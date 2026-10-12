// Determinism and saves (기획서 4.2.8): the same seed replays the same craft, the fire and
// deck streams use their own keys, and a saved craft resumes exactly.

import { describe, expect, it } from 'vitest';
import { rngFor } from '../core/rng.ts';
import { CARD_CRAFT_STATE_VERSION, FIRE_STATES } from '../data/cards.ts';
import { dayOneDeck } from './deck.ts';
import {
  abandonCardCraft,
  type CardCraftState,
  cardCraftOutcome,
  cardIdOf,
  cardTurnSummary,
  checkPlay,
  drawPileSummary,
  endTurn,
  playCard,
  playNeeds,
  previewPlay,
  startCardCraft,
} from './engine.ts';
import { fireStatesOf, fireWeights, rollTurnFire } from './fire.ts';
import { parseCardCraft, restoreCardCraft, serializeCardCraft } from './save.ts';
import { cloneCraft, handIds, inHand, layOut, makeCardSetup } from './testkit.ts';

/** A fixed, plain way to play: the first card that can be played safely, else end the turn. */
function step(s: CardCraftState): CardCraftState {
  for (const uid of s.hand) {
    const c = checkPlay(s, uid);
    if (c.ok && !c.breaks) return playCard(s, uid);
  }
  return endTurn(s);
}

function playOut(s: CardCraftState, maxSteps = 300): CardCraftState {
  let x = s;
  for (let i = 0; i < maxSteps && x.status === 'active'; i++) x = step(x);
  return x;
}

/** Ends turns only: plays nothing. */
function passOut(s: CardCraftState): CardCraftState {
  let x = s;
  while (x.status === 'active') x = endTurn(x);
  return x;
}

function fires(s: CardCraftState): string[] {
  return s.log.flatMap((e) => (e.kind === 'turn' ? [e.fire] : []));
}

