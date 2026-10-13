// The stage part of the save (기획서 6.3, 6.7): progress and the two formations (stage, daily boss).
// Plain JSON; what comes back from storage is checked field by field.

import { isHeroKey, type HeroKey } from '../data/heroes.ts';
import type { Formation } from './formation.ts';
import type { StageProgress } from './progress.ts';

export const STAGE_SAVE_VERSION = 1;

export interface StageState {
  progress: StageProgress;
  /** 스테이지 편성과 일일 보스 편성은 따로 저장한다 (6.3). */
  formations: { stage: Formation; daily: Formation };
}

export function serializeStage(state: StageState): string {
  return JSON.stringify({ version: STAGE_SAVE_VERSION, ...state });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function whole(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

/** A row of hero keys (unknown keys dropped). Order and rules are checked when it fights. */
function keys(v: unknown): HeroKey[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((k): k is HeroKey => isHeroKey(k));
}

export function restoreFormation(v: unknown): Formation | null {
  if (!isObj(v)) return null;
  const front = keys(v.front);
  const back = keys(v.back);
  return front === null || back === null ? null : { front, back };
}

export function restoreStageProgress(v: unknown): StageProgress | null {
  if (!isObj(v)) return null;
  const best = whole(v.best);
  const attempts = whole(v.attempts);
  const bestLevel = whole(v.bestLevel);
  if (best === null || attempts === null || bestLevel === null || typeof v.auto !== 'boolean') return null;
  let stuck: StageProgress['stuck'] = null;
  if (isObj(v.stuck)) {
    const floor = whole(v.stuck.floor);
    if (floor !== null && typeof v.stuck.team === 'string') stuck = { floor, team: v.stuck.team };
  }
  return { best, auto: v.auto, attempts, stuck, bestLevel: Math.max(1, bestLevel) };
}

/**
 * Turns an older save into the current version's shape (each step: version n → n + 1). Only version
 * 1 so far; when STAGE_SAVE_VERSION goes up, its step goes here.
 */
export function migrateStageSave(data: unknown): unknown {
  return data;
}

export function restoreStage(raw: unknown): StageState | null {
  const data = migrateStageSave(raw);
  if (!isObj(data) || data.version !== STAGE_SAVE_VERSION || !isObj(data.formations)) return null;
  const progress = restoreStageProgress(data.progress);
  const stage = restoreFormation(data.formations.stage);
  const daily = restoreFormation(data.formations.daily);
  if (progress === null || stage === null || daily === null) return null;
  return { progress, formations: { stage, daily } };
}
