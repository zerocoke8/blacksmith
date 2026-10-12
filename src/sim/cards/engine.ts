// 카드 제작 엔진 (기획서 4.2). Pure and deterministic: a CardCraftState is plain JSON,
// every step returns a new state, and randomness comes only from the 'fire' and 'deck'
// keys of the craft (4.2.8). The screen shows what this computes; it never decides.

import { rngFor } from '../core/rng.ts';
import type { QualityTier, UniqueId } from '../core/types.ts';
import { QUALITY, qualityTierFor } from '../data/common.ts';
import {
  BUFF_IDS,
  BUFFS,
  type BuffId,
  CARD_CRAFT_STATE_VERSION,
  CARD_IDS,
  CARD_STREAM,
  type CardEffect,
  type CardId,
  CARDS,
  CHARGE_IDS,
  CHARGES,
  type ChargeId,
  COOLING_IRON_STEP,
  DECK_KEY,
  FIRE_EFFECT,
  FIRE_LABEL,
  type FireState,
  FIRST_FIRE,
  GOOD_FIRE,
  HEAT,
  REROLLS_PER_CRAFT,
} from '../data/cards.ts';
import { type FireStream, rollRerollFire, rollTurnFire } from './fire.ts';
import { adamantPlus, type CardRecipe, type CardRecipeInput, cardRecipeFor } from './recipe.ts';
import {
  type CardRules,
  type CardSmithStats,
  type CardTools,
  cardMaxDurability,
  cardSmithStats,
  resolveCardRules,
} from './smith.ts';

export interface CardCraftSetup {
  seed: number;
  /** The random stream key (3.6); default 'craft', the idle world's crafts. */
  stream?: string;
  /** 제작 번호. Goes up by one every time a craft starts. */
  craftNo: number;
  recipe: CardRecipeInput;
  /** 기술 덱: cards and 각인. The recipe adds the material cards. */
  deck: CardId[];
  tools: CardTools;
  /** [검증] switches; missing ones take the doc's values. */
  rules?: Partial<CardRules>;
}

export type CardCraftStatus = 'active' | 'success' | 'failed';

export type CardLogEntry =
  /** A turn began: fire state shown, cards drawn to fill the hand. */
  | { kind: 'turn'; turn: number; fire: FireState; drawn: string[] }
  /** A card was played. Numbers are the card's net changes. */
  | {
      kind: 'play';
      turn: number;
      uid: string;
      card: CardId;
      cost: number;
      fire: FireState;
      progress: number;
      quality: number;
      durability: number;
      heat: number;
    }
  /** Cards drawn by a card effect. */
  | { kind: 'draw'; turn: number; drawn: string[] }
  /** The fire state changed mid-turn (불 다시 보기, 대장장이의 감, 용의 숨결, 순풍). */
  | { kind: 'fire'; turn: number; from: FireState; to: FireState; cause: CardId }
  /** The 버린 더미 was shuffled into the 뽑을 더미 (shuffleNo = the key used). */
  | { kind: 'shuffle'; turn: number; shuffleNo: number }
  /**
   * 다시 달구기. durability is the net change (negative = lost). allowedLeft: cards in hand the
   * fire, 열기 and card conditions allowed but that were not played (durability aside); 0 means
   * the turn played everything it could ('다 내기', 16.3의 1번). Missing in saves made before it.
   */
  | {
      kind: 'reheat';
      turn: number;
      durability: number;
      kept: string[];
      discarded: string[];
      exhausted: string[];
      allowedLeft?: number;
    }
  | { kind: 'end'; turn: number; status: 'success' | 'failed'; abandoned: boolean };

export interface ChargeState {
  /** Cards it still applies to. */
  left: number;
  /** Turns left, this one included. */
  turns: number;
}

