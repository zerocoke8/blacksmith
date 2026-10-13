import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../platform/storage.ts';
import type { ServerMock } from '../../platform/server.ts';
import { HEROES, heroSpec, STAR_STEP_COPIES } from '../../sim/data/heroes.ts';
import { formationProblems } from '../../sim/stage/index.ts';
import { heroStar, heroWeapon, restoreHeroes, serializeHeroes } from '../../sim/hero/index.ts';
import { mockGroup, rankWindow } from '../battle/rankMock.ts';
import { labEvolve, labOwnAll, labStarUp, labWeaponBox, prototypeHeroes, prototypeStage, START_NORMALS, START_SPECIALS } from './start.ts';
import { DAILY_KEY, brokenKey, HEROES_KEY, makeGameStore, STAGE_KEY } from './store.ts';

const fakeServer = (day = 3): ServerMock => ({
  playerSeed: async () => 1,
  battleSeed: async () => 2,
  claimIdleLumps: async () => ({ gained: 0, band: 1, capped: false }),
  today: () => day,
});

describe('the prototype start (뽑기가 아직 없다)', () => {
  it('six normals, one per weapon, and a few specials, each holding a weapon of their type', () => {
    const h = prototypeHeroes();
    expect(new Set(START_NORMALS.map((k) => heroSpec(k).weapon)).size).toBe(6);
    expect(START_NORMALS.every((k) => heroSpec(k).rarity === 'normal')).toBe(true);
    expect(START_SPECIALS.every((k) => heroSpec(k).rarity === 'special')).toBe(true);
    for (const k of [...START_NORMALS, ...START_SPECIALS]) {
      expect(h.roster[k]).toBe(1);
      expect(heroWeapon(h.armory, k)?.type).toBe(heroSpec(k).weapon);
    }
    // Spares wait in the list for a swap, and the save comes back whole.
    expect(h.armory.weapons.length).toBeGreaterThan(START_NORMALS.length + START_SPECIALS.length);
    expect(restoreHeroes(JSON.parse(serializeHeroes(h)))).toEqual(h);
    expect(formationProblems(prototypeStage().formations.stage, h.roster)).toEqual([]);
  });

  it('the 실험 panel: own all, a star up, an evolution, a weapon box', () => {
    let h = labOwnAll(prototypeHeroes());
    expect(HEROES.every((s) => (h.roster[s.key] ?? 0) >= 1)).toBe(true);
    h = labStarUp(h, 'hero_vail');
    expect(h.roster.hero_vail).toBe(1 + STAR_STEP_COPIES.special);
    h = labEvolve(h, 'hero_vail');
    expect(heroStar(h.roster, 'hero_vail')?.color).toBe('gold');
    h = labEvolve(h, 'hero_vail');
    expect(heroStar(h.roster, 'hero_vail')?.color).toBe('red');
    expect(labEvolve(h, 'hero_vail')).toBe(h);
    h = labEvolve(h, 'hero_rookie');
    expect(heroStar(h.roster, 'hero_rookie')).toMatchObject({ color: 'gold', mark: 'moon', pips: 1 });
    const boxed = labWeaponBox(h, 2, 1);
    expect(boxed.armory.weapons.length).toBe(h.armory.weapons.length + 6);
    expect(labWeaponBox(boxed, 2, 1).armory.weapons.length).toBe(boxed.armory.weapons.length);
    expect(boxed.armory.weapons.filter((w) => w.id.startsWith('box1')).every((w) => w.materialTier === 2)).toBe(true);
  });
});

