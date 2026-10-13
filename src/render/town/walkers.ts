// 손님 용사 (기획서 9.3): heroes come in at the gate, walk to the shop, go in a while, and walk back
// out. The player has no part in it and nothing is counted: it is the screen's show, never saved
// (9.1 '지도 상태는 저장하지 않는다'), and it gives no gold (16번 질문의 (가), the economy is not in).
// Pure: the scene steps it each frame with its own random numbers and draws what it says.

import { GUESTS } from './layout.ts';

type Pt = readonly [number, number];

/** Total length of a polyline (map px). */
export function roadLength(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

/** The point `d` map px along a polyline, and the direction of the leg it is on. */
export function pointAt(pts: readonly Pt[], d: number): { x: number; y: number; dx: number; dy: number } {
  const first = pts[0] ?? ([0, 0] as const);
  if (pts.length < 2) return { x: first[0], y: first[1], dx: 0, dy: 0 };
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len || i === pts.length - 1) {
      const k = len === 0 ? 0 : Math.min(1, left / len);
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: len === 0 ? 0 : (b[0] - a[0]) / len, dy: len === 0 ? 0 : (b[1] - a[1]) / len };
    }
    left -= len;
  }
  const last = pts[pts.length - 1] as Pt;
  return { x: last[0], y: last[1], dx: 0, dy: 0 };
}

export interface Walker {
  readonly id: number;
  /** Which hero picture (an index into the scene's list). */
  readonly hero: number;
  /**
   * Its lane: a sideways offset from the road's middle (map px), positive on the way in (the street's
   * east side, the shop path's south side), negative on the way out, so two guests meeting pass by.
   */
  readonly lane: number;
  readonly phase: 'in' | 'shop' | 'out';
  /** How far along the road (map px from the start, the bottom edge). Walking out it counts down. */
  readonly dist: number;
  /** ms left in the shop. */
  readonly wait: number;
  /** ms left standing to say a line (tapped). */
  readonly talk: number;
  /** Faces right (the pictures face left). */
  readonly flip: boolean;
}

export interface Crowd {
  readonly walkers: readonly Walker[];
  /** ms until the next guest comes in. */
  readonly nextIn: number;
  readonly nextId: number;
}

export interface CrowdOptions {
  readonly road: readonly Pt[];
  readonly heroes: number;
  /** A random number in [0, 1) (presentation only). */
  readonly rand: () => number;
}

const between = (r: () => number, [a, b]: readonly [number, number]) => a + (b - a) * r();

/** A hero not on the map now, if there is one. */
function pickHero(walkers: readonly Walker[], heroes: number, rand: () => number): number {
  const busy = new Set(walkers.map((w) => w.hero));
  const free: number[] = [];
  for (let i = 0; i < heroes; i++) if (!busy.has(i)) free.push(i);
  const pool = free.length > 0 ? free : Array.from({ length: heroes }, (_, i) => i);
  return pool[Math.floor(rand() * pool.length)] ?? 0;
}

function newWalker(id: number, hero: number, rand: () => number, at: Partial<Walker> = {}): Walker {
  return {
    id,
    hero,
    lane: between(rand, GUESTS.lane),
    phase: 'in',
    dist: 0,
    wait: 0,
    talk: 0,
    flip: false,
    ...at,
  };
}

/**
 * The guests as the map opens: a couple already on the road (so the town is not empty for the
 * first half minute), one of them on the way out.
 */
export function startCrowd(o: CrowdOptions, count = 3): Crowd {
  const len = roadLength(o.road);
  const walkers: Walker[] = [];
  for (let i = 0; i < Math.min(count, GUESTS.max, o.heroes); i++) {
    const hero = pickHero(walkers, o.heroes, o.rand);
    const out = i % 2 === 1;
    const dist = len * (0.25 + 0.6 * o.rand());
    const lane = between(o.rand, GUESTS.lane) * (out ? -1 : 1);
    walkers.push(newWalker(i, hero, o.rand, { phase: out ? 'out' : 'in', dist, lane }));
  }
  return { walkers, nextIn: between(o.rand, GUESTS.spawnMs), nextId: walkers.length };
}

