import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../platform/storage.ts';
import { lockedLine, topic } from './text.ts';
import { newTownVisit, readTownLog, readTownPrefs, summarizeTown, TOWN_VISIT_LIMIT, townStoreOn } from './store.ts';

describe('town saves', () => {
  it('round-trips the switches and the play log through the store', async () => {
    const s = townStoreOn(memoryStore());
    expect(await s.loadPrefs()).toEqual({ version: 1, lockPreview: false });
    await s.savePrefs({ version: 1, lockPreview: true });
    expect((await s.loadPrefs()).lockPreview).toBe(true);
    const v = { ...newTownVisit(5), drags: 2, dragMs: 900, buildingTaps: { forge: 1 }, went: 'cards', via: 'map' as const };
    await s.saveLog({ version: 1, visits: [v] });
    expect((await s.loadLog()).visits).toEqual([v]);
  });

  it('reads broken data as empty, and repairs what it can', () => {
    expect(readTownPrefs('x')).toEqual({ version: 1, lockPreview: false });
    expect(readTownLog(null).visits).toEqual([]);
    expect(readTownLog({ visits: 'no' }).visits).toEqual([]);
    const r = readTownLog({ visits: [{ drags: -3, dragMs: 'x', buildingTaps: { forge: 2, bad: 'y' }, via: 'teleport' }, 7] });
    expect(r.visits).toHaveLength(1);
    expect(r.visits[0]).toMatchObject({ drags: 0, dragMs: 0, buildingTaps: { forge: 2 }, via: null, went: null });
    const many = readTownLog({ visits: Array.from({ length: TOWN_VISIT_LIMIT + 9 }, (_, i) => ({ startMs: i })) });
    expect(many.visits).toHaveLength(TOWN_VISIT_LIMIT);
    expect(many.visits[0]?.startMs).toBe(9);
  });

  it('sums the play log (17장의 15·16번)', () => {
    const a = { ...newTownVisit(0), drags: 3, dragMs: 3000, buildingTaps: { forge: 1, shop: 2 }, went: 'cards', via: 'map' as const };
    const b = { ...newTownVisit(1), quickTaps: { refine: 1 }, went: 'refine', via: 'quick' as const };
    const c = { ...newTownVisit(2), drags: 1, dragMs: 500, guestTaps: 2 };
    const s = summarizeTown([a, b, c]);
    expect(s).toMatchObject({ visits: 3, dragged: 2, buildingTaps: 3, quickTaps: 1, guestTaps: 2, viaMap: 1, viaQuick: 1, onlyLooked: 1 });
    // Four drags in 3.5 s: one drag is 875 ms on average; per visit (one never dragged) 3500 / 3.
    expect(s.drags).toBe(4);
    expect(s.meanDragMs).toBeCloseTo(3500 / 4);
    expect(s.dragMsPerVisit).toBeCloseTo(3500 / 3);
    expect(summarizeTown([]).meanDragMs).toBe(0);
    expect(summarizeTown([b]).meanDragMs).toBe(0);
    expect(summarizeTown([]).dragMsPerVisit).toBe(0);
  });
});

describe('town lines', () => {
  it('picks 은/는 by the last syllable', () => {
    expect(topic('불의 탑')).toBe('은');
    expect(topic('모험가 길드')).toBe('는');
    expect(topic('광산')).toBe('은');
    expect(lockedLine('불의 탑', 10)).toBe('불의 탑은 최고 스테이지 10층에 닿으면 열린다.');
  });
});
