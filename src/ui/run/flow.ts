// Which run screen to show, from the engine's phase and what the player has already seen
// (13.4: 행동 → 결과 → 사건 → 보상 고르기, 13.17). Pure, so a reload lands on the same screen.

import { abandonCardCraft, type CardCraftState, endTurn, playCard } from '../../sim/cards/index.ts';
import type { RunAction, RunState, RunTurnLog } from '../../sim/run/index.ts';
import type { RunMeta } from './store.ts';

export type RunScreen = 'prep' | 'forge' | 'forgeDone' | 'result' | 'choice' | 'over' | 'turn';

/** Actions that take the turn (13.4.1, 13.7): the turn's earlier 결과 count as seen. */
export const TURN_ACTIONS: readonly RunAction['type'][] = ['expedition', 'wall', 'climb', 'forge', 'maintain', 'rest', 'bond', 'retire'];

/** The first 원정 결과 the player has not been shown yet. Without notes, every result counts as seen. */
export function unseenExpedition(run: RunState, meta: RunMeta | null): RunTurnLog | null {
  const seen = meta?.seenLogs ?? run.turnLog.length;
  return run.turnLog.slice(seen).find((l) => l.expedition !== null) ?? null;
}

/**
 * The screen for a run: the anvil while a 단조 is on (or its last moment is held), the 완성 화면,
 * then 원정 결과 before the 사건 it led to, the 사건, 판 끝, else the 턴 화면.
 */
export function screenOf(run: RunState | null, meta: RunMeta | null, holding: boolean): RunScreen {
  if (run === null) return 'prep';
  if (holding || run.phase === 'forge') return 'forge';
  if (run.phase === 'forgeDone') return 'forgeDone';
  if (unseenExpedition(run, meta) !== null) return 'result';
  if (run.phase === 'choice') return 'choice';
  if (run.phase === 'over') return 'over';
  return 'turn';
}

/**
 * The craft a 단조 action ends on, for the screen to hold a broken iron a moment (the run drops a
 * failed craft). The same card-engine call the run made, so the same result.
 */
export function finalCraft(craft: CardCraftState, a: RunAction): CardCraftState | null {
  try {
    if (a.type === 'forgePlay') return playCard(craft, a.uid, a.opts ?? {});
    if (a.type === 'forgeEndTurn') return endTurn(craft, a.keep ?? []);
    if (a.type === 'forgeAbandon') return abandonCardCraft(craft);
  } catch {
    // fall through
  }
  return null;
}
