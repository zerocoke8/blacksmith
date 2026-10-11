// Small pieces of run state shared by the action handlers: copying, HP, walls, the 상점 (13.4.3),
// materials and the deck. Handlers work on a draft made by draftRun, never on the caller's state.

import { type EnchantMaterialKey, type EvolveBranch, evolutionOf } from '../cards/index.ts';
import { type CardId, CARDS } from '../data/cards.ts';
import { listPrice, materialPrice, REPAIR_COST_RATE } from '../data/common.ts';
import { DEMON_FLOOR, ENCHANT_PRICE_UNITS, INJURY_HP_CAP, WALL_FLOORS } from '../data/run.ts';
import { BAND_FLOORS } from '../data/world.ts';
import type { Weapon } from '../core/types.ts';
import type { RunState, RunStats, RunWall, RunWeapon } from './types.ts';

/** A working copy: every part an action may change is copied, the rest is shared. */
export function draftRun(s: RunState): RunState {
  return {
    ...s,
    walls: s.walls.map((w) => ({ ...w })),
    weapon: copyHeld(s.weapon),
    rack: [...s.rack],
    deck: [...s.deck],
    inventory: { ...s.inventory },
    mainMaterials: { ...s.mainMaterials },
    companions: s.companions.map((c) => ({ ...c, stories: [...c.stories] })),
    pending: [...s.pending],
    seasonEventsDone: [...s.seasonEventsDone],
    stats: copyStats(s.stats),
    current: s.current === null ? null : { ...s.current, events: [...s.current.events], lines: [...s.current.lines] },
    turnLog: [...s.turnLog],
    actions: [...s.actions],
    forge: s.forge === null ? null : { ...s.forge },
  };
}

function copyHeld(h: RunWeapon): RunWeapon {
  return { ...h, weapon: { ...h.weapon, enchants: [...h.weapon.enchants] } };
}

function copyStats(st: RunStats): RunStats {
  return { ...st, cardUses: { ...st.cardUses }, bossesCleared: [...st.bossesCleared] };
}

// ---------- HP (13.4.2) ----------

/** HP 상한: 부상 중이면 60%. */
export function hpCap(s: Pick<RunState, 'injured'>): number {
  return s.injured ? INJURY_HP_CAP : 1;
}

export function heal(s: RunState, amount: number): void {
  s.hp = Math.min(hpCap(s), s.hp + amount);
}

/** 부상 (or 중상): HP 상한 60% until 휴식. */
export function injure(s: RunState): void {
  s.injured = true;
  s.hp = Math.min(s.hp, INJURY_HP_CAP);
}

// ---------- Walls (13.7) ----------

/** The first wall whose boss has not fallen, or null after the 악마. */
export function nextWall(s: Pick<RunState, 'walls'>): RunWall | null {
  return s.walls.find((w) => w.passedTurn === null) ?? null;
}

export function demonPassed(s: Pick<RunState, 'lastBossFloor'>): boolean {
  return s.lastBossFloor >= DEMON_FLOOR;
}

export function wallIndex(floor: number): number {
  return WALL_FLOORS.indexOf(floor);
}

// ---------- 상점 (13.4.3) ----------

/** Highest main-material band on sale: 1구간 철 from the start, n구간 보스를 넘으면 n+1구간. */
export function shopBand(s: Pick<RunState, 'lastBossFloor'>): number {
  return Math.floor(s.lastBossFloor / BAND_FLOORS) + 1;
}

/** 하급 인챈트 재료와 원소 결정 = 상점에 있는 최고 구간 재료가 × 2. */
export function enchantPrice(s: Pick<RunState, 'lastBossFloor'>): number {
  return ENCHANT_PRICE_UNITS * materialPrice(shopBand(s));
}

/** Material sold in the shop: 하급 체형 계열 재료와 원소 결정 (상급은 팔지 않는다). */
export function isShopMaterial(key: EnchantMaterialKey): boolean {
  return key.startsWith('crystal:') || key.endsWith(':low');
}

/** 일반 수리비 = 정가의 5% (10장, 13.4.1 정비). */
export function repairCostOf(w: Pick<Weapon, 'materialTier' | 'quality'>): number {
  return Math.round(listPrice(w.materialTier, w.quality) * REPAIR_COST_RATE);
}

export function addMaterial(s: RunState, key: EnchantMaterialKey, n: number): void {
  s.inventory[key] = (s.inventory[key] ?? 0) + n;
}

export function mainCount(s: Pick<RunState, 'mainMaterials'>, tier: number): number {
  return s.mainMaterials[String(tier)] ?? 0;
}

export function addMain(s: RunState, tier: number, n: number): void {
  const k = String(tier);
  const next = (s.mainMaterials[k] ?? 0) + n;
  if (next > 0) s.mainMaterials[k] = next;
  else delete s.mainMaterials[k];
}

// ---------- Deck (13.8.1) ----------

export function removeOneCard(deck: CardId[], card: CardId): boolean {
  const i = deck.indexOf(card);
  if (i < 0) return false;
  deck.splice(i, 1);
  return true;
}

export interface EvolveOption {
  card: CardId;
  branch: EvolveBranch;
  to: CardId;
}

/**
 * Evolutions open to the deck's cards: 판 안의 진화는 골드를 내지 않고 본편 단련 없이도 된다
 * (13.8.1). One entry per distinct card and branch, in deck order.
 */
export function evolveOptions(deck: readonly CardId[]): EvolveOption[] {
  const out: EvolveOption[] = [];
  const seen = new Set<CardId>();
  for (const card of deck) {
    if (seen.has(card) || CARDS[card].evolutions === null) continue;
    seen.add(card);
    for (const branch of ['power', 'finesse'] as const) {
      const to = evolutionOf(card, branch);
      if (to !== null) out.push({ card, branch, to });
    }
  }
  return out;
}

/** Replaces one copy of the card with its evolution. */
export function evolveInDeck(deck: CardId[], card: CardId, branch: EvolveBranch): boolean {
  const to = evolutionOf(card, branch);
  const i = deck.indexOf(card);
  if (to === null || i < 0) return false;
  deck[i] = to;
  return true;
}
