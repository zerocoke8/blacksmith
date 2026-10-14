// 실시간 전투 (사용자 결정 2026-10-14 '실시간 전투', 필살기는 눌러서도 자동으로도): the battle is simulated
// as it plays. The engine (sim/stage/battle.ts startBattle) is stepped a tick at a time, a little
// ahead of what the field shows — far enough that no cue is known only after its moment
// (timeline.ts TIMELINE_LEAD_MS) — so a tap on a full card still changes what comes. Each step's
// events go through the timeline builder into the scene's live run. The fight itself is still the
// engine's alone (CLAUDE.md 규칙 2): a tap is an input the engine records (BattleResult.inputs), and the
// same setup, seed and inputs give the same battle anywhere (13장: the server replays them).
// The cards show the gauges as the field shows the fight, not as the engine has run it: each step's
// gauges are kept, and the cards read the one for the tick on screen. The schedule's arithmetic is
// pure (aheadTick, shownTick) and tested without a screen.

import type { LiveRun, RunEnd } from '../../render/battle/scene.ts';
import { makeTimelineBuilder, TIMELINE, TIMELINE_LEAD_MS, type TimelineUnit } from '../../render/battle/timeline.ts';
import type { BattleEvent, BattleResult, BattleRun, SignatureGauge } from '../../sim/stage/index.ts';

/** The live fight's slack [튜닝: 연출]: the engine runs this much (ms at ×1) past the longest wind-up, for a slow frame. */
export const LIVE = { marginMs: 150 } as const;

interface Schedule {
  tickMs: number;
  speed: number;
  /** Before the first tick (timeline.ts TIMELINE.introMs). */
  introMs?: number;
}

/**
 * The last tick the engine must have run when the field's clock is at `clockMs`: every tick whose
 * earliest cue (its wind-up, TIMELINE_LEAD_MS before it) comes within the margin.
 */
export function aheadTick(clockMs: number, o: Schedule & { leadMs?: number; marginMs?: number }): number {
  const intro = o.introMs ?? TIMELINE.introMs;
  const lead = (o.leadMs ?? TIMELINE_LEAD_MS) + (o.marginMs ?? LIVE.marginMs);
  return Math.floor((clockMs * o.speed + lead - intro) / o.tickMs);
}

/** The tick the field is showing at `clockMs` (0 before the first: the fighters taking their places). */
export function shownTick(clockMs: number, o: Schedule): number {
  const intro = o.introMs ?? TIMELINE.introMs;
  return Math.max(0, Math.floor((clockMs * o.speed - intro) / o.tickMs));
}

/** Runs a battle to its end: what is left of it with the signatures on auto (a skipped or abandoned fight). */
export function runToEnd(run: BattleRun, each?: (t: number, events: BattleEvent[]) => void): BattleResult {
  if (!run.done) run.setAuto(true);
  while (!run.done) {
    const events = run.step();
    each?.(run.tick, events);
  }
  return run.result();
}

/** A card's gauge as the field shows it; `ordered`: tapped, and its signature not on screen yet. */
export interface LiveGauge extends SignatureGauge {
  ordered: boolean;
}

export const NO_GAUGE: LiveGauge = { has: false, share: 0, ready: false, ordered: false };

/** The scene as the live play uses it (render/battle/scene.ts BattleScene). */
export interface LiveScene {
  runLive(opts?: { speed?: number }): LiveRun;
  skip(): void;
  stop(): void;
  clockMs(): number | null;
}

export interface LivePlayOptions {
  run: BattleRun;
  units: readonly TimelineUnit[];
  tickMs: number;
  speed: number;
  scene: LiveScene;
  /** After each engine step. */
  onTick?(t: number, events: readonly BattleEvent[]): void;
  /** The frame scheduler (requestAnimationFrame; tests pass their own): returns a cancel. */
  frame?(cb: () => void): () => void;
}

