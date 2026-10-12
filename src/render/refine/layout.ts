// 광석 정제 장면의 배치와 연출 숫자 (기획서 10.1 화면, 연출과 진동). The same workshop as the card
// craft (render/forge: bg_workshop, the dwarf's poses, the anvil, the furnace) at the same
// proportions, with the pile of lumps beside the anvil and fifteen spots on the floor round it
// where a batch's finds land. No PixiJS here: the React overlay reads it too. The game's numbers
// (tempo, batch, odds) are src/sim/data/refine.ts; these are only how it looks.

import {
  type ArtPoint,
  DEFAULT_ASPECT,
  PROP_ART,
  type Rect,
  SCENE_PLACE,
  strikeLift,
  strikeReach,
} from '../forge/layout.ts';
import type { RefineRarity } from '../../sim/data/refine.ts';

/** Width ÷ height of the refine pictures before they load (from meta.json). */
export const REFINE_ASPECT = { ore_chunk: 1.15, chunk_pile: 1.81 } as const;

/**
 * Where things stand (fractions of the scene box), as in the card craft (forge/layout.ts
 * SCENE_PLACE): the dwarf's head→foot height is dwarf.h of the height, at most dwarf.maxW of the
 * width, and the anvil (k of him) and the furnace are sized from him. The scene here is taller
 * than the craft's (no gauge band or hand under it), so he is a little smaller against its height.
 * The dwarf stands as high as puts his strike pose's hammer face on the lump's top and step of the
 * width left of where it lands on its middle (he leans that far in as he strikes). The lump sits
 * on the anvil's face, chunk.w of its width. The pile of lumps stands on the floor right of the
 * anvil, in front of the furnace: pile.w × the anvil's width at full size, its foot at x, y.
 */
export const REFINE_PLACE = {
  dwarf: { h: 0.44, maxW: 0.58, step: 0.02 },
  anvil: { x: 0.54, y: 0.75, k: SCENE_PLACE.anvil.k },
  furnace: { x: 0.93, y: 0.66, k: SCENE_PLACE.furnace.k },
  pile: { x: 0.83, y: 0.715, w: 1.15 },
  chunk: { w: 0.5 },
  /** A found item's box: this share of the anvil's width, between min and max px. */
  item: { k: 0.4, min: 30, max: 46 },
  /** The background's wall meets its floor at this share of its height (bg_workshop). */
  floor: SCENE_PLACE.floor,
  /** bg_workshop's width ÷ height (it covers the box). */
  bgAspect: DEFAULT_ASPECT.bg_workshop,
} as const;

/** The step between neighbouring spots in a row (anvil widths): wide enough that two amounts like '110G' don't touch. */
const SLOT_STEP = 0.42;

/**
 * The fifteen spots on the floor round the anvil where a batch's finds land, in the order they
 * fill (nearest the anvil first): dx from the anvil's foot and dy below it, in anvil widths.
 * Three rows fan out in front of the stump, the middle row set half a step over; the dwarf stands
 * behind the left ones.
 */
export const ITEM_SLOTS: readonly { dx: number; dy: number }[] = (
  [
    [0, 0.3],
    [1, 0.3],
    [-1, 0.3],
    [0.5, 0.62],
    [-0.5, 0.62],
    [2, 0.3],
    [-2, 0.3],
    [1.5, 0.62],
    [-1.5, 0.62],
    [0, 0.94],
    [1, 0.94],
    [-1, 0.94],
    [2.5, 0.62],
    [2, 0.94],
    [-2, 0.94],
  ] as const
).map(([k, dy]) => ({ dx: k * SLOT_STEP, dy }));

/**
 * The pile grows in steps with the lumps on it (10.1 '몇 단계로'): from `from` lumps it is drawn
 * at `scale` of its full size. Under the first step there is no pile.
 */
export const PILE_STEPS: readonly { from: number; scale: number }[] = [
  { from: 1, scale: 0.42 },
  { from: 30, scale: 0.6 },
  { from: 150, scale: 0.78 },
  { from: 400, scale: 0.94 },
  { from: 720, scale: 1.06 },
];

export function pileScale(lumps: number): number {
  let s = 0;
  for (const step of PILE_STEPS) if (lumps >= step.from) s = step.scale;
  return s;
}

/** The speech bubble: as on the craft screen (forge/layout.ts OVERLAY_PLACE.bubble). */
const BUBBLE = { dx: 0.3, dy: -0.92, maxW: 0.6, edge: 8, half: 30 };

