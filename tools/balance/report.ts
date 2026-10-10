// Turns simulation runs into metrics, target checks (✓/✗) and a markdown report.

import { GRADES, type Grade } from '../../src/sim/core/types.ts';
import { DAY_MINUTES, FAME_STAGES, RETIRE_AT_DAYS } from '../../src/sim/data/world.ts';
import { gradeShares } from '../../src/sim/world/fame.ts';
import type { CareerRecord, ReturnReason, ShopLedger } from '../../src/sim/world/types.ts';
import type { RunResult } from './simulate.ts';
import {
  ACTIVE_HEROES_BY_STAGE,
  ACTIVE_HEROES_TOLERANCE,
  DEATH_RATE_RANGE,
  EXPEDITIONS_PER_DAY,
  FAILURES_RANGE,
  FAME_STAGE_DAYS,
  FLOORS_PER_DAY,
  GRADE_TARGETS,
  INJURIES_RANGE,
  MID_GROWTH,
  NEW_FLOORS_TOLERANCE,
  RECORD_TOLERANCE,
  REPAIR_HOURS_RANGE,
  RETIRE_DAYS_TOLERANCE,
  SHOP_RECORD_CURVE,
  SHOP_RECORD_TOLERANCE,
  TOP_GROWTH_MIN,
} from './targets.ts';

// ---------- small stats helpers ----------

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return (s[lo] as number) + ((s[hi] as number) - (s[lo] as number)) * (pos - lo);
}

export const median = (v: readonly number[]): number => quantile(v, 0.5);

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
}

const careerDays = (c: CareerRecord): number => (c.endedAt - c.arrivedAt) / DAY_MINUTES;

/**
 * The 7.4 table describes heroes without inheritance who walk in with the basic weapon.
 * Disciples (master's weapon, strength, talent, …) are shown on their own lines.
 */
export const isFirstGeneration = (c: Pick<CareerRecord, 'generation' | 'inherited'>): boolean =>
  c.generation === 1 && c.inherited.length === 0;

const zeroGrades = (): Record<Grade, number> => ({ N: 0, C: 0, B: 0, A: 0, S: 0 });

function toShares(counts: Record<Grade, number>): Record<Grade, number> {
  const total = GRADES.reduce((s, g) => s + counts[g], 0);
  const out = zeroGrades();
  for (const g of GRADES) out[g] = total > 0 ? counts[g] / total : NaN;
  return out;
}

export function activeHeroesTarget(stage: number): number {
  const i = Math.max(1, Math.min(stage, ACTIVE_HEROES_BY_STAGE.length)) - 1;
  return ACTIVE_HEROES_BY_STAGE[i] as number;
}

// ---------- metrics ----------

export interface GradeMetrics {
  grade: Grade;
  careers: number;
  /** Careers of first-generation heroes (the 7.4 cohort). */
  firstGenCareers: number;
  retired: number;
  dead: number;
  deathRate: number;
  /** All retired heroes, disciples included. */
  recordMedian: number;
  recordP90: number;
  recordMax: number;
  /** 7.4 '보통' cohort: first generation, mid growth. */
  midGrowthCount: number;
  midGrowthMedian: number;
  /** Records pile up just below boss floors, so the median jumps; checks use the mean. */
  midGrowthMean: number;
  /** 7.4 '최상' cohort: first generation, top growth. */
  topGrowthCount: number;
  topGrowthMedian: number;
  topGrowthMean: number;
  /** Disciples in the same growth windows (shown, not judged). */
  discipleMidCount: number;
  discipleMidMean: number;
  discipleTopCount: number;
  discipleTopMean: number;
  /** First-generation retirees that arrived after day 7 (merchant has caught up). */
  lateMedian: number;
  lateCount: number;
  /** All retired heroes: the 6.3 retirement rule applies to everyone. */
  retireDaysMedian: number;
  /** First-generation retirees. */
  newFloorsPerDay: number;
  injuriesMean: number;
  failuresMean: number;
}

export interface CurvePoint {
  day: number;
  label: string;
  target: number;
  shopRecord: number;
  worldRecord: number;
}

export interface FameStagePoint {
  stage: number;
  label: string;
  range: readonly [number, number];
  /** Median day reached across seeds; null if not reached in some run. */
  day: number | null;
  reachedRuns: number;
}

export interface Population {
  arrivalsPerDay: { rookies: number; disciples: number };
  /** Share of all arrivals that are disciples. */
  discipleShare: number;
  rookieGrades: Record<Grade, number>;
  /** 6.2 shares at the fame stage of each rookie's arrival, averaged. */
  rookieExpected: Record<Grade, number>;
  discipleGrades: Record<Grade, number>;
  /** Active heroes on the last day, seed mean. */
  activeEnd: number;
  /** 9.2 '활동 용사' for each run's final fame stage, seed mean. */
  activeTarget: number;
  activeGrades: Record<Grade, number>;
  activeGenerationMean: number;
  /** Share of last-day active heroes that are disciples (generation 2+). */
  activeDiscipleShare: number;
  generationMax: number;
  fameStageEnd: number;
}

