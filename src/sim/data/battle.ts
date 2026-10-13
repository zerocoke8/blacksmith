// 전투 (기획서 6.3~6.7, 8.2, B.16). Every number here is a [튜닝] starting value; change them here,
// not at call sites. The element and body tables are common.ts (the same as 6.5·6.6).

import type { WeaponType } from '../core/types.ts';

// ---------- Time ----------

/** One tick of the battle simulation (6.4: 시작값 0.1초). */
export const BATTLE_TICK_MS = 100;

/** 다음 층 도전의 제한 시간 (6.7): 30 s. */
export const STAGE_TIME_LIMIT_TICKS = 300;

/** 일일 보스 한 번의 도전 (8.2): 60 s. */
export const DAILY_TIME_LIMIT_TICKS = 600;

/**
 * Ticks between a hero's normal attacks. The same for every weapon type (6.4, 4.8 '공격 속도는
 * 전투 계산에 쓰지 않는다'): '느리고 강한'·'연사' are the screen's to show.
 */
export const HERO_ATTACK_INTERVAL_TICKS: Record<WeaponType, number> = {
  oneHandSword: 10,
  greatsword: 10,
  dagger: 10,
  bow: 10,
  crossbow: 10,
  staff: 10,
};

/** A hero's first attack: on tick 1 + slot × this, so five do not land on the same tick. */
export const HERO_FIRST_ATTACK_STAGGER_TICKS = 2;

/** A monster's first blow: its interval + line place × this, so a group does not strike as one. */
export const ENEMY_FIRST_ATTACK_STAGGER_TICKS = 1;

/** An active skill is first ready after this share of its cooldown (a 30 s fight sees a few). */
export const SKILL_FIRST_READY_SHARE = 0.5;

// ---------- Damage ----------

/**
 * The weapon's base attack (4.4 기본 공격력): 무기 공격력 = 이것 × 종류 × 주재료 × 품질 × 강화.
 * Its own value, apart from the v0.8 tower's BASE_ATTACK (data/world.ts).
 */
export const WEAPON_BASE_ATTACK = 100;

/** A hero with no weapon fights bare-handed: a band-1 ★1 weapon of their type × this, no element. */
export const BARE_HANDS_ATTACK = 0.5;

/** 열 보너스 (6.3): damage (and healing) × this in the hero's own row. 시작값 +10%. */
export const ROW_BONUS = 1.1;

/** 공명 (5.2, 6.5): the hero's element = the weapon's element. 시작값 ×1.1, smaller than ×1.3. */
export const RESONANCE_MULT = 1.1;

/**
 * Defence (6.4 방어 감쇠, changed): a hit × atk ÷ (atk + def), the attacker's attack against the
 * defender's defence. Scale-free, so it keeps working when both grow by 1.04 a floor; the doc's
 * 100 ÷ (100 + 방어) stops biting once defence is in the thousands.
 */
export const DEFENSE_WEIGHT = 1;

/**
 * 치명타 (15장의 1번 [질문]): 'gauge' adds the crit rate to a counter each hit and crits when it
 * reaches 1 (no randomness: the same team gets the same result, so the auto-challenge's wait for a
 * change (6.7) and the daily boss's five tries (8.2) hold, and a manual retry cannot shop for luck).
 * 'roll' draws each hit from rngFor(battle seed, 'battle', …) and is ready as this one-line switch.
 * CLAUDE.md: until the user answers, the recommendation (no randomness) stands.
 */
export type CritMode = 'roll' | 'gauge';
export const CRIT_MODE: CritMode = 'gauge';

/** 전투력 (6.4): how much defence counts in the summary number (display only). */
export const POWER_DEF_WEIGHT = 0.25;

// ---------- Skills ----------

/** A healer casts only when some living ally is missing at least this share of max HP. */
export const HEAL_TRIGGER_MISSING = 0.1;

/**
 * 필살기 게이지 (5.4: 게이지가 차면 저절로): +perTick every tick, +perAttack on each of the hero's
 * normal attacks, full at `full`. About fifteen seconds at one attack a second (two in a 30 s floor,
 * four in a 60 s daily try); faster made a special's gold evolution worth more floors than a
 * weapon's quality (5.7 지킬 선, measured with tools/stage/measure.ts).
 */
export const SIGNATURE_GAUGE = { full: 1000, perTick: 2, perAttack: 45 } as const;

/** 'lastStand' passives count from this share of max HP down. */
export const LAST_STAND_HP = 0.5;

// ---------- Weapon enhancement (4.12 추천) ----------

/**
 * 강화 배율 = 1 + step × 단계, at most +max (4.12). +8 (×1.16), not the first +10 (×1.2): with
 * 공명 ×1.1 an old weapon would reach ×1.32, past 속성 유리 ×1.3 (4.12 지킬 선, 16장의 30번).
 */
export const ENHANCE = { step: 0.02, max: 8 } as const;

/** Gold for the next step: base × 1.5^단계 × 2.5^(구간−1) [미정] (16장의 29번). */
export const ENHANCE_COST = { base: 100, perStep: 1.5, perBand: 2.5 } as const;

// ---------- Auto-challenge (6.7) ----------

/** Battles one call of the auto-climb may run (a guard; the screen calls again). */
export const AUTO_CLIMB_MAX_BATTLES = 200;

/** Tries one call of the daily boss's run (climbDaily) may make (a guard, like the auto-climb's). */
export const DAILY_CLIMB_MAX_TRIES = 200;

// ---------- Formation (6.3) ----------

/** 편성 5명, 한 열에 많아야 4명 (사용자 결정). */
export const FORMATION_SIZE = 5;
export const FORMATION_ROW_MAX = 4;
