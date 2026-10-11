// 육성 한 판 save data: the run in progress (판 세이브: setup + 행동 기록, 13.16), the 명예의 전당
// (13.13), the screen's own notes about the run (time spent, results seen), the [검증] switches with
// the last 준비 화면, and the play log. Everything goes through platform/storage.ts (CLAUDE.md 규칙 4);
// the run and the hall are written and read with the engine's own functions, so a reload replays
// the same actions and lands on the same turn.

import { type SaveStore, webStore } from '../../platform/storage.ts';
import { ENCHANT_IDS } from '../../sim/core/types.ts';
import { type CardId, CARD_IDS, CARDS } from '../../sim/data/cards.ts';
import { type FamilyId, isFamilyId } from '../../sim/data/families.ts';
import {
  type DeathMode,
  DEATH_MODE_LABEL,
  DEFAULT_RUN_RULES,
  EVENT_RATE_RANGE,
  LATE_GOLD_RATE_RANGE,
  RUN_DEFAULT_DECK,
  RUN_HAND_SIZE_RANGE,
  RUN_TURNS_RANGE,
  type Star,
  STARS,
  WALL_PRESETS,
  type WallPreset,
} from '../../sim/data/run.ts';
import {
  HALL_SAVE_KEY,
  type HallOfFame,
  parseHall,
  recoverRun,
  RUN_SAVE_KEY,
  type RunRecoveryStatus,
  type RunRules,
  type RunState,
  serializeHall,
  serializeRun,
  type WeaponKeep,
} from '../../sim/run/index.ts';
import type { RunRecord } from './record.ts';

export const RUN_META_KEY = 'run.meta';
export const RUN_PREFS_KEY = 'run.prefs';
export const RUN_RECORDS_KEY = 'run.records';

/**
 * Play log entries kept; the oldest go first. A record is about 16KB (its replay included), so
 * this keeps the log well inside the browser's storage next to the card craft's log.
 */
export const RUN_RECORD_LIMIT = 60;
/** A pause longer than this between two taps counts as this long (a break, not thinking). */
export const RUN_IDLE_CAP_MS = 120_000;

/** [검증] 실험 패널 (16.3). Applies from the next run; a run copies its rules when it starts. */
export interface RunLab {
  star: Star;
  /** 보유 가문 동료의 성급. 시즌 칸은 빌린 1성 (13.3). */
  companionStar: Star;
  turns: number;
  wallPreset: WallPreset;
  deathMode: DeathMode;
  eventRate: number;
  quickForge: boolean;
  /** 판 손패 (13.8: 5장). */
  handSize: number;
  /** 31층부터 층 수입 배율 (13.4.3: ×1). */
  lateGoldRate: number;
  seed: number;
  /** 판을 시작할 때마다 다음 시드로 넘긴다. */
  seedStep: boolean;
  /** 4.2.9 두 번 눌러 내기, in the run's forges. */
  tapToPreview: boolean;
}

/** The 준비 화면 as last filled in ('지난 판 구성', 13.3). Ancestors are 명예의 전당 card ids. */
export interface PrepDraft {
  hero: FamilyId;
  /** 동료 칸 3개: 보유 가문 둘 + 시즌 칸. null = 비워 둠. */
  companions: (FamilyId | null)[];
  deck: CardId[];
  ancestors: string[];
  mainAncestor: number | null;
  factorPicks: { ancestor: number; index: number }[];
  weaponKeep: WeaponKeep | null;
}

export interface RunPrefs {
  version: 1;
  lab: RunLab;
  draft: PrepDraft | null;
  /** One-time lines already shown. */
  seen: string[];
}

