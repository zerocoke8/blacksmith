import { describe, expect, it } from 'vitest';
import type { QualityTier } from '../core/types.ts';
import { DAILY_TIME_LIMIT_TICKS } from '../data/battle.ts';
import { type HeroKey, heroSpec } from '../data/heroes.ts';
import { DAILY_TRIES } from '../data/monsters.ts';
import { type HeroesState, newHeroesState, type WeaponItem } from '../hero/index.ts';
import type { Formation } from '../stage/formation.ts';
import {
  challengeDaily,
  climbDaily,
  dailyBossOf,
  dailyBossUnit,
  dailyRecord,
  type DailyState,
  dayOfMinute,
  groupPlayers,
  matchFloor,
  newDailyState,
  rankGroup,
  restoreDaily,
  rollDailyTo,
  serializeDaily,
} from './index.ts';

const F: Formation = { front: ['hero_rookie', 'hero_bri'], back: ['hero_tori', 'hero_tessa', 'hero_som'] };

function team(level: number, quality: QualityTier | null): HeroesState {
  const s = newHeroesState();
  s.level = { level, exp: 0 };
  for (const key of [...F.front, ...F.back] as HeroKey[]) {
    s.roster[key] = 1;
    if (quality === null) continue;
    const w: WeaponItem = { id: `w_${key}`, type: heroSpec(key).weapon, materialTier: 1, quality, element: null, enchants: [], unique: null, enhance: 0 };
    s.armory.weapons.push(w);
    s.armory.equipped[key] = w.id;
  }
  return s;
}

describe('the day\'s boss (8.1)', () => {
  it('turns over five days: 연못 거북, 두더지 광부, 딸꾹 드래곤, 뭉게 정령, 가마솥 대감', () => {
    expect([1, 2, 3, 4, 5, 6, 10, 11].map((d) => dailyBossOf(d).monster.name)).toEqual([
      '연못 거북',
      '두더지 광부',
      '딸꾹 드래곤',
      '뭉게 정령',
      '가마솥 대감',
      '연못 거북',
      '가마솥 대감',
      '연못 거북',
    ]);
    expect(dayOfMinute(0)).toBe(1);
    expect(dayOfMinute(24 * 60 - 1)).toBe(1);
    expect(dayOfMinute(24 * 60)).toBe(2);
  });

  it('grows stage by stage', () => {
    const a = dailyBossUnit(1, 1);
    const b = dailyBossUnit(1, 2);
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.atk).toBeGreaterThan(a.atk);
    expect([a.body, a.element, a.boss]).toEqual(['armored', 'water', true]);
  });
});

describe('tries (8.2)', () => {
  it('takes one try on a loss and keeps the best damage; five again on the next stage', () => {
    const weak = { battleSeed: 3, heroes: team(1, null), formation: F };
    let s: DailyState = newDailyState(1);
    const t1 = challengeDaily(s, weak);
    expect(t1?.won).toBe(false);
    expect(t1?.result.ticks).toBeLessThanOrEqual(DAILY_TIME_LIMIT_TICKS);
    s = t1?.state ?? s;
    expect(s).toMatchObject({ cleared: 0, tries: DAILY_TRIES - 1, attempts: 1 });
    expect(s.bestDamage).toBe(t1?.result.damageDealt);
    for (let i = 0; i < DAILY_TRIES - 1; i++) s = challengeDaily(s, weak)?.state ?? s;
    expect(s.tries).toBe(0);
    expect(challengeDaily(s, weak)).toBeNull();
    expect(dailyRecord(s).stage).toBe(0);
    expect(dailyRecord(s).damage).toBeGreaterThan(0);

    const strong = { battleSeed: 3, heroes: team(20, 5), formation: F };
    const day = climbDaily(newDailyState(1), strong);
    expect(day.tries.length).toBeGreaterThan(1);
    const wins = day.tries.filter((t) => t.won);
    expect(wins.length).toBe(day.state.cleared);
    expect(day.state.tries).toBe(DAILY_TRIES - 1);
    // A win gives the five tries back and clears the damage of the old stage.
    const afterWin = wins[0]?.state;
    expect(afterWin).toMatchObject({ cleared: 1, tries: DAILY_TRIES, bestDamage: 0 });
  });

  it('is the same run every time for the same seed', () => {
    const ctx = { battleSeed: 9, heroes: team(10, 3), formation: F };
    expect(climbDaily(newDailyState(2), ctx)).toEqual(climbDaily(newDailyState(2), ctx));
  });

  it('starts afresh on a new day and never rolls back', () => {
    const s: DailyState = { day: 4, cleared: 7, tries: 2, bestDamage: 900, attempts: 12 };
    expect(rollDailyTo(s, 4)).toBe(s);
    expect(rollDailyTo(s, 3)).toBe(s);
    expect(rollDailyTo(s, 5)).toEqual(newDailyState(5));
  });

  it('round-trips through JSON', () => {
    const s: DailyState = { day: 4, cleared: 7, tries: 2, bestDamage: 900, attempts: 12 };
    expect(restoreDaily(JSON.parse(serializeDaily(s)))).toEqual(s);
    expect(restoreDaily({ ...s, day: 0 })).toBeNull();
    expect(restoreDaily({ ...s, tries: 99 })?.tries).toBe(DAILY_TRIES);
    expect(restoreDaily('x')).toBeNull();
  });
});

describe('ranking (8.3)', () => {
  it('puts the higher stage first, then the higher damage; ties share a rank', () => {
    const r = rankGroup([
      { id: 'a', stage: 5, damage: 100 },
      { id: 'b', stage: 7, damage: 10 },
      { id: 'c', stage: 5, damage: 300 },
      { id: 'd', stage: 5, damage: 100 },
      { id: 'e', stage: 0, damage: 999 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
      ['d', 3],
      ['e', 5],
    ]);
  });

  it('groups about 100 by floor, and a high level lifts a low floor (꼼수 방지)', () => {
    const players = Array.from({ length: 240 }, (_, i) => ({ id: `p${String(i).padStart(3, '0')}`, best: i, level: i }));
    const groups = groupPlayers(players, 100);
    expect(groups.map((g) => g.length)).toEqual([100, 140]);
    expect(groups[0]?.[0]).toBe('p239');
    expect(matchFloor({ best: 5, level: 80 })).toBe(70);
    expect(matchFloor({ best: 50, level: 20 })).toBe(50);
    const sneaky = groupPlayers([...players, { id: 'sneak', best: 1, level: 230 }], 100);
    expect(sneaky[0]).toContain('sneak');
  });
});
