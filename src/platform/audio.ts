// The only place that makes sound (기획서 10.1 연출과 진동 '망치 소리', CLAUDE.md 규칙 4).
// Screens ask by intent (hit, hitBright, rare, veryRare), never by waveform. Every sound is
// synthesised with the Web Audio API (no sound files, no packages): the hammer's clank is a few
// inharmonic partials like a struck bar, a short thud under it and a click of noise on top; a rare
// find adds a short chime, a very rare one a longer rising one. When the app is wrapped with
// Capacitor this file may switch to native audio and nothing else changes.
// Browsers start sound only from a touch or a click, so the screen calls unlock() from its press
// handlers. The on/off switch is a per-device setting kept through platform/storage.ts. A sound only
// ever plays out a result the engine has already decided (규칙 2).

import { type SaveStore, webStore } from './storage.ts';

export type SoundIntent = 'hit' | 'hitBright' | 'rare' | 'veryRare' | 'strike' | 'crit' | 'heal';

export const SOUND_KEY = 'pref.sound';

/**
 * The sounds (device mapping, like platform/haptics.ts WEB_PATTERN; the game decides only which
 * intent plays). pitch: the clank's lowest partial (Hz); ring: how long it rings (s); thud: the
 * weight under it (0~1); chime: notes (Hz) of the chime over it, `gap` s apart, ringing `chimeRing` s.
 */
export const SOUND_RECIPE: Record<
  SoundIntent,
  { pitch: number; ring: number; thud: number; chime: readonly number[]; gap: number; chimeRing: number; clank?: number }
> = {
  hit: { pitch: 540, ring: 0.2, thud: 0.9, chime: [], gap: 0, chimeRing: 0 },
  hitBright: { pitch: 610, ring: 0.24, thud: 0.8, chime: [], gap: 0, chimeRing: 0 },
  rare: { pitch: 610, ring: 0.26, thud: 0.8, chime: [1318.5, 1975.5], gap: 0.07, chimeRing: 0.5 },
  veryRare: { pitch: 660, ring: 0.3, thud: 1, chime: [1046.5, 1318.5, 1568, 2093], gap: 0.09, chimeRing: 0.9 },
  // The battle (6장, stand-ins until the ElevenLabs sounds of tools/art/README.md): a soft thump for a
  // blow, a brighter clank with a ping for a crit, a little rising chime with no clank for a heal.
  strike: { pitch: 260, ring: 0.07, thud: 0.8, chime: [], gap: 0, chimeRing: 0, clank: 0.35 },
  crit: { pitch: 520, ring: 0.14, thud: 1, chime: [1760], gap: 0.03, chimeRing: 0.18 },
  heal: { pitch: 0, ring: 0, thud: 0, chime: [880, 1174.7, 1568], gap: 0.06, chimeRing: 0.35, clank: 0 },
};

/** A struck bar's partials: frequency ratios to the lowest one and their loudness. */
const PARTIALS: readonly { ratio: number; gain: number }[] = [
  { ratio: 1, gain: 0.3 },
  { ratio: 2.76, gain: 0.2 },
  { ratio: 5.4, gain: 0.1 },
  { ratio: 8.93, gain: 0.05 },
];

/** Overall loudness, and how much each blow's pitch wanders (±, so fifteen blows are not one sample). */
const MASTER = 0.55;
const WANDER = 0.03;

export type AudioCtor = new (options?: AudioContextOptions) => AudioContext;

export interface Sound {
  /** The browser can make sound here. */
  supported(): boolean;
  /** The player's switch (on by default). */
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** Called when the switch changes (or its saved value arrives). */
  subscribe(listener: () => void): () => void;
  /** Wake the sound from inside a touch, click or key press (browsers start it only there). */
  unlock(): void;
  /** Play this intent now; false when switched off, not supported or not started yet. */
  play(intent: SoundIntent): boolean;
}

