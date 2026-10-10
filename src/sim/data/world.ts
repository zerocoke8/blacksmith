// World simulation numbers: towers, heroes, expeditions, fame (기획서 3.4, 6, 7, 9).
// Values marked [튜닝] in the doc are copied as-is. Values the doc leaves open are
// marked "helper" and chosen here; change them here, not at call sites.

import type { BodyType, Grade, TowerId, WeaponType } from '../core/types.ts';
import { TOWER_HOME_BODY } from './common.ts';

// ---------- Time scale (3.4, 3.6) ----------

export const DAY_MINUTES = 24 * 60;
export const HOUR_MINUTES = 60;

/** One floor takes 20 minutes, cleared before or not. */
export const FLOOR_MINUTES = 20;
/** At most 12 floors per expedition (= 4 hours). */
export const MAX_FLOORS_PER_EXPEDITION = 12;
export const TOWN_STAY_MINUTES = 3 * HOUR_MINUTES;
export const INJURY_REST_MINUTES = 12 * HOUR_MINUTES;
/** The disciple shows up about 6 hours after the master retires. */
export const DISCIPLE_DELAY_MINUTES = 6 * HOUR_MINUTES;
export const DEMON_LORD_REVIVE_MINUTES = 72 * HOUR_MINUTES;

/** The first hero walks in right away (3.7). */
export const FIRST_HERO_ARRIVAL_MINUTE = 0;
/** The fixed S-grade hero arrives on day 2 (6.2). Helper: start of day 2. */
export const FIXED_S_ARRIVAL_MINUTE = DAY_MINUTES;

// ---------- Tower layout (7.1, 7.2) ----------

export const BAND_FLOORS = 10;
/** The 9 normal floors of a band: 6 main body + 3 sub body, shuffled. */
export const BAND_MAIN_FLOORS = 6;
export const BAND_SUB_FLOORS = 3;
/** Main body draw: the tower's home body 40%, the other three 20% each. */
export const MAIN_BODY_WEIGHT_HOME = 0.4;
export const MAIN_BODY_WEIGHT_OTHER = 0.2;
/** No spirit enemies on floors 1~20. */
export const NO_SPIRIT_THROUGH_FLOOR = 20;
/** Section bosses sit on multiples of 10 up to floor 40; 대보스 from 50 (uniques.ts). */
export const SECTION_BOSS_LAST_FLOOR = 40;
export const DEMON_LORD_EVERY = 100;
/** Demon lord body is "fixed" (7.2). Helper: the tower's home body. */
export const DEMON_LORD_BODY: Record<TowerId, BodyType> = { ...TOWER_HOME_BODY };

// ---------- Combat (7.3, 7.9) ----------

/**
 * Helper constant (7.3): base weapon attack. Chosen so a strength-1.0 rookie with the
 * basic weapon (★1 iron, no element), mid 인망 and a neutral body matchup clears floor 9
 * (R ≈ 1.15) and turns back at the floor 10 boss (R ≈ 0.85, clear chance < 50%).
 */
export const BASE_ATTACK = 110;

/** Clear chance by R; values in between are joined by straight lines. */
export const CLEAR_CHANCE_POINTS: readonly (readonly [r: number, chance: number])[] = [
  [0.7, 0.1],
  [0.85, 0.35],
  [1.0, 0.6],
  [1.2, 0.85],
  [1.5, 0.95],
  [2.0, 0.99],
];

/** HP lost on a clear = 10% ÷ R; boss floors ×2. */
export const HP_LOSS_ON_CLEAR = 0.1;
export const BOSS_HP_LOSS_MULT = 2;

export interface FailOdds {
  safe: number;
  injury: number;
  death: number;
}

/** Failure outcome by HP when entering the failed floor. */
export const FAIL_HP_THRESHOLD = 0.7;
export const FAIL_ODDS_HIGH_HP: FailOdds = { safe: 0.85, injury: 0.14, death: 0.01 };
export const FAIL_ODDS_LOW_HP: FailOdds = { safe: 0.7, injury: 0.28, death: 0.02 };
export const BOSS_DEATH_MULT = 2;

/** Weapon attack ×0.5 when durability hits 0 on a floor (무뎌짐, 7.12). */
export const DULL_ATTACK_MULT = 0.5;

/**
 * An enchant that suits the weapon type moves 1.5x as far from neutral (4.5).
 * Belongs with enchants.ts; kept here until that file exports it.
 */
export const ENCHANT_AFFINITY_SCALE = 1.5;