export interface LivePlay {
  /**
   * When the field has played the end (or the fight was skipped or stopped), with the engine's
   * result: a fight stopped halfway is run to its end first (runToEnd), so there is always one.
   */
  readonly done: Promise<{ end: RunEnd; result: BattleResult }>;
  /** The player tapped a full card: that hero's signature on the engine's next tick. */
  order(unit: string): void;
  /** The AUTO button, from the engine's next tick on. */
  setAuto(on: boolean): void;
  /** A hero's gauge as the field shows it now. */
  gauge(unit: string): LiveGauge;
  /** 건너뛰기, or leaving: the rest on auto, every cue to the field, the field jumps to the end. */
  finishNow(): BattleResult;
  /** Stops playing (the field stops where it is); `done` still comes, with the rest run on auto. */
  stop(): void;
}

interface Kept {
  t: number;
  gauges: Map<string, SignatureGauge>;
}

const rafFrame = (cb: () => void): (() => void) => {
  const id = requestAnimationFrame(() => cb());
  return () => cancelAnimationFrame(id);
};

export function playLive(o: LivePlayOptions): LivePlay {
  const { run, scene } = o;
  const builder = makeTimelineBuilder(o.units, { tickMs: o.tickMs, speed: o.speed });
  const heroes = o.units.filter((u) => u.side === 'hero').map((u) => u.id);
  const frame = o.frame ?? rafFrame;
  const sched = { tickMs: o.tickMs, speed: o.speed };

  /** Each step's gauges (as of its tick), oldest first; the ones the field has passed go. */
  const kept: Kept[] = [];
  const keep = () => kept.push({ t: run.tick, gauges: new Map(heroes.map((id) => [id, run.gauge(id)])) });
  keep();
  /** Taps not yet on screen: the tick their signature goes off on. */
  const ordered = new Map<string, number>();

  const live = scene.runLive({ speed: o.speed });
  /** Our run on the field is over (its end played, skipped or stopped). */
  let over = false;
  let cancel: (() => void) | null = null;

  const step = (): BattleEvent[] => {
    const events = run.step();
    keep();
    o.onTick?.(run.tick, events);
    return events;
  };

  const pump = () => {
    cancel = null;
    if (over) return;
    const clock = scene.clockMs();
    if (clock !== null && !run.done) {
      const target = aheadTick(clock, sched);
      const batch: BattleEvent[] = [];
      while (!run.done && run.tick < target) batch.push(...step());
      if (batch.length > 0) live.push(builder.add(batch));
    }
    if (!run.done) cancel = frame(pump);
  };

  const halt = () => {
    cancel?.();
    cancel = null;
  };

  const done = live.done.then((end) => {
    over = true;
    halt();
    return { end, result: runToEnd(run, (t, events) => o.onTick?.(t, events)) };
  });

  const gauge = (unit: string): LiveGauge => {
    const clock = scene.clockMs();
    const shown = clock === null || over ? Number.POSITIVE_INFINITY : shownTick(clock, sched);
    // The latest kept step the field has reached; older ones are no longer needed.
    while (kept.length > 1 && (kept[1] as Kept).t <= shown) kept.shift();
    const g = (kept[0] as Kept).gauges.get(unit);
    if (g === undefined) return NO_GAUGE;
    const at = ordered.get(unit);
    if (at !== undefined && shown >= at) ordered.delete(unit);
    return { ...g, ordered: at !== undefined && shown < at };
  };

  pump();

  return {
    done,
    order(unit) {
      // Only a card shown full (the engine, ahead, is full too: a waiting gauge stays full until it goes).
      const g = gauge(unit);
      if (over || run.done || !g.ready || g.ordered || !run.gauge(unit).ready) return;
      run.order(unit);
      ordered.set(unit, run.tick + 1);
    },
    setAuto(on) {
      if (!run.done) run.setAuto(on);
    },
    gauge,
    finishNow() {
      if (!run.done) {
        run.setAuto(true);
        const batch: BattleEvent[] = [];
        while (!run.done) batch.push(...step());
        if (!over) live.push(builder.add(batch));
      }
      halt();
      if (!over) scene.skip();
      return run.result();
    },
    stop() {
      halt();
      if (!over) scene.stop();
    },
  };
}
