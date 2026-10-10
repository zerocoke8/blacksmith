import { describe, expect, it } from 'vitest';
import { rngFor } from '../core/rng.ts';
import { GRADES } from '../core/types.ts';
import { fameStageFor, fameThreshold, gradeShares, newHeroesPerDay } from './fame.ts';
import {
  chooseTower,
  heroPower,
  inheritanceCount,
  levelFor,
  rollDisciple,
  rollRookie,
  startFloorOf,
} from './hero.ts';
import type { CareerRecord } from './types.ts';

const master = (over: Partial<CareerRecord> = {}): CareerRecord => ({
  id: 'h1',
  seq: 1,
  grade: 'B',
  growth: 0.9,
  charisma: 'mid',
  luck: 'mid',
  weaponType: 'bow',
  tower: 'wind',
  generation: 1,
  masterId: null,
  inherited: [],
  arrivedAt: 0,
  endedAt: 9000,
  end: 'retired',
  record: 45,
  finalLevel: 30,
  finalPower: 2.2,
  injuries: 2,
  diedOnFloor: null,
  weapon: { id: 'w1', type: 'bow', materialTier: 4, quality: 3, element: null, enchants: [], unique: null },
  weaponMine: true,
  stats: {
    expeditions: 20,
    floorsCleared: 180,
    failures: 15,
    dullCount: 0,
    visits: 12,
    repairs: 8,
    weaponsBought: 2,
    goldEarned: 1000,
  },
  ...over,
});

describe('level and strength (7.4)', () => {
  it('reaches level 30 at about 200 cumulative floors', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(100)).toBe(15);
    expect(levelFor(199)).toBe(29);
    expect(levelFor(200)).toBe(30);
    expect(levelFor(5000)).toBe(30);
  });

  it('follows 힘 = 1.0 + (상한 − 1.0) × 성장률 × (레벨 − 1) ÷ 29', () => {
    expect(heroPower('S', 1, 30)).toBeCloseTo(9);
    expect(heroPower('N', 0.5, 30)).toBeCloseTo(1.1);
    expect(heroPower('A', 0.3, 1)).toBeCloseTo(1);
    expect(heroPower('B', 0.6, 15)).toBeCloseTo(1 + 1.4 * 0.6 * (14 / 29));
    // Inherited start strength, capped by the grade cap.
    expect(heroPower('B', 0.5, 1, 1.3)).toBeCloseTo(1.3);
    expect(heroPower('N', 0.5, 30, 5)).toBeCloseTo(1.2);
  });

  it('starts expeditions one floor above the last boss', () => {
    expect(startFloorOf(0)).toBe(1);
    expect(startFloorOf(30)).toBe(31);
  });
});

describe('rookies (6.2, 6.3)', () => {
  it('rolls the same hero from the same stream', () => {
    const a = rollRookie(rngFor(1, 'spawn', 4), gradeShares(1));
    const b = rollRookie(rngFor(1, 'spawn', 4), gradeShares(1));
    expect(a).toEqual(b);
    expect(a.growth).toBeGreaterThanOrEqual(0.3);
    expect(a.growth).toBeLessThanOrEqual(1);
    expect(a.gold).toBeGreaterThanOrEqual(150);
    expect(a.gold).toBeLessThanOrEqual(300);
  });

  it('picks the home tower half the time and one of the other three otherwise (6.3)', () => {
    const n = 20000;
    const counts = { water: 0, fire: 0, earth: 0, wind: 0 };
    for (let i = 0; i < n; i++) counts[chooseTower(rngFor(9, 'tower-pick', i), 'bow')]++;
    expect(counts.wind / n).toBeCloseTo(0.5, 1); // bow → 풍의 탑
    for (const t of ['water', 'fire', 'earth'] as const) expect(counts[t] / n).toBeCloseTo(1 / 6, 1);
  });

  it('roughly follows the grade shares', () => {
    const counts = { N: 0, C: 0, B: 0, A: 0, S: 0 };
    for (let i = 0; i < 20000; i++) counts[rollRookie(rngFor(9, 'spawn', i), gradeShares(1)).grade]++;
    expect(counts.N / 20000).toBeCloseTo(0.4, 1);
    expect(counts.S / 20000).toBeCloseTo(0.02, 1);
  });
});

describe('fame stages (6.2, 9.2)', () => {
  it('moves grade shares from N to B/A/S up to stage 7', () => {
    const s7 = gradeShares(7);
    expect(s7.N).toBeCloseTo(0.28);
    expect(s7.C).toBeCloseTo(0.3);
    expect(s7.B).toBeCloseTo(0.26);
    expect(s7.A).toBeCloseTo(0.116);
    expect(s7.S).toBeCloseTo(0.044);
    expect(gradeShares(9)).toEqual(s7);
    for (const st of [1, 4, 7]) expect(GRADES.reduce((s, g) => s + gradeShares(st)[g], 0)).toBeCloseTo(1);
  });

  it('maps fame to stages, with ★n doubling past stage 7', () => {
    expect(fameStageFor(0)).toBe(1);
    expect(fameStageFor(299)).toBe(1);
    expect(fameStageFor(300)).toBe(2);
    expect(fameStageFor(999_999)).toBe(6);
    expect(fameStageFor(1_000_000)).toBe(7);
    expect(fameThreshold(8)).toBe(2_000_000);
    expect(fameStageFor(4_000_000)).toBe(9);
    expect(newHeroesPerDay(1)).toBe(8);
    expect(newHeroesPerDay(7)).toBe(35);
    expect(newHeroesPerDay(9)).toBe(41);
  });
});

describe('inheritance (6.5)', () => {
  it('counts 1 + ⌊record ÷ 20⌋ + ⌊hearts ÷ 2⌋, at most 5', () => {
    expect(inheritanceCount(35, 3)).toBe(3);
    expect(inheritanceCount(0, 0)).toBe(1);
    expect(inheritanceCount(200, 10)).toBe(5);
  });

  it('draws distinct, useful picks and applies them', () => {
    for (let n = 0; n < 200; n++) {
      const m = master();
      const roll = rollDisciple(rngFor(3, 'disciple', n), m, 2);
      expect(roll.inherit.picks).toHaveLength(inheritanceCount(m.record, 2));
      expect(new Set(roll.inherit.picks).size).toBe(roll.inherit.picks.length);
      if (roll.inherit.picks.includes('strength')) expect(roll.inherit.startPower).toBeCloseTo(1 + 2.2 * 0.15);
      if (roll.inherit.picks.includes('mastery')) expect(roll.inherit.masteryFloorBonus).toBeCloseTo(45 * 0.25);
      if (roll.inherit.picks.includes('talent')) expect(roll.grade).toBe('A');
      else expect(roll.grade).toBe('B');
    }
  });

  it('never passes on a below-average growth or talent past S', () => {
    for (let n = 0; n < 200; n++) {
      const roll = rollDisciple(rngFor(4, 'disciple', n), master({ grade: 'S', growth: 0.4 }), 2);
      expect(roll.inherit.picks).not.toContain('growth');
      expect(roll.inherit.picks).not.toContain('talent');
    }
  });
});
