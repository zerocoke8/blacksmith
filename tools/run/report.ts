// 육성 한 판 측정: 판을 봇으로 끝까지 두고 모은 숫자와 기획서 13장 목표 (16.3의 11~19번).
// measure.ts runs it from the command line; bots.test.ts pins a small run.

import type { Bot as CardBot } from '../cards/bots.ts';
import type { CardRecipeGrade } from '../../src/sim/data/cards.ts';
import { FAMILIES, type FamilyId } from '../../src/sim/data/families.ts';
import {
  DEMON_FLOOR,
  PLAY_SECONDS,
  POLICY_LABEL,
  RUN_DEFAULT_DECK,
  RUN_GRADE_SPEC,
  RUN_GRADES,
  type RunGrade,
  type Star,
  WALL_FLOORS,
} from '../../src/sim/data/run.ts';
import type { LegendCard, RunActionKind, RunChoiceKind, RunMember, RunRules, RunState } from '../../src/sim/run/index.ts';
import { startRun } from '../../src/sim/run/index.ts';
import { playRun, type RunBot } from './bots.ts';

// ---------- One run ----------

export type StopAt = 10 | 20 | 30 | 40 | 50 | 'climb' | 'dead' | 'other';

export interface RunSample {
  seed: number;
  stop: StopAt;
  record: number;
  demon: boolean;
  forges: number;
  forgeFails: number;
  qualities: number[];
  /** Turn actions in order (forced ones marked). */
  turns: { action: RunActionKind; forced: boolean; policy: string | null; gold: number }[];
  goldIncome: number;
  goldEnd: number;
  /** Runs that reached the 마지막 등반: 판 골드 left when it started, and what had come in by then. */
  goldBeforeClimb: number | null;
  incomeBeforeClimb: number | null;
  spent: { materials: number; shop: number; repair: number; merchant: number };
  grade: RunGrade;
  score: number;
  seconds: number;
  /** 사건 (13.11): 선택이 있는 사건, 재료 발견, 부상·중상. */
  events: Partial<Record<RunChoiceKind, number>>;
  finds: number;
  injuries: number;
  severe: number;
  legend: LegendCard | null;
}

const ACTION_KINDS: readonly RunActionKind[] = ['expedition', 'forge', 'maintain', 'rest', 'bond', 'wall', 'climb'];
/** Kinds the player picks freely (forced turns and 은퇴 aside), for the 줄다리기 지표. */
const FREE_KINDS: readonly RunActionKind[] = ['expedition', 'forge', 'maintain', 'rest', 'bond'];
/** Choices that are 사건 (13.11); 보스 보상 and follow-ups (진화, 카드 빼기) are not. */
const EVENT_KINDS: readonly RunChoiceKind[] = ['merchant', 'chat', 'story', 'artisan', 'sign', 'season'];

function stopOf(s: RunState): StopAt {
  if (s.end?.kind === 'climb') return 'climb';
  if (s.end?.kind === 'dead') return 'dead';
  if (s.end?.kind === 'wall') {
    const w = s.walls.find((x) => x.passedTurn === null);
    if (w !== undefined && (WALL_FLOORS as readonly number[]).includes(w.floor)) return w.floor as StopAt;
  }
  return 'other';
}

/** 판 시간 (13.4.1 시간 감): 준비 + 행동마다 + 단조는 레시피 등급대로 + 사건 + 판 끝. */
export function playSeconds(s: RunState): number {
  let t = PLAY_SECONDS.prep + PLAY_SECONDS.end;
  for (const turn of s.turnLog) {
    if (turn.action === 'expedition' || turn.action === 'wall' || turn.action === 'climb') t += PLAY_SECONDS.expedition;
    else if (turn.action === 'forge') {
      const grade: CardRecipeGrade = turn.forge?.grade ?? 'basic';
      t += PLAY_SECONDS.forge[grade];
    } else if (turn.action !== 'retire') t += PLAY_SECONDS.other;
  }
  return t + s.stats.choices * PLAY_SECONDS.event;
}