export interface CreditMetrics {
  purchases: number;
  onCredit: number;
  firstVisitPurchases: number;
  firstVisitOnCredit: number;
  creditSlots: number;
}

export interface Metrics {
  policy: string;
  material: string;
  disciplesReplaceNewHeroes: boolean;
  discipleChance: number | null;
  ignoreBudget: boolean;
  days: number;
  seeds: number[];
  cohortNote: string;
  grades: GradeMetrics[];
  careers: number;
  deathRate: number;
  deathRateBPlus: number;
  injuriesMean: number;
  injuriesMeanRetired: number;
  /** B+ grades: the doc's per-career numbers assume a one-week career. */
  injuriesWeekCareer: number;
  failuresWeekCareer: number;
  failuresMean: number;
  expeditionsPerDay: number;
  floorsPerDay: number;
  repairIntervalMedianHours: number;
  repairIntervalMeanHours: number;
  visitsPerCareer: number;
  weaponsPerCareer: number;
  retireReasons: Record<string, number>;
  returnReasons: Record<ReturnReason, number>;
  zeroFloorExpeditionShare: number;
  population: Population;
  curve: CurvePoint[];
  fameStages: FameStagePoint[];
  fameEnd: number;
  /** Share of fame by source over the whole run. */
  fameShare: { firstClear: number; towerRecord: number; retire: number };
  merchantBandEnd: number;
  credit: CreditMetrics;
  /** Seed mean. */
  ledger: ShopLedger;
}

function gradeMetrics(grade: Grade, cohort: readonly CareerRecord[]): GradeMetrics {
  const all = cohort.filter((c) => c.grade === grade);
  const retired = all.filter((c) => c.end === 'retired');
  const dead = all.filter((c) => c.end === 'dead');
  const firstGen = retired.filter(isFirstGeneration);
  const disciples = retired.filter((c) => !isFirstGeneration(c));
  const isMid = (c: CareerRecord): boolean => c.growth >= MID_GROWTH[0] && c.growth <= MID_GROWTH[1];
  const isTop = (c: CareerRecord): boolean => c.growth >= TOP_GROWTH_MIN;
  const rec = retired.map((c) => c.record);
  const mid = firstGen.filter(isMid);
  const top = firstGen.filter(isTop);
  const dMid = disciples.filter(isMid);
  const dTop = disciples.filter(isTop);
  const late = firstGen.filter((c) => c.arrivedAt >= 7 * DAY_MINUTES);
  return {
    grade,
    careers: all.length,
    firstGenCareers: all.filter(isFirstGeneration).length,
    retired: retired.length,
    dead: dead.length,
    deathRate: all.length ? dead.length / all.length : NaN,
    recordMedian: median(rec),
    recordP90: quantile(rec, 0.9),
    recordMax: rec.length ? Math.max(...rec) : NaN,
    midGrowthCount: mid.length,
    midGrowthMedian: median(mid.map((c) => c.record)),
    midGrowthMean: mean(mid.map((c) => c.record)),
    topGrowthCount: top.length,
    topGrowthMedian: median(top.map((c) => c.record)),
    topGrowthMean: mean(top.map((c) => c.record)),
    discipleMidCount: dMid.length,
    discipleMidMean: mean(dMid.map((c) => c.record)),
    discipleTopCount: dTop.length,
    discipleTopMean: mean(dTop.map((c) => c.record)),
    lateCount: late.length,
    lateMedian: median(late.map((c) => c.record)),
    retireDaysMedian: median(retired.map(careerDays)),
    newFloorsPerDay: median(firstGen.map((c) => c.record / Math.max(careerDays(c), 1e-9))),
    injuriesMean: mean(all.map((c) => c.injuries)),
    failuresMean: mean(all.map((c) => c.stats.failures)),
  };
}

function population(runs: readonly RunResult[], days: number): Population {
  const rookieCounts = zeroGrades();
  const discipleCounts = zeroGrades();
  const expectedSum = zeroGrades();
  const activeCounts = zeroGrades();
  let rookies = 0;
  let disciples = 0;
  let generationSum = 0;
  let active = 0;
  let activeDisciples = 0;
  let generationMax = 0;
  for (const r of runs) {
    let stage = 1;
    for (const e of r.events) {
      if (e.kind === 'fameStage') stage = e.stage;
      else if (e.kind === 'arrival') {
        if (e.disciple) {
          disciples++;
          discipleCounts[e.grade]++;
        } else {
          rookies++;
          rookieCounts[e.grade]++;
          const shares = gradeShares(stage);
          for (const g of GRADES) expectedSum[g] += shares[g];
        }
      }
    }
    for (const h of r.world.heroes) {
      activeCounts[h.grade]++;
      generationSum += h.generation;
      if (h.generation > 1) activeDisciples++;
      active++;
      generationMax = Math.max(generationMax, h.generation);
    }
    for (const c of r.world.careers) generationMax = Math.max(generationMax, c.generation);
  }
  const rookieExpected = zeroGrades();
  for (const g of GRADES) rookieExpected[g] = rookies > 0 ? expectedSum[g] / rookies : NaN;
  return {
    arrivalsPerDay: { rookies: rookies / runs.length / days, disciples: disciples / runs.length / days },
    discipleShare: rookies + disciples > 0 ? disciples / (rookies + disciples) : NaN,
    rookieGrades: toShares(rookieCounts),
    rookieExpected,
    discipleGrades: toShares(discipleCounts),
    activeEnd: active / runs.length,
    activeTarget: mean(runs.map((r) => activeHeroesTarget(r.world.fameStage))),
    activeGrades: toShares(activeCounts),
    activeGenerationMean: active > 0 ? generationSum / active : NaN,
    activeDiscipleShare: active > 0 ? activeDisciples / active : NaN,
    generationMax,
    fameStageEnd: mean(runs.map((r) => r.world.fameStage)),
  };
}

