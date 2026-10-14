// 전투 카드의 얼굴 (기획서 14장 화풍): each hero card in the battle shows the hero's face, cut from the
// whole-body picture (src/assets/art/heroes). The pictures differ — a sword over the shoulder, a staff
// above the head, a pack beside it, smoke over the hair — so the face is found in the picture itself:
// the doodles all paint skin the same peach, so the biggest peach patch in the upper part is the
// face. A face hidden under a helmet or painted paler falls back on the head's shape: in the top
// band, the widest run of columns that are mostly drawn (a staff or a blade is a thin run). The
// finding is pure (findFace, tested); the picture is read once per hero in the browser (loadFace).

/** How a face is cut from a picture [튜닝: 연출]: shares of the picture's height unless said. */
export const FACE = {
  /** The upper part searched for the face's peach. */
  skinBand: 0.6,
  /** The peach patch counts as the face from this share of the picture's area. */
  skinMin: 0.012,
  /** The cut's height: the face's width × this (the hair and a bit of the shoulders round it). */
  skinZoom: 1.5,
  /** The face's middle sits this far down the cut. */
  faceAt: 0.56,
  /** The shape fallback: the top band searched for the head. */
  band: 0.42,
  /** A column counts when this share of the band's tallest column is drawn. */
  core: 0.45,
  /** Columns this far apart (px of the grid) still count as one run (an ear, a gap in the hair). */
  joinPx: 2,
  /** The shape fallback's cut: the head's width × this. */
  zoom: 1.05,
  /** Room left over the top of the head (the shape fallback). */
  headroom: 0.02,
  /** Every cut's height stays between these. */
  min: 0.36,
  max: 0.62,
  /** Alpha that counts as drawn (0..255). */
  alpha: 96,
} as const;

export interface FaceCut {
  /** The face's middle, a share of the picture's width (as drawn, not mirrored). */
  cx: number;
  /** The cut's top, a share of the picture's height. */
  top: number;
  /** The cut's height, a share of the picture's height (its width follows the card). */
  size: number;
}

/** Until a picture is read (or when it cannot be): the top middle. */
export const DEFAULT_FACE: FaceCut = { cx: 0.5, top: 0, size: 0.5 };

/** The doodles' skin: a light peach (the art's flat fill, tools/art/assets.ts STYLE). */
export function isSkin(r: number, g: number, b: number): boolean {
  return r >= 232 && g >= 196 && g <= 232 && b >= 160 && b <= 208 && r - b >= 34 && g - b >= 16;
}

const clampSize = (s: number) => Math.min(FACE.max, Math.max(FACE.min, s));

/** Where the face is in a picture (w × h, RGBA, rows from the top). */
export function findFace(rgba: ArrayLike<number>, w: number, h: number): FaceCut {
  if (w <= 0 || h <= 0) return DEFAULT_FACE;
  const alphaAt = (x: number, y: number) => rgba[(y * w + x) * 4 + 3] ?? 0;
  let y0 = -1;
  for (let y = 0; y < h && y0 < 0; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaAt(x, y) >= FACE.alpha) {
        y0 = y;
        break;
      }
    }
  }
  if (y0 < 0) return DEFAULT_FACE;
  return skinFace(rgba, w, h, y0) ?? shapeFace(alphaAt, w, h, y0);
}

/** The biggest patch of skin in the upper part (4-connected), or null when there is none big enough. */
function skinFace(rgba: ArrayLike<number>, w: number, h: number, y0: number): FaceCut | null {
  const y1 = Math.min(h, y0 + Math.round(FACE.skinBand * h));
  const skin = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((rgba[i + 3] ?? 0) >= FACE.alpha && isSkin(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0)) skin[y * w + x] = 1;
    }
  }
  let best: { n: number; x0: number; x1: number; y0: number; y1: number } | null = null;
  const stack: number[] = [];
  for (let start = 0; start < skin.length; start++) {
    if (skin[start] !== 1) continue;
    skin[start] = 2;
    stack.push(start);
    const box = { n: 0, x0: w, x1: -1, y0: h, y1: -1 };
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const x = p % w;
      const y = (p - x) / w;
      box.n += 1;
      box.x0 = Math.min(box.x0, x);
      box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y);
      box.y1 = Math.max(box.y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < skin.length && skin[q] === 1) {
          skin[q] = 2;
          stack.push(q);
        }
      }
    }
    if (best === null || box.n > best.n) best = box;
  }
  if (best === null || best.n < FACE.skinMin * w * h) return null;
  const size = clampSize(((best.x1 - best.x0 + 1) / h) * FACE.skinZoom);
  const cy = (best.y0 + best.y1 + 1) / 2 / h;
  return {
    cx: (best.x0 + best.x1 + 1) / 2 / w,
    top: Math.min(1 - size, Math.max(0, cy - size * FACE.faceAt)),
    size,
  };
}

/** The head by its shape: the widest run of mostly drawn columns in the top band. */
function shapeFace(alphaAt: (x: number, y: number) => number, w: number, h: number, y0: number): FaceCut {
  const y1 = Math.min(h, y0 + Math.max(1, Math.round(FACE.band * h)));
  const cols: number[] = [];
  const firstY: number[] = [];
  for (let x = 0; x < w; x++) {
    let n = 0;
    let first = -1;
    for (let y = y0; y < y1; y++) {
      if (alphaAt(x, y) >= FACE.alpha) {
        n += 1;
        if (first < 0) first = y;
      }
    }
    cols.push(n);
    firstY.push(first);
  }
  const floor = Math.max(...cols) * FACE.core;
  // (Typed by a cast: `close` sets it, and a plain null would stay narrowed to null after the calls.)
  let best = null as [number, number] | null;
  let start = -1;
  let last = -1;
  const close = () => {
    if (start >= 0 && (best === null || last - start > best[1] - best[0])) best = [start, last];
  };
  for (let x = 0; x < w; x++) {
    if ((cols[x] ?? 0) < floor) continue;
    if (start < 0 || x - last > FACE.joinPx + 1) {
      close();
      start = x;
    }
    last = x;
  }
  close();
  if (best === null) return DEFAULT_FACE;
  const [a, b] = best;
  // The head's top: the middle of where its columns begin (smoke or a staff over it does not count).
  const tops = firstY.slice(a, b + 1).filter((y) => y >= 0).sort((p, q) => p - q);
  const top = tops[Math.floor(tops.length / 2)] ?? y0;
  return {
    cx: (a + b + 1) / 2 / w,
    top: Math.max(0, top / h - FACE.headroom),
    size: clampSize(((b - a + 1) / h) * FACE.zoom),
  };
}

const found = new Map<string, Promise<FaceCut>>();

/** A picture's face, read once (a small copy of it is enough). */
export function loadFace(url: string): Promise<FaceCut> {
  let p = found.get(url);
  if (p === undefined) {
    p = new Promise<FaceCut>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const h = 96;
          const w = Math.max(1, Math.round((img.naturalWidth / Math.max(1, img.naturalHeight)) * h));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const g = c.getContext('2d', { willReadFrequently: true });
          if (g === null) return resolve(DEFAULT_FACE);
          g.drawImage(img, 0, 0, w, h);
          resolve(findFace(g.getImageData(0, 0, w, h).data, w, h));
        } catch {
          resolve(DEFAULT_FACE);
        }
      };
      img.onerror = () => resolve(DEFAULT_FACE);
      img.src = url;
    });
    found.set(url, p);
  }
  return p;
}
