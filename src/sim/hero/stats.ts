// 용사의 능력치 (기획서 5.4, 5.7, 6.4): 체력·공격·방어·치명타 from the role, the shared level, the
// star step (with its evolution) and the weapon. Also what the weapon brings into a fight
// (enchants 4.5 '전투 계산' 열, 고유능력 4.6). Pure.

import type { BodyType, Element, WeaponType } from '../core/types.ts';
import { BODY_FIT_MULT, BEATS, CRIT_DAMAGE, ELEMENT_MULT, WEAPON_SPEC } from '../data/common.ts';
import { ENCHANT_AFFINITY_SCALE, ENCHANTS } from '../data/enchants.ts';
import {
  type HeroKey,
  heroSpec,
  levelAttackMult,
  levelHpMult,
  RARITY_BASE_MULT,
  ROLE_BASE,
  starAttackMult,
  starHpMult,
} from '../data/heroes.ts';
import { UNIQUES } from '../data/uniques.ts';
import { POWER_DEF_WEIGHT, RESONANCE_MULT } from '../data/battle.ts';
import { passiveOpen, starStepOf, type StarStep } from './roster.ts';
import { bareHandsAttack, type WeaponItem, weaponItemAttack } from './weapon.ts';

// ---------- The weapon in a fight ----------

/** What a weapon brings into the damage formula (6.4), after enchant affinity (4.5). */
export interface WeaponCombat {
  type: WeaponType;
  attack: number;
  /** 속성 칸 (null = 무속성). */
  element: Element | null;
  /** 속성 증폭: added to the advantage multiplier. */
  advantageAdd: number;
  critRateAdd: number;
  critDamage: number;
  /** 연격·선제·질풍 (4.5 '전투 계산' 값). */
  attackMult: number;
  /** 추격: attack × (1 + crit rate × this). */
  pursuitPerCrit: number;
  /** The △ multiplier (관통 raises it). */
  badBodyMult: number;
  /** 만물 관통: △ → ○. */
  allPierce: boolean;
  /** 용의 분노 (bosses, the daily boss too) and 해일 (non-boss enemies). */
  bossMult: number;
  nonBossMult: number;
}

/**
 * The weapon's fight numbers. Upper enchants count from the start: 무기 숙련 (4.7) is [미정] and the
 * per-hero best floor it used is gone. Enchants and uniques the doc marks '다시 짠다' (풍요, 견고,
 * 응급 회복, 불굴; 환생, 대지의 가호, 질주, 순풍의 운, 빙갑) do nothing in a fight yet (16장의 15번).
 */
export function weaponCombat(item: WeaponItem | null, heroWeapon: WeaponType): WeaponCombat {
  const type = item?.type ?? heroWeapon;
  const spec = WEAPON_SPEC[type];
  const c: WeaponCombat = {
    type,
    attack: item === null ? bareHandsAttack(type) : weaponItemAttack(item),
    element: item?.element ?? null,
    advantageAdd: 0,
    critRateAdd: 0,
    critDamage: CRIT_DAMAGE,
    attackMult: 1,
    pursuitPerCrit: 0,
    badBodyMult: BODY_FIT_MULT.bad,
    allPierce: false,
    bossMult: 1,
    nonBossMult: 1,
  };
  if (item === null) return c;
  for (const id of item.enchants) {
    const k = spec.affinity.includes(id) ? ENCHANT_AFFINITY_SCALE : 1;
    const e = ENCHANTS[id].effect;
    switch (e.kind) {
      case 'attackMult':
        c.attackMult *= 1 + (e.value - 1) * k;
        break;
      case 'pursuit':
        c.pursuitPerCrit += e.perCritRate * k;
        break;
      case 'critRateAdd':
        c.critRateAdd += e.value * k;
        break;
      case 'critDamageAdd':
        c.critDamage += e.value * k;
        break;
      case 'badBodyMult':
        c.badBodyMult = Math.max(c.badBodyMult, BODY_FIT_MULT.bad + (e.value - BODY_FIT_MULT.bad) * k);
        break;
      case 'elementAdvantageAdd':
        c.advantageAdd += e.value * k;
        break;
      default:
        break; // '다시 짠다' (16장의 15번)
    }
  }
  if (item.unique !== null) {
    const u = UNIQUES[item.unique].effect;
    if (u.kind === 'bossPowerMult') c.bossMult *= u.value;
    else if (u.kind === 'nonBossPowerMult') c.nonBossMult *= u.value;
    else if (u.kind === 'allPierce') c.allPierce = true;
  }
  return c;
}