describe('the game store', () => {
  it('starts as the prototype, saves each part, and reads it back', async () => {
    const store = memoryStore();
    const g = makeGameStore(store, fakeServer());
    const s = await g.load();
    expect(s.daily.day).toBe(3);
    expect(await store.load(HEROES_KEY)).not.toBeNull();
    g.setStage({ ...s.stage, progress: { ...s.stage.progress, best: 7 } });
    const news = await g.addExp(100);
    expect(news).toMatchObject({ gained: 100 });
    expect(news!.levelsUp).toBeGreaterThanOrEqual(1);
    await new Promise((r) => setTimeout(r, 0));
    const again = await makeGameStore(store, fakeServer()).load();
    expect(again.stage.progress.best).toBe(7);
    expect(again.heroes.level.level).toBe(news!.level);
    expect(await store.load(STAGE_KEY)).toContain('"best":7');
    expect(await store.load(DAILY_KEY)).not.toBeNull();
  });

  it('a broken save part is kept aside and starts afresh; an old daily save still reads; a new day rolls it', async () => {
    const store = memoryStore();
    await store.save(HEROES_KEY, '{oops');
    const oldStage = JSON.stringify({ version: 99, progress: { best: 40 } });
    await store.save(STAGE_KEY, oldStage);
    // The first prototype's daily save had no version.
    await store.save(DAILY_KEY, JSON.stringify({ day: 1, cleared: 4, tries: 2, bestDamage: 9, attempts: 7 }));
    const s = await makeGameStore(store, fakeServer(2)).load();
    expect(s.heroes.roster.hero_rookie).toBe(1);
    expect(s.daily).toMatchObject({ day: 2, cleared: 0, tries: 5 });
    await new Promise((r) => setTimeout(r, 0));
    // What could not be read is not lost: it waits under '<key>.broken', and the part starts afresh.
    expect(await store.load(brokenKey(HEROES_KEY))).toBe('{oops');
    expect(await store.load(brokenKey(STAGE_KEY))).toBe(oldStage);
    expect(await store.load(brokenKey(DAILY_KEY))).toBeNull();
    expect(await store.load(HEROES_KEY)).toContain('"version":1');
    expect(await store.load(DAILY_KEY)).toContain('"version":1');
  });
});

describe('a crafted weapon reaches the heroes (4.11, 사용자 결정 1)', () => {
  it('joins the weapon list once, takes its 속성 칸 when filled, keeps its 강화', async () => {
    const g = makeGameStore(memoryStore(), fakeServer());
    const s = await g.load();
    const before = s.heroes.armory.weapons.length;
    const w = { id: 'cw-1-1', type: 'bow' as const, materialTier: 2, quality: 3 as const, element: null, enchants: [], unique: null };
    await g.stockWeapon(w);
    await g.stockWeapon(w);
    expect(g.get()!.heroes.armory.weapons).toHaveLength(before + 1);
    const h = g.get()!.heroes;
    g.setHeroes({ ...h, armory: { ...h.armory, weapons: h.armory.weapons.map((x) => (x.id === w.id ? { ...x, enhance: 2 } : x)) } });
    await g.stockWeapon({ ...w, element: 'water' as const, enchants: ['combo' as const] });
    const item = g.get()!.heroes.armory.weapons.find((x) => x.id === w.id);
    expect(item).toMatchObject({ element: 'water', enchants: ['combo'], enhance: 2, materialTier: 2, quality: 3 });
    expect(g.get()!.heroes.armory.weapons).toHaveLength(before + 1);
  });
});

describe('the made-up ranking group (8.3 흉내)', () => {
  it('about 100, ranked by the sim, the same for a day, and a window round the player', () => {
    const me = { stage: 4, damage: 12345, best: 12, level: 10 };
    const a = mockGroup(5, me, 5);
    expect(a).toHaveLength(100);
    expect(a.filter((r) => r.me)).toHaveLength(1);
    expect(mockGroup(5, me, 5)).toEqual(a);
    for (let i = 1; i < a.length; i++) {
      const p = a[i - 1]!;
      const q = a[i]!;
      expect(p.stage > q.stage || (p.stage === q.stage && p.damage >= q.damage)).toBe(true);
    }
    const w = rankWindow(a, 5, 2);
    expect(w.filter((x) => x !== 'gap' && x.me)).toHaveLength(1);
    expect(w.length).toBeLessThanOrEqual(5 + 5 + 2);
  });
});
