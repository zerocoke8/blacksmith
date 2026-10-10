// The best line when every turn is 보통: an exact search for balance tests and tools.
// It mirrors engine.applyAction for the 보통 condition on a packed numeric state; the
// balance tests replay every answer through the real engine.
//
// Moves that cannot change the answer are folded away:
// - 불 다시 보기 is left out (re-rolling 보통 gives 보통).
// - 대장장이의 감 is used right before the good-only action it allows (it costs nothing).
// - 최후의 한 수 is used right before the progress action it stops (it uses no turn).
//
// Branch and bound keeps it fast: a branch is dropped when even a generous estimate of the
// quality still to come cannot beat the best line found so far (see qualityBound).
//
// Quality past the cap is worth nothing (the engine stops the gauge there). When some line
// can reach the cap, the answer is the fewest turns among the lines that do (reachTurns),
// not the line that would overfill it most.

import { BUFF_BONUS, CRAFT_ACTIONS, type CraftActionId, INNER_QUIET } from '../data/craft.ts';
import type { CraftSetup, CraftState } from './engine.ts';
import { recipeFor } from './recipe.ts';
import { smithStats } from './smith.ts';

export interface AllNormalLine {
  /** Quality the line makes, capped at the recipe's quality cap. */
  quality: number;
  /** Quality as a share of the cap, 0..1. */
  ratio: number;
  /** Best quality any line makes without the cap, as a share of the cap (past 1 = room to spare). */
  uncapped: number;
  /** Turns used (free actions do not count): the fewest among lines of this quality. */
  turns: number;
  /** Actions in order, free ones included, ready for applyAction. */
  actions: CraftActionId[];
  /** States the search stored. */
  states: number;
}

/** Open-addressing map from packed state (a whole number below 2^53) to a value and a flag. */
class StateTable {
  keys: Float64Array;
  values: Float64Array;
  exact: Uint8Array;
  size = 0;
  mask: number;
  /** Slot of the last lookup. */
  private at = 0;

  constructor() {
    this.mask = (1 << 16) - 1;
    this.keys = new Float64Array(this.mask + 1).fill(-1);
    this.values = new Float64Array(this.mask + 1);
    this.exact = new Uint8Array(this.mask + 1);
  }

  private slot(key: number): number {
    const lo = key % 4294967296 | 0;
    const hi = (key / 4294967296) | 0;
    let h = Math.imul(lo ^ Math.imul(hi, 0x9e3779b1), 0x85ebca6b);
    h ^= h >>> 15;
    let i = h & this.mask;
    while (this.keys[i] !== -1 && this.keys[i] !== key) i = (i + 1) & this.mask;
    return i;
  }

  /** True if the key is stored; read value and isExact afterwards. */
  find(key: number): boolean {
    this.at = this.slot(key);
    return this.keys[this.at] === key;
  }

  get value(): number {
    return this.values[this.at] as number;
  }

  get isExact(): boolean {
    return this.exact[this.at] === 1;
  }

  set(key: number, value: number, exact: boolean): void {
    if ((this.size + 1) * 2 > this.mask + 1) this.grow();
    const i = this.slot(key);
    if (this.keys[i] !== key) {
      this.keys[i] = key;
      this.size += 1;
    }
    this.values[i] = value;
    this.exact[i] = exact ? 1 : 0;
  }

  private grow(): void {
    const { keys, values, exact } = this;
    this.mask = this.mask * 2 + 1;
    this.keys = new Float64Array(this.mask + 1).fill(-1);
    this.values = new Float64Array(this.mask + 1);
    this.exact = new Uint8Array(this.mask + 1);
    this.size = 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i] as number;
      if (k !== -1) this.set(k, values[i] as number, exact[i] === 1);
    }
  }
}

/** Same rounding as the engine (floorGain). */
function floorGain(x: number): number {
  return Math.floor(x + 1e-6);
}

/** value = quality × TURN_WEIGHT − turns: more quality wins, then fewer turns. */
const TURN_WEIGHT = 256;