export function computeMetrics(runs: readonly RunResult[]): Metrics {
  const first = runs[0];
  if (first === undefined) throw new Error('no runs');
  const days = first.config.days;
  const endMinute = days * DAY_MINUTES;

  // Cohort: heroes whose whole career fits in the run (max career ≈ 10 days + one cycle).
  const margin = (RETIRE_AT_DAYS + 1) * DAY_MINUTES;
  const complete = endMinute > margin;
  const cohort: CareerRecord[] = [];
  for (const r of runs) {
    for (const c of r.world.careers) if (!complete || c.arrivedAt <= endMinute - margin) cohort.push(c);
  }
  const cohortNote = complete
    ? `${days - RETIRE_AT_DAYS - 1}일차까지 도착한 용사 (커리어가 모두 끝난 집단)`
    : `실행 기간이 짧아 끝난 커리어만 집계 (긴 커리어가 빠져 있어 치우침)`;

  const grades = GRADES.map((g) => gradeMetrics(g, cohort));

  const totalDays = cohort.reduce((s, c) => s + careerDays(c), 0);
  const dead = cohort.filter((c) => c.end === 'dead').length;
  const bPlus = cohort.filter((c) => c.grade === 'B' || c.grade === 'A' || c.grade === 'S');

  // Repair intervals, per hero, from visit events.
  const intervals: number[] = [];
  const returnReasons: Record<ReturnReason, number> = {
    hp: 0,
    durability: 0,
    risk: 0,
    maxFloors: 0,
    dull: 0,
    failed: 0,
  };
  let returns = 0;
  let zeroFloor = 0;
  const credit: CreditMetrics = {
    purchases: 0,
    onCredit: 0,
    firstVisitPurchases: 0,
    firstVisitOnCredit: 0,
    creditSlots: first.world.rules.creditSlots,
  };
  for (const r of runs) {
    const lastRepair = new Map<string, number>();
    for (const e of r.events) {
      if (e.kind === 'visit') {
        if (e.repaired) {
          const prev = lastRepair.get(e.heroId);
          if (prev !== undefined) intervals.push((e.at - prev) / 60);
          lastRepair.set(e.heroId, e.at);
        }
        if (e.bought !== null) {
          const firstVisit = e.reasons.includes('first');
          credit.purchases++;
          if (e.credit > 0) credit.onCredit++;
          if (firstVisit) credit.firstVisitPurchases++;
          if (firstVisit && e.credit > 0) credit.firstVisitOnCredit++;
        }
      } else if (e.kind === 'return') {
        returns++;
        returnReasons[e.reason]++;
        if (e.floorsCleared === 0 && e.reason !== 'failed') zeroFloor++;
      }
    }
  }
  for (const k of Object.keys(returnReasons) as ReturnReason[]) returnReasons[k] = returns ? returnReasons[k] / returns : 0;

  const retireReasons: Record<string, number> = { stagnant: 0, injuries: 0, maxDays: 0 };
  for (const r of runs) {
    for (const e of r.events) if (e.kind === 'retire') retireReasons[e.reason] = (retireReasons[e.reason] ?? 0) + 1;
  }

  const curve: CurvePoint[] = SHOP_RECORD_CURVE.filter((p) => p.day <= days).map((p) => ({
    day: p.day,
    label: p.label,
    target: p.floor,
    shopRecord: median(runs.map((r) => r.daily[p.day - 1]?.shopRecord ?? NaN)),
    worldRecord: median(runs.map((r) => r.daily[p.day - 1]?.worldRecord ?? NaN)),
  }));

  const fameStages: FameStagePoint[] = FAME_STAGE_DAYS.map((t) => {
    const reached: number[] = [];
    for (const r of runs) {
      const e = r.events.find((x) => x.kind === 'fameStage' && x.stage === t.stage);
      if (e !== undefined) reached.push(e.at / DAY_MINUTES);
    }
    return {
      stage: t.stage,
      label: t.label,
      range: t.range,
      day: reached.length === runs.length ? median(reached) : null,
      reachedRuns: reached.length,
    };
  });

  const ledger: ShopLedger = {
    salesCash: 0,
    creditGiven: 0,
    creditOwed: 0,
    creditRepaid: 0,
    creditLost: 0,
    repairIncome: 0,
    repairUnpaid: 0,
    supplySubsidy: 0,
  };
  for (const r of runs) {
    for (const k of Object.keys(ledger) as (keyof ShopLedger)[]) ledger[k] += r.world.ledger[k] / runs.length;
  }

  return {
    policy: first.config.policy,
    material: first.config.material,
    disciplesReplaceNewHeroes: first.world.rules.disciplesReplaceNewHeroes,
    discipleChance: first.world.rules.discipleChance,
    ignoreBudget: first.world.rules.ignoreBudget,
    days,
    seeds: runs.map((r) => r.config.seed),
    cohortNote,
    grades,
    careers: cohort.length,
    deathRate: cohort.length ? dead / cohort.length : NaN,
    deathRateBPlus: bPlus.length ? bPlus.filter((c) => c.end === 'dead').length / bPlus.length : NaN,
    injuriesMean: mean(cohort.map((c) => c.injuries)),
    injuriesMeanRetired: mean(cohort.filter((c) => c.end === 'retired').map((c) => c.injuries)),
    injuriesWeekCareer: mean(bPlus.filter((c) => c.end === 'retired').map((c) => c.injuries)),
    failuresWeekCareer: mean(bPlus.map((c) => c.stats.failures)),
    failuresMean: mean(cohort.map((c) => c.stats.failures)),
    expeditionsPerDay: cohort.reduce((s, c) => s + c.stats.expeditions, 0) / totalDays,
    floorsPerDay: cohort.reduce((s, c) => s + c.stats.floorsCleared, 0) / totalDays,
    repairIntervalMedianHours: median(intervals),
    repairIntervalMeanHours: mean(intervals),
    visitsPerCareer: mean(cohort.map((c) => c.stats.visits)),
    weaponsPerCareer: mean(cohort.map((c) => c.stats.weaponsBought)),
    retireReasons,
    returnReasons,
    zeroFloorExpeditionShare: returns ? zeroFloor / returns : 0,
    population: population(runs, days),
    curve,
    fameStages,
    fameEnd: mean(runs.map((r) => r.world.fame)),
    fameShare: fameShare(runs),
    merchantBandEnd: mean(runs.map((r) => r.world.merchantBand)),
    credit,
    ledger,
  };
}

