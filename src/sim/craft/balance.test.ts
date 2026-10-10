// Guards the tuning targets of 기획서 4.2.1 / 4.3 at band 1 (basic actions make ★3, ★4 only
// now and then; legal skill boards and tools open ★4~★5), and 4.2.3 '도구로 따라잡는다'
// over the bands. Every skill board here must be one 9.3 allows at its fame stage.

import { describe, expect, it } from 'vitest';
import type { QualityTier } from '../core/types.ts';
import { materialPrice } from '../data/common.ts';
import { CRAFT_ACTIONS, type CraftActionId, type CraftNodeId, GOOD_CONDITIONS } from '../data/craft.ts';
import { checkAction, type CraftState, craftOutcome, startCraft, applyAction } from './engine.ts';
import { recipeFor } from './recipe.ts';
import { checkLayout, smithStats, type ToolLevels } from './smith.ts';
import { EXAMPLE_FLOW, findAllNormalCraft, makeSetup, runFromSetup } from './testkit.ts';

const NORMAL_CRAFT = findAllNormalCraft(1, 25);
const tools = (n: number): ToolLevels => ({ anvil: n, whetstone: n, furnace: n });

/** Best quality ratio over every line, assuming every turn is 보통 (memoised DFS). */
function bestAllNormal(start: CraftState): number {
  const memo = new Map<string, number>();
  let best = 0;
  const dfs = (s: CraftState) => {
    if (s.status === 'success') {
      best = Math.max(best, craftOutcome(s).qualityRatio);
      return;
    }
    if (s.status !== 'active') return;
    const b = s.buffs;
    const key = [s.progress, s.durability, s.cp, s.innerQuiet, ...Object.values(b), s.turn === 0].join(',');
    if ((memo.get(key) ?? -1) >= s.quality) return;
    memo.set(key, s.quality);
    for (const a of s.stats.actions) {
      if (CRAFT_ACTIONS[a].free || checkAction(s, a) !== null) continue;
      dfs({ ...applyAction(s, a), condition: 'normal' });
    }
  };
  dfs(start);
  return best;
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

describe('band 1 balance', () => {
  it('basic actions cannot reach ★4 when every turn is 보통', () => {
    const best = bestAllNormal(startCraft(makeSetup({ craftNo: NORMAL_CRAFT })));
    expect(best).toBeGreaterThanOrEqual(0.55);
    expect(best).toBeLessThan(0.8);
  });

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

  const lines: { name: string; stage: number; nodes: CraftNodeId[]; tools: number; line: CraftActionId[]; atLeast: number; below?: number }[] = [
    {
      name: 'stage-1 board (첫 손질) stops just short of ★4 — one 좋음 makes the difference',
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
    },
    {
      name: 'stage-4 board (크게 내려치기) reaches ~95% without tools',
      stage: 4,
      nodes: STAGE4,
      tools: 0,
      line: ['reflect', 'basicSynthesis', 'basicTouch', 'basicTouch', 'innovation', 'basicTouch', 'basicTouch', 'byregotsBlessing', 'groundwork'],
      atLeast: 0.9,
    },
    {
      name: 'tools alone reach ★4',
      stage: 1,
      nodes: [],
      tools: 6,
      line: ['basicSynthesis', 'basicSynthesis', 'basicSynthesis', 'innovation', 'basicTouch', 'basicTouch', 'mastersMend', 'innovation', 'basicTouch', 'basicTouch', 'byregotsBlessing', 'basicSynthesis'],
      atLeast: 0.8,
    },
    {
      name: 'stage-1 board with a few tool levels reaches ★5',
      stage: 1,
      nodes: STAGE1,
      tools: 6,
      line: ['reflect', 'basicSynthesis', 'basicSynthesis', 'basicSynthesis', 'innovation', 'basicTouch', 'mastersMend', 'basicTouch', 'innovation', 'basicTouch', 'byregotsBlessing', 'basicSynthesis'],
      atLeast: 1,
    },
  ];

  for (const { name, stage, nodes, tools: lv, line, atLeast, below } of lines) {
    it(name, () => {
      expect(checkLayout(nodes, stage)).toBeNull();
      const end = runFromSetup(makeSetup({ craftNo: NORMAL_CRAFT, nodes, tools: tools(lv) }), line);
      expect(end.status).toBe('success');
      const ratio = craftOutcome(end).qualityRatio;
      expect(ratio).toBeGreaterThanOrEqual(atLeast);
      if (below !== undefined) expect(ratio).toBeLessThan(below);
    });
  }

  it('no legal board up to stage 4 makes ★5 at band 1 without tools when every turn is 보통', { timeout: 30_000 }, () => {
    expect(checkLayout(STAGE4, 4)).toBeNull();
    const best = bestAllNormal(startCraft(makeSetup({ craftNo: NORMAL_CRAFT, nodes: STAGE4 })));
    expect(best).toBeGreaterThanOrEqual(0.9);
    expect(best).toBeLessThan(1);
  });
});

/** Basic hammers to finish, and quality cap in basic touches, for a band and tool level. */
function load(band: number, toolLevel: number): { hammers: number; touches: number } {
  const r = recipeFor({ weaponType: 'oneHandSword', materialTier: band, bossMaterial: null });
  const s = smithStats({ nodes: [], tools: tools(toolLevel) });
  return { hammers: r.progressRequired / s.craftsmanship, touches: r.qualityCap / s.control };
}

describe('tools keep up with the bands (4.2.3, 9.4, 10)', () => {
  const start = load(1, 0);

  it('band 1 without tools is 4 hammers and a cap of 16 touches', () => {
    expect(start.hammers).toBeCloseTo(4);
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
    it(`${p.when}: band ${p.band} with tools ${p.tools} stays a 3~4.5-hammer, 12~17-touch recipe`, () => {
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
