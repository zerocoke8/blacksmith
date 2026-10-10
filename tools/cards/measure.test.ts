// A small, fixed measurement (기획서 4.2.1). Any change to the engine, the card data or the
// bots that moves the numbers fails here, so it is seen before the full measure.ts run.
// When the change is meant, run `node tools/cards/measure.ts` again and update these.

import { describe, expect, it } from 'vitest';
import { makeSmartBot, simpleBot } from './bots.ts';
import { checkSetDeck, runSet, SETS, type Stats, summarize } from './sets.ts';

const r4 = (x: number): number => Math.round(x * 10000) / 10000;

/** fail, ★1~★5, median, p10, hands, cards, thrown away, '다 내기', '빈 턴'. */
function pinned(s: Stats): number[] {
  return [s.fail, ...s.tiers, s.median, s.p10, s.turns, s.cards, s.discarded, s.allPlayedShare, s.emptyTurnShare].map(r4);
}

function measured(id: string, bot: 'simple' | 'smart'): number[] {
  const set = SETS.find((x) => x.id === id);
  if (set === undefined) throw new Error(`no set ${id}`);
  return pinned(summarize(bot === 'simple' ? runSet(set, simpleBot, 400, 1, 40) : runSet(set, makeSmartBot(), 20, 1, 40)));
}

describe('measurement (world seed 1, 단순 400판, 따짐 20판)', () => {
  it('1일차 덱 · 굴림 모두 보통', () => {
    expect(measured('day1', 'simple')).toEqual([0, 0.0025, 0.325, 0.6, 0.0625, 0.01, 0.6063, 0.4231, 2.925, 11.87, 1.25, 0.8208, 0]);
    expect(measured('day1', 'smart')).toEqual([0, 0, 0, 0.65, 0.3, 0.05, 0.7338, 0.665, 3.95, 12.55, 5.55, 0.3051, 0.038]);
  });

  it('1일차 덱 · 상태 굴림', () => {
    expect(measured('day1Rolled', 'simple')).toEqual([
      0, 0.0025, 0.2675, 0.5575, 0.1075, 0.065, 0.6513, 0.4363, 2.9275, 11.9175, 1.195, 0.8197, 0,
    ]);
    expect(measured('day1Rolled', 'smart')).toEqual([0, 0, 0, 0.45, 0.45, 0.1, 0.8031, 0.645, 4, 12.4, 5.75, 0.3, 0.05]);
  });

  it('every set is a deck the 작업대 would accept', () => {
    for (const set of SETS) expect(() => checkSetDeck(set)).not.toThrow();
  });
});
