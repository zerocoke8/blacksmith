// Deterministic randomness for the simulation (기획서 3.6).
// Every random draw comes from a stream named by a key tuple, e.g.
// rngFor(worldSeed, 'floor', heroId, expeditionNo, floor). Streams never share
// state, so one hero's events cannot shift another hero's results, and the same
// world seed always replays the same world on any device or server.

export type KeyPart = string | number;

/** 32-bit FNV-1a over the key parts, separated so ('ab','c') != ('a','bc'). */
export function hashKey(...parts: KeyPart[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = typeof part === 'number' ? `n${part}` : `s${part}`;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x1f; // part separator
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** sfc32 generator seeded from a 32-bit hash. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    // Warm up so nearby seeds diverge.
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (clamped to [0, 1]). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Index chosen with probability proportional to weights. */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weightedIndex with no positive weight');
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= Math.max(0, weights[i] ?? 0);
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}

/** Independent stream for one key tuple. */
export function rngFor(worldSeed: number, ...key: KeyPart[]): Rng {
  return new Rng(hashKey(worldSeed, ...key));
}
