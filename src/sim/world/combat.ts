// Party power and floor judgement (기획서 7.3, 7.9). Pure functions, no state.

import type { Rng } from '../core/rng.ts';
import type { BodyType, Element, TowerId, Weapon, WeaponType } from '../core/types.ts';
import {
  BEATS,
  BODY_FIT_MULT,
  type BodyFit,
  CRIT_DAMAGE,
  elementMultiplier,
  MASTERY_MASTER_FLOOR,
  MASTERY_SKILLED_FLOOR,
  materialAttack,
  QUALITY,
  WEAPON_SPEC,
} from '../data/common.ts';
import { ENCHANT_AFFINITY_SCALE, ENCHANTS } from '../data/enchants.ts';
import { UNIQUES } from '../data/uniques.ts';
import {
  BASE_ATTACK,
  BOSS_DEATH_MULT,
  BOSS_HP_LOSS_MULT,
  CLEAR_CHANCE_POINTS,
  DULL_ATTACK_MULT,
  FAIL_HP_THRESHOLD,
  FAIL_ODDS_HIGH_HP,
  FAIL_ODDS_LOW_HP,
  type FailOdds,
  HP_LOSS_ON_CLEAR,
} from '../data/world.ts';
import type { FailOutcome, FloorInfo } from './types.ts';

// ---------- Weapon ----------

/** 무기 공격력 = 기본 공격력 × 종류 × 주재료 × 품질 (4.4). */
export function weaponAttack(w: Pick<Weapon, 'type' | 'materialTier' | 'quality'>): number {
  return BASE_ATTACK * WEAPON_SPEC[w.type].attack * materialAttack(w.materialTier) * QUALITY[w.quality].attack;
}

export type Mastery = 'novice' | 'skilled' | 'master';

/** 미숙 / 능숙 (15층) / 달인 (40층), 4.7. */
export function masteryOf(masteryFloor: number): Mastery {
  if (masteryFloor >= MASTERY_MASTER_FLOOR) return 'master';
  if (masteryFloor >= MASTERY_SKILLED_FLOOR) return 'skilled';
  return 'novice';
}

/** A weapon's tower-calculation numbers after mastery locks and affinity bonuses. */
export interface WeaponProfile {
  type: WeaponType;
  attack: number;
  element: Element | null;
  /** 속성 증폭: added to the advantage multiplier. */
  advantageAdd: number;
  critRate: number;
  critDamage: number;
  /** Product of attack enchants (연격, 선제, 질풍, 추격). */
  attackMult: number;
  /** Multiplier used for △ bodies (관통 raises it). */
  badBodyMult: number;
  allPierce: boolean;
  /** Injury and death chance multiplier (응급 회복, 빙갑). */
  riskMult: number;
  wearMult: number;
  incomeMult: number;
  partyAdd: number;
  bossPowerMult: number;
  nonBossPowerMult: number;
  rebirth: boolean;
  fairWind: boolean;
  indomitable: boolean;
  extraFloors: number;
}

