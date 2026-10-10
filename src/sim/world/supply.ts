// Supply policies: the balance simulator's stand-in for the player at the counter.
// When a hero visits, the policy decides which weapon to hand over; the hero takes
// it only if its 목표 기대 전투력 beats the current weapon (5.1).

import { ELEMENTS, type Element, type EnchantId, type TowerId, type Weapon } from '../core/types.ts';
import { bandOf, BEATS, QUALITY, usedEnchantSlots, WEAPON_SPEC } from '../data/common.ts';
import { ENCHANTS } from '../data/enchants.ts';
import { MAX_FLOORS_PER_EXPEDITION, POLICY_QUALITY } from '../data/world.ts';
import { expectedPower, weaponProfile } from './combat.ts';
import { fighterOf, masteryFloorOf, startFloorOf } from './hero.ts';
import { floorInfo } from './tower.ts';
import type { DemonLordDown, FloorInfo, HeroState } from './types.ts';

export const POLICY_IDS = ['none', 'standard', 'matched'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

/**
 * Which main material a policy uses.
 * - 'band': the band the hero is about to climb (기록 + 1), capped by what the merchant sells.
 *   Matches 7.4 '그 층대의 역작 무기'.
 * - 'top': the merchant's best band, whatever the hero's floor.
 */
export const MATERIAL_RULES = ['band', 'top'] as const;
export type MaterialRule = (typeof MATERIAL_RULES)[number];

export type WeaponDraft = Omit<Weapon, 'id'>;

export interface SupplyContext {
  seed: number;
  now: number;
  merchantBand: number;
  demonLordsDown: readonly DemonLordDown[];
}

export interface SupplyPolicy {
  id: string;
  /** Weapon handed to a visiting hero, or null for nothing. */
  offer(hero: HeroState, ctx: SupplyContext): WeaponDraft | null;
}

/** 다음 목표 층들: one full expedition from the hero's start floor. */
export function targetFloors(hero: HeroState, ctx: SupplyContext): FloorInfo[] {
  const start = startFloorOf(hero.lastBossFloor);
  const out: FloorInfo[] = [];
  for (let f = start; f < start + MAX_FLOORS_PER_EXPEDITION; f++) {
    out.push(floorInfo(ctx.seed, hero.tower, f, ctx.now, ctx.demonLordsDown));
  }
  return out;
}

/** 목표 기대 전투력 of a weapon in this hero's hands. */
export function targetPower(w: WeaponDraft, hero: HeroState, floors: readonly FloorInfo[]): number {
  return expectedPower(weaponProfile(w, masteryFloorOf(hero)), fighterOf(hero), floors);
}

export function isUpgrade(offer: WeaponDraft, hero: HeroState, ctx: SupplyContext): boolean {
  const floors = targetFloors(hero, ctx);
  return targetPower(offer, hero, floors) > targetPower(hero.held.weapon, hero, floors) * (1 + 1e-9);
}

/** The element that beats this tower (수 > 화 > 지 > 풍 > 수). */
export function advantageElement(tower: TowerId): Element {
  return ELEMENTS.find((e) => BEATS[e] === tower) as Element;
}

export function policyMaterialTier(hero: HeroState, ctx: SupplyContext, rule: MaterialRule): number {
  if (rule === 'top') return ctx.merchantBand;
  return Math.max(1, Math.min(ctx.merchantBand, bandOf(hero.record + 1)));
}

/** Ties (no attack gain) go to the defensive picks first. */
const MATCHED_TIE_ORDER: readonly EnchantId[] = ['firstAid', 'sturdy', 'bounty'];

function tieRank(id: EnchantId): number {
  const i = MATCHED_TIE_ORDER.indexOf(id);
  return i < 0 ? MATCHED_TIE_ORDER.length : i;
}

/** ★3 + the tower's weak element + the weapon type's affinity enchants, best first. */
export function matchedWeapon(hero: HeroState, ctx: SupplyContext, tier: number): WeaponDraft {
  const draft: WeaponDraft = {
    type: hero.weaponType,
    materialTier: tier,
    quality: POLICY_QUALITY,
    element: advantageElement(hero.tower),
    enchants: [],
    unique: null,
  };
  const floors = targetFloors(hero, ctx);
  // Upper materials only come as gifts (4.5), so the policy sticks to basic enchants.
  let candidates = WEAPON_SPEC[hero.weaponType].affinity.filter((id) => id !== 'element' && !ENCHANTS[id].upper);
  while (usedEnchantSlots(draft) < QUALITY[draft.quality].slots && candidates.length > 0) {
    let best: EnchantId | null = null;
    let bestScore = -Infinity;
    for (const id of candidates) {
      const score = targetPower({ ...draft, enchants: [...draft.enchants, id] }, hero, floors);
      const better =
        score > bestScore * (1 + 1e-9) ||
        (Math.abs(score - bestScore) <= bestScore * 1e-9 && best !== null && tieRank(id) < tieRank(best));
      if (better) {
        best = id;
        bestScore = score;
      }
    }
    if (best === null) break;
    draft.enchants.push(best);
    const picked = best;
    candidates = candidates.filter((id) => id !== picked);
  }
  return draft;
}

export function createPolicy(id: PolicyId, material: MaterialRule = 'band'): SupplyPolicy {
  switch (id) {
    case 'none':
      return { id, offer: () => null };
    case 'standard':
      return {
        id,
        offer: (hero, ctx) => ({
          type: hero.weaponType,
          materialTier: policyMaterialTier(hero, ctx, material),
          quality: POLICY_QUALITY,
          element: null,
          enchants: [],
          unique: null,
        }),
      };
    case 'matched':
      return { id, offer: (hero, ctx) => matchedWeapon(hero, ctx, policyMaterialTier(hero, ctx, material)) };
  }
}
