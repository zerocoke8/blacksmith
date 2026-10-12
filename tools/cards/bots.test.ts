import { describe, expect, it } from 'vitest';
import { dayOneDeck, rollTurnFire, startCardCraft } from '../../src/sim/cards/index.ts';
import { type CardCraftSetup, endTurn } from '../../src/sim/cards/engine.ts';
import { makeSmartBot, runCraft, simpleBot } from './bots.ts';
import { runSet, SETS, summarize } from './sets.ts';

const setup = (craftNo: number): CardCraftSetup => ({
  seed: 3,
  craftNo,
  recipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: null },
  deck: dayOneDeck(),
  tools: { anvil: 0, whetstone: 0, furnace: 1 },
});

describe('measuring bots', () => {
  it('finish crafts, the same way every time', () => {
    for (const bot of [simpleBot, makeSmartBot()]) {
      for (const craftNo of [1, 2, 3]) {
        const a = runCraft(setup(craftNo), bot);
        const b = runCraft(setup(craftNo), bot);
        expect(a.final).toEqual(b.final);
        expect(a.outcome.success).toBe(true);
        expect(a.cardsPlayed).toBe(a.final.log.filter((e) => e.kind === 'play').length);
      }
    }
  });

  it('the 따져 보는 봇 does not see the order of the 뽑을 더미', () => {
    for (const craftNo of [1, 2, 3, 4]) {
      const s = endTurn(startCardCraft(setup(craftNo)));
      const shuffled = { ...s, drawPile: [...s.drawPile].reverse() };
      expect(makeSmartBot().decide(shuffled)).toEqual(makeSmartBot().decide(s));
    }
  });

  it('the 따져 보는 봇 does not see future fire states or later shuffles', () => {
    // Another stream keeps all that shows (hand, piles, gauges, this turn's fire) and
    // changes every hidden roll still to come.
    let futuresDiffer = 0;
    for (const craftNo of [1, 2, 3, 4, 5]) {
      const s = endTurn(startCardCraft(setup(craftNo)));
      const other = { ...s, setup: { ...s.setup, stream: 'other' } };
      const fires = (stream: string) =>
        [3, 4, 5, 6, 7, 8].map((t) => rollTurnFire({ seed: 3, stream, craftNo }, 'basic', 'default', t, 'normal'));
      if (fires('craft').join() !== fires('other').join()) futuresDiffer += 1;
      expect(makeSmartBot().decide(other)).toEqual(makeSmartBot().decide(s));
    }
    expect(futuresDiffer).toBeGreaterThan(0);
  });

  it('the 단순 봇 does not get worse with a bigger hand (its verdicts would measure the bot)', () => {
    const day1 = SETS.find((x) => x.id === 'day1');
    if (day1 === undefined) throw new Error('no day1 set');
    const medians = [5, 6, 7].map(
      (handSize) => summarize(runSet({ ...day1, rules: { firePreset: 'allNormal', handSize } }, simpleBot, 300, 1, 40)).median,
    );
    expect(medians[0] as number).toBeLessThanOrEqual(medians[1] as number);
    expect(medians[1] as number).toBeLessThanOrEqual(medians[2] as number);
  });

  it("counts turns from the engine's turn summary", () => {
    const run = runCraft(setup(2), simpleBot);
    expect(run.reheatTurns).toBe(run.final.log.filter((e) => e.kind === 'reheat').length);
    expect(run.endedTurns).toBe(run.turns);
    expect(Object.values(run.played).reduce((a, b) => a + (b ?? 0), 0)).toBe(run.cardsPlayed);
    expect(Object.values(run.thrown).reduce((a, b) => a + (b ?? 0), 0)).toBe(run.discarded);
  });
});
