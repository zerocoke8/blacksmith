import { describe, expect, it } from 'vitest';
import { DAY_MINUTES, RETIRE_AT_DAYS } from '../../src/sim/data/world.ts';
import {
  activeHeroesTarget,
  buildChecks,
  computeMetrics,
  isFirstGeneration,
  quantile,
  renderMarkdown,
} from './report.ts';
import { simulate } from './simulate.ts';
import { MID_GROWTH } from './targets.ts';

describe('balance report', () => {
  it('runs a short world for each policy and renders a report', () => {
    for (const policy of ['none', 'standard', 'matched'] as const) {
      const runs = [1, 2].map((seed) => simulate({ seed, days: 12, policy, material: 'band' }));
      const m = computeMetrics(runs);
      const checks = buildChecks(m);
      const md = renderMarkdown(m, checks);
      expect(m.careers).toBeGreaterThan(0);
      expect(checks.length).toBeGreaterThan(5);
      expect(md).toContain(`정책 \`${policy}\``);
      if (policy === 'none') expect(checks.filter((c) => c.group.startsWith('커리어 최고층'))).toHaveLength(0);
      else expect(checks.filter((c) => c.group.startsWith('커리어 최고층'))).toHaveLength(5);
      expect(checks.some((c) => c.group.startsWith('인구') && c.ok !== null)).toBe(policy !== 'none');
    }
  });

  it('judges 7.4 on first-generation heroes only and shows disciples apart', () => {
    const days = 16;
    const run = simulate({ seed: 1, days, policy: 'standard', material: 'band' });
    const m = computeMetrics([run]);
    const last = (days - RETIRE_AT_DAYS - 1) * DAY_MINUTES;
    const retired = run.world.careers.filter((c) => c.arrivedAt <= last && c.end === 'retired');
    let disciples = 0;
    for (const g of m.grades) {
      const mid = retired.filter((c) => c.grade === g.grade && c.growth >= MID_GROWTH[0] && c.growth <= MID_GROWTH[1]);
      expect(g.midGrowthCount).toBe(mid.filter(isFirstGeneration).length);
      expect(g.discipleMidCount).toBe(mid.length - g.midGrowthCount);
      disciples += g.discipleMidCount;
    }
    expect(disciples).toBeGreaterThan(0);
    expect(isFirstGeneration({ generation: 1, inherited: [] })).toBe(true);
    expect(isFirstGeneration({ generation: 2, inherited: ['luck'] })).toBe(false);
  });

  it('judges retirement days on the doc range with half a day of slack, both ends inclusive', () => {
    const m = computeMetrics([simulate({ seed: 1, days: 12, policy: 'standard', material: 'band' })]);
    const nCheck = (days: number) => {
      const grades = m.grades.map((g) => (g.grade === 'N' ? { ...g, retireDaysMedian: days } : g));
      return buildChecks({ ...m, grades }).find((c) => c.name.startsWith('N급 커리어 일수'))?.ok;
    };
    expect(nCheck(2.5)).toBe(true);
    expect(nCheck(4.5)).toBe(true); // N 3~4일
    expect(nCheck(4.6)).toBe(false);
    expect(nCheck(2.4)).toBe(false);
  });

  it('takes the 9.2 active-hero target from the fame stage', () => {
    expect(activeHeroesTarget(1)).toBe(30);
    expect(activeHeroesTarget(4)).toBe(75);
    expect(activeHeroesTarget(7)).toBe(135);
    expect(activeHeroesTarget(9)).toBe(135); // ★n keeps the stage-7 value
  });

  it('interpolates quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([5], 0.9)).toBe(5);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });
});
