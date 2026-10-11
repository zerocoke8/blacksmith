// What the run screens show (기획서 13.17), computed from the state. Read-only: the screens call
// runAct to change anything.

import { allEnchantMaterialKeys, cardName, cardText, type EnchantMaterialKey, enchantMaterialLabel } from '../cards/index.ts';
import type { BodyType, Element, EnchantId, QualityTier, UniqueId, Weapon } from '../core/types.ts';
import { type CardId, CARDS } from '../data/cards.ts';
import {
  BODY_LABEL,
  ELEMENT_LABEL,
  MASTERY_SKILLED_FLOOR,
  materialName,
  materialPrice,
  QUALITY,
  usedEnchantSlots,
} from '../data/common.ts';
import { ENCHANTS } from '../data/enchants.ts';
import { FAMILIES, type FamilyId } from '../data/families.ts';
import {
  ACTION_HP,
  BOND_MAX,
  EXPEDITION_POLICIES,
  type ExpeditionPolicy,
  FINAL_CLIMB_START,
  MAINTAIN_POWER_MULT,
  POLICY_LABEL,
  SEASONS,
  STAR_SPEC,
  type Star,
  STORY_BONDS,
  WALL_WARN_TURNS,
} from '../data/run.ts';
import { FLOORS_FOR_MAX_LEVEL, MAX_LEVEL, STAT_TIER_LABEL, type StatTier } from '../data/world.ts';
import { masteryOf, type Mastery, weaponAttack } from '../world/combat.ts';
import { UNIQUES } from '../data/uniques.ts';
import { type ExpeditionForecast, forecastExpedition } from './expedition.ts';
import { type ForgePlan, forgePlan } from './forge.ts';
import { floorOdds, heroLevel, heroPower, masteryFloor, partyBonus, runStartPower } from './hero.ts';
import { actionBlock, type ForcedTurn, forcedTurn } from './run.ts';
import { type SeasonBandView, seasonLayout } from './season.ts';
import { enchantPrice, hpCap, isShopMaterial, mainCount, nextWall, repairCostOf, shopBand } from './state.ts';
import { wallTodayLine, wallWarnLine, weaponTitle } from './text.ts';
import type { RunAction, RunState, ShopItem } from './types.ts';

export const MASTERY_LABEL: Record<Mastery, string> = { novice: '미숙', skilled: '능숙', master: '달인' };

export interface RunHeroView {
  family: FamilyId;
  name: string;
  emoji: string;
  color: string;
  star: Star;
  level: number;
  /** 판 누적 층 to the next level, or null at 30. */
  floorsToNextLevel: number | null;
  power: number;
  startPower: number;
  powerCap: number;
  hp: number;
  hpCap: number;
  injured: boolean;
  /** 중상: this turn is 휴식. */
  forcedRest: boolean;
  mastery: Mastery;
  masteryLabel: string;
  masteryFloor: number;
  charisma: string;
  luck: string;
  partyBonus: number;
}

export function heroView(s: RunState): RunHeroView {
  const fam = FAMILIES[s.setup.hero.family];
  const level = heroLevel(s);
  let toNext: number | null = null;
  if (level < MAX_LEVEL) {
    // Smallest cumulative count reaching level + 1 (levelFor: 1 + ⌊n × 29 ÷ 140⌋).
    const need = Math.ceil((level * FLOORS_FOR_MAX_LEVEL) / (MAX_LEVEL - 1));
    toNext = Math.max(0, need - s.cumulativeFloors);
  }
  const mf = masteryFloor(s);
  const mastery = masteryOf(mf);
  const tier = (t: StatTier): string => STAT_TIER_LABEL[t];
  return {
    family: fam.id,
    name: fam.name,
    emoji: fam.emoji,
    color: fam.color,
    star: s.setup.hero.star,
    level,
    floorsToNextLevel: toNext,
    power: heroPower(s),
    startPower: runStartPower(s.setup.hero.star, s.factors),
    powerCap: STAR_SPEC[s.setup.hero.star].powerCap,
    hp: s.hp,
    hpCap: hpCap(s),
    injured: s.injured,
    forcedRest: s.forcedRest,
    mastery,
    masteryLabel: MASTERY_LABEL[mastery],
    masteryFloor: mf,
    charisma: tier(fam.charisma),
    luck: tier(fam.luck),
    partyBonus: partyBonus(s),
  };
}

