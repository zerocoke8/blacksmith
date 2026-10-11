// 평가 등급과 전설 용사 카드 (기획서 13.12), 명예의 전당 (13.13).

import { describe, expect, it } from 'vitest';
import { HALL_SIZE, RUN_GRADE_SPEC, RUN_GRADES } from '../data/run.ts';
import {
  emptyHall,
  hallAdd,
  hallAddBlock,
  hallRemove,
  hallSetLock,
  hallSorted,
  isLegendCard,
  nextGeneration,
  parseHall,
  serializeHall,
} from './hall.ts';
import { factorCandidates, gradeFor, legendTitle, rollFactors, runWeaponName, scoreOf, spareTurns } from './rating.ts';
import { inheritedWeaponName, runAct, startRun } from './run.ts';
import { arenSetup, playThrough, sampleAncestor } from './testkit.ts';
import { factorText, floorWords, nativeCount } from './text.ts';
import type { RunState } from './types.ts';

describe('평가 점수와 등급 (13.12)', () => {
  it('scores 층 × 100 + 벽 여유 × 30 + 최고 ★ × 100 + 유대 합 × 20', () => {
    expect(scoreOf({ record: 30, spareTurns: 4, bestQuality: 3, bondSum: 2 })).toEqual({
      floors: 3000,
      spare: 120,
      weapon: 300,
      bond: 40,
      total: 3460,
    });
    const s = startRun(arenSetup());
    const walls = s.walls.map((w, i) => (i < 2 ? { ...w, passedTurn: w.deadline - 2 } : w));
    expect(spareTurns({ walls })).toBe(4);
  });

  it('draws the grade lines where the doc does', () => {
    expect(gradeFor(0, false)).toBe('novice');
    expect(gradeFor(2499, false)).toBe('novice');
    expect(gradeFor(2500, false)).toBe('known');
    expect(gradeFor(3999, false)).toBe('known');
    expect(gradeFor(4000, false)).toBe('seasoned');
    expect(gradeFor(9999, false)).toBe('seasoned');
    expect(gradeFor(3000, true)).toBe('demonSlayer');
    expect(gradeFor(6999, true)).toBe('demonSlayer');
    expect(gradeFor(7000, true)).toBe('sung');
    expect(RUN_GRADES.map((g) => RUN_GRADE_SPEC[g].label)).toEqual(['풋내기', '이름난', '노련한', '악마를 벤', '노래로 남은']);
    expect(legendTitle({ grade: 'sung', family: 'aren' })).toBe('노래로 남은 아렌');
  });

  it('감: 20층 벽 은퇴는 풋내기, 40층 벽 은퇴는 노련한', () => {
    const twenty = scoreOf({ record: 19, spareTurns: 2, bestQuality: 3, bondSum: 2 }).total;
    const forty = scoreOf({ record: 39, spareTurns: 8, bestQuality: 3, bondSum: 4 }).total;
    expect(gradeFor(twenty, false)).toBe('novice');
    expect(gradeFor(forty, false)).toBe('seasoned');
  });
});

describe('인자 (13.10, 13.12)', () => {
  it('gives 1·2·2·3·3 factors at the grade level, from what the run did', () => {
    const states = playThrough(startRun(arenSetup({ seed: 3 })));
    const end = states[states.length - 1] as RunState;
    for (const g of RUN_GRADES) {
      const spec = RUN_GRADE_SPEC[g];
      const f = rollFactors(end, g);
      expect(f).toHaveLength(spec.factors);
      for (const x of f) expect(x.level).toBe(spec.factorLevel);
      expect(new Set(f.map((x) => `${x.kind}${x.body}`)).size).toBe(f.length);
    }
    expect(rollFactors(end, 'sung')).toEqual(rollFactors(end, 'sung'));
    const kinds = factorCandidates(end, 1).map((f) => f.kind);
    expect(kinds.slice(0, 3)).toEqual(['strength', 'mastery', 'charisma']);
    expect(kinds.includes('toughness')).toBe(end.stats.injuries === 0);
    expect(kinds.includes('towerAdapt')).toBe(end.lastBossFloor >= 50);
  });

  it('사냥꾼 takes the body of the most beaten bosses; 카드 the most played card', () => {
    const s = startRun(arenSetup());
    const done: RunState = {
      ...s,
      stats: { ...s.stats, bossesCleared: [10, 20, 30], cardUses: { polish: 5, quickPolish: 4, hammer: 6 } },
    };
    const c = factorCandidates(done, 2);
    expect(c.find((f) => f.kind === 'hunter')?.body).toBe('flying'); // ties → the higher boss (30층 비행)
    expect(c.find((f) => f.kind === 'card')).toMatchObject({ card: 'polish', evolved: 'quickPolish', level: 2 });
  });
});

