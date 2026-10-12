// The only place that makes the phone vibrate (CLAUDE.md 규칙 4, 기획서 10.1 연출과 진동).
// Screens ask by intent (tap, rare, veryRare), never by pattern. Today it is the web's
// navigator.vibrate (Android browsers; iOS Safari has none, so an iPhone stays still until the app
// is wrapped); when the app is wrapped with Capacitor this file switches to Capacitor Haptics
// (impact and notification styles for the same intents) and nothing else changes.
// The on/off switch is a per-device setting kept through platform/storage.ts. A vibration only
// ever plays out a result the engine has already decided (규칙 2).

import { type SaveStore, webStore } from './storage.ts';

export type HapticIntent = 'tap' | 'rare' | 'veryRare';

/** How hard it buzzes: 'light' is 10.1's numbers (the default), 'firm' a [검증] choice in the 실험 panel. */
export type HapticStrength = 'light' | 'firm';
export const HAPTIC_STRENGTHS: readonly HapticStrength[] = ['light', 'firm'];

type Pattern = number | readonly number[];

/**
 * Web patterns (ms, vibrate / pause / vibrate …) [튜닝] (10.1): one short tap (about 12 ms) per
 * blow; two short for a rare find; two short and a longer one for a very rare find. Each is
 * shorter than the fastest hammer beat (110 ms) but the last, which comes while he stops to look.
 * 'firm' is the same shape with longer pulses: many Android motors (ERM) need 20~30 ms to spin up,
 * so 12 ms may not be felt at all there. Still under the fastest beat.
 * The ms live here, not in src/sim/data: they are the device's mapping of an intent (10.1), and
 * this is the file that changes for Capacitor Haptics. Which rarity asks for which intent is
 * src/sim/data/refine.ts REFINE_HAPTIC.
 */
export const WEB_PATTERNS: Record<HapticStrength, Record<HapticIntent, Pattern>> = {
  light: { tap: 12, rare: [14, 46, 16], veryRare: [14, 46, 16, 70, 60] },
  firm: { tap: 22, rare: [22, 50, 22], veryRare: [22, 50, 22, 70, 70] },
};

/** The default patterns (10.1). */
export const WEB_PATTERN: Record<HapticIntent, Pattern> = WEB_PATTERNS.light;

export const HAPTICS_KEY = 'pref.haptics';
export const HAPTICS_STRENGTH_KEY = 'pref.haptics.strength';

interface Vibrator {
  vibrate?: (pattern: number | number[]) => boolean;
}

export interface Haptics {
  /** The device can vibrate from here (false on iOS Safari and desktops without it). */
  supported(): boolean;
  /** The player's switch (on by default). */
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** How hard it buzzes ('light' by default). */
  strength(): HapticStrength;
  setStrength(s: HapticStrength): void;
  /** Called when the switch or the strength changes (or a saved value arrives). */
  subscribe(listener: () => void): () => void;
  /** Vibrate for this intent; false when switched off or not supported. */
  play(intent: HapticIntent): boolean;
}

/** The haptics on a store and a navigator (tests pass their own). */
export function makeHaptics(store: SaveStore, nav: () => Vibrator | undefined): Haptics {
  let on = true;
  let strength: HapticStrength = 'light';
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  void store.load(HAPTICS_KEY).then((v) => {
    if (v === 'off' && on) {
      on = false;
      emit();
    }
  });
  void store.load(HAPTICS_STRENGTH_KEY).then((v) => {
    if (v === 'firm' && strength !== 'firm') {
      strength = 'firm';
      emit();
    }
  });
  const vibrator = () => {
    try {
      const n = nav();
      return n !== undefined && n !== null && typeof n.vibrate === 'function' ? n : null;
    } catch {
      return null;
    }
  };
  return {
    supported: () => vibrator() !== null,
    enabled: () => on,
    setEnabled(value) {
      if (on === value) return;
      on = value;
      emit();
      void store.save(HAPTICS_KEY, value ? 'on' : 'off');
    },
    strength: () => strength,
    setStrength(value) {
      if (strength === value) return;
      strength = value;
      emit();
      void store.save(HAPTICS_STRENGTH_KEY, value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play(intent) {
      if (!on) return false;
      const v = vibrator();
      if (v === null) return false;
      const p = WEB_PATTERNS[strength][intent];
      try {
        return v.vibrate?.call(v, typeof p === 'number' ? p : [...p]) === true;
      } catch {
        return false;
      }
    },
  };
}

/** The app's haptics. */
export const haptics: Haptics = makeHaptics(webStore, () => globalThis.navigator as Vibrator | undefined);

/** A blow of the hammer. */
export function tap(): boolean {
  return haptics.play('tap');
}

/** A rare find. */
export function rare(): boolean {
  return haptics.play('rare');
}

/** A very rare find. */
export function veryRare(): boolean {
  return haptics.play('veryRare');
}
