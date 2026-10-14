import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCraftOutcome, playCard, startCardCraft } from '../cards/index.ts';
import { cloneCraft, inHand, layOut, makeCardSetup } from '../cards/testkit.ts';
import { ENHANCE, RESONANCE_MULT, WEAPON_BASE_ATTACK } from '../data/battle.ts';
import { ELEMENT_MULT } from '../data/common.ts';
import {
  ACTIVE_SKILLS,
  EVOLUTION_LADDER,
  expToNext,
  HERO_KEYS,
  HEROES,
  heroSpec,
  passiveText,
  SIGNATURES,
  skillText,
  STAR_POWER,
  STAR_STEP_COPIES,
  starAttackMult,
} from '../data/heroes.ts';
import {
  addCopies,
  addExp,
  addWeapon,
  type Armory,
  colorAt,
  copiesForStar,
  enhanceCost,
  enhanceWeapon,
  equipBlock,
  equipWeapon,
  fillElementSlot,
  heroStats,
  heroWeapon,
  holderOf,
  levelProgress,
  newArmory,
  newHeroesState,
  newLevelState,
  passiveOpen,
  restoreHeroes,
  serializeHeroes,
  signatureLevel,
  starStepOf,
  unequipWeapon,
  type WeaponItem,
  weaponItemAttack,
  weaponItemFromCraft,
  weaponItemName,
  weaponItemOf,
} from './index.ts';

function weapon(id: string, over: Partial<WeaponItem> = {}): WeaponItem {
  return { id, type: 'oneHandSword', materialTier: 1, quality: 1, element: null, enchants: [], unique: null, enhance: 0, ...over };
}

describe('roster data (5.8, roster.json)', () => {
  const roster = JSON.parse(readFileSync(new URL('../../../tools/art/roster/roster.json', import.meta.url), 'utf8')) as {
    heroes: { key: string; name: string; rarity: string; element: string; weapon: string; role: string; line: string }[];
  };
  const ROLE: Record<string, string> = { 근접: 'melee', 원거리: 'ranged', 힐러: 'healer' };

  it('has the 36 of roster.json, field for field', () => {
    expect(HEROES.length).toBe(roster.heroes.length);
    for (const r of roster.heroes) {
      const h = heroSpec(r.key as (typeof HERO_KEYS)[number]);
      expect({ name: h.name, rarity: h.rarity, element: h.element, weapon: h.weapon, role: h.role, line: h.line }).toEqual({
        name: r.name,
        rarity: r.rarity,
        element: r.element,
        weapon: r.weapon,
        role: ROLE[r.role],
        line: r.line,
      });
    }
  });

  it('is 24 specials (one per element × weapon) and 12 normals (two per weapon, three per element)', () => {
    const specials = HEROES.filter((h) => h.rarity === 'special');
    const normals = HEROES.filter((h) => h.rarity === 'normal');
    expect(specials.length).toBe(24);
    expect(new Set(specials.map((h) => `${h.element}/${h.weapon}`)).size).toBe(24);
    expect(normals.length).toBe(12);
    const byWeapon = new Map<string, number>();
    const byElement = new Map<string, number>();
    for (const h of normals) {
      byWeapon.set(h.weapon, (byWeapon.get(h.weapon) ?? 0) + 1);
      byElement.set(h.element, (byElement.get(h.element) ?? 0) + 1);
    }
    expect([...byWeapon.values()]).toEqual([2, 2, 2, 2, 2, 2]);
    expect([...byElement.values()]).toEqual([3, 3, 3, 3]);
    expect(HEROES.filter((h) => h.role === 'healer').map((h) => h.name)).toEqual(['유나', '모라', '견습 치유사 솜']);
    for (const h of HEROES) {
      if (h.role === 'healer') expect(h.weapon).toBe('staff');
      expect(passiveText(h.passive).length).toBeGreaterThan(0);
    }
  });

  it('has an active skill and a signature for every weapon and the healer', () => {
    for (const k of [...Object.keys(ACTIVE_SKILLS)]) {
      expect(SIGNATURES[k as keyof typeof SIGNATURES]).toBeDefined();
      expect(ACTIVE_SKILLS[k as keyof typeof ACTIVE_SKILLS].cooldownTicks).toBeGreaterThan(0);
    }
  });

  it('words attack speed for the hero screen: the passive and a skill\'s status', () => {
    expect(passiveText({ kind: 'atkSpeed', value: 0.15 })).toBe('공격 속도 +15%');
    expect(skillText(SIGNATURES.greatsword)).toBe('적 모두에게 공격의 250%, 맞은 적의 공격 속도 −30% (4초)');
    expect(skillText(SIGNATURES.healer)).toBe('편성 모두의 체력을 45% 채운다, 편성 모두의 공격 속도 +30% (5초)');
    expect(skillText(ACTIVE_SKILLS.oneHandSword)).toBe('맨 앞의 적에게 공격의 240%');
  });
});

