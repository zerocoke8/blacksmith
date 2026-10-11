// 육성 한 판 측정기 (기획서 13.7.1 첫 감을 다시 잰다, 16.3의 11~19번).
//   node tools/run/measure.ts                 성급 1~5 × 단순 봇 (13.7.1 그대로) · 늦게 짓는 단순 봇 · 계획 봇,
//                                             판마다 실제 카드 판 (단순 카드 봇)
//   node tools/run/measure.ts --quick         단조 간이 모드 (카드 퍼즐 대신 봇이 ★3을 정한다)
//   node tools/run/measure.ts --smart         단조를 따져 보는 카드 봇으로 친다 (느리다; 판 수를 줄인다)
// Options:
//   --runs N        판 수 per 성급 × 봇 (default 200; --smart 30)
//   --seed S        first 판 시드 (default 1). Run i uses S + i, the same for every bot and 성급.
//   --stars 1,2,5   성급 to measure (default 1,2,3,4,5)
//   --family id     주인공 가문 (vail, nea, odel, aren, isol; default aren = 13.18 예시)
//   --ancestor      주 선대의 ★3 무기 (연격)로 시작한다 (13.7.1의 가정). Default: 첫 판 (기본 무기)
//   --wall tight|default|loose, --death, --events X, --turns N   [검증] 실험 스위치
//   --hand N        판 손패 (기획서 5)
//   --late-gold X   31층부터 층 수입 배율 (기획서 1)
//   --bots a,b      봇만 골라 잰다 (simple, simpleLate, planner; default 셋 다)
// Prints markdown: where runs stop, forges, grades, actions, gold, events, the 줄다리기 지표,
// then the doc's targets with ✓/✗.

import { performance } from 'node:perf_hooks';
import { makeSmartBot, simpleBot } from '../cards/bots.ts';
import { FAMILIES, type FamilyId, isFamilyId } from '../../src/sim/data/families.ts';
import {
  DEFAULT_RUN_RULES,
  LATE_GOLD_FROM_FLOOR,
  RUN_TURNS,
  type Star,
  STARS,
  WALL_PRESET_LABEL,
  WALL_PRESETS,
  type WallPreset,
} from '../../src/sim/data/run.ts';
import { resolveRunRules, type RunRules } from '../../src/sim/run/index.ts';
import { makeRunBot, RUN_BOT_NAME, type RunBotId, SIMPLE_FORGE_LEAD } from './bots.ts';
import { defaultCompanions, reportLines, type Row, runConfig, sampleAncestor, summarize } from './report.ts';

