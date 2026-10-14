// 사건 재생 시간표 (기획서 6.4 전투, CLAUDE.md 규칙 2): the battle's event list (sim/stage/battle.ts)
// laid out in screen time. Each hit lands exactly on its tick (× the tick length, ÷ the speed); the
// show around it — a melee fighter's walk up to a new foe that arrives as its first blow on it lands
// (it then stands there and fights, 사용자 결정 2026-10-14), its lunge, an arrow that leaves early
// enough to arrive on it, a skill's wind-up, a fall just after the last blow, a status's badge, the
// end — is fitted round those moments. Nothing here changes what happened: the HP after each cue is
// the event's own.
// The live fight lays it out a few ticks at a time as the engine steps (makeTimelineBuilder); a
// finished battle all at once (buildTimeline). Both give the same cues. Pure, so the schedule is
// tested without a screen.

import type { BattleEvent, BattleOutcome, HitVia, StatusStat } from '../../sim/stage/battle.ts';
import { ATTACK_IMPACT_AT, actionMs } from './motion.ts';

/** How a unit's blows travel: a melee lunge, or a shot of some kind. */
export type ShotStyle = 'arrow' | 'bolt' | 'orb';

export interface TimelineUnit {
  id: string;
  side: 'hero' | 'enemy';
  /** null: melee (it walks to its foe and lunges); otherwise what it shoots. */
  shot: ShotStyle | null;
}

export type Cue =
  /** A fighter starts an action (its blow, if any, lands at the matching impact). */
  | { at: number; kind: 'act'; unit: string; action: 'attack' | 'skill' | 'ultimate'; dur: number }
  /** A skill or signature's name over the caster (a hero's or a monster's). */
  | { at: number; kind: 'cast'; unit: string; via: 'skill' | 'signature'; name: string }
  /**
   * A melee fighter walks over `go` ms to stand in front of `dst`, arriving as its first blow on it
   * lands; it then stays by that foe (following it if it moves) until its next 'move'.
   */
  | { at: number; kind: 'move'; unit: string; dst: string; go: number }
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
  /** A status on `unit` (up: the stat goes up), on until `until` (ms: the screen time of its last tick). */
  | { at: number; kind: 'status'; unit: string; stat: StatusStat; up: boolean; until: number }
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
   * A melee fighter's walk to its foe (사용자 결정 2026-10-14: '적군 쪽으로 이동 후 그냥 서서 공격, 목표가
   * 죽으면 다음 목표 쪽으로'): from its place to its first foe, and from one foe to the next. ×1 here;
   * the speed shortens them. Kept within a signature's wind-up so the live fight need not be stepped
   * further ahead for them (TIMELINE_LEAD_MS).
   */
  move: { firstMs: 480, nextMs: 320 },
  /** A fall comes this long after the last blow it took. */
  downLagMs: 140,
  /** The end comes this long after the last thing. */
  endPadMs: 450,
} as const;

/** A skill's or signature's action starts this share of its length before its tick (the wind-up). */
const CAST_LEAD = 0.5;

/**
 * The most any cue starts before the tick it belongs to (ms at ×1; ÷ the speed): today a
 * signature's wind-up. The live fight keeps the engine at least this far ahead of the screen, so no
 * cue is known only after its moment has passed.
 */
export const TIMELINE_LEAD_MS = Math.max(
  actionMs('ultimate') * CAST_LEAD,
  actionMs('skill') * CAST_LEAD,
  actionMs('attack') * ATTACK_IMPACT_AT,
  ...Object.values(TIMELINE.shotMs).map((ms) => ms + TIMELINE.drawMs),
  TIMELINE.move.firstMs,
  TIMELINE.move.nextMs,
);

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

/** Lays out a battle's events as they come (the live fight). */
export interface TimelineBuilder {
  /**
   * Lays out the next events, whole ticks in order (one engine step, or a whole battle). Returns the
   * cues they made, in time order; one can come before cues an earlier call gave (a wind-up), so the
   * scene merges them by time.
   */
  add(events: readonly BattleEvent[]): Cue[];
  /** When the 'end' cue is, once the end has come (null before). */
  readonly endAt: number | null;
  readonly outcome: BattleOutcome;
}

/** Stable by time: same-time cues keep the order they were made in. */
export function byTime(cues: readonly Cue[]): Cue[] {
  const order = cues.map((c, i) => ({ c, i }));
  order.sort((a, b) => a.c.at - b.c.at || a.i - b.i);
  return order.map((x) => x.c);
}

/**
 * Two time-sorted lists as one (the scene's cues still to play and a batch just made): by time,
 * same-time cues the waiting ones first — so a fight fed a tick at a time plays its cues in the
 * order buildTimeline gives.
 */
export function mergeCues(waiting: readonly Cue[], batch: readonly Cue[]): Cue[] {
  const out: Cue[] = [];
  let i = 0;
  let j = 0;
  while (i < waiting.length || j < batch.length) {
    const a = waiting[i];
    const b = batch[j];
    if (b === undefined || (a !== undefined && a.at <= b.at)) {
      out.push(a as Cue);
      i += 1;
    } else {
      out.push(b);
      j += 1;
    }
  }
  return out;
}

