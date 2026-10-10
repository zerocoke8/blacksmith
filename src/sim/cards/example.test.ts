// 기획서 4.2.10 한 판 예시, played card by card. Every number in the doc's table must match.

import { describe, expect, it } from 'vitest';
import type { CardId } from '../data/cards.ts';
import { cardCraftOutcome, type CardCraftState, checkPlay, drawPileSummary, endTurn, playCard } from './engine.ts';
import { cloneCraft, handIds, inHand, layOut, startDayOne } from './testkit.ts';

interface Row {
  card: CardId;
  durability: number;
  progress: number;
  quality: number;
  heat: number;
}

function playRows(state: CardCraftState, rows: Row[]): CardCraftState {
  let s = state;
  for (const r of rows) {
    s = playCard(s, inHand(s, r.card));
    expect({ card: r.card, durability: s.durability, progress: s.progress, quality: s.quality, heat: s.heat }).toEqual(r);
  }
  return s;
}

/** Turn 1 of the example, all 보통: 1일차 덱 10장 + 쇳물 고르기 2장, 손패 5. */
function exampleStart(): CardCraftState {
  const s = startDayOne({ rules: { firePreset: 'allNormal' } });
  expect(s.recipe).toMatchObject({ progressRequired: 390, qualityCap: 1600, durability: 28 });
  expect(Object.keys(s.cards)).toHaveLength(12);
  return layOut(
    s,
    ['polish', 'hammer', 'precisePolish', 'quench', 'hammer'],
    ['bellows', 'finisher', 'ironMelt', 'polish', 'ironMelt', 'polish', 'hammer'],
  );
}

function throughTurnTwo(): CardCraftState {
  let s = exampleStart();
  // 1턴: 정밀 다듬기는 보통이라 못 낸다.
  expect(checkPlay(s, inHand(s, 'precisePolish'))).toMatchObject({ ok: false, reason: '좋음·최상일 때만' });
  s = playRows(s, [
    { card: 'polish', durability: 25, progress: 0, quality: 100, heat: 1 },
    { card: 'hammer', durability: 22, progress: 100, quality: 100, heat: 1 },
    { card: 'hammer', durability: 19, progress: 200, quality: 100, heat: 1 },
    { card: 'quench', durability: 27, progress: 200, quality: 100, heat: 1 },
  ]);
  s = endTurn(s);
  expect(s.durability).toBe(25);
  expect(s.turn).toBe(2);
  expect(handIds(s)).toEqual(['bellows', 'finisher', 'ironMelt', 'polish', 'ironMelt']);
  s = playRows(s, [
    { card: 'bellows', durability: 23, progress: 200, quality: 100, heat: 1 },
    { card: 'polish', durability: 20, progress: 200, quality: 265, heat: 2 },
    { card: 'ironMelt', durability: 18, progress: 250, quality: 355, heat: 3 },
    { card: 'ironMelt', durability: 16, progress: 300, quality: 452, heat: 4 },
    // 100 × 마무리 1.8 × 열기 보정 1.4 × 풀무질 1.5 = 378
    { card: 'finisher', durability: 13, progress: 300, quality: 830, heat: 0 },
  ]);
  s = endTurn(s);
  expect(s.durability).toBe(11);
  return s;
}

describe('4.2.10 한 판 예시', () => {
  it('turn 3 draws the last 2 cards, then shuffles the 7 discarded ones', () => {
    const s = throughTurnTwo();
    // 담금질 and both 쇳물 고르기 are gone (소멸); 7 went to the discard and were reshuffled.
    expect(s.exhausted.map((u) => s.cards[u])).toEqual(['quench', 'ironMelt', 'ironMelt']);
    expect(s.shuffleNo).toBe(2);
    expect(s.hand).toHaveLength(5);
    expect(s.drawPile).toHaveLength(4);
    expect(s.discard).toHaveLength(0);
    expect(handIds(s).slice(0, 2)).toEqual(['polish', 'hammer']);
    const left = drawPileSummary(s).reduce((n, x) => n + x.count, 0);
    expect(left).toBe(4);
  });

  it('ends at quality 1,145 / 1,600 = ★3 역작, 2 slots, 3 turns, 12 cards', () => {
    let s = throughTurnTwo();
    s = layOut(s, ['polish', 'hammer', 'polish', 'precisePolish', 'bellows'], [], true);
    // 2턴의 풀무질이 아직 타고 있다.
    expect(s.buffs.bellows).toBe(1);
    s = playRows(s, [
      { card: 'polish', durability: 8, progress: 300, quality: 980, heat: 1 },
      { card: 'polish', durability: 5, progress: 300, quality: 1145, heat: 2 },
    ]);
    expect(checkPlay(s, inHand(s, 'hammer'))).toEqual({ ok: true, cost: 3, finishes: true, breaks: false });
    s = playCard(s, inHand(s, 'hammer'));
    expect([s.durability, s.progress, s.quality, s.heat]).toEqual([2, 400, 1145, 2]);
    const out = cardCraftOutcome(s);
    expect(out).toMatchObject({ status: 'success', tier: 3, slots: 2, turns: 3, cardsPlayed: 12 });
    expect(out.qualityRatio).toBeCloseTo(0.7156, 4);
  });

  it('a 좋음 third turn makes a ★5 걸작, finishing with 막타 on 2 durability', () => {
    let s = throughTurnTwo();
    s = layOut(s, ['polish', 'hammer', 'polish', 'precisePolish', 'bellows'], [], true);
    s = { ...cloneCraft(s), fire: 'good' };
    s = playAll(s, ['precisePolish', 'polish', 'polish']);
    expect(s.durability).toBe(2);
    expect(s.quality).toBe(1600);
    // 두드리기 costs 3 > 2, but it fills the 공정: 막타.
    expect(checkPlay(s, inHand(s, 'hammer'))).toMatchObject({ ok: true, finishes: true });
    s = playCard(s, inHand(s, 'hammer'));
    expect(s.durability).toBe(-1);
    expect(cardCraftOutcome(s)).toMatchObject({ status: 'success', tier: 5, slots: 4 });
  });
});

function playAll(state: CardCraftState, ids: CardId[]): CardCraftState {
  let s = state;
  for (const id of ids) s = playCard(s, inHand(s, id));
  return s;
}
