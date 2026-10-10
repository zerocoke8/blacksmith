// Tower floors (기획서 7.1, 7.2). Every floor's body type and boss kind is fixed by
// (world seed, tower, band) and is the same for every hero, forever.

import { rngFor } from '../core/rng.ts';
import { BODY_TYPES, type BodyType, type TowerId } from '../core/types.ts';
import {
  bandOf,
  BOSS_POWER_MULT,
  DEMON_LORD_POWER_MULT,
  enemyBasePower,
  TOWER_HOME_BODY,
} from '../data/common.ts';
import { greatBossAt } from '../data/uniques.ts';
import {
  BAND_FLOORS,
  BAND_MAIN_FLOORS,
  BAND_SUB_FLOORS,
  DEMON_LORD_BODY,
  DEMON_LORD_EVERY,
  MAIN_BODY_WEIGHT_HOME,
  MAIN_BODY_WEIGHT_OTHER,
  NO_SPIRIT_THROUGH_FLOOR,
} from '../data/world.ts';
import type { DemonLordDown, FloorInfo } from './types.ts';

export interface BandLayout {
  band: number;
  main: BodyType;
  sub: BodyType;
  /** Body of each normal floor in the band, floors 1..9 of the band in order. */
  bodies: BodyType[];
}

// Derived data only: a cache of a pure function, so it never changes results.
const layoutCache = new Map<string, BandLayout[]>();
const LAYOUT_CACHE_LIMIT = 64;

function drawBand(seed: number, tower: TowerId, band: number, prevMain: BodyType | null): BandLayout {
  const rng = rngFor(seed, 'tower', tower, band);
  const firstFloor = (band - 1) * BAND_FLOORS + 1;
  const allowSpirit = firstFloor > NO_SPIRIT_THROUGH_FLOOR;
  const candidates = BODY_TYPES.filter((b) => allowSpirit || b !== 'spirit');
  const home = TOWER_HOME_BODY[tower];
  const weights = candidates.map((b) => (b === home ? MAIN_BODY_WEIGHT_HOME : MAIN_BODY_WEIGHT_OTHER));

  // Redraw while equal to the previous band's main body.
  let main = candidates[rng.weightedIndex(weights)] as BodyType;
  for (let tries = 0; main === prevMain && tries < 64; tries++) {
    main = candidates[rng.weightedIndex(weights)] as BodyType;
  }
  if (main === prevMain) main = candidates.find((b) => b !== prevMain) as BodyType;

  const sub = rng.pick(candidates.filter((b) => b !== main));
  const bodies: BodyType[] = [
    ...Array.from({ length: BAND_MAIN_FLOORS }, () => main),
    ...Array.from({ length: BAND_SUB_FLOORS }, () => sub),
  ];
  // Fisher–Yates with the band's own stream.
  for (let i = bodies.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = bodies[i] as BodyType;
    bodies[i] = bodies[j] as BodyType;
    bodies[j] = tmp;
  }
  return { band, main, sub, bodies };
}

export function bandLayout(seed: number, tower: TowerId, band: number): BandLayout {
  const key = `${seed}|${tower}`;
  let list = layoutCache.get(key);
  if (list === undefined) {
    if (layoutCache.size >= LAYOUT_CACHE_LIMIT) layoutCache.clear();
    list = [];
    layoutCache.set(key, list);
  }
  while (list.length < band) {
    const b = list.length + 1;
    list.push(drawBand(seed, tower, b, list[b - 2]?.main ?? null));
  }
  return list[band - 1] as BandLayout;
}

export function isBossFloor(floor: number): boolean {
  return floor % BAND_FLOORS === 0;
}

export function demonLordDownUntil(
  downs: readonly DemonLordDown[],
  tower: TowerId,
  floor: number,
  now: number,
): number | null {
  for (const d of downs) if (d.tower === tower && d.floor === floor && now < d.until) return d.until;
  return null;
}

/** Floor body, boss kind and enemy power at world minute `now`. */
export function floorInfo(
  seed: number,
  tower: TowerId,
  floor: number,
  now = 0,
  downs: readonly DemonLordDown[] = [],
): FloorInfo {
  const band = bandOf(floor);
  const layout = bandLayout(seed, tower, band);
  const base = enemyBasePower(floor);

  if (!isBossFloor(floor)) {
    const body = layout.bodies[(floor - 1) % BAND_FLOORS] as BodyType;
    return { tower, floor, band, kind: 'normal', body, enemyPower: base };
  }
  if (floor % DEMON_LORD_EVERY === 0) {
    // A slain demon lord's floor is a section boss floor until it revives (72h).
    if (demonLordDownUntil(downs, tower, floor, now) !== null) {
      return { tower, floor, band, kind: 'sectionBoss', body: layout.main, enemyPower: base * BOSS_POWER_MULT };
    }
    return {
      tower,
      floor,
      band,
      kind: 'demonLord',
      body: DEMON_LORD_BODY[tower],
      enemyPower: base * DEMON_LORD_POWER_MULT,
    };
  }
  const great = greatBossAt(tower, floor);
  if (great !== null) {
    return { tower, floor, band, kind: 'greatBoss', body: great.bossBody, enemyPower: base * BOSS_POWER_MULT };
  }
  return { tower, floor, band, kind: 'sectionBoss', body: layout.main, enemyPower: base * BOSS_POWER_MULT };
}
