import { describe, expect, it } from 'vitest';
import { GUEST_ROAD, GUESTS, MAP_H } from './layout.ts';
import { type Crowd, pointAt, roadLength, startCrowd, stepCrowd, talkTo, walkerPose } from './walkers.ts';

/** A seeded stand-in for Math.random (the scene's guests are presentation only). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('the guests’ road (9.3: gate → shop → gate)', () => {
  it('starts below the map and ends at the shop door', () => {
    const first = GUEST_ROAD[0] as readonly [number, number];
    const last = GUEST_ROAD[GUEST_ROAD.length - 1] as readonly [number, number];
    expect(first[1]).toBeGreaterThan(MAP_H);
    expect(last[0]).toBeGreaterThan(first[0] + 300);
    expect(last[1]).toBeLessThan(4100);
  });

  it('measures and walks a polyline', () => {
    const road = [
      [0, 0],
      [3, 4],
      [3, 10],
    ] as const;
    expect(roadLength(road)).toBe(11);
    expect(pointAt(road, 2.5)).toMatchObject({ x: 1.5, y: 2 });
    expect(pointAt(road, 8)).toMatchObject({ x: 3, y: 7, dx: 0, dy: 1 });
    expect(pointAt(road, 99)).toMatchObject({ x: 3, y: 10 });
  });
});

describe('the crowd', () => {
  const opts = { road: GUEST_ROAD, heroes: 10, rand: rng(7) };

  it('opens with a few on the road, never two of the same hero', () => {
    const c = startCrowd(opts);
    expect(c.walkers.length).toBeGreaterThan(0);
    expect(c.walkers.length).toBeLessThanOrEqual(GUESTS.max);
    expect(new Set(c.walkers.map((w) => w.hero)).size).toBe(c.walkers.length);
  });

  it('walks in on one side of the road and out on the other, so two meeting pass each other', () => {
    for (const w of startCrowd({ ...opts, rand: rng(11) }).walkers) {
      if (w.phase === 'in') expect(w.lane).toBeGreaterThanOrEqual(GUESTS.lane[0]);
      else expect(w.lane).toBeLessThanOrEqual(-GUESTS.lane[0]);
    }
    let c: Crowd = { walkers: [], nextIn: 0, nextId: 0 };
    c = stepCrowd(c, 1, { ...opts, rand: rng(5) });
    const inLane = c.walkers[0]?.lane ?? 0;
    expect(inLane).toBeGreaterThanOrEqual(GUESTS.lane[0]);
    expect(inLane).toBeLessThanOrEqual(GUESTS.lane[1]);
    for (let t = 0; t < 200_000; t += 100) {
      c = stepCrowd({ ...c, nextIn: Infinity }, 100, opts);
      const w = c.walkers[0];
      if (w === undefined || w.phase === 'out') break;
    }
    expect(c.walkers[0]?.lane).toBe(-inLane);
  });

  it('every guest walks in, stays in the shop a while, walks out and is gone', () => {
    let c: Crowd = { walkers: [], nextIn: 0, nextId: 0 };
    c = stepCrowd(c, 1, { ...opts, rand: rng(3) });
    expect(c.walkers).toHaveLength(1);
    const id = c.walkers[0]?.id;
    const len = roadLength(GUEST_ROAD);
    const phases: string[] = [];
    let wasInShopMs = 0;
    for (let t = 0; t < 200_000; t += 50) {
      c = stepCrowd({ ...c, nextIn: Infinity }, 50, opts);
      const w = c.walkers.find((x) => x.id === id);
      if (w === undefined) break;
      if (phases[phases.length - 1] !== w.phase) phases.push(w.phase);
      if (w.phase === 'shop') {
        wasInShopMs += 50;
        expect(walkerPose(w, GUEST_ROAD).alpha).toBe(0);
      }
    }
    expect(phases).toEqual(['in', 'shop', 'out']);
    expect(wasInShopMs).toBeGreaterThanOrEqual(GUESTS.shopMs[0] - 50);
    expect(wasInShopMs).toBeLessThanOrEqual(GUESTS.shopMs[1] + 50);
    expect(c.walkers.find((x) => x.id === id)).toBeUndefined();
    // One way at the walking speed.
    expect(len / GUESTS.speed).toBeGreaterThan(10);
  });

  it('keeps to the most at once and keeps coming', () => {
    let c = startCrowd(opts);
    let most = 0;
    let ids = new Set<number>();
    for (let t = 0; t < 600_000; t += 100) {
      c = stepCrowd(c, 100, opts);
      most = Math.max(most, c.walkers.length);
      ids = new Set([...ids, ...c.walkers.map((w) => w.id)]);
    }
    expect(most).toBeLessThanOrEqual(GUESTS.max);
    expect(ids.size).toBeGreaterThan(20);
  });

  it('faces where it walks: right along the shop path in, left on the way out', () => {
    let c: Crowd = { walkers: [], nextIn: 0, nextId: 0 };
    c = stepCrowd(c, 1, opts);
    const len = roadLength(GUEST_ROAD);
    // Walk to near the shop door (the path runs right).
    c = { ...c, walkers: c.walkers.map((w) => ({ ...w, dist: len - 120 })) };
    c = stepCrowd({ ...c, nextIn: Infinity }, 100, opts);
    expect(c.walkers[0]?.flip).toBe(true);
    c = { ...c, walkers: c.walkers.map((w) => ({ ...w, phase: 'out' as const, dist: len - 120 })) };
    c = stepCrowd({ ...c, nextIn: Infinity }, 100, opts);
    expect(c.walkers[0]?.flip).toBe(false);
  });

  it('a tapped guest stops to talk, then walks on', () => {
    let c = startCrowd(opts, 1);
    const w0 = c.walkers[0];
    expect(w0).toBeDefined();
    c = talkTo(c, w0?.id ?? -1);
    const d0 = c.walkers[0]?.dist ?? 0;
    c = stepCrowd({ ...c, nextIn: Infinity }, GUESTS.talkMs - 100, opts);
    expect(c.walkers[0]?.dist).toBe(d0);
    expect(walkerPose(c.walkers[0] as NonNullable<(typeof c.walkers)[0]>, GUEST_ROAD).bob).toBe(0);
    c = stepCrowd({ ...c, nextIn: Infinity }, 200, opts);
    c = stepCrowd({ ...c, nextIn: Infinity }, 500, opts);
    expect(c.walkers[0]?.dist).not.toBe(d0);
  });

  it('bobs as it walks and fades at the shop door', () => {
    const len = roadLength(GUEST_ROAD);
    const base = { id: 1, hero: 0, lane: 0, phase: 'in' as const, wait: 0, talk: 0, flip: false };
    const bobs = [0, 5, 10, 15, 20, 25].map((d) => walkerPose({ ...base, dist: 300 + d }, GUEST_ROAD).bob);
    expect(Math.max(...bobs)).toBeGreaterThan(0);
    expect(Math.max(...bobs)).toBeLessThanOrEqual(GUESTS.bob);
    expect(walkerPose({ ...base, dist: 300 }, GUEST_ROAD).alpha).toBe(1);
    expect(walkerPose({ ...base, dist: len - 5 }, GUEST_ROAD).alpha).toBeLessThan(0.5);
  });
});
