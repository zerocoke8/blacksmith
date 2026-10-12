import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CARD_FACE,
  DWARF_POSE_ART,
  DWARF_POSES,
  floatAt,
  hammerX,
  ORB_FACE,
  OVERLAY_PLACE,
  PROP_ART,
  SCENE_ART_KEYS,
  SCENE_PLACE,
  type SceneArtKey,
  sceneLayout,
  STRIKE_AT,
  strikeLift,
  TABLE_ROWS,
  UI_ART_KEYS,
  WEAPON_ART,
  WEAPON_REST,
  weaponRest,
} from './layout.ts';

// The delivered pictures' sizes, trims and measured anchors, read from the art pipeline's
// meta.json (tools/art/process.ts), so the checks follow the real art when a picture is redrawn.
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface MetaEntry {
  w: number;
  h: number;
  trim: { x: number; y: number; w: number; h: number; ow: number; oh: number };
  alignedTo?: string;
  anchors?: {
    bar?: { x0: number; x1: number; y0: number; y1: number };
    crack?: { x: number };
    ring?: { cx: number; cy: number; r: number };
    frame?: { cost?: { cx: number; cy: number; d: number }; name?: Box; art?: Box; ribbon?: Box; text?: Box };
  };
}
const META = JSON.parse(readFileSync(new URL('../../assets/art/meta.json', import.meta.url), 'utf8')) as Record<string, Record<string, MetaEntry>>;
const scene = (k: string) => META.scene?.[k] as MetaEntry;
const ART_ASPECT: Partial<Record<SceneArtKey, number>> = {};
for (const k of SCENE_ART_KEYS) {
  const e = META.scene?.[k];
  if (e !== undefined) ART_ASPECT[k] = e.w / e.h;
}

// Scene boxes of the art table (ui/cards/tableLayout.ts tableRows): 390×844, 360×640 and 412×915
// phones, a 320×568 one and a wide one.
const BOXES = [
  [390, 430],
  [360, 263],
  [412, 492],
  [320, 208],
  [480, 452],
] as const;

/** The dwarf's (idle) head→foot height on the poses' shared canvas, px. */
const IDLE_BODY = (DWARF_POSE_ART.idle.foot.y - DWARF_POSE_ART.idle.head) * DWARF_POSE_ART.idle.src;

