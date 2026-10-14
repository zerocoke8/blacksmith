// 사건 재생 시간표 (기획서 6.4 전투, CLAUDE.md 규칙 2): the battle's event list (sim/stage/battle.ts)
// laid out in screen time. Each hit lands exactly on its tick (× the tick length, ÷ the speed); the
// show around it — a melee fighter's run up to its foe that arrives as the hit lands (and back to its
// place after), its lunge there, an arrow that leaves early enough to arrive on it, a skill's
// wind-up, a fall just after the last blow, the end — is fitted round those moments. Nothing here changes what happened: the HP after each cue is the event's own.
// Pure, so the schedule is tested without a screen.

import type { BattleEvent, BattleOutcome, HitVia } from '../../sim/stage/battle.ts';
import { ATTACK_IMPACT_AT, actionMs } from './motion.ts';

/** How a unit's blows travel: a melee lunge, or a shot of some kind. */
export type ShotStyle = 'arrow' | 'bolt' | 'orb';

export interface TimelineUnit {
  id: string;
  side: 'hero' | 'enemy';
  /** null: melee (it lunges); otherwise what it shoots. */
  shot: ShotStyle | null;
}

export type Cue =
  /** A fighter starts an action (its blow, if any, lands at the matching impact). */
  | { at: number; kind: 'act'; unit: string; action: 'attack' | 'skill' | 'ultimate'; dur: number }
  /** A skill or signature's name over the caster. */
  | { at: number; kind: 'cast'; unit: string; via: 'skill' | 'signature'; name: string }
  /**
   * A melee fighter runs from its place up to `dst` (`go` ms, arriving as its first blow of the tick
   * lands), stays there `hold` ms (past its last blow of the tick) and runs back (`back` ms).
   */
  | { at: number; kind: 'dash'; unit: string; dst: string; go: number; hold: number; back: number }
  /** A shot leaves `src` and reaches `dst` after `dur`. */
  | { at: number; kind: 'shot'; src: string; dst: string; dur: number; style: ShotStyle }
  | {
      at: number;
      kind: 'impact';
      src: string;
      dst: string;
      via: HitVia;
      amount: number;
      crit: boolean;
      /** ◎ (element advantage) or ○→ a good body matchup: the number shows it. */
      good: boolean;
      hpAfter: number;
    }
  | { at: number; kind: 'heal'; src: string; dst: string; amount: number; hpAfter: number }
  | { at: number; kind: 'down'; unit: string }
  | { at: number; kind: 'end'; outcome: BattleOutcome };

/** The schedule's sizes (ms at speed 1) [튜닝: 연출]. */
export const TIMELINE = {
  /** Before the first tick: the fighters take their places. */
  introMs: 650,
  /** Hits of one fighter on one tick (a flurry, a spread) come this far apart. */
  hitGapMs: 85,
  /** Heals of one cast, one ally after another. */
  healGapMs: 45,
  /** A shot's flight. */
  shotMs: { arrow: 260, bolt: 200, orb: 330 } as Record<ShotStyle, number>,
  /** A ranged attack lets go this long before its shot leaves (the draw). */
  drawMs: 90,
  /**
   * A melee fighter's run to its foe and back (사용자 결정 2026-10-14: '근접은 적 근처까지 가서 친다'):
   * the run there, the stay after its last blow of the tick, the run back. ×1 here; the speed shortens
   * them. A hero attacks every 10 ticks (1 s at ×1), so the whole trip fits between two attacks.
   */
  dash: { goMs: 210, holdMs: 140, backMs: 260 },
  /** A fall comes this long after the last blow it took. */
  downLagMs: 140,
  /** The end comes this long after the last thing. */
  endPadMs: 450,
} as const;

export interface Timeline {
  cues: Cue[];
  /** When the 'end' cue is (ms from the start). */
  endAt: number;
  outcome: BattleOutcome;
  /** The playback speed it was laid out for (the scene shortens its floating words to match). */
  speed: number;
}

/** The screen time (ms) of tick t's first hit. */
export function tickTime(t: number, tickMs: number, speed: number, introMs: number = TIMELINE.introMs): number {
  return introMs / speed + (t * tickMs) / speed;
}