/**
 * Numeric side of 고유능력 (4.6). Belongs with uniques.ts, which only carries the
 * descriptions; kept here until that file exports numbers.
 */
export const UNIQUE_BOSS_POWER_MULT = 1.5; // 용의 분노
export const UNIQUE_NON_BOSS_POWER_MULT = 1.5; // 해일
export const UNIQUE_PARTY_BONUS_ADD = 0.2; // 대지의 가호
export const UNIQUE_EXTRA_FLOORS = 4; // 질주
export const UNIQUE_RISK_MULT = 0.5; // 빙갑

// ---------- Return rules (7.10) ----------

export const RETURN_AT_HP = 0.4;
export const RETURN_AT_DURABILITY = 0.2;
/** Turn back when the next floor's clear chance is below this. */
export const RETURN_BELOW_CLEAR_CHANCE = 0.5;

// ---------- Durability (7.12) ----------

export const WEAR_NORMAL_FLOOR = 0.03;
export const WEAR_BOSS_MIN = 0.1;
export const WEAR_BOSS_MAX = 0.3;
/** Back from an expedition below 50% → visits the shop for repair. */
export const REPAIR_VISIT_BELOW = 0.5;

// ---------- Heroes (6.1~6.5, 7.4) ----------

export const STAT_TIERS = ['low', 'mid', 'high'] as const;
export type StatTier = (typeof STAT_TIERS)[number];

export const STAT_TIER_LABEL: Record<StatTier, string> = { low: '하', mid: '중', high: '상' };

/** Helper: the doc does not give a distribution for 인망·운. Mid is twice as common. */
export const STAT_TIER_WEIGHTS: Record<StatTier, number> = { low: 1, mid: 2, high: 1 };

/** 인망 → 파티 보정 (6.4). */
export const PARTY_BONUS: Record<StatTier, number> = { low: 0.2, mid: 0.4, high: 0.6 };
/** 운 → chance that a death becomes an injury (6.1). */
export const LUCK_DEATH_TO_INJURY: Record<StatTier, number> = { low: 0.1, mid: 0.2, high: 0.3 };

/** Hidden growth rate is drawn uniformly from 30~100%. */
export const GROWTH_MIN = 0.3;
export const GROWTH_MAX = 1.0;

/** Level 1~30 by cumulative cleared floors; about 200 floors (day 7) reaches 30. */
export const MAX_LEVEL = 30;
export const FLOORS_FOR_MAX_LEVEL = 200;

/** Weapon mastery by best floor (4.7). */
export const MASTERY_SKILLED_FLOOR = 15;
export const MASTERY_MASTER_FLOOR = 40;

/** The tower whose home body each weapon type hits for ◎ (6.3). */
export const WEAPON_HOME_TOWER: Record<WeaponType, TowerId> = {
  oneHandSword: 'fire',
  dagger: 'fire',
  greatsword: 'earth',
  crossbow: 'earth',
  bow: 'wind',
  staff: 'water',
};
/** 50% pick the weapon's home tower; the rest pick uniformly among the other three. */
export const HOME_TOWER_CHANCE = 0.5;

/** First-visit gold = band-1 material price × 15~30. */
export const START_GOLD_UNITS_MIN = 15;
export const START_GOLD_UNITS_MAX = 30;
/** Each cleared floor earns that band's material price × 1. */
export const INCOME_UNITS_PER_FLOOR = 1;

/** Two expeditions in a row without a new record → comes to buy a new weapon. */
export const STAGNATION_EXPEDITIONS = 2;

/** Retirement, judged on every return (6.3). */
export const RETIRE_STAGNANT_MINUTES = 24 * HOUR_MINUTES;
export const RETIRE_HINT_STAGNANT_MINUTES = 12 * HOUR_MINUTES;
export const RETIRE_MIN_DAYS: Record<Grade, number> = { N: 3, C: 4, B: 6, A: 6, S: 7 };
export const RETIRE_AT_INJURIES = 5;
export const RETIRE_AT_DAYS = 10;

// ---------- Inheritance (6.5) ----------

export const INHERIT_IDS = [
  'growth',
  'strength',
  'mastery',
  'charisma',
  'luck',
  'towerAdapt',
  'toughness',
  'familyLoyalty',
  'talent',
] as const;
export type InheritId = (typeof INHERIT_IDS)[number];

export const INHERIT_LABEL: Record<InheritId, string> = {
  growth: '성장률',
  strength: '강함',
  mastery: '무기 숙련',
  charisma: '인망',
  luck: '운',
  towerAdapt: '탑 적응',
  toughness: '강인함',
  familyLoyalty: '가문의 단골',
  talent: '재능',
};

