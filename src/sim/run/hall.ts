// 명예의 전당 (기획서 13.13): 전설 용사 카드 50장. Pure: the screen saves it through
// src/platform/storage.ts (CLAUDE.md 규칙 4) with serializeHall / parseHall.

import { restoreCardWeapon } from '../cards/index.ts';
import { BODY_TYPES } from '../core/types.ts';
import { CARD_IDS } from '../data/cards.ts';
import { isFamilyId } from '../data/families.ts';
import {
  FACTOR_KINDS,
  FACTOR_LEVEL_MAX,
  HALL_SIZE,
  HALL_VERSION,
  isSeasonId,
  RUN_GRADES,
  STARS,
} from '../data/run.ts';
import type { Factor, LegendCard, RunEndKind } from './types.ts';

/** Storage keys the screen uses with src/platform/storage.ts. */
export const RUN_SAVE_KEY = 'run.current';
export const HALL_SAVE_KEY = 'run.hall';

export interface HallOfFame {
  version: number;
  cards: LegendCard[];
  /** 잠근 카드: 내보낼 수 없다. */
  locked: string[];
}

export function emptyHall(): HallOfFame {
  return { version: HALL_VERSION, cards: [], locked: [] };
}

export function hallIsFull(hall: HallOfFame): boolean {
  return hall.cards.length >= HALL_SIZE;
}

/** A card id not used in the hall yet (the same seed can be played twice in the prototype). */
function freeId(hall: HallOfFame, id: string): string {
  if (!hall.cards.some((c) => c.id === id)) return id;
  for (let n = 2; ; n++) {
    const next = `${id}-${n}`;
    if (!hall.cards.some((c) => c.id === next)) return next;
  }
}

/** Why the card cannot go in now (short Korean), or null. A full hall needs a card to let go. */
export function hallAddBlock(hall: HallOfFame, evictId: string | null = null): string | null {
  if (!hallIsFull(hall)) return null;
  if (evictId === null) return `명예의 전당은 ${HALL_SIZE}장까지다. 내보낼 카드를 고른다`;
  if (!hall.cards.some((c) => c.id === evictId)) return '없는 카드';
  if (hall.locked.includes(evictId)) return '잠근 카드는 내보낼 수 없다';
  return null;
}

/** Puts a 전설 용사 카드 in (13.13); when full, `evictId` leaves (그 카드는 이름과 기록만 남는다). */
export function hallAdd(hall: HallOfFame, card: LegendCard, evictId: string | null = null): HallOfFame {
  const reason = hallAddBlock(hall, evictId);
  if (reason !== null) throw new Error(`hall: ${reason}`);
  const kept = hallIsFull(hall) ? hall.cards.filter((c) => c.id !== evictId) : [...hall.cards];
  const base = { ...hall, cards: kept, locked: hall.locked.filter((id) => kept.some((c) => c.id === id)) };
  return { ...base, cards: [...kept, { ...card, id: freeId(base, card.id) }] };
}

export function hallSetLock(hall: HallOfFame, id: string, locked: boolean): HallOfFame {
  if (!hall.cards.some((c) => c.id === id)) return hall;
  const rest = hall.locked.filter((x) => x !== id);
  return { ...hall, locked: locked ? [...rest, id] : rest };
}

/** 내보내기: locked cards stay. */
export function hallRemove(hall: HallOfFame, id: string): HallOfFame {
  if (hall.locked.includes(id)) return hall;
  return { ...hall, cards: hall.cards.filter((c) => c.id !== id) };
}

export type HallSort = 'family' | 'season' | 'grade' | 'record' | 'factors';

