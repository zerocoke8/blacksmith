// 카드 제작 장면의 배치, 그림 기준점, 연출 시간과 색 (화면 쪽 숫자는 모두 여기에).
// The art arrives as src/assets/art/<scene|ui|cards>/<key>.webp; when a picture changes
// (a new crop, a different pose), only the numbers here move. No PixiJS here: React reads
// this file too, and it must not pull the renderer into the first load.
// The art is the doodle style (tools/art/assets.ts): flat colours under a fat dark-brown line, so
// the effects are flat outlined shapes too (procedural.ts), never soft glows.

import type { WeaponType } from '../../sim/core/types.ts';
import type { CardId, FireState } from '../../sim/data/cards.ts';

// ---------- Asset manifest ----------

export const SCENE_ART_KEYS = [
  'bg_workshop',
  'dwarf_idle',
  'dwarf_raise',
  'dwarf_strike',
  'dwarf_work',
  'dwarf_cheer',
  'dwarf_slump',
  'anvil',
  'furnace',
  'bellows',
  'quench',
  'iron_hot',
  'iron_cracked',
  'iron_cold',
  'weapon_oneHandSword',
  'weapon_greatsword',
  'weapon_dagger',
  'weapon_bow',
  'weapon_crossbow',
  'weapon_staff',
] as const;
export type SceneArtKey = (typeof SCENE_ART_KEYS)[number];

export const UI_ART_KEYS = [
  'frame_progress',
  'frame_quality',
  'frame_support',
  'frame_material',
  'frame_imprint',
  'card_back',
  'orb_durability',
  'btn_reheat',
  'pile_draw',
  'pile_discard',
  'pile_exhaust',
  'fire_normal',
  'fire_good',
  'fire_excellent',
  'fire_poor',
  'fire_sturdy',
  'fire_surge',
  'fire_malleable',
  'fire_goodOmen',
  'icon_heat',
  'icon_progress',
  'icon_quality',
] as const;
export type UiArtKey = (typeof UI_ART_KEYS)[number];

/** idle at rest, raise → strike for a blow, work for careful work, cheer when it is done, slump when it fails. */
export type DwarfPose = 'idle' | 'raise' | 'strike' | 'work' | 'cheer' | 'slump';
export const DWARF_POSES: readonly DwarfPose[] = ['idle', 'raise', 'strike', 'work', 'cheer', 'slump'];

/** A point in a picture as fractions of its width and height (0,0 = top left). */
export interface ArtPoint {
  x: number;
  y: number;
}

// ---------- Where each picture is pinned (fractions of the delivered, trimmed picture) ----------

/**
 * Dwarf poses. The six pictures were drawn on one canvas at one scale (1227×1282), so the scene
 * shows them all at one scale too: src = the picture's height on that canvas (px, meta.json
 * trim.h; the scene reads meta.json and falls back to this), and the idle pose's head→foot sets
 * the dwarf's size. A pose that leans or slumps is shorter, one that lifts the hammer taller,
 * as drawn. foot = the point between the boots on the floor (the scene keeps it still between
 * poses), head = top of the hair (y; the idle pose's sets the size). hammer = the middle of the
 * striking (bottom) face of the hammer head in the strike pose: the dwarf stands as high as makes
 * it land on the top of the hot bar (sceneLayout), and steps in so it lands on the bar's middle.
 * reach = the whetstone's tip in the work pose (he steps in and bends toward the iron by tilt,
 * radians). Measured on the delivered pictures; re-measure if a pose is redrawn.
 */
export const DWARF_POSE_ART: Record<DwarfPose, { foot: ArtPoint; head: number; src: number; hammer?: ArtPoint; reach?: ArtPoint; tilt?: number }> = {
  idle: { foot: { x: 0.53, y: 0.995 }, head: 0.003, src: 815 },
  raise: { foot: { x: 0.47, y: 0.995 }, head: 0.155, src: 1006 },
  strike: { foot: { x: 0.29, y: 0.995 }, head: 0.003, src: 761, hammer: { x: 0.9, y: 0.765 } },
  work: { foot: { x: 0.38, y: 0.995 }, head: 0.003, src: 788, reach: { x: 0.95, y: 0.57 }, tilt: 0.12 },
  cheer: { foot: { x: 0.5, y: 0.995 }, head: 0.003, src: 814 },
  slump: { foot: { x: 0.43, y: 0.995 }, head: 0.003, src: 762 },
};

/** Pose to use when a pose picture is missing (raise stands in for cheer: arms up). */
export const DWARF_POSE_FALLBACK: Record<DwarfPose, DwarfPose[]> = {
  idle: [],
  raise: ['idle'],
  strike: ['idle'],
  work: ['idle'],
  cheer: ['raise', 'idle'],
  slump: ['idle'],
};

