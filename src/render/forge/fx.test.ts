import { describe, expect, it } from 'vitest';
import {
  abandonCardCraft,
  type CardCraftState,
  checkPlay,
  currentTier,
  endTurn,
  playCard,
  startCardCraft,
} from '../../sim/cards/engine.ts';
import { cloneCraft, inHand, layOut, makeCardSetup } from '../../sim/cards/testkit.ts';
import { cardArtKey } from './assets.ts';
import { effectsForPlay, effectsForStart, type FxStep, type PlayFx, snapOf } from './fx.ts';

const calm = { firePreset: 'allNormal' as const };

function start(hand: Parameters<typeof layOut>[1], over: Parameters<typeof makeCardSetup>[0] = {}): CardCraftState {
  const setup = makeCardSetup({ rules: calm, ...over });
  return layOut(startCardCraft(setup), hand);
}

function playOne(s: CardCraftState, id: Parameters<typeof inHand>[1]): { after: CardCraftState; steps: FxStep[] } {
  const after = playCard(s, inHand(s, id));
  return { after, steps: effectsForPlay(s, after) };
}

function only(steps: FxStep[]): PlayFx {
  const plays = steps.filter((x): x is PlayFx => x.kind === 'play');
  expect(plays).toHaveLength(1);
  return plays[0] as PlayFx;
}

function gauges(s: CardCraftState) {
  const { tier: _t, ...rest } = snapOf(s);
  return rest;
}

describe('effectsForPlay: one card', () => {
  const base = start(['hammer', 'polish', 'bellows', 'quench', 'finisher']);

  it('공정 card → strike, with the logged gain', () => {
    const { after, steps } = playOne(base, 'hammer');
    const p = only(steps);
    expect(p.motions).toEqual(['strike']);
    expect(p.gain.progress).toBe(after.progress - base.progress);
    expect(p.gain.progress).toBeGreaterThan(0);
    expect(p.to).toBe('discard');
    expect(p.snap.progress).toBe(after.progress);
  });

  it('품질 card → polish; 마무리 (spends 열기) → finish', () => {
    const a = playOne(base, 'polish');
    expect(only(a.steps).motions).toEqual(['polish']);
    expect(only(a.steps).gain.heat).toBe(1);
    const b = playOne(a.after, 'finisher');
    const p = only(b.steps);
    expect(p.motions).toEqual(['finish']);
    expect(p.gain.heat).toBeLessThan(0);
    expect(p.snap.heat).toBe(0);
  });

  it('풀무질 moves no gauge: its printed buff picks the bellows', () => {
    const { steps } = playOne(base, 'bellows');
    const p = only(steps);
    expect(p.gain).toMatchObject({ progress: 0, quality: 0, heat: 0 });
    expect(p.motions).toEqual(['bellows']);
  });

  it('담금질 → quench, gone to 소멸, restored counted', () => {
    const worn = { ...cloneCraft(base), durability: 10 };
    const { after, steps } = playOne(worn, 'quench');
    const p = only(steps);
    expect(p.motions).toEqual(['quench']);
    expect(p.gain.restored).toBe(after.durability - worn.durability + p.cost);
    expect(p.gain.restored).toBeGreaterThan(0);
    expect(p.to).toBe('exhaust');
  });

  it('재료 카드 → infuse first, tinted by that card', () => {
    const s = start(['ironMelt', 'hammer', 'polish', 'bellows', 'quench']);
    const { steps } = playOne(s, 'ironMelt');
    const p = only(steps);
    expect(p.motions[0]).toBe('infuse');
    expect(p.motions.length).toBeLessThanOrEqual(2);
    expect(p.material).toBe('ironMelt');
    expect(p.legendary).toBe(false);
  });

  it('a card that changes the fire carries it (용의 숨결 → 최상)', () => {
    const s = start(['dragonBreath', 'hammer', 'polish', 'bellows', 'quench'], {
      recipe: { weaponType: 'dagger', materialTier: 1, bossMaterial: 'dragonFury' },
    });
    const { after, steps } = playOne(s, 'dragonBreath');
    const p = only(steps);
    expect(p.legendary).toBe(true);
    expect(p.fireTo).toBe('excellent');
    expect(p.motions).toContain('infuse');
    expect(p.snap.fire).toBe(after.fire);
  });

  it('marks the ★ the card reached', () => {
    const near = { ...cloneCraft(base), quality: Math.ceil(base.recipe.qualityCap * 0.3) - 1 };
    const { steps } = playOne(near, 'polish');
    expect(only(steps).tierUp).toBe(2);
  });
});

