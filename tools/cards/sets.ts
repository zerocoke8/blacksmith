// 카드 제작 측정 세트와 통계 (기획서 4.2.1 초벌 측정, 4.9, 16.2의 11번, 16.3의 1~5·10번).
// measure.ts runs them from the command line; measure.test.ts pins a small run so an engine
// change that moves the numbers shows up.

import {
  type CardCollection,
  type CardCraftSetup,
  type CardRules,
  type CardTools,
  checkDeck,
  dayOneDeck,
  learnedUnlockCards,
} from '../../src/sim/cards/index.ts';
import type { UniqueId } from '../../src/sim/core/types.ts';
import { QUALITY } from '../../src/sim/data/common.ts';
import { BOSS_MATERIAL_CARD, CARD_IDS, type CardId, CARDS, FIRE_PRESET_LABEL } from '../../src/sim/data/cards.ts';
import { UNIQUES } from '../../src/sim/data/uniques.ts';
import { type Bot, type CraftRun, runCraft } from './bots.ts';

// ---------- Decks ----------

export const DAY1 = dayOneDeck();
/** 단계 1 해금 카드: 초벌 측정과 같이 신중한 두드리기 2장 + 첫 손질 (4.2.2). */
export const STAGE1: CardId[] = [...DAY1, 'carefulHammer', 'carefulHammer', 'firstTouch'];
/** 1주 (명성 단계 4, 상한 6): 해금 카드 6장. */
export const WEEK1: CardId[] = [...STAGE1, 'firstHammer', 'allIn', 'allIn'];
/** 1달 (명성 단계 6, 상한 8): 해금 카드 8장 (각인 섬세한 손 포함). */
export const MONTH1: CardId[] = [...WEEK1, 'lastStroke', 'deftHand'];

/** The 1일차 덱 with its 정밀 다듬기 swapped for another card (16.3의 1번: 죽은 카드 비교). */
function day1With(swap: CardId): CardId[] {
  const deck = [...DAY1];
  deck[deck.indexOf('precisePolish')] = swap;
  return deck;
}

// ---------- Sets ----------

/** core = default run, all = --all comparisons, legend = --legend (16.2의 11번). */
export type SetGroup = 'core' | 'all' | 'legend';

export interface MeasureSet {
  id: string;
  label: string;
  deck: CardId[];
  fameStage: number;
  materialTier: number;
  boss: UniqueId | null;
  tools: CardTools;
  rules: Partial<CardRules>;
  group: SetGroup;
  /** 진화 카드 the deck may hold (the measurement does not temper them first). */
  evolved?: Partial<Record<CardId, number>>;
  /** Share of --smart games for long crafts (the 따져 보는 봇 is slow there). */
  smartScale?: number;
}

const T0: CardTools = { anvil: 0, whetstone: 0, furnace: 0 };
const ADV_TOOLS: CardTools = { anvil: 20, whetstone: 20, furnace: 2 };
const LEG_TOOLS: CardTools = { anvil: 35, whetstone: 35, furnace: 4 };
/** '모두 보통' stops the fire rolls only; 용의 숨결·순풍 still set the fire (data/cards.ts FIRE_PRESETS). */
const ALL_NORMAL = '굴림 모두 보통';

const day1 = (id: string, label: string, rules: Partial<CardRules>, group: SetGroup, more: Partial<MeasureSet> = {}): MeasureSet => ({
  id,
  label: `1일차 덱 · ${label}`,
  deck: DAY1,
  fameStage: 1,
  materialTier: 1,
  boss: null,
  tools: T0,
  rules,
  group,
  ...more,
});

const legend = (id: string, boss: UniqueId, label: string, rules: Partial<CardRules>, group: SetGroup, smartScale: number): MeasureSet => ({
  id,
  label: `전설 · 8구간 + ${UNIQUES[boss].material} · 도구 35 · 화로 4 · 1달 덱 · ${label}`,
  deck: MONTH1,
  fameStage: 6,
  materialTier: 8,
  boss,
  tools: LEG_TOOLS,
  rules,
  group,
  smartScale,
});

const BOSSES = Object.keys(BOSS_MATERIAL_CARD) as UniqueId[];