export interface EnchantView {
  id: EnchantId;
  name: string;
  /** 상위 인챈트: 능숙 전에는 탑 계산에서 0 (4.7). */
  locked: boolean;
  lockText: string | null;
}

export interface RunWeaponView {
  title: string;
  name: string | null;
  weapon: Weapon;
  attack: number;
  element: Element | null;
  enchants: EnchantView[];
  unique: { id: UniqueId; name: string; locked: boolean } | null;
  durability: number;
  slots: number;
  freeSlots: number;
  repairCost: number;
  /** 정비 버프 (다음 원정 ×1.2). */
  maintainBuff: boolean;
}

export function weaponView(s: RunState, weapon: Weapon = s.weapon.weapon): RunWeaponView {
  const mf = masteryFloor(s);
  const mastery = masteryOf(mf);
  const slots = QUALITY[weapon.quality].slots;
  return {
    title: weaponTitle(weapon),
    name: weapon === s.weapon.weapon ? s.weapon.name : null,
    weapon,
    attack: weaponAttack(weapon),
    element: weapon.element,
    enchants: weapon.enchants.map((id) => {
      const locked = ENCHANTS[id].upper && mastery === 'novice';
      return { id, name: ENCHANTS[id].name, locked, lockText: locked ? `능숙 필요 (앞으로 ${Math.ceil(MASTERY_SKILLED_FLOOR - mf)}층)` : null };
    }),
    unique:
      weapon.unique === null
        ? null
        : { id: weapon.unique, name: UNIQUES[weapon.unique].name, locked: mastery !== 'master' },
    durability: weapon === s.weapon.weapon ? s.weapon.durability : 1,
    slots,
    freeSlots: slots - usedEnchantSlots(weapon),
    repairCost: repairCostOf(weapon),
    maintainBuff: s.maintainBuff,
  };
}

export interface WallView {
  index: number;
  floor: number;
  boss: string;
  body: BodyType;
  bodyLabel: string;
  element: Element;
  elementLabel: string;
  deadline: number;
  turnsLeft: number;
  passedTurn: number | null;
  state: 'passed' | 'next' | 'later';
  /** 지금 장비와 레벨로의 R과 돌파 확률, 정비 버프를 받았을 때와 함께. */
  r: number;
  chance: number;
  chanceMaintained: number;
}

export function wallViews(s: RunState): WallView[] {
  const next = nextWall(s);
  return s.walls.map((w, index) => {
    const odds = floorOdds(s, w.floor);
    const maintained = floorOdds(s, w.floor, { maintain: true });
    return {
      index,
      floor: w.floor,
      boss: odds.info.name,
      body: odds.info.body,
      bodyLabel: BODY_LABEL[odds.info.body],
      element: odds.info.element,
      elementLabel: ELEMENT_LABEL[odds.info.element],
      deadline: w.deadline,
      turnsLeft: w.deadline - s.turn,
      passedTurn: w.passedTurn,
      state: w.passedTurn !== null ? 'passed' : w === next ? 'next' : 'later',
      r: odds.r,
      chance: odds.chance,
      chanceMaintained: maintained.chance,
    };
  });
}

export interface ActionView {
  action: RunAction['type'];
  label: string;
  /** Why it cannot be taken now, or null. */
  block: string | null;
  /** 효과 미리보기 (길게 누르기, 13.17). */
  hint: string;
}

