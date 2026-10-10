// Balance targets copied from 기획서. These are what the report checks against,
// not tuning inputs (those live in src/sim/data).

import type { Grade } from '../../src/sim/core/types.ts';

export interface GradeTarget {
  /** 7.4 '보통': mid growth, ★3 weapon of the band. */
  normal: number;
  /** 7.4 '최상': growth 100%, well-matched weapon. */
  best: number;
  /** 7.4 '하루 새 층 (평균)'. */
  newFloorsPerDay: number;
  /**
   * 7.4 '은퇴 시점' as career length in days, [min, max] as written in the doc
   * ('약 7일' = [7, 7]). Judged with RETIRE_DAYS_TOLERANCE on both ends.
   */
  retireDays: readonly [number, number];
}

export const GRADE_TARGETS: Record<Grade, GradeTarget> = {
  N: { normal: 19, best: 38, newFloorsPerDay: 5, retireDays: [3, 4] },
  C: { normal: 27, best: 47, newFloorsPerDay: 6, retireDays: [4, 5] },
  B: { normal: 37, best: 60, newFloorsPerDay: 6, retireDays: [6, 7] },
  A: { normal: 53, best: 78, newFloorsPerDay: 8, retireDays: [7, 7] },
  S: { normal: 77, best: 103, newFloorsPerDay: 10, retireDays: [7, 8] },
};

/** Half a day either side of the 7.4 retirement range. */
export const RETIRE_DAYS_TOLERANCE = 0.5;

/** A record within ±15% of the table counts as on target. */
export const RECORD_TOLERANCE = 0.15;
/** 하루 새 층 within ±30%. */
export const NEW_FLOORS_TOLERANCE = 0.3;

/** Growth windows used to pick the '보통' and '최상' heroes out of the crowd. */
export const MID_GROWTH: readonly [number, number] = [0.55, 0.75];
export const TOP_GROWTH_MIN = 0.9;

/** 6.3 / 7.9: about 20% of a one-week career die. */
export const DEATH_RATE_RANGE: readonly [number, number] = [0.15, 0.25];
/** 6.3: 3~4 injuries per career. */
export const INJURIES_RANGE: readonly [number, number] = [3, 4];
/** 7.9: about 17 failures per career. */
export const FAILURES_RANGE: readonly [number, number] = [13, 21];
/** 3.4 / 7.12: repair every 10~14 hours. */
export const REPAIR_HOURS_RANGE: readonly [number, number] = [10, 14];
/** 10장: 24~36 cleared floors per day. */
export const FLOORS_PER_DAY_RANGE: readonly [number, number] = [24, 36];
/** 3.4: 3~4 departures per day. */
export const EXPEDITIONS_PER_DAY_RANGE: readonly [number, number] = [3, 4];

/** 3.7: shop best record (our weapons). Checked at these days, ±20%. */
export const SHOP_RECORD_CURVE: readonly { day: number; floor: number; label: string }[] = [
  { day: 1, floor: 12, label: '1일차' },
  { day: 3, floor: 30, label: '2~3일차' },
  { day: 7, floor: 50, label: '1주' },
  { day: 14, floor: 65, label: '2주' },
  { day: 28, floor: 85, label: '3~4주' },
  { day: 42, floor: 100, label: '6주' },
  { day: 90, floor: 130, label: '3달' },
];
export const SHOP_RECORD_TOLERANCE = 0.2;

/** 9.2 '활동 용사' by fame stage 1~7 (★n stages keep the stage-7 value). */
export const ACTIVE_HEROES_BY_STAGE: readonly number[] = [30, 45, 60, 75, 95, 115, 135];
/** The doc gives these as '~N'; ±25% counts as on target. */
export const ACTIVE_HEROES_TOLERANCE = 0.25;

/** 3.7 / 9.2: day each fame stage should be reached, [min, max]. */
export const FAME_STAGE_DAYS: readonly { stage: number; range: readonly [number, number]; label: string }[] = [
  { stage: 2, range: [0, 1.5], label: '1일차' },
  { stage: 3, range: [1.5, 3.5], label: '2~3일차' },
  { stage: 4, range: [5.5, 8.5], label: '1주' },
  { stage: 5, range: [11, 17], label: '2주' },
  { stage: 6, range: [19, 30], label: '3~4주' },
  { stage: 7, range: [50, 70], label: '2달' },
];
