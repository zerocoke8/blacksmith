// The run bots finish runs the same way every time, through the public run functions only, and
// the report adds up. Small and fast; `node tools/run/measure.ts` is the real measurement.

import { describe, expect, it } from 'vitest';
import { simpleBot } from '../cards/bots.ts';
import { runAct, type RunState, startRun, verifyRun } from '../../src/sim/run/index.ts';
import { designFor, makeRunBot, picksFor, playRun } from './bots.ts';
import { checksFor, defaultCompanions, reportLines, runConfig, sampleOf, summarize } from './report.ts';

const setup = (seed: number, quickForge = false) => ({
  seed,
  hero: { family: 'aren' as const, star: 2 as const },
  companions: defaultCompanions('aren', 2),
  rules: { quickForge },
});

describe('run bots', () => {
  it('play to the end, the same way every time, with real card crafts', () => {
    for (const id of ['simple', 'simpleLate', 'planner'] as const) {
      for (const seed of [1, 2]) {
        const a = playRun(startRun(setup(seed)), makeRunBot(id), { cardBot: simpleBot, maxCraftTurns: 40, maxSteps: 5000 });
        const b = playRun(startRun(setup(seed)), makeRunBot(id), { cardBot: simpleBot, maxCraftTurns: 40, maxSteps: 5000 });
        expect(a.phase).toBe('over');
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(verifyRun(a)).toBe(true);
      }
    }
  });

  it('단순 봇 is 13.7.1 as written: it forges as soon as a new 주재료 opens and the gold is there', () => {
    const s0 = startRun(setup(1));
    // 10층 보스 down on turn 2, 강철 on sale, gold for it: 단순 봇 forges now, the 늦게 짓는 one climbs on.
    const s = { ...s0, turn: 3, lastBossFloor: 10, record: 12, gold: 400, walls: s0.walls.map((w, i) => (i === 0 ? { ...w, passedTurn: 2 } : w)) };
    expect(makeRunBot('simple').decide(s)).toEqual({ type: 'forge', materialTier: 2 });
    expect(makeRunBot('simpleLate').decide(s)).toEqual({ type: 'expedition', policy: 'normal' });
    // 벽 2 마감 (10턴) 3턴 앞이면 늦게 짓는 봇도 짓는다.
    expect(makeRunBot('simpleLate').decide({ ...s, turn: 7 })).toEqual({ type: 'forge', materialTier: 2 });
    // Without the gold: the doc's other rules in order (내구도 → HP → 원정).
    expect(makeRunBot('simple').decide({ ...s, gold: 0, hp: 0.5 })).toEqual({ type: 'rest' });
    expect(makeRunBot('simple').decide({ ...s, gold: 0, weapon: { ...s.weapon, durability: 0.3 } })).toEqual({ type: 'expedition', policy: 'normal' });
  });

  it('the planner hangs a 완성 that is weaker than the weapon in hand', () => {
    const s0 = startRun(setup(1, true));
    const fine = { id: 'f', type: 'dagger' as const, materialTier: 2, quality: 5 as const, element: 'fire' as const, enchants: ['pierce' as const], unique: null };
    const s: RunState = { ...s0, lastBossFloor: 10, record: 10, gold: 500, walls: s0.walls.map((w, i) => (i === 0 ? { ...w, passedTurn: 2 } : w)), weapon: { ...s0.weapon, weapon: fine } };
    const weak = runAct(s, { type: 'forge', materialTier: 2, quality: 1 });
    expect(makeRunBot('planner').decide(weak)).toEqual({ type: 'forgeFinish', hang: true });
    expect(makeRunBot('simple').decide(weak).type).toBe('forgeFinish');
    expect(makeRunBot('simple').decide(weak)).not.toMatchObject({ hang: true });
  });

  it('the planner draws the weapon for the next wall: 이기는 속성, △ 체형이면 관통', () => {
    const s = startRun(setup(1));
    expect(designFor(s, false)).toEqual({ element: null, enchants: ['combo', 'pursuit', 'keen'] });
    // 1구간 화 · 인간형 보스 → 수 결정, 단검은 인간형에 ◎
    expect(designFor(s, true).element).toBe('water');
    const wall2 = { ...s, lastBossFloor: 10, record: 10, walls: s.walls.map((w, i) => (i === 0 ? { ...w, passedTurn: 2 } : w)) };
    // 2구간 지 · 갑각 보스 → 화 결정 + 관통 (상위 인챈트는 상급 재료가 있을 때만 붙는다)
    expect(designFor(wall2, true)).toEqual({ element: 'fire', enchants: ['pierce', 'gale', 'vital', 'combo', 'pursuit', 'keen'] });
    const weapon = { id: 'w', type: 'dagger' as const, materialTier: 2, quality: 3 as const, element: null, enchants: [], unique: null };
    const { picks, buy } = picksFor({ ...wall2, gold: 1000 }, weapon, designFor(wall2, true), 1000);
    expect(picks).toEqual([
      { kind: 'enchant', enchant: 'element', element: 'fire' },
      { kind: 'enchant', enchant: 'pierce', element: null },
    ]);
    expect(buy).toEqual(['crystal:fire', 'shell:low']);
  });

  it('measures a small set and compares with the doc', () => {
    const bot = makeRunBot('planner');
    const samples = runConfig({
      bot,
      cardBot: simpleBot,
      family: 'aren',
      star: 1,
      companions: defaultCompanions('aren', 1),
      ancestor: null,
      runs: 6,
      seed: 1,
      rules: { quickForge: true },
      maxCraftTurns: 40,
    });
    const sum = summarize(samples, 30);
    expect(sum.runs).toBe(6);
    expect(Object.values(sum.stops).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Object.values(sum.grades).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(sum.tug.switchRate).toBeGreaterThan(0);
    const rows = [{ label: 'p', bot, star: 1 as const, summary: sum }];
    expect(checksFor(rows, 30).length).toBeGreaterThan(3);
    expect(reportLines({ rows, turns: 30, title: 't', notes: [] }).join('\n')).toContain('## 기획서 목표와 비교');
    const one = sampleOf(playRun(startRun(setup(3, true)), bot, { cardBot: simpleBot, maxCraftTurns: 40, maxSteps: 5000 }));
    expect(one.seconds).toBeGreaterThan(0);
  });
});
