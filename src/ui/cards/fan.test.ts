import { describe, expect, it } from 'vitest';
import { CARD_ASPECT, CARD_FACE, HAND_FAN } from '../../render/forge/layout.ts';
import { fanPlaces, handCardWidth, liftedWidth, shownWidths } from './fan.ts';

// Hand boxes of the art table (tableLayout.ts tableRows): 390×844, 360×640 and 412×915 phones.
const BOXES = [
  [390, 200],
  [360, 187],
  [412, 209],
] as const;

describe('the hand fan', () => {
  for (const [w, h] of BOXES) {
    for (const n of [3, 4, 5]) {
      it(`${w}px, ${n} cards: every card shows its cost and the start of its name`, () => {
        const cw = handCardWidth(w, h, n);
        const places = fanPlaces(n, w, h, cw, -1);
        const shown = shownWidths(places);
        // Up to n=5 the visible strip reaches past the name's start by a few letters.
        for (const s of shown.slice(0, -1)) expect(s / cw).toBeGreaterThanOrEqual(HAND_FAN.show - 0.02);
        expect(HAND_FAN.show - CARD_FACE.name.x).toBeGreaterThan(0.3);
        // The fan stays on screen.
        const first = places[0];
        const last = places[places.length - 1];
        expect(first?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((last?.x ?? 0) + (last?.w ?? 0)).toBeLessThanOrEqual(w);
        expect(cw).toBeGreaterThanOrEqual(HAND_FAN.minW);
      });
    }

    it(`${w}px: the lifted card is laid out big, inside the box's sides`, () => {
      const n = 5;
      const cw = handCardWidth(w, h, n);
      for (const sel of [0, 2, 4]) {
        const p = fanPlaces(n, w, h, cw, sel)[sel];
        expect(p?.w).toBe(liftedWidth(cw, w));
        expect(p?.w ?? 0).toBeGreaterThan(cw * 1.2);
        expect(p?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((p?.x ?? 0) + (p?.w ?? 0)).toBeLessThanOrEqual(w);
        expect(p?.rot).toBe(0);
      }
    });
  }

  it('small hands keep bigger cards than full ones', () => {
    expect(handCardWidth(390, 200, 3)).toBeGreaterThan(handCardWidth(390, 200, 5));
  });

  it('a short screen caps the lifted card (liftMaxH), upright and bottom-aligned as before', () => {
    const cw = handCardWidth(360, 187, 5);
    const free = fanPlaces(5, 360, 187, cw, 2)[2];
    const capped = fanPlaces(5, 360, 187, cw, 2, 240)[2];
    expect(capped?.h ?? 0).toBeLessThanOrEqual(240 + 1e-6);
    expect(capped?.h ?? 0).toBeLessThan(free?.h ?? 0);
    expect((capped?.w ?? 0) / (capped?.h ?? 1)).toBeCloseTo(CARD_ASPECT, 6);
    expect(liftedWidth(cw, 360, 240)).toBeCloseTo(240 * CARD_ASPECT, 6);
    // Its bottom stays where an uncapped one's is (the band over it only needs its top).
    const bottom = (p: { y: number; h: number } | undefined) => (p?.y ?? 0) + (p?.h ?? 0) * (1 + HAND_FAN.liftUp);
    expect(bottom(capped)).toBeCloseTo(187 - HAND_FAN.bottom, 6);
    expect(bottom(free)).toBeCloseTo(187 - HAND_FAN.bottom, 6);
  });
});
