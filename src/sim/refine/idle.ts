// 방치 보상 (기획서 6.8, 7.1): what the server counts while the player is away — lumps at the best
// floor's rate (idleLumpsPerHour), up to the offline cap (idleLumpCap, 12 hours' worth), tagged with
// the best floor's band. Pure: the server (src/platform/server.ts stands in for it today) keeps the
// clock below and calls this with its own time. Time past the cap is thrown away (a freeze line,
// 12.5: never raised for money or ads).

import { idleLumpCap, idleLumpsPerHour, lumpBandOf } from '../data/refine.ts';

/** The server's count: the minute counted up to and the part-lump (60ths) carried. */
export interface IdleClock {
  at: number;
  carry: number;
}

export function newIdleClock(nowMinute: number): IdleClock {
  return { at: Math.floor(Number.isFinite(nowMinute) ? nowMinute : 0), carry: 0 };
}

export interface IdleGain {
  clock: IdleClock;
  /** Lumps that came in. */
  gained: number;
  /** The band they carry (7.1). */
  band: number;
  /** The offline cap was reached (the rest of the time was thrown away). */
  capped: boolean;
}

/**
 * Lumps from the clock's minute to nowMinute at the best floor's rate. Path independent below the
 * cap (counting at t1 then t2 = counting once at t2). A clock behind the counted minute adds nothing.
 */
export function idleGain(clock: IdleClock, nowMinute: number, bestFloor: number): IdleGain {
  const now = Math.floor(Number.isFinite(nowMinute) ? nowMinute : clock.at);
  const band = lumpBandOf(bestFloor);
  if (now <= clock.at) return { clock, gained: 0, band, capped: false };
  const cap = idleLumpCap(bestFloor);
  const total = clock.carry + (now - clock.at) * idleLumpsPerHour(bestFloor);
  const lumps = Math.floor(total / 60);
  if (lumps >= cap) return { clock: { at: now, carry: 0 }, gained: cap, band, capped: true };
  return { clock: { at: now, carry: total - lumps * 60 }, gained: lumps, band, capped: false };
}