// ---------- checks ----------

export interface Check {
  group: string;
  name: string;
  target: string;
  actual: string;
  /** null = no target applies (e.g. the 'none' baseline). */
  ok: boolean | null;
}

/** The 7.4 record column a policy stands for: standard = '보통', matched = '최상'. */
function recordColumnOf(policy: string): 'normal' | 'best' | null {
  return policy === 'standard' ? 'normal' : policy === 'matched' ? 'best' : null;
}

/** Inclusive on both ends. */
export const within = (v: number, lo: number, hi: number): boolean => Number.isFinite(v) && v >= lo && v <= hi;
const near = (v: number, target: number, tol: number): boolean => within(v, target * (1 - tol), target * (1 + tol));
const f1 = (v: number): string => (Number.isFinite(v) ? v.toFixed(1) : '—');
const f0 = (v: number): string => (Number.isFinite(v) ? Math.round(v).toString() : '—');
const pct = (v: number): string => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
const pct0 = (v: number): string => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
const gradeRow = (s: Record<Grade, number>): string => GRADES.map((g) => `${g} ${pct0(s[g])}`).join(' · ');

/**
 * Target checks (✓/✗).
 * The 7.4 table (career best, 하루 새 층, 은퇴 시점) describes the power curve with the
 * weapon handed over on time, so those rows are judged on `power`: the same seeds and
 * policy run with rules.ignoreBudget. Every other row is judged on `m`, the run under
 * the doc's economy. With a single run, pass it alone and it is used for both.
 */
