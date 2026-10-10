// World state and events. Everything here is plain data so a save can hold it as-is.

import type { BodyType, Grade, TowerId, Weapon, WeaponType } from '../core/types.ts';
import type { InheritId, StatTier } from '../data/world.ts';

/** A weapon in a hero's hands. */
export interface HeldWeapon {
  weapon: Weapon;
  /** Made in our shop. Fame and merchant unlocks only count these (9.1, 4.4). */
  mine: boolean;
  /** 0..1 */
  durability: number;
}

/** Numbers a disciple carries from the master (6.5). Neutral values for everyone else. */
export interface InheritBonus {
  picks: InheritId[];
  /** Strength at level 1 (1.0 + master power × 0.15 with '강함'). */
  startPower: number;
  /** Added to the best floor when judging weapon mastery. */
  masteryFloorBonus: number;
  /** 기타 배율 from '탑 적응'. */
  powerMult: number;
  /** Injury chance multiplier from '강인함'. */
  injuryMult: number;
}

export type FloorKind = 'normal' | 'sectionBoss' | 'greatBoss' | 'demonLord';

export interface FloorInfo {
  tower: TowerId;
  floor: number;
  band: number;
  kind: FloorKind;
  body: BodyType;
  /** Enemy power including the boss multiplier. */
  enemyPower: number;
}

export type FailOutcome = 'safe' | 'injury' | 'death';

/** A floor result fixed on entry and revealed one floor-time later (3.6). */
export interface PendingFloor {
  floor: number;
  kind: FloorKind;
  cleared: boolean;
  outcome: FailOutcome | null;
  hpLoss: number;
  dull: boolean;
  r: number;
  chance: number;
}

export interface ExpeditionState {
  no: number;
  startFloor: number;
  /** Floor the hero will enter next. */
  floor: number;
  floorsEntered: number;
  hp: number;
  recordAtStart: number;
  rebirthUsed: boolean;
  indomitableUsed: boolean;
  pending: PendingFloor | null;
}

export type HeroPhase = 'town' | 'climbing';

export interface HeroStats {
  expeditions: number;
  floorsCleared: number;
  failures: number;
  dullCount: number;
  visits: number;
  repairs: number;
  weaponsBought: number;
  goldEarned: number;
}

export interface HeroState {
  id: string;
  /** Creation order; also the tie-break order of same-time events (3.6). */
  seq: number;
  grade: Grade;
  /** Hidden growth rate 0.3..1.0. */
  growth: number;
  charisma: StatTier;
  luck: StatTier;
  weaponType: WeaponType;
  tower: TowerId;
  arrivedAt: number;
  generation: number;
  masterId: string | null;
  inherit: InheritBonus;
  held: HeldWeapon;
  gold: number;
  debt: number;
  /** Best floor cleared (기록). */
  record: number;
  recordAt: number;
  /** Highest boss floor cleared; the next expedition starts one floor above it. */
  lastBossFloor: number;
  cumulativeFloors: number;
  injuries: number;
  restUntil: number;
  /** Expeditions in a row without a new record. */
  stagnation: number;
  retireHinted: boolean;
  firstVisitDone: boolean;
  phase: HeroPhase;
  /** Time of this hero's next event: departure in town, next floor step while climbing. */
  nextAt: number;
  expeditionNo: number;
  expedition: ExpeditionState | null;
  stats: HeroStats;
}

export type CareerEnd = 'retired' | 'dead';

/** What remains of a hero after the career ends (가계도, 전적, 밸런스 집계). */
export interface CareerRecord {
  id: string;
  seq: number;
  grade: Grade;
  growth: number;
  charisma: StatTier;
  luck: StatTier;
  weaponType: WeaponType;
  tower: TowerId;
  generation: number;
  masterId: string | null;
  inherited: InheritId[];
  arrivedAt: number;
  endedAt: number;
  end: CareerEnd;
  record: number;
  finalLevel: number;
  finalPower: number;
  injuries: number;
  diedOnFloor: number | null;
  weapon: Weapon;
  weaponMine: boolean;
  stats: HeroStats;
}

/** A disciple waiting to arrive. Holds what the master leaves behind. */
export interface PendingDisciple {
  at: number;
  master: CareerRecord;
  /** Master's loyalty hearts; feeds the random inheritance count. */
  hearts: number;
}

export interface DemonLordDown {
  tower: TowerId;
  floor: number;
  until: number;
}