/** Unpacked search state. Buff fields hold turns left. */
interface Node {
  p: number;
  d: number;
  c: number;
  iq: number;
  inn: number;
  ven: number;
  wn: number;
  man: number;
  gs: number;
  mm: number;
  first: number;
  /** 대장장이의 감 still unused. */
  hs: number;
}

/** One turn, with the free actions folded in front of it. */
interface Move {
  /** Engine actions in order: free ones first, then the turn's action. */
  actions: CraftActionId[];
  id: CraftActionId;
  /** 최후의 한 수 right before it. */
  appraised: boolean;
}

const DONE = 'done';

function buffTurns(id: CraftActionId): number {
  return CRAFT_ACTIONS[id].buff?.turns ?? 0;
}

interface Search {
  start: Node;
  cap: number;
  /** Best value from `n` with no cap; exact when above `alpha`, else some upper bound ≤ alpha. */
  value(n: Node, alpha: number): number;
  /** Fewest turns from `n` that finish the work and gain at least `need` quality (Infinity if none). */
  reachTurns(n: Node, need: number): number;
  /** Exact best value from `n` when quality past `need` is worth nothing. */
  cappedValue(n: Node, need: number): number;
  moves: Move[];
  turn(n: Node, m: Move): Node | typeof DONE | null;
  /** Quality made by the last turn() call. */
  lastGain(): number;
  states(): number;
  /** The search state for an engine state of this craft, or null if it has none. */
  fromState(state: CraftState): Node | null;
}

