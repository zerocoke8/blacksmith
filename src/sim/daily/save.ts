// The daily boss part of the save (기획서 8.2). Plain JSON, checked field by field on the way back.

import { DAILY_TRIES } from '../data/monsters.ts';
import type { DailyState } from './daily.ts';

export const DAILY_SAVE_VERSION = 1;

export function serializeDaily(state: DailyState): string {
  return JSON.stringify({ version: DAILY_SAVE_VERSION, ...state });
}

/**
 * Turns an older save into the current version's shape (each step: version n → n + 1). The first
 * prototype wrote no version: that is version 1's shape.
 */
export function migrateDailySave(data: unknown): unknown {
  if (typeof data === 'object' && data !== null && !Array.isArray(data) && !('version' in data)) return { ...data, version: 1 };
  return data;
}

function whole(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

export function restoreDaily(raw: unknown): DailyState | null {
  const data = migrateDailySave(raw);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.version !== DAILY_SAVE_VERSION) return null;
  const day = whole(d.day);
  const cleared = whole(d.cleared);
  const tries = whole(d.tries);
  const bestDamage = whole(d.bestDamage);
  const attempts = whole(d.attempts);
  if (day === null || day < 1 || cleared === null || tries === null || bestDamage === null || attempts === null) return null;
  return { day, cleared, tries: Math.min(DAILY_TRIES, tries), bestDamage, attempts };
}
