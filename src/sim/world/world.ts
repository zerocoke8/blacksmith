// World driver (기획서 3.6). Event-based: every hero carries the time of its next
// event, and advanceWorld processes due events in (time, kind, hero) order.
// The state is plain data and is mutated in place; the same seed and the same
// calls always produce the same world.

import { rngFor } from '../core/rng.ts';
import type { Grade, TowerId, Weapon } from '../core/types.ts';
import { bandOf, listPrice, materialPrice, REPAIR_COST_RATE } from '../data/common.ts';
import {
  ASSUMED_LOYALTY_HEARTS,
  BAND_FLOORS,
  CREDIT_PREMIUM_FIRST_VISIT,
  CREDIT_PREMIUM_LATER,
  CREDIT_QUEUE_GRADES,
  CREDIT_SLOTS_START,
  DAY_MINUTES,
  DEMON_LORD_REVIVE_MINUTES,
  DISCIPLE_CHANCE_PER_HEART,
  DISCIPLE_DELAY_MINUTES,
  DISCIPLES_REPLACE_NEW_HEROES,
  FAME_PER_FIRST_CLEAR,
  FAME_PER_RETIRE_RECORD,
  FAME_PER_TOWER_RECORD,
  FIRST_HERO_ARRIVAL_MINUTE,
  FIXED_S_ARRIVAL_MINUTE,
  FLOOR_MINUTES,
  INCOME_UNITS_PER_FLOOR,
  INJURY_REST_MINUTES,
  LUCK_DEATH_TO_INJURY,
  MAX_FLOORS_PER_EXPEDITION,
  REPAIR_VISIT_BELOW,
  RETIRE_AT_DAYS,
  RETIRE_AT_INJURIES,
  RETIRE_HINT_DAYS_EARLY,
  RETIRE_HINT_STAGNANT_MINUTES,
  RETIRE_MIN_DAYS,
  RETIRE_STAGNANT_MINUTES,
  RETURN_AT_DURABILITY,
  RETURN_AT_HP,
  RETURN_BELOW_CLEAR_CHANCE,
  SPAWN_GAP_JITTER_MAX,
  SPAWN_GAP_JITTER_MIN,
  STAGNATION_EXPEDITIONS,
  TOWN_STAY_MINUTES,
  WEAR_BOSS_MAX,
  WEAR_BOSS_MIN,
  WEAR_NORMAL_FLOOR,
} from '../data/world.ts';
import {
  clearChance,
  effectiveClearChance,
  failOdds,
  hpLossOnClear,
  partyPower,
  rollClear,
  rollFailOutcome,
  weaponProfile,
} from './combat.ts';
import { fameStageFor, gradeShares, newHeroesPerDay } from './fame.ts';
import {
  basicWeapon,
  fighterOf,
  levelOf,
  masteryFloorOf,
  newHero,
  NO_INHERIT,
  powerOf,
  rollDisciple,
  rollRookie,
  type RookieRoll,
  startFloorOf,
} from './hero.ts';
import { DEMON_LORD_LINE, deathLine, RETIRE_HINT_LINE, retireLine } from './messages.ts';
import { EventHeap, type EventKey } from './queue.ts';
import { isUpgrade, type SupplyContext, type SupplyPolicy } from './supply.ts';
import { floorInfo, isBossFloor } from './tower.ts';
import type {
  CareerEnd,
  CareerRecord,
  FailOutcome,
  HeroState,
  PendingDisciple,
  PendingFloor,
  RetireReason,
  ReturnReason,
  VisitReason,
  WorldEvent,
  WorldRules,
  WorldState,
} from './types.ts';

