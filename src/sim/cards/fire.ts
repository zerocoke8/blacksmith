// 화로 상태 rolls (기획서 4.2.3, 4.2.8). Each turn has its own random key, so which cards
// were played never moves the fire sequence: (seed, stream, craftNo, 'fire', turn) and
// (…, 'fire', turn, reroll) for 불 다시 보기.

import { rngFor } from '../core/rng.ts';
import {
  type CardRecipeGrade,
  FIRE_KEY,
  FIRE_PRESET_SCALE,
  FIRE_STATES,
  FIRE_WEIGHTS,
  type FirePreset,
  type FireState,
  FIRST_FIRE,
  FORCED_NEXT_FIRE,
} from '../data/cards.ts';

export interface FireStream {
  seed: number;
  stream: string;
  craftNo: number;
}

/** Roll weights for a grade under a preset: non-normal weights scaled, 보통 takes the rest. */
export function fireWeights(grade: CardRecipeGrade, preset: FirePreset): number[] {
  const base = FIRE_WEIGHTS[grade];
  const scale = FIRE_PRESET_SCALE[preset];
  const weights = FIRE_STATES.map((f) => (f === 'normal' ? 0 : (base[f] ?? 0) * scale));
  const others = weights.reduce((a, b) => a + b, 0);
  weights[0] = Math.max(0, 100 - others);
  return weights;
}

/** Fire states a grade can show (rolled, forced, or the first turn), in display order. */
export function fireStatesOf(grade: CardRecipeGrade): FireState[] {
  const present = new Set<FireState>([FIRST_FIRE]);
  for (const f of FIRE_STATES) {
    if ((FIRE_WEIGHTS[grade][f] ?? 0) > 0) {
      present.add(f);
      const forced = FORCED_NEXT_FIRE[grade][f];
      if (forced) present.add(forced);
    }
  }
  return FIRE_STATES.filter((f) => present.has(f));
}

/** The state forced by the previous turn's last state, or null. */
export function forcedFire(grade: CardRecipeGrade, previous: FireState): FireState | null {
  return FORCED_NEXT_FIRE[grade][previous] ?? null;
}

/**
 * The fire state rolled at the start of `turn` (1-based). Turn 1 is always 보통; a forced
 * turn takes the forced state (its key is the turn number, so later turns never shift).
 */
export function rollTurnFire(
  key: FireStream,
  grade: CardRecipeGrade,
  preset: FirePreset,
  turn: number,
  previous: FireState,
): FireState {
  if (turn <= 1) return FIRST_FIRE;
  const forced = forcedFire(grade, previous);
  if (forced !== null) return forced;
  const rng = rngFor(key.seed, key.stream, key.craftNo, FIRE_KEY, turn);
  return FIRE_STATES[rng.weightedIndex(fireWeights(grade, preset))] as FireState;
}

/** The r-th (1-based) 불 다시 보기 of `turn`. Rerolls use the grade's weights, never forced. */
export function rollRerollFire(
  key: FireStream,
  grade: CardRecipeGrade,
  preset: FirePreset,
  turn: number,
  reroll: number,
): FireState {
  const rng = rngFor(key.seed, key.stream, key.craftNo, FIRE_KEY, turn, reroll);
  return FIRE_STATES[rng.weightedIndex(fireWeights(grade, preset))] as FireState;
}
