// 일일 보스 (기획서 8.1, 8.2): one boss a day on a five-day turn, in stages. A try is a 60 s fight
// with the daily formation; killing the boss clears the stage, opens the next and gives the five
// tries back; otherwise the try's damage stays. The day's record is (가장 높은 잡은 단계, 막힌 단계에
// 한 번에 준 가장 큰 데미지) (8.3, 15장의 3번 추천). Pure.
// The day number, the reset and the ranking groups are the server's (8.3, 13장); src/platform/server.ts
// stands in for it today. A try the screen plays live comes in two halves: beginDailyTry spends the
// try before the fight (closing the app mid-try cannot take back a bad one) and finishDailyTry.

import { BOSS_POWER_MULT, CRIT_DAMAGE, powInt } from '../data/common.ts';
import { type CritMode, DAILY_CLIMB_MAX_TRIES, DAILY_TIME_LIMIT_TICKS } from '../data/battle.ts';
import {
  DAILY_BOSS_ROAR,
  DAILY_BOSSES,
  DAILY_DAY_MINUTES,
  DAILY_STAGE,
  DAILY_TRIES,
  type DailyBossSpec,
  FLOOR_GROWTH,
  MOB_GROUP_BASE,
  MOB_STATS,
  monsterSpec,
  type MonsterSpec,
} from '../data/monsters.ts';
import type { HeroesState } from '../hero/save.ts';
import { type BattleResult, type BattleSetup, type EnemyUnit, runBattle, type SignatureMode } from '../stage/battle.ts';
import type { Formation } from '../stage/formation.ts';
import { buildTeam } from '../stage/team.ts';

export interface DailyState {
  /** The server's day number (1 = the first day; the boss turn counts from it). */
  day: number;
  /** The highest stage killed today (0 = none). */
  cleared: number;
  /** Tries left at the next stage (cleared + 1). */
  tries: number;
  /** The biggest damage of one try at the next stage. */
  bestDamage: number;
  /** 도전 번호 today: the crit stream key. */
  attempts: number;
}

export function newDailyState(day: number): DailyState {
  return { day: Math.max(1, Math.floor(day)), cleared: 0, tries: DAILY_TRIES, bestDamage: 0, attempts: 0 };
}

/** A new day starts afresh (8.2: 횟수는 그날의 것, 쌓이지 않는다; 매일 1단계부터, 15장의 3번 추천). */
export function rollDailyTo(state: DailyState, day: number): DailyState {
  return Math.floor(day) > state.day ? newDailyState(day) : state;
}

/** The server's day number of a world minute (the day's start hour is [미정], 16장의 13번: 0시 for now). */
export function dayOfMinute(minute: number): number {
  return Math.floor(Math.max(0, minute) / DAILY_DAY_MINUTES) + 1;
}

/** The day's boss (8.1 추천 5일 돌림): day 1 연못 거북, 2 두더지 광부, 3 딸꾹 드래곤, 4 뭉게 정령, 5 가마솥 대감. */
export function dailyBossOf(day: number): { spec: DailyBossSpec; monster: MonsterSpec } {
  const n = DAILY_BOSSES.length;
  const i = (((Math.floor(day) - 1) % n) + n) % n;
  const spec = DAILY_BOSSES[i] as DailyBossSpec;
  return { spec, monster: monsterSpec(spec.key) };
}

/** The floor a stage fights like (8.2: 스테이지 곡선과 같은 모양, 시작점만 다르게). */
export function dailyStageFloor(stage: number): number {
  return DAILY_STAGE.firstFloor + (Math.max(1, Math.floor(stage)) - 1) * DAILY_STAGE.floorsPerStage;
}

