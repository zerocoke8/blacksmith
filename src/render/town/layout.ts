// 마을 지도의 배치 (기획서 9장). The map is the composer's layout.json as it is
// (docs/mockups/town/layout.json, written by tools/art/town/compose.ts): the same size, the same
// places, the same drawing order and shadows. This file reads it, says which picture is which
// building, and holds the screen's own numbers: where the name tags hang, where the camera looks
// first, the guests' road, the smoke and the fountain. No PixiJS, no DOM: the scene, the React
// overlay, the map's bake (tools/art/town/bake.ts) and the tests all read it.
// These are only how the map looks and moves; when a building opens is a rule (src/sim/data/town.ts).

import type { TownBuildingId } from '../../sim/data/town.ts';
import { type Bounds, type Cam, centerOn, clampCam, type View } from './camera.ts';
import type { Rect } from './hit.ts';

export interface LayoutItem {
  readonly key: string;
  readonly kind: 'building' | 'prop' | 'person';
  /** Where it touches the ground: the middle of its body at its lowest point (map px). */
  readonly x: number;
  readonly y: number;
  /** Map px per source px (the generated PNG's px). */
  readonly scale: number;
  readonly flip: boolean;
  readonly shear: number;
  /** The drawn body box (map px): its bottom is y, its middle x. */
  readonly box: Rect;
  readonly anchor: { readonly cx: number; readonly gy: number };
  /** The ground ellipse's size (low props like the fence). */
  readonly ell?: number;
  /** Contact shadows written by hand instead of the ellipse (map px from x, y): the gate's pillars. */
  readonly spots?: readonly { readonly dx: number; readonly dy: number; readonly rx: number; readonly ry: number }[];
  readonly note?: string;
}

export interface PuffStyle {
  readonly top: string;
  readonly under: string;
  readonly line: number;
  readonly seed?: number;
}

export interface TownLayout {
  readonly map: {
    readonly width: number;
    readonly height: number;
    readonly ground: string;
    readonly groundScale: number;
    readonly groundY: number;
    readonly skyColor: string;
    /** The ground's ink lines are thinned by r map px on each side (the composer's thinInk). */
    readonly thin?: { readonly r: number } | null;
  };
  readonly baseScale: number;
  readonly shadow: { readonly color: string; readonly mode: string };
  readonly paths: {
    readonly style: { readonly fill: string; readonly ink: string; readonly dot: string; readonly line: number; readonly seed: number };
    readonly list: readonly { readonly key: string; readonly w: number; readonly pts: readonly (readonly [number, number])[]; readonly dots?: number }[];
  };
  readonly towers: { readonly stack: Readonly<Record<string, { readonly top: number; readonly bot: number; readonly n: number; readonly shrink: number }>> };
  readonly clouds: {
    readonly style: PuffStyle;
    readonly horizon: { readonly y: number; readonly r: number; readonly step: number; readonly jit: number; readonly seed: number };
    readonly rings: readonly { readonly x: number; readonly y: number; readonly w: number; readonly r: number; readonly n: number }[];
    readonly band: { readonly key: string; readonly srcH: number; readonly h: number; readonly y: number; readonly x0: number };
  };
  readonly smoke: { readonly puffs: readonly { readonly x: number; readonly y: number; readonly r: number }[]; readonly style: PuffStyle };
  readonly outlines: {
    readonly props: Readonly<Record<string, number>>;
    readonly people: { readonly scale: number; readonly line: number; readonly dwarfScale: number; readonly dwarfLine: number };
  };
  readonly items: readonly LayoutItem[];
}

const FILES = import.meta.glob('/docs/mockups/town/layout.json', { import: 'default', eager: true }) as Record<string, unknown>;

function readLayout(): TownLayout {
  const raw = Object.values(FILES)[0] as TownLayout | undefined;
  if (raw === undefined || !Array.isArray(raw.items) || raw.map === undefined || raw.paths === undefined || raw.smoke === undefined) {
    throw new Error('docs/mockups/town/layout.json is missing');
  }
  return raw;
}

