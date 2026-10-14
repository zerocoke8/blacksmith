// What the hero cards under the field read (HeroCardRow): each hero's HP as the field shows it (the
// cues as they play: a blow, a heal, a fall) and its signature gauge as the live play shows it
// (live.ts). A signature's wind-up starts half a second before its tick (timeline.ts lead), so from
// that cue until the gauge empties on screen the card shows it firing (full, pressed in), not a
// gauge still filling under the signature's name. The screen resets it for each new fight and hands
// it the fight's play. Pure.

import type { Cue } from '../../render/battle/timeline.ts';
import { type LiveGauge, type LivePlay, NO_GAUGE } from './live.ts';

export interface CardFeed {
  /** A new fight on the field: these heroes, at full HP, gauges empty, no play yet. */
  reset(heroes: readonly { id: string; maxHp: number }[]): void;
  /** A cue as the field plays it. */
  cue(c: Cue): void;
  /** The fight's end as the engine left it (a skipped fight jumps there without playing its cues). */
  settle(heroHp: Readonly<Record<string, number>>): void;
  hp(id: string): number;
  gauge(id: string): LiveGauge;
  /** The fight playing (kept after its end, so the cards hold their last look until the next reset). */
  play: LivePlay | null;
}

/** How a card looks this frame (rounded, so a card is redrawn only when it would look different). */
export interface CardLook {
  /** HP share, in steps of 1/200. */
  hp: number;
  /** Gauge share, in steps of 1/100; 0 for a hero without a signature. */
  gauge: number;
  /** The gauge is full and the hero stands: glows, and a tap fires it. */
  ready: boolean;
  /** Tapped; its signature is coming. */
  ordered: boolean;
  down: boolean;
}

export function cardLook(hero: { id: string; maxHp: number; signature: boolean }, feed: Pick<CardFeed, 'hp' | 'gauge'>): CardLook {
  const hp = feed.hp(hero.id);
  const g = hero.signature ? feed.gauge(hero.id) : NO_GAUGE;
  const down = hp <= 0;
  return {
    hp: Math.round(Math.max(0, Math.min(1, hp / Math.max(1, hero.maxHp))) * 200) / 200,
    gauge: g.has ? Math.round(g.share * 100) / 100 : 0,
    ready: g.has && g.ready && !g.ordered && !down,
    ordered: g.has && g.ordered && !down,
    down,
  };
}

export function sameLook(a: readonly CardLook[], b: readonly CardLook[]): boolean {
  return a.length === b.length && a.every((x, i) => {
    const y = b[i] as CardLook;
    return x.hp === y.hp && x.gauge === y.gauge && x.ready === y.ready && x.ordered === y.ordered && x.down === y.down;
  });
}

export function makeCardFeed(): CardFeed {
  const hp = new Map<string, number>();
  /** Heroes whose signature wind-up is playing, until their gauge empties on screen. */
  const firing = new Set<string>();
  const feed: CardFeed = {
    play: null,
    reset(heroes) {
      hp.clear();
      firing.clear();
      for (const h of heroes) hp.set(h.id, h.maxHp);
      feed.play = null;
    },
    cue(c) {
      if ((c.kind === 'impact' || c.kind === 'heal') && hp.has(c.dst)) hp.set(c.dst, c.hpAfter);
      else if (c.kind === 'down' && hp.has(c.unit)) hp.set(c.unit, 0);
      else if (c.kind === 'act' && c.action === 'ultimate' && hp.has(c.unit)) firing.add(c.unit);
    },
    settle(heroHp) {
      for (const [id, v] of Object.entries(heroHp)) if (hp.has(id)) hp.set(id, Math.max(0, v));
    },
    hp: (id) => hp.get(id) ?? 0,
    gauge: (id) => {
      const g = feed.play?.gauge(id) ?? NO_GAUGE;
      if (!firing.has(id)) return g;
      // The gauge empties on screen on the signature's own tick: the firing look ends there.
      if (g.share < 0.5) {
        firing.delete(id);
        return g;
      }
      return { ...g, share: 1, ready: false, ordered: true };
    },
  };
  return feed;
}