export function sampleOf(s: RunState): RunSample {
  const events: Partial<Record<RunChoiceKind, number>> = {};
  for (const t of s.turnLog) {
    // A 사연 opened by 교류 is that action's result, not a 사건 (13.11).
    let fromBond = t.action === 'bond';
    for (const k of t.events) {
      if (k === 'story' && fromBond) {
        fromBond = false;
        continue;
      }
      events[k] = (events[k] ?? 0) + 1;
    }
  }
  const last = s.turnLog[s.turnLog.length - 1];
  const climbed = s.end?.kind === 'climb' && last !== undefined;
  const climbGold = climbed ? (last.expedition?.gold ?? 0) : 0;
  return {
    seed: s.setup.seed,
    stop: stopOf(s),
    record: s.record,
    demon: s.lastBossFloor >= DEMON_FLOOR,
    forges: s.stats.forges,
    forgeFails: s.stats.forgeFails,
    qualities: s.turnLog.flatMap((t) => (t.forge?.quality ? [t.forge.quality] : [])),
    turns: s.turnLog.map((t) => ({
      action: t.action,
      forced: t.forced,
      policy: t.expedition !== null && t.action === 'expedition' ? t.expedition.policy : null,
      gold: t.goldAfter,
    })),
    goldIncome: s.stats.goldEarned + s.stats.goldGifted,
    goldEnd: s.gold,
    goldBeforeClimb: climbed ? last.goldBefore : null,
    incomeBeforeClimb: climbed ? s.stats.goldEarned + s.stats.goldGifted - climbGold : null,
    spent: {
      materials: s.stats.spentMaterials,
      shop: s.stats.spentShop,
      repair: s.stats.spentRepair,
      merchant: s.stats.spentMerchant,
    },
    grade: s.result?.grade ?? 'novice',
    score: s.result?.score.total ?? 0,
    seconds: playSeconds(s),
    events,
    finds: s.stats.finds,
    injuries: s.stats.injuries,
    severe: s.stats.severe,
    legend: s.result?.legend ?? null,
  };
}

// ---------- A configuration ----------

export interface MeasureConfig {
  bot: RunBot;
  cardBot: CardBot;
  family: FamilyId;
  star: Star;
  companions: RunMember[];
  ancestor: LegendCard | null;
  runs: number;
  seed: number;
  rules: Partial<RunRules>;
  maxCraftTurns: number;
}

/** 동료: 시작 가문 둘 (주인공과 같은 성급) + 시즌 가문 1성 (빌림), 주인공과 겹치면 다음 가문. */
export function defaultCompanions(hero: FamilyId, star: Star): RunMember[] {
  const owned = (['vail', 'nea', 'odel', 'aren'] as FamilyId[]).filter((f) => f !== hero).slice(0, 2);
  const season: FamilyId = hero === 'isol' ? 'odel' : 'isol';
  return [...owned.map((family) => ({ family, star })), { family: season, star: 1 as Star }];
}

/** 13.7.1의 '선대 무기': 노련한 선대가 남긴 ★3 역작 (연격). */
export function sampleAncestor(hero: FamilyId): LegendCard {
  const type = FAMILIES[hero].weapon;
  return {
    id: 'L-sample',
    family: hero,
    star: 1,
    grade: 'seasoned',
    season: 'ash',
    record: 38,
    score: 4200,
    wallsPassed: 3,
    end: 'wall',
    endFloor: 38,
    factors: [],
    weapon: { id: 'a', type, materialTier: 4, quality: 3, element: null, enchants: ['combo'], unique: null },
    weaponName: `${FAMILIES[hero].name}의 무기`,
    deck: [...RUN_DEFAULT_DECK],
    runSeed: 0,
  };
}

export function runConfig(c: MeasureConfig): RunSample[] {
  const out: RunSample[] = [];
  for (let i = 0; i < c.runs; i++) {
    const start = startRun({
      seed: c.seed + i,
      hero: { family: c.family, star: c.star },
      companions: c.companions,
      ancestors: c.ancestor === null ? [] : [c.ancestor],
      mainAncestor: c.ancestor === null ? null : 0,
      weaponKeep: c.ancestor === null ? null : { kind: 'enchant', enchant: 'combo' },
      deck: [...RUN_DEFAULT_DECK],
      rules: c.rules,
    });
    out.push(sampleOf(playRun(start, c.bot, { cardBot: c.cardBot, maxCraftTurns: c.maxCraftTurns, maxSteps: 5000 })));
  }
  return out;
}

