import { describe, expect, it } from 'vitest';
import { BATTLE_TICK_MS, DAILY_TIME_LIMIT_TICKS, STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { dailyBossUnit } from '../../sim/daily/daily.ts';
import { buildTeam, floorEnemies, runBattle } from '../../sim/stage/index.ts';
import type { BattleEvent } from '../../sim/stage/battle.ts';
import { prototypeHeroes, START_FORMATION } from '../../ui/game/start.ts';
import { ANIM_ACTIONS, ANIM_SPEC, ATTACK_IMPACT_AT, actionMs, motionPose, REST_POSE } from './motion.ts';
import {
  buildTimeline,
  type Cue,
  damageUpTo,
  finalHp,
  makeTimelineBuilder,
  mergeCues,
  tickTime,
  TIMELINE,
  TIMELINE_LEAD_MS,
  type TimelineUnit,
} from './timeline.ts';

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

type Move = Extract<Cue, { kind: 'move' }>;
type Status = Extract<Cue, { kind: 'status' }>;
const moves = (cues: readonly Cue[]) => cues.filter((c): c is Move => c.kind === 'move');
const impacts = (cues: readonly Cue[]) => cues.filter((c): c is Extract<Cue, { kind: 'impact' }> => c.kind === 'impact');
const end = (t: number): BattleEvent => ({ t, kind: 'end', outcome: 'timeout' });
/** Two monsters: e1 is the next foe once e0 is down. */
const units2: TimelineUnit[] = [...units, { id: 'e1', side: 'enemy', shot: null }];

describe('melee walks (사용자 결정 2026-10-14: 적군 쪽으로 이동 후 그냥 서서 공격, 목표가 죽으면 다음 목표 쪽으로)', () => {
  it('a melee fighter walks to its first foe and arrives as its first blow lands; a shot has none', () => {
    for (const speed of [1, 4]) {
      const tl = buildTimeline([hit(5, 'h0', 'e0', 1, 99), hit(5, 'h1', 'e0', 1, 98), hit(7, 'e0', 'h0', 3, 97), end(7)], units, { tickMs: 100, speed });
      const ms = moves(tl.cues);
      // Both sides' melee walk; the archer (h1) stays.
      expect(ms.map((m) => [m.unit, m.dst])).toEqual([
        ['h0', 'e0'],
        ['e0', 'h0'],
      ]);
      const blow = impacts(tl.cues).find((c) => c.src === 'h0')!;
      const first = ms[0]!;
      expect(first.at + first.go).toBeCloseTo(blow.at);
      expect(first.go).toBeCloseTo(TIMELINE.move.firstMs / speed);
      // Never before the fight starts, and in time order with the rest.
      expect(first.at).toBeGreaterThan(0);
      for (let i = 1; i < tl.cues.length; i++) expect(tl.cues[i]!.at).toBeGreaterThanOrEqual(tl.cues[i - 1]!.at);
    }
  });

  it('stays by its foe while it lives, then walks (a shorter way) to the next', () => {
    const events: BattleEvent[] = [
      hit(2, 'h0', 'e0', 50, 50),
      hit(12, 'h0', 'e0', 50, 0),
      { t: 12, kind: 'down', unit: 'e0' },
      hit(22, 'h0', 'e1', 50, 50),
      hit(32, 'h0', 'e1', 50, 0),
      { t: 32, kind: 'down', unit: 'e1' },
      { t: 32, kind: 'end', outcome: 'win' },
    ];
    const tl = buildTimeline(events, units2, { tickMs: 100, speed: 1 });
    const ms = moves(tl.cues);
    expect(ms.map((m) => m.dst)).toEqual(['e0', 'e1']);
    const next = ms[1]!;
    expect(next.go).toBeCloseTo(TIMELINE.move.nextMs);
    expect(next.at + next.go).toBeCloseTo(tickTime(22, 100, 1));
  });

  it('sets off for a new foe only after its last blow on the old one has landed', () => {
    // A flurry's last blow lands 170 ms after its tick; the next blow, on a new foe, 200 ms after it.
    const events: BattleEvent[] = [
      { t: 2, kind: 'cast', src: 'h0', via: 'skill', skill: 'flurry', name: '연속 찌르기' },
      hit(2, 'h0', 'e0', 30, 70, { via: 'skill' }),
      hit(2, 'h0', 'e0', 30, 40, { via: 'skill' }),
      hit(2, 'h0', 'e0', 40, 0, { via: 'skill' }),
      { t: 2, kind: 'down', unit: 'e0' },
      hit(4, 'h0', 'e1', 10, 90),
      end(4),
    ];
    const tl = buildTimeline(events, units2, { tickMs: 100, speed: 1 });
    const blows = impacts(tl.cues);
    const next = moves(tl.cues)[1]!;
    expect(next.at).toBeCloseTo(blows[2]!.at + 1);
    expect(next.at + next.go).toBeCloseTo(blows[3]!.at);
    expect(next.go).toBeLessThan(TIMELINE.move.nextMs);
  });

  it('a spread reaches its later foes from where it stands: one walk a tick', () => {
    const events: BattleEvent[] = [
      { t: 2, kind: 'cast', src: 'h0', via: 'skill', skill: 'sweep', name: '휘두르기' },
      hit(2, 'h0', 'e0', 5, 95, { via: 'skill' }),
      hit(2, 'h0', 'e1', 5, 95, { via: 'skill' }),
      hit(2, 'h0', 'e0', 5, 90, { via: 'skill' }),
      hit(2, 'h0', 'e1', 5, 90, { via: 'skill' }),
      end(2),
    ];
    const ms = moves(buildTimeline(events, units2, { tickMs: 100, speed: 1 }).cues);
    expect(ms.map((m) => m.dst)).toEqual(['e0']);
  });
});

describe('statuses and a monster’s own skill (공격 속도 버프·디버프)', () => {
  it('a status shows after its tick’s blows, up or down, on until its last tick', () => {
    for (const speed of [1, 2]) {
      const events: BattleEvent[] = [
        { t: 30, kind: 'cast', src: 'h0', via: 'signature', skill: 'quake', name: '땅 가르기' },
        hit(30, 'h0', 'e0', 20, 80, { via: 'signature' }),
        hit(30, 'h0', 'e0', 20, 60, { via: 'signature' }),
        { t: 30, kind: 'status', src: 'h0', dst: 'e0', stat: 'atkSpeed', mult: 0.7, until: 70 },
        { t: 30, kind: 'status', src: 'h0', dst: 'h1', stat: 'atkSpeed', mult: 1.3, until: 80 },
        end(30),
      ];
      const tl = buildTimeline(events, units, { tickMs: 100, speed });
      const st = tl.cues.filter((c): c is Status => c.kind === 'status');
      expect(st.map((c) => [c.unit, c.stat, c.up])).toEqual([
        ['e0', 'atkSpeed', false],
        ['h1', 'atkSpeed', true],
      ]);
      const blows = impacts(tl.cues);
      for (const c of st) expect(c.at).toBeGreaterThanOrEqual(blows[blows.length - 1]!.at);
      expect(st[0]!.until).toBeCloseTo(tickTime(70, 100, speed));
      expect(st[1]!.until).toBeCloseTo(tickTime(80, 100, speed));
    }
  });

  it('a monster’s skill (the daily boss’s roar) winds up and shows its name like a hero’s', () => {
    const events: BattleEvent[] = [
      { t: 80, kind: 'cast', src: 'e0', via: 'skill', skill: 'roar', name: '쿵쿵 울부짖기' },
      { t: 80, kind: 'status', src: 'e0', dst: 'h0', stat: 'atkSpeed', mult: 0.8, until: 120 },
      { t: 80, kind: 'status', src: 'e0', dst: 'h1', stat: 'atkSpeed', mult: 0.8, until: 120 },
      end(80),
    ];
    const tl = buildTimeline(events, units, { tickMs: 100, speed: 1 });
    const T = tickTime(80, 100, 1);
    expect(tl.cues.find((c) => c.kind === 'act')).toMatchObject({ unit: 'e0', action: 'skill', at: T - actionMs('skill') * 0.5 });
    expect(tl.cues.find((c) => c.kind === 'cast')).toMatchObject({ unit: 'e0', via: 'skill', name: '쿵쿵 울부짖기' });
    const st = tl.cues.filter((c): c is Status => c.kind === 'status');
    expect(st.map((c) => [c.unit, c.up, c.at])).toEqual([
      ['h0', false, T],
      ['h1', false, T],
    ]);
    // A roar is no walk.
    expect(moves(tl.cues)).toHaveLength(0);
  });
});

describe('the live fight’s timeline (a tick at a time)', () => {
  /** Events in whole ticks, as the engine's steps give them. */
  const byTick = (events: readonly BattleEvent[]): BattleEvent[][] => {
    const out: BattleEvent[][] = [];
    for (const e of events) {
      const last = out[out.length - 1];
      if (last !== undefined && last[0]!.t === e.t) last.push(e);
      else out.push([e]);
    }
    return out;
  };
  /** A real fight: a floor's group, or a daily boss (its roar slows the heroes). */
  const simBattle = (daily = false) => {
    const heroes = prototypeHeroes();
    const team = buildTeam(heroes, START_FORMATION);
    const enemies = daily ? [dailyBossUnit(3, 1)] : floorEnemies(10);
    const limitTicks = daily ? DAILY_TIME_LIMIT_TICKS : STAGE_TIME_LIMIT_TICKS;
    const r = runBattle({ heroes: team, enemies, limitTicks, seed: 7, key: ['test', 10] });
    const tlUnits: TimelineUnit[] = [
      ...team.map((h) => ({ id: h.id, side: 'hero' as const, shot: h.weapon.type === 'bow' ? ('arrow' as const) : h.weapon.type === 'staff' ? ('orb' as const) : null })),
      ...enemies.map((e) => ({ id: e.id, side: 'enemy' as const, shot: null })),
    ];
    return { events: r.events, units: tlUnits };
  };
  const synthetic: BattleEvent[] = [
    hit(1, 'h0', 'e0', 10, 90),
    hit(3, 'h1', 'e0', 10, 80),
    { t: 9, kind: 'cast', src: 'h0', via: 'signature', skill: 'quake', name: '땅 가르기' },
    hit(9, 'h0', 'e0', 40, 40, { via: 'signature', crit: true }),
    { t: 9, kind: 'status', src: 'h0', dst: 'e0', stat: 'atkSpeed', mult: 0.7, until: 49 },
    hit(11, 'e0', 'h0', 5, 95),
    { t: 12, kind: 'cast', src: 'e0', via: 'skill', skill: 'roar', name: '쿵쿵 울부짖기' },
    { t: 12, kind: 'status', src: 'e0', dst: 'h0', stat: 'atkSpeed', mult: 0.8, until: 52 },
    hit(13, 'h1', 'e0', 40, 0),
    { t: 13, kind: 'down', unit: 'e0' },
    { t: 13, kind: 'end', outcome: 'win' },
  ];

  it('fed tick by tick it gives what buildTimeline gives all at once, and merges into the same order', () => {
    for (const { events, units: us } of [{ events: synthetic, units }, simBattle(), simBattle(true)]) {
      for (const speed of [1, 4]) {
        const whole = buildTimeline(events, us, { tickMs: BATTLE_TICK_MS, speed });
        const b = makeTimelineBuilder(us, { tickMs: BATTLE_TICK_MS, speed });
        let merged: Cue[] = [];
        const ticks = byTick(events);
        ticks.forEach((group, i) => {
          const got = b.add(group);
          // Each call's cues come in time order.
          for (let k = 1; k < got.length; k++) expect(got[k]!.at).toBeGreaterThanOrEqual(got[k - 1]!.at);
          merged = mergeCues(merged, got);
          if (i < ticks.length - 1) expect(b.endAt).toBeNull();
        });
        expect(merged).toEqual(whole.cues);
        expect(b.endAt).toBe(whole.endAt);
        expect(b.outcome).toBe(whole.outcome);
      }
    }
  });

  it('no cue starts more than TIMELINE_LEAD_MS (÷ the speed) before the tick it belongs to', () => {
    // Today the bound is a signature's wind-up; walks and shots stay within it.
    expect(TIMELINE_LEAD_MS).toBe(actionMs('ultimate') * 0.5);
    expect(TIMELINE_LEAD_MS).toBeGreaterThanOrEqual(TIMELINE.move.firstMs);
    for (const { events, units: us } of [{ events: synthetic, units }, simBattle(), simBattle(true)]) {
      for (const speed of [1, 2, 4]) {
        const b = makeTimelineBuilder(us, { tickMs: BATTLE_TICK_MS, speed });
        for (const group of byTick(events)) {
          const T = tickTime(group[0]!.t, BATTLE_TICK_MS, speed);
          for (const c of b.add(group)) expect(c.at).toBeGreaterThanOrEqual(T - TIMELINE_LEAD_MS / speed - 1e-9);
        }
      }
    }
  });
});
