// Which building (or walker) a tap on the map lands on (기획서 9.1 '건물을 탭하면'). Each target is
// its drawn picture: a box in map px and, when the picture's pixels are known, its alpha, so a tap
// on the grass between a roof and a tree is nobody's. A finger is fat, so a tap a little off the
// edge still counts (`slop` map px around the point), but a tap right on a picture beats one that
// only grazes another. Among those, the one drawn in front (larger z, the ground y) wins. Pure: the
// scene hands in the targets and their alpha lookups.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A picture's alpha mask: w × h values 0~255, row by row, and where it lies on the map. */
export interface AlphaMask {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  /** Map px of its top-left corner, map px per mask px, and whether it is drawn mirrored. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly flip: boolean;
}

export interface HitTarget<T> {
  readonly id: T;
  /** Drawing order: larger is in front. */
  readonly z: number;
  /** Its box (map px). Without a mask, the box is what counts. */
  readonly rect: Rect;
  readonly mask?: AlphaMask;
}

/** At or above this alpha a pixel is the picture (as the art pipeline's body box, 128). */
export const SOLID_ALPHA = 128;

/** The mask's alpha under a map point (0 outside it). */
export function alphaAt(m: AlphaMask, mx: number, my: number): number {
  const w = m.w * m.scale;
  let lx = (mx - m.x) / m.scale;
  if (m.flip) lx = (w - (mx - m.x)) / m.scale;
  const ly = (my - m.y) / m.scale;
  const ix = Math.floor(lx);
  const iy = Math.floor(ly);
  if (ix < 0 || iy < 0 || ix >= m.w || iy >= m.h) return 0;
  return m.data[iy * m.w + ix] ?? 0;
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The point itself is on the target's picture. */
export function hitsAt<T>(t: HitTarget<T>, x: number, y: number): boolean {
  if (!inRect(t.rect, x, y)) return false;
  return t.mask === undefined || alphaAt(t.mask, x, y) >= SOLID_ALPHA;
}

/** Points on a ring of radius r round (x, y): eight directions. */
function ring(x: number, y: number, r: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    out.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return out;
}

/**
 * The target under a tap at (x, y) (map px), or null. A target hit at the point itself beats one
 * hit only within `slop` round it; then the one in front wins.
 */
export function hitTest<T>(targets: readonly HitTarget<T>[], x: number, y: number, slop: number): HitTarget<T> | null {
  let best: HitTarget<T> | null = null;
  let bestScore = -Infinity;
  const near = slop > 0 ? [...ring(x, y, slop), ...ring(x, y, slop / 2)] : [];
  for (const t of targets) {
    let score: number;
    if (hitsAt(t, x, y)) score = 1e9 + t.z;
    else if (near.some((p) => hitsAt(t, p.x, p.y))) score = t.z;
    else continue;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