// ---------- Statistics ----------

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1) + 0.5)))] as number;
}

export interface Tug {
  /** Consecutive free turns that changed action (매 턴 갈리는가). */
  switchRate: number;
  /** Mean normalized entropy of the free actions at each turn across runs (판마다 갈리는가). */
  entropy: number;
  /** Share of the most common free action. */
  topShare: number;
  topAction: RunActionKind;
  /** Median longest run of the same free action. */
  longestStreak: number;
}

export function tugOf(samples: readonly RunSample[]): Tug {
  let pairs = 0;
  let changed = 0;
  const counts = new Map<RunActionKind, number>();
  const byTurn = new Map<number, Map<RunActionKind, number>>();
  const streaks: number[] = [];
  for (const s of samples) {
    let streak = 0;
    let best = 0;
    let prev: RunActionKind | null = null;
    s.turns.forEach((t, i) => {
      if (t.forced || !FREE_KINDS.includes(t.action)) {
        prev = null;
        streak = 0;
        return;
      }
      counts.set(t.action, (counts.get(t.action) ?? 0) + 1);
      const m = byTurn.get(i) ?? new Map<RunActionKind, number>();
      m.set(t.action, (m.get(t.action) ?? 0) + 1);
      byTurn.set(i, m);
      if (prev !== null) {
        pairs += 1;
        if (prev !== t.action) changed += 1;
      }
      streak = prev === t.action ? streak + 1 : 1;
      best = Math.max(best, streak);
      prev = t.action;
    });
    streaks.push(best);
  }
  let hSum = 0;
  let hWeight = 0;
  for (const m of byTurn.values()) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    let h = 0;
    for (const n of m.values()) h -= (n / total) * Math.log(n / total);
    hSum += (h / Math.log(FREE_KINDS.length)) * total;
    hWeight += total;
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let top: RunActionKind = 'expedition';
  for (const [k, n] of counts) if (n > (counts.get(top) ?? 0)) top = k;
  return {
    switchRate: pairs === 0 ? 0 : changed / pairs,
    entropy: hWeight === 0 ? 0 : hSum / hWeight,
    topShare: total === 0 ? 0 : (counts.get(top) ?? 0) / total,
    topAction: top,
    longestStreak: quantile(streaks, 0.5),
  };
}

export interface Summary {
  runs: number;
  stops: Record<string, number>;
  demon: number;
  climbRecord: { p10: number; median: number; p90: number; n: number };
  recordMedian: number;
  forges: number;
  forgeFails: number;
  qualityMean: number;
  /** Mean count per run, every run. */
  actions: Record<RunActionKind, number>;
  /** Mean count per run for runs that played every turn (마지막 등반까지). */
  fullActions: Record<RunActionKind, number> | null;
  policies: Record<string, number>;
  goldAt: { turn: number; median: number; n: number }[];
  goldIncome: number;
  goldEnd: number;
  /** Median 판 골드 left when the 마지막 등반 started, and its share of the gold earned by then. */
  goldBeforeClimb: number | null;
  leftShare: number | null;
  spent: RunSample['spent'];
  grades: Record<RunGrade, number>;
  score: number;
  minutes: { median: number; p10: number; p90: number; full: number | null };
  events: number;
  eventKinds: Partial<Record<RunChoiceKind, number>>;
  finds: number;
  injuries: number;
  severe: number;
  tug: Tug;
}

