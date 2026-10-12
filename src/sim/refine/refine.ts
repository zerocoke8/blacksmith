// 광석 정제의 규칙 (기획서 10.1): lumps pile up while the player is away, and each blow of the
// hammer turns `mult` lumps into one row of the result table × mult. Pure and deterministic
// (CLAUDE.md 규칙 1): time comes in as whole world minutes, every result comes from
// rngFor(worldSeed, 'refine', 정제 번호) (3.6), and the state is plain JSON.
// The screen keeps the tempo and plays the effects; it calls hitOnce / hitInBatch once per blow
// and shows what came back (규칙 2).

import { rngFor } from '../core/rng.ts';
import {
  REFINE_BATCH_MAX,
  REFINE_LUMPS,
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
  /** base × mult: what went into the bag. */
  amount: number;
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
 * Count the lumps that came in up to nowMinute (10.1 쌓이기). The counted-up-to minute moves on
 * only by the lumps counted, so a part-minute is never lost. When the pile reaches the cap the
 * time while it is full is thrown away (the minute moves to now). A clock behind the counted
 * minute (set back, another device) adds nothing and moves nothing: it waits (3.6). Path
 * independent: counting at t1 then t2 gives what counting once at t2 gives.
 */
export function accrue(state: RefineState, nowMinute: number): Accrual {
  const now = wholeMinute(nowMinute);
  if (now <= state.accruedAt) return { state, gained: 0 };
  const room = REFINE_LUMPS.cap - state.lumps;
  if (room <= 0) return { state: { ...state, accruedAt: now }, gained: 0 };
  const steps = Math.floor((now - state.accruedAt) / REFINE_LUMPS.everyMinutes);
  if (steps <= 0) return { state, gained: 0 };
  if (steps >= room) return { state: { ...state, lumps: REFINE_LUMPS.cap, accruedAt: now }, gained: room };
  return {
    state: { ...state, lumps: state.lumps + steps, accruedAt: state.accruedAt + steps * REFINE_LUMPS.everyMinutes },
    gained: steps,
  };
}

/** The world minute the next lump comes in, or null while the pile is full. */
export function nextLumpAt(state: RefineState): number | null {
  if (state.lumps >= REFINE_LUMPS.cap) return null;
  return state.accruedAt + REFINE_LUMPS.everyMinutes;
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

/** The drop of blow number refineNo at ×mult: (world seed, 'refine', 정제 번호) alone decides it (3.6). */
export function rollRefine(worldSeed: number, refineNo: number, mult: RefineMult): RefineDrop {
  const rng = rngFor(worldSeed, 'refine', refineNo);
  const row = REFINE_TABLE[rng.weightedIndex(WEIGHTS)] ?? REFINE_TABLE[0];
  const base = row.min === row.max ? row.min : rng.int(row.min, row.max);
  return { refineNo, item: row.id, rarity: row.rarity, base, mult, amount: base * mult };
}

/**
 * One blow of the hammer at exactly ×mult: mult lumps go, one row comes out × mult and is in the
 * bag at once (친 결과는 그 자리에서 가방 몫). null when the pile cannot pay mult.
 */
export function hitOnce(state: RefineState, worldSeed: number, mult: RefineMult): { state: RefineState; drop: RefineDrop } | null {
  if (!isRefineMult(mult) || state.lumps < mult) return null;
  const refineNo = state.refineNo + 1;
  const drop = rollRefine(worldSeed, refineNo, mult);
  const bag = { ...state.bag, [drop.item]: (state.bag[drop.item] ?? 0) + drop.amount };
  return { state: { ...state, lumps: state.lumps - mult, refineNo, bag }, drop };
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
