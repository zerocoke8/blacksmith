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
 * Ticks between a hero's normal attacks at attack speed 1, by weapon type. 사용자 결정 2026-10-14
 * turned over 4.8 '공격 속도는 전투 계산에 쓰지 않는다': every weapon has its own rhythm. 4.8's
 * '기대 데미지는 같게' still holds: a normal attack's power is × (this ÷ ATTACK_SPEED_REF_TICKS), so
 * a dagger's quick jabs and a crossbow's slow bolts do the same damage a second.
 */
export const HERO_ATTACK_INTERVAL_TICKS: Record<WeaponType, number> = {
  dagger: 7,
  oneHandSword: 10,
  bow: 11,
  staff: 12,
  greatsword: 14,
  crossbow: 15,
};

/** The interval a hero's normal attack power is weighed against: power × interval ÷ this. */
export const ATTACK_SPEED_REF_TICKS = 10;

/**
 * A hero's first attack: on tick 1 + slot × this, so five do not land on the same tick (at attack
 * speed 1, whatever the weapon's interval).
 */
export const HERO_FIRST_ATTACK_STAGGER_TICKS = 2;

/** A monster's first blow: its interval + line place × this, so a group does not strike as one. */
export const ENEMY_FIRST_ATTACK_STAGGER_TICKS = 1;

/** An active skill is first ready after this share of its cooldown (a 30 s fight sees a few). */
export const SKILL_FIRST_READY_SHARE = 0.5;

/**
 * A cast puts the next normal attack off (사용자 결정 2026-10-14 '스킬쓰면 다음 공격도 늦춰지게'): the
 * swing meter stands still this many ticks after an active skill, a signature or a monster's skill.
 * A pause, not an emptied meter, so every weapon loses the same time to a cast (an emptied meter cost
 * a whole blow whenever a cooldown was a multiple of the interval: 13~19% of a sword's or a
 * greatsword's normal attacks against 2~5% of a dagger's), and 4.8 '기대 데미지는 같게' holds.
 */
export const CAST_SWING_PAUSE_TICKS = { skill: 6, signature: 10, monster: 6 } as const;

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
 * 치명타 (15장의 1번, 사용자 결정 2026-10-14 '확률 방식으로'): 'roll' draws each hit's crit from
 * rngFor(battle seed, …battle key) in the battle's fixed order, so the same seed and inputs still
 * replay the same battle (13장). The seed is one per challenge (6.7: 층과 도전 번호), so retrying
 * cannot shop for luck on the same attempt. 'gauge' (the crit rate added to a counter, a crit on
 * reaching 1, no randomness) stays for tests and measurements that need exact numbers.
 */
export type CritMode = 'roll' | 'gauge';
export const CRIT_MODE: CritMode = 'roll';

/** 전투력 (6.4): how much defence counts in the summary number (display only). */
export const POWER_DEF_WEIGHT = 0.25;

// ---------- Skills ----------

/** A healer casts only when some living ally is missing at least this share of max HP. */
export const HEAL_TRIGGER_MISSING = 0.1;

/**
 * 필살기 게이지 (5.4): +perTick every tick, +perAttack × (the hero's interval ÷
 * ATTACK_SPEED_REF_TICKS) on each normal attack (so a dagger's many jabs fill it no faster than a
 * crossbow's few bolts), full at `full`. About fifteen seconds at speed 1 (two in a 30 s floor, four
 * in a 60 s daily try); faster made a special's gold evolution worth more floors than a weapon's
 * quality (5.7 지킬 선, measured with tools/stage/measure.ts). It fires by itself when full in auto
 * mode, or when the player taps the card (사용자 결정 2026-10-14); in manual mode a full gauge waits.
 */
export const SIGNATURE_GAUGE = { full: 1000, perTick: 2, perAttack: 45 } as const;

/** 'lastStand' passives count from this share of max HP down. */
export const LAST_STAND_HP = 0.5;

// ---------- Statuses (사용자 결정 2026-10-14: 공격 속도가 버프·디버프로 바뀐다) ----------

/** A stat a status changes for a while. */
export type StatusStat = 'atkSpeed';

/**
 * A timed status a skill puts on fighters: `stat` × `mult` for `ticks` (through tick cast + ticks).
 * on: 'allies' — the caster's living side, the caster too (a buff); 'targets' — the enemies the
 * skill hit that still stand (a monster's skill: the hero it is on); 'foes' — every living fighter
 * of the other side. The same skill from the same caster refreshes its status instead of stacking;
 * statuses from different sources multiply.
 */
export interface StatusSpec {
  stat: StatusStat;
  mult: number;
  ticks: number;
  on: 'allies' | 'targets' | 'foes';
}

/** A monster's own skill (a daily boss's roar): goes off every `everyTicks`, first at `firstTick`. */
export interface EnemySkill {
  id: string;
  name: string;
  firstTick: number;
  everyTicks: number;
  status: StatusSpec;
}

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
