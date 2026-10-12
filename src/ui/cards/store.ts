// Card craft prototype save data: the smith's profile (decks, evolutions, 단련, [검증] switches),
// the craft in progress, and the play log. Goes through platform/storage.ts only (CLAUDE.md
// 규칙 4). Everything read back is checked field by field before the engine sees it, and writes
// land in the order they were made.

import { type SaveStore, webStore } from '../../platform/storage.ts';
import { UNIQUE_IDS, type Weapon, WEAPON_TYPES } from '../../sim/core/types.ts';
import {
  allEnchantMaterialKeys,
  type CardCraftState,
  type CardRecipeInput,
  type CardTools,
  dayOneDeck,
  furnaceLevel,
  type MaterialInventory,
  NO_CARD_TOOLS,
  restoreCardCraft,
  restoreCardWeapon,
  type TemperRecord,
  weaponFromCardCraft,
} from '../../sim/cards/index.ts';
import {
  CARD_IDS,
  type CardId,
  type CardRecipeGrade,
  CARDS,
  DURABILITY_DELTA_RANGE,
  FIRE_PRESETS,
  type FirePreset,
  FURNACE_LEVELS,
  HAND_SIZE_RANGE,
  REHEAT_COST,
  REHEAT_COST_RANGE,
} from '../../sim/data/cards.ts';

export const PROFILE_KEY = 'cards.profile';
export const SESSION_KEY = 'cards.session';
export const RECORDS_KEY = 'cards.records';

/** Prototype limits for the [검증] panel. Stage 8 = ★1 …; the unlock cap stops at 12 (9.2). */
export const LAB_MAX_TOOL = 60;
export const LAB_MAX_FAME_STAGE = 10;
export const MAX_MATERIAL_TIER = 15;
/** Enchant materials per kind on the result screen (no shop in the prototype). */
export const PROTOTYPE_STOCK = 5;
/** Play log entries kept; the oldest go first. */
export const RECORD_LIMIT = 500;
/** A pause longer than this between two taps counts as this long (a break, not thinking). */
export const IDLE_CAP_MS = 120_000;

export const GRADES: readonly CardRecipeGrade[] = ['basic', 'advanced', 'legendary'];

/** [검증] switches (16.3). They apply from the next craft; the engine copies them at the start. */
export interface LabSettings {
  /** null = the 화로's hand size. */
  handSize: number | null;
  reheatCost: number;
  coolingIron: boolean;
  firePreset: FirePreset;
  /** Added to every recipe's 내구도 (16.2의 11번; 식는 쇠 with a longer iron). */
  durabilityDelta: number;
  seed: number;
  fameStage: number;
  tools: CardTools;
  /** Prototype shortcut: evolve without the 단련 count. */
  temperFree: boolean;
  /** 4.2.9's two-tap play: the first tap previews, the second plays. */
  tapToPreview: boolean;
}

export interface CardProfile {
  version: 1;
  nextCraftNo: number;
  /** 단계 1 해금 카드 open once the first craft is over (4.2.1, 4.2.2). */
  firstCraftDone: boolean;
  /** One saved deck per recipe grade, used by that grade automatically (4.2.6). */
  decks: Record<CardRecipeGrade, CardId[]>;
  /** 만든 진화 카드 장수. */
  evolved: Partial<Record<CardId, number>>;
  temper: TemperRecord;
  lab: LabSettings;
  lastRecipe: CardRecipeInput;
  /** One-time dwarf lines already shown. */
  seen: string[];
  /** Id of the last craft whose 단련 went into `temper` (so a reload never counts it twice). */
  settled: string | null;
}

/**
 * Time spent on one turn (16.3: 턴마다 고민하는 시간). What happened in the turn is read from
 * the craft's log (cardTurnSummary), the same way the measuring bots read it.
 */
export interface TurnStat {
  turn: number;
  ms: number;
}

