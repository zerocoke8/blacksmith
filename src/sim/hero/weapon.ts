// 무기 아이템과 장착 (기획서 4.3 속성 칸, 4.4, 4.11, 4.12). A finished card craft becomes a
// WeaponItem in the forge's weapon list; a hero holds one of their own weapon type; any weapon can
// be swapped at any time. Pure, plain JSON.
//
// 속성 칸: every weapon has one element slot outside the enchant slots (4.3, B.16). The card engine
// knows no element (4.1, 4.3 '카드 제작 엔진은 속성을 모른다'), so a weapon leaves the craft with an
// empty slot (무속성); the result screen fills it with one 원소 결정 (cards/enchant.ts 'elementSlot')
// as the weapon joins this list. fillElementSlot fills an item's empty slot later (the way to do
// that is [미정], 16장의 17번). A weapon whose element came from the old 속성 부여 enchant keeps it.

import { type Element, ELEMENTS, type EnchantId, type QualityTier, type UniqueId, type Weapon, type WeaponType } from '../core/types.ts';
import { ELEMENT_LABEL, materialAttack, materialName, powInt, QUALITY, WEAPON_LABEL, WEAPON_SPEC } from '../data/common.ts';
import { BARE_HANDS_ATTACK, ENHANCE, ENHANCE_COST, WEAPON_BASE_ATTACK } from '../data/battle.ts';
import { type HeroKey, heroSpec } from '../data/heroes.ts';
import { type CardCraftState, weaponFromCardCraft } from '../cards/index.ts';
import type { MaterialInventory } from '../cards/index.ts';

/** A weapon in the forge's list: the craft's weapon + 강화 단계 (4.12). */
export interface WeaponItem {
  id: string;
  type: WeaponType;
  /** 주재료 구간 (1 = 철, 4.4). */
  materialTier: number;
  quality: QualityTier;
  /** 속성 칸 (4.3): the attack element; null = 무속성. Never changes once filled. */
  element: Element | null;
  /** Filled enchant slots (never 'element': that is the element slot now). */
  enchants: EnchantId[];
  unique: UniqueId | null;
  /** 강화 +n (4.12), 0..ENHANCE.max. */
  enhance: number;
}

/** A card-engine Weapon as an item (+0). An old '속성 부여' in the enchants moves to the element slot. */
export function weaponItemOf(w: Weapon, enhance = 0): WeaponItem {
  return {
    id: w.id,
    type: w.type,
    materialTier: Math.max(1, Math.floor(w.materialTier)),
    quality: w.quality,
    element: w.element,
    enchants: w.enchants.filter((e) => e !== 'element'),
    unique: w.unique,
    enhance: clampEnhance(enhance),
  };
}

/** The weapon a successful card craft makes (cards/enchant.ts weaponFromCardCraft), as an item. */
export function weaponItemFromCraft(state: CardCraftState, id: string): WeaponItem {
  return weaponItemOf(weaponFromCardCraft(state, id));
}

function clampEnhance(n: number): number {
  return Math.max(0, Math.min(ENHANCE.max, Math.floor(Number.isFinite(n) ? n : 0)));
}

// ---------- 속성 칸 ----------

/** Why the element slot cannot take this crystal (short Korean), or null when it can. */
export function elementSlotBlock(item: WeaponItem, element: Element, inventory: MaterialInventory): string | null {
  if (!(ELEMENTS as readonly string[]).includes(element)) return '원소 결정을 골라야 한다';
  if (item.element !== null) return '속성은 이미 정해졌다';
  if ((inventory[`crystal:${element}`] ?? 0) <= 0) return '원소 결정이 없다';
  return null;
}

/** Puts one 원소 결정 into the element slot (4.3). A filled slot never changes. */
export function fillElementSlot(
  item: WeaponItem,
  element: Element,
  inventory: MaterialInventory,
): { item: WeaponItem; inventory: MaterialInventory } {
  const reason = elementSlotBlock(item, element, inventory);
  if (reason !== null) throw new Error(`element slot: ${reason}`);
  const key = `crystal:${element}` as const;
  return { item: { ...item, element }, inventory: { ...inventory, [key]: (inventory[key] ?? 0) - 1 } };
}

// ---------- Attack and 강화 ----------

/** 강화 배율 = 1 + 0.02 × 단계 (4.12 추천). */
export function enhanceMult(enhance: number): number {
  return 1 + ENHANCE.step * clampEnhance(enhance);
}

/** 무기 공격력 = 기본 × 종류 × 주재료 × 품질 × 강화 (4.4). */
export function weaponItemAttack(item: Pick<WeaponItem, 'type' | 'materialTier' | 'quality' | 'enhance'>): number {
  return (
    WEAPON_BASE_ATTACK *
    WEAPON_SPEC[item.type].attack *
    materialAttack(item.materialTier) *
    QUALITY[item.quality].attack *
    enhanceMult(item.enhance)
  );
}