export const SETS: MeasureSet[] = [
  day1('day1', `1구간 기본 · ${ALL_NORMAL}`, { firePreset: 'allNormal' }, 'core'),
  day1('day1Rolled', '1구간 기본 · 상태 굴림', {}, 'core'),
  { ...day1('stage1', '', {}, 'core'), label: '단계 1 해금 (신중한 두드리기 2 + 첫 손질) · 상태 굴림', deck: STAGE1 },
  day1('hand6', `손패 6 · 간직 0 · ${ALL_NORMAL}`, { firePreset: 'allNormal', handSize: 6 }, 'core'),
  day1('hand7', `손패 7 · 간직 0 · ${ALL_NORMAL}`, { firePreset: 'allNormal', handSize: 7 }, 'core'),
  // 16.3의 10번 with the real 화로: its 간직 comes with the bigger hand.
  day1('furnace2', `화로 2 (손패 6 · 간직 1) · ${ALL_NORMAL}`, { firePreset: 'allNormal' }, 'core', {
    tools: { ...T0, furnace: 2 },
  }),
  day1('furnace4', `화로 4 (손패 7 · 간직 2) · ${ALL_NORMAL}`, { firePreset: 'allNormal' }, 'core', {
    tools: { ...T0, furnace: 4 },
  }),
  {
    id: 'advanced',
    label: `고급 · 5구간 · 도구 20 · 화로 2 · 1주 덱 · ${ALL_NORMAL}`,
    deck: WEEK1,
    fameStage: 4,
    materialTier: 5,
    boss: null,
    tools: ADV_TOOLS,
    rules: { firePreset: 'allNormal' },
    group: 'core',
  },
  legend('legendary', 'earthBlessing', ALL_NORMAL, { firePreset: 'allNormal' }, 'core', 0.3),
  day1('cooling', `식는 쇠 켬 · ${ALL_NORMAL}`, { firePreset: 'allNormal', coolingIron: true }, 'core'),

  // ----- --all: [검증] 비교 -----
  day1('reheat1', '다시 달구기 −1 · 상태 굴림', { reheatCost: 1 }, 'all'),
  day1('reheat3', '다시 달구기 −3 · 상태 굴림', { reheatCost: 3 }, 'all'),
  // Free turn ends: the 따져 보는 봇 waits many turns for good fire, so fewer games.
  day1('reheat0', '다시 달구기 0 · 상태 굴림', { reheatCost: 0 }, 'all', { smartScale: 0.15 }),
  day1('calm', `화로 ${FIRE_PRESET_LABEL.calm}`, { firePreset: 'calm' }, 'all'),
  day1('volatile', `화로 ${FIRE_PRESET_LABEL.volatile}`, { firePreset: 'volatile' }, 'all'),
  day1('coolingRolled', '식는 쇠 켬 · 상태 굴림', { coolingIron: true }, 'all'),
  // 16.3의 3번: does 식는 쇠 lengthen a craft once the iron is longer too?
  day1('coolingLong10', `식는 쇠 + 내구도 +10 · ${ALL_NORMAL}`, { firePreset: 'allNormal', coolingIron: true, durabilityDelta: 10 }, 'all'),
  day1('coolingLong20', `식는 쇠 + 내구도 +20 · ${ALL_NORMAL}`, { firePreset: 'allNormal', coolingIron: true, durabilityDelta: 20 }, 'all'),
  // 16.3의 1번: turns 1·2 are '다 내기' at 28; a shorter iron makes them choose.
  day1('tight4', `내구도 −4 · ${ALL_NORMAL}`, { firePreset: 'allNormal', durabilityDelta: -4 }, 'all'),
  // 16.3의 1번: 정밀 다듬기 is rarely playable; the same deck without it.
  { ...day1('polish4', '정밀 다듬기 → 다듬기 (다듬기 4) · 상태 굴림', {}, 'all'), deck: day1With('polish') },
  {
    ...day1('keenEye', '정밀 다듬기 → 눈썰미 (진화 B) · 상태 굴림', {}, 'all'),
    deck: day1With('keenEye'),
    evolved: { keenEye: 1 },
  },
  {
    id: 'band2',
    label: `1일차 덱 · 2구간 · 도구 4 · ${ALL_NORMAL}`,
    deck: DAY1,
    fameStage: 2,
    materialTier: 2,
    boss: null,
    tools: { anvil: 4, whetstone: 4, furnace: 0 },
    rules: { firePreset: 'allNormal' },
    group: 'all',
  },
  {
    id: 'band3',
    label: `1일차 덱 · 3구간 · 도구 10 · 화로 1 · ${ALL_NORMAL}`,
    deck: DAY1,
    fameStage: 3,
    materialTier: 3,
    boss: null,
    tools: { anvil: 10, whetstone: 10, furnace: 1 },
    rules: { firePreset: 'allNormal' },
    group: 'all',
  },
  {
    id: 'advancedRolled',
    label: '고급 · 5구간 · 도구 20 · 화로 2 · 1주 덱 · 상태 굴림',
    deck: WEEK1,
    fameStage: 4,
    materialTier: 5,
    boss: null,
    tools: ADV_TOOLS,
    rules: {},
    group: 'all',
  },
  legend('legendaryRolled', 'earthBlessing', '상태 굴림', {}, 'all', 0.3),

  // ----- --legend: 16.2의 11번 (전설 내구도 70은 재지 않은 추정) -----
  ...BOSSES.map((b) => legend(`boss-${b}`, b, ALL_NORMAL, { firePreset: 'allNormal' }, 'legend', 0.1)),
  ...[-10, -15, -20].map((d) =>
    legend(`legendDur${70 + d}`, 'earthBlessing', `내구도 ${70 + d} · ${ALL_NORMAL}`, { firePreset: 'allNormal', durabilityDelta: d }, 'legend', 0.1),
  ),
  legend('legendReheat3', 'earthBlessing', `다시 달구기 −3 · ${ALL_NORMAL}`, { firePreset: 'allNormal', reheatCost: 3 }, 'legend', 0.1),
  legend(
    'legendDur60Reheat3',
    'earthBlessing',
    `내구도 60 · 다시 달구기 −3 · ${ALL_NORMAL}`,
    { firePreset: 'allNormal', durabilityDelta: -10, reheatCost: 3 },
    'legend',
    0.1,
  ),
];

