import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_ASPECT, HAND_FAN, OVERLAY_PLACE, SCENE_ART_KEYS, type SceneArtKey, sceneLayout, TABLE_ROWS } from '../../render/forge/layout.ts';
import { fanPlaces } from './fan.ts';
import { bandRise, liftedHeight, rowsCardWidth, type Row, tableRows } from './tableLayout.ts';

// The art table's rows on phones: 390×844, 360×640 and 412×915 (the three the screen is checked
// on), and a small and a wide one. Heights are the safe area (inside the notch and the home bar).
const PHONES = [
  [390, 844],
  [360, 640],
  [412, 915],
  [320, 568],
  [480, 900],
] as const;

const ART = JSON.parse(readFileSync(new URL('../../assets/art/meta.json', import.meta.url), 'utf8')) as Record<
  string,
  Record<string, { w: number; h: number }>
>;
const ART_ASPECT: Partial<Record<SceneArtKey, number>> = {};
for (const k of SCENE_ART_KEYS) {
  const e = ART.scene?.[k];
  if (e !== undefined) ART_ASPECT[k] = e.w / e.h;
}

const bottom = (r: Row) => r.y + r.h;
const overlap = (a: Row, b: Row) => a.y < bottom(b) - 1e-6 && b.y < bottom(a) - 1e-6;

describe('tableRows', () => {
  for (const [w, h] of PHONES) {
    const rows = tableRows(w, h);
    const order = [rows.top, rows.scene, rows.band, rows.hand, rows.foot];

    it(`${w}×${h}: top band, scene, gauge band, hand and bottom row tile the screen without overlap`, () => {
      expect(rows.top.y).toBe(0);
      for (let i = 1; i < order.length; i++) {
        const a = order[i - 1] as Row;
        const b = order[i] as Row;
        expect(b.y).toBeCloseTo(bottom(a), 6);
        expect(overlap(a, b)).toBe(false);
      }
      for (const r of order) expect(r.h).toBeGreaterThan(0);
      expect(bottom(rows.foot)).toBeLessThanOrEqual(h + 1e-6);
      expect(h - bottom(rows.foot)).toBeLessThan(1);
      expect(rows.scene.h).toBeGreaterThanOrEqual(TABLE_ROWS.sceneMin);
    });

    it(`${w}×${h}: the gauge band sits right over the hand, the fan's cards inside the hand's row`, () => {
      expect(bottom(rows.band)).toBeCloseTo(rows.hand.y, 6);
      for (const n of [1, 3, 4, 5, 6]) {
        const cw = rowsCardWidth(rows, n);
        for (const p of fanPlaces(n, w, rows.hand.h, cw, -1, rows.liftMaxH)) {
          // Under the band; the fan's outer cards dip along its arc by a few px at most.
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y + p.h).toBeLessThanOrEqual(rows.hand.h + 0.08 * p.h);
          expect(p.x).toBeGreaterThanOrEqual(-1e-6);
          expect(p.x + p.w).toBeLessThanOrEqual(w + 1e-6);
        }
        // Up to a full hand (5), the gap between the band and the cards is the hint line's.
        const tops = fanPlaces(n, w, rows.hand.h, cw, -1, rows.liftMaxH).map((p) => p.y);
        if (n <= 5) expect(Math.min(...tops)).toBeLessThanOrEqual(HAND_FAN.top + 4);
      }
    });

    it(`${w}×${h}: a lifted card never covers the gauge band (the band rises over it, into the scene's floor only)`, () => {
      for (const n of [1, 3, 4, 5, 6, 7]) {
        const rise = bandRise(rows, n);
        const cw = rowsCardWidth(rows, n);
        for (let sel = 0; sel < n; sel++) {
          const lifted = fanPlaces(n, w, rows.hand.h, cw, sel, rows.liftMaxH)[sel];
          expect(lifted).toBeDefined();
          if (lifted === undefined) continue;
          const liftedTop = rows.hand.y + lifted.y;
          const bandBottom = bottom(rows.band) - rise;
          expect(bandBottom).toBeLessThanOrEqual(liftedTop + 1e-6);
          expect(liftedTop - bandBottom).toBeLessThanOrEqual(TABLE_ROWS.riseGap + 1);
          // It stays in the hand's row at the bottom (the orb and 다시 달구기 stay clear).
          expect(lifted.y + lifted.h).toBeLessThanOrEqual(rows.hand.h + 1e-6);
          expect(lifted.h).toBeLessThanOrEqual(rows.liftMaxH + 1e-6);
          expect(lifted.h).toBeCloseTo(liftedHeight(rows, n), 6);
        }
        // The risen band (and its chips) stays on the scene's floor, under the top band.
        expect(rise).toBeGreaterThanOrEqual(0);
        expect(rise).toBeLessThanOrEqual(TABLE_ROWS.riseShare * rows.scene.h + 1);
        expect(rows.band.y - rise - TABLE_ROWS.ledge).toBeGreaterThan(bottom(rows.top));
      }
    });

    it(`${w}×${h}: the lifted card is laid out bigger than the fan's, so its text reads`, () => {
      for (const n of [4, 5, 6]) expect(liftedHeight(rows, n)).toBeGreaterThan((rowsCardWidth(rows, n) / 2) * 3 * 1.2);
    });

    it(`${w}×${h}: with the band held still (실험 패널), the lifted card stays in the hand's row, under the band`, () => {
      for (const n of [1, 3, 4, 5, 6, 7]) {
        const cw = rowsCardWidth(rows, n);
        for (let sel = 0; sel < n; sel++) {
          const lifted = fanPlaces(n, w, rows.hand.h, cw, sel, rows.liftMaxHStill)[sel];
          expect(lifted).toBeDefined();
          if (lifted === undefined) continue;
          expect(lifted.y).toBeGreaterThanOrEqual(TABLE_ROWS.riseGap - 1e-6);
          expect(lifted.y + lifted.h).toBeLessThanOrEqual(rows.hand.h + 1e-6);
          // Never smaller than the cards resting in the fan.
          expect(lifted.h).toBeGreaterThanOrEqual(cw / CARD_ASPECT - 1e-6);
          expect(lifted.h).toBeCloseTo(liftedHeight(rows, n, true), 6);
        }
      }
    });

    it(`${w}×${h}: with the band risen, the iron and the dwarf's bubble stay in sight over its chips`, () => {
      const L = sceneLayout(w, rows.scene.h, ART_ASPECT);
      const rise = bandRise(rows, 5);
      const ledgeTop = rows.scene.h - rise - TABLE_ROWS.ledge;
      expect(L.iron.y - L.iron.h / 2).toBeLessThan(ledgeTop);
      expect(L.bubble.y + OVERLAY_PLACE.bubble.half).toBeLessThanOrEqual(ledgeTop + 1e-6);
    });
  }

  it('a short screen takes the short sizes', () => {
    expect(tableRows(360, 640).band.h).toBe(TABLE_ROWS.bandShort);
    expect(tableRows(390, 844).band.h).toBe(TABLE_ROWS.band);
  });

  it('a very short screen gives the hand way before the scene goes under its floor', () => {
    const rows = tableRows(360, 520);
    expect(rows.scene.h).toBeGreaterThanOrEqual(TABLE_ROWS.sceneMin);
    expect(rows.hand.h).toBeGreaterThanOrEqual(TABLE_ROWS.hand.min);
    expect(rows.hand.h).toBeLessThan(tableRows(360, 640).hand.h);
  });
});
