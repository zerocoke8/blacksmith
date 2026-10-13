// 완성 화면: the finished weapon, its 속성 칸 and its 인챈트 슬롯 (기획서 4.3, 4.5, 4.6, 4.8).
// 속성 칸 (4.3, 사용자 결정 '공격 속성은 무기의 것', B.16): every weapon, ★1 included, has one element
// slot outside the enchant slots; one 원소 결정 fills it and it never changes. '속성 부여' no longer
// goes into an enchant slot (it moved to the 속성 칸, 4.5). The FF14 prototype (craft/enchant.ts) and
// the v0.8 world keep their own old rule (data/common.ts usedEnchantSlots); this file does not use it.

import { ELEMENTS, type Element, type EnchantId, type Weapon } from '../core/types.ts';
import { ELEMENT_LABEL, QUALITY } from '../data/common.ts';
import { ENCHANT_MATERIAL_GRADE_LABEL } from '../data/cards.ts';
import { ENCHANTS, type EnchantFamily, FAMILY_LABEL } from '../data/enchants.ts';
import { type CardCraftState, cardCraftOutcome } from './engine.ts';

export type BodyMaterialFamily = Exclude<EnchantFamily, 'crystal'>;
export type MaterialGrade = 'low' | 'high';

/** Inventory key: `emblem:low`, `feather:high`, `crystal:fire` … */
export type EnchantMaterialKey = `${BodyMaterialFamily}:${MaterialGrade}` | `crystal:${Element}`;

export type MaterialInventory = Partial<Record<EnchantMaterialKey, number>>;

export const BODY_MATERIAL_FAMILIES: readonly BodyMaterialFamily[] = ['emblem', 'feather', 'shell', 'soulDust'];

export function allEnchantMaterialKeys(): EnchantMaterialKey[] {
  const keys: EnchantMaterialKey[] = [];
  for (const f of BODY_MATERIAL_FAMILIES) keys.push(`${f}:low`, `${f}:high`);
  for (const e of ELEMENTS) keys.push(`crystal:${e}`);
  return keys;
}

export function enchantMaterialLabel(key: EnchantMaterialKey): string {
  const [family, rest] = key.split(':') as [string, string];
  if (family === 'crystal') return `${FAMILY_LABEL.crystal} (${ELEMENT_LABEL[rest as Element]})`;
  return `${ENCHANT_MATERIAL_GRADE_LABEL[rest as MaterialGrade]} ${FAMILY_LABEL[family as BodyMaterialFamily]}`;
}

/**
 * One thing put into the weapon on the result screen.
 * - enchant: fills one slot. A crystal enchant (속성 증폭) names the crystal's element.
 * - elementSlot: the weapon's 속성 칸, outside the enchant slots (4.3): one 원소 결정.
 */
export type SlotPick =
  | { kind: 'enchant'; enchant: EnchantId; element: Element | null }
  | { kind: 'elementSlot'; element: Element };

export function weaponSlotCount(weapon: Pick<Weapon, 'quality'>): number {
  return QUALITY[weapon.quality].slots;
}

/** Enchant slots in use: the enchants (the element is in its own 속성 칸, 4.3). */
export function weaponUsedSlots(weapon: Pick<Weapon, 'enchants'>): number {
  return weapon.enchants.filter((e) => e !== 'element').length;
}

export function weaponFreeSlots(weapon: Weapon): number {
  return weaponSlotCount(weapon) - weaponUsedSlots(weapon);
}

/** The material a pick uses, or null if the pick is malformed. */
export function slotMaterial(pick: SlotPick): EnchantMaterialKey | null {
  if (pick.kind === 'elementSlot') return `crystal:${pick.element}`;
  const spec = ENCHANTS[pick.enchant];
  if (spec.family === 'crystal') return pick.element === null ? null : `crystal:${pick.element}`;
  return `${spec.family}:${spec.upper ? 'high' : 'low'}`;
}

/** Why the pick cannot go in (short Korean), or null if it can. */
export function slotBlock(weapon: Weapon, pick: SlotPick, inventory: MaterialInventory): string | null {
  const key = slotMaterial(pick);
  if (key === null) return '원소 결정을 골라야 한다';
  if (pick.kind === 'elementSlot') {
    if (weapon.element !== null) return '속성은 이미 정해졌다';
  } else {
    if (pick.enchant === 'element') return '속성은 속성 칸에 넣는다';
    if (weapon.enchants.includes(pick.enchant)) return '같은 인챈트는 하나만';
    if (weaponFreeSlots(weapon) <= 0) return '빈 슬롯이 없다';
  }
  if ((inventory[key] ?? 0) <= 0) return '재료가 없다';
  return null;
}

/** Puts the pick in and uses one material. Filled slots never change (4.3). */
export function fillSlot(
  weapon: Weapon,
  pick: SlotPick,
  inventory: MaterialInventory,
): { weapon: Weapon; inventory: MaterialInventory } {
  const reason = slotBlock(weapon, pick, inventory);
  if (reason !== null) throw new Error(`slot pick not allowed: ${reason}`);
  const key = slotMaterial(pick) as EnchantMaterialKey;
  const nextInventory: MaterialInventory = { ...inventory, [key]: (inventory[key] ?? 0) - 1 };
  const next: Weapon = { ...weapon, enchants: [...weapon.enchants] };
  if (pick.kind === 'elementSlot') next.element = pick.element;
  else next.enchants.push(pick.enchant);
  return { weapon: next, inventory: nextInventory };
}

/** The bare weapon a successful card craft makes, before slots are filled. */
export function weaponFromCardCraft(state: CardCraftState, id: string): Weapon {
  const outcome = cardCraftOutcome(state);
  if (!outcome.success || outcome.tier === null) throw new Error('weaponFromCardCraft: craft did not succeed');
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