/** What the screen notes about the run in progress, for the play log (16.3의 11·12번). */
export interface RunMeta {
  version: 1;
  /** seed-start time: names the run in the play log. */
  id: string;
  startedAtMs: number;
  /** n대: this family's cards in the hall when the run started, + 1. */
  generation: number;
  /** Time on the 준비 화면 before [오른다]. */
  prepMs: number;
  /** Time deciding on the 턴 화면 (sheets included), by turn. */
  turnMs: Record<string, number>;
  /** Time on 사건과 보상 고르기, by the turn they came after. */
  choiceMs: Record<string, number>;
  /** Time reading 원정 결과, by turn. */
  resultMs: Record<string, number>;
  /** Time on the anvil and the 완성 화면, by 단조 번호. */
  forgeMs: Record<string, number>;
  /** Time per craft turn, by 단조 번호. */
  forgeTurnMs: Record<string, number[]>;
  pileOpens: number;
  infoOpens: number;
  /** Turn logs whose 결과 the player has been shown. */
  seenLogs: number;
  /** 원정 결과 shown, and how many were skipped before every floor was out (16.3의 16번). */
  reveals: number;
  skips: number;
  /** In the play log already. */
  recorded: boolean;
  /** Id the 전설 용사 카드 got in the hall, once hung. */
  hallId: string | null;
  /** The hall was full and the player let this card go. */
  hallDeclined: boolean;
}

export function defaultRunLab(): RunLab {
  return {
    star: 2,
    companionStar: 1,
    turns: DEFAULT_RUN_RULES.turns,
    wallPreset: DEFAULT_RUN_RULES.wallPreset,
    deathMode: DEFAULT_RUN_RULES.deathMode,
    eventRate: DEFAULT_RUN_RULES.eventRate,
    quickForge: DEFAULT_RUN_RULES.quickForge,
    handSize: DEFAULT_RUN_RULES.handSize,
    lateGoldRate: DEFAULT_RUN_RULES.lateGoldRate,
    seed: 1,
    seedStep: true,
    tapToPreview: false,
  };
}

export function defaultPrefs(): RunPrefs {
  return { version: 1, lab: defaultRunLab(), draft: null, seen: [] };
}

export function rulesOfLab(lab: RunLab): RunRules {
  return {
    turns: lab.turns,
    wallPreset: lab.wallPreset,
    deathMode: lab.deathMode,
    eventRate: lab.eventRate,
    quickForge: lab.quickForge,
    handSize: lab.handSize,
    lateGoldRate: lab.lateGoldRate,
  };
}

export function newMeta(seed: number, nowMs: number, generation: number, prepMs: number): RunMeta {
  return {
    version: 1,
    id: `${seed}-${nowMs}`,
    startedAtMs: nowMs,
    generation,
    prepMs,
    turnMs: {},
    choiceMs: {},
    resultMs: {},
    forgeMs: {},
    forgeTurnMs: {},
    pileOpens: 0,
    infoOpens: 0,
    seenLogs: 0,
    reveals: 0,
    skips: 0,
    recorded: false,
    hallId: null,
    hallDeclined: false,
  };
}

export type TimeBucket = 'turnMs' | 'choiceMs' | 'resultMs' | 'forgeMs';

/** Adds time to one bucket of the meta. */
export function addMetaTime(meta: RunMeta, bucket: TimeBucket, key: number, ms: number): RunMeta {
  if (!(ms > 0)) return meta;
  const k = String(key);
  return { ...meta, [bucket]: { ...meta[bucket], [k]: (meta[bucket][k] ?? 0) + ms } };
}

/** Adds time to one craft turn of a 단조 (and to the 단조 itself). */
export function addForgeTurnTime(meta: RunMeta, forgeNo: number, craftTurn: number, ms: number): RunMeta {
  if (!(ms > 0)) return meta;
  const k = String(forgeNo);
  const turns = [...(meta.forgeTurnMs[k] ?? [])];
  while (turns.length < craftTurn) turns.push(0);
  turns[craftTurn - 1] = (turns[craftTurn - 1] ?? 0) + ms;
  return addMetaTime({ ...meta, forgeTurnMs: { ...meta.forgeTurnMs, [k]: turns } }, 'forgeMs', forgeNo, ms);
}

/** Total time the run has been on screen. */
export function activeMsOf(meta: RunMeta): number {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return meta.prepMs + sum(meta.turnMs) + sum(meta.choiceMs) + sum(meta.resultMs) + sum(meta.forgeMs);
}

// ---------- Reading saved data ----------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function whole(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}

function readStar(v: unknown, fallback: Star): Star {
  return STARS.find((s) => s === v) ?? fallback;
}

