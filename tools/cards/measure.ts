// 카드 제작 측정기 (기획서 4.2.1 초벌 측정, 4.9, 16.2의 11번, 16.3의 1~5·10번).
//   node tools/cards/measure.ts            기본 측정 세트
//   node tools/cards/measure.ts --quick    판 수를 줄여 빠르게
//   node tools/cards/measure.ts --all      [검증] 비교 세트까지 (다시 달구기 −1·−3·0, 화로 잔잔함·요동, 식는 쇠 + 내구도, …)
//   node tools/cards/measure.ts --legend   전설 세트 (대보스 재료 8종, 내구도 60·55·50, 다시 달구기 −3)
// Options:
//   --simple N      games per set for the 단순 봇 (default 4000; --quick 600)
//   --smart N       games per set for the 따져 보는 봇 (default 1000; --quick 150)
//   --seed S        world seed (default 1). Game i uses craft number i, the same for both bots.
//   --max-turns N   a bot craft is stopped (and failed) past this turn (default 40)
//   --only a,b      run only these set ids
// Prints markdown: one table of results, each card's play share, then the doc's targets with ✓/✗.
// The sets and the statistics are in sets.ts.

import { performance } from 'node:perf_hooks';
import { makeSmartBot, SMART_BOT_DEFAULTS, simpleBot } from './bots.ts';
import { checkSetDeck, reportLines, runSet, type SetGroup, SETS, type SetResult, summarize } from './sets.ts';

interface Args {
  simple: number;
  smart: number;
  seed: number;
  maxTurns: number;
  groups: SetGroup[];
  only: string[] | null;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const quick = argv.includes('--quick');
  const int = (name: string, fallback: number): number => {
    const raw = get(name);
    if (raw === undefined) return fallback;
    const v = Number.parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 1) throw new Error(`--${name} needs a positive number, got ${raw}`);
    return v;
  };
  const only = get('only');
  const groups: SetGroup[] = ['core'];
  if (argv.includes('--all')) groups.push('all');
  if (argv.includes('--legend')) groups.push('legend');
  return {
    simple: int('simple', quick ? 600 : 4000),
    smart: int('smart', quick ? 150 : 1000),
    seed: int('seed', 1),
    maxTurns: int('max-turns', SMART_BOT_DEFAULTS.maxTurns),
    groups,
    only: only === undefined ? null : only.split(','),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sets = SETS.filter((s) => (args.only ? args.only.includes(s.id) : args.groups.includes(s.group)));
  const unknown = (args.only ?? []).filter((id) => !SETS.some((s) => s.id === id));
  if (unknown.length > 0) throw new Error(`unknown set ids: ${unknown.join(', ')}`);
  const smart = makeSmartBot({ maxTurns: args.maxTurns });
  const results = new Map<string, SetResult>();
  for (const set of sets) {
    checkSetDeck(set);
    const t0 = performance.now();
    const simpleStats = summarize(runSet(set, simpleBot, args.simple, args.seed, args.maxTurns));
    const smartGames = Math.max(20, Math.round(args.smart * (set.smartScale ?? 1)));
    const smartStats = summarize(runSet(set, smart, smartGames, args.seed, args.maxTurns));
    results.set(set.id, { simple: simpleStats, smart: smartStats });
    const timeouts = simpleStats.timedOut + smartStats.timedOut;
    process.stderr.write(
      `${set.id}: ${((performance.now() - t0) / 1000).toFixed(1)}s${timeouts > 0 ? ` (턴 상한에 걸린 판 ${timeouts})` : ''}\n`,
    );
  }
  const lines = reportLines(
    { sets, results, simpleGames: args.simple, smartGames: args.smart, seed: args.seed, maxTurns: args.maxTurns },
    smart.name,
    simpleBot.name,
  );
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
