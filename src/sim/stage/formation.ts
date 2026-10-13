// 편성 (기획서 6.3): five heroes in a front row and a back row, at most four in a row. The stage and
// the daily boss keep their own formation (6.3); weapons stay with the hero (4.11). Pure.

import { FORMATION_ROW_MAX, FORMATION_SIZE, ROW_BONUS } from '../data/battle.ts';
import { type FormationRow, type HeroKey, type HeroRole, heroSpec, isHeroKey, ROLE_ROW } from '../data/heroes.ts';
import { type HeroRoster, ownsHero } from '../hero/roster.ts';

export interface Formation {
  front: HeroKey[];
  back: HeroKey[];
}

export function emptyFormation(): Formation {
  return { front: [], back: [] };
}

/** A hero's place: the row and the slot (0.. front first, then back: the order they act in). */
export interface FormationSlot {
  key: HeroKey;
  row: FormationRow;
  slot: number;
}

export function formationSlots(f: Formation): FormationSlot[] {
  const out: FormationSlot[] = [];
  for (const key of f.front) out.push({ key, row: 'front', slot: out.length });
  for (const key of f.back) out.push({ key, row: 'back', slot: out.length });
  return out;
}

export type FormationProblem =
  | { code: 'empty' }
  | { code: 'tooMany'; count: number }
  | { code: 'rowFull'; row: FormationRow; count: number }
  | { code: 'duplicate'; key: HeroKey }
  | { code: 'unknown'; key: string }
  | { code: 'notOwned'; key: HeroKey };

/**
 * What is wrong with a formation ([] = it can fight). Fewer than five may fight (a new player may
 * not have five yet, 5.8); `full` says whether all five places are filled.
 */
export function formationProblems(f: Formation, roster: HeroRoster): FormationProblem[] {
  const out: FormationProblem[] = [];
  const all = [...f.front, ...f.back];
  if (all.length === 0) out.push({ code: 'empty' });
  if (all.length > FORMATION_SIZE) out.push({ code: 'tooMany', count: all.length });
  if (f.front.length > FORMATION_ROW_MAX) out.push({ code: 'rowFull', row: 'front', count: f.front.length });
  if (f.back.length > FORMATION_ROW_MAX) out.push({ code: 'rowFull', row: 'back', count: f.back.length });
  const seen = new Set<string>();
  for (const key of all) {
    if (!isHeroKey(key)) {
      out.push({ code: 'unknown', key });
      continue;
    }
    if (seen.has(key)) out.push({ code: 'duplicate', key });
    seen.add(key);
    if (!ownsHero(roster, key)) out.push({ code: 'notOwned', key });
  }
  return out;
}

export function formationFull(f: Formation): boolean {
  return f.front.length + f.back.length === FORMATION_SIZE;
}

/** The problem in a line (Korean, 1.1 tone). */
export function formationProblemText(p: FormationProblem): string {
  switch (p.code) {
    case 'empty':
      return '아무도 서 있지 않다.';
    case 'tooMany':
      return `${FORMATION_SIZE}명까지만 선다.`;
    case 'rowFull':
      return `한 줄에 ${FORMATION_ROW_MAX}명까지다.`;
    case 'duplicate':
      return `${heroSpec(p.key).name}은(는) 한 자리에만 선다.`;
    case 'unknown':
      return '모르는 얼굴이다.';
    case 'notOwned':
      return `${heroSpec(p.key).name}은(는) 아직 오지 않았다.`;
  }
}

/** 열 보너스 (6.3): melee in front, ranged and healers at the back. */
export function rowBonusFor(role: HeroRole, row: FormationRow): number {
  return ROLE_ROW[role] === row ? ROW_BONUS : 1;
}

/** Moves a hero to a row (end of it), taking them out of wherever they stood. */
export function placeHero(f: Formation, key: HeroKey, row: FormationRow): Formation {
  const front = f.front.filter((k) => k !== key);
  const back = f.back.filter((k) => k !== key);
  if (row === 'front') front.push(key);
  else back.push(key);
  return { front, back };
}

export function removeHero(f: Formation, key: HeroKey): Formation {
  return { front: f.front.filter((k) => k !== key), back: f.back.filter((k) => k !== key) };
}
