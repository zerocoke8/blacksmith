// 기획서 13.18 한 판 예시 (아렌 2성 단검, 1시즌 「재의 악마의 탑」)를 엔진 함수로 다시 계산한다.
// The doc's numbers are hand-rounded to two digits; each check allows that much.

import { describe, expect, it } from 'vitest';
import type { Weapon } from '../core/types.ts';
import { bandOf, materialPrice } from '../data/common.ts';
import { FAMILIES } from '../data/families.ts';
import { bonusEffects } from './events.ts';
import { forgePlan } from './forge.ts';
import { floorOdds, heroLevel, runLevel, runPower } from './hero.ts';
import { hpLossOnClear } from '../world/combat.ts';
import { gradeFor, scoreOf } from './rating.ts';
import { ancestorLine, startRun } from './run.ts';
import { seasonFloor } from './season.ts';
import { enchantPrice, repairCostOf } from './state.ts';
import { arenSetup, sampleAncestor } from './testkit.ts';
import type { RunState } from './types.ts';

const dagger = (over: Partial<Weapon>): Weapon => ({
  id: 't',
  type: 'dagger',
  materialTier: 1,
  quality: 3,
  element: null,
  enchants: [],
  unique: null,
  ...over,
});

/** 준비: 아렌 2성, 주 선대 '노련한 아렌'의 '아렌의 단검'을 철로 고쳐 벼려 연격을 잇는다. */
function start(): RunState {
  return startRun(
    arenSetup({ ancestors: [sampleAncestor()], mainAncestor: 0, weaponKeep: { kind: 'enchant', enchant: 'combo' } }),
  );
}

const at = (s: RunState, over: Partial<RunState>): RunState => ({ ...s, ...over });
const r2 = (x: number): number => Math.round(x * 100) / 100;
const pct = (x: number): number => Math.round(x * 100);

/** 판 골드 for clearing floors a..b (그 구간 재료가 × 1, 13.4.3). */
function income(a: number, b: number): number {
  let g = 0;
  for (let f = a; f <= b; f++) g += materialPrice(bandOf(f));
  return g;
}

