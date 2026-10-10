import { describe, expect, it } from 'vitest';
import { QUALITY, qualityTierFor } from '../data/common.ts';
import { CONDITION_WEIGHTS, type Condition, type CraftActionId, CRAFT_ACTIONS } from '../data/craft.ts';
import { rollCondition } from './conditions.ts';
import {
  abandonCraft,
  actionCost,
  checkAction,
  type CraftState,
  craftOutcome,
  previewNextCondition,
  previewReroll,
  startCraft,
  applyAction,
  wouldBreak,
} from './engine.ts';
import { EXAMPLE_FLOW, findAllNormalCraft, makeSetup, runActions, runFromSetup } from './testkit.ts';

/** A state with a chosen condition, for rule checks that must not depend on the roll. */
function withCondition(state: CraftState, condition: Condition): CraftState {
  return { ...structuredClone(state), condition };
}

const NORMAL_CRAFT = findAllNormalCraft(1, 25);

describe('determinism', () => {
  it('replays the same condition sequence for the same seed and craft number', () => {
    const script: CraftActionId[] = ['basicSynthesis', 'basicSynthesis', 'basicSynthesis'];
    const a = runFromSetup(makeSetup({ worldSeed: 42, craftNo: 7 }), script);
    const b = runFromSetup(makeSetup({ worldSeed: 42, craftNo: 7 }), script);
    expect(a.log.map((e) => e.condition)).toEqual(b.log.map((e) => e.condition));
    expect(a).toEqual(b);
  });

  it('does not depend on which actions were used', () => {
    const a = runFromSetup(makeSetup({ worldSeed: 9, craftNo: 3 }), ['basicTouch', 'basicTouch', 'basicTouch']);
    const b = runFromSetup(makeSetup({ worldSeed: 9, craftNo: 3 }), ['basicSynthesis', 'innovation', 'mastersMend']);
    expect(a.log.map((e) => e.condition)).toEqual(b.log.map((e) => e.condition));
    expect(a.condition).toBe(b.condition);
  });

  it('gives different crafts different sequences', () => {
    const seq = (craftNo: number) =>
      Array.from({ length: 30 }, (_, i) => rollCondition(5, craftNo, i, 'legendary', null)).join(',');
    expect(seq(1)).not.toBe(seq(2));
  });

  it('starts every craft on 보통 and draws the next condition from the craft stream', () => {
    const s0 = startCraft(makeSetup({ worldSeed: 11, craftNo: 4 }));
    expect(s0.condition).toBe('normal');
    const s1 = applyAction(s0, 'basicSynthesis');
    expect(s1.condition).toBe(rollCondition(11, 4, 0, 'basic', 'normal'));
    expect(s1.rngCursor).toBe(1);
  });

  it('불 다시 보기 takes the next value of the same stream without using a turn', () => {
    const s0 = startCraft(makeSetup({ worldSeed: 3, craftNo: 2, nodes: ['carefulObservation'] }));
    const s1 = applyAction(s0, 'carefulObservation');
    expect(s1.turn).toBe(0);
    expect(s1.rngCursor).toBe(1);
    expect(s1.condition).toBe(rollCondition(3, 2, 0, 'basic', null));
    const s2 = applyAction(s1, 'basicSynthesis');
    expect(s2.condition).toBe(rollCondition(3, 2, 1, 'basic', s1.condition));
  });

  it('rolls conditions roughly at the tuned weights', () => {
    const counts: Partial<Record<Condition, number>> = {};
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const c = rollCondition(1, i + 1, 0, 'legendary', null);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    const weights = CONDITION_WEIGHTS.legendary;
    const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    for (const [c, w] of Object.entries(weights)) {
      expect(Math.abs((counts[c as Condition] ?? 0) / n - (w ?? 0) / total)).toBeLessThan(0.015);
    }
    expect(counts.poor ?? 0).toBe(0);
  });
});

