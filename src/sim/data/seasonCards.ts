// 시즌 카드 (기획서 13.8.1): 그 시즌 판의 보상 후보와 행상에만 나오는 카드 2~3장. 육성 한 판 전용이다.
// The card list (data/cards.ts) reads only this file, never the run's tuning file (data/run.ts), so the
// shared card data does not lean on the mode (1.2: 공통부와 모드를 섞지 않는다). To fold the run mode
// away, delete this file and its two lines in cards.ts (the import and the spread).
// This file only imports types from cards.ts, so the two modules never wait on each other at load time.

import type { CardEffect, CardSpecInput } from './cards.ts';

export const SEASON_CARD_IDS = [
  'ashHammer', // 재 섞인 망치 (1시즌)
  'ashQuench', // 재 담금질 (1시즌)
] as const;
export type SeasonCardId = (typeof SEASON_CARD_IDS)[number];

const sq = (ratio: number): CardEffect => ({ type: 'quality', ratio });
const sp = (ratio: number): CardEffect => ({ type: 'progress', ratio });
const sh = (amount: number): CardEffect => ({ type: 'heat', amount });

/** Card specs merged into src/sim/data/cards.ts. [튜닝] */
export const SEASON_CARD_SPECS: Record<SeasonCardId, CardSpecInput> = {
  ashHammer: {
    name: '재 섞인 망치',
    kind: 'progress',
    group: 'season',
    cost: 3,
    effects: [sp(0.7), sq(0.5), sh(1)],
  },
  ashQuench: {
    name: '재 담금질',
    kind: 'support',
    group: 'season',
    cost: 0,
    keywords: { exhaust: true },
    effects: [{ type: 'restore', amount: 5, overMax: false }, sh(2)],
  },
};