describe('effectsForPlay: turns and the end', () => {
  const base = start(['hammer', 'polish', 'bellows', 'quench', 'finisher']);

  it('다시 달구기 → reheat then turn, durability as logged', () => {
    const after = endTurn(base);
    const steps = effectsForPlay(base, after);
    const kinds = steps.map((s) => s.kind).filter((k) => k !== 'shuffle');
    expect(kinds).toEqual(['reheat', 'turn']);
    const reheat = steps.find((s) => s.kind === 'reheat');
    expect(reheat?.kind === 'reheat' && reheat.discarded.length).toBe(5);
    expect(steps[steps.length - 1]?.snap.durability).toBe(after.durability);
    const turn = steps.find((s) => s.kind === 'turn');
    expect(turn?.kind === 'turn' && turn.turn).toBe(2);
  });

  it('완성 → complete with the final ★ and the weapon', () => {
    const done = { ...cloneCraft(base), progress: base.recipe.progressRequired - 1 };
    const { after, steps } = playOne(done, 'hammer');
    expect(after.status).toBe('success');
    const last = steps[steps.length - 1];
    expect(last).toMatchObject({ kind: 'complete', tier: currentTier(after), weaponType: 'oneHandSword', legendary: false });
  });

  it('쇠가 갈라짐 → break; 그만두기 → break (abandoned)', () => {
    const thin = { ...cloneCraft(base), durability: 3 };
    const { after, steps } = playOne(thin, 'polish');
    expect(after.status).toBe('failed');
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'break', abandoned: false });
    const quit = abandonCardCraft(base);
    expect(effectsForPlay(base, quit)).toEqual([expect.objectContaining({ kind: 'break', abandoned: true })]);
  });

  it('nothing for a different craft or an older state', () => {
    const other = startCardCraft(makeCardSetup({ craftNo: 2, rules: calm }));
    expect(effectsForPlay(base, other)).toEqual([]);
    const after = playCard(base, inHand(base, 'hammer'));
    expect(effectsForPlay(after, base)).toEqual([]);
  });
});

describe('effectsForPlay: the bars end on the engine state', () => {
  /** Plays a whole craft: the first card that can go, else 다시 달구기. */
  function* walk(seed: number): Generator<[CardCraftState, CardCraftState]> {
    let s = startCardCraft(makeCardSetup({ seed, deck: [...makeCardSetup().deck, 'thrift', 'kindle'] }));
    for (let i = 0; i < 80 && s.status === 'active'; i++) {
      const uid = s.hand.find((u) => {
        const c = checkPlay(s, u);
        return c.ok && !c.breaks;
      });
      const next = uid !== undefined ? playCard(s, uid) : endTurn(s);
      yield [s, next];
      s = next;
    }
  }

  for (const seed of [1, 7, 42]) {
    it(`seed ${seed}`, () => {
      let n = 0;
      for (const [before, after] of walk(seed)) {
        const steps = effectsForPlay(before, after);
        expect(steps.length).toBeGreaterThan(0);
        const last = steps[steps.length - 1];
        expect(last === undefined ? null : { ...last.snap, tier: undefined }).toEqual({ ...gauges(after), tier: undefined });
        expect(last?.snap.tier).toBe(currentTier(after));
        for (const st of steps) if (st.kind === 'play') expect(st.motions.length).toBeGreaterThan(0);
        n += 1;
      }
      expect(n).toBeGreaterThan(5);
    });
  }
});

describe('effectsForStart', () => {
  it('runes only for a fresh craft with 각인', () => {
    const plain = startCardCraft(makeCardSetup({ rules: calm }));
    expect(effectsForStart(plain)).toEqual([]);
    const marked = startCardCraft(makeCardSetup({ rules: calm, deck: [...makeCardSetup().deck, 'thickAnvil'] }));
    expect(effectsForStart(marked)).toEqual([expect.objectContaining({ kind: 'imprint', cards: ['thickAnvil'] })]);
    const later = endTurn(marked);
    expect(effectsForStart(later)).toEqual([]);
  });
});

describe('cardArtKey', () => {
  it('own id, evolved → original card', () => {
    expect(cardArtKey('hammer')).toBe('hammer');
    expect(cardArtKey('heavyHammer')).toBe('hammer');
    expect(cardArtKey('dragonBreath')).toBe('dragonBreath');
  });
});
