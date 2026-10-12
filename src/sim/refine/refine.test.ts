import { describe, expect, it } from 'vitest';
import {
  RARITY_LABEL,
  REFINE_BATCH_MAX,
  REFINE_ITEM_IDS,
  REFINE_LUMPS,
  REFINE_LUMPS_PER_HOUR,
  REFINE_MULTS,
  REFINE_TABLE,
  REFINE_TEMPO,
  type RefineMult,
} from '../data/refine.ts';
import {
  accrue,
  bagTotals,
  batchFull,
  effectiveMult,
  hitInBatch,
  hitOnce,
  hitsLeft,
  holdIntervalMs,
  newBatch,
  newRefineState,
  nextLumpAt,
  nextMult,
  rarityOdds,
  type RefineBatch,
  type RefineDrop,
  type RefineState,
  refineOdds,
  refineView,
  restoreRefine,
  rollRefine,
  serializeRefine,
} from './index.ts';

const SEED = 20261013;

function withLumps(lumps: number, at = 0): RefineState {
  return { ...newRefineState(at), lumps };
}

/** Strike n times at ×mult (stepping down when short), as a held hammer would, batch after batch. */
function strike(state: RefineState, seed: number, mults: readonly RefineMult[]): { state: RefineState; drops: RefineDrop[] } {
  let s = state;
  const drops: RefineDrop[] = [];
  let batch: RefineBatch = newBatch();
  for (const m of mults) {
    if (batchFull(batch)) batch = newBatch();
    const r = hitInBatch(s, batch, seed, m);
    if (r === null) break;
    s = r.state;
    batch = r.batch;
    drops.push(r.drop);
  }
  return { state: s, drops };
}

describe('data (기획서 10.1)', () => {
  it('has the doc table: weights sum to 100, rarities 65/21/13/1', () => {
    expect(REFINE_TABLE.reduce((s, r) => s + r.weight, 0)).toBe(100);
    const r = rarityOdds();
    expect(r.common).toBeCloseTo(0.65, 10);
    expect(r.uncommon).toBeCloseTo(0.21, 10);
    expect(r.rare).toBeCloseTo(0.13, 10);
    expect(r.veryRare).toBeCloseTo(0.01, 10);
    expect(RARITY_LABEL.veryRare).toBe('아주 귀함');
  });

  it('names the ores after the main materials', () => {
    const names = Object.fromEntries(REFINE_TABLE.map((r) => [r.id, r.name]));
    expect(names).toMatchObject({
      ironOre: '철광석',
      steelIngot: '강철 덩이',
      mithrilOre: '미스릴 원석',
      orichalcumOre: '오리할콘 원석',
      adamantOre: '아다만 원석',
      gold: '골드',
      wildflowers: '들꽃 다발',
      honeyCake: '꿀 과자',
      shinyPebble: '반짝 조약돌',
      knitGloves: '손뜨개 장갑',
    });
    expect(new Set(REFINE_ITEM_IDS).size).toBe(REFINE_TABLE.length);
  });

  it('has the doc numbers for lumps, multipliers, batches and tempo', () => {
    expect(REFINE_LUMPS_PER_HOUR).toBe(60);
    expect(REFINE_LUMPS.cap).toBe(720);
    expect([...REFINE_MULTS]).toEqual([1, 2, 5, 10, 20]);
    expect(REFINE_BATCH_MAX).toBe(15);
    expect(REFINE_TEMPO.firstMs).toBe(220);
    expect(REFINE_TEMPO.minMs).toBe(110);
    const gold = REFINE_TABLE.find((r) => r.id === 'gold');
    expect([gold?.min, gold?.max]).toEqual([5, 15]);
  });
});

