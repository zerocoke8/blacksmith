import { describe, expect, it } from 'vitest';
import { alphaBox, bodyOf, MARK, rowExtent, seeded, shadowMarks, splitByMarks, thinInk } from './pixels.ts';

/** RGBA canvas stand-in. */
function picture(w: number, h: number, paint: (x: number, y: number) => readonly [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const o = (y * w + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = a;
    }
  }
  return d;
}

const INK = [52, 35, 26, 255] as const;
const CLEAR = [0, 0, 0, 0] as const;
const GREY = [150, 152, 148, 255] as const; // a baked flat shadow
const ORANGE = [240, 150, 60, 255] as const; // a light, coloured part of the picture

/**
 * 60×40: a box (ink outline, orange inside) on the left, a grey shadow blob touching the outside
 * on the right, a small orange patch that touches the outside too.
 */
function scene(): Uint8ClampedArray {
  return picture(60, 40, (x, y) => {
    const inBox = x >= 4 && x < 26 && y >= 4 && y < 30;
    if (inBox) return x === 4 || x === 25 || y === 4 || y === 29 ? INK : ORANGE;
    if (x >= 26 && x < 50 && y >= 20 && y < 36) return GREY;
    if (x >= 52 && x < 58 && y >= 2 && y < 8) return ORANGE;
    return CLEAR;
  });
}

describe('lifting the baked shadow (the composer’s analyze)', () => {
  it('marks the grey patch reached from outside, not the picture inside its ink', () => {
    const d = scene();
    const m = shadowMarks(d, 60, 40, 50);
    expect(m[25 * 60 + 30]).toBe(MARK.shadow);
    expect(m[10 * 60 + 10]).toBe(MARK.body); // inside the outline
    expect(m[4 * 60 + 4]).toBe(MARK.body); // the ink line
    expect(m[0]).toBe(MARK.clear);
  });

  it('keeps a light patch that is coloured, and one too small to be a shadow', () => {
    const d = scene();
    const m = shadowMarks(d, 60, 40, 50);
    expect(m[4 * 60 + 54]).toBe(MARK.body); // orange: saturated, so not a shadow
    // The same grey patch, but the threshold says it is too small.
    const m2 = shadowMarks(d, 60, 40, 24 * 16 + 1);
    expect(m2[25 * 60 + 30]).toBe(MARK.body);
  });

  it('splits the picture from its shadow', () => {
    const d = scene();
    const { sprite, shadow } = splitByMarks(d, shadowMarks(d, 60, 40, 50));
    expect(shadow).not.toBeNull();
    const at = (a: Uint8ClampedArray, x: number, y: number) => a[(y * 60 + x) * 4 + 3];
    expect(at(sprite, 30, 25)).toBe(0);
    expect(at(shadow as Uint8ClampedArray, 30, 25)).toBe(255);
    expect(at(sprite, 10, 10)).toBe(255);
    expect(at(shadow as Uint8ClampedArray, 10, 10)).toBe(0);
  });

  it('a picture without a shadow comes back whole', () => {
    const d = picture(10, 10, (x, y) => (x > 2 && x < 7 && y > 2 && y < 7 ? INK : CLEAR));
    const { sprite, shadow } = splitByMarks(d, shadowMarks(d, 10, 10, 4));
    expect(shadow).toBeNull();
    expect(Array.from(sprite)).toEqual(Array.from(d));
  });
});

describe('measuring a picture', () => {
  it('finds the body box, its middle and its foot', () => {
    // A T shape: a wide bar on top, a narrow stem below.
    const d = picture(20, 20, (x, y) => ((y >= 2 && y < 6 && x >= 2 && x < 18) || (y >= 6 && y < 16 && x >= 8 && x < 12) ? INK : CLEAR));
    const b = bodyOf(d, 20, 20);
    expect(b?.box).toEqual({ x: 2, y: 2, w: 16, h: 14 });
    expect(b?.cx).toBe(9.5);
    expect(b?.gy).toBe(16);
    // The foot is the stem, not the bar.
    expect(b?.base).toEqual({ x: 9.5, w: 4 });
    expect(alphaBox(d, 20, 20, 8)).toEqual({ x: 2, y: 2, w: 16, h: 14 });
    expect(rowExtent(d, 20, 3)).toEqual({ c: 9.5, w: 16 });
    expect(bodyOf(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe('thinning the ground’s ink', () => {
  it('narrows a dark brown line on grass and leaves the grass alone', () => {
    const GRASS = [140, 180, 100, 255] as const;
    const d = picture(30, 10, (x) => (x >= 10 && x < 20 ? INK : GRASS));
    thinInk(d, 30, 10, 2);
    const isInk = (x: number) => (d[(5 * 30 + x) * 4] ?? 0) < 100;
    const width = Array.from({ length: 30 }, (_, x) => x).filter(isInk).length;
    expect(width).toBeLessThan(10);
    expect(width).toBeGreaterThanOrEqual(5);
    expect(d[(5 * 30 + 2) * 4 + 1]).toBe(180); // grass untouched
  });
});

describe('the composer’s seeded numbers', () => {
  it('repeat for a seed', () => {
    const a = seeded(4);
    const b = seeded(4);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
