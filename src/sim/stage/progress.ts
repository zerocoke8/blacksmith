// 다음 층 도전과 자동 도전 (기획서 6.7): the floor above the best one is fought for real; clearing it
// within 30 s raises the best floor, losing keeps the player where they are and costs nothing.
// The auto-challenge goes on while it wins; after a loss it waits until the team changes (level,
// stars, formation, rows, weapons), since the same team would meet the same wall. Pure.

import { STAGE_TIME_LIMIT_TICKS, AUTO_CLIMB_MAX_BATTLES, type CritMode } from '../data/battle.ts';
import type { HeroesState } from '../hero/save.ts';
import { type BattleResult, runBattle } from './battle.ts';
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

/** Fights the next floor once (the [도전] button, or one step of the auto-challenge). */
export function challengeNextFloor(p: StageProgress, ctx: StageContext): StageChallenge {
  const floor = nextFloor(p);
  const attempt = p.attempts + 1;
  const team = buildTeam(ctx.heroes, ctx.formation);
  const result = runBattle({
    heroes: team,
    enemies: floorEnemies(floor),
    limitTicks: STAGE_TIME_LIMIT_TICKS,
    seed: ctx.battleSeed,
    key: stageBattleKey(floor, attempt),
    critMode: ctx.critMode,
  });
  const won = result.outcome === 'win';
  const progress: StageProgress = won
    ? { ...p, best: floor, attempts: attempt, stuck: null, bestLevel: ctx.heroes.level.level }
    : { ...p, attempts: attempt, stuck: { floor, team: teamFingerprint(team) } };
  return { floor, attempt, won, result, progress };
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
