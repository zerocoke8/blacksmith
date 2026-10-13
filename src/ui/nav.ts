// Which screen the address shows, and how to go home (기획서 3.2: the home is the town map).
// The screen lives in the address (#cards, #refine, #craft): a reload comes back to the same screen
// (a craft resumes on its turn, its save is the card craft's own), and the phone's back gesture
// goes from a screen back to the map. The map itself is the address with no hash. Pure: App.tsx
// hands in location.hash and history.state.

/**
 * The screens the map opens: 카드 제작 (4.2), 광석 정제 (7장), 용사 (5.9), 스테이지 (6장), 도전 = 일일 보스
 * (8장), and the v0.6 prototype kept for comparison.
 */
export const SCREENS = ['cards', 'refine', 'heroes', 'stage', 'challenge', 'craft'] as const;
export type HomeExit = (typeof SCREENS)[number];
export type Screen = 'home' | HomeExit;

/** The history entry the map pushes when it opens a screen (so going home is a step back). */
export const FROM_HOME = 'blacksmith:fromHome';

/** The screen an address's hash names; anything else is the map. */
export function screenFromHash(hash: string): Screen {
  const h = hash.replace(/^#/, '');
  return (SCREENS as readonly string[]).includes(h) ? (h as HomeExit) : 'home';
}

/** The history state the map pushes with a screen. */
export function openState(): Record<string, true> {
  return { [FROM_HOME]: true };
}

/**
 * Going home from a screen: 'back' when the map opened it (a step back in history, so the phone's
 * back gesture and the screen's own button agree), 'replace' when the app was opened on that screen
 * (a reload, a link): the map takes its place instead of leaving the app.
 */
export function homeStep(state: unknown): 'back' | 'replace' {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[FROM_HOME] === true ? 'back' : 'replace';
}
