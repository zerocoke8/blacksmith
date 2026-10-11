// 단조 (기획서 13.8): 4장의 카드 제작 엔진을 그대로 쓴다. 판에서 다른 것은 입력뿐이다: 판 숙련도 표
// (레시피마다 기준 도구 레벨), 손패 5장 (화로 손질 6장), 간직 0장, 판 덱, 난수 (판 시드, 'forge',
// 단조 번호) 아래 'fire'·'deck' (13.16). The quick forge ([검증] 단조 간이 모드) skips the cards.

import {
  type CardCraftSetup,
  type CardCraftState,
  cardCraftOutcome,
  cardRecipeGrade,
  fillSlot,
  type MaterialInventory,
  type SlotPick,
  slotBlock,
  weaponFromCardCraft,
} from '../cards/index.ts';
import { rngFor } from '../core/rng.ts';
import type { QualityTier, Weapon } from '../core/types.ts';
import { CARD_STREAM, type CardId, type CardRecipeGrade, CARDS } from '../data/cards.ts';
import { materialPrice, WEAPON_MATERIAL_UNITS } from '../data/common.ts';
import { FAMILIES } from '../data/families.ts';
import {
  QUICK_FORGE_WEIGHTS,
  RUN_SMITH_LEGENDARY_LEVEL,
  RUN_SMITH_LEVEL_BY_TIER,
  RUN_SMITH_LEVEL_STEP,
  SEASONS,
} from '../data/run.ts';
import { mainCount, shopBand } from './state.ts';
import { subj } from './text.ts';
import type { BossMaterialFate, RunState } from './types.ts';

export const FORGE_STREAM = CARD_STREAM.forge;

/** 판 숙련도 표 (13.8): 기준 도구 레벨 of a recipe. 작업·가공 숙련도 = 100 × 1.04^레벨. */
export function runSmithLevel(materialTier: number, legendary: boolean): number {
  const table = RUN_SMITH_LEVEL_BY_TIER;
  const tier = Math.max(1, Math.floor(materialTier));
  const base =
    tier <= table.length
      ? (table[tier - 1] as number)
      : (table[table.length - 1] as number) + RUN_SMITH_LEVEL_STEP * (tier - table.length);
  return legendary ? Math.max(RUN_SMITH_LEGENDARY_LEVEL, base) : base;
}

/** 손패 5장, 화로 손질로 6장 (13.8). The [검증] 판 손패 switch moves the 5. */
export function runHandSize(s: Pick<RunState, 'handBonus' | 'rules'>): number {
  return s.rules.handSize + s.handBonus;
}

export interface ForgePlan {
  materialTier: number;
  legendary: boolean;
  grade: CardRecipeGrade;
  /** 주재료 on hand (보스 보상, 산 것) used for this weapon. */
  owned: number;
  /** Units still to buy at the shop, and what they cost. */
  toBuy: number;
  cost: number;
  smithLevel: number;
  handSize: number;
  /** Why it cannot start (short Korean), or null. */
  block: string | null;
}

/** What a 단조 of this recipe needs now: 주재료 6개 (없는 만큼 상점에서 산다) [+ 시즌 보스 재료]. */
export function forgePlan(s: RunState, materialTier: number, legendary = false): ForgePlan {
  const tier = Math.floor(materialTier);
  const owned = Math.min(WEAPON_MATERIAL_UNITS, mainCount(s, tier));
  const toBuy = WEAPON_MATERIAL_UNITS - owned;
  const cost = toBuy * materialPrice(tier);
  const unique = SEASONS[s.setup.season].bossMaterial.unique;
  let block: string | null = null;
  if (!Number.isInteger(materialTier) || tier < 1) block = '없는 주재료';
  else if (toBuy > 0 && tier > shopBand(s)) block = '상점에 아직 없는 주재료';
  else if (legendary && s.bossMaterials <= 0) block = `${subj(SEASONS[s.setup.season].bossMaterial.name)} 없다`;
  else if (cost > s.gold) block = `골드가 모자라다 (${cost}G 필요)`;
  return {
    materialTier: tier,
    legendary,
    grade: cardRecipeGrade(tier, legendary ? unique : null),
    owned,
    toBuy,
    cost,
    smithLevel: runSmithLevel(tier, legendary),
    handSize: runHandSize(s),
    block,
  };
}