function makeSearch(setup: CraftSetup): Search {
  const recipe = recipeFor(setup.recipe);
  const stats = smithStats(setup.smith);
  const maxD = recipe.durability + stats.durabilityBonus;
  const maxCp = stats.maxCp;
  const req = recipe.progressRequired;
  const known = new Set(stats.actions);
  const hasHs = known.has('heartAndSoul');
  const hasFa = known.has('finalAppraisal');
  const faCp = CRAFT_ACTIONS.finalAppraisal.cp;

  const moves: Move[] = [];
  for (const id of stats.actions) {
    const spec = CRAFT_ACTIONS[id];
    if (spec.free) continue;
    if (spec.requires === 'goodCondition' && !hasHs) continue;
    const prefix: CraftActionId[] = spec.requires === 'goodCondition' ? ['heartAndSoul'] : [];
    moves.push({ actions: [...prefix, id], id, appraised: false });
    if (hasFa && spec.progress > 0) moves.push({ actions: [...prefix, 'finalAppraisal', id], id, appraised: true });
  }

  const radix = {
    d: maxD + 1,
    c: maxCp + 1,
    iq: INNER_QUIET.max + 1,
    inn: buffTurns('innovation') + 1,
    ven: buffTurns('veneration') + 1,
    wn: buffTurns('wasteNot') + 1,
    man: buffTurns('manipulation') + 1,
    gs: buffTurns('greatStrides') + 1,
    mm: buffTurns('muscleMemory') + 1,
  };
  const span = Object.values(radix).reduce((a, b) => a * b, req * 2 * 2);
  if (span > Number.MAX_SAFE_INTEGER) throw new RangeError('solveAllNormal: this craft is too big for a packed state');

  const pack = (n: Node): number => {
    let k = n.p;
    k = k * radix.d + n.d;
    k = k * radix.c + n.c;
    k = k * radix.iq + n.iq;
    k = k * radix.inn + n.inn;
    k = k * radix.ven + n.ven;
    k = k * radix.wn + n.wn;
    k = k * radix.man + n.man;
    k = k * radix.gs + n.gs;
    k = k * radix.mm + n.mm;
    k = k * 2 + n.first;
    return k * 2 + n.hs;
  };

  let gain = 0;

  /** The state after `move` under 보통, DONE if it finishes the work, null if not allowed or it breaks. */
  const turn = (n: Node, move: Move): Node | typeof DONE | null => {
    const { id, appraised } = move;
    const spec = CRAFT_ACTIONS[id];
    if (spec.requires === 'firstTurn' && n.first === 0) return null;
    if (spec.requires === 'goodCondition' && n.hs === 0) return null;
    if (spec.requires === 'innerQuiet' && n.iq < 1) return null;
    const cpCost = spec.cp + (appraised ? faCp : 0);
    if (cpCost > n.c) return null;

    let { p, d, c, iq, inn, ven, wn, man, gs, mm, hs } = n;
    c -= cpCost;
    if (spec.requires === 'goodCondition') hs = 0;

    if (spec.progress > 0) {
      const bonus = 1 + (ven > 0 ? BUFF_BONUS.veneration : 0) + (mm > 0 ? BUFF_BONUS.muscleMemory : 0);
      mm = 0;
      let next = p + floorGain(stats.craftsmanship * spec.progress * bonus * 1);
      if (appraised) {
        if (next < req) return null; // only right before the action it stops
        next = req - 1;
      }
      p = Math.max(p, next);
    }

    gain = 0;
    if (spec.quality > 0) {
      const finisher = id === 'byregotsBlessing';
      const efficiency = finisher ? spec.quality * (1 + iq * INNER_QUIET.finisherPerStack) : spec.quality;
      const bonus = 1 + (inn > 0 ? BUFF_BONUS.innovation : 0) + (gs > 0 ? BUFF_BONUS.greatStrides : 0);
      gs = 0;
      gain = floorGain(stats.control * efficiency * (1 + iq * INNER_QUIET.qualityPerStack) * bonus * 1);
      iq = finisher ? 0 : Math.min(INNER_QUIET.max, iq + spec.innerQuiet);
    }

    const durCost = Math.ceil(spec.durability * (wn > 0 ? BUFF_BONUS.wasteNot : 1) * 1);
    d = Math.min(maxD, Math.max(0, d - durCost) + spec.restoreDurability);
    c = Math.min(maxCp, c + spec.restoreCp);

    if (p >= req) return DONE;
    if (d <= 0) return null;
    if (man > 0 && id !== 'manipulation') d = Math.min(maxD, d + BUFF_BONUS.manipulation);

    if (inn > 0) inn -= 1;
    if (ven > 0) ven -= 1;
    if (wn > 0) wn -= 1;
    if (man > 0) man -= 1;
    if (gs > 0) gs -= 1;
    if (mm > 0) mm -= 1;
    if (spec.buff) {
      const t = spec.buff.turns;
      const b = spec.buff.id;
      if (b === 'innovation') inn = t;
      else if (b === 'veneration') ven = t;
      else if (b === 'wasteNot') wn = t;
      else if (b === 'manipulation') man = t;
      else if (b === 'greatStrides') gs = t;
      else if (b === 'muscleMemory') mm = t;
    }
    return { p, d, c, iq, inn, ven, wn, man, gs, mm, first: 0, hs };
  };

  const bound = qualityBound(stats.actions, stats.control, maxCp, maxD);
  const memo = new StateTable();

  const value = (n: Node, alpha: number): number => {
    const k = pack(n);
    if (memo.find(k) && (memo.isExact || memo.value <= alpha)) return memo.value;

    const kids: { next: Node | typeof DONE; here: number; ub: number }[] = [];
    for (const m of moves) {
      const next = turn(n, m);
      if (next === null) continue;
      const here = gain * TURN_WEIGHT - 1;
      const ub = next === DONE ? here : here + bound(next) * TURN_WEIGHT - 1;
      kids.push({ next, here, ub });
    }
    kids.sort((a, b) => b.ub - a.ub);

    let best = Number.NEGATIVE_INFINITY;
    for (const kid of kids) {
      const floor = Math.max(alpha, best);
      if (kid.ub <= floor) {
        // Sorted: no later child can beat it either. Its bound still caps this node.
        best = Math.max(best, kid.ub);
        break;
      }
      const v = kid.next === DONE ? kid.here : kid.here + value(kid.next, floor - kid.here);
      if (v > best) best = v;
    }
    memo.set(k, best, best > alpha);
    return best;
  };

  // Fewest turns to finish, quality aside. Moves that only add quality never help, so 열기,
  // 풀무질 and 혼신 drop out of the key; 최후의 한 수 only ever delays the finish.
  const finishMoves = moves.filter(({ id, appraised }) => {
    const spec = CRAFT_ACTIONS[id];
    if (appraised || id === 'innovation' || id === 'greatStrides') return false;
    return spec.progress > 0 || spec.restoreDurability > 0 || spec.restoreCp > 0 || spec.buff !== null;
  });
  const finishMemo = new StateTable();
  const finishTurns = (from: Node): number => {
    const n: Node = { ...from, iq: 0, inn: 0, gs: 0 };
    const k = pack(n);
    if (finishMemo.find(k)) return finishMemo.value;
    let best = Number.POSITIVE_INFINITY;
    for (const m of finishMoves) {
      const next = turn(n, m);
      if (next === null) continue;
      const t = next === DONE ? 1 : 1 + finishTurns(next);
      if (t < best) best = t;
    }
    finishMemo.set(k, best, true);
    return best;
  };

  /** Some line from `n` gains `need` (cheap when none does: most branches are cut). */
  const canReach = (n: Node, need: number): boolean => value(n, (need - 1) * TURN_WEIGHT) > (need - 1) * TURN_WEIGHT;

  const reachMemo = new Map<number, Map<number, number>>();
  const reachTurns = (n: Node, need: number): number => {
    if (need <= 0) return finishTurns(n);
    if (!canReach(n, need)) return Number.POSITIVE_INFINITY;
    const k = pack(n);
    let byNeed = reachMemo.get(k);
    const hit = byNeed?.get(need);
    if (hit !== undefined) return hit;
    let best = Number.POSITIVE_INFINITY;
    for (const m of moves) {
      const next = turn(n, m);
      if (next === null) continue;
      const g = gain;
      if (next === DONE) {
        if (g >= need) best = 1;
        continue;
      }
      // Every line from `next` takes at least its fewest turns to finish.
      const floor = 1 + finishTurns(next);
      if (floor >= best) continue;
      best = Math.min(best, need - g <= 0 ? floor : 1 + reachTurns(next, need - g));
    }
    if (byNeed === undefined) {
      byNeed = new Map();
      reachMemo.set(k, byNeed);
    }
    byNeed.set(need, best);
    return best;
  };

  const cappedValue = (n: Node, need: number): number => {
    const v = value(n, Number.NEGATIVE_INFINITY);
    // Short of `need`, no line overfills, so the plain best stands.
    if (!Number.isFinite(v) || Math.ceil(v / TURN_WEIGHT) < need) return v;
    return need * TURN_WEIGHT - reachTurns(n, need);
  };

  const start: Node = {
    p: 0,
    d: maxD,
    c: maxCp,
    iq: 0,
    inn: 0,
    ven: 0,
    wn: 0,
    man: 0,
    gs: 0,
    mm: 0,
    first: 1,
    hs: hasHs ? 1 : 0,
  };

  const fromState = (state: CraftState): Node | null => {
    // 최후의 한 수 waiting on its own is never needed when every turn is 보통 (see the top).
    if (state.status !== 'active' || state.buffs.finalAppraisal > 0) return null;
    const { buffs } = state;
    const hsLeft = hasHs && (state.heartAndSoul || (state.uses.heartAndSoul ?? 0) === 0);
    return {
      p: state.progress,
      d: state.durability,
      c: state.cp,
      iq: state.innerQuiet,
      inn: buffs.innovation,
      ven: buffs.veneration,
      wn: buffs.wasteNot,
      man: buffs.manipulation,
      gs: buffs.greatStrides,
      mm: buffs.muscleMemory,
      first: state.turn === 0 ? 1 : 0,
      hs: hsLeft ? 1 : 0,
    };
  };

  return {
    start,
    cap: recipe.qualityCap,
    value,
    reachTurns,
    cappedValue,
    moves,
    turn,
    lastGain: () => gain,
    states: () => memo.size + finishMemo.size,
    fromState,
  };
}