export function buildChecks(m: Metrics, power: Metrics = m): Check[] {
  const out: Check[] = [];
  const recordColumn = recordColumnOf(m.policy);
  const curve = power.ignoreBudget ? ' · 예산 무시' : '';

  for (const own of m.grades) {
    const g = power.grades.find((x) => x.grade === own.grade) ?? own;
    const t = GRADE_TARGETS[g.grade];
    if (recordColumn !== null) {
      const target = t[recordColumn];
      const actual = recordColumn === 'normal' ? g.midGrowthMean : g.topGrowthMean;
      const who = recordColumn === 'normal' ? `성장률 ${MID_GROWTH[0]}~${MID_GROWTH[1]}` : `성장률 ≥${TOP_GROWTH_MIN}`;
      out.push({
        group: `커리어 최고층 (7.4${curve})`,
        name: `${g.grade}급 ${recordColumn === 'normal' ? '보통' : '최상'} 평균 (1대, ${who})`,
        target: `${target}층 ±${RECORD_TOLERANCE * 100}%`,
        actual: `${f0(actual)}층`,
        ok: near(actual, target, RECORD_TOLERANCE),
      });
    }
    const lo = t.retireDays[0] - RETIRE_DAYS_TOLERANCE;
    const hi = t.retireDays[1] + RETIRE_DAYS_TOLERANCE;
    const doc = t.retireDays[0] === t.retireDays[1] ? `약 ${t.retireDays[0]}일` : `${t.retireDays[0]}~${t.retireDays[1]}일`;
    out.push({
      group: `은퇴 시점 (6.3, 7.4${curve})`,
      name: `${g.grade}급 커리어 일수 (중앙값)`,
      target: `${doc} (${f1(lo)}~${f1(hi)})`,
      actual: `${f1(g.retireDaysMedian)}일`,
      ok: within(g.retireDaysMedian, lo, hi),
    });
    // 7.4 '하루 새 층' is the '보통' record over the retirement time, so only 'standard' is judged.
    out.push({
      group: `하루 새 층 (7.4${curve})`,
      name: `${g.grade}급 기록 ÷ 커리어 일수 (1대)`,
      target: `약 ${t.newFloorsPerDay}층 ±${NEW_FLOORS_TOLERANCE * 100}%`,
      actual: `${f1(g.newFloorsPerDay)}층`,
      ok: recordColumn === 'normal' ? near(g.newFloorsPerDay, t.newFloorsPerDay, NEW_FLOORS_TOLERANCE) : null,
    });
  }

  // 6.3 / 7.9 state these per one-week career, so B+ grades are judged; all grades are shown for reference.
  out.push({
    group: '위험 (6.3, 7.9)',
    name: '사망률 (B급 이상, 1주 커리어)',
    target: `${pct(DEATH_RATE_RANGE[0])}~${pct(DEATH_RATE_RANGE[1])}`,
    actual: pct(m.deathRateBPlus),
    ok: within(m.deathRateBPlus, DEATH_RATE_RANGE[0], DEATH_RATE_RANGE[1]),
  });
  out.push({
    group: '위험 (6.3, 7.9)',
    name: '커리어당 부상 (B급 이상, 은퇴)',
    target: `${INJURIES_RANGE[0]}~${INJURIES_RANGE[1]}회`,
    actual: `${f1(m.injuriesWeekCareer)}회`,
    ok: within(m.injuriesWeekCareer, INJURIES_RANGE[0], INJURIES_RANGE[1]),
  });
  out.push({
    group: '위험 (6.3, 7.9)',
    name: '커리어당 실패 (B급 이상)',
    target: `약 17회 (${FAILURES_RANGE[0]}~${FAILURES_RANGE[1]})`,
    actual: `${f1(m.failuresWeekCareer)}회`,
    ok: within(m.failuresWeekCareer, FAILURES_RANGE[0], FAILURES_RANGE[1]),
  });
  out.push({
    group: '위험 (6.3, 7.9)',
    name: '참고: 전체 등급 사망률 / 부상 (은퇴) / 실패',
    target: '—',
    actual: `${pct(m.deathRate)} / ${f1(m.injuriesMeanRetired)}회 / ${f1(m.failuresMean)}회`,
    ok: null,
  });
  out.push({
    group: '시간 (3.4, 7.12, 10)',
    name: '수리 간격 (중앙값)',
    target: `${REPAIR_HOURS_RANGE[0]}~${REPAIR_HOURS_RANGE[1]}시간`,
    actual: `${f1(m.repairIntervalMedianHours)}시간`,
    ok: within(m.repairIntervalMedianHours, REPAIR_HOURS_RANGE[0], REPAIR_HOURS_RANGE[1]),
  });
  out.push({
    group: '시간 (3.4, 7.12, 10)',
    name: '하루 출발 횟수',
    target: `약 ${EXPEDITIONS_PER_DAY.target}번 (${EXPEDITIONS_PER_DAY.range[0]}~${EXPEDITIONS_PER_DAY.range[1]})`,
    actual: `${f1(m.expeditionsPerDay)}번`,
    ok: within(m.expeditionsPerDay, EXPEDITIONS_PER_DAY.range[0], EXPEDITIONS_PER_DAY.range[1]),
  });
  out.push({
    group: '시간 (3.4, 7.12, 10)',
    name: '하루 돌파 층수 (이미 넘은 층 포함)',
    target: `약 ${FLOORS_PER_DAY.target}층 (${FLOORS_PER_DAY.range[0]}~${FLOORS_PER_DAY.range[1]})`,
    actual: `${f1(m.floorsPerDay)}층`,
    ok: within(m.floorsPerDay, FLOORS_PER_DAY.range[0], FLOORS_PER_DAY.range[1]),
  });

  const shopTargets = m.policy !== 'none';
  const pop = m.population;
  out.push({
    group: '인구 (9.2)',
    name: `마지막 날 활동 용사 (명성 단계 ${f1(pop.fameStageEnd)})`,
    target: `~${f0(pop.activeTarget)}명 ±${ACTIVE_HEROES_TOLERANCE * 100}%`,
    actual: `${f0(pop.activeEnd)}명`,
    ok: shopTargets ? near(pop.activeEnd, pop.activeTarget, ACTIVE_HEROES_TOLERANCE) : null,
  });
  out.push({
    group: '인구 (9.2)',
    name: '참고: 도착 중 제자 비율',
    target: '— (9.2 새 용사/일에 포함, 6.5)',
    actual: pct(pop.discipleShare),
    ok: null,
  });
  out.push({
    group: '인구 (6.2)',
    name: '참고: 활동 용사 등급 비율 (마지막 날)',
    target: `신규 도착 기대 ${gradeRow(pop.rookieExpected)}`,
    actual: gradeRow(pop.activeGrades),
    ok: null,
  });

  for (const p of m.curve) {
    out.push({
      group: '가게 최고 기록 (3.7)',
      name: `${p.day}일 (${p.label})`,
      target: `~${p.target}층 ±${SHOP_RECORD_TOLERANCE * 100}%`,
      actual: `${f0(p.shopRecord)}층`,
      ok: shopTargets ? near(p.shopRecord, p.target, SHOP_RECORD_TOLERANCE) : null,
    });
  }
  for (const s of m.fameStages) {
    if (s.range[0] > m.days) continue;
    out.push({
      group: '명성 단계 (9.2)',
      name: `단계 ${s.stage} 도달 (${s.label})`,
      target: `${s.range[0]}~${s.range[1]}일`,
      actual: s.day === null ? `미도달 (${s.reachedRuns}/${m.seeds.length})` : `${f1(s.day)}일`,
      ok: shopTargets ? s.day !== null && within(s.day, s.range[0], s.range[1]) : null,
    });
  }
  return out;
}