export function summarize(samples: readonly RunSample[], turns: number): Summary {
  const n = Math.max(1, samples.length);
  const stops: Record<string, number> = {};
  for (const s of samples) stops[String(s.stop)] = (stops[String(s.stop)] ?? 0) + 1 / n;
  const climbed = samples.filter((s) => s.stop === 'climb').map((s) => s.record);
  const actionsOf = (list: readonly RunSample[]): Record<RunActionKind, number> => {
    const out = Object.fromEntries(ACTION_KINDS.map((k) => [k, 0])) as Record<RunActionKind, number>;
    for (const s of list) for (const t of s.turns) if (t.action in out) out[t.action] += 1 / Math.max(1, list.length);
    return out;
  };
  const full = samples.filter((s) => s.turns.length >= turns);
  const policies: Record<string, number> = {};
  let policyTotal = 0;
  for (const s of samples) {
    for (const t of s.turns) {
      if (t.policy === null) continue;
      policies[t.policy] = (policies[t.policy] ?? 0) + 1;
      policyTotal += 1;
    }
  }
  for (const k of Object.keys(policies)) policies[k] = (policies[k] as number) / Math.max(1, policyTotal);
  const goldAt = [5, 10, 15, 20, 25, 30]
    .filter((t) => t <= turns)
    .map((turn) => {
      const xs = samples.flatMap((s) => (s.turns.length >= turn ? [(s.turns[turn - 1] as { gold: number }).gold] : []));
      return { turn, median: quantile(xs, 0.5), n: xs.length };
    });
  const grades = Object.fromEntries(RUN_GRADES.map((g) => [g, 0])) as Record<RunGrade, number>;
  for (const s of samples) grades[s.grade] += 1 / n;
  const eventKinds: Partial<Record<RunChoiceKind, number>> = {};
  for (const s of samples) for (const [k, v] of Object.entries(s.events)) eventKinds[k as RunChoiceKind] = (eventKinds[k as RunChoiceKind] ?? 0) + v / n;
  const choiceEvents = samples.map((s) => EVENT_KINDS.reduce((a, k) => a + (s.events[k] ?? 0), 0));
  const minutes = samples.map((s) => s.seconds / 60);
  const beforeClimb = samples.flatMap((s) => (s.goldBeforeClimb === null ? [] : [s.goldBeforeClimb]));
  const leftShares = samples.flatMap((s) =>
    s.goldBeforeClimb === null || s.incomeBeforeClimb === null || s.incomeBeforeClimb <= 0
      ? []
      : [s.goldBeforeClimb / s.incomeBeforeClimb],
  );
  const fullMinutes = full.map((s) => s.seconds / 60);
  return {
    runs: samples.length,
    stops,
    demon: samples.filter((s) => s.demon).length / n,
    climbRecord: { p10: quantile(climbed, 0.1), median: quantile(climbed, 0.5), p90: quantile(climbed, 0.9), n: climbed.length },
    recordMedian: quantile(
      samples.map((s) => s.record),
      0.5,
    ),
    forges: mean(samples.map((s) => s.forges)),
    forgeFails: mean(samples.map((s) => s.forgeFails)),
    qualityMean: mean(samples.flatMap((s) => s.qualities)),
    actions: actionsOf(samples),
    fullActions: full.length === 0 ? null : actionsOf(full),
    policies,
    goldAt,
    goldIncome: mean(samples.map((s) => s.goldIncome)),
    goldEnd: quantile(
      samples.map((s) => s.goldEnd),
      0.5,
    ),
    goldBeforeClimb: beforeClimb.length === 0 ? null : quantile(beforeClimb, 0.5),
    leftShare: leftShares.length === 0 ? null : quantile(leftShares, 0.5),
    spent: {
      materials: mean(samples.map((s) => s.spent.materials)),
      shop: mean(samples.map((s) => s.spent.shop)),
      repair: mean(samples.map((s) => s.spent.repair)),
      merchant: mean(samples.map((s) => s.spent.merchant)),
    },
    grades,
    score: quantile(
      samples.map((s) => s.score),
      0.5,
    ),
    minutes: {
      median: quantile(minutes, 0.5),
      p10: quantile(minutes, 0.1),
      p90: quantile(minutes, 0.9),
      full: fullMinutes.length === 0 ? null : quantile(fullMinutes, 0.5),
    },
    events: mean(choiceEvents.map((c, i) => c + (samples[i]?.finds ?? 0) + (samples[i]?.injuries ?? 0))),
    eventKinds,
    finds: mean(samples.map((s) => s.finds)),
    injuries: mean(samples.map((s) => s.injuries)),
    severe: mean(samples.map((s) => s.severe)),
    tug: tugOf(samples),
  };
}

// ---------- Report ----------