describe('기획서 4.2.1 example flow', () => {
  const setup = makeSetup({ craftNo: NORMAL_CRAFT });

  it('uses 95 CP and finishes exactly at durability 0 in 11 turns', () => {
    const start = startCraft(setup);
    expect(start.cp).toBe(100);
    expect(start.durability).toBe(60);
    expect(start.recipe.progressRequired).toBeGreaterThan(3 * start.stats.craftsmanship);
    expect(start.recipe.progressRequired).toBeLessThanOrEqual(4 * start.stats.craftsmanship);

    const end = runActions(start, EXAMPLE_FLOW);
    expect(end.log.every((e) => e.condition === 'normal')).toBe(true);
    expect(end.turn).toBe(11);
    expect(start.cp - end.cp).toBe(95);
    expect(end.durability).toBe(0);
    expect(end.progress).toBe(4 * start.stats.craftsmanship);
    expect(end.status).toBe('success');
  });

  it('lands on ★3 역작 (55~75%) when every turn is 보통', () => {
    const end = runFromSetup(setup, EXAMPLE_FLOW);
    const outcome = craftOutcome(end);
    expect(outcome.qualityRatio).toBeGreaterThanOrEqual(0.55);
    expect(outcome.qualityRatio).toBeLessThanOrEqual(0.75);
    expect(outcome.tier).toBe(3);
  });

  it('is not finished one turn early (durability 10, progress 3/4)', () => {
    const almost = runFromSetup(setup, EXAMPLE_FLOW.slice(0, 10));
    expect(almost.status).toBe('active');
    expect(almost.durability).toBe(10);
    expect(almost.progress).toBe(300);
  });
});

describe('failure', () => {
  it('fails when durability hits 0 before the progress is full', () => {
    const s = startCraft(makeSetup({ craftNo: NORMAL_CRAFT }));
    const end = runActions(s, ['basicTouch', 'basicTouch', 'basicTouch', 'basicTouch', 'basicTouch', 'basicSynthesis']);
    expect(end.durability).toBe(0);
    expect(end.status).toBe('failed');
    expect(craftOutcome(end).success).toBe(false);
    expect(craftOutcome(end).tier).toBeNull();
    expect(checkAction(end, 'basicSynthesis')).not.toBeNull();
    expect(() => applyAction(end, 'basicSynthesis')).toThrow();
  });

  it('stopping halfway is a failure', () => {
    const s = runFromSetup(makeSetup(), ['basicTouch']);
    const quit = abandonCraft(s);
    expect(quit.status).toBe('failed');
    expect(quit.abandoned).toBe(true);
    expect(craftOutcome(quit).success).toBe(false);
  });

  it('단조 유지 does not save a craft that already hit 0', () => {
    const s = startCraft(makeSetup({ nodes: ['manipulation'] }));
    const low = { ...applyAction(withCondition(s, 'normal'), 'manipulation'), durability: 10 };
    const end = applyAction(withCondition(low, 'normal'), 'basicTouch');
    expect(end.status).toBe('failed');
  });
});

describe('condition-only and limited actions', () => {
  const nodes = ['tricksOfTheTrade', 'heartAndSoul', 'reflect', 'muscleMemory', 'carefulObservation'] as const;
  const base = startCraft(makeSetup({ nodes: [...nodes] }));

  it('정밀 다듬기 and 불씨 살리기 need 좋음 or 최상', () => {
    const normal = withCondition(base, 'normal');
    expect(checkAction(normal, 'preciseTouch')).toBe('좋음·최상일 때만');
    expect(checkAction(normal, 'tricksOfTheTrade')).toBe('좋음·최상일 때만');
    for (const c of ['good', 'excellent'] as const) {
      expect(checkAction(withCondition(base, c), 'preciseTouch')).toBeNull();
      expect(checkAction(withCondition(base, c), 'tricksOfTheTrade')).toBeNull();
    }
    for (const c of ['poor', 'sturdy', 'pliant', 'malleable', 'goodOmen'] as const) {
      expect(checkAction(withCondition(base, c), 'preciseTouch')).not.toBeNull();
    }
  });

  it('대장장이의 감 allows one good-only action, once per craft', () => {
    let s = withCondition(base, 'normal');
    s = applyAction(s, 'heartAndSoul');
    expect(s.turn).toBe(0);
    expect(s.heartAndSoul).toBe(true);
    expect(checkAction(s, 'heartAndSoul')).not.toBeNull();
    s = applyAction(withCondition(s, 'normal'), 'preciseTouch');
    expect(s.heartAndSoul).toBe(false);
    expect(s.innerQuiet).toBe(2);
    expect(checkAction(withCondition(s, 'normal'), 'preciseTouch')).toBe('좋음·최상일 때만');
    expect(checkAction(s, 'heartAndSoul')).toBe('이번엔 다 썼다');
  });

  it('대장장이의 감 is kept when the condition is already 좋음', () => {
    let s = applyAction(withCondition(base, 'normal'), 'heartAndSoul');
    s = applyAction(withCondition(s, 'good'), 'preciseTouch');
    expect(s.heartAndSoul).toBe(true);
  });

  it('first-turn actions only on the first turn', () => {
    expect(checkAction(base, 'reflect')).toBeNull();
    expect(checkAction(base, 'muscleMemory')).toBeNull();
    const after = applyAction(base, 'basicSynthesis');
    expect(checkAction(after, 'reflect')).toBe('첫 턴에만');
    expect(checkAction(after, 'muscleMemory')).toBe('첫 턴에만');
  });

  it('free actions keep the first turn open', () => {
    const s = applyAction(applyAction(base, 'carefulObservation'), 'heartAndSoul');
    expect(checkAction(s, 'reflect')).toBeNull();
  });

  it('불 다시 보기 three times per craft', () => {
    let s = base;
    for (let i = 0; i < 3; i++) s = applyAction(s, 'carefulObservation');
    expect(s.rngCursor).toBe(3);
    expect(checkAction(s, 'carefulObservation')).toBe('이번엔 다 썼다');
  });

  it('actions not on the skill board are refused', () => {
    expect(checkAction(base, 'manipulation')).toBe('아직 모르는 기술');
  });

  it('needs enough CP', () => {
    const poor = { ...base, cp: 9 };
    expect(checkAction(poor, 'basicTouch')).toBe('제작력이 모자라다');
    expect(checkAction(poor, 'basicSynthesis')).toBeNull();
  });

  it('불씨 살리기 restores 20 CP up to the maximum', () => {
    const s = applyAction(withCondition({ ...base, cp: 50 }, 'good'), 'tricksOfTheTrade');
    expect(s.cp).toBe(70);
    const full = applyAction(withCondition(base, 'good'), 'tricksOfTheTrade');
    expect(full.cp).toBe(full.stats.maxCp);
  });
});

