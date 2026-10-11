// 카드 제작 장면의 배치, 그림 기준점, 연출 시간과 색 (화면 쪽 숫자는 모두 여기에).
// The art arrives as src/assets/art/<scene|ui|cards>/<key>.webp; when a picture changes
// (a new crop, a different pose), only the numbers here move. No PixiJS here: React reads
// this file too, and it must not pull the renderer into the first load.

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
  'anvil',
  'furnace',
  'bellows',
  'quench',
  'iron_hot',
  'iron_cracked',
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

export type DwarfPose = 'idle' | 'raise' | 'strike' | 'work' | 'cheer';

/** A point in a picture as fractions of its width and height (0,0 = top left). */
export interface ArtPoint {
  x: number;
  y: number;
}

// ---------- Where each picture is pinned (fractions of the delivered, trimmed picture) ----------

/**
 * Dwarf poses. foot = the point between the boots on the floor, head = top of the hair (y only).
 * The scene scales every pose so head→foot is the same height, so the dwarf never grows when the
 * hammer goes up. hammer = the bottom (striking) face of the hammer head in the strike pose: the
 * scene leans the dwarf forward so it lands on the iron, and tilts him back by `tilt` (radians)
 * so it lands on the bar rather than in front of it. reach = the tool tips in the work pose (the
 * dwarf steps in so they meet the iron, and bends toward it by its tilt). Measured on the delivered pictures (meta.json trims);
 * re-measure if a pose is redrawn.
 */
export const DWARF_POSE_ART: Record<DwarfPose, { foot: ArtPoint; head: number; hammer?: ArtPoint; reach?: ArtPoint; tilt?: number }> = {
  idle: { foot: { x: 0.6, y: 0.995 }, head: 0.01 },
  raise: { foot: { x: 0.6, y: 0.995 }, head: 0.174 },
  strike: { foot: { x: 0.43, y: 0.995 }, head: 0.012, hammer: { x: 0.9, y: 0.69 }, tilt: -0.07 },
  work: { foot: { x: 0.38, y: 0.995 }, head: 0.02, reach: { x: 0.95, y: 0.47 }, tilt: 0.08 },
  cheer: { foot: { x: 0.5, y: 0.995 }, head: 0.035 },
};

/** Pose to use when a pose picture is missing (raise stands in for cheer: arms up). */
export const DWARF_POSE_FALLBACK: Record<DwarfPose, DwarfPose[]> = {
  idle: [],
  raise: ['idle'],
  strike: ['idle'],
  work: ['idle'],
  cheer: ['raise', 'idle'],
};

export const PROP_ART = {
  /** foot = bottom middle of the stump on the floor; face = middle of the anvil's flat top, faceW its width. */
  anvil: { foot: { x: 0.53, y: 0.99 }, face: { x: 0.64, y: 0.035 }, faceW: 0.58 },
  /** mouth = middle of the fire opening; top = the chimney's top edge (the fire icon sits above). */
  furnace: { foot: { x: 0.6, y: 0.995 }, mouth: { x: 0.62, y: 0.6 }, top: 0.01 },
  /** nozzle = the tip that points at the fire. */
  bellows: { foot: { x: 0.4, y: 0.99 }, nozzle: { x: 0.98, y: 0.6 } },
  /** water = middle of the water surface (steam rises from here). */
  quench: { foot: { x: 0.41, y: 0.99 }, water: { x: 0.4, y: 0.19 } },
  /** The hot bar lies on the anvil: rest = the line that touches the face (the bar's bottom edge). */
  iron: { rest: { x: 0.5, y: 0.88 } },
} as const;

/**
 * Finished weapons are painted on a diagonal: from = the butt (pommel, grip end, bow's lower
 * tip, crossbow stock), to = the tip. The scene turns the picture so that line lies across the
 * anvil, tip to the right (flip mirrors a picture whose tip points left first: the crossbow);
 * len = its length as a share of the anvil's width, so a dagger lies small and a greatsword long.
 */