/** Lays out a battle's events (in their order) for playback at `speed` (1 = real time). */
export function buildTimeline(events: readonly BattleEvent[], units: readonly TimelineUnit[], opts: { tickMs: number; speed: number }): Timeline {
  const speed = Math.max(0.1, opts.speed);
  const unitOf = new Map(units.map((u) => [u.id, u]));
  const cues: Cue[] = [];
  /** Hits so far on this tick by each fighter (their gap), and whether its action was started. */
  let tick = -1;
  const hitsThisTick = new Map<string, number>();
  const actedThisTick = new Set<string>();
  const castThisTick = new Map<string, 'skill' | 'signature'>();
  /** A melee fighter's run on this tick: its stay grows to cover each later blow. */
  const dashThisTick = new Map<string, Extract<Cue, { kind: 'dash' }>>();
  const lastImpact = new Map<string, number>();
  let outcome: BattleOutcome = 'timeout';
  let endAt = 0;
  let latest = 0;
  /** The first moment after the unit's last HP change (1 ms on). */
  const afterLast = (unit: string, at: number): number => {
    const last = lastImpact.get(unit);
    return last !== undefined && at <= last ? last + 1 : at;
  };
  // A run back to its place goes on into the end's pad (the end does not wait for it).
  const endOf = (c: Cue) => c.at + (c.kind === 'shot' || c.kind === 'act' ? c.dur : c.kind === 'dash' ? c.go + c.hold : 0);
  const push = (c: Cue) => {
    cues.push(c);
    latest = Math.max(latest, endOf(c));
  };

  for (const e of events) {
    if (e.t !== tick) {
      tick = e.t;
      hitsThisTick.clear();
      actedThisTick.clear();
      castThisTick.clear();
      dashThisTick.clear();
    }
    const T = tickTime(e.t, opts.tickMs, speed);
    switch (e.kind) {
      case 'cast': {
        const action = e.via === 'signature' ? 'ultimate' : 'skill';
        const dur = actionMs(action) / speed;
        const lead = dur * 0.5;
        push({ at: T - lead, kind: 'act', unit: e.src, action, dur });
        push({ at: T - lead, kind: 'cast', unit: e.src, via: e.via, name: e.name });
        actedThisTick.add(e.src);
        castThisTick.set(e.src, e.via);
        break;
      }
      case 'hit': {
        const k = hitsThisTick.get(e.src) ?? 0;
        hitsThisTick.set(e.src, k + 1);
        // A unit's HP changes in the engine's order: a hit never lands before an earlier one on the same unit.
        const at = afterLast(e.dst, T + (k * TIMELINE.hitGapMs) / speed);
        const src = unitOf.get(e.src);
        const shot = src?.shot ?? null;
        if (!actedThisTick.has(e.src)) {
          actedThisTick.add(e.src);
          const dur = actionMs('attack') / speed;
          const lead = shot === null ? dur * ATTACK_IMPACT_AT : (TIMELINE.shotMs[shot] + TIMELINE.drawMs) / speed;
          push({ at: at - lead, kind: 'act', unit: e.src, action: 'attack', dur });
        }
        if (shot === null) {
          // The run there arrives on the first blow; each later blow of the tick keeps it there.
          const run = dashThisTick.get(e.src);
          const hold = TIMELINE.dash.holdMs / speed;
          if (run === undefined) {
            const go = TIMELINE.dash.goMs / speed;
            const c: Extract<Cue, { kind: 'dash' }> = { at: at - go, kind: 'dash', unit: e.src, dst: e.dst, go, hold, back: TIMELINE.dash.backMs / speed };
            dashThisTick.set(e.src, c);
            push(c);
          } else {
            run.hold = Math.max(run.hold, at + hold - (run.at + run.go));
            latest = Math.max(latest, endOf(run));
          }
        }
        if (shot !== null) {
          const fly = TIMELINE.shotMs[shot] / speed;
          push({ at: at - fly, kind: 'shot', src: e.src, dst: e.dst, dur: fly, style: shot });
        }
        push({
          at,
          kind: 'impact',
          src: e.src,
          dst: e.dst,
          via: e.via,
          amount: e.amount,
          crit: e.crit,
          good: e.elementMult > 1 || e.bodyMult > 1,
          hpAfter: e.hpAfter,
        });
        lastImpact.set(e.dst, at);
        break;
      }
      case 'heal': {
        const k = hitsThisTick.get(e.src) ?? 0;
        hitsThisTick.set(e.src, k + 1);
        const at = afterLast(e.dst, T + (k * TIMELINE.healGapMs) / speed);
        push({ at, kind: 'heal', src: e.src, dst: e.dst, amount: e.amount, hpAfter: e.hpAfter });
        lastImpact.set(e.dst, at);
        break;
      }
      case 'down': {
        const at = (lastImpact.get(e.unit) ?? T) + TIMELINE.downLagMs / speed;
        push({ at, kind: 'down', unit: e.unit });
        break;
      }
      case 'end': {
        outcome = e.outcome;
        endAt = Math.max(latest, T) + TIMELINE.endPadMs / speed;
        push({ at: endAt, kind: 'end', outcome });
        break;
      }
    }
  }
  if (!cues.some((c) => c.kind === 'end')) {
    endAt = latest + TIMELINE.endPadMs / speed;
    cues.push({ at: endAt, kind: 'end', outcome });
  }
  // Stable by time: same-time cues keep the order the events came in.
  const order = cues.map((c, i) => ({ c, i }));
  order.sort((a, b) => a.c.at - b.c.at || a.i - b.i);
  return { cues: order.map((x) => x.c), endAt, outcome, speed };
}

/** Every unit's HP once the whole timeline has played (a skipped battle jumps here). */
export function finalHp(tl: Timeline, start: Readonly<Record<string, number>>): Record<string, number> {
  const hp: Record<string, number> = { ...start };
  for (const c of tl.cues) {
    if (c.kind === 'impact') hp[c.dst] = c.hpAfter;
    else if (c.kind === 'heal') hp[c.dst] = c.hpAfter;
  }
  return hp;
}

/** The damage shown as dealt up to `ms` (the daily boss's running total): hero impacts' HP taken off. */
export function damageUpTo(tl: Timeline, ms: number, heroIds: ReadonlySet<string>, startHp: Readonly<Record<string, number>>): number {
  const hp: Record<string, number> = { ...startHp };
  let total = 0;
  for (const c of tl.cues) {
    if (c.at > ms) break;
    if (c.kind !== 'impact' || !heroIds.has(c.src)) continue;
    const before = hp[c.dst] ?? 0;
    total += Math.max(0, before - c.hpAfter);
    hp[c.dst] = c.hpAfter;
  }
  return total;
}