// ---------- Running ----------

export function setupFor(set: MeasureSet, seed: number, craftNo: number): CardCraftSetup {
  return {
    seed,
    craftNo,
    recipe: { weaponType: 'oneHandSword', materialTier: set.materialTier, bossMaterial: set.boss },
    deck: set.deck,
    tools: set.tools,
    rules: set.rules,
  };
}

/** Throws if the set's deck breaks a deck rule (the measurement would not be a real deck). */
export function checkSetDeck(set: MeasureSet): void {
  const collection: CardCollection = { learned: learnedUnlockCards(set.fameStage, true), evolved: set.evolved ?? {} };
  const problems = checkDeck(set.deck, collection, set.fameStage);
  if (problems.length > 0) throw new Error(`${set.id}: ${problems.map((p) => p.message).join(' / ')}`);
}

/** Game i uses craft number i (1-based), the same for every bot. */
export function runSet(set: MeasureSet, bot: Bot, games: number, seed: number, maxTurns: number): CraftRun[] {
  const runs: CraftRun[] = [];
  for (let i = 1; i <= games; i++) runs.push(runCraft(setupFor(set, seed, i), bot, maxTurns));
  return runs;
}

// ---------- Stats ----------

export interface Stats {
  games: number;
  fail: number;
  tiers: [number, number, number, number, number];
  median: number;
  p10: number;
  turns: number;
  cards: number;
  discarded: number;
  /** Among turns ended by 다시 달구기: every allowed card played ('다 내기'). */
  allPlayedShare: number;
  /** Among turns that ended: no card played ('빈 턴'). */
  emptyTurnShare: number;
  timedOut: number;
  /** Per card: plays ÷ (plays + throws at 다시 달구기), and how many times it was in either. */
  cardShare: { card: CardId; share: number; seen: number }[];
}