export const WEAPON_ART: Record<WeaponType, { from: ArtPoint; to: ArtPoint; flip?: boolean; len: number }> = {
  oneHandSword: { from: { x: 0.07, y: 0.95 }, to: { x: 0.97, y: 0.02 }, len: 1.1 },
  greatsword: { from: { x: 0.05, y: 0.96 }, to: { x: 0.97, y: 0.02 }, len: 1.35 },
  dagger: { from: { x: 0.08, y: 0.93 }, to: { x: 0.97, y: 0.03 }, len: 0.72 },
  bow: { from: { x: 0.03, y: 0.98 }, to: { x: 0.97, y: 0.02 }, len: 1.2 },
  crossbow: { from: { x: 0.97, y: 0.04 }, to: { x: 0.08, y: 0.9 }, flip: true, len: 0.95 },
  staff: { from: { x: 0.06, y: 0.97 }, to: { x: 0.82, y: 0.04 }, len: 1.3 },
};

/** The drawn stand-in weapon (procedural.ts weapon) lies flat, tip to the right. */
export const WEAPON_STANDIN = { from: { x: 0.03, y: 0.5 }, to: { x: 0.97, y: 0.5 } } as const;

/** How the weapon lies on the anvil: a slight tilt (radians) and its middle above the face (share of the anvil's width). */
export const WEAPON_REST = { tilt: -0.1, lift: 0.07 };

/** Width ÷ height for pictures not loaded yet (the procedural stand-ins use the same). */
export const DEFAULT_ASPECT: Record<SceneArtKey, number> = {
  bg_workshop: 1.5,
  dwarf_idle: 0.96,
  dwarf_raise: 0.53,
  dwarf_strike: 0.67,
  dwarf_work: 0.8,
  dwarf_cheer: 0.73,
  anvil: 1.15,
  furnace: 0.8,
  bellows: 1.4,
  quench: 1.25,
  iron_hot: 3.2,
  iron_cracked: 3.6,
  weapon_oneHandSword: 3.2,
  weapon_greatsword: 3.6,
  weapon_dagger: 2.4,
  weapon_bow: 1.6,
  weapon_crossbow: 1.6,
  weapon_staff: 4,
};

// ---------- Where things stand in the scene (fractions of the scene box) ----------

/**
 * x, y = where the picture's foot point lands; h = its height as a share of the scene height,
 * capped so its width stays under maxW of the scene width (narrow phones). The dwarf's h is
 * head→foot. The scene box is the top half of a portrait screen (about 390×450).
 * Depth: the background's floor meets the wall at about 0.59 of the height. The dwarf stands a
 * little further back than the anvil (his feet higher, drawn behind it), so his hammer, held
 * low in the strike picture, lands on the iron while the anvil keeps a smith's size; the
 * furnace stands further back on the right, the bellows and the tub in front.
 */
export const SCENE_PLACE = {
  dwarf: { x: 0.225, y: 0.855, h: 0.56, maxW: 0.44 },
  anvil: { x: 0.54, y: 0.975, h: 0.29, maxW: 0.36 },
  furnace: { x: 0.85, y: 0.86, h: 0.56, maxW: 0.34 },
  bellows: { x: 0.8, y: 0.95, h: 0.17, maxW: 0.28 },
  quench: { x: 0.1, y: 0.995, h: 0.18, maxW: 0.22 },
  /** Hot bar width as a share of the anvil face. */
  iron: { w: 0.95 },
  /** How far the dwarf may lean (share of scene width) so the hammer or the tongs meet the iron. */
  lunge: 0.12,
} as const;

