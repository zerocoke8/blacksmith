// Guards the crafting difficulty curve (기획서 4.2.1, 4.2.3, 4.3, 9.3, 9.4) at the pace points
// of 3.7 and 10장 (testkit.ts): main-material band, level of all three tools, fame stage.
// "Best" is the exact best line when every turn is 보통 (solver.ts), replayed through the
// engine. Every skill board here is one 9.3 allows at its fame stage. What a player who
// reacts to conditions gets is in play.test.ts.

import { describe, expect, it } from 'vitest';
import type { QualityTier } from '../core/types.ts';
import { materialPrice } from '../data/common.ts';
import { CRAFT_ACTIONS, type CraftActionId, type CraftNodeId, GOOD_CONDITIONS } from '../data/craft.ts';
import { applyAction, type CraftSetup, type CraftState, craftOutcome, startCraft } from './engine.ts';
import { recipeFor, recipeSize } from './recipe.ts';
import { checkLayout, smithStats, type ToolLevels } from './smith.ts';
import { type AllNormalLine, reachesAllNormal, solveAllNormal } from './solver.ts';
import {
  BASIC_PACE,
  EXAMPLE_FLOW,
  findAllNormalCraft,
  fullCraftLayouts,
  LATE_PACE,
  makeSetup,
  PACE_BOSS_MATERIAL,
  replayAllNormal,
  runFromSetup,
} from './testkit.ts';

const NORMAL_CRAFT = findAllNormalCraft(1, 25);
const tools = (n: number): ToolLevels => ({ anvil: n, whetstone: n, furnace: n });

/** Solves, and checks the engine agrees with the solver about that line (solver.test.ts checks the solver). */
function best(setup: CraftSetup): AllNormalLine {
  const line = solveAllNormal(setup);
  const end = replayAllNormal(setup, line.actions);
  expect(end.status).toBe('success');
  expect(end.turn).toBe(line.turns);
  expect(craftOutcome(end).qualityRatio).toBe(line.ratio);
  return line;
}

/**
 * The player 4.2.1 describes: the example flow, with 정밀 다듬기 instead of
 * 다듬기 on 좋음/최상 when the CP for the rest of the plan allows it.
 */
function docPlayer(setup: ReturnType<typeof makeSetup>): CraftState {
  let s = startCraft(setup);
  for (const [i, planned] of EXAMPLE_FLOW.entries()) {
    if (s.status !== 'active') break;
    const restCp = EXAMPLE_FLOW.slice(i + 1).reduce((sum, a) => sum + CRAFT_ACTIONS[a].cp, 0);
    let a: CraftActionId = planned;
    if (planned === 'basicTouch' && GOOD_CONDITIONS.includes(s.condition) && s.cp - 15 >= restCp) a = 'preciseTouch';
    s = applyAction(s, a);
  }
  return s;
}

// Legal craft layouts (9.3): each branch is walked in order from node 1.
const STAGE1: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'reflect'];
const STAGE3: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'reflect'];
const STAGE4: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'groundwork', 'reflect'];

describe('기본 레시피 1~3구간: basic actions make ★3 in 10~15 turns (4.2.1, 4.2.3, 4.3)', () => {
  for (const p of BASIC_PACE) {
    it(`${p.when} (${p.band}구간, 도구 ${p.tools}): best is ★3 when every turn is 보통`, () => {
      const line = best(makeSetup({ materialTier: p.band, tools: tools(p.tools) }));
      expect(line.ratio).toBeGreaterThanOrEqual(0.55);
      expect(line.ratio).toBeLessThan(0.8);
      expect(line.turns).toBeGreaterThanOrEqual(10);
      expect(line.turns).toBeLessThanOrEqual(15);
    });

    it(`${p.when}: no skill board of fame stage ${p.stage} makes a sure 걸작`, () => {
      for (const nodes of fullCraftLayouts(p.stage)) {
        expect(checkLayout(nodes, p.stage)).toBeNull();
        expect(reachesAllNormal(makeSetup({ materialTier: p.band, tools: tools(p.tools), nodes }), 1)).toBe(false);
      }
    });
  }

  it('the 4.2.1 player mostly makes ★3; ★4 and up only now and then (4.3)', () => {
    const n = 3000;
    const tiers: Record<QualityTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let craftNo = 1; craftNo <= n; craftNo++) {
      const end = docPlayer(makeSetup({ worldSeed: 2024, craftNo }));
      const outcome = craftOutcome(end);
      expect(outcome.success).toBe(true);
      tiers[outcome.tier as QualityTier]++;
    }
    expect(tiers[3] / n).toBeGreaterThan(0.85);
    expect((tiers[4] + tiers[5]) / n).toBeLessThan(0.1);
    expect(tiers[5] / n).toBeLessThan(0.02);
  });
});

