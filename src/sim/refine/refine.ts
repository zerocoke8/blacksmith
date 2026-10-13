// 광석 정제의 규칙 (기획서 10.1): lumps pile up while the player is away, and each blow of the
// hammer turns `mult` lumps into one row of the result table × mult. Pure and deterministic
// (CLAUDE.md 규칙 1): time comes in as whole world minutes, every result comes from
// rngFor(worldSeed, 'refine', 정제 번호) (3.6), and the state is plain JSON.
// The screen keeps the tempo and plays the effects; it calls hitOnce / hitInBatch once per blow
// and shows what came back (규칙 2).

import { rngFor } from '../core/rng.ts';
import {
  bandAmount,
  idleLumpCap,
  idleLumpsPerHour,
  lumpBandOf,
  REFINE_BATCH_MAX,
  REFINE_MULTS,
  REFINE_TABLE,
  REFINE_TEMPO,
  type RefineItemId,
  type RefineMult,
  type RefineRarity,
} from '../data/refine.ts';

/** The refine part of the world save (10.1, 3.6). */
export interface RefineState {
  /** 광석 덩어리 on the pile. */
  lumps: number;
  /** 정제 번호 of the last blow (0 = never refined); the next blow is refineNo + 1. */
  refineNo: number;
  /** 가방: how many of each item (gold: G). Only items that came out are present. */
  bag: Partial<Record<RefineItemId, number>>;
  /** The world minute lumps have been counted up to (마지막으로 쌓인 시각). */
  accruedAt: number;
  /**
   * 덩어리에 받을 때의 단계 (7.1): the pile in lots, oldest first. Lumps no lot covers (a save from
   * before lots, a test or lab button that adds lumps) count as band 1 and are struck first.
   */
  lots?: LumpLot[];
  /** Part of a lump, in 60ths, carried to the next count (rates that are not one a minute). */
  carry?: number;
}

/** Lumps that came in at one band (7.1). */
export interface LumpLot {
  band: number;
  count: number;
}

/** What one blow brought. */
export interface RefineDrop {
  /** The blow's 정제 번호. */
  refineNo: number;
  item: RefineItemId;
  rarity: RefineRarity;
  /** The amount at ×1 (gold rolled in its range). */
  base: number;
  mult: RefineMult;
  /** base × mult: what went into the bag (경험치: into the level bar instead, 5.3). */
  amount: number;
  /** The band of the lump it came from (7.1). */
  band: number;
}

export function newRefineState(nowMinute: number): RefineState {
  return { lumps: 0, refineNo: 0, bag: {}, accruedAt: wholeMinute(nowMinute) };
}

function wholeMinute(m: number): number {
  return Number.isFinite(m) ? Math.floor(m) : 0;
}

// ---------- Lumps piling up ----------

export interface Accrual {
  state: RefineState;
  /** Lumps that came in this time (the '자리를 비운 사이' notice). */
  gained: number;
}

/**
 * Count the lumps that came in up to nowMinute (10.1 쌓이기), at the rate and cap of the best floor
 * (6.8, 7.1: idleLumpsPerHour, idleLumpCap; floor 0 = 60 an hour, 720), tagged with its band. The counted-up-to minute moves on
 * only by the lumps counted, so a part-minute is never lost. When the pile reaches the cap the
 * time while it is full is thrown away (the minute moves to now). A clock behind the counted
 * minute (set back, another device) adds nothing and moves nothing: it waits (3.6). Path
 * independent: counting at t1 then t2 gives what counting once at t2 gives.
 */
export function accrue(state: RefineState, nowMinute: number, bestFloor = 0): Accrual {
  const now = wholeMinute(nowMinute);
  if (now <= state.accruedAt) return { state, gained: 0 };
  const cap = idleLumpCap(bestFloor);
  const room = cap - state.lumps;
  if (room <= 0) return { state: withCarry({ ...state, accruedAt: now }, 0), gained: 0 };
  const total = (state.carry ?? 0) + (now - state.accruedAt) * idleLumpsPerHour(bestFloor);
  const steps = Math.floor(total / 60);
  const band = lumpBandOf(bestFloor);
  if (steps >= room) {
    return { state: withCarry({ ...state, lumps: cap, lots: addLot(state, room, band), accruedAt: now }, 0), gained: room };
  }
  return {
    state: withCarry({ ...state, lumps: state.lumps + steps, lots: addLot(state, steps, band), accruedAt: now }, total - steps * 60),
    gained: steps,
  };
}

