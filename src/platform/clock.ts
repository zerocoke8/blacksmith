// The only place that reads the device clock (CLAUDE.md, 기획서 3.6).
// The simulation never reads time itself; it is handed world minutes.

export interface Clock {
  /** Wall-clock milliseconds since the Unix epoch. */
  nowMs(): number;
}

export const systemClock: Clock = {
  nowMs: () => Date.now(),
};

/** A clock tests and tools can move by hand. */
export function manualClock(startMs = 0): Clock & { advance(ms: number): void; set(ms: number): void } {
  let now = startMs;
  return {
    nowMs: () => now,
    advance: (ms) => {
      now += ms;
    },
    set: (ms) => {
      now = ms;
    },
  };
}
