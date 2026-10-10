// Heroes: creation, level, strength, mastery and inheritance (기획서 6.1~6.5, 7.4).

import type { Rng } from '../core/rng.ts';
import { ELEMENTS, GRADES, WEAPON_TYPES, type Grade, type TowerId, type Weapon, type WeaponType } from '../core/types.ts';
import { GRADE_POWER_CAP, materialPrice } from '../data/common.ts';
import {
  FLOORS_FOR_MAX_LEVEL,
  GRADE_AVERAGE_GROWTH,
  GROWTH_MAX,
  GROWTH_MIN,
  HOME_TOWER_CHANCE,
  INHERIT_COUNT_BASE,
  INHERIT_COUNT_MAX,
  INHERIT_FLOORS_PER_PICK,
  INHERIT_GROWTH_SHARE,
  INHERIT_HEARTS_PER_PICK,
  INHERIT_IDS,
  INHERIT_MASTERY_SHARE,
  INHERIT_STRENGTH_SHARE,
  INHERIT_WEIGHTS,
  type InheritId,
  MAX_LEVEL,
  PARTY_BONUS,
  START_GOLD_UNITS_MAX,
  START_GOLD_UNITS_MIN,
  STAT_TIER_WEIGHTS,
  STAT_TIERS,
  type StatTier,
  TALENT_MIN_MASTER_GROWTH,
  TOUGHNESS_INJURY_MULT,
  TOWER_ADAPT_MULT,
  WEAPON_HOME_TOWER,
} from '../data/world.ts';
import type { Fighter } from './combat.ts';
import type { CareerRecord, HeldWeapon, HeroState, InheritBonus } from './types.ts';

// ---------- Level and strength (7.4) ----------

/** Level 1~30 from cumulative cleared floors (re-climbed floors count). Linear to 30 at ~200. */
export function levelFor(cumulativeFloors: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor((cumulativeFloors * (MAX_LEVEL - 1)) / FLOORS_FOR_MAX_LEVEL));
}

/** 힘 = 시작값 + (상한 − 시작값) × 성장률 × (레벨 − 1) ÷ 29. 시작값 is 1.0 unless inherited. */
export function heroPower(grade: Grade, growth: number, level: number, startPower = 1): number {
  const cap = GRADE_POWER_CAP[grade];
  const start = Math.min(startPower, cap);
  return start + ((cap - start) * growth * (level - 1)) / (MAX_LEVEL - 1);
}

export function levelOf(h: Pick<HeroState, 'cumulativeFloors'>): number {
  return levelFor(h.cumulativeFloors);
}

export function powerOf(h: Pick<HeroState, 'grade' | 'growth' | 'cumulativeFloors' | 'inherit'>): number {
  return heroPower(h.grade, h.growth, levelOf(h), h.inherit.startPower);
}

/** Floor used for weapon mastery: best floor + inherited bonus (4.7, 6.5). */
export function masteryFloorOf(h: Pick<HeroState, 'record' | 'inherit'>): number {
  return h.record + h.inherit.masteryFloorBonus;
}

export function fighterOf(h: HeroState): Fighter {
  return { power: powerOf(h), partyBonus: PARTY_BONUS[h.charisma], powerMult: h.inherit.powerMult };
}

/** Expeditions start one floor above the last boss this hero beat (7.8). */
export function startFloorOf(lastBossFloor: number): number {
  return lastBossFloor + 1;
}

// ---------- Rolling a new hero (6.1~6.3) ----------

export const NO_INHERIT: InheritBonus = {
  picks: [],
  startPower: 1,
  masteryFloorBonus: 0,
  powerMult: 1,
  injuryMult: 1,
};

export function drawStatTier(rng: Rng): StatTier {
  return STAT_TIERS[rng.weightedIndex(STAT_TIERS.map((t) => STAT_TIER_WEIGHTS[t]))] as StatTier;
}

export function drawGrowth(rng: Rng): number {
  return GROWTH_MIN + rng.next() * (GROWTH_MAX - GROWTH_MIN);
}

export function drawGrade(rng: Rng, shares: Record<Grade, number>): Grade {
  return GRADES[rng.weightedIndex(GRADES.map((g) => shares[g]))] as Grade;
}

/** Half pick the weapon's home tower; the rest pick one of the other three (6.3). */
export function chooseTower(rng: Rng, weaponType: WeaponType): TowerId {
  const home = WEAPON_HOME_TOWER[weaponType];
  const goHome = rng.chance(HOME_TOWER_CHANCE);
  const other = rng.pick(ELEMENTS.filter((e) => e !== home));
  return goHome ? home : other;
}

export function drawStartGold(rng: Rng): number {
  return materialPrice(1) * rng.int(START_GOLD_UNITS_MIN, START_GOLD_UNITS_MAX);
}

/** ★1 iron weapon with no element: what every rookie carries in (6.3). */
export function basicWeapon(id: string, type: WeaponType): Weapon {
  return { id, type, materialTier: 1, quality: 1, element: null, enchants: [], unique: null };
}

export interface RookieRoll {
  grade: Grade;
  weaponType: WeaponType;
  tower: TowerId;
  growth: number;
  charisma: StatTier;
  luck: StatTier;
  gold: number;
}

