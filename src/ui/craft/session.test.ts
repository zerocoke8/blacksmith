import { describe, expect, it } from 'vitest';
import { memoryStore, type SaveStore } from '../../platform/storage.ts';
import { applyAction, smithStats } from '../../sim/craft/index.ts';
import {
  beginCraft,
  type CraftSession,
  craftSaves,
  DEV_KEY,
  defaultDev,
  readDev,
  readSession,
  SESSION_KEY,
} from './session.ts';

const recipe = { weaponType: 'dagger', materialTier: 1, bossMaterial: null } as const;

/** A store that records writes, can be slow, and can fail one key on demand. */
function recordingStore(opts: { delayMs?: number; failKey?: string } = {}) {
  const inner = memoryStore();
  const writes: string[] = [];
  const wait = () => new Promise<void>((r) => setTimeout(r, opts.delayMs ?? 0));
  const store: SaveStore = {
    load: (key) => inner.load(key),
    async save(key, value) {
      await wait();
      if (key === opts.failKey) throw new Error('disk full');
      writes.push(key);
      await inner.save(key, value);
    },
    async remove(key) {
      await wait();
      writes.push(`-${key}`);
      await inner.remove(key);
    },
  };
  return { store, writes, inner };
}

describe('readDev', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(readDev(null)).toEqual(defaultDev());
    expect(readDev({ version: 2 })).toEqual(defaultDev());
  });

  it('repairs broken fields one by one, so smith stats never turn NaN', () => {
    const dev = readDev({
      version: 1,
      worldSeed: 'seed',
      nextCraftNo: -4,
      fameStage: 99,
      nodes: ['reflect', 'fly', 'reflect', 'wasteNot'],
      tools: { anvil: 'x', whetstone: -2, furnace: 3.7 },
      lastRecipe: { weaponType: 'spear', materialTier: 2, bossMaterial: null },
    });
    expect(dev.worldSeed).toBe(1);
    expect(dev.nextCraftNo).toBe(1);
    expect(dev.fameStage).toBe(10);
    expect(dev.nodes).toEqual(['wasteNot', 'reflect']);
    expect(dev.tools).toEqual({ anvil: 0, whetstone: 0, furnace: 3 });
    expect(dev.lastRecipe).toEqual(defaultDev().lastRecipe);
    const stats = smithStats({ nodes: dev.nodes, tools: dev.tools });
    expect([stats.craftsmanship, stats.control, stats.maxCp].every(Number.isFinite)).toBe(true);
  });

  it('keeps good saved settings', () => {
    const good = { ...defaultDev(), worldSeed: 77, nextCraftNo: 12, fameStage: 4, nodes: ['wasteNot' as const], tools: { anvil: 3, whetstone: 2, furnace: 1 } };
    expect(readDev(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });
});

describe('readSession', () => {
  const { session } = beginCraft(craftSaves(memoryStore()), defaultDev(), recipe);

  it('takes back a whole session', () => {
    expect(readSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  });

  it('drops a session whose craft is broken', () => {
    const broken = JSON.parse(JSON.stringify(session)) as { craft: Record<string, unknown> };
    broken.craft.durability = 'lots';
    expect(readSession(broken)).toBeNull();
    expect(readSession({ version: 1, craft: { version: 1 } })).toBeNull();
    expect(readSession('nope')).toBeNull();
  });

  it('rebuilds a missing weapon for a finished craft and repairs the stock', () => {
    const craft = { ...session.craft, progress: session.craft.recipe.progressRequired - 1 };
    const done = applyAction(craft, 'basicSynthesis');
    expect(done.status).toBe('success');
    const back = readSession({ version: 1, craft: JSON.parse(JSON.stringify(done)), weapon: { broken: true }, inventory: { 'emblem:low': 'x' } });
    expect(back?.weapon?.quality).toBeGreaterThanOrEqual(1);
    expect(back?.inventory['emblem:low']).toBe(0);
  });
});

describe('craft saves', () => {
  it('round-trips dev settings and the session', async () => {
    const saves = craftSaves(memoryStore());
    const { dev, session } = beginCraft(saves, defaultDev(), recipe);
    expect(await saves.loadDev()).toEqual(dev);
    expect(await saves.loadSession()).toEqual(session);
    await saves.saveSession(null);
    expect(await saves.loadSession()).toBeNull();
  });

  it('writes the bumped craft number before the session', async () => {
    const { store, writes } = recordingStore({ delayMs: 2 });
    const saves = craftSaves(store);
    const begun = beginCraft(saves, defaultDev(), recipe);
    expect(begun.session.craft.setup.craftNo).toBe(1);
    expect(begun.dev.nextCraftNo).toBe(2);
    await begun.saved;
    expect(writes).toEqual([DEV_KEY, SESSION_KEY]);
  });

  it('never reuses a craft number when the app dies before the session is written', async () => {
    const { store } = recordingStore({ failKey: SESSION_KEY });
    const saves = craftSaves(store);
    await expect(beginCraft(saves, await saves.loadDev(), recipe).saved).rejects.toThrow();
    // Reopen: no session, and the next craft takes number 2, not 1 again.
    expect(await saves.loadSession()).toBeNull();
    const reopened = await saves.loadDev();
    expect(reopened.nextCraftNo).toBe(2);
  });

  it('skips the session when the craft number could not be written', async () => {
    const { store, writes } = recordingStore({ failKey: DEV_KEY });
    const saves = craftSaves(store);
    await expect(beginCraft(saves, defaultDev(), recipe).saved).rejects.toThrow();
    expect(writes).toEqual([]);
    expect(await saves.loadSession()).toBeNull();
  });

  it('lands writes in call order even on a slow store, so an older state never wins', async () => {
    const { store } = recordingStore({ delayMs: 3 });
    const saves = craftSaves(store);
    const begun = beginCraft(saves, defaultDev(), recipe);
    const next: CraftSession = { ...begun.session, craft: applyAction(begun.session.craft, 'basicSynthesis') };
    void saves.saveSession(next);
    const loaded = await saves.loadSession();
    expect(loaded?.craft.turn).toBe(1);
  });
});
