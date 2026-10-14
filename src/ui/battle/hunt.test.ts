import { describe, expect, it } from 'vitest';
import { newArmory } from '../../sim/hero/index.ts';
import { STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { buildTeam, challengeNextFloor, floorEnemies, newStageProgress, runBattle } from '../../sim/stage/index.ts';
import { prototypeHeroes, START_FORMATION } from '../game/start.ts';
import { huntFight } from './hunt.ts';

describe('the idle hunt never shows a loss (6.8, 사용자 결정 3)', () => {
  it('shows a fight the team wins as it is', () => {
    const heroes = prototypeHeroes();
    let p = newStageProgress();
    for (let i = 0; i < 5; i++) p = challengeNextFloor(p, { battleSeed: 1, heroes, formation: START_FORMATION }).progress;
    expect(p.best).toBe(5);
    const team = buildTeam(heroes, START_FORMATION);
    const h = huntFight(team, floorEnemies(p.best), 3);
    expect(h.sturdy).toBe(false);
    expect(h.team).toEqual(team);
    expect(h.setup).toEqual({ heroes: team, enemies: floorEnemies(p.best), limitTicks: STAGE_TIME_LIMIT_TICKS, seed: 3, key: ['hunt', 3], signatures: 'auto' });
    expect(runBattle(h.setup).outcome).toBe('win');
  });

  it('with a weaker team (every weapon put down, a floor far up) nobody falls, and what stands goes off', () => {
    const heroes = { ...prototypeHeroes(), armory: newArmory() };
    const team = buildTeam(heroes, START_FORMATION);
    for (const floor of [9, 30, 60]) {
      for (const mode of ['auto', 'manual'] as const) {
        const h = huntFight(team, floorEnemies(floor), 1, mode);
        expect(h.setup.signatures).toBe(mode);
        const r = runBattle(h.setup);
        const heroIds = new Set(h.team.map((u) => u.id));
        expect(r.events.some((e) => e.kind === 'down' && heroIds.has(e.unit))).toBe(false);
        expect(r.outcome === 'win' || h.sturdy).toBe(true);
        expect(r.outcome).not.toBe('wiped');
      }
    }
  });
});