export function createWorld(seed: number, rules: Partial<WorldRules> = {}): WorldState {
  return {
    seed,
    rules: {
      disciplesReplaceNewHeroes: DISCIPLES_REPLACE_NEW_HEROES,
      discipleChance: null,
      creditSlots: CREDIT_SLOTS_START,
      ignoreBudget: false,
      ...rules,
    },
    now: 0,
    heroes: [],
    careers: [],
    nextSeq: 1,
    weaponSeq: 1,
    spawnCount: 0,
    nextSpawnAt: FIRST_HERO_ARRIVAL_MINUTE,
    spawnSkips: 0,
    fixedSArrived: false,
    disciples: [],
    discipleCount: 0,
    fame: 0,
    fameStage: 1,
    shopRecord: { water: 0, fire: 0, earth: 0, wind: 0 },
    merchantBand: 1,
    demonLordsDown: [],
    ledger: {
      salesCash: 0,
      creditGiven: 0,
      creditOwed: 0,
      creditRepaid: 0,
      creditLost: 0,
      repairIncome: 0,
      repairUnpaid: 0,
      supplySubsidy: 0,
    },
  };
}

// ---------- Pure rules (exported for tests and UI) ----------

export interface ReturnCheck {
  hp: number;
  durability: number;
  floorsEntered: number;
  maxFloors: number;
  nextClearChance: number;
}

/** 귀환 기준 (7.10), checked before entering each floor. */
export function returnReason(c: ReturnCheck): ReturnReason | null {
  if (c.hp <= RETURN_AT_HP) return 'hp';
  if (c.durability <= RETURN_AT_DURABILITY) return 'durability';
  if (c.floorsEntered >= c.maxFloors) return 'maxFloors';
  if (c.nextClearChance < RETURN_BELOW_CLEAR_CHANCE) return 'risk';
  return null;
}

/** 은퇴 (6.3), judged on every return. */
export function retireReason(
  h: Pick<HeroState, 'grade' | 'arrivedAt' | 'recordAt' | 'injuries'>,
  now: number,
): RetireReason | null {
  const days = (now - h.arrivedAt) / DAY_MINUTES;
  if (h.injuries >= RETIRE_AT_INJURIES) return 'injuries';
  if (days >= RETIRE_AT_DAYS) return 'maxDays';
  if (now - h.recordAt >= RETIRE_STAGNANT_MINUTES && days >= RETIRE_MIN_DAYS[h.grade]) return 'stagnant';
  return null;
}

/** 6.5: a retired hero's disciple comes with chance hearts × 20%, sure at 5 hearts. */
export function discipleChanceFor(hearts: number): number {
  return Math.min(1, Math.max(0, hearts * DISCIPLE_CHANCE_PER_HEART));
}

/**
 * Whether a retiring hero's disciple will come (6.5). The chance comes from the master's
 * hearts unless rules.discipleChance overrides it. One draw on the stream
 * (world seed, 'discipleComes', master id); a sure chance draws nothing.
 */
export function discipleComes(world: Pick<WorldState, 'seed' | 'rules'>, masterId: string, hearts: number): boolean {
  const p = world.rules.discipleChance ?? discipleChanceFor(hearts);
  if (p >= 1) return true;
  if (p <= 0) return false;
  return rngFor(world.seed, 'discipleComes', masterId).chance(p);
}

/** 가게 방문 ②~④ after a return (① first visit and ⑤ farewell are handled elsewhere). */
export function visitReasons(h: Pick<HeroState, 'held' | 'stagnation' | 'debt'>): VisitReason[] {
  const out: VisitReason[] = [];
  if (h.held.durability < REPAIR_VISIT_BELOW) out.push('repair');
  if (h.stagnation >= STAGNATION_EXPEDITIONS) out.push('stagnation');
  if (h.debt > 0) out.push('debt');
  return out;
}

export function supplyContext(world: WorldState, now: number): SupplyContext {
  return { seed: world.seed, now, merchantBand: world.merchantBand, demonLordsDown: world.demonLordsDown };
}

export function heroById(world: WorldState, id: string): HeroState | undefined {
  return world.heroes.find((h) => h.id === id);
}

// ---------- Scheduling ----------

/** Same-time events run in this kind order, then by hero creation order (3.6). */
export const EVENT_ORDER = ['floor', 'depart', 'disciple', 'fixedS', 'spawn'] as const;
type ScheduledKind = (typeof EVENT_ORDER)[number];