interface Args {
  runs: number;
  seed: number;
  stars: Star[];
  family: FamilyId;
  ancestor: boolean;
  smart: boolean;
  bots: RunBotId[];
  rules: Partial<RunRules>;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const num = (name: string, fallback: number): number => {
    const raw = get(name);
    if (raw === undefined) return fallback;
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new Error(`--${name} needs a number, got ${raw}`);
    return v;
  };
  const smart = argv.includes('--smart');
  const stars = (get('stars') ?? '1,2,3,4,5').split(',').map(Number) as Star[];
  if (!stars.every((s) => STARS.includes(s))) throw new Error('--stars takes 1~5');
  const family = get('family') ?? 'aren';
  if (!isFamilyId(family)) throw new Error(`--family: one of ${Object.keys(FAMILIES).join(', ')}`);
  const wall = get('wall') ?? 'default';
  if (!(WALL_PRESETS as readonly string[]).includes(wall)) throw new Error(`--wall: ${WALL_PRESETS.join(', ')}`);
  const bots = (get('bots') ?? 'simple,simpleLate,planner').split(',') as RunBotId[];
  if (!bots.every((b) => b in RUN_BOT_NAME)) throw new Error(`--bots: ${Object.keys(RUN_BOT_NAME).join(', ')}`);
  return {
    runs: Math.max(1, Math.floor(num('runs', smart ? 30 : 200))),
    seed: Math.floor(num('seed', 1)),
    stars,
    family,
    ancestor: argv.includes('--ancestor'),
    smart,
    bots,
    rules: {
      turns: Math.floor(num('turns', RUN_TURNS)),
      wallPreset: wall as WallPreset,
      deathMode: argv.includes('--death') ? 'death' : 'severe',
      eventRate: num('events', 1),
      quickForge: argv.includes('--quick'),
      handSize: Math.floor(num('hand', DEFAULT_RUN_RULES.handSize)),
      lateGoldRate: num('late-gold', DEFAULT_RUN_RULES.lateGoldRate),
    },
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const cardBot = args.smart ? makeSmartBot() : simpleBot;
  const rows: Row[] = [];
  for (const id of args.bots) {
    for (const star of args.stars) {
      const bot = makeRunBot(id);
      const t0 = performance.now();
      const samples = runConfig({
        bot,
        cardBot,
        family: args.family,
        star,
        companions: defaultCompanions(args.family, star),
        ancestor: args.ancestor ? sampleAncestor(args.family) : null,
        runs: args.runs,
        seed: args.seed,
        rules: args.rules,
        maxCraftTurns: 40,
      });
      rows.push({ label: `${bot.name} ${star}성`, bot, star, summary: summarize(samples, args.rules.turns ?? RUN_TURNS) });
      process.stderr.write(`${bot.name} ${star}성: ${((performance.now() - t0) / 1000).toFixed(1)}s\n`);
    }
  }
  const fam = FAMILIES[args.family];
  const rules = resolveRunRules(args.rules);
  const comp = defaultCompanions(args.family, 1)
    .map((c) => FAMILIES[c.family].name)
    .join(' · ');
  const forge = args.rules.quickForge ? '단조 간이 모드 (봇이 ★3을 정한다)' : `카드 판을 ${cardBot.name}이 친다`;
  const lines = reportLines({
    rows,
    turns: args.rules.turns ?? RUN_TURNS,
    title: '육성 한 판 측정 (1시즌 재의 악마의 탑)',
    notes: [
      `주인공 ${fam.name} (${fam.emoji}, 무기 ${fam.weapon}), 동료 ${comp} (보유 둘은 주인공과 같은 성급, 시즌 가문은 1성으로 빌림)`,
      `${args.ancestor ? '주 선대의 ★3 역작 무기 (연격)로 시작' : '첫 판: 선대 없이 기본 무기 (★1 무속성 철)로 시작'}, 덱은 1일차 덱 + 해금 카드 6장 (시즌 상한)`,
      `${forge}. 성급 × 봇마다 ${args.runs}판, 판 시드 ${args.seed}~${args.seed + args.runs - 1}`,
      `규칙: ${rules.turns}턴, 벽 일정 ${WALL_PRESET_LABEL[rules.wallPreset]}, 판 안의 사망 ${rules.deathMode === 'death' ? '사망' : '중상'}, 사건 빈도 ×${rules.eventRate}, 손패 ${rules.handSize}, ${LATE_GOLD_FROM_FLOOR}층부터 층 수입 ×${rules.lateGoldRate}`,
      `단순 봇은 13.7.1 단순 규칙 그대로 (새 주재료와 돈 → 단조, 내구도 40% 아래 → 정비, HP 55% 아래 → 휴식, 나머지 보통 원정). 늦게 짓는 단순 봇은 새 주재료가 풀려도 다음 벽 마감 ${SIMPLE_FORGE_LEAD}턴 안에서만 짓는다 (첫 측정의 단순 봇, 비교용)`,
      '판 시간 = 준비 90초 + 원정 25초 + 단조 60·90·120초 (기본·고급·전설) + 정비·휴식·교류 12초 + 사건 15초 + 판 끝 90초 (13.4.1 시간 감)',
      '줄다리기 지표: 연속한 두 자유 턴(벽 도전·마지막 등반·중상 휴식 제외)의 행동이 다른 비율, 같은 턴의 판들 사이 행동 엔트로피 (0 = 모두 같음, 1 = 5종이 고르게)',
    ],
  });
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
