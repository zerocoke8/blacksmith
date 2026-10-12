// Measuring bots for the card craft (기획서 4.2.1 초벌 측정, 16.3). They only call the
// engine's public functions, like a player at the screen would.
//
// - 단순 봇: plays from the hand in a fixed priority (첫 손, 담금질, progress, buffs, quality,
//   마무리 last), keeps enough durability for the hammers it still needs, and holds the
//   finishing card while the reheated iron could still take two more cards (it knows the
//   finishing card can be swung as 막타 on any durability left).
// - 따져 보는 봇: plans the whole turn (every distinct order of the hand, orders that reach
//   the same state merged) and judges each plan by playing the rest of the craft out many
//   times with the 단순 봇 (successive halving). It knows what is left in the 뽑을 더미
//   (덱 세기) but not the order, nor future fire states: each playout redraws both.

import { rngFor } from '../../src/sim/core/rng.ts';
import {
  abandonCardCraft,
  adamantPlus,
  blockReason,
  cardCost,
  type CardCraftOutcome,
  type CardCraftSetup,
  type CardCraftState,
  cardCraftOutcome,
  cardIdOf,
  cardTurnSummary,
  checkPlay,
  endTurn,
  type PlayOptions,
  playCard,
  reheatInfo,
  startCardCraft,
} from '../../src/sim/cards/index.ts';
import {
  BUFF_IDS,
  BUFFS,
  type CardEffect,
  type CardId,
  CARDS,
  CHARGE_IDS,
  CHARGES,
  FIRE_EFFECT,
  GOOD_FIRE,
} from '../../src/sim/data/cards.ts';

export type BotAction = { kind: 'play'; uid: string; opts?: PlayOptions } | { kind: 'end'; keep: string[] };

export interface Bot {
  name: string;
  decide(state: CardCraftState): BotAction;
}

// ---------- Card facts for bots ----------

function flatEffects(effects: readonly CardEffect[]): CardEffect[] {
  return effects.flatMap((e) => (e.type === 'ifGoodFire' ? [...flatEffects(e.then), ...flatEffects(e.otherwise)] : [e]));
}

const FACTS = new Map<CardId, { progress: boolean; quality: boolean; restore: number; finisher: boolean }>();
function facts(id: CardId): { progress: boolean; quality: boolean; restore: number; finisher: boolean } {
  let f = FACTS.get(id);
  if (f === undefined) {
    const effects = flatEffects(CARDS[id].effects);
    f = {
      progress: effects.some((e) => e.type === 'progress' || e.type === 'fillProgress'),
      quality: effects.some((e) => e.type === 'quality' || e.type === 'finish'),
      restore: effects.reduce((n, e) => (e.type === 'restore' ? n + e.amount : n), 0),
      finisher: effects.some((e) => e.type === 'finish'),
    };
    FACTS.set(id, f);
  }
  return f;
}

/**
 * Fixed priority of the 단순 봇: first-hand cards, durability, progress (with its buffs), fire
 * cards, quality buffs, quality cards, and the 마무리 family last.
 */
const SIMPLE_ORDER: readonly CardId[] = [
  'firstHammer',
  'firstTouch',
  'firstFlame',
  'firstBreath',
  'quench',
  'deepQuench',
  'sprinkle',
  'deepWater',
  'keepForging',
  'layeredShell',
  'thrift',
  'heatUp',
  'steelFold',
  'giantHammer',
  'bigStrike',
  'solidHammer',
  'heavyHammer',
  'carefulHammer',
  'hammer',
  'lightHammer',
  'lastStroke',
  'smithSense',
  'dragonBreath',
  'tailwind',
  'reread',
  'kindle',
  'stormBellows',
  'bellows',
  'strongBellows',
  'longBellows',
  'allIn',
  'fullForce',
  'evenForce',
  'rekindle',
  'flameMatch',
  'precisePolish',
  'keenEye',
  'orichalcumGlow',
  'mithrilGrain',
  'ironMelt',
  'adamantCore',
  'carefulTouch',
  'thoroughPolish',
  'polish',
  'quickPolish',
  'grandFinish',
  'finisher',
  'halfFinish',
  'frostFinish',
];
const RANK = new Map<CardId, number>(SIMPLE_ORDER.map((id, i) => [id, i]));
const rank = (id: CardId): number => RANK.get(id) ?? SIMPLE_ORDER.length;