const RANK: Record<ScheduledKind, number> = { floor: 0, depart: 1, disciple: 2, fixedS: 3, spawn: 4 };

interface Scheduled extends EventKey {
  kind: ScheduledKind;
  hero: HeroState | null;
  disciple: PendingDisciple | null;
}

interface Ctx {
  world: WorldState;
  policy: SupplyPolicy;
  out: WorldEvent[];
  queue: EventHeap<Scheduled>;
  /** Heroes that left the world during this call; their queued entries are dropped. */
  gone: Set<HeroState>;
}

function heroEntry(h: HeroState): Scheduled {
  const kind: ScheduledKind = h.phase === 'climbing' ? 'floor' : 'depart';
  return { at: h.nextAt, rank: RANK[kind], order: h.seq, kind, hero: h, disciple: null };
}

function discipleEntry(d: PendingDisciple): Scheduled {
  return { at: d.at, rank: RANK.disciple, order: d.master.seq, kind: 'disciple', hero: null, disciple: d };
}

function spawnEntry(world: WorldState): Scheduled {
  return { at: world.nextSpawnAt, rank: RANK.spawn, order: 0, kind: 'spawn', hero: null, disciple: null };
}

/**
 * Runs every event due at or before `until` and returns what happened, in order.
 * World time never goes back: an `until` in the past does nothing.
 * The queue is rebuilt from the state on each call, so the state alone is the save.
 */
export function advanceWorld(world: WorldState, until: number, policy: SupplyPolicy): WorldEvent[] {
  const ctx: Ctx = { world, policy, out: [], queue: new EventHeap<Scheduled>(), gone: new Set() };
  if (until < world.now) return ctx.out;
  for (const h of world.heroes) ctx.queue.push(heroEntry(h));
  for (const d of world.disciples) ctx.queue.push(discipleEntry(d));
  if (!world.fixedSArrived) {
    ctx.queue.push({ at: FIXED_S_ARRIVAL_MINUTE, rank: RANK.fixedS, order: 0, kind: 'fixedS', hero: null, disciple: null });
  }
  ctx.queue.push(spawnEntry(world));

  for (;;) {
    const ev = ctx.queue.peek();
    if (ev === undefined || ev.at > until) break;
    ctx.queue.pop();
    world.now = Math.max(world.now, ev.at);
    switch (ev.kind) {
      case 'floor':
      case 'depart': {
        const hero = ev.hero as HeroState;
        if (ctx.gone.has(hero)) break;
        if (ev.kind === 'floor') floorStep(ctx, hero, ev.at);
        else depart(ctx, hero, ev.at);
        // Each hero has exactly one live entry: re-queue it after its own event.
        if (!ctx.gone.has(hero)) ctx.queue.push(heroEntry(hero));
        break;
      }
      case 'disciple':
        discipleArrives(ctx, ev.disciple as PendingDisciple, ev.at);
        break;
      case 'fixedS':
        fixedSArrives(ctx, ev.at);
        break;
      case 'spawn':
        spawnArrives(ctx, ev.at);
        ctx.queue.push(spawnEntry(world));
        break;
    }
  }
  world.now = until;
  return ctx.out;
}

// ---------- Arrivals ----------

function rookieFromRoll(ctx: Ctx, roll: RookieRoll, at: number): HeroState {
  const world = ctx.world;
  const seq = world.nextSeq++;
  const id = `h${seq}`;
  return newHero({
    id,
    seq,
    at,
    grade: roll.grade,
    growth: roll.growth,
    charisma: roll.charisma,
    luck: roll.luck,
    weaponType: roll.weaponType,
    tower: roll.tower,
    gold: roll.gold,
    held: { weapon: basicWeapon(`${id}-basic`, roll.weaponType), mine: false, durability: 1 },
    generation: 1,
    masterId: null,
    inherit: { ...NO_INHERIT, picks: [] },
  });
}

