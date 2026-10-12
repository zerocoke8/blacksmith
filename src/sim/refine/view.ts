// What the refine screen shows (기획서 10.1 화면): the pile, the multiplier the hammer will use and
// how many blows that pays for, the bag in table order, and the odds for the 실험 panel.
// Plain data from the state; the screen formats it.

import {
  REFINE_LUMPS,
  REFINE_TABLE,
  type RefineItemId,
  type RefineKind,
  type RefineMult,
  type RefineRarity,
} from '../data/refine.ts';
import { effectiveMult, hitsLeft, nextLumpAt, type RefineState } from './refine.ts';

export interface RefineBagLine {
  id: RefineItemId;
  name: string;
  kind: RefineKind;
  rarity: RefineRarity;
  count: number;
}

export interface RefineView {
  lumps: number;
  cap: number;
  /** The pile is at its cap: nothing more comes in until it is struck. */
  full: boolean;
  /** At least one lump: the hammer can strike. */
  canHit: boolean;
  /** The multiplier the next blow uses (the chosen one, or lower when the pile is short), null with no lump. */
  mult: RefineMult | null;
  /** The chosen multiplier is more than the pile pays for, so the blow goes lower. */
  lowered: boolean;
  /** Blows the pile pays for at `mult`. */
  hits: number;
  /** The world minute the next lump comes in, null while full. */
  nextLumpAt: number | null;
  /** The bag in table order, items there are only. */
  bag: RefineBagLine[];
  gold: number;
  /** Everything in the bag but gold. */
  items: number;
  refineNo: number;
}

export function refineView(state: RefineState, chosen: RefineMult): RefineView {
  const mult = effectiveMult(state.lumps, chosen);
  const bag: RefineBagLine[] = [];
  let gold = 0;
  let items = 0;
  for (const row of REFINE_TABLE) {
    const count = state.bag[row.id] ?? 0;
    if (count <= 0) continue;
    bag.push({ id: row.id, name: row.name, kind: row.kind, rarity: row.rarity, count });
    if (row.kind === 'gold') gold += count;
    else items += count;
  }
  return {
    lumps: state.lumps,
    cap: REFINE_LUMPS.cap,
    full: state.lumps >= REFINE_LUMPS.cap,
    canHit: mult !== null,
    mult,
    lowered: mult !== null && mult < chosen,
    hits: mult === null ? 0 : hitsLeft(state.lumps, mult),
    nextLumpAt: nextLumpAt(state),
    bag,
    gold,
    items,
    refineNo: state.refineNo,
  };
}

/** Totals by item: gold apart, the rest summed (for counting up as drops fly into the bag). */
export function bagTotals(bag: Partial<Record<RefineItemId, number>>): { gold: number; items: number } {
  let gold = 0;
  let items = 0;
  for (const row of REFINE_TABLE) {
    const n = bag[row.id] ?? 0;
    if (row.kind === 'gold') gold += n;
    else items += n;
  }
  return { gold, items };
}

export interface RefineOddsLine {
  id: RefineItemId;
  name: string;
  kind: RefineKind;
  rarity: RefineRarity;
  /** Chance of this row per blow (0..1). */
  chance: number;
  min: number;
  max: number;
}

/** The result table as chances per blow (the same at every multiplier). */
export function refineOdds(): RefineOddsLine[] {
  const total = REFINE_TABLE.reduce((s, r) => s + r.weight, 0);
  return REFINE_TABLE.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    rarity: r.rarity,
    chance: total > 0 ? r.weight / total : 0,
    min: r.min,
    max: r.max,
  }));
}

/** Chance per blow of each rarity. */
export function rarityOdds(): Record<RefineRarity, number> {
  const out: Record<RefineRarity, number> = { common: 0, uncommon: 0, rare: 0, veryRare: 0 };
  for (const line of refineOdds()) out[line.rarity] += line.chance;
  return out;
}