export interface CardCraftState {
  version: number;
  /** Copies taken at the start, so deck, tool or rule changes apply from the next craft (4.2.8). */
  setup: CardCraftSetup;
  recipe: CardRecipe;
  smith: CardSmithStats;
  rules: CardRules;
  /** Every card instance in this craft (기술 덱 + 재료 카드): uid → card. */
  cards: Record<string, CardId>;
  /** 각인 in the deck: never in hand, on for the whole craft. */
  imprints: CardId[];
  /** Current turn, 1-based. */
  turn: number;
  progress: number;
  quality: number;
  durability: number;
  maxDurability: number;
  heat: number;
  fire: FireState;
  rerollsThisTurn: number;
  rerollsUsed: number;
  /** Turns left per buff, this one included. Missing = off. */
  buffs: Partial<Record<BuffId, number>>;
  charges: Partial<Record<ChargeId, ChargeState>>;
  /** 이번 턴 다음 카드 코스트 −n (강철 접기, 단단한 두드리기). */
  nextCardDiscount: number;
  playedThisTurn: number;
  /** 첫 숨: cards drawn past the hand size next turn. */
  extraDrawNextTurn: number;
  /** 단조 유지: reheats left that restore instead of costing, and how much they restore. */
  maintainReheats: number;
  maintainRestore: number;
  /** 겹친 갑피: 다시 달구기 costs at most this, or null. */
  shellReheatCost: number | null;
  /** Index 0 is the top. */
  drawPile: string[];
  hand: string[];
  discard: string[];
  exhausted: string[];
  /** Shuffles done so far; the next one uses this as its 'deck' key. */
  shuffleNo: number;
  status: CardCraftStatus;
  /** Stopped by the player; counts as a failure (4.2). */
  abandoned: boolean;
  /** Times each card was played (단련, 4.2.5). */
  uses: Partial<Record<CardId, number>>;
  log: CardLogEntry[];
}

export interface PlayOptions {
  /** 다시 피는 불: cards picked from the 버린 더미 (up to the card's count). */
  targets?: string[];
  /** A card that ends the turn (깊은 담금질): cards kept by the 화로, as in endTurn. */
  keep?: string[];
}

export type PlayCheck =
  | {
      ok: true;
      cost: number;
      /** 공정을 다 채운다: "이 한 방으로 완성". */
      finishes: boolean;
      /** The craft fails if this is played (the iron runs out). The screen asks first. */
      breaks: boolean;
    }
  | { ok: false; cost: number; reason: string };

export interface PlayPreview {
  cost: number;
  finishes: boolean;
  breaks: boolean;
  /** Net changes, as the gauges would show them. */
  progress: number;
  quality: number;
  durability: number;
  heat: number;
}

// ---------- Small helpers ----------

/** Floors with a small epsilon so 100 × 1.8 × 1.4 × 1.5 is 378, not 377. */
function floorGain(x: number): number {
  return Math.floor(x + 1e-6);
}

function fireKey(state: CardCraftState): FireStream {
  return { seed: state.setup.seed, stream: state.setup.stream ?? CARD_STREAM.craft, craftNo: state.setup.craftNo };
}

function isGoodFire(f: FireState): boolean {
  return GOOD_FIRE.includes(f);
}