export interface CardSession {
  version: 1;
  /** seed-craftNo-start time: names the craft in the play log. */
  id: string;
  craft: CardCraftState;
  /** Set once the craft succeeds; slots are filled into it. */
  weapon: Weapon | null;
  inventory: MaterialInventory;
  fameStage: number;
  tapToPreview: boolean;
  /**
   * The art screen was the table on screen (it always plays with two taps). Missing in sessions
   * saved before it was noted.
   */
  artScreen?: boolean;
  startedAtMs: number;
  endedAtMs: number | null;
  /** Time spent with the craft on screen, each pause capped at IDLE_CAP_MS. */
  activeMs: number;
  turnMs: number;
  turns: TurnStat[];
  pileOpens: number;
  infoOpens: number;
  /** The craft is in the play log and its 단련 is in the profile. */
  recorded: boolean;
  /** 단련 this craft opened ("손에 익었군."). */
  opened: CardId[];
  /** 해금 카드 learned because this was the first craft. */
  learned: CardId[];
}

/** One finished craft in the play log. Korean labels, so it reads as it is when pasted. */
export interface PlayRecord {
  id: string;
  at: string;
  seed: number;
  craftNo: number;
  recipe: { weapon: string; tier: number; material: string; grade: string; boss: string | null };
  settings: {
    hand: number;
    keep: number;
    reheatCost: number;
    coolingIron: boolean;
    fire: string;
    /** 레시피 내구도 ±n (missing in records made before the switch: 0). */
    durabilityDelta?: number;
    fameStage: number;
    anvil: number;
    whetstone: number;
    furnace: number;
    /** Played with two taps: the art screen, or the plain one with 두 번 눌러 내기 on. */
    twoTap: boolean;
    /** Played on the art screen (false = the plain table); missing in records from before it was noted. */
    artScreen?: boolean;
  };
  deck: Record<string, number>;
  result: {
    status: 'success' | 'failed';
    abandoned: boolean;
    tier: number | null;
    tierName: string | null;
    quality: number;
    qualityCap: number;
    qualityPct: number;
    progress: number;
    progressRequired: number;
  };
  hands: number;
  cardsPlayed: number;
  cardsDiscarded: number;
  durabilityLeft: number;
  maxDurability: number;
  played: Record<string, number>;
  discarded: Record<string, number>;
  /**
   * allowedLeft: at 다시 달구기, cards the fire, 열기 and conditions allowed but not played
   * (durability aside; 0 = '다 내기'), null if the turn ended another way. Same as the bots.
   */
  turns: { turn: number; fire: string; played: string[]; allowedLeft: number | null; discarded: number; sec: number }[];
  activeSec: number;
  wallSec: number;
  pileOpens: number;
  cardInfoOpens: number;
}

export function defaultLab(): LabSettings {
  return {
    handSize: null,
    reheatCost: REHEAT_COST,
    coolingIron: false,
    firePreset: 'default',
    durabilityDelta: 0,
    seed: 1,
    fameStage: 1,
    tools: { ...NO_CARD_TOOLS },
    temperFree: false,
    tapToPreview: false,
  };
}

export function defaultProfile(): CardProfile {
  return {
    version: 1,
    nextCraftNo: 1,
    firstCraftDone: false,
    decks: { basic: dayOneDeck(), advanced: dayOneDeck(), legendary: dayOneDeck() },
    evolved: {},
    temper: {},
    lab: defaultLab(),
    lastRecipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: null },
    seen: [],
    settled: null,
  };
}

export function defaultInventory(): MaterialInventory {
  return Object.fromEntries(allEnchantMaterialKeys().map((k) => [k, PROTOTYPE_STOCK]));
}

export function weaponIdFor(craft: CardCraftState): string {
  return `cw-${craft.setup.seed}-${craft.setup.craftNo}`;
}

/** Hand size and keep the next craft will use. */
export function handOf(lab: LabSettings): { hand: number; keep: number } {
  const f = furnaceLevel(lab.tools.furnace);
  return { hand: lab.handSize ?? f.hand, keep: f.keep };
}

// ---------- Reading saved data ----------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A whole number clamped to [min, max], or the fallback when it is not a finite number. */
function whole(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}

function isCardId(v: unknown): v is CardId {
  return typeof v === 'string' && (CARD_IDS as readonly string[]).includes(v);
}

/** Deck cards only: known ids, no material cards. */
function readDeck(v: unknown): CardId[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((id): id is CardId => isCardId(id) && CARDS[id].kind !== 'material');
}