function handIds(state: CardCraftState): CardId[] {
  return state.hand.map((u) => cardIdOf(state, u));
}

/** Durability the 단순 봇 keeps for the progress it still needs (the last hammer may be 막타). */
function progressReserve(state: CardCraftState): number {
  const left = state.recipe.progressRequired - state.progress;
  if (left <= 0) return 0;
  const hammers = Math.ceil(left / state.smith.craftsmanship);
  let inHand = 0;
  for (const id of handIds(state)) if (facts(id).progress && CARDS[id].kind !== 'material') inHand += 1;
  const reheat = inHand >= hammers ? 0 : Math.max(0, -reheatInfo(state).durability);
  // The last hammer may be 막타, but the iron must still be whole (≥ 1) to swing it.
  return (hammers - 1) * TYPICAL_COST + 1 + reheat;
}

/**
 * checkPlay without the full simulation when the card cannot fill the 공정: only cards that
 * raise progress can be 막타 or finish, so only they need the engine's dry run.
 */
function quickCheck(state: CardCraftState, uid: string, opts: PlayOptions): { cost: number; finishes: boolean; breaks: boolean } | null {
  const id = cardIdOf(state, uid);
  if (blockReason(state, uid) !== null) return null;
  const f = facts(id);
  if ((f.progress && couldFinish(state, id)) || endsTurn(id)) {
    const c = checkPlay(state, uid, opts);
    return c.ok ? c : null;
  }
  const cost = cardCost(state, uid);
  if (cost > state.durability) return null;
  const restored = state.durability - cost + f.restore;
  const after = id === 'deepWater' ? restored : Math.max(state.durability - cost, Math.min(state.maxDurability, restored));
  return { cost, finishes: false, breaks: after <= 0 };
}

/** Best case of the card's progress (every buff and charge on) reaches the 공정 needed. */
function couldFinish(state: CardCraftState, id: CardId): boolean {
  const effects = flatEffects(CARDS[id].effects);
  if (effects.some((e) => e.type === 'fillProgress')) return true;
  const plus = id === 'adamantCore' ? adamantPlus(state.recipe.materialTier) : 0;
  let ratio = 0;
  for (const e of effects) if (e.type === 'progress') ratio += e.ratio + plus;
  let bonus = 0;
  for (const b of BUFF_IDS) {
    const eff = BUFFS[b].effect;
    if ((state.buffs[b] ?? 0) > 0 && eff.kind === 'progress') bonus += eff.bonus;
  }
  for (const c of CHARGE_IDS) if (state.charges[c] !== undefined && CHARGES[c].gauge === 'progress') bonus += CHARGES[c].bonus;
  const best = state.smith.craftsmanship * ratio * (1 + bonus) * FIRE_EFFECT[state.fire].progress + 1;
  return state.progress + best >= state.recipe.progressRequired;
}

function endsTurn(id: CardId): boolean {
  return flatEffects(CARDS[id].effects).some((e) => e.type === 'endTurn');
}

function isGood(state: CardCraftState): boolean {
  return GOOD_FIRE.includes(state.fire);
}

/**
 * The 단순 봇 does not finish while the reheated iron would still take this many more cards:
 * it ends the turn and keeps polishing instead, then finishes with 막타.
 */
const HOLD_FINISH_CARDS = 2;
const TYPICAL_COST = 3;

function shouldFinish(state: CardCraftState): boolean {
  if (state.quality >= state.recipe.qualityCap) return true;
  // 막타: the finishing card can be swung on whatever durability is left, so its own cost does
  // not count. Holding it pays while the iron, once reheated, still has room for
  // HOLD_FINISH_CARDS more cards (and stays whole, ≥ 1).
  const afterReheat = state.durability + reheatInfo(state).durability;
  return afterReheat - HOLD_FINISH_CARDS * TYPICAL_COST < 1;
}

