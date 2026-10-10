// [검증] switches (16.3): hand size, 다시 달구기 cost, '식는 쇠', fire presets, 레시피 내구도 ±n.
// The defaults must be the doc's rules.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_RULES, FIRE_WEIGHTS, REHEAT_COST } from '../data/cards.ts';
import { cardCost, type CardCraftState, endTurn, playCard, reheatInfo, startCardCraft } from './engine.ts';
import { fireWeights, rollTurnFire } from './fire.ts';
import { cardSmithStats, resolveCardRules } from './smith.ts';
import { inHand, layOut, makeCardSetup } from './testkit.ts';

describe('defaults are the doc', () => {
  it('손패 by 화로, 다시 달구기 −2, 식는 쇠 off, fire table as written', () => {
    expect(resolveCardRules(undefined)).toEqual({
      handSize: null,
      reheatCost: 2,
      coolingIron: false,
      firePreset: 'default',
      durabilityDelta: 0,
    });
    expect(DEFAULT_CARD_RULES.reheatCost).toBe(REHEAT_COST);
    expect(fireWeights('basic', 'default')).toEqual([87.25, 12, 0.75, 0, 0, 0, 0, 0]);
    const rules = resolveCardRules({});
    const hands = [0, 1, 2, 3, 4].map((furnace) => cardSmithStats({ anvil: 0, whetstone: 0, furnace }, [], rules));
    expect(hands.map((h) => [h.handSize, h.keep])).toEqual([
      [5, 0],
      [5, 1],
      [6, 1],
      [6, 2],
      [7, 2],
    ]);
    expect(cardSmithStats({ anvil: 20, whetstone: 10, furnace: 9 }, [], rules)).toMatchObject({
      craftsmanship: 219,
      control: 148,
      handSize: 7,
    });
  });
});

describe('손패 장수 덮어쓰기', () => {
  it('overrides the 화로 hand but keeps its 간직', () => {
    for (const handSize of [5, 6, 7]) {
      const s = startCardCraft(makeCardSetup({ tools: { anvil: 0, whetstone: 0, furnace: 1 }, rules: { handSize } }));
      expect(s.hand).toHaveLength(handSize);
      expect(s.smith.keep).toBe(1);
    }
  });
});

describe('다시 달구기 비용', () => {
  it('takes 0~3 durability per turn end, clamped to that range', () => {
    for (const reheatCost of [0, 1, 2, 3]) {
      const s = endTurn(startCardCraft(makeCardSetup({ rules: { reheatCost } })));
      expect(s.durability).toBe(28 - reheatCost);
    }
    expect(resolveCardRules({ reheatCost: 7 }).reheatCost).toBe(3);
    expect(resolveCardRules({ reheatCost: -2 }).reheatCost).toBe(0);
    expect(reheatInfo(startCardCraft(makeCardSetup({ rules: { reheatCost: 3 } }))).durability).toBe(-3);
  });
});

describe('식는 쇠', () => {
  function start(coolingIron: boolean): CardCraftState {
    const s = startCardCraft(makeCardSetup({ rules: { firePreset: 'allNormal', coolingIron } }));
    return layOut(s, ['hammer', 'hammer', 'polish', 'bellows', 'quench']);
  }

  it('the n-th card of a turn costs n − 1 more, fresh each turn', () => {
    let s = start(true);
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(3);
    s = playCard(s, inHand(s, 'quench'));
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(4);
    s = playCard(s, inHand(s, 'hammer'));
    expect(s.durability).toBe(28 - 4);
    expect(cardCost(s, inHand(s, 'bellows'))).toBe(4);
    s = endTurn(layOut(s, [...s.hand.map((u) => s.cards[u] as 'hammer')], ['hammer']));
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(3);
  });

  it('is off by default', () => {
    let s = start(false);
    s = playCard(s, inHand(s, 'quench'));
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(3);
  });
});

describe('레시피 내구도 ±n', () => {
  it('moves the 최대 내구도 of any grade, never below 1, clamped to its range', () => {
    expect(startCardCraft(makeCardSetup({ rules: { durabilityDelta: 10 } })).maxDurability).toBe(38);
    const legend = { weaponType: 'oneHandSword', materialTier: 8, bossMaterial: 'earthBlessing' } as const;
    const s = startCardCraft(makeCardSetup({ recipe: legend, rules: { durabilityDelta: -20 } }));
    expect([s.maxDurability, s.durability]).toEqual([50, 50]);
    expect(startCardCraft(makeCardSetup({ rules: { durabilityDelta: -40 } })).maxDurability).toBe(1);
    expect(resolveCardRules({ durabilityDelta: 99 }).durabilityDelta).toBe(40);
    expect(resolveCardRules({ durabilityDelta: Number.NaN }).durabilityDelta).toBe(0);
  });

  it('adds to 두꺼운 모루판', () => {
    const deck = [...makeCardSetup().deck, 'thickAnvil' as const];
    expect(startCardCraft(makeCardSetup({ deck, rules: { durabilityDelta: -4 } })).maxDurability).toBe(28 + 5 - 4);
  });
});

describe('화로 상태 프리셋', () => {
  const key = { seed: 9, stream: 'craft', craftNo: 2 };
  const share = (grade: 'basic' | 'legendary', preset: 'default' | 'calm' | 'volatile' | 'allNormal'): number => {
    let notNormal = 0;
    const n = 10_000;
    for (let t = 2; t < n + 2; t++) if (rollTurnFire(key, grade, preset, t, 'normal') !== 'normal') notNormal += 1;
    return notNormal / n;
  };

  it('잔잔함 halves and 요동 raises every non-보통 weight; 모두 보통 has none', () => {
    const base = FIRE_WEIGHTS.legendary;
    const calm = fireWeights('legendary', 'calm');
    const volatile = fireWeights('legendary', 'volatile');
    expect(calm[1]).toBeCloseTo((base.good ?? 0) * 0.5, 9);
    expect(volatile[1]).toBeCloseTo((base.good ?? 0) * 1.5, 9);
    expect(fireWeights('legendary', 'allNormal')).toEqual([100, 0, 0, 0, 0, 0, 0, 0]);
    expect(share('basic', 'allNormal')).toBe(0);
    expect(share('basic', 'calm')).toBeLessThan(share('basic', 'default'));
    expect(share('basic', 'volatile')).toBeGreaterThan(share('basic', 'default'));
    expect(share('legendary', 'volatile')).toBeGreaterThan(0.75);
  });
});