export const TOWN_LAYOUT: TownLayout = readLayout();
export const MAP_W = TOWN_LAYOUT.map.width;
export const MAP_H = TOWN_LAYOUT.map.height;

/** The pictures the map draws: everything in the layout but the mockup's people (the guests walk instead, 9.3). The dwarf stays at his door. */
export const MAP_ITEMS: readonly LayoutItem[] = TOWN_LAYOUT.items.filter((it) => it.kind !== 'person' || it.key === 'dwarf');

/** Which building a picture is (null: a prop, a tree, a person). */
export function buildingOf(key: string): TownBuildingId | null {
  if (key.startsWith('tower_')) return 'tower';
  switch (key) {
    case 'bld_forge':
      return 'forge';
    case 'bld_guild':
      return 'guild';
    case 'bld_gate':
      return 'gate';
    case 'bld_mine':
      return 'mine';
    case 'bld_shop':
      return 'shop';
    case 'bld_inn':
      return 'inn';
    case 'bld_market':
      return 'market';
    case 'bld_fountain':
      return 'fountain';
    case 'bld_house_a':
    case 'bld_house_b':
      return 'house';
    default:
      return null;
  }
}

/** One tappable building on the map: its picture's place in MAP_ITEMS and its own id ('tower_fire', 'house_3'). */
export interface MapBuilding {
  /** Unique on the map: the picture's key, numbered when there are more (bld_house_a#2). */
  readonly uid: string;
  readonly building: TownBuildingId;
  readonly key: string;
  readonly item: LayoutItem;
}

export const MAP_BUILDINGS: readonly MapBuilding[] = (() => {
  const seen = new Map<string, number>();
  const out: MapBuilding[] = [];
  for (const item of MAP_ITEMS) {
    const building = buildingOf(item.key);
    if (building === null) continue;
    const n = (seen.get(item.key) ?? 0) + 1;
    seen.set(item.key, n);
    out.push({ uid: n === 1 ? item.key : `${item.key}#${n}`, building, key: item.key, item });
  }
  return out;
})();

export function mapBuilding(uid: string): MapBuilding | null {
  return MAP_BUILDINGS.find((b) => b.uid === uid) ?? null;
}

/**
 * Name tags (9.1 '건물 이름표는 늘 보인다'): the buildings you go into, and the scenery with a name
 * (shop, inn, market). Houses and the fountain have none: they are the town's look, not places.
 * A tag hangs at its body box's bottom middle, moved by (dx, dy) map px (a tag is a CSS sticker:
 * it keeps its size at any zoom). The gate's hangs over its left pillar, clear of the guests, who
 * walk through the arch and out over its right side.
 */
export const LABEL_SPOT: Partial<Record<string, { dx: number; dy: number }>> = {
  bld_forge: { dx: -40, dy: -16 },
  bld_guild: { dx: 10, dy: -14 },
  bld_gate: { dx: -150, dy: -240 },
  bld_mine: { dx: 0, dy: -10 },
  bld_shop: { dx: -10, dy: -8 },
  bld_inn: { dx: 0, dy: -8 },
  bld_market: { dx: 0, dy: -6 },
  tower_water: { dx: 0, dy: -8 },
  tower_fire: { dx: 0, dy: -8 },
  tower_earth: { dx: 0, dy: -8 },
  tower_wind: { dx: 0, dy: -8 },
};

/** Where a building's tag hangs (map px), or null for one without a tag. */
export function labelPoint(b: MapBuilding): { x: number; y: number } | null {
  const spot = LABEL_SPOT[b.key];
  if (spot === undefined) return null;
  const box = b.item.box;
  return { x: box.x + box.w / 2 + spot.dx, y: box.y + box.h + spot.dy };
}

