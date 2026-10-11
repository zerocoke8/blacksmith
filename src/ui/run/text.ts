// Words for the 육성 한 판 screens (기획서 1.1: 따뜻하지만 쓸쓸하게, 대사는 한두 줄). Lines that belong to
// the rules (은퇴, 중상, 사건) come from the engine (sim/run/text.ts); this file only labels what the
// screens show around them.

import { FAMILIES, type FamilyId } from '../../sim/data/families.ts';
import { DEATH_MODE_LABEL, LATE_GOLD_FROM_FLOOR, POLICY_LABEL, RUN_HAND_SIZE, type Star, WALL_PRESET_LABEL } from '../../sim/data/run.ts';
import { MAX_FLOORS_PER_EXPEDITION, RETURN_AT_DURABILITY } from '../../sim/data/world.ts';
import {
  type ExpeditionEnd,
  type FloorResult,
  nativeCount,
  type RunActionKind,
  type RunChoiceKind,
  type RunEndKind,
  type RunRules,
  type RunTurnLog,
} from '../../sim/run/index.ts';

export const ACTION_LABEL: Record<RunActionKind, string> = {
  expedition: '원정',
  wall: '벽 도전',
  climb: '마지막 등반',
  forge: '단조',
  maintain: '정비',
  rest: '휴식',
  bond: '교류',
  retire: '은퇴',
};

/** Why an expedition turned back (7.10 귀환 기준, 7.12 무뎌짐). */
export const RETURN_LABEL: Record<ExpeditionEnd, string> = {
  hp: 'HP가 기준 아래라 돌아섰다',
  durability: `무기 내구도가 ${Math.round(RETURN_AT_DURABILITY * 100)}% 아래라 돌아섰다`,
  risk: '다음 층이 위험해 돌아섰다',
  maxFloors: '한 원정에 오를 만큼 올랐다',
  dull: '무기가 무뎌져 돌아섰다',
  failed: '층을 넘지 못했다',
  hpZero: 'HP가 바닥났다',
};

/** The same reasons, said ahead of time (원정 미리 보기). */
export const FORECAST_END_LABEL: Record<ExpeditionEnd, string> = {
  hp: 'HP 기준에서 돌아선다',
  durability: `내구도 ${Math.round(RETURN_AT_DURABILITY * 100)}%에서 돌아선다`,
  risk: '위험한 층 앞에서 돌아선다',
  maxFloors: `${MAX_FLOORS_PER_EXPEDITION}층을 다 오른다`,
  dull: '무기가 무뎌진다',
  failed: '대개 거기서 막힌다',
  hpZero: 'HP가 바닥난다',
};

export const FLOOR_RESULT_LABEL: Record<FloorResult, string> = {
  safe: '무사히 물러남',
  injury: '부상',
  severe: '중상',
  death: '돌아오지 않음',
};

export const END_KIND_LABEL: Record<RunEndKind, string> = {
  wall: '벽에서 은퇴',
  climb: '마지막 등반',
  retired: '스스로 은퇴',
  dead: '돌아오지 않음',
  turns: '턴이 다함',
};

export const CHOICE_KIND_LABEL: Record<RunChoiceKind, string> = {
  bossReward: '보스 보상',
  merchant: '행상',
  chat: '동료 사연',
  story: '사연',
  artisan: '떠돌이 장인',
  sign: '탑의 기척',
  season: '시즌 사건',
  evolve: '카드 강화',
  remove: '카드 빼기',
};

/** 0.537 → '54%'. */
export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function goldText(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}G`;
}

/** 성급: '2성' (13.5: 품질 ★와 섞지 않는다). The picture is the 가문 문장의 깃. */
export function starText(star: Star): string {
  return `${star}성`;
}

export function starFlags(star: Star): string {
  return '⚑'.repeat(star);
}

/** '3대 아렌' (6.7.1: 가문 이름이 곧 용사 이름, 세대는 대수로 부른다). */
export function heroName(family: FamilyId, generation: number): string {
  return `${generation}대 ${FAMILIES[family].name}`;
}

/** 체형·속성 배율 → ◎ ○ △ (7.5, 7.6). */
export function fitMark(mult: number): string {
  if (mult > 1.001) return '◎';
  if (mult < 0.999) return '△';
  return '○';
}

/** One line of the 실험 settings a run was played under. */
export function rulesLine(rules: RunRules): string {
  const parts = [`${rules.turns}턴`, `벽 ${WALL_PRESET_LABEL[rules.wallPreset]}`, `판 안 ${DEATH_MODE_LABEL[rules.deathMode]}`];
  if (rules.eventRate !== 1) parts.push(`사건 ×${rules.eventRate}`);
  if (rules.quickForge) parts.push('단조 간이');
  if (rules.handSize !== RUN_HAND_SIZE) parts.push(`손패 ${rules.handSize}`);
  if (rules.lateGoldRate !== 1) parts.push(`${LATE_GOLD_FROM_FLOOR}층부터 수입 ×${rules.lateGoldRate}`);
  return parts.join(' · ');
}

/** '원정 (보통)', '벽 도전', '단조' — what a turn was. */
export function turnActionLabel(log: RunTurnLog): string {
  const base = ACTION_LABEL[log.action];
  if (log.action === 'expedition' && log.expedition !== null) return `${base} (${POLICY_LABEL[log.expedition.policy]})`;
  return base;
}

/** '11~21층' or '11층에서 막힘' for a turn's expedition. */
export function floorsLabel(log: RunTurnLog): string | null {
  const e = log.expedition;
  if (e === null) return null;
  const cleared = e.floors.filter((f) => f.cleared);
  const last = cleared[cleared.length - 1];
  if (last === undefined) return `${e.startFloor}층에서 막힘`;
  return e.startFloor === last.floor ? `${last.floor}층` : `${e.startFloor}~${last.floor}층`;
}

/** Seconds, one decimal. */
export function sec(ms: number): number {
  return Math.round(ms / 100) / 10;
}

/** The dwarf, when a family the hall already knows comes back (6.7.2). */
export const SAME_FACE_LINE = '"그 얼굴, 또 보는군."';

/** 탑 입구 (13.2: 꼭대기의 악마는 마왕이 아니다). */
export function entryLines(turns: number): string[] {
  return [`${nativeCount(turns)} 턴. 그동안 무기를 몇 번이고 다시 지어 준다.`, '꼭대기의 악마는 마왕이 아니다. 이번 계절의 탑 주인일 뿐이다.'];
}

export const FIRST_RUN_LINE = '첫 판은 선대 없이 오른다. 손에 든 것은 기본 무기 한 자루다.';
/** The hall has names but none is picked. */
export const NO_ANCESTOR_LINE = '선대 없이 오르면, 손에 든 것은 기본 무기 한 자루다.';
/** A saved run came back after an update (sim/run recoverRun). */
export const RUN_CHANGED_LINE = '그사이 규칙이 바뀌었다. 지난 판을 같은 행동으로 다시 셈했다. 숫자가 조금 다를 수 있다.';
export const RUN_PARTIAL_LINE = '그사이 규칙이 바뀌었다. 지난 판의 행동을 끝까지 잇지 못해, 이을 수 있는 데까지 왔다.';
export const HALL_EMPTY_LINE = '벽이 아직 비어 있다. 첫 이름은 이번 판이 건다.';
export const NEXT_RUN_LINE = '다음 녀석이 문을 열 때까지, 화로는 꺼지지 않는다.';