/** carry is kept only while there is some, so a one-a-minute pile saves as it always did. */
function withCarry(state: RefineState, carry: number): RefineState {
  const next = { ...state };
  if (carry > 0) next.carry = carry;
  else delete next.carry;
  return next;
}

// ---------- Lots (7.1) ----------

/**
 * The pile as lots, oldest first, always summing to state.lumps: lumps no lot covers come first as
 * band 1; lots past the pile (lumps taken off by hand) are cut from the newest end.
 */
export function pileLots(state: Pick<RefineState, 'lumps' | 'lots'>): LumpLot[] {
  const lots = (state.lots ?? []).filter((l) => l.count > 0);
  const covered = lots.reduce((sum, l) => sum + l.count, 0);
  const out: LumpLot[] = [];
  const uncovered = Math.max(0, state.lumps - covered);
  if (uncovered > 0) out.push({ band: 1, count: uncovered });
  let left = state.lumps - uncovered;
  for (const l of lots) {
    if (left <= 0) break;
    const n = Math.min(l.count, left);
    const last = out[out.length - 1];
    if (last !== undefined && last.band === l.band) last.count += n;
    else out.push({ band: l.band, count: n });
    left -= n;
  }
  return out;
}

/** Lumps that come in at a band join the newest lot. */
function addLot(state: RefineState, n: number, band: number): LumpLot[] {
  const lots = pileLots(state);
  if (n <= 0) return lots;
  const last = lots[lots.length - 1];
  if (last !== undefined && last.band === band) last.count += n;
  else lots.push({ band, count: n });
  return lots;
}

/** Takes n lumps off the oldest lots; the band of the first one taken. */
function takeLumps(state: RefineState, n: number): { lots: LumpLot[]; band: number } {
  const lots = pileLots(state);
  const band = lots[0]?.band ?? 1;
  let left = n;
  while (left > 0 && lots.length > 0) {
    const first = lots[0] as LumpLot;
    const k = Math.min(first.count, left);
    first.count -= k;
    left -= k;
    if (first.count === 0) lots.shift();
  }
  return { lots, band };
}

/** Lumps of each band on the pile, for the pile's label (7.1 '더미에 받은 때의 구간을 적어 보인다'). */
export function lumpsByBand(state: Pick<RefineState, 'lumps' | 'lots'>): LumpLot[] {
  const by = new Map<number, number>();
  for (const l of pileLots(state)) by.set(l.band, (by.get(l.band) ?? 0) + l.count);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([band, count]) => ({ band, count }));
}

/**
 * Lumps the server hands over (6.8 서버가 준다; src/platform/server.ts today): they join the pile at
 * their band. The pile's cap is the server's to keep (it counts up to it, idleLumpCap).
 */
export function receiveLumps(state: RefineState, n: number, band: number): RefineState {
  const add = Math.max(0, Math.floor(n));
  if (add === 0) return state;
  return { ...state, lumps: state.lumps + add, lots: addLot(state, add, Math.max(1, Math.floor(band))) };
}

/** The world minute the next lump comes in, or null while the pile is full. */
export function nextLumpAt(state: RefineState, bestFloor = 0): number | null {
  if (state.lumps >= idleLumpCap(bestFloor)) return null;
  const need = 60 - (state.carry ?? 0);
  return state.accruedAt + Math.max(1, Math.ceil(need / idleLumpsPerHour(bestFloor)));
}

// ---------- Multipliers ----------

export function isRefineMult(v: unknown): v is RefineMult {
  return typeof v === 'number' && (REFINE_MULTS as readonly number[]).includes(v);
}

/**
 * The multiplier a blow uses (10.1): the one chosen, or, when the pile has fewer lumps than that,
 * the largest it can still pay. null when there is not one lump.
 */
export function effectiveMult(lumps: number, chosen: RefineMult): RefineMult | null {
  let best: RefineMult | null = null;
  for (const m of REFINE_MULTS) if (m <= chosen && m <= lumps) best = m;
  return best;
}

/**
 * The multiplier button (10.1): ×1 → ×2 → ×5 → ×10 → ×20 → ×1, skipping any the pile cannot pay
 * for even once. With nothing to skip to (not one lump, or only ×1 payable), it stays.
 */
export function nextMult(current: RefineMult, lumps: number): RefineMult {
  const i = REFINE_MULTS.indexOf(current);
  for (let k = 1; k < REFINE_MULTS.length; k++) {
    const m = REFINE_MULTS[(i + k) % REFINE_MULTS.length] as RefineMult;
    if (m <= lumps) return m;
  }
  return current;
}