function simplePick(state: CardCraftState): BotAction | null {
  const reserve = progressReserve(state);
  const order = [...state.hand].sort((a, b) => rank(cardIdOf(state, a)) - rank(cardIdOf(state, b)));
  const ids = handIds(state);
  const qualityLeft = (except: string): boolean =>
    state.hand.some((u) => u !== except && facts(cardIdOf(state, u)).quality && blockReason(state, u) === null);
  const progressLeft = (except: string): boolean =>
    state.hand.some((u) => u !== except && facts(cardIdOf(state, u)).progress && blockReason(state, u) === null);
  let finishing: string | null = null;
  for (const uid of order) {
    const id = cardIdOf(state, uid);
    const f = facts(id);
    const spec = CARDS[id];
    const opts: PlayOptions = id === 'rekindle' ? { targets: recallTargets(state) } : {};
    const check = quickCheck(state, uid, opts);
    if (check === null || check.breaks) continue;
    if (check.finishes) {
      finishing ??= uid;
      continue;
    }
    const after = state.durability - check.cost;
    // 첫 손 cards only work now; pure progress cards are needed anyway (and get dearer under 식는 쇠).
    if (spec.keywords.firstHand === true || (f.progress && !f.quality)) return { kind: 'play', uid };
    if (f.restore > 0 && !f.quality) {
      // Only when none of it is wasted (4.2.10: 담금질은 가득일 때 내면 버려진다).
      if (state.durability + f.restore <= state.maxDurability || id === 'deepWater') return { kind: 'play', uid };
      continue;
    }
    if (after < reserve) continue;
    if (id === 'thrift' || id === 'heatUp') {
      if (!progressLeft(uid)) continue;
      return { kind: 'play', uid };
    }
    if (id === 'reread' && (isGood(state) || ids.filter((x) => facts(x).quality).length < 2)) continue;
    if (spec.kind === 'support' && !f.quality && !f.progress && id !== 'reread' && id !== 'kindle') {
      // A buff is worth it only with a quality card to follow.
      if (!qualityLeft(uid) || after - TYPICAL_COST < reserve) continue;
    }
    if (f.finisher && id !== 'frostFinish' && state.heat < 3 && qualityLeft(uid)) continue;
    return { kind: 'play', uid, opts };
  }
  if (finishing !== null && shouldFinish(state)) return { kind: 'play', uid: finishing };
  return null;
}

function recallTargets(state: CardCraftState): string[] {
  return [...state.discard].sort((a, b) => rank(cardIdOf(state, a)) - rank(cardIdOf(state, b))).slice(0, 3);
}

/** Hand cards in the order the 단순 봇 would keep them: 마무리 first when hot, then its priority. */
function rankedKeep(state: CardCraftState): string[] {
  const candidates = state.hand.filter((u) => CARDS[cardIdOf(state, u)].keywords.retain !== true);
  const score = (u: string): number => {
    const id = cardIdOf(state, u);
    if (facts(id).finisher && state.heat >= 3) return -1;
    return rank(id);
  };
  return candidates.sort((a, b) => score(a) - score(b));
}

/** What the 단순 봇 keeps at 다시 달구기. */
function simpleKeep(state: CardCraftState): string[] {
  const n = reheatInfo(state).keep;
  return n <= 0 ? [] : rankedKeep(state).slice(0, n);
}

/** The 따져 보는 봇 tries keeping pairs only among this many best-ranked cards. */
const PAIR_POOL = 4;

export const simpleBot: Bot = {
  name: '단순 봇',
  decide(state) {
    return simplePick(state) ?? { kind: 'end', keep: simpleKeep(state) };
  },
};

// ---------- 따져 보는 봇 ----------

/** Final score of a finished craft: the quality share, or −1 for a failure. */
function score(state: CardCraftState): number {
  if (state.status === 'success') return state.quality / state.recipe.qualityCap;
  return -1;
}

function apply(state: CardCraftState, action: BotAction): CardCraftState {
  return action.kind === 'play' ? playCard(state, action.uid, action.opts ?? {}) : endTurn(state, action.keep);
}

