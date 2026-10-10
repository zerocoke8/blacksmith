// Helpers shared by craft tests and future balance tools. Pure.

import type { WeaponType } from '../core/types.ts';
import type { Condition, CraftActionId, CraftNodeId, RecipeGrade } from '../data/craft.ts';
import { rollCondition } from './conditions.ts';
import { type CraftSetup, type CraftState, startCraft, applyAction } from './engine.ts';
import { NO_TOOLS, type ToolLevels } from './smith.ts';

export function makeSetup(
  opts: {
    worldSeed?: number;
    craftNo?: number;
    weaponType?: WeaponType;
    materialTier?: number;
    nodes?: CraftNodeId[];
    tools?: ToolLevels;
  } = {},
): CraftSetup {
  return {
    worldSeed: opts.worldSeed ?? 1,
    craftNo: opts.craftNo ?? 1,
    recipe: { weaponType: opts.weaponType ?? 'oneHandSword', materialTier: opts.materialTier ?? 1, bossMaterial: null },
    smith: { nodes: opts.nodes ?? [], tools: opts.tools ?? NO_TOOLS },
  };
}

/** First craft number whose first `turns` turns are all 보통 when no re-roll is used. */
export function findAllNormalCraft(worldSeed: number, turns: number, grade: RecipeGrade = 'basic'): number {
  for (let craftNo = 1; craftNo < 1_000_000; craftNo++) {
    let prev: Condition = 'normal';
    let ok = true;
    // Turn 1 is always 보통; draw i decides turn i + 2.
    for (let i = 0; i < turns - 1 && ok; i++) {
      prev = rollCondition(worldSeed, craftNo, i, grade, prev);
      ok = prev === 'normal';
    }
    if (ok) return craftNo;
  }
  throw new Error('no all-normal craft found');
}

export function runActions(state: CraftState, actions: readonly CraftActionId[]): CraftState {
  return actions.reduce((s, a) => applyAction(s, a), state);
}

export function runFromSetup(setup: CraftSetup, actions: readonly CraftActionId[]): CraftState {
  return runActions(startCraft(setup), actions);
}

/** The 11-turn example from 기획서 4.2.1. */
export const EXAMPLE_FLOW: readonly CraftActionId[] = [
  'basicSynthesis',
  'basicTouch',
  'basicTouch',
  'basicTouch',
  'mastersMend',
  'innovation',
  'basicTouch',
  'byregotsBlessing',
  'basicSynthesis',
  'basicSynthesis',
  'basicSynthesis',
];