function spawnArrives(ctx: Ctx, at: number): void {
  const world = ctx.world;
  const n = world.spawnCount++;
  if (world.spawnSkips > 0) {
    world.spawnSkips--; // a disciple already took this arrival
  } else {
    const roll = rollRookie(rngFor(world.seed, 'spawn', n), gradeShares(world.fameStage));
    arrive(ctx, rookieFromRoll(ctx, roll, at), at);
  }
  const gapRng = rngFor(world.seed, 'spawnGap', n);
  const jitter = SPAWN_GAP_JITTER_MIN + gapRng.next() * (SPAWN_GAP_JITTER_MAX - SPAWN_GAP_JITTER_MIN);
  world.nextSpawnAt = at + Math.max(1, Math.round((DAY_MINUTES / newHeroesPerDay(world.fameStage)) * jitter));
}

function fixedSArrives(ctx: Ctx, at: number): void {
  const world = ctx.world;
  world.fixedSArrived = true;
  const roll = rollRookie(rngFor(world.seed, 'fixedS', 0), gradeShares(world.fameStage), 'S');
  arrive(ctx, rookieFromRoll(ctx, roll, at), at);
}

function discipleArrives(ctx: Ctx, pending: PendingDisciple, at: number): void {
  const world = ctx.world;
  world.disciples = world.disciples.filter((d) => d !== pending);
  if (world.rules.disciplesReplaceNewHeroes) world.spawnSkips++;
  const n = world.discipleCount++;
  const master = pending.master;
  const roll = rollDisciple(rngFor(world.seed, 'disciple', n), master, pending.hearts);
  const seq = world.nextSeq++;
  const hero = newHero({
    id: `h${seq}`,
    seq,
    at,
    grade: roll.grade,
    growth: roll.growth,
    charisma: roll.charisma,
    luck: roll.luck,
    weaponType: master.weaponType,
    tower: master.tower,
    gold: roll.gold,
    // The master's weapon, record and all, comes with the disciple (6.5).
    held: { weapon: { ...master.weapon, enchants: [...master.weapon.enchants] }, mine: master.weaponMine, durability: 1 },
    generation: master.generation + 1,
    masterId: master.id,
    inherit: roll.inherit,
  });
  arrive(ctx, hero, at);
}

function arrive(ctx: Ctx, hero: HeroState, at: number): void {
  ctx.world.heroes.push(hero);
  ctx.gone.delete(hero);
  ctx.out.push({
    kind: 'arrival',
    at,
    heroId: hero.id,
    grade: hero.grade,
    disciple: hero.masterId !== null,
    masterId: hero.masterId,
  });
  visit(ctx, hero, at, ['first']);
  hero.phase = 'town';
  hero.nextAt = at + TOWN_STAY_MINUTES;
  ctx.queue.push(heroEntry(hero));
}

// ---------- Expedition ----------

function depart(ctx: Ctx, hero: HeroState, at: number): void {
  hero.expeditionNo++;
  const start = startFloorOf(hero.lastBossFloor);
  hero.expedition = {
    no: hero.expeditionNo,
    startFloor: start,
    floor: start,
    floorsEntered: 0,
    hp: 1,
    recordAtStart: hero.record,
    rebirthUsed: false,
    indomitableUsed: false,
    pending: null,
  };
  hero.phase = 'climbing';
  hero.nextAt = at; // first floor step runs right away
  ctx.out.push({ kind: 'depart', at, heroId: hero.id, expeditionNo: hero.expeditionNo, startFloor: start });
}

/**
 * One step on the climb: reveal the floor entered 20 minutes ago, then either turn
 * back or enter the next floor. 출발 → 층마다 [귀환 판단 → 내구도 차감 → 돌파 판정 →
 * HP 차감·골드 획득] → 귀환 (7.8). The entered floor's result is fixed on entry.
 */
