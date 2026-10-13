// 몬스터와 층 (기획서 6.1, 6.2, 6.10, 8.1, 8.2). The 25 monsters are tools/art/roster/bestiary.json
// moved over as data (key = art key in src/assets/art/monsters/). Every number is a [튜닝] starting
// value; the curves are [미정] in the doc (16장의 11·12·13번). Change them here, not at call sites.

import type { BodyType, Element } from '../core/types.ts';
import { BOSS_POWER_MULT, DEMON_LORD_POWER_MULT, ENEMY_GROWTH_PER_FLOOR } from './common.ts';
import { DAY_MINUTES, SECTION_BOSS_LAST_FLOOR } from './world.ts';

// ---------- The 25 (6.10) ----------

export type MonsterKind = 'normal' | 'floorBoss' | 'dailyBoss';

export interface MonsterSpec {
  key: string;
  name: string;
  kind: MonsterKind;
  body: BodyType;
  /** null: a floor boss, drawn without an element; it takes the floor's (6.10). */
  element: Element | null;
  /** Picture height against a hero (1.0) [튜닝]. */
  scale: number;
}

export const MONSTERS = [
  { key: 'mon_humanoid_water', name: '물방울 고블린', kind: 'normal', body: 'humanoid', element: 'water', scale: 0.65 },
  { key: 'mon_humanoid_fire', name: '불씨 고블린', kind: 'normal', body: 'humanoid', element: 'fire', scale: 0.65 },
  { key: 'mon_humanoid_earth', name: '조약돌 고블린', kind: 'normal', body: 'humanoid', element: 'earth', scale: 0.65 },
  { key: 'mon_humanoid_wind', name: '산들 고블린', kind: 'normal', body: 'humanoid', element: 'wind', scale: 0.65 },
  { key: 'mon_armored_water', name: '물방울 동글게', kind: 'normal', body: 'armored', element: 'water', scale: 0.65 },
  { key: 'mon_armored_fire', name: '불씨 동글게', kind: 'normal', body: 'armored', element: 'fire', scale: 0.65 },
  { key: 'mon_armored_earth', name: '조약돌 동글게', kind: 'normal', body: 'armored', element: 'earth', scale: 0.65 },
  { key: 'mon_armored_wind', name: '산들 동글게', kind: 'normal', body: 'armored', element: 'wind', scale: 0.65 },
  { key: 'mon_flying_water', name: '물방울 박쥐', kind: 'normal', body: 'flying', element: 'water', scale: 0.65 },
  { key: 'mon_flying_fire', name: '불씨 박쥐', kind: 'normal', body: 'flying', element: 'fire', scale: 0.65 },
  { key: 'mon_flying_earth', name: '조약돌 박쥐', kind: 'normal', body: 'flying', element: 'earth', scale: 0.65 },
  { key: 'mon_flying_wind', name: '산들 박쥐', kind: 'normal', body: 'flying', element: 'wind', scale: 0.65 },
  { key: 'mon_spirit_water', name: '물방울 유령', kind: 'normal', body: 'spirit', element: 'water', scale: 0.65 },
  { key: 'mon_spirit_fire', name: '불씨 유령', kind: 'normal', body: 'spirit', element: 'fire', scale: 0.65 },
  { key: 'mon_spirit_earth', name: '조약돌 유령', kind: 'normal', body: 'spirit', element: 'earth', scale: 0.65 },
  { key: 'mon_spirit_wind', name: '산들 유령', kind: 'normal', body: 'spirit', element: 'wind', scale: 0.65 },
  { key: 'boss_humanoid', name: '고블린 두목', kind: 'floorBoss', body: 'humanoid', element: null, scale: 1.1 },
  { key: 'boss_armored', name: '투구게', kind: 'floorBoss', body: 'armored', element: null, scale: 1.1 },
  { key: 'boss_flying', name: '박쥐 비행대장', kind: 'floorBoss', body: 'flying', element: null, scale: 1.1 },
  { key: 'boss_spirit', name: '유령 임금', kind: 'floorBoss', body: 'spirit', element: null, scale: 1.1 },
  { key: 'daily_turtle', name: '연못 거북', kind: 'dailyBoss', body: 'armored', element: 'water', scale: 1.7 },
  { key: 'daily_mole', name: '두더지 광부', kind: 'dailyBoss', body: 'humanoid', element: 'earth', scale: 1.7 },
  { key: 'daily_dragon', name: '딸꾹 드래곤', kind: 'dailyBoss', body: 'flying', element: 'fire', scale: 1.7 },
  { key: 'daily_cloud', name: '뭉게 정령', kind: 'dailyBoss', body: 'spirit', element: 'wind', scale: 1.7 },
  { key: 'daily_gamasot', name: '가마솥 대감', kind: 'dailyBoss', body: 'armored', element: 'fire', scale: 1.7 },
] as const satisfies readonly MonsterSpec[];

export type MonsterKey = (typeof MONSTERS)[number]['key'];

const MONSTER_BY_KEY = new Map<string, MonsterSpec>(MONSTERS.map((m) => [m.key, m]));

export function monsterSpec(key: string): MonsterSpec {
  const m = MONSTER_BY_KEY.get(key);
  if (m === undefined) throw new Error(`unknown monster ${key}`);
  return m;
}

/** The normal monster of a body and element: `mon_<body>_<element>`. */
export function normalMonster(body: BodyType, element: Element): MonsterSpec {
  return monsterSpec(`mon_${body}_${element}`);
}

/** The floor boss of a body: `boss_<body>`. */
export function floorBossMonster(body: BodyType): MonsterSpec {
  return monsterSpec(`boss_${body}`);
}

