// The art table's rows, top to bottom (ArtTable): the top band, the scene, the gauge band right
// over the cards, the hand and the bottom row. Pure geometry, no DOM; the numbers are
// render/forge/layout.ts TABLE_ROWS. ArtTable sizes its rows from this, so what the tests check
// here is the screen's own layout.

import { CARD_ASPECT, HAND_FAN, TABLE_ROWS } from '../../render/forge/layout.ts';
import { fanPlaces, handCardWidth } from './fan.ts';

/** A row: its top edge and height (px, from the top of the table's safe area). */
export interface Row {
  y: number;
  h: number;
}

export interface TableRows {
  w: number;
  h: number;
  top: Row;
  scene: Row;
  band: Row;
  hand: Row;
  foot: Row;
  /** The tallest a lifted card may be: the gauge band rises over it by at most riseShare of the scene. */
  liftMaxH: number;
  /** The tallest a lifted card may be with the band held still (실험 패널): it stays in the hand's row. */
  liftMaxHStill: number;
}

/** The rows of a table w×h (the safe area inside the notch and the home bar). */
export function tableRows(w: number, h: number): TableRows {
  const R = TABLE_ROWS;
  const short = h < R.shortH;
  const top = short ? R.topShort : R.top;
  const band = short ? R.bandShort : R.band;
  const foot = short ? R.footShort : R.foot;
  let hand = Math.round(Math.max(R.hand.min, Math.min(R.hand.max, w * R.hand.k + R.hand.add)));
  let scene = h - top - band - foot - hand;
  if (scene < R.sceneMin) {
    // A very short screen: the hand gives way first, down to its floor.
    const give = Math.max(0, Math.min(hand - R.hand.min, R.sceneMin - scene));
    hand -= give;
    scene += give;
  }
  scene = Math.max(0, Math.floor(scene));
  const rise = R.riseShare * scene;
  return {
    w,
    h,
    top: { y: 0, h: top },
    scene: { y: top, h: scene },
    band: { y: top + scene, h: band },
    hand: { y: top + scene + band, h: hand },
    foot: { y: top + scene + band + hand, h: foot },
    liftMaxH: Math.max(hand - HAND_FAN.bottom, (hand - HAND_FAN.bottom - R.riseGap + rise) / (1 + HAND_FAN.liftUp)),
    liftMaxHStill: (hand - HAND_FAN.bottom - R.riseGap) / (1 + HAND_FAN.liftUp),
  };
}

/** The card width of a hand of n in these rows. */
export function rowsCardWidth(rows: TableRows, n: number): number {
  return handCardWidth(rows.w, rows.hand.h, n);
}

/**
 * How far (px) the gauge band rises while a card of a hand of n is lifted, so the lifted card
 * never covers it: riseGap over the lifted card's top, or 0 when the card stays in the hand's row.
 */
export function bandRise(rows: TableRows, n: number): number {
  if (n <= 0) return 0;
  const cw = rowsCardWidth(rows, n);
  const lifted = fanPlaces(n, rows.w, rows.hand.h, cw, 0, rows.liftMaxH)[0];
  if (lifted === undefined) return 0;
  return Math.max(0, Math.ceil(TABLE_ROWS.riseGap - lifted.y));
}

/** The lifted card's height for a hand of n (its width over CARD_ASPECT); still = the band held still. */
export function liftedHeight(rows: TableRows, n: number, still = false): number {
  const cw = rowsCardWidth(rows, n);
  const lifted = fanPlaces(Math.max(1, n), rows.w, rows.hand.h, cw, 0, still ? rows.liftMaxHStill : rows.liftMaxH)[0];
  return lifted?.h ?? cw / CARD_ASPECT;
}
