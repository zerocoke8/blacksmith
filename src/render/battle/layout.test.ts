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
  MOVE,
  movePoint,
  movePoints,
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

describe('where a melee fighter stands by its foe (movePoint)', () => {
  const [w, h] = [390, 600];
  const uh = unitHeight(w, h);
  const hero = { x: w * 0.36, y: h * 0.74, w: uh * 0.7, h: uh, side: 'hero' as const };
  const foe = { x: w * 0.63, y: h * 0.62, w: uh * 0.6, h: uh * 0.6 };

  it('a hero stops just left of its foe, most of the way to its lane', () => {
    const p = movePoint(hero, foe, w, h);
    expect(p.x).toBeGreaterThan(hero.x);
    expect(p.x).toBeLessThan(foe.x);
    // The bodies meet: less than the two half widths apart, but not on top of each other.
    expect(foe.x - p.x).toBeLessThan((hero.w + foe.w) / 2 + MOVE.gap * hero.h + 1e-9);
    expect(foe.x - p.x).toBeGreaterThan(hero.w * 0.25);
    expect(p.y).toBeCloseTo(hero.y + (foe.y - hero.y) * MOVE.lane);
    // Mostly in its own lane: less than half the way to the foe's.
    expect(MOVE.lane).toBeLessThan(0.5);
    // Two from two lanes at one foe stand apart.
    const other = movePoint({ ...hero, y: h * 0.58 }, foe, w, h);
    expect(Math.abs(other.y - p.y)).toBeGreaterThan(5);
  });

  it('a back-row walker stands a step behind; a monster stands right of its hero', () => {
    const front = movePoint(hero, foe, w, h);
    const back = movePoint({ ...hero, behind: true }, foe, w, h);
    expect(front.x - back.x).toBeCloseTo(MOVE.behind * hero.h);
    const mon = { ...foe, side: 'enemy' as const };
    const target = { x: hero.x, y: hero.y, w: hero.w, h: hero.h };
    expect(movePoint(mon, target, w, h).x).toBeGreaterThan(target.x);
  });

  it('at a lone boss heroes keep mostly to their own lanes', () => {
    const boss = { x: w * 0.76, y: h * 0.84, w: uh * 1.4, h: uh * 1.3, boss: true };
    const top = { ...hero, y: h * 0.6 };
    const p = movePoint(top, boss, w, h);
    expect(p.y).toBeCloseTo(top.y + (boss.y - top.y) * MOVE.bossLane);
    expect(p.x).toBeLessThan(boss.x - boss.w * 0.25);
  });

  it('three heroes on the front-most monster stand in a column before it, not in a heap', () => {
    const three = [0.58, 0.74, 0.9].map((k) => ({ ...hero, y: h * k }));
    const top = { ...foe, y: h * FIELD.laneTop };
    const at = movePoints(three, top, w, h);
    const ys = at.map((p) => p.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect((ys[i] as number) - (ys[i - 1] as number)).toBeGreaterThanOrEqual(MOVE.spread * hero.h - 1e-9);
    for (const p of at) {
      expect(p.y).toBeGreaterThanOrEqual(h * FIELD.laneTop - 1e-9);
      expect(p.y).toBeLessThanOrEqual(h * FIELD.laneBottom + 1e-9);
      expect(p.x).toBeLessThan(top.x);
    }
    // Each keeps its order (the top lane's hero stays on top).
    expect((at[0] as { y: number }).y).toBeLessThan((at[2] as { y: number }).y);
    // Alone, it is movePoint.
    expect(movePoints([hero], foe, w, h)).toEqual([movePoint(hero, foe, w, h)]);
  });

  it('a crowd taller than the lanes squeezes in rather than leaving them', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...hero, y: h * 0.74 + i }));
    for (const p of movePoints(many, foe, w, h)) {
      expect(p.y).toBeGreaterThanOrEqual(h * FIELD.laneTop - 1e-9);
      expect(p.y).toBeLessThanOrEqual(h * FIELD.laneBottom + 1e-9);
    }
  });

  it('never leaves the field: inside its width and on the lanes', () => {
    // A foe at the left edge (a hero would stand off the field) and one below the lanes (a boss's feet).
    const p = movePoint(hero, { x: 6, y: h * 0.99, w: 40, h: 40 }, w, h);
    expect(p.x - hero.w / 2).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(h * FIELD.laneBottom + 1e-9);
    const q = movePoint({ ...foe, side: 'enemy' }, { x: w - 4, y: h * 0.3, w: 40, h: 40 }, w, h);
    expect(q.x + foe.w / 2).toBeLessThanOrEqual(w);
    expect(q.y).toBeGreaterThanOrEqual(h * FIELD.laneTop - 1e-9);
  });
});