function fisherYates(seed: number, craftNo: number, k: number, uids: string[]): string[] {
  const rng = rngFor(seed, 'craft', craftNo, 'deck', k);
  const out = [...uids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return out;
}

describe('determinism', () => {
  it('the same setup replays the same craft', () => {
    for (const craftNo of [1, 2, 3, 40]) {
      const setup = makeCardSetup({ seed: 77, craftNo });
      expect(startCardCraft(setup)).toEqual(startCardCraft(setup));
      expect(playOut(startCardCraft(setup))).toEqual(playOut(startCardCraft(setup)));
    }
  });

  it('a state is plain JSON: saving mid-craft and going on gives the same craft', () => {
    for (const craftNo of [1, 5, 9]) {
      let s = startCardCraft(makeCardSetup({ craftNo, deck: [...dayOneDeck(), 'firstTouch', 'carefulHammer'] }));
      for (let i = 0; i < 4; i++) s = step(s);
      const resumed = parseCardCraft(serializeCardCraft(s));
      expect(resumed).toEqual(s);
      expect(playOut(resumed as CardCraftState)).toEqual(playOut(s));
    }
  });

  it('the first shuffle uses (seed, craft, craftNo, deck, 0)', () => {
    const s = startCardCraft(makeCardSetup({ seed: 5, craftNo: 3 }));
    const uids = [...Array.from({ length: 10 }, (_, i) => `c${i}`), 'm0', 'm1'];
    expect([...s.hand, ...s.drawPile]).toEqual(fisherYates(5, 3, 0, uids));
  });

  it('each reshuffle of the 버린 더미 uses the next deck key', () => {
    let s = startCardCraft(makeCardSetup({ seed: 2, craftNo: 8 }));
    s = endTurn(s);
    s = endTurn(s);
    // Turn 3: 2 left in the pile, then the 10 discarded cards are shuffled with key 1.
    const shuffle = s.log.find((e) => e.kind === 'shuffle');
    expect(shuffle).toMatchObject({ kind: 'shuffle', turn: 3, shuffleNo: 1 });
    expect(s.shuffleNo).toBe(2);
    const before = endTurn(startCardCraft(makeCardSetup({ seed: 2, craftNo: 8 })));
    const expected = [...before.drawPile, ...fisherYates(2, 8, 1, [...before.discard, ...before.hand])];
    expect([...s.hand, ...s.drawPile]).toEqual(expected);
  });

  it('fire states come from (…, fire, turn) whatever is played', () => {
    const setup = makeCardSetup({ seed: 11, craftNo: 4, recipe: { weaponType: 'staff', materialTier: 5, bossMaterial: null } });
    const passed = passOut(startCardCraft(setup));
    const played = playOut(startCardCraft(setup));
    const n = Math.min(fires(passed).length, fires(played).length);
    expect(n).toBeGreaterThan(2);
    expect(fires(passed).slice(0, n)).toEqual(fires(played).slice(0, n));
    let previous = 'normal' as (typeof FIRE_STATES)[number];
    fires(passed).forEach((f, i) => {
      expect(f).toBe(rollTurnFire({ seed: 11, stream: 'craft', craftNo: 4 }, 'advanced', 'default', i + 1, previous));
      previous = f as typeof previous;
    });
  });

  it('turn 1 is always 보통', () => {
    for (let craftNo = 1; craftNo <= 100; craftNo++) {
      const s = startCardCraft(
        makeCardSetup({ craftNo, recipe: { weaponType: 'bow', materialTier: 1, bossMaterial: 'dash' }, rules: { firePreset: 'volatile' } }),
      );
      expect(s.fire).toBe('normal');
    }
  });

  it("another stream key draws differently from the idle world's 'craft' stream", () => {
    let differ = 0;
    for (let n = 1; n <= 10; n++) {
      const a = startCardCraft(makeCardSetup({ craftNo: n }));
      const b = startCardCraft(makeCardSetup({ craftNo: n, stream: 'other' }));
      if (handIds(a).join() !== handIds(b).join()) differ += 1;
    }
    expect(differ).toBeGreaterThan(5);
  });

  it('copies the deck at the start: changing the setup later changes nothing', () => {
    const setup = makeCardSetup();
    const s = startCardCraft(setup);
    const copy = JSON.stringify(s);
    setup.deck.push('hammer');
    setup.tools.anvil = 50;
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe('fire rules (4.2.3)', () => {
  const key = { seed: 3, stream: 'craft', craftNo: 1 };

  it('식음 follows 최상 in 고급·전설 only; 좋음 follows 불티', () => {
    expect(rollTurnFire(key, 'advanced', 'default', 5, 'excellent')).toBe('poor');
    expect(rollTurnFire(key, 'legendary', 'default', 5, 'excellent')).toBe('poor');
    expect(rollTurnFire(key, 'legendary', 'default', 5, 'goodOmen')).toBe('good');
    expect(rollTurnFire(key, 'basic', 'default', 5, 'excellent')).toBe(rollTurnFire(key, 'basic', 'default', 5, 'normal'));
  });

  it('each grade shows the doc’s states', () => {
    expect(fireStatesOf('basic')).toEqual(['normal', 'good', 'excellent']);
    expect(fireStatesOf('advanced')).toEqual(['normal', 'good', 'excellent', 'poor', 'sturdy', 'surge']);
    expect(fireStatesOf('legendary')).toEqual(['normal', 'good', 'excellent', 'poor', 'sturdy', 'surge', 'malleable', 'goodOmen']);
  });

  it('rolls match the table: 기본 좋음 12%', () => {
    let good = 0;
    const n = 20_000;
    for (let t = 2; t < n + 2; t++) if (rollTurnFire(key, 'basic', 'default', t, 'normal') === 'good') good += 1;
    expect(good / n).toBeGreaterThan(0.11);
    expect(good / n).toBeLessThan(0.13);
  });

  it('every preset sums to 100%', () => {
    for (const grade of ['basic', 'advanced', 'legendary'] as const) {
      for (const preset of ['default', 'calm', 'volatile', 'allNormal'] as const) {
        expect(fireWeights(grade, preset).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
      }
    }
  });
});

describe('saves', () => {
  const s = startCardCraft(makeCardSetup());

  it('accepts a real state', () => {
    expect(restoreCardCraft(JSON.parse(serializeCardCraft(s)))).not.toBeNull();
    expect(s.version).toBe(CARD_CRAFT_STATE_VERSION);
  });

  it('rejects anything else', () => {
    const broken = (f: (x: Record<string, unknown>) => void): unknown => {
      const x = JSON.parse(serializeCardCraft(s)) as Record<string, unknown>;
      f(x);
      return restoreCardCraft(x);
    };
    expect(restoreCardCraft(null)).toBeNull();
    expect(parseCardCraft('{not json')).toBeNull();
    expect(broken((x) => (x.version = 1))).toBeNull();
    expect(broken((x) => (x.fire = 'stormy'))).toBeNull();
    expect(broken((x) => (x.hand = []))).toBeNull(); // a card went missing
    expect(broken((x) => ((x.cards as Record<string, string>).c0 = 'sword'))).toBeNull();
    expect(broken((x) => (x.buffs = { bellows: -1 }))).toBeNull();
  });

  /** The parts of a saved craft these tests edit by hand. */
  interface Saved {
    rules: Record<string, unknown>;
    setup: { rules: Record<string, unknown>; deck: string[] };
    recipe: Record<string, unknown>;
    smith: Record<string, unknown>;
    cards: Record<string, string>;
    maxDurability: number;
  }
  const edited = (f: (x: Saved) => void): unknown => {
    const x = JSON.parse(serializeCardCraft(s)) as Saved;
    f(x);
    return restoreCardCraft(x);
  };

  it('refuses switches out of range, in both copies of the rules', () => {
    expect(edited((x) => (x.rules.reheatCost = 99))).toBeNull();
    expect(edited((x) => (x.rules.handSize = 0))).toBeNull();
    expect(edited((x) => (x.rules.durabilityDelta = 2.5))).toBeNull();
    // The setup's copy must be the same switches as the craft's.
    expect(edited((x) => (x.setup.rules.reheatCost = 1))).toBeNull();
  });

  it('refuses a recipe, smith, card or 최대 내구도 the setup does not make', () => {
    expect(edited((x) => (x.recipe.qualityCap = 100))).toBeNull();
    expect(edited((x) => (x.recipe.durability = 90))).toBeNull();
    expect(edited((x) => (x.smith.control = 400))).toBeNull();
    expect(edited((x) => (x.smith.handSize = 9))).toBeNull();
    expect(edited((x) => (x.maxDurability = 60))).toBeNull();
    // Swapping two card instances keeps every pile whole but is not the dealt deck.
    expect(
      edited((x) => {
        const c0 = x.cards.c0 as string;
        x.cards.c0 = x.cards.m0 as string;
        x.cards.m0 = c0;
      }),
    ).toBeNull();
    expect(edited((x) => (x.setup.deck = dayOneDeck().reverse()))).toBeNull();
  });

  it('takes a save from before a switch existed, with the switch at its default', () => {
    const x = JSON.parse(serializeCardCraft(s)) as { rules: Record<string, unknown>; setup: { rules: Record<string, unknown> } };
    delete x.rules.durabilityDelta;
    delete x.setup.rules.durabilityDelta;
    const back = restoreCardCraft(x);
    expect(back?.rules.durabilityDelta).toBe(0);
    expect(back?.setup.rules?.durabilityDelta).toBe(0);
    expect(back).toEqual(s);
  });

  it('a finished or failed craft round-trips too', () => {
    const done = playOut(startCardCraft(makeCardSetup({ craftNo: 4 })));
    expect(restoreCardCraft(JSON.parse(serializeCardCraft(done)))).toEqual(done);
    const quit = abandonCardCraft(s);
    expect(restoreCardCraft(JSON.parse(serializeCardCraft(quit)))).toEqual(quit);
  });
});

describe('다시 달구기 log (턴 기록)', () => {
  const start = (furnace: number): CardCraftState =>
    layOut(
      startCardCraft(makeCardSetup({ tools: { anvil: 0, whetstone: 0, furnace }, rules: { firePreset: 'allNormal' } })),
      ['polish', 'hammer', 'precisePolish', 'quench', 'hammer'],
    );

  it('keeps only the kept cards, not the next hand (화로 0 keeps nothing)', () => {
    let s = playCard(start(0), inHand(start(0), 'hammer'));
    s = endTurn(s);
    const e = s.log.find((x) => x.kind === 'reheat');
    if (e?.kind !== 'reheat') throw new Error('no reheat');
    expect(e.kept).toEqual([]);
    expect(e.discarded).toHaveLength(4);
    expect(s.hand).toHaveLength(5);
    // The log is not the hand: changing one leaves the other.
    s.hand.push('c0');
    expect(e.kept).toEqual([]);
  });

  it('화로 1 keeps the one card picked, and the log says that one', () => {
    const s0 = start(1);
    const keep = inHand(s0, 'quench');
    const s = endTurn(s0, [keep]);
    const e = s.log.find((x) => x.kind === 'reheat');
    if (e?.kind !== 'reheat') throw new Error('no reheat');
    expect(e.kept).toEqual([keep]);
    expect(e.discarded).toHaveLength(4);
    expect(s.hand[0]).toBe(keep);
  });

  it("counts the cards fire and 열기 still allowed ('다 내기' = 0)", () => {
    // 정밀 다듬기 needs 좋음, so after the other four it is not 'left'.
    let s = start(0);
    for (const id of ['polish', 'hammer', 'hammer', 'quench'] as const) s = playCard(s, inHand(s, id));
    s = endTurn(s);
    const all = cardTurnSummary(s)[0];
    expect(all).toEqual({
      turn: 1,
      fire: 'normal',
      played: ['polish', 'hammer', 'hammer', 'quench'],
      end: 'reheat',
      allowedLeft: 0,
      discarded: 1,
    });
    // Ending at once leaves four that could have gone (durability does not matter here).
    const empty = cardTurnSummary(endTurn(start(0)))[0];
    expect(empty).toMatchObject({ played: [], end: 'reheat', allowedLeft: 4, discarded: 5 });
    expect(cardCraftOutcome(s).discarded).toBe(1);
  });

  it('the turn summary follows the craft to its end', () => {
    const done = playOut(startCardCraft(makeCardSetup({ craftNo: 2, rules: { firePreset: 'allNormal' } })));
    const turns = cardTurnSummary(done);
    expect(turns).toHaveLength(done.turn);
    expect(turns.slice(0, -1).every((t) => t.end === 'reheat')).toBe(true);
    expect(turns.at(-1)?.end).toBe(done.status);
    expect(turns.flatMap((t) => t.played)).toHaveLength(cardCraftOutcome(done).cardsPlayed);
    expect(cardTurnSummary(abandonCardCraft(startCardCraft(makeCardSetup()))).at(-1)?.end).toBe('failed');
  });
});

describe('what a play needs, and checking it', () => {
  it('깊은 담금질 ends the turn; 다시 피는 불 picks 3', () => {
    const s = layOut(
      startCardCraft(
        makeCardSetup({
          deck: [...dayOneDeck().filter((id) => id !== 'quench'), 'deepQuench'],
          recipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: 'rebirth' },
        }),
      ),
      ['deepQuench', 'rekindle', 'hammer', 'polish', 'hammer'],
    );
    expect(playNeeds(s, inHand(s, 'deepQuench'))).toEqual({ targets: 0, endsTurn: true });
    expect(playNeeds(s, inHand(s, 'rekindle'))).toEqual({ targets: 3, endsTurn: false });
    expect(playNeeds(s, inHand(s, 'hammer'))).toEqual({ targets: 0, endsTurn: false });
  });

  it('checkPlay, previewPlay and playCard agree on keep and targets', () => {
    const s = cloneCraft(
      layOut(
        startCardCraft(makeCardSetup({ deck: [...dayOneDeck().filter((id) => id !== 'quench'), 'deepQuench'] })),
        ['deepQuench', 'hammer', 'polish', 'hammer', 'bellows'],
      ),
    );
    s.durability = 10;
    const uid = inHand(s, 'deepQuench');
    const tooMany = { keep: [inHand(s, 'hammer'), inHand(s, 'polish'), inHand(s, 'bellows')] };
    // 화로 0 keeps nothing.
    expect(checkPlay(s, uid, tooMany)).toEqual({ ok: false, cost: 0, reason: '화로는 0장까지 남겨 준다' });
    expect(previewPlay(s, uid, tooMany)).toBeNull();
    expect(() => playCard(s, uid, tooMany)).toThrow();
    expect(checkPlay(s, uid, { keep: [] }).ok).toBe(true);
    // Targets on a card that takes none.
    expect(checkPlay(s, inHand(s, 'hammer'), { targets: ['c1'] })).toMatchObject({ ok: false, reason: '이 카드는 고를 것이 없다' });
  });
});

describe('reading the state', () => {
  it('the 뽑을 더미 is shown without its order', () => {
    const s = startCardCraft(makeCardSetup());
    const summary = drawPileSummary(s);
    expect(summary.reduce((n, x) => n + x.count, 0)).toBe(s.drawPile.length);
    const counts = new Map<string, number>();
    for (const u of s.drawPile) counts.set(cardIdOf(s, u), (counts.get(cardIdOf(s, u)) ?? 0) + 1);
    for (const x of summary) expect(counts.get(x.card)).toBe(x.count);
  });

  it('a preview shows the gauge changes without changing the state', () => {
    const s = startCardCraft(makeCardSetup({ rules: { firePreset: 'allNormal' } }));
    const before = JSON.stringify(s);
    for (const uid of s.hand) {
      const p = previewPlay(s, uid);
      const c = checkPlay(s, uid);
      if (!c.ok) {
        expect(p).toBeNull();
        continue;
      }
      const after = playCard(s, uid);
      expect(p).toEqual({
        cost: c.cost,
        finishes: c.finishes,
        breaks: c.breaks,
        progress: after.progress - s.progress,
        quality: after.quality - s.quality,
        durability: after.durability - s.durability,
        heat: after.heat - s.heat,
      });
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});
