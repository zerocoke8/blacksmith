// Shared numbers from 기획서. Everything here is a [튜닝] starting value unless
// the doc says otherwise; change numbers here, not at call sites.

import type { BodyType, Element, EnchantId, Grade, QualityTier, TowerId, Weapon, WeaponType } from '../core/types.ts';

// ---------- Labels (player-facing, Korean) ----------

export const WEAPON_LABEL: Record<WeaponType, string> = {
  oneHandSword: '한손검',
  greatsword: '대검',
  dagger: '단검',
  bow: '활',
  crossbow: '석궁',
  staff: '지팡이',
};

export const ELEMENT_LABEL: Record<Element, string> = { water: '수', fire: '화', earth: '지', wind: '풍' };

export const TOWER_LABEL: Record<TowerId, string> = {
  water: '수의 탑',
  fire: '화의 탑',
  earth: '지의 탑',
  wind: '풍의 탑',
};

export const BODY_LABEL: Record<BodyType, string> = {
  humanoid: '인간형',
  armored: '갑각',
  flying: '비행',
  spirit: '영체',
};

// ---------- Weapon types (기획서 4.8, 7.6) ----------

export type BodyFit = 'good' | 'normal' | 'bad'; // ◎ ○ △

export interface WeaponTypeSpec {
  attack: number;
  critRate: number;
  bodyFit: Record<BodyType, BodyFit>;
  /** Enchants whose numeric effect is 1.5x on this weapon type (4.5). */
  affinity: readonly EnchantId[];
}

export const WEAPON_SPEC: Record<WeaponType, WeaponTypeSpec> = {
  oneHandSword: {
    attack: 1.0,
    critRate: 0.05,
    bodyFit: { humanoid: 'good', armored: 'normal', flying: 'bad', spirit: 'bad' },
    affinity: ['firstAid', 'sturdy', 'firstStrike'],
  },
  greatsword: {
    attack: 1.0,
    critRate: 0.05,
    bodyFit: { humanoid: 'normal', armored: 'good', flying: 'bad', spirit: 'bad' },
    affinity: ['firstStrike', 'pierce', 'firstAid'],
  },
  dagger: {
    attack: 0.95,
    critRate: 0.15,
    bodyFit: { humanoid: 'good', armored: 'bad', flying: 'normal', spirit: 'bad' },
    affinity: ['combo', 'pursuit', 'keen', 'gale', 'vital'],
  },
  bow: {
    attack: 1.0,
    critRate: 0.05,
    bodyFit: { humanoid: 'normal', armored: 'bad', flying: 'good', spirit: 'bad' },
    affinity: ['combo', 'pierce', 'bounty', 'gale'],
  },
  crossbow: {
    attack: 1.0,
    critRate: 0.05,
    bodyFit: { humanoid: 'bad', armored: 'good', flying: 'normal', spirit: 'bad' },
    affinity: ['firstStrike', 'pierce', 'keen', 'vital'],
  },
  staff: {
    attack: 0.85,
    critRate: 0.05,
    bodyFit: { humanoid: 'normal', armored: 'normal', flying: 'normal', spirit: 'good' },
    affinity: ['elementBoost', 'bounty', 'firstAid'],
  },
};

export const BODY_FIT_MULT: Record<BodyFit, number> = { good: 1.3, normal: 1.0, bad: 0.75 };

/** Base crit damage multiplier (치명 피해 ×1.5); 급소 raises it to ×2.5 (4.5). */
export const CRIT_DAMAGE = 1.5;

// ---------- Elements (기획서 7.5) ----------

/** BEATS[a] is the element that a beats. 수 > 화 > 지 > 풍 > 수. */
export const BEATS: Record<Element, Element> = { water: 'fire', fire: 'earth', earth: 'wind', wind: 'water' };

export const ELEMENT_MULT = { advantage: 1.5, neutral: 1.0, disadvantage: 0.75, same: 0.75, none: 1.0 } as const;

export function elementMultiplier(weapon: Element | null, tower: Element): number {
  if (weapon === null) return ELEMENT_MULT.none;
  if (weapon === tower) return ELEMENT_MULT.same;
  if (BEATS[weapon] === tower) return ELEMENT_MULT.advantage;
  if (BEATS[tower] === weapon) return ELEMENT_MULT.disadvantage;
  return ELEMENT_MULT.neutral;
}