export function weaponProfile(w: Omit<Weapon, 'id'>, masteryFloor: number): WeaponProfile {
  const spec = WEAPON_SPEC[w.type];
  const mastery = masteryOf(masteryFloor);
  const upperOn = mastery !== 'novice';
  const p: WeaponProfile = {
    type: w.type,
    attack: weaponAttack(w),
    element: w.element,
    advantageAdd: 0,
    critRate: spec.critRate,
    critDamage: CRIT_DAMAGE,
    attackMult: 1,
    badBodyMult: BODY_FIT_MULT.bad,
    allPierce: false,
    riskMult: 1,
    wearMult: 1,
    incomeMult: 1,
    partyAdd: 0,
    bossPowerMult: 1,
    nonBossPowerMult: 1,
    rebirth: false,
    fairWind: false,
    indomitable: false,
    extraFloors: 0,
  };
  let pursuitPerCrit = 0;
  for (const id of w.enchants) {
    const e = ENCHANTS[id];
    if (e.upper && !upperOn) continue; // locked: 0 in the tower calculation
    const k = spec.affinity.includes(id) ? ENCHANT_AFFINITY_SCALE : 1;
    const effect = e.effect;
    switch (effect.kind) {
      case 'attackMult':
        p.attackMult *= 1 + (effect.value - 1) * k;
        break;
      case 'pursuit':
        pursuitPerCrit += effect.perCritRate * k;
        break;
      case 'critRateAdd':
        p.critRate += effect.value * k;
        break;
      case 'critDamageAdd':
        p.critDamage += effect.value * k;
        break;
      case 'riskMult':
        p.riskMult *= 1 - (1 - effect.value) * k;
        break;
      case 'wearMult':
        p.wearMult *= 1 - (1 - effect.value) * k;
        break;
      case 'badBodyMult':
        p.badBodyMult = Math.max(p.badBodyMult, BODY_FIT_MULT.bad + (effect.value - BODY_FIT_MULT.bad) * k);
        break;
      case 'bounty':
        p.incomeMult += effect.incomeAdd * k;
        break;
      case 'elementAdvantageAdd':
        p.advantageAdd += effect.value * k;
        break;
      case 'rule':
        if (id === 'indomitable') p.indomitable = true;
        break;
    }
  }
  // 추격 scales with the final crit rate.
  p.attackMult *= 1 + p.critRate * pursuitPerCrit;

  if (w.unique !== null && mastery === 'master') {
    const effect = UNIQUES[w.unique].effect;
    switch (effect.kind) {
      case 'bossPowerMult':
        p.bossPowerMult *= effect.value;
        break;
      case 'nonBossPowerMult':
        p.nonBossPowerMult *= effect.value;
        break;
      case 'partyAdd':
        p.partyAdd += effect.value;
        break;
      case 'extraFloors':
        p.extraFloors += effect.value;
        break;
      case 'riskMult':
        p.riskMult *= effect.value;
        break;
      case 'rebirth':
        p.rebirth = true;
        break;
      case 'allPierce':
        p.allPierce = true;
        break;
      case 'fairWind':
        p.fairWind = true;
        break;
    }
  }
  return p;
}

// ---------- Matchup (7.5, 7.6) ----------

export function elementFactor(p: Pick<WeaponProfile, 'element' | 'advantageAdd'>, tower: TowerId): number {
  const base = elementMultiplier(p.element, tower);
  if (p.element !== null && BEATS[p.element] === tower) return base + p.advantageAdd;
  return base;
}

export function bodyFactor(
  p: Pick<WeaponProfile, 'type' | 'element' | 'badBodyMult' | 'allPierce'>,
  body: BodyType,
): number {
  let fit: BodyFit = WEAPON_SPEC[p.type].bodyFit[body];
  // An elemental weapon reaches spirits: △ → ○ (4.5 속성 부여).
  if (fit === 'bad' && body === 'spirit' && p.element !== null) fit = 'normal';
  if (fit === 'bad' && p.allPierce) fit = 'normal';
  return fit === 'bad' ? p.badBodyMult : BODY_FIT_MULT[fit];
}

/** 치명 = 1 + 치명률 × (치명 피해 − 1). */
export function critFactor(p: Pick<WeaponProfile, 'critRate' | 'critDamage'>): number {
  return 1 + p.critRate * (p.critDamage - 1);
}

// ---------- Party power (7.3) ----------

export interface Fighter {
  /** 용사 힘 (7.4). */
  power: number;
  /** 파티 보정 from 인망. */
  partyBonus: number;
  /** 기타 배율 carried by the hero (계승 '탑 적응'). */
  powerMult: number;
}