/** Nearest-rank percentile of a sorted list. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] as number;
}

export function summarize(runs: readonly CraftRun[]): Stats {
  const n = runs.length;
  const tiers: Stats['tiers'] = [0, 0, 0, 0, 0];
  // A failed craft counts as quality 0 in the median and the lower tail.
  const q = runs.map((r) => (r.outcome.success ? r.outcome.qualityRatio : 0)).sort((a, b) => a - b);
  let fail = 0;
  let turns = 0;
  let cards = 0;
  let discarded = 0;
  let allPlayed = 0;
  let reheats = 0;
  let empty = 0;
  let ended = 0;
  let timedOut = 0;
  const played = new Map<CardId, number>();
  const thrown = new Map<CardId, number>();
  for (const r of runs) {
    if (r.outcome.tier === null) fail += 1;
    else tiers[r.outcome.tier - 1] = (tiers[r.outcome.tier - 1] ?? 0) + 1;
    turns += r.turns;
    cards += r.cardsPlayed;
    discarded += r.discarded;
    allPlayed += r.allPlayedTurns;
    reheats += r.reheatTurns;
    empty += r.emptyTurns;
    ended += r.endedTurns;
    if (r.timedOut) timedOut += 1;
    for (const [id, k] of Object.entries(r.played) as [CardId, number][]) played.set(id, (played.get(id) ?? 0) + k);
    for (const [id, k] of Object.entries(r.thrown) as [CardId, number][]) thrown.set(id, (thrown.get(id) ?? 0) + k);
  }
  const cardShare = CARD_IDS.filter((id) => played.has(id) || thrown.has(id)).map((card) => {
    const p = played.get(card) ?? 0;
    const seen = p + (thrown.get(card) ?? 0);
    return { card, share: p / seen, seen };
  });
  return {
    games: n,
    fail: fail / n,
    tiers: tiers.map((t) => t / n) as Stats['tiers'],
    median: percentile(q, 0.5),
    p10: percentile(q, 0.1),
    turns: turns / n,
    cards: cards / n,
    discarded: discarded / n,
    allPlayedShare: reheats === 0 ? 0 : allPlayed / reheats,
    emptyTurnShare: ended === 0 ? 0 : empty / ended,
    timedOut,
    cardShare,
  };
}

// ---------- Report ----------

export const pct = (x: number, digits = 0): string => `${(x * 100).toFixed(digits)}%`;
const pp = (x: number): string => `${(x * 100).toFixed(1)}%p`;
const num = (x: number): string => x.toFixed(1);

export function row(setLabel: string, bot: string, s: Stats): string {
  const luck = s.median - s.p10;
  return [
    setLabel,
    bot,
    s.games,
    pct(s.fail, 1),
    ...s.tiers.map((t) => pct(t)),
    pct(s.median, 1),
    pct(s.p10, 1),
    pp(luck),
    num(s.turns),
    num(s.cards),
    num(s.discarded),
    pct(s.allPlayedShare),
    pct(s.emptyTurnShare),
  ].join(' | ');
}

export const TABLE_HEAD = [
  '| 설정 | 봇 | 판 | 실패 | ★1 | ★2 | ★3 | ★4 | ★5 | 중앙값 | 하위10% | 운의 폭 | 손패 | 낸 카드 | 버린 카드 | 다 내기 턴 | 빈 턴 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
];

/** "두드리기 98% · 정밀 다듬기 12%": how often each card was played rather than thrown away. */
export function cardShareLine(s: Stats): string {
  return s.cardShare.map((c) => `${CARDS[c.card].name} ${pct(c.share)}`).join(' · ');
}

export interface Check {
  goal: string;
  rule: string;
  measured: string;
  /** null = a reference line with no target. */
  ok: boolean | null;
  /** Why the verdict may say more about the bots than the game. */
  caveat?: string;
}

/** The 단순 봇 is a fixed stand-in for '단순한 규칙으로 치는 사람'; verdicts that lean on it say so. */
const SIMPLE_BOT_CAVEAT = '단순 봇에 기댄 판정: 기획서의 단순한 사람(초벌 50%·3.2번·10.5장)보다 세다';

export interface SetResult {
  simple: Stats;
  smart: Stats;
}

