// 시즌 악마의 탑의 층 (기획서 13.2.1). Each band's element, main and sub body and boss come from
// the season data; the order of the bodies within a band comes from (시즌 시드, 'season', 구간),
// the same for every player (13.16). Floors build the same FloorInfo the 7장 tower code uses.

import { rngFor } from '../core/rng.ts';
import { BODY_TYPES, type BodyType, type Element } from '../core/types.ts';
import { bandOf, BOSS_POWER_MULT, DEMON_LORD_POWER_MULT, enemyBasePower } from '../data/common.ts';
import { DEMON_FLOOR, SEASONS, type SeasonId, type SeasonSpec, WALL_FLOORS } from '../data/run.ts';
import { BAND_FLOORS, BAND_MAIN_FLOORS, BAND_SUB_FLOORS } from '../data/world.ts';
import type { FloorInfo } from '../world/types.ts';

/** Random stream of the season layout (13.16). */
export const SEASON_STREAM = 'season';

/** Bands with a boss at their top floor (1~5); above that the tower has no bosses. */
export const SEASON_BOSS_BANDS = DEMON_FLOOR / BAND_FLOORS;

export interface SeasonFloor extends FloorInfo {
  element: Element;
  /** 대표 적 or 보스 이름. */
  name: string;
}

// Derived data only: a cache of a pure function, so it never changes results.
const bandCache = new Map<string, BodyType[]>();
const BAND_CACHE_LIMIT = 256;

function drawBand(season: SeasonSpec, band: number): BodyType[] {
  const rng = rngFor(season.seed, SEASON_STREAM, band);
  if (band <= SEASON_BOSS_BANDS) {
    const spec = season.bands[band - 1];
    if (spec === undefined) throw new Error(`season band ${band} missing`);
    const bodies: BodyType[] = [
      ...Array.from({ length: BAND_MAIN_FLOORS }, () => spec.main),
      ...Array.from({ length: BAND_SUB_FLOORS }, () => spec.sub),
    ];
    for (let i = bodies.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const t = bodies[i] as BodyType;
      bodies[i] = bodies[j] as BodyType;
      bodies[j] = t;
    }
    return bodies;
  }
  // 위층: 체형은 층마다 섞인다.
  return Array.from({ length: BAND_FLOORS }, () => rng.pick(BODY_TYPES));
}

/** Bodies of the band's floors in order (9 normal floors for bands 1~5, 10 above). */
export function seasonBandBodies(seasonId: SeasonId, band: number): BodyType[] {
  const key = `${seasonId}|${band}`;
  let bodies = bandCache.get(key);
  if (bodies === undefined) {
    if (bandCache.size >= BAND_CACHE_LIMIT) bandCache.clear();
    bodies = drawBand(SEASONS[seasonId], band);
    bandCache.set(key, bodies);
  }
  return bodies;
}

export function isSeasonBossFloor(floor: number): boolean {
  return floor <= DEMON_FLOOR && floor % BAND_FLOORS === 0;
}

/** One floor of the season tower: body, element, boss kind and enemy power (7.3 curve, 13.2.1). */
export function seasonFloor(seasonId: SeasonId, floor: number): SeasonFloor {
  const season = SEASONS[seasonId];
  const f = Math.max(1, Math.floor(floor));
  const band = bandOf(f);
  const base = enemyBasePower(f);
  if (band <= SEASON_BOSS_BANDS) {
    const spec = season.bands[band - 1];
    if (spec === undefined) throw new Error(`season band ${band} missing`);
    if (isSeasonBossFloor(f)) {
      const demon = f === DEMON_FLOOR;
      return {
        tower: spec.element,
        element: spec.element,
        floor: f,
        band,
        kind: demon ? 'demonLord' : 'sectionBoss',
        body: spec.main,
        enemyPower: base * (demon ? DEMON_LORD_POWER_MULT : BOSS_POWER_MULT),
        name: demon ? season.demon : spec.boss,
      };
    }
    const body = seasonBandBodies(seasonId, band)[(f - 1) % BAND_FLOORS] as BodyType;
    return {
      tower: spec.element,
      element: spec.element,
      floor: f,
      band,
      kind: 'normal',
      body,
      enemyPower: base,
      name: spec.enemies[body] ?? spec.enemies[spec.main] ?? '',
    };
  }
  const body = seasonBandBodies(seasonId, band)[(f - 1) % BAND_FLOORS] as BodyType;
  return {
    tower: season.upper.element,
    element: season.upper.element,
    floor: f,
    band,
    kind: 'normal',
    body,
    enemyPower: base,
    name: season.upper.enemies[body],
  };
}

export interface SeasonBandView {
  band: number;
  firstFloor: number;
  lastFloor: number;
  element: Element;
  main: BodyType;
  sub: BodyType;
  boss: string;
  bossFloor: number;
  bossBody: BodyType;
  demon: boolean;
  /** Body of each floor, first to last (the boss floor included). */
  floors: BodyType[];
}

/** 다섯 구간의 배치: 판을 시작하기 전에 모두 보인다 (13.2.1, 정찰 없음). */
export function seasonLayout(seasonId: SeasonId): SeasonBandView[] {
  const season = SEASONS[seasonId];
  return WALL_FLOORS.map((bossFloor, i) => {
    const spec = season.bands[i];
    if (spec === undefined) throw new Error(`season band ${i + 1} missing`);
    const firstFloor = bossFloor - BAND_FLOORS + 1;
    const floors: BodyType[] = [];
    for (let f = firstFloor; f <= bossFloor; f++) floors.push(seasonFloor(seasonId, f).body);
    return {
      band: i + 1,
      firstFloor,
      lastFloor: bossFloor,
      element: spec.element,
      main: spec.main,
      sub: spec.sub,
      boss: bossFloor === DEMON_FLOOR ? season.demon : spec.boss,
      bossFloor,
      bossBody: spec.main,
      demon: bossFloor === DEMON_FLOOR,
      floors,
    };
  });
}
