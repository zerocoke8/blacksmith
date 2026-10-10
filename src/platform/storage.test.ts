import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStore, webStore } from './storage.ts';

/** A localStorage stand-in; `full` makes every write throw like a quota error. */
function fakeLocalStorage(full = false): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => {
      if (full) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('webStore', () => {
  it('reports a successful write and reads it back', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    expect(await webStore.save('k', 'v')).toBe(true);
    expect(await webStore.load('k')).toBe('v');
    await webStore.remove('k');
    expect(await webStore.load('k')).toBeNull();
  });

  it('reports a failed write instead of swallowing it', async () => {
    vi.stubGlobal('localStorage', fakeLocalStorage(true));
    expect(await webStore.save('k', 'v')).toBe(false);
    expect(await webStore.load('k')).toBeNull();
  });

  it('reports false when there is no storage at all', async () => {
    vi.stubGlobal('localStorage', undefined);
    expect(await webStore.save('k', 'v')).toBe(false);
    expect(await webStore.load('k')).toBeNull();
    await expect(webStore.remove('k')).resolves.toBeUndefined();
  });
});

describe('memoryStore', () => {
  it('always writes and says so', async () => {
    const store = memoryStore();
    expect(await store.save('a', '1')).toBe(true);
    expect(await store.load('a')).toBe('1');
    await store.remove('a');
    expect(await store.load('a')).toBeNull();
  });
});