/** The sound on a store and an AudioContext constructor (tests pass their own). */
export function makeSound(store: SaveStore, ctor: () => AudioCtor | undefined, random: () => number = Math.random): Sound {
  let on = true;
  let ctx: AudioContext | null = null;
  let out: AudioNode | null = null;
  let noise: AudioBuffer | null = null;
  /** The silent sample has played once (iOS); later presses only resume a suspended context. */
  let woke = false;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  void store.load(SOUND_KEY).then((v) => {
    if (v === 'off' && on) {
      on = false;
      emit();
    }
  });

  const Ctor = (): AudioCtor | null => {
    try {
      return ctor() ?? null;
    } catch {
      return null;
    }
  };

  /** The context and its output (a gentle limiter so a chime over a clank never clips). */
  const context = (): AudioContext | null => {
    if (ctx !== null) return ctx;
    const C = Ctor();
    if (C === null) return null;
    try {
      ctx = new C({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.gain.value = MASTER;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -10;
      limit.ratio.value = 6;
      master.connect(limit);
      limit.connect(ctx.destination);
      out = master;
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.05));
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = random() * 2 - 1;
    } catch {
      ctx = null;
      out = null;
    }
    return ctx;
  };

  /** One decaying tone: up in 2 ms, then down to silence over `ring` s. */
  const tone = (c: AudioContext, to: AudioNode, type: OscillatorType, hz: number, gain: number, at: number, ring: number, dropTo?: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    if (dropTo !== undefined) o.frequency.exponentialRampToValueAtTime(dropTo, at + ring);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    o.connect(g);
    g.connect(to);
    o.start(at);
    o.stop(at + ring + 0.03);
  };

  const clank = (c: AudioContext, to: AudioNode, intent: SoundIntent) => {
    const r = SOUND_RECIPE[intent];
    const t = c.currentTime + 0.005;
    const pitch = r.pitch * (1 + (random() * 2 - 1) * WANDER);
    const loud = r.clank ?? 1;
    if (loud > 0) PARTIALS.forEach((p, i) => tone(c, to, 'sine', pitch * p.ratio, p.gain * loud, t, r.ring * (1 - i * 0.18)));
    // The weight of the hammer: a low thump that drops.
    if (r.thud > 0) tone(c, to, 'sine', 150, 0.5 * r.thud, t, 0.09, 70);
    // The click of the face on the lump: a burst of noise through a band.
    if (noise !== null && loud > 0) {
      const n = c.createBufferSource();
      n.buffer = noise;
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 3200;
      band.Q.value = 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      n.connect(band);
      band.connect(g);
      g.connect(to);
      n.start(t);
      n.stop(t + 0.05);
    }
    r.chime.forEach((hz, i) => tone(c, to, 'triangle', hz, 0.16, t + 0.05 + i * r.gap, r.chimeRing));
  };

  const api: Sound = {
    supported: () => Ctor() !== null,
    enabled: () => on,
    setEnabled(value) {
      if (on === value) return;
      on = value;
      emit();
      void store.save(SOUND_KEY, value ? 'on' : 'off');
      if (value) api.unlock();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unlock() {
      if (!on) return;
      const c = context();
      if (c === null || (woke && c.state === 'running')) return;
      woke = true;
      try {
        if (c.state === 'suspended') void c.resume().catch(() => undefined);
        // iOS wakes the output only once something has played inside the gesture: one silent sample.
        const b = c.createBuffer(1, 1, c.sampleRate);
        const s = c.createBufferSource();
        s.buffer = b;
        s.connect(c.destination);
        s.start();
      } catch {
        // nothing to wake
      }
    },
    play(intent) {
      if (!on) return false;
      const c = context();
      if (c === null || out === null) return false;
      try {
        if (c.state === 'suspended') void c.resume().catch(() => undefined);
        if (c.state === 'closed') return false;
        clank(c, out, intent);
        return true;
      } catch {
        return false;
      }
    },
  };
  return api;
}

/** The app's sound. */
export const sound: Sound = makeSound(
  webStore,
  () => (globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined,
);
