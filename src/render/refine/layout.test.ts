import { describe, expect, it } from 'vitest';
import { REFINE_BATCH_MAX, REFINE_LUMPS } from '../../sim/data/refine.ts';
import { REFINE_ITEM_ART, REFINE_ART_KEYS } from './assets.ts';
import { DEFAULT_ASPECT, strikeReach } from '../forge/layout.ts';
import { amountFontPx, ITEM_SLOTS, PILE_STEPS, pileScale, pileTop, REFINE_STACK, refineLayout, stackOf } from './layout.ts';
import { REFINE_ITEM_IDS } from '../../sim/data/refine.ts';

/** Scene boxes on the three phones checked (the screen less its top band and the hammer row). */
const BOXES = [
  [390, 640],
  [360, 436],
  [412, 711],
] as const;

describe('refine layout', () => {
  it('has a spot on the floor for every blow of a batch, inside the box and below the anvil', () => {
    expect(ITEM_SLOTS.length).toBe(REFINE_BATCH_MAX);
    for (const [w, h] of BOXES) {
      const l = refineLayout(w, h);
      expect(l.slots.length).toBe(REFINE_BATCH_MAX);
      for (const s of l.slots) {
        expect(s.x - l.item / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + l.item / 2).toBeLessThanOrEqual(w);
        expect(s.y + l.item / 2).toBeLessThanOrEqual(h);
        expect(s.y).toBeGreaterThan(l.anvil.y + l.anvil.h * 0.6);
      }
      // Nearest the anvil first.
      const d = (i: number) => Math.hypot((l.slots[i]?.x ?? 0) - l.face.x, (l.slots[i]?.y ?? 0) - (l.anvil.y + l.anvil.h));
      expect(d(0)).toBeLessThan(d(REFINE_BATCH_MAX - 1));
    }
  });

  it('stands the dwarf on the floor so his strike lands on the lump', () => {
    for (const [w, h] of BOXES) {
      const l = refineLayout(w, h);
      expect(l.dwarf.y).toBeGreaterThan(l.floor);
      expect(l.dwarf.y).toBeLessThanOrEqual(h);
      expect(l.dwarf.x + strikeReach(l.dwarf.bodyH, DEFAULT_ASPECT.dwarf_strike) + l.lean).toBeCloseTo(l.hit.x, 6);
      expect(l.hit.y).toBeLessThan(l.face.y);
      expect(l.dwarf.x).toBeGreaterThan(0);
    }
  });

  it('leaves room between neighbours for the widest amount (×20 gold: 300G)', () => {
    // Jua's digits and G are about 0.62 em wide; the ink line adds 2 px on each side.
    const width = (label: string, px: number) => label.length * 0.62 * px + 4;
    for (const [w, h] of BOXES) {
      const l = refineLayout(w, h);
      const rows = new Map<number, number[]>();
      ITEM_SLOTS.forEach((s, i) => rows.set(s.dy, [...(rows.get(s.dy) ?? []), l.slots[i]?.x ?? 0]));
      for (const xs of rows.values()) {
        xs.sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThanOrEqual(width('300G', amountFontPx(l.item, '300G')));
          expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThanOrEqual(width('×20', amountFontPx(l.item, '×20')));
        }
      }
    }
  });

  it('heaps a find higher the bigger its multiplier', () => {
    expect(stackOf(1)).toBe(1);
    expect(stackOf(2)).toBe(1);
    expect(stackOf(5)).toBeGreaterThan(1);
    expect(stackOf(20)).toBe(REFINE_STACK.at(-1)?.n);
    for (let i = 1; i < REFINE_STACK.length; i++) expect(REFINE_STACK[i]?.n).toBeGreaterThan(REFINE_STACK[i - 1]?.n ?? 0);
  });

  it('grows the pile in steps up to the cap', () => {
    expect(pileScale(0)).toBe(0);
    expect(pileScale(1)).toBe(PILE_STEPS[0]?.scale);
    let last = 0;
    for (const s of PILE_STEPS) {
      expect(s.scale).toBeGreaterThan(last);
      last = s.scale;
    }
    expect(pileScale(REFINE_LUMPS.cap)).toBe(last);
    const l = refineLayout(390, 640);
    expect(pileTop(l, 720).y).toBeLessThan(pileTop(l, 10).y);
  });

  it('has an icon for every row of the result table', () => {
    for (const id of REFINE_ITEM_IDS) expect(REFINE_ART_KEYS).toContain(REFINE_ITEM_ART[id]);
  });
});
