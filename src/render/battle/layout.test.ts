import { describe, expect, it } from 'vitest';
import {
  bossBox,
  bossCenterX,
  bossFeetY,
  clampFighterSize,
  enemySpots,
  FIELD,
  FIGHTER_SIZE,
  FIGHTER_SIZE_RANGE,
  fighterHeight,
  heroSpots,
  unitHeight,
} from './layout.ts';

describe('where the fighters stand', () => {
  for (const [w, h] of [
    [390, 600],
    [360, 420],
  ] as const) {
    it(`keeps everyone on the ${w}×${h} field, heroes left of the monsters, the front row nearer the middle`, () => {
      for (const [front, back] of [
        [3, 2],
        [4, 1],
        [1, 4],
        [2, 3],
      ] as const) {
        const s = heroSpots(w, h, front, back);
        expect(s.front).toHaveLength(front);
        expect(s.back).toHaveLength(back);
        const fx = Math.min(...s.front.map((p) => p.x));
        const bx = Math.max(...s.back.map((p) => p.x));
        expect(fx).toBeGreaterThan(bx);
        for (const p of [...s.front, ...s.back]) {
          expect(p.x).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(w / 2);
          expect(p.y).toBeGreaterThan(h * FIELD.horizon);
          expect(p.y).toBeLessThanOrEqual(h);
        }
      }
      for (const n of [3, 4, 5]) {
        const e = enemySpots(w, h, n, false);
        expect(e).toHaveLength(n);
        for (const p of e) {
          expect(p.x).toBeGreaterThan(w / 2);
          expect(p.x).toBeLessThan(w);
        }
        // e0 (the one hit first) is in the front column.
        expect(e[0]!.x).toBeLessThan(e[n - 1]!.x);
      }
      expect(enemySpots(w, h, 1, true)).toHaveLength(1);
      expect(unitHeight(w, h)).toBeLessThanOrEqual(h * FIELD.unitH);
    });
  }
});

describe('a lone boss keeps to its side (the daily boss over the front row)', () => {
  for (const w of [360, 390, 412]) {
    it(`at ${w} px wide its box starts right of the front row's heroes`, () => {
      const h = w * 1.6;
      const uh = unitHeight(w, h);
      const s = heroSpots(w, h, 4, 1);
      // A hero picture is at most about 1.1 times as wide as tall (a big sword); the nearest lane is 1.05 big.
      const frontRight = Math.max(...s.front.map((p) => p.x + (uh * 1.05 * 1.12) / 2));
      expect(bossBox(w).left).toBeGreaterThanOrEqual(frontRight - 1);
      // A boss that fits its box stays in it; a wider one (the 크기 panel above 1) keeps its right
      // edge on the box's and reaches left; none leaves the field on the right.
      for (const bw of [80, bossBox(w).maxW, bossBox(w).maxW * 1.3]) {
        const x = bossCenterX(w, bw, w * FIELD.boss.x);
        if (bw <= bossBox(w).maxW) expect(x - bw / 2).toBeGreaterThanOrEqual(bossBox(w).left - 1e-9);
        else expect(x + bw / 2).toBeCloseTo(bossBox(w).right);
        expect(x + bw / 2).toBeLessThanOrEqual(w);
      }
    });
  }
});

describe('a lone boss stands in the middle of the fight', () => {
  it("its body is level with the middle-lane hero's, and its feet stay on the field", () => {
    const [w, h] = [390, 600];
    const heroH = unitHeight(w, h) * FIGHTER_SIZE.hero;
    const mid = enemySpots(w, h, 3, false); // a group spreads over the lanes
    const lanesMid = (Math.min(...mid.map((p) => p.y)) + Math.max(...mid.map((p) => p.y))) / 2;
    for (const bossH of [heroH, heroH * 1.5, heroH * 2.2]) {
      const feet = bossFeetY(h, bossH, heroH);
      // Its middle is the hero's middle on the middle lane (unless the feet would leave the field).
      if (feet < h * FIELD.bossFeetMax) expect(feet - bossH / 2).toBeCloseTo(lanesMid - heroH / 2);
      expect(feet).toBeLessThanOrEqual(h * FIELD.bossFeetMax);
      expect(feet - bossH).toBeGreaterThan(0);
    }
    // A boss of a hero's size stands on the middle lane.
    expect(bossFeetY(h, heroH, heroH)).toBeCloseTo(lanesMid);
  });
});

describe('fighter sizes (the 크기 panel)', () => {
  it('a size multiplies the drawn height; a boss is still held to its box', () => {
    const [w, h] = [390, 600];
    const uh = unitHeight(w, h);
    const one = { hero: 1, enemy: 1, boss: 1 };
    expect(fighterHeight(w, h, { side: 'hero', boss: false, size: 1 }, 0.8, one)).toBeCloseTo(uh);
    expect(fighterHeight(w, h, { side: 'hero', boss: false, size: 1 }, 0.8, { ...one, hero: 0.5 })).toBeCloseTo(uh * 0.5);
    expect(fighterHeight(w, h, { side: 'enemy', boss: false, size: 0.65 }, 1, { ...one, enemy: 0.8 })).toBeCloseTo(uh * 0.65 * 0.8);
    // A wide boss its box holds (a daily boss): the 보스 size still moves it, from the box's width.
    const boxed = (k: number) => fighterHeight(w, h, { side: 'enemy', boss: true, size: 1.7 }, 1.6, { ...one, boss: k });
    expect(boxed(1) * 1.6).toBeCloseTo(bossBox(w).maxW);
    expect(boxed(0.6)).toBeCloseTo(boxed(1) * 0.6);
    expect(boxed(1.2)).toBeCloseTo(boxed(1) * 1.2);
    expect(boxed(0.8)).toBeLessThan(boxed(0.9));
  });

  it('a stored size comes back inside the range, a bad one as the default', () => {
    expect(clampFighterSize({})).toEqual(FIGHTER_SIZE);
    expect(clampFighterSize({ hero: 99, enemy: -1, boss: 'x' })).toEqual({ hero: FIGHTER_SIZE_RANGE.max, enemy: FIGHTER_SIZE_RANGE.min, boss: FIGHTER_SIZE.boss });
    expect(clampFighterSize({ hero: 0.7 }).hero).toBe(0.7);
  });
});