// ---------- economy loss (shown, not judged) ----------

/** One grade: the power curve (budget ignored) against the doc's economy, same seeds. */
export interface EconomyLossRow {
  grade: Grade;
  /** 7.4 '보통' cohort mean record. */
  normalPower: number;
  normalBudget: number;
  /** 7.4 '최상' cohort mean record. */
  bestPower: number;
  bestBudget: number;
  /** All retirees' median record. */
  medianPower: number;
  medianBudget: number;
  retireDaysPower: number;
  retireDaysBudget: number;
  /**
   * The 7.4 record row this policy is judged on ('보통' for standard, '최상' for matched),
   * checked on the doc-economy run instead: what the old judging would say. null for 'none'.
   */
  docEconomyRecordOk: boolean | null;
}

export interface EconomyLossCurvePoint {
  day: number;
  label: string;
  power: number;
  budget: number;
}

/** Floors the doc's economy (budget, credit) costs, against the same seeds with the weapon always handed over. */
export function economyLoss(m: Metrics, power: Metrics): { grades: EconomyLossRow[]; curve: EconomyLossCurvePoint[] } {
  const column = recordColumnOf(m.policy);
  const grades = m.grades.map((b) => {
    const p = power.grades.find((x) => x.grade === b.grade) ?? b;
    const budgetRecord = column === 'normal' ? b.midGrowthMean : b.topGrowthMean;
    return {
      grade: b.grade,
      normalPower: p.midGrowthMean,
      normalBudget: b.midGrowthMean,
      bestPower: p.topGrowthMean,
      bestBudget: b.topGrowthMean,
      medianPower: p.recordMedian,
      medianBudget: b.recordMedian,
      retireDaysPower: p.retireDaysMedian,
      retireDaysBudget: b.retireDaysMedian,
      docEconomyRecordOk:
        column === null ? null : near(budgetRecord, GRADE_TARGETS[b.grade][column], RECORD_TOLERANCE),
    };
  });
  const curve = m.curve.map((b) => ({
    day: b.day,
    label: b.label,
    power: power.curve.find((x) => x.day === b.day)?.shopRecord ?? NaN,
    budget: b.shopRecord,
  }));
  return { grades, curve };
}

// ---------- markdown ----------

const mark = (ok: boolean | null): string => (ok === null ? '—' : ok ? '✓' : '✗');

function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/**
 * Markdown report for one policy. `power` is the same seeds run with the budget ignored;
 * when given, the 7.4 rows in `checks` come from it (see buildChecks) and an
 * '경제 손실' table compares the two runs.
 */
