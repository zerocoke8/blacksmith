// 평가와 전설 용사 카드 (기획서 13.12), 인자 고르기 (13.10 '어디서 붙나', 판 시드 'factor').

import { evolutionOf } from '../cards/index.ts';
import { rngFor } from '../core/rng.ts';
import type { BodyType } from '../core/types.ts';
import { CARD_IDS, type CardId, CARDS } from '../data/cards.ts';
import { WEAPON_LABEL } from '../data/common.ts';
import { FAMILIES } from '../data/families.ts';
import {
  DEMON_FLOOR,
  RUN_GRADE_SPEC,
  RUN_GRADES,
  type RunGrade,
  SCORE,
  SEASONS,
  WEAPON_NAME_FLOOR_FROM,
} from '../data/run.ts';
import { BAND_FLOORS } from '../data/world.ts';
import { seasonFloor } from './season.ts';
import { obj } from './text.ts';
import type { Factor, LegendCard, RunEnd, RunResult, RunScore, RunState } from './types.ts';

export const FACTOR_STREAM = 'factor';

/** 평가 점수 (13.12): 층 × 100 + 벽 여유 × 30 + 최고 품질 ★ × 100 + 유대 합 × 20. */
export function scoreOf(input: { record: number; spareTurns: number; bestQuality: number; bondSum: number }): RunScore {
  const floors = input.record * SCORE.perFloor;
  const spare = input.spareTurns * SCORE.perSpareTurn;
  const weapon = input.bestQuality * SCORE.perStar;
  const bond = input.bondSum * SCORE.perBond;
  return { floors, spare, weapon, bond, total: floors + spare + weapon + bond };
}

/** 벽 여유: 벽마다 (마감 턴 − 넘은 턴). */
export function spareTurns(s: Pick<RunState, 'walls'>): number {
  let n = 0;
  for (const w of s.walls) if (w.passedTurn !== null) n += Math.max(0, w.deadline - w.passedTurn);
  return n;
}

export function runScore(s: RunState): RunScore {
  return scoreOf({
    record: s.record,
    spareTurns: spareTurns(s),
    bestQuality: s.stats.bestQuality,
    bondSum: s.companions.reduce((n, c) => n + c.bond, 0),
  });
}

/** 평가 등급 (13.12): the highest grade whose conditions hold. */
export function gradeFor(score: number, demon: boolean): RunGrade {
  let grade: RunGrade = 'novice';
  for (const g of RUN_GRADES) {
    const spec = RUN_GRADE_SPEC[g];
    if (score >= spec.minScore && (!spec.needsDemon || demon)) grade = g;
  }
  return grade;
}

// ---------- 인자 (13.10, 13.12) ----------

/** 사냥꾼: 판에서 가장 많이 넘은 보스의 체형 (ties: the higher boss). */
function hunterBody(s: RunState): BodyType | null {
  const counts = new Map<BodyType, { n: number; top: number }>();
  for (const floor of s.stats.bossesCleared) {
    const body = seasonFloor(s.setup.season, floor).body;
    const c = counts.get(body) ?? { n: 0, top: 0 };
    counts.set(body, { n: c.n + 1, top: Math.max(c.top, floor) });
  }
  let best: BodyType | null = null;
  let bestKey = [-1, -1];
  for (const [body, c] of counts) {
    if (c.n > (bestKey[0] as number) || (c.n === bestKey[0] && c.top > (bestKey[1] as number))) {
      best = body;
      bestKey = [c.n, c.top];
    }
  }
  return best;
}

/** 카드: 판에서 가장 많이 낸 기술 카드의 계열, and its most played (or 힘) evolution. */
function cardFactor(s: RunState): { card: CardId; evolved: CardId | null } | null {
  const byFamily = new Map<CardId, number>();
  const byCard = new Map<CardId, number>();
  for (const [id, n] of Object.entries(s.stats.cardUses) as [CardId, number][]) {
    const g = CARDS[id].group;
    if (g !== 'basic' && g !== 'unlock' && g !== 'evolved') continue;
    const root = CARDS[id].family;
    byFamily.set(root, (byFamily.get(root) ?? 0) + n);
    byCard.set(id, (byCard.get(id) ?? 0) + n);
  }
  let card: CardId | null = null;
  for (const id of CARD_IDS) {
    const n = byFamily.get(id) ?? 0;
    if (n > 0 && (card === null || n > (byFamily.get(card) ?? 0))) card = id;
  }
  if (card === null) return null;
  let evolved: CardId | null = null;
  for (const id of CARD_IDS) {
    if (CARDS[id].group !== 'evolved' || CARDS[id].family !== card) continue;
    const n = byCard.get(id) ?? 0;
    if (n > 0 && (evolved === null || n > (byCard.get(evolved) ?? 0))) evolved = id;
  }
  return { card, evolved: evolved ?? evolutionOf(card, 'power') };
}