export function partyPower(p: WeaponProfile, fighter: Fighter, info: FloorInfo, dull = false): number {
  const boss = info.kind !== 'normal';
  const attack = p.attack * (dull ? DULL_ATTACK_MULT : 1);
  const matchup = elementFactor(p, info.tower) * bodyFactor(p, info.body);
  const party = 1 + fighter.partyBonus + p.partyAdd;
  const other = fighter.powerMult * (boss ? p.bossPowerMult : p.nonBossPowerMult);
  return attack * fighter.power * matchup * critFactor(p) * p.attackMult * party * other;
}

// ---------- Judgement (7.9) ----------

/** Clear chance from R, straight lines between the table points. */
export function clearChance(r: number): number {
  const pts = CLEAR_CHANCE_POINTS;
  const first = pts[0] as readonly [number, number];
  const last = pts[pts.length - 1] as readonly [number, number];
  if (r <= first[0]) return first[1];
  if (r >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [r1, c1] = pts[i] as readonly [number, number];
    if (r <= r1) {
      const [r0, c0] = pts[i - 1] as readonly [number, number];
      return c0 + ((c1 - c0) * (r - r0)) / (r1 - r0);
    }
  }
  return last[1];
}

/** Chance used for decisions: 순풍의 운 rolls twice and keeps the better. */
export function effectiveClearChance(chance: number, fairWind: boolean): number {
  return fairWind ? 1 - (1 - chance) * (1 - chance) : chance;
}

/** HP lost on a clear = 10% ÷ R, boss floors ×2. */
export function hpLossOnClear(r: number, boss: boolean): number {
  return (HP_LOSS_ON_CLEAR / Math.max(r, 1e-6)) * (boss ? BOSS_HP_LOSS_MULT : 1);
}

/**
 * Failure odds. Multipliers shrink or grow injury/death; the difference moves into
 * 'safe return' (7.9). riskMult hits both, injuryMult only injury.
 */
export function failOdds(hpAtEntry: number, boss: boolean, riskMult = 1, injuryMult = 1): FailOdds {
  const base = hpAtEntry >= FAIL_HP_THRESHOLD ? FAIL_ODDS_HIGH_HP : FAIL_ODDS_LOW_HP;
  const death = Math.min(1, base.death * (boss ? BOSS_DEATH_MULT : 1) * riskMult);
  const injury = Math.min(1 - death, base.injury * riskMult * injuryMult);
  return { safe: 1 - injury - death, injury, death };
}

/** One clear roll; 순풍의 운 rolls twice. Always draws the same count for a given flag. */
export function rollClear(rng: Rng, chance: number, fairWind: boolean): boolean {
  const a = rng.next();
  const b = fairWind ? rng.next() : 1;
  return Math.min(a, b) < chance;
}

export interface FailRoll {
  outcome: FailOutcome;
  luckSaved: boolean;
  indomitableUsed: boolean;
}

/** Order: table roll → 운 (death → injury) → 불굴 (death → injury, once per expedition). */
export function rollFailOutcome(
  rng: Rng,
  odds: FailOdds,
  luckSaveChance: number,
  indomitableReady: boolean,
): FailRoll {
  const x = rng.next();
  let outcome: FailOutcome = x < odds.death ? 'death' : x < odds.death + odds.injury ? 'injury' : 'safe';
  let luckSaved = false;
  let indomitableUsed = false;
  if (outcome === 'death' && rng.next() < luckSaveChance) {
    outcome = 'injury';
    luckSaved = true;
  }
  if (outcome === 'death' && indomitableReady) {
    outcome = 'injury';
    indomitableUsed = true;
  }
  return { outcome, luckSaved, indomitableUsed };
}

/** Average party power over a list of floors (목표 기대 전투력, 5.1). */
export function expectedPower(p: WeaponProfile, fighter: Fighter, floors: readonly FloorInfo[]): number {
  if (floors.length === 0) return 0;
  let sum = 0;
  for (const f of floors) sum += partyPower(p, fighter, f);
  return sum / floors.length;
}