/** A pose's picture height for a dwarf of head→foot height 1 (the poses share one scale: DWARF_POSE_ART src). */
export function poseHeight(p: DwarfPose): number {
  const i = DWARF_POSE_ART.idle;
  return DWARF_POSE_ART[p].src / ((i.foot.y - i.head) * i.src);
}

/** How far above the feet the strike pose's hammer face is, as a share of the dwarf's (idle) head→foot height. */
export function strikeLift(): number {
  const s = DWARF_POSE_ART.strike;
  return (s.foot.y - (s.hammer?.y ?? s.foot.y)) * poseHeight('strike');
}

/** How far right of the feet the strike pose's hammer face is (px), for a dwarf bodyH tall whose strike picture is aspect wide÷tall. */
export function strikeReach(bodyH: number, aspect: number): number {
  const s = DWARF_POSE_ART.strike;
  return ((s.hammer?.x ?? s.foot.x) - s.foot.x) * aspect * poseHeight('strike') * bodyH;
}

/** Where on the bar the hammer lands: this share of the bar's width left of its middle. */
export const STRIKE_AT = 0.08;

export const PROP_ART = {
  /** foot = bottom middle of the stump on the floor; face = middle of the anvil's flat top, faceW its width. */
  anvil: { foot: { x: 0.59, y: 0.99 }, face: { x: 0.64, y: 0.012 }, faceW: 0.62 },
  /**
   * mouth = middle of the fire in the arch (embers rise from here, the iron goes in here); arch =
   * a box round the dark opening (left, right, top, floor): the scene finds the opening's own shape
   * inside it on the picture (procedural.ts furnaceMouth, from the mouth point) and paints the
   * painted flames over in the opening's dark, so it can draw the fire's state; flame = the drawn
   * flame's base middle and its size at 보통 (shares of the picture), its width growing by grow ×
   * (power − 1) with the fire; top = the chimney's top edge.
   */
  furnace: {
    foot: { x: 0.55, y: 0.99 },
    mouth: { x: 0.43, y: 0.74 },
    arch: { x0: 0.2, x1: 0.65, top: 0.5, bottom: 0.87 },
    flame: { x: 0.43, y: 0.835, w: 0.27, h: 0.21, grow: 0.14 },
    top: 0.01,
  },
  /** nozzle = the tip that points at the fire. */
  bellows: { foot: { x: 0.47, y: 0.99 }, nozzle: { x: 0.98, y: 0.58 } },
  /** water = middle of the water surface. */
  quench: { foot: { x: 0.33, y: 0.99 }, water: { x: 0.36, y: 0.26 } },
  /**
   * The bar in the hot iron picture (iron_cracked and iron_cold are processed onto the same canvas,
   * so the same ends and bottom; they are drawn a little thinner): left and right ends, top and
   * bottom edges (the bottom lies on the anvil's face). The sparkles drawn round it are outside
   * the box. crack = where the split bar's crack runs (share of the picture's width): the scene
   * cuts iron_cracked there into two halves that part when it splits. Measured by the art pipeline
   * (meta.json anchors; layout.test.ts checks these against it).
   */
  iron: { bar: { x0: 0.003, x1: 0.925, y0: 0.471, y1: 0.987 }, crack: 0.46 },
} as const;

/**
 * The bar splitting (쇠가 갈라졌다): the two halves of iron_cracked part by gap × the bar's width
 * and the right one tips down by tilt (radians), over the first part share of the break.
 */
export const IRON_SPLIT = { gap: 0.08, tilt: 0.08, part: 0.12 } as const;

/**
 * The quench (담금질): the bar lifts off the anvil in an arc lift × the anvil's height high, into
 * the tub's water at scale, out of sight there (the steam and the drops rise off the water), and
 * back; out = the share of the motion it takes to get there, back = where it sets off back.
 */
export const QUENCH_DIP = { lift: 0.45, scale: 0.6, out: 0.3, back: 0.55 } as const;

/**
 * Finished weapons are drawn on a diagonal: from = the butt (pommel, grip end, bow's lower tip,
 * crossbow stock), to = the tip. The scene turns the picture so that line lies across the anvil,
 * tip to the right (flip mirrors a picture whose tip points left first); len = its length as a
 * share of the anvil's width, so a dagger lies small and a greatsword long.
 */
