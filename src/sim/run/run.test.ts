// 결정론과 판 세이브 (기획서 13.16): 같은 (설정, 행동 기록)이면 같은 판이고, 직렬화 → 복원 →
// 이어 하기가 끊지 않고 한 판과 같다. 단조 안의 카드 제작 상태도 같이 저장된다.

import { describe, expect, it } from 'vitest';
import { FAMILY_IDS, familyCardId } from '../data/families.ts';
import { RUN_START_GOLD, STARS } from '../data/run.ts';
import {
  defaultRunSetup,
  normalizeSetup,
  replayRun,
  resolveRunRules,
  runAct,
  setupProblems,
  startRun,
  wallDeadlines,
} from './run.ts';
import { parseRun, recoverRun, serializeRun, verifyRun } from './save.ts';
import { arenSetup, plainAction, playThrough, sampleAncestor } from './testkit.ts';
import type { RunAction, RunRules, RunState } from './types.ts';

const json = (s: RunState): string => serializeRun(s);

/** Freezes every object reachable from v (ESM is strict: a write to a frozen object throws). */
function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

/**
 * plainAction, but a finished weapon goes on the rack every other time and every craft ends its
 * first hand after one card (both 완성 paths and 다시 달구기 get walked).
 */
function hangingAction(s: RunState): RunAction {
  if (s.phase === 'forgeDone' && (s.forge?.no ?? 0) % 2 === 0) return { type: 'forgeFinish', hang: true };
  const craft = s.forge?.craft;
  if (s.phase === 'forge' && craft !== null && craft !== undefined && craft.turn === 1 && craft.log.filter((e) => e.kind === 'play').length === 1) {
    return { type: 'forgeEndTurn' };
  }
  return plainAction(s);
}

describe('결정론', () => {
  it('the same setup and choices give the same run, to the last byte', () => {
    for (const seed of [1, 2, 3]) {
      const a = playThrough(startRun(arenSetup({ seed })));
      const b = playThrough(startRun(arenSetup({ seed })));
      expect(json(a[a.length - 1] as RunState)).toBe(json(b[b.length - 1] as RunState));
      expect((a[a.length - 1] as RunState).phase).toBe('over');
    }
  });

  it('a different 판 시드 gives a different run', () => {
    const ends = [1, 2, 3, 4, 5].map((seed) => {
      const states = playThrough(startRun(arenSetup({ seed })));
      return json(states[states.length - 1] as RunState);
    });
    expect(new Set(ends).size).toBe(ends.length);
  });

  it('runAct never changes the state it is given (every input frozen, and read back the same after)', () => {
    const cases: { seed: number; rules: Partial<RunRules> }[] = [
      { seed: 4, rules: {} },
      { seed: 5, rules: { eventRate: 3 } },
      { seed: 6, rules: { quickForge: true, deathMode: 'death' } },
      { seed: 7, rules: { wallPreset: 'tight', turns: 40, handSize: 6, lateGoldRate: 0.5 } },
    ];
    let steps = 0;
    const seen = new Set<string>();
    for (const c of cases) {
      let s = startRun(arenSetup({ seed: c.seed }, c.rules));
      for (let i = 0; i < 2000 && s.phase !== 'over'; i++) {
        const before = json(s);
        const action = hangingAction(s);
        seen.add(action.type === 'forgeFinish' && action.hang === true ? 'hang' : action.type);
        deepFreeze(s);
        const next = runAct(s, action);
        expect(json(s)).toBe(before);
        s = next;
        steps += 1;
      }
      expect(s.phase).toBe('over');
    }
    expect(steps).toBeGreaterThan(50);
    // Every kind of step went through frozen: the card craft, both 완성 paths, choices, the forced turns.
    for (const kind of ['expedition', 'forge', 'forgePlay', 'forgeEndTurn', 'forgeFinish', 'hang', 'maintain', 'rest', 'choose', 'wall']) {
      expect(seen.has(kind), kind).toBe(true);
    }
  });

  it('replaying the action list gives the state (서버 검증)', () => {
    const states = playThrough(startRun(arenSetup({ seed: 6 })));
    const end = states[states.length - 1] as RunState;
    expect(json(replayRun(end.setup, end.actions))).toBe(json(end));
    expect(verifyRun(end)).toBe(true);
  });
});