/** DOM overlay over the scene: gauge plate (like an enemy's HP bar), fire badge, speech bubble. */
export const OVERLAY_PLACE = {
  /** Plate centre x (share of width), top (share of height), width (share, clamped in px). */
  gauges: { x: 0.45, top: 0.035, w: 0.6, minW: 200, maxW: 310 },
  /**
   * Fire badge: px above the furnace top, kept inside the scene; col = the width (px) kept free
   * for it on the right, so the gauge plate never runs into it.
   */
  fire: { above: 4, size: 50, col: 78 },
  /**
   * Bubble: its left edge and vertical middle, from the dwarf's feet point, as shares of the
   * dwarf's head→foot height (right of the head, over the open floor before the anvil).
   */
  bubble: { dx: 0.16, dy: -0.86, maxW: 0.58 },
  /**
   * Where a played card hovers while its effect starts (its centre): above and right of the
   * iron, clear of the hammer's path and the blow, under the gauge plate. x from the iron as a
   * share of the width, y as a share of the height.
   */
  cardHover: { dx: 0.17, y: 0.36 },
  /**
   * Floating numbers (공정 +100 …) rise from above the hammer head that lands on the iron, left
   * of the played card hovering to its right: x = the iron's middle + dx × its width, the first
   * number lift × the scene's height over the iron's top edge (the strike pose's hammer head
   * stands about 0.15 of it over the iron), each next one of the same beat step px higher and
   * alt × the iron's width to the side. A short scene squeezes lift and step so the stack stays
   * gap px under the gauge plate.
   */
  floats: { dx: -0.24, lift: 0.21, step: 26, alt: 0.2, gap: 6 },
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
  /** Feet point of the dwarf and its head→foot height, px. */
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
  /** The hot bar: middle point (where blows land), width and height. */
  iron: { x: number; y: number; w: number; h: number };
  gauges: { x: number; y: number; w: number };
  fire: ArtPoint;
  bubble: { x: number; y: number; maxW: number };
  /** Centre of a played card while it hovers over the scene. */
  cardHover: ArtPoint;
}

function placed(
  w: number,
  h: number,
  place: { x: number; y: number; h: number; maxW: number },
  aspect: number,
  foot: ArtPoint,
): Rect {
  let ph = place.h * h;
  if (ph * aspect > place.maxW * w) ph = (place.maxW * w) / aspect;
  const pw = ph * aspect;
  return { x: place.x * w - foot.x * pw, y: place.y * h - foot.y * ph, w: pw, h: ph };
}

/**
 * Pixel layout of the scene for a box of w×h. `aspect` gives the loaded pictures' width÷height
 * (missing keys use DEFAULT_ASPECT). React places the overlay with it; the Pixi scene places the
 * sprites with it, so both agree.
 */