function removeOne(list: string[], uid: string): boolean {
  const i = list.indexOf(uid);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/** A working copy. Setup, recipe, smith, rules and cards never change after the start, so they are shared. */
function draft(state: CardCraftState): CardCraftState {
  const charges: Partial<Record<ChargeId, ChargeState>> = {};
  for (const id of CHARGE_IDS) {
    const c = state.charges[id];
    if (c !== undefined) charges[id] = { ...c };
  }
  return {
    ...state,
    buffs: { ...state.buffs },
    charges,
    drawPile: [...state.drawPile],
    hand: [...state.hand],
    discard: [...state.discard],
    exhausted: [...state.exhausted],
    uses: { ...state.uses },
    log: [...state.log],
  };
}

function assertActive(state: CardCraftState): void {
  if (state.status !== 'active') throw new Error('card craft is over');
}

export function cardIdOf(state: CardCraftState, uid: string): CardId {
  const id = state.cards[uid];
  if (id === undefined) throw new Error(`unknown card ${uid}`);
  return id;
}

// ---------- Deck: shuffle and draw (4.2.8) ----------

function shuffled(state: CardCraftState, uids: readonly string[], shuffleNo: number): string[] {
  const key = fireKey(state);
  const rng = rngFor(key.seed, key.stream, key.craftNo, DECK_KEY, shuffleNo);
  const out = [...uids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = out[i] as string;
    out[i] = out[j] as string;
    out[j] = t;
  }
  return out;
}

/** Shuffles the 버린 더미 under the (empty) 뽑을 더미. */
function reshuffle(s: CardCraftState): void {
  const order = shuffled(s, s.discard, s.shuffleNo);
  s.log.push({ kind: 'shuffle', turn: s.turn, shuffleNo: s.shuffleNo });
  s.shuffleNo += 1;
  s.drawPile.push(...order);
  s.discard = [];
}

function drawCards(s: CardCraftState, n: number): string[] {
  const drawn: string[] = [];
  for (let i = 0; i < n; i++) {
    if (s.drawPile.length === 0) {
      if (s.discard.length === 0) break;
      reshuffle(s);
    }
    const uid = s.drawPile.shift() as string;
    s.hand.push(uid);
    drawn.push(uid);
  }
  return drawn;
}

// ---------- Fire ----------

function applyTailwind(s: CardCraftState, cause: CardId | null): void {
  if ((s.buffs.tailwind ?? 0) > 0 && s.fire === 'normal') {
    s.fire = 'good';
    if (cause !== null) s.log.push({ kind: 'fire', turn: s.turn, from: 'normal', to: 'good', cause });
  }
}

function beginTurn(s: CardCraftState): void {
  s.turn += 1;
  s.fire = rollTurnFire(fireKey(s), s.recipe.grade, s.rules.firePreset, s.turn, s.fire);
  applyTailwind(s, null);
  s.rerollsThisTurn = 0;
  s.playedThisTurn = 0;
  s.nextCardDiscount = 0;
  const count = Math.max(0, s.smith.handSize - s.hand.length) + FIRE_EFFECT[s.fire].extraDraw + s.extraDrawNextTurn;
  s.extraDrawNextTurn = 0;
  const drawn = drawCards(s, count);
  s.log.push({ kind: 'turn', turn: s.turn, fire: s.fire, drawn });
}

/**
 * Next turn's fire state if 불꽃 읽기 is in the deck, else null. It follows this turn's
 * current state (최상 → 식음 in 고급·전설, 불티 → 좋음), so a reroll can change it.
 */
export function nextFirePreview(state: CardCraftState): FireState | null {
  if (!state.smith.foresight || state.status !== 'active') return null;
  const next = rollTurnFire(fireKey(state), state.recipe.grade, state.rules.firePreset, state.turn + 1, state.fire);
  return next === 'normal' && (state.buffs.tailwind ?? 0) > 1 ? 'good' : next;
}

// ---------- Start ----------

export function startCardCraft(setup: CardCraftSetup): CardCraftState {
  for (const id of setup.deck) if (!(CARD_IDS as readonly string[]).includes(id)) throw new Error(`unknown card ${id}`);
  const rules = resolveCardRules(setup.rules);
  const recipe = cardRecipeFor(setup.recipe);
  const imprints = setup.deck.filter((id) => CARDS[id].imprint !== null);
  const smith = cardSmithStats(setup.tools, imprints, rules);
  const cards: Record<string, CardId> = {};
  const uids: string[] = [];
  setup.deck
    .filter((id) => CARDS[id].imprint === null)
    .forEach((id, i) => {
      cards[`c${i}`] = id;
      uids.push(`c${i}`);
    });
  recipe.materialCards.forEach((id, i) => {
    cards[`m${i}`] = id;
    uids.push(`m${i}`);
  });
  const maxDurability = cardMaxDurability(recipe, smith, rules);
  const s: CardCraftState = {
    version: CARD_CRAFT_STATE_VERSION,
    setup: {
      seed: setup.seed,
      stream: setup.stream ?? CARD_STREAM.craft,
      craftNo: setup.craftNo,
      recipe: { ...setup.recipe },
      deck: [...setup.deck],
      tools: { ...setup.tools },
      rules: { ...rules },
    },
    recipe,
    smith,
    rules,
    cards,
    imprints,
    turn: 0,
    progress: 0,
    quality: 0,
    durability: maxDurability,
    maxDurability,
    heat: 0,
    fire: FIRST_FIRE,
    rerollsThisTurn: 0,
    rerollsUsed: 0,
    buffs: {},
    charges: {},
    nextCardDiscount: 0,
    playedThisTurn: 0,
    extraDrawNextTurn: 0,
    maintainReheats: 0,
    maintainRestore: 0,
    shellReheatCost: null,
    drawPile: [],
    hand: [],
    discard: [],
    exhausted: [],
    shuffleNo: 0,
    status: 'active',
    abandoned: false,
    uses: {},
    log: [],
  };
  // First shuffle (key 0); 첫 손 cards go on top so they are in the first hand (4.2.8).
  const order = shuffled(s, uids, 0);
  s.shuffleNo = 1;
  const first = order.filter((u) => CARDS[cards[u] as CardId].keywords.firstHand === true);
  s.drawPile = [...first, ...order.filter((u) => !first.includes(u))];
  beginTurn(s);
  return s;
}

// ---------- Costs and play checks ----------

/** One thing that moved a card's cost: its name as the player sees it, and the change. */
export interface CostStep {
  label: string;
  delta: number;
}

/**
 * The card's cost now: 식는 쇠, 아껴 치기, 다음 카드 −1, 단단함 in that order. When `steps`
 * is given, each change that moved the cost is pushed onto it.
 */
function costOf(state: CardCraftState, id: CardId, steps?: CostStep[]): number {
  const base = CARDS[id].cost;
  if (base === null) return 0;
  let c = base;
  const step = (label: string, next: number): void => {
    if (steps !== undefined && next !== c) steps.push({ label, delta: next - c });
    c = next;
  };
  if (state.rules.coolingIron) step('식는 쇠', c + COOLING_IRON_STEP * state.playedThisTurn);
  const thrift = BUFFS.thrift.effect;
  if ((state.buffs.thrift ?? 0) > 0 && id !== 'thrift' && thrift.kind === 'thrift' && c >= 1) {
    step(BUFFS.thrift.name, Math.max(1, c - thrift.amount));
  }
  if (state.nextCardDiscount > 0) step('다음 카드', Math.max(0, c - state.nextCardDiscount));
  if (FIRE_EFFECT[state.fire].halfCost) step(FIRE_LABEL.sturdy, Math.ceil(c / 2));
  return c;
}

/** What this card costs right now (식는 쇠, 아껴 치기, 다음 카드 −1, 단단함 in that order). */
export function cardCost(state: CardCraftState, uid: string): number {
  return costOf(state, cardIdOf(state, uid));
}

/** Why the cost is what it is: the printed cost, each change ("식는 쇠 +1", "단단함 −2"), the result. */
export function cardCostSteps(state: CardCraftState, uid: string): { base: number; steps: CostStep[]; cost: number } {
  const id = cardIdOf(state, uid);
  const steps: CostStep[] = [];
  const cost = costOf(state, id, steps);
  return { base: CARDS[id].cost ?? 0, steps, cost };
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * Why this card cannot be played now, ignoring durability (short Korean, 4.2.9), or null.
 * The screen greys the card out and shows this line.
 */
export function blockReason(state: CardCraftState, uid: string): string | null {
  const spec = CARDS[cardIdOf(state, uid)];
  if (spec.cost === null) return '각인은 손에 오지 않는다';
  if (spec.keywords.firstHand === true && state.turn > 1) return '첫 턴에만';
  if (spec.keywords.goodOnly === true && !isGoodFire(state.fire)) return '좋음·최상일 때만';
  for (const r of spec.requires) {
    if (r.type === 'heat' && state.heat < r.min) return r.min <= 1 ? '열기가 없다' : `열기 ${r.min} 이상일 때만`;
    if (r.type === 'progressLeft' && state.recipe.progressRequired - state.progress > r.share * state.recipe.progressRequired) {
      return `남은 공정이 ${pct(r.share)} 이하일 때만`;
    }
    if (r.type === 'rerollsLeft' && state.rerollsUsed >= REROLLS_PER_CRAFT) return `다시 보기는 제작당 ${REROLLS_PER_CRAFT}번`;
    if (r.type === 'discardNotEmpty' && state.discard.length === 0) return '버린 더미가 비었다';
  }
  return null;
}

/** What the player must pick before this card is played (4.2.4 다시 피는 불, 4.2.5 깊은 담금질). */
export interface PlayNeeds {
  /** Cards to pick from the 버린 더미 (up to this many), or 0. */
  targets: number;
  /** The card ends the turn, so the 화로's 간직 is picked as at 다시 달구기. */
  endsTurn: boolean;
}

export function playNeeds(state: CardCraftState, uid: string): PlayNeeds {
  const effects = CARDS[cardIdOf(state, uid)].effects;
  const recall = effects.find((e) => e.type === 'recall');
  return {
    targets: recall !== undefined && recall.type === 'recall' ? recall.count : 0,
    endsTurn: effects.some((e) => e.type === 'endTurn'),
  };
}

/** Why these cards cannot be kept at 다시 달구기 (short Korean), or null. */
function keepProblem(state: CardCraftState, keep: readonly string[]): string | null {
  if (new Set(keep).size !== keep.length) return '같은 카드를 두 번 남길 수 없다';
  for (const k of keep) {
    if (!state.hand.includes(k)) return '손에 없는 카드는 남길 수 없다';
    if (CARDS[cardIdOf(state, k)].keywords.retain === true) return '간직 카드는 저절로 남는다';
  }
  if (keep.length > state.smith.keep) return `화로는 ${state.smith.keep}장까지 남겨 준다`;
  return null;
}

/** Why the picks for this card are not allowed (short Korean), or null. */
function optionProblem(state: CardCraftState, uid: string, opts: PlayOptions): string | null {
  const targets = opts.targets ?? [];
  if (targets.length > 0) {
    const max = playNeeds(state, uid).targets;
    if (max === 0) return '이 카드는 고를 것이 없다';
    if (new Set(targets).size !== targets.length) return '같은 카드를 두 번 고를 수 없다';
    if (targets.length > max) return `${max}장까지 고른다`;
    for (const t of targets) if (!state.discard.includes(t)) return '버린 더미에 없는 카드';
  }
  if (opts.keep !== undefined) return keepProblem(state, opts.keep.filter((k) => k !== uid));
  return null;
}

/** Resolves a play on a working copy and reports what happened. */
function simulatePlay(state: CardCraftState, uid: string, opts: PlayOptions): { s: CardCraftState; cost: number } {
  const cost = cardCost(state, uid);
  const s = draft(state);
  resolvePlay(s, uid, cost, opts);
  return { s, cost };
}

/**
 * Whether the card can be played now. A card that fills the 공정 can be played even when
 * the durability is short (막타, 4.2).
 */
export function checkPlay(state: CardCraftState, uid: string, opts: PlayOptions = {}): PlayCheck {
  if (state.status !== 'active') return { ok: false, cost: 0, reason: '제작이 끝났다' };
  if (!state.hand.includes(uid)) return { ok: false, cost: 0, reason: '손에 없는 카드' };
  const cost = cardCost(state, uid);
  const reason = blockReason(state, uid) ?? optionProblem(state, uid, opts);
  if (reason !== null) return { ok: false, cost, reason };
  const { s } = simulatePlay(state, uid, opts);
  const finishes = s.status === 'success';
  if (!finishes && cost > state.durability) return { ok: false, cost, reason: '내구도가 모자라다' };
  return { ok: true, cost, finishes, breaks: s.status === 'failed' };
}

/** Gauge changes if this card were played now (a tap shows them faintly, 4.2.9), or null if it cannot be. */
export function previewPlay(state: CardCraftState, uid: string, opts: PlayOptions = {}): PlayPreview | null {
  const check = checkPlay(state, uid, opts);
  if (!check.ok) return null;
  const { s } = simulatePlay(state, uid, opts);
  return {
    cost: check.cost,
    finishes: check.finishes,
    breaks: check.breaks,
    progress: s.progress - state.progress,
    quality: s.quality - state.quality,
    durability: s.durability - state.durability,
    heat: s.heat - state.heat,
  };
}

// ---------- Playing a card ----------

interface PlayContext {
  id: CardId;
  heatBefore: number;
  /** Ratio added to every 공정·품질 effect (아다만 심 +n). */
  ratioPlus: number;
  progressChargeUsed: boolean;
  qualityChargeUsed: boolean;
  endTurn: boolean;
}

/** Spends the '다음 n장' bonuses for one gauge; returns their sum. */
function spendCharges(s: CardCraftState, gauge: 'progress' | 'quality'): number {
  let bonus = 0;
  for (const id of CHARGE_IDS) {
    const c = s.charges[id];
    if (c === undefined || CHARGES[id].gauge !== gauge) continue;
    bonus += CHARGES[id].bonus;
    c.left -= 1;
    if (c.left <= 0) delete s.charges[id];
  }
  return bonus;
}

function buffBonus(s: CardCraftState, kind: 'progress' | 'quality'): number {
  let bonus = 0;
  for (const id of BUFF_IDS) {
    const effect = BUFFS[id].effect;
    if ((s.buffs[id] ?? 0) > 0 && effect.kind === kind) bonus += effect.bonus;
  }
  return bonus;
}

function gainProgress(s: CardCraftState, ratio: number, ctx: PlayContext): void {
  let bonus = buffBonus(s, 'progress');
  if (!ctx.progressChargeUsed) {
    bonus += spendCharges(s, 'progress');
    ctx.progressChargeUsed = true;
  }
  s.progress += floorGain(s.smith.craftsmanship * ratio * (1 + bonus) * FIRE_EFFECT[s.fire].progress);
}

function gainQuality(s: CardCraftState, ratio: number, ctx: PlayContext): void {
  let bonus = buffBonus(s, 'quality');
  if (!ctx.qualityChargeUsed) {
    bonus += spendCharges(s, 'quality');
    ctx.qualityChargeUsed = true;
  }
  const heatBonus = 1 + ctx.heatBefore * HEAT.qualityPerHeat;
  const gain = floorGain(s.smith.control * ratio * heatBonus * (1 + bonus) * FIRE_EFFECT[s.fire].quality);
  s.quality = Math.min(s.recipe.qualityCap, s.quality + gain);
}

function setHeat(s: CardCraftState, heat: number): void {
  s.heat = Math.max(0, Math.min(HEAT.max, heat));
}

function changeFire(s: CardCraftState, to: FireState, cause: CardId): void {
  if (s.fire === to) return;
  s.log.push({ kind: 'fire', turn: s.turn, from: s.fire, to, cause });
  s.fire = to;
}

function applyEffects(s: CardCraftState, effects: readonly CardEffect[], ctx: PlayContext, opts: PlayOptions): void {
  for (const e of effects) {
    switch (e.type) {
      case 'progress':
        gainProgress(s, e.ratio + ctx.ratioPlus, ctx);
        break;
      case 'quality':
        gainQuality(s, e.ratio + ctx.ratioPlus, ctx);
        break;
      case 'heat':
        setHeat(s, s.heat + e.amount);
        break;
      case 'finish': {
        const used = e.spend === 'half' ? Math.floor(s.heat / 2) : s.heat;
        gainQuality(s, e.ratio * (1 + used * e.perHeat), ctx);
        if (e.spend !== 'none') setHeat(s, s.heat - used);
        break;
      }
      case 'restore':
        if (e.overMax) s.durability += e.amount;
        else s.durability = Math.max(s.durability, Math.min(s.maxDurability, s.durability + e.amount));
        break;
      case 'buff':
        // Playing the same buff again restarts its turns; it does not add (4.2).
        s.buffs[e.buff] = e.turns;
        if (e.buff === 'tailwind') applyTailwind(s, ctx.id);
        break;
      case 'charge':
        s.charges[e.charge] = { left: CHARGES[e.charge].cards, turns: e.turns };
        break;
      case 'draw': {
        const drawn = drawCards(s, e.count);
        s.log.push({ kind: 'draw', turn: s.turn, drawn });
        break;
      }
      case 'drawNextTurn':
        s.extraDrawNextTurn += e.count;
        break;
      case 'nextCardDiscount':
        s.nextCardDiscount = e.amount;
        break;
      case 'setFire':
        if (e.to === 'excellent') changeFire(s, 'excellent', ctx.id);
        else if (s.fire !== 'excellent') changeFire(s, 'good', ctx.id);
        break;
      case 'reroll': {
        s.rerollsThisTurn += 1;
        s.rerollsUsed += 1;
        const to = rollRerollFire(fireKey(s), s.recipe.grade, s.rules.firePreset, s.turn, s.rerollsThisTurn);
        s.log.push({ kind: 'fire', turn: s.turn, from: s.fire, to, cause: ctx.id });
        s.fire = to;
        applyTailwind(s, ctx.id);
        break;
      }
      case 'fillProgress':
        s.progress = Math.max(s.progress, s.recipe.progressRequired);
        break;
      case 'maintain':
        s.maintainReheats = e.reheats;
        s.maintainRestore = e.restore;
        break;
      case 'shellReheat':
        s.shellReheatCost = s.shellReheatCost === null ? e.cost : Math.min(s.shellReheatCost, e.cost);
        break;
      case 'recall':
        for (const t of (opts.targets ?? []).slice(0, e.count)) if (removeOne(s.discard, t)) s.hand.push(t);
        break;
      case 'endTurn':
        ctx.endTurn = true;
        break;
      case 'ifGoodFire':
        applyEffects(s, isGoodFire(s.fire) ? e.then : e.otherwise, ctx, opts);
        break;
    }
  }
}

function finishIfDone(s: CardCraftState): void {
  if (s.progress >= s.recipe.progressRequired) {
    s.status = 'success';
    s.log.push({ kind: 'end', turn: s.turn, status: 'success', abandoned: false });
  } else if (s.durability <= 0) {
    s.status = 'failed';
    s.log.push({ kind: 'end', turn: s.turn, status: 'failed', abandoned: false });
  }
}

/** Plays the card on a working copy, with no durability check (callers check it). */
function resolvePlay(s: CardCraftState, uid: string, cost: number, opts: PlayOptions): void {
  const id = cardIdOf(s, uid);
  const spec = CARDS[id];
  const before = { progress: s.progress, quality: s.quality, durability: s.durability, heat: s.heat };
  const fire = s.fire;
  removeOne(s.hand, uid);
  s.playedThisTurn += 1;
  s.nextCardDiscount = 0;
  s.durability -= cost;
  const ctx: PlayContext = {
    id,
    heatBefore: s.heat,
    ratioPlus: id === 'adamantCore' ? adamantPlus(s.recipe.materialTier) : 0,
    progressChargeUsed: false,
    qualityChargeUsed: false,
    endTurn: false,
  };
  applyEffects(s, spec.effects, ctx, opts);
  // 첫 손 cards cannot be played again, so they leave with 소멸 (4.2 키워드).
  if (spec.keywords.exhaust === true || spec.keywords.firstHand === true) s.exhausted.push(uid);
  else s.discard.push(uid);
  s.uses[id] = (s.uses[id] ?? 0) + 1;
  s.log.push({
    kind: 'play',
    turn: s.turn,
    uid,
    card: id,
    cost,
    fire,
    progress: s.progress - before.progress,
    quality: s.quality - before.quality,
    durability: s.durability - before.durability,
    heat: s.heat - before.heat,
  });
  finishIfDone(s);
  if (ctx.endTurn && s.status === 'active') doEndTurn(s, opts.keep ?? []);
}

/** Plays one card from the hand. Throws if it cannot be played (see checkPlay). */
export function playCard(state: CardCraftState, uid: string, opts: PlayOptions = {}): CardCraftState {
  assertActive(state);
  if (!state.hand.includes(uid)) throw new Error(`card ${uid} is not in hand`);
  const reason = blockReason(state, uid) ?? optionProblem(state, uid, opts);
  if (reason !== null) throw new Error(`cannot play ${uid}: ${reason}`);
  const { s, cost } = simulatePlay(state, uid, opts);
  if (s.status !== 'success' && cost > state.durability) throw new Error(`cannot play ${uid}: 내구도가 모자라다`);
  return s;
}

// ---------- Ending a turn: 다시 달구기 ----------

/** Cards that stay in hand on their own (간직). */
export function retainedCards(state: CardCraftState): string[] {
  return state.hand.filter((u) => CARDS[cardIdOf(state, u)].keywords.retain === true);
}

export interface ReheatInfo {
  /** Durability change (negative = lost; 단조 유지 makes it positive). */
  durability: number;
  /** The craft fails if the turn ends now: "이 쇠는 더 못 버틴다". */
  breaks: boolean;
  /** How many more cards the 화로 lets the player keep. */
  keep: number;
  /** 간직 cards that stay anyway. */
  retained: string[];
}

function reheatChange(state: CardCraftState): number {
  if (state.maintainReheats > 0) {
    return Math.max(0, Math.min(state.maxDurability - state.durability, state.maintainRestore));
  }
  const cost = state.shellReheatCost === null ? state.rules.reheatCost : Math.min(state.rules.reheatCost, state.shellReheatCost);
  return -cost;
}

export function reheatInfo(state: CardCraftState): ReheatInfo {
  const durability = reheatChange(state);
  return {
    durability,
    breaks: state.status === 'active' && state.durability + durability <= 0,
    keep: state.smith.keep,
    retained: retainedCards(state),
  };
}

function doEndTurn(s: CardCraftState, keep: readonly string[]): void {
  const allowedLeft = s.hand.filter((u) => blockReason(s, u) === null).length;
  const change = reheatChange(s);
  if (s.maintainReheats > 0) s.maintainReheats -= 1;
  s.durability += change;
  const firstTurn = s.turn === 1;
  const isFirstHand = (u: string): boolean => CARDS[cardIdOf(s, u)].keywords.firstHand === true;
  const kept: string[] = [];
  const discarded: string[] = [];
  const exhausted: string[] = [];
  for (const u of s.hand) {
    if (firstTurn && isFirstHand(u)) exhausted.push(u);
    else if (CARDS[cardIdOf(s, u)].keywords.retain === true || keep.includes(u)) kept.push(u);
    else discarded.push(u);
  }
  // A copy: the next turn draws into the hand, and the log must keep only what was kept.
  s.hand = [...kept];
  s.discard.push(...discarded);
  s.exhausted.push(...exhausted);
  if (firstTurn) {
    // 첫 손: gone once the first turn is over, wherever it is (4.2 키워드).
    for (const pile of [s.drawPile, s.discard]) {
      for (const u of pile.filter(isFirstHand)) {
        removeOne(pile, u);
        s.exhausted.push(u);
        exhausted.push(u);
      }
    }
  }
  for (const id of BUFF_IDS) {
    const left = (s.buffs[id] ?? 0) - 1;
    if (left > 0) s.buffs[id] = left;
    else delete s.buffs[id];
  }
  for (const id of CHARGE_IDS) {
    const c = s.charges[id];
    if (c === undefined) continue;
    c.turns -= 1;
    if (c.turns <= 0) delete s.charges[id];
  }
  s.log.push({ kind: 'reheat', turn: s.turn, durability: change, kept, discarded, exhausted, allowedLeft });
  if (s.durability <= 0) {
    s.status = 'failed';
    s.log.push({ kind: 'end', turn: s.turn, status: 'failed', abandoned: false });
    return;
  }
  beginTurn(s);
}

/**
 * Ends the turn (다시 달구기): the hand goes to the 버린 더미 except 간직 cards and up to
 * `smith.keep` cards the player picks, durability −2, then the next turn starts.
 */
export function endTurn(state: CardCraftState, keep: readonly string[] = []): CardCraftState {
  assertActive(state);
  const problem = keepProblem(state, keep);
  if (problem !== null) throw new Error(`cannot keep: ${problem}`);
  const s = draft(state);
  doEndTurn(s, keep);
  return s;
}

/** Stopping halfway is a failure (4.2). */
export function abandonCardCraft(state: CardCraftState): CardCraftState {
  if (state.status !== 'active') return state;
  const s = draft(state);
  s.status = 'failed';
  s.abandoned = true;
  s.log.push({ kind: 'end', turn: s.turn, status: 'failed', abandoned: true });
  return s;
}

// ---------- Reading the state ----------

export function cardQualityRatio(state: CardCraftState): number {
  return Math.min(1, state.quality / state.recipe.qualityCap);
}

/** Tier the quality gauge is at now (★ marks on the gauge, 4.2.9). */
export function currentTier(state: CardCraftState): QualityTier {
  return qualityTierFor(cardQualityRatio(state));
}

/** Cards left in the 뽑을 더미, without their order (4.2.9: 덱 세기는 판단으로). */
export function drawPileSummary(state: CardCraftState): { card: CardId; count: number }[] {
  const counts = new Map<CardId, number>();
  for (const u of state.drawPile) {
    const id = cardIdOf(state, u);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return CARD_IDS.filter((id) => counts.has(id)).map((id) => ({ card: id, count: counts.get(id) as number }));
}

export type BossMaterialFate = 'used' | 'returned' | 'lost';

export interface CardCraftOutcome {
  status: CardCraftStatus;
  success: boolean;
  abandoned: boolean;
  /** Quality as a share of the cap, 0..1. */
  qualityRatio: number;
  tier: QualityTier | null;
  /** 인챈트 슬롯 (4.3). */
  slots: number;
  /** 대보스 재료: 걸작 → used (고유능력), success short of 걸작 → returned, failure → lost (4.6). */
  boss: { unique: UniqueId; fate: BossMaterialFate } | null;
  turns: number;
  cardsPlayed: number;
  /** Cards thrown away unplayed at 다시 달구기 (16.3의 1번: 버린 카드). */
  discarded: number;
}

export function cardCraftOutcome(state: CardCraftState): CardCraftOutcome {
  const success = state.status === 'success';
  const ratio = cardQualityRatio(state);
  const tier = success ? qualityTierFor(ratio) : null;
  const unique = state.recipe.bossMaterial;
  let boss: CardCraftOutcome['boss'] = null;
  if (unique !== null && state.status !== 'active') {
    boss = { unique, fate: !success ? 'lost' : tier === 5 ? 'used' : 'returned' };
  }
  let cardsPlayed = 0;
  let discarded = 0;
  for (const e of state.log) {
    if (e.kind === 'play') cardsPlayed += 1;
    else if (e.kind === 'reheat') discarded += e.discarded.length;
  }
  return {
    status: state.status,
    success,
    abandoned: state.abandoned,
    qualityRatio: ratio,
    tier,
    slots: tier === null ? 0 : QUALITY[tier].slots,
    boss,
    turns: state.turn,
    cardsPlayed,
    discarded,
  };
}

/** One turn of a craft, read from the log (16.3의 1·2번; the bots and the play log both use it). */
export interface CardTurnSummary {
  turn: number;
  /** The fire state the turn ended on (after rerolls and cards that change it). */
  fire: FireState;
  /** Cards played this turn, in order. */
  played: CardId[];
  /**
   * How the turn ended: 다시 달구기 ('reheat', also a card that ends the turn), the craft
   * finished or broke ('success' / 'failed', abandoning included), or it is still going.
   */
  end: 'reheat' | 'success' | 'failed' | 'active';
  /** At 다시 달구기: cards the fire, 열기 and conditions allowed but not played (0 = '다 내기'). Else null. */
  allowedLeft: number | null;
  /** Cards thrown away at 다시 달구기. */
  discarded: number;
}

export function cardTurnSummary(state: CardCraftState): CardTurnSummary[] {
  const out: CardTurnSummary[] = [];
  let cur: CardTurnSummary | null = null;
  for (const e of state.log) {
    if (e.kind === 'turn') {
      cur = { turn: e.turn, fire: e.fire, played: [], end: 'active', allowedLeft: null, discarded: 0 };
      out.push(cur);
    } else if (cur === null) {
      continue;
    } else if (e.kind === 'play') {
      cur.played.push(e.card);
    } else if (e.kind === 'fire') {
      cur.fire = e.to;
    } else if (e.kind === 'reheat') {
      cur.end = 'reheat';
      cur.allowedLeft = e.allowedLeft ?? null;
      cur.discarded = e.discarded.length;
    } else if (e.kind === 'end' && cur.end === 'active') {
      cur.end = e.status;
    }
  }
  return out;
}
