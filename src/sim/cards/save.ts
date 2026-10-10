// Saving a card craft in progress (기획서 4.2.8). The state is plain JSON; anything read
// back goes through these checks before the engine sees it: the shape, and that the recipe,
// smith, cards and rules are the ones the saved setup makes (4.2.8: 같은 입력으로 다시 계산).
// Storage itself is src/platform/storage.ts's job (CLAUDE.md 규칙 4).

import {
  ELEMENTS,
  ENCHANT_IDS,
  type QualityTier,
  UNIQUE_IDS,
  type Weapon,
  WEAPON_TYPES,
} from '../core/types.ts';
import {
  BUFF_IDS,
  CARD_CRAFT_STATE_VERSION,
  CARD_IDS,
  type CardId,
  type CardRecipeGrade,
  CARDS,
  CHARGE_IDS,
  DEFAULT_CARD_RULES,
  FIRE_PRESETS,
  FIRE_STATES,
} from '../data/cards.ts';
import type { CardCraftState } from './engine.ts';
import { type CardRecipeInput, cardRecipeFor } from './recipe.ts';
import { type CardRules, type CardTools, cardMaxDurability, cardSmithStats, resolveCardRules } from './smith.ts';

type Obj = Record<string, unknown>;

const GRADES: readonly CardRecipeGrade[] = ['basic', 'advanced', 'legendary'];
const STATUSES: readonly string[] = ['active', 'success', 'failed'];
const LOG_KINDS: readonly string[] = ['turn', 'play', 'draw', 'fire', 'shuffle', 'reheat', 'end'];

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isCount(v: unknown): v is number {
  return isNum(v) && v >= 0 && Number.isInteger(v);
}

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function listOf<T extends string>(list: readonly T[], v: unknown): v is T[] {
  return Array.isArray(v) && v.every((x) => oneOf(list, x));
}

function isStrings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isRecipeInput(v: unknown): boolean {
  return (
    isObj(v) &&
    oneOf(WEAPON_TYPES, v.weaponType) &&
    isNum(v.materialTier) &&
    v.materialTier >= 1 &&
    (v.bossMaterial === null || oneOf(UNIQUE_IDS, v.bossMaterial))
  );
}

/**
 * Saved [검증] switches, or null. A switch added after the save was made takes its default;
 * a value the engine would have clamped (out of range) was not made by the engine.
 */
function readRules(v: unknown): CardRules | null {
  if (!isObj(v)) return null;
  const r = { ...DEFAULT_CARD_RULES, ...v };
  if (!(r.handSize === null || isCount(r.handSize)) || !isCount(r.reheatCost)) return null;
  if (typeof r.coolingIron !== 'boolean' || !oneOf(FIRE_PRESETS, r.firePreset)) return null;
  if (!isNum(r.durabilityDelta) || !Number.isInteger(r.durabilityDelta)) return null;
  const rules: CardRules = {
    handSize: r.handSize,
    reheatCost: r.reheatCost,
    coolingIron: r.coolingIron,
    firePreset: r.firePreset,
    durabilityDelta: r.durabilityDelta,
  };
  return sameJson(resolveCardRules(rules), rules) ? rules : null;
}

