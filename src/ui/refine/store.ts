// 광석 정제 save data (기획서 10.1): the refine state (the world save's refine part), the world seed
// it rolls with, the multiplier chosen, and a small play log for the [검증] questions (16.3의
// 22·23번). Goes through platform/storage.ts only (CLAUDE.md 규칙 4). Everything read back is
// checked before the rules see it, and writes land in the order they were made.
// The prototype has no world save yet, so the refine save keeps its own seed; it moves into the
// world save when the idle world comes in (3.6).

import { type SaveStore, webStore } from '../../platform/storage.ts';
import { REFINE_LUMPS, REFINE_MULTS, type RefineMult } from '../../sim/data/refine.ts';
import { accrue, bagTotals, isRefineMult, newRefineState, type RefineState, restoreRefine } from '../../sim/refine/index.ts';

export const REFINE_SAVE_KEY = 'refine.save';

/**
 * Where a refine save that could not be read is put aside, once, before a fresh one replaces it
 * (a wrong version, a broken field, broken JSON): the player's bag is not thrown away unseen, and
 * it can be mended by hand or by a later migration. The next one that breaks takes its place.
 */
export const REFINE_SAVE_BROKEN_KEY = 'refine.save.broken';

/**
 * Prototype start: the first visit finds the lumps of this many minutes away already on the pile
 * (3 hours: the doc's own example visit, 10.1 경제 크기), so the hammer has something to strike
 * before the first lumps come in. Not a game rule (the world save will start the pile).
 */
export const PROTOTYPE_FIRST_AWAY_MIN = 180;

/** Visits kept in the play log; the oldest go first. */
export const VISIT_LIMIT = 200;

/** One visit to the refine screen (16.3의 22·23번: taps and holds, multipliers, an empty hammer). */
export interface RefineVisit {
  /** When it began (ms since the epoch) and when its last thing happened. */
  startMs: number;
  lastMs: number;
  /** Lumps on the pile on arrival, and how many of them came in while away. */
  lumpsIn: number;
  gained: number;
  /** The pile was at its cap on arrival. */
  full: boolean;
  /** Presses that struck: with one blow (a tap) or held into more. */
  taps: number;
  holds: number;
  blows: number;
  /** Blows per multiplier ('1', '2', '5', '10', '20'). */
  byMult: Record<string, number>;
  multChanges: number;
  /** The hammer pressed with not one lump. */
  emptyPresses: number;
  /** Vibration was on at the visit's last blow, and set firm (the 실험 panel's longer pulses). */
  haptics: boolean;
  firmHaptics: boolean;
  /** The hammer's sound was on at the visit's last blow. */
  sound: boolean;
}

/**
 * The refine save. `version` goes up only with a migration from the one before it in
 * readRefineSave: a save it cannot read is kept aside (REFINE_SAVE_BROKEN_KEY), never read as new.
 */
export interface RefineSave {
  version: 1;
  seed: number;
  state: RefineState;
  /** The multiplier chosen (the blow goes lower when the pile is short, 10.1). */
  mult: RefineMult;
  /** The first visit's line was said ("광석은 두드려 봐야 속을 안다."). */
  firstSeen: boolean;
  visits: RefineVisit[];
}

const MS_PER_MINUTE = 60_000;

/** Whole world minutes from wall-clock ms (the prototype counts real time, 10.1). */
export function worldMinute(ms: number): number {
  return Math.floor(ms / MS_PER_MINUTE);
}

/** The wall-clock ms a world minute begins at (for the '다음 덩어리까지' countdown). */
export function minuteStartMs(minute: number): number {
  return minute * MS_PER_MINUTE;
}

export function newRefineSave(nowMinute: number, seed: number): RefineSave {
  return {
    version: 1,
    seed: seed >>> 0,
    state: newRefineState(nowMinute - PROTOTYPE_FIRST_AWAY_MIN),
    mult: 1,
    firstSeen: false,
    visits: [],
  };
}

