// A fight as the battle scene shows it: the sim's fighters (stage/team.ts, layout.ts, daily.ts) as
// the field's units — pictures, rows, what each shoots — and the timeline's units. Pure.

import type { ShotStyle, TimelineUnit } from '../../render/battle/timeline.ts';
import type { BattleShow, BattleUnitSpec } from '../../render/battle/scene.ts';
import type { Element, WeaponType } from '../../sim/core/types.ts';
import { monsterSpec } from '../../sim/data/monsters.ts';
import type { EnemyUnit, HeroUnit } from '../../sim/stage/index.ts';

/** How each weapon's blows travel on screen (4.8: 느리고 강한·연사 are the screen's to show). */
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
