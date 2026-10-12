// 광석 정제 (기획서 10.1). Every number here is a [튜닝] starting value and the same as the
// doc's 10.1 tables; change them here (and in the doc), not at call sites.
// The result table is data: a new ore or gift is one more row (and its icon in
// render/refine/assets.ts). Weights are relative, so adding a row needs no other change; it only
// changes what later blows bring, never what is already in the bag.

import { materialName } from './common.ts';

// ---------- Rarity ----------

/** 희귀도 (10.1): sets how big the effect and the vibration are, not the amount. */
export type RefineRarity = 'common' | 'uncommon' | 'rare' | 'veryRare';
export const REFINE_RARITIES: readonly RefineRarity[] = ['common', 'uncommon', 'rare', 'veryRare'];

export const RARITY_LABEL: Record<RefineRarity, string> = {
  common: '흔함',
  uncommon: '드묾',
  rare: '귀함',
  veryRare: '아주 귀함',
};

// ---------- The result table ----------

export type RefineKind = 'ore' | 'gold' | 'gift';

export const REFINE_KIND_LABEL: Record<RefineKind, string> = { ore: '광석', gold: '골드', gift: '선물' };

export interface RefineRow {
  readonly id: string;
  readonly name: string;
  readonly kind: RefineKind;
  readonly rarity: RefineRarity;
  /** Relative weight (the table sums to 100 today, so a weight is a %). */
  readonly weight: number;
  /** Amount at ×1, rolled in [min, max] (gold: G). */
  readonly min: number;
  readonly max: number;
  /** An ore: the main material it counts as (4.4, 10장). Not used yet (16.2의 24번). */
  readonly materialTier?: number;
}

/** Ores follow the main materials' names (4.4, common.ts materialName): 철광석, 강철 덩이, ○○ 원석. */
export function oreName(tier: number): string {
  if (tier === 1) return `${materialName(1)}광석`;
  if (tier === 2) return `${materialName(2)} 덩이`;
  return `${materialName(tier)} 원석`;
}

export const REFINE_TABLE = [
  { id: 'ironOre', name: oreName(1), kind: 'ore', rarity: 'common', weight: 40, min: 1, max: 1, materialTier: 1 },
  { id: 'gold', name: '골드', kind: 'gold', rarity: 'common', weight: 25, min: 5, max: 15 },
  { id: 'steelIngot', name: oreName(2), kind: 'ore', rarity: 'uncommon', weight: 15, min: 1, max: 1, materialTier: 2 },
  { id: 'wildflowers', name: '들꽃 다발', kind: 'gift', rarity: 'uncommon', weight: 3, min: 1, max: 1 },
  { id: 'honeyCake', name: '꿀 과자', kind: 'gift', rarity: 'uncommon', weight: 3, min: 1, max: 1 },
  { id: 'mithrilOre', name: oreName(3), kind: 'ore', rarity: 'rare', weight: 6, min: 1, max: 1, materialTier: 3 },
  { id: 'orichalcumOre', name: oreName(4), kind: 'ore', rarity: 'rare', weight: 3, min: 1, max: 1, materialTier: 4 },
  { id: 'shinyPebble', name: '반짝 조약돌', kind: 'gift', rarity: 'rare', weight: 2, min: 1, max: 1 },
  { id: 'knitGloves', name: '손뜨개 장갑', kind: 'gift', rarity: 'rare', weight: 2, min: 1, max: 1 },
  { id: 'adamantOre', name: oreName(5), kind: 'ore', rarity: 'veryRare', weight: 1, min: 1, max: 1, materialTier: 5 },
] as const satisfies readonly RefineRow[];

export type RefineItemId = (typeof REFINE_TABLE)[number]['id'];

export const REFINE_ITEM_IDS: readonly RefineItemId[] = REFINE_TABLE.map((r) => r.id);

const ROW_BY_ID = new Map<string, RefineRow>(REFINE_TABLE.map((r) => [r.id, r]));

