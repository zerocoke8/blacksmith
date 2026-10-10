import { describe, expect, it } from 'vitest';
import { hashKey, Rng, rngFor } from './rng.ts';

describe('rng', () => {
  it('replays the same sequence for the same key', () => {
    const a = rngFor(42, 'floor', 'hero-1', 3, 17);
    const b = rngFor(42, 'floor', 'hero-1', 3, 17);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('separates key parts so concatenations do not collide', () => {
    expect(hashKey('ab', 'c')).not.toBe(hashKey('a', 'bc'));
    expect(hashKey(1, 23)).not.toBe(hashKey(12, 3));
    expect(hashKey('1')).not.toBe(hashKey(1));
  });

  it('gives different streams for different keys', () => {
    const a = rngFor(42, 'floor', 'hero-1', 3, 17).next();
    const b = rngFor(42, 'floor', 'hero-1', 3, 18).next();
    expect(a).not.toBe(b);
  });

  it('is roughly uniform', () => {
    const rng = new Rng(7);
    const buckets = new Array(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) buckets[Math.floor(rng.next() * 10)]++;
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan(n / 100);
  });

  it('int stays in range and weightedIndex follows weights', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[rng.weightedIndex([1, 2, 0])]!++;
    expect(counts[2]).toBe(0);
    expect(counts[1]! / counts[0]!).toBeGreaterThan(1.8);
    expect(counts[1]! / counts[0]!).toBeLessThan(2.2);
  });
});