// ---------- Quality tiers (기획서 4.3, 10) ----------

export interface QualitySpec {
  name: string;
  /** Minimum quality as a fraction of the recipe's quality cap. */
  threshold: number;
  attack: number;
  slots: number;
  /** Price multiplier — a different value from attack (10장). */
  price: number;
}

export const QUALITY: Record<QualityTier, QualitySpec> = {
  1: { name: '범작', threshold: 0, attack: 1.0, slots: 0, price: 1.0 },
  2: { name: '수작', threshold: 0.3, attack: 1.1, slots: 1, price: 1.25 },
  3: { name: '역작', threshold: 0.55, attack: 1.25, slots: 2, price: 1.5 },
  4: { name: '명작', threshold: 0.8, attack: 1.4, slots: 3, price: 1.75 },
  5: { name: '걸작', threshold: 1.0, attack: 1.6, slots: 4, price: 2.0 },
};

/** Highest tier whose threshold the quality ratio (0..1) reaches. */
export function qualityTierFor(ratio: number): QualityTier {
  let tier: QualityTier = 1;
  for (const t of [2, 3, 4, 5] as const) if (ratio >= QUALITY[t].threshold - 1e-9) tier = t;
  return tier;
}

/** Slots used by 속성 부여 + other enchants. A staff's element is outside the slots (4.8). */
export function usedEnchantSlots(w: Pick<Weapon, 'type' | 'element' | 'enchants'>): number {
  const elementSlot = w.element !== null && w.type !== 'staff' ? 1 : 0;
  return w.enchants.length + elementSlot;
}

// ---------- Main materials (기획서 4.4, 10) ----------

const MATERIAL_NAMES = ['철', '강철', '미스릴', '오리할콘', '아다만'] as const;

export function materialName(tier: number): string {
  if (tier <= MATERIAL_NAMES.length) return MATERIAL_NAMES[tier - 1] ?? '철';
  return `아다만 +${tier - MATERIAL_NAMES.length}`;
}

/** Attack multiplier per material tier: ×1.2 per band. */
export const MATERIAL_ATTACK_STEP = 1.2;
export function materialAttack(tier: number): number {
  return MATERIAL_ATTACK_STEP ** (tier - 1);
}

/** Merchant price of one unit of main material in band n: 10G × 2.5^(n−1). */
export function materialPrice(tier: number): number {
  return Math.round(10 * 2.5 ** (tier - 1));
}

/** Material cost of one weapon ≈ 6 units (10장). */
export const WEAPON_MATERIAL_UNITS = 6;

/** 정가 = 재료비 × 3 × 가격 배율. Enchants are not priced in (10장). */
export function listPrice(materialTier: number, quality: QualityTier): number {
  return Math.round(materialPrice(materialTier) * WEAPON_MATERIAL_UNITS * 3 * QUALITY[quality].price);
}

/** 일반 수리비 = 정가의 5%. */
export const REPAIR_COST_RATE = 0.05;

/** Band index of a floor: floors 1~10 are band 1. */
export function bandOf(floor: number): number {
  return Math.max(1, Math.ceil(floor / 10));
}

// ---------- Towers and enemies (기획서 7.1, 7.2, 7.3) ----------

export const TOWER_HOME_BODY: Record<TowerId, BodyType> = {
  fire: 'humanoid',
  earth: 'armored',
  wind: 'flying',
  water: 'spirit',
};

export const ENEMY_BASE_POWER = 100;
export const ENEMY_GROWTH_PER_FLOOR = 1.04;
export const BOSS_POWER_MULT = 1.3;
export const DEMON_LORD_POWER_MULT = 2.0;

export function enemyBasePower(floor: number): number {
  return ENEMY_BASE_POWER * ENEMY_GROWTH_PER_FLOOR ** (floor - 1);
}

// ---------- Hero grades (기획서 6.2, 7.4) ----------

export const GRADE_POWER_CAP: Record<Grade, number> = { N: 1.2, C: 1.6, B: 2.4, A: 4.0, S: 9.0 };
export const GRADE_START_SHARE: Record<Grade, number> = { N: 0.4, C: 0.3, B: 0.2, A: 0.08, S: 0.02 };
