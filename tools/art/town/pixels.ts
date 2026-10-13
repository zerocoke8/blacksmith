// The map bake's pixel work (bake-map.ts), on plain RGBA arrays (no DOM, so it is tested in Node).
// These are the composer's own steps (page.js analyze / thinInk / rowExtent), so the game draws the
// same map from the same pictures:
//   - shadowMarks: finds the flat grey shadow baked into a generated picture (light, unsaturated,
//     reached from the transparent outside without crossing the ink line), so the map can lift it
//     off and lay every shadow down together in one colour (layout.json 'shadow').
//   - thinInk: thins the ground picture's dark-brown ink lines, so the roads' lines are no fatter
//     than the buildings' once the ground is stretched 2.4×.
//   - bodyBox: the picture's body (alpha ≥ 128), its middle and its foot (the base: its lowest 12%).

/** RGBA, row by row (ImageData.data). */
export type Rgba = Uint8ClampedArray;

const luma = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11;

/** Marks: 0 the picture, 1 transparent outside, 2 shadow, 3 the shadow's soft rim. */
export const MARK = { body: 0, clear: 1, shadow: 2, rim: 3 } as const;

/**
 * Which pixels are the baked shadow. `minArea` is the smallest patch that counts (smaller light
 * patches are anti-alias specks): the composer's 400 px on the generated PNG, so a picture shrunk
 * by s passes 400·s².
 */
export function shadowMarks(d: Rgba, W: number, H: number, minArea: number): Uint8Array {
  const N = W * H;
  const mark = new Uint8Array(N);
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) {
    if ((d[i * 4 + 3] ?? 0) < 24) {
      mark[i] = MARK.clear;
      q[qt++] = i;
    }
  }
  // Light pixels reached from the outside (the dark ink line stops the fill).
  const cand = new Uint8Array(N);
  while (qh < qt) {
    const i = q[qh++] as number;
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || mark[j] !== 0 || cand[j] !== 0) continue;
      const o = j * 4;
      if ((d[o + 3] ?? 0) >= 24 && luma(d[o] ?? 0, d[o + 1] ?? 0, d[o + 2] ?? 0) > 58) {
        cand[j] = 1;
        q[qt++] = j;
      }
    }
  }
  // Connected patches of them: a big grey one is a shadow (a coloured one is part of the picture).
  const label = new Int32Array(N);
  let labels = 0;
  let mean: [number, number, number] | null = null;
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (cand[i] === 0 || label[i] !== 0) continue;
    labels++;
    label[i] = labels;
    stack.length = 0;
    stack.push(i);
    const px: number[] = [];
    while (stack.length > 0) {
      const k = stack.pop() as number;
      px.push(k);
      const x = k % W;
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (j >= 0 && j < N && cand[j] !== 0 && label[j] === 0) {
          label[j] = labels;
          stack.push(j);
        }
      }
    }
    if (px.length < minArea) continue;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const k of px) {
      r += d[k * 4] ?? 0;
      g += d[k * 4 + 1] ?? 0;
      b += d[k * 4 + 2] ?? 0;
    }
    const m: [number, number, number] = [r / px.length, g / px.length, b / px.length];
    const sat = Math.max(...m) - Math.min(...m);
    if (sat < 60) {
      for (const k of px) mark[k] = MARK.shadow;
      mean = m;
    }
  }
  // The shadow's soft rim: half-transparent pixels next to it, of its colour.
  if (mean !== null) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        const a = d[i * 4 + 3] ?? 0;
        if (mark[i] !== 0 || a < 1 || a >= 240) continue;
        const x = i % W;
        let near = false;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && (mark[j] === MARK.shadow || mark[j] === MARK.rim)) {
            near = true;
            break;
          }
        }
        if (!near) continue;
        const o = i * 4;
        const dist = Math.abs((d[o] ?? 0) - mean[0]) + Math.abs((d[o + 1] ?? 0) - mean[1]) + Math.abs((d[o + 2] ?? 0) - mean[2]);
        if (dist < 90) mark[i] = MARK.rim;
      }
    }
  }
  return mark;
}

/** Splits RGBA by the marks: the picture without its shadow, and the shadow's alpha (as black). */
export function splitByMarks(d: Rgba, mark: Uint8Array): { sprite: Rgba; shadow: Rgba | null } {
  const N = mark.length;
  const sprite = new Uint8ClampedArray(N * 4);
  let any = false;
  const shadow = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const a = d[o + 3] ?? 0;
    const m = mark[i];
    if (m === MARK.shadow || m === MARK.rim) {
      shadow[o + 3] = m === MARK.shadow && a >= 200 ? 255 : a;
      any = true;
    } else {
      sprite[o] = d[o] ?? 0;
      sprite[o + 1] = d[o + 1] ?? 0;
      sprite[o + 2] = d[o + 2] ?? 0;
      sprite[o + 3] = a;
    }
  }
  return { sprite, shadow: any ? shadow : null };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box of pixels with alpha ≥ min, or null for an empty picture. */