function readCounts(v: unknown, accept: (id: CardId) => boolean): Partial<Record<CardId, number>> {
  const out: Partial<Record<CardId, number>> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (isCardId(k) && accept(k)) {
      const c = whole(n, 0, Number.MAX_SAFE_INTEGER, 0);
      if (c > 0) out[k] = c;
    }
  }
  return out;
}

export function readRecipeInput(v: unknown, fallback: CardRecipeInput): CardRecipeInput {
  if (!isObj(v)) return fallback;
  const type = WEAPON_TYPES.find((t) => t === v.weaponType);
  const boss = v.bossMaterial === null ? null : (UNIQUE_IDS.find((u) => u === v.bossMaterial) ?? undefined);
  if (type === undefined || boss === undefined) return fallback;
  return { weaponType: type, materialTier: whole(v.materialTier, 1, MAX_MATERIAL_TIER, 1), bossMaterial: boss };
}

export function readLab(v: unknown): LabSettings {
  const base = defaultLab();
  if (!isObj(v)) return base;
  const tools = isObj(v.tools) ? v.tools : {};
  return {
    handSize: v.handSize === null ? null : whole(v.handSize, HAND_SIZE_RANGE.min, HAND_SIZE_RANGE.max, 0) || null,
    reheatCost: whole(v.reheatCost, REHEAT_COST_RANGE.min, REHEAT_COST_RANGE.max, base.reheatCost),
    coolingIron: v.coolingIron === true,
    firePreset: FIRE_PRESETS.find((p) => p === v.firePreset) ?? base.firePreset,
    durabilityDelta: whole(v.durabilityDelta, DURABILITY_DELTA_RANGE.min, DURABILITY_DELTA_RANGE.max, 0),
    seed: typeof v.seed === 'number' && Number.isFinite(v.seed) ? v.seed >>> 0 : base.seed,
    fameStage: whole(v.fameStage, 1, LAB_MAX_FAME_STAGE, base.fameStage),
    tools: {
      anvil: whole(tools.anvil, 0, LAB_MAX_TOOL, 0),
      whetstone: whole(tools.whetstone, 0, LAB_MAX_TOOL, 0),
      furnace: whole(tools.furnace, 0, FURNACE_LEVELS.length - 1, 0),
    },
    temperFree: v.temperFree === true,
    tapToPreview: v.tapToPreview === true,
  };
}

/** The saved profile, repaired field by field; anything broken falls back to the default. */
export function readProfile(data: unknown): CardProfile {
  const base = defaultProfile();
  if (!isObj(data) || data.version !== 1) return base;
  const decks = isObj(data.decks) ? data.decks : {};
  return {
    version: 1,
    nextCraftNo: whole(data.nextCraftNo, 1, Number.MAX_SAFE_INTEGER, base.nextCraftNo),
    firstCraftDone: data.firstCraftDone === true,
    decks: {
      basic: readDeck(decks.basic) ?? base.decks.basic,
      advanced: readDeck(decks.advanced) ?? base.decks.advanced,
      legendary: readDeck(decks.legendary) ?? base.decks.legendary,
    },
    evolved: readCounts(data.evolved, (id) => CARDS[id].group === 'evolved'),
    temper: readCounts(data.temper, () => true),
    lab: readLab(data.lab),
    lastRecipe: readRecipeInput(data.lastRecipe, base.lastRecipe),
    seen: Array.isArray(data.seen) ? data.seen.filter((s): s is string => typeof s === 'string') : [],
    settled: typeof data.settled === 'string' ? data.settled : null,
  };
}

function readInventory(v: unknown): MaterialInventory {
  if (!isObj(v)) return defaultInventory();
  return Object.fromEntries(allEnchantMaterialKeys().map((k) => [k, whole(v[k], 0, Number.MAX_SAFE_INTEGER, 0)]));
}

function readTurns(v: unknown): TurnStat[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).map((t) => ({
    turn: whole(t.turn, 0, Number.MAX_SAFE_INTEGER, 0),
    ms: whole(t.ms, 0, Number.MAX_SAFE_INTEGER, 0),
  }));
}

function readCardList(v: unknown): CardId[] {
  return Array.isArray(v) ? v.filter(isCardId) : [];
}

