// 덱 편집 (작업대) rules (기획서 4.2.1, 4.2.2, 4.2.6). Editing is free and allowed any time;
// these checks say whether a deck may be saved and used.

import {
  BASIC_CARD_IDS,
  type CardId,
  CARDS,
  DAY_ONE_DECK,
  DECK_RULES,
  UNLOCK_CAP,
  UNLOCK_CARD_IDS,
} from '../data/cards.ts';

/** What the smith owns beyond the six basic cards (always owned, no count limit). */
export interface CardCollection {
  /** 배운 해금 카드 (4.2.2). Owned without a count limit. */
  learned: CardId[];
  /** 만든 진화 카드 장수 (4.2.5). */
  evolved: Partial<Record<CardId, number>>;
}

export const EMPTY_COLLECTION: CardCollection = { learned: [], evolved: {} };

/** 1일차 덱 (4.2.1) as a card list. */
export function dayOneDeck(): CardId[] {
  const out: CardId[] = [];
  for (const [id, n] of DAY_ONE_DECK) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

/** 덱의 해금 카드 수 상한 at a 명성 단계 (stage 8 = ★1 …), 3 → 12 (9.2). */
export function unlockCap(fameStage: number): number {
  const stage = Number.isFinite(fameStage) ? Math.max(1, Math.floor(fameStage)) : 1;
  const table = UNLOCK_CAP.byStage;
  if (stage <= table.length) return table[stage - 1] as number;
  const last = table[table.length - 1] as number;
  return Math.min(UNLOCK_CAP.max, last + UNLOCK_CAP.perStarStage * (stage - table.length));
}

/**
 * 해금 카드 learned at a 명성 단계 (4.2.2): a node opens at its stage, and stage-1 cards
 * only after the first craft is done.
 */
export function learnedUnlockCards(fameStage: number, firstCraftDone: boolean): CardId[] {
  return UNLOCK_CARD_IDS.filter((id) => {
    const node = CARDS[id].unlock;
    if (node === null || node.stage > fameStage) return false;
    return node.stage > 1 || firstCraftDone;
  });
}

/** Cards that come to hand: 각인 and material cards are not counted (4.2.6). */
export function deckHandCount(deck: readonly CardId[]): number {
  return deck.filter((id) => CARDS[id].imprint === null && CARDS[id].kind !== 'material').length;
}

/** Counts toward the 해금 카드 상한: 해금 카드, their 각인 and their evolutions (not evolved basic cards). */
export function countsAsUnlock(id: CardId): boolean {
  return CARDS[CARDS[id].family].group === 'unlock';
}

/** 같은 계열 장수 limit for a card's family (4.2.6). */
export function familyLimit(id: CardId): number {
  const family = CARDS[id].family;
  const root = CARDS[family];
  if (root.group === 'basic') return DECK_RULES.familyLimit.basic;
  if (root.keywords.firstHand === true || root.imprint !== null) return DECK_RULES.familyLimit.firstHandOrImprint;
  return DECK_RULES.familyLimit.unlock;
}

export interface DeckProblem {
  code: 'size' | 'unlockCap' | 'family' | 'pair' | 'notOwned' | 'notDeckCard';
  /** Short Korean line for the 작업대 screen. */
  message: string;
  card?: CardId;
}

function countBy<T>(list: readonly T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

/** Every rule the deck breaks; empty if it can be used (4.2.6). */
export function checkDeck(deck: readonly CardId[], collection: CardCollection, fameStage: number): DeckProblem[] {
  const problems: DeckProblem[] = [];
  const counts = countBy(deck);

  for (const [id, n] of counts) {
    const spec = CARDS[id];
    if (spec.kind === 'material') {
      problems.push({ code: 'notDeckCard', card: id, message: `${spec.name}: 재료 카드는 덱에 넣지 않는다` });
    } else if (spec.group === 'unlock' && !collection.learned.includes(id)) {
      problems.push({ code: 'notOwned', card: id, message: `${spec.name}: 아직 배우지 않았다` });
    } else if (spec.group === 'evolved' && n > (collection.evolved[id] ?? 0)) {
      problems.push({ code: 'notOwned', card: id, message: `${spec.name}: ${collection.evolved[id] ?? 0}장만 있다` });
    }
  }

  const size = deckHandCount(deck);
  if (size < DECK_RULES.minCards || size > DECK_RULES.maxCards) {
    problems.push({ code: 'size', message: `덱은 ${DECK_RULES.minCards}~${DECK_RULES.maxCards}장 (지금 ${size}장)` });
  }

  const unlocks = deck.filter(countsAsUnlock).length;
  const cap = unlockCap(fameStage);
  if (unlocks > cap) problems.push({ code: 'unlockCap', message: `해금 카드는 ${cap}장까지 (지금 ${unlocks}장)` });

  const families = countBy(deck.filter((id) => CARDS[id].kind !== 'material').map((id) => CARDS[id].family));
  for (const [family, n] of families) {
    const limit = familyLimit(family);
    if (n > limit) problems.push({ code: 'family', card: family, message: `${CARDS[family].name} 계열은 ${limit}장까지` });
  }

  for (const [family] of families) {
    const pair = CARDS[family].unlock?.pair ?? null;
    // Report each ↔ once, from the card listed first in the branch table.
    const order = UNLOCK_CARD_IDS as readonly CardId[];
    if (pair !== null && families.has(pair) && order.indexOf(family) < order.indexOf(pair)) {
      problems.push({ code: 'pair', card: family, message: `${CARDS[family].name} ↔ ${CARDS[pair].name}: 둘 중 하나만` });
    }
  }
  return problems;
}

/** The basic six (always owned). */
export function isBasicCard(id: CardId): boolean {
  return (BASIC_CARD_IDS as readonly string[]).includes(id);
}
