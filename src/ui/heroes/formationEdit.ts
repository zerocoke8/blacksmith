// 편성 고치기 (기획서 6.3, 사용자 결정 11): what a tap or a drag on the formation screen does. Five
// heroes, a front row and a back row of four places each. A hero tapped in the list joins (in the row
// that suits the role, 6.3: 근접은 앞열, 원거리·힐러는 뒷열, or the other when that is full) or leaves;
// a placed hero dragged (or tapped, then a place tapped) onto another moves there, swapping with
// whoever stood there. Pure; the rules that decide whether it can fight are sim/stage formation.ts.

import { FORMATION_ROW_MAX, FORMATION_SIZE } from '../../sim/data/battle.ts';
import { type FormationRow, type HeroKey, heroSpec, ROLE_ROW } from '../../sim/data/heroes.ts';
import { type Formation, formationProblems, rowBonusFor } from '../../sim/stage/index.ts';
import type { HeroRoster } from '../../sim/hero/index.ts';

export interface Place {
  row: FormationRow;
  index: number;
}

export function placeOf(f: Formation, key: HeroKey): Place | null {
  const i = f.front.indexOf(key);
  if (i >= 0) return { row: 'front', index: i };
  const j = f.back.indexOf(key);
  if (j >= 0) return { row: 'back', index: j };
  return null;
}

export function memberCount(f: Formation): number {
  return f.front.length + f.back.length;
}

export type ToggleResult = { formation: Formation; note: null } | { formation: Formation; note: 'full' };

/** A hero tapped in the list: leaves if placed, else joins the role's row (or the other one). */
export function toggleMember(f: Formation, key: HeroKey): ToggleResult {
  if (placeOf(f, key) !== null) return { formation: { front: f.front.filter((k) => k !== key), back: f.back.filter((k) => k !== key) }, note: null };
  if (memberCount(f) >= FORMATION_SIZE) return { formation: f, note: 'full' };
  const want = ROLE_ROW[heroSpec(key).role];
  const other: FormationRow = want === 'front' ? 'back' : 'front';
  const row = f[want].length < FORMATION_ROW_MAX ? want : other;
  return { formation: { ...f, [row]: [...f[row], key] }, note: null };
}

/**
 * Moves a placed hero to a place (row, index). Onto another hero: the two swap. Onto an empty place
 * of a row: the hero joins that row's end (a row has no gaps: its order is the acting order). A full
 * row with no one to swap refuses (the formation comes back unchanged).
 */
export function moveMember(f: Formation, key: HeroKey, to: Place): Formation {
  const from = placeOf(f, key);
  if (from === null) return f;
  const target = f[to.row][to.index];
  if (target !== undefined) {
    if (target === key) return f;
    const next: Formation = { front: [...f.front], back: [...f.back] };
    next[from.row][from.index] = target;
    next[to.row][to.index] = key;
    return next;
  }
  if (from.row === to.row) {
    // An empty place in its own row: to the row's end.
    const row = f[from.row].filter((k) => k !== key);
    return { ...f, [from.row]: [...row, key] };
  }
  if (f[to.row].length >= FORMATION_ROW_MAX) return f;
  const next: Formation = { front: f.front.filter((k) => k !== key), back: f.back.filter((k) => k !== key) };
  next[to.row] = [...next[to.row], key];
  return next;
}

export interface FormationCheck {
  canFight: boolean;
  /** Problems in a line each (sim's text). */
  problems: string[];
  /** Heroes standing where their role gets no row bonus (6.3). */
  offRow: HeroKey[];
}

export function checkFormation(f: Formation, roster: HeroRoster, problemText: (p: ReturnType<typeof formationProblems>[number]) => string): FormationCheck {
  const ps = formationProblems(f, roster);
  const offRow: HeroKey[] = [];
  for (const key of f.front) if (rowBonusFor(heroSpec(key).role, 'front') === 1) offRow.push(key);
  for (const key of f.back) if (rowBonusFor(heroSpec(key).role, 'back') === 1) offRow.push(key);
  return { canFight: ps.length === 0, problems: ps.map(problemText), offRow };
}

/** Two formations hold the same heroes in the same places. */
export function sameFormation(a: Formation, b: Formation): boolean {
  return a.front.join() === b.front.join() && a.back.join() === b.back.join();
}

/**
 * 추천 편성 (6.3, 16장의 28번 추천): the five strongest by power (6.4 전투력), with the strongest healer
 * kept in when one is owned (power does not count healing), each in the row their role suits (6.3).
 * A row past four sends its weakest to the other row. Ties keep the roster's order. Pure.
 */
export function recommendedFormation(owned: readonly HeroKey[], powerOf: (key: HeroKey) => number): Formation {
  const order = new Map(owned.map((k, i) => [k, i]));
  const byPower = [...owned].sort((a, b) => powerOf(b) - powerOf(a) || (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const pick = byPower.slice(0, FORMATION_SIZE);
  const healer = byPower.find((k) => heroSpec(k).role === 'healer');
  if (healer !== undefined && !pick.includes(healer) && pick.length === FORMATION_SIZE) pick[pick.length - 1] = healer;
  // pick is strongest first (a swapped-in healer last): each row keeps that order.
  const front = pick.filter((k) => ROLE_ROW[heroSpec(k).role] === 'front');
  const back = pick.filter((k) => ROLE_ROW[heroSpec(k).role] === 'back');
  while (front.length > FORMATION_ROW_MAX) back.push(front.pop() as HeroKey);
  while (back.length > FORMATION_ROW_MAX) {
    // The weakest who is not a healer goes forward (a healer stays behind).
    let i = back.length - 1;
    while (i > 0 && heroSpec(back[i] as HeroKey).role === 'healer') i -= 1;
    front.push(back.splice(i, 1)[0] as HeroKey);
  }
  return { front, back };
}
