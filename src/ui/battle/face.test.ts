import { describe, expect, it } from 'vitest';
import { DEFAULT_FACE, FACE, findFace, isSkin } from './face.ts';

type Paint = readonly [number, number, number] | null;
const SKIN = [248, 216, 184] as const;
const HAIR = [120, 80, 50] as const;
const STEEL = [150, 150, 160] as const;
const CLOTH = [90, 120, 80] as const;

/** A w × h RGBA picture: each pixel the colour `paint` gives it, or clear. */
function picture(w: number, h: number, paint: (x: number, y: number) => Paint): Uint8Array {
  const a = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y);
      if (c === null) continue;
      a.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return a;
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

describe('finding the face in a hero picture (findFace)', () => {
  it('knows the doodles\' peach skin from hair, steel and cloth', () => {
    expect(isSkin(...SKIN)).toBe(true);
    expect(isSkin(...HAIR)).toBe(false);
    expect(isSkin(...STEEL)).toBe(false);
    expect(isSkin(250, 250, 250)).toBe(false);
    expect(isSkin(250, 220, 140)).toBe(false);
  });

  it('cuts round the biggest peach patch: the face, not a hand, off to one side under a pack', () => {
    const w = 80;
    const h = 100;
    const pic = picture(w, h, (x, y) => {
      if (disc(30, 26, 12)(x, y) && y > 20) return SKIN; // the face under the hair
      if (disc(30, 24, 16)(x, y)) return HAIR;
      if (rect(52, 10, 78, 50)(x, y)) return CLOTH; // a pack beside the head
      if (disc(8, 44, 4)(x, y)) return SKIN; // a hand
      if (rect(16, 40, 50, 100)(x, y)) return CLOTH;
      return null;
    });
    const f = findFace(pic, w, h);
    expect(f.cx * w).toBeGreaterThan(26);
    expect(f.cx * w).toBeLessThan(34);
    expect(f.size).toBeGreaterThanOrEqual(FACE.min);
    expect(f.size).toBeLessThanOrEqual(FACE.max);
    // The face (rows 20..38) is inside the cut.
    expect(f.top * h).toBeLessThanOrEqual(20);
    expect((f.top + f.size) * h).toBeGreaterThanOrEqual(38);
  });

  it('without skin to see (a helmet), finds the head by its shape: not fooled by a staff over it', () => {
    const w = 80;
    const h = 100;
    const pic = picture(w, h, (x, y) => {
      if (rect(6, 0, 9, 100)(x, y)) return HAIR; // a thin staff reaching the top
      if (disc(55, 24, 16)(x, y)) return STEEL;
      if (rect(0, 60, 40, 66)(x, y)) return STEEL; // a blade low on the left
      if (rect(44, 40, 66, 100)(x, y)) return CLOTH;
      return null;
    });
    const f = findFace(pic, w, h);
    expect(f.cx * w).toBeGreaterThan(50);
    expect(f.cx * w).toBeLessThan(60);
    // The head's own top, not the staff's.
    expect(f.top * h).toBeGreaterThan(4);
  });

  it('gives the plain cut for an empty picture', () => {
    expect(findFace(new Uint8Array(400), 10, 10)).toEqual(DEFAULT_FACE);
    expect(findFace([], 0, 0)).toEqual(DEFAULT_FACE);
  });
});