export function readLab(v: unknown): RunLab {
  const base = defaultRunLab();
  if (!isObj(v)) return base;
  const rate =
    typeof v.eventRate === 'number' && Number.isFinite(v.eventRate)
      ? Math.min(EVENT_RATE_RANGE.max, Math.max(EVENT_RATE_RANGE.min, v.eventRate))
      : base.eventRate;
  return {
    star: readStar(v.star, base.star),
    companionStar: readStar(v.companionStar, base.companionStar),
    turns: whole(v.turns, RUN_TURNS_RANGE.min, RUN_TURNS_RANGE.max, base.turns),
    wallPreset: WALL_PRESETS.find((p) => p === v.wallPreset) ?? base.wallPreset,
    deathMode: (Object.keys(DEATH_MODE_LABEL) as DeathMode[]).find((m) => m === v.deathMode) ?? base.deathMode,
    eventRate: rate,
    quickForge: v.quickForge === true,
    handSize: whole(v.handSize, RUN_HAND_SIZE_RANGE.min, RUN_HAND_SIZE_RANGE.max, base.handSize),
    lateGoldRate:
      typeof v.lateGoldRate === 'number' && Number.isFinite(v.lateGoldRate)
        ? Math.min(LATE_GOLD_RATE_RANGE.max, Math.max(LATE_GOLD_RATE_RANGE.min, v.lateGoldRate))
        : base.lateGoldRate,
    seed: typeof v.seed === 'number' && Number.isSafeInteger(v.seed) && v.seed >= 0 ? v.seed : base.seed,
    seedStep: v.seedStep !== false,
    tapToPreview: v.tapToPreview === true,
  };
}

function isCardId(v: unknown): v is CardId {
  return typeof v === 'string' && (CARD_IDS as readonly string[]).includes(v);
}

function readWeaponKeep(v: unknown): WeaponKeep | null {
  if (!isObj(v)) return null;
  if (v.kind === 'element') return { kind: 'element' };
  const enchant = ENCHANT_IDS.find((id) => id === v.enchant);
  if (v.kind === 'enchant' && enchant !== undefined) return { kind: 'enchant', enchant };
  return null;
}

export function readDraft(v: unknown): PrepDraft | null {
  if (!isObj(v) || !isFamilyId(v.hero)) return null;
  const companions = Array.isArray(v.companions)
    ? v.companions.slice(0, 3).map((c) => (isFamilyId(c) ? c : null))
    : [];
  while (companions.length < 3) companions.push(null);
  const deck = Array.isArray(v.deck) ? v.deck.filter((id): id is CardId => isCardId(id) && CARDS[id].kind !== 'material') : [];
  const ancestors = Array.isArray(v.ancestors) ? v.ancestors.filter((id): id is string => typeof id === 'string').slice(0, 2) : [];
  const picks = Array.isArray(v.factorPicks)
    ? v.factorPicks.filter(isObj).map((p) => ({ ancestor: whole(p.ancestor, 0, 1, 0), index: whole(p.index, 0, 9, 0) }))
    : [];
  const main = v.mainAncestor === null || v.mainAncestor === undefined ? null : whole(v.mainAncestor, 0, 1, 0);
  return {
    hero: v.hero,
    companions,
    deck: deck.length > 0 ? deck : [...RUN_DEFAULT_DECK],
    ancestors,
    mainAncestor: main,
    factorPicks: picks,
    weaponKeep: readWeaponKeep(v.weaponKeep),
  };
}

export function readPrefs(data: unknown): RunPrefs {
  const base = defaultPrefs();
  if (!isObj(data) || data.version !== 1) return base;
  return {
    version: 1,
    lab: readLab(data.lab),
    draft: readDraft(data.draft),
    seen: Array.isArray(data.seen) ? data.seen.filter((s): s is string => typeof s === 'string') : [],
  };
}

function readMsRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    const ms = whole(n, 0, Number.MAX_SAFE_INTEGER, 0);
    if (ms > 0) out[k] = ms;
  }
  return out;
}

