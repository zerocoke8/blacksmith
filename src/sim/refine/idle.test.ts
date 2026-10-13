import { describe, expect, it } from 'vitest';
import {
  bandAmount,
  idleLumpCap,
  idleLumpsPerHour,
  lumpBandOf,
  REFINE_BAND_VALUE,
  REFINE_LUMPS,
  REFINE_TABLE,
} from '../data/refine.ts';
import { addExp, newLevelState } from '../hero/level.ts';
import {
  accrue,
  bagTotals,
  hitOnce,
  idleGain,
  isExpDrop,
  lumpsByBand,
  newIdleClock,
  newRefineState,
  pileLots,
  receiveLumps,
  type RefineDrop,
  type RefineState,
  refineExp,
  refineView,
  restoreRefine,
  rollRefine,
  serializeRefine,
} from './index.ts';

const SEED = 20261014;

describe('경험치 in the result table (7.3, 5.3)', () => {
  it('is a common row that took 15 of gold\'s 25', () => {
    const exp = REFINE_TABLE.find((r) => r.id === 'exp');
    const gold = REFINE_TABLE.find((r) => r.id === 'gold');
    expect(exp).toMatchObject({ kind: 'exp', rarity: 'common', weight: 15 });
    expect(gold?.weight).toBe(10);
  });

  it('never goes into the bag; it is for the shared level', () => {
    let s: RefineState = { ...newRefineState(0), lumps: 500 };
    const drops: RefineDrop[] = [];
    for (let i = 0; i < 300; i++) {
      const r = hitOnce(s, SEED, 1);
      if (r === null) break;
      s = r.state;
      drops.push(r.drop);
    }
    const exp = drops.filter(isExpDrop);
    expect(exp.length).toBeGreaterThan(20);
    expect(s.bag.exp).toBeUndefined();
    const nonExp = drops.filter((d) => !isExpDrop(d)).reduce((n, d) => n + d.amount, 0);
    const t = bagTotals(s.bag);
    expect(t.gold + t.items).toBe(nonExp);
    expect(refineView(s, 1).bag.some((l) => l.id === 'exp')).toBe(false);
    const total = refineExp(drops);
    expect(total).toBe(exp.reduce((n, d) => n + d.amount, 0));
    expect(addExp(newLevelState(), total).levelsUp).toBeGreaterThan(0);
  });
});

describe('bands: what a lump is worth (7.1)', () => {
  it('scales 경험치 and 골드 by band, not ores and gifts, and keeps the row and roll', () => {
    expect(bandAmount('exp', 10, 1)).toBe(10);
    expect(bandAmount('exp', 10, 3)).toBe(Math.round(10 * REFINE_BAND_VALUE * REFINE_BAND_VALUE));
    expect(bandAmount('ore', 1, 5)).toBe(1);
    for (let n = 1; n <= 300; n++) {
      const a = rollRefine(SEED, n, 2, 1);
      const b = rollRefine(SEED, n, 2, 4);
      expect(b.item).toBe(a.item);
      expect(b.band).toBe(4);
      if (a.item === 'exp' || a.item === 'gold') expect(b.base).toBeGreaterThan(a.base);
      else expect(b.base).toBe(a.base);
    }
  });

  it('tags lumps with the best floor\'s band and strikes the oldest first', () => {
    expect(lumpBandOf(0)).toBe(1);
    expect(lumpBandOf(10)).toBe(1);
    expect(lumpBandOf(11)).toBe(2);
    let s = receiveLumps(newRefineState(0), 3, 1);
    s = receiveLumps(s, 4, 2);
    expect(pileLots(s)).toEqual([
      { band: 1, count: 3 },
      { band: 2, count: 4 },
    ]);
    const bands: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = hitOnce(s, SEED, 2);
      if (r === null) break;
      s = r.state;
      bands.push(r.drop.band);
    }
    // 2 lumps of band 1, then a blow straddling (worth the first lump: band 1), then band 2.
    expect(bands).toEqual([1, 1, 2]);
    expect(s.lumps).toBe(1);
    expect(lumpsByBand(s)).toEqual([{ band: 2, count: 1 }]);
  });

  it('treats lumps no lot covers as band 1 (an old save, a lab button)', () => {
    const old: RefineState = { lumps: 5, refineNo: 0, bag: {}, accruedAt: 0 };
    expect(pileLots(old)).toEqual([{ band: 1, count: 5 }]);
    const mixed: RefineState = { ...old, lumps: 7, lots: [{ band: 3, count: 4 }] };
    expect(pileLots(mixed)).toEqual([
      { band: 1, count: 3 },
      { band: 3, count: 4 },
    ]);
    const trimmed: RefineState = { ...old, lumps: 2, lots: [{ band: 3, count: 4 }] };
    expect(pileLots(trimmed)).toEqual([{ band: 3, count: 2 }]);
  });
});