/** One frame: walk, wait in the shop, leave at the bottom; a new guest when it is time and there is room. */
export function stepCrowd(c: Crowd, dtMs: number, o: CrowdOptions): Crowd {
  const len = roadLength(o.road);
  const step = (GUESTS.speed * dtMs) / 1000;
  const walkers: Walker[] = [];
  for (const w of c.walkers) {
    if (w.talk > 0) {
      walkers.push({ ...w, talk: Math.max(0, w.talk - dtMs) });
      continue;
    }
    if (w.phase === 'in') {
      const dist = w.dist + step;
      if (dist >= len) walkers.push({ ...w, phase: 'shop', dist: len, wait: between(o.rand, GUESTS.shopMs) });
      else walkers.push({ ...w, dist, flip: facing(o.road, dist, 1, w.flip) });
    } else if (w.phase === 'shop') {
      const wait = w.wait - dtMs;
      walkers.push(wait <= 0 ? { ...w, phase: 'out', wait: 0, lane: -w.lane } : { ...w, wait });
    } else {
      const dist = w.dist - step;
      // Gone once well past the bottom edge (the road starts below the map).
      if (dist > 0) walkers.push({ ...w, dist, flip: facing(o.road, dist, -1, w.flip) });
    }
  }
  let nextIn = c.nextIn - dtMs;
  let nextId = c.nextId;
  if (nextIn <= 0) {
    if (walkers.length < GUESTS.max) {
      walkers.push(newWalker(nextId, pickHero(walkers, o.heroes, o.rand), o.rand));
      nextId += 1;
    }
    nextIn = between(o.rand, GUESTS.spawnMs);
  }
  return { walkers, nextIn, nextId };
}

/** Facing where it walks: right when the leg goes right (the pictures face left); straight up or down keeps the last. */
function facing(road: readonly Pt[], dist: number, dir: 1 | -1, was: boolean): boolean {
  const p = pointAt(road, dist);
  const dx = p.dx * dir;
  if (dx > 0.35) return true;
  if (dx < -0.35) return false;
  return was;
}

/** A tapped guest stops for a line (9.3 '탭하면 대사 한 줄'). */
export function talkTo(c: Crowd, id: number): Crowd {
  return { ...c, walkers: c.walkers.map((w) => (w.id === id ? { ...w, talk: GUESTS.talkMs } : w)) };
}

export interface WalkerPose {
  /** Feet on the map (map px). */
  x: number;
  y: number;
  /** The body's bob up (map px, ≥ 0) and a small sway (radians). */
  bob: number;
  tilt: number;
  flip: boolean;
  /** 0 inside the shop, fading at its door. */
  alpha: number;
}

/** Where a walker is drawn and how it is posed. */
export function walkerPose(w: Walker, road: readonly Pt[]): WalkerPose {
  const len = roadLength(road);
  const p = pointAt(road, w.dist);
  // The lane runs sideways to the leg (to the walker's right on the way in).
  const nx = -p.dy;
  const ny = p.dx;
  const x = p.x + nx * w.lane;
  const y = p.y + ny * w.lane * 0.5;
  const moving = w.talk <= 0 && w.phase !== 'shop';
  const phase = (w.dist / GUESTS.stride) * Math.PI;
  const bob = moving ? Math.abs(Math.sin(phase)) * GUESTS.bob : 0;
  const tilt = moving ? Math.sin(phase) * 0.05 : 0;
  // Going in at the door: the last stretch fades (in through the door), and fades back walking out.
  const doorFade = 26;
  const toDoor = len - w.dist;
  const alpha = w.phase === 'shop' ? 0 : toDoor < doorFade ? Math.max(0, toDoor / doorFade) : 1;
  return { x, y, bob, tilt, flip: w.flip, alpha };
}