export const WEAPON_ART: Record<WeaponType, { from: ArtPoint; to: ArtPoint; flip?: boolean; len: number }> = {
  oneHandSword: { from: { x: 0.08, y: 0.92 }, to: { x: 0.96, y: 0.04 }, len: 1.15 },
  greatsword: { from: { x: 0.07, y: 0.93 }, to: { x: 0.95, y: 0.05 }, len: 1.4 },
  dagger: { from: { x: 0.1, y: 0.89 }, to: { x: 0.96, y: 0.05 }, len: 0.8 },
  bow: { from: { x: 0.06, y: 0.96 }, to: { x: 0.95, y: 0.04 }, len: 1.2 },
  crossbow: { from: { x: 0.07, y: 0.9 }, to: { x: 0.82, y: 0.2 }, len: 1.05 },
  staff: { from: { x: 0.08, y: 0.97 }, to: { x: 0.68, y: 0.08 }, len: 1.35 },
};

/**
 * How he takes a finished weapon: he cheers (the cheer pose) from cheerFrom ★, legendary or not
 * (a legendary one has its sunburst; his face follows the line he says, ui/cards/text.ts TIER_LINE);
 * under that he looks at it quietly (idle) and gives one small nod, nod = how
 * far he dips (share of his height), nodTilt = how far he leans in (radians), at nodAt..nodTo of
 * the 완성 motion.
 */
export const DONE_POSE = { cheerFrom: 4, nod: 0.04, nodTilt: 0.05, nodAt: 0.45, nodTo: 0.72 } as const;

/** The drawn stand-in weapon (procedural.ts weapon) lies flat, tip to the right. */
export const WEAPON_STANDIN = { from: { x: 0.03, y: 0.5 }, to: { x: 0.97, y: 0.5 } } as const;

/**
 * How the weapon lies on the anvil: a slight tilt (radians), its middle above the face (share of
 * the anvil's width), and its butt no further left than butt × the face's width left of the face's
 * middle, so the hilt lies on the anvil and clear of the dwarf's beard; a long blade reaches out
 * over the furnace instead (weaponRest).
 */
export const WEAPON_REST = { tilt: -0.1, lift: 0.1, butt: 0.42 } as const;

/** Width ÷ height for pictures not loaded yet (the procedural stand-ins use the same). */
export const DEFAULT_ASPECT: Record<SceneArtKey, number> = {
  bg_workshop: 1.5,
  dwarf_idle: 0.875,
  dwarf_raise: 0.576,
  dwarf_strike: 0.869,
  dwarf_work: 0.737,
  dwarf_cheer: 0.815,
  dwarf_slump: 0.946,
  anvil: 1.127,
  furnace: 0.886,
  bellows: 1.724,
  quench: 1.343,
  iron_hot: 2.47,
  iron_cracked: 2.47,
  iron_cold: 2.47,
  weapon_oneHandSword: 1,
  weapon_greatsword: 1.04,
  weapon_dagger: 1.01,
  weapon_bow: 0.94,
  weapon_crossbow: 1.12,
  weapon_staff: 0.72,
};

// ---------- Where things stand in the scene (fractions of the scene box) ----------

/**
 * The dwarf sets the scale: his head→foot height is dwarf.h of the scene's height, at most
 * dwarf.maxW of its width (a tall, narrow scene). Everything else is sized from him,
 * as drawn together: the anvil (on its stump) k = 0.39 of him, its face at his waist; the furnace
 * 1.3 of him. x, y = where a picture's foot point lands. The scene box is what the table's rows
 * leave between the top band and the gauge band (TABLE_ROWS: about 390×430 on a 390×844 phone,
 * 360×260 on a 360×640 one); nothing of the HUD covers it.
 * Depth: the background's floor meets its wall at floor (0.53) of its height, and everything
 * stands on the floor below that line. The anvil stands in front; the dwarf a step behind it,
 * exactly as high as puts the strike pose's hammer face on the hot bar's top, and as far left as
 * puts it on the bar's middle less dwarf.step of the scene's width, the step he takes in as he
 * strikes (sceneLayout); the furnace a step back on the right (its right side may leave the box);
 * the bellows and the tub in front, the bellows' nozzle at the furnace's fire. The anvil's foot is
 * well above the box's bottom: while a card is lifted the gauge band rises over the scene's floor
 * (TABLE_ROWS.riseShare), and the iron and the dwarf stay in sight over it.
 */