function factor(kind: Factor['kind'], level: number, more: Partial<Factor> = {}): Factor {
  return { kind, level, body: null, card: null, evolved: null, ...more };
}

/** Candidates by '어디서 붙나' (13.10). */
export function factorCandidates(s: RunState, level: number): Factor[] {
  const out: Factor[] = [factor('strength', level), factor('mastery', level), factor('charisma', level)];
  if (s.stats.injuries === 0) out.push(factor('toughness', level));
  if (s.lastBossFloor >= DEMON_FLOOR) out.push(factor('towerAdapt', level));
  const body = hunterBody(s);
  if (body !== null) out.push(factor('hunter', level, { body }));
  const card = cardFactor(s);
  if (card !== null) out.push(factor('card', level, card));
  return out;
}

/** 인자 개수와 단계는 평가 등급이, 무엇이 붙을지는 판에서 한 일과 판 시드가 정한다 (13.12). */
export function rollFactors(s: RunState, grade: RunGrade): Factor[] {
  const spec = RUN_GRADE_SPEC[grade];
  const pool = factorCandidates(s, spec.factorLevel);
  const rng = rngFor(s.setup.seed, FACTOR_STREAM);
  const out: Factor[] = [];
  while (out.length < spec.factors && pool.length > 0) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0] as Factor);
  return out;
}

// ---------- 무기 이름 (13.12, 12.1) ----------

/**
 * 판 끝에 든 무기는 반드시 이름이 붙는다. 이어받은 이름은 그대로 둔다 (12.1 처음 붙은 이름).
 * 60층부터 '{탑} n층을 연 {무기}', 악마를 넘었으면 '{악마}를 벤 {무기}', 아니면 '{이름}의 {무기}'.
 */
export function runWeaponName(s: RunState): string {
  if (s.weapon.name !== null) return s.weapon.name;
  const season = SEASONS[s.setup.season];
  const label = WEAPON_LABEL[s.weapon.weapon.type];
  if (s.record >= WEAPON_NAME_FLOOR_FROM) {
    return `${season.name} ${Math.floor(s.record / BAND_FLOORS) * BAND_FLOORS}층을 연 ${label}`;
  }
  if (s.lastBossFloor >= DEMON_FLOOR) return `${obj(season.demon)} 벤 ${label}`;
  return `${FAMILIES[s.setup.hero.family].name}의 ${label}`;
}

// ---------- 전설 용사 카드 ----------

export function legendCardId(s: RunState): string {
  return `L${s.setup.season}-${s.setup.seed}-${s.setup.hero.family}-${s.turn}`;
}

/** The run's result: 평가, 등급, 인자, 무기 이름, 전설 용사 카드 (13.12). */
export function runResultOf(s: RunState, end: RunEnd): RunResult {
  const score = runScore(s);
  const demon = s.lastBossFloor >= DEMON_FLOOR;
  const grade = gradeFor(score.total, demon);
  const factors = rollFactors(s, grade);
  const weaponName = runWeaponName(s);
  const legend: LegendCard = {
    id: legendCardId(s),
    family: s.setup.hero.family,
    star: s.setup.hero.star,
    grade,
    season: s.setup.season,
    record: s.record,
    score: score.total,
    wallsPassed: s.walls.filter((w) => w.passedTurn !== null).length,
    end: end.kind,
    endFloor: end.floor,
    factors,
    weapon: { ...s.weapon.weapon, enchants: [...s.weapon.weapon.enchants] },
    weaponName,
    deck: [...s.deck],
    runSeed: s.setup.seed,
    generation: s.setup.generation,
    weaponInherited: s.weapon.origin === 'ancestor' && s.weapon.name !== null,
  };
  return { score, grade, factors, weaponName, legend };
}

/** '노래로 남은 아렌' (13.12: 등급 이름이 카드의 칭호가 된다). */
export function legendTitle(card: Pick<LegendCard, 'grade' | 'family'>): string {
  return `${RUN_GRADE_SPEC[card.grade].label} ${FAMILIES[card.family].name}`;
}