/** The saved session if the craft in it is whole, else null (the player starts fresh). */
export function readSession(data: unknown): CardSession | null {
  if (!isObj(data) || data.version !== 1) return null;
  const craft = restoreCardCraft(data.craft);
  if (craft === null) return null;
  let weapon: Weapon | null = null;
  if (craft.status === 'success') {
    // A broken weapon record is rebuilt bare from the craft (filled slots are lost).
    weapon = restoreCardWeapon(data.weapon) ?? weaponFromCardCraft(craft, weaponIdFor(craft));
  }
  const n = (v: unknown) => whole(v, 0, Number.MAX_SAFE_INTEGER, 0);
  const startedAtMs = n(data.startedAtMs);
  return {
    version: 1,
    id: typeof data.id === 'string' ? data.id : `${craft.setup.seed}-${craft.setup.craftNo}-${startedAtMs}`,
    craft,
    weapon,
    inventory: readInventory(data.inventory),
    fameStage: whole(data.fameStage, 1, LAB_MAX_FAME_STAGE, 1),
    tapToPreview: data.tapToPreview === true,
    ...(typeof data.artScreen === 'boolean' ? { artScreen: data.artScreen } : {}),
    startedAtMs,
    endedAtMs: data.endedAtMs === null || data.endedAtMs === undefined ? null : n(data.endedAtMs),
    activeMs: n(data.activeMs),
    turnMs: n(data.turnMs),
    turns: readTurns(data.turns),
    pileOpens: n(data.pileOpens),
    infoOpens: n(data.infoOpens),
    recorded: data.recorded === true,
    opened: readCardList(data.opened),
    learned: readCardList(data.learned),
  };
}

/**
 * Saved play records; entries without an id or a result are dropped. Records from before the
 * turn notes came from the engine called '다 내기' playableLeft (durability counted); they keep
 * it as allowedLeft, the closest there is.
 */
export function readRecords(data: unknown): PlayRecord[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is PlayRecord => isObj(r) && typeof r.id === 'string' && isObj(r.result) && isObj(r.settings))
    .map((r) => {
      const turns = Array.isArray(r.turns) ? r.turns : [];
      return {
        ...r,
        turns: turns.map((t) => {
          const old = t as Partial<PlayRecord['turns'][number]> & { playableLeft?: number | null };
          return { ...t, allowedLeft: old.allowedLeft ?? old.playableLeft ?? null, discarded: old.discarded ?? 0 };
        }),
      };
    })
    .slice(-RECORD_LIMIT);
}

// ---------- Writing ----------

export interface CardSaves {
  loadAll(): Promise<{ profile: CardProfile; session: CardSession | null; records: PlayRecord[] }>;
  /** Resolve false when the store refused the write (missing, full or blocked). */
  saveProfile(profile: CardProfile): Promise<boolean>;
  saveSession(session: CardSession | null): Promise<boolean>;
  saveRecords(records: PlayRecord[]): Promise<boolean>;
}

/** Card saves on a store. Every load and save runs in call order. */
export function cardSaves(store: SaveStore): CardSaves {
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  const loadJson = async (key: string): Promise<unknown> => {
    const raw = await store.load(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };
  return {
    loadAll: () =>
      inOrder(async () => ({
        profile: readProfile(await loadJson(PROFILE_KEY)),
        session: readSession(await loadJson(SESSION_KEY)),
        records: readRecords(await loadJson(RECORDS_KEY)),
      })),
    saveProfile: (profile) => inOrder(() => store.save(PROFILE_KEY, JSON.stringify(profile))),
    saveSession: (session) =>
      inOrder(async () => {
        if (session !== null) return store.save(SESSION_KEY, JSON.stringify(session));
        await store.remove(SESSION_KEY);
        return true;
      }),
    saveRecords: (records) => inOrder(() => store.save(RECORDS_KEY, JSON.stringify(records))),
  };
}

/** The app's card saves (localStorage today, the native store after Capacitor). */
export const cardStore: CardSaves = cardSaves(webStore);

/**
 * Whether a card craft is on the anvil or waiting on its result screen (slots still to fill):
 * after a reload the home screen goes straight back to it. '다시 만들기' clears it.
 */
export async function hasCardSession(saves: CardSaves = cardStore): Promise<boolean> {
  const { session } = await saves.loadAll();
  return session !== null;
}
