// Helpers for card-engine tests: set up a craft and lay out piles by card name.
// Pure like the rest of src/sim; only tests and tools import it.

import type { CardId } from '../data/cards.ts';
import { dayOneDeck } from './deck.ts';
import { type CardCraftSetup, type CardCraftState, cardIdOf, playCard, startCardCraft } from './engine.ts';

export function makeCardSetup(over: Partial<CardCraftSetup> = {}): CardCraftSetup {
  return {
    seed: 1,
    craftNo: 1,
    recipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: null },
    deck: dayOneDeck(),
    tools: { anvil: 0, whetstone: 0, furnace: 0 },
    ...over,
  };
}

/** A copy of the state (tests may then poke fields directly). */
export function cloneCraft(state: CardCraftState): CardCraftState {
  return JSON.parse(JSON.stringify(state)) as CardCraftState;
}

/**
 * Lays out the live cards (hand, draw pile, discard) by card id: `hand` becomes the hand,
 * `draw` goes on top of the draw pile in order, and everything else stays below in its old
 * order. The discard pile is emptied into the bottom of the draw pile unless keepDiscard.
 */
export function layOut(
  state: CardCraftState,
  hand: readonly CardId[],
  draw: readonly CardId[] = [],
  keepDiscard = false,
): CardCraftState {
  const s = cloneCraft(state);
  const pool = keepDiscard ? [...s.hand, ...s.drawPile] : [...s.hand, ...s.drawPile, ...s.discard];
  const take = (id: CardId): string => {
    const i = pool.findIndex((u) => cardIdOf(s, u) === id);
    if (i < 0) throw new Error(`layOut: no live ${id}`);
    return pool.splice(i, 1)[0] as string;
  };
  s.hand = hand.map(take);
  const top = draw.map(take);
  s.drawPile = [...top, ...pool];
  if (!keepDiscard) s.discard = [];
  return s;
}

/** The uid of the first card of this kind in hand. */
export function inHand(state: CardCraftState, id: CardId): string {
  const uid = state.hand.find((u) => cardIdOf(state, u) === id);
  if (uid === undefined) throw new Error(`no ${id} in hand (${state.hand.map((u) => cardIdOf(state, u)).join(', ')})`);
  return uid;
}

/** Plays cards from the hand by id, in order. */
export function playAll(state: CardCraftState, ids: readonly CardId[]): CardCraftState {
  let s = state;
  for (const id of ids) s = playCard(s, inHand(s, id));
  return s;
}

export function handIds(state: CardCraftState): CardId[] {
  return state.hand.map((u) => cardIdOf(state, u));
}

export function startDayOne(over: Partial<CardCraftSetup> = {}): CardCraftState {
  return startCardCraft(makeCardSetup(over));
}