export function checksFor(results: Map<string, SetResult>, maxTurns: number): Check[] {
  const out: Check[] = [];
  const day1 = results.get('day1');
  const rolled = results.get('day1Rolled');
  const stage1 = results.get('stage1');
  const adv = results.get('advanced');
  const leg = results.get('legendary');
  if (day1) {
    const { simple, smart } = day1;
    const mid = (simple.median + smart.median) / 2;
    out.push({
      goal: '4.2.1 1일차 덱을 모두 보통으로 무난히 치면 역작 근처',
      rule: '두 봇 중앙값의 가운데 55~70% (사람은 두 줄 사이)',
      measured: `단순 ${pct(simple.median, 1)} · 따짐 ${pct(smart.median, 1)} → ${pct(mid, 1)}`,
      ok: mid >= 0.55 && mid <= 0.7,
      caveat: SIMPLE_BOT_CAVEAT,
    });
    out.push({
      goal: '4.2.1 카드 10~13장이면 끝난다',
      rule: '두 봇 모두 낸 카드 평균 10~13장',
      measured: `단순 ${num(simple.cards)} · 따짐 ${num(smart.cards)}`,
      ok: [simple, smart].every((s) => s.cards >= 10 && s.cards <= 13),
    });
    out.push({
      goal: '4.2.1 손패 3~5번이면 끝난다',
      rule: '두 봇 모두 손패 평균 3~5번',
      measured: `단순 ${num(simple.turns)} · 따짐 ${num(smart.turns)}`,
      ok: [simple, smart].every((s) => s.turns >= 3 && s.turns <= 5),
      caveat: SIMPLE_BOT_CAVEAT,
    });
    out.push({
      goal: '4.2.1 모두 보통으로는 걸작이 거의 나오지 않는다',
      rule: '두 봇 모두 ★5 ≤ 3%',
      measured: `단순 ${pct(simple.tiers[4], 1)} · 따짐 ${pct(smart.tiers[4], 1)}`,
      ok: simple.tiers[4] <= 0.03 && smart.tiers[4] <= 0.03,
    });
    out.push({
      goal: '4.2.1 따져 보는 사람은 역작이 확실하고 명작도 나온다',
      rule: '따짐 ★3 이상 ≥ 90%, ★4 이상 ≥ 10%',
      measured: `★3+ ${pct(smart.tiers[2] + smart.tiers[3] + smart.tiers[4], 1)} · ★4+ ${pct(smart.tiers[3] + smart.tiers[4], 1)}`,
      ok: smart.tiers[2] + smart.tiers[3] + smart.tiers[4] >= 0.9 && smart.tiers[3] + smart.tiers[4] >= 0.1,
    });
    out.push({
      goal: '4.2.1 [검증] 실력이 별 하나만큼 차이를 낸다',
      rule: '중앙값 차 ≥ 20%p (별 하나 ≈ 25%p; 초벌 26%p)',
      measured: pp(smart.median - simple.median),
      ok: smart.median - simple.median >= 0.2,
      caveat: SIMPLE_BOT_CAVEAT,
    });
    out.push({
      goal: '4.9 셔플 운이 실력보다 작다',
      rule: '따짐의 (중앙값 − 하위 10%) < 실력 차',
      measured: `운 ${pp(smart.median - smart.p10)} · 실력 ${pp(smart.median - simple.median)}`,
      ok: smart.median - smart.p10 < smart.median - simple.median,
      caveat: SIMPLE_BOT_CAVEAT,
    });
    out.push({
      goal: '4.2.1 실패는 1% 안팎',
      rule: '두 봇 모두 실패 ≤ 2%',
      measured: `단순 ${pct(simple.fail, 1)} · 따짐 ${pct(smart.fail, 1)}`,
      ok: simple.fail <= 0.02 && smart.fail <= 0.02,
    });
  }
  if (rolled && day1) {
    out.push({
      goal: '4.2.1 걸작은 좋은 상태와 콤보가 맞을 때만',
      rule: '상태 굴림의 따짐 ★5가 모두 보통보다 많고 2~20%',
      measured: `굴림 ${pct(rolled.smart.tiers[4], 1)} · 보통 ${pct(day1.smart.tiers[4], 1)}`,
      ok: rolled.smart.tiers[4] > day1.smart.tiers[4] && rolled.smart.tiers[4] >= 0.02 && rolled.smart.tiers[4] <= 0.2,
    });
  }
  if (stage1) {
    out.push({
      goal: '4.2.2 [검증] 단계 1 해금 카드가 걸작을 너무 쉽게 만들지 않는가',
      rule: '참고: 초벌 따짐 걸작 약 30% (✓ = 35% 이하)',
      measured: `따짐 ★5 ${pct(stage1.smart.tiers[4], 1)} · 단순 ★5 ${pct(stage1.simple.tiers[4], 1)}`,
      ok: stage1.smart.tiers[4] <= 0.35,
    });
  }
  for (const [id, label, base] of [
    ['hand6', '손패 6 (간직 0)', 0.87],
    ['hand7', '손패 7 (간직 0)', 0.92],
  ] as const) {
    const r = results.get(id);
    if (r) {
      out.push({
        goal: `4.2.7 [검증] ${label}의 힘 (초벌 따짐 중앙값 ${pct(base)})`,
        rule: '참고: 초벌 ±5%p 안이면 ✓',
        measured: `따짐 ${pct(r.smart.median, 1)} · ★5 ${pct(r.smart.tiers[4], 1)}`,
        ok: Math.abs(r.smart.median - base) <= 0.05,
      });
    }
  }
  for (const [id, label] of [
    ['furnace2', '화로 2 (손패 6 · 간직 1)'],
    ['furnace4', '화로 4 (손패 7 · 간직 2)'],
  ] as const) {
    const r = results.get(id);
    if (r) {
      out.push({
        goal: `16.3의 10번 [검증] 실제 ${label}이 너무 센가`,
        rule: '참고 (목표 없음): 간직 0으로 잰 손패 6·7과 비교',
        measured: `따짐 ${pct(r.smart.median, 1)} · ★4+ ${pct(r.smart.tiers[3] + r.smart.tiers[4], 1)} · ★5 ${pct(r.smart.tiers[4], 1)}`,
        ok: null,
      });
    }
  }
  const h6 = results.get('hand6');
  const h7 = results.get('hand7');
  if (day1 && h6 && h7) {
    const m = [day1.simple.median, h6.simple.median, h7.simple.median];
    out.push({
      goal: '봇 점검: 단순 봇이 손패 5 → 6 → 7에 따라 오른다',
      rule: '단순 봇 중앙값이 줄지 않는다 (줄면 판정이 봇의 버릇을 잰다)',
      measured: m.map((x) => pct(x, 1)).join(' → '),
      ok: (m[0] as number) <= (m[1] as number) && (m[1] as number) <= (m[2] as number),
    });
  }
  const lengthCheck = (r: SetResult, name: string, cards: [number, number], hands: [number, number]): void => {
    out.push({
      goal: `4.2.3 ${name} 길이: 카드 ${cards[0]}~${cards[1]}장, 손패 ${hands[0]}~${hands[1]}번`,
      rule: '따짐 평균',
      measured: `카드 ${num(r.smart.cards)} · 손패 ${num(r.smart.turns)} · 빈 턴 ${pct(r.smart.emptyTurnShare)}`,
      ok: r.smart.cards >= cards[0] && r.smart.cards <= cards[1] && r.smart.turns >= hands[0] && r.smart.turns <= hands[1],
    });
    out.push({
      goal: `4.3 ${name} 기준점: 무난히 치면 역작, 잘 치면 역작~명작`,
      rule: '단순 중앙값 ≥ 55%, 따짐 ★3+ ≥ 90%, 따짐 ★5 ≤ 20%',
      measured: `단순 ${pct(r.simple.median, 1)} · 따짐 ★3+ ${pct(1 - r.smart.fail - r.smart.tiers[0] - r.smart.tiers[1], 1)} · ★5 ${pct(r.smart.tiers[4], 1)}`,
      ok:
        r.simple.median >= 0.55 &&
        1 - r.smart.fail - r.smart.tiers[0] - r.smart.tiers[1] >= 0.9 &&
        r.smart.tiers[4] <= 0.2,
      caveat: SIMPLE_BOT_CAVEAT,
    });
  };
  if (adv) lengthCheck(adv, '고급', [14, 18], [4, 6]);
  if (leg) lengthCheck(leg, '전설', [20, 25], [6, 8]);
  for (const [id, r] of results) {
    for (const [bot, s] of [
      ['단순', r.simple],
      ['따짐', r.smart],
    ] as const) {
      if (s.turns >= maxTurns * 0.75 || s.timedOut > 0) {
        out.push({
          goal: `봇 점검: ${id} (${bot}) 손패 수가 턴 상한에 묶였는가`,
          rule: `평균 손패가 상한 ${maxTurns}의 75% 미만, 상한에 걸린 판 0`,
          measured: `손패 ${num(s.turns)} · 상한에 걸린 판 ${s.timedOut}`,
          ok: false,
          caveat: '손패 수는 상한값을 따라 움직인다 (--max-turns로 바꿔 본다)',
        });
      }
    }
  }
  return out;
}