/** A tower's bubble hangs this far over its feet (map px): over the door, not up in the clouds. */
export const TOWER_BUBBLE_DY = 260;
/** The dwarf's bubble hangs this far over his feet (map px): over his head. */
export const DWARF_BUBBLE_DY = 90;

/** Where a building's one-line bubble points from (map px): over its roof. */
export function bubblePoint(b: MapBuilding): { x: number; y: number } {
  const box = b.item.box;
  const top = b.building === 'tower' ? b.item.y - TOWER_BUBBLE_DY : box.y + Math.min(40, box.h * 0.12);
  return { x: box.x + box.w / 2, y: top };
}

/** The towers run up past the map's top into the clouds: what would land above this map y is never seen, so the bake cuts it. */
export const TOWER_TOP_CUT = -20;

/** A locked building is drawn with this tint (9.2 '공사 중'처럼, [미정]: a greyed picture for now). */
export const LOCK_TINT = 0xa59e95;

// ---------- Where the camera looks first ----------

/** How much of the screen the top band and the quick entries cover (CSS px from the top and from the bottom). */
export interface Insets {
  readonly top: number;
  readonly bottom: number;
}

/** The first look (9.1 '접속하면 대장간이 화면 가운데') [튜닝]. */
export const HOME_VIEW = {
  /** The view's middle: this share down the forge's body, and this many map px lower still. */
  share: 0.62,
  below: 140,
  /** CSS px kept between the shop's tag and the quick entries, and between the forge's top (its chimney) and the top band. */
  shopGap: 18,
  forgeGap: 0,
} as const;

/**
 * Where the camera's top-left is first: the forge in the middle, a little low, so the shop's door
 * and the guests on its path show under it (9.3). On a short screen it moves down until the shop's
 * tag clears the quick entries, as far as the forge's top stays under the top band.
 */
export function homeCamera(view: View, z: number, b: Bounds, insets: Insets): Cam {
  const forge = MAP_BUILDINGS.find((m) => m.building === 'forge');
  if (forge === undefined) return centerOn(MAP_W / 2, MAP_H / 2, view, z, b);
  const box = forge.item.box;
  const c = centerOn(box.x + box.w / 2, box.y + box.h * HOME_VIEW.share + HOME_VIEW.below, view, z, b);
  let y = c.y;
  const shop = MAP_BUILDINGS.find((m) => m.building === 'shop');
  const tag = shop !== undefined ? labelPoint(shop) : null;
  if (tag !== null) y = Math.max(y, tag.y - (view.h - insets.bottom - HOME_VIEW.shopGap) / z);
  y = Math.min(y, box.y - (insets.top + HOME_VIEW.forgeGap) / z);
  return clampCam({ x: c.x, y }, b);
}

// ---------- The guests' road (9.3): in at the gate, to the shop, out at the gate ----------

type Pt = readonly [number, number];

/**
 * The guests' road (map px, 9.3): up the main street from below the map's bottom edge and through
 * the gate's arch, then right to the shop's door. The shop's dirt path runs in right behind the
 * gate's right pillar (x 1410–1510, its top at y ≈ 3955, the arch's beam left of it at y ≈ 3920–4015),
 * so a guest on the path itself would walk hidden behind the pillar with only a head showing. They
 * come out above the arch instead, cross just north of the pillar's top, and go down to the door
 * (beside the fence, which is low there). They walk it there and back.
 */
export const GUEST_ROAD: readonly Pt[] = [
  [1236, MAP_H + 90],
  [1234, 4300],
  [1232, 4150],
  [1250, 4060],
  [1266, 3960],
  [1330, 3926],
  [1420, 3926],
  [1490, 3938],
  [1590, 3986],
  [1724, 3992],
];