export const pct = (x: number, digits = 0): string => `${(x * 100).toFixed(digits)}%`;
const f1 = (x: number): string => x.toFixed(1);

export interface Row {
  label: string;
  bot: RunBot;
  star: Star;
  summary: Summary;
}

export interface Check {
  name: string;
  target: string;
  actual: string;
  ok: boolean | null;
  where: string;
}

function find(rows: readonly Row[], bot: string, star: Star): Summary | null {
  return rows.find((r) => r.bot.id === bot && r.star === star)?.summary ?? null;
}

/** 기획서 13장 목표와 견준다. */
export function checksFor(rows: readonly Row[], _turns: number): Check[] {
  const out: Check[] = [];
  const stars = [...new Set(rows.map((r) => r.star))].sort();
  const lo = stars[0] as Star;
  const hi = stars[stars.length - 1] as Star;
  const plan = (s: Star): Summary | null => find(rows, 'planner', s);
  const simple = (s: Star): Summary | null => find(rows, 'simple', s);
  const p1 = plan(lo);
  const s1 = simple(lo);
  const p5 = plan(hi);
  const s5 = simple(hi);
  if (p1 !== null) {
    const m = p1.minutes.full ?? p1.minutes.median;
    out.push({ name: '판 시간 (30턴을 다 한 판, 중앙값)', target: '20~30분', actual: `${f1(m)}분`, ok: m >= 20 && m <= 30, where: '13.1, 16.3의 11번' });
    out.push({ name: '단조 횟수 (계획 봇)', target: '판당 4~6번', actual: f1(p1.forges), ok: p1.forges >= 4 && p1.forges <= 6, where: '13.8' });
    const a = p1.fullActions;
    if (a !== null) {
      const rest = a.rest + a.bond;
      out.push({
        name: '행동 (계획 봇, 30턴을 다 한 판)',
        target: '원정 약 16 · 휴식(+교류) 약 6 · 정비 약 4 · 단조 약 4',
        actual: `원정 ${f1(a.expedition + a.wall + a.climb)} · 휴식+교류 ${f1(rest)} · 정비 ${f1(a.maintain)} · 단조 ${f1(a.forge)}`,
        ok:
          Math.abs(a.expedition + a.wall + a.climb - 16) <= 3 &&
          Math.abs(rest - 6) <= 3 &&
          Math.abs(a.maintain - 4) <= 2 &&
          Math.abs(a.forge - 4) <= 2,
        where: '13.4.1',
      });
    }
    out.push({
      name: '사건 (선택 사건 + 재료 발견 + 부상·중상)',
      target: '판당 8~10개',
      actual: `${f1(p1.events)} (그중 재료 발견 ${f1(p1.finds)})`,
      ok: p1.events >= 8 && p1.events <= 10,
      where: '13.11',
    });
    out.push({ name: '잘 지으면 끝까지 간다 (계획 봇 악마)', target: `${lo}성 50% 이상 (13.7.1 맞춘 ★3 53%)`, actual: pct(p1.demon), ok: p1.demon >= 0.5, where: '13.7, 13.7.1' });
    out.push({
      name: '줄다리기: 행동이 턴마다 갈린다 (계획 봇)',
      target: '연속 턴 바뀜 50% 이상, 한 행동 60% 이하',
      actual: `바뀜 ${pct(p1.tug.switchRate)}, ${p1.tug.topAction} ${pct(p1.tug.topShare)}`,
      ok: p1.tug.switchRate >= 0.5 && p1.tug.topShare <= 0.6,
      where: '13.4.1, 13.20의 1번, 16.3의 12번',
    });
    if (p1.goldBeforeClimb !== null && p1.leftShare !== null) {
      out.push({
        name: '판 골드가 남아도는가 (계획 봇, 마지막 등반 직전 중앙값)',
        target: '그때까지 번 골드의 25% 이하',
        actual: `${Math.round(p1.goldBeforeClimb)}G (${pct(p1.leftShare)})`,
        ok: p1.leftShare <= 0.25,
        where: '13.7.1, 16.2의 15번, 16.3의 18번',
      });
    }
    if (p1.climbRecord.n > 0) {
      out.push({
        name: '마지막 등반 기록 (계획 봇, 중앙값)',
        target: '52~62층 (13.7.1)',
        actual: `${p1.climbRecord.median}층`,
        ok: p1.climbRecord.median >= 52 && p1.climbRecord.median <= 62,
        where: '13.7.1',
      });
    }
  }
  const midWalls = (x: Summary): number => (x.stops['20'] ?? 0) + (x.stops['30'] ?? 0) + (x.stops['40'] ?? 0);
  if (s1 !== null) {
    const mid = midWalls(s1);
    out.push({
      name: '계획 없이 가면 중반에 막힌다 (단순 봇, 13.7.1 규칙 그대로)',
      target: `${lo}성: 20~40층 벽에서 50% 이상, 악마 10% 이하`,
      actual: `20~40층 벽 ${pct(mid)}, 악마 ${pct(s1.demon)}`,
      ok: mid >= 0.5 && s1.demon <= 0.1,
      where: '13.7, 13.7.1',
    });
  }
  const late1 = find(rows, 'simpleLate', lo);
  if (late1 !== null) {
    // Not a target: how much the 단순 봇's result leans on when it forges.
    out.push({
      name: '늦게 짓는 단순 봇 (벽 3턴 앞에서만 단조, 비교용)',
      target: '목표 아님',
      actual: `${lo}성: 20~40층 벽 ${pct(midWalls(late1))}, 악마 ${pct(late1.demon)}`,
      ok: null,
      where: '규칙 검토',
    });
  }
  if (p1 !== null && s5 !== null) {
    out.push({
      name: '성급은 계획을 대신하지 못한다',
      target: `계획 봇 ${lo}성 악마 > 단순 봇 ${hi}성 악마`,
      actual: `${pct(p1.demon)} > ${pct(s5.demon)}`,
      ok: p1.demon > s5.demon,
      where: '13.5, 13.20',
    });
  }
  if (p1 !== null && p5 !== null && hi !== lo) {
    out.push({
      name: '같은 실력이면 높은 성급이 앞선다',
      target: `계획 봇 ${hi}성 평가 중앙값 > ${lo}성`,
      actual: `${p5.score} > ${p1.score}`,
      ok: p5.score > p1.score,
      where: '15.3, 16.3의 19번',
    });
  }
  return out;
}