describe('sceneLayout', () => {
  for (const [w, h] of BOXES) {
    for (const [what, aspect] of [
      ['stand-ins', {}],
      ['art', ART_ASPECT],
    ] as const) {
      const tag = `${w}×${h} (${what})`;
      const L = sceneLayout(w, h, aspect);

      it(`${tag}: the hot bar lies on the anvil's face`, () => {
        expect(L.iron.x - L.iron.w / 2).toBeGreaterThanOrEqual(L.face.x - L.face.w / 2 - 0.5);
        expect(L.iron.x + L.iron.w / 2).toBeLessThanOrEqual(L.face.x + L.face.w / 2 + 0.5);
        // Its bottom edge is the face line.
        expect(Math.abs(L.iron.y + L.iron.h / 2 - L.face.y)).toBeLessThan(0.5);
      });

      it(`${tag}: the anvil comes up to his middle on screen, the furnace is taller than him`, () => {
        // He stands a step behind it, so its face shows between his feet and his chin.
        expect(L.face.y).toBeLessThan(L.dwarf.y);
        expect(L.face.y).toBeGreaterThan(L.dwarf.y - L.dwarf.bodyH * 0.6);
        expect(L.furnace.h).toBeGreaterThan(L.dwarf.bodyH);
        expect(L.dwarf.bodyH).toBeLessThanOrEqual(SCENE_PLACE.dwarf.maxW * w + 1e-6);
      });

      it(`${tag}: everything stands on the floor inside the box, the dwarf a step behind the anvil`, () => {
        expect(L.anvil.x).toBeGreaterThanOrEqual(-1);
        expect(L.anvil.x + L.anvil.w).toBeLessThanOrEqual(w + 1);
        // The furnace stands at the right edge: its fire stays in the box, at most a little under half of it leaves.
        expect(L.furnace.x).toBeGreaterThan(L.anvil.x);
        expect(L.mouth.x).toBeLessThan(w - 4);
        expect(L.furnace.x + L.furnace.w - w).toBeLessThan(L.furnace.w * 0.45);
        expect(L.furnace.y).toBeGreaterThanOrEqual(0);
        for (const foot of [L.dwarf.y, L.anvil.y + L.anvil.h, L.furnace.y + L.furnace.h]) {
          expect(foot).toBeGreaterThan(SCENE_PLACE.floor * h);
          expect(foot).toBeLessThanOrEqual(h + 1);
        }
        expect(L.dwarf.y).toBeLessThan(L.anvil.y + L.anvil.h);
        expect(L.dwarf.y - L.dwarf.bodyH).toBeGreaterThan(0);
        // The raised hammer (the raise pose is drawn taller) stays inside too.
        const raise = (DWARF_POSE_ART.raise.src * DWARF_POSE_ART.raise.foot.y) / IDLE_BODY;
        expect(L.dwarf.y - L.dwarf.bodyH * raise).toBeGreaterThan(0);
      });

      it(`${tag}: he stands where his hammer meets the bar's top (the floor and the box's bottom do not push him)`, () => {
        // sceneLayout clamps his feet to the floor and the box; at the table's sizes neither may bind,
        // or the blow would land above or inside the bar.
        const want = L.iron.y - L.iron.h / 2 + strikeLift() * L.dwarf.bodyH;
        expect(want).toBeGreaterThan(SCENE_PLACE.floor * h + 2);
        expect(want).toBeLessThan(h - 1);
        expect(L.dwarf.y).toBeCloseTo(want, 6);
      });

      it(`${tag}: the played card hovers over the scene, clear of the iron`, () => {
        expect(L.cardHover.x).toBeGreaterThan(0);
        expect(L.cardHover.x).toBeLessThan(w);
        expect(L.cardHover.y).toBeLessThan(L.iron.y - L.iron.h);
        // Its box (at most maxH tall) stays between the scene's top and the iron.
        expect(L.cardHover.y - L.cardHover.maxH / 2).toBeGreaterThanOrEqual(OVERLAY_PLACE.cardHover.top - 0.5);
        expect(L.cardHover.y + L.cardHover.maxH / 2).toBeLessThanOrEqual(L.iron.y - L.iron.h * 0.7 + 0.5);
      });

      it(`${tag}: floating numbers rise over the bar, right of the blow (clear of his face), left of the hovering card`, () => {
        for (let order = 0; order < 4; order++) {
          const at = floatAt(L, order);
          expect(at.y).toBeLessThan(L.iron.y - L.iron.h / 2);
          expect(at.y).toBeGreaterThanOrEqual(OVERLAY_PLACE.floats.top);
          // They read rightward from here: never left of where the hammer lands (his face is left of it).
          expect(at.x).toBeGreaterThan(hammerX(L));
          expect(at.x).toBeLessThan(L.cardHover.x);
          // A number of about 90 px still fits in the box.
          expect(at.x + 90).toBeLessThanOrEqual(w);
        }
        // Later numbers of a beat start higher and further right.
        expect(floatAt(L, 1).y).toBeLessThan(floatAt(L, 0).y);
        expect(floatAt(L, 1).x).toBeGreaterThan(floatAt(L, 0).x);
      });

      it(`${tag}: the bubble stays in the scene, over the chips of the gauge band even when it rises`, () => {
        const half = OVERLAY_PLACE.bubble.half;
        expect(L.bubble.y - half).toBeGreaterThanOrEqual(0);
        expect(L.bubble.y + half).toBeLessThanOrEqual(h * (1 - TABLE_ROWS.riseShare) - TABLE_ROWS.ledge);
        expect(L.bubble.x + Math.min(L.bubble.maxW, 120)).toBeLessThanOrEqual(w);
      });

      it(`${tag}: a finished weapon lies on the anvil with its hilt clear of the dwarf`, () => {
        for (const art of Object.values(WEAPON_ART)) {
          const len = L.anvil.w * art.len;
          const rest = weaponRest(L, len);
          const butt = rest.x - (len / 2) * Math.cos(WEAPON_REST.tilt);
          expect(butt).toBeGreaterThanOrEqual(L.face.x - L.face.w * WEAPON_REST.butt - 0.5);
          // Its middle is over the anvil, its tip may reach out over the furnace.
          expect(rest.x).toBeGreaterThan(L.anvil.x);
          expect(rest.x).toBeLessThan(L.anvil.x + L.anvil.w * 1.4);
          expect(rest.y).toBeLessThan(L.face.y);
        }
      });
    }
  }
});

describe('sceneLayout with the delivered pictures', () => {
  for (const [w, h] of BOXES) {
    it(`${w}×${h}: the dwarf can step in far enough for the hammer to land on the bar`, () => {
      const L = sceneLayout(w, h, ART_ASPECT);
      // The strike picture at the dwarf's scale (the poses share one), its hammer face from the feet.
      const s = scene('dwarf_strike');
      const art = DWARF_POSE_ART.strike;
      const width = s.trim.w * (L.dwarf.bodyH / IDLE_BODY);
      const hammer = L.dwarf.x + ((art.hammer?.x ?? 0) - art.foot.x) * width;
      const target = L.iron.x - L.iron.w * STRIKE_AT;
      expect(Math.abs(target - hammer)).toBeLessThanOrEqual(SCENE_PLACE.lunge * w);
    });
  }
});

