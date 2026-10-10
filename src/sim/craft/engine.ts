// The crafting puzzle (기획서 4.2). Pure and deterministic: a CraftState is plain
// JSON, every step returns a new state, and conditions come from the craft stream.

import { qualityTierFor } from '../data/common.ts';
import {
  BUFF_BONUS,
  BUFF_IDS,
  type BuffId,
  CONDITION_EFFECT,
  type Condition,
  CRAFT_ACTIONS,
  type CraftActionId,
  FIRST_CONDITION,
  GOOD_CONDITIONS,
  INNER_QUIET,
} from '../data/craft.ts';
import type { QualityTier, UniqueId } from '../core/types.ts';
import { rollCondition } from './conditions.ts';
import { type Recipe, type RecipeInput, recipeFor } from './recipe.ts';
import { type SmithSetup, type SmithStats, smithStats } from './smith.ts';

export const CRAFT_STATE_VERSION = 1;

export interface CraftSetup {
  worldSeed: number;
  /** Goes up by one every time a craft starts (3.6). */
  craftNo: number;
  recipe: RecipeInput;
  smith: SmithSetup;
}

export type CraftStatus = 'active' | 'success' | 'failed';

export interface TurnLogEntry {
  /** 1-based turn the action was used on. Free actions share the turn. */
  turn: number;
  action: CraftActionId;
  condition: Condition;
  progress: number;
  quality: number;
  /** Net changes, including 단조 유지 after the action. */
  durability: number;
  cp: number;
  /** New condition after 불 다시 보기. */
  rerolledTo: Condition | null;
}

export interface CraftState {
  version: number;
  setup: CraftSetup;
  /** Snapshots, so data or skill-board changes apply from the next craft (9.3). */
  recipe: Recipe;
  stats: SmithStats;
  /** Turns used so far; 0 means the first turn has not been played. */
  turn: number;
  progress: number;
  quality: number;
  durability: number;
  maxDurability: number;
  cp: number;
  innerQuiet: number;
  condition: Condition;
  /** Draws taken from the craft stream. */
  rngCursor: number;
  /** Turns left per buff; 0 = off. */
  buffs: Record<BuffId, number>;
  /** 대장장이의 감 is waiting to be spent. */
  heartAndSoul: boolean;
  uses: Partial<Record<CraftActionId, number>>;
  status: CraftStatus;
  /** Stopped by the player; counts as a failure (4.2). */
  abandoned: boolean;
  log: TurnLogEntry[];
}

function noBuffs(): Record<BuffId, number> {
  const buffs = {} as Record<BuffId, number>;
  for (const id of BUFF_IDS) buffs[id] = 0;
  return buffs;
}

export function startCraft(setup: CraftSetup): CraftState {
  const recipe = recipeFor(setup.recipe);
  const stats = smithStats(setup.smith);
  const maxDurability = recipe.durability + stats.durabilityBonus;
  return {
    version: CRAFT_STATE_VERSION,
    setup: structuredClone(setup),
    recipe,
    stats,
    turn: 0,
    progress: 0,
    quality: 0,
    durability: maxDurability,
    maxDurability,
    cp: stats.maxCp,
    innerQuiet: 0,
    condition: FIRST_CONDITION,
    rngCursor: 0,
    buffs: noBuffs(),
    heartAndSoul: false,
    uses: {},
    status: 'active',
    abandoned: false,
    log: [],
  };
}

/** Floors with a small epsilon so 1.15 × 100 is 115, not 114. */
function floorGain(x: number): number {
  return Math.floor(x + 1e-6);
}

function isGood(c: Condition): boolean {
  return GOOD_CONDITIONS.includes(c);
}

/** CP and durability this action would cost right now (after buffs and condition). */
export function actionCost(state: CraftState, id: CraftActionId): { cp: number; durability: number } {
  const spec = CRAFT_ACTIONS[id];
  const ce = CONDITION_EFFECT[state.condition];
  const cp = Math.ceil(spec.cp * (spec.free ? 1 : ce.cpCost));
  const wasteNot = state.buffs.wasteNot > 0 ? BUFF_BONUS.wasteNot : 1;
  const durability = Math.ceil(spec.durability * wasteNot * ce.durabilityCost);
  return { cp, durability };
}