/** The turn's buttons: 행동 5종 and the forced one, each with why it is blocked. */
export function actionViews(s: RunState): ActionView[] {
  const forced = forcedTurn(s);
  const out: ActionView[] = [];
  if (forced === 'wall') out.push({ action: 'wall', label: '벽 도전', block: actionBlock(s, { type: 'wall' }), hint: '귀환 기준 없이 벽 보스까지 오른다. 못 넘으면 은퇴' });
  if (forced === 'climb') out.push({ action: 'climb', label: '마지막 등반', block: actionBlock(s, { type: 'climb' }), hint: '51층부터 쓰러질 때까지 오른다' });
  out.push({ action: 'expedition', label: '원정', block: actionBlock(s, { type: 'expedition', policy: 'normal' }), hint: '층마다 골드와 누적 층. HP가 깎인다' });
  const plans = forgeOptions(s);
  const canForge = plans.find((p) => p.block === null);
  const hp = (n: number): string => `HP +${Math.round(n * 100)}%`;
  out.push({
    action: 'forge',
    label: '단조',
    block: forced !== null ? actionBlock(s, { type: 'forge', materialTier: 1 }) : canForge === undefined ? (plans[0]?.block ?? '주재료가 없다') : null,
    hint: `${hp(ACTION_HP.forge)}. 카드 제작으로 새 무기를 짓는다`,
  });
  out.push({
    action: 'maintain',
    label: '정비',
    block: actionBlock(s, { type: 'maintain' }),
    hint: `${hp(ACTION_HP.maintain)}. 내구도 100%, 빈 슬롯 채우기, 다음 원정 ×${MAINTAIN_POWER_MULT} (${repairCostOf(s.weapon.weapon)}G)`,
  });
  out.push({ action: 'rest', label: '휴식', block: actionBlock(s, { type: 'rest' }), hint: `${hp(ACTION_HP.rest)}. 부상이 낫는다` });
  const bondable = s.companions.findIndex((c) => c.bond < BOND_MAX);
  out.push({
    action: 'bond',
    label: '교류',
    block: s.companions.length === 0 ? '동료가 없다' : bondable < 0 ? '유대가 모두 가득하다' : actionBlock(s, { type: 'bond', companion: bondable }),
    hint: `${hp(ACTION_HP.bond)}. 동료 한 명과 유대 +1`,
  });
  return out;
}

/**
 * A weapon a 단조 of this recipe could make, before its slots: the given ★ and element, and for a
 * 전설 걸작 the season's 고유능력 (4.6, 13.2.1). For the 단조 preview; the forge decides the real one.
 */
export function plannedWeapon(s: RunState, plan: Pick<ForgePlan, 'materialTier' | 'legendary'>, quality: QualityTier, element: Element | null): Weapon {
  return {
    id: 'plan',
    type: FAMILIES[s.setup.hero.family].weapon,
    materialTier: plan.materialTier,
    quality,
    element,
    enchants: [],
    unique: plan.legendary && quality === 5 ? SEASONS[s.setup.season].bossMaterial.unique : null,
  };
}

/** Floors the 마지막 등반 opens with (13.7: 51층부터), for weighing a weapon after the 악마. */
export const CLIMB_PREVIEW_FLOORS = 10;

/**
 * Mean 돌파 확률 over the first floors of the 마지막 등반 (51층부터 CLIMB_PREVIEW_FLOORS층) at today's
 * level, with this weapon. After the 악마 there is no wall to weigh a weapon against; this is.
 */
export function climbOdds(s: RunState, weapon: Weapon = s.weapon.weapon): number {
  let sum = 0;
  for (let i = 0; i < CLIMB_PREVIEW_FLOORS; i++) sum += floorOdds(s, FINAL_CLIMB_START + i, { weapon }).chance;
  return sum / CLIMB_PREVIEW_FLOORS;
}

export interface ShopEntry {
  item: ShopItem;
  label: string;
  price: number;
  owned: number;
}

/** 상점 (13.4.3): 주재료 1구간~지금 구간, 하급 인챈트 재료 4계열, 원소 결정 4종. */
export function shopEntries(s: RunState): ShopEntry[] {
  const out: ShopEntry[] = [];
  for (let tier = 1; tier <= shopBand(s); tier++) {
    out.push({ item: { kind: 'main', tier }, label: materialName(tier), price: materialPrice(tier), owned: mainCount(s, tier) });
  }
  const price = enchantPrice(s);
  for (const key of allEnchantMaterialKeys()) {
    if (!isShopMaterial(key)) continue;
    out.push({ item: { kind: 'material', key }, label: enchantMaterialLabel(key), price, owned: s.inventory[key] ?? 0 });
  }
  return out;
}