/**
 * The same craft with the hidden parts redrawn: the 뽑을 더미 reshuffled and the fire (and
 * later shuffles) re-seeded. What the player can see stays. The same `world` number gives
 * the same redraw for every plan of this turn (common random numbers).
 */
function determinize(state: CardCraftState, world: number): CardCraftState {
  const rng = rngFor(state.setup.seed, 'bot', state.setup.craftNo, state.turn, world);
  // Start from a fixed order so the real (hidden) order cannot leak into the redraw.
  const pile = [...state.drawPile].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (let i = pile.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = pile[i] as string;
    pile[i] = pile[j] as string;
    pile[j] = t;
  }
  // A stream of its own too: the redrawn fire and shuffles owe nothing to the real ones.
  return { ...state, drawPile: pile, setup: { ...state.setup, seed: rng.nextUint32(), stream: BOT_STREAM } };
}

/** Random stream of the redrawn worlds (never the real 'craft'). */
const BOT_STREAM = 'botWorld';

function playout(state: CardCraftState, maxTurns: number): number {
  let s = state;
  while (s.status === 'active') {
    if (s.turn > maxTurns) return -1;
    s = apply(s, simpleBot.decide(s));
  }
  return score(s);
}

/** Keep choices worth trying: none, each single card, and pairs among the 단순 봇's top picks. */
function keepOptions(state: CardCraftState): string[][] {
  const n = reheatInfo(state).keep;
  const free = state.hand.filter((u) => CARDS[cardIdOf(state, u)].keywords.retain !== true);
  const top = simpleKeep(state).length > 0 ? rankedKeep(state).slice(0, PAIR_POOL) : [];
  // Distinct by card id: keeping either 다듬기 is the same choice.
  const seen = new Set<string>();
  const out: string[][] = [];
  const add = (keep: string[]): void => {
    const key = keep
      .map((u) => cardIdOf(state, u))
      .sort()
      .join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(keep);
  };
  add([]);
  if (n >= 1) for (const a of free) add([a]);
  if (n >= 2) {
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) add([top[i] as string, top[j] as string]);
    }
  }
  return out;
}

/** Cards whose effect shows something hidden (a draw, a fire roll, the next hand). A plan stops at them. */
function revealsHidden(id: CardId): boolean {
  return flatEffects(CARDS[id].effects).some((e) => e.type === 'draw' || e.type === 'reroll' || e.type === 'endTurn');
}

/** Everything about a mid-turn state except quality: two plans that reach it differ only in quality. */
function signature(s: CardCraftState): string {
  const hand = s.hand
    .map((u) => cardIdOf(s, u))
    .sort()
    .join(',');
  const buffs = Object.entries(s.buffs)
    .map(([k, n]) => `${k}:${n}`)
    .sort()
    .join(';');
  const charges = Object.entries(s.charges)
    .map(([k, c]) => `${k}:${c?.left}/${c?.turns}`)
    .sort()
    .join(';');
  return [
    hand,
    s.progress,
    s.durability,
    s.heat,
    s.fire,
    buffs,
    charges,
    s.nextCardDiscount,
    s.playedThisTurn,
    s.extraDrawNextTurn,
    s.maintainReheats,
    s.shellReheatCost,
    s.rerollsUsed,
  ].join('|');
}

interface PlanNode {
  state: CardCraftState;
  steps: BotAction[];
}

interface Leaf {
  /** Actions on the real state that reveal nothing. */
  steps: BotAction[];
  /** The state after `steps`. */
  state: CardCraftState;
  /** The last action, done in each redrawn world (it may reveal something), or null if the craft is over. */
  last: BotAction | null;
  total: number;
  runs: number;
}

/**
 * Every distinct way to play out this turn (orders that end in the same state merge, keeping
 * the better quality), each ending in 다시 달구기 (with each keep choice), in a finishing card,
 * or in a card that reveals something.
 */
