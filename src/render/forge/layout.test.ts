import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { floatAt, OVERLAY_PLACE, SCENE_ART_KEYS, SCENE_PLACE, type SceneArtKey, sceneLayout, UI_ART_KEYS, WEAPON_ART } from './layout.ts';

// The delivered pictures' width÷height, read from the art pipeline's meta.json, so the checks
// follow the real art when a picture is redrawn.
const META = JSON.parse(readFileSync(new URL('../../assets/art/meta.json', import.meta.url), 'utf8')) as Record<
  string,
  Record<string, { w: number; h: number }>
>;
const ART_ASPECT: Partial<Record<SceneArtKey, number>> = {};
for (const k of SCENE_ART_KEYS) {
  const e = META.scene?.[k];
  if (e !== undefined) ART_ASPECT[k] = e.w / e.h;
}

// Scene boxes measured on the art table: 390×844 and 360×640 phones, and a wide one.
const BOXES = [
  [390, 466],
  [360, 290],
  [480, 540],
] as const;

/** The gauge plate's bottom edge (px) for a box of height h (ForgeStage measures the real one). */
const plateBottom = (h: number) => OVERLAY_PLACE.gauges.top * h + 92;

describe('sceneLayout', () => {
  for (const [w, h] of BOXES) {
    for (const aspect of [{}, ART_ASPECT]) {
      const tag = `${w}×${h}${aspect === ART_ASPECT ? ' (art)' : ' (stand-ins)'}`;
      const L = sceneLayout(w, h, aspect);

      it(`${tag}: the hot iron lies on the anvil's face`, () => {
        expect(L.iron.x).toBeGreaterThan(L.anvil.x);
        expect(L.iron.x).toBeLessThan(L.anvil.x + L.anvil.w);
        expect(L.iron.w).toBeLessThan(L.face.w);
        // Its bottom edge sits on the face line (within a few px).
        expect(Math.abs(L.iron.y + L.iron.h * 0.38 - L.face.y)).toBeLessThan(4);
      });

      it(`${tag}: everything stands inside the box, the dwarf a step behind the anvil`, () => {
        for (const r of [L.anvil, L.furnace]) {
          expect(r.x).toBeGreaterThanOrEqual(-1);
          expect(r.x + r.w).toBeLessThanOrEqual(w + 1);
        }
        expect(L.dwarf.y).toBeLessThan(L.anvil.y + L.anvil.h);
        expect(L.dwarf.y - L.dwarf.bodyH).toBeGreaterThan(0);
      });

      it(`${tag}: the played card hovers over the scene, clear of the iron`, () => {
        expect(L.cardHover.x).toBeGreaterThan(0);
        expect(L.cardHover.x).toBeLessThan(w);
        expect(L.cardHover.y).toBeLessThan(L.iron.y - L.iron.h);
        expect(L.fire.y).toBeGreaterThan(0);
      });

      it(`${tag}: floating numbers rise over the iron, under the plate, left of the hovering card`, () => {
        const plate = plateBottom(h);
        for (let order = 0; order < 4; order++) {
          const at = floatAt(L, order, plate);
          expect(at.y).toBeLessThan(L.iron.y - L.iron.h / 2);
          expect(at.y).toBeGreaterThanOrEqual(plate);
          expect(at.x).toBeLessThan(L.cardHover.x);
        }
        // Later numbers of a beat start higher.
        expect(floatAt(L, 1, plate).y).toBeLessThan(floatAt(L, 0, plate).y);
      });
    }
  }

  it('keeps the hover inside the box on narrow phones', () => {
    const L = sceneLayout(320, 240, ART_ASPECT);
    expect(L.cardHover.x).toBeLessThanOrEqual(320 - 50);
    expect(SCENE_PLACE.lunge).toBeGreaterThan(0);
  });
});

describe('art manifest', () => {
  it('every scene and UI key has a processed picture in meta.json', () => {
    for (const k of SCENE_ART_KEYS) expect(META.scene?.[k], `scene/${k}`).toBeDefined();
    for (const k of UI_ART_KEYS) expect(META.ui?.[k], `ui/${k}`).toBeDefined();
  });
});

describe('WEAPON_ART', () => {
  it('has a butt→tip line and a length for every weapon', () => {
    for (const a of Object.values(WEAPON_ART)) {
      expect(Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y)).toBeGreaterThan(0.5);
      expect(a.len).toBeGreaterThan(0.5);
    }
  });
});
