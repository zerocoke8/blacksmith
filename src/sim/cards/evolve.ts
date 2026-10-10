// 단련과 진화 (기획서 4.2.5). Playing a card kind enough times opens its 단련; the smith then
// pays gold to make evolved cards one at a time, picking a branch per card. Gold is only
// computed here; spending it is the caller's job (방치 세계, 4.2.11).

import { powInt } from '../data/common.ts';
import { type CardId, CARDS, EVOLVE_BASE_COST, EVOLVE_COST_STEP } from '../data/cards.ts';
import type { CardCollection } from './deck.ts';
import type { CardCraftState } from './engine.ts';

/** 누적 단련: times each card kind was played; for a 각인, crafts finished with it in the deck. */
export type TemperRecord = Partial<Record<CardId, number>>;

/** 'power' = 갈래 A (힘), 'finesse' = 갈래 B (손놀림). */
export type EvolveBranch = 'power' | 'finesse';

export const EVOLVE_BRANCH_LABEL: Record<EvolveBranch, string> = { power: '힘', finesse: '손놀림' };

/** Plays (or crafts) needed to open the card's 단련, or null if it has no branches. */
export function temperNeed(id: CardId): number | null {
  return CARDS[id].temper;
}

export function isTemperOpen(record: TemperRecord, id: CardId): boolean {
  const need = temperNeed(id);
  return need !== null && (record[id] ?? 0) >= need;
}

/** Cards from the 기술 덱 count; material cards do not (4.1 출력). */
function countsForTemper(id: CardId): boolean {
  return CARDS[id].kind !== 'material';
}

/**
 * Adds a finished craft to the record: every play of a 기술 덱 card, and +1 for each 각인
 * in the deck if the craft succeeded ('넣고 마친 제작'). An unfinished craft adds nothing.
 */
export function recordTemper(record: TemperRecord, state: CardCraftState): TemperRecord {
  if (state.status === 'active') return record;
  const next: TemperRecord = { ...record };
  for (const [id, n] of Object.entries(state.uses) as [CardId, number][]) {
    if (countsForTemper(id)) next[id] = (next[id] ?? 0) + n;
  }
  if (state.status === 'success') for (const id of new Set(state.imprints)) next[id] = (next[id] ?? 0) + 1;
  return next;
}

/** Cards whose 단련 opened between two records ("손에 익었군." line). */
export function newlyOpened(before: TemperRecord, after: TemperRecord): CardId[] {
  return (Object.keys(after) as CardId[]).filter((id) => !isTemperOpen(before, id) && isTemperOpen(after, id));
}

/** 진화 1장 = 기준가 × 2^(명성 단계 − 1): 기본 카드 300G, 해금 카드 600G (4.2.5). */
export function evolveCost(id: CardId, fameStage: number): number {
  const root = CARDS[CARDS[id].family];
  const base = root.group === 'basic' ? EVOLVE_BASE_COST.basic : EVOLVE_BASE_COST.unlock;
  const stage = Number.isFinite(fameStage) ? Math.max(1, Math.floor(fameStage)) : 1;
  return Math.round(base * powInt(EVOLVE_COST_STEP, stage - 1));
}

/** The evolved card a branch makes. */
export function evolutionOf(id: CardId, branch: EvolveBranch): CardId | null {
  const evo = CARDS[id].evolutions;
  if (evo === null) return null;
  return branch === 'power' ? evo[0] : evo[1];
}

/** Why the card cannot be evolved now (short Korean), or null. */
export function evolveBlock(record: TemperRecord, id: CardId): string | null {
  const need = temperNeed(id);
  if (need === null) return '아직 갈래가 없다';
  if ((record[id] ?? 0) < need) return `단련 ${record[id] ?? 0} / ${need}`;
  return null;
}

/**
 * Makes one evolved card. The original card stays (basic and unlock cards have no count
 * limit); the evolved card is added to the collection. Returns the gold it costs.
 */
export function evolveCard(
  collection: CardCollection,
  record: TemperRecord,
  id: CardId,
  branch: EvolveBranch,
  fameStage: number,
): { collection: CardCollection; card: CardId; cost: number } {
  const reason = evolveBlock(record, id);
  if (reason !== null) throw new Error(`cannot evolve ${id}: ${reason}`);
  const card = evolutionOf(id, branch) as CardId;
  return {
    collection: {
      learned: [...collection.learned],
      evolved: { ...collection.evolved, [card]: (collection.evolved[card] ?? 0) + 1 },
    },
    card,
    cost: evolveCost(id, fameStage),
  };
}