export interface Report {
  sets: MeasureSet[];
  results: Map<string, SetResult>;
  simpleGames: number;
  smartGames: number;
  seed: number;
  maxTurns: number;
}

export function reportLines(r: Report, smartName: string, simpleName: string): string[] {
  const lines: string[] = [];
  lines.push(`# 카드 제작 측정 (단순 봇 ${r.simpleGames}판, 따져 보는 봇 ${r.smartGames}판, 세계 시드 ${r.seed}, 턴 상한 ${r.maxTurns})`);
  lines.push('');
  lines.push(...TABLE_HEAD);
  for (const set of r.sets) {
    const res = r.results.get(set.id);
    if (!res) continue;
    lines.push(`| ${row(set.label, simpleName, res.simple)} |`);
    lines.push(`| ${row('〃', smartName, res.smart)} |`);
  }
  lines.push('');
  lines.push(
    '- 품질 단계는 ' +
      ([1, 2, 3, 4, 5] as const).map((t) => `★${t} ${QUALITY[t].name} ${pct(QUALITY[t].threshold)}`).join(' · ') +
      '. 실패한 판은 품질 0으로 중앙값과 하위 10%에 넣는다.',
  );
  lines.push('- 운의 폭 = 중앙값 − 하위 10% (같은 봇). 손패 = 턴 수. 버린 카드 = 다시 달구기 때 내지 않고 버린 장수.');
  lines.push(
    '- 다 내기 턴 = 다시 달구기로 끝난 턴 가운데, 화로·열기·조건이 허락한 카드를 모두 낸 턴 (내구도는 따지지 않는다). ' +
      '빈 턴 = 끝난 턴 가운데 카드를 한 장도 내지 않은 턴. 플레이 기록도 같은 정의로 센다 (엔진의 cardTurnSummary).',
  );
  lines.push(`- ${ALL_NORMAL} = 화로 굴림이 늘 보통이다. 용의 숨결·순풍·대장장이의 감처럼 카드가 바꾸는 상태는 그대로다.`);
  lines.push(
    `- 덱: 1일차 = ${DAY1.map((id) => CARDS[id].name).join(', ')}. 단계 1 = 1일차 + 신중한 두드리기 2, 첫 손질. ` +
      '1주 = 단계 1 + 첫 망치, 혼신 2. 1달 = 1주 + 최후의 한 수, 섬세한 손(각인). 재료 카드 2장(전설은 대보스 카드 2장 더)은 레시피가 섞는다.',
  );
  lines.push('');
  lines.push('## 카드별 낸 비율 (낸 ÷ (낸 + 다시 달구기 때 버린))');
  lines.push('');
  for (const set of r.sets) {
    const res = r.results.get(set.id);
    if (!res) continue;
    lines.push(`- ${set.label}`);
    lines.push(`  - 단순: ${cardShareLine(res.simple)}`);
    lines.push(`  - 따짐: ${cardShareLine(res.smart)}`);
  }
  const checks = checksFor(r.results, r.maxTurns);
  if (checks.length > 0) {
    lines.push('');
    lines.push('## 기획서 목표와 비교');
    lines.push('');
    lines.push('| 목표 | 기준 | 측정 | 판정 | 주의 |');
    lines.push('|---|---|---|---|---|');
    for (const c of checks) {
      lines.push(`| ${c.goal} | ${c.rule} | ${c.measured} | ${c.ok === null ? '—' : c.ok ? '✓' : '✗'} | ${c.caveat ?? ''} |`);
    }
  }
  return lines;
}