/** 속성 배율 (6.5) with 속성 증폭 on an advantage. Enemy element null (none) is neutral. */
export function elementMultFor(weapon: Element | null, enemy: Element | null, advantageAdd = 0): number {
  if (weapon === null || enemy === null) return ELEMENT_MULT.none;
  if (weapon === enemy) return ELEMENT_MULT.same;
  if (BEATS[weapon] === enemy) return ELEMENT_MULT.advantage + advantageAdd;
  if (BEATS[enemy] === weapon) return ELEMENT_MULT.disadvantage;
  return ELEMENT_MULT.neutral;
}

/** 체형 배율 (6.6): an element-filled weapon lifts spirit △ to ○; 관통 softens △; 만물 관통 lifts it. */
export function bodyMultFor(w: Pick<WeaponCombat, 'type' | 'element' | 'badBodyMult' | 'allPierce'>, body: BodyType): number {
  let fit = WEAPON_SPEC[w.type].bodyFit[body];
  if (fit === 'bad' && body === 'spirit' && w.element !== null) fit = 'normal';
  if (fit === 'bad' && w.allPierce) fit = 'normal';
  if (fit === 'bad') return w.badBodyMult;
  return BODY_FIT_MULT[fit];
}

/** 공명 (5.2, 6.5): the hero's element = the weapon's. */
export function resonanceMult(heroElement: Element, weaponElement: Element | null): number {
  return weaponElement !== null && weaponElement === heroElement ? RESONANCE_MULT : 1;
}

// ---------- The hero's own stats ----------

export interface HeroStats {
  maxHp: number;
  atk: number;
  def: number;
  /** Crit rate 0..1 (weapon type + 예리 + passive). */
  crit: number;
  critDamage: number;
}

/**
 * 체력·방어 = 역할 기본 × 레벨 × 별·진화; 공격 = 무기 공격력 × 역할 몫 × 레벨 × 별·진화 (6.4).
 * The hero's own passive (atk / hp / def / crit) is in once it is open; team passives are added
 * when a formation is built (stage/team.ts).
 */
export function heroStats(key: HeroKey, copies: number, level: number, weapon: WeaponItem | null): HeroStats {
  const spec = heroSpec(key);
  const step: StarStep = starStepOf(spec.rarity, copies);
  const base = ROLE_BASE[spec.role];
  const rar = RARITY_BASE_MULT[spec.rarity];
  const w = weaponCombat(weapon, spec.weapon);
  const p = passiveOpen(spec.rarity, step.color) ? spec.passive : null;
  const own = (kind: 'atk' | 'hp' | 'def' | 'crit'): number => (p !== null && p.kind === kind ? p.value : 0);
  const hpMult = levelHpMult(level) * starHpMult(step.index) * rar;
  return {
    maxHp: Math.max(1, Math.round(base.hp * hpMult * (1 + own('hp')))),
    atk: Math.max(1, Math.round(w.attack * base.attack * levelAttackMult(level) * starAttackMult(step.index) * rar * (1 + own('atk')))),
    def: Math.max(0, Math.round(base.def * hpMult * (1 + own('def')))),
    crit: Math.min(1, WEAPON_SPEC[w.type].critRate + w.critRateAdd + own('crit')),
    critDamage: w.critDamage,
  };
}

/**
 * 전투력 (6.4): the one summary number on the screen. Not used to decide anything (the battle does).
 * √(공격 × 체력) × (1 + 방어 ÷ 공격 × POWER_DEF_WEIGHT), rounded [튜닝].
 */
export function heroPower(s: Pick<HeroStats, 'maxHp' | 'atk' | 'def'>): number {
  return Math.round(Math.sqrt(s.atk * s.maxHp) * (1 + (s.def / Math.max(1, s.atk)) * POWER_DEF_WEIGHT));
}
