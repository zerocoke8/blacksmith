import { describe, expect, it } from 'vitest';
import type { LiveRun, RunEnd } from '../../render/battle/scene.ts';
import { buildTimeline, type Cue, TIMELINE, TIMELINE_LEAD_MS } from '../../render/battle/timeline.ts';
import { BATTLE_TICK_MS, STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { dailyBossUnit } from '../../sim/daily/index.ts';
import { type BattleSetup, buildTeam, type Formation, floorEnemies, runBattle, type SignatureMode, startBattle } from '../../sim/stage/index.ts';
import { labEvolve, prototypeHeroes } from '../game/start.ts';
import { aheadTick, LIVE, type LivePlay, playLive, runToEnd, shownTick } from './live.ts';
import { battleShow, timelineUnits } from './show.ts';

/** A team with two specials at gold: they have signatures. */
const FORMATION: Formation = { front: ['hero_rookie', 'hero_vail', 'hero_shu'], back: ['hero_nea', 'hero_som'] };
function team() {
  let h = prototypeHeroes();
  h = labEvolve(h, 'hero_vail');
  h = labEvolve(h, 'hero_nea');
  return buildTeam(h, FORMATION);
}

function stageSetup(floor: number, signatures: SignatureMode = 'auto'): BattleSetup {
  return { heroes: team(), enemies: floorEnemies(floor), limitTicks: STAGE_TIME_LIMIT_TICKS, seed: 11, key: ['live', floor], signatures };
}

/** Floor 1's monsters that do not fall: the whole 30 s, nobody down, the gauges fill. */
function toughSetup(signatures: SignatureMode = 'auto'): BattleSetup {
  return { ...stageSetup(1, signatures), enemies: floorEnemies(1).map((e) => ({ ...e, maxHp: 1e9 })) };
}

/**
 * A field that plays by hand: its clock moves only when the test says, cues play when their moment
 * comes, and it notes when each cue was pushed.
 */
function fakeField() {
  let clock: number | null = null;
  let cues: Cue[] = [];
  let resolve: ((e: RunEnd) => void) | null = null;
  const pushed: { cue: Cue; clock: number }[] = [];
  const calls: string[] = [];
  const end = (e: RunEnd) => {
    const r = resolve;
    resolve = null;
    clock = null;
    r?.(e);
  };
  const scene = {
    runLive(opts?: { speed?: number }): LiveRun {
      calls.push(`runLive ${opts?.speed}`);
      clock = 0;
      cues = [];
      const done = new Promise<RunEnd>((r) => (resolve = r));
      return {
        push(batch: readonly Cue[]) {
          if (resolve === null) return;
          for (const c of batch) pushed.push({ cue: c, clock: clock ?? -1 });
          cues.push(...batch);
          cues.sort((a, b) => a.at - b.at);
        },
        done,
      };
    },
    skip() {
      calls.push('skip');
      end('skipped');
    },
    stop() {
      calls.push('stop');
      end('stopped');
    },
    clockMs: () => clock,
  };
  let next: (() => void) | null = null;
  const frame = (cb: () => void) => {
    next = cb;
    return () => {
      if (next === cb) next = null;
    };
  };
  /** One frame: the clock moves on, the cues due play (the end cue ends it), then the driver's frame runs. */
  const advance = (ms: number) => {
    if (clock === null) return;
    clock += ms;
    const due = cues.filter((c) => c.at <= (clock as number));
    cues = cues.filter((c) => c.at > (clock as number));
    if (due.some((c) => c.kind === 'end')) end('done');
    const cb = next;
    next = null;
    cb?.();
  };
  return { scene, frame, advance, pushed, calls, clock: () => clock };
}

async function playThrough(setup: BattleSetup, speed: number, frameMs = 16, during?: (p: LivePlay, f: ReturnType<typeof fakeField>) => void) {
  const f = fakeField();
  const show = battleShow(setup.heroes, setup.enemies, null);
  const play = playLive({ run: startBattle(setup), units: timelineUnits(show), tickMs: BATTLE_TICK_MS, speed, scene: f.scene, frame: f.frame });
  for (let i = 0; i < 100000 && f.clock() !== null; i++) {
    f.advance(frameMs);
    during?.(play, f);
  }
  const out = await play.done;
  return { ...out, f, play, show };
}

describe('the live schedule (aheadTick, shownTick)', () => {
  it('keeps the engine a wind-up and a margin ahead of the field', () => {
    const o = { tickMs: 100, speed: 1 };
    // Before anything: tick 1's first cue can start at intro + 100 − lead; nothing is due yet.
    expect(aheadTick(0, o)).toBe(Math.floor((TIMELINE_LEAD_MS + LIVE.marginMs - TIMELINE.introMs) / 100));
    expect(aheadTick(1000, o)).toBe(Math.floor((1000 + TIMELINE_LEAD_MS + LIVE.marginMs - TIMELINE.introMs) / 100));
    // Twice as fast: the same ticks at half the clock.
    expect(aheadTick(500, { tickMs: 100, speed: 2 })).toBe(aheadTick(1000, o));
    expect(shownTick(0, o)).toBe(0);
    expect(shownTick(TIMELINE.introMs + 350, o)).toBe(3);
    expect(shownTick((TIMELINE.introMs + 350) / 4, { tickMs: 100, speed: 4 })).toBe(3);
  });
});

describe('a live fight (playLive)', () => {
  for (const speed of [1, 2, 4]) {
    it(`gives the field every cue before its moment and the same fight as runBattle, at ×${speed}`, async () => {
      const setup = stageSetup(10);
      const { end, result, f } = await playThrough(setup, speed);
      expect(end).toBe('done');
      expect(result).toEqual(runBattle(setup));
      // Nothing came late: each cue was pushed while the field's clock was still before it.
      const late = f.pushed.filter((p) => p.cue.at < p.clock);
      expect(late).toEqual([]);
      // And the field got exactly the timeline of the whole fight.
      const tl = buildTimeline(result.events, timelineUnits(battleShow(setup.heroes, setup.enemies, null)), { tickMs: BATTLE_TICK_MS, speed });
      expect([...f.pushed.map((p) => p.cue)].sort((a, b) => a.at - b.at)).toEqual([...tl.cues].sort((a, b) => a.at - b.at));
      expect(f.calls[0]).toBe(`runLive ${speed}`);
    });
  }

  it('plays a daily boss with its roar on time, even on slow frames', async () => {
    const setup: BattleSetup = { heroes: team(), enemies: [dailyBossUnit(3, 2)], limitTicks: 600, seed: 5, key: ['live', 'daily'] };
    const { result, f } = await playThrough(setup, 2, 60);
    expect(result).toEqual(runBattle(setup));
    expect(result.events.some((e) => e.kind === 'status')).toBe(true);
    expect(f.pushed.filter((p) => p.cue.at < p.clock)).toEqual([]);
  });

  it('fires a tapped signature in manual mode, and the server replays it from the inputs', async () => {
    const setup = toughSetup('manual');
    let tappedAt: number | null = null;
    let sawOrdered = false;
    const { result } = await playThrough(setup, 1, 16, (play) => {
      const g = play.gauge('h1');
      if (g.ordered) sawOrdered = true;
      if (tappedAt === null && g.ready && !g.ordered) {
        play.order('h1');
        tappedAt = 1;
        // Shown as tapped until it plays.
        expect(play.gauge('h1').ordered).toBe(true);
      }
    });
    expect(tappedAt).not.toBeNull();
    expect(sawOrdered).toBe(true);
    const casts = result.inputs.filter((i) => i.kind === 'cast');
    expect(casts.length).toBe(1);
    expect(result.events.some((e) => e.kind === 'cast' && e.via === 'signature' && e.src === 'h1' && e.t === casts[0]?.t)).toBe(true);
    // Nobody else's signature went off: manual mode waits.
    expect(result.events.some((e) => e.kind === 'cast' && e.via === 'signature' && e.src !== 'h1')).toBe(false);
    expect(runBattle({ ...setup, inputs: result.inputs })).toEqual(result);
  });

  it('ignores a tap on a card that is not full', async () => {
    const setup = toughSetup('manual');
    const { result } = await playThrough(setup, 1, 16, (play) => {
      if (!play.gauge('h0').ready) play.order('h0');
      if (!play.gauge('h1').ready) play.order('h1');
    });
    // Only the start by hand (the engine records it for the server, 13장).
    expect(result.inputs).toEqual([{ t: 1, kind: 'auto', on: false }]);
  });

  it('shows the gauges as the field shows the fight, not as far as the engine has run', async () => {
    const setup = toughSetup();
    const shadow = startBattle(setup);
    let checked = 0;
    await playThrough(setup, 1, 16, (play, f) => {
      const clock = f.clock();
      if (clock === null) return;
      const t = shownTick(clock, { tickMs: BATTLE_TICK_MS, speed: 1 });
      while (shadow.tick < t && !shadow.done) shadow.step();
      if (shadow.tick !== t) return;
      expect(play.gauge('h1')).toEqual({ ...shadow.gauge('h1'), ordered: false });
      checked += 1;
    });
    expect(checked).toBeGreaterThan(50);
  });

  it('switches AUTO on halfway: the signatures go off by themselves from then on', async () => {
    const setup = toughSetup('manual');
    let switched = false;
    const { result } = await playThrough(setup, 1, 16, (play, f) => {
      if (!switched && (f.clock() ?? 0) > 5000) {
        play.setAuto(true);
        switched = true;
      }
    });
    expect(result.inputs.filter((i) => i.kind === 'auto' && i.on)).toHaveLength(1);
    expect(result.events.some((e) => e.kind === 'cast' && e.via === 'signature')).toBe(true);
    expect(runBattle({ ...setup, inputs: result.inputs })).toEqual(result);
  });

  it('skips: the rest on auto, every cue to the field before it jumps, the same result as a replay', async () => {
    const setup = toughSetup('manual');
    const f = fakeField();
    const show = battleShow(setup.heroes, setup.enemies, null);
    const play = playLive({ run: startBattle(setup), units: timelineUnits(show), tickMs: BATTLE_TICK_MS, speed: 2, scene: f.scene, frame: f.frame });
    for (let i = 0; i < 120; i++) f.advance(16);
    const result = play.finishNow();
    expect(f.calls.at(-1)).toBe('skip');
    expect(f.pushed.some((p) => p.cue.kind === 'end')).toBe(true);
    const out = await play.done;
    expect(out.end).toBe('skipped');
    expect(out.result).toEqual(result);
    expect(result.inputs.filter((i) => i.kind === 'auto' && i.on)).toEqual([{ t: expect.any(Number), kind: 'auto', on: true }]);
    expect(runBattle({ ...setup, inputs: result.inputs })).toEqual(result);
    // Done: a second skip, a tap or the switch change nothing.
    expect(play.finishNow()).toEqual(result);
    play.order('h1');
    play.setAuto(false);
    expect(play.finishNow().inputs).toEqual(result.inputs);
  });

  it('stopped halfway, it still ends with a result (the rest run on auto)', async () => {
    const setup = stageSetup(15, 'manual');
    const f = fakeField();
    const show = battleShow(setup.heroes, setup.enemies, null);
    const play = playLive({ run: startBattle(setup), units: timelineUnits(show), tickMs: BATTLE_TICK_MS, speed: 1, scene: f.scene, frame: f.frame });
    for (let i = 0; i < 60; i++) f.advance(16);
    play.stop();
    const out = await play.done;
    expect(out.end).toBe('stopped');
    expect(out.result).toEqual(runBattle({ ...setup, inputs: out.result.inputs }));
  });

  it('runToEnd finishes a fight that never played, on auto', () => {
    const setup = stageSetup(12, 'manual');
    const r = runToEnd(startBattle(setup));
    expect(r.inputs).toEqual([{ t: 1, kind: 'auto', on: true }]);
    expect(r).toEqual(runBattle({ ...setup, inputs: r.inputs }));
  });
});
