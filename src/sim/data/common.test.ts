import { describe, expect, it } from 'vitest';
import {
  ELEMENT_MULT,
  elementMultiplier,
  ENEMY_BASE_POWER,
  ENEMY_GROWTH_PER_FLOOR,
  enemyBasePower,
  MATERIAL_ATTACK_STEP,
  MATERIAL_PRICE_BASE,
  MATERIAL_PRICE_STEP,
  materialAttack,
  materialPrice,
  POW_INT_MAX_EXPONENT,
  powInt,
} from './common.ts';

/** Relative difference, for comparing against the engine's own `**`. */
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const REL_TOLERANCE = 1e-12;

describe('powInt (3.6: same bits on every engine)', () => {
  it('builds each entry by one multiplication from the previous one', () => {
    expect(powInt(1.04, 0)).toBe(1);
    for (let n = 1; n <= 500; n++) expect(powInt(1.04, n)).toBe(powInt(1.04, n - 1) * 1.04);
  });

  it('matches ** within 1e-12 relative', () => {
    for (const base of [1.04, 1.15, 1.2, 1.25, 2.5, 0.75]) {
      for (let n = -50; n <= 1000; n++) {
        if (!Number.isFinite(base ** n) || base ** n === 0) continue;
        expect(rel(powInt(base, n), base ** n), `${base}^${n}`).toBeLessThanOrEqual(REL_TOLERANCE);
      }
    }
  });

  it('gives the same answer whatever order the cache is filled in', () => {
    // A base no other test or module uses, so this test fills its table from empty.
    const base = 1.0123;
    const high = powInt(base, 300);
    const ascending: number[] = [];
    let v = 1;
    for (let n = 0; n <= 300; n++) {
      ascending.push(v);
      v *= base;
    }
    expect(high).toBe(ascending[300]);
    for (let n = 300; n >= 0; n--) expect(powInt(base, n)).toBe(ascending[n]);
  });

  it('takes integer exponents only, within range', () => {
    expect(() => powInt(1.04, 1.5)).toThrow(RangeError);
    expect(() => powInt(1.04, Number.NaN)).toThrow(RangeError);
    expect(() => powInt(1.04, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => powInt(1.04, POW_INT_MAX_EXPONENT + 1)).toThrow(RangeError);
    expect(() => powInt(1.04, -POW_INT_MAX_EXPONENT - 1)).toThrow(RangeError);
    expect(powInt(1.04, -2)).toBe(1 / (1.04 * 1.04));
    // Whole bases stay exact, like the fame ×2 steps (9.2 ★n).
    expect(powInt(2, 10)).toBe(1024);
  });
});

describe('element multipliers (7.5)', () => {
  it('uses the retuned advantage ×1.3', () => {
    expect(ELEMENT_MULT.advantage).toBe(1.3);
    // 수 > 화 > 지 > 풍 > 수, in the fire tower.
    expect(elementMultiplier('water', 'fire')).toBe(1.3);
    expect(elementMultiplier('wind', 'fire')).toBe(1.0);
    expect(elementMultiplier('earth', 'fire')).toBe(0.75);
    expect(elementMultiplier('fire', 'fire')).toBe(0.75);
    expect(elementMultiplier(null, 'fire')).toBe(1.0);
  });
});

describe('table-backed curves (4.4, 7.3, 10)', () => {
  it('enemyBasePower = 100 × 1.04^(floor − 1)', () => {
    expect(enemyBasePower(1)).toBe(ENEMY_BASE_POWER);
    for (let f = 1; f <= 1000; f++) {
      expect(enemyBasePower(f)).toBe(ENEMY_BASE_POWER * powInt(ENEMY_GROWTH_PER_FLOOR, f - 1));
      expect(rel(enemyBasePower(f), ENEMY_BASE_POWER * ENEMY_GROWTH_PER_FLOOR ** (f - 1))).toBeLessThanOrEqual(REL_TOLERANCE);
    }
  });

  it('materialAttack = 1.15^(tier − 1)', () => {
    expect(materialAttack(1)).toBe(1);
    expect(materialAttack(2)).toBe(MATERIAL_ATTACK_STEP);
    for (let t = 1; t <= 300; t++) {
      expect(rel(materialAttack(t), MATERIAL_ATTACK_STEP ** (t - 1))).toBeLessThanOrEqual(REL_TOLERANCE);
    }
  });

  it('materialPrice = round(10 × 2.5^(tier − 1)), the 10장 table', () => {
    expect([1, 2, 3, 4, 5].map(materialPrice)).toEqual([10, 25, 63, 156, 391]);
    for (let t = 1; t <= 60; t++) {
      const exact = MATERIAL_PRICE_BASE * MATERIAL_PRICE_STEP ** (t - 1);
      expect(rel(materialPrice(t), Math.round(exact))).toBeLessThanOrEqual(REL_TOLERANCE);
    }
  });
});
