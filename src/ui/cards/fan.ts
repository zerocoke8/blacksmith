// Where each card of the hand lies (ArtHand): a fan along the bottom of the hand box, the lifted
// card laid out bigger so its text reads. Pure geometry, no DOM; numbers in render/forge/layout.ts.

import { CARD_ASPECT, HAND_FAN } from '../../render/forge/layout.ts';

/** A card's slot in the hand box: its top-left corner and size (px), turn (degrees) and stacking. */
export interface FanPlace {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  z: number;
}

/** Degrees between neighbours for a hand of n. */
function spreadOf(n: number): number {
  return n <= 1 ? 0 : Math.min(HAND_FAN.spread, (2 * HAND_FAN.maxFan) / (n - 1));
}

/**
 * Card width for a hand of n in a box w×h: each card under another shows HAND_FAN.show of its
 * width (cost and the start of its name), never wider than the box allows.
 */
export function handCardWidth(w: number, h: number, n: number): number {
  const cap = Math.min(HAND_FAN.maxW, w * HAND_FAN.maxShare, (h - HAND_FAN.top) * CARD_ASPECT);
  if (n <= 1) return Math.max(HAND_FAN.minW, cap);
  const outer = (spreadOf(n) * (n - 1)) / 2;
  // The outer cards lean out by about their height × sin(angle) on each side.
  const lean = (2 * Math.sin((outer * Math.PI) / 180)) / CARD_ASPECT;
  const fit = (w - 2 * HAND_FAN.margin) / (1 + HAND_FAN.show * (n - 1) + lean);
  return Math.max(HAND_FAN.minW, Math.min(cap, fit));
}

/** Width of the lifted card. */
export function liftedWidth(cw: number, w: number): number {
  return Math.max(cw * HAND_FAN.minLift, Math.min(HAND_FAN.liftW, w * HAND_FAN.maxLiftShare));
}

/** The fan for n cards of width cw in a box w×h; `selected` (an index, or −1) is lifted. */
export function fanPlaces(n: number, w: number, h: number, cw: number, selected: number): FanPlace[] {
  const ch = cw / CARD_ASPECT;
  const mid = (n - 1) / 2;
  const spread = spreadOf(n);
  // The outer cards lean out: keep their top corners on screen.
  const overhang = ch * Math.sin((spread * mid * Math.PI) / 180);
  const avail = Math.max(cw, w - 2 * HAND_FAN.margin - 2 * overhang);
  const step = n <= 1 ? 0 : Math.min(cw * 0.84, (avail - cw) / (n - 1));
  const total = cw + step * (n - 1);
  const x0 = (w - total) / 2;
  const baseY = h - ch - 4;
  const out: FanPlace[] = [];
  for (let i = 0; i < n; i++) {
    const off = i - mid;
    let x = x0 + i * step;
    const y = baseY + off * off * ch * 0.012;
    if (selected >= 0 && i === selected) {
      // Laid out bigger, upright, its bottom near the box's bottom, kept inside the box's sides.
      const lw = liftedWidth(cw, w);
      const lh = lw / CARD_ASPECT;
      const centre = Math.max(lw / 2 + 4, Math.min(w - lw / 2 - 4, x + cw / 2));
      out.push({ x: centre - lw / 2, y: h - 4 - lh - lh * HAND_FAN.liftUp, w: lw, h: lh, rot: 0, z: 100 });
      continue;
    }
    if (selected >= 0) {
      // Neighbours step aside so the lifted card reads clearly.
      const d = i - selected;
      x += Math.sign(d) * Math.max(0, cw * HAND_FAN.push - Math.abs(d) * cw * HAND_FAN.pushFalloff);
    }
    out.push({ x, y, w: cw, h: ch, rot: off * spread, z: i });
  }
  return out;
}

/** How much of each card's width shows from under the next one (px); the last card shows whole. */
export function shownWidths(places: readonly FanPlace[]): number[] {
  return places.map((p, i) => {
    const next = places[i + 1];
    return next === undefined ? p.w : Math.max(0, Math.min(p.w, next.x - p.x));
  });
}