export function newVisit(nowMs: number, state: RefineState, gained: number, full: boolean): RefineVisit {
  return {
    startMs: nowMs,
    lastMs: nowMs,
    lumpsIn: state.lumps,
    gained,
    full,
    taps: 0,
    holds: 0,
    blows: 0,
    byMult: {},
    multChanges: 0,
    emptyPresses: 0,
    haptics: true,
    firmHaptics: false,
    sound: true,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function n0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function readVisit(v: unknown): RefineVisit | null {
  if (!isObj(v)) return null;
  const byMult: Record<string, number> = {};
  if (isObj(v.byMult)) for (const m of REFINE_MULTS) if (n0(v.byMult[String(m)]) > 0) byMult[String(m)] = n0(v.byMult[String(m)]);
  return {
    startMs: n0(v.startMs),
    lastMs: n0(v.lastMs),
    lumpsIn: n0(v.lumpsIn),
    gained: n0(v.gained),
    full: v.full === true,
    taps: n0(v.taps),
    holds: n0(v.holds),
    blows: n0(v.blows),
    byMult,
    multChanges: n0(v.multChanges),
    emptyPresses: n0(v.emptyPresses),
    haptics: v.haptics !== false,
    firmHaptics: v.firmHaptics === true,
    sound: v.sound !== false,
  };
}

/** A saved refine save, or null when there is none worth keeping (the player starts fresh). */
export function readRefineSave(data: unknown): RefineSave | null {
  if (!isObj(data) || data.version !== 1) return null;
  const state = restoreRefine(data.state);
  if (state === null) return null;
  const seed = typeof data.seed === 'number' && Number.isFinite(data.seed) ? data.seed >>> 0 : 1;
  return {
    version: 1,
    seed,
    state,
    mult: isRefineMult(data.mult) ? data.mult : 1,
    firstSeen: data.firstSeen === true,
    visits: Array.isArray(data.visits)
      ? data.visits
          .map(readVisit)
          .filter((x): x is RefineVisit => x !== null)
          .slice(-VISIT_LIMIT)
      : [],
  };
}

export interface RefineSaves {
  load(): Promise<RefineSave | null>;
  /** Resolve false when the store refused the write (missing, full or blocked). */
  save(save: RefineSave): Promise<boolean>;
  clear(): Promise<void>;
}

/** Refine saves on a store. Every load and save runs in call order. */
export function refineSaves(store: SaveStore): RefineSaves {
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    load: () =>
      inOrder(async () => {
        const raw = await store.load(REFINE_SAVE_KEY);
        if (raw === null) return null;
        let save: RefineSave | null = null;
        try {
          save = readRefineSave(JSON.parse(raw) as unknown);
        } catch {
          save = null;
        }
        // Unreadable: put it aside before the screen starts a fresh one over it.
        if (save === null && (await store.load(REFINE_SAVE_BROKEN_KEY)) !== raw) await store.save(REFINE_SAVE_BROKEN_KEY, raw);
        return save;
      }),
    save: (save) => inOrder(() => store.save(REFINE_SAVE_KEY, JSON.stringify(save))),
    clear: () => inOrder(() => store.remove(REFINE_SAVE_KEY)),
  };
}

/** The app's refine saves (localStorage today, the native store after Capacitor). */
export const refineStore: RefineSaves = refineSaves(webStore);

/** The pile as the home screen sees it (peekRefine). */
export interface RefinePeek {
  lumps: number;
  /** How many of them came in since the refine screen last took the pile in. */
  gained: number;
  full: boolean;
  /** The bag's gold, as the top band shows it (nothing is spent yet). */
  gold: number;
  /** Where that counting began (the save's accruedAt minute), or null: no save yet, the prototype's first pile. */
  since: number | null;
}

/**
 * For the home screen: the pile as it stands now and how much of it came in since the last visit,
 * without writing anything (counting is the same done now or later).
 */
export async function peekRefine(nowMs: number, saves: RefineSaves = refineStore): Promise<RefinePeek> {
  const now = worldMinute(nowMs);
  const loaded = await saves.load();
  const save = loaded ?? newRefineSave(now, 1);
  const r = accrue(save.state, now);
  return {
    lumps: r.state.lumps,
    gained: r.gained,
    full: r.state.lumps >= REFINE_LUMPS.cap,
    gold: bagTotals(r.state.bag).gold,
    since: loaded === null ? null : save.state.accruedAt,
  };
}

/** Play log totals (the 실험 panel). */
export interface VisitSummary {
  visits: number;
  blows: number;
  taps: number;
  holds: number;
  byMult: Record<string, number>;
  multChanges: number;
  emptyPresses: number;
  fullArrivals: number;
  hapticsOff: number;
  hapticsFirm: number;
  soundOff: number;
}

export function summarizeVisits(visits: readonly RefineVisit[]): VisitSummary {
  const out: VisitSummary = {
    visits: visits.length,
    blows: 0,
    taps: 0,
    holds: 0,
    byMult: {},
    multChanges: 0,
    emptyPresses: 0,
    fullArrivals: 0,
    hapticsOff: 0,
    hapticsFirm: 0,
    soundOff: 0,
  };
  for (const v of visits) {
    out.blows += v.blows;
    out.taps += v.taps;
    out.holds += v.holds;
    out.multChanges += v.multChanges;
    out.emptyPresses += v.emptyPresses;
    if (v.full) out.fullArrivals += 1;
    if (!v.haptics && v.blows > 0) out.hapticsOff += 1;
    if (v.haptics && v.firmHaptics && v.blows > 0) out.hapticsFirm += 1;
    if (!v.sound && v.blows > 0) out.soundOff += 1;
    for (const [m, k] of Object.entries(v.byMult)) out.byMult[m] = (out.byMult[m] ?? 0) + k;
  }
  return out;
}

/** The play log as JSON to paste with impressions (Korean keys, as the card craft's log). */
export function visitsJson(save: RefineSave): string {
  return JSON.stringify(
    {
      시드: save.seed,
      정제번호: save.state.refineNo,
      덩어리: save.state.lumps,
      가방: save.state.bag,
      방문: save.visits.map((v) => ({
        시각: new Date(v.startMs).toISOString(),
        머문초: Math.round((v.lastMs - v.startMs) / 1000),
        올때덩어리: v.lumpsIn,
        쌓인덩어리: v.gained,
        가득: v.full,
        탭: v.taps,
        꾹: v.holds,
        망치질: v.blows,
        배율별: v.byMult,
        배율바꿈: v.multChanges,
        빈망치: v.emptyPresses,
        진동: v.haptics,
        진동세게: v.firmHaptics,
        소리: v.sound,
      })),
    },
    null,
    1,
  );
}
