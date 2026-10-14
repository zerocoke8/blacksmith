// 전투 장면의 자리 (기획서 6.3 편성): where everyone stands on the field. Heroes on the left looking
// right, the front row nearer the middle, the back row behind it; the monsters on the right, the
// front-most one (the one the heroes hit first) nearest the middle; a boss alone, big, in the middle
// of the monsters' side, its body level with the heroes' (bossFeetY). Positions are the feet, in CSS
// px of the field. How big everyone is drawn is FIGHTER_SIZE (the battle's 크기 panel tries others
// live). Pure.

/** The field's look [튜닝: 연출]. Shares of the field's width or height. */
export const FIELD = {
  /** Where the ground begins (the horizon), from the top. */
  horizon: 0.42,
  /** Feet of the farthest lane and the nearest lane. */
  laneTop: 0.58,
  laneBottom: 0.9,
  /** Hero rows (x of the middle lane): front nearer the middle. */
  heroFront: 0.36,
  heroBack: 0.15,
  /** Monster columns: the first (front) nearer the middle. */
  enemyFront: 0.63,
  enemyBack: 0.84,
  /** A lane lower on screen is nearer: it shifts this much toward the middle (perspective). */
  laneLean: 0.035,
  /**
   * A lone boss: x of its middle (the middle of the monsters' side), and the lane (0 far, 1 near)
   * whose hero its body is level with (0.5: the middle of the formation). Its feet go no lower than
   * bossFeetMax of the height. The box it keeps to: left edge, a gap at the right edge in px.
   */
  boss: { x: 0.74, lane: 0.5 },
  bossFeetMax: 0.96,
  bossLeft: 0.56,
  bossRightGap: 14,
  /** A fighter's height: this share of the field's height, but not over this share of its width. */
  unitH: 0.25,
  unitHMaxW: 0.26,
  /** Picture sizes against a hero (1.0); monsters use their own (data/monsters.ts scale). */
  laneScale: { far: 0.9, near: 1.05 },
} as const;

/**
 * How big the fighters are drawn [튜닝: 연출], times unitHeight: the heroes, a group's monsters and a
 * lone boss (each monster also has its own size, data/monsters.ts scale). The battle's 크기 panel
 * (ui/battle/SizeLab.tsx) tries other sizes live and keeps them on the device; these are the
 * starting sizes and the panel's 기본값.
 */
export interface FighterSize {
  readonly hero: number;
  readonly enemy: number;
  readonly boss: number;
}

export const FIGHTER_SIZE: FighterSize = { hero: 0.8, enemy: 0.8, boss: 0.8 };

/** The 크기 panel's range for each size. */
export const FIGHTER_SIZE_RANGE = { min: 0.4, max: 1.4, step: 0.05 } as const;

export interface FieldSpot {
  x: number;
  y: number;
  /** Size multiplier for depth (far lanes a little smaller). */
  depth: number;
}

export function unitHeight(w: number, h: number): number {
  return Math.max(36, Math.min(h * FIELD.unitH, w * FIELD.unitHMaxW));
}

function lanes(n: number): number[] {
  if (n <= 1) return [0.55];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i / (n - 1));
  return out;
}

function laneY(h: number, lane: number): number {
  return h * (FIELD.laneTop + (FIELD.laneBottom - FIELD.laneTop) * lane);
}

function laneDepth(lane: number): number {
  return FIELD.laneScale.far + (FIELD.laneScale.near - FIELD.laneScale.far) * lane;
}

function spot(w: number, h: number, colX: number, lane: number, toward: 1 | -1): FieldSpot {
  const y = laneY(h, lane);
  const x = w * (colX + toward * FIELD.laneLean * (lane - 0.5) * 2);
  return { x, y, depth: laneDepth(lane) };
}

/**
 * Heroes' spots by row: front first (as formationSlots lists them). A row of n spreads over the
 * lanes; a row of 4 uses all four, a row of 1 the middle.
 */
export function heroSpots(w: number, h: number, front: number, back: number): { front: FieldSpot[]; back: FieldSpot[] } {
  // Back row lanes sit between the front's, so nobody hides behind anyone.
  const f = lanes(front).map((l) => spot(w, h, FIELD.heroFront, front === 1 ? 0.5 : l, 1));
  const b = lanes(back).map((l) => spot(w, h, FIELD.heroBack, back === 1 ? 0.45 : back === 2 ? 0.2 + l * 0.6 : l, 1));
  return { front: f, back: b };
}

/**
 * A lone boss's box: from FIELD.bossLeft of the width to the right edge (less the gap). The front
 * row's heroes end short of bossLeft (heroFront + their half width + the lean), so a big boss
 * (the daily boss's cauldron and ladle) never covers them.
 */
export function bossBox(w: number): { left: number; right: number; maxW: number } {
  const left = w * FIELD.bossLeft;
  const right = w - FIELD.bossRightGap;
  return { left, right, maxW: Math.max(1, right - left) };
}

