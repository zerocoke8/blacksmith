// Craft prototype save data. Goes through platform/storage.ts only (CLAUDE.md rule 4).
// Everything read back is checked before the engine sees it, and writes land in the
// order they were made, so a slow native store later cannot put an old state back.

import { type SaveStore, webStore } from '../../platform/storage.ts';
import type { Weapon } from '../../sim/core/types.ts';
import {
  allMaterialKeys,
  type CraftState,
  isRecipeInput,
  type MaterialInventory,
  NO_TOOLS,
  type RecipeInput,
  restoreCraftState,
  restoreWeapon,
  startCraft,
  type ToolLevels,
  weaponFromCraft,
} from '../../sim/craft/index.ts';
import { CRAFT_NODE_IDS, type CraftNodeId } from '../../sim/data/craft.ts';

export const SESSION_KEY = 'craft.session';
export const DEV_KEY = 'craft.dev';

/** Prototype stock: plenty of every enchant material (no shop yet). */
export const PROTOTYPE_STOCK = 5;

/** Dev panel limits. Stage 8 = ★1 …; the board cap stops growing at stage 10 (9.2). */
export const DEV_MAX_TOOL = 60;
export const DEV_MAX_FAME_STAGE = 10;

export interface CraftSession {
  version: 1;
  craft: CraftState;
  /** Set once the craft succeeds; slots are filled into it. */
  weapon: Weapon | null;
  inventory: MaterialInventory;
}

/** Stand-ins for world and skill-board data until those screens exist. */
export interface DevSettings {
  version: 1;
  worldSeed: number;
  nextCraftNo: number;
  /** Only used to check the layout against 9.3; the panel does not block anything. */
  fameStage: number;
  nodes: CraftNodeId[];
  tools: ToolLevels;
  lastRecipe: RecipeInput;
}

export function defaultInventory(): MaterialInventory {
  return Object.fromEntries(allMaterialKeys().map((k) => [k, PROTOTYPE_STOCK]));
}

export function defaultDev(): DevSettings {
  return {
    version: 1,
    worldSeed: 1,
    nextCraftNo: 1,
    fameStage: 1,
    nodes: [],
    tools: { ...NO_TOOLS },
    lastRecipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: null },
  };
}

export function weaponIdFor(craft: CraftState): string {
  return `w-${craft.setup.worldSeed}-${craft.setup.craftNo}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A whole number ≥ min, clamped to max, or the fallback when it is not a finite number. */
function whole(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}

/** Dev settings from saved data, field by field; anything broken falls back to the default. */
export function readDev(data: unknown): DevSettings {
  const base = defaultDev();
  if (!isObject(data) || data.version !== 1) return base;
  const saved = data.nodes;
  const tools = isObject(data.tools) ? data.tools : {};
  const recipe = data.lastRecipe;
  return {
    version: 1,
    worldSeed: typeof data.worldSeed === 'number' && Number.isFinite(data.worldSeed) ? data.worldSeed >>> 0 : base.worldSeed,
    nextCraftNo: whole(data.nextCraftNo, 1, Number.MAX_SAFE_INTEGER, base.nextCraftNo),
    fameStage: whole(data.fameStage, 1, DEV_MAX_FAME_STAGE, base.fameStage),
    nodes: Array.isArray(saved) ? CRAFT_NODE_IDS.filter((id) => saved.includes(id)) : base.nodes,
    tools: {
      anvil: whole(tools.anvil, 0, DEV_MAX_TOOL, 0),
      whetstone: whole(tools.whetstone, 0, DEV_MAX_TOOL, 0),
      furnace: whole(tools.furnace, 0, DEV_MAX_TOOL, 0),
    },
    lastRecipe: isRecipeInput(recipe)
      ? { weaponType: recipe.weaponType, materialTier: Math.floor(recipe.materialTier), bossMaterial: recipe.bossMaterial }
      : base.lastRecipe,
  };
}

function readInventory(data: unknown): MaterialInventory {
  if (!isObject(data)) return defaultInventory();
  return Object.fromEntries(allMaterialKeys().map((k) => [k, whole(data[k], 0, Number.MAX_SAFE_INTEGER, 0)]));
}

/** The saved session if the craft in it is whole, else null (the player starts fresh). */
export function readSession(data: unknown): CraftSession | null {
  if (!isObject(data) || data.version !== 1) return null;
  const craft = restoreCraftState(data.craft);
  if (craft === null) return null;
  let weapon: Weapon | null = null;
  if (craft.status === 'success') {
    // A broken weapon record is rebuilt bare from the craft (filled slots are lost).
    weapon = restoreWeapon(data.weapon) ?? weaponFromCraft(craft, weaponIdFor(craft));
  }
  return { version: 1, craft, weapon, inventory: readInventory(data.inventory) };
}

export interface CraftSaves {
  loadDev(): Promise<DevSettings>;
  loadSession(): Promise<CraftSession | null>;
  saveDev(dev: DevSettings): Promise<void>;
  saveSession(session: CraftSession | null): Promise<void>;
  /** The bumped craft number first, then the new session; the session is skipped if the first write fails. */
  saveStart(dev: DevSettings, session: CraftSession): Promise<void>;
}

/** Craft saves on a store. Every load and save runs in call order. */
export function craftSaves(store: SaveStore): CraftSaves {
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  const loadJson = (key: string) =>
    inOrder(async (): Promise<unknown> => {
      const raw = await store.load(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    });
  const writeSession = (session: CraftSession | null) =>
    session === null ? store.remove(SESSION_KEY) : store.save(SESSION_KEY, JSON.stringify(session));

  return {
    loadDev: async () => readDev(await loadJson(DEV_KEY)),
    loadSession: async () => readSession(await loadJson(SESSION_KEY)),
    saveDev: (dev) => inOrder(() => store.save(DEV_KEY, JSON.stringify(dev))),
    saveSession: (session) => inOrder(() => writeSession(session)),
    saveStart: (dev, session) =>
      inOrder(async () => {
        await store.save(DEV_KEY, JSON.stringify(dev));
        await writeSession(session);
      }),
  };
}

/** The app's craft saves (localStorage today, the native store after Capacitor). */
export const craftStore: CraftSaves = craftSaves(webStore);

/**
 * Starts a craft with the next craft number (3.6: +1 every start). The bumped number
 * is written before the session, so a crash in between skips a number, never reuses one.
 */
export function beginCraft(
  saves: CraftSaves,
  dev: DevSettings,
  recipe: RecipeInput,
): { dev: DevSettings; session: CraftSession; saved: Promise<void> } {
  const craft = startCraft({
    worldSeed: dev.worldSeed,
    craftNo: dev.nextCraftNo,
    recipe,
    smith: { nodes: dev.nodes, tools: dev.tools },
  });
  const nextDev: DevSettings = { ...dev, nextCraftNo: dev.nextCraftNo + 1, lastRecipe: recipe };
  const session: CraftSession = { version: 1, craft, weapon: null, inventory: defaultInventory() };
  return { dev: nextDev, session, saved: saves.saveStart(nextDev, session) };
}