describe('판 세이브', () => {
  it('serialize → restore → continue is the same as never stopping, at every step', () => {
    const states = playThrough(startRun(arenSetup({ seed: 8 })));
    const end = states[states.length - 1] as RunState;
    for (let i = 0; i < states.length; i += 3) {
      const back = parseRun(serializeRun(states[i] as RunState));
      expect(back).not.toBeNull();
      let s = back as RunState;
      expect(json(s)).toBe(json(states[i] as RunState));
      while (s.phase !== 'over') s = runAct(s, plainAction(s));
      expect(json(s)).toBe(json(end));
    }
  });

  it('a 단조 in progress keeps its card craft (hand, piles, fire) through a save', () => {
    let mid: RunState | undefined;
    for (let seed = 1; seed < 40 && mid === undefined; seed++) {
      const states = playThrough(startRun(arenSetup({ seed })));
      mid = states.find((s) => s.phase === 'forge' && (s.forge?.craft?.log.length ?? 0) > 3);
    }
    expect(mid).toBeDefined();
    const s = mid as RunState;
    const back = parseRun(serializeRun(s)) as RunState;
    expect(back.forge?.craft).toEqual(s.forge?.craft);
    expect(back.forge?.craft?.setup).toMatchObject({ seed: s.setup.seed, stream: 'forge', craftNo: s.forge?.no });
    expect(back.forge?.craft?.smith).toMatchObject({ handSize: 5, keep: 0 });
  });

  it('a hand-edited save comes back as what its actions make', () => {
    const states = playThrough(startRun(arenSetup({ seed: 9 })));
    const s = states[Math.floor(states.length / 2)] as RunState;
    const edited = { ...s, gold: s.gold + 10_000 };
    expect(verifyRun(edited)).toBe(false);
    expect(parseRun(serializeRun(edited))?.gold).toBe(s.gold);
  });

  it('after an update, the device save replays as far as it can and says how it came back', () => {
    const states = playThrough(startRun(arenSetup({ seed: 12 })));
    const mid = states[Math.floor(states.length / 2)] as RunState;
    const same = recoverRun(serializeRun(mid));
    expect(same?.status).toBe('same');
    expect(json(same?.state as RunState)).toBe(json(mid));
    // The numbers moved under it (here: the saved state disagrees with its own actions).
    const moved = recoverRun(serializeRun({ ...mid, gold: mid.gold + 1 }));
    expect(moved).toMatchObject({ status: 'changed', replayed: mid.actions.length, total: mid.actions.length });
    expect(moved?.state.gold).toBe(mid.gold);
    // An action that no longer fits: the run goes on from the last one that did.
    const broken = { ...mid, actions: [...mid.actions.slice(0, 5), { type: 'climb' } as RunAction, ...mid.actions.slice(5)] };
    const part = recoverRun(serializeRun(broken));
    expect(part).toMatchObject({ status: 'partial', replayed: 5, total: mid.actions.length + 1 });
    expect(json(part?.state as RunState)).toBe(json(replayRun(mid.setup, mid.actions.slice(0, 5))));
    // The strict reading (서버 검증) still refuses it.
    expect(parseRun(serializeRun(broken))).toBeNull();
    expect(recoverRun(null)).toBeNull();
    expect(recoverRun('{')).toBeNull();
    expect(recoverRun(JSON.stringify({ ...mid, setup: { ...mid.setup, seed: 1.5 } }))).toBeNull();
  });

  it('broken saves read back as nothing', () => {
    expect(parseRun(null)).toBeNull();
    expect(parseRun('{')).toBeNull();
    expect(parseRun(JSON.stringify({ version: 999 }))).toBeNull();
    const s = startRun(arenSetup());
    expect(parseRun(JSON.stringify({ ...s, actions: [{ type: 'climb' }] }))).toBeNull();
  });
});