/**
 * A quick, never-too-low estimate of the quality still to come from a state, used to cut
 * branches. It drops the progress gauge, lets durability be bought at 담금질's rate (the
 * cheapest there is for 10-durability actions: 단조 유지 and 아껴 치기 cost more per point) and
 * pools it with CP, then plays only quality actions and their buffs on that one budget.
 */
function qualityBound(
  actions: readonly CraftActionId[],
  control: number,
  maxCp: number,
  maxD: number,
): (n: Node) => number {
  const mend = CRAFT_ACTIONS.mastersMend;
  // One CP = mend.restoreDurability units, one durability = mend.cp units.
  const perCp = mend.restoreDurability;
  const perDur = mend.cp;
  const tricksCp = actions.includes('tricksOfTheTrade') ? CRAFT_ACTIONS.tricksOfTheTrade.restoreCp : 0;
  const manipPerTurn = BUFF_BONUS.manipulation;

  interface QAction {
    id: CraftActionId;
    cost: number;
  }
  const relaxed: QAction[] = [];
  let maxQualityDur = 0;
  for (const id of actions) {
    const spec = CRAFT_ACTIONS[id];
    const usable = spec.quality > 0 || id === 'innovation' || id === 'greatStrides';
    if (!usable) continue;
    if (spec.quality > 0) maxQualityDur = Math.max(maxQualityDur, spec.durability);
    // Whole CP steps, rounded down so the estimate stays high.
    relaxed.push({ id, cost: Math.floor((spec.cp * perCp + spec.durability * perDur) / perCp) });
  }
  const wasteNotSave = maxQualityDur * (1 - BUFF_BONUS.wasteNot);

  const R = {
    iq: INNER_QUIET.max + 1,
    inn: buffTurns('innovation') + 1,
    gs: buffTurns('greatStrides') + 1,
  };
  const maxBudget =
    Math.ceil(((maxCp + tricksCp) * perCp + (maxD + manipPerTurn * buffTurns('manipulation') + wasteNotSave * buffTurns('wasteNot')) * perDur) / perCp) + 1;
  const table = new Float64Array((maxBudget + 1) * R.iq * R.inn * R.gs * 4).fill(-1);

  // Best relaxed quality from (budget in CP steps, 열기, buffs, first turn, 대장장이의 감).
  const best = (b: number, iq: number, inn: number, gs: number, first: number, hs: number): number => {
    const idx = ((((b * R.iq + iq) * R.inn + inn) * R.gs + gs) * 2 + first) * 2 + hs;
    const hit = table[idx] as number;
    if (hit >= 0) return hit;
    let top = 0;
    for (const a of relaxed) {
      if (a.cost > b) continue;
      const spec = CRAFT_ACTIONS[a.id];
      if (spec.requires === 'firstTurn' && first === 0) continue;
      if (spec.requires === 'goodCondition' && hs === 0) continue;
      if (spec.requires === 'innerQuiet' && iq < 1) continue;
      let g = 0;
      let nIq = iq;
      let nGs = gs;
      if (spec.quality > 0) {
        const finisher = a.id === 'byregotsBlessing';
        const efficiency = finisher ? spec.quality * (1 + iq * INNER_QUIET.finisherPerStack) : spec.quality;
        const bonus = 1 + (inn > 0 ? BUFF_BONUS.innovation : 0) + (gs > 0 ? BUFF_BONUS.greatStrides : 0);
        g = floorGain(control * efficiency * (1 + iq * INNER_QUIET.qualityPerStack) * bonus * 1);
        nIq = finisher ? 0 : Math.min(INNER_QUIET.max, iq + spec.innerQuiet);
        nGs = 0;
      }
      let nInn = inn > 0 ? inn - 1 : 0;
      nGs = nGs > 0 ? nGs - 1 : 0;
      if (a.id === 'innovation') nInn = buffTurns('innovation');
      if (a.id === 'greatStrides') nGs = buffTurns('greatStrides');
      const nHs = spec.requires === 'goodCondition' ? 0 : hs;
      const v = g + best(b - a.cost, nIq, nInn, nGs, 0, nHs);
      if (v > top) top = v;
    }
    table[idx] = top;
    return top;
  };

  return (n: Node) => {
    const units = (n.c + tricksCp * n.hs) * perCp + (n.d + manipPerTurn * n.man + wasteNotSave * n.wn) * perDur;
    const b = Math.min(maxBudget, Math.ceil(units / perCp));
    return best(b, n.iq, n.inn, n.gs, n.first, n.hs);
  };
}