export function readMeta(data: unknown): RunMeta | null {
  if (!isObj(data) || data.version !== 1 || typeof data.id !== 'string') return null;
  const n = (v: unknown) => whole(v, 0, Number.MAX_SAFE_INTEGER, 0);
  const forgeTurnMs: Record<string, number[]> = {};
  if (isObj(data.forgeTurnMs)) {
    for (const [k, list] of Object.entries(data.forgeTurnMs)) {
      if (Array.isArray(list)) forgeTurnMs[k] = list.map(n);
    }
  }
  return {
    version: 1,
    id: data.id,
    startedAtMs: n(data.startedAtMs),
    generation: whole(data.generation, 1, 999, 1),
    prepMs: n(data.prepMs),
    turnMs: readMsRecord(data.turnMs),
    choiceMs: readMsRecord(data.choiceMs),
    resultMs: readMsRecord(data.resultMs),
    forgeMs: readMsRecord(data.forgeMs),
    forgeTurnMs,
    pileOpens: n(data.pileOpens),
    infoOpens: n(data.infoOpens),
    seenLogs: n(data.seenLogs),
    reveals: n(data.reveals),
    skips: n(data.skips),
    recorded: data.recorded === true,
    hallId: typeof data.hallId === 'string' ? data.hallId : null,
    hallDeclined: data.hallDeclined === true,
  };
}

/** Saved play records; entries without an id or a result are dropped. */
export function readRunRecords(data: unknown): RunRecord[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is RunRecord => isObj(r) && typeof r.id === 'string' && isObj(r.result) && isObj(r.end) && Array.isArray(r.turns))
    .slice(-RUN_RECORD_LIMIT);
}

// ---------- Writing ----------

export interface RunLoad {
  run: RunState | null;
  /** A saved run was there but did not replay (another version, a broken save). */
  runLost: boolean;
  /**
   * How the saved run came back (sim/run recoverRun): 'changed' or 'partial' when the game was
   * updated under it, so the screen can say so. Null without a run.
   */
  runStatus: RunRecoveryStatus | null;
  meta: RunMeta | null;
  hall: HallOfFame;
  prefs: RunPrefs;
  records: RunRecord[];
}

export interface RunSaves {
  loadAll(): Promise<RunLoad>;
  /** Resolve false when the store refused the write (missing, full or blocked). */
  saveRun(run: RunState | null): Promise<boolean>;
  saveMeta(meta: RunMeta | null): Promise<boolean>;
  saveHall(hall: HallOfFame): Promise<boolean>;
  savePrefs(prefs: RunPrefs): Promise<boolean>;
  saveRecords(records: RunRecord[]): Promise<boolean>;
}

/** Run saves on a store. Every load and save runs in call order. */
export function runSaves(store: SaveStore): RunSaves {
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  const loadJson = async (key: string): Promise<unknown> => {
    const raw = await store.load(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };
  const putOrRemove = async (key: string, text: string | null): Promise<boolean> => {
    if (text !== null) return store.save(key, text);
    await store.remove(key);
    return true;
  };
  return {
    loadAll: () =>
      inOrder(async () => {
        const runText = await store.load(RUN_SAVE_KEY);
        const back = recoverRun(runText);
        return {
          run: back?.state ?? null,
          runLost: runText !== null && back === null,
          runStatus: back?.status ?? null,
          meta: readMeta(await loadJson(RUN_META_KEY)),
          hall: parseHall(await store.load(HALL_SAVE_KEY)),
          prefs: readPrefs(await loadJson(RUN_PREFS_KEY)),
          records: readRunRecords(await loadJson(RUN_RECORDS_KEY)),
        };
      }),
    saveRun: (run) => inOrder(() => putOrRemove(RUN_SAVE_KEY, run === null ? null : serializeRun(run))),
    saveMeta: (meta) => inOrder(() => putOrRemove(RUN_META_KEY, meta === null ? null : JSON.stringify(meta))),
    saveHall: (hall) => inOrder(() => store.save(HALL_SAVE_KEY, serializeHall(hall))),
    savePrefs: (prefs) => inOrder(() => store.save(RUN_PREFS_KEY, JSON.stringify(prefs))),
    saveRecords: (records) => inOrder(() => store.save(RUN_RECORDS_KEY, JSON.stringify(records))),
  };
}

/** The app's run saves (localStorage today, the native store after Capacitor). */
export const runStore: RunSaves = runSaves(webStore);

/** Whether a run is saved (in progress, or over and waiting on its 판 끝 화면). Does not replay it. */
export async function hasRunSave(store: SaveStore = webStore): Promise<boolean> {
  return (await store.load(RUN_SAVE_KEY)) !== null;
}
