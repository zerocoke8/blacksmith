// 스테이지 측정기 (기획서 6.4, 6.7, 16장의 11·12·22번): where does a formation stop climbing?
//   node tools/stage/measure.ts                 levels × weapon quality, floors 1~100
//   node tools/stage/measure.ts --team special  five specials instead of five normals
//   node tools/stage/measure.ts --tier 1        every weapon stays iron (band 1) instead of following the floor's band
//   node tools/stage/measure.ts --crit gauge    crits on a fixed count, no luck (the default is CRIT_MODE: 'roll', from
//                                               the battle seed, 사용자 결정 2026-10-14; one seed is one draw, try --seed)
//   node tools/stage/measure.ts --star 10       every hero at this star index (0 = 동별 1, 15 = 달 1 금색, 20 = 해 1 빨강)
//   node tools/stage/measure.ts --element match weapons carry the floor's weak element (속성 유리 every floor)
//   node tools/stage/measure.ts --daily         the daily boss instead: highest stage killed per day of the turn
// Options: --max N (top floor, default 100), --seed S (battle seed, default 1).
// Each cell is the first floor the formation loses (it stays on the floor below), with how it lost:
// t = time ran out (30 s), w = everyone down. '>N' = climbed all the way.

import { BEATS, bandOf, ELEMENT_LABEL } from '../../src/sim/data/common.ts';
import { CRIT_MODE, type CritMode } from '../../src/sim/data/battle.ts';
import { type HeroKey, heroSpec, STAR_STEP_COPIES } from '../../src/sim/data/heroes.ts';
import type { Element, QualityTier } from '../../src/sim/core/types.ts';
import { DAILY_BOSSES, monsterSpec } from '../../src/sim/data/monsters.ts';
import { climbDaily, newDailyState } from '../../src/sim/daily/index.ts';
import { type HeroesState, newHeroesState, type WeaponItem } from '../../src/sim/hero/index.ts';
import { challengeNextFloor, type Formation, floorLayout, newStageProgress, type StageProgress } from '../../src/sim/stage/index.ts';

interface Args {
  team: 'normal' | 'special';
  tier: number | 'band';
  crit: CritMode;
  star: number;
  element: 'none' | 'match';
  daily: boolean;
  max: number;
  seed: number;
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
    if (!Number.isFinite(v) || v < 0) throw new Error(`--${name} needs a number, got ${raw}`);
    return v;
  };
  const tierRaw = get('tier');
  return {
    team: get('team') === 'special' ? 'special' : 'normal',
    tier: tierRaw === undefined ? 'band' : int('tier', 1),
    crit: get('crit') === 'roll' ? 'roll' : get('crit') === 'gauge' ? 'gauge' : CRIT_MODE,
    star: int('star', 0),
    element: get('element') === 'match' ? 'match' : 'none',
    daily: argv.includes('--daily'),
    max: int('max', 100),
    seed: int('seed', 1),
  };
}

/** The default formations: two melee in front; a bow, a crossbow and a healer behind. */
const TEAMS: Record<Args['team'], Formation> = {
  normal: { front: ['hero_rookie', 'hero_bri'], back: ['hero_tori', 'hero_tessa', 'hero_som'] },
  special: { front: ['hero_vail', 'hero_odel'], back: ['hero_nea', 'hero_toma', 'hero_yuna'] },
};

/** The element that beats `e` (수 > 화 > 지 > 풍 > 수). */
function weakTo(e: Element): Element {
  for (const [a, b] of Object.entries(BEATS)) if (b === e) return a as Element;
  return e;
}

function makeHeroes(args: Args, level: number, quality: QualityTier, tier: number, element: Element | null): HeroesState {
  const f = TEAMS[args.team];
  const keys: HeroKey[] = [...f.front, ...f.back];
  const s = newHeroesState();
  s.level = { level, exp: 0 };
  for (const key of keys) {
    const spec = heroSpec(key);
    s.roster[key] = 1 + args.star * STAR_STEP_COPIES[spec.rarity];
    const w: WeaponItem = { id: `w_${key}`, type: spec.weapon, materialTier: tier, quality, element, enchants: [], unique: null, enhance: 0 };
    s.armory.weapons.push(w);
    s.armory.equipped[key] = w.id;
  }
  return s;
}

function stallFloor(args: Args, level: number, quality: QualityTier): string {
  let p: StageProgress = newStageProgress();
  for (let floor = 1; floor <= args.max; floor++) {
    const tier = args.tier === 'band' ? bandOf(floor) : args.tier;
    const element = args.element === 'match' ? weakTo(floorLayout(floor).element) : null;
    const heroes = makeHeroes(args, level, quality, tier, element);
    const c = challengeNextFloor(p, { battleSeed: args.seed, heroes, formation: TEAMS[args.team], critMode: args.crit });
    if (!c.won) return `${floor}${c.result.outcome === 'timeout' ? 't' : 'w'}`;
    p = c.progress;
  }
  return `>${args.max}`;
}

const LEVELS = [1, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100];
const QUALITIES: QualityTier[] = [1, 2, 3, 4, 5];

function stageTable(args: Args): void {
  console.log(`## 막히는 층 (팀 ${args.team}, 별 ${args.star}, 무기 구간 ${args.tier}, 속성 ${args.element}, 치명 ${args.crit}, 시드 ${args.seed})\n`);
  console.log(`| 레벨 | ${QUALITIES.map((q) => `★${q}`).join(' | ')} |`);
  console.log(`|---|${QUALITIES.map(() => '---').join('|')}|`);
  for (const level of LEVELS) {
    console.log(`| ${level} | ${QUALITIES.map((q) => stallFloor(args, level, q)).join(' | ')} |`);
  }
}

function dailyTable(args: Args): void {
  console.log(`## 일일 보스: 그날 잡은 가장 높은 단계 / 막힌 단계의 데미지 (팀 ${args.team}, 별 ${args.star}, 무기 ★3, 속성 ${args.element})\n`);
  console.log(`| 레벨 | ${DAILY_BOSSES.map((b) => monsterSpec(b.key).name).join(' | ')} |`);
  console.log(`|---|${DAILY_BOSSES.map(() => '---').join('|')}|`);
  for (const level of LEVELS) {
    const cells = DAILY_BOSSES.map((b) => {
      const boss = monsterSpec(b.key);
      const element = args.element === 'match' && boss.element !== null ? weakTo(boss.element) : null;
      const tier = args.tier === 'band' ? bandOf(level) : args.tier;
      const heroes = makeHeroes(args, level, 3, tier, element);
      const r = climbDaily(newDailyState(b.day), { battleSeed: args.seed, heroes, formation: TEAMS[args.team], critMode: args.crit });
      return `${r.state.cleared} / ${r.state.bestDamage}`;
    });
    console.log(`| ${level} | ${cells.join(' | ')} |`);
  }
  if (args.element === 'match') console.log(`\n(속성 match: ${DAILY_BOSSES.map((b) => { const e = monsterSpec(b.key).element; return e === null ? '-' : ELEMENT_LABEL[weakTo(e)]; }).join(', ')})`);
}

const args = parseArgs(process.argv.slice(2));
if (args.daily) dailyTable(args);
else stageTable(args);