export function usesLeft(state: CraftState, id: CraftActionId): number | null {
  const limit = CRAFT_ACTIONS[id].perCraft;
  return limit === null ? null : limit - (state.uses[id] ?? 0);
}

/** Why the action cannot be used now (short Korean), or null if it can. */
export function checkAction(state: CraftState, id: CraftActionId): string | null {
  const spec = CRAFT_ACTIONS[id];
  if (state.status !== 'active') return '제작이 끝났다';
  if (!state.stats.actions.includes(id)) return '아직 모르는 기술';
  if (spec.requires === 'firstTurn' && state.turn > 0) return '첫 턴에만';
  if (spec.requires === 'goodCondition' && !isGood(state.condition) && !state.heartAndSoul) return '좋음·최상일 때만';
  if (spec.requires === 'innerQuiet' && state.innerQuiet < 1) return '열기가 없다';
  const left = usesLeft(state, id);
  if (left !== null && left <= 0) return '이번엔 다 썼다';
  if (id === 'heartAndSoul' && state.heartAndSoul) return '이미 감이 왔다';
  if (actionCost(state, id).cp > state.cp) return '제작력이 모자라다';
  return null;
}

export function canUse(state: CraftState, id: CraftActionId): boolean {
  return checkAction(state, id) === null;
}

/** Condition the next turn would get if a turn were used now (불꽃 읽기). */
export function previewNextCondition(state: CraftState): Condition {
  const { worldSeed, craftNo } = state.setup;
  return rollCondition(worldSeed, craftNo, state.rngCursor, state.recipe.grade, state.condition);
}

/**
 * Condition 불 다시 보기 would give now. It takes the same draw as the next turn (3.6),
 * so it equals previewNextCondition unless the current condition forces the next one.
 * The screen shows it only with 불꽃 읽기.
 */
export function previewReroll(state: CraftState): Condition {
  const { worldSeed, craftNo } = state.setup;
  return rollCondition(worldSeed, craftNo, state.rngCursor, state.recipe.grade, null);
}

/**
 * True when the action can be used but would end the craft as a failure: durability
 * reaches 0 before the progress is full. The screen asks before such a tap.
 */
export function wouldBreak(state: CraftState, id: CraftActionId): boolean {
  if (checkAction(state, id) !== null) return false;
  return applyAction(state, id).status === 'failed';
}

