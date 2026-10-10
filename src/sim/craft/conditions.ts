// Craft conditions come from one stream per craft: rngFor(worldSeed, 'craft', craftNo) (3.6).
// Each turn and each 불 다시 보기 takes the next value, so a saved cursor replays exactly.

import { rngFor } from '../core/rng.ts';
import { CONDITIONS, CONDITION_WEIGHTS, type Condition, CRAFT_STREAM, FORCED_NEXT, type RecipeGrade } from '../data/craft.ts';

/** Stream positioned at `cursor` draws from the start. */
function streamAt(worldSeed: number, craftNo: number, cursor: number) {
  const rng = rngFor(worldSeed, CRAFT_STREAM, craftNo);
  for (let i = 0; i < cursor; i++) rng.nextUint32();
  return rng;
}

/**
 * The condition drawn at `cursor`. `previous` applies the grade's forced follow-ups
 * (최상 → 식음 from 고급, 불티 → 좋음); pass null for a fresh re-roll. A forced
 * condition still uses up its draw so later turns do not shift.
 */
export function rollCondition(
  worldSeed: number,
  craftNo: number,
  cursor: number,
  grade: RecipeGrade,
  previous: Condition | null,
): Condition {
  const weights = CONDITION_WEIGHTS[grade];
  const pool = CONDITIONS.filter((c) => (weights[c] ?? 0) > 0);
  const index = streamAt(worldSeed, craftNo, cursor).weightedIndex(pool.map((c) => weights[c] ?? 0));
  const rolled = pool[index] ?? 'normal';
  const forced = previous === null ? undefined : FORCED_NEXT[grade][previous];
  return forced ?? rolled;
}