function floorStep(ctx: Ctx, hero: HeroState, at: number): void {
  const world = ctx.world;
  const exp = hero.expedition;
  if (exp === null) throw new Error(`floorStep without expedition: ${hero.id}`);

  if (exp.pending !== null) {
    const p = exp.pending;
    exp.pending = null;
    if (p.dull) ctx.out.push({ kind: 'dull', at, heroId: hero.id, floor: p.floor });
    if (!p.cleared) {
      endExpedition(ctx, hero, at, 'failed', p.outcome, p.floor);
      return;
    }
    applyClear(ctx, hero, p, at);
    if (p.dull) {
      endExpedition(ctx, hero, at, 'dull', null, p.floor);
      return;
    }
    exp.floor = p.floor + 1;
  }

  const profile = weaponProfile(hero.held.weapon, masteryFloorOf(hero));
  const fighter = fighterOf(hero);
  const info = floorInfo(world.seed, hero.tower, exp.floor, at, world.demonLordsDown);
  const nextChance = clearChance(partyPower(profile, fighter, info) / info.enemyPower);
  const reason = returnReason({
    hp: exp.hp,
    durability: hero.held.durability,
    floorsEntered: exp.floorsEntered,
    maxFloors: MAX_FLOORS_PER_EXPEDITION + profile.extraFloors,
    nextClearChance: effectiveClearChance(nextChance, profile.fairWind),
  });
  if (reason !== null) {
    endExpedition(ctx, hero, at, reason, null, exp.floor);
    return;
  }

  // Enter the floor: wear first, then judge with the floor's own stream (3.6).
  const rng = rngFor(world.seed, 'floor', hero.id, exp.no, exp.floor);
  const boss = info.kind !== 'normal';
  const wear = boss ? WEAR_BOSS_MIN + rng.next() * (WEAR_BOSS_MAX - WEAR_BOSS_MIN) : WEAR_NORMAL_FLOOR;
  hero.held.durability = Math.max(0, hero.held.durability - wear * profile.wearMult);
  const dull = hero.held.durability <= 0;
  if (dull) hero.stats.dullCount++;

  const r = partyPower(profile, fighter, info, dull) / info.enemyPower;
  const chance = clearChance(r);
  let cleared = rollClear(rng, chance, profile.fairWind);
  if (!cleared && profile.rebirth && !exp.rebirthUsed) {
    exp.rebirthUsed = true; // 환생: judge the same floor once more, HP unchanged
    cleared = rollClear(rng, chance, profile.fairWind);
  }
  let outcome: FailOutcome | null = null;
  if (!cleared) {
    const odds = failOdds(exp.hp, boss, profile.riskMult, hero.inherit.injuryMult);
    const roll = rollFailOutcome(rng, odds, LUCK_DEATH_TO_INJURY[hero.luck], profile.indomitable && !exp.indomitableUsed);
    if (roll.indomitableUsed) exp.indomitableUsed = true;
    outcome = roll.outcome;
  }
  exp.pending = {
    floor: exp.floor,
    kind: info.kind,
    cleared,
    outcome,
    hpLoss: cleared ? hpLossOnClear(r, boss) : 0,
    dull,
    r,
    chance,
  };
  exp.floorsEntered++;
  hero.nextAt = at + FLOOR_MINUTES;
}