export const SCENE_PLACE = {
  /** maxWide: a pose drawn wider than the idle one (the raised arm, the bow) may take this × maxW of the width. */
  dwarf: { h: 0.52, maxW: 0.56, step: 0.03, maxWide: 1.4 },
  anvil: { x: 0.56, y: 0.79, k: 0.39 },
  furnace: { x: 0.9, y: 0.72, k: 1.3 },
  bellows: { x: 0.72, y: 0.85, k: 0.2 },
  quench: { x: 0.065, y: 0.93, k: 0.21 },
  /** Hot bar width as a share of the anvil face. */
  iron: { w: 0.88 },
  /** How far the dwarf may lean (share of scene width) so the hammer or the whetstone meets the iron. */
  lunge: 0.12,
  /** The whetstone (work pose) meets the bar this share of its width left of its middle; the polish glint starts there. */
  workReach: 0.42,
  /** The background's wall meets its floor at this share of its height (bg_workshop). */
  floor: 0.53,
} as const;

/**
 * DOM overlay over the scene: the speech bubble, the played card's hover point and the floating
 * numbers. The gauges and the fire's state are not over the scene but in the gauge band under it
 * (TABLE_ROWS), right over the cards; the furnace shows its state by its flame.
 */
export const OVERLAY_PLACE = {
  /**
   * Bubble: its left edge and vertical middle, from the dwarf's feet point, as shares of the
   * dwarf's head→foot height (right of the head, over the open wall before the furnace). It is
   * kept edge px inside the scene, its middle at least half px from the top and the bottom.
   */
  bubble: { dx: 0.3, dy: -0.88, maxW: 0.6, edge: 8, half: 30 },
  /**
   * Where a played card hovers while its effect starts (its centre): above and right of the
   * iron, clear of the hammer's path and the blow. x from the iron as a share of the width; the
   * card fits between top px under the scene's top edge and the iron.
   */
  cardHover: { dx: 0.19, top: 8 },
  /**
   * Floating numbers (공정 +100 …) rise just right of where the hammer lands and read rightward
   * (x is their left edge), so they never reach back over the dwarf's face at the blow (his face
   * is left of his hammer in every pose): x = the hammer's landing point (STRIKE_AT) + dx × the
   * bar's width, the first number lift × the scene's height over the bar's top edge, each next
   * one of the same beat step px higher and slant × the bar's width further right (a short
   * diagonal, up and away from him). A short scene squeezes lift and step so the stack stays top
   * px under the scene's top edge. Then each one is drawn down into its bar in the gauge band
   * (FLOAT_FLIGHT).
   */
  floats: { dx: 0.14, lift: 0.14, step: 26, slant: 0.22, top: 8 },
} as const;

/**
 * A floating number's life (ms): it pops up by the anvil, rises a little and holds until `fly`
 * of its life, then is drawn into its bar (공정, 품질), the 열기 badge or the durability orb,
 * arriving at `absorb`, where the bar flashes; the numbers of one beat follow each other by
 * stagger. Its target is taken when it sets off (the band may have moved meanwhile). On the way
 * the text shrinks into a little outlined star (spark px wide), so only the star lands on the
 * bar's own number. Reduced motion: no flight, it shows for reducedMs where it rose, brightest
 * (and the bar flashing) at reducedPeak of that.
 */
export const FLOAT_FLIGHT = { ms: 1250, fly: 0.56, absorb: 0.86, stagger: 90, spark: 12, reducedMs: 940, reducedPeak: 0.15 } as const;

/**
 * The art table's rows, top to bottom (ui/cards/tableLayout.ts tableRows): the top band, the
 * scene, the gauge band (공정·품질 bars, ★ marks, 열기, the fire's state), the hand and the bottom
 * row (durability orb, piles, 다시 달구기), px. A screen under shortH px gets the short sizes.
 * The hand is sized from the width (a full hand's cards, about 0.28 of it, 2:3, and the hint
 * line over them); the scene takes the rest, down to sceneMin, then the hand gives way down to
 * its min. While a card is lifted, the gauge band rises over the scene's floor just enough to
 * stay over the lifted card (riseGap px above it), at most riseShare of the scene's height (the
 * lifted card is laid out smaller when that is not enough). With the band held still (실험 패널),
 * the lifted card stays in the hand's row instead, riseGap px under the band.
 */
export const TABLE_ROWS = {
  shortH: 700,
  top: 50,
  topShort: 46,
  band: 84,
  bandShort: 72,
  foot: 80,
  footShort: 72,
  hand: { k: 0.42, add: 36, min: 150, max: 262 },
  sceneMin: 170,
  riseGap: 6,
  riseShare: 0.3,
  /** The chips over the band (풀무질 2턴, 다음 화로 …) take about this much of the scene's floor. */
  ledge: 22,
} as const;