describe('lumps piling up', () => {
  it('adds one a minute, 60 an hour', () => {
    const r = accrue(newRefineState(1000), 1060);
    expect(r.gained).toBe(60);
    expect(r.state.lumps).toBe(60);
    expect(r.state.accruedAt).toBe(1060);
    expect(nextLumpAt(r.state)).toBe(1061);
  });

  it('stops at the cap and throws away the time while full', () => {
    const r = accrue(newRefineState(0), 24 * 60);
    expect(r.gained).toBe(720);
    expect(r.state.lumps).toBe(720);
    expect(r.state.accruedAt).toBe(24 * 60);
    expect(nextLumpAt(r.state)).toBeNull();
    // Struck down to 700 an hour later, it fills again from the strike, not from the full hours.
    const full = accrue(r.state, 25 * 60).state;
    expect(full.accruedAt).toBe(25 * 60);
    const after = accrue({ ...full, lumps: 700 }, 25 * 60 + 5);
    expect(after.gained).toBe(5);
  });

  it('keeps a part-minute and never counts a minute twice', () => {
    const s = newRefineState(10);
    const a = accrue(s, 10.9);
    expect(a.gained).toBe(0);
    const b = accrue(a.state, 11.2);
    expect(b.gained).toBe(1);
    expect(b.state.accruedAt).toBe(11);
  });

  it('adds nothing and moves nothing when the clock goes back', () => {
    const s = accrue(newRefineState(500), 600).state;
    const back = accrue(s, 400);
    expect(back.gained).toBe(0);
    expect(back.state).toBe(s);
    expect(back.state.lumps).toBe(100);
    // Once the clock is past the counted minute again, it goes on from there.
    expect(accrue(back.state, 610).gained).toBe(10);
    expect(accrue(s, Number.NaN).gained).toBe(0);
  });

  it('is the same counted in steps or at once', () => {
    let s = newRefineState(0);
    let total = 0;
    for (const t of [3, 3, 17, 90, 91, 400, 800, 801]) {
      const r = accrue(s, t);
      expect(r.gained).toBeGreaterThanOrEqual(0);
      total += r.gained;
      s = r.state;
    }
    const once = accrue(newRefineState(0), 801);
    expect(s).toEqual(once.state);
    expect(total).toBe(once.gained);
  });

  it('adds nothing over the cap when a test pile is already over it', () => {
    const r = accrue({ ...newRefineState(0), lumps: 1000 }, 60);
    expect(r.gained).toBe(0);
    expect(r.state.lumps).toBe(1000);
    expect(r.state.accruedAt).toBe(60);
  });
});

describe('one blow', () => {
  it('is decided by the seed and the 정제 번호 alone', () => {
    const a = strike(withLumps(400), SEED, Array(40).fill(5));
    const b = strike(withLumps(400), SEED, Array(40).fill(5));
    expect(a.drops).toEqual(b.drops);
    expect(a.state).toEqual(b.state);
    const c = strike(withLumps(400), SEED + 1, Array(40).fill(5));
    expect(c.drops.map((d) => d.item)).not.toEqual(a.drops.map((d) => d.item));
  });

  it('multiplies the amount only: the same item comes out at any multiplier', () => {
    for (let n = 1; n <= 200; n++) {
      const one = rollRefine(SEED, n, 1);
      for (const m of REFINE_MULTS) {
        const d = rollRefine(SEED, n, m);
        expect(d.item).toBe(one.item);
        expect(d.base).toBe(one.base);
        expect(d.amount).toBe(one.base * m);
      }
    }
  });

  it('spends mult lumps, counts the 정제 번호 and puts base × mult in the bag', () => {
    const s = withLumps(30);
    const r = hitOnce(s, SEED, 10);
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.state.lumps).toBe(20);
    expect(r.state.refineNo).toBe(1);
    expect(r.drop.refineNo).toBe(1);
    expect(r.state.bag[r.drop.item]).toBe(r.drop.amount);
    expect(r.drop.amount).toBe(r.drop.base * 10);
    // The input state is left as it was.
    expect(s.lumps).toBe(30);
    expect(s.bag).toEqual({});
  });

  it('rolls gold in 5~15 per ×1', () => {
    const golds = Array.from({ length: 2000 }, (_, i) => rollRefine(SEED, i + 1, 1)).filter((d) => d.item === 'gold');
    expect(golds.length).toBeGreaterThan(300);
    for (const g of golds) expect(g.base).toBeGreaterThanOrEqual(5);
    for (const g of golds) expect(g.base).toBeLessThanOrEqual(15);
    expect(new Set(golds.map((g) => g.base)).size).toBe(11);
  });

  it('will not strike when the pile cannot pay', () => {
    expect(hitOnce(withLumps(4), SEED, 5)).toBeNull();
    expect(hitOnce(withLumps(0), SEED, 1)).toBeNull();
    expect(hitOnce(withLumps(10), SEED, 3 as RefineMult)).toBeNull();
  });

  it('follows the table over many blows', () => {
    const n = 100_000;
    const counts = new Map<string, number>();
    for (let i = 1; i <= n; i++) {
      const d = rollRefine(SEED, i, 1);
      counts.set(d.item, (counts.get(d.item) ?? 0) + 1);
    }
    for (const line of refineOdds()) {
      const got = (counts.get(line.id) ?? 0) / n;
      // ±4 standard errors.
      const se = Math.sqrt((line.chance * (1 - line.chance)) / n);
      expect(Math.abs(got - line.chance)).toBeLessThan(4 * se + 1e-9);
    }
  });
});