export function sceneLayout(w: number, h: number, aspect: Partial<Record<SceneArtKey, number>> = {}): SceneLayout {
  const a = (k: SceneArtKey) => aspect[k] ?? DEFAULT_ASPECT[k];
  const anvil = placed(w, h, SCENE_PLACE.anvil, a('anvil'), PROP_ART.anvil.foot);
  const face = {
    x: anvil.x + PROP_ART.anvil.face.x * anvil.w,
    y: anvil.y + PROP_ART.anvil.face.y * anvil.h,
    w: PROP_ART.anvil.faceW * anvil.w,
  };
  const furnace = placed(w, h, SCENE_PLACE.furnace, a('furnace'), PROP_ART.furnace.foot);
  const bellows = placed(w, h, SCENE_PLACE.bellows, a('bellows'), PROP_ART.bellows.foot);
  const quench = placed(w, h, SCENE_PLACE.quench, a('quench'), PROP_ART.quench.foot);
  const ironW = face.w * SCENE_PLACE.iron.w;
  const ironH = ironW / a('iron_hot');
  const gaugeW = Math.max(OVERLAY_PLACE.gauges.minW, Math.min(OVERLAY_PLACE.gauges.maxW, OVERLAY_PLACE.gauges.w * w));
  const gaugeX = Math.max(gaugeW / 2 + 6, Math.min(w - gaugeW / 2 - OVERLAY_PLACE.fire.col, OVERLAY_PLACE.gauges.x * w));
  const furnaceTop = { x: furnace.x + furnace.w / 2, y: furnace.y + PROP_ART.furnace.top * furnace.h };
  const fireSize = OVERLAY_PLACE.fire.size;
  const dwarfBody = SCENE_PLACE.dwarf.h * h;
  return {
    w,
    h,
    dwarf: { x: SCENE_PLACE.dwarf.x * w, y: SCENE_PLACE.dwarf.y * h, bodyH: dwarfBody },
    anvil,
    face,
    furnace,
    mouth: { x: furnace.x + PROP_ART.furnace.mouth.x * furnace.w, y: furnace.y + PROP_ART.furnace.mouth.y * furnace.h },
    furnaceTop,
    bellows,
    nozzle: { x: bellows.x + PROP_ART.bellows.nozzle.x * bellows.w, y: bellows.y + PROP_ART.bellows.nozzle.y * bellows.h },
    quench,
    water: { x: quench.x + PROP_ART.quench.water.x * quench.w, y: quench.y + PROP_ART.quench.water.y * quench.h },
    iron: { x: face.x, y: face.y - (PROP_ART.iron.rest.y - 0.5) * ironH, w: ironW, h: ironH },
    gauges: { x: gaugeX, y: OVERLAY_PLACE.gauges.top * h, w: gaugeW },
    fire: {
      x: w - OVERLAY_PLACE.fire.col / 2,
      y: Math.max(fireSize / 2 + 4, furnaceTop.y - OVERLAY_PLACE.fire.above - fireSize / 2),
    },
    cardHover: { x: Math.min(w - 50, face.x + OVERLAY_PLACE.cardHover.dx * w), y: OVERLAY_PLACE.cardHover.y * h },
    bubble: {
      x: SCENE_PLACE.dwarf.x * w + OVERLAY_PLACE.bubble.dx * dwarfBody,
      y: SCENE_PLACE.dwarf.y * h + OVERLAY_PLACE.bubble.dy * dwarfBody,
      // Kept clear of the fire badge over the furnace.
      maxW: Math.max(
        120,
        Math.min(OVERLAY_PLACE.bubble.maxW * w, furnaceTop.x - fireSize / 2 - 8 - (SCENE_PLACE.dwarf.x * w + OVERLAY_PLACE.bubble.dx * dwarfBody)),
      ),
    },
  };
}

/** Numbers a beat can stack (공정, 품질, 열기, 내구도). */
const FLOAT_STACK = 4;

/**
 * Where the floating number of this order (0 = the beat's first) starts: its centre x and top y
 * in the scene box (px). plateBottom = the gauge plate's bottom edge in the same box.
 */
