import { describe, expect, it } from 'vitest';
import type { Element, EnchantId, QualityTier, Weapon, WeaponType } from '../core/types.ts';
import { usedEnchantSlots } from '../data/common.ts';
import { abandonCraft, startCraft, applyAction } from './engine.ts';
import {
  allMaterialKeys,
  applyPick,
  checkPick,
  freeSlots,
  type MaterialInventory,
  materialFor,
  materialLabel,
  type SlotPick,
  weaponFromCraft,
} from './enchant.ts';
import { makeSetup } from './testkit.ts';

const plenty = (): MaterialInventory => Object.fromEntries(allMaterialKeys().map((k) => [k, 5]));

function weapon(type: WeaponType, quality: QualityTier): Weapon {
  return { id: 'w', type, materialTier: 1, quality, element: null, enchants: [], unique: null };
}

const enchant = (id: EnchantId, element: Element | null = null): SlotPick => ({ kind: 'enchant', enchant: id, element });

describe('slot filling (4.3, 4.5, 4.8)', () => {
  it('has as many slots as the tier gives', () => {
    expect([1, 2, 3, 4, 5].map((q) => freeSlots(weapon('bow', q as QualityTier)))).toEqual([0, 1, 2, 3, 4]);
  });

  it('one material = one enchant, and it is spent', () => {
    const inv = plenty();
    const { weapon: w, inventory } = applyPick(weapon('bow', 3), enchant('combo'), inv);
    expect(w.enchants).toEqual(['combo']);
    expect(inventory['emblem:low']).toBe(4);
    expect(inv['emblem:low']).toBe(5);
    expect(freeSlots(w)).toBe(1);
  });

  it('refuses the same enchant twice', () => {
    const { weapon: w, inventory } = applyPick(weapon('bow', 3), enchant('combo'), plenty());
    expect(checkPick(w, enchant('combo'), inventory)).toBe('같은 인챈트는 하나만');
  });

  it('refuses when slots are full', () => {
    let w = weapon('dagger', 2);
    let inv = plenty();
    ({ weapon: w, inventory: inv } = applyPick(w, enchant('keen'), inv));
    expect(checkPick(w, enchant('pursuit'), inv)).toBe('빈 슬롯이 없다');
    expect(checkPick(weapon('dagger', 1), enchant('keen'), inv)).toBe('빈 슬롯이 없다');
  });

  it('upper enchants need 상급 material, basic ones 하급', () => {
    expect(materialFor(enchant('gale'))).toBe('emblem:high');
    expect(materialFor(enchant('vital'))).toBe('feather:high');
    expect(materialFor(enchant('indomitable'))).toBe('soulDust:high');
    expect(materialFor(enchant('pierce'))).toBe('shell:low');
    const noHigh: MaterialInventory = { ...plenty(), 'emblem:high': 0 };
    expect(checkPick(weapon('dagger', 4), enchant('gale'), noHigh)).toBe('재료가 없다');
    expect(checkPick(weapon('dagger', 4), enchant('combo'), noHigh)).toBeNull();
  });

  it('속성 부여 takes a slot on non-staff weapons and only one element', () => {
    let w = weapon('greatsword', 3);
    let inv = plenty();
    ({ weapon: w, inventory: inv } = applyPick(w, enchant('element', 'fire'), inv));
    expect(w.element).toBe('fire');
    expect(w.enchants).toEqual([]);
    expect(usedEnchantSlots(w)).toBe(1);
    expect(inv['crystal:fire']).toBe(4);
    expect(checkPick(w, enchant('element', 'water'), inv)).toBe('속성은 하나만');
  });

  it('crystal enchants need an element to pick the crystal', () => {
    expect(checkPick(weapon('bow', 3), enchant('element', null), plenty())).toBe('원소 결정을 골라야 한다');
    expect(materialFor(enchant('elementBoost', 'wind'))).toBe('crystal:wind');
  });

  it('a staff has an element slot outside the enchant slots', () => {
    let w = weapon('staff', 2);
    let inv = plenty();
    expect(checkPick(w, enchant('element', 'earth'), inv)).toBe('지팡이는 속성 칸에 넣는다');
    ({ weapon: w, inventory: inv } = applyPick(w, { kind: 'staffElement', element: 'earth' }, inv));
    expect(w.element).toBe('earth');
    expect(freeSlots(w)).toBe(1);
    expect(checkPick(w, { kind: 'staffElement', element: 'fire' }, inv)).toBe('속성은 이미 정해졌다');
    ({ weapon: w, inventory: inv } = applyPick(w, enchant('elementBoost', 'earth'), inv));
    expect(w.enchants).toEqual(['elementBoost']);
    expect(freeSlots(w)).toBe(0);
    // ★1 staff: no enchant slots, but the element slot is still there.
    expect(checkPick(weapon('staff', 1), { kind: 'staffElement', element: 'water' }, inv)).toBeNull();
  });

  it('only staves have the element slot', () => {
    expect(checkPick(weapon('bow', 5), { kind: 'staffElement', element: 'fire' }, plenty())).toBe('지팡이만 속성 칸이 있다');
  });

  it('labels materials in Korean', () => {
    expect(materialLabel('emblem:high')).toBe('상급 마족 문장');
    expect(materialLabel('crystal:water')).toBe('원소 결정 (수)');
  });
});

describe('weaponFromCraft', () => {
  it('builds a bare weapon with the craft tier and the unique only for a 걸작 with boss material', () => {
    const setup = { ...makeSetup({ craftNo: 3 }), recipe: { weaponType: 'staff' as const, materialTier: 6, bossMaterial: 'iceArmor' as const } };
    const s = startCraft(setup);
    const ready = { ...s, progress: s.recipe.progressRequired - 1 };
    const best = applyAction({ ...ready, quality: s.recipe.qualityCap }, 'basicSynthesis');
    expect(weaponFromCraft(best, 'w1')).toEqual({
      id: 'w1',
      type: 'staff',
      materialTier: 6,
      quality: 5,
      element: null,
      enchants: [],
      unique: 'iceArmor',
    });
    const good = applyAction({ ...ready, quality: Math.ceil(s.recipe.qualityCap * 0.8) }, 'basicSynthesis');
    expect(weaponFromCraft(good, 'w2').unique).toBeNull();
    expect(weaponFromCraft(good, 'w2').quality).toBe(4);
    expect(() => weaponFromCraft(abandonCraft(s), 'w3')).toThrow();
  });
});