describe('13.18 한 판 예시', () => {
  it('준비: ★3 역작 철 단검 (연격), 고유 카드 잔날 세우기 레벨 2, 판 골드 150G', () => {
    const s = start();
    expect(s.weapon.weapon).toMatchObject({ type: 'dagger', materialTier: 1, quality: 3, element: null, enchants: ['combo'] });
    expect(s.weapon.name).toBe('아렌의 단검');
    expect(s.gold).toBe(150);
    expect(s.deck).toContain('edgeHone2');
    expect(FAMILIES.aren).toMatchObject({ weapon: 'dagger', charisma: 'mid', luck: 'mid' });
    expect(ancestorLine(s)).toBe('"…이 단검, 내가 만든 거다. 이번엔 네 손에 맞춰 주지."');
  });

  it('레벨과 힘: 판 누적 층으로 오르고, 2성 상한 2.55', () => {
    const rows: [number, number, number][] = [
      // [누적 층, 레벨, 힘]
      [12, 3, 1.11],
      [17, 4, 1.16],
      [28, 6, 1.27],
      [31, 7, 1.32],
      [35, 8, 1.37],
      [41, 9, 1.43],
      [51, 11, 1.53],
    ];
    for (const [floors, level, power] of rows) {
      expect(runLevel(floors)).toBe(level);
      expect(r2(runPower(2, level))).toBe(power);
    }
  });

  it('1시즌 배치가 예시와 같다: 3층 비행, 21·22층 비행, 23층 갑각', () => {
    expect(seasonFloor('ash', 3).body).toBe('flying');
    expect([21, 22, 23].map((f) => seasonFloor('ash', f).body)).toEqual(['flying', 'flying', 'armored']);
    expect(seasonFloor('ash', 10)).toMatchObject({ name: '재의 문지기', body: 'humanoid', element: 'fire', kind: 'sectionBoss' });
    expect(seasonFloor('ash', 50)).toMatchObject({ name: '재의 군주', kind: 'demonLord' });
  });

  it('1턴: 10층 재의 문지기 R 1.87 (98%), 12층까지 300G', () => {
    const s = start();
    const boss = floorOdds(at(s, { cumulativeFloors: 9 }), 10);
    expect(r2(boss.r)).toBe(1.87);
    expect(pct(boss.chance)).toBe(98);
    expect(150 + income(1, 12)).toBe(300);
    expect(heroLevel(at(s, { cumulativeFloors: 12 }))).toBe(3);
  });

  it('2턴: 강철 6개 + 화의 결정 + 갑각 파편 = 250G', () => {
    const s = at(start(), { lastBossFloor: 10, record: 12, gold: 300 });
    const plan = forgePlan(s, 2);
    expect(plan.block).toBeNull();
    expect(plan.cost + 2 * enchantPrice(s)).toBe(250);
    expect(plan.grade).toBe('basic');
    expect(plan.smithLevel).toBe(4);
  });

  it('3~5턴: 175G, 488G, 20층 바위 수문장 R 1.30 (88%)', () => {
    const s = at(start(), { lastBossFloor: 10, record: 15, cumulativeFloors: 26 });
    expect(50 + income(11, 15)).toBe(175);
    expect(175 + income(11, 21)).toBe(488);
    const steel = dagger({ materialTier: 2, element: 'fire', enchants: ['pierce'] });
    const boss = floorOdds(s, 20, { weapon: steel });
    expect(r2(boss.r)).toBe(1.3);
    expect(pct(boss.chance)).toBe(88);
  });

  it('6턴: 비행 구간 앞의 네 갈래', () => {
    const steel = dagger({ materialTier: 2, element: 'fire', enchants: ['pierce'] });
    const s = at(start(), { lastBossFloor: 20, record: 21, cumulativeFloors: 28, weapon: { ...start().weapon, weapon: steel } });
    expect(repairCostOf(steel)).toBe(34);
    // 강철 단검을 정비하고 오른다: 0.77 (22%), 정비 버프를 받아도 0.93 (48%)
    expect(r2(floorOdds(s, 30).r)).toBe(0.77);
    expect(pct(floorOdds(s, 30).chance)).toBe(22);
    expect(r2(floorOdds(s, 30, { maintain: true }).r)).toBe(0.93);
    expect(pct(floorOdds(s, 30, { maintain: true }).chance)).toBe(48);
    // 미스릴 단검 세 가지
    const plain = dagger({ materialTier: 3, enchants: ['pursuit'] });
    const earth = dagger({ materialTier: 3, element: 'earth', enchants: ['pursuit'] });
    const fine = dagger({ materialTier: 3, quality: 4, element: 'earth', enchants: ['pursuit', 'combo'] });
    expect([plain, earth, fine].map((w) => r2(floorOdds(s, 30, { weapon: w }).r))).toEqual([0.99, 1.28, 1.69]);
    expect([plain, earth, fine].map((w) => pct(floorOdds(s, 30, { weapon: w }).chance))).toEqual([58, 88, 97]);
    // 비용: 칼깃은 1턴에 주운 것, 결정과 마족 문장은 상점 (3구간이 풀려 재료가 63G × 2).
    const g = at(s, { gold: 1000 });
    const mithril = forgePlan(g, 3).cost;
    expect([mithril, mithril + enchantPrice(g), mithril + 2 * enchantPrice(g)]).toEqual([378, 504, 630]);
  });

  it('7턴: 정비 버프로 21~23층 R 1.71 · 1.72 · 1.44', () => {
    const steel = dagger({ materialTier: 2, element: 'fire', enchants: ['pierce'] });
    const s = at(start(), { lastBossFloor: 20, record: 21, maintainBuff: true, weapon: { ...start().weapon, weapon: steel } });
    const rs = [21, 22, 23].map((f, i) => r2(floorOdds(at(s, { cumulativeFloors: 28 + i }), f).r));
    expect(rs).toEqual([1.71, 1.72, 1.44]);
    expect(454 + income(21, 23)).toBe(643);
  });

  it('8~13턴: 지속성 미스릴 단검으로 30층 잿빛 와이번 R 1.55 (95%), 1,399G', () => {
    const earth = dagger({ materialTier: 3, element: 'earth', enchants: ['pursuit'] });
    const s = at(start(), { lastBossFloor: 20, record: 26, cumulativeFloors: 50, weapon: { ...start().weapon, weapon: earth } });
    const boss = floorOdds(s, 30);
    expect(r2(boss.r)).toBe(1.55);
    expect(pct(boss.chance)).toBe(95);
    expect(643 - 504 + income(21, 24) + income(21, 26) + income(21, 30)).toBe(1399);
  });

  it('10턴: 네아 3성 유대 1 → 칼깃 2개 (2단계)', () => {
    const s = start();
    const nea = s.companions[0];
    if (nea === undefined) throw new Error('no 네아');
    expect(bonusEffects(s, nea, 'materialGift')).toEqual({
      preview: '하급 칼깃 2개',
      effects: [{ kind: 'material', key: 'feather:low', count: 2 }],
    });
  });

  it('14턴: 40층 안개 원령 앞 R 0.81 · 0.70 · 1.21, 풍속성 오리할콘 1,248G', () => {
    const s = at(start(), { lastBossFloor: 30, record: 30, cumulativeFloors: 51, gold: 1399 });
    const now = dagger({ materialTier: 3, element: 'earth', enchants: ['pursuit'] });
    const plain = dagger({ materialTier: 4, enchants: ['pursuit'] });
    const wind = dagger({ materialTier: 4, element: 'wind', enchants: ['pursuit'] });
    expect([now, plain, wind].map((w) => r2(floorOdds(s, 40, { weapon: w }).r))).toEqual([0.81, 0.7, 1.21]);
    expect([now, plain, wind].map((w) => pct(floorOdds(s, 40, { weapon: w }).chance))).toEqual([28, 10, 85]);
    expect(forgePlan(s, 4).cost + enchantPrice(s)).toBe(1248);
  });

  it('HP 열: 모든 층을 넘는다 치고 층마다 10% ÷ R (보스 ×2), 문서의 손 계산과 3%p 안', () => {
    const steel = dagger({ materialTier: 2, element: 'fire', enchants: ['pierce'] });
    const earth = dagger({ materialTier: 3, element: 'earth', enchants: ['pursuit'] });
    const s = start();
    const held = s.weapon.weapon;
    /** HP after clearing floors a..b from `hp`, the level growing floor by floor (13.18's assumption). */
    const climbHp = (a: number, b: number, hp: number, cumulative: number, record: number, weapon: Weapon, maintain = false): number => {
      let h = hp;
      for (let f = a; f <= b; f++) {
        const odds = floorOdds(at(s, { cumulativeFloors: cumulative + (f - a), record: Math.max(record, f - 1), maintainBuff: maintain }), f, { weapon });
        h -= hpLossOnClear(odds.r, odds.info.kind !== 'normal');
      }
      return h;
    };
    // [턴, 층 a~b, 시작 HP, 누적 층, 기록, 무기, 정비 버프, 문서의 끝 HP]
    const rows: [number, number, number, number, number, number, Weapon, boolean, number][] = [
      [1, 1, 12, 1.0, 0, 0, held, false, 0.4],
      [3, 11, 15, 0.6, 12, 12, steel, false, 0.37],
      [5, 11, 21, 0.97, 17, 15, steel, false, 0.33],
      [7, 21, 23, 0.53, 28, 21, steel, true, 0.35],
      [9, 21, 24, 0.55, 31, 23, earth, false, 0.36],
      [11, 21, 26, 0.66, 35, 24, earth, false, 0.38],
      [13, 21, 30, 0.98, 41, 26, earth, false, 0.42],
    ];
    for (const [turn, a, b, hp, cumulative, record, weapon, maintain, doc] of rows) {
      const got = climbHp(a, b, hp, cumulative, record, weapon, maintain);
      // 1턴 lands near 43% against the doc's 40% (its rounding); the rest within a point or two.
      expect(Math.abs(got - doc), `${turn}턴: ${Math.round(got * 100)}% vs ${Math.round(doc * 100)}%`).toBeLessThanOrEqual(0.035);
    }
  });

  it('판 끝 (예상): 60층, 벽 여유 17턴, ★4, 유대 9 → 7,090점, 노래로 남은', () => {
    const score = scoreOf({ record: 60, spareTurns: 3 + 5 + 3 + 3 + 3, bestQuality: 4, bondSum: 9 });
    expect(score).toEqual({ floors: 6000, spare: 510, weapon: 400, bond: 180, total: 7090 });
    expect(gradeFor(score.total, true)).toBe('sung');
  });
});
