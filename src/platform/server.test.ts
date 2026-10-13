import { describe, expect, it } from 'vitest';
import { idleLumpCap, idleLumpsPerHour } from '../sim/data/refine.ts';
import { manualClock } from './clock.ts';
import { makeServerMock } from './server.ts';
import { memoryStore } from './storage.ts';

const MIN = 60_000;

describe('server stand-in (13장, 6.8)', () => {
  it('keeps one player seed and gives each challenge its own battle seed (no seed shopping)', async () => {
    const store = memoryStore();
    const a = makeServerMock({ store, clock: manualClock(0), seed: 42 });
    expect(await a.playerSeed()).toBe(42);
    const b1 = await a.battleSeed({ kind: 'stage', floor: 10, attempt: 3 });
    // Asking again for the same challenge gives the same seed: a retry needs the next 도전 번호.
    expect(await a.battleSeed({ kind: 'stage', floor: 10, attempt: 3 })).toBe(b1);
    const b2 = await a.battleSeed({ kind: 'stage', floor: 10, attempt: 4 });
    expect(b2).not.toBe(b1);
    const d1 = await a.battleSeed({ kind: 'daily', day: 3, stage: 2, attempt: 1 });
    expect(d1).not.toBe(await a.battleSeed({ kind: 'daily', day: 3, stage: 2, attempt: 2 }));
    expect(d1).not.toBe(await a.battleSeed({ kind: 'daily', day: 4, stage: 2, attempt: 1 }));
    // Another session on the same storage keeps the player's seed, so the same challenge's seed.
    const again = makeServerMock({ store, clock: manualClock(0), seed: 7 });
    expect(await again.playerSeed()).toBe(42);
    expect(await again.battleSeed({ kind: 'stage', floor: 10, attempt: 3 })).toBe(b1);
  });

  it('counts the lumps while away at the best floor\'s rate, up to the offline cap', async () => {
    const clock = manualClock(1_000 * MIN);
    const server = makeServerMock({ store: memoryStore(), clock, seed: 1 });
    await server.playerSeed();
    clock.advance(60 * MIN);
    expect(await server.claimIdleLumps(30)).toEqual({ gained: idleLumpsPerHour(30), band: 3, capped: false });
    expect(await server.claimIdleLumps(30)).toEqual({ gained: 0, band: 3, capped: false });
    clock.advance(3 * 24 * 60 * MIN);
    expect(await server.claimIdleLumps(30)).toEqual({ gained: idleLumpCap(30), band: 3, capped: true });
  });

  it('says what day it is', () => {
    const clock = manualClock(0);
    const server = makeServerMock({ store: memoryStore(), clock, seed: 1 });
    const d = server.today();
    clock.advance(24 * 60 * MIN);
    expect(server.today()).toBe(d + 1);
  });
});
