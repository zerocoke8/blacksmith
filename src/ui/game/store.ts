// 용사·스테이지·일일 보스 저장 (기획서 5장, 6장, 8장): the heroes (owned, the shared level, the weapon
// list), the stage (best floor, auto-challenge, the two formations) and the daily boss, kept through
// platform/storage.ts (CLAUDE.md 규칙 4) and shared by every screen as one small store. The rules are
// the sim's; this file only loads, keeps and saves their plain JSON. Seeds and the day come from the
// server stand-in (platform/server.ts, 사용자 결정 5 '시드는 서버가 준다').
// Level news: every time experience goes in (refining, the 실험 panel) the store notes what changed,
// and whichever screen shows the level bar says it at the top ('경험치 +n', '레벨 업!', 사용자 결정 2).
// A part it cannot read (broken JSON, a version it does not know, a bad field) is kept aside as
// '<key>.broken' before the prototype's starts over it (as the refine save does, 7.5): owned heroes,
// the level, the weapons and the best floor are never thrown away unseen. Each part's restore runs
// its migration first (sim/*/save.ts), where a version going up turns the old shape into the new.

import { makeServerMock, type ServerMock } from '../../platform/server.ts';
import { type SaveStore, webStore } from '../../platform/storage.ts';
import { type DailyState, newDailyState, restoreDaily, rollDailyTo, serializeDaily } from '../../sim/daily/index.ts';
import type { Weapon } from '../../sim/core/types.ts';
import {
  addExp,
  addWeapon,
  findWeapon,
  type HeroesState,
  type LevelState,
  restoreHeroes,
  serializeHeroes,
  updateWeapon,
  weaponItemOf,
} from '../../sim/hero/index.ts';
import { restoreStage, serializeStage, type StageState } from '../../sim/stage/index.ts';
import { prototypeHeroes, prototypeStage } from './start.ts';

export const HEROES_KEY = 'heroes.save';
export const STAGE_KEY = 'stage.save';
export const DAILY_KEY = 'daily.save';

/** Where an unreadable part is kept aside. */
export function brokenKey(key: string): string {
  return `${key}.broken`;
}

export interface GameState {
  heroes: HeroesState;
  stage: StageState;
  daily: DailyState;
}

/** What the last experience did (the top banner). */
export interface LevelNews {
  key: number;
  gained: number;
  levelsUp: number;
  level: number;
}

function parse<T>(raw: string | null, restore: (v: unknown) => T | null): T | null {
  if (raw === null) return null;
  try {
    return restore(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export interface GameStore {
  /** Loads once (later calls get the same state); a missing or broken part starts as the prototype's. */
  load(): Promise<GameState>;
  /** The state, or null before it loaded. */
  get(): GameState | null;
  subscribe(listener: () => void): () => void;
  setHeroes(next: HeroesState): void;
  setStage(next: StageState): void;
  setDaily(next: DailyState): void;
  /** Experience into the shared level (5.3): refining calls this. Returns what changed. */
  addExp(n: number): Promise<LevelNews | null>;
  /**
   * A finished craft's weapon into the heroes' weapon list (4.11, 사용자 결정 1): added once, and
   * updated when its 속성 칸 or slots are filled on the result screen (its 강화 kept).
   */
  stockWeapon(w: Weapon): Promise<void>;
  /** The level news since a screen last showed it (the screen marks it seen). */
  news(): LevelNews | null;
  markNewsSeen(key: number): void;
  /** The level the map last showed (memory): the map tells a rise since. */
  levelSeen(): LevelState | null;
  setLevelSeen(level: LevelState): void;
  /** The day as the server says it; rolls the daily state to it. */
  today(): number;
  readonly server: ServerMock;
}

export function makeGameStore(store: SaveStore, server: ServerMock): GameStore {
  let state: GameState | null = null;
  let loading: Promise<GameState> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  let news: LevelNews | null = null;
  let newsKey = 0;
  let seen: LevelState | null = null;
  // Writes go out in the order they were made.
  let queue: Promise<unknown> = Promise.resolve();
  const write = (key: string, text: string) => {
    queue = queue.then(() => store.save(key, text)).catch(() => undefined);
  };

  const api: GameStore = {
    server,
    load() {
      if (state !== null) return Promise.resolve(state);
      if (loading !== null) return loading;
      loading = (async () => {
        const [h, s, d] = await Promise.all([store.load(HEROES_KEY), store.load(STAGE_KEY), store.load(DAILY_KEY)]);
        const savedHeroes = parse(h, restoreHeroes);
        const savedStage = parse(s, restoreStage);
        const savedDaily = parse(d, restoreDaily);
        const heroes = savedHeroes ?? prototypeHeroes();
        const stage = savedStage ?? prototypeStage();
        const day = server.today();
        const daily = rollDailyTo(savedDaily ?? newDailyState(day), day);
        state = { heroes, stage, daily };
        // Unreadable: put it aside first (the writes go out in order), then start the part afresh.
        const fresh = async (key: string, raw: string | null, read: unknown, text: string) => {
          if (read !== null) return;
          if (raw !== null && (await store.load(brokenKey(key))) !== raw) write(brokenKey(key), raw);
          write(key, text);
        };
        await fresh(HEROES_KEY, h, savedHeroes, serializeHeroes(heroes));
        await fresh(STAGE_KEY, s, savedStage, serializeStage(stage));
        await fresh(DAILY_KEY, d, savedDaily, serializeDaily(daily));
        // A new day since: the rolled state goes out now (in the current version's shape).
        if (savedDaily !== null && daily !== savedDaily) write(DAILY_KEY, serializeDaily(daily));
        seen ??= heroes.level;
        emit();
        return state;
      })();
      return loading;
    },
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    setHeroes(next) {
      if (state === null) return;
      state = { ...state, heroes: next };
      write(HEROES_KEY, serializeHeroes(next));
      emit();
    },
    setStage(next) {
      if (state === null) return;
      state = { ...state, stage: next };
      write(STAGE_KEY, serializeStage(next));
      emit();
    },
    setDaily(next) {
      if (state === null) return;
      state = { ...state, daily: next };
      write(DAILY_KEY, serializeDaily(next));
      emit();
    },
    async addExp(n) {
      const s = await api.load();
      const r = addExp(s.heroes.level, n);
      if (r.gained <= 0) return null;
      newsKey += 1;
      news = { key: newsKey, gained: r.gained, levelsUp: r.levelsUp, level: r.state.level };
      api.setHeroes({ ...s.heroes, level: r.state });
      return news;
    },
    async stockWeapon(w) {
      const s = await api.load();
      const had = findWeapon(s.heroes.armory, w.id);
      const item = weaponItemOf(w, had?.enhance ?? 0);
      if (had !== null && JSON.stringify(had) === JSON.stringify(item)) return;
      const armory = had !== null ? updateWeapon(s.heroes.armory, item) : addWeapon(s.heroes.armory, item);
      api.setHeroes({ ...s.heroes, armory });
    },
    news: () => news,
    markNewsSeen(key) {
      if (news !== null && news.key === key) news = null;
    },
    levelSeen: () => seen,
    setLevelSeen(level) {
      seen = level;
    },
    today() {
      const day = server.today();
      if (state !== null && day > state.daily.day) api.setDaily(rollDailyTo(state.daily, day));
      return day;
    },
  };
  return api;
}

/** The app's game store (localStorage today, the native store after Capacitor). */
export const gameStore: GameStore = makeGameStore(webStore, makeServerMock());