describe('열기 (Inner Quiet) and 마무리', () => {
  const base = startCraft(makeSetup({ craftNo: NORMAL_CRAFT, nodes: ['reflect'] }));

  it('stacks per quality action, 2 for 정밀 다듬기 and 첫 손질, max 10', () => {
    let s = applyAction(base, 'reflect');
    expect(s.innerQuiet).toBe(2);
    s = applyAction(withCondition(s, 'normal'), 'basicTouch');
    expect(s.innerQuiet).toBe(3);
    s = applyAction(withCondition(s, 'good'), 'preciseTouch');
    expect(s.innerQuiet).toBe(5);
    s = { ...withCondition(s, 'normal'), innerQuiet: 10, durability: 60, cp: 100 };
    s = applyAction(s, 'basicTouch');
    expect(s.innerQuiet).toBe(10);
  });

  it('adds 10% quality per stack', () => {
    const s = { ...withCondition(base, 'normal'), innerQuiet: 5 };
    const after = applyAction(s, 'basicTouch');
    expect(after.quality).toBe(150); // 100 × (1 + 5 × 0.1)
  });

  it('마무리 spends every stack: 100% × (1 + stacks × 0.2), plus the stack bonus', () => {
    const s = { ...withCondition(base, 'normal'), innerQuiet: 4 };
    const after = applyAction(s, 'byregotsBlessing');
    expect(after.innerQuiet).toBe(0);
    expect(after.quality).toBe(252); // 100 × 1.8 × 1.4
  });

  it('마무리 needs at least one stack', () => {
    expect(checkAction(withCondition(base, 'normal'), 'byregotsBlessing')).toBe('열기가 없다');
  });

  it('quality stops at the cap', () => {
    const s = { ...withCondition(base, 'excellent'), innerQuiet: 10, quality: base.recipe.qualityCap - 5 };
    const after = applyAction(s, 'byregotsBlessing');
    expect(after.quality).toBe(base.recipe.qualityCap);
  });
});

