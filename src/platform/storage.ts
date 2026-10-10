// The only place that touches persistent storage (CLAUDE.md).
// Today it is localStorage; when the app is wrapped with Capacitor this file
// switches to the native store and nothing else changes.

export interface SaveStore {
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'blacksmith:';

export const webStore: SaveStore = {
  async load(key) {
    try {
      return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
    } catch {
      return null;
    }
  },
  async save(key, value) {
    try {
      globalThis.localStorage?.setItem(PREFIX + key, value);
    } catch {
      // Storage can be full or blocked (private mode); the game keeps running.
    }
  },
  async remove(key) {
    try {
      globalThis.localStorage?.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  },
};

/** In-memory store for tests and tools. */
export function memoryStore(): SaveStore {
  const data = new Map<string, string>();
  return {
    async load(key) {
      return data.get(key) ?? null;
    },
    async save(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