/** 정렬: 가문, 시즌, 평가, 최고 도달층, 인자 (13.13). Ties keep the hall's order. */
export function hallSorted(hall: HallOfFame, by: HallSort): LegendCard[] {
  const key = (c: LegendCard): (number | string)[] => {
    switch (by) {
      case 'family':
        return [c.family, -c.record];
      case 'season':
        return [c.season, -c.score];
      case 'grade':
        return [-RUN_GRADES.indexOf(c.grade), -c.score];
      case 'record':
        return [-c.record, -c.score];
      case 'factors':
        return [-c.factors.reduce((n, f) => n + f.level, 0), -c.factors.length];
    }
  };
  return hall.cards
    .map((c, i) => ({ c, i, k: key(c) }))
    .sort((a, b) => {
      for (let j = 0; j < a.k.length; j++) {
        const x = a.k[j] as number | string;
        const y = b.k[j] as number | string;
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return a.i - b.i;
    })
    .map((e) => e.c);
}

// ---------- Checks for saved data ----------

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const oneOf = (list: readonly unknown[], v: unknown): boolean => list.includes(v);
const END_KINDS: readonly RunEndKind[] = ['wall', 'climb', 'retired', 'dead', 'turns'];

export function isFactor(v: unknown): v is Factor {
  if (!isObj(v) || !oneOf(FACTOR_KINDS, v.kind) || !isCount(v.level)) return false;
  if (v.level < 1 || v.level > FACTOR_LEVEL_MAX) return false;
  if (!(v.body === null || oneOf(BODY_TYPES, v.body))) return false;
  if (!(v.card === null || oneOf(CARD_IDS, v.card)) || !(v.evolved === null || oneOf(CARD_IDS, v.evolved))) return false;
  if (v.kind === 'hunter' && v.body === null) return false;
  if (v.kind === 'card' && v.card === null) return false;
  return true;
}

/** A 전설 용사 카드 with every field of this version, else false. */
export function isLegendCard(v: unknown): v is LegendCard {
  if (!isObj(v) || typeof v.id !== 'string' || !isFamilyId(v.family) || !oneOf(STARS, v.star)) return false;
  if (!oneOf(RUN_GRADES, v.grade) || !isSeasonId(v.season)) return false;
  if (!isCount(v.record) || !isCount(v.score) || !isCount(v.wallsPassed) || !isCount(v.endFloor)) return false;
  if (!oneOf(END_KINDS, v.end) || typeof v.weaponName !== 'string' || !Number.isSafeInteger(v.runSeed)) return false;
  if (!Array.isArray(v.factors) || !v.factors.every(isFactor)) return false;
  if (!Array.isArray(v.deck) || !v.deck.every((id) => oneOf(CARD_IDS, id))) return false;
  if (v.generation !== undefined && !(isCount(v.generation) && v.generation >= 1)) return false;
  if (v.weaponInherited !== undefined && typeof v.weaponInherited !== 'boolean') return false;
  return restoreCardWeapon(v.weapon) !== null;
}

/**
 * 대수 the next hero of this family gets ('3대 아렌', 6.7.1): one past the highest on the wall. Cards
 * kept before the 대수 was stored count by their order on the wall, so the old count still holds.
 */
export function nextGeneration(hall: HallOfFame, family: LegendCard['family']): number {
  let top = 0;
  let n = 0;
  for (const c of hall.cards) {
    if (c.family !== family) continue;
    n += 1;
    top = Math.max(top, c.generation ?? n);
  }
  return top + 1;
}

export function serializeHall(hall: HallOfFame): string {
  return JSON.stringify(hall);
}

/** The saved hall, keeping the cards that read back whole; an empty hall if nothing does. */
export function parseHall(text: string | null): HallOfFame {
  if (text === null) return emptyHall();
  try {
    const data: unknown = JSON.parse(text);
    if (!isObj(data) || data.version !== HALL_VERSION || !Array.isArray(data.cards)) return emptyHall();
    const cards = data.cards.filter(isLegendCard).slice(0, HALL_SIZE);
    const locked = Array.isArray(data.locked)
      ? data.locked.filter((id): id is string => typeof id === 'string' && cards.some((c) => c.id === id))
      : [];
    return { version: HALL_VERSION, cards, locked };
  } catch {
    return emptyHall();
  }
}
