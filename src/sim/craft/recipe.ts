// Recipe = weapon type + main-material band + optional 대보스 material (기획서 4.2.3).

import type { UniqueId, WeaponType } from '../core/types.ts';
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

export function recipeFor(input: RecipeInput): Recipe {
  const tier = Math.max(1, Math.floor(input.materialTier));
  const grade = recipeGrade(tier, input.bossMaterial);
  const legendary = grade === 'legendary';
  const progress = RECIPE.progressBase * RECIPE.progressGrowth ** (tier - 1) * (legendary ? RECIPE.legendaryProgressMult : 1);
  const quality = RECIPE.qualityCapBase * RECIPE.qualityGrowth ** (tier - 1) * (legendary ? RECIPE.legendaryQualityMult : 1);
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