function applyClear(ctx: Ctx, hero: HeroState, p: PendingFloor, at: number): void {
  const world = ctx.world;
  const exp = hero.expedition;
  if (exp !== null) exp.hp = Math.max(0, exp.hp - p.hpLoss);
  hero.cumulativeFloors++;
  hero.stats.floorsCleared++;

  const profile = weaponProfile(hero.held.weapon, masteryFloorOf(hero));
  const income = materialPrice(bandOf(p.floor)) * INCOME_UNITS_PER_FLOOR * profile.incomeMult;
  hero.gold += income;
  hero.stats.goldEarned += income;

  if (isBossFloor(p.floor)) {
    hero.lastBossFloor = Math.max(hero.lastBossFloor, p.floor);
    if (p.kind === 'demonLord') {
      world.demonLordsDown = world.demonLordsDown.filter((d) => d.until > at);
      world.demonLordsDown.push({ tower: hero.tower, floor: p.floor, until: at + DEMON_LORD_REVIVE_MINUTES });
      ctx.out.push({
        kind: 'demonLordSlain',
        at,
        heroId: hero.id,
        tower: hero.tower,
        floor: p.floor,
        message: DEMON_LORD_LINE,
      });
    }
    // 4.4: our weapon clears band n → the merchant stocks band n+1.
    const nextBand = p.floor / BAND_FLOORS + 1;
    if (hero.held.mine && nextBand > world.merchantBand) {
      world.merchantBand = nextBand;
      ctx.out.push({ kind: 'merchantBand', at, band: nextBand });
    }
  }

  if (p.floor > hero.record) {
    hero.record = p.floor;
    hero.recordAt = at;
    hero.retireHinted = false;
    ctx.out.push({ kind: 'record', at, heroId: hero.id, tower: hero.tower, floor: p.floor, mine: hero.held.mine });
    if (hero.held.mine) {
      addFame(ctx, at, p.floor * FAME_PER_FIRST_CLEAR, 'firstClear');
      const tower: TowerId = hero.tower;
      if (p.floor > world.shopRecord[tower]) {
        world.shopRecord[tower] = p.floor;
        ctx.out.push({ kind: 'shopRecord', at, tower, floor: p.floor, heroId: hero.id });
        addFame(ctx, at, p.floor * FAME_PER_TOWER_RECORD, 'towerRecord');
      }
    }
  }
}

function endExpedition(
  ctx: Ctx,
  hero: HeroState,
  at: number,
  reason: ReturnReason,
  outcome: FailOutcome | null,
  floor: number,
): void {
  const exp = hero.expedition;
  if (exp === null) return;
  hero.stats.expeditions++;
  if (reason === 'failed') hero.stats.failures++;
  const improved = hero.record > exp.recordAtStart;
  hero.stagnation = improved ? 0 : hero.stagnation + 1;
  hero.expedition = null;
  hero.phase = 'town';
  ctx.out.push({
    kind: 'return',
    at,
    heroId: hero.id,
    expeditionNo: exp.no,
    reason,
    outcome,
    floorsCleared: exp.floorsEntered - (reason === 'failed' ? 1 : 0),
    record: hero.record,
    recordImproved: improved,
  });

  if (outcome === 'death') {
    die(ctx, hero, at, floor);
    return;
  }
  if (outcome === 'injury') {
    hero.injuries++;
    hero.restUntil = at + INJURY_REST_MINUTES;
    ctx.out.push({ kind: 'injury', at, heroId: hero.id, floor, count: hero.injuries });
  }

  const retire = retireReason(hero, at);
  if (retire !== null) {
    visit(ctx, hero, at, ['farewell']);
    retireHero(ctx, hero, at, retire);
    return;
  }
  // The farewell hint only comes once retiring is actually possible within about a day.
  const careerDays = (at - hero.arrivedAt) / DAY_MINUTES;
  if (
    !hero.retireHinted &&
    at - hero.recordAt >= RETIRE_HINT_STAGNANT_MINUTES &&
    careerDays >= RETIRE_MIN_DAYS[hero.grade] - RETIRE_HINT_DAYS_EARLY
  ) {
    hero.retireHinted = true;
    ctx.out.push({ kind: 'retireHint', at, heroId: hero.id, message: RETIRE_HINT_LINE });
  }

  const reasons = visitReasons(hero);
  if (reasons.length > 0) visit(ctx, hero, at, reasons);
  hero.nextAt = Math.max(at + TOWN_STAY_MINUTES, hero.restUntil);
}

// ---------- Shop visit (6.3, 5.1, 5.3, 8) ----------

/**
 * Visits where the policy may hand over a weapon on credit: the first visit and the
 * 'stuck, need a new weapon' visit (6.3 ③). Elsewhere the hero buys off the shelf
 * only within budget (5.1).
 */
const CREDIT_VISIT_REASONS: readonly VisitReason[] = ['first', 'stagnation'];

export function repairCost(w: Pick<Weapon, 'materialTier' | 'quality'>): number {
  return listPrice(w.materialTier, w.quality) * REPAIR_COST_RATE;
}