/**
 * Where a lone boss of this width stands (its middle): at `want`, moved into its box. A boss wider
 * than its box (the 크기 panel's 보스 above 1) keeps its right edge on the box's and reaches left over
 * the front row: the panel shows a size that is too big as too big.
 */
export function bossCenterX(w: number, bossW: number, want: number): number {
  const b = bossBox(w);
  if (bossW > b.maxW) return b.right - bossW / 2;
  const half = bossW / 2;
  return Math.max(b.left + half, Math.min(want, b.right - half));
}

/**
 * A lone boss's feet (px from the top): its middle level with the middle of a hero of heroH px
 * standing on FIELD.boss.lane, so a big boss stands in the middle of the fight rather than at its
 * bottom edge, and never lower than FIELD.bossFeetMax.
 */
export function bossFeetY(h: number, bossH: number, heroH: number): number {
  const lane = FIELD.boss.lane;
  const middle = laneY(h, lane) - heroH / 2;
  return Math.min(h * FIELD.bossFeetMax, middle + bossH / 2);
}

/**
 * Monsters' spots, e0 first: the first half (rounded up) in the front column, the rest behind; a
 * lone boss at FIELD.boss.x on the middle lane (the scene moves its feet to bossFeetY once it knows
 * how tall it is).
 */
export function enemySpots(w: number, h: number, n: number, boss: boolean): FieldSpot[] {
  if (boss || n <= 1) return [{ x: w * FIELD.boss.x, y: laneY(h, FIELD.boss.lane), depth: 1 }];
  const nf = Math.ceil(n / 2);
  const nb = n - nf;
  const front = lanes(nf).map((l) => spot(w, h, FIELD.enemyFront, nf === 1 ? 0.5 : l, -1));
  const back = lanes(nb).map((l) => spot(w, h, FIELD.enemyBack, nb === 1 ? 0.45 : nb === 2 ? 0.2 + l * 0.6 : l, -1));
  return [...front, ...back];
}

/**
 * A fighter's drawn height (px): unitHeight times its own size (a monster's data/monsters.ts scale,
 * 1 for a hero), a lone boss first held to its box's width (aspect: its picture's width over its
 * height), and then times FighterSize for its kind — so the 보스 size moves even a boss its box holds
 * (a big daily boss), and above 1 grows it past the box (bossCenterX).
 */
export function fighterHeight(w: number, h: number, who: { side: 'hero' | 'enemy'; boss: boolean; size: number }, aspect: number, sizes: FighterSize): number {
  const k = who.side === 'hero' ? sizes.hero : who.boss ? sizes.boss : sizes.enemy;
  const base = unitHeight(w, h) * who.size;
  const fit = who.boss ? bossBox(w).maxW / Math.max(0.01, aspect) : Number.POSITIVE_INFINITY;
  return Math.max(1, Math.min(base, fit) * k);
}

/** Sizes kept in FIGHTER_SIZE_RANGE (a stored value from an older range, or a bad one, comes back in it). */
export function clampFighterSize(s: Partial<Record<keyof FighterSize, unknown>>): FighterSize {
  const one = (v: unknown, d: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
    return Math.round(Math.max(FIGHTER_SIZE_RANGE.min, Math.min(FIGHTER_SIZE_RANGE.max, n)) * 100) / 100;
  };
  return { hero: one(s.hero, FIGHTER_SIZE.hero), enemy: one(s.enemy, FIGHTER_SIZE.enemy), boss: one(s.boss, FIGHTER_SIZE.boss) };
}

/**
 * Where a melee fighter's run stops [튜닝: 연출] (사용자 결정 2026-10-14: '근접은 적 근처까지 가서 친다'):
 * just in front of its foe, the facing edges of the two pictures `gap` (× the runner's height) apart;
 * its lunge at the blow (motion.ts MOTION.lunge) then closes the gap. `edge`: the share of a
 * picture's half width that counts as its body (a sword or a tail sticks out past it). `lane`: how
 * far up or down toward its foe's lane it goes — not all the way, so two who run at one foe from two
 * lanes stand apart, not on top of each other; a lone boss less still (a big body does not hop lanes).
 */
export const DASH = { gap: 0.1, edge: 0.7, lane: 0.7, bossLane: 0.35 } as const;

export interface DashBody {
  readonly x: number;
  /** Feet (px from the top). */
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The feet of a runner (side: heroes run right, monsters left) standing in front of its foe. */
export function dashPoint(runner: DashBody & { side: 'hero' | 'enemy'; boss: boolean }, foe: DashBody): { x: number; y: number } {
  const toward = runner.side === 'hero' ? 1 : -1;
  const x = foe.x - toward * (DASH.edge * (foe.w / 2 + runner.w / 2) + DASH.gap * runner.h);
  const y = runner.y + (foe.y - runner.y) * (runner.boss ? DASH.bossLane : DASH.lane);
  return { x, y };
}