export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayout {
  w: number;
  h: number;
  /** Feet point of the dwarf and his (idle) head→foot height, px. */
  dwarf: { x: number; y: number; bodyH: number };
  anvil: Rect;
  /** Anvil working face: centre point and width. */
  face: { x: number; y: number; w: number };
  furnace: Rect;
  mouth: ArtPoint;
  furnaceTop: ArtPoint;
  bellows: Rect;
  nozzle: ArtPoint;
  quench: Rect;
  water: ArtPoint;
  /** The hot bar: its middle (where blows land), its width and height (the bar, not the picture). */
  iron: { x: number; y: number; w: number; h: number };
  bubble: { x: number; y: number; maxW: number };
  /** Centre of a played card while it hovers over the scene, and the most height it may take. */
  cardHover: ArtPoint & { maxH: number };
}

/**
 * Pixel layout of the scene for a box of w×h. `aspect` gives the loaded pictures' width÷height
 * (missing keys use DEFAULT_ASPECT). React places the overlay with it; the Pixi scene places the
 * sprites with it, so both agree.
 */
export function sceneLayout(w: number, h: number, aspect: Partial<Record<SceneArtKey, number>> = {}): SceneLayout {
  const a = (k: SceneArtKey) => aspect[k] ?? DEFAULT_ASPECT[k];
  const P = SCENE_PLACE;
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
  const bellows = prop(P.bellows, a('bellows'), PROP_ART.bellows.foot);
  const quench = prop(P.quench, a('quench'), PROP_ART.quench.foot);
  // The bar lies on the face; the picture around it is sized from the bar.
  const bar = PROP_ART.iron.bar;
  const ironW = face.w * P.iron.w;
  const ironH = (ironW / (bar.x1 - bar.x0) / a('iron_hot')) * (bar.y1 - bar.y0);
  const ironY = face.y - ironH / 2;
  // The dwarf stands as high as puts the strike pose's hammer face on the bar's top, on the floor,
  // and a step left of where it lands on the bar's middle.
  const footY = Math.min(h - 1, Math.max(P.floor * h + 2, face.y - ironH + strikeLift() * body));
  const footX = face.x - ironW * STRIKE_AT - strikeReach(body, a('dwarf_strike')) - P.dwarf.step * w;
  const furnaceTop = { x: furnace.x + furnace.w / 2, y: furnace.y + PROP_ART.furnace.top * furnace.h };
  // The played card hovers between the scene's top and the iron, so neither the numbers nor the blow hide.
  const hoverFrom = OVERLAY_PLACE.cardHover.top;
  const hoverH = Math.max(40, ironY - ironH * 0.7 - hoverFrom);
  const bub = OVERLAY_PLACE.bubble;
  const bubbleX = footX + bub.dx * body;
  const bubbleLow = Math.max(bub.half + bub.edge, h - bub.half - bub.edge - TABLE_ROWS.ledge);
  return {
    w,
    h,
    dwarf: { x: footX, y: footY, bodyH: body },
    anvil,
    face,
    furnace,
    mouth: { x: furnace.x + PROP_ART.furnace.mouth.x * furnace.w, y: furnace.y + PROP_ART.furnace.mouth.y * furnace.h },
    furnaceTop,
    bellows,
    nozzle: { x: bellows.x + PROP_ART.bellows.nozzle.x * bellows.w, y: bellows.y + PROP_ART.bellows.nozzle.y * bellows.h },
    quench,
    water: { x: quench.x + PROP_ART.quench.water.x * quench.w, y: quench.y + PROP_ART.quench.water.y * quench.h },
    iron: { x: face.x, y: ironY, w: ironW, h: ironH },
    cardHover: { x: Math.min(w - 50, face.x + OVERLAY_PLACE.cardHover.dx * w), y: hoverFrom + hoverH / 2, maxH: hoverH },
    bubble: {
      x: bubbleX,
      // Its middle stays clear of the scene's top and of the chips over the gauge band.
      y: Math.min(bubbleLow, Math.max(bub.half + bub.edge, footY + bub.dy * body)),
      maxW: Math.max(120, Math.min(bub.maxW * w, w - bub.edge - bubbleX)),
    },
  };
}

/** Numbers a beat can stack (공정, 품질, 열기, 내구도). */
const FLOAT_STACK = 4;

/** Where the strike pose's hammer lands on the bar (x, scene px): STRIKE_AT of its width left of its middle. */
export function hammerX(l: SceneLayout): number {
  return l.iron.x - l.iron.w * STRIKE_AT;
}

/**
 * Where the floating number of this order (0 = the beat's first) starts: its left edge x and top
 * y in the scene box (px), under the scene's top edge.
 */
