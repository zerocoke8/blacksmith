import { describe, expect, it } from 'vitest';
import { cardLook, makeCardFeed, sameLook } from './cardFeed.ts';
import type { LiveGauge, LivePlay } from './live.ts';

const hero = { id: 'h0', maxHp: 200, signature: true };

function playWith(g: Partial<LiveGauge>): LivePlay {
  const gauge: LiveGauge = { has: true, share: 0, ready: false, ordered: false, ...g };
  return {
    done: new Promise(() => undefined),
    order: () => undefined,
    setAuto: () => undefined,
    gauge: () => gauge,
    finishNow: () => {
      throw new Error('not here');
    },
    stop: () => undefined,
  };
}

describe('the hero cards under the field (cardFeed)', () => {
  it('follows the HP the field shows: blows, heals, a fall; a new fight starts full', () => {
    const f = makeCardFeed();
    f.reset([hero, { id: 'h1', maxHp: 100 }]);
    expect(f.hp('h0')).toBe(200);
    f.cue({ at: 0, kind: 'impact', src: 'e0', dst: 'h0', via: 'attack', amount: 50, crit: false, good: false, hpAfter: 150 });
    f.cue({ at: 1, kind: 'heal', src: 'h1', dst: 'h0', amount: 20, hpAfter: 170 });
    // A monster's HP is not a card's.
    f.cue({ at: 2, kind: 'impact', src: 'h0', dst: 'e0', via: 'attack', amount: 5, crit: false, good: false, hpAfter: 5 });
    expect(f.hp('h0')).toBe(170);
    expect(f.hp('e0')).toBe(0);
    f.cue({ at: 3, kind: 'down', unit: 'h1' });
    expect(f.hp('h1')).toBe(0);
    f.reset([hero]);
    expect(f.hp('h0')).toBe(200);
    expect(f.play).toBeNull();
    // A skipped fight: straight to the engine's end, for the cards' heroes only.
    f.settle({ h0: 0, h9: 50 });
    expect(f.hp('h0')).toBe(0);
    expect(f.hp('h9')).toBe(0);
  });

  it('looks: HP and gauge shares, ready only when full, standing and not yet tapped', () => {
    const f = makeCardFeed();
    f.reset([hero]);
    expect(cardLook(hero, f)).toEqual({ hp: 1, gauge: 0, ready: false, ordered: false, down: false });
    f.play = playWith({ share: 0.456 });
    expect(cardLook(hero, f).gauge).toBe(0.46);
    f.play = playWith({ share: 1, ready: true });
    expect(cardLook(hero, f).ready).toBe(true);
    f.play = playWith({ share: 1, ready: true, ordered: true });
    expect(cardLook(hero, f)).toMatchObject({ ready: false, ordered: true });
    f.cue({ at: 0, kind: 'down', unit: 'h0' });
    expect(cardLook(hero, f)).toMatchObject({ ready: false, ordered: false, down: true, hp: 0 });
    // A hero without a signature: an empty gauge, never ready.
    f.reset([hero]);
    f.play = playWith({ share: 1, ready: true });
    expect(cardLook({ ...hero, signature: false }, f)).toMatchObject({ gauge: 0, ready: false });
  });

  it('redraws only on a change it would show', () => {
    const a = [{ hp: 0.5, gauge: 0.2, ready: false, ordered: false, down: false }];
    expect(sameLook(a, [{ ...a[0]! }])).toBe(true);
    expect(sameLook(a, [{ ...a[0]!, gauge: 0.21 }])).toBe(false);
    expect(sameLook(a, [])).toBe(false);
  });
});
