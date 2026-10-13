// 마을 지도 홈의 저장 (기획서 9장): the 실험 panel's switches and a small play log for the map's
// [검증] questions (17장의 15·16번: how long the map is dragged, building taps against the quick
// entries). Through platform/storage.ts only (CLAUDE.md 규칙 4). Where the map was looking and who
// walks on it is never saved (9.1).

import { type SaveStore, webStore } from '../../platform/storage.ts';

export const TOWN_PREFS_KEY = 'town.prefs';
export const TOWN_LOG_KEY = 'town.log';

export interface TownPrefs {
  version: 1;
  /** Draw the map as a player with no stage would see it (best stage 0): the locked look (9.2). */
  lockPreview: boolean;
}

export function defaultTownPrefs(): TownPrefs {
  return { version: 1, lockPreview: false };
}

/** One visit to the map (from the home screen opening to leaving it). */
export interface TownVisit {
  startMs: number;
  lastMs: number;
  /** Drags of the map and their total length (ms). */
  drags: number;
  dragMs: number;
  /** Taps on buildings (by building id) and on the quick entries (by slot). */
  buildingTaps: Record<string, number>;
  quickTaps: Record<string, number>;
  /** Taps on the walking guests (17장의 17번). */
  guestTaps: number;
  /** Where the visit went ('cards', 'refine', 'craft'), null while on the map or if the app was left. */
  went: string | null;
  /** How it went there: a building on the map, or a quick entry. */
  via: 'map' | 'quick' | null;
}

export interface TownLog {
  version: 1;
  visits: TownVisit[];
}

/** Visits kept; the oldest go first. */
export const TOWN_VISIT_LIMIT = 200;

export function newTownVisit(nowMs: number): TownVisit {
  return { startMs: nowMs, lastMs: nowMs, drags: 0, dragMs: 0, buildingTaps: {}, quickTaps: {}, guestTaps: 0, went: null, via: null };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const counts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  return out;
};

export function readTownPrefs(data: unknown): TownPrefs {
  if (typeof data !== 'object' || data === null) return defaultTownPrefs();
  const d = data as Record<string, unknown>;
  return { version: 1, lockPreview: d.lockPreview === true };
}

export function readTownLog(data: unknown): TownLog {
  if (typeof data !== 'object' || data === null) return { version: 1, visits: [] };
  const list = (data as Record<string, unknown>).visits;
  if (!Array.isArray(list)) return { version: 1, visits: [] };
  const visits: TownVisit[] = [];
  for (const v of list) {
    if (typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    visits.push({
      startMs: num(r.startMs),
      lastMs: num(r.lastMs),
      drags: num(r.drags),
      dragMs: num(r.dragMs),
      buildingTaps: counts(r.buildingTaps),
      quickTaps: counts(r.quickTaps),
      guestTaps: num(r.guestTaps),
      went: typeof r.went === 'string' ? r.went : null,
      via: r.via === 'map' || r.via === 'quick' ? r.via : null,
    });
  }
  return { version: 1, visits: visits.slice(-TOWN_VISIT_LIMIT) };
}

export interface TownStore {
  loadPrefs(): Promise<TownPrefs>;
  savePrefs(p: TownPrefs): Promise<boolean>;
  loadLog(): Promise<TownLog>;
  saveLog(l: TownLog): Promise<boolean>;
}

export function townStoreOn(store: SaveStore): TownStore {
  const parse = async (key: string): Promise<unknown> => {
    const raw = await store.load(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };
  return {
    loadPrefs: async () => readTownPrefs(await parse(TOWN_PREFS_KEY)),
    savePrefs: (p) => store.save(TOWN_PREFS_KEY, JSON.stringify(p)),
    loadLog: async () => readTownLog(await parse(TOWN_LOG_KEY)),
    saveLog: (l) => store.save(TOWN_LOG_KEY, JSON.stringify({ version: 1, visits: l.visits.slice(-TOWN_VISIT_LIMIT) })),
  };
}

export const townStore: TownStore = townStoreOn(webStore);

/** Play log totals (the 실험 panel). */
export interface TownSummary {
  visits: number;
  /** Visits where the map was dragged at all, and the drags in all. */
  dragged: number;
  drags: number;
  /** One drag's mean length (ms): all the drag time over all the drags (17장의 15번 '한 번 끈 시간'). */
  meanDragMs: number;
  /** Drag time per visit (ms), counting the visits that never dragged. */
  dragMsPerVisit: number;
  buildingTaps: number;
  quickTaps: number;
  guestTaps: number;
  /** Visits that left for a screen by a building, by a quick entry, or did not leave (only looked). */
  viaMap: number;
  viaQuick: number;
  onlyLooked: number;
}

export function summarizeTown(visits: readonly TownVisit[]): TownSummary {
  const sum = (f: (v: TownVisit) => number) => visits.reduce((s, v) => s + f(v), 0);
  const total = (r: Record<string, number>) => Object.values(r).reduce((s, n) => s + n, 0);
  const drags = sum((v) => v.drags);
  const dragMs = sum((v) => v.dragMs);
  return {
    visits: visits.length,
    dragged: visits.filter((v) => v.drags > 0).length,
    drags,
    meanDragMs: drags === 0 ? 0 : dragMs / drags,
    dragMsPerVisit: visits.length === 0 ? 0 : dragMs / visits.length,
    buildingTaps: sum((v) => total(v.buildingTaps)),
    quickTaps: sum((v) => total(v.quickTaps)),
    guestTaps: sum((v) => v.guestTaps),
    viaMap: visits.filter((v) => v.via === 'map').length,
    viaQuick: visits.filter((v) => v.via === 'quick').length,
    onlyLooked: visits.filter((v) => v.went === null && (v.drags > 0 || total(v.buildingTaps) > 0)).length,
  };
}
