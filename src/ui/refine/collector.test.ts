import { describe, expect, it } from 'vitest';
import { makeCollector } from './collector.ts';

/** A hand-moved clock with timers. */
function rig(delay = 280) {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let collected = 0;
  const c = makeCollector({
    now: () => now,
    schedule(fn, ms) {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    cancel: (id) => timers.delete(id),
    delay,
    collect: () => {
      collected += 1;
    },
  });
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  return {
    c,
    advance,
    collected: () => collected,
    get now() {
      return now;
    },
  };
}

describe('batch collector', () => {
  it('sends the finds once the last has landed and the beat has passed', () => {
    const r = rig();
    r.c.press(false);
    r.c.landing(r.now + 360);
    r.c.release(true);
    r.advance(360 + 279);
    expect(r.collected()).toBe(0);
    r.advance(2);
    expect(r.collected()).toBe(1);
    expect(r.c.waiting()).toBe(false);
  });

  it('lets a press inside the beat join the same batch', () => {
    const r = rig();
    r.c.press(false);
    r.c.landing(r.now + 360);
    r.c.release(true);
    r.advance(500);
    r.c.press(false);
    r.advance(2000);
    expect(r.collected()).toBe(0);
    r.c.landing(r.now + 360);
    r.c.release(true);
    r.advance(360 + 281);
    expect(r.collected()).toBe(1);
  });

  it('still sends the finds after a press that struck nothing (an empty pile)', () => {
    // The pile ran out on the last tap; a quick second tap inside the beat strikes nothing.
    const r = rig();
    r.c.press(false);
    r.c.landing(r.now + 360);
    r.c.release(true);
    r.advance(150);
    r.c.press(false);
    r.c.release(true);
    r.advance(10_000);
    expect(r.collected()).toBe(1);
  });

  it('sends a full batch at once when pressed again', () => {
    const r = rig();
    r.c.landing(360);
    r.c.release(true);
    r.c.press(true);
    expect(r.collected()).toBe(1);
    r.c.release(false);
    r.advance(5000);
    expect(r.collected()).toBe(1);
  });

  it('waits for nothing when nothing is on the floor', () => {
    const r = rig();
    r.c.press(false);
    r.c.release(false);
    expect(r.c.waiting()).toBe(false);
    r.advance(5000);
    expect(r.collected()).toBe(0);
  });

  it('can send them now', () => {
    const r = rig();
    r.c.landing(360);
    r.c.release(true);
    r.c.flush();
    expect(r.collected()).toBe(1);
    r.advance(5000);
    expect(r.collected()).toBe(1);
  });
});
