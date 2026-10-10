// Finished weapon and enchant slot filling (기획서 4.3, 4.5, 4.6, 4.8).

import { ELEMENTS, type Element, type EnchantId, type Weapon } from '../core/types.ts';
import { ELEMENT_LABEL, QUALITY, usedEnchantSlots } from '../data/common.ts';
import { type BodyFamily, MATERIAL_GRADE_LABEL } from '../data/craft.ts';
import { ENCHANTS, FAMILY_LABEL } from '../data/enchants.ts';
import { type CraftState, craftOutcome } from './engine.ts';

export type MaterialGrade = 'low' | 'high';

/** Inventory key: `emblem:low`, `feather:high`, `crystal:fire` … */
export type EnchantMaterialKey = `${BodyFamily}:${MaterialGrade}` | `crystal:${Element}`;

export type MaterialInventory = Partial<Record<EnchantMaterialKey, number>>;

export const BODY_FAMILIES: readonly BodyFamily[] = ['emblem', 'feather', 'shell', 'soulDust'];

export function allMaterialKeys(): EnchantMaterialKey[] {
  const keys: EnchantMaterialKey[] = [];
  for (const f of BODY_FAMILIES) keys.push(`${f}:low`, `${f}:high`);
  for (const e of ELEMENTS) keys.push(`crystal:${e}`);
  return keys;
}

export function materialLabel(key: EnchantMaterialKey): string {
  const [family, rest] = key.split(':') as [string, string];
  if (family === 'crystal') return `${FAMILY_LABEL.crystal} (${ELEMENT_LABEL[rest as Element]})`;
  return `${MATERIAL_GRADE_LABEL[rest as MaterialGrade]} ${FAMILY_LABEL[family as BodyFamily]}`;
}

/**
 * One thing put into the weapon on the result screen.
 * - enchant: fills one slot. Crystal enchants (속성 부여, 속성 증폭) name the crystal's element.
 * - staffElement: a staff's element slot, outside the enchant slots (4.8).
 */
export type SlotPick =
  | { kind: 'enchant'; enchant: EnchantId; element: Element | null }
  | { kind: 'staffElement'; element: Element };

export function slotCount(weapon: Pick<Weapon, 'quality'>): number {
  return QUALITY[weapon.quality].slots;
}

export function freeSlots(weapon: Weapon): number {
  return slotCount(weapon) - usedEnchantSlots(weapon);
}

/** The material a pick consumes, or null if the pick is malformed. */
export function materialFor(pick: SlotPick): EnchantMaterialKey | null {
  if (pick.kind === 'staffElement') return `crystal:${pick.element}`;
  const spec = ENCHANTS[pick.enchant];
  if (spec.family === 'crystal') return pick.element === null ? null : `crystal:${pick.element}`;
  return `${spec.family}:${spec.upper ? 'high' : 'low'}`;
}

/** Why the pick cannot go in (short Korean), or null if it can. */
export function checkPick(weapon: Weapon, pick: SlotPick, inventory: MaterialInventory): string | null {
  const key = materialFor(pick);
  if (key === null) return '원소 결정을 골라야 한다';
  if (pick.kind === 'staffElement') {
    if (weapon.type !== 'staff') return '지팡이만 속성 칸이 있다';
    if (weapon.element !== null) return '속성은 이미 정해졌다';
  } else {
    if (pick.enchant === 'element') {
      if (weapon.type === 'staff') return '지팡이는 속성 칸에 넣는다';
      if (weapon.element !== null) return '속성은 하나만';
    } else if (weapon.enchants.includes(pick.enchant)) {
      return '같은 인챈트는 하나만';
    }
    if (freeSlots(weapon) <= 0) return '빈 슬롯이 없다';
  }
  if ((inventory[key] ?? 0) <= 0) return '재료가 없다';
  return null;
}

/** Puts the pick in and spends one material. Filled slots never change (4.3). */
export function applyPick(
  weapon: Weapon,
  pick: SlotPick,
  inventory: MaterialInventory,
): { weapon: Weapon; inventory: MaterialInventory } {
  const reason = checkPick(weapon, pick, inventory);
  if (reason !== null) throw new Error(`slot pick not allowed: ${reason}`);
  const key = materialFor(pick) as EnchantMaterialKey;
  const nextInventory: MaterialInventory = { ...inventory, [key]: (inventory[key] ?? 0) - 1 };
  const next: Weapon = { ...weapon, enchants: [...weapon.enchants] };
  if (pick.kind === 'staffElement' || pick.enchant === 'element') {
    next.element = pick.element;
  } else {
    next.enchants.push(pick.enchant);
  }
  return { weapon: next, inventory: nextInventory };
}

/** The bare weapon a successful craft makes, before slots are filled. */
export function weaponFromCraft(state: CraftState, id: string): Weapon {
  const outcome = craftOutcome(state);
  if (!outcome.success || outcome.tier === null) throw new Error('weaponFromCraft: craft did not succeed');
  return {
    id,
    type: state.recipe.weaponType,
    materialTier: state.recipe.materialTier,
    quality: outcome.tier,
    element: null,
    enchants: [],
    unique: outcome.boss?.fate === 'used' ? outcome.boss.unique : null,
  };
}