export interface ShopLedger {
  /** Gold paid in cash for weapons. */
  salesCash: number;
  /** Sale prices handed over on credit (principal). */
  creditGiven: number;
  /** What those credits owe back: principal + premium. */
  creditOwed: number;
  /** Paid back, premium included. */
  creditRepaid: number;
  /** Written off when a debtor died, premium included. */
  creditLost: number;
  repairIncome: number;
  /** Repair cost a hero could not pay; the repair is done anyway (일반 수리는 자동). */
  repairUnpaid: number;
  /** Simulator only (rules.ignoreBudget): weapon price the hero could not pay, written off. */
  supplySubsidy: number;
}

/** Rule switches the doc leaves open; the simulator can flip them to compare. */
export interface WorldRules {
  /** A disciple's arrival uses up one of the day's new-hero arrivals (9.2). */
  disciplesReplaceNewHeroes: boolean;
  /**
   * Chance (0~1) that a retired hero's disciple comes at all. null = the game rule,
   * master's hearts × 20% (6.5); a number overrides it for comparisons. Rolled once per
   * retirement on its own stream. A disciple who never comes takes no arrival.
   */
  discipleChance: number | null;
  /** Credits open at once, shop-wide (5.3: 2, up to 6 with the 외상 장부 facility). */
  creditSlots: number;
  /**
   * Simulator only, off in the game: the hero takes the policy's weapon whatever the
   * budget, paying what the budget allows. Measures the power curve (7.3, 7.4) apart
   * from the economy (5.3, 10).
   */
  ignoreBudget: boolean;
}

export interface WorldState {
  seed: number;
  rules: WorldRules;
  /** World minutes processed so far. */
  now: number;
  /** Active heroes in creation order. */
  heroes: HeroState[];
  careers: CareerRecord[];
  nextSeq: number;
  weaponSeq: number;
  spawnCount: number;
  nextSpawnAt: number;
  /** Spawns to skip because disciples already took their place (rules.disciplesReplaceNewHeroes). */
  spawnSkips: number;
  fixedSArrived: boolean;
  disciples: PendingDisciple[];
  discipleCount: number;
  fame: number;
  fameStage: number;
  /** Best floor reached with our weapons, per tower. */
  shopRecord: Record<TowerId, number>;
  /** Highest main-material band the merchant sells. */
  merchantBand: number;
  demonLordsDown: DemonLordDown[];
  ledger: ShopLedger;
}

export type ReturnReason = 'hp' | 'durability' | 'risk' | 'maxFloors' | 'dull' | 'failed';

export type VisitReason = 'first' | 'repair' | 'stagnation' | 'debt' | 'farewell';

export type WorldEvent =
  | { kind: 'arrival'; at: number; heroId: string; grade: Grade; disciple: boolean; masterId: string | null }
  | { kind: 'depart'; at: number; heroId: string; expeditionNo: number; startFloor: number }
  | {
      kind: 'return';
      at: number;
      heroId: string;
      expeditionNo: number;
      reason: ReturnReason;
      outcome: FailOutcome | null;
      floorsCleared: number;
      record: number;
      recordImproved: boolean;
    }
  | { kind: 'record'; at: number; heroId: string; tower: TowerId; floor: number; mine: boolean }
  | { kind: 'shopRecord'; at: number; tower: TowerId; floor: number; heroId: string }
  | { kind: 'injury'; at: number; heroId: string; floor: number; count: number }
  | { kind: 'death'; at: number; heroId: string; floor: number; record: number; message: string }
  | { kind: 'retireHint'; at: number; heroId: string; message: string }
  | { kind: 'retire'; at: number; heroId: string; record: number; reason: RetireReason; message: string }
  | {
      kind: 'visit';
      at: number;
      heroId: string;
      reasons: VisitReason[];
      repaired: boolean;
      durabilityBefore: number;
      bought: Weapon | null;
      /** Gold now owed for `bought` (price + premium) when it went on credit, else 0. */
      credit: number;
    }
  | { kind: 'dull'; at: number; heroId: string; floor: number }
  | { kind: 'fame'; at: number; amount: number; total: number; source: 'firstClear' | 'towerRecord' | 'retire' }
  | { kind: 'fameStage'; at: number; stage: number }
  | { kind: 'merchantBand'; at: number; band: number }
  | { kind: 'demonLordSlain'; at: number; heroId: string; tower: TowerId; floor: number; message: string };

export type RetireReason = 'stagnant' | 'injuries' | 'maxDays';
