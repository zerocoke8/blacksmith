// A fight as the battle scene shows it: the sim's fighters (stage/team.ts, layout.ts, daily.ts) as
// the field's units — pictures, rows, what each shoots — the timeline's units, and the heroes' cards
// under the field (HeroCardRow). Pure.

import type { ShotStyle, TimelineUnit } from '../../render/battle/timeline.ts';
import type { BattleShow, BattleUnitSpec } from '../../render/battle/scene.ts';
import type { Element, WeaponType } from '../../sim/core/types.ts';
import type { EvolutionColor, HeroKey } from '../../sim/data/heroes.ts';
import { monsterSpec } from '../../sim/data/monsters.ts';
import type { HeroRoster } from '../../sim/hero/index.ts';
import type { EnemyUnit, HeroUnit } from '../../sim/stage/index.ts';
import { heroCardView } from '../heroes/view.ts';

/** How each weapon's blows travel on screen (each weapon's rhythm is the engine's, 4.8). */
export const WEAPON_SHOT: Record<WeaponType, ShotStyle | null> = {
  oneHandSword: null,
  greatsword: null,
  dagger: null,
  bow: 'arrow',
  crossbow: 'bolt',
  staff: 'orb',
};

export function heroUnitSpec(h: HeroUnit): BattleUnitSpec {
  return {
    id: h.id,
    key: h.heroKey,
    side: 'hero',
    name: h.name,
    maxHp: h.maxHp,
    hp: h.maxHp,
    shot: WEAPON_SHOT[h.weapon.type],
    element: h.weapon.element ?? h.element,
    row: h.row,
  };
}

export function enemyUnitSpec(e: EnemyUnit): BattleUnitSpec {
  let size = 0.65;
  try {
    size = monsterSpec(e.key).scale;
  } catch {
    // an unknown key keeps the normal size
  }
  return { id: e.id, key: e.key, side: 'enemy', name: e.name, maxHp: e.maxHp, hp: e.maxHp, shot: null, element: e.element, size, boss: e.boss };
}

export function battleShow(heroes: readonly HeroUnit[], enemies: readonly EnemyUnit[], element: Element | null): BattleShow {
  return { heroes: heroes.map(heroUnitSpec), enemies: enemies.map(enemyUnitSpec), element };
}

export function timelineUnits(show: BattleShow): TimelineUnit[] {
  return [...show.heroes, ...show.enemies].map((u) => ({ id: u.id, side: u.side, shot: u.shot }));
}

/** A hero's card under the field (사용자 결정 2026-10-14: 카드를 눌러 필살기). */
export interface CardHero {
  /** The fighter's id ('h0'.., formation order). */
  id: string;
  key: HeroKey;
  name: string;
  /** The name on the card: a normal hero's own name without the job before it ('신참 검사 비코' → '비코'). */
  short: string;
  maxHp: number;
  /** The card's colour: the evolution colour, as on the hero cards (5.6, 5.9). */
  color: EvolutionColor;
  special: boolean;
  /** Has a signature (a special at gold or above): the gauge fills and the card can be tapped. */
  signature: boolean;
}

/** The fight's heroes as cards, in formation order (the order they fight in). */
export function cardHeroes(team: readonly HeroUnit[], roster: HeroRoster): CardHero[] {
  return team.map((h) => {
    const v = heroCardView(roster, h.heroKey);
    const short = h.name.trim().split(/\s+/).at(-1) ?? h.name;
    return { id: h.id, key: h.heroKey, name: h.name, short, maxHp: h.maxHp, color: v.color, special: v.special, signature: h.signature !== null };
  });
}