/** Credits open right now, shop-wide (one per hero at most, 5.3). */
export function openCredits(world: Pick<WorldState, 'heroes'>): number {
  let n = 0;
  for (const h of world.heroes) if (h.debt > 0) n++;
  return n;
}

export interface SaleInput {
  price: number;
  /** 예산 = 보유 골드 − 다음 수리비 (6.3). */
  budget: number;
  grade: Grade;
  disciple: boolean;
  reasons: readonly VisitReason[];
  /** Credit the hero still owes. */
  debt: number;
  firstVisitDone: boolean;
  openCredits: number;
  creditSlots: number;
}

export type SaleTerms = { kind: 'cash' } | { kind: 'credit'; owed: number };

/**
 * How a better weapon changes hands (5.1, 5.3), or null when it cannot.
 * - Cash whenever the price fits the budget; credit is never used then.
 * - Credit only for a hero waiting in the queue (B grade and up, or a disciple's first
 *   visit), on a first or 'stuck' visit, with no open credit of their own, and while
 *   the shop has a free credit slot.
 * - Credit covers the whole price and no cash changes hands: owed = price × (1 + premium).
 */
export function saleTerms(s: SaleInput): SaleTerms | null {
  if (s.price <= s.budget) return { kind: 'cash' };
  const queued = CREDIT_QUEUE_GRADES.includes(s.grade) || (s.disciple && s.reasons.includes('first'));
  const creditVisit = s.reasons.some((r) => CREDIT_VISIT_REASONS.includes(r));
  if (!queued || !creditVisit || s.debt > 0 || s.openCredits >= s.creditSlots) return null;
  const premium = s.firstVisitDone ? CREDIT_PREMIUM_LATER : CREDIT_PREMIUM_FIRST_VISIT;
  return { kind: 'credit', owed: s.price * (1 + premium) };
}

function visit(ctx: Ctx, hero: HeroState, at: number, reasons: VisitReason[]): void {
  const world = ctx.world;
  const ledger = world.ledger;
  const farewell = reasons.includes('farewell');
  hero.stats.visits++;

  const durabilityBefore = hero.held.durability;
  let repaired = false;
  // 일반 수리 below 50% (7.12); a hero visiting for other reasons keeps a healthier weapon as is.
  if (!farewell && durabilityBefore < REPAIR_VISIT_BELOW) {
    const w = hero.held.weapon;
    const cost = repairCost(w);
    const paid = Math.min(Math.max(0, hero.gold), cost);
    hero.gold -= paid;
    ledger.repairIncome += paid;
    ledger.repairUnpaid += cost - paid;
    hero.held.durability = 1;
    hero.stats.repairs++;
    repaired = true;
  }
  // Repair first, then whatever is left goes to the debt (5.3).
  if (hero.debt > 0) {
    const pay = Math.min(Math.max(0, hero.gold), hero.debt);
    hero.gold -= pay;
    hero.debt -= pay;
    ledger.creditRepaid += pay;
  }

  let bought = null;
  let credit = 0;
  if (!farewell) {
    const sctx = supplyContext(world, at);
    const offer = ctx.policy.offer(hero, sctx);
    if (offer !== null && isUpgrade(offer, hero, sctx)) {
      const price = listPrice(offer.materialTier, offer.quality);
      const budget = hero.gold - repairCost(hero.held.weapon);
      const terms: SaleTerms | { kind: 'subsidy' } | null = world.rules.ignoreBudget
        ? price <= budget
          ? { kind: 'cash' }
          : { kind: 'subsidy' }
        : saleTerms({
            price,
            budget,
            grade: hero.grade,
            disciple: hero.masterId !== null,
            reasons,
            debt: hero.debt,
            firstVisitDone: hero.firstVisitDone,
            openCredits: budget >= price ? 0 : openCredits(world),
            creditSlots: world.rules.creditSlots,
          });
      if (terms !== null) {
        if (terms.kind === 'cash') {
          hero.gold -= price;
          ledger.salesCash += price;
        } else if (terms.kind === 'credit') {
          hero.debt = terms.owed;
          credit = terms.owed;
          ledger.creditGiven += price;
          ledger.creditOwed += terms.owed;
        } else {
          // Simulator only: pay what the budget allows, write off the rest.
          const cash = Math.max(0, Math.min(price, budget));
          hero.gold -= cash;
          ledger.salesCash += cash;
          ledger.supplySubsidy += price - cash;
        }
        const weapon = { ...offer, enchants: [...offer.enchants], id: `w${world.weaponSeq++}` };
        hero.held = { weapon, mine: true, durability: 1 };
        hero.stagnation = 0;
        hero.stats.weaponsBought++;
        bought = weapon;
      }
    }
  }
  hero.firstVisitDone = true;
  ctx.out.push({ kind: 'visit', at, heroId: hero.id, reasons, repaired, durabilityBefore, bought, credit });
}