/** Walks the best line down from the start (value() and reachTurns() are exact from it). */
function bestLine(s: Search): AllNormalLine {
  const actions: CraftActionId[] = [];
  let quality = 0;
  let turns = 0;
  const most = Math.ceil(s.value(s.start, Number.NEGATIVE_INFINITY) / TURN_WEIGHT);
  // Quality still worth having: the rest of the cap once some line can fill it, else no limit.
  let need = most >= s.cap ? s.cap : Number.POSITIVE_INFINITY;
  let n: Node | null = s.start;
  while (n !== null) {
    const from: Node = n;
    const capped = Number.isFinite(need);
    const here = capped ? s.reachTurns(from, need) : s.value(from, Number.NEGATIVE_INFINITY);
    let picked: { m: Move; next: Node | typeof DONE; g: number } | null = null;
    for (const m of s.moves) {
      const next = s.turn(from, m);
      if (next === null) continue;
      const g = s.lastGain();
      let hit: boolean;
      if (capped) {
        // The fewest turns that still fill the cap: this move plus the rest's fewest.
        hit = next === DONE ? g >= need && here === 1 : 1 + s.reachTurns(next, need - g) === here;
      } else {
        // The rest of the line must be worth exactly this much; asking for just above
        // rest − 1 keeps the check cheap for children that cannot get there.
        const rest = here - (g * TURN_WEIGHT - 1);
        hit = next === DONE ? rest === 0 : s.value(next, rest - 1) === rest;
      }
      if (hit) {
        picked = { m, next, g };
        break;
      }
    }
    if (picked === null) break;
    actions.push(...picked.m.actions);
    quality += picked.g;
    need -= picked.g;
    turns += 1;
    n = picked.next === DONE ? null : picked.next;
  }
  const capped = Math.min(s.cap, quality);
  return { quality: capped, ratio: capped / s.cap, uncapped: most / s.cap, turns, actions, states: s.states() };
}

