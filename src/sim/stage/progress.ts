// 다음 층 도전과 자동 도전 (기획서 6.7): the floor above the best one is fought for real; clearing it
// within 30 s raises the best floor, losing keeps the player where they are and costs nothing.
// The auto-challenge goes on while it wins; after a loss it waits until the team changes (level,
// stars, formation, rows, weapons), since the same team would meet the same wall. Pure.
// A challenge the screen plays live comes in two halves: beginNextFloor (the attempt is taken and
// saved before the fight, so closing the app mid-fight cannot buy a fresh seed) and finishNextFloor.

import { STAGE_TIME_LIMIT_TICKS, AUTO_CLIMB_MAX_BATTLES, type CritMode } from '../data/battle.ts';
import type { HeroesState } from '../hero/save.ts';
import { type BattleResult, type BattleSetup, type HeroUnit, runBattle, type SignatureMode } from './battle.ts';
import { type Formation, formationProblems } from './formation.ts';
import { floorEnemies } from './layout.ts';
import { buildTeam, teamFingerprint } from './team.ts';

export interface StageProgress {
  /** 최고 스테이지: the highest floor cleared (0 = none yet). The idle hunt is on this floor (6.8). */
  best: number;
  /** 자동 도전 (6.7): on by default [튜닝]. */
  auto: boolean;
  /** 도전 번호: every challenge (won or lost) takes the next; the battle's crit stream key. */
  attempts: number;
  /** The last lost challenge: the floor and the team that lost it. The auto-challenge waits for a change. */
  stuck: { floor: number; team: string } | null;
  /** The shared level when `best` was last raised (꼼수 방지 기록, 6.7 · 8.3 무리 매칭). */
  bestLevel: number;
}

export function newStageProgress(): StageProgress {
  return { best: 0, auto: true, attempts: 0, stuck: null, bestLevel: 1 };
}

/** The floor the next challenge is on. */
export function nextFloor(p: StageProgress): number {
  return p.best + 1;
}

export function setAutoChallenge(p: StageProgress, on: boolean): StageProgress {
  return { ...p, auto: on };
}

export interface StageContext {
  /** The battle seed (서버가 준다, 3.5). */
  battleSeed: number;
  heroes: HeroesState;
  formation: Formation;
  critMode?: CritMode;
  /** The signature mode the fight starts in (the screen's AUTO button; default 'auto'). */
  signatures?: SignatureMode;
}

export interface StageChallenge {
  floor: number;
  attempt: number;
  won: boolean;
  result: BattleResult;
  progress: StageProgress;
}

/** The battle stream of a stage challenge: (seed, 'battle', 'stage', 층, 도전 번호) (3.5). */
export function stageBattleKey(floor: number, attempt: number): ['battle', 'stage', number, number] {
  return ['battle', 'stage', floor, attempt];
}

/** A next-floor challenge that has begun: its battle to run (or step live) and the progress to save now. */
export interface BegunFloor {
  floor: number;
  attempt: number;
  team: HeroUnit[];
  setup: BattleSetup;
  /** The progress with this attempt taken (attempts + 1): save it before the fight. */
  progress: StageProgress;
}

/** Takes the next attempt at the next floor and sets up its battle. Throws on a formation that cannot fight. */
export function beginNextFloor(p: StageProgress, ctx: StageContext): BegunFloor {
  const floor = nextFloor(p);
  const attempt = p.attempts + 1;
  const team = buildTeam(ctx.heroes, ctx.formation);
  const setup: BattleSetup = {
    heroes: team,
    enemies: floorEnemies(floor),
    limitTicks: STAGE_TIME_LIMIT_TICKS,
    seed: ctx.battleSeed,
    key: stageBattleKey(floor, attempt),
    critMode: ctx.critMode,
    signatures: ctx.signatures,
  };
  return { floor, attempt, team, setup, progress: { ...p, attempts: attempt } };
}

/**
 * The challenge's end from its battle: a win raises the best floor (and records the level it was
 * done at), a loss marks the floor stuck for the team that lost it.
 */
export function finishNextFloor(begun: BegunFloor, result: BattleResult, levelNow: number): StageChallenge {
  const { floor, attempt } = begun;
  const won = result.outcome === 'win';
  const progress: StageProgress = won
    ? { ...begun.progress, best: floor, stuck: null, bestLevel: levelNow }
    : { ...begun.progress, stuck: { floor, team: teamFingerprint(begun.team) } };
  return { floor, attempt, won, result, progress };
}

/** Fights the next floor once, start to end (one step of the auto-challenge; tools and tests). */
export function challengeNextFloor(p: StageProgress, ctx: StageContext): StageChallenge {
  const begun = beginNextFloor(p, ctx);
  return finishNextFloor(begun, runBattle(begun.setup), ctx.heroes.level.level);
}

/**
 * Whether the auto-challenge fights now (6.7): it is on, the formation can fight, and either the last
 * challenge was not lost on this floor or the team has changed since.
 */
export function canAutoChallenge(p: StageProgress, ctx: Pick<StageContext, 'heroes' | 'formation'>): boolean {
  if (!p.auto) return false;
  if (formationProblems(ctx.formation, ctx.heroes.roster).length > 0) return false;
  if (p.stuck === null || p.stuck.floor !== nextFloor(p)) return true;
  return teamFingerprint(buildTeam(ctx.heroes, ctx.formation)) !== p.stuck.team;
}

/**
 * Runs the auto-challenge: floor after floor while it wins, stopping at the first loss (or after
 * maxBattles). Returns every challenge in order; the screen plays the last loss, skims the wins.
 */
export function autoClimb(
  p: StageProgress,
  ctx: StageContext,
  maxBattles: number = AUTO_CLIMB_MAX_BATTLES,
): { progress: StageProgress; challenges: StageChallenge[] } {
  const challenges: StageChallenge[] = [];
  let cur = p;
  while (challenges.length < maxBattles && canAutoChallenge(cur, ctx)) {
    const c = challengeNextFloor(cur, ctx);
    challenges.push(c);
    cur = c.progress;
    if (!c.won) break;
  }
  return { progress: cur, challenges };
}
