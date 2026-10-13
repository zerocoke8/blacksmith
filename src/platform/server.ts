// 서버 흉내 (기획서 6.8, 8.3, 13장, 15장의 2번; CLAUDE.md 규칙 4·5): the one module server calls will go
// through. Today there is no server, so this stands in for it on the device: it hands out the
// player's seed and battle seeds (시드는 서버가 준다, B.16; one per challenge, see BattleUse), counts the lumps that came in while away
// (방치 보상, 서버가 최고 스테이지에 비례해 준다) and says what day it is (일일 보스의 날).
// The counting itself is the sim's pure functions (src/sim/refine/idle.ts, src/sim/daily), so the
// real server can run the same code. Its own state is kept through platform/storage.ts.
// A stand-in on the device can be fooled (a clock set forward); the real one will not be (3.5).

import { dayOfMinute } from '../sim/daily/daily.ts';
import { type IdleClock, idleGain, newIdleClock } from '../sim/refine/idle.ts';
import { type Clock, systemClock } from './clock.ts';
import { type SaveStore, webStore } from './storage.ts';

const KEY = 'server.mock';
const VERSION = 1;
const MINUTE_MS = 60_000;

interface MockState {
  version: number;
  /** The player's seed (정제, 제작). */
  seed: number;
  /** Battle seeds handed out so far (a log: the seed itself comes from the challenge it is for). */
  battles: number;
  idle: IdleClock;
}

/**
 * What a battle seed is for: one challenge, named by the save's own count (15장의 2번 추천 '시드를
 * 내준 것 = 도전 한 번'). The same challenge always gets the same seed, so asking again cannot buy
 * a luckier one (seed shopping); only a new challenge (the next 도전 번호, which the save records)
 * gets a new seed. The real server will also check the number against its own record.
 */
export type BattleUse =
  | { kind: 'stage'; floor: number; attempt: number }
  | { kind: 'daily'; day: number; stage: number; attempt: number };

export interface IdleClaim {
  gained: number;
  band: number;
  capped: boolean;
}

export interface ServerMock {
  /** The player's seed (서버가 준다). The same every call. */
  playerSeed(): Promise<number>;
  /** The seed of one challenge (다음 층, 일일 보스): the same for the same challenge. */
  battleSeed(use: BattleUse): Promise<number>;
  /**
   * Lumps that came in since the last claim, at the best floor's rate and band (6.8, 7.1). Claim with
   * the floor that held before a new best floor is recorded (6.7, B.18): the time gone by keeps its value.
   */
  claimIdleLumps(bestFloor: number): Promise<IdleClaim>;
  /** The server's day number (8.1: 날이 바뀌는 시각은 [미정], 0시 UTC for now). */
  today(): number;
}

function freshSeed(): number {
  // A device stand-in only: the real seed comes from the server. Not the sim's randomness.
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.getRandomValues === 'function') return c.getRandomValues(new Uint32Array(1))[0] as number;
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** A 32-bit mix of (seed, n) for battle seeds. */
function mix(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function readState(text: string | null): MockState | null {
  if (text === null) return null;
  try {
    const v = JSON.parse(text) as Partial<MockState> | null;
    if (v === null || v.version !== VERSION) return null;
    if (typeof v.seed !== 'number' || typeof v.battles !== 'number' || typeof v.idle !== 'object' || v.idle === null) return null;
    if (typeof v.idle.at !== 'number' || typeof v.idle.carry !== 'number') return null;
    return { version: VERSION, seed: v.seed >>> 0, battles: Math.max(0, Math.floor(v.battles)), idle: { at: v.idle.at, carry: v.idle.carry } };
  } catch {
    return null;
  }
}

export function makeServerMock(opts: { store?: SaveStore; clock?: Clock; seed?: number } = {}): ServerMock {
  const store = opts.store ?? webStore;
  const clock = opts.clock ?? systemClock;
  const minute = (): number => Math.floor(clock.nowMs() / MINUTE_MS);
  let cache: MockState | null = null;

  const load = async (): Promise<MockState> => {
    if (cache !== null) return cache;
    const saved = readState(await store.load(KEY));
    cache = saved ?? { version: VERSION, seed: (opts.seed ?? freshSeed()) >>> 0, battles: 0, idle: newIdleClock(minute()) };
    if (saved === null) await store.save(KEY, JSON.stringify(cache));
    return cache;
  };

  const put = async (next: MockState): Promise<void> => {
    cache = next;
    await store.save(KEY, JSON.stringify(next));
  };

  return {
    async playerSeed() {
      return (await load()).seed;
    },
    async battleSeed(use) {
      const s = await load();
      await put({ ...s, battles: s.battles + 1 });
      const parts = use.kind === 'stage' ? [1, use.floor, use.attempt] : [2, use.day, use.stage, use.attempt];
      return parts.reduce((h, n) => mix(h, Math.floor(n) >>> 0), s.seed >>> 0);
    },
    async claimIdleLumps(bestFloor) {
      const s = await load();
      const r = idleGain(s.idle, minute(), bestFloor);
      if (r.clock !== s.idle) await put({ ...s, idle: r.clock });
      return { gained: r.gained, band: r.band, capped: r.capped };
    },
    today() {
      return dayOfMinute(minute());
    },
  };
}