describe('idle lumps by the best floor (6.8, 7.1)', () => {
  it('is the v0.8 60 an hour and 720 at floor 0, a little more higher up (수는 천천히)', () => {
    expect(idleLumpsPerHour(0)).toBe(60);
    expect(idleLumpCap(0)).toBe(REFINE_LUMPS.cap);
    expect(idleLumpsPerHour(100)).toBe(110);
    expect(idleLumpCap(100)).toBe(110 * 12);
    for (let f = 1; f < 200; f++) expect(idleLumpsPerHour(f)).toBeGreaterThanOrEqual(idleLumpsPerHour(f - 1));
  });

  it('counts the pile at the floor\'s rate with the band attached, in steps or at once', () => {
    const r = accrue(newRefineState(0), 60, 40);
    expect(r.gained).toBe(80);
    expect(lumpsByBand(r.state)).toEqual([{ band: 4, count: 80 }]);
    let s = newRefineState(0);
    let total = 0;
    for (const t of [1, 2, 7, 33, 34, 59, 60, 61, 200]) {
      const step = accrue(s, t, 37);
      total += step.gained;
      s = step.state;
    }
    const once = accrue(newRefineState(0), 200, 37);
    expect(s).toEqual(once.state);
    expect(total).toBe(once.gained);
    expect(once.state.lumps).toBe(Math.floor((200 * idleLumpsPerHour(37)) / 60));
  });

  it('server count: offline cap, time past it thrown away, a clock behind adds nothing', () => {
    const c = newIdleClock(1000);
    const a = idleGain(c, 1060, 0);
    expect(a).toMatchObject({ gained: 60, band: 1, capped: false });
    const far = idleGain(c, 1000 + 48 * 60, 20);
    expect(far).toMatchObject({ gained: idleLumpCap(20), band: 2, capped: true });
    expect(idleGain(far.clock, 1000, 20)).toMatchObject({ gained: 0 });
    // Path independent below the cap.
    let k = c;
    let sum = 0;
    for (const t of [1001, 1013, 1100, 1177, 1300]) {
      const g = idleGain(k, t, 55);
      sum += g.gained;
      k = g.clock;
    }
    expect(sum).toBe(idleGain(c, 1300, 55).gained);
    expect(k).toEqual(idleGain(c, 1300, 55).clock);
  });

  it('saves lots and carry and restores them', () => {
    const s = accrue(receiveLumps(newRefineState(0), 3, 2), 7, 41).state;
    const back = restoreRefine(JSON.parse(serializeRefine(s)));
    expect(back).toEqual(s);
    expect(back?.carry).toBe(s.carry);
    expect(restoreRefine({ lumps: 1, refineNo: 0, bag: {}, accruedAt: 0, lots: [{ band: 0, count: 1 }, 'x'] })).toEqual({
      lumps: 1,
      refineNo: 0,
      bag: {},
      accruedAt: 0,
      lots: [],
    });
  });
});