export function floatAt(l: SceneLayout, order: number): ArtPoint {
  const f = OVERLAY_PLACE.floats;
  const top = l.iron.y - l.iron.h / 2;
  const room = top - f.top;
  const lift = f.lift * l.h;
  const k = Math.max(0.3, Math.min(1, room / (lift + f.step * (FLOAT_STACK - 1))));
  const i = order % FLOAT_STACK;
  return { x: hammerX(l) + (f.dx + i * f.slant) * l.iron.w, y: top - k * (lift + i * f.step) };
}

/**
 * Where the finished weapon's middle lies (scene px) for a weapon len px long: over the anvil's
 * face, moved right as far as keeps its butt at most WEAPON_REST.butt × the face's width left of
 * the face's middle.
 */
export function weaponRest(l: SceneLayout, len: number): ArtPoint {
  const r = WEAPON_REST;
  const half = (len / 2) * Math.cos(r.tilt);
  const x = Math.max(l.face.x - l.face.w * 0.05, l.face.x - l.face.w * r.butt + half);
  return { x, y: l.face.y - l.anvil.w * r.lift };
}

// ---------- Effect timing (ms) ----------

/** One motion: total length and the share of it where the blow lands (bars move then). */
export interface FxTiming {
  ms: number;
  hit: number;
}

export const FX_TIMING = {
  strike: { ms: 680, hit: 0.42 },
  /** A legendary material (거인의 망치 …): a slower raise while the iron glows and holds, a heavier blow. */
  strikeBig: { ms: 1150, hit: 0.62 },
  polish: { ms: 620, hit: 0.45 },
  finish: { ms: 860, hit: 0.45 },
  bellows: { ms: 560, hit: 0.35 },
  quench: { ms: 700, hit: 0.3 },
  infuse: { ms: 760, hit: 0.5 },
  infuseBig: { ms: 980, hit: 0.5 },
  fire: { ms: 520, hit: 0.4 },
  focus: { ms: 440, hit: 0.4 },
  imprint: { ms: 1000, hit: 0.3 },
  reheat: { ms: 760, hit: 0.62 },
  turn: { ms: 240, hit: 0.2 },
  turnFire: { ms: 520, hit: 0.35 },
  shuffle: { ms: 0, hit: 0 },
  complete: { ms: 1500, hit: 0.28 },
  completeBig: { ms: 1900, hit: 0.28 },
  break: { ms: 1300, hit: 0.25 },
} satisfies Record<string, FxTiming>;

/** A card with two motions (공정과 품질) starts the second at this share of the first. */
export const FX_SECOND_AT = 0.32;
/** A legendary material starts its blow at this share of its glow (the glow holds while he raises). */
export const FX_LEGENDARY_STRIKE_AT = 0.4;
/** Motions per card at most (the first is the main one). */
export const FX_MAX_MOTIONS = 2;
/** Cards waiting to be shown speed the show up: ×(1 + per × waiting), at most max. */
export const FX_SPEEDUP = { per: 0.65, max: 3 };
/** Reduced motion: every effect this much shorter. */
export const FX_REDUCED = 0.6;

/**
 * Screen shake (px, ms). Off for reduced motion. thump: one low drop and settle of the whole
 * scene under a legendary blow (px, ms).
 */
export const SHAKE = { strike: 5, heavy: 9, break: 6, ms: 220, thump: 7, thumpMs: 460 };

/**
 * Card flight from the hand (ms): to the iron, a moment there, then to its pile. A 소멸 card
 * burns away where it hovers instead (burn ms, with this many embers).
 */
export const CARD_FLIGHT = { toScene: 260, hold: 90, toPile: 300, dealStagger: 70, deal: 360, burn: 640, embers: 12 };

/** After the last effect of a finished craft, how long before the result screen (ms). */
export const END_HOLD_MS = 1600;

/** The art table's other timings (ms), and how many floating numbers stay on screen. */
export const TABLE_TIMING = {
  /** The dwarf's closing line comes this long after the iron is done (the numbers clear first). */
  lineAfterEnd: 700,
  /**
   * The end banner comes this long after the last blow lands: the hand has sunk away under it
   * (art.css .ft-hand.ended, 0.45s) and the weapon (or the split bar) lies on the anvil.
   */
  bannerAfterEnd: 480,
  /** The longest the finished table waits for its effects before the result screen. */
  endSafety: 9000,
  /** How long a dwarf line stays. */
  say: 3600,
  /** Reduced motion: the finished iron stays this long instead of END_HOLD_MS. */
  endHoldReduced: 700,
  floatersKept: 10,
} as const;