/** '보통' = 1, '낮음' = helper 0.3. */
export const INHERIT_WEIGHTS: Record<InheritId, number> = {
  growth: 1,
  strength: 1,
  mastery: 1,
  charisma: 1,
  luck: 1,
  towerAdapt: 1,
  toughness: 1,
  familyLoyalty: 1,
  talent: 0.3,
};

/** Random inheritance count = 1 + ⌊record ÷ 20⌋ + ⌊hearts ÷ 2⌋, at most 5. */
export const INHERIT_COUNT_BASE = 1;
export const INHERIT_FLOORS_PER_PICK = 20;
export const INHERIT_HEARTS_PER_PICK = 2;
export const INHERIT_COUNT_MAX = 5;
/** Helper: loyalty is not simulated yet, so every master is assumed to have this many hearts. */
export const ASSUMED_LOYALTY_HEARTS = 2;

export const GRADE_AVERAGE_GROWTH = (GROWTH_MIN + GROWTH_MAX) / 2;
export const INHERIT_GROWTH_SHARE = 0.5;
export const INHERIT_STRENGTH_SHARE = 0.15;
export const INHERIT_MASTERY_SHARE = 0.25;
export const TOWER_ADAPT_MULT = 1.05;
export const TOUGHNESS_INJURY_MULT = 0.8;

// ---------- Fame (9.1, 9.2) ----------

export const FAME_PER_FIRST_CLEAR = 1; // × floor
export const FAME_PER_TOWER_RECORD = 2; // × floor, on top of the first clear
export const FAME_PER_RETIRE_RECORD = 10; // × record

export interface FameStageSpec {
  stage: number;
  name: string;
  fame: number;
  newHeroesPerDay: number;
}

export const FAME_STAGES: readonly FameStageSpec[] = [
  { stage: 1, name: '무명 대장간', fame: 0, newHeroesPerDay: 8 },
  { stage: 2, name: '마을 대장간', fame: 300, newHeroesPerDay: 12 },
  { stage: 3, name: '소문난 대장간', fame: 2_000, newHeroesPerDay: 16 },
  { stage: 4, name: '도시의 명장', fame: 10_000, newHeroesPerDay: 20 },
  { stage: 5, name: '왕국의 명장', fame: 50_000, newHeroesPerDay: 25 },
  { stage: 6, name: '대륙의 명장', fame: 250_000, newHeroesPerDay: 30 },
  { stage: 7, name: '전설의 대장장이', fame: 1_000_000, newHeroesPerDay: 35 },
];
/** ★n stages beyond 7: threshold ×2 each, +3 new heroes per day each. */
export const STAR_STAGE_FAME_MULT = 2;
export const STAR_STAGE_NEW_HEROES = 3;

/** From stage 2 to 7, each stage moves 2%p from N into B 1%p, A 0.6%p, S 0.4%p (6.2). */
export const GRADE_SHARE_SHIFT_PER_STAGE: Record<Grade, number> = { N: -0.02, C: 0, B: 0.01, A: 0.006, S: 0.004 };
export const GRADE_SHARE_LAST_SHIFT_STAGE = 7;

/**
 * Helper: 9.2 '새 용사/일' does not say whether disciples count. false = disciples come
 * on top of the daily new heroes (as written); true = each disciple takes one arrival.
 */
export const DISCIPLES_REPLACE_NEW_HEROES = false;

/** Helper: gap between arrivals = (1 day ÷ rate) × uniform(0.5, 1.5). */
export const SPAWN_GAP_JITTER_MIN = 0.5;
export const SPAWN_GAP_JITTER_MAX = 1.5;

// ---------- Credit (5.3) ----------

export const CREDIT_PREMIUM_FIRST_VISIT = 0.5;
export const CREDIT_PREMIUM_LATER = 0.25;
/** Credits open at once, shop-wide. The 외상 장부 facility raises it to 6 (9.4). */
export const CREDIT_SLOTS_START = 2;
export const CREDIT_SLOTS_MAX = 6;
/**
 * Grades that wait in the queue when the shelf has nothing in budget (5.1), and so can
 * be offered credit. N·C just leave. Favorites and regulars are not simulated.
 */
export const CREDIT_QUEUE_GRADES: readonly Grade[] = ['B', 'A', 'S'];

// ---------- Supply policies (balance simulator stand-in for the player) ----------

/** Policies 'standard' and 'matched' hand over ★3 (역작) weapons. */
export const POLICY_QUALITY = 3;
