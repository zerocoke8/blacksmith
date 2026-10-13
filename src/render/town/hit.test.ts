import { describe, expect, it } from 'vitest';
import { type AlphaMask, alphaAt, type HitTarget, hitsAt, hitTest } from './hit.ts';

/** A w×h mask with alpha 255 inside the given cells (x, y ranges inclusive), 0 elsewhere. */
function mask(w: number, h: number, solid: (x: number, y: number) => boolean, at: Partial<AlphaMask> = {}): AlphaMask {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = solid(x, y) ? 255 : 0;
  return { w, h, data, x: 0, y: 0, scale: 1, flip: false, ...at };
}

const box = (m: AlphaMask) => ({ x: m.x, y: m.y, w: m.w * m.scale, h: m.h * m.scale });

describe('alpha under a map point', () => {
  it('reads the mask through its place and scale', () => {
    const m = mask(10, 10, (x) => x < 5, { x: 100, y: 200, scale: 2 });
    expect(alphaAt(m, 101, 201)).toBe(255);
    expect(alphaAt(m, 109, 201)).toBe(255); // x 4.5 → cell 4
    expect(alphaAt(m, 111, 201)).toBe(0); // cell 5
    expect(alphaAt(m, 99, 201)).toBe(0); // outside
    expect(alphaAt(m, 101, 221)).toBe(0); // below
  });

  it('reads a mirrored picture mirrored', () => {
    const m = mask(10, 4, (x) => x < 3, { x: 0, y: 0, flip: true });
    // The solid left columns of the texture are drawn on the right.
    expect(alphaAt(m, 9.5, 1)).toBe(255);
    expect(alphaAt(m, 0.5, 1)).toBe(0);
  });
});

describe('hit test (9.1: tap a building)', () => {
  // A house with a roof (solid in its top-left) and a tree drawn in front, overlapping it.
  const house = mask(100, 100, (x, y) => (x < 60 && y < 60) || (y >= 60 && x >= 20 && x < 80), { x: 0, y: 0 });
  const tree = mask(40, 40, (x, y) => (x - 20) ** 2 + (y - 20) ** 2 < 18 ** 2, { x: 50, y: 50 });
  const targets: HitTarget<string>[] = [
    { id: 'house', z: 100, rect: box(house), mask: house },
    { id: 'tree', z: 90 + 50, rect: box(tree), mask: tree },
  ];

  it('finds the picture under the finger', () => {
    expect(hitTest(targets, 10, 10, 0)?.id).toBe('house');
    expect(hitTest(targets, 70, 70, 0)?.id).toBe('tree');
  });

  it('a tap on the transparent part of a box is nobody’s', () => {
    expect(hitsAt(targets[0] as HitTarget<string>, 90, 20)).toBe(false);
    expect(hitTest(targets, 90, 20, 0)).toBeNull();
  });

  it('the one drawn in front wins where they overlap', () => {
    expect(hitTest(targets, 60, 70, 0)?.id).toBe('tree');
  });

  it('a fat finger just off a picture still counts, but a direct hit wins', () => {
    // 5 px right of the roof's edge (x 60), nothing under the point itself.
    expect(hitTest(targets, 64, 20, 0)).toBeNull();
    expect(hitTest(targets, 64, 20, 8)?.id).toBe('house');
    // On the house (directly) but within reach of the tree's edge: the house.
    expect(hitTest(targets, 40, 75, 8)?.id).toBe('house');
  });

  it('without a mask the box counts', () => {
    const t: HitTarget<string>[] = [{ id: 'plain', z: 1, rect: { x: 0, y: 0, w: 10, h: 10 } }];
    expect(hitTest(t, 5, 5, 0)?.id).toBe('plain');
    expect(hitTest(t, 15, 5, 0)).toBeNull();
  });
});