// ---------- Endings ----------

function careerOf(hero: HeroState, at: number, end: CareerEnd, diedOnFloor: number | null): CareerRecord {
  return {
    id: hero.id,
    seq: hero.seq,
    grade: hero.grade,
    growth: hero.growth,
    charisma: hero.charisma,
    luck: hero.luck,
    weaponType: hero.weaponType,
    tower: hero.tower,
    generation: hero.generation,
    masterId: hero.masterId,
    inherited: [...hero.inherit.picks],
    arrivedAt: hero.arrivedAt,
    endedAt: at,
    end,
    record: hero.record,
    finalLevel: levelOf(hero),
    finalPower: powerOf(hero),
    injuries: hero.injuries,
    diedOnFloor,
    weapon: { ...hero.held.weapon, enchants: [...hero.held.weapon.enchants] },
    weaponMine: hero.held.mine,
    stats: { ...hero.stats },
  };
}

function removeHero(ctx: Ctx, hero: HeroState): void {
  ctx.world.heroes = ctx.world.heroes.filter((h) => h !== hero);
  ctx.gone.add(hero);
}

function die(ctx: Ctx, hero: HeroState, at: number, floor: number): void {
  const world = ctx.world;
  world.ledger.creditLost += hero.debt;
  world.careers.push(careerOf(hero, at, 'dead', floor));
  removeHero(ctx, hero);
  ctx.out.push({
    kind: 'death',
    at,
    heroId: hero.id,
    floor,
    record: hero.record,
    message: deathLine(hero.grade, hero.weaponType),
  });
}

function retireHero(ctx: Ctx, hero: HeroState, at: number, reason: RetireReason): void {
  const world = ctx.world;
  // A retiring hero settles all credit (5.3).
  world.ledger.creditRepaid += hero.debt;
  hero.debt = 0;
  const career = careerOf(hero, at, 'retired', null);
  world.careers.push(career);
  removeHero(ctx, hero);
  // Loyalty is not simulated yet; every master is assumed to have the same hearts.
  const hearts = ASSUMED_LOYALTY_HEARTS;
  const coming = discipleComes(world, hero.id, hearts);
  if (coming) {
    const pending: PendingDisciple = { at: at + DISCIPLE_DELAY_MINUTES, master: career, hearts };
    world.disciples.push(pending);
    ctx.queue.push(discipleEntry(pending));
  }
  ctx.out.push({
    kind: 'retire',
    at,
    heroId: hero.id,
    record: hero.record,
    reason,
    message: retireLine(hero.grade, hero.weaponType, coming),
  });
  if (hero.held.mine) addFame(ctx, at, hero.record * FAME_PER_RETIRE_RECORD, 'retire');
}

// ---------- Fame (9.1, 9.2) ----------

function addFame(ctx: Ctx, at: number, amount: number, source: 'firstClear' | 'towerRecord' | 'retire'): void {
  if (amount <= 0) return;
  const world = ctx.world;
  world.fame += amount;
  ctx.out.push({ kind: 'fame', at, amount, total: world.fame, source });
  const stage = fameStageFor(world.fame);
  while (world.fameStage < stage) {
    world.fameStage++;
    ctx.out.push({ kind: 'fameStage', at, stage: world.fameStage });
  }
}
