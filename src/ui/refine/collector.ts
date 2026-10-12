// When a batch's finds leave the floor round the anvil for the bag (기획서 10.1 누르기와 묶음).
// The finger lifts (or the fifteenth blow comes): once the last find has landed and a short beat
// has passed (render/refine/layout.ts REFINE_ITEM_FX.collectDelay [튜닝]), they fly. A press inside
// that beat joins the same batch (the finds stay and more land beside them); a press on a full
// batch sends it off first. A press that strikes nothing (an empty pile) still ends with the finds
// flying: the wait starts again from its release. Only the screen's timing; the finds themselves
// are the engine's (CLAUDE.md 규칙 2). Timers are passed in, so tests drive it by hand.

export interface CollectorDeps {
  now(): number;
  schedule(fn: () => void, ms: number): number;
  cancel(id: number): void;
  /** How long after the last landing they wait (ms). */
  delay: number;
  /** Send the finds on the floor into the bag (and start a new batch). */
  collect(): void;
}

export interface Collector {
  /** A find will land at this time (ms, the deps' clock). */
  landing(atMs: number): void;
  /** A press begins. `full`: the batch on the floor has its fifteen and goes now. */
  press(full: boolean): void;
  /** The press ended. `pending`: finds are on the floor (struck this press or before it). */
  release(pending: boolean): void;
  /** Send them now (no wait). */
  flush(): void;
  /** They are waiting to fly. */
  waiting(): boolean;
  dispose(): void;
}

export function makeCollector(deps: CollectorDeps): Collector {
  let timer: number | null = null;
  let landAt = 0;

  const clear = () => {
    if (timer !== null) deps.cancel(timer);
    timer = null;
  };
  const fire = () => {
    timer = null;
    deps.collect();
  };

  return {
    landing(atMs) {
      landAt = Math.max(landAt, atMs);
    },
    press(full) {
      clear();
      if (full) deps.collect();
    },
    release(pending) {
      clear();
      if (!pending) return;
      timer = deps.schedule(fire, Math.max(0, landAt - deps.now()) + deps.delay);
    },
    flush() {
      clear();
      deps.collect();
    },
    waiting: () => timer !== null,
    dispose() {
      clear();
    },
  };
}
