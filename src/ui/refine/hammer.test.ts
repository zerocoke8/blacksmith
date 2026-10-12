import { describe, expect, it } from 'vitest';
import { REFINE_BATCH_MAX, REFINE_TEMPO } from '../../sim/data/refine.ts';
import { holdIntervalMs } from '../../sim/refine/index.ts';
import { type BlowResult, makeHammer } from './hammer.ts';

/** A hand-moved clock with timers. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    schedule(fn: () => void, ms: number) {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    cancel(id: number) {
      timers.delete(id);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
    get now() {
      return now;
    },
  };
}

function rig(opts: { lumps?: number; veryRareAt?: number } = {}) {
  const t = fakeTimers();
  let lumps = opts.lumps ?? 1000;
  let inBatch = 0;
  const blowsAt: number[] = [];
  const releases: number[] = [];
  const hammer = makeHammer({
    blow(n): BlowResult {
      if (lumps <= 0 || inBatch >= REFINE_BATCH_MAX) return { struck: false, full: inBatch >= REFINE_BATCH_MAX };
      lumps -= 1;
      inBatch += 1;
      blowsAt.push(t.now);
      return { struck: true, full: inBatch >= REFINE_BATCH_MAX, ...(n === opts.veryRareAt ? { pauseMs: REFINE_TEMPO.veryRarePauseMs } : {}) };
    },
    release(n) {
      releases.push(n);
      inBatch = 0;
    },
    schedule: (fn, ms) => t.schedule(fn, ms),
    cancel: (id) => t.cancel(id),
  });
  return { t, hammer, blowsAt, releases };
}

describe('hammer press', () => {
  it('strikes once on a tap', () => {
    const r = rig();
    r.hammer.down();
    r.t.advance(80);
    r.hammer.up();
    r.t.advance(2000);
    expect(r.blowsAt).toEqual([0]);
    expect(r.releases).toEqual([1]);
  });

  it('keeps striking faster while held, and stops at fifteen', () => {
    const r = rig();
    r.hammer.down();
    r.t.advance(10_000);
    expect(r.blowsAt.length).toBe(REFINE_BATCH_MAX);
    const gaps = r.blowsAt.slice(1).map((at, i) => at - (r.blowsAt[i] ?? 0));
    expect(gaps[0]).toBe(holdIntervalMs(1));
    expect(gaps.at(-1)).toBe(REFINE_TEMPO.minMs);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1] ?? 0);
    // It stopped by itself; letting go later adds nothing.
    expect(r.releases).toEqual([REFINE_BATCH_MAX]);
    expect(r.hammer.pressing()).toBe(false);
    r.hammer.up();
    expect(r.releases).toEqual([REFINE_BATCH_MAX]);
    // The next press is a new batch.
    r.hammer.down();
    r.hammer.up();
    expect(r.blowsAt.length).toBe(REFINE_BATCH_MAX + 1);
  });

  it('stops when the pile runs out', () => {
    const r = rig({ lumps: 3 });
    r.hammer.down();
    r.t.advance(5000);
    expect(r.blowsAt.length).toBe(3);
    expect(r.releases).toEqual([3]);
  });

  it('pauses after a very rare find, then goes on', () => {
    const r = rig({ veryRareAt: 2 });
    r.hammer.down();
    r.t.advance(holdIntervalMs(1) + 1);
    expect(r.blowsAt.length).toBe(2);
    r.t.advance(REFINE_TEMPO.veryRarePauseMs - 2);
    expect(r.blowsAt.length).toBe(2);
    r.t.advance(5);
    expect(r.blowsAt.length).toBe(3);
  });

  it('stops at once when let go mid-hold', () => {
    const r = rig();
    r.hammer.down();
    r.t.advance(holdIntervalMs(1) + holdIntervalMs(2) + 10);
    r.hammer.up();
    r.t.advance(3000);
    expect(r.blowsAt.length).toBe(3);
    expect(r.releases).toEqual([3]);
  });
});
