// 보유 용사 (기획서 5.1, 5.5, 5.6): which heroes the player has and how many copies of each.
// The star step and the evolution colour follow from the copy count alone, so the save keeps only
// the count and the two can never disagree. Copies come from the server's draws (12.2, CLAUDE.md
// 규칙 5); this file only counts them. Pure, plain JSON.

import {
  EVOLUTION_AT_STAR,
  EVOLUTION_LADDER,
  type EvolutionColor,
  type HeroKey,
  type HeroRarity,
  heroSpec,
  STAR_MARKS,
  STAR_MAX_INDEX,
  STAR_PIPS_PER_MARK,
  STAR_STEP_COPIES,
  type StarMark,
} from '../data/heroes.ts';

/** Hero key → copies owned, the first one included (≥ 1). Heroes not owned are absent. */
export type HeroRoster = Partial<Record<HeroKey, number>>;

export interface StarStep {
  /** 0 = 동별 1 … 24 = 해 5. */
  index: number;
  mark: StarMark;
  /** 1~5 symbols of the mark. */
  pips: number;
  color: EvolutionColor;
  /** The ladder's end (일반 달 5, 특급 해 5): further copies count but raise nothing. */
  atMax: boolean;
  /** Copies toward the next step ('4/5', '4/13' under the card, 5.9); have = need at the end. */
  have: number;
  need: number;
}

/** The star step `copies` copies make for a hero of this rarity (5.5 표). */
export function starStepOf(rarity: HeroRarity, copies: number): StarStep {
  const per = STAR_STEP_COPIES[rarity];
  const n = Math.max(1, Math.floor(copies));
  const max = STAR_MAX_INDEX[rarity];
  const raw = Math.floor((n - 1) / per);
  const index = Math.min(max, raw);
  const atMax = raw >= max;
  return {
    index,
    mark: STAR_MARKS[Math.floor(index / STAR_PIPS_PER_MARK)] as StarMark,
    pips: (index % STAR_PIPS_PER_MARK) + 1,
    color: colorAt(rarity, index),
    atMax,
    have: atMax ? per : (n - 1) % per,
    need: per,
  };
}

/** The evolution colour at a star index: the highest of the rarity's ladder it has reached (5.6). */
export function colorAt(rarity: HeroRarity, starIndex: number): EvolutionColor {
  let color: EvolutionColor = 'purple';
  for (const c of EVOLUTION_LADDER[rarity]) if (starIndex >= EVOLUTION_AT_STAR[c]) color = c;
  return color;
}

/** Copies the n-th star index takes, the first copy included (5.5 표: 특급 달 1 = 76, 일반 달 5 = 248). */
export function copiesForStar(rarity: HeroRarity, starIndex: number): number {
  return 1 + Math.max(0, Math.floor(starIndex)) * STAR_STEP_COPIES[rarity];
}

export function ownsHero(roster: HeroRoster, key: HeroKey): boolean {
  return (roster[key] ?? 0) >= 1;
}

/** What a draw of copies changed, for the dwarf's line and the card (5.5 '오를 때 드워프가 한 줄'). */
export interface CopiesAdded {
  roster: HeroRoster;
  key: HeroKey;
  /** The hero was not owned before. */
  isNew: boolean;
  before: StarStep | null;
  after: StarStep;
  /** Star steps gained. */
  stepsUp: number;
  /** Evolution colours reached, in order (e.g. ['gold']). */
  evolved: EvolutionColor[];
}

/** Adds n copies of a hero (a draw's result, 12.2). n ≤ 0 changes nothing. */
export function addCopies(roster: HeroRoster, key: HeroKey, n: number): CopiesAdded {
  const spec = heroSpec(key);
  const had = roster[key] ?? 0;
  const add = Math.max(0, Math.floor(n));
  const before = had >= 1 ? starStepOf(spec.rarity, had) : null;
  const total = had + add;
  const next: HeroRoster = add > 0 ? { ...roster, [key]: total } : roster;
  const after = starStepOf(spec.rarity, Math.max(1, total));
  const evolved: EvolutionColor[] = [];
  if (before !== null) {
    for (const c of EVOLUTION_LADDER[spec.rarity]) {
      const at = EVOLUTION_AT_STAR[c];
      if (before.index < at && after.index >= at) evolved.push(c);
    }
  }
  return {
    roster: next,
    key,
    isNew: had < 1 && total >= 1,
    before,
    after,
    stepsUp: before === null ? 0 : after.index - before.index,
    evolved,
  };
}

/** The hero's star step, or null when not owned. */
export function heroStar(roster: HeroRoster, key: HeroKey): StarStep | null {
  const n = roster[key] ?? 0;
  return n >= 1 ? starStepOf(heroSpec(key).rarity, n) : null;
}

/** Specials always; normals from the gold evolution (5.4). */
export function passiveOpen(rarity: HeroRarity, color: EvolutionColor): boolean {
  return rarity === 'special' || color !== 'purple';
}

/** 필살기 (5.4, 5.6): specials from gold; 'strong' from red. null = none yet. */
export function signatureLevel(rarity: HeroRarity, color: EvolutionColor): 'open' | 'strong' | null {
  if (rarity !== 'special') return null;
  if (color === 'red' || color === 'white') return 'strong';
  if (color === 'gold') return 'open';
  return null;
}