export interface ReportInput {
  rows: Row[];
  turns: number;
  title: string;
  notes: string[];
}

export function reportLines(r: ReportInput): string[] {
  const lines: string[] = [`# ${r.title}`, '', ...r.notes.map((n) => `- ${n}`), ''];
  lines.push('## 멈춘 곳 (도달 벽 분포)', '');
  lines.push('| 봇 | 성급 | 판 | 10층 벽 | 20층 벽 | 30층 벽 | 40층 벽 | 악마 | 마지막 등반 | 사망 | 악마를 넘음 | 등반 기록 p10 / 중앙 / p90 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of r.rows) {
    const s = row.summary;
    const st = (k: string): string => pct(s.stops[k] ?? 0);
    const climb = s.climbRecord.n > 0 ? `${s.climbRecord.p10} / ${s.climbRecord.median} / ${s.climbRecord.p90}` : '—';
    lines.push(`| ${row.bot.name} | ${row.star}성 | ${s.runs} | ${st('10')} | ${st('20')} | ${st('30')} | ${st('40')} | ${st('50')} | ${st('climb')} | ${st('dead')} | ${pct(s.demon)} | ${climb} |`);
  }
  lines.push('', '## 단조, 평가, 시간', '');
  lines.push('| 봇 | 성급 | 단조 / 판 | 실패 | 평균 ★ | 평가 중앙 | 풋내기 | 이름난 | 노련한 | 악마를 벤 | 노래로 남은 | 판 시간 중앙 (p10~p90) | 30턴 판 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of r.rows) {
    const s = row.summary;
    const g = RUN_GRADES.map((x) => pct(s.grades[x])).join(' | ');
    const full = s.minutes.full === null ? '—' : `${f1(s.minutes.full)}분`;
    lines.push(
      `| ${row.bot.name} | ${row.star}성 | ${f1(s.forges)} | ${f1(s.forgeFails)} | ${s.qualityMean.toFixed(2)} | ${s.score} | ${g} | ${f1(s.minutes.median)}분 (${f1(s.minutes.p10)}~${f1(s.minutes.p90)}) | ${full} |`,
    );
  }
  lines.push('', '## 행동 비율 (판당 평균 횟수)', '');
  lines.push('| 봇 | 성급 | 원정 | 벽 도전 | 마지막 등반 | 단조 | 정비 | 휴식 | 교류 | 방침 (신중 / 보통 / 과감) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const row of r.rows) {
    const a = row.summary.actions;
    const p = row.summary.policies;
    const pol = (['cautious', 'normal', 'bold'] as const).map((k) => pct(p[k] ?? 0)).join(' / ');
    lines.push(
      `| ${row.bot.name} | ${row.star}성 | ${f1(a.expedition)} | ${f1(a.wall)} | ${f1(a.climb)} | ${f1(a.forge)} | ${f1(a.maintain)} | ${f1(a.rest)} | ${f1(a.bond)} | ${pol} |`,
    );
  }
  lines.push('', '## 판 골드 흐름', '');
  const goldTurns = r.rows[0]?.summary.goldAt.map((g) => `${g.turn}턴`) ?? [];
  lines.push(
    `| 봇 | 성급 | ${goldTurns.join(' | ')} | 번 골드 (층·선물) | 주재료 | 상점 | 수리 | 행상 | 마지막 등반 직전 남은 골드 | 판 끝 |`,
  );
  lines.push(`|---|---|${goldTurns.map(() => '---').join('|')}|---|---|---|---|---|---|---|`);
  for (const row of r.rows) {
    const s = row.summary;
    const at = s.goldAt.map((g) => (g.n > 0 ? `${Math.round(g.median)}G` : '—')).join(' | ');
    const before = s.goldBeforeClimb === null ? '—' : `${Math.round(s.goldBeforeClimb)}G (${pct(s.leftShare ?? 0)})`;
    lines.push(
      `| ${row.bot.name} | ${row.star}성 | ${at} | ${Math.round(s.goldIncome)}G | ${Math.round(s.spent.materials)} | ${Math.round(s.spent.shop)} | ${Math.round(s.spent.repair)} | ${Math.round(s.spent.merchant)} | ${before} | ${Math.round(s.goldEnd)}G |`,
    );
  }
  lines.push('', '## 사건과 줄다리기 지표', '');
  lines.push('| 봇 | 성급 | 사건 / 판 | 행상 | 동료 사연 | 사연 | 장인 | 기척 | 시즌 | 재료 발견 | 부상 (중상) | 연속 턴 바뀜 | 턴별 행동 엔트로피 | 가장 많은 행동 | 같은 행동 최장 연속 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of r.rows) {
    const s = row.summary;
    const e = (k: RunChoiceKind): string => f1(s.eventKinds[k] ?? 0);
    lines.push(
      `| ${row.bot.name} | ${row.star}성 | ${f1(s.events)} | ${e('merchant')} | ${e('chat')} | ${e('story')} | ${e('artisan')} | ${e('sign')} | ${e('season')} | ${f1(s.finds)} | ${f1(s.injuries)} (${f1(s.severe)}) | ${pct(s.tug.switchRate)} | ${s.tug.entropy.toFixed(2)} | ${s.tug.topAction} ${pct(s.tug.topShare)} | ${s.tug.longestStreak} |`,
    );
  }
  lines.push('', '## 기획서 목표와 비교', '');
  lines.push('| | 항목 | 목표 | 측정 | 곳 |');
  lines.push('|---|---|---|---|---|');
  for (const c of checksFor(r.rows, r.turns)) {
    lines.push(`| ${c.ok === null ? '·' : c.ok ? '✓' : '✗'} | ${c.name} | ${c.target} | ${c.actual} | ${c.where} |`);
  }
  lines.push('');
  lines.push(`방침 이름: ${Object.values(POLICY_LABEL).join(' / ')}. 등급: ${RUN_GRADES.map((g) => RUN_GRADE_SPEC[g].label).join(' < ')}.`);
  return lines;
}
