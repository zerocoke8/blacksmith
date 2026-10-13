// The map's bake (기획서 9장), run in headless Chrome by bake.ts: the composer's steps
// (tools/art/town/page.js) on the processed WebPs, so the game draws the same map the mockup shows
// without doing any of this as it opens.
//   - The ground: sky, the ground picture (its ink lines thinned), the dirt paths and every shadow,
//     on one canvas at the ground picture's own resolution. The game stretches it 2.4× on the GPU
//     (layout map.groundScale), so the biggest picture is the ground's own 1024 px width.
//   - Each building, tower, prop: its baked grey shadow lifted off (it joins the one shadow layer),
//     small props and people given the extra outer ink the composer gives them, the towers stacked
//     storey on storey into the clouds, then shrunk to map resolution (one px per map px) so nothing
//     shimmers when the map moves.
//   - The clouds on the horizon and round the towers, the cloud band's tile.
// Browser code (canvas), loaded through Vite's dev server so it reads the same layout the game does
// (src/render/town/layout.ts). The pixel steps are pixels.ts (tested in Node).

import type { BakedLayer, BakedManifest, BakedPic } from '../../../src/render/town/baked.ts';
import { GUESTS, groundEllipse, type LayoutItem, MAP_ITEMS, type PuffStyle, TOWER_TOP_CUT, TOWN_LAYOUT } from '../../../src/render/town/layout.ts';
import { alphaBox, bodyOf, rowExtent, seeded, shadowMarks, splitByMarks, thinInk } from './pixels.ts';

const INK = '#34231a';

// ---------- The sources: processed WebPs and their sizes ----------

const SOURCES = import.meta.glob(['/src/assets/art/{town,heroes}/*.webp', '/src/assets/art/scene/dwarf_idle.webp'], {
  import: 'default',
  eager: true,
}) as Record<string, string>;

function sourceUrl(group: 'town' | 'heroes' | 'scene', key: string): string | null {
  return SOURCES[`/src/assets/art/${group}/${key}.webp`] ?? null;
}

const META_FILES = import.meta.glob('/src/assets/art/meta.json', { import: 'default', eager: true }) as Record<string, unknown>;

