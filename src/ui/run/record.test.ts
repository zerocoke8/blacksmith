import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../platform/storage.ts';
import { FAMILY_IDS } from '../../sim/data/families.ts';
import { RUN_DEFAULT_DECK } from '../../sim/data/run.ts';
import {
  emptyHall,
  hallAdd,
  normalizeSetup,
  replayRun,
  type RunState,
  serializeRun,
  setupProblems,
  startRun,
} from '../../sim/run/index.ts';
import { arenSetup, playThrough, sampleAncestor } from '../../sim/run/testkit.ts';
import { defaultDraft, draftWithAncestors, setupInputOf } from './Prep.tsx';
import { buildRunRecord, runRecordsJson, settingsLabel, stopLabel, summarizeRuns } from './record.ts';
import {
  activeMsOf,
  addForgeTurnTime,
  addMetaTime,
  defaultPrefs,
  defaultRunLab,
  newMeta,
  readLab,
  readMeta,
  readPrefs,
  runSaves,
} from './store.ts';

function finished(seed = 3): RunState {
  const states = playThrough(startRun(arenSetup({ seed, generation: 2 })));
  const last = states[states.length - 1] as RunState;
  expect(last.phase).toBe('over');
  return last;
}

describe('준비 화면', () => {
  it('starts a valid run from the default draft of every family', () => {
    for (const hero of FAMILY_IDS) {
      const input = setupInputOf(defaultDraft(hero), defaultRunLab(), emptyHall());
      expect(setupProblems(normalizeSetup(input))).toEqual([]);
      const s = startRun(input);
      expect(s.setup.hero.family).toBe(hero);
      // 시즌 칸: the season family is borrowed at 1성 (13.3).
      const season = s.companions.find((c) => c.family === 'isol');
      if (hero !== 'isol') expect(season?.star).toBe(1);
    }
  });

  it('takes the 실험 settings: 성급, 규칙, 시드', () => {
    const lab = { ...defaultRunLab(), star: 5 as const, companionStar: 3 as const, turns: 20, wallPreset: 'tight' as const, seed: 77 };
    const s = startRun(setupInputOf(defaultDraft('vail'), lab, emptyHall()));
    expect(s.setup.hero.star).toBe(5);
    expect(s.setup.seed).toBe(77);
    expect(s.rules.turns).toBe(20);
    expect(s.rules.wallPreset).toBe('tight');
    expect(s.companions.filter((c) => c.family !== 'isol').every((c) => c.star === 3)).toBe(true);
  });

  it('inherits from the hall: 주 선대 weapon and picked factors', () => {
    const hall = hallAdd(emptyHall(), sampleAncestor());
    const id = hall.cards[0]?.id as string;
    const draft = { ...draftWithAncestors(defaultDraft('aren'), [id], hall), factorPicks: [{ ancestor: 0, index: 0 }] };
    expect(draft.mainAncestor).toBe(0);
    expect(draft.weaponKeep).toEqual({ kind: 'element' });
    const s = startRun(setupInputOf(draft, defaultRunLab(), hall));
    expect(s.weapon.origin).toBe('ancestor');
    expect(s.weapon.weapon.element).toBe('wind');
    // Same family: the factor goes up one level (13.10).
    expect(s.factors[0]?.level).toBe(3);
  });

  it('drops ancestors that left the hall instead of starting a broken setup', () => {
    const hall = hallAdd(emptyHall(), sampleAncestor());
    const draft = { ...draftWithAncestors(defaultDraft('aren'), [hall.cards[0]?.id as string], hall), factorPicks: [{ ancestor: 0, index: 1 }] };
    const input = setupInputOf(draft, defaultRunLab(), emptyHall());
    expect(input.ancestors).toEqual([]);
    expect(input.factorPicks).toEqual([]);
    expect(setupProblems(normalizeSetup(input))).toEqual([]);
  });
});