describe('stars and evolution (5.5, 5.6)', () => {
  it('matches the doc table: copies counted with the first one', () => {
    // 특급 5 a step, 일반 13 (사용자 결정).
    expect(STAR_STEP_COPIES).toEqual({ special: 5, normal: 13 });
    expect(starStepOf('special', 1)).toMatchObject({ index: 0, mark: 'bronze', pips: 1, color: 'purple', have: 0, need: 5 });
    expect(starStepOf('special', 21)).toMatchObject({ mark: 'bronze', pips: 5 });
    expect(starStepOf('special', 26)).toMatchObject({ mark: 'silver', pips: 1 });
    expect(starStepOf('special', 71)).toMatchObject({ mark: 'gold', pips: 5, color: 'purple' });
    expect(starStepOf('special', 76)).toMatchObject({ mark: 'moon', pips: 1, color: 'gold' });
    expect(starStepOf('special', 101)).toMatchObject({ mark: 'sun', pips: 1, color: 'red' });
    expect(starStepOf('special', 121)).toMatchObject({ mark: 'sun', pips: 5, color: 'red', atMax: true });
    expect(starStepOf('normal', 53)).toMatchObject({ mark: 'bronze', pips: 5 });
    expect(starStepOf('normal', 131)).toMatchObject({ mark: 'gold', pips: 1 });
    expect(starStepOf('normal', 196)).toMatchObject({ mark: 'moon', pips: 1, color: 'gold' });
    expect(starStepOf('normal', 248)).toMatchObject({ mark: 'moon', pips: 5, color: 'gold', atMax: true });
    // Past the end: copies still count, nothing rises, no red for a normal.
    expect(starStepOf('normal', 400)).toMatchObject({ index: 19, color: 'gold', atMax: true, have: 13, need: 13 });
    expect(copiesForStar('special', 15)).toBe(76);
    expect(copiesForStar('normal', 19)).toBe(248);
    expect(starStepOf('special', 30)).toMatchObject({ have: 4, need: 5 });
  });

  it('climbs purple → gold (normal ends) and purple → gold → red (special; white later)', () => {
    expect(EVOLUTION_LADDER.normal).toEqual(['purple', 'gold']);
    expect(EVOLUTION_LADDER.special).toEqual(['purple', 'gold', 'red']);
    expect(colorAt('normal', 24)).toBe('gold');
    expect(colorAt('special', 24)).toBe('red');
  });

  it('opens the passive and the signature at the right colours (5.4)', () => {
    expect(passiveOpen('special', 'purple')).toBe(true);
    expect(passiveOpen('normal', 'purple')).toBe(false);
    expect(passiveOpen('normal', 'gold')).toBe(true);
    expect(signatureLevel('normal', 'gold')).toBeNull();
    expect(signatureLevel('special', 'purple')).toBeNull();
    expect(signatureLevel('special', 'gold')).toBe('open');
    expect(signatureLevel('special', 'red')).toBe('strong');
  });

  it('adds copies and reports steps and evolutions', () => {
    let r = addCopies({}, 'hero_vail', 1);
    expect(r).toMatchObject({ isNew: true, before: null, stepsUp: 0 });
    r = addCopies(r.roster, 'hero_vail', 74);
    expect(r.roster.hero_vail).toBe(75);
    expect(r.after).toMatchObject({ mark: 'gold', pips: 5 });
    expect(r.evolved).toEqual([]);
    r = addCopies(r.roster, 'hero_vail', 30);
    expect(r.after.color).toBe('red');
    expect(r.evolved).toEqual(['gold', 'red']);
    expect(r.stepsUp).toBe(6);
    const same = addCopies(r.roster, 'hero_vail', 0);
    expect(same.roster).toBe(r.roster);
  });

  it('grows power a little within a mark and more at a new mark or evolution (5.7)', () => {
    expect(STAR_POWER[0]).toBe(1);
    for (let i = 1; i < STAR_POWER.length; i++) expect(STAR_POWER[i] as number).toBeGreaterThan(STAR_POWER[i - 1] as number);
    const step = (i: number): number => (STAR_POWER[i] as number) / (STAR_POWER[i - 1] as number);
    expect(step(5)).toBeGreaterThan(step(4));
    expect(step(15)).toBeGreaterThan(step(10));
    expect(starAttackMult(15)).toBeLessThan(STAR_POWER[15] as number);
  });
});