describe('판 준비 (13.3)', () => {
  it('starts at turn 1 with 150G, full HP and the season walls', () => {
    const s = startRun(arenSetup());
    expect(s).toMatchObject({ turn: 1, phase: 'turn', hp: 1, gold: RUN_START_GOLD, record: 0, lastBossFloor: 0 });
    expect(s.walls.map((w) => [w.floor, w.deadline])).toEqual([
      [10, 4],
      [20, 10],
      [30, 16],
      [40, 22],
      [50, 28],
    ]);
    expect(s.weapon.weapon).toMatchObject({ type: 'dagger', materialTier: 1, quality: 1, element: null, enchants: [] });
  });

  it('the default setup starts for every family and 성급', () => {
    for (const family of FAMILY_IDS) {
      for (const star of STARS) {
        const setup = defaultRunSetup(7, family, star);
        expect(setupProblems(normalizeSetup(setup))).toEqual([]);
        expect(setup.companions).toHaveLength(3);
        expect(startRun(setup).deck).toContain(familyCardId(family, star));
      }
    }
    expect((defaultRunSetup(1, 'aren', 2).companions ?? []).map((c) => c.family)).toEqual(['vail', 'nea', 'isol']);
  });

  it('refuses a setup that breaks the rules', () => {
    const bad = (over: Parameters<typeof arenSetup>[0]): string[] => setupProblems(normalizeSetup(arenSetup(over)));
    expect(bad({})).toEqual([]);
    expect(bad({ companions: [{ family: 'aren', star: 1 }] })).toContain('아렌: 같은 가문은 한 칸에만');
    expect(bad({ hero: { family: 'aren', star: 6 as 1 } })).toContain('성급은 1~5');
    expect(bad({ deck: ['hammer'] }).some((m) => m.startsWith('덱은'))).toBe(true);
    expect(bad({ deck: [...arenSetup().deck ?? [], 'edgeHone1'] })).toContain('잔날 세우기: 판 안에서만 들어온다');
    expect(bad({ deck: [...arenSetup().deck ?? [], 'thrift'] })).toContain('해금 카드는 시즌 상한 6장까지 (지금 7장)');
    expect(bad({ ancestors: [sampleAncestor()], factorPicks: [0, 1, 2].map((index) => ({ ancestor: 0, index })) })).toContain(
      '인자는 계승 칸 2개까지',
    );
    expect(() => startRun(arenSetup({ seed: 1.5 }))).toThrow('판 시드는 정수');
    // The same 전설 용사 카드 in both 선대 칸 would let one card's 인자 be taken twice.
    const twice = bad({ ancestors: [sampleAncestor(), sampleAncestor()], factorPicks: [{ ancestor: 0, index: 0 }, { ancestor: 1, index: 0 }] });
    expect(twice).toContain('같은 선대를 두 칸에 둘 수 없다');
    expect(bad({ ancestors: [sampleAncestor(), sampleAncestor({ id: 'L-other' })] })).toEqual([]);
  });

  it('keeps the 대수 the setup carries (default 1)', () => {
    expect(startRun(arenSetup()).setup.generation).toBe(1);
    expect(startRun(arenSetup({ generation: 3 })).setup.generation).toBe(3);
    expect(normalizeSetup(arenSetup({ generation: 0 })).generation).toBe(1);
  });

  it('scales the walls with the run length and keeps the last before the end', () => {
    expect(wallDeadlines(resolveRunRules({ wallPreset: 'tight' }))).toEqual([3, 8, 14, 20, 26]);
    expect(wallDeadlines(resolveRunRules({ wallPreset: 'loose' }))).toEqual([5, 12, 18, 24, 29]);
    expect(wallDeadlines(resolveRunRules({ turns: 12 }))).toEqual([2, 4, 6, 9, 11]);
    expect(wallDeadlines(resolveRunRules({ turns: 60, wallPreset: 'loose' }))).toEqual([10, 24, 36, 48, 58]);
    expect(resolveRunRules({ turns: 3, eventRate: 99, deathMode: 'x' as 'death' })).toMatchObject({
      turns: 12,
      eventRate: 3,
      deathMode: 'severe',
    });
    // The doc's rules by default; the [검증] switches stay in their ranges.
    expect(resolveRunRules({})).toMatchObject({ handSize: 5, lateGoldRate: 1, quickForge: false });
    expect(resolveRunRules({ handSize: 9, lateGoldRate: 0 })).toMatchObject({ handSize: 6, lateGoldRate: 0.25 });
    expect(resolveRunRules({ handSize: 4.4, lateGoldRate: Number.NaN })).toMatchObject({ handSize: 4, lateGoldRate: 1 });
  });
});