// ---------- Stats and the floor curve (6.4) [튜닝] ----------

/** A fighter's numbers; HP and attack are whole numbers once scaled. */
export interface MonsterStats {
  hp: number;
  atk: number;
  def: number;
  crit: number;
  intervalTicks: number;
}

/**
 * One floor's budget at floor 1: a group of MOB_GROUP_BASE normal monsters, each with these numbers.
 * A bigger group (mobCount) splits the same HP and attack among more monsters, so the count changes
 * the fight's shape (spread skills pay), not the floor's strength.
 */
export const MOB_STATS: MonsterStats = { hp: 3000, atk: 80, def: 30, crit: 0, intervalTicks: 12 };
export const MOB_GROUP_BASE = 3;

/** 잡몹 무리의 마릿수 (6.1 추천 3~5): 3 in bands 1~2, 4 in 3~4, 5 from 5. */
export const MOB_COUNT = { base: 3, max: 5, bandsPerExtra: 2 } as const;

/**
 * A floor boss stands alone (6.2 추천) and is the whole group's budget × its power (6.2 표: 구간 보스·대보스
 * ×1.3, 마왕 ×2.0, common.ts). It hits slower and harder; its DPS is the group's × power.
 */
export const FLOOR_BOSS_SHAPE = { hpOfGroup: 1, atkOfGroup: 0.6, def: 1.2, crit: 0.05, intervalTicks: 15 } as const;

/** Stat growth per floor (6.4: 기준값 × 1.04^(층 − 1)); the one number in common.ts. */
export const FLOOR_GROWTH = ENEMY_GROWTH_PER_FLOOR;
export { BOSS_POWER_MULT, DEMON_LORD_POWER_MULT };

/** Floor bosses every 10 floors (사용자 결정 '10층마다 보스'); 마왕 every 100 (6.2). */
export const BOSS_EVERY = 10;
export const DEMON_LORD_EVERY_FLOORS = 100;
/** 대보스 from floor 50 (구간 보스 10~40 다음, 6.2). No pictures yet (16장의 4번): the floor bosses stand in. */
export const GREAT_BOSS_FROM = SECTION_BOSS_LAST_FLOOR + BOSS_EVERY;

/** 구간 보스 순서 (6.2 추천): 10층 인간형 → 20층 갑각 → 30층 비행 → 40층 영체 → again. */
export const FLOOR_BOSS_ORDER: readonly BodyType[] = ['humanoid', 'armored', 'flying', 'spirit'];

// ---------- Floor layout (6.1, 6.2) ----------

/**
 * 스테이지 배치의 공용 시드 (3.5: 모두에게 같은 공용 시드). Every player meets the same floors.
 * The server may hand it out later; until then it is this constant.
 */
export const STAGE_LAYOUT_SEED = 0x9e0d2026;

/** A band's 9 normal floors: 6 of its main body and 3 of its sub body, shuffled (6.2). */
export const BAND_MAIN_FLOORS = 6;
export const BAND_SUB_FLOORS = 3;
/** No spirit floors through floor 20 (6.2). */
export const NO_SPIRIT_THROUGH = 20;

// ---------- Daily bosses (8.1, 8.2) ----------

export interface DailyBossSpec {
  key: MonsterKey;
  /** Day of the five-day turn, 1~5 (8.1 추천 돌림). */
  day: number;
  /** Small flavour on top of the stage curve [튜닝]: a sturdy turtle, a hard-hitting dragon. */
  hp: number;
  atk: number;
  def: number;
}

export const DAILY_BOSSES: readonly DailyBossSpec[] = [
  { key: 'daily_turtle', day: 1, hp: 1.0, atk: 0.9, def: 1.4 },
  { key: 'daily_mole', day: 2, hp: 1.1, atk: 1.0, def: 1.0 },
  { key: 'daily_dragon', day: 3, hp: 0.9, atk: 1.3, def: 0.9 },
  { key: 'daily_cloud', day: 4, hp: 1.2, atk: 0.9, def: 0.8 },
  { key: 'daily_gamasot', day: 5, hp: 1.15, atk: 1.0, def: 1.2 },
];

/**
 * 보스 단계의 곡선 (8.2: 스테이지 곡선과 같은 모양에 시작점만 다르게). Stage s fights like floor
 * firstFloor + (s − 1) × floorsPerStage, as one boss with hpOfGroup × that floor's group budget
 * (a 60 s fight, twice the stage's 30 s) and a boss's slow heavy blows.
 */
export const DAILY_STAGE = {
  firstFloor: 1,
  floorsPerStage: 2,
  hpOfGroup: 1.8,
  atkOfGroup: 1.1,
  def: 1.2,
  crit: 0.05,
  intervalTicks: 20,
} as const;

/** 하루 도전 횟수 (사용자 결정): 5, back to 5 on reaching the next stage. */
export const DAILY_TRIES = 5;

/** A day is DAY_MINUTES of server time (when it starts is [미정], 16장의 13번). */
export const DAILY_DAY_MINUTES = DAY_MINUTES;

/** 랭킹 무리 (8.3): about 100 players. */
export const RANK_GROUP_SIZE = 100;

/**
 * 꼼수 방지 (6.7, 8.3 추천 '레벨이 그 층대의 보통보다 크게 높으면 위 무리로'): a player is grouped
 * by max(최고 스테이지, 레벨 − levelSlack). How the two mix is [미정] (16장의 13번).
 */
export const RANK_MATCH = { levelSlack: 10 } as const;
