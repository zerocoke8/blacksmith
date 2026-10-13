import { describe, expect, it } from 'vitest';
import type { QualityTier } from '../core/types.ts';
import { STAGE_TIME_LIMIT_TICKS } from '../data/battle.ts';
import { heroSpec, type HeroKey } from '../data/heroes.ts';
import { MONSTERS } from '../data/monsters.ts';
import { readFileSync } from 'node:fs';
import { addExp, type HeroesState, newHeroesState, type WeaponItem } from '../hero/index.ts';
import { type Formation, formationFull, formationProblems, formationProblemText, placeHero } from './formation.ts';
import { bandBodyOrder, bossKindOf, floorEnemies, floorLayout, mobCount } from './layout.ts';
import {
  autoClimb,
  canAutoChallenge,
  challengeNextFloor,
  newStageProgress,
  setAutoChallenge,
  type StageProgress,
} from './progress.ts';
import { restoreStage, serializeStage } from './save.ts';

const F: Formation = { front: ['hero_rookie', 'hero_bri'], back: ['hero_tori', 'hero_tessa', 'hero_som'] };

function team(level: number, quality: QualityTier | null, tier = 1): HeroesState {
  const s = newHeroesState();
  s.level = { level, exp: 0 };
  for (const key of [...F.front, ...F.back] as HeroKey[]) {
    s.roster[key] = 1;
    if (quality === null) continue;
    const w: WeaponItem = { id: `w_${key}`, type: heroSpec(key).weapon, materialTier: tier, quality, element: null, enchants: [], unique: null, enhance: 0 };
    s.armory.weapons.push(w);
    s.armory.equipped[key] = w.id;
  }
  return s;
}

describe('formation (6.3)', () => {
  it('takes up to five, at most four a row, each once, only owned heroes', () => {
    const roster = team(1, null).roster;
    expect(formationProblems(F, roster)).toEqual([]);
    expect(formationFull(F)).toBe(true);
    expect(formationProblems({ front: [], back: [] }, roster).map((p) => p.code)).toEqual(['empty']);
    const five = { front: ['hero_rookie', 'hero_bri', 'hero_tori', 'hero_tessa', 'hero_som'], back: [] } as Formation;
    expect(formationProblems(five, roster).map((p) => p.code)).toEqual(['rowFull']);
    const six = { front: ['hero_rookie', 'hero_bri', 'hero_tori'], back: ['hero_tessa', 'hero_som', 'hero_vail'] } as Formation;
    expect(formationProblems(six, roster).map((p) => p.code)).toEqual(['tooMany', 'notOwned']);
    const dup = { front: ['hero_rookie'], back: ['hero_rookie'] } as Formation;
    expect(formationProblems(dup, roster).map((p) => p.code)).toEqual(['duplicate']);
    for (const p of formationProblems(six, roster)) expect(formationProblemText(p).length).toBeGreaterThan(0);
    // Fewer than five may fight.
    expect(formationProblems({ front: ['hero_rookie'], back: [] }, roster)).toEqual([]);
    expect(placeHero(F, 'hero_tori', 'front')).toEqual({ front: ['hero_rookie', 'hero_bri', 'hero_tori'], back: ['hero_tessa', 'hero_som'] });
  });
});

describe('floor layout (6.1, 6.2, 6.10)', () => {
  it('puts a lone boss every 10th floor, bodies in turn, demon lord on 100', () => {
    expect([10, 20, 30, 40, 50].map((f) => floorLayout(f).monster.key)).toEqual(['boss_humanoid', 'boss_armored', 'boss_flying', 'boss_spirit', 'boss_humanoid']);
    expect([9, 10, 40, 50, 90, 100].map(bossKindOf)).toEqual([null, 'section', 'section', 'great', 'great', 'demonLord']);
    expect(floorEnemies(10)).toHaveLength(1);
    expect(floorEnemies(10)[0]?.boss).toBe(true);
    // The boss is the group's HP × 1.3 (6.2).
    const group = floorEnemies(9).reduce((s, e) => s + e.maxHp, 0) * 1.04;
    expect((floorEnemies(10)[0]?.maxHp ?? 0) / group).toBeCloseTo(1.3, 1);
  });

  it('fills a normal floor with one monster of the floor\'s body and element', () => {
    for (let f = 1; f <= 60; f++) {
      const lay = floorLayout(f);
      const en = floorEnemies(f);
      expect(en).toHaveLength(lay.count);
      for (const e of en) expect([e.body, e.element, e.key]).toEqual([lay.body, lay.element, lay.monster.key]);
      if (lay.boss === null) expect(lay.monster.key).toBe(`mon_${lay.body}_${lay.element}`);
    }
    expect([1, 15, 25, 35, 45, 95].map(mobCount)).toEqual([3, 3, 4, 4, 5, 5]);
  });

  it('keeps 6 main + 3 sub bodies a band and no spirit through floor 20', () => {
    for (let band = 1; band <= 10; band++) {
      const order = bandBodyOrder(band);
      expect(order).toHaveLength(9);
      const counts = [...new Set(order)].map((b) => order.filter((x) => x === b).length).sort();
      expect(counts).toEqual([3, 6]);
      if (band <= 2) expect(order).not.toContain('spirit');
    }
    for (let f = 1; f <= 20; f++) if (floorLayout(f).boss === null) expect(floorLayout(f).body).not.toBe('spirit');
  });

  it('is the same every time (the same floors for every player)', () => {
    const a = Array.from({ length: 100 }, (_, i) => floorLayout(i + 1));
    const b = Array.from({ length: 100 }, (_, i) => floorLayout(i + 1));
    expect(a).toEqual(b);
    // Every element and body shows up in the first 100 floors.
    expect(new Set(a.map((l) => l.element)).size).toBe(4);
    expect(new Set(a.map((l) => l.body)).size).toBe(4);
  });

  it('uses the 25 monsters of bestiary.json', () => {
    const b = JSON.parse(readFileSync(new URL('../../../tools/art/roster/bestiary.json', import.meta.url), 'utf8')) as {
      monsters: { key: string; name: string; body: string; element: string }[];
    };
    expect(MONSTERS.map((m) => [m.key, m.name, m.body, m.element ?? 'any'])).toEqual(b.monsters.map((m) => [m.key, m.name, m.body, m.element]));
  });

  it('grows 1.04 a floor', () => {
    const r = (floorEnemies(2)[0]?.maxHp ?? 0) / (floorEnemies(1)[0]?.maxHp ?? 1);
    expect(r).toBeCloseTo(1.04, 3);
  });
});