/** 인챈트 재료 on hand (상급 included), for the 완성 화면 and 정비. */
export function inventoryEntries(s: RunState): { key: EnchantMaterialKey; label: string; count: number }[] {
  return allEnchantMaterialKeys()
    .filter((k) => (s.inventory[k] ?? 0) > 0)
    .map((key) => ({ key, label: enchantMaterialLabel(key), count: s.inventory[key] ?? 0 }));
}

/** Recipes the 단조 can start with: each band on sale or on hand, and 전설 with the 시즌 보스 재료. */
export function forgeOptions(s: RunState): ForgePlan[] {
  const tiers = new Set<number>();
  for (let t = 1; t <= shopBand(s); t++) tiers.add(t);
  for (const k of Object.keys(s.mainMaterials)) tiers.add(Number(k));
  const out: ForgePlan[] = [];
  for (const t of [...tiers].sort((a, b) => b - a)) {
    out.push(forgePlan(s, t, false));
    if (s.bossMaterials > 0) out.push(forgePlan(s, t, true));
  }
  return out;
}

export interface CompanionView {
  index: number;
  family: FamilyId;
  name: string;
  emoji: string;
  color: string;
  star: Star;
  bond: number;
  /** The next 유대 where a 사연 opens, or null after 5. */
  nextStory: number | null;
  stories: number[];
  uniqueCardName: string;
}

export function companionViews(s: RunState): CompanionView[] {
  return s.companions.map((c, index) => {
    const fam = FAMILIES[c.family];
    return {
      index,
      family: c.family,
      name: fam.name,
      emoji: fam.emoji,
      color: fam.color,
      star: c.star,
      bond: c.bond,
      nextStory: STORY_BONDS.find((b) => b > c.bond) ?? null,
      stories: [...c.stories],
      uniqueCardName: fam.uniqueCardName,
    };
  });
}

export interface DeckEntry {
  card: CardId;
  name: string;
  text: string;
  count: number;
  /** 판 안에서만 들어온 카드 (가문 고유 카드, 시즌 카드). */
  runOnly: boolean;
}

export function deckEntries(s: RunState): DeckEntry[] {
  const counts = new Map<CardId, number>();
  for (const id of s.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([card, count]) => ({
    card,
    name: cardName(card),
    text: cardText(card),
    count,
    runOnly: CARDS[card].group === 'family' || CARDS[card].group === 'season',
  }));
}

export interface RunTurnView {
  turn: number;
  turns: number;
  phase: RunState['phase'];
  forced: ForcedTurn;
  /** 붉은 띠 경고 (13.7), or null. */
  warning: string | null;
  gold: number;
  shopBand: number;
  seasonName: string;
  bands: SeasonBandView[];
  walls: WallView[];
  hero: RunHeroView;
  weapon: RunWeaponView;
  companions: CompanionView[];
  forecasts: Record<ExpeditionPolicy, ExpeditionForecast & { label: string }>;
  actions: ActionView[];
}

/** 턴 화면 (판의 홈, 13.17). */
export function turnView(s: RunState): RunTurnView {
  const forced = forcedTurn(s);
  const next = nextWall(s);
  let warning: string | null = null;
  if (next !== null && s.phase !== 'over') {
    if (forced === 'wall') warning = wallTodayLine(next.floor);
    else if (next.deadline - s.turn === WALL_WARN_TURNS) warning = wallWarnLine(next.floor);
  }
  const forecasts = {} as Record<ExpeditionPolicy, ExpeditionForecast & { label: string }>;
  for (const p of EXPEDITION_POLICIES) forecasts[p] = { ...forecastExpedition(s, p), label: POLICY_LABEL[p] };
  return {
    turn: s.turn,
    turns: s.rules.turns,
    phase: s.phase,
    forced,
    warning,
    gold: s.gold,
    shopBand: shopBand(s),
    seasonName: SEASONS[s.setup.season].name,
    bands: seasonLayout(s.setup.season),
    walls: wallViews(s),
    hero: heroView(s),
    weapon: weaponView(s),
    companions: companionViews(s),
    forecasts,
    actions: actionViews(s),
  };
}