/** Fixed draw order so a hero's stream always means the same thing. */
export function rollRookie(rng: Rng, shares: Record<Grade, number>, forceGrade: Grade | null = null): RookieRoll {
  const drawn = drawGrade(rng, shares);
  const weaponType = rng.pick(WEAPON_TYPES);
  const tower = chooseTower(rng, weaponType);
  const growth = drawGrowth(rng);
  const charisma = drawStatTier(rng);
  const luck = drawStatTier(rng);
  const gold = drawStartGold(rng);
  return { grade: forceGrade ?? drawn, weaponType, tower, growth, charisma, luck, gold };
}

export interface NewHeroInput {
  id: string;
  seq: number;
  at: number;
  grade: Grade;
  growth: number;
  charisma: StatTier;
  luck: StatTier;
  weaponType: WeaponType;
  tower: TowerId;
  gold: number;
  held: HeldWeapon;
  generation: number;
  masterId: string | null;
  inherit: InheritBonus;
}

export function newHero(i: NewHeroInput): HeroState {
  return {
    id: i.id,
    seq: i.seq,
    grade: i.grade,
    growth: i.growth,
    charisma: i.charisma,
    luck: i.luck,
    weaponType: i.weaponType,
    tower: i.tower,
    arrivedAt: i.at,
    generation: i.generation,
    masterId: i.masterId,
    inherit: i.inherit,
    held: i.held,
    gold: i.gold,
    debt: 0,
    record: 0,
    recordAt: i.at,
    lastBossFloor: 0,
    cumulativeFloors: 0,
    injuries: 0,
    restUntil: i.at,
    stagnation: 0,
    retireHinted: false,
    firstVisitDone: false,
    phase: 'town',
    nextAt: i.at,
    expeditionNo: 0,
    expedition: null,
    stats: {
      expeditions: 0,
      floorsCleared: 0,
      failures: 0,
      dullCount: 0,
      visits: 0,
      repairs: 0,
      weaponsBought: 0,
      goldEarned: 0,
    },
  };
}

// ---------- Inheritance (6.5) ----------

/** 1 + ⌊최고 도달층 ÷ 20⌋ + ⌊충성 하트 ÷ 2⌋, at most 5. */
export function inheritanceCount(record: number, hearts: number): number {
  return Math.min(
    INHERIT_COUNT_MAX,
    INHERIT_COUNT_BASE + Math.floor(record / INHERIT_FLOORS_PER_PICK) + Math.floor(hearts / INHERIT_HEARTS_PER_PICK),
  );
}

function stepUp(t: StatTier): StatTier {
  const i = STAT_TIERS.indexOf(t);
  return STAT_TIERS[Math.min(STAT_TIERS.length - 1, i + 1)] as StatTier;
}

function gradeUp(g: Grade): Grade {
  return GRADES[Math.min(GRADES.length - 1, GRADES.indexOf(g) + 1)] as Grade;
}

export interface DiscipleRoll {
  grade: Grade;
  growth: number;
  charisma: StatTier;
  luck: StatTier;
  gold: number;
  inherit: InheritBonus;
}

/**
 * Fixed inheritance: same weapon type, grade and tower (the caller keeps those).
 * Random picks are drawn without repeats; picks that would do nothing for this
 * disciple are left out ("나쁜 것은 물려주지 않는다").
 */
export function rollDisciple(rng: Rng, master: CareerRecord, hearts: number): DiscipleRoll {
  const ownGrowth = drawGrowth(rng);
  const ownCharisma = drawStatTier(rng);
  const ownLuck = drawStatTier(rng);
  const gold = drawStartGold(rng);

  const useful = (id: InheritId): boolean => {
    switch (id) {
      case 'growth':
        return master.growth > GRADE_AVERAGE_GROWTH && ownGrowth < GROWTH_MAX;
      case 'mastery':
        return master.record > 0;
      case 'charisma':
        return ownCharisma !== 'high';
      case 'luck':
        return ownLuck !== 'high';
      case 'talent':
        return master.grade !== 'S' && master.growth >= TALENT_MIN_MASTER_GROWTH;
      default:
        return true;
    }
  };
  let pool = INHERIT_IDS.filter(useful);
  const picks: InheritId[] = [];
  const count = inheritanceCount(master.record, hearts);
  while (picks.length < count && pool.length > 0) {
    const idx = rng.weightedIndex(pool.map((id) => INHERIT_WEIGHTS[id]));
    const id = pool[idx] as InheritId;
    picks.push(id);
    pool = pool.filter((p) => p !== id);
  }

  const has = (id: InheritId): boolean => picks.includes(id);
  const grade = has('talent') ? gradeUp(master.grade) : master.grade;
  const growth = has('growth')
    ? Math.min(GROWTH_MAX, ownGrowth + (master.growth - GRADE_AVERAGE_GROWTH) * INHERIT_GROWTH_SHARE)
    : ownGrowth;
  const startPower = has('strength')
    ? Math.min(GRADE_POWER_CAP[grade], 1 + master.finalPower * INHERIT_STRENGTH_SHARE)
    : 1;
  return {
    grade,
    growth,
    charisma: has('charisma') ? stepUp(ownCharisma) : ownCharisma,
    luck: has('luck') ? stepUp(ownLuck) : ownLuck,
    gold,
    inherit: {
      picks,
      startPower,
      masteryFloorBonus: has('mastery') ? master.record * INHERIT_MASTERY_SHARE : 0,
      powerMult: has('towerAdapt') ? TOWER_ADAPT_MULT : 1,
      injuryMult: has('toughness') ? TOUGHNESS_INJURY_MULT : 1,
    },
  };
}