/**
 * The hand (ArtHand). A card is as wide as a full hand allows: each card under another shows
 * `show` of its width (its cost gem and the first letters of its name, which starts at the left
 * of the band), between minW and maxW px and at most maxShare of the hand's width; small hands
 * keep big cards. Neighbours turn spread° apart, the ends at most maxFan° from the middle.
 * The lifted card is laid out about liftW px wide (at least ×minLift, at most maxLiftShare of
 * the hand's width), so its text is read at that size, and rises liftUp of its height.
 */
export const HAND_FAN = {
  minW: 96,
  maxW: 150,
  maxShare: 0.33,
  show: 0.58,
  spread: 3,
  maxFan: 4.5,
  /** Room over the cards for the hint line, the side margin and the room under the cards (px). */
  top: 34,
  margin: 6,
  bottom: 4,
  liftW: 196,
  minLift: 1.25,
  maxLiftShare: 0.56,
  liftUp: 0.04,
  /** Neighbours of the lifted card step aside by push × a card width, falloff less per card further away. */
  push: 0.42,
  pushFalloff: 0.08,
  /** A finger moving this far (px) is a drag, not a tap; a drag let go this far over the hand plays. */
  dragPx: 10,
  playLinePx: 18,
  /** About how wide the lifted card's tip is (px): near the screen's edges it lines up with the card's side. */
  tipW: 270,
  /** Lift and drop (ms), the same as the slot's CSS transition (art.css .ah-slot). */
  liftMs: 240,
} as const;

// ---------- Colours ----------
// Flat colours under the art's dark-brown line: the hot bar is painted in one flat colour by its
// heat, the effects are flat shapes in these colours with an INK outline (procedural.ts).

/** The outline of every drawn effect shape, the art's own line colour. */
export const INK = 0x3b2a20;

/** The hot bar's flat colour by 열기 0..10: deep red when it has little heat, orange, then yellow at white heat. */
export const HEAT_TINT: readonly number[] = [
  0xb9412f, 0xc54a30, 0xd15532, 0xdc6334, 0xe67337, 0xee843b, 0xf49641, 0xf8a849, 0xfbba55, 0xfdcb63, 0xffdc78,
];

/** The bar gone cold (quenched, split, put down): flat iron grey. */
export const IRON_COLD = 0x8e8984;

/**
 * The furnace's flame per 화로 상태: the colour of the flat flame drawn in its mouth (as in the
 * fire_<state> icons) and its size (1 = 보통). The flame's core is the colour mixed with white.
 */
export const FIRE_FLAME: Record<FireState, { color: number; power: number }> = {
  normal: { color: 0xff9a4a, power: 1 },
  good: { color: 0xffc23a, power: 1.25 },
  excellent: { color: 0xfff0c4, power: 1.5 },
  poor: { color: 0x9db4cc, power: 0.6 },
  sturdy: { color: 0xf5934a, power: 0.95 },
  surge: { color: 0xf25a48, power: 1.45 },
  malleable: { color: 0xf49aa8, power: 1.1 },
  goodOmen: { color: 0xffa94a, power: 1.05 },
};

/** The metal's colour the bar takes for a moment when a material card is played (and its sparkles). */
export const METAL_TINT: Partial<Record<CardId, number>> = {
  ironMelt: 0xff9a50,
  steelFold: 0xcfe2ff,
  mithrilGrain: 0x9fe0f5,
  orichalcumGlow: 0xffc84a,
  adamantCore: 0xb48cf0,
  dragonBreath: 0xf25a48,
  rekindle: 0xffa33a,
  giantHammer: 0xc8925a,
  layeredShell: 0x9fd07a,
  stormBellows: 0x7fd6e0,
  tailwind: 0xd0f2c4,
  deepWater: 0x6aa6f0,
  frostFinish: 0xc8ecff,
};

/** Fill colours of the effect shapes (all drawn white under an INK outline and tinted). */
export const FX_COLOR = {
  /** Sparks off a blow: little stars, crosses and drops. */
  spark: [0xffc24a, 0xff9a3a, 0xffe07a],
  /** 품질: sky-blue and white ✦. */
  silver: [0xffffff, 0xcfeaff, 0x9fd2f5],
  /** 마무리, 완성, 걸작: gold ✦. */
  gold: [0xfff2b8, 0xffe27a, 0xffc94a],
  rune: [0xc4a4f4, 0x9f78e6],
  /** The comic impact star at a blow. */
  impact: 0xffe066,
  steam: 0xfbf7ef,
  smoke: 0xa39b94,
  /** The air the bellows push. */
  wind: 0xf6f1e6,
  /** Drops flying off the quench. */
  water: 0x9fd2f5,
  crack: 0xd9503a,
  /** The sparks off a split bar: the crack's red and an ember orange. */
  crackSparks: [0xd9503a, 0xf59a50],
  /** The flat sunburst behind a 걸작 or a legendary weapon. */
  burst: 0xffe7a0,
  /** The pale colour a bar takes for a moment as it is struck, polished, finished, fanned, reheated. */
  flash: { strike: 0xfff6d8, polish: 0xe8f6ff, finish: 0xfff0b0, bellows: 0xffd890, reheat: 0xffe0a0 },
  /** The metal colour of a material card with no METAL_TINT entry (a blow; a soak). */
  metalDefault: { strike: 0xffb060, infuse: 0xffc080 },
} as const;

