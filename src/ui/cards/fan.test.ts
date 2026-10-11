import { describe, expect, it } from 'vitest';
import { CARD_FACE, HAND_FAN } from '../../render/forge/layout.ts';
import { fanPlaces, handCardWidth, liftedWidth, shownWidths } from './fan.ts';

// Hand boxes of the art table (art.css .ft-hand): 390×844, 360×640 and 412×915 phones.
const BOXES = [
  [390, 204],
  [360, 191],
  [412, 213],
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
    expect(handCardWidth(390, 204, 3)).toBeGreaterThan(handCardWidth(390, 204, 5));
  });
});
