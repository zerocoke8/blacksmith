// 공유 레벨 (기획서 5.3): one level every hero shares, like an account level. Experience comes from
// refining (7.3) and goes straight into the bar; a full bar raises the level by itself. Pure.

import { expToNext, LEVEL_MAX } from '../data/heroes.ts';

export interface LevelState {
  level: number;
  /** Experience toward the next level (0 ≤ exp < expToNext(level), except at LEVEL_MAX). */
  exp: number;
}

export function newLevelState(): LevelState {
  return { level: 1, exp: 0 };
}

export interface ExpAdded {
  state: LevelState;
  /** Levels gained (the screen's banner, 5.3: 레벨이 오르면 위쪽 배너). */
  levelsUp: number;
  /** Experience that went in. */
  gained: number;
}

/** Puts n experience into the bar and raises the level as often as it fills (5.3). */
export function addExp(state: LevelState, n: number): ExpAdded {
  const add = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  let level = Math.max(1, Math.floor(state.level));
  let exp = Math.max(0, Math.floor(state.exp)) + add;
  let up = 0;
  while (level < LEVEL_MAX) {
    const need = expToNext(level);
    if (exp < need) break;
    exp -= need;
    level += 1;
    up += 1;
  }
  return { state: { level, exp }, levelsUp: up, gained: add };
}

/** The bar (0..1) for the top band. */
export function levelProgress(state: LevelState): { level: number; exp: number; need: number; ratio: number } {
  const need = expToNext(state.level);
  return { level: state.level, exp: state.exp, need, ratio: state.level >= LEVEL_MAX ? 1 : Math.min(1, state.exp / need) };
}
