// Balance simulator CLI.
//   node tools/balance/run.ts --days 30 --seed 1 --policy matched
// Options:
//   --days N              world days to run (default 30)
//   --seed N              first world seed (default 1)
//   --seeds K             run K seeds (seed, seed+1, ...) and pool the results (default 1)
//   --policy P            none | standard | matched | all (default all)
//   --material M          band | top: which main material the shop hands over (default band)
//   --disciples D         extra | replace: disciples on top of new heroes, or taking their place
//                         (default: data/world.ts DISCIPLES_REPLACE_NEW_HEROES)
//   --disciple-chance p   0~1: chance that a retired hero's disciple comes at all
//                         (default: the game rule, hearts × 20%). Works with --disciples.
//   --credit-slots N      credits open at once, shop-wide (default CREDIT_SLOTS_START = 2;
//                         the 외상 장부 facility goes up to 6)
//   --budget B            doc | ignore. 'doc' (default) runs the doc's economy and, for the
//                         policies that sell, the same seeds again with the budget ignored:
//                         the 7.4 rows are judged on that power-curve run and the gap is shown
//                         as '경제 손실'. 'ignore' runs only the power-curve measurement.
//   --out DIR             JSON output folder (default tools/balance/out)
// Prints a markdown report and writes one JSON per policy.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDIT_SLOTS_START, DISCIPLES_REPLACE_NEW_HEROES } from '../../src/sim/data/world.ts';
import { MATERIAL_RULES, type MaterialRule, POLICY_IDS, type PolicyId } from '../../src/sim/world/supply.ts';
import type { WorldRules } from '../../src/sim/world/types.ts';
import { buildChecks, computeMetrics, type Metrics, renderMarkdown } from './report.ts';
import { type RunResult, simulate } from './simulate.ts';

interface Args {
  days: number;
  seed: number;
  seeds: number;
  policies: PolicyId[];
  material: MaterialRule;
  disciplesReplace: boolean;
  discipleChance: number | null;
  creditSlots: number;
  ignoreBudget: boolean;
  out: string;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const int = (name: string, fallback: number): number => {
    const raw = get(name);
    if (raw === undefined) return fallback;
    const v = Number.parseInt(raw, 10);
    if (!Number.isFinite(v)) throw new Error(`--${name} needs a number, got ${raw}`);
    return v;
  };
  const policy = get('policy') ?? 'all';
  if (policy !== 'all' && !(POLICY_IDS as readonly string[]).includes(policy)) {
    throw new Error(`--policy must be one of ${POLICY_IDS.join(', ')}, all`);
  }
  const material = get('material') ?? 'band';
  if (!(MATERIAL_RULES as readonly string[]).includes(material)) {
    throw new Error(`--material must be one of ${MATERIAL_RULES.join(', ')}`);
  }
  const disciples = get('disciples');
  if (disciples !== undefined && disciples !== 'extra' && disciples !== 'replace') {
    throw new Error('--disciples must be extra or replace');
  }
  const chanceRaw = get('disciple-chance');
  const discipleChance = chanceRaw === undefined ? null : Number(chanceRaw);
  if (discipleChance !== null && (!Number.isFinite(discipleChance) || discipleChance < 0 || discipleChance > 1)) {
    throw new Error(`--disciple-chance needs a number from 0 to 1, got ${chanceRaw}`);
  }
  const budget = get('budget') ?? 'doc';
  if (budget !== 'doc' && budget !== 'ignore') throw new Error('--budget must be doc or ignore');
  return {
    days: Math.max(1, int('days', 30)),
    seed: int('seed', 1),
    seeds: Math.max(1, int('seeds', 1)),
    policies: policy === 'all' ? [...POLICY_IDS] : [policy as PolicyId],
    material: material as MaterialRule,
    disciplesReplace: disciples === undefined ? DISCIPLES_REPLACE_NEW_HEROES : disciples === 'replace',
    discipleChance,
    creditSlots: Math.max(0, int('credit-slots', CREDIT_SLOTS_START)),
    ignoreBudget: budget === 'ignore',
    out: get('out') ?? fileURLToPath(new URL('./out/', import.meta.url)),
  };
}

function runSeeds(args: Args, policy: PolicyId, ignoreBudget: boolean): RunResult[] {
  const rules: Partial<WorldRules> = {
    disciplesReplaceNewHeroes: args.disciplesReplace,
    discipleChance: args.discipleChance,
    creditSlots: args.creditSlots,
    ignoreBudget,
  };
  const runs: RunResult[] = [];
  for (let k = 0; k < args.seeds; k++) {
    runs.push(simulate({ seed: args.seed + k, days: args.days, policy, material: args.material, rules }));
  }
  return runs;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = performance.now();
  const sections: string[] = [];
  const summary: string[][] = [];
  mkdirSync(args.out, { recursive: true });

  for (const policy of args.policies) {
    const runs = runSeeds(args, policy, args.ignoreBudget);
    const metrics = computeMetrics(runs);
    // 7.4 is the power curve with the weapon on time. 'none' never sells, so the budget changes nothing there.
    const power: Metrics =
      !args.ignoreBudget && policy !== 'none' ? computeMetrics(runSeeds(args, policy, true)) : metrics;
    const checks = buildChecks(metrics, power);
    sections.push(renderMarkdown(metrics, checks, power));
    const judged = checks.filter((c) => c.ok !== null);
    const failed = checks.filter((c) => c.ok === false);
    summary.push([
      policy,
      `${judged.filter((c) => c.ok).length}/${judged.length}`,
      failed
        .map((c) => c.name)
        .slice(0, 6)
        .join(', ') + (failed.length > 6 ? ' …' : ''),
    ]);

    const variant =
      (args.disciplesReplace ? '-replace' : '') +
      (args.discipleChance !== null ? `-dc${args.discipleChance}` : '') +
      (args.creditSlots !== CREDIT_SLOTS_START ? `-credit${args.creditSlots}` : '') +
      (args.ignoreBudget ? '-nobudget' : '');
    const tag = `${policy}-${args.material}${variant}-d${args.days}-s${args.seed}x${args.seeds}`;
    const file = join(args.out, `${tag}.json`);
    writeFileSync(
      file,
      JSON.stringify(
        {
          args: { ...args, policies: [policy] },
          metrics,
          powerMetrics: power === metrics ? null : power,
          checks,
          runs: runs.map((r) => ({ config: r.config, daily: r.daily, careers: r.world.careers })),
        },
        null,
        1,
      ),
    );
  }

  const elapsed = (performance.now() - started) / 1000;
  const head = [
    `# 밸런스 시뮬레이션 (${args.days}일, 시드 ${args.seed}${args.seeds > 1 ? `~${args.seed + args.seeds - 1}` : ''}, ${elapsed.toFixed(1)}초)`,
    '',
    '| 정책 | 통과 | 어긋난 항목 (앞 6개) |',
    '| --- | --- | --- |',
    ...summary.map((r) => `| ${r.join(' | ')} |`),
    '',
    args.ignoreBudget
      ? '예산 무시 측정만 돌렸다 (힘 곡선).'
      : '7.4 판정은 같은 시드의 예산 무시 측정(힘 곡선)으로, 나머지는 기획서 경제로 판정한다.',
    `JSON: ${args.out}`,
  ].join('\n');
  process.stdout.write(`${head}\n\n${sections.join('\n\n---\n\n')}\n`);
}

main();