describe('art manifest', () => {
  it('every scene and UI key has a processed picture in meta.json', () => {
    for (const k of SCENE_ART_KEYS) expect(META.scene?.[k], `scene/${k}`).toBeDefined();
    for (const k of UI_ART_KEYS) expect(META.ui?.[k], `ui/${k}`).toBeDefined();
  });

  it('the six dwarf poses: their pictures are as tall on the shared canvas as layout.ts says', () => {
    for (const p of DWARF_POSES) {
      const e = META.scene?.[`dwarf_${p}`];
      expect(e, `dwarf_${p}`).toBeDefined();
      expect(DWARF_POSE_ART[p].src, `dwarf_${p}`).toBe(e?.trim.h);
    }
  });

  it("the split and the cold bars are processed onto the hot bar's canvas, so the scene swaps them in place", () => {
    const hot = scene('iron_hot');
    for (const k of ['iron_cracked', 'iron_cold']) {
      const e = scene(k);
      expect(e.alignedTo, k).toBe('iron_hot');
      expect([e.w, e.h], k).toEqual([hot.w, hot.h]);
      expect(e.trim, k).toEqual(hot.trim);
    }
  });
});

describe('layout.ts anchors against the pictures (meta.json anchors, measured by tools/art/process.ts)', () => {
  const near = (got: number | undefined, want: number, tol: number, what: string) => {
    expect(got, what).toBeDefined();
    expect(Math.abs((got ?? Number.NaN) - want), `${what}: measured ${got}, layout.ts ${want}`).toBeLessThanOrEqual(tol);
  };

  it("PROP_ART.iron.bar is the hot bar's box; the split and cold bars share its ends and its bottom", () => {
    const bar = PROP_ART.iron.bar;
    const hot = scene('iron_hot').anchors?.bar;
    near(hot?.x0, bar.x0, 0.01, 'iron_hot x0');
    near(hot?.x1, bar.x1, 0.01, 'iron_hot x1');
    near(hot?.y0, bar.y0, 0.01, 'iron_hot y0');
    near(hot?.y1, bar.y1, 0.01, 'iron_hot y1');
    for (const k of ['iron_cracked', 'iron_cold']) {
      const b = scene(k).anchors?.bar;
      near(b?.x0, bar.x0, 0.015, `${k} x0`);
      near(b?.x1, bar.x1, 0.015, `${k} x1`);
      near(b?.y1, bar.y1, 0.01, `${k} y1`);
      // Drawn no thicker than the hot bar.
      expect(b?.y0 ?? 0, `${k} y0`).toBeGreaterThanOrEqual(bar.y0 - 0.01);
    }
  });

  it('PROP_ART.iron.crack is where the split bar is cracked', () => {
    near(scene('iron_cracked').anchors?.crack?.x, PROP_ART.iron.crack, 0.02, 'iron_cracked crack');
  });

  it("CARD_FACE's boxes are the cream panels of every frame picture", () => {
    const tol = 0.015;
    for (const kind of ['progress', 'quality', 'support', 'material', 'imprint']) {
      const f = META.ui?.[`frame_${kind}`]?.anchors?.frame;
      expect(f, `frame_${kind}`).toBeDefined();
      near(f?.cost?.cx, CARD_FACE.cost.cx, tol, `${kind} cost cx`);
      near(f?.cost?.cy, CARD_FACE.cost.cy, tol, `${kind} cost cy`);
      near(f?.cost?.d, CARD_FACE.cost.d, tol, `${kind} cost d`);
      for (const part of ['name', 'art', 'ribbon', 'text'] as const) {
        const got = f?.[part];
        const want = CARD_FACE[part];
        near(got?.x, want.x, tol, `${kind} ${part} left`);
        near(got === undefined ? undefined : got.x + got.w, want.x + want.w, tol, `${kind} ${part} right`);
        near(got?.y, want.y, tol, `${kind} ${part} top`);
        near(got === undefined ? undefined : got.y + got.h, want.y + want.h, tol, `${kind} ${part} bottom`);
      }
    }
  });

  it("ORB_FACE is the durability orb's ember", () => {
    const ring = META.ui?.orb_durability?.anchors?.ring;
    near(ring?.cx, ORB_FACE.cx, 0.01, 'orb cx');
    near(ring?.cy, ORB_FACE.cy, 0.01, 'orb cy');
    near(ring?.r, ORB_FACE.r, 0.01, 'orb r');
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