describe('buffs', () => {
  const all = startCraft(
    makeSetup({
      craftNo: NORMAL_CRAFT,
      nodes: ['wasteNot', 'veneration', 'manipulation', 'greatStrides', 'muscleMemory', 'finalAppraisal'],
    }),
  );
  const normal = (s: CraftState) => withCondition(s, 'normal');

  it('풀무질 boosts the next 3 turns by 50%', () => {
    let s = applyAction(normal(all), 'innovation');
    expect(s.buffs.innovation).toBe(3);
    const q: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = s.quality;
      s = applyAction(normal({ ...s, innerQuiet: 0 }), 'basicTouch');
      q.push(s.quality - before);
    }
    expect(q).toEqual([150, 150, 150, 100]);
    expect(s.buffs.innovation).toBe(0);
  });

  it('혼신 doubles only the next quality action, stacking with 풀무질', () => {
    let s = applyAction(normal(all), 'innovation');
    s = applyAction(normal(s), 'greatStrides');
    expect(s.buffs.greatStrides).toBe(3);
    s = applyAction(normal(s), 'basicTouch');
    expect(s.quality).toBe(250); // 100 × (1 + 0.5 + 1.0)
    expect(s.buffs.greatStrides).toBe(0);
    const before = s.quality;
    s = applyAction(normal(s), 'basicTouch');
    expect(s.quality - before).toBe(165); // 100 × 1.1 (열기 1) × 1.5
  });

  it('첫 망치 adds +100% to the next progress action', () => {
    let s = applyAction(all, 'muscleMemory');
    expect(s.progress).toBe(300);
    s = applyAction(normal(s), 'innovation');
    s = applyAction(normal(s), 'basicSynthesis');
    expect(s.progress).toBe(500);
    expect(s.buffs.muscleMemory).toBe(0);
  });

  it('달구기 boosts progress by 50% for 3 turns', () => {
    let s = applyAction(normal(all), 'veneration');
    s = applyAction(normal({ ...s, recipe: { ...s.recipe, progressRequired: 10000 } }), 'basicSynthesis');
    expect(s.progress).toBe(150);
  });

  it('아껴 치기 halves durability costs for 4 turns', () => {
    let s = applyAction(normal(all), 'wasteNot');
    const costs: number[] = [];
    for (let i = 0; i < 5; i++) {
      costs.push(actionCost(normal(s), 'basicTouch').durability);
      s = applyAction(normal({ ...s, cp: 100 }), 'basicTouch');
    }
    expect(costs).toEqual([5, 5, 5, 5, 10]);
  });

  it('단조 유지 restores 5 durability after each of the next 8 turns', () => {
    let s = applyAction(normal(all), 'manipulation');
    expect(s.durability).toBe(60);
    s = applyAction(normal(s), 'basicTouch');
    expect(s.durability).toBe(55);
    s = applyAction(normal(s), 'innovation');
    expect(s.durability).toBe(60);
  });

  it('최후의 한 수 stops progress one short, once', () => {
    let s = applyAction(normal(all), 'finalAppraisal');
    expect(s.turn).toBe(0);
    s = applyAction(normal({ ...s, progress: s.recipe.progressRequired - 50 }), 'basicSynthesis');
    expect(s.progress).toBe(s.recipe.progressRequired - 1);
    expect(s.status).toBe('active');
    expect(s.buffs.finalAppraisal).toBe(0);
    s = applyAction(normal(s), 'basicSynthesis');
    expect(s.status).toBe('success');
  });
});

