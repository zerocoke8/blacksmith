// Shape checks for saved craft data. A CraftState is plain JSON (3.6 saves the craft in
// progress); anything read back from storage goes through here before the engine sees it.

import {
  ELEMENTS,
  ENCHANT_IDS,
  type QualityTier,
  UNIQUE_IDS,
  type Weapon,
  WEAPON_TYPES,
} from '../core/types.ts';
import { BUFF_IDS, CONDITIONS, CRAFT_ACTION_IDS, CRAFT_NODE_IDS, type RecipeGrade } from '../data/craft.ts';
import { CRAFT_STATE_VERSION, type CraftState } from './engine.ts';
import type { RecipeInput } from './recipe.ts';
import type { SmithSetup, ToolLevels } from './smith.ts';

type Obj = Record<string, unknown>;

const GRADES: readonly RecipeGrade[] = ['basic', 'advanced', 'legendary'];
const STATUSES: readonly string[] = ['active', 'success', 'failed'];

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isCount(v: unknown): v is number {
  return isNum(v) && v >= 0;
}

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function listOf<T extends string>(list: readonly T[], v: unknown): v is T[] {
  return Array.isArray(v) && v.every((x) => oneOf(list, x));
}

export function isToolLevels(v: unknown): v is ToolLevels {
  return isObj(v) && isCount(v.anvil) && isCount(v.whetstone) && isCount(v.furnace);
}

export function isRecipeInput(v: unknown): v is RecipeInput {
  return (
    isObj(v) &&
    oneOf(WEAPON_TYPES, v.weaponType) &&
    isNum(v.materialTier) &&
    v.materialTier >= 1 &&
    (v.bossMaterial === null || oneOf(UNIQUE_IDS, v.bossMaterial))
  );
}

function isSmithSetup(v: unknown): v is SmithSetup {
  return isObj(v) && listOf(CRAFT_NODE_IDS, v.nodes) && isToolLevels(v.tools);
}

function isRecipeSnapshot(v: unknown): boolean {
  if (!isObj(v) || !oneOf(GRADES, v.grade) || !listOf(CONDITIONS, v.conditions)) return false;
  if (!isNum(v.progressRequired) || v.progressRequired <= 0) return false;
  if (!isNum(v.qualityCap) || v.qualityCap <= 0 || !isCount(v.durability)) return false;
  return isRecipeInput(v);
}

function isLogEntry(v: unknown): boolean {
  return (
    isObj(v) &&
    isNum(v.turn) &&
    oneOf(CRAFT_ACTION_IDS, v.action) &&
    oneOf(CONDITIONS, v.condition) &&
    isNum(v.progress) &&
    isNum(v.quality) &&
    isNum(v.durability) &&
    isNum(v.cp) &&
    (v.rerolledTo === null || oneOf(CONDITIONS, v.rerolledTo))
  );
}

/** The saved craft if it has the full CraftState shape of this version, else null. */
export function restoreCraftState(data: unknown): CraftState | null {
  if (!isObj(data) || data.version !== CRAFT_STATE_VERSION) return null;
  const { setup, recipe, stats, buffs, uses, log } = data;
  if (!isObj(setup) || !isNum(setup.worldSeed) || !isCount(setup.craftNo)) return null;
  if (!isRecipeInput(setup.recipe) || !isSmithSetup(setup.smith)) return null;
  if (!isRecipeSnapshot(recipe)) return null;
  if (!isObj(stats) || !isCount(stats.craftsmanship) || !isCount(stats.control) || !isCount(stats.maxCp)) return null;
  if (!isCount(stats.durabilityBonus) || typeof stats.foresight !== 'boolean') return null;
  if (!listOf(CRAFT_ACTION_IDS, stats.actions)) return null;
  const counts = [data.turn, data.progress, data.quality, data.durability, data.maxDurability, data.cp];
  if (!counts.every(isCount) || !isCount(data.innerQuiet) || !isCount(data.rngCursor)) return null;
  if (!oneOf(CONDITIONS, data.condition) || !oneOf(STATUSES, data.status)) return null;
  if (typeof data.heartAndSoul !== 'boolean' || typeof data.abandoned !== 'boolean') return null;
  if (!isObj(buffs) || !BUFF_IDS.every((b) => isCount(buffs[b]))) return null;
  if (!isObj(uses) || !Object.entries(uses).every(([k, n]) => oneOf(CRAFT_ACTION_IDS, k) && isCount(n))) return null;
  if (!Array.isArray(log) || !log.every(isLogEntry)) return null;
  return data as unknown as CraftState;
}

/** The saved weapon if it has the Weapon shape, else null. */
export function restoreWeapon(data: unknown): Weapon | null {
  if (!isObj(data) || typeof data.id !== 'string' || !oneOf(WEAPON_TYPES, data.type)) return null;
  if (!isNum(data.materialTier) || data.materialTier < 1) return null;
  if (![1, 2, 3, 4, 5].includes(data.quality as QualityTier)) return null;
  if (data.element !== null && !oneOf(ELEMENTS, data.element)) return null;
  if (!listOf(ENCHANT_IDS, data.enchants) || data.enchants.includes('element')) return null;
  if (data.unique !== null && !oneOf(UNIQUE_IDS, data.unique)) return null;
  return data as unknown as Weapon;
}
