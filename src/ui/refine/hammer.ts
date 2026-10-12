// The hammer button's press (기획서 10.1 누르기와 묶음): the press strikes at once, and while it is
// held the next blows come faster and faster (sim/refine holdIntervalMs), until the finger lifts,
// the batch has its fifteen, or the pile is empty. A very rare find stops the hammer for a moment
// (he looks at it) before it goes on. The screen keeps this tempo; every blow's result comes
// from the engine (CLAUDE.md 규칙 2). Timers are passed in, so tests drive it by hand.

import { holdIntervalMs } from '../../sim/refine/index.ts';

export interface BlowResult {
  /** A blow was struck. */
  struck: boolean;
  /** The batch is full after it (stop without waiting for the finger). */
  full: boolean;
  /** Wait this long before the next blow instead of the tempo (a very rare find). */
  pauseMs?: number;
}

export interface HammerDeps {
  /** Strike the press's n-th blow (1 = the press itself). */
  blow(n: number): BlowResult;
  /** The press is over (let go, batch full, or nothing more to strike) after `blows` blows. */
  release(blows: number): void;
  schedule(fn: () => void, ms: number): number;
  cancel(id: number): void;
}

export interface Hammer {
  down(): void;
  up(): void;
  /** A press is going on. */
  pressing(): boolean;
  dispose(): void;
}

export function makeHammer(deps: HammerDeps): Hammer {
  let active = false;
  let blows = 0;
  let timer: number | null = null;

  const clear = () => {
    if (timer !== null) deps.cancel(timer);
    timer = null;
  };
  const end = () => {
    if (!active) return;
    active = false;
    clear();
    deps.release(blows);
  };
  const step = () => {
    timer = null;
    if (!active) return;
    const r = deps.blow(blows + 1);
    if (!r.struck) {
      end();
      return;
    }
    blows += 1;
    if (r.full) {
      end();
      return;
    }
    timer = deps.schedule(step, r.pauseMs ?? holdIntervalMs(blows));
  };

  return {
    down() {
      if (active) return;
      active = true;
      blows = 0;
      step();
    },
    up() {
      end();
    },
    pressing: () => active,
    dispose() {
      active = false;
      clear();
    },
  };
}
