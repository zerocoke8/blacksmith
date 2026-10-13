// 프로토타입 보유 상태 (뽑기가 아직 없다, 12.2): the heroes, the starter weapons and the formations a
// new save begins with, and the 실험 panel's changes ('모두 보유', '별 +1', '진화', '경험치 +n',
// '무기 상자'). Not game rules: the draw (서버가 판정, CLAUDE.md 규칙 5) and the forge's weapon list
// will replace them. Pure: everything is built from the sim's own functions.

import type { Element, QualityTier, WeaponType } from '../../sim/core/types.ts';
import { ELEMENTS, WEAPON_TYPES } from '../../sim/core/types.ts';
import { rngFor } from '../../sim/core/rng.ts';
import {
  EVOLUTION_AT_STAR,
  EVOLUTION_LADDER,
  type HeroKey,
  HEROES,
  heroSpec,
  STAR_MAX_INDEX,
} from '../../sim/data/heroes.ts';
import {
  addCopies,
  addExp,
  addWeapon,
  type Armory,
  copiesForStar,
  equipWeapon,
  type HeroesState,
  newHeroesState,
  starStepOf,
  type WeaponItem,
} from '../../sim/hero/index.ts';
import { type Formation, newStageProgress, type StageState } from '../../sim/stage/index.ts';

/** 일반 6명, 무기마다 한 명 (the task's prototype start). The staff one is the healer, so a fight shows heals. */
export const START_NORMALS: readonly HeroKey[] = ['hero_rookie', 'hero_bri', 'hero_shu', 'hero_tori', 'hero_hob', 'hero_som'];
/** 특급 몇 명. */
export const START_SPECIALS: readonly HeroKey[] = ['hero_vail', 'hero_nea', 'hero_karel'];

/** The first formation (both the stage's and the daily boss's). */
export const START_FORMATION: Formation = { front: ['hero_rookie', 'hero_bri', 'hero_shu'], back: ['hero_tori', 'hero_som'] };

/**
 * Starter weapons: one plain ★2 iron weapon of every type, and one more with an element, chosen so a
 * swap means something (공명: a hero whose element matches gets ×1.1). [the screen's start, not 기획서]
 */
const STARTER: readonly { type: WeaponType; element: Element | null; quality: QualityTier }[] = [
  { type: 'oneHandSword', element: null, quality: 2 },
  { type: 'oneHandSword', element: 'fire', quality: 2 },
  { type: 'greatsword', element: null, quality: 2 },
  { type: 'greatsword', element: 'water', quality: 3 },
  { type: 'dagger', element: null, quality: 2 },
  { type: 'dagger', element: 'wind', quality: 3 },
  { type: 'bow', element: null, quality: 2 },
  { type: 'bow', element: 'wind', quality: 2 },
  { type: 'crossbow', element: null, quality: 2 },
  { type: 'crossbow', element: 'earth', quality: 3 },
  { type: 'staff', element: null, quality: 2 },
  { type: 'staff', element: 'fire', quality: 2 },
];

/** Who holds what at the start (the rest wait in the list). */
const START_EQUIP: readonly [HeroKey, number][] = [
  ['hero_rookie', 0],
  ['hero_vail', 1],
  ['hero_bri', 2],
  ['hero_shu', 4],
  ['hero_tori', 6],
  ['hero_nea', 7],
  ['hero_hob', 8],
  ['hero_som', 10],
  ['hero_karel', 11],
];

export function starterWeapon(i: number): WeaponItem {
  const s = STARTER[i] as (typeof STARTER)[number];
  return { id: `start-${i + 1}`, type: s.type, materialTier: 1, quality: s.quality, element: s.element, enchants: [], unique: null, enhance: 0 };
}

export function prototypeHeroes(): HeroesState {
  let h = newHeroesState();
  let roster = h.roster;
  for (const key of [...START_NORMALS, ...START_SPECIALS]) roster = addCopies(roster, key, 1).roster;
  let armory: Armory = h.armory;
  STARTER.forEach((_, i) => (armory = addWeapon(armory, starterWeapon(i))));
  for (const [key, i] of START_EQUIP) armory = equipWeapon(armory, key, starterWeapon(i).id);
  h = { ...h, roster, armory };
  return h;
}

export function prototypeStage(): StageState {
  return { progress: newStageProgress(), formations: { stage: cloneFormation(START_FORMATION), daily: cloneFormation(START_FORMATION) } };
}

export function cloneFormation(f: Formation): Formation {
  return { front: [...f.front], back: [...f.back] };
}

// ---------- 실험 panel ----------

/** '모두 보유': every hero not owned comes with one copy. */
export function labOwnAll(h: HeroesState): HeroesState {
  let roster = h.roster;
  for (const s of HEROES) if ((roster[s.key] ?? 0) < 1) roster = addCopies(roster, s.key, 1).roster;
  return { ...h, roster };
}

/** '별 +1': the copies the next star step needs (none at the ladder's end). An unowned hero comes first. */
export function labStarUp(h: HeroesState, key: HeroKey): HeroesState {
  const have = h.roster[key] ?? 0;
  if (have < 1) return { ...h, roster: addCopies(h.roster, key, 1).roster };
  const spec = heroSpec(key);
  const step = starStepOf(spec.rarity, have);
  if (step.atMax) return h;
  return { ...h, roster: addCopies(h.roster, key, step.need - step.have).roster };
}

/** '진화': copies up to the next evolution colour of the rarity's ladder (none at its end). */
export function labEvolve(h: HeroesState, key: HeroKey): HeroesState {
  const spec = heroSpec(key);
  const have = Math.max(1, h.roster[key] ?? 0);
  const step = starStepOf(spec.rarity, have);
  const next = EVOLUTION_LADDER[spec.rarity].find((c) => EVOLUTION_AT_STAR[c] > step.index);
  if (next === undefined) return (h.roster[key] ?? 0) < 1 ? { ...h, roster: addCopies(h.roster, key, 1).roster } : h;
  const want = copiesForStar(spec.rarity, Math.min(STAR_MAX_INDEX[spec.rarity], EVOLUTION_AT_STAR[next]));
  return { ...h, roster: addCopies(h.roster, key, want - (h.roster[key] ?? 0)).roster };
}

/** '경험치 +n' (the same path refining takes, 5.3). */
export function labExp(h: HeroesState, n: number): { state: HeroesState; levelsUp: number; gained: number } {
  const r = addExp(h.level, n);
  return { state: { ...h, level: r.state }, levelsUp: r.levelsUp, gained: r.gained };
}

/**
 * '무기 상자': one weapon of every type at a band (★3, an element drawn from the box number), so the
 * swap list has something better to try. Display-only randomness from the sim's rng, keyed by the box.
 */
export function labWeaponBox(h: HeroesState, band: number, box: number): HeroesState {
  const rng = rngFor(0x5eed, 'lab', 'weaponBox', box);
  let armory = h.armory;
  for (const type of WEAPON_TYPES) {
    const id = `box${box}-${type}`;
    if (armory.weapons.some((w) => w.id === id)) continue;
    armory = addWeapon(armory, {
      id,
      type,
      materialTier: Math.max(1, Math.floor(band)),
      quality: rng.pick([3, 3, 4] as const),
      element: rng.pick(ELEMENTS),
      enchants: [],
      unique: null,
      enhance: 0,
    });
  }
  return { ...h, armory };
}
