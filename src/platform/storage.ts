// The only place that touches persistent storage (CLAUDE.md).
// Today it is localStorage; when the app is wrapped with Capacitor this file
// switches to the native store and nothing else changes.

export interface SaveStore {
  load(key: string): Promise<string | null>;
  /** true when the value was written; false when storage is missing, full or blocked. */
  save(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'blacksmith:';

/** localStorage, or null where there is none (Node, some private modes). */
function localStore(): Storage | null {
  const store = globalThis.localStorage as Storage | undefined;
  return store !== undefined && store !== null && typeof store.setItem === 'function' ? store : null;
}

export const webStore: SaveStore = {
  async load(key) {
    try {
      return localStore()?.getItem(PREFIX + key) ?? null;
    } catch {
      return null;
    }
  },
  async save(key, value) {
    // Storage can be missing, full or blocked (private mode). The game keeps running,
    // and the caller learns the write did not happen.
    try {
      const store = localStore();
      if (store === null) return false;
      store.setItem(PREFIX + key, value);
      return true;
    } catch {
      return false;
    }
  },
  async remove(key) {
    try {
      localStore()?.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  },
};

/** In-memory store for tests and tools. Writes always succeed. */
export function memoryStore(): SaveStore {
  const data = new Map<string, string>();
  return {
    async load(key) {
      return data.get(key) ?? null;
    },
    async save(key, value) {
      data.set(key, value);
      return true;
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