describe('next-floor challenge and auto-challenge (6.7)', () => {
  it('raises the best floor only when the floor is cleared in 30 s', () => {
    const p = newStageProgress();
    const win = challengeNextFloor(p, { battleSeed: 1, heroes: team(1, 3), formation: F });
    expect(win.won).toBe(true);
    expect(win.floor).toBe(1);
    expect(win.result.ticks).toBeLessThanOrEqual(STAGE_TIME_LIMIT_TICKS);
    expect(win.progress).toMatchObject({ best: 1, attempts: 1, stuck: null, bestLevel: 1 });
    const lose = challengeNextFloor(p, { battleSeed: 1, heroes: team(1, null), formation: F });
    expect(lose.won).toBe(false);
    expect(lose.progress.best).toBe(0);
    expect(lose.progress.stuck?.floor).toBe(1);
  });

  it('climbs while it wins and stops at the first loss, the same way every time', () => {
    const ctx = { battleSeed: 5, heroes: team(1, 1), formation: F };
    const a = autoClimb(newStageProgress(), ctx);
    const b = autoClimb(newStageProgress(), ctx);
    expect(b).toEqual(a);
    const last = a.challenges[a.challenges.length - 1];
    expect(last?.won).toBe(false);
    expect(a.challenges.slice(0, -1).every((c) => c.won)).toBe(true);
    expect(a.progress.best).toBe(a.challenges.length - 1);
    expect(a.progress.best).toBeGreaterThan(3);
    // Stuck: the same team does not try again by itself …
    expect(canAutoChallenge(a.progress, ctx)).toBe(false);
    expect(autoClimb(a.progress, ctx).challenges).toHaveLength(0);
    // … a level up does.
    const stronger = { ...ctx, heroes: { ...ctx.heroes, level: addExp(ctx.heroes.level, 100_000).state } };
    expect(canAutoChallenge(a.progress, stronger)).toBe(true);
    const more = autoClimb(a.progress, stronger);
    expect(more.progress.best).toBeGreaterThan(a.progress.best);
    expect(more.progress.bestLevel).toBe(stronger.heroes.level.level);
  });

  it('does nothing with the auto-challenge off; the button still fights', () => {
    const off = setAutoChallenge(newStageProgress(), false);
    const ctx = { battleSeed: 5, heroes: team(1, 1), formation: F };
    expect(autoClimb(off, ctx).challenges).toHaveLength(0);
    expect(challengeNextFloor(off, ctx).won).toBe(true);
  });

  it('stays on the floor after a loss: nothing is lost', () => {
    const p: StageProgress = { ...newStageProgress(), best: 40 };
    const c = challengeNextFloor(p, { battleSeed: 1, heroes: team(1, 1), formation: F });
    expect(c.won).toBe(false);
    expect(c.progress.best).toBe(40);
  });
});

describe('stage save', () => {
  it('round-trips and rejects broken saves', () => {
    const ctx = { battleSeed: 5, heroes: team(1, 1), formation: F };
    const progress = autoClimb(newStageProgress(), ctx).progress;
    const state = { progress, formations: { stage: F, daily: { front: ['hero_bri'], back: ['hero_som'] } as Formation } };
    expect(restoreStage(JSON.parse(serializeStage(state)))).toEqual(state);
    expect(restoreStage({ version: 1, progress: { best: -1 }, formations: { stage: F, daily: F } })).toBeNull();
    const odd = JSON.parse(serializeStage(state)) as { formations: { stage: { front: string[] } } };
    odd.formations.stage.front.push('hero_nobody');
    expect(restoreStage(odd)?.formations.stage).toEqual(F);
  });
});