export function refineRow(id: RefineItemId): RefineRow {
  const row = ROW_BY_ID.get(id);
  if (row === undefined) throw new Error(`unknown refine item ${id}`);
  return row;
}

export function isRefineItemId(v: unknown): v is RefineItemId {
  return typeof v === 'string' && ROW_BY_ID.has(v);
}

// ---------- Lumps, multipliers, batches ----------

/**
 * 광석 덩어리 (10.1): one lump every `everyMinutes` world minutes while away (60 an hour), up to
 * `cap` (12 hours' worth, 720). Time while the pile is full is thrown away, like the vault (3.3).
 * The cap is a freeze line (15.7): never raised for money or ads.
 */
export const REFINE_LUMPS = { everyMinutes: 1, cap: 720 } as const;

/** Lumps an hour (for the screen): 60 ÷ everyMinutes. */
export const REFINE_LUMPS_PER_HOUR = 60 / REFINE_LUMPS.everyMinutes;

/** 배율 (10.1): lumps one blow uses and what its amount is multiplied by. The odds never change. */
export const REFINE_MULTS = [1, 2, 5, 10, 20] as const;
export type RefineMult = (typeof REFINE_MULTS)[number];

/** 묶음 (10.1): the most blows one press of the hammer makes. */
export const REFINE_BATCH_MAX = 15;

/**
 * Hammering tempo while the hammer is held (10.1): the press hits at once, then the next blows
 * come firstMs apart, each stepMs sooner than the last, never under minMs (about 2 s for 15).
 * A very rare find stops him for veryRarePauseMs (he looks at it) before the next blow.
 * The screen keeps the tempo; the engine decides every result (CLAUDE.md 규칙 2).
 */
export const REFINE_TEMPO = { firstMs: 220, minMs: 110, stepMs: 14, veryRarePauseMs: 700 } as const;

// ---------- Feel ----------

/**
 * How each rarity buzzes (10.1 연출과 진동): one short tap for common and uncommon, two short for
 * rare, two short and a longer one for very rare. Names of platform/haptics.ts intents; the
 * pattern itself is the device's (the web vibration call today, Capacitor Haptics later).
 */
export const REFINE_HAPTIC: Record<RefineRarity, 'tap' | 'rare' | 'veryRare'> = {
  common: 'tap',
  uncommon: 'tap',
  rare: 'rare',
  veryRare: 'veryRare',
};

/**
 * How each rarity sounds (10.1 연출과 진동 '망치 소리'): the hammer's clank on every blow, a little
 * brighter for uncommon, with a short chime over it for rare and a longer one for very rare. Names
 * of platform/audio.ts intents; the sound itself is that file's (synthesised, no sound files).
 */
export const REFINE_SOUND: Record<RefineRarity, 'hit' | 'hitBright' | 'rare' | 'veryRare'> = {
  common: 'hit',
  uncommon: 'hitBright',
  rare: 'rare',
  veryRare: 'veryRare',
};

/** The dwarf's lines (10.1, tone 1.1: one or two lines). */
export const REFINE_LINES = {
  first: '광석은 두드려 봐야 속을 안다.',
  full: '더미가 모루보다 높아졌군.',
  rare: '…호오.',
  veryRare: '…이런 게 다 나오는군. 오래 살고 볼 일이다.',
  gift: '이건 녀석들 몫이다.',
} as const;

/**
 * How often he says a line again (ms) [튜닝]. A batch of fifteen has a rare find about 90% of the
 * time, so '…호오.' after every batch turns into a verbal tic and dulls the very rare line: once
 * said it waits `rare` before he says it again (later rare finds get only his cheer). The very
 * rare line always comes. The gift line comes once a visit.
 */
export const REFINE_LINE_GAP_MS = { rare: 20_000 } as const;

/** The line on coming back (10.1 '돌아옴'): a notice, not a spoken line. */
export function refineReturnLine(gained: number): string {
  return `자리를 비운 사이 광석 덩어리 ${gained}개가 쌓였다.`;
}