export interface RefineLayout {
  w: number;
  h: number;
  /** The floor line of the background (px from the top). */
  floor: number;
  /** Feet point of the dwarf and his (idle) head→foot height. */
  dwarf: { x: number; y: number; bodyH: number };
  anvil: Rect;
  face: { x: number; y: number; w: number };
  furnace: Rect;
  /** The lump on the anvil: its middle x, its bottom (on the face), its size. */
  chunk: { x: number; y: number; w: number; h: number };
  /** Where the hammer lands: the top of the lump. */
  hit: ArtPoint;
  /** How far he leans in as he strikes (px). */
  lean: number;
  /** The pile's foot (bottom middle) and its width at full size. */
  pile: { x: number; y: number; w: number };
  /** A found item's box (px, square). */
  item: number;
  /** The item spots' middles, in the order they fill. */
  slots: ArtPoint[];
  bubble: { x: number; y: number; maxW: number };
}

export type RefineAspectKey = 'anvil' | 'furnace' | 'dwarf_strike' | 'ore_chunk' | 'chunk_pile';

/**
 * Pixel layout for a scene box w×h; `aspect` gives the loaded pictures' width÷height (the rest use
 * the defaults). The React overlay and the Pixi scene both place with it, so they agree.
 */
export function refineLayout(w: number, h: number, aspect: Partial<Record<RefineAspectKey, number>> = {}): RefineLayout {
  const P = REFINE_PLACE;
  const a = (k: RefineAspectKey): number =>
    aspect[k] ?? (k === 'ore_chunk' || k === 'chunk_pile' ? REFINE_ASPECT[k] : DEFAULT_ASPECT[k]);
  const body = Math.min(P.dwarf.h * h, P.dwarf.maxW * w);
  const prop = (place: { x: number; y: number; k: number }, ratio: number, foot: ArtPoint): Rect => {
    const ph = place.k * body;
    const pw = ph * ratio;
    return { x: place.x * w - foot.x * pw, y: place.y * h - foot.y * ph, w: pw, h: ph };
  };
  const anvil = prop(P.anvil, a('anvil'), PROP_ART.anvil.foot);
  const face = {
    x: anvil.x + PROP_ART.anvil.face.x * anvil.w,
    y: anvil.y + PROP_ART.anvil.face.y * anvil.h,
    w: PROP_ART.anvil.faceW * anvil.w,
  };
  const furnace = prop(P.furnace, a('furnace'), PROP_ART.furnace.foot);
  const chunkW = face.w * P.chunk.w;
  const chunkH = chunkW / a('ore_chunk');
  // The lump sits on the face a little sunk in (its outline meets the face's).
  const chunk = { x: face.x, y: face.y + chunkH * 0.06, w: chunkW, h: chunkH };
  const hit = { x: chunk.x, y: chunk.y - chunkH * 0.92 };
  // The background covers the box: its floor line, where nothing may stand above.
  const bgH = Math.max(h, w / P.bgAspect);
  const floor = h / 2 + (P.floor - 0.5) * bgH;
  const lean = P.dwarf.step * w;
  const footY = Math.min(h - 1, Math.max(floor + 2, hit.y + strikeLift() * body));
  const footX = hit.x - strikeReach(body, a('dwarf_strike')) - lean;
  const footA = { x: P.anvil.x * w, y: P.anvil.y * h };
  const item = Math.max(P.item.min, Math.min(P.item.max, P.item.k * anvil.w));
  const half = item / 2 + 3;
  const slots = ITEM_SLOTS.map((s) => ({
    x: Math.max(half, Math.min(w - half, footA.x + s.dx * anvil.w)),
    y: Math.min(h - half, footA.y + s.dy * anvil.w),
  }));
  const bubbleX = footX + BUBBLE.dx * body;
  return {
    w,
    h,
    floor,
    dwarf: { x: footX, y: footY, bodyH: body },
    anvil,
    face,
    furnace,
    chunk,
    hit,
    lean,
    pile: { x: P.pile.x * w, y: P.pile.y * h, w: P.pile.w * anvil.w },
    item,
    slots,
    bubble: {
      x: bubbleX,
      y: Math.max(BUBBLE.half + BUBBLE.edge, footY + BUBBLE.dy * body),
      maxW: Math.max(120, Math.min(BUBBLE.maxW * w, w - BUBBLE.edge - bubbleX)),
    },
  };
}

/** Where a pile of this many lumps has its top middle (the lump hops from there to the anvil). */
export function pileTop(l: RefineLayout, lumps: number): ArtPoint {
  const s = Math.max(PILE_STEPS[0]?.scale ?? 0.4, pileScale(lumps));
  const ph = (l.pile.w * s) / REFINE_ASPECT.chunk_pile;
  return { x: l.pile.x, y: l.pile.y - ph * 0.75 };
}

// ---------- Effects (ms, px at a 390-wide phone; the scene scales them) ----------

/**
 * A blow: the strike pose holds strikeShare of the beat (at most strikeMax ms), then the hammer
 * goes up again while the press is held (raise) or down (idle). A tap holds the strike tapMs.
 * The next lump hops from the pile to the anvil in hopShare of the beat (between hopMin and hopMax).
 * A rare find: he cheers for cheerMs. A very rare one: he stops and bends in over it (the work
 * pose, eyes open) for the pause (data/refine.ts REFINE_TEMPO.veryRarePauseMs), leaning in by
 * look × his step, then cheers for cheerMs if the next blow has not come.
 */
