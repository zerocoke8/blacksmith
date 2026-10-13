import { describe, expect, it } from 'vitest';
import { attachTownInput, CLICK_DROP_MS, type TownInputHandlers, type TownPointer } from './input.ts';

/** An EventTarget that counts its listeners. */
class Counted extends EventTarget {
  n = 0;
  override addEventListener(type: string, fn: EventListenerOrEventListenerObject | null, opts?: AddEventListenerOptions | boolean): void {
    this.n += 1;
    super.addEventListener(type, fn, opts);
  }
  override removeEventListener(type: string, fn: EventListenerOrEventListenerObject | null, opts?: EventListenerOptions | boolean): void {
    this.n -= 1;
    super.removeEventListener(type, fn, opts);
  }
}

/** A DOM-like event with the fields the map reads, at time t (ms). */
function ev(type: string, t: number, fields: Record<string, unknown> = {}): Event {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'timeStamp', { value: t });
  for (const [k, v] of Object.entries(fields)) Object.defineProperty(e, k, { value: v });
  return e;
}

function rig(upTakes = true) {
  const input = new Counted();
  const win = new Counted();
  const seen: string[] = [];
  const h: TownInputHandlers = {
    down: (p: TownPointer, tag) => seen.push(`down ${p.id} ${p.x},${p.y} ${tag ?? '-'}`),
    move: (p) => seen.push(`move ${p.id} ${p.x},${p.y}`),
    up: (p) => {
      seen.push(`up ${p.id}`);
      return upTakes;
    },
    cancel: (id) => seen.push(`cancel ${id}`),
    wheel: (dx, dy) => seen.push(`wheel ${dx},${dy}`),
  };
  const off = attachTownInput(
    {
      input,
      win,
      local: (e) => ({ x: e.clientX - 10, y: e.clientY - 20 }),
      tagOf: (e) => ((e as Event & { tag?: string }).tag ?? null),
    },
    h,
  );
  // A finger as the page sees it: the window's capture listener first, then the map box.
  const finger = (type: 'pointerdown' | 'pointermove' | 'pointerup', t: number, fields: Record<string, unknown> = {}) => {
    const f = { pointerId: 1, clientX: 110, clientY: 220, pointerType: 'touch', button: 0, ...fields };
    if (type === 'pointerdown') win.dispatchEvent(ev(type, t, f));
    input.dispatchEvent(ev(type, t, f));
  };
  /** The browser's click: true when it got through (not dropped). */
  const click = (t: number, detail = 1) => {
    const e = ev('click', t, { detail });
    let through = true;
    const origStop = e.stopPropagation.bind(e);
    Object.defineProperty(e, 'stopPropagation', {
      value: () => {
        through = false;
        origStop();
      },
    });
    win.dispatchEvent(e);
    return through && !e.defaultPrevented;
  };
  return { input, win, seen, off, finger, click };
}

describe('the map’s fingers on the page', () => {
  it('passes fingers on in the map box’s px, with the tag they went down on', () => {
    const r = rig();
    r.finger('pointerdown', 0, { tag: 'bld_forge' });
    r.finger('pointermove', 10, { clientX: 130 });
    r.finger('pointerup', 20, { clientX: 130 });
    expect(r.seen).toEqual(['down 1 100,200 bld_forge', 'move 1 120,200', 'up 1']);
  });

  it('a mouse’s other buttons are not fingers; the wheel moves the map and keeps the page still', () => {
    const r = rig();
    r.finger('pointerdown', 0, { pointerType: 'mouse', button: 2 });
    expect(r.seen).toEqual([]);
    const w = ev('wheel', 5, { deltaX: 3, deltaY: 40 });
    r.input.dispatchEvent(w);
    expect(r.seen).toEqual(['wheel 3,40']);
    expect(w.defaultPrevented).toBe(true);
  });

  it('a lost finger is a cancel', () => {
    const r = rig();
    r.input.dispatchEvent(ev('pointercancel', 0, { pointerId: 4 }));
    r.input.dispatchEvent(ev('lostpointercapture', 1, { pointerId: 5 }));
    expect(r.seen).toEqual(['cancel 4', 'cancel 5']);
  });

  it('drops the one click that follows a touch the map took (it would close the sheet the tap opened)', () => {
    const r = rig();
    r.finger('pointerdown', 0);
    r.finger('pointerup', 80);
    expect(r.click(90)).toBe(false);
    // Only that one: the next click is someone else's.
    expect(r.click(120)).toBe(true);
  });

  it('keeps a click that comes too late, a keyboard’s click, and one after a new touch', () => {
    const late = rig();
    late.finger('pointerdown', 0);
    late.finger('pointerup', 80);
    expect(late.click(80 + CLICK_DROP_MS + 1)).toBe(true);

    const keys = rig();
    keys.finger('pointerdown', 0);
    keys.finger('pointerup', 80);
    expect(keys.click(90, 0)).toBe(true);

    // A finger lifts off the map, then a new touch lands (on the sheet it opened): that touch's click is its own.
    const again = rig();
    again.finger('pointerdown', 0);
    again.finger('pointerup', 80);
    again.win.dispatchEvent(ev('pointerdown', 300));
    expect(again.click(360)).toBe(true);
  });

  it('keeps the click when the map did not take the touch', () => {
    const r = rig(false);
    r.finger('pointerdown', 0);
    r.finger('pointerup', 80);
    expect(r.click(90)).toBe(true);
  });

  it('takes every listener off again, once', () => {
    const r = rig();
    expect(r.input.n).toBeGreaterThan(0);
    expect(r.win.n).toBeGreaterThan(0);
    r.off();
    expect(r.input.n).toBe(0);
    expect(r.win.n).toBe(0);
    r.off();
    expect(r.input.n).toBe(0);
    // Nothing reaches the map any more.
    r.finger('pointerdown', 0);
    expect(r.seen).toEqual([]);
  });
});