export function floatAt(l: SceneLayout, order: number, plateBottom: number): ArtPoint {
  const f = OVERLAY_PLACE.floats;
  const top = l.iron.y - l.iron.h / 2;
  const room = top - (plateBottom + f.gap);
  const lift = f.lift * l.h;
  const k = Math.max(0.3, Math.min(1, room / (lift + f.step * (FLOAT_STACK - 1))));
  const i = order % FLOAT_STACK;
  return { x: l.iron.x + (f.dx + (i % 2 === 1 ? f.alt : 0)) * l.iron.w, y: top - k * (lift + i * f.step) };
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
  show: 0.56,
  spread: 3,
  maxFan: 4.5,
  /** Room over the cards for the hint line, and the side margin (px). */
  top: 34,
  margin: 6,
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

/** Iron colour by 열기 0..10, cold to white hot. */
export const HEAT_TINT: readonly number[] = [
  0xc0583a, 0xd0623a, 0xdc6e3a, 0xe57c3c, 0xee8c40, 0xf49c46, 0xf8ad50, 0xfbbf62, 0xfdd078, 0xffe093, 0xfff0b8,
];

/** Fire glow per 화로 상태: colour and strength (1 = 보통). */
export const FIRE_GLOW: Record<FireState, { color: number; power: number }> = {
  normal: { color: 0xff8a3a, power: 1 },
  good: { color: 0xffa640, power: 1.3 },
  excellent: { color: 0xffd36a, power: 1.75 },
  poor: { color: 0xb8543a, power: 0.55 },
  sturdy: { color: 0xd98a5a, power: 1 },
  surge: { color: 0xff6a2a, power: 1.5 },
  malleable: { color: 0xffb070, power: 1.15 },
  goodOmen: { color: 0xffc860, power: 1.2 },
};

/** Metal glow seeping into the iron when a material card is played. */
export const METAL_TINT: Partial<Record<CardId, number>> = {
  ironMelt: 0xff9a50,
  steelFold: 0xcfe2ff,
  mithrilGrain: 0x9fe8ff,
  orichalcumGlow: 0xffc84a,
  adamantCore: 0xb48cff,
  dragonBreath: 0xff4a24,
  rekindle: 0xffb03a,
  giantHammer: 0xc8925a,
  layeredShell: 0x9fd07a,
  stormBellows: 0x7fe0e0,
  tailwind: 0xd8ffd0,
  deepWater: 0x4a8cff,
  frostFinish: 0xc8f0ff,
};

export const FX_COLOR = {
  spark: [0xffe9a8, 0xffc35a, 0xff8a2a],
  silver: [0xffffff, 0xd8ecff, 0xa8d4ff],
  gold: [0xfff2c0, 0xffd66a, 0xffb43a],
  rune: [0xd6b0ff, 0xa070ff],
  steam: 0xf4f0ea,
  smoke: 0x3a3430,
  crack: 0xff3a1a,
} as const;

// ---------- Card face (fractions of the card: x, w of its width; y, h of its height) ----------

/** Cards are 2:3 like the frame pictures. */
export const CARD_ASPECT = 2 / 3;

/**
 * Boxes on the card face, measured on the delivered (trimmed) frame_<kind> pictures, which all
 * share one layout (±0.3%): the cost gem over the round socket (centre cx, cy and diameter d as a
 * share of the width; a little wider than the socket's hole so it covers its rim), the name band,
 * the picture window (the card art is cut to fill it, just inside the frame's dark window), the
 * kind ribbon and the parchment text box. The CSS frame uses the same boxes, so a frame picture
 * can be swapped in without moving anything else.
 */
export const CARD_FACE = {
  cost: { cx: 0.124, cy: 0.084, d: 0.172 },
  /** The name starts at the band's left end, just right of the gem, so a card half under another still shows it. */
  name: { x: 0.232, y: 0.056, w: 0.658, h: 0.068 },
  art: { x: 0.119, y: 0.156, w: 0.77, h: 0.373 },
  ribbon: { x: 0.235, y: 0.54, w: 0.54, h: 0.053 },
  text: { x: 0.095, y: 0.614, w: 0.815, h: 0.305 },
} as const;

/**
 * Type on the card (px, at the card's own size): the base is base × the card's width; names,
 * rules text and notes never go under their floors (small phones), names shrink only to fit
 * their band. The kind ribbon is left out on cards narrower than ribbonMinW (the frame's colour
 * already says the kind). Long rules text (more than longText, or veryLong characters) steps
 * down and gets a fifth line; the long-press sheet has all of it.
 */
export const CARD_TYPE = {
  base: 0.088,
  nameMin: 10.5,
  textMin: 10.5,
  noteMin: 10,
  keyMin: 9,
  ribbonMinW: 140,
  longText: 30,
  veryLong: 40,
} as const;

/**
 * Where a card picture is cut (object-position y, 0 = keep the top, 0.5 = centre). The pictures
 * are square and the window is about 4:3, so a subject that reaches the top edge (a raised
 * hammer, a feather, a crown) keeps its head with a value under 0.5. Keys are art keys
 * (render/forge/assets.ts cardArtKey).
 */
export const CARD_ART_FOCUS: Readonly<Record<string, number>> = {
  trainedArm: 0.3,
  giantHammer: 0.3,
  dragonBreath: 0.3,
  rekindle: 0.35,
  downStrike: 0.25,
  stormBellows: 0.35,
  frostFinish: 0.35,
  allIn: 0.4,
};

/**
 * 'auto' = use frame_<kind> pictures when they are there (the boxes above must match them),
 * 'css' = always draw the frame with CSS.
 */
export const CARD_FRAME_ART: 'auto' | 'css' = 'auto';