// ---------- Card face (fractions of the card: x, w of its width; y, h of its height) ----------

/** Cards are 2:3 like the frame pictures. */
export const CARD_ASPECT = 2 / 3;

/**
 * Boxes on the card face: the cream insides of the doodle frame_<kind> pictures (measured on the
 * delivered, trimmed pictures, which all share one layout within 1%; the picture is stretched to
 * the 2:3 card): the round cost bubble at the top-left corner (centre cx, cy and diameter d as a
 * share of the width; the cost is written in it), the name band, the picture window (the card art
 * is cut to fill it, inside the window's line), the kind ribbon and the text box. The CSS frame
 * draws the same boxes, so a frame picture can be swapped in without moving anything else.
 */
export const CARD_FACE = {
  cost: { cx: 0.131, cy: 0.089, d: 0.215 },
  /** The name starts at the band's left end, just right of the bubble, so a card half under another still shows it. */
  name: { x: 0.27, y: 0.073, w: 0.64, h: 0.061 },
  art: { x: 0.084, y: 0.175, w: 0.84, h: 0.346 },
  ribbon: { x: 0.231, y: 0.55, w: 0.545, h: 0.044 },
  text: { x: 0.078, y: 0.621, w: 0.856, h: 0.326 },
} as const;

/** A mini card (the top of a card: cost, name band and picture) is cut just under the picture window's line. */
export const CARD_MINI_CUT = 0.545;

/**
 * Type on the card (px, at the card's own size): the base is base × the card's width; names,
 * rules text and notes never go under their floors (small phones), names shrink only to fit
 * their band. The kind's name in the ribbon is ribbon × the base, at least ribbonMin px and at
 * most as tall as the ribbon. Long rules text (more than longText, or veryLong characters) steps
 * down and may take a fifth line; the text gets as many whole lines as its box holds over the
 * keywords and the note (the last one ends in …, the long-press sheet has all of it). Keywords
 * (소멸, 첫 손 …) are ink pills under the text on cards at least keysMinW wide; on smaller cards
 * they stay in the text, where they take less room. A card half under the next one in the fan
 * wraps a short text cutPad px inside the strip that shows.
 */
export const CARD_TYPE = {
  base: 0.088,
  cutPad: 3,
  nameMin: 10.5,
  textMin: 10.5,
  noteMin: 10,
  keyMin: 10,
  keysMinW: 140,
  ribbon: 0.62,
  ribbonMin: 7,
  longText: 30,
  veryLong: 40,
  /** Line height of the rules text (card.css .gc-text, the same number). */
  lineH: 1.24,
} as const;

/**
 * The durability orb (orb_durability): the middle and radius of the ember inside its iron ring
 * (shares of the picture's width and height; r of its width), and the picture's size as a share
 * of the orb's box (it overhangs the box evenly, so the number sits on the ember). The table
 * covers the spent share of the ember with ash from the top (ArtTable), so how much is left shows
 * at a glance and the number stays ink on a quiet colour.
 */
export const ORB_FACE = { cx: 0.502, cy: 0.505, r: 0.33, img: 1.26 } as const;

/**
 * Where a card picture is cut (object-position y, 0 = keep the top, 0.5 = centre). The pictures
 * are 1.35:1 (tools/art: widened from squares) and the window about 1.6:1, so a little of the top
 * and the bottom goes; a subject that reaches up (a raised hammer, a light bulb, a scarf hanging
 * from the top) keeps its top with a value under 0.5. Keys are art keys (render/forge/assets.ts
 * cardArtKey).
 */
export const CARD_ART_FOCUS: Readonly<Record<string, number>> = {
  bigStrike: 0.3,
  smithSense: 0.35,
  finisher: 0.4,
  emberWatch: 0.2,
  heatUp: 0.4,
};

/**
 * 'auto' = use frame_<kind> pictures when they are there (the boxes above must match them),
 * 'css' = always draw the frame with CSS.
 */
export const CARD_FRAME_ART: 'auto' | 'css' = 'auto';