/** The boss of a day at a stage, as a fighter, with its roar (data/monsters.ts DAILY_BOSS_ROAR). */
export function dailyBossUnit(day: number, stage: number): EnemyUnit {
  const { spec, monster } = dailyBossOf(day);
  const s = powInt(FLOOR_GROWTH, dailyStageFloor(stage) - 1);
  const groupHp = MOB_STATS.hp * MOB_GROUP_BASE;
  const groupAtkPerTick = (MOB_STATS.atk * MOB_GROUP_BASE) / MOB_STATS.intervalTicks;
  return {
    id: 'e0',
    key: monster.key,
    name: monster.name,
    body: monster.body,
    element: monster.element,
    boss: true,
    maxHp: Math.max(1, Math.round(groupHp * DAILY_STAGE.hpOfGroup * BOSS_POWER_MULT * spec.hp * s)),
    atk: Math.max(1, Math.round(groupAtkPerTick * DAILY_STAGE.intervalTicks * DAILY_STAGE.atkOfGroup * BOSS_POWER_MULT * spec.atk * s)),
    def: Math.round(MOB_STATS.def * DAILY_STAGE.def * spec.def * s),
    pen: Math.max(1, Math.round(MOB_STATS.atk * s)),
    crit: DAILY_STAGE.crit,
    critDamage: CRIT_DAMAGE,
    intervalTicks: DAILY_STAGE.intervalTicks,
    skill: DAILY_BOSS_ROAR,
  };
}

export interface DailyContext {
  battleSeed: number;
  heroes: HeroesState;
  /** 일일 보스 편성 (6.3: 스테이지 편성과 따로). */
  formation: Formation;
  critMode?: CritMode;
  /** The signature mode the fight starts in (the screen's AUTO button; default 'auto'). */
  signatures?: SignatureMode;
}

export interface DailyTry {
  stage: number;
  attempt: number;
  won: boolean;
  result: BattleResult;
  state: DailyState;
}

/** The battle stream of a try: (seed, 'battle', 'daily', 날, 단계, 도전 번호) (3.5). */
export function dailyBattleKey(day: number, stage: number, attempt: number): ['battle', 'daily', number, number, number] {
  return ['battle', 'daily', day, stage, attempt];
}

/** A try that has begun: its battle to run (or step live) and the state to save now. */
export interface BegunDailyTry {
  stage: number;
  attempt: number;
  setup: BattleSetup;
  /** The state with this try spent (tries − 1, attempts + 1): save it before the fight. */
  state: DailyState;
}

/** Spends a try at the next stage and sets up its battle, or null with no tries left. */
export function beginDailyTry(state: DailyState, ctx: DailyContext): BegunDailyTry | null {
  if (state.tries <= 0) return null;
  const stage = state.cleared + 1;
  const attempt = state.attempts + 1;
  const setup: BattleSetup = {
    heroes: buildTeam(ctx.heroes, ctx.formation),
    enemies: [dailyBossUnit(state.day, stage)],
    limitTicks: DAILY_TIME_LIMIT_TICKS,
    seed: ctx.battleSeed,
    key: dailyBattleKey(state.day, stage, attempt),
    critMode: ctx.critMode,
    signatures: ctx.signatures,
  };
  return { stage, attempt, setup, state: { ...state, tries: state.tries - 1, attempts: attempt } };
}

/** The try's end from its battle: a kill clears the stage and gives the five tries back; otherwise its damage counts. */
export function finishDailyTry(begun: BegunDailyTry, result: BattleResult): DailyTry {
  const { stage, attempt } = begun;
  const won = result.outcome === 'win';
  const next: DailyState = won
    ? { ...begun.state, cleared: stage, tries: DAILY_TRIES, bestDamage: 0 }
    : { ...begun.state, bestDamage: Math.max(begun.state.bestDamage, result.damageDealt) };
  return { stage, attempt, won, result, state: next };
}

/** One try at the next stage, start to end, or null with no tries left. */
export function challengeDaily(state: DailyState, ctx: DailyContext): DailyTry | null {
  const begun = beginDailyTry(state, ctx);
  return begun === null ? null : finishDailyTry(begun, runBattle(begun.setup));
}

/** Tries while they win, then one loss (the day's run: 이긴 단계는 빠르게 넘긴다, 8.2 추천). */
export function climbDaily(state: DailyState, ctx: DailyContext, maxTries: number = DAILY_CLIMB_MAX_TRIES): { state: DailyState; tries: DailyTry[] } {
  const tries: DailyTry[] = [];
  let cur = state;
  while (tries.length < maxTries) {
    const t = challengeDaily(cur, ctx);
    if (t === null) break;
    tries.push(t);
    cur = t.state;
    if (!t.won) break;
  }
  return { state: cur, tries };
}

/** 그날의 기록 (8.3): the highest stage killed and the best damage at the stage above it. */
export interface DailyRecord {
  stage: number;
  damage: number;
}

export function dailyRecord(state: DailyState): DailyRecord {
  return { stage: state.cleared, damage: state.bestDamage };
}
