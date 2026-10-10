// What a player who re-plans every turn (testkit.ts playReplanning) gets at the pace points
// of 3.7 and 10장, conditions and all. balance.test.ts holds the all-보통 curve; these are
// slower, so they run in their own file.

import { describe, expect, it } from 'vitest';
import type { QualityTier } from '../core/types.ts';
import { craftOutcome } from './engine.ts';
import type { ToolLevels } from './smith.ts';
import { allNormalOutlook } from './solver.ts';
import { BASIC_PACE, LATE_PACE, makeSetup, PACE_BOSS_MATERIAL, playReplanning } from './testkit.ts';

const tools = (n: number): ToolLevels => ({ anvil: n, whetstone: n, furnace: n });

describe('a player who re-plans every turn', () => {
  it('gets ★4 now and then and ★5 rarely from 기본 recipes with basic actions (4.3)', () => {
    const n = 200;
    for (const p of BASIC_PACE) {
      const setup = makeSetup({ worldSeed: 777, materialTier: p.band, tools: tools(p.tools) });
      const outlook = allNormalOutlook(setup);
      const tiers: Record<QualityTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (let craftNo = 1; craftNo <= n; craftNo++) {
        const outcome = craftOutcome(playReplanning({ ...setup, craftNo }, outlook));
        expect(outcome.success).toBe(true);
        tiers[outcome.tier as QualityTier]++;
      }
      expect(tiers[1] + tiers[2]).toBe(0);
      expect((tiers[4] + tiers[5]) / n).toBeGreaterThan(0.1);
      expect((tiers[4] + tiers[5]) / n).toBeLessThan(0.4);
      expect(tiers[5] / n).toBeLessThan(0.2);
    }
  });

  // Real crafts run longer than the all-보통 line: 단단함·부드러움·좋음 pay for extra turns.
  // The first 전설 (1주, weakest board) runs longest; later ones fill the cap and stop sooner.
  it('finishes the first 전설 (1주) in 25 turns or fewer on average (4.2: 최대 25턴)', { timeout: 120_000 }, () => {
    const p = LATE_PACE[0];
    if (p === undefined) throw new Error('no pace point');
    const setup = makeSetup({
      worldSeed: 777,
      materialTier: p.band,
      tools: tools(p.tools),
      nodes: p.strongest.legendary,
      bossMaterial: PACE_BOSS_MATERIAL,
    });
    const outlook = allNormalOutlook(setup);
    const n = 60;
    let turns = 0;
    for (let craftNo = 1; craftNo <= n; craftNo++) {
      const end = playReplanning({ ...setup, craftNo }, outlook);
      expect(end.status).toBe('success');
      turns += end.turn;
    }
    expect(turns / n).toBeLessThanOrEqual(25);
  });
});