/** Blows the pile pays for at this multiplier. */
export function hitsLeft(lumps: number, mult: RefineMult): number {
  return Math.max(0, Math.floor(lumps / mult));
}

// ---------- One blow ----------

const WEIGHTS: readonly number[] = REFINE_TABLE.map((r) => r.weight);

/**
 * The drop of blow number refineNo at ×mult: (world seed, 'refine', 정제 번호) alone decides the row
 * and the roll (3.6); the lump's band scales the amount (bandAmount, 7.1).
 */
export function rollRefine(worldSeed: number, refineNo: number, mult: RefineMult, band = 1): RefineDrop {
  const rng = rngFor(worldSeed, 'refine', refineNo);
  const row = REFINE_TABLE[rng.weightedIndex(WEIGHTS)] ?? REFINE_TABLE[0];
  const rolled = row.min === row.max ? row.min : rng.int(row.min, row.max);
  const b = Math.max(1, Math.floor(band));
  const base = bandAmount(row.kind, rolled, b);
  return { refineNo, item: row.id, rarity: row.rarity, base, mult, amount: base * mult, band: b };
}

const EXP_ITEMS = new Set<string>(REFINE_TABLE.filter((r) => r.kind === 'exp').map((r) => r.id));

/** Whether a drop is 경험치 (it fills the level bar, not the bag, 5.3). */
export function isExpDrop(d: Pick<RefineDrop, 'item'>): boolean {
  return EXP_ITEMS.has(d.item);
}

/** 경험치 in some drops (it goes to the shared level: hero/level.ts addExp, 5.3). */
export function refineExp(drops: readonly Pick<RefineDrop, 'item' | 'amount'>[]): number {
  let n = 0;
  for (const d of drops) if (EXP_ITEMS.has(d.item)) n += d.amount;
  return n;
}

/**
 * One blow of the hammer at exactly ×mult: mult lumps go (oldest first; the blow is worth the band
 * of the first one), one row comes out × mult and is in the bag at once (친 결과는 그 자리에서 가방
 * 몫). 경험치 skips the bag: the caller puts refineExp of the drops into the shared level (5.3).
 * null when the pile cannot pay mult.
 */
export function hitOnce(state: RefineState, worldSeed: number, mult: RefineMult): { state: RefineState; drop: RefineDrop } | null {
  if (!isRefineMult(mult) || state.lumps < mult) return null;
  const refineNo = state.refineNo + 1;
  const taken = takeLumps(state, mult);
  const drop = rollRefine(worldSeed, refineNo, mult, taken.band);
  const bag = isExpDrop(drop) ? state.bag : { ...state.bag, [drop.item]: (state.bag[drop.item] ?? 0) + drop.amount };
  const next: RefineState = { ...state, lumps: state.lumps - mult, refineNo, bag };
  if (state.lots !== undefined) next.lots = taken.lots;
  return { state: next, drop };
}

// ---------- A batch: one press of the hammer ----------

/** The blows of one press (최대 15). Plain JSON; the screen shows its drops round the anvil. */
export interface RefineBatch {
  drops: RefineDrop[];
}

export function newBatch(): RefineBatch {
  return { drops: [] };
}

export function batchFull(batch: RefineBatch): boolean {
  return batch.drops.length >= REFINE_BATCH_MAX;
}

/**
 * The next blow of a press (10.1 누르기와 묶음): null when the batch has its 15 or the pile is
 * empty. A pile short of the chosen multiplier is struck at the largest it can pay.
 */
export function hitInBatch(
  state: RefineState,
  batch: RefineBatch,
  worldSeed: number,
  chosen: RefineMult,
): { state: RefineState; batch: RefineBatch; drop: RefineDrop } | null {
  if (batchFull(batch)) return null;
  const mult = effectiveMult(state.lumps, chosen);
  if (mult === null) return null;
  const r = hitOnce(state, worldSeed, mult);
  if (r === null) return null;
  return { state: r.state, batch: { drops: [...batch.drops, r.drop] }, drop: r.drop };
}

/**
 * Time from blow n of a held press (1 = the press) to the next (10.1): firstMs, each one stepMs
 * sooner, never under minMs.
 */
export function holdIntervalMs(n: number): number {
  const k = Math.max(0, Math.floor(n) - 1);
  return Math.max(REFINE_TEMPO.minMs, REFINE_TEMPO.firstMs - REFINE_TEMPO.stepMs * k);
}
