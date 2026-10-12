// 카드 제작 레시피 = 주재료 구간 + 대보스 재료 (기획서 4.2.3, 4.2.4).

import type { UniqueId, WeaponType } from '../core/types.ts';
import { materialName, POW_INT_MAX_EXPONENT, powInt } from '../data/common.ts';
import {
  ADAMANT_PLUS,
  BOSS_MATERIAL_CARD,
  CARD_RECIPE,
  type CardId,
  type CardRecipeGrade,
  MAIN_MATERIAL_CARD,
  MATERIAL_CARD_COPIES,
} from '../data/cards.ts';

/** 레시피 = 무기 종류 + 주재료 구간 + 대보스 재료 (4.1). */
export interface CardRecipeInput {
  /** Names the weapon; does not change the craft (4.8). */
  weaponType: WeaponType;
  /** Main-material band, 1 = 철. */
  materialTier: number;
  /** 대보스 material put in, or null. Makes the recipe 전설. */
  bossMaterial: UniqueId | null;
}

export interface CardRecipe extends CardRecipeInput {
  grade: CardRecipeGrade;
  progressRequired: number;
  qualityCap: number;
  /** 레시피 내구도, before 두꺼운 모루판. */
  durability: number;
  /** Cards this recipe shuffles in for this craft only (4.2.4). */
  materialCards: CardId[];
}

export function cardRecipeGrade(materialTier: number, bossMaterial: UniqueId | null): CardRecipeGrade {
  if (bossMaterial !== null) return 'legendary';
  return materialTier >= CARD_RECIPE.advancedFromBand ? 'advanced' : 'basic';
}

/** Whole band ≥ 1; anything that is not a finite number counts as band 1. */
export function normalizeTier(materialTier: number): number {
  return Number.isFinite(materialTier) ? Math.max(1, Math.floor(materialTier)) : 1;
}

/** The main-material card for a band. */
export function mainMaterialCard(materialTier: number): CardId {
  const tier = normalizeTier(materialTier);
  return MAIN_MATERIAL_CARD[Math.min(tier, MAIN_MATERIAL_CARD.length) - 1] as CardId;
}

/** 아다만 심 +(n−5): ratio added to its 공정·품질 (4.2.4). 0 below 6구간. */
export function adamantPlus(materialTier: number): number {
  const steps = normalizeTier(materialTier) - ADAMANT_PLUS.fromBand + 1;
  if (steps <= 0) return 0;
  return Math.min(ADAMANT_PLUS.max, steps * ADAMANT_PLUS.perBand);
}

export function cardRecipeFor(input: CardRecipeInput): CardRecipe {
  const tier = normalizeTier(input.materialTier);
  const grade = cardRecipeGrade(tier, input.bossMaterial);
  const mult =
    grade === 'basic' && tier === CARD_RECIPE.advancedFromBand - 1 ? CARD_RECIPE.bridgeMult : CARD_RECIPE.gradeMult[grade];
  // Repeated products, not `**` (3.6).
  const steps = Math.min(tier - 1, POW_INT_MAX_EXPONENT);
  const progress = CARD_RECIPE.progressBase * powInt(CARD_RECIPE.progressGrowth, steps) * mult.progress;
  const quality = CARD_RECIPE.qualityCapBase * powInt(CARD_RECIPE.qualityGrowth, steps) * mult.quality;
  const materialCards: CardId[] = [];
  for (let i = 0; i < MATERIAL_CARD_COPIES; i++) materialCards.push(mainMaterialCard(tier));
  if (input.bossMaterial !== null) {
    for (let i = 0; i < MATERIAL_CARD_COPIES; i++) materialCards.push(BOSS_MATERIAL_CARD[input.bossMaterial]);
  }
  return {
    weaponType: input.weaponType,
    materialTier: tier,
    bossMaterial: input.bossMaterial,
    grade,
    progressRequired: Math.round(progress),
    qualityCap: Math.round(quality),
    durability: CARD_RECIPE.durability[grade],
    materialCards,
  };
}

/** '철', '아다만 +2' … for recipe pickers. */
export function recipeMaterialName(input: CardRecipeInput): string {
  return materialName(normalizeTier(input.materialTier));
}