describe('판 무기의 이름 (13.12)', () => {
  it('always names the weapon held at the end', () => {
    const s = startRun(arenSetup());
    expect(runWeaponName(s)).toBe('아렌의 단검');
    expect(runWeaponName({ ...s, lastBossFloor: 50, record: 55 })).toBe('재의 군주를 벤 단검');
    expect(runWeaponName({ ...s, lastBossFloor: 50, record: 63 })).toBe('재의 악마의 탑 60층을 연 단검');
    const inherited = startRun(arenSetup({ ancestors: [sampleAncestor()], mainAncestor: 0 }));
    expect(runWeaponName({ ...inherited, record: 63, lastBossFloor: 50 })).toBe('아렌의 단검');
  });

  it('an inherited name keeps its achievement and takes the new weapon type', () => {
    expect(inheritedWeaponName('재의 악마의 탑 60층을 연 단검', 'dagger', 'greatsword')).toBe('재의 악마의 탑 60층을 연 대검');
    expect(inheritedWeaponName('재의 군주를 벤 대검', 'greatsword', 'oneHandSword')).toBe('재의 군주를 벤 한손검');
    expect(inheritedWeaponName('아렌의 단검', 'dagger', 'dagger')).toBe('아렌의 단검');
    // A name that does not end in its type word is left alone.
    expect(inheritedWeaponName('두 대를 이은 것', 'dagger', 'bow')).toBe('두 대를 이은 것');
    const odel = startRun(arenSetup({ hero: { family: 'odel', star: 1 }, companions: [], ancestors: [sampleAncestor({ weaponName: '재의 악마의 탑 60층을 연 단검' })], mainAncestor: 0 }));
    expect(odel.weapon.name).toBe('재의 악마의 탑 60층을 연 대검');
    const end = runAct(odel, { type: 'retire' });
    expect(end.result?.legend).toMatchObject({ weaponName: '재의 악마의 탑 60층을 연 대검', weaponInherited: true });
    expect(runAct(startRun(arenSetup()), { type: 'retire' }).result?.legend.weaponInherited).toBe(false);
  });

  it('a finished run carries its 전설 용사 카드', () => {
    const states = playThrough(startRun(arenSetup({ seed: 2 })));
    const end = states[states.length - 1] as RunState;
    const card = end.result?.legend;
    expect(isLegendCard(card)).toBe(true);
    expect(card).toMatchObject({ family: 'aren', star: 2, season: 'ash', record: end.record, runSeed: 2, deck: end.deck });
    expect(end.weapon.name).toBe(card?.weaponName);
    const retired = runAct(startRun(arenSetup()), { type: 'retire' });
    expect(retired.end).toMatchObject({ kind: 'retired', floor: 0 });
    expect(retired.result?.grade).toBe('novice');
  });
});

describe('명예의 전당 (13.13)', () => {
  const card = (i: number) => ({ ...sampleAncestor(), id: `c${i}`, record: i });

  it('holds 50 cards; a full hall lets one go, never a locked one', () => {
    let hall = emptyHall();
    for (let i = 0; i < HALL_SIZE; i++) hall = hallAdd(hall, card(i));
    expect(hallAddBlock(hall)).toBe('명예의 전당은 50장까지다. 내보낼 카드를 고른다');
    hall = hallSetLock(hall, 'c0', true);
    expect(hallAddBlock(hall, 'c0')).toBe('잠근 카드는 내보낼 수 없다');
    expect(hallRemove(hall, 'c0').cards).toHaveLength(HALL_SIZE);
    hall = hallAdd(hall, card(99), 'c1');
    expect(hall.cards).toHaveLength(HALL_SIZE);
    expect(hall.cards.some((c) => c.id === 'c1')).toBe(false);
    expect(hall.cards[hall.cards.length - 1]?.id).toBe('c99');
  });

  it('counts the 대수 from the wall: one past the highest of the family, old cards by their order', () => {
    let hall = emptyHall();
    expect(nextGeneration(hall, 'aren')).toBe(1);
    hall = hallAdd(hall, card(1)); // kept before the 대수 was stored: counts as 1대
    hall = hallAdd(hall, { ...card(2), generation: 2 });
    hall = hallAdd(hall, { ...card(3), family: 'odel', generation: 5 });
    expect(nextGeneration(hall, 'aren')).toBe(3);
    expect(nextGeneration(hall, 'odel')).toBe(6);
    // Letting the first card go does not move the count back.
    expect(nextGeneration(hallRemove(hall, 'c1'), 'aren')).toBe(3);
    const s = startRun(arenSetup({ generation: nextGeneration(hall, 'aren') }));
    expect(runAct(s, { type: 'retire' }).result?.legend.generation).toBe(3);
    expect(isLegendCard({ ...card(4), generation: 0 })).toBe(false);
    expect(isLegendCard({ ...card(4), weaponInherited: 'yes' })).toBe(false);
  });

  it('gives a repeated id a new one, sorts, and survives a save', () => {
    let hall = hallAdd(hallAdd(emptyHall(), card(5)), card(5));
    expect(hall.cards.map((c) => c.id)).toEqual(['c5', 'c5-2']);
    hall = hallAdd(hall, { ...card(40), id: 'x', grade: 'sung' });
    expect(hallSorted(hall, 'record').map((c) => c.id)).toEqual(['x', 'c5', 'c5-2']);
    expect(hallSorted(hall, 'grade')[0]?.id).toBe('x');
    hall = hallSetLock(hall, 'x', true);
    expect(parseHall(serializeHall(hall))).toEqual(hall);
    expect(parseHall('nope')).toEqual(emptyHall());
    const broken = JSON.parse(serializeHall(hall)) as { cards: unknown[] };
    broken.cards.push({ id: 'bad' });
    expect(parseHall(JSON.stringify(broken)).cards).toHaveLength(3);
  });
});

describe('문장', () => {
  it('counts floors in 고유어 like the doc', () => {
    expect(nativeCount(30)).toBe('서른');
    expect(nativeCount(20)).toBe('스무');
    expect(nativeCount(21)).toBe('스물한');
    expect(nativeCount(60)).toBe('예순');
    expect(floorWords(9)).toBe('아홉 층');
    expect(floorWords(120)).toBe('120층');
    expect(factorText({ kind: 'hunter', level: 3, body: 'flying', card: null, evolved: null })).toBe('비행 사냥꾼 3단계: 그 체형 상대 전투력 ×1.08');
    expect(factorText({ kind: 'card', level: 2, body: null, card: 'polish', evolved: 'quickPolish' })).toBe('카드 2단계: 날랜 다듬기');
    expect(factorText({ kind: 'strength', level: 1, body: null, card: null, evolved: null })).toBe('강함 1단계: 시작 힘 +0.05');
  });
});
