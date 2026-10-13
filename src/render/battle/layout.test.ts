import { describe, expect, it } from 'vitest';
import { bossBox, bossCenterX, enemySpots, FIELD, heroSpots, unitHeight } from './layout.ts';

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
      // However wide the picture, its middle stays inside the box and it never leaves the field.
      for (const bw of [80, bossBox(w).maxW, w]) {
        const x = bossCenterX(w, bw, w * FIELD.boss.x);
        const half = Math.min(bw, bossBox(w).maxW) / 2;
        expect(x - half).toBeGreaterThanOrEqual(bossBox(w).left - 1e-9);
        expect(x + half).toBeLessThanOrEqual(w);
      }
    });
  }
});
