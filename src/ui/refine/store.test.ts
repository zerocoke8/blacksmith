import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../platform/storage.ts';
import { REFINE_LUMPS } from '../../sim/data/refine.ts';
import { hitOnce } from '../../sim/refine/index.ts';
import {
  newRefineSave,
  newVisit,
  peekRefine,
  PROTOTYPE_FIRST_AWAY_MIN,
  readRefineSave,
  REFINE_SAVE_BROKEN_KEY,
  REFINE_SAVE_KEY,
  refineSaves,
  summarizeVisits,
  VISIT_LIMIT,
  visitsJson,
  worldMinute,
} from './store.ts';

const MIN = 60_000;

describe('refine save', () => {
  it('starts with the first visit’s pile waiting', async () => {
    const saves = refineSaves(memoryStore());
    const now = 1_000_000 * MIN;
    expect(await saves.load()).toBeNull();
    const peek = await peekRefine(now, saves);
    expect(peek).toEqual({ lumps: PROTOTYPE_FIRST_AWAY_MIN, gained: PROTOTYPE_FIRST_AWAY_MIN, full: false });
  });

  it('round-trips through the store, and peeking writes nothing', async () => {
    const store = memoryStore();
    const saves = refineSaves(store);
    const now = worldMinute(5_000_000 * MIN);
    const base = newRefineSave(now, 77);
    const hit = hitOnce({ ...base.state, lumps: 50 }, base.seed, 5);
    expect(hit).not.toBeNull();
    const save = { ...base, state: hit?.state ?? base.state, mult: 10 as const, firstSeen: true, visits: [newVisit(1, base.state, 3, false)] };
    expect(await saves.save(save)).toBe(true);
    expect(await saves.load()).toEqual(save);
    const before = await store.load(REFINE_SAVE_KEY);
    const peek = await peekRefine((now + 30) * MIN, saves);
    // The first visit's three hours, and the half hour since.
    expect(peek.gained).toBe(PROTOTYPE_FIRST_AWAY_MIN + 30);
    expect(await store.load(REFINE_SAVE_KEY)).toBe(before);
    await saves.clear();
    expect(await saves.load()).toBeNull();
  });

  it('reads a broken save as none, and repairs what it can', () => {
    expect(readRefineSave(null)).toBeNull();
    expect(readRefineSave({ version: 2 })).toBeNull();
    expect(readRefineSave({ version: 1, seed: 3, state: { lumps: 'x' } })).toBeNull();
    const ok = readRefineSave({
      version: 1,
      seed: -1,
      state: { lumps: 5, refineNo: 2, bag: { gold: 30 }, accruedAt: 10 },
      mult: 3,
      visits: [null, { blows: 4, byMult: { '1': 4, '3': 9 } }, ...Array.from({ length: VISIT_LIMIT + 5 }, () => ({}))],
    });
    expect(ok?.mult).toBe(1);
    expect(ok?.seed).toBe(0xffffffff);
    expect(ok?.visits.length).toBe(VISIT_LIMIT);
  });

  it('puts an unreadable save aside before a fresh one replaces it', async () => {
    const store = memoryStore();
    const saves = refineSaves(store);
    const later = JSON.stringify({ ...newRefineSave(100, 5), version: 2 });
    await store.save(REFINE_SAVE_KEY, later);
    expect(await saves.load()).toBeNull();
    expect(await store.load(REFINE_SAVE_BROKEN_KEY)).toBe(later);
    // Broken JSON too; a readable save leaves the kept one alone.
    await store.save(REFINE_SAVE_KEY, '{"version":1,');
    expect(await saves.load()).toBeNull();
    expect(await store.load(REFINE_SAVE_BROKEN_KEY)).toBe('{"version":1,');
    const ok = newRefineSave(100, 6);
    await saves.save(ok);
    expect(await saves.load()).toEqual(ok);
    expect(await store.load(REFINE_SAVE_BROKEN_KEY)).toBe('{"version":1,');
  });

  it('notes a full pile on the hammer button', async () => {
    const saves = refineSaves(memoryStore());
    const now = 9_000_000;
    await saves.save(newRefineSave(now - 2 * REFINE_LUMPS.cap, 1));
    expect(await peekRefine(now * MIN, saves)).toMatchObject({ lumps: REFINE_LUMPS.cap, full: true });
  });

  it('sums the play log', () => {
    const a = { ...newVisit(0, newRefineSave(0, 1).state, 0, true), taps: 2, holds: 1, blows: 17, byMult: { '1': 7, '10': 10 }, multChanges: 2 };
    const b = { ...newVisit(0, newRefineSave(0, 1).state, 0, false), emptyPresses: 3, haptics: false, blows: 1, byMult: { '10': 1 } };
    const s = summarizeVisits([a, b]);
    expect(s).toMatchObject({ visits: 2, blows: 18, taps: 2, holds: 1, multChanges: 2, emptyPresses: 3, fullArrivals: 1, hapticsOff: 1, soundOff: 0 });
    expect(summarizeVisits([{ ...a, sound: false, firmHaptics: true }])).toMatchObject({ soundOff: 1, hapticsFirm: 1 });
    // An older log (before the sound switch) reads as sound on, vibration light.
    const old = readRefineSave({ version: 1, seed: 1, state: newRefineSave(0, 1).state, visits: [{ blows: 2 }] });
    expect(old?.visits[0]).toMatchObject({ sound: true, firmHaptics: false, haptics: true });
    expect(s.byMult).toEqual({ '1': 7, '10': 11 });
    const json = JSON.parse(visitsJson({ ...newRefineSave(0, 9), visits: [a] })) as { 시드: number; 방문: unknown[] };
    expect(json.시드).toBe(9);
    expect(json.방문.length).toBe(1);
  });
});
