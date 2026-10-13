import { describe, expect, it } from 'vitest';
import { BATTLE_TICK_MS, STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { buildTeam, floorEnemies, runBattle } from '../../sim/stage/index.ts';
import type { BattleEvent } from '../../sim/stage/battle.ts';
import { prototypeHeroes, START_FORMATION } from '../../ui/game/start.ts';
import { ANIM_ACTIONS, ANIM_SPEC, ATTACK_IMPACT_AT, actionMs, motionPose, REST_POSE } from './motion.ts';
import { buildTimeline, type Cue, damageUpTo, finalHp, tickTime, TIMELINE, type TimelineUnit } from './timeline.ts';

const units: TimelineUnit[] = [
  { id: 'h0', side: 'hero', shot: null },
  { id: 'h1', side: 'hero', shot: 'arrow' },
  { id: 'e0', side: 'enemy', shot: null },
];

const hit = (t: number, src: string, dst: string, amount: number, hpAfter: number, extra: Partial<Extract<BattleEvent, { kind: 'hit' }>> = {}): BattleEvent => ({
  t,
  kind: 'hit',
  src,
  dst,
  via: 'attack',
  amount,
  crit: false,
  elementMult: 1,
  bodyMult: 1,
  hpAfter,
  ...extra,
});

describe('the playback schedule (사건 재생 시간표)', () => {
  it('lands every hit on its own tick, scaled by the speed', () => {
    const events: BattleEvent[] = [hit(3, 'h0', 'e0', 10, 90), hit(13, 'h1', 'e0', 20, 70), { t: 13, kind: 'end', outcome: 'timeout' }];
    for (const speed of [1, 2, 4]) {
      const tl = buildTimeline(events, units, { tickMs: 100, speed });
      const impacts = tl.cues.filter((c): c is Extract<Cue, { kind: 'impact' }> => c.kind === 'impact');
      expect(impacts.map((c) => c.at)).toEqual([tickTime(3, 100, speed), tickTime(13, 100, speed)]);
      expect(tickTime(3, 100, speed)).toBeCloseTo((TIMELINE.introMs + 300) / speed);
    }
  });

  it('starts a melee lunge so its far point meets the hit, and a shot early enough to arrive on it', () => {
    const tl = buildTimeline([hit(5, 'h0', 'e0', 1, 99), hit(5, 'h1', 'e0', 1, 98), { t: 5, kind: 'end', outcome: 'timeout' }], units, { tickMs: 100, speed: 1 });
    const T = tickTime(5, 100, 1);
    const lunge = tl.cues.find((c) => c.kind === 'act' && c.unit === 'h0');
    expect(lunge?.at).toBeCloseTo(T - actionMs('attack') * ATTACK_IMPACT_AT);
    const shot = tl.cues.find((c) => c.kind === 'shot');
    const arrow = tl.cues.find((c) => c.kind === 'impact' && c.src === 'h1');
    expect(shot).toBeDefined();
    // Two blows on one unit in one tick keep the engine's order (the second a moment later).
    expect(arrow!.at).toBeGreaterThan(T);
    if (shot?.kind === 'shot') expect(shot.at + shot.dur).toBeCloseTo(arrow!.at);
  });

  it('spreads one fighter’s hits on one tick and keeps every HP the engine gave', () => {
    const events: BattleEvent[] = [
      { t: 2, kind: 'cast', src: 'h0', via: 'skill', skill: 'flurry', name: '연속 찌르기' },
      hit(2, 'h0', 'e0', 5, 95, { via: 'skill' }),
      hit(2, 'h0', 'e0', 6, 89, { via: 'skill', crit: true }),
      hit(2, 'h0', 'e0', 7, 82, { via: 'skill', elementMult: 1.3 }),
      { t: 2, kind: 'end', outcome: 'timeout' },
    ];
    const tl = buildTimeline(events, units, { tickMs: 100, speed: 1 });
    const impacts = tl.cues.filter((c): c is Extract<Cue, { kind: 'impact' }> => c.kind === 'impact');
    expect(impacts.map((c) => c.hpAfter)).toEqual([95, 89, 82]);
    expect(impacts[1]!.at - impacts[0]!.at).toBeCloseTo(TIMELINE.hitGapMs);
    expect(impacts.map((c) => [c.crit, c.good])).toEqual([[false, false], [true, false], [false, true]]);
    // The cast is one action (the skill), not three lunges.
    expect(tl.cues.filter((c) => c.kind === 'act')).toHaveLength(1);
    expect(tl.cues.find((c) => c.kind === 'cast')).toMatchObject({ name: '연속 찌르기', via: 'skill' });
  });

  it('puts a fall just after the blow that felled, and the end last', () => {
    const events: BattleEvent[] = [hit(4, 'h0', 'e0', 100, 0), { t: 4, kind: 'down', unit: 'e0' }, { t: 4, kind: 'end', outcome: 'win' }];
    const tl = buildTimeline(events, units, { tickMs: 100, speed: 1 });
    const impact = tl.cues.find((c) => c.kind === 'impact')!;
    const down = tl.cues.find((c) => c.kind === 'down')!;
    expect(down.at).toBeCloseTo(impact.at + TIMELINE.downLagMs);
    expect(tl.cues[tl.cues.length - 1]).toMatchObject({ kind: 'end', outcome: 'win' });
    expect(tl.outcome).toBe('win');
  });

  it('plays a whole sim battle in order, never before zero, and ends with the engine’s HP', () => {
    const heroes = prototypeHeroes();
    const team = buildTeam(heroes, START_FORMATION);
    const enemies = floorEnemies(10);
    const r = runBattle({ heroes: team, enemies, limitTicks: STAGE_TIME_LIMIT_TICKS, seed: 7, key: ['test', 10] });
    const tlUnits: TimelineUnit[] = [
      ...team.map((h) => ({ id: h.id, side: 'hero' as const, shot: h.weapon.type === 'bow' ? ('arrow' as const) : h.weapon.type === 'staff' ? ('orb' as const) : null })),
      ...enemies.map((e) => ({ id: e.id, side: 'enemy' as const, shot: null })),
    ];
    for (const speed of [1, 4]) {
      const tl = buildTimeline(r.events, tlUnits, { tickMs: BATTLE_TICK_MS, speed });
      for (let i = 1; i < tl.cues.length; i++) expect(tl.cues[i]!.at).toBeGreaterThanOrEqual(tl.cues[i - 1]!.at);
      expect(tl.cues[0]!.at).toBeGreaterThanOrEqual(0);
      const start: Record<string, number> = {};
      for (const u of [...team, ...enemies]) start[u.id] = u.maxHp;
      const hp = finalHp(tl, start);
      for (const [id, v] of Object.entries(r.heroHp)) expect(hp[id]).toBe(v);
      for (const [id, v] of Object.entries(r.enemyHp)) expect(hp[id]).toBe(v);
      const heroIds = new Set(team.map((h) => h.id));
      expect(damageUpTo(tl, tl.endAt, heroIds, start)).toBe(r.damageDealt);
      expect(tl.endAt).toBeGreaterThanOrEqual(tickTime(r.ticks, BATTLE_TICK_MS, speed));
    }
  });
});

describe('the six actions (스프라이트 규격)', () => {
  it('has a sheet spec for each action, idle and victory looping', () => {
    expect(ANIM_ACTIONS).toEqual(['idle', 'attack', 'skill', 'hit', 'victory', 'ultimate']);
    for (const a of ANIM_ACTIONS) expect(ANIM_SPEC[a].frames).toBeGreaterThan(0);
    expect(ANIM_SPEC.idle.loop && ANIM_SPEC.victory.loop).toBe(true);
    expect(actionMs('attack')).toBe(Math.round((ANIM_SPEC.attack.frames / ANIM_SPEC.attack.fps) * 1000));
  });

  it('lunges forward and comes back; a ranged attack does not step in', () => {
    const d = actionMs('attack');
    const at = (k: number, melee: boolean) => motionPose('attack', d * k, d, { melee, time: 0 });
    expect(at(ATTACK_IMPACT_AT, true).dx).toBeGreaterThan(20);
    expect(at(1, true).dx).toBeCloseTo(0);
    expect(at(ATTACK_IMPACT_AT, false).dx).toBeLessThanOrEqual(0);
    expect(motionPose('hit', 0, 100, { melee: true, time: 0 }).flash).toBe(1);
    expect(motionPose('down', 100, 100, { melee: true, time: 0 }).alpha).toBe(0);
    expect(motionPose('idle', 0, Infinity, { melee: true, time: 0 }).dx).toBe(REST_POSE.dx);
  });
});