describe('play record', () => {
  it('records a finished run with its replay, turns, forges and times', () => {
    const s = finished();
    let meta = newMeta(s.setup.seed, 1_000, 2, 30_000);
    meta = addMetaTime(meta, 'turnMs', 1, 4_000);
    meta = addMetaTime(meta, 'turnMs', 2, 6_000);
    meta = addForgeTurnTime(meta, 1, 2, 9_000);
    const rec = buildRunRecord(s, meta, 1_000 + 25 * 60_000);
    expect(rec.turns.length).toBe(s.turnLog.length);
    expect(rec.actions.length).toBe(s.turnLog.length);
    expect(rec.forges.length).toBe(s.turnLog.filter((l) => l.forge !== null).length);
    expect(rec.turns[0]?.thinkSec).toBe(4);
    expect(rec.hero.generation).toBe(2);
    expect(rec.result.score).toBe(s.result?.score.total);
    expect(rec.prepSec).toBe(30);
    expect(rec.activeSec).toBe(49);
    expect(rec.wallSec).toBe(1500);
    const again = replayRun(rec.replay.setup, rec.replay.actions);
    expect(serializeRun(again)).toBe(serializeRun(s));
  });

  it('summarizes runs and writes JSON that reads back', () => {
    const a = buildRunRecord(finished(3), newMeta(3, 0, 1, 0), 60_000);
    const b = buildRunRecord(finished(4), newMeta(4, 0, 1, 0), 60_000);
    const sum = summarizeRuns([a, b]);
    expect(sum.count).toBe(2);
    expect(Object.values(sum.stops).reduce((x, y) => x + y, 0)).toBe(2);
    expect(Object.values(sum.actionShare).reduce((x, y) => x + y, 0)).toBeGreaterThan(99);
    const parsed = JSON.parse(runRecordsJson([a, b], 0)) as { records: unknown[]; summary: { count: number } };
    expect(parsed.records.length).toBe(2);
    expect(parsed.summary.count).toBe(2);
    expect(stopLabel(a).length).toBeGreaterThan(0);
  });

  it('labels each run with its settings so the summary does not mix them', () => {
    const card = buildRunRecord(finished(3), newMeta(3, 0, 1, 0), 60_000);
    expect(settingsLabel(card)).toBe('2성 · 30턴 · 벽 기본 · 카드 단조');
    const quick = startRun(arenSetup({ seed: 4 }, { quickForge: true, wallPreset: 'tight', handSize: 4, lateGoldRate: 0.5 }));
    const quickEnd = playThrough(quick);
    const q = buildRunRecord(quickEnd[quickEnd.length - 1] as RunState, newMeta(4, 0, 1, 0), 60_000);
    expect(q.settings).toMatchObject({ quickForge: true, handSize: 4, lateGoldRate: 0.5 });
    expect(settingsLabel(q)).toBe('2성 · 30턴 · 벽 빡빡 · 단조 간이 · 손패 4 · 후반 수입 ×0.5');
    // Records from before the switches existed read as the doc's rules.
    const old = { ...card, settings: { ...card.settings, handSize: undefined, lateGoldRate: undefined } };
    expect(settingsLabel(old)).toBe(settingsLabel(card));
    expect(q.forges.every((f) => typeof f.taken === 'boolean')).toBe(true);
  });
});

describe('saves', () => {
  it('a run saved mid-turn comes back as the same state', async () => {
    const store = runSaves(memoryStore());
    const states = playThrough(startRun(arenSetup({ seed: 5 })));
    const mid = states[Math.floor(states.length / 2)] as RunState;
    await store.saveRun(mid);
    const meta = addMetaTime(newMeta(5, 10, 1, 0), 'choiceMs', 3, 1234);
    await store.saveMeta(meta);
    const data = await store.loadAll();
    expect(data.run).not.toBeNull();
    expect(serializeRun(data.run as RunState)).toBe(serializeRun(mid));
    expect(data.meta).toEqual(meta);
    expect(data.runLost).toBe(false);
    await store.saveRun(null);
    await store.saveMeta(null);
    const empty = await store.loadAll();
    expect(empty.run).toBeNull();
    expect(empty.meta).toBeNull();
  });

  it('tells how a saved run came back after an update: the same, renumbered, or cut short', async () => {
    const raw = memoryStore();
    const store = runSaves(raw);
    const states = playThrough(startRun(arenSetup({ seed: 5 })));
    const mid = states[Math.floor(states.length / 2)] as RunState;
    await store.saveRun(mid);
    expect((await store.loadAll()).runStatus).toBe('same');
    await raw.save('run.current', serializeRun({ ...mid, gold: mid.gold + 7 }));
    const moved = await store.loadAll();
    expect(moved).toMatchObject({ runStatus: 'changed', runLost: false });
    expect(moved.run?.gold).toBe(mid.gold);
    await raw.save('run.current', serializeRun({ ...mid, actions: [...mid.actions.slice(0, 3), { type: 'climb' }] }));
    const cut = await store.loadAll();
    expect(cut).toMatchObject({ runStatus: 'partial', runLost: false });
    expect(cut.run?.actions).toHaveLength(3);
  });

  it('says so when a saved run no longer replays', async () => {
    const raw = memoryStore();
    await raw.save('run.current', JSON.stringify({ version: 1, setup: { seed: 1 }, actions: [{ type: 'rest' }] }));
    const data = await runSaves(raw).loadAll();
    expect(data.run).toBeNull();
    expect(data.runLost).toBe(true);
  });

  it('repairs broken prefs and meta field by field', () => {
    expect(readPrefs(null)).toEqual(defaultPrefs());
    expect(readPrefs({ version: 1, lab: { star: 9, turns: 999, eventRate: 'x', wallPreset: 'loose' } }).lab).toEqual({
      ...defaultRunLab(),
      turns: 60,
      wallPreset: 'loose',
    });
    expect(readLab({ star: 4, deathMode: 'death', quickForge: true }).star).toBe(4);
    expect(readLab({ handSize: 9, lateGoldRate: 0.1 })).toMatchObject({ handSize: 6, lateGoldRate: 0.25 });
    expect(readLab({})).toMatchObject({ handSize: 5, lateGoldRate: 1 });
    const prefs = readPrefs({ version: 1, draft: { hero: 'nea', companions: ['vail', 'bogus'], deck: ['nope'] } });
    expect(prefs.draft?.hero).toBe('nea');
    expect(prefs.draft?.companions).toEqual(['vail', null, null]);
    expect(prefs.draft?.deck).toEqual([...RUN_DEFAULT_DECK]);
    expect(readMeta({ version: 1 })).toBeNull();
    const meta = readMeta({ ...newMeta(1, 2, 3, 4), turnMs: { 1: 5, 2: -3 }, forgeTurnMs: { 1: [1, 'x'] } });
    expect(meta?.turnMs).toEqual({ 1: 5 });
    expect(meta?.forgeTurnMs).toEqual({ 1: [1, 0] });
    expect(activeMsOf(meta as NonNullable<typeof meta>)).toBe(9);
  });
});
