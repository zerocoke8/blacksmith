// 아트 화면 켜기/끄기 (실험 패널): the workshop scene with real cards, or the plain table to
// compare with. A screen preference, not a game rule, so it has its own key in
// platform/storage.ts and both the card prototype and a run's 단조 read it. On by default.

import { useSyncExternalStore } from 'react';
import { webStore } from '../../platform/storage.ts';

const KEY = 'ui.artScreen';

let on = true;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

// Read at start-up, long before anyone reaches the anvil.
void webStore.load(KEY).then((v) => {
  if (v === 'off' && on) {
    on = false;
    emit();
  }
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useArtScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => on,
  );
}

export function setArtScreen(value: boolean): void {
  on = value;
  emit();
  void webStore.save(KEY, value ? 'on' : 'off');
}

// 게이지 띠 따라 올리기 (실험 패널): while a card is lifted, the gauge band rises just over it
// (on, the default), or stays put and the lifted card stays in the hand's row, smaller (off).
// A screen preference too, its own key, read by both labs.
const RISE_KEY = 'ui.bandRise';
let rise = true;

void webStore.load(RISE_KEY).then((v) => {
  if (v === 'off' && rise) {
    rise = false;
    emit();
  }
});

export function useBandRise(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => rise,
    () => rise,
  );
}

export function setBandRise(value: boolean): void {
  rise = value;
  emit();
  void webStore.save(RISE_KEY, value ? 'on' : 'off');
}

let broken = false;
let webgl: boolean | null = null;

/** WebGL is there and the scene has not failed this session. */
export function artScreenUsable(): boolean {
  if (broken) return false;
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
      webgl = gl !== null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

/** The scene could not start: use the plain table until the page is reloaded. */
export function markArtBroken(): void {
  broken = true;
}

/**
 * The art screen is the one on the anvil now (switched on and usable). Play records note it:
 * the art screen always plays with two taps (lift, then play), the plain one only with the
 * 두 번 눌러 내기 switch, so the two are not one sample.
 */
export function artScreenActive(): boolean {
  return on && artScreenUsable();
}
