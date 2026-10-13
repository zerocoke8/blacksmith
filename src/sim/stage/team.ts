// A formation as fighters (기획서 6.3, 6.4): each hero's stats from the shared level, their stars and
// the weapon they hold, plus the formation's team passives, the row bonus, the skills. Pure.

import {
  ACTIVE_SKILLS,
  heroSpec,
  SIGNATURE_RED_MULT,
  SIGNATURES,
  skillKeyOf,
} from '../data/heroes.ts';
import { HERO_ATTACK_INTERVAL_TICKS } from '../data/battle.ts';
import { passiveOpen, signatureLevel, starStepOf } from '../hero/roster.ts';
import type { HeroesState } from '../hero/save.ts';
import { heroPower, heroStats, weaponCombat } from '../hero/stats.ts';
import { heroWeapon } from '../hero/weapon.ts';
import type { HeroUnit } from './battle.ts';
import { type Formation, formationProblems, formationSlots, rowBonusFor } from './formation.ts';

/** The formation's fighters, front row first. Throws on a formation that cannot fight (check formationProblems). */
export function buildTeam(heroes: HeroesState, formation: Formation): HeroUnit[] {
  const problems = formationProblems(formation, heroes.roster);
  if (problems.length > 0) throw new Error(`formation cannot fight: ${problems.map((p) => p.code).join(', ')}`);
  const slots = formationSlots(formation);
  const level = heroes.level.level;
  // Team passives of every member whose passive is open (5.4).
  let teamAtk = 0;
  let teamDef = 0;
  let teamHp = 0;
  const open = slots.map(({ key }) => {
    const spec = heroSpec(key);
    const step = starStepOf(spec.rarity, heroes.roster[key] ?? 1);
    return passiveOpen(spec.rarity, step.color) ? spec.passive : null;
  });
  for (const p of open) {
    if (p === null) continue;
    if (p.kind === 'teamAtk') teamAtk += p.value;
    else if (p.kind === 'teamDef') teamDef += p.value;
    else if (p.kind === 'teamHp') teamHp += p.value;
  }
  return slots.map(({ key, row, slot }, i) => {
    const spec = heroSpec(key);
    const copies = heroes.roster[key] ?? 1;
    const step = starStepOf(spec.rarity, copies);
    const weapon = heroWeapon(heroes.armory, key);
    const s = heroStats(key, copies, level, weapon);
    const passive = open[i] ?? null;
    const active = ACTIVE_SKILLS[skillKeyOf(spec)];
    const haste = passive !== null && passive.kind === 'haste' ? passive.value : 0;
    const sig = signatureLevel(spec.rarity, step.color);
    const atk = Math.max(1, Math.round(s.atk * (1 + teamAtk)));
    return {
      id: `h${slot}`,
      heroKey: key,
      name: spec.name,
      row,
      role: spec.role,
      element: spec.element,
      maxHp: Math.max(1, Math.round(s.maxHp * (1 + teamHp))),
      atk,
      pen: atk,
      def: Math.max(0, Math.round(s.def * (1 + teamDef))),
      crit: s.crit,
      critDamage: s.critDamage,
      intervalTicks: HERO_ATTACK_INTERVAL_TICKS[spec.weapon],
      weapon: weaponCombat(weapon, spec.weapon),
      rowBonus: rowBonusFor(spec.role, row),
      active,
      activeCooldown: Math.max(1, Math.round(active.cooldownTicks * (1 - haste))),
      passive,
      signature: sig === null ? null : { skill: SIGNATURES[skillKeyOf(spec)], mult: sig === 'strong' ? SIGNATURE_RED_MULT : 1 },
    };
  });
}

/** 편성 전투력 (6.4): the five's power summed. For the screen and grouping, never for a result. */
export function teamPower(team: readonly HeroUnit[]): number {
  return team.reduce((s, u) => s + heroPower(u), 0);
}

/**
 * Everything about a team that can change a battle, as one string. The auto-challenge waits on a
 * failed floor until this changes (6.7: 레벨·별·진화·편성·열·무기가 바뀌면 다시 도전).
 */
export function teamFingerprint(team: readonly HeroUnit[]): string {
  return JSON.stringify(
    team.map((u) => [u.heroKey, u.row, u.maxHp, u.atk, u.def, u.crit, u.critDamage, u.weapon, u.activeCooldown, u.passive?.kind ?? '', u.signature?.mult ?? 0]),
  );
}
