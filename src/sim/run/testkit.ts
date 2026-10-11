// Helpers for run tests: setups, a 견본 선대, and a plain driver that plays a run to the end the
// way a hurried player would. Pure like the rest of src/sim; only tests import it.

import { checkPlay } from '../cards/index.ts';
import type { Weapon } from '../core/types.ts';
import { RUN_DEFAULT_DECK } from '../data/run.ts';
import { forgePlan } from './forge.ts';
import { actionBlock, forcedTurn, runAct } from './run.ts';
import { nextWall, shopBand } from './state.ts';
import type { Factor, LegendCard, RunAction, RunRules, RunSetupInput, RunState } from './types.ts';

/** 13.18: 아렌 2성, 동료 네아 3성 · 바일 1성 · 이솔 1성 (시즌 가문, 빌림). */
export function arenSetup(over: Partial<RunSetupInput> = {}, rules: Partial<RunRules> = {}): RunSetupInput {
  return {
    seed: 1,
    hero: { family: 'aren', star: 2 },
    companions: [
      { family: 'nea', star: 3 },
      { family: 'vail', star: 1 },
      { family: 'isol', star: 1 },
    ],
    deck: [...RUN_DEFAULT_DECK],
    rules,
    ...over,
  };
}

export function factor(kind: Factor['kind'], level: number, more: Partial<Factor> = {}): Factor {
  return { kind, level, body: null, card: null, evolved: null, ...more };
}

/** 13.18의 주 선대 '노련한 아렌': 그가 남긴 '아렌의 단검'. */
export function sampleAncestor(over: Partial<LegendCard> = {}): LegendCard {
  const weapon: Weapon = {
    id: 'f4',
    type: 'dagger',
    materialTier: 4,
    quality: 3,
    element: 'wind',
    enchants: ['combo', 'pursuit'],
    unique: null,
  };
  return {
    id: 'L-ancestor',
    family: 'aren',
    star: 2,
    grade: 'seasoned',
    season: 'ash',
    record: 38,
    score: 4210,
    wallsPassed: 3,
    end: 'wall',
    endFloor: 38,
    factors: [factor('strength', 2), factor('mastery', 2), factor('card', 2, { card: 'polish', evolved: 'quickPolish' })],
    weapon,
    weaponName: '아렌의 단검',
    deck: [...RUN_DEFAULT_DECK],
    runSeed: 99,
    ...over,
  };
}

/** Plays the first card that can go without breaking the iron, else ends the turn. */
export function forgeStep(s: RunState): RunAction {
  const craft = s.forge?.craft;
  if (craft === null || craft === undefined) throw new Error('no craft');
  for (const uid of craft.hand) {
    const c = checkPlay(craft, uid);
    if (c.ok && !c.breaks) return { type: 'forgePlay', uid };
  }
  return { type: 'forgeEndTurn' };
}

/**
 * A plain player: takes what is forced, chooses the first choice it can pay for, rests under
 * 50%, keeps the weapon above 40%, forges the newest material when it can, else climbs.
 */
export function plainAction(s: RunState): RunAction {
  if (s.phase === 'choice') {
    const head = s.pending[0];
    const i = head?.options.findIndex((o) => o.cost <= s.gold) ?? 0;
    return { type: 'choose', option: Math.max(0, i) };
  }
  if (s.phase === 'forge') return forgeStep(s);
  if (s.phase === 'forgeDone') return { type: 'forgeFinish' };
  const forced = forcedTurn(s);
  if (forced === 'wall') return { type: 'wall' };
  if (forced === 'climb') return { type: 'climb' };
  if (forced === 'rest' || s.hp < 0.5) return { type: 'rest' };
  if (s.weapon.durability < 0.4 && actionBlock(s, { type: 'maintain' }) === null) return { type: 'maintain' };
  const band = shopBand(s);
  if (band > s.weapon.weapon.materialTier && forgePlan(s, band).block === null && nextWall(s) !== null) {
    return { type: 'forge', materialTier: band };
  }
  return { type: 'expedition', policy: 'normal' };
}

/** Plays the run to its end with plainAction; returns every state on the way (first = start). */
export function playThrough(start: RunState, pick: (s: RunState) => RunAction = plainAction, maxSteps = 2000): RunState[] {
  const states = [start];
  let s = start;
  for (let i = 0; i < maxSteps && s.phase !== 'over'; i++) {
    s = runAct(s, pick(s));
    states.push(s);
  }
  return states;
}