function planLeaves(state: CardCraftState): Leaf[] {
  const leaves: Leaf[] = [];
  let layer: PlanNode[] = [{ state, steps: [] }];
  while (layer.length > 0) {
    const next = new Map<string, PlanNode>();
    for (const node of layer) {
      const s = node.state;
      if (!reheatInfo(s).breaks) {
        leaves.push({ steps: node.steps, state: s, last: { kind: 'end', keep: simpleKeep(s) }, total: 0, runs: 0 });
      }
      const seen = new Set<CardId>();
      for (const uid of s.hand) {
        const id = cardIdOf(s, uid);
        if (seen.has(id)) continue;
        seen.add(id);
        const opts: PlayOptions = id === 'rekindle' ? { targets: recallTargets(s) } : {};
        if (blockReason(s, uid) !== null) continue;
        const action: BotAction = { kind: 'play', uid, opts };
        if (revealsHidden(id)) {
          const check = checkPlay(s, uid, opts);
          if (check.ok && !check.breaks) leaves.push({ steps: node.steps, state: s, last: action, total: 0, runs: 0 });
          continue;
        }
        let after: CardCraftState;
        try {
          after = playCard(s, uid, opts);
        } catch {
          continue; // not enough durability
        }
        if (after.status === 'failed') continue; // would break the iron
        const steps = [...node.steps, action];
        if (after.status !== 'active') {
          leaves.push({ steps, state: after, last: null, total: score(after), runs: 1 });
          continue;
        }
        const sig = signature(after);
        const old = next.get(sig);
        if (old === undefined || old.state.quality < after.quality) next.set(sig, { state: after, steps });
      }
    }
    layer = [...next.values()];
  }
  if (leaves.length === 0) leaves.push({ steps: [], state, last: { kind: 'end', keep: [] }, total: 0, runs: 0 });
  return leaves;
}

export interface SmartBotOptions {
  /** Successive halving: playouts per plan in each round, and how many plans go on. */
  rounds: readonly { playouts: number; keep: number }[];
  maxTurns: number;
}

export const SMART_BOT_DEFAULTS: SmartBotOptions = {
  rounds: [
    { playouts: 4, keep: 6 },
    { playouts: 12, keep: 3 },
    { playouts: 32, keep: 1 },
  ],
  maxTurns: 40,
};

function evaluate(leaf: Leaf, from: number, count: number, maxTurns: number): void {
  if (leaf.last === null) return;
  for (let w = from; w < from + count; w++) {
    const after = apply(determinize(leaf.state, w), leaf.last);
    leaf.total += after.status === 'active' ? playout(after, maxTurns) : score(after);
    leaf.runs += 1;
  }
}

const mean = (l: Leaf): number => l.total / Math.max(1, l.runs);

/** Adds the other keep choices of each turn-ending plan, caught up to the playouts done so far. */
function withKeepChoices(leaves: Leaf[], playedWorlds: number, maxTurns: number): Leaf[] {
  const out = [...leaves];
  for (const l of leaves) {
    if (l.last === null || l.last.kind !== 'end' || reheatInfo(l.state).keep <= 0) continue;
    const st = l.state;
    const key = (keep: readonly string[]): string =>
      keep
        .map((u) => cardIdOf(st, u))
        .sort()
        .join(',');
    const taken = key(l.last.keep);
    for (const keep of keepOptions(st)) {
      if (key(keep) === taken) continue;
      const leaf: Leaf = { steps: l.steps, state: st, last: { kind: 'end', keep }, total: 0, runs: 0 };
      evaluate(leaf, 0, playedWorlds, maxTurns);
      out.push(leaf);
    }
  }
  return out;
}

interface Queued {
  action: BotAction;
  logLength: number;
  turn: number;
  craftNo: number;
}

/**
 * Plans the whole turn: every distinct order of the hand, judged by playing the rest of the
 * craft out many times with the 단순 봇 (4.2.1 초벌 측정의 '따져 보는 사람').
 */