describe('conditions', () => {
  const base = startCraft(makeSetup({ nodes: ['wasteNot'] }));

  it('좋음 ×1.5, 최상 ×3, 식음 ×0.5 quality', () => {
    const gain = (c: Condition) => applyAction(withCondition(base, c), 'basicTouch').quality;
    expect(gain('good')).toBe(150);
    expect(gain('excellent')).toBe(300);
    expect(gain('poor')).toBe(50);
  });

  it('단단함 halves durability cost, also with 아껴 치기 (rounded up)', () => {
    expect(actionCost(withCondition(base, 'sturdy'), 'basicTouch').durability).toBe(5);
    const wn = applyAction(withCondition(base, 'normal'), 'wasteNot');
    expect(actionCost(withCondition(wn, 'sturdy'), 'basicTouch').durability).toBe(3);
  });

  it('부드러움 halves CP cost (rounded up)', () => {
    expect(actionCost(withCondition(base, 'pliant'), 'innovation').cp).toBe(8);
    expect(actionCost(withCondition(base, 'pliant'), 'mastersMend').cp).toBe(13);
  });

  it('잘 펴짐 ×1.5 progress', () => {
    expect(applyAction(withCondition(base, 'malleable'), 'basicSynthesis').progress).toBe(150);
  });

  it('최상 is followed by 식음 from 고급 up, and 불티 by 좋음', () => {
    const legendary = { ...makeSetup(), recipe: { weaponType: 'bow' as const, materialTier: 6, bossMaterial: 'dash' as const } };
    for (let craftNo = 1; craftNo <= 20; craftNo++) {
      const s = { ...startCraft(makeSetup({ craftNo, materialTier: 6 })), condition: 'excellent' as const };
      expect(applyAction(s, 'basicSynthesis').condition).toBe('poor');
      const l = { ...startCraft({ ...legendary, craftNo }), condition: 'goodOmen' as const };
      expect(applyAction(l, 'basicSynthesis').condition).toBe('good');
    }
  });

  it('기본 recipes never show 식음, even right after 최상 (4.2.3)', () => {
    for (let craftNo = 1; craftNo <= 200; craftNo++) {
      expect(rollCondition(1, craftNo, 0, 'basic', 'excellent')).not.toBe('poor');
    }
  });

  it('불꽃 읽기 preview matches what the next turn gets', () => {
    for (let craftNo = 1; craftNo <= 30; craftNo++) {
      const s = runFromSetup(makeSetup({ craftNo, materialTier: 6, nodes: ['flameReading'] }), ['basicSynthesis']);
      expect(s.stats.foresight).toBe(true);
      expect(applyAction(s, 'basicTouch').condition).toBe(previewNextCondition(s));
    }
  });

  it('불 다시 보기 takes the previewed draw; only a forced follow-up makes them differ', () => {
    for (let craftNo = 1; craftNo <= 30; craftNo++) {
      const s = startCraft(makeSetup({ craftNo, materialTier: 6, nodes: ['flameReading', 'carefulObservation'] }));
      expect(applyAction(s, 'carefulObservation').condition).toBe(previewReroll(s));
      expect(previewReroll(s)).toBe(previewNextCondition(s));
      const afterExcellent = withCondition(s, 'excellent');
      expect(previewNextCondition(afterExcellent)).toBe('poor');
      expect(applyAction(afterExcellent, 'carefulObservation').condition).toBe(previewReroll(afterExcellent));
    }
  });

  it('불 다시 보기 on the first turn may fish for 좋음 before 첫 손질 (FF14 rule, kept)', () => {
    const s0 = startCraft(makeSetup({ worldSeed: 5, craftNo: 1, nodes: ['reflect', 'carefulObservation'] }));
    let s = s0;
    while (!['good', 'excellent'].includes(s.condition) && checkAction(s, 'carefulObservation') === null) {
      s = applyAction(s, 'carefulObservation');
    }
    expect(s.turn).toBe(0);
    expect(checkAction(s, 'reflect')).toBeNull();
  });
});

describe('breaking the work (wouldBreak)', () => {
  const s = startCraft(makeSetup({ craftNo: NORMAL_CRAFT, nodes: ['manipulation', 'wasteNot'] }));
  const at = (durability: number, extra: Partial<CraftState> = {}) => ({ ...withCondition(s, 'normal'), durability, ...extra });

  it('flags an action that drops durability to 0 before the progress is full', () => {
    expect(wouldBreak(at(10), 'basicTouch')).toBe(true);
    expect(applyAction(at(10), 'basicTouch').status).toBe('failed');
    expect(wouldBreak(at(20), 'basicTouch')).toBe(false);
    expect(wouldBreak(at(10), 'innovation')).toBe(false);
    expect(wouldBreak(at(10), 'mastersMend')).toBe(false);
  });

  it('does not flag the hammer that finishes the work at durability 0', () => {
    const last = at(10, { progress: s.recipe.progressRequired - 100 });
    expect(wouldBreak(last, 'basicSynthesis')).toBe(false);
    expect(applyAction(last, 'basicSynthesis').status).toBe('success');
  });

  it('follows the cost the action really has now', () => {
    expect(wouldBreak({ ...at(5), condition: 'sturdy' }, 'basicTouch')).toBe(true);
    expect(wouldBreak({ ...at(10), condition: 'sturdy' }, 'basicTouch')).toBe(false);
    const wasteNot = applyAction(at(20), 'wasteNot');
    expect(wouldBreak({ ...withCondition(wasteNot, 'normal'), durability: 10 }, 'basicTouch')).toBe(false);
  });

  it('단조 유지 does not save it, and unusable actions are not flagged', () => {
    const manip = applyAction(at(30), 'manipulation');
    expect(wouldBreak({ ...withCondition(manip, 'normal'), durability: 10 }, 'basicTouch')).toBe(true);
    expect(wouldBreak(at(10), 'preciseTouch')).toBe(false);
    expect(wouldBreak(abandonCraft(at(10)), 'basicTouch')).toBe(false);
  });
});