describe('shared level (5.3)', () => {
  it('fills the bar and raises the level as often as it fills', () => {
    const s = newLevelState();
    const need = expToNext(1) + expToNext(2) + expToNext(3);
    const r = addExp(s, need + 5);
    expect(r.levelsUp).toBe(3);
    expect(r.state).toEqual({ level: 4, exp: 5 });
    expect(addExp(r.state, 0).levelsUp).toBe(0);
    expect(addExp(r.state, -10).state).toEqual(r.state);
    expect(addExp(r.state, Number.NaN).state).toEqual(r.state);
    expect(levelProgress(r.state)).toMatchObject({ level: 4, exp: 5, need: expToNext(4) });
  });

  it('is path independent: many small gains = one big one', () => {
    let s = newLevelState();
    let ups = 0;
    for (let i = 0; i < 300; i++) {
      const r = addExp(s, 7);
      s = r.state;
      ups += r.levelsUp;
    }
    const once = addExp(newLevelState(), 2100);
    expect(s).toEqual(once.state);
    expect(ups).toBe(once.levelsUp);
  });

  it('raises every hero the same: a hero drawn later fights at the shared level', () => {
    const lv1 = heroStats('hero_vail', 1, 1, null);
    const lv20 = heroStats('hero_vail', 1, 20, null);
    expect(lv20.maxHp).toBeGreaterThan(lv1.maxHp);
    expect(lv20.atk).toBeGreaterThan(lv1.atk);
    expect(lv20.def).toBeGreaterThan(lv1.def);
  });
});

