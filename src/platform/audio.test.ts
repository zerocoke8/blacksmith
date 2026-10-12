import { describe, expect, it, vi } from 'vitest';
import { type AudioCtor, makeSound, SOUND_KEY, SOUND_RECIPE } from './audio.ts';
import { memoryStore } from './storage.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Just enough of an AudioContext to count what a sound starts. */
function fakeAudio(state: AudioContextState = 'running') {
  const started: { kind: string; hz?: number; type?: string }[] = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn() });
  let made = 0;
  const resume = vi.fn(() => Promise.resolve());
  class Ctx {
    state = state;
    currentTime = 1;
    sampleRate = 8000;
    destination = node();
    resume = resume;
    constructor() {
      made += 1;
    }
    createGain() {
      return { ...node(), gain: param() };
    }
    createDynamicsCompressor() {
      return { ...node(), threshold: param(), ratio: param() };
    }
    createBiquadFilter() {
      return { ...node(), type: '', frequency: param(), Q: param() };
    }
    createBuffer(_c: number, len: number) {
      const data = new Float32Array(len);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      return { ...node(), buffer: null, start: () => started.push({ kind: 'buffer' }), stop: vi.fn() };
    }
    createOscillator() {
      const o = {
        ...node(),
        type: 'sine',
        frequency: { ...param(), setValueAtTime: (hz: number) => (o.hz = hz) },
        hz: 0,
        start: () => started.push({ kind: 'osc', hz: o.hz, type: o.type }),
        stop: vi.fn(),
      };
      return o;
    }
  }
  return { ctor: Ctx as unknown as AudioCtor, started, made: () => made, resume };
}

describe('sound', () => {
  it('rings the hammer, and lays a chime over it for a rare find', () => {
    const a = fakeAudio();
    const s = makeSound(memoryStore(), () => a.ctor, () => 0.5);
    expect(s.supported()).toBe(true);
    expect(s.play('hit')).toBe(true);
    const hit = a.started.filter((x) => x.kind === 'osc').length;
    expect(hit).toBeGreaterThan(2);
    expect(a.started.some((x) => x.kind === 'buffer')).toBe(true);
    a.started.length = 0;
    expect(s.play('veryRare')).toBe(true);
    const chime = a.started.filter((x) => x.type === 'triangle').map((x) => x.hz);
    expect(chime).toEqual([...SOUND_RECIPE.veryRare.chime]);
    // One context for the whole screen.
    expect(a.made()).toBe(1);
  });

  it('is quiet where the browser has no audio, or when switched off, and keeps the switch', async () => {
    expect(makeSound(memoryStore(), () => undefined).play('hit')).toBe(false);
    expect(makeSound(memoryStore(), () => undefined).supported()).toBe(false);
    const store = memoryStore();
    const a = fakeAudio();
    const s = makeSound(store, () => a.ctor);
    s.setEnabled(false);
    expect(s.play('rare')).toBe(false);
    expect(a.started.length).toBe(0);
    await flush();
    expect(await store.load(SOUND_KEY)).toBe('off');
    const again = makeSound(store, () => a.ctor);
    await flush();
    expect(again.enabled()).toBe(false);
  });

  it('wakes a suspended context from a press', () => {
    const a = fakeAudio('suspended');
    const s = makeSound(memoryStore(), () => a.ctor);
    s.unlock();
    expect(a.resume).toHaveBeenCalled();
  });
});
