// 전투 장면의 자리 (기획서 6.3 편성): where everyone stands on the field. Heroes on the left looking
// right, the front row nearer the middle, the back row behind it; the monsters on the right, the
// front-most one (the one the heroes hit first) nearest the middle; a boss alone, big, on the
// right. Positions are the feet, in CSS px of the field. Pure.

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
  /** A lone boss: its feet, and the box it keeps to (left edge, a gap at the right edge in px). */
  boss: { x: 0.74, y: 0.84 },
  bossLeft: 0.56,
  bossRightGap: 14,
  /** A fighter's height: this share of the field's height, but not over this share of its width. */
  unitH: 0.25,
  unitHMaxW: 0.26,
  /** Picture sizes against a hero (1.0); monsters use their own (data/monsters.ts scale). */
  laneScale: { far: 0.9, near: 1.05 },
} as const;

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

function spot(w: number, h: number, colX: number, lane: number, toward: 1 | -1): FieldSpot {
  const y = h * (FIELD.laneTop + (FIELD.laneBottom - FIELD.laneTop) * lane);
  const x = w * (colX + toward * FIELD.laneLean * (lane - 0.5) * 2);
  return { x, y, depth: FIELD.laneScale.far + (FIELD.laneScale.near - FIELD.laneScale.far) * lane };
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

/** Where a lone boss of this width stands (its middle): at `want`, moved into its box. */
export function bossCenterX(w: number, bossW: number, want: number): number {
  const b = bossBox(w);
  const half = Math.min(bossW, b.maxW) / 2;
  return Math.max(b.left + half, Math.min(want, b.right - half));
}

/**
 * Monsters' spots, e0 first: the first half (rounded up) in the front column, the rest behind; a
 * lone boss at FIELD.boss.
 */
export function enemySpots(w: number, h: number, n: number, boss: boolean): FieldSpot[] {
  if (boss || n <= 1) return [{ x: w * FIELD.boss.x, y: h * FIELD.boss.y, depth: 1 }];
  const nf = Math.ceil(n / 2);
  const nb = n - nf;
  const front = lanes(nf).map((l) => spot(w, h, FIELD.enemyFront, nf === 1 ? 0.5 : l, -1));
  const back = lanes(nb).map((l) => spot(w, h, FIELD.enemyBack, nb === 1 ? 0.45 : nb === 2 ? 0.2 + l * 0.6 : l, -1));
  return [...front, ...back];
}