describe('multipliers and batches', () => {
  it('steps the multiplier down when the pile is short', () => {
    expect(effectiveMult(100, 10)).toBe(10);
    expect(effectiveMult(7, 10)).toBe(5);
    expect(effectiveMult(1, 20)).toBe(1);
    expect(effectiveMult(0, 1)).toBeNull();
    const r = strike(withLumps(7), SEED, [10, 10, 10, 10]);
    expect(r.drops.map((d) => d.mult)).toEqual([5, 2]);
    expect(r.state.lumps).toBe(0);
  });

  it('cycles ×1 → ×2 → ×5 → ×10 → ×20 → ×1, skipping what the pile cannot pay', () => {
    expect(nextMult(1, 720)).toBe(2);
    expect(nextMult(10, 720)).toBe(20);
    expect(nextMult(20, 720)).toBe(1);
    expect(nextMult(2, 7)).toBe(5);
    expect(nextMult(5, 7)).toBe(1);
    expect(nextMult(1, 1)).toBe(1);
    expect(nextMult(10, 0)).toBe(10);
  });

  it('counts the blows the pile pays for', () => {
    expect(hitsLeft(720, 20)).toBe(36);
    expect(hitsLeft(720, 1)).toBe(720);
    expect(hitsLeft(9, 10)).toBe(0);
  });

  it('stops a batch at 15 blows', () => {
    let s = withLumps(100);
    let b = newBatch();
    for (let i = 0; i < REFINE_BATCH_MAX; i++) {
      const r = hitInBatch(s, b, SEED, 1);
      expect(r).not.toBeNull();
      if (r === null) return;
      s = r.state;
      b = r.batch;
    }
    expect(batchFull(b)).toBe(true);
    expect(hitInBatch(s, b, SEED, 1)).toBeNull();
    expect(s.lumps).toBe(100 - REFINE_BATCH_MAX);
    // The bag already holds all fifteen.
    const sum = b.drops.reduce((acc, d) => acc + d.amount, 0);
    const t = bagTotals(s.bag);
    expect(t.gold + t.items).toBe(sum);
  });

  it('speeds the held hammer from 220 ms to 110 ms, about 2 s for a batch', () => {
    expect(holdIntervalMs(1)).toBe(220);
    expect(holdIntervalMs(2)).toBe(206);
    expect(holdIntervalMs(9)).toBe(110);
    expect(holdIntervalMs(50)).toBe(110);
    let total = 0;
    for (let n = 1; n < REFINE_BATCH_MAX; n++) total += holdIntervalMs(n);
    expect(total).toBeGreaterThan(1800);
    expect(total).toBeLessThan(2300);
  });
});

describe('view', () => {
  it('shows the lowered multiplier, blows left and the bag in table order', () => {
    const s: RefineState = { lumps: 7, refineNo: 3, bag: { adamantOre: 1, ironOre: 4, gold: 30 }, accruedAt: 0 };
    const v = refineView(s, 10);
    expect(v.mult).toBe(5);
    expect(v.lowered).toBe(true);
    expect(v.hits).toBe(1);
    expect(v.canHit).toBe(true);
    expect(v.bag.map((b) => b.id)).toEqual(['ironOre', 'gold', 'adamantOre']);
    expect(v.gold).toBe(30);
    expect(v.items).toBe(5);
    expect(refineView(withLumps(0), 1)).toMatchObject({ canHit: false, mult: null, hits: 0, full: false });
    expect(refineView(withLumps(720), 20)).toMatchObject({ full: true, nextLumpAt: null, hits: 36 });
  });
});

describe('save', () => {
  it('round-trips through JSON', () => {
    const r = strike(accrue(newRefineState(100), 400).state, SEED, Array(30).fill(2));
    const back = restoreRefine(JSON.parse(serializeRefine(r.state)));
    expect(back).toEqual(r.state);
    // The restored state strikes on exactly as the original would.
    const a = strike(r.state, SEED, [5, 5, 5]);
    const b = back === null ? null : strike(back, SEED, [5, 5, 5]);
    expect(b?.drops).toEqual(a.drops);
  });

  it('rejects a broken save and drops unknown items', () => {
    expect(restoreRefine(null)).toBeNull();
    expect(restoreRefine({ lumps: -1, refineNo: 0, bag: {}, accruedAt: 0 })).toBeNull();
    expect(restoreRefine({ lumps: 1, refineNo: 0.5, bag: {}, accruedAt: 0 })).toBeNull();
    expect(restoreRefine({ lumps: 1, refineNo: 0, bag: [], accruedAt: 0 })).toBeNull();
    expect(restoreRefine({ lumps: 1, refineNo: 0, bag: {}, accruedAt: '0' })).toBeNull();
    expect(restoreRefine({ lumps: 3, refineNo: 2, bag: { ironOre: 2, dragonScale: 4, gold: -5, steelIngot: 0 }, accruedAt: 9 })).toEqual({
      lumps: 3,
      refineNo: 2,
      bag: { ironOre: 2 },
      accruedAt: 9,
    });
  });
});