/** The builder, plus the latest moment anything reaches so far (buildTimeline's end when no end event came). */
function startTimeline(units: readonly TimelineUnit[], opts: { tickMs: number; speed: number }): TimelineBuilder & { readonly latest: number } {
  const speed = Math.max(0.1, opts.speed);
  const unitOf = new Map(units.map((u) => [u.id, u]));
  let tick = -1;
  /** Hits and heals so far on this tick by each fighter (their gap), and whether its action was started. */
  const hitsThisTick = new Map<string, number>();
  const actedThisTick = new Set<string>();
  /** Melee fighters whose first blow of this tick has come: a spread's later foes are reached from where it stands. */
  const struckThisTick = new Set<string>();
  /** This tick's last impact or heal so far (a status shows after the blows that brought it). */
  let tickLand = Number.NEGATIVE_INFINITY;
  /** By the unit hit or healed: its last HP change. */
  const lastImpact = new Map<string, number>();
  /** By the striker: its last blow's landing (a walk to a new foe leaves after it). */
  const lastBlow = new Map<string, number>();
  /** The foe each melee fighter stands by. */
  const standingBy = new Map<string, string>();
  let outcome: BattleOutcome = 'timeout';
  let endAt: number | null = null;
  let latest = 0;
  /** The first moment after the unit's last HP change (1 ms on). */
  const afterLast = (unit: string, at: number): number => {
    const last = lastImpact.get(unit);
    return last !== undefined && at <= last ? last + 1 : at;
  };
  const endOf = (c: Cue) => c.at + (c.kind === 'shot' || c.kind === 'act' ? c.dur : c.kind === 'move' ? c.go : 0);

  const add = (events: readonly BattleEvent[]): Cue[] => {
    const cues: Cue[] = [];
    const push = (c: Cue) => {
      cues.push(c);
      latest = Math.max(latest, endOf(c));
    };
    for (const e of events) {
      if (endAt !== null) break;
      if (e.t !== tick) {
        tick = e.t;
        hitsThisTick.clear();
        actedThisTick.clear();
        struckThisTick.clear();
        tickLand = Number.NEGATIVE_INFINITY;
      }
      const T = tickTime(e.t, opts.tickMs, speed);
      switch (e.kind) {
        case 'cast': {
          // A hero's skill or signature, or a monster's own (a daily boss's roar): the same wind-up and name.
          const action = e.via === 'signature' ? 'ultimate' : 'skill';
          const dur = actionMs(action) / speed;
          const lead = dur * CAST_LEAD;
          push({ at: T - lead, kind: 'act', unit: e.src, action, dur });
          push({ at: T - lead, kind: 'cast', unit: e.src, via: e.via, name: e.name });
          actedThisTick.add(e.src);
          break;
        }
        case 'hit': {
          const k = hitsThisTick.get(e.src) ?? 0;
          hitsThisTick.set(e.src, k + 1);
          // A unit's HP changes in the engine's order: a hit never lands before an earlier one on the same unit.
          const at = afterLast(e.dst, T + (k * TIMELINE.hitGapMs) / speed);
          const shot = unitOf.get(e.src)?.shot ?? null;
          if (shot === null && !struckThisTick.has(e.src)) {
            struckThisTick.add(e.src);
            // A new foe: it walks over to arrive as this blow lands, setting off only after its last blow has landed.
            const by = standingBy.get(e.src);
            if (by !== e.dst) {
              const want = (by === undefined ? TIMELINE.move.firstMs : TIMELINE.move.nextMs) / speed;
              const from = Math.min(at, Math.max((lastBlow.get(e.src) ?? Number.NEGATIVE_INFINITY) + 1, at - want));
              push({ at: from, kind: 'move', unit: e.src, dst: e.dst, go: at - from });
              standingBy.set(e.src, e.dst);
            }
          }
          if (!actedThisTick.has(e.src)) {
            actedThisTick.add(e.src);
            const dur = actionMs('attack') / speed;
            const lead = shot === null ? dur * ATTACK_IMPACT_AT : (TIMELINE.shotMs[shot] + TIMELINE.drawMs) / speed;
            push({ at: at - lead, kind: 'act', unit: e.src, action: 'attack', dur });
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
          lastBlow.set(e.src, at);
          tickLand = Math.max(tickLand, at);
          break;
        }
        case 'heal': {
          const k = hitsThisTick.get(e.src) ?? 0;
          hitsThisTick.set(e.src, k + 1);
          const at = afterLast(e.dst, T + (k * TIMELINE.healGapMs) / speed);
          push({ at, kind: 'heal', src: e.src, dst: e.dst, amount: e.amount, hpAfter: e.hpAfter });
          lastImpact.set(e.dst, at);
          tickLand = Math.max(tickLand, at);
          break;
        }
        case 'status': {
          const until = tickTime(e.until, opts.tickMs, speed);
          push({ at: Math.max(T, tickLand), kind: 'status', unit: e.dst, stat: e.stat, up: e.mult > 1, until });
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
    return byTime(cues);
  };

  return {
    add,
    get endAt() {
      return endAt;
    },
    get outcome() {
      return outcome;
    },
    get latest() {
      return latest;
    },
  };
}

/** A builder for a live fight: fed each engine step's events as they come (TimelineBuilder). */
export function makeTimelineBuilder(units: readonly TimelineUnit[], opts: { tickMs: number; speed: number }): TimelineBuilder {
  return startTimeline(units, opts);
}

/** Lays out a battle's events (in their order) for playback at `speed` (1 = real time). */
export function buildTimeline(events: readonly BattleEvent[], units: readonly TimelineUnit[], opts: { tickMs: number; speed: number }): Timeline {
  const speed = Math.max(0.1, opts.speed);
  const b = startTimeline(units, opts);
  const cues = b.add(events);
  let endAt = b.endAt;
  if (endAt === null) {
    // A list without its end: it ends after the last thing.
    endAt = b.latest + TIMELINE.endPadMs / speed;
    cues.push({ at: endAt, kind: 'end', outcome: b.outcome });
  }
  return { cues, endAt, outcome: b.outcome, speed };
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
