// 대장장이 스탯 for card crafting (기획서 4.2.7): 모루·숫돌 set the 숙련도 a card's ratio
// is taken from, 화로 sets the hand and how many cards 다시 달구기 keeps. 각인 cards in the
// deck add to these for the whole craft.

import { POW_INT_MAX_EXPONENT, powInt } from '../data/common.ts';
import {
  CARD_SMITH_BASE,
  CARD_TOOL_STEP,
  CARDS,
  type CardId,
  DEFAULT_CARD_RULES,
  DURABILITY_DELTA_RANGE,
  FIRE_PRESETS,
  type FirePreset,
  FURNACE_LEVELS,
  HAND_SIZE_RANGE,
  REHEAT_COST_RANGE,
} from '../data/cards.ts';

export interface CardTools {
  anvil: number; // 모루
  whetstone: number; // 숫돌
  furnace: number; // 화로 0~4
}

export const NO_CARD_TOOLS: CardTools = { anvil: 0, whetstone: 0, furnace: 0 };

/** Prototype switches for the [검증] questions. See DEFAULT_CARD_RULES. */
export interface CardRules {
  handSize: number | null;
  reheatCost: number;
  coolingIron: boolean;
  firePreset: FirePreset;
  /** Added to the recipe's 내구도 (the iron keeps at least 1). */
  durabilityDelta: number;
}

export interface CardSmithStats {
  /** 작업 숙련도: progress per +100%. */
  craftsmanship: number;
  /** 가공 숙련도: quality per +100%. */
  control: number;
  handSize: number;
  /** Cards the player may keep at 다시 달구기 (간직 cards stay on top of this). */
  keep: number;
  /** Added to the recipe durability (두꺼운 모루판). */
  durabilityBonus: number;
  /** 불꽃 읽기: next turn's fire state is shown. */
  foresight: boolean;
}

/** Whole, non-negative level; anything that is not a finite number counts as 0. */
function level(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function clampInt(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
}

/** Fills in defaults and clamps each switch to its range. */
export function resolveCardRules(rules: Partial<CardRules> | undefined): CardRules {
  const r = { ...DEFAULT_CARD_RULES, ...(rules ?? {}) };
  return {
    handSize: r.handSize === null ? null : clampInt(r.handSize, HAND_SIZE_RANGE.min, HAND_SIZE_RANGE.max),
    reheatCost: clampInt(r.reheatCost, REHEAT_COST_RANGE.min, REHEAT_COST_RANGE.max),
    coolingIron: r.coolingIron === true,
    firePreset: (FIRE_PRESETS as readonly string[]).includes(r.firePreset) ? r.firePreset : 'default',
    durabilityDelta: Number.isFinite(r.durabilityDelta)
      ? clampInt(r.durabilityDelta, DURABILITY_DELTA_RANGE.min, DURABILITY_DELTA_RANGE.max)
      : 0,
  };
}

/** The craft's 최대 내구도: 레시피 내구도 + 두꺼운 모루판 + the [검증] delta, at least 1. */
export function cardMaxDurability(recipe: { durability: number }, smith: CardSmithStats, rules: CardRules): number {
  return Math.max(1, recipe.durability + smith.durabilityBonus + rules.durabilityDelta);
}

/** 숙련도 multiplier 모루 or 숫돌 gives at a level: 1.04^level by repeated products (3.6). */
export function cardToolMultiplier(tool: 'anvil' | 'whetstone', lv: number): number {
  return powInt(CARD_TOOL_STEP[tool], Math.min(level(lv), POW_INT_MAX_EXPONENT));
}

/** 화로 level clamped to the table (상한 4의 시설). */
export function furnaceLevel(lv: number): { hand: number; keep: number; cost: number } {
  const i = Math.min(level(lv), FURNACE_LEVELS.length - 1);
  return FURNACE_LEVELS[i] as { hand: number; keep: number; cost: number };
}

/** Smith stats for one craft, from tools, the 각인 in the deck and the rule switches. */
export function cardSmithStats(tools: CardTools, imprints: readonly CardId[], rules: CardRules): CardSmithStats {
  let craftBonus = 0;
  let controlBonus = 0;
  let durabilityBonus = 0;
  let foresight = false;
  for (const id of imprints) {
    const imprint = CARDS[id].imprint;
    if (imprint === null) continue;
    if (imprint.type === 'craftsmanship') craftBonus += imprint.bonus;
    else if (imprint.type === 'control') controlBonus += imprint.bonus;
    else if (imprint.type === 'durability') durabilityBonus += imprint.amount;
    else foresight = true;
  }
  const furnace = furnaceLevel(tools.furnace);
  return {
    craftsmanship: Math.round(CARD_SMITH_BASE.craftsmanship * cardToolMultiplier('anvil', tools.anvil) * (1 + craftBonus)),
    control: Math.round(CARD_SMITH_BASE.control * cardToolMultiplier('whetstone', tools.whetstone) * (1 + controlBonus)),
    handSize: rules.handSize ?? furnace.hand,
    keep: furnace.keep,
    durabilityBonus,
    foresight,
  };
}
