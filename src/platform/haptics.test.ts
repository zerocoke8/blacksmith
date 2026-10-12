import { describe, expect, it, vi } from 'vitest';
import { HAPTICS_KEY, HAPTICS_STRENGTH_KEY, makeHaptics, WEB_PATTERN, WEB_PATTERNS } from './haptics.ts';
import { memoryStore } from './storage.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('haptics', () => {
  it('vibrates by intent with the web pattern', () => {
    const vibrate = vi.fn(() => true);
    const h = makeHaptics(memoryStore(), () => ({ vibrate }));
    expect(h.supported()).toBe(true);
    expect(h.play('tap')).toBe(true);
    expect(h.play('rare')).toBe(true);
    expect(h.play('veryRare')).toBe(true);
    expect(vibrate.mock.calls).toEqual([[WEB_PATTERN.tap], [[...(WEB_PATTERN.rare as number[])]], [[...(WEB_PATTERN.veryRare as number[])]]]);
  });

  it('calls vibrate on the navigator itself (it throws when detached)', () => {
    const nav = {
      vibrate(this: unknown, _p: number | number[]) {
        if (this !== nav) throw new TypeError('Illegal invocation');
        return true;
      },
    };
    expect(makeHaptics(memoryStore(), () => nav).play('tap')).toBe(true);
  });

  it('does nothing where the device cannot vibrate', () => {
    const h = makeHaptics(memoryStore(), () => ({}));
    expect(h.supported()).toBe(false);
    expect(h.play('tap')).toBe(false);
    expect(makeHaptics(memoryStore(), () => undefined).play('rare')).toBe(false);
    const throws = makeHaptics(memoryStore(), () => ({ vibrate: () => { throw new Error('blocked'); } }));
    expect(throws.play('tap')).toBe(false);
  });

  it('stays still when switched off, and keeps the switch in storage', async () => {
    const store = memoryStore();
    const vibrate = vi.fn(() => true);
    const h = makeHaptics(store, () => ({ vibrate }));
    const seen = vi.fn();
    h.subscribe(seen);
    h.setEnabled(false);
    expect(h.enabled()).toBe(false);
    expect(h.play('tap')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    expect(seen).toHaveBeenCalledTimes(1);
    await flush();
    expect(await store.load(HAPTICS_KEY)).toBe('off');
    // A new start reads the switch back.
    const again = makeHaptics(store, () => ({ vibrate }));
    await flush();
    expect(again.enabled()).toBe(false);
  });

  it('buzzes longer when set firm, keeps the 10.1 numbers by default, and remembers the choice', async () => {
    const store = memoryStore();
    const vibrate = vi.fn(() => true);
    const h = makeHaptics(store, () => ({ vibrate }));
    expect(h.strength()).toBe('light');
    expect(WEB_PATTERN.tap).toBe(12);
    h.setStrength('firm');
    h.play('tap');
    h.play('rare');
    expect(vibrate.mock.calls).toEqual([[WEB_PATTERNS.firm.tap], [[...(WEB_PATTERNS.firm.rare as number[])]]]);
    await flush();
    expect(await store.load(HAPTICS_STRENGTH_KEY)).toBe('firm');
    const again = makeHaptics(store, () => ({ vibrate }));
    await flush();
    expect(again.strength()).toBe('firm');
  });

  it('ends every pattern but the very rare one inside the fastest hammer beat', () => {
    const total = (p: number | readonly number[]) => (typeof p === 'number' ? p : p.reduce((a, b) => a + b, 0));
    for (const set of Object.values(WEB_PATTERNS)) {
      expect(total(set.tap)).toBeLessThan(110);
      expect(total(set.rare)).toBeLessThan(110);
    }
  });
});