function isSetup(v: unknown): boolean {
  if (!isObj(v) || !isNum(v.seed) || !isCount(v.craftNo) || typeof v.stream !== 'string') return false;
  if (!isRecipeInput(v.recipe) || !listOf(CARD_IDS, v.deck)) return false;
  const t = v.tools;
  return isObj(t) && isCount(t.anvil) && isCount(t.whetstone) && isCount(t.furnace);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Card instances the engine deals for this deck and recipe: c0… for the 기술 덱, m0… for materials. */
function dealtCards(deck: readonly CardId[], materialCards: readonly CardId[]): Record<string, CardId> {
  const cards: Record<string, CardId> = {};
  deck.filter((id) => CARDS[id].imprint === null).forEach((id, i) => (cards[`c${i}`] = id));
  materialCards.forEach((id, i) => (cards[`m${i}`] = id));
  return cards;
}

function sameCards(a: Obj, b: Record<string, CardId>): boolean {
  const keys = Object.keys(b);
  return Object.keys(a).length === keys.length && keys.every((k) => a[k] === b[k]);
}

/**
 * The recipe, smith, 각인, card instances and 최대 내구도 the saved setup makes, compared
 * with the saved ones. A hand-edited save that changes any of them is refused.
 */
function matchesSetup(data: Obj, setup: Obj, rules: CardRules): boolean {
  const deck = setup.deck as CardId[];
  const recipe = cardRecipeFor(setup.recipe as CardRecipeInput);
  const imprints = deck.filter((id) => CARDS[id].imprint !== null);
  const smith = cardSmithStats(setup.tools as CardTools, imprints, rules);
  return (
    sameJson(recipe, data.recipe) &&
    sameJson(imprints, data.imprints) &&
    sameJson(smith, data.smith) &&
    sameCards(data.cards as Obj, dealtCards(deck, recipe.materialCards)) &&
    data.maxDurability === cardMaxDurability(recipe, smith, rules)
  );
}

function isRecipe(v: unknown): boolean {
  if (!isRecipeInput(v) || !isObj(v) || !oneOf(GRADES, v.grade)) return false;
  if (!isNum(v.progressRequired) || v.progressRequired <= 0 || !isNum(v.qualityCap) || v.qualityCap <= 0) return false;
  return isCount(v.durability) && listOf(CARD_IDS, v.materialCards);
}

function isSmith(v: unknown): boolean {
  return (
    isObj(v) &&
    isNum(v.craftsmanship) &&
    isNum(v.control) &&
    isCount(v.handSize) &&
    isCount(v.keep) &&
    isCount(v.durabilityBonus) &&
    typeof v.foresight === 'boolean'
  );
}

/** Every card instance is in exactly one pile (or the hand). */
function pilesAreWhole(data: Obj, cards: Obj): boolean {
  const piles = [data.drawPile, data.hand, data.discard, data.exhausted];
  if (!piles.every(isStrings)) return false;
  const all = (piles as string[][]).flat();
  const keys = Object.keys(cards);
  return all.length === keys.length && new Set(all).size === all.length && all.every((u) => u in cards);
}

/** The saved card craft if it has the full shape of this version, else null. */
export function restoreCardCraft(data: unknown): CardCraftState | null {
  if (!isObj(data) || data.version !== CARD_CRAFT_STATE_VERSION) return null;
  if (!isSetup(data.setup) || !isRecipe(data.recipe) || !isSmith(data.smith)) return null;
  const setup = data.setup as Obj;
  const rules = readRules(data.rules);
  if (rules === null) return null;
  // The setup keeps its own copy of the rules; it must be the same switches.
  if (setup.rules !== undefined && !sameJson(readRules(setup.rules), rules)) return null;
  const { cards, buffs, charges, uses, log } = data;
  if (!isObj(cards) || !Object.values(cards).every((id) => oneOf(CARD_IDS, id))) return null;
  if (!listOf(CARD_IDS, data.imprints)) return null;
  const counts = [
    data.turn,
    data.progress,
    data.quality,
    data.maxDurability,
    data.heat,
    data.rerollsThisTurn,
    data.rerollsUsed,
    data.nextCardDiscount,
    data.playedThisTurn,
    data.extraDrawNextTurn,
    data.maintainReheats,
    data.maintainRestore,
    data.shuffleNo,
  ];
  if (!counts.every(isCount) || !isNum(data.durability)) return null;
  if (data.shellReheatCost !== null && !isCount(data.shellReheatCost)) return null;
  if (!oneOf(FIRE_STATES, data.fire) || !oneOf(STATUSES, data.status) || typeof data.abandoned !== 'boolean') return null;
  if (!isObj(buffs) || !Object.entries(buffs).every(([k, n]) => oneOf(BUFF_IDS, k) && isCount(n))) return null;
  if (
    !isObj(charges) ||
    !Object.entries(charges).every(([k, c]) => oneOf(CHARGE_IDS, k) && isObj(c) && isCount(c.left) && isCount(c.turns))
  ) {
    return null;
  }
  if (!isObj(uses) || !Object.entries(uses).every(([k, n]) => oneOf(CARD_IDS, k) && isCount(n))) return null;
  if (!pilesAreWhole(data, cards)) return null;
  if (!Array.isArray(log) || !log.every((e) => isObj(e) && oneOf(LOG_KINDS, e.kind) && isCount(e.turn))) return null;
  if (!matchesSetup(data, setup, rules)) return null;
  return { ...data, rules, setup: { ...setup, rules: { ...rules } } } as unknown as CardCraftState;
}

export function serializeCardCraft(state: CardCraftState): string {
  return JSON.stringify(state);
}

/** Parses and checks a saved craft; null if it is not one. */
export function parseCardCraft(text: string): CardCraftState | null {
  try {
    return restoreCardCraft(JSON.parse(text));
  } catch {
    return null;
  }
}

/** The saved weapon if it has the Weapon shape, else null. */
export function restoreCardWeapon(data: unknown): Weapon | null {
  if (!isObj(data) || typeof data.id !== 'string' || !oneOf(WEAPON_TYPES, data.type)) return null;
  if (!isNum(data.materialTier) || data.materialTier < 1) return null;
  if (![1, 2, 3, 4, 5].includes(data.quality as QualityTier)) return null;
  if (data.element !== null && !oneOf(ELEMENTS, data.element)) return null;
  if (!listOf(ENCHANT_IDS, data.enchants) || data.enchants.includes('element')) return null;
  if (data.unique !== null && !oneOf(UNIQUE_IDS, data.unique)) return null;
  return data as unknown as Weapon;
}