export function applyAction(state: CraftState, id: CraftActionId): CraftState {
  const reason = checkAction(state, id);
  if (reason !== null) throw new Error(`craft action ${id} not usable: ${reason}`);

  const spec = CRAFT_ACTIONS[id];
  const s = structuredClone(state);
  const cond = s.condition;
  const ce = CONDITION_EFFECT[cond];
  const cost = actionCost(s, id);
  const before = { durability: s.durability, cp: s.cp };
  const entry: TurnLogEntry = {
    turn: s.turn + 1,
    action: id,
    condition: cond,
    progress: 0,
    quality: 0,
    durability: 0,
    cp: 0,
    rerolledTo: null,
  };

  s.cp -= cost.cp;
  if (spec.perCraft !== null) s.uses[id] = (s.uses[id] ?? 0) + 1;

  // Free actions: no turn passes, nothing ticks.
  if (spec.free) {
    if (id === 'carefulObservation') {
      const { worldSeed, craftNo } = s.setup;
      s.condition = rollCondition(worldSeed, craftNo, s.rngCursor, s.recipe.grade, null);
      s.rngCursor += 1;
      entry.rerolledTo = s.condition;
    } else if (id === 'heartAndSoul') {
      s.heartAndSoul = true;
    }
    if (spec.buff) s.buffs[spec.buff.id] = spec.buff.turns;
    entry.cp = s.cp - before.cp;
    s.log.push(entry);
    return s;
  }

  // A good-only action outside 좋음/최상 spends 대장장이의 감.
  if (spec.requires === 'goodCondition' && !isGood(cond)) s.heartAndSoul = false;

  if (spec.progress > 0) {
    const bonus =
      1 + (s.buffs.veneration > 0 ? BUFF_BONUS.veneration : 0) + (s.buffs.muscleMemory > 0 ? BUFF_BONUS.muscleMemory : 0);
    s.buffs.muscleMemory = 0;
    let next = s.progress + floorGain(s.stats.craftsmanship * spec.progress * bonus * ce.progress);
    if (s.buffs.finalAppraisal > 0 && next >= s.recipe.progressRequired) {
      next = s.recipe.progressRequired - 1;
      s.buffs.finalAppraisal = 0;
    }
    next = Math.max(s.progress, next);
    entry.progress = next - s.progress;
    s.progress = next;
  }

  if (spec.quality > 0) {
    const finisher = id === 'byregotsBlessing';
    const efficiency = finisher ? spec.quality * (1 + s.innerQuiet * INNER_QUIET.finisherPerStack) : spec.quality;
    const bonus =
      1 + (s.buffs.innovation > 0 ? BUFF_BONUS.innovation : 0) + (s.buffs.greatStrides > 0 ? BUFF_BONUS.greatStrides : 0);
    s.buffs.greatStrides = 0;
    const gain = floorGain(
      s.stats.control * efficiency * (1 + s.innerQuiet * INNER_QUIET.qualityPerStack) * bonus * ce.quality,
    );
    const next = Math.min(s.recipe.qualityCap, s.quality + gain);
    entry.quality = next - s.quality;
    s.quality = next;
    s.innerQuiet = finisher ? 0 : Math.min(INNER_QUIET.max, s.innerQuiet + spec.innerQuiet);
  }

  s.durability = Math.max(0, s.durability - cost.durability);
  s.durability = Math.min(s.maxDurability, s.durability + spec.restoreDurability);
  s.cp = Math.min(s.stats.maxCp, s.cp + spec.restoreCp);

  if (s.progress >= s.recipe.progressRequired) {
    s.status = 'success';
  } else if (s.durability <= 0) {
    s.status = 'failed';
  } else if (s.buffs.manipulation > 0 && id !== 'manipulation') {
    s.durability = Math.min(s.maxDurability, s.durability + BUFF_BONUS.manipulation);
  }

  for (const b of BUFF_IDS) if (s.buffs[b] > 0) s.buffs[b] -= 1;
  if (spec.buff) s.buffs[spec.buff.id] = spec.buff.turns;

  const { worldSeed, craftNo } = s.setup;
  s.condition = rollCondition(worldSeed, craftNo, s.rngCursor, s.recipe.grade, cond);
  s.rngCursor += 1;
  s.turn += 1;

  entry.durability = s.durability - before.durability;
  entry.cp = s.cp - before.cp;
  s.log.push(entry);
  return s;
}

/** Stopping halfway is a failure (4.2). */
export function abandonCraft(state: CraftState): CraftState {
  if (state.status !== 'active') return state;
  return { ...structuredClone(state), status: 'failed', abandoned: true };
}

export type BossMaterialFate = 'used' | 'returned' | 'lost';

export interface CraftOutcome {
  success: boolean;
  abandoned: boolean;
  /** Quality as a share of the cap, 0..1. */
  qualityRatio: number;
  tier: QualityTier | null;
  boss: { unique: UniqueId; fate: BossMaterialFate } | null;
}

export function qualityRatio(state: CraftState): number {
  return Math.min(1, state.quality / state.recipe.qualityCap);
}

export function craftOutcome(state: CraftState): CraftOutcome {
  const success = state.status === 'success';
  const ratio = qualityRatio(state);
  const tier = success ? qualityTierFor(ratio) : null;
  const unique = state.recipe.bossMaterial;
  let boss: CraftOutcome['boss'] = null;
  if (unique !== null) {
    // 4.6: only a 걸작 takes the ability; short of that the material comes back.
    const fate: BossMaterialFate = !success ? 'lost' : tier === 5 ? 'used' : 'returned';
    boss = { unique, fate };
  }
  return { success, abandoned: state.abandoned, qualityRatio: ratio, tier, boss };
}
