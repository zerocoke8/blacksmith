// The heroes part of the save (기획서 5장, 4.11): owned heroes, the shared level, the weapon list and
// who holds what. Plain JSON, saved as it is; what comes back from storage is checked field by
// field so a hand-edited or half-written save never reaches the rules. Unknown heroes, enchants or
// broken weapons are dropped, and a hold that no longer fits (wrong type, missing weapon) is let go.

import { ELEMENTS, ENCHANT_IDS, type EnchantId, type QualityTier, UNIQUE_IDS, WEAPON_TYPES, type WeaponType } from '../core/types.ts';
import { ENHANCE } from '../data/battle.ts';
import { type HeroKey, heroSpec, isHeroKey, LEVEL_MAX } from '../data/heroes.ts';
import { addExp, type LevelState, newLevelState } from './level.ts';
import type { HeroRoster } from './roster.ts';
import type { Armory, WeaponItem } from './weapon.ts';

export const HEROES_SAVE_VERSION = 1;

export interface HeroesState {
  roster: HeroRoster;
  level: LevelState;
  armory: Armory;
}

export function newHeroesState(): HeroesState {
  return { roster: {}, level: newLevelState(), armory: { weapons: [], equipped: {} } };
}

export function serializeHeroes(state: HeroesState): string {
  return JSON.stringify({ version: HEROES_SAVE_VERSION, ...state });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function whole(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

function restoreWeapon(v: unknown): WeaponItem | null {
  if (!isObj(v)) return null;
  const { id, type, materialTier, quality, element, enchants, unique, enhance } = v;
  if (typeof id !== 'string' || id === '') return null;
  if (!(WEAPON_TYPES as readonly unknown[]).includes(type)) return null;
  const tier = whole(materialTier);
  if (tier === null || tier < 1) return null;
  if (quality !== 1 && quality !== 2 && quality !== 3 && quality !== 4 && quality !== 5) return null;
  if (element !== null && !(ELEMENTS as readonly unknown[]).includes(element)) return null;
  if (!Array.isArray(enchants)) return null;
  const ench: EnchantId[] = [];
  for (const e of enchants) if ((ENCHANT_IDS as readonly unknown[]).includes(e) && e !== 'element' && !ench.includes(e as EnchantId)) ench.push(e as EnchantId);
  if (unique !== null && !(UNIQUE_IDS as readonly unknown[]).includes(unique)) return null;
  const plus = whole(enhance);
  return {
    id,
    type: type as WeaponType,
    materialTier: tier,
    quality: quality as QualityTier,
    element: element as WeaponItem['element'],
    enchants: ench,
    unique: unique as WeaponItem['unique'],
    enhance: Math.min(ENHANCE.max, plus ?? 0),
  };
}

/**
 * Turns an older save into the current version's shape (each step: version n → n + 1). There is only
 * version 1 so far; when HEROES_SAVE_VERSION goes up, its step goes here, or the old save cannot be
 * read (the game store keeps an unreadable one aside, never over it unseen).
 */
export function migrateHeroesSave(data: unknown): unknown {
  return data;
}

/** A saved heroes state (parsed JSON), or null when it is not a whole one. */
export function restoreHeroes(raw: unknown): HeroesState | null {
  const data = migrateHeroesSave(raw);
  if (!isObj(data) || data.version !== HEROES_SAVE_VERSION) return null;
  if (!isObj(data.roster) || !isObj(data.level) || !isObj(data.armory)) return null;
  const roster: HeroRoster = {};
  for (const [k, v] of Object.entries(data.roster)) {
    const n = whole(v);
    if (isHeroKey(k) && n !== null && n >= 1) roster[k] = n;
  }
  const lv = whole(data.level.level);
  const ex = whole(data.level.exp);
  if (lv === null || ex === null || lv < 1) return null;
  // Experience over the bar (a hand edit) settles into levels the normal way.
  const level = addExp({ level: Math.min(LEVEL_MAX, lv), exp: 0 }, ex).state;
  const weaponsRaw = data.armory.weapons;
  const equippedRaw = data.armory.equipped;
  if (!Array.isArray(weaponsRaw) || !isObj(equippedRaw)) return null;
  const weapons: WeaponItem[] = [];
  for (const raw of weaponsRaw) {
    const w = restoreWeapon(raw);
    if (w !== null && !weapons.some((x) => x.id === w.id)) weapons.push(w);
  }
  const equipped: Partial<Record<HeroKey, string>> = {};
  const held = new Set<string>();
  for (const [k, id] of Object.entries(equippedRaw)) {
    if (!isHeroKey(k) || typeof id !== 'string' || held.has(id)) continue;
    const w = weapons.find((x) => x.id === id);
    if (w === undefined || w.type !== heroSpec(k).weapon) continue;
    equipped[k] = id;
    held.add(id);
  }
  return { roster, level, armory: { weapons, equipped } };
}