/** How the guests walk (presentation only, [튜닝] by eye). */
export const GUESTS = {
  /**
   * The median hero's body height on the map (map px; 9.3 '작게'). Every hero keeps its own height
   * next to the others. The pictures are baked at this size: change it, then run tools/art/town/bake.ts.
   */
  height: 80,
  /** Walking speed (map px per s): slow, an unhurried stroll. */
  speed: 34,
  /** At most this many on the map at once (9.3 '많아야 12명'), and the wait between two arrivals (ms). */
  max: 5,
  spawnMs: [6500, 12000] as const,
  /** How long one stays in the shop (ms). */
  shopMs: [2600, 5200] as const,
  /** A step: this many map px of road, and how high the body bobs on it (map px). */
  stride: 26,
  bob: 3.2,
  /**
   * Each walks its own lane, between lane[0] and lane[1] map px off the road's middle: walking in
   * on one side, out on the other, so two guests meeting pass each other instead of overlapping.
   */
  lane: [4, 16] as const,
  /** A tapped guest stops and says a line for this long (ms). */
  talkMs: 2600,
} as const;

/** With less motion (9.1, reduced motion): the guests stand still here instead (map px, facing). */
export const GUEST_STILL: readonly { x: number; y: number; flip: boolean }[] = [
  { x: 1196, y: 4122, flip: false },
  { x: 1700, y: 3990, flip: true },
  { x: 1214, y: 4240, flip: false },
];

/**
 * A picture's ground shadow (the composer's contact ellipse), from its feet (map px): as wide as
 * its base or 30% of its body (55% for a tree), nudged to the lower right (light from the upper
 * left). `foot` is the baked picture's base (its offset from the middle, the ellipse's width basis);
 * `k` shrinks it for low props (layout 'ell').
 */
export function groundEllipse(foot: { readonly off: number; readonly bw: number }, flip: boolean, k = 1): { x: number; y: number; rx: number; ry: number } {
  const { off, bw } = foot;
  return { x: off * (flip ? -1 : 1) + bw * 0.1, y: -bw * 0.04, rx: bw * 0.56 * k, ry: bw * 0.17 * k };
}

// ---------- Small motions ----------

/** The forge's chimney smoke: puffs rise from the first puff's place toward the last's, growing. */
export const SMOKE = {
  /** A new puff this often (ms), living this long (ms). */
  everyMs: 620,
  lifeMs: 6200,
  /** Radius at birth and at its biggest (map px); each puff is between minK and 1 of that. */
  r0: 16,
  r1: 42,
  minK: 0.62,
  /** Drift (map px per s): up and to the right, as the mockup's cluster leans; each puff ± spread of it. */
  vx: 17,
  vy: -28,
  spread: 0.35,
  /** A little sideways wobble (map px) and its period (ms). */
  wobble: 9,
  wobbleMs: 2600,
} as const;

/** The fountain's spout: drops jump from here (a share of the fountain's body box) and land in the upper bowl. */
export const FOUNTAIN = {
  spout: { x: 0.49, y: 0.06 },
  /** Where they land: this far below the spout (share of the box height), spread this wide (share of the width). */
  fall: 0.17,
  spread: 0.13,
  /** How high a drop jumps over the spout (map px). */
  rise: 14,
  everyMs: 150,
  lifeMs: 620,
  /** Drop size (map px). */
  size: 7,
  color: 0x8fc8ee,
} as const;

/** The cloud band drifts this slowly (map px per s). */
export const CLOUD_DRIFT = 5;

/** The dwarf at his door breathes (a share of his height, period ms). */
export const DWARF_BREATH = { amount: 0.012, ms: 1300 } as const;

/**
 * A building pressed [튜닝]: squashed this much while the finger is on it (a thumb covers most of a
 * small one, so it is a clear squash), springing back in popMs.
 */
export const PRESS = { squashX: 1.05, squashY: 0.92, popMs: 240 } as const;

/** A guest or the dwarf tapped: a little hop (map px up, ms) [튜닝]. */
export const HOP = { height: 10, ms: 260 } as const;