export function alphaBox(d: Rgba, W: number, H: number, min: number): Box | null {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((d[(y * W + x) * 4 + 3] ?? 0) >= min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export interface Body {
  /** The body's box (alpha ≥ 128). */
  box: Box;
  /** Its middle x and the ground line (one past its lowest row): where it stands on the map. */
  cx: number;
  gy: number;
  /** Its base: the lowest 12% of the body, middle x and width (for the ground shadow). */
  base: { x: number; w: number };
}

/** The body of a picture (as page.js measures it after cropping and thickening). */
export function bodyOf(d: Rgba, W: number, H: number): Body | null {
  const box = alphaBox(d, W, H, 128);
  if (box === null) return null;
  const by1 = box.y + box.h - 1;
  let fx0 = W;
  let fx1 = -1;
  for (let y = Math.round(by1 - box.h * 0.12); y <= by1; y++) {
    for (let x = 0; x < W; x++) {
      if ((d[(y * W + x) * 4 + 3] ?? 0) >= 128) {
        if (x < fx0) fx0 = x;
        if (x > fx1) fx1 = x;
      }
    }
  }
  return { box, cx: (box.x + box.x + box.w - 1) / 2, gy: by1 + 1, base: { x: (fx0 + fx1) / 2, w: fx1 - fx0 + 1 } };
}

/** The opaque run of a row: its middle and width (the tower stacking's wall). */
export function rowExtent(d: Rgba, W: number, y: number): { c: number; w: number } {
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < W; x++) {
    if ((d[(y * W + x) * 4 + 3] ?? 0) >= 128) {
      if (x0 < 0) x0 = x;
      x1 = x;
    }
  }
  return x0 < 0 ? { c: W / 2, w: 1 } : { c: (x0 + x1) / 2, w: x1 - x0 + 1 };
}

/**
 * Thins dark-brown ink lines by r px on each side (in place). Every ink pixel finds its nearest
 * non-ink pixel (two passes of nearest-seed spreading); within r it takes the colour a few px past
 * that seed, blended over the last px for a soft edge. Grass, water, the cliff's fill and pebbles
 * are lighter or not brown, so they are never ink. (page.js thinInk.)
 */
export function thinInk(d: Rgba, W: number, H: number, r: number): void {
  const N = W * H;
  const ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const R = d[o] ?? 0;
    const G = d[o + 1] ?? 0;
    const B = d[o + 2] ?? 0;
    const L = R * 0.3 + G * 0.59 + B * 0.11;
    const cliff = Math.abs(R - 162) < 16 && Math.abs(G - 142) < 16 && Math.abs(B - 125) < 16;
    ink[i] = L < 162 && R >= G - 2 && B <= R + 10 && !cliff ? 1 : 0;
  }
  const sx = new Int32Array(N).fill(-1);
  const sy = new Int32Array(N);
  const dist = new Float64Array(N).fill(1e12);
  for (let i = 0; i < N; i++) {
    if (ink[i] === 0) {
      sx[i] = i % W;
      sy[i] = (i / W) | 0;
      dist[i] = 0;
    }
  }
  const relax = (i: number, j: number, x: number, y: number) => {
    const jx = sx[j] as number;
    if (jx < 0) return;
    const dx = x - jx;
    const dy = y - (sy[j] as number);
    const dd = dx * dx + dy * dy;
    if (dd < (dist[i] as number)) {
      dist[i] = dd;
      sx[i] = jx;
      sy[i] = sy[j] as number;
    }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ink[i] === 0) continue;
      if (x > 0) relax(i, i - 1, x, y);
      if (y > 0) {
        relax(i, i - W, x, y);
        if (x > 0) relax(i, i - W - 1, x, y);
        if (x < W - 1) relax(i, i - W + 1, x, y);
      }
    }
    for (let x = W - 2; x >= 0; x--) {
      const i = y * W + x;
      if (ink[i] !== 0) relax(i, i + 1, x, y);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (ink[i] === 0) continue;
      if (x < W - 1) relax(i, i + 1, x, y);
      if (y < H - 1) {
        relax(i, i + W, x, y);
        if (x < W - 1) relax(i, i + W + 1, x, y);
        if (x > 0) relax(i, i + W - 1, x, y);
      }
    }
    for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (ink[i] !== 0) relax(i, i - 1, x, y);
    }
  }
  const src = new Uint8ClampedArray(d);
  for (let i = 0; i < N; i++) {
    const seedX = sx[i] as number;
    if (ink[i] === 0 || seedX < 0) continue;
    const dd = Math.sqrt(dist[i] as number);
    const t = Math.min(1, r + 0.5 - dd);
    if (t <= 0) continue;
    const seedY = sy[i] as number;
    const x = i % W;
    const y = (i / W) | 0;
    const vx = seedX - x;
    const vy = seedY - y;
    const len = Math.hypot(vx, vy) || 1;
    let px = seedX;
    let py = seedY;
    for (const step of [3, 2, 1]) {
      const qx = Math.round(seedX + (vx / len) * step);
      const qy = Math.round(seedY + (vy / len) * step);
      if (qx >= 0 && qy >= 0 && qx < W && qy < H && ink[qy * W + qx] === 0) {
        px = qx;
        py = qy;
        break;
      }
    }
    const j = (py * W + px) * 4;
    const o = i * 4;
    for (let k = 0; k < 3; k++) d[o + k] = (src[o + k] ?? 0) * (1 - t) + (src[j + k] ?? 0) * t;
  }
}

/** The composer's seeded random numbers (page.js rng), so the clouds' and paths' wobble is the same. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
