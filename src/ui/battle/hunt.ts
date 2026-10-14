// 방치 사냥의 장면 (기획서 6.8, 사용자 결정 3 '자동 사냥에는 성공·실패가 없다'): the best floor's group
// falls, again and again. The scene borrows its choreography from the sim's battle (who hits whom,
// when), played live like any fight (live.ts: the cards can be tapped), but it is only a show:
// nothing is saved, nothing is rewarded, and it never shows a loss. Before it plays, the fight is
// run once as it would go untouched (the signatures as the AUTO button has them, no taps): when the
// team wins it, that fight is shown. When the team is weaker now (a weapon put down, a new
// formation, an unlucky roll of crits), the show swaps in heroes that cannot fall and a longer
// clock; whatever still stands at the end leaves in a puff (BattleScene.scatter). Pure.

import { STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { type BattleSetup, type EnemyUnit, type HeroUnit, runBattle, type SignatureMode } from '../../sim/stage/index.ts';

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
  /** The fight to play (live). */
  setup: BattleSetup;
  /** The stand-ins: monsters still standing at its end are sent off (no group is left over). */
  sturdy: boolean;
}

/** The hunt's n-th fight on a floor's group. */
export function huntFight(team: readonly HeroUnit[], enemies: readonly EnemyUnit[], n: number, signatures: SignatureMode = 'auto'): HuntShow {
  const key = ['hunt', n] as const;
  const real: BattleSetup = { heroes: [...team], enemies: [...enemies], limitTicks: STAGE_TIME_LIMIT_TICKS, seed: n, key, signatures };
  if (runBattle(real).outcome === 'win') return { team: [...team], setup: real, sturdy: false };
  const sturdy = team.map((h) => ({ ...h, maxHp: h.maxHp * HUNT.sturdyHpMult }));
  return {
    team: sturdy,
    setup: { heroes: sturdy, enemies: [...enemies], limitTicks: STAGE_TIME_LIMIT_TICKS * HUNT.longLimits, seed: n, key, signatures },
    sturdy: true,
  };
}
