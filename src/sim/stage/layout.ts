// 층 배치 (기획서 6.1, 6.2, 6.10): what stands on each floor. The same for every player (3.5: 공용
// 시드), from rngFor(STAGE_LAYOUT_SEED, 'stage', …). A floor is one group of one monster (one body,
// one element); every 10th floor is a lone boss. Pure.

import { rngFor } from '../core/rng.ts';
import { BODY_TYPES, type BodyType, type Element, ELEMENTS } from '../core/types.ts';
import { bandOf, CRIT_DAMAGE, powInt } from '../data/common.ts';
import {
  BAND_MAIN_FLOORS,
  BAND_SUB_FLOORS,
  BOSS_EVERY,
  BOSS_POWER_MULT,
  DEMON_LORD_EVERY_FLOORS,
  DEMON_LORD_POWER_MULT,
  FLOOR_BOSS_ORDER,
  FLOOR_BOSS_SHAPE,
  FLOOR_GROWTH,
  floorBossMonster,
  GREAT_BOSS_FROM,
  MOB_COUNT,
  MOB_GROUP_BASE,
  MOB_STATS,
  type MonsterSpec,
  NO_SPIRIT_THROUGH,
  normalMonster,
  STAGE_LAYOUT_SEED,
} from '../data/monsters.ts';
import type { EnemyUnit } from './battle.ts';

/** 구간 보스 (10~40), 대보스 (50부터, 100의 배수 제외), 마왕 (100, 200, …) (6.2). */
export type FloorBossKind = 'section' | 'great' | 'demonLord';

export interface FloorLayout {
  floor: number;
  band: number;
  boss: FloorBossKind | null;
  body: BodyType;
  element: Element;
  monster: MonsterSpec;
  /** Monsters on the floor (a boss stands alone). */
  count: number;
}

function wholeFloor(floor: number): number {
  return Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));
}

export function bossKindOf(floor: number): FloorBossKind | null {
  const f = wholeFloor(floor);
  if (f % BOSS_EVERY !== 0) return null;
  if (f % DEMON_LORD_EVERY_FLOORS === 0) return 'demonLord';
  return f >= GREAT_BOSS_FROM ? 'great' : 'section';
}

/** The bodies a band may use: no spirit while any of its floors is ≤ 20 (6.2). */
function bandBodies(band: number): BodyType[] {
  const lastFloor = band * BOSS_EVERY;
  return BODY_TYPES.filter((b) => b !== 'spirit' || lastFloor - BOSS_EVERY + 1 > NO_SPIRIT_THROUGH);
}

/** The bodies of a band's 9 normal floors, in floor order: 6 main + 3 sub, shuffled (6.2). */
export function bandBodyOrder(band: number): BodyType[] {
  const rng = rngFor(STAGE_LAYOUT_SEED, 'stage', 'band', band);
  const bodies = bandBodies(band);
  const main = rng.pick(bodies);
  const sub = rng.pick(bodies.filter((b) => b !== main));
  const order: BodyType[] = [];
  for (let i = 0; i < BAND_MAIN_FLOORS; i++) order.push(main);
  for (let i = 0; i < BAND_SUB_FLOORS; i++) order.push(sub);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = order[i] as BodyType;
    order[i] = order[j] as BodyType;
    order[j] = t;
  }
  return order;
}

/** 층마다의 속성 (6.2 [미정]: 층 시드로 정한다). */
export function floorElement(floor: number): Element {
  return rngFor(STAGE_LAYOUT_SEED, 'stage', wholeFloor(floor)).pick(ELEMENTS);
}

/** 무리의 마릿수 (6.1): 3 in bands 1~2, then one more every two bands, up to 5. */
export function mobCount(floor: number): number {
  const band = bandOf(wholeFloor(floor));
  return Math.min(MOB_COUNT.max, MOB_COUNT.base + Math.floor((band - 1) / MOB_COUNT.bandsPerExtra));
}

export function floorLayout(floor: number): FloorLayout {
  const f = wholeFloor(floor);
  const band = bandOf(f);
  const element = floorElement(f);
  const boss = bossKindOf(f);
  if (boss !== null) {
    const body = FLOOR_BOSS_ORDER[(f / BOSS_EVERY - 1) % FLOOR_BOSS_ORDER.length] as BodyType;
    return { floor: f, band, boss, body, element, monster: floorBossMonster(body), count: 1 };
  }
  const body = bandBodyOrder(band)[(f - 1) % BOSS_EVERY] as BodyType;
  return { floor: f, band, boss: null, body, element, monster: normalMonster(body, element), count: mobCount(f) };
}

/** The floor's stat scale (6.4): 1.04^(층 − 1). */
export function floorScale(floor: number): number {
  return powInt(FLOOR_GROWTH, wholeFloor(floor) - 1);
}

export function bossPowerOf(kind: FloorBossKind): number {
  return kind === 'demonLord' ? DEMON_LORD_POWER_MULT : BOSS_POWER_MULT;
}

/** The fighters on a floor (ids e0, e1, … front first). */
export function floorEnemies(floor: number): EnemyUnit[] {
  const lay = floorLayout(floor);
  const s = floorScale(lay.floor);
  if (lay.boss !== null) {
    const p = bossPowerOf(lay.boss);
    const groupHp = MOB_STATS.hp * MOB_GROUP_BASE;
    // The group's DPS × power, in slower blows.
    const groupAtkPerTick = (MOB_STATS.atk * MOB_GROUP_BASE) / MOB_STATS.intervalTicks;
    return [
      {
        id: 'e0',
        key: lay.monster.key,
        name: lay.monster.name,
        body: lay.body,
        element: lay.element,
        boss: true,
        maxHp: Math.max(1, Math.round(groupHp * FLOOR_BOSS_SHAPE.hpOfGroup * p * s)),
        atk: Math.max(1, Math.round(groupAtkPerTick * FLOOR_BOSS_SHAPE.intervalTicks * FLOOR_BOSS_SHAPE.atkOfGroup * p * s)),
        def: Math.round(MOB_STATS.def * FLOOR_BOSS_SHAPE.def * s),
        pen: Math.max(1, Math.round(MOB_STATS.atk * s)),
        crit: FLOOR_BOSS_SHAPE.crit,
        critDamage: CRIT_DAMAGE,
        intervalTicks: FLOOR_BOSS_SHAPE.intervalTicks,
      },
    ];
  }
  const share = MOB_GROUP_BASE / lay.count;
  const out: EnemyUnit[] = [];
  for (let i = 0; i < lay.count; i++) {
    out.push({
      id: `e${i}`,
      key: lay.monster.key,
      name: lay.monster.name,
      body: lay.body,
      element: lay.element,
      boss: false,
      maxHp: Math.max(1, Math.round(MOB_STATS.hp * share * s)),
      atk: Math.max(1, Math.round(MOB_STATS.atk * share * s)),
      def: Math.round(MOB_STATS.def * s),
      pen: Math.max(1, Math.round(MOB_STATS.atk * s)),
      crit: MOB_STATS.crit,
      critDamage: CRIT_DAMAGE,
      intervalTicks: MOB_STATS.intervalTicks,
    });
  }
  return out;
}
