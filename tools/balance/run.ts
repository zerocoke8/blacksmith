// Balance simulator CLI.
//   node tools/balance/run.ts --days 30 --seed 1 --policy matched
// Options:
//   --days N            world days to run (default 30)
//   --seed N            first world seed (default 1)
//   --seeds K           run K seeds (seed, seed+1, ...) and pool the results (default 1)
//   --policy P          none | standard | matched | all (default all)
//   --material M        band | top: which main material the shop hands over (default band)
//   --disciples D       extra | replace: disciples on top of new heroes, or taking their place
//                       (default: data/world.ts DISCIPLES_REPLACE_NEW_HEROES)
//   --credit-slots N    credits open at once, shop-wide (default CREDIT_SLOTS_START = 2;
//                       the 외상 장부 facility goes up to 6)
//   --budget B          doc | ignore. 'ignore' hands every hero the policy weapon whatever
//                       the budget (shortfall written off), to read the power curve (7.4)
//                       apart from the economy. Default doc.
//   --out DIR           JSON output folder (default tools/balance/out)
// Prints a markdown report and writes one JSON per policy.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDIT_SLOTS_START, DISCIPLES_REPLACE_NEW_HEROES } from '../../src/sim/data/world.ts';
import { MATERIAL_RULES, type MaterialRule, POLICY_IDS, type PolicyId } from '../../src/sim/world/supply.ts';
import { buildChecks, computeMetrics, renderMarkdown } from './report.ts';
import { type RunResult, simulate } from './simulate.ts';

interface Args {
  days: number;
  seed: number;
  seeds: number;
  policies: PolicyId[];
  material: MaterialRule;
  disciplesReplace: boolean;
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
  const budget = get('budget') ?? 'doc';
  if (budget !== 'doc' && budget !== 'ignore') throw new Error('--budget must be doc or ignore');
  return {
    days: Math.max(1, int('days', 30)),
    seed: int('seed', 1),
    seeds: Math.max(1, int('seeds', 1)),
    policies: policy === 'all' ? [...POLICY_IDS] : [policy as PolicyId],
    material: material as MaterialRule,
    disciplesReplace: disciples === undefined ? DISCIPLES_REPLACE_NEW_HEROES : disciples === 'replace',
    creditSlots: Math.max(0, int('credit-slots', CREDIT_SLOTS_START)),
    ignoreBudget: budget === 'ignore',
    out: get('out') ?? fileURLToPath(new URL('./out/', import.meta.url)),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = performance.now();
  const sections: string[] = [];
  const summary: string[][] = [];
  mkdirSync(args.out, { recursive: true });

  for (const policy of args.policies) {
    const runs: RunResult[] = [];
    for (let k = 0; k < args.seeds; k++) {
      runs.push(
        simulate({
          seed: args.seed + k,
          days: args.days,
          policy,
          material: args.material,
          rules: {
            disciplesReplaceNewHeroes: args.disciplesReplace,
            creditSlots: args.creditSlots,
            ignoreBudget: args.ignoreBudget,
          },
        }),
      );
    }
    const metrics = computeMetrics(runs);
    const checks = buildChecks(metrics);
    sections.push(renderMarkdown(metrics, checks));
    const judged = checks.filter((c) => c.ok !== null);
    summary.push([
      policy,
      `${judged.filter((c) => c.ok).length}/${judged.length}`,
      checks
        .filter((c) => c.ok === false)
        .map((c) => c.name)
        .slice(0, 6)
        .join(', ') + (checks.filter((c) => c.ok === false).length > 6 ? ' …' : ''),
    ]);

    const variant =
      (args.disciplesReplace ? '-replace' : '') +
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
    `JSON: ${args.out}`,
  ].join('\n');
  process.stdout.write(`${head}\n\n${sections.join('\n\n---\n\n')}\n`);
}

main();
