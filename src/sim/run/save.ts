// 판 세이브 (기획서 13.16): 판 상태 (진행 중인 단조의 카드 제작 상태까지) is plain JSON. Reading
// a save replays its setup and action list with the same src/sim code, so a hand-edited state
// cannot come back and the server can check a finished run the same way. Storage itself is
// src/platform/storage.ts's job (CLAUDE.md 규칙 4); the key is hall.ts RUN_SAVE_KEY.

import { RUN_SAVE_VERSION } from '../data/run.ts';
import { replayRun, runAct, startRun } from './run.ts';
import type { RunAction, RunSetupInput, RunState } from './types.ts';

export function serializeRun(state: RunState): string {
  return JSON.stringify(state);
}

function savedParts(data: unknown): { setup: RunSetupInput; actions: RunAction[] } | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.version !== RUN_SAVE_VERSION || typeof d.setup !== 'object' || d.setup === null || !Array.isArray(d.actions)) return null;
  return { setup: d.setup as RunSetupInput, actions: d.actions as RunAction[] };
}

/**
 * The run a saved state stands for: its setup and actions replayed, or null if they do not
 * replay (another version, a broken or edited save). Strict: this is the 서버 검증 reading.
 */
export function restoreRun(data: unknown): RunState | null {
  const parts = savedParts(data);
  if (parts === null) return null;
  try {
    return replayRun(parts.setup, parts.actions);
  } catch {
    return null;
  }
}

export function parseRun(text: string | null): RunState | null {
  if (text === null) return null;
  try {
    return restoreRun(JSON.parse(text));
  } catch {
    return null;
  }
}

/** True if the saved state is exactly what its actions make (서버 검증의 기기 쪽 확인). */
export function verifyRun(state: RunState): boolean {
  const again = restoreRun(JSON.parse(serializeRun(state)));
  return again !== null && serializeRun(again) === serializeRun(state);
}

/**
 * How a device's own save came back after the game was updated:
 * - 'same': the saved state, byte for byte.
 * - 'changed': every action replays, but the run's numbers moved ([튜닝] values or card data changed
 *   since it was saved, so the floors, crafts and gold came out differently).
 * - 'partial': an action no longer fits the new rules; the run goes on from the last one that did.
 */
export type RunRecoveryStatus = 'same' | 'changed' | 'partial';

export interface RunRecovery {
  state: RunState;
  status: RunRecoveryStatus;
  /** Saved actions that replayed, of `total`. */
  replayed: number;
  total: number;
}

/**
 * Reads the device's run save the forgiving way (a prototype is redeployed while runs are going):
 * replays as many saved actions as the current rules allow, and says whether the result is still the
 * saved run. Null only when the save is broken or its setup cannot start. The ranked run's check
 * stays strict (restoreRun, verifyRun).
 */
export function recoverRun(text: string | null): RunRecovery | null {
  if (text === null) return null;
  let parts: { setup: RunSetupInput; actions: RunAction[] } | null;
  try {
    parts = savedParts(JSON.parse(text));
  } catch {
    return null;
  }
  if (parts === null) return null;
  let s: RunState;
  try {
    s = startRun(parts.setup);
  } catch {
    return null;
  }
  let replayed = 0;
  for (const a of parts.actions) {
    try {
      s = runAct(s, a);
    } catch {
      break;
    }
    replayed += 1;
  }
  const total = parts.actions.length;
  const status: RunRecoveryStatus = replayed < total ? 'partial' : serializeRun(s) === text ? 'same' : 'changed';
  return { state: s, status, replayed, total };
}