/** What a hero with no weapon swings: a band-1 ★1 of their type × BARE_HANDS_ATTACK, no element. */
export function bareHandsAttack(type: WeaponType): number {
  return weaponItemAttack({ type, materialTier: 1, quality: 1, enhance: 0 }) * BARE_HANDS_ATTACK;
}

/** Gold for the next 강화 step, or null at the cap [미정] (16장의 29번). */
export function enhanceCost(item: Pick<WeaponItem, 'materialTier' | 'enhance'>): number | null {
  if (item.enhance >= ENHANCE.max) return null;
  return Math.round(
    ENHANCE_COST.base * powInt(ENHANCE_COST.perStep, clampEnhance(item.enhance)) * powInt(ENHANCE_COST.perBand, Math.max(1, item.materialTier) - 1),
  );
}

/** One 강화 step (4.12: no failure). Gold is the caller's to take. null at the cap. */
export function enhanceWeapon(item: WeaponItem): WeaponItem | null {
  if (item.enhance >= ENHANCE.max) return null;
  return { ...item, enhance: item.enhance + 1 };
}

/** '수 · 강철 한손검 +3' (4.3 '무기 이름 앞에 속성을 붙여 부른다' [튜닝]). */
export function weaponItemName(item: WeaponItem): string {
  const base = `${materialName(item.materialTier)} ${WEAPON_LABEL[item.type]}`;
  const named = item.element === null ? base : `${ELEMENT_LABEL[item.element]} · ${base}`;
  return item.enhance > 0 ? `${named} +${item.enhance}` : named;
}

// ---------- 무기 목록과 장착 (4.11) ----------

export interface Armory {
  /** The forge's weapon list, held ones included. */
  weapons: WeaponItem[];
  /** Hero key → the id of the weapon they hold. One weapon, one hero. */
  equipped: Partial<Record<HeroKey, string>>;
}

export function newArmory(): Armory {
  return { weapons: [], equipped: {} };
}

export function findWeapon(armory: Armory, id: string): WeaponItem | null {
  return armory.weapons.find((w) => w.id === id) ?? null;
}

/** Adds a new weapon to the list (an id already there is refused). */
export function addWeapon(armory: Armory, item: WeaponItem): Armory {
  if (findWeapon(armory, item.id) !== null) throw new Error(`weapon ${item.id} already in the list`);
  return { ...armory, weapons: [...armory.weapons, item] };
}

/** Replaces a weapon in the list (after 강화 or the element slot). */
export function updateWeapon(armory: Armory, item: WeaponItem): Armory {
  if (findWeapon(armory, item.id) === null) throw new Error(`weapon ${item.id} not in the list`);
  return { ...armory, weapons: armory.weapons.map((w) => (w.id === item.id ? item : w)) };
}

/** Who holds this weapon, or null. */
export function holderOf(armory: Armory, weaponId: string): HeroKey | null {
  for (const [key, id] of Object.entries(armory.equipped)) if (id === weaponId) return key as HeroKey;
  return null;
}

/** The weapon a hero holds, or null. */
export function heroWeapon(armory: Armory, hero: HeroKey): WeaponItem | null {
  const id = armory.equipped[hero];
  return id === undefined ? null : findWeapon(armory, id);
}

/** Why the hero cannot take this weapon (short Korean), or null. */
export function equipBlock(armory: Armory, hero: HeroKey, weaponId: string): string | null {
  const w = findWeapon(armory, weaponId);
  if (w === null) return '없는 무기다';
  if (w.type !== heroSpec(hero).weapon) return `${WEAPON_LABEL[heroSpec(hero).weapon]}만 쥔다`;
  return null;
}

/**
 * Gives the hero this weapon (4.11): the hero's old weapon goes back to the list, and if another
 * hero held this one, that hero's hands are now empty.
 */
export function equipWeapon(armory: Armory, hero: HeroKey, weaponId: string): Armory {
  const reason = equipBlock(armory, hero, weaponId);
  if (reason !== null) throw new Error(`equip: ${reason}`);
  const equipped: Partial<Record<HeroKey, string>> = {};
  for (const [key, id] of Object.entries(armory.equipped) as [HeroKey, string][]) {
    if (id !== weaponId && key !== hero) equipped[key] = id;
  }
  equipped[hero] = weaponId;
  return { ...armory, equipped };
}

/** Takes the hero's weapon back to the list. */
export function unequipWeapon(armory: Armory, hero: HeroKey): Armory {
  if (armory.equipped[hero] === undefined) return armory;
  const equipped = { ...armory.equipped };
  delete equipped[hero];
  return { ...armory, equipped };
}