/**
 * Best quality over every line from the start of this setup, assuming 보통 on every turn;
 * ties go to the shorter line, and every line that fills the cap ties. Exact.
 */
export function solveAllNormal(setup: CraftSetup): AllNormalLine {
  const s = makeSearch(setup);
  if (!Number.isFinite(s.value(s.start, Number.NEGATIVE_INFINITY))) {
    return { quality: 0, ratio: 0, uncapped: 0, turns: 0, actions: [], states: s.states() };
  }
  return bestLine(s);
}

/**
 * Whether some line reaches `ratio` of the quality cap when every turn is 보통. Exact, and
 * much faster than solveAllNormal when the answer is no (most branches are cut early).
 */
export function reachesAllNormal(setup: CraftSetup, ratio: number): boolean {
  const s = makeSearch(setup);
  const target = Math.ceil(s.cap * ratio - 1e-9);
  // value > (target − 1) × TURN_WEIGHT ⇔ quality ≥ target, since a line has under TURN_WEIGHT turns.
  return s.value(s.start, (target - 1) * TURN_WEIGHT) > (target - 1) * TURN_WEIGHT;
}

/**
 * What is still to come from a state of this craft if every later turn is 보통: the best
 * quality still to gain, up to the room left under the cap, and the fewest turns that
 * gain it; or null if the work cannot be finished. For players that re-plan every turn
 * (balance checks). Searches are kept between calls, so one outlook serves many crafts of
 * the same setup.
 */
export function allNormalOutlook(setup: CraftSetup): (state: CraftState) => { quality: number; turns: number } | null {
  const s = makeSearch(setup);
  return (state) => {
    const n = s.fromState(state);
    if (n === null) return null;
    const v = s.cappedValue(n, Math.max(0, s.cap - state.quality));
    if (!Number.isFinite(v)) return null;
    // v = quality × TURN_WEIGHT − turns, with 1 ≤ turns < TURN_WEIGHT (max: no −0).
    const quality = Math.max(0, Math.ceil(v / TURN_WEIGHT));
    return { quality, turns: quality * TURN_WEIGHT - v };
  };
}