/** The card craft a run's 단조 starts (13.8, 13.16). */
export function forgeCraftSetup(s: RunState, no: number, plan: ForgePlan): CardCraftSetup {
  return {
    seed: s.setup.seed,
    stream: FORGE_STREAM,
    craftNo: no,
    recipe: {
      weaponType: FAMILIES[s.setup.hero.family].weapon,
      materialTier: plan.materialTier,
      bossMaterial: plan.legendary ? SEASONS[s.setup.season].bossMaterial.unique : null,
    },
    deck: [...s.deck],
    tools: { anvil: plan.smithLevel, whetstone: plan.smithLevel, furnace: 0 },
    rules: { handSize: plan.handSize },
  };
}

/** 단조 간이 모드: quality drawn from (판 시드, 'forge', 단조 번호, 'quick') when none is given. */
export function quickQuality(seed: number, no: number): QualityTier {
  const rng = rngFor(seed, FORGE_STREAM, no, 'quick');
  const tiers = [1, 2, 3, 4, 5] as const;
  return tiers[rng.weightedIndex(tiers.map((t) => QUICK_FORGE_WEIGHTS[t]))] as QualityTier;
}

export function forgeWeaponId(no: number): string {
  return `f${no}`;
}

/** The weapon a quick forge makes: 걸작 + 시즌 보스 재료 → 고유능력 (4.6). */
export function quickWeapon(s: RunState, no: number, plan: ForgePlan, quality: QualityTier): { weapon: Weapon; fate: BossMaterialFate | null } {
  const unique = SEASONS[s.setup.season].bossMaterial.unique;
  const fate: BossMaterialFate | null = plan.legendary ? (quality === 5 ? 'used' : 'returned') : null;
  return {
    weapon: {
      id: forgeWeaponId(no),
      type: FAMILIES[s.setup.hero.family].weapon,
      materialTier: plan.materialTier,
      quality,
      element: null,
      enchants: [],
      unique: fate === 'used' ? unique : null,
    },
    fate,
  };
}

/** The finished weapon of a card craft and the fate of its 시즌 보스 재료. */
export function craftedWeapon(craft: CardCraftState, no: number): { weapon: Weapon; fate: BossMaterialFate | null } {
  const outcome = cardCraftOutcome(craft);
  return { weapon: weaponFromCardCraft(craft, forgeWeaponId(no)), fate: outcome.boss?.fate ?? null };
}

/** Why these slot picks cannot go in (short Korean), or null. */
export function picksBlock(weapon: Weapon, picks: readonly SlotPick[], inventory: MaterialInventory): string | null {
  let w = weapon;
  let inv = inventory;
  for (const pick of picks) {
    const reason = slotBlock(w, pick, inv);
    if (reason !== null) return reason;
    ({ weapon: w, inventory: inv } = fillSlot(w, pick, inv));
  }
  return null;
}

/** Puts the picks in (완성 화면 or 정비의 빈 슬롯 채우기, 4.3, 13.4.1). */
export function applyPicks(weapon: Weapon, picks: readonly SlotPick[], inventory: MaterialInventory): { weapon: Weapon; inventory: MaterialInventory } {
  let w = weapon;
  let inv = inventory;
  for (const pick of picks) ({ weapon: w, inventory: inv } = fillSlot(w, pick, inv));
  return { weapon: w, inventory: inv };
}

/** 기술 카드 played in a craft (not material or boss cards), for the 카드 인자 (13.10). */
export function techUses(craft: CardCraftState): Partial<Record<CardId, number>> {
  const out: Partial<Record<CardId, number>> = {};
  for (const [id, n] of Object.entries(craft.uses) as [CardId, number][]) {
    const g = CARDS[id].group;
    if (g === 'material' || g === 'boss') continue;
    out[id] = (out[id] ?? 0) + n;
  }
  return out;
}