export const REFINE_BEAT = {
  strikeShare: 0.55,
  strikeMax: 130,
  tapMs: 150,
  hopShare: 0.72,
  hopMin: 80,
  hopMax: 170,
  cheerMs: 420,
  look: 1.6,
} as const;

/**
 * A find coming out (DOM, RefineStage): it pops up off the lump and arcs down onto its spot
 * (flyMs, arc × the item box high above the higher end), bounces once, and its amount pops over it.
 * When the batch is done (the finger lifts, or the fifteenth blow) the finds wait collectDelay
 * after the last one has landed, then fly into the bag or the gold (collectMs each, stagger apart).
 * A press that comes before they fly keeps them on the floor and adds to them.
 */
export const REFINE_ITEM_FX = {
  flyMs: 360,
  arc: 1.6,
  collectDelay: 280,
  collectMs: 460,
  stagger: 38,
  reducedMs: 160,
} as const;

/**
 * A rare find shows itself (DOM, RefineStage): it pops out up to `scale` × its size, `up` item
 * boxes above the lump, rising riseMs and holding there holdMs before it drops to its spot, while a
 * little tag over it names it for tagMs. A very rare one rises and holds while he stops to look
 * (data/refine.ts REFINE_TEMPO.veryRarePauseMs); a rare one only pops bigger on its way down, as the
 * hammer does not stop for it.
 */
export const REFINE_SHOWCASE: Record<'rare' | 'veryRare', { scale: number; up: number; riseMs: number; holdMs: number; tagMs: number }> = {
  rare: { scale: 1.5, up: 0, riseMs: 0, holdMs: 0, tagMs: 750 },
  veryRare: { scale: 2.3, up: 1.6, riseMs: 180, holdMs: 420, tagMs: 1300 },
};

/**
 * How a find shows its multiplier (10.1 '한 방의 크기'): from `from` it is drawn as n icons
 * heaped together instead of one, so a ×10 find looks bigger than a ×1 one, not only its label.
 */
export const REFINE_STACK: readonly { from: number; n: number }[] = [
  { from: 1, n: 1 },
  { from: 5, n: 2 },
  { from: 10, n: 3 },
];

export function stackOf(mult: number): number {
  let n = 1;
  for (const s of REFINE_STACK) if (mult >= s.from) n = s.n;
  return n;
}

/**
 * The amount over a find (px): `k` × the item box between min and max; a label of `long`
 * characters or more ('110G'; '×20' is 3) is drawn at longK of that, so neighbours never touch.
 */
export const REFINE_LABEL = { k: 0.34, min: 11, max: 15.5, long: 4, longK: 0.84 } as const;

export function amountFontPx(item: number, label: string): number {
  const base = Math.max(REFINE_LABEL.min, Math.min(REFINE_LABEL.max, item * REFINE_LABEL.k));
  return label.length >= REFINE_LABEL.long ? Math.max(REFINE_LABEL.min * 0.9, base * REFINE_LABEL.longK) : base;
}

/** The flat comic star of a blow by rarity: size (px at unit 1), sparks, and how far they fly. */
export const REFINE_BURST: Record<RefineRarity, { size: number; sparks: number; power: number; ring: number }> = {
  common: { size: 54, sparks: 9, power: 0.85, ring: 0 },
  uncommon: { size: 62, sparks: 12, power: 0.95, ring: 4 },
  rare: { size: 98, sparks: 20, power: 1.2, ring: 12 },
  veryRare: { size: 150, sparks: 30, power: 1.45, ring: 20 },
};

/** The whole stage shakes (DOM, so the finds on the floor shake with it): px and ms by rarity. Off for reduced motion. */
export const REFINE_SHAKE: Record<RefineRarity, { px: number; ms: number }> = {
  common: { px: 2, ms: 90 },
  uncommon: { px: 2.5, ms: 110 },
  rare: { px: 6, ms: 230 },
  veryRare: { px: 10, ms: 380 },
};

/** Flat colours (Pixi tints) of a blow's star and ✦ by rarity, and of the lump's crumbs. */
export const REFINE_TINT = {
  burst: { common: 0xffe066, uncommon: 0xbfe7a8, rare: 0x9fd2f5, veryRare: 0xc9b0f2 } as Record<RefineRarity, number>,
  twinkle: {
    common: [0xffe07a],
    uncommon: [0xbfe7a8, 0xffffff],
    rare: [0xffffff, 0xcfeaff, 0x9fd2f5],
    veryRare: [0xffffff, 0xd9c8f7, 0xb48cf0, 0xfff2b8],
  } as Record<RefineRarity, readonly number[]>,
  crumbs: [0x8f8174, 0x7a6d61, 0xa49686],
  dust: 0xd8cfc4,
  sun: 0xfff0b0,
} as const;
