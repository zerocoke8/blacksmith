import { describe, expect, it } from 'vitest';
import { CARD_IDS, CARDS } from '../data/cards.ts';
import { cardCostSteps, endTurn, playCard, startCardCraft } from './engine.ts';
import { resolveCardRules } from './smith.ts';
import { cardText } from './text.ts';
import { cloneCraft, inHand, layOut, makeCardSetup } from './testkit.ts';
import { activeEffects, cardRuleNotes, handView, pileCounts } from './view.ts';

describe('craft screen view (4.2.9)', () => {
  const start = layOut(
    startCardCraft(makeCardSetup({ deck: [...makeCardSetup().deck, 'allIn'], rules: { firePreset: 'allNormal' } })),
    ['precisePolish', 'finisher', 'bellows', 'allIn', 'hammer'],
  );

  it('greys out cards with the reason, shows current costs and 막타', () => {
    const view = handView({ ...cloneCraft(start), progress: 300, durability: 2 });
    const by = Object.fromEntries(view.map((v) => [v.card, v]));
    expect(by.precisePolish?.block).toBe('좋음·최상일 때만');
    expect(by.finisher?.block).toBe('열기가 없다');
    expect(by.bellows).toMatchObject({ block: null, cost: 2, breaks: true });
    expect(by.hammer).toMatchObject({ block: null, finishes: true, cost: 3, name: '두드리기', kindLabel: '공정' });
  });

  it('lists what is on, like "풀무질 1턴"', () => {
    let s = playCard(start, inHand(start, 'bellows'));
    s = playCard(s, inHand(s, 'allIn'));
    expect(activeEffects(s)).toEqual(['풀무질 2턴', '혼신 1장']);
    s = endTurn(s);
    expect(activeEffects(s)).toEqual(['풀무질 1턴', '혼신 1장']);
    // 13 cards: 5 in hand, 2 played + 3 thrown away, 3 left to draw.
    expect(pileCounts(s)).toEqual({ draw: 3, discard: 5, exhausted: 0 });
  });
});

describe('[검증] switches on the craft screen', () => {
  const cooling = layOut(
    startCardCraft(makeCardSetup({ rules: { firePreset: 'allNormal', coolingIron: true } })),
    ['quench', 'hammer', 'polish', 'bellows', 'hammer'],
  );

  it('says 식는 쇠 is on, and how much the next card costs more', () => {
    expect(activeEffects(cooling)).toEqual(['식는 쇠']);
    const s = playCard(cooling, inHand(cooling, 'quench'));
    expect(activeEffects(s)).toEqual(['식는 쇠 · 다음 카드 +1']);
    expect(activeEffects(startCardCraft(makeCardSetup()))).toEqual([]);
  });

  it('explains a cost that moved: 식는 쇠, 아껴 치기, 단단함', () => {
    const s = playCard(cooling, inHand(cooling, 'quench'));
    expect(cardCostSteps(s, inHand(s, 'hammer'))).toEqual({ base: 3, steps: [{ label: '식는 쇠', delta: 1 }], cost: 4 });
    const sturdy = { ...cloneCraft(s), fire: 'sturdy' as const, buffs: { thrift: 1 } };
    expect(cardCostSteps(sturdy, inHand(sturdy, 'hammer'))).toEqual({
      base: 3,
      steps: [
        { label: '식는 쇠', delta: 1 },
        { label: '아껴 치기', delta: -1 },
        { label: '단단함', delta: -1 },
      ],
      cost: 2,
    });
    expect(cardCostSteps(cooling, inHand(cooling, 'hammer')).steps).toEqual([]);
  });

  it('lists the switches that are not the doc', () => {
    expect(cardRuleNotes(resolveCardRules({}))).toEqual([]);
    expect(
      cardRuleNotes(resolveCardRules({ handSize: 6, reheatCost: 0, coolingIron: true, firePreset: 'volatile', durabilityDelta: -10 })),
    ).toEqual(['손패 6', '다시 달구기 0', '식는 쇠', '화로 요동', '내구도 −10']);
  });
});

describe('card text on the hand', () => {
  it('the short form says the same in fewer letters', () => {
    expect(cardText('finisher')).toBe('열기 1 이상일 때. 열기를 모두 써서 품질 +100% × (1 + 열기 × 0.2)');
    expect(cardText('finisher', 1, { short: true })).toBe('열기를 모두 써서 품질 +100% (열기당 +20%)');
    expect(cardText('grandFinish', 1, { short: true })).toBe('열기 5 이상. 열기를 모두 써서 품질 +100% (열기당 +30%)');
    for (const id of CARD_IDS) {
      if (CARDS[id].imprint !== null) continue;
      expect(cardText(id, 1, { short: true }).length).toBeLessThanOrEqual(cardText(id).length);
    }
    const s = startCardCraft(makeCardSetup());
    for (const v of handView(s)) expect(v.shortText).toBe(cardText(v.card, 1, { short: true }));
  });
});