/**
 * 4구간 is the shop's top band from 3일차 (3구간·도구 10) until 1주 (5구간·도구 20) (3.7, 10장),
 * at fame stage 3 and then 4. It is the bridge to 고급 (RECIPE.bridgeMult).
 */
const BRIDGE = { band: 4, tools: { from: 11, to: 19 }, stages: [3, 4] } as const;

describe('4구간, the bridge to 고급: ★3~★4 at best all the way to 1주 (4.2.3, 4.3)', () => {
  it('the strongest legal board stays at ★3~★4 when every turn is 보통, at every tool level', { timeout: 60_000 }, () => {
    for (let lv = BRIDGE.tools.from; lv <= BRIDGE.tools.to; lv++) {
      for (const stage of BRIDGE.stages) {
        const setups = fullCraftLayouts(stage).map((nodes) => makeSetup({ materialTier: BRIDGE.band, tools: tools(lv), nodes }));
        expect(setups.some((s) => reachesAllNormal(s, 0.55)), `도구 ${lv}, 명성 ${stage}: ★3`).toBe(true);
        expect(setups.some((s) => reachesAllNormal(s, 1)), `도구 ${lv}, 명성 ${stage}: no sure 걸작`).toBe(false);
      }
    }
  });

  it('halfway (도구 15, 명성 3) the strongest board takes 10~15 turns, a 기본 length', () => {
    const lines = fullCraftLayouts(3).map((nodes) => best(makeSetup({ materialTier: BRIDGE.band, tools: tools(15), nodes })));
    const line = lines.reduce((a, b) => (b.quality > a.quality || (b.quality === a.quality && b.turns < a.turns) ? b : a));
    expect(line.ratio).toBeGreaterThanOrEqual(0.55);
    expect(line.ratio).toBeLessThan(1);
    expect(line.turns).toBeGreaterThanOrEqual(10);
    expect(line.turns).toBeLessThanOrEqual(15);
  });
});

describe('band 1: the first skill boards (9.3)', () => {
  const lines: { name: string; stage: number; nodes: CraftNodeId[]; tools: number; line: CraftActionId[]; atLeast: number; below: number }[] = [
    {
      name: 'stage-1 board (첫 손질) stops short of ★4 — 좋음 makes the difference',
      stage: 1,
      nodes: STAGE1,
      tools: 0,
      line: ['reflect', 'basicSynthesis', 'basicSynthesis', 'basicSynthesis', 'basicTouch', 'mastersMend', 'innovation', 'basicTouch', 'basicTouch', 'byregotsBlessing', 'basicSynthesis'],
      atLeast: 0.7,
      below: 0.8,
    },
    {
      name: 'stage-3 board (두꺼운 모루판) reaches ★4 without tools',
      stage: 3,
      nodes: STAGE3,
      tools: 0,
      line: ['reflect', 'basicSynthesis', 'basicSynthesis', 'basicSynthesis', 'basicTouch', 'basicTouch', 'basicTouch', 'mastersMend', 'basicTouch', 'basicTouch', 'byregotsBlessing', 'basicSynthesis'],
      atLeast: 0.8,
      below: 0.85,
    },
    {
      name: 'stage-4 board (크게 내려치기) reaches ~88% without tools',
      stage: 4,
      nodes: STAGE4,
      tools: 0,
      line: ['reflect', 'basicSynthesis', 'basicTouch', 'basicTouch', 'innovation', 'basicTouch', 'basicTouch', 'byregotsBlessing', 'groundwork'],
      atLeast: 0.85,
      below: 0.9,
    },
  ];

  for (const { name, stage, nodes, tools: lv, line, atLeast, below } of lines) {
    it(name, () => {
      expect(checkLayout(nodes, stage)).toBeNull();
      const end = runFromSetup(makeSetup({ craftNo: NORMAL_CRAFT, nodes, tools: tools(lv) }), line);
      expect(end.status).toBe('success');
      const ratio = craftOutcome(end).qualityRatio;
      expect(ratio).toBeGreaterThanOrEqual(atLeast);
      expect(ratio).toBeLessThan(below);
    });
  }

  it('첫 손질 with early tools (0~6) is never a sure 걸작; at 도구 6 it tops out in ★4', () => {
    const ratios = [0, 1, 2, 3, 4, 5, 6].map((lv) => best(makeSetup({ nodes: STAGE1, tools: tools(lv) })).ratio);
    for (const r of ratios) expect(r).toBeLessThan(1);
    expect(ratios[6]).toBeGreaterThanOrEqual(0.8);
  });

  it('tools alone (6 levels, ahead of the band-1 pace) still make ★3 with basic actions', () => {
    const line = best(makeSetup({ tools: tools(6) }));
    expect(line.ratio).toBeGreaterThanOrEqual(0.55);
    expect(line.ratio).toBeLessThan(0.8);
  });

  it('no legal board up to stage 4 makes ★5 at band 1 without tools when every turn is 보통', () => {
    const ratios = fullCraftLayouts(4).map((nodes) => best(makeSetup({ nodes })).ratio);
    expect(Math.max(...ratios)).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...ratios)).toBeLessThan(1);
  });
});

