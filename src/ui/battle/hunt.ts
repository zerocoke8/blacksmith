// 방치 사냥의 장면 (기획서 6.8, 사용자 결정 3 '자동 사냥에는 성공·실패가 없다'): the best floor's group
// falls, again and again. The scene borrows its choreography from the sim's battle (who hits whom,
// when) but it is only a show: nothing is saved, nothing is rewarded, and it never shows a loss.
// The team that beat the floor beats it again the same way (crits are not rolled, 15장의 1번 추천),
// so that fight is shown as it is. When the team is weaker now (a weapon put down, a new formation),
// the show swaps in heroes that cannot fall and a longer clock; whatever still stands at the end
// leaves in a puff (BattleScene.scatter). Pure.

import { STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { type BattleResult, type EnemyUnit, type HeroUnit, runBattle } from '../../sim/stage/index.ts';

/** The hunt's show [튜닝: 연출]. */
export const HUNT = {
  /** The stand-in heroes' HP × this: monsters' blows show, but nobody falls and nobody needs a heal. */
  sturdyHpMult: 1000,
  /** The stand-in fight's clock: this many stage limits. */
  longLimits: 4,
} as const;

export interface HuntShow {
  /** The heroes as the field shows them (the stand-ins when the real team could not win). */
  team: HeroUnit[];
  result: BattleResult;
  /** Monsters still standing when it ends: the scene sends them off (no group is left over). */
  scatter: boolean;
}

/** The hunt's n-th fight on a floor's group. */
export function huntFight(team: readonly HeroUnit[], enemies: readonly EnemyUnit[], n: number): HuntShow {
  const key = ['hunt', n] as const;
  const real = runBattle({ heroes: [...team], enemies: [...enemies], limitTicks: STAGE_TIME_LIMIT_TICKS, seed: n, key });
  if (real.outcome === 'win') return { team: [...team], result: real, scatter: false };
  const sturdy = team.map((h) => ({ ...h, maxHp: h.maxHp * HUNT.sturdyHpMult }));
  const result = runBattle({ heroes: sturdy, enemies: [...enemies], limitTicks: STAGE_TIME_LIMIT_TICKS * HUNT.longLimits, seed: n, key });
  return { team: sturdy, result, scatter: result.outcome !== 'win' };
}
