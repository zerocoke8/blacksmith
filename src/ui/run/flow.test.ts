import { describe, expect, it } from 'vitest';
import { runAct, type RunState, startRun } from '../../sim/run/index.ts';
import { arenSetup, forgeStep, playThrough } from '../../sim/run/testkit.ts';
import { finalCraft, screenOf, unseenExpedition } from './flow.ts';
import { newMeta } from './store.ts';

describe('run screens', () => {
  it('shows the 준비 화면 without a run, then the 턴 화면', () => {
    expect(screenOf(null, null, false)).toBe('prep');
    const s = startRun(arenSetup());
    expect(screenOf(s, newMeta(1, 0, 1, 0), false)).toBe('turn');
  });

  it('shows the 원정 결과 before the 사건 it led to, until it is seen', () => {
    const s = runAct(startRun(arenSetup()), { type: 'expedition', policy: 'normal' });
    const meta = newMeta(1, 0, 1, 0);
    expect(unseenExpedition(s, meta)?.turn).toBe(1);
    expect(screenOf(s, meta, false)).toBe('result');
    const seen = { ...meta, seenLogs: s.turnLog.length };
    // 10층 보스를 넘으면 보스 보상이 기다린다 (13.4.3).
    expect(screenOf(s, seen, false)).toBe(s.phase === 'choice' ? 'choice' : 'turn');
    // Without notes (a lost meta), nothing is replayed.
    expect(screenOf(s, null, false)).toBe(s.phase === 'choice' ? 'choice' : 'turn');
  });

  it('keeps the anvil up while a finished 단조 is held, then the 완성 화면', () => {
    let s: RunState = runAct(startRun(arenSetup()), { type: 'forge', materialTier: 1 });
    const meta = newMeta(1, 0, 1, 0);
    expect(screenOf(s, meta, false)).toBe('forge');
    while (s.phase === 'forge') s = runAct(s, forgeStep(s));
    expect(['forgeDone', 'choice', 'turn']).toContain(s.phase);
    expect(screenOf(s, meta, true)).toBe('forge');
    if (s.phase === 'forgeDone') expect(screenOf(s, meta, false)).toBe('forgeDone');
  });

  it('rebuilds the craft a broken or abandoned 단조 ended on', () => {
    const s = runAct(startRun(arenSetup()), { type: 'forge', materialTier: 1 });
    const craft = s.forge?.craft;
    if (craft === null || craft === undefined) throw new Error('no craft');
    const after = runAct(s, { type: 'forgeAbandon' });
    expect(after.forge).toBeNull();
    const last = finalCraft(craft, { type: 'forgeAbandon' });
    expect(last?.status).toBe('failed');
    expect(last?.abandoned).toBe(true);
    expect(finalCraft(craft, { type: 'rest' })).toBeNull();
  });

  it('ends on the 판 끝 화면', () => {
    const states = playThrough(startRun(arenSetup({ seed: 2 })));
    const last = states[states.length - 1] as RunState;
    expect(screenOf(last, { ...newMeta(2, 0, 1, 0), seenLogs: last.turnLog.length }, false)).toBe('over');
  });
});