export function makeSmartBot(opts: Partial<SmartBotOptions> = {}): Bot {
  const o = { ...SMART_BOT_DEFAULTS, ...opts };
  let queue: Queued[] = [];
  return {
    name: '따져 보는 봇',
    decide(state) {
      const head = queue[0];
      if (
        head !== undefined &&
        head.logLength === state.log.length &&
        head.turn === state.turn &&
        head.craftNo === state.setup.craftNo
      ) {
        queue.shift();
        return head.action;
      }
      queue = [];
      let leaves = planLeaves(state);
      let world = 0;
      for (let i = 0; i < o.rounds.length; i++) {
        const round = o.rounds[i] as { playouts: number; keep: number };
        // After the first cut, plans that end the turn also try other ways of keeping cards (화로).
        if (i === 1) leaves = withKeepChoices(leaves, world, o.maxTurns);
        if (leaves.length <= 1) break;
        for (const l of leaves) evaluate(l, world, round.playouts, o.maxTurns);
        world += round.playouts;
        leaves = [...leaves].sort((a, b) => mean(b) - mean(a)).slice(0, round.keep);
      }
      const best = leaves[0] as Leaf;
      // Replay the plan on the real state to know where each step lands.
      let s = state;
      const actions = best.last === null ? best.steps : [...best.steps, best.last];
      for (const action of actions) {
        queue.push({ action, logLength: s.log.length, turn: s.turn, craftNo: s.setup.craftNo });
        if (action === best.last) break;
        s = apply(s, action);
      }
      return (queue.shift() as Queued).action;
    },
  };
}

// ---------- Running a craft ----------

/**
 * One measured craft. The turn counts come from the engine's cardTurnSummary, the same one the
 * play log reads, so '다 내기', '빈 턴' and '버린 카드' mean the same for bots and players.
 */
export interface CraftRun {
  outcome: CardCraftOutcome;
  final: CardCraftState;
  turns: number;
  cardsPlayed: number;
  /** Cards left in hand and thrown away at 다시 달구기 (16.3의 1번: 버린 카드). */
  discarded: number;
  /** Turns ended by 다시 달구기 with every card the fire, 열기 and conditions allowed played ('다 내기', 16.3의 1번). */
  allPlayedTurns: number;
  /** Turns ended by 다시 달구기 (a card that ends the turn included). */
  reheatTurns: number;
  /** Turns that ended (by 다시 달구기, or with the craft). */
  endedTurns: number;
  /** Turns ended without playing a card (16.3의 2번: 턴을 넘기는 빈도). */
  emptyTurns: number;
  /** Ran past maxTurns and was stopped (counted as a failure). */
  timedOut: boolean;
  /** Per card: times played and times thrown away at 다시 달구기 (죽은 카드 찾기, 16.3의 1·7번). */
  played: Partial<Record<CardId, number>>;
  thrown: Partial<Record<CardId, number>>;
}

export function runCraft(setup: CardCraftSetup, bot: Bot, maxTurns = SMART_BOT_DEFAULTS.maxTurns): CraftRun {
  let s = startCardCraft(setup);
  let timedOut = false;
  while (s.status === 'active') {
    if (s.turn > maxTurns) {
      timedOut = true;
      s = abandonCardCraft(s);
      break;
    }
    s = apply(s, bot.decide(s));
  }
  const outcome = cardCraftOutcome(s);
  const turns = cardTurnSummary(s);
  const played: Partial<Record<CardId, number>> = {};
  const thrown: Partial<Record<CardId, number>> = {};
  for (const e of s.log) {
    if (e.kind === 'play') played[e.card] = (played[e.card] ?? 0) + 1;
    if (e.kind === 'reheat') {
      for (const u of e.discarded) {
        const id = cardIdOf(s, u);
        thrown[id] = (thrown[id] ?? 0) + 1;
      }
    }
  }
  const reheated = turns.filter((t) => t.end === 'reheat');
  const ended = turns.filter((t) => t.end !== 'active');
  return {
    outcome,
    final: s,
    turns: s.turn,
    cardsPlayed: outcome.cardsPlayed,
    discarded: outcome.discarded,
    allPlayedTurns: reheated.filter((t) => t.allowedLeft === 0).length,
    reheatTurns: reheated.length,
    endedTurns: ended.length,
    emptyTurns: ended.filter((t) => t.played.length === 0).length,
    timedOut,
    played,
    thrown,
  };
}