describe('quality tiers', () => {
  it('maps ratio boundaries to tiers', () => {
    expect(qualityTierFor(0)).toBe(1);
    expect(qualityTierFor(0.2999)).toBe(1);
    expect(qualityTierFor(0.3)).toBe(2);
    expect(qualityTierFor(0.5499)).toBe(2);
    expect(qualityTierFor(0.55)).toBe(3);
    expect(qualityTierFor(0.7999)).toBe(3);
    expect(qualityTierFor(0.8)).toBe(4);
    expect(qualityTierFor(0.9999)).toBe(4);
    expect(qualityTierFor(1)).toBe(5);
  });

  it('a finished craft takes its tier from quality / cap; 걸작 needs a full gauge', () => {
    const done = runFromSetup(makeSetup({ craftNo: NORMAL_CRAFT }), ['basicSynthesis', 'basicSynthesis', 'basicSynthesis']);
    const cap = done.recipe.qualityCap;
    const finish = (quality: number) => craftOutcome(applyAction({ ...done, quality }, 'basicSynthesis'));
    expect(finish(Math.ceil(cap * 0.3)).tier).toBe(2);
    expect(finish(Math.ceil(cap * 0.55)).tier).toBe(3);
    expect(finish(Math.ceil(cap * 0.8)).tier).toBe(4);
    expect(finish(cap - 1).tier).toBe(4);
    expect(finish(cap).tier).toBe(5);
    expect(QUALITY[5].slots).toBe(4);
  });
});

describe('대보스 material', () => {
  const setup = { ...makeSetup({ materialTier: 5 }), recipe: { weaponType: 'bow' as const, materialTier: 5, bossMaterial: 'dash' as const } };

  it('is used by a 걸작, returned short of it, lost on failure', () => {
    const s = startCraft(setup);
    expect(s.recipe.grade).toBe('legendary');
    const nearlyDone = { ...s, progress: s.recipe.progressRequired - 1 };
    const full = applyAction({ ...nearlyDone, quality: s.recipe.qualityCap }, 'basicSynthesis');
    expect(craftOutcome(full).boss).toEqual({ unique: 'dash', fate: 'used' });
    const half = applyAction({ ...nearlyDone, quality: Math.floor(s.recipe.qualityCap / 2) }, 'basicSynthesis');
    expect(craftOutcome(half).boss).toEqual({ unique: 'dash', fate: 'returned' });
    expect(craftOutcome(abandonCraft(s)).boss).toEqual({ unique: 'dash', fate: 'lost' });
  });
});

describe('save and resume', () => {
  it('a craft serialised mid-way finishes exactly like one that never stopped', () => {
    const nodes = ['carefulObservation', 'reflect', 'wasteNot', 'greatStrides'] as const;
    for (let craftNo = 1; craftNo <= 25; craftNo++) {
      const setup = makeSetup({ worldSeed: 77, craftNo, materialTier: 6, nodes: [...nodes], tools: { anvil: 5, whetstone: 5, furnace: 5 } });
      const script: CraftActionId[] = [
        'reflect',
        'carefulObservation',
        'basicTouch',
        'wasteNot',
        'carefulObservation',
        'basicTouch',
        'basicSynthesis',
        'greatStrides',
        'byregotsBlessing',
        'basicSynthesis',
        'basicSynthesis',
        'basicSynthesis',
        'basicSynthesis',
        'basicSynthesis',
      ];
      const usable = (s: CraftState, a: CraftActionId) => checkAction(s, a) === null;
      let straight = startCraft(setup);
      let resumed = startCraft(setup);
      for (const [i, a] of script.entries()) {
        if (!usable(straight, a)) continue;
        straight = applyAction(straight, a);
        if (i % 3 === 1) resumed = JSON.parse(JSON.stringify(resumed)) as CraftState;
        resumed = applyAction(resumed, a);
      }
      expect(resumed).toEqual(straight);
      expect(JSON.parse(JSON.stringify(straight))).toEqual(straight);
    }
  });
});

describe('action table', () => {
  it('has 6 basic and 12 skill-board actions', () => {
    const specs = Object.values(CRAFT_ACTIONS);
    expect(specs.filter((a) => a.basic)).toHaveLength(6);
    expect(specs.filter((a) => !a.basic)).toHaveLength(12);
  });
});
