// Fame stages and what they change (기획서 6.2, 9.2).

import { GRADES, type Grade } from '../core/types.ts';
import { GRADE_START_SHARE } from '../data/common.ts';
import {
  FAME_STAGES,
  GRADE_SHARE_LAST_SHIFT_STAGE,
  GRADE_SHARE_SHIFT_PER_STAGE,
  STAR_STAGE_FAME_MULT,
  STAR_STAGE_NEW_HEROES,
} from '../data/world.ts';

const LAST = FAME_STAGES[FAME_STAGES.length - 1] as (typeof FAME_STAGES)[number];

/** Fame needed for a stage. Stages past 7 are ★n: the previous threshold ×2. */
export function fameThreshold(stage: number): number {
  if (stage <= LAST.stage) return (FAME_STAGES[stage - 1] ?? FAME_STAGES[0])?.fame ?? 0;
  return LAST.fame * STAR_STAGE_FAME_MULT ** (stage - LAST.stage);
}

export function fameStageFor(fame: number): number {
  let stage = 1;
  while (fame >= fameThreshold(stage + 1)) stage++;
  return stage;
}

export function newHeroesPerDay(stage: number): number {
  if (stage <= LAST.stage) return (FAME_STAGES[stage - 1] ?? LAST).newHeroesPerDay;
  return LAST.newHeroesPerDay + STAR_STAGE_NEW_HEROES * (stage - LAST.stage);
}

/** Grade shares at a fame stage; ★n stages keep the stage-7 shares. */
export function gradeShares(stage: number): Record<Grade, number> {
  const steps = Math.max(0, Math.min(stage, GRADE_SHARE_LAST_SHIFT_STAGE) - 1);
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) out[g] = GRADE_START_SHARE[g] + GRADE_SHARE_SHIFT_PER_STAGE[g] * steps;
  return out;
}
