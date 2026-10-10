// Recipe = weapon type + main-material band + optional 대보스 material (기획서 4.2.3).

import type { UniqueId, WeaponType } from '../core/types.ts';
import { POW_INT_MAX_EXPONENT, powInt } from '../data/common.ts';
import {
  CONDITIONS,
  CONDITION_WEIGHTS,
  type Condition,
  FIRST_CONDITION,
  FORCED_NEXT,
  RECIPE,
  type RecipeGrade,
} from '../data/craft.ts';

export interface RecipeInput {
  weaponType: WeaponType;
  /** Main-material band, 1 = 철. */
  materialTier: number;
  /** 대보스 material put in before crafting, or null. */
  bossMaterial: UniqueId | null;
}

export interface Recipe extends RecipeInput {
  grade: RecipeGrade;
  progressRequired: number;
  qualityCap: number;
  /** Recipe durability before smith passives. */
  durability: number;
  /** Every condition that can show up, in roll order. */
  conditions: Condition[];
}

export function recipeGrade(materialTier: number, bossMaterial: UniqueId | null): RecipeGrade {
  if (bossMaterial !== null) return 'legendary';
  return materialTier >= RECIPE.advancedFromBand ? 'advanced' : 'basic';
}

/** Conditions a grade can produce: weighted rolls, forced follow-ups and the first turn. */
export function conditionsOf(grade: RecipeGrade): Condition[] {
  const weights = CONDITION_WEIGHTS[grade];
  const present = new Set<Condition>([FIRST_CONDITION]);
  for (const c of CONDITIONS) {
    if ((weights[c] ?? 0) > 0) {
      present.add(c);
      const forced = FORCED_NEXT[grade][c];
      if (forced) present.add(forced);
    }
  }
  return CONDITIONS.filter((c) => present.has(c));
}

/**
 * Size on top of the band growth (4.2.3): the grade's, except that the last 기본 band
 * (just below 고급) is already part way there.
 */
export function recipeSize(materialTier: number, grade: RecipeGrade): { progress: number; quality: number } {
  if (grade === 'basic' && materialTier === RECIPE.advancedFromBand - 1) return RECIPE.bridgeMult;
  return RECIPE.gradeMult[grade];
}

export function recipeFor(input: RecipeInput): Recipe {
  const tier = Number.isFinite(input.materialTier) ? Math.max(1, Math.floor(input.materialTier)) : 1;
  const grade = recipeGrade(tier, input.bossMaterial);
  const mult = recipeSize(tier, grade);
  // Repeated products, not `**` (3.6); a band past the power table is a broken save.
  const steps = Math.min(tier - 1, POW_INT_MAX_EXPONENT);
  const progress = RECIPE.progressBase * powInt(RECIPE.progressGrowth, steps) * mult.progress;
  const quality = RECIPE.qualityCapBase * powInt(RECIPE.qualityGrowth, steps) * mult.quality;
  return {
    weaponType: input.weaponType,
    materialTier: tier,
    bossMaterial: input.bossMaterial,
    grade,
    progressRequired: Math.round(progress),
    qualityCap: Math.round(quality),
    durability: RECIPE.durability[grade],
    conditions: conditionsOf(grade),
  };
}