interface PicMeta {
  /** Processed px per source px, and the kept box on the source PNG (source px). */
  readonly scale: number;
  readonly trim: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function picMeta(group: 'town' | 'heroes' | 'scene', key: string): PicMeta | null {
  const root = Object.values(META_FILES)[0];
  if (!isObj(root) || !isObj(root[group])) return null;
  const raw = (root[group] as Record<string, unknown>)[key];
  if (!isObj(raw)) return null;
  const trim = isObj(raw.trim) ? raw.trim : {};
  const w = num(raw.w, 0);
  const h = num(raw.h, 0);
  return { scale: num(raw.scale, 1), trim: { x: num(trim.x, 0), y: num(trim.y, 0), w: num(trim.w, w), h: num(trim.h, h) } };
}

/** The example heroes with a processed picture, in a fixed order. */
function heroKeys(): string[] {
  return Object.keys(SOURCES)
    .map((p) => /\/art\/heroes\/(hero_[^/]+)\.webp$/.exec(p)?.[1])
    .filter((k): k is string => k !== undefined)
    .sort();
}

// ---------- Canvas ----------

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Every canvas here is read back at some point, so they live on the CPU side. */
function ctx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: true });
  if (g === null) throw new Error('no 2d canvas');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  return g;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Shrinks by halves, then to the exact size (the composer's resample): sharp, never upscaled twice. */
function resample(src: HTMLCanvasElement, s: number): { c: HTMLCanvasElement; sx: number; sy: number } {
  const tw = Math.max(1, Math.round(src.width * s));
  const th = Math.max(1, Math.round(src.height * s));
  let c = src;
  let w = src.width;
  let h = src.height;
  while (w / 2 >= tw && h / 2 >= th && w > 2) {
    const nw = Math.round(w / 2);
    const nh = Math.round(h / 2);
    const n = mk(nw, nh);
    ctx(n).drawImage(c, 0, 0, nw, nh);
    c = n;
    w = nw;
    h = nh;
  }
  if (w !== tw || h !== th) {
    const n = mk(tw, th);
    ctx(n).drawImage(c, 0, 0, tw, th);
    c = n;
  }
  return { c, sx: tw / src.width, sy: th / src.height };
}

function pixelsOf(c: HTMLCanvasElement): ImageData {
  return ctx(c).getImageData(0, 0, c.width, c.height);
}

function fromPixels(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = mk(w, h);
  const img = new ImageData(w, h);
  img.data.set(data);
  ctx(c).putImageData(img, 0, 0);
  return c;
}

// ---------- One picture ----------

/** A picture ready for the map: its canvas and where it stands in it. */
interface Baked {
  readonly canvas: HTMLCanvasElement;
  readonly ax: number;
  readonly ay: number;
  readonly scale: number;
  readonly foot: { readonly off: number; readonly bw: number };
}

interface Cut {
  /** The picture, its shadow lifted, cropped to what is there (this picture's px). */
  readonly canvas: HTMLCanvasElement;
  /** Its lifted shadow in the same frame, or null. */
  readonly shadow: HTMLCanvasElement | null;
}

/** A picture ready for the map, and where its cut frame lies (for its lifted shadow). */
interface Placed2 {
  readonly sprite: Baked;
  /** The feet in the cut frame (cut px): the shadow is drawn from there. */
  readonly cutAnchor: { readonly x: number; readonly y: number };
}

/** Box of alpha ≥ min over one or two RGBA arrays of the same size. */
function unionBox(a: Uint8ClampedArray, b: Uint8ClampedArray | null, W: number, H: number, min: number) {
  const ba = alphaBox(a, W, H, min);
  const bb = b !== null ? alphaBox(b, W, H, min) : null;
  if (ba === null) return bb;
  if (bb === null) return ba;
  const x0 = Math.min(ba.x, bb.x);
  const y0 = Math.min(ba.y, bb.y);
  return { x: x0, y: y0, w: Math.max(ba.x + ba.w, bb.x + bb.w) - x0, h: Math.max(ba.y + ba.h, bb.y + bb.h) - y0 };
}

/**
 * The composer's analyze(), first half: lift the baked shadow off and crop to what is there.
 * `stack` stacks a tower first (rows in this picture's px).
 */
function cut(img: CanvasImageSource & { width: number; height: number }, o: { shadow: boolean; minArea: number; stack?: StackSpec | undefined }): Cut {
  const W = img.width;
  const H = img.height;
  const c0 = mk(W, H);
  ctx(c0).drawImage(img, 0, 0);
  const d = pixelsOf(c0).data;
  let spriteData: Uint8ClampedArray = d;
  let shadowData: Uint8ClampedArray | null = null;
  if (o.shadow) {
    const parts = splitByMarks(d, shadowMarks(d, W, H, o.minArea));
    spriteData = parts.sprite;
    shadowData = parts.shadow;
  }
  if (o.stack !== undefined) {
    const stacked = stackTower(fromPixels(spriteData, W, H), o.stack);
    const SW = stacked.width;
    const SH = stacked.height;
    let shadow: HTMLCanvasElement | null = null;
    if (shadowData !== null) {
      // The base is drawn unscaled at the bottom: its shadow keeps its place under it.
      shadow = mk(SW, SH);
      ctx(shadow).drawImage(fromPixels(shadowData, W, H), 0, SH - H);
    }
    const box = unionBox(pixelsOf(stacked).data, shadow !== null ? pixelsOf(shadow).data : null, SW, SH, 8) ?? { x: 0, y: 0, w: SW, h: SH };
    return { canvas: cropTo(stacked, box), shadow: shadow !== null ? cropTo(shadow, box) : null };
  }
  const box = unionBox(spriteData, shadowData, W, H, 8) ?? { x: 0, y: 0, w: W, h: H };
  const pic = o.shadow ? fromPixels(spriteData, W, H) : c0;
  return { canvas: cropTo(pic, box), shadow: shadowData !== null ? cropTo(fromPixels(shadowData, W, H), box) : null };
}

function cropTo(src: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const c = mk(box.w, box.h);
  ctx(c).drawImage(src, -box.x, -box.y);
  return c;
}

/** The composer's extra outer ink: the silhouette in ink, stamped round in three rings under the picture. */
function thicken(pic: HTMLCanvasElement, r: number): { c: HTMLCanvasElement; pad: number } {
  const pad = Math.ceil(r) + 2;
  const out = mk(pic.width + pad * 2, pic.height + pad * 2);
  const sil = mk(out.width, out.height);
  const gs = ctx(sil);
  gs.drawImage(pic, pad, pad);
  gs.globalCompositeOperation = 'source-in';
  gs.fillStyle = INK;
  gs.fillRect(0, 0, sil.width, sil.height);
  const go = ctx(out);
  for (const rr of [r, r * 0.66, r * 0.33]) {
    for (let k = 0; k < 32; k++) {
      const t = (k / 32) * Math.PI * 2;
      go.drawImage(sil, Math.cos(t) * rr, Math.sin(t) * rr);
    }
  }
  go.drawImage(pic, pad, pad);
  return { c: out, pad };
}

/**
 * The cut picture at map resolution (`s` = map px per cut px), with the composer's outer ink
 * (`line` map px), measured where it stands (after the ink, as the composer measures). `cropAbove`:
 * rows that land higher than this map y relative to the feet are dropped (the towers' tops, hidden in the clouds).
 */
function toMap(c: Cut, s: number, o: { line?: number; tree?: boolean; cropAbove?: number } = {}): Placed2 {
  const r = s < 1 ? resample(c.canvas, s) : { c: c.canvas, sx: 1, sy: 1 };
  let pic = r.c;
  let pad = 0;
  if ((o.line ?? 0) > 0) {
    const t = thicken(pic, ((o.line ?? 0) * r.sx) / s);
    pic = t.c;
    pad = t.pad;
  }
  /** Map px per px of the result. */
  const scale = s / r.sx;
  const d = pixelsOf(pic).data;
  let b = bodyOf(d, pic.width, pic.height) ?? { box: { x: 0, y: 0, w: pic.width, h: pic.height }, cx: pic.width / 2, gy: pic.height, base: { x: pic.width / 2, w: pic.width } };
  let top = 0;
  if (o.cropAbove !== undefined) {
    top = Math.max(0, Math.floor(b.gy + o.cropAbove / scale) - 2);
    if (top > 0) {
      const t = mk(pic.width, pic.height - top);
      ctx(t).drawImage(pic, 0, -top);
      pic = t;
      b = { ...b, box: { ...b.box, y: b.box.y - top }, gy: b.gy - top };
    }
  }
  // The composer's contact ellipse: as wide as the base, at least 30% of the body (55% for a tree).
  const bw = Math.max(b.base.w, b.box.w * (o.tree === true ? 0.55 : 0.3)) * scale;
  const off = (b.base.x - b.cx) * scale;
  return {
    sprite: { canvas: pic, ax: b.cx, ay: b.gy, scale, foot: { off, bw } },
    cutAnchor: { x: (b.cx - pad) / r.sx, y: (b.gy + top - pad) / r.sy },
  };
}

// ---------- Endless towers (page.js stackTower) ----------

interface StackSpec {
  /** Rows (this picture's px): head [0, top), storey [top, bot), base [bot, H). */
  readonly top: number;
  readonly bot: number;
  readonly n: number;
  readonly shrink: number;
  /** Rows that overlap and fade at each join. */
  readonly ov: number;
}

/**
 * One storey band repeated n times up the tower, each shrink× the one below, warped row by row so
 * the wall tapers without steps; the head on top; every piece on the base's axis; the joins
 * cross-faded over ov rows.
 */
function stackTower(img: HTMLCanvasElement, sp: StackSpec): HTMLCanvasElement {
  const W = img.width;
  const H = img.height;
  const OV = sp.ov;
  const d = pixelsOf(img).data;
  const ea = rowExtent(d, W, sp.top);
  const eb = rowExtent(d, W, sp.bot - 1);
  const uh = sp.bot - sp.top;
  const s = sp.shrink;
  const wall = (r: number) => ea.w + ((eb.w - ea.w) * (r - sp.top)) / (uh - 1);
  const cen = (r: number) => ea.c + ((eb.c - ea.c) * (r - sp.top)) / (uh - 1);
  const want = (r: number) => eb.w * (s + ((1 - s) * (r - sp.top)) / (uh - 1));
  const U = mk(W, uh + OV);
  const gu = ctx(U);
  for (let i = 0; i < uh + OV; i++) {
    const r = sp.top - OV + i;
    const f = want(r) / wall(r);
    gu.globalAlpha = i < OV ? (i + 1) / (OV + 1) : 1;
    gu.drawImage(img, 0, r, W, 1, W / 2 - cen(r) * f, i, W * f, 1);
  }
  const sc: number[] = [];
  for (let k = 0; k < sp.n; k++) sc.push(s ** k);
  const hs = (eb.w * s ** sp.n) / ea.w;
  const cHead = rowExtent(d, W, sp.top - 1).c;
  const base = H - sp.bot;
  const total = base + sc.reduce((a, k) => a + k * uh, 0) + hs * sp.top;
  const out = mk(W, Math.ceil(total) + 2);
  const g = ctx(out);
  const ax = rowExtent(d, W, sp.bot).c;
  const pos: { y: number; k: number }[] = [];
  let y = out.height - base;
  for (const k of sc) {
    y -= uh * k;
    pos.push({ y, k });
  }
  const yHead = y - hs * sp.top;
  g.drawImage(img, 0, 0, W, sp.top, ax - cHead * hs, yHead, W * hs, hs * sp.top);
  for (let i = pos.length - 1; i >= 0; i--) {
    const p = pos[i] as { y: number; k: number };
    g.drawImage(U, 0, 0, W, uh + OV, ax - (W / 2) * p.k, p.y - OV * p.k, W * p.k, (uh + OV) * p.k);
  }
  g.drawImage(img, 0, sp.bot - OV, W, base + OV, 0, out.height - base - OV, W, base + OV);
  return out;
}

// ---------- Clouds (page.js drawPuffs) ----------

interface Puff {
  x: number;
  y: number;
  r: number;
}

/** Puffs with one ink outline round them all, a blue-grey body and white tops (local coordinates). */
function drawPuffs(g: CanvasRenderingContext2D, puffs: readonly Puff[], spec: PuffStyle): void {
  const t = spec.line;
  const W = g.canvas.width;
  const H = g.canvas.height;
  g.save();
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineWidth = t * 2;
  g.lineJoin = 'round';
  for (const p of puffs) {
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.stroke();
    g.fill();
  }
  g.fillStyle = spec.under;
  for (const p of puffs) {
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
  }
  const top = mk(W, H);
  const gt = ctx(top);
  gt.fillStyle = spec.top;
  for (const p of puffs) {
    gt.beginPath();
    gt.arc(p.x - p.r * 0.06, p.y - p.r * 0.2, p.r * 0.86, 0, Math.PI * 2);
    gt.fill();
  }
  const ln = mk(W, H);
  const gl = ctx(ln);
  gl.strokeStyle = INK;
  gl.lineWidth = Math.max(2, t * 0.55);
  for (const p of puffs) {
    gl.beginPath();
    gl.arc(p.x - p.r * 0.06, p.y - p.r * 0.2, p.r * 0.86, Math.PI * 0.15, Math.PI * 0.85);
    gl.stroke();
  }
  gl.globalCompositeOperation = 'destination-out';
  gl.drawImage(top, 0, 0);
  const mask = mk(W, H);
  const gm = ctx(mask);
  gm.fillStyle = '#000';
  for (const p of puffs) {
    gm.beginPath();
    gm.arc(p.x, p.y, p.r - 1, 0, Math.PI * 2);
    gm.fill();
  }
  const both = mk(W, H);
  const gb = ctx(both);
  gb.drawImage(top, 0, 0);
  gb.drawImage(ln, 0, 0);
  gb.globalCompositeOperation = 'destination-in';
  gb.drawImage(mask, 0, 0);
  g.drawImage(both, 0, 0);
  g.restore();
}

/** A row of puffs across the map (the horizon), seeded as the composer's. */
function puffRow(spec: { y: number; r: number; step: number; jit: number; seed: number }, W: number): Puff[] {
  const R = seeded(spec.seed);
  const out: Puff[] = [];
  for (let x = -40; x < W + 60; x += spec.step * (0.75 + R() * 0.5)) out.push({ x, y: spec.y + (R() - 0.5) * spec.jit, r: spec.r * (0.7 + R() * 0.55) });
  return out;
}

/** The rings of cloud where each tower goes into the band, seeded as the composer's. */
function ringPuffs(): Puff[] {
  const R = seeded(TOWN_LAYOUT.clouds.style.seed ?? 3);
  const out: Puff[] = [];
  for (const t of TOWN_LAYOUT.clouds.rings) {
    for (let k = 0; k < t.n; k++) {
      const u = k / (t.n - 1) - 0.5;
      out.push({
        x: t.x + u * t.w + (R() - 0.5) * 16,
        y: t.y + Math.abs(u) * t.r * 0.5 + (R() - 0.5) * 14,
        r: t.r * (0.62 + R() * 0.3) * (1 - Math.abs(u) * 0.5),
      });
    }
  }
  return out;
}

interface Layer {
  readonly canvas: HTMLCanvasElement;
  /** Map px of its top-left, and map px per canvas px. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Puffs drawn at map resolution on a canvas just big enough for them. */
function puffLayer(puffs: readonly Puff[], style: PuffStyle, mapW: number): Layer {
  const m = style.line + 3;
  const x0 = Math.max(0, Math.floor(Math.min(...puffs.map((p) => p.x - p.r)) - m));
  const x1 = Math.min(mapW, Math.ceil(Math.max(...puffs.map((p) => p.x + p.r)) + m));
  const y0 = Math.floor(Math.min(...puffs.map((p) => p.y - p.r)) - m);
  const y1 = Math.ceil(Math.max(...puffs.map((p) => p.y + p.r)) + m);
  const c = mk(x1 - x0, y1 - y0);
  drawPuffs(
    ctx(c),
    puffs.map((p) => ({ x: p.x - x0, y: p.y - y0, r: p.r })),
    style,
  );
  return { canvas: c, x: x0, y: y0, scale: 1 };
}

/** The widest picture a GPU must take (old phones stop at 2048 px): a wider layer is cut into strips. */
const MAX_SIDE = 2048;

function strips(l: Layer): Layer[] {
  const n = Math.ceil(l.canvas.width / MAX_SIDE);
  if (n <= 1) return [l];
  const out: Layer[] = [];
  const w = Math.ceil(l.canvas.width / n);
  for (let i = 0; i < n; i++) {
    const x = i * w;
    const sw = Math.min(w, l.canvas.width - x);
    const c = mk(sw, l.canvas.height);
    ctx(c).drawImage(l.canvas, -x, 0);
    out.push({ canvas: c, x: l.x + x * l.scale, y: l.y, scale: l.scale });
  }
  return out;
}

// ---------- The ground: sky, ground, paths, shadows ----------

/** The composer's dirt paths, drawn on the ground canvas (`toCanvas` maps map px to its px). */
function drawPaths(base: HTMLCanvasElement, toCanvas: (g: CanvasRenderingContext2D) => void): void {
  const { list, style } = TOWN_LAYOUT.paths;
  if (list.length === 0) return;
  const W = base.width;
  const H = base.height;
  const g = ctx(base);
  const d = g.getImageData(0, 0, W, H).data;
  // Ink only over grass, so a path opens the road's outline where it meets it.
  const grass = new ImageData(W, H);
  const gd = grass.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const gg = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    if (gg > r + 6 && gg > b + 6) gd[i + 3] = 255;
  }
  const gm = mk(W, H);
  ctx(gm).putImageData(grass, 0, 0);
  const trace = (gg: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]) => {
    gg.beginPath();
    const p0 = pts[0] as readonly [number, number];
    gg.moveTo(p0[0], p0[1]);
    if (pts.length === 2) {
      const p1 = pts[1] as readonly [number, number];
      gg.lineTo(p1[0], p1[1]);
    } else {
      for (let k = 1; k < pts.length - 1; k++) {
        const a = pts[k] as readonly [number, number];
        const b = pts[k + 1] as readonly [number, number];
        const last = k === pts.length - 2;
        gg.quadraticCurveTo(a[0], a[1], last ? b[0] : (a[0] + b[0]) / 2, last ? b[1] : (a[1] + b[1]) / 2);
      }
    }
  };
  const ink = mk(W, H);
  const gi = ctx(ink);
  gi.save();
  toCanvas(gi);
  gi.lineCap = 'round';
  gi.lineJoin = 'round';
  gi.strokeStyle = style.ink;
  for (const p of list) {
    gi.lineWidth = p.w + style.line * 2;
    trace(gi, p.pts);
    gi.stroke();
  }
  gi.restore();
  gi.globalCompositeOperation = 'destination-in';
  gi.drawImage(gm, 0, 0);
  g.drawImage(ink, 0, 0);
  g.save();
  toCanvas(g);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = style.fill;
  for (const p of list) {
    g.lineWidth = p.w;
    trace(g, p.pts);
    g.stroke();
  }
  const R = seeded(style.seed);
  g.fillStyle = style.dot;
  for (const p of list) {
    for (let k = 0; k < (p.dots ?? 2); k++) {
      const a = p.pts[0] as readonly [number, number];
      const b = p.pts[p.pts.length - 1] as readonly [number, number];
      const t = 0.3 + R() * 0.4;
      g.beginPath();
      g.ellipse(a[0] + (b[0] - a[0]) * t + (R() - 0.5) * p.w * 0.4, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * p.w * 0.3, 7, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// ---------- Everything ----------

/** Stack spec in a processed picture's rows (layout.json 'towers.stack' is in source rows). */
function stackIn(key: string, m: PicMeta): StackSpec | undefined {
  const s = TOWN_LAYOUT.towers.stack[key];
  if (s === undefined) return undefined;
  const row = (r: number) => Math.round((r - m.trim.y) * m.scale);
  return { top: row(s.top), bot: row(s.bot), n: s.n, shrink: s.shrink, ov: Math.max(3, Math.round(10 * m.scale)) };
}

/** The bake: every picture to write (by file name, without .webp) and the manifest saying where each goes (its `sources` filled in by bake.ts). */
export interface BakeResult {
  readonly canvases: ReadonlyMap<string, HTMLCanvasElement>;
  readonly manifest: Omit<BakedManifest, 'sources'>;
  readonly ms: Readonly<Record<string, number>>;
}

export async function bakeMap(): Promise<BakeResult> {
  const ms: Record<string, number> = {};
  let t0 = performance.now();
  const L = TOWN_LAYOUT;
  const W = L.map.width;
  const canvases = new Map<string, HTMLCanvasElement>();
  const pic = (name: string, b: Baked): BakedPic => {
    canvases.set(name, b.canvas);
    return { file: name, w: b.canvas.width, h: b.canvas.height, ax: b.ax, ay: b.ay, scale: b.scale, foot: b.foot };
  };
  const layer = (name: string, l: Layer): BakedLayer => {
    canvases.set(name, l.canvas);
    return { file: name, x: l.x, y: l.y, w: l.canvas.width, h: l.canvas.height, scale: l.scale };
  };

  // ---- Sources ----
  const keys = [...new Set(MAP_ITEMS.map((it) => it.key))];
  const heroes = heroKeys();
  const imgs = new Map<string, HTMLImageElement>();
  const want: { id: string; url: string | null }[] = [
    ...keys.map((k) => ({ id: k, url: k === 'dwarf' ? sourceUrl('scene', 'dwarf_idle') : sourceUrl('town', k) })),
    { id: '#ground', url: sourceUrl('town', L.map.ground) },
    { id: '#band', url: sourceUrl('town', L.clouds.band.key) },
    ...heroes.map((k) => ({ id: `#hero:${k}`, url: sourceUrl('heroes', k) })),
  ];
  const missing: string[] = [];
  await Promise.all(
    want.map(async (w) => {
      if (w.url === null) {
        missing.push(w.id);
        return;
      }
      imgs.set(w.id, await loadImage(w.url));
    }),
  );
  if (missing.length > 0) throw new Error(`no processed picture for: ${missing.join(', ')}`);
  ms.load = performance.now() - t0;

  // ---- Each picture ----
  t0 = performance.now();
  const pictures: Record<string, BakedPic> = {};
  const sprites = new Map<string, Baked>();
  const cuts = new Map<string, { cut: Cut; s: number; at: { x: number; y: number } }>();
  for (const key of keys) {
    const img = imgs.get(key) as HTMLImageElement;
    const first = MAP_ITEMS.find((it) => it.key === key) as LayoutItem;
    const isDwarf = key === 'dwarf';
    const m = picMeta(isDwarf ? 'scene' : 'town', isDwarf ? 'dwarf_idle' : key);
    if (m === null) throw new Error(`meta.json has no entry for ${key}`);
    // Small props and the dwarf get the composer's outer ink (source px → map px).
    const lineSrc = isDwarf ? L.outlines.people.dwarfLine : (L.outlines.props[key] ?? 0);
    const c = cut(img, {
      shadow: first.kind !== 'person',
      minArea: 400 * m.scale * m.scale,
      stack: key.startsWith('tower_') ? stackIn(key, m) : undefined,
    });
    const s = first.scale / m.scale;
    // The towers run up past the map's top into the clouds: what lands above TOWER_TOP_CUT is never seen.
    const towerFeet = key.startsWith('tower_') ? Math.max(...MAP_ITEMS.filter((it) => it.key === key).map((it) => it.y)) : null;
    const placed = toMap(c, s, {
      line: lineSrc * first.scale,
      tree: key.includes('tree'),
      ...(towerFeet !== null ? { cropAbove: TOWER_TOP_CUT - towerFeet } : {}),
    });
    sprites.set(key, placed.sprite);
    cuts.set(key, { cut: c, s, at: placed.cutAnchor });
    pictures[key] = pic(key, placed.sprite);
  }
  ms.pictures = performance.now() - t0;

  // ---- The guests: every hero at one scale, so they keep their heights next to each other ----
  t0 = performance.now();
  const heroPics: Record<string, BakedPic> = {};
  const metas = heroes.map((k) => picMeta('heroes', k));
  const heights = metas.map((m) => m?.trim.h ?? 0).filter((h) => h > 0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? 1000;
  const perSource = GUESTS.height / median;
  const lineMap = L.outlines.people.line * L.outlines.people.scale;
  heroes.forEach((k, i) => {
    const img = imgs.get(`#hero:${k}`) as HTMLImageElement;
    const m = metas[i];
    if (m === null || m === undefined) throw new Error(`meta.json has no entry for heroes/${k}`);
    const s = perSource / m.scale;
    heroPics[k] = pic(k, toMap(cut(img, { shadow: false, minArea: 0 }), s, { line: lineMap }).sprite);
  });
  ms.heroes = performance.now() - t0;

  // ---- The ground canvas ----
  t0 = performance.now();
  const groundImg = imgs.get('#ground') as HTMLImageElement;
  const gs = L.map.groundScale;
  const k = 1 / gs;
  const gw = groundImg.width;
  const gh = groundImg.height;
  const skyRows = Math.ceil(L.map.groundY * k);
  // Its row 0 is this map y (so the ground picture lands on whole px, unresampled).
  const y0 = L.map.groundY - skyRows / k;
  const base = mk(gw, skyRows + gh);
  const gb = ctx(base);
  gb.fillStyle = L.map.skyColor;
  gb.fillRect(0, 0, base.width, skyRows + Math.ceil(4 * k));
  {
    const gc = mk(gw, gh);
    const gg = ctx(gc);
    gg.drawImage(groundImg, 0, 0);
    const thin = L.map.thin?.r ?? 0;
    if (thin > 0) {
      const id = gg.getImageData(0, 0, gw, gh);
      thinInk(id.data, gw, gh, thin * k);
      gg.putImageData(id, 0, 0);
    }
    gb.drawImage(gc, 0, skyRows);
  }
  ms.ground = performance.now() - t0;
  t0 = performance.now();
  const toBase = (g: CanvasRenderingContext2D) => g.setTransform(k, 0, 0, k, 0, -y0 * k);
  drawPaths(base, toBase);
  ms.paths = performance.now() - t0;

  // One shadow layer: every ground ellipse and lifted shadow, one colour, multiplied once.
  t0 = performance.now();
  const sh = mk(base.width, base.height);
  const gsh = ctx(sh);
  toBase(gsh);
  gsh.fillStyle = '#000';
  for (const it of MAP_ITEMS) {
    const sp = sprites.get(it.key);
    const c = cuts.get(it.key);
    if (sp === undefined || c === undefined) continue;
    if (it.spots !== undefined) {
      for (const p of it.spots) {
        gsh.beginPath();
        gsh.ellipse(it.x + p.dx, it.y + p.dy, p.rx, p.ry, 0, 0, Math.PI * 2);
        gsh.fill();
      }
      continue;
    }
    const e = groundEllipse(sp.foot, it.flip, it.ell ?? 1);
    gsh.beginPath();
    gsh.ellipse(it.x + e.x, it.y + e.y, e.rx, e.ry, 0, 0, Math.PI * 2);
    gsh.fill();
    if (c.cut.shadow !== null && !it.flip) {
      gsh.save();
      gsh.translate(it.x, it.y);
      gsh.drawImage(c.cut.shadow, -c.at.x * c.s, -c.at.y * c.s, c.cut.shadow.width * c.s, c.cut.shadow.height * c.s);
      gsh.restore();
    }
  }
  gsh.setTransform(1, 0, 0, 1, 0, 0);
  gsh.globalCompositeOperation = 'source-in';
  gsh.fillStyle = L.shadow.color;
  gsh.fillRect(0, 0, sh.width, sh.height);
  gb.save();
  gb.globalCompositeOperation = 'multiply';
  gb.drawImage(sh, 0, 0);
  gb.restore();
  ms.shadows = performance.now() - t0;
  const ground = layer('ground', { canvas: base, x: 0, y: y0, scale: gs });

  // ---- Clouds ----
  t0 = performance.now();
  const horizon = strips(puffLayer(puffRow(L.clouds.horizon, W), L.clouds.style, W)).map((l, i) => layer(`horizon_${i}`, l));
  const rings = L.clouds.rings.length > 0 ? strips(puffLayer(ringPuffs(), L.clouds.style, W)).map((l, i) => layer(`rings_${i}`, l)) : [];
  let band: BakedManifest['band'] = null;
  const bandImg = imgs.get('#band') as HTMLImageElement;
  const bm = picMeta('town', L.clouds.band.key);
  if (bm !== null) {
    // Source rows [0, srcH) are the band's h map px; the processed picture keeps the rows it trimmed to.
    const perSrc = L.clouds.band.h / L.clouds.band.srcH;
    const s = perSrc / bm.scale;
    const c0 = mk(bandImg.width, bandImg.height);
    ctx(c0).drawImage(bandImg, 0, 0);
    const r = resample(c0, s);
    canvases.set('band', r.c);
    band = { file: 'band', w: bm.trim.w * perSrc, h: bandImg.height * s, x0: L.clouds.band.x0 + bm.trim.x * perSrc, y: L.clouds.band.y + bm.trim.y * perSrc };
  }
  ms.clouds = performance.now() - t0;

  return { canvases, manifest: { version: 1, guestHeight: GUESTS.height, ground, horizon, rings, band, pictures, heroes: heroPics }, ms };
}
