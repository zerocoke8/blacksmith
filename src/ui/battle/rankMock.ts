// 무리 순위 흉내 (기획서 8.3): until the server ranks a group of about 100 every day, the screen shows
// the player among made-up neighbours of a similar floor. The ranking itself is the sim's rankGroup
// (what the server will run). The neighbours are drawn from the sim's rng keyed by the day, so the
// same day shows the same group. Display only: nothing here is saved or rewarded.

import { rngFor } from '../../sim/core/rng.ts';
import { RANK_GROUP_SIZE } from '../../sim/data/monsters.ts';
import { matchFloor, type Ranked, rankGroup } from '../../sim/daily/index.ts';

export const ME_ID = 'me';

const FIRST = ['졸린', '배고픈', '용감한', '느긋한', '수줍은', '부지런한', '덜렁대는', '따뜻한', '작은', '바쁜', '말 많은', '조용한'];
const SECOND = ['대장장이', '고슴도치', '견습생', '모험가', '빵굽는이', '양치기', '두더지', '수습 기사', '약초꾼', '나그네', '우편배달부', '등대지기'];

export interface RankRow extends Ranked {
  name: string;
  me: boolean;
}

/**
 * The made-up group: RANK_GROUP_SIZE − 1 neighbours whose stages spread round what a player of this
 * floor and level reaches (the player's own record decides nothing here), plus the player.
 */
export function mockGroup(day: number, me: { stage: number; damage: number; best: number; level: number }, typicalStage: number): RankRow[] {
  const rng = rngFor(0xd41b05, 'rankMock', day, matchFloor(me));
  const entries = [{ id: ME_ID, stage: me.stage, damage: me.damage }];
  const names = new Map<string, string>([[ME_ID, '나']]);
  for (let i = 0; i < RANK_GROUP_SIZE - 1; i++) {
    const id = `p${i}`;
    const spread = rng.int(-3, 3) + rng.int(-1, 1);
    const stage = Math.max(0, typicalStage + spread);
    // Damage at the stage they stopped: about the size of that stage's boss, some way in.
    const damage = Math.round((1 + stage) * 9000 * (0.15 + rng.next() * 0.8));
    entries.push({ id, stage, damage });
    names.set(id, `${rng.pick(FIRST)} ${rng.pick(SECOND)}`);
  }
  return rankGroup(entries).map((r) => ({ ...r, name: names.get(r.id) ?? r.id, me: r.id === ME_ID }));
}

/** The rows to show: the top few, then the player with a neighbour on each side. */
export function rankWindow(rows: readonly RankRow[], top = 5, around = 2): (RankRow | 'gap')[] {
  const meAt = rows.findIndex((r) => r.me);
  const out: (RankRow | 'gap')[] = [];
  const keep = new Set<number>();
  for (let i = 0; i < Math.min(top, rows.length); i++) keep.add(i);
  if (meAt >= 0) for (let i = Math.max(0, meAt - around); i <= Math.min(rows.length - 1, meAt + around); i++) keep.add(i);
  let last = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (last >= 0 && i > last + 1) out.push('gap');
    out.push(rows[i] as RankRow);
    last = i;
  }
  return out;
}