describe('weapons (4.3, 4.4, 4.11, 4.12)', () => {
  it('turns a successful card craft into an item with an empty element slot', () => {
    let s = startCardCraft(makeCardSetup({ recipe: { weaponType: 'greatsword', materialTier: 1, bossMaterial: null } }));
    s = layOut(s, ['hammer', 'polish', 'polish', 'polish', 'bellows']);
    s = { ...cloneCraft(s), progress: 300, quality: 1000 };
    s = playCard(s, inHand(s, 'hammer'));
    expect(cardCraftOutcome(s).success).toBe(true);
    const item = weaponItemFromCraft(s, 'w1');
    expect(item).toMatchObject({ id: 'w1', type: 'greatsword', materialTier: 1, quality: 3, element: null, enchants: [], enhance: 0 });
    // The old 속성 부여 enchant becomes the element slot.
    expect(weaponItemOf({ ...item, element: 'fire', enchants: ['element', 'combo'] })).toMatchObject({ element: 'fire', enchants: ['combo'] });
  });

  it('fills the element slot once with a crystal, any weapon type, outside the enchant slots', () => {
    const w = weapon('a', { quality: 1 });
    const r = fillElementSlot(w, 'water', { 'crystal:water': 2 });
    expect(r.item.element).toBe('water');
    expect(r.item.enchants).toEqual([]);
    expect(r.inventory['crystal:water']).toBe(1);
    expect(() => fillElementSlot(r.item, 'fire', { 'crystal:fire': 1 })).toThrow();
    expect(() => fillElementSlot(w, 'fire', {})).toThrow();
    expect(weaponItemName(r.item)).toBe('수 · 철 한손검');
  });

  it('computes attack and enhancement (+2% a step, +8 at most, no failure)', () => {
    const w = weapon('a', { quality: 5, materialTier: 2 });
    expect(weaponItemAttack(w)).toBeCloseTo(WEAPON_BASE_ATTACK * 1.15 * 1.6, 9);
    let e: WeaponItem | null = w;
    for (let i = 0; i < ENHANCE.max; i++) e = e === null ? null : enhanceWeapon(e);
    expect(e?.enhance).toBe(8);
    expect(e === null ? 0 : weaponItemAttack(e)).toBeCloseTo(weaponItemAttack(w) * 1.16, 9);
    // 4.12 지킬 선: an old weapon at the cap with 공명 stays under a new one with 속성 유리 (×1.3).
    expect(RESONANCE_MULT * (1 + ENHANCE.step * ENHANCE.max)).toBeLessThan(ELEMENT_MULT.advantage);
    expect(e === null ? 'x' : enhanceWeapon(e)).toBeNull();
    expect(e === null ? 0 : enhanceCost(e)).toBeNull();
    expect(enhanceCost(w)).toBeGreaterThan(0);
    expect(weaponItemName({ ...w, enhance: 3 })).toBe('강철 한손검 +3');
  });

  it('equips one weapon per hero, of their type, and swaps', () => {
    let a: Armory = newArmory();
    a = addWeapon(a, weapon('s1'));
    a = addWeapon(a, weapon('s2'));
    a = addWeapon(a, weapon('b1', { type: 'bow' }));
    expect(() => addWeapon(a, weapon('s1'))).toThrow();
    expect(equipBlock(a, 'hero_vail', 'b1')).toBe('한손검만 쥔다');
    expect(equipBlock(a, 'hero_vail', 'nope')).toBe('없는 무기다');
    a = equipWeapon(a, 'hero_vail', 's1');
    expect(heroWeapon(a, 'hero_vail')?.id).toBe('s1');
    // Another sword hero takes s1: Vail's hands are empty.
    a = equipWeapon(a, 'hero_sien', 's1');
    expect(heroWeapon(a, 'hero_vail')).toBeNull();
    expect(holderOf(a, 's1')).toBe('hero_sien');
    // Sien switches to s2: s1 goes back to the list.
    a = equipWeapon(a, 'hero_sien', 's2');
    expect(holderOf(a, 's1')).toBeNull();
    expect(a.weapons.length).toBe(3);
    a = unequipWeapon(a, 'hero_sien');
    expect(heroWeapon(a, 'hero_sien')).toBeNull();
  });

  it('gives resonance only when the weapon element is the hero element (5.2, 6.5)', () => {
    expect(RESONANCE_MULT).toBeLessThan(1.3);
  });
});

describe('heroes save', () => {
  it('round-trips and drops what no longer fits', () => {
    const s = newHeroesState();
    s.roster = addCopies(addCopies({}, 'hero_vail', 30).roster, 'hero_rookie', 1).roster;
    s.level = addExp(s.level, 500).state;
    s.armory = equipWeapon(addWeapon(addWeapon(newArmory(), weapon('s1', { element: 'fire', enchants: ['combo'], enhance: 4 })), weapon('b1', { type: 'bow' })), 'hero_vail', 's1');
    const back = restoreHeroes(JSON.parse(serializeHeroes(s)));
    expect(back).toEqual(s);
    const broken = JSON.parse(serializeHeroes(s)) as { roster: Record<string, unknown>; armory: { equipped: Record<string, string>; weapons: unknown[] } };
    broken.roster.hero_nobody = 4;
    broken.roster.hero_rookie = 0;
    broken.armory.equipped.hero_nea = 's1'; // a bow hero holding a sword
    broken.armory.weapons.push({ id: 'bad', type: 'spoon' });
    const fixed = restoreHeroes(broken);
    expect(fixed?.roster).toEqual({ hero_vail: 30 });
    expect(fixed?.armory.equipped).toEqual({ hero_vail: 's1' });
    expect(fixed?.armory.weapons.map((w) => w.id)).toEqual(['s1', 'b1']);
    expect(restoreHeroes({ version: 99 })).toBeNull();
    expect(restoreHeroes(null)).toBeNull();
  });
});
