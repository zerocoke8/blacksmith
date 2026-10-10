import { describe, expect, it } from 'vitest';
import { DAY_MINUTES, RETIRE_AT_DAYS } from '../../src/sim/data/world.ts';
import {
  activeHeroesTarget,
  buildChecks,
  type Check,
  computeMetrics,
  economyLoss,
  isFirstGeneration,
  quantile,
  renderMarkdown,
} from './report.ts';
import { clearChance } from '../../src/sim/world/combat.ts';
import { createPolicy } from '../../src/sim/world/supply.ts';
import { advanceWorld, createWorld } from '../../src/sim/world/world.ts';
import {
  careerDayOf,
  expeditionCandidates,
  fixedSHeroId,
  fixedSRoll,
  renderCareer,
  renderExpedition,
  traceCareer,
  traceExpedition,
} from './examples.ts';
import { simulate } from './simulate.ts';
import { EXPEDITIONS_PER_DAY, FLOORS_PER_DAY, GRADE_TARGETS, MID_GROWTH, RECORD_TOLERANCE } from './targets.ts';

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

  it('judges 7.4 on the power-curve run and shows the economy gap apart', () => {
    const budget = computeMetrics([simulate({ seed: 1, days: 12, policy: 'standard', material: 'band' })]);
    const power = computeMetrics([
      simulate({ seed: 1, days: 12, policy: 'standard', material: 'band', rules: { ignoreBudget: true } }),
    ]);
    expect(power.ignoreBudget).toBe(true);
    // Make the two runs' 7.4 numbers unmistakable.
    const marked = { ...power, grades: power.grades.map((g) => ({ ...g, midGrowthMean: 999, newFloorsPerDay: 77, retireDaysMedian: 3 })) };
    const checks = buildChecks(budget, marked);
    const sevenFour = checks.filter((c) => c.group.includes('7.4'));
    expect(sevenFour.length).toBe(15); // 보통, 하루 새 층, 은퇴 시점 × 5 grades
    for (const c of sevenFour) expect(c.group).toContain('예산 무시');
    expect(checks.find((c) => c.name.startsWith('B급 보통'))?.actual).toBe('999층');
    expect(checks.find((c) => c.name.startsWith('B급 기록 ÷'))?.actual).toBe('77.0층');
    expect(checks.find((c) => c.name.startsWith('N급 커리어 일수'))?.actual).toBe('3.0일');
    // Everything else stays on the doc-economy run.
    const own = buildChecks(budget);
    const rest = (cs: Check[]) => cs.filter((c) => !c.group.includes('7.4')).map((c) => [c.name, c.actual, c.ok]);
    expect(rest(checks)).toEqual(rest(own));

    const loss = economyLoss(budget, power);
    expect(loss.grades.map((r) => r.grade)).toEqual(['N', 'C', 'B', 'A', 'S']);
    for (const r of loss.grades) {
      const b = budget.grades.find((g) => g.grade === r.grade);
      const p = power.grades.find((g) => g.grade === r.grade);
      expect([r.normalBudget, r.normalPower]).toEqual([b?.midGrowthMean, p?.midGrowthMean]);
      // What the old judging (7.4 on the doc-economy run) would say, shown for reference.
      const target = GRADE_TARGETS[r.grade].normal;
      const v = b?.midGrowthMean ?? Number.NaN;
      expect(r.docEconomyRecordOk).toBe(v >= target * (1 - RECORD_TOLERANCE) && v <= target * (1 + RECORD_TOLERANCE));
    }
    expect(economyLoss({ ...budget, policy: 'none' }, power).grades.every((r) => r.docEconomyRecordOk === null)).toBe(true);
    expect(loss.curve.map((p) => p.day)).toEqual(budget.curve.map((p) => p.day));
    const md = renderMarkdown(budget, checks, power);
    expect(md).toContain('### 경제 손실 (판정 아님)');
    expect(md).toContain('예산 적용으로 본 7.4 기록');
    expect(renderMarkdown(budget, own)).not.toContain('경제 손실');
  });

  it('judges departures and cleared floors per day on the new targets', () => {
    expect(FLOORS_PER_DAY).toEqual({ target: 20, range: [16, 24] });
    expect(EXPEDITIONS_PER_DAY).toEqual({ target: 4, range: [3.5, 4.5] });
    const m = computeMetrics([simulate({ seed: 1, days: 12, policy: 'standard', material: 'band' })]);
    const at = (floorsPerDay: number, expeditionsPerDay: number) => {
      const checks = buildChecks({ ...m, floorsPerDay, expeditionsPerDay });
      return [
        checks.find((c) => c.name.startsWith('하루 돌파 층수'))?.ok,
        checks.find((c) => c.name.startsWith('하루 출발'))?.ok,
      ];
    };
    expect(at(16, 3.5)).toEqual([true, true]);
    expect(at(24, 4.5)).toEqual([true, true]);
    expect(at(15.9, 3.4)).toEqual([false, false]);
    expect(at(24.1, 4.6)).toEqual([false, false]);
  });

  it('reports the disciple chance and the share of disciples among active heroes', () => {
    const m = computeMetrics([
      simulate({ seed: 1, days: 12, policy: 'standard', material: 'band', rules: { discipleChance: 0 } }),
    ]);
    expect(m.discipleChance).toBe(0);
    expect(m.population.discipleShare).toBe(0);
    expect(m.population.activeDiscipleShare).toBe(0);
    expect(renderMarkdown(m, buildChecks(m))).toContain('제자 확률 0%');
  });

  it('rebuilds a 7.11 expedition floor by floor from the real world', () => {
    const cand = expeditionCandidates('matched', [1, 2, 3], {}).next();
    expect(cand.done).toBe(false);
    if (cand.done === true) return;
    const t = traceExpedition(cand.value.pick, 'matched');
    expect(t.startFloor).toBe(31);
    expect(t.rows.map((r) => r.floor)).toEqual(t.rows.map((_, i) => 31 + i));
    expect(t.rows.slice(0, -1).every((r) => r.cleared)).toBe(true);
    expect(t.rows[t.rows.length - 1]?.cleared).toBe(false);
    expect(t.reason).toBe('failed');
    for (const r of t.rows) expect(r.chance).toBeCloseTo(clearChance(r.r), 12);
    for (let i = 1; i < t.rows.length; i++) {
      expect(t.rows[i]?.hpAtEntry).toBeCloseTo(t.rows[i - 1]?.hpAfter ?? 0, 12);
      expect(t.rows[i]?.durabilityAfter ?? 0).toBeLessThan(t.rows[i - 1]?.durabilityAfter ?? 0);
    }
    const md = renderExpedition(t);
    expect(md).toContain('| 층 | 적 | R | 돌파 확률 | 결과 | HP | 내구도 |');
    expect(md.split('\n').filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(t.rows.length);
  });

  it('rebuilds a 6.6 career timeline for the fixed S-grade hero', () => {
    const roll = fixedSRoll(1);
    const t = traceCareer({ seed: 1, heroId: fixedSHeroId(1) }, 'matched');
    expect(t.hero.grade).toBe('S');
    expect(t.hero.weaponType).toBe(roll.weaponType);
    expect(t.hero.arrivedAt).toBe(DAY_MINUTES);
    const end = t.events.find((e) => e.kind === 'retire' || e.kind === 'death');
    expect(end).toBeDefined();
    const md = renderCareer(t, '#### ② S급');
    expect(md).toContain('| 경력 | 무슨 일 | 기록 |');
    const rows = md.split('\n').filter((l) => /^\| \d+일 \|/.test(l));
    expect(rows.length).toBe(Math.floor(((end?.at ?? 0) - t.hero.arrivedAt) / DAY_MINUTES) + 1);
    expect(rows[0]).toContain('첫 방문');
    expect(rows[rows.length - 1]).toContain(`${t.hero.record}층`);

    // Stepping to the hero's own events changes nothing (3.6): same events as one uninterrupted run.
    const whole = advanceWorld(createWorld(1), end?.at ?? 0, createPolicy('matched'));
    expect(t.events).toEqual(whole.filter((e) => 'heroId' in e && e.heroId === t.hero.id));

    // An expedition sits on the row of the day it comes back, departure and records included,
    // and the row's 기록 is the record right after its last return.
    const dayOf = careerDayOf(t);
    const departDay = new Map<number, number>();
    const lastRecord = new Map<number, number>();
    let underway = 0;
    for (const e of t.events) {
      if (e.kind === 'depart') {
        departDay.set(e.expeditionNo, dayOf(e));
        underway = e.expeditionNo;
      } else if (e.kind === 'record') {
        expect(dayOf(e)).toBe(departDay.get(underway));
      } else if (e.kind === 'return') {
        expect(dayOf(e)).toBe(departDay.get(e.expeditionNo));
        expect(t.snaps.find((s) => s.at === e.at)?.record).toBe(e.record);
        lastRecord.set(dayOf(e), e.record);
      }
    }
    expect(lastRecord.size).toBeGreaterThan(3);
    for (const [d, record] of lastRecord) expect(rows[d - 1]).toMatch(new RegExp(`\\| ${record}층 · 힘 [0-9.]+ \\|$`));
  });

  it('takes the 9.2 active-hero target from the fame stage', () => {
    expect(activeHeroesTarget(1)).toBe(30);
    expect(activeHeroesTarget(4)).toBe(85);
    expect(activeHeroesTarget(7)).toBe(170);
    expect(activeHeroesTarget(9)).toBe(170); // ★n keeps the stage-7 value
  });

  it('interpolates quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([5], 0.9)).toBe(5);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });
});