/** All-보통 length of the best line per grade (4.2.3). */
const GRADE_TARGET = {
  advanced: { label: '고급', boss: null, minTurns: 15, maxTurns: 20 },
  legendary: { label: '전설', boss: PACE_BOSS_MATERIAL, minTurns: 20, maxTurns: 25 },
} as const;

describe('고급·전설: ★3~★4 at best, 걸작 needs luck (4.2.3, 9.2, 9.3, 10)', () => {
  for (const p of LATE_PACE) {
    for (const grade of ['advanced', 'legendary'] as const) {
      const target = GRADE_TARGET[grade];
      it(
        `${p.when} (${p.band}구간, 도구 ${p.tools}, 명성 ${p.stage}): ${target.label} is ★3~★4 in ${target.minTurns}~${target.maxTurns} turns`,
        { timeout: 60_000 },
        () => {
          const setupFor = (nodes: CraftNodeId[]) =>
            makeSetup({ materialTier: p.band, tools: tools(p.tools), nodes, bossMaterial: target.boss });
          const strongest = p.strongest[grade];
          expect(checkLayout(strongest, p.stage)).toBeNull();
          expect(recipeFor(setupFor(strongest).recipe).grade).toBe(grade);

          const line = best(setupFor(strongest));
          expect(line.ratio).toBeGreaterThanOrEqual(0.55);
          expect(line.ratio).toBeLessThan(1);
          expect(line.turns).toBeGreaterThanOrEqual(target.minTurns);
          expect(line.turns).toBeLessThanOrEqual(target.maxTurns);

          // No other legal board does better, so no board makes a sure 걸작 either.
          const cap = recipeFor(setupFor(strongest).recipe).qualityCap;
          for (const nodes of fullCraftLayouts(p.stage)) {
            expect(reachesAllNormal(setupFor(nodes), (line.quality + 1) / cap)).toBe(false);
          }
        },
      );
    }
  }
});

/** Basic hammers to finish, and quality cap in basic touches, before the grade's (or bridge's) extra size. */
function load(band: number, toolLevel: number): { hammers: number; touches: number } {
  const r = recipeFor({ weaponType: 'oneHandSword', materialTier: band, bossMaterial: null });
  const s = smithStats({ nodes: [], tools: tools(toolLevel) });
  const m = recipeSize(r.materialTier, r.grade);
  return { hammers: r.progressRequired / m.progress / s.craftsmanship, touches: r.qualityCap / m.quality / s.control };
}

describe('tools keep up with the bands (4.2.3, 9.4, 10)', () => {
  const start = load(1, 0);

  it('band 1 without tools: three basic hammers fall short, four finish; the cap is 16 touches', () => {
    expect(start.hammers).toBeGreaterThan(3);
    expect(start.hammers).toBeLessThanOrEqual(4);
    expect(start.touches).toBeCloseTo(16);
  });

  // 10장 성장 페이스: 3일차 3구간·도구 10, 1달 8구간·도구 35. 3달 (13구간) has no tool
  // level in the doc; 55 is 1달 plus five bands of the trend below.
  const pace = [
    { when: '3일차', band: 3, tools: 10 },
    { when: '1달', band: 8, tools: 35 },
    { when: '3달', band: 13, tools: 55 },
  ];
  for (const p of pace) {
    it(`${p.when}: band ${p.band} with tools ${p.tools} is a 3~4.5-hammer, 12~17-touch recipe before the grade's size`, () => {
      const { hammers, touches } = load(p.band, p.tools);
      expect(hammers).toBeGreaterThanOrEqual(3);
      expect(hammers).toBeLessThanOrEqual(4.5);
      expect(touches).toBeGreaterThanOrEqual(12);
      expect(touches).toBeLessThanOrEqual(17);
    });
  }

  it('the gap does not keep growing: tool levels bought at the band-by-band price trend hold within ±10% to band 20', () => {
    // Materials cost ×2.5 per band (10장) and each tool level ×1.25 (9.4), so the same
    // share of income buys log 2.5 / log 1.25 ≈ 4.1 more levels per band.
    const toolCostGrowth = 1.25;
    const levelsPerBand = Math.log(materialPrice(2) / materialPrice(1)) / Math.log(toolCostGrowth);
    for (let band = 1; band <= 20; band++) {
      const { hammers, touches } = load(band, Math.round(levelsPerBand * (band - 1)));
      expect(hammers / start.hammers).toBeGreaterThan(0.9);
      expect(hammers / start.hammers).toBeLessThan(1.1);
      expect(touches / start.touches).toBeGreaterThan(0.9);
      expect(touches / start.touches).toBeLessThan(1.1);
    }
  });
});
