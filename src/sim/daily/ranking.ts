// 랭킹 무리와 순위 (기획서 8.3). The server groups players and ranks them every day; these pure
// functions are what it runs (and what the server stand-in runs today).

import { RANK_GROUP_SIZE, RANK_MATCH } from '../data/monsters.ts';

export interface RankEntry {
  id: string;
  /** 그날 잡은 가장 높은 단계. */
  stage: number;
  /** 막힌 단계에 한 번에 준 가장 큰 데미지. */
  damage: number;
}

export interface Ranked extends RankEntry {
  /** 1-based. Equal stage and damage share a rank (8.3 추천: 데미지까지 같으면 같은 순위). */
  rank: number;
}

/** 순위 (8.3): higher stage first, then higher damage; ties share the rank (1, 1, 3). Order among ties: id. */
export function rankGroup(entries: readonly RankEntry[]): Ranked[] {
  const sorted = [...entries].sort((a, b) => b.stage - a.stage || b.damage - a.damage || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: Ranked[] = [];
  sorted.forEach((e, i) => {
    const prev = out[i - 1];
    const rank = prev !== undefined && prev.stage === e.stage && prev.damage === e.damage ? prev.rank : i + 1;
    out.push({ ...e, rank });
  });
  return out;
}

export interface MatchPlayer {
  id: string;
  /** 최고 스테이지 when the groups are made. */
  best: number;
  /** The shared level then. */
  level: number;
}

/** The floor a player is grouped by: max(최고 스테이지, 레벨 − slack) (꼼수 방지, 6.7 · 8.3 [미정]). */
export function matchFloor(p: Pick<MatchPlayer, 'best' | 'level'>): number {
  return Math.max(p.best, p.level - RANK_MATCH.levelSlack);
}

/**
 * Groups of about `size` with similar floors (8.3 흉내): sorted by matchFloor, then level, then id,
 * cut into runs of `size`; a short last run joins the one before it when it is under half.
 */
export function groupPlayers(players: readonly MatchPlayer[], size: number = RANK_GROUP_SIZE): string[][] {
  const n = Math.max(1, Math.floor(size));
  const sorted = [...players].sort(
    (a, b) => matchFloor(b) - matchFloor(a) || b.level - a.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const groups: string[][] = [];
  for (let i = 0; i < sorted.length; i += n) groups.push(sorted.slice(i, i + n).map((p) => p.id));
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last !== undefined && last.length < n / 2) {
    groups.pop();
    (groups[groups.length - 1] as string[]).push(...last);
  }
  return groups;
}
