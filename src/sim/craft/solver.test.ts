// The all-보통 solver (solver.ts) against a plain search through the engine, and the
// re-planning player built on it (testkit.ts). balance.test.ts leans on both.

import { describe, expect, it } from 'vitest';
import { CRAFT_ACTIONS, type CraftActionId, type CraftNodeId } from '../data/craft.ts';
import { applyAction, checkAction, type CraftSetup, type CraftState, craftOutcome, startCraft } from './engine.ts';
import { recipeFor } from './recipe.ts';
import { checkLayout, type ToolLevels } from './smith.ts';
import { type AllNormalLine, allNormalOutlook, reachesAllNormal, solveAllNormal } from './solver.ts';
import { makeSetup, playReplanning, replayAllNormal } from './testkit.ts';

const tools = (n: number): ToolLevels => ({ anvil: n, whetstone: n, furnace: n });

/**
 * The best line over every line when every turn is 보통, by a plain search through the
 * engine with the free actions in: most quality (the engine caps it), then fewest turns.
 * 불 다시 보기 turns 보통 into 보통, so it is left out, and 최후의 한 수 is not cast again
 * while it still waits (casting it later does the same for the same 1 CP).
 */
function bruteForceAllNormal(start: CraftState): { ratio: number; turns: number } {
  // Per state, the (quality, turns) pairs seen that no other pair beats on both.
  const seen = new Map<string, [number, number][]>();
  let best = { ratio: 0, turns: Number.POSITIVE_INFINITY };
  const dfs = (s: CraftState) => {
    if (s.status === 'success') {
      const ratio = craftOutcome(s).qualityRatio;
      if (ratio > best.ratio || (ratio === best.ratio && s.turn < best.turns)) best = { ratio, turns: s.turn };
      return;
    }
    if (s.status !== 'active') return;
    const key = [
      s.progress,
      s.durability,
      s.cp,
      s.innerQuiet,
      ...Object.values(s.buffs),
      s.turn === 0,
      s.heartAndSoul,
      s.uses.heartAndSoul ?? 0,
    ].join(',');
    const front = seen.get(key) ?? [];
    if (front.some(([q, t]) => q >= s.quality && t <= s.turn)) return;
    seen.set(key, [...front.filter(([q, t]) => q > s.quality || t < s.turn), [s.quality, s.turn]]);
    for (const a of s.stats.actions) {
      if (a === 'carefulObservation' || checkAction(s, a) !== null) continue;
      if (a === 'finalAppraisal' && s.buffs.finalAppraisal > 0) continue;
      dfs({ ...applyAction(s, a), condition: 'normal' });
    }
  };
  dfs(start);
  return best;
}

/** Solves, and checks the engine agrees with the solver about that line. */
function best(setup: CraftSetup): AllNormalLine {
  const line = solveAllNormal(setup);
  const end = replayAllNormal(setup, line.actions);
  expect(end.status).toBe('success');
  expect(end.turn).toBe(line.turns);
  expect(craftOutcome(end).qualityRatio).toBe(line.ratio);
  return line;
}

const STAGE1: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'reflect'];
const STAGE4: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'groundwork', 'reflect'];

describe('the all-보통 solver', () => {
  it('finds the same best line as a plain search through the engine: quality, then fewest turns', { timeout: 60_000 }, () => {
    const setups = [
      makeSetup(),
      makeSetup({ nodes: STAGE1 }),
      makeSetup({ nodes: STAGE4 }),
      makeSetup({ materialTier: 3, tools: tools(10) }),
      makeSetup({ materialTier: 5, tools: tools(20) }),
      // Past the cap: every line that fills it ties, and the fewest turns win.
      makeSetup({ tools: tools(8) }),
      makeSetup({ tools: tools(7), nodes: STAGE1 }),
      makeSetup({ nodes: ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'manipulation', 'reflect', 'greatStrides'] }),
    ];
    for (const setup of setups) {
      const line = best(setup);
      expect({ ratio: line.ratio, turns: line.turns }).toEqual(bruteForceAllNormal(startCraft(setup)));
    }
    expect(best(makeSetup({ tools: tools(8) })).ratio).toBe(1);
  });

  it('folds 대장장이의 감 and 최후의 한 수 in without missing a better line', { timeout: 60_000 }, () => {
    const cases: { setup: CraftSetup; uses: CraftActionId[] }[] = [
      {
        setup: makeSetup({ nodes: ['reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul'] }),
        uses: ['heartAndSoul', 'tricksOfTheTrade', 'greatStrides'],
      },
      { setup: makeSetup({ materialTier: 2, nodes: ['muscleMemory', 'finalAppraisal'] }), uses: ['finalAppraisal'] },
    ];
    for (const { setup, uses } of cases) {
      const line = best(setup);
      for (const a of uses) expect(line.actions).toContain(a);
      expect({ ratio: line.ratio, turns: line.turns }).toEqual(bruteForceAllNormal(startCraft(setup)));
    }
  });

  it('plays 최후의 한 수 and 대장장이의 감 as the engine does on fuller boards', () => {
    const hammer: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'groundwork', 'trainedArm', 'finalAppraisal'];
    expect(checkLayout(hammer, 5)).toBeNull();
    expect(best(makeSetup({ materialTier: 3, nodes: hammer })).actions).toContain('finalAppraisal');
    const fingertip: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul'];
    expect(checkLayout(fingertip, 4)).toBeNull();
    expect(best(makeSetup({ materialTier: 5, tools: tools(20), nodes: fingertip })).actions).toContain('heartAndSoul');
  });

  it('its outlook from the start is the best line, also when the line fills the cap', () => {
    for (const setup of [makeSetup({ materialTier: 5, tools: tools(20), nodes: STAGE4 }), makeSetup({ tools: tools(8) })]) {
      const line = solveAllNormal(setup);
      expect(allNormalOutlook(setup)(startCraft(setup))).toEqual({ quality: line.quality, turns: line.turns });
    }
  });

  it('answers "can any line reach this?" in agreement with the best line', () => {
    const setup = makeSetup({ materialTier: 3, tools: tools(10), nodes: ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'reflect'] });
    const line = solveAllNormal(setup);
    const cap = recipeFor(setup.recipe).qualityCap;
    expect(reachesAllNormal(setup, line.quality / cap)).toBe(true);
    expect(reachesAllNormal(setup, (line.quality + 1) / cap)).toBe(false);
  });
});

describe('the re-planning player', () => {
  it('stops adding quality once the gauge is full (quality past the cap is worth nothing)', () => {
    for (const setup of [makeSetup({ worldSeed: 5, tools: tools(8) }), makeSetup({ worldSeed: 5, tools: tools(7), nodes: STAGE1 })]) {
      const outlook = allNormalOutlook(setup);
      for (let craftNo = 1; craftNo <= 30; craftNo++) {
        const end = playReplanning({ ...setup, craftNo }, outlook);
        expect(craftOutcome(end).tier).toBe(5);
        // Every turn after the gauge is full works toward the finish.
        let quality = 0;
        for (const e of end.log) {
          if (quality >= end.recipe.qualityCap) {
            expect(CRAFT_ACTIONS[e.action].quality).toBe(0);
            expect(['innovation', 'greatStrides']).not.toContain(e.action);
          }
          quality += e.quality;
        }
      }
    }
  });
});