export function renderMarkdown(m: Metrics, checks: readonly Check[], power?: Metrics): string {
  const parts: string[] = [];
  const passed = checks.filter((c) => c.ok === true).length;
  const judged = checks.filter((c) => c.ok !== null).length;
  const split = power !== undefined && power !== m ? power : null;
  parts.push(
    `## 정책 \`${m.policy}\` · 주재료 \`${m.material}\` · ${m.days}일 · 시드 ${m.seeds.join(', ')}` +
      (m.ignoreBudget ? ' · 예산 무시 (무기를 늘 넘김, 경제와 분리한 측정)' : ` · 동시 외상 ${m.credit.creditSlots}건`) +
      (m.disciplesReplaceNewHeroes ? ' · 제자가 신규 유입을 대신함' : '') +
      (m.discipleChance !== null ? ` · 제자 확률 ${pct0(m.discipleChance)} (고정)` : ' · 제자 확률 하트×20%'),
  );
  parts.push(`목표 통과 ${passed}/${judged}. 집계 대상: ${m.cohortNote}, ${m.careers}명.`);
  if (split !== null) {
    parts.push(
      '7.4 판정(커리어 최고층·하루 새 층·은퇴 시점)은 같은 시드를 예산 무시로 돌린 측정(무기를 제때 쥔 경우의 힘 곡선)으로 한다. ' +
        "나머지 판정과 아래 표는 기획서 경제(예산·외상)를 따른 측정이다. 둘의 차이는 '경제 손실' 표에 있다.",
    );
  }

  parts.push('### 목표 대비');
  parts.push(
    table(
      ['', '항목', '목표', '실제', '분류'],
      checks.map((c) => [mark(c.ok), c.name, c.target, c.actual, c.group]),
    ),
  );

  parts.push('### 등급별 커리어');
  parts.push(
    table(
      [
        '등급',
        '인원 (1대)',
        '사망률',
        '기록 중앙값',
        'p90',
        '최고',
        '보통: 1대 중앙값 / 평균 (n)',
        '보통: 제자 평균 (n)',
        '최상: 1대 중앙값 / 평균 (n)',
        '최상: 제자 평균 (n)',
        '7일차 이후 도착 1대 (n)',
        '은퇴 일수',
        '하루 새 층 (1대)',
        '부상',
        '실패',
      ],
      m.grades.map((g) => [
        g.grade,
        `${g.careers} (${g.firstGenCareers})`,
        pct(g.deathRate),
        f0(g.recordMedian),
        f0(g.recordP90),
        f0(g.recordMax),
        `${f0(g.midGrowthMedian)} / ${f0(g.midGrowthMean)} (${g.midGrowthCount})`,
        `${f0(g.discipleMidMean)} (${g.discipleMidCount})`,
        `${f0(g.topGrowthMedian)} / ${f0(g.topGrowthMean)} (${g.topGrowthCount})`,
        `${f0(g.discipleTopMean)} (${g.discipleTopCount})`,
        `${f0(g.lateMedian)} (${g.lateCount})`,
        f1(g.retireDaysMedian),
        f1(g.newFloorsPerDay),
        f1(g.injuriesMean),
        f1(g.failuresMean),
      ]),
    ),
  );
  parts.push(
    '기록은 은퇴한 용사 기준. 7.4 판정은 1대(계승 없음, 기본 무기로 시작)만 쓰고, 제자는 따로 보여 준다. ' +
      '부상·실패는 사망 포함 전체 커리어 평균.',
  );

  if (split !== null) {
    const loss = economyLoss(m, split);
    const trio = (p: number, b: number): string =>
      `${f0(p)} / ${f0(b)} / ${Number.isFinite(p - b) ? (p - b).toFixed(1) : '—'}`;
    parts.push('### 경제 손실 (판정 아님)');
    const column = recordColumnOf(m.policy);
    parts.push(
      '같은 시드에서 무기를 예산과 관계없이 제때 넘긴 측정(힘 곡선)과 기획서 경제를 따른 측정을 나란히 둔다. ' +
        '칸마다 힘 곡선 / 예산 적용 / 경제 때문에 잃은 층.' +
        (column === null
          ? ''
          : ` 마지막 열은 7.4 '${column === 'normal' ? '보통' : '최상'}' 기록을 예산 적용 측정으로 판정하면 어떻게 되는지 보여 준다 (참고, 통과 수에 넣지 않음).`),
    );
    parts.push(
      table(
        [
          '등급',
          '보통 평균 (1대)',
          '최상 평균 (1대)',
          '은퇴 기록 중앙값',
          '은퇴 일수 (힘 곡선 / 예산 적용)',
          ...(column === null ? [] : ['예산 적용으로 본 7.4 기록']),
        ],
        loss.grades.map((r) => [
          r.grade,
          trio(r.normalPower, r.normalBudget),
          trio(r.bestPower, r.bestBudget),
          trio(r.medianPower, r.medianBudget),
          `${f1(r.retireDaysPower)} / ${f1(r.retireDaysBudget)}`,
          ...(column === null
            ? []
            : [
                `${mark(r.docEconomyRecordOk)} ${f0(column === 'normal' ? r.normalBudget : r.bestBudget)}층 (목표 ${GRADE_TARGETS[r.grade][column]}층 ±${RECORD_TOLERANCE * 100}%)`,
              ]),
        ]),
      ),
    );
    parts.push(
      table(
        ['일', '가게 최고 기록: 힘 곡선 / 예산 적용 / 잃은 층'],
        loss.curve.map((p) => [`${p.day} (${p.label})`, trio(p.power, p.budget)]),
      ),
    );
  }

  parts.push('### 원정과 방문');
  const rr = m.returnReasons;
  const cr = m.credit;
  parts.push(
    table(
      ['항목', '값'],
      [
        ['귀환 이유', `위험 ${pct(rr.risk)} · 실패 ${pct(rr.failed)} · HP ${pct(rr.hp)} · 내구도 ${pct(rr.durability)} · 12층 ${pct(rr.maxFloors)} · 무뎌짐 ${pct(rr.dull)}`],
        ['한 층도 못 오른 원정', pct(m.zeroFloorExpeditionShare)],
        ['수리 간격 평균', `${f1(m.repairIntervalMeanHours)}시간`],
        ['커리어당 방문 / 무기 구입', `${f1(m.visitsPerCareer)}회 / ${f1(m.weaponsPerCareer)}자루`],
        [
          '무기 구입 중 외상',
          `${pct(cr.purchases ? cr.onCredit / cr.purchases : NaN)} (${cr.onCredit}/${cr.purchases}), ` +
            `첫 방문 구입 중 ${pct(cr.firstVisitPurchases ? cr.firstVisitOnCredit / cr.firstVisitPurchases : NaN)}`,
        ],
        ['은퇴 이유', `정체 ${m.retireReasons.stagnant ?? 0} · 부상 5회 ${m.retireReasons.injuries ?? 0} · 10일 ${m.retireReasons.maxDays ?? 0}`],
        ['마지막 날 명성 / 상인 주재료 구간', `${f0(m.fameEnd)} / ${f1(m.merchantBandEnd)}`],
        ['명성 출처', `첫 돌파 ${pct(m.fameShare.firstClear)} · 탑 기록 갱신 ${pct(m.fameShare.towerRecord)} · 은퇴 ${pct(m.fameShare.retire)}`],
      ],
    ),
  );

  const pop = m.population;
  parts.push('### 인구');
  parts.push(
    table(
      ['항목', '값'],
      [
        ['하루 도착 (신규 / 제자)', `${f1(pop.arrivalsPerDay.rookies)} / ${f1(pop.arrivalsPerDay.disciples)} (제자 ${pct(pop.discipleShare)})`],
        ['신규 등급 비율 (실제)', gradeRow(pop.rookieGrades)],
        ['신규 등급 비율 (6.2 기대)', gradeRow(pop.rookieExpected)],
        ['제자 등급 비율', gradeRow(pop.discipleGrades)],
        ['마지막 날 활동 용사', `${f0(pop.activeEnd)}명 (9.2 단계 기준 ~${f0(pop.activeTarget)}명)`],
        ['활동 용사 등급 비율', gradeRow(pop.activeGrades)],
        ['활동 용사 평균 세대 / 최고 세대', `${f1(pop.activeGenerationMean)} / ${pop.generationMax}`],
        ['활동 용사 중 제자', pct(pop.activeDiscipleShare)],
      ],
    ),
  );

  parts.push('### 가게 최고 기록 곡선');
  parts.push(
    table(
      ['일', '목표', '내 무기 최고', '세계 최고 (모든 무기)'],
      m.curve.map((p) => [`${p.day} (${p.label})`, `~${p.target}`, f0(p.shopRecord), f0(p.worldRecord)]),
    ),
  );

  parts.push('### 명성 단계');
  parts.push(
    table(
      ['단계', '이름', '누적 명성', '목표', '도달'],
      m.fameStages.map((s) => {
        const spec = FAME_STAGES[s.stage - 1];
        return [
          String(s.stage),
          spec?.name ?? '',
          String(spec?.fame ?? ''),
          `${s.range[0]}~${s.range[1]}일`,
          s.day === null ? `미도달 (${s.reachedRuns}/${m.seeds.length})` : `${f1(s.day)}일`,
        ];
      }),
    ),
  );

  const l = m.ledger;
  const outstanding = l.creditOwed - l.creditRepaid - l.creditLost;
  parts.push('### 가게 장부 (참고, 시드 평균)');
  parts.push(
    table(
      [
        '현금 판매',
        '외상 원금',
        '갚을 돈 (웃돈 포함)',
        '회수 (웃돈 포함)',
        '떼임 (웃돈 포함)',
        '남은 외상',
        '수리',
        '못 받은 수리비',
        '예산 무시로 넘긴 몫',
      ],
      [
        [
          f0(l.salesCash),
          f0(l.creditGiven),
          f0(l.creditOwed),
          f0(l.creditRepaid),
          f0(l.creditLost),
          f0(outstanding),
          f0(l.repairIncome),
          f0(l.repairUnpaid),
          f0(l.supplySubsidy),
        ],
      ],
    ),
  );
  return parts.join('\n\n');
}

function fameShare(runs: readonly RunResult[]): { firstClear: number; towerRecord: number; retire: number } {
  const sum = { firstClear: 0, towerRecord: 0, retire: 0 };
  for (const r of runs) for (const e of r.events) if (e.kind === 'fame') sum[e.source] += e.amount;
  const total = sum.firstClear + sum.towerRecord + sum.retire;
  return total > 0
    ? { firstClear: sum.firstClear / total, towerRecord: sum.towerRecord / total, retire: sum.retire / total }
    : sum;
}
