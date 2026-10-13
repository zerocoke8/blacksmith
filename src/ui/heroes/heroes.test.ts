import { describe, expect, it } from 'vitest';
import { HEROES, heroSpec } from '../../sim/data/heroes.ts';
import { addCopies, copiesForStar, type HeroRoster } from '../../sim/hero/index.ts';
import { formationProblemText } from '../../sim/stage/index.ts';
import { checkFormation, memberCount, moveMember, placeOf, sameFormation, toggleMember } from './formationEdit.ts';
import { filterCount, heroCardView, heroList, NO_FILTER } from './view.ts';

describe('a hero card shows (5.9)', () => {
  it('the star row, the copies toward the next step and the evolution colour', () => {
    let roster: HeroRoster = {};
    roster = addCopies(roster, 'hero_vail', 1 + 4).roster; // 특급 5 a step: 동별 1, 4/5
    const v = heroCardView(roster, 'hero_vail');
    expect(v).toMatchObject({ owned: true, special: true, mark: 'bronze', pips: 1, have: 4, need: 5, barText: '4/5', color: 'purple' });
    roster = addCopies(roster, 'hero_rookie', 1 + 13 * 2 + 3).roster; // 일반 13 a step: 동별 3, 3/13
    expect(heroCardView(roster, 'hero_rookie')).toMatchObject({ mark: 'bronze', pips: 3, barText: '3/13', special: false });
  });

  it('gold from 달 1 (passive opens for a normal, the signature for a special), red from 해 1, and the end', () => {
    const r1 = { hero_rookie: copiesForStar('normal', 15) };
    expect(heroCardView(r1, 'hero_rookie')).toMatchObject({ mark: 'moon', pips: 1, color: 'gold', passiveOpen: true, signature: null });
    const r2 = { hero_vail: copiesForStar('special', 20) };
    expect(heroCardView(r2, 'hero_vail')).toMatchObject({ mark: 'sun', color: 'red', signature: 'strong' });
    const r3 = { hero_vail: copiesForStar('special', 24) + 50 };
    expect(heroCardView(r3, 'hero_vail')).toMatchObject({ atMax: true, barText: '끝', ratio: 1 });
  });

  it('an unowned hero: dimmed, nothing collected', () => {
    expect(heroCardView({}, 'hero_nea')).toMatchObject({ owned: false, have: 0, ratio: 0, starIndex: -1 });
  });
});

describe('the list: tabs, sorting, filters (5.9)', () => {
  const roster: HeroRoster = { hero_rookie: 30, hero_vail: 1, hero_yuna: 12 };

  it('puts owned heroes first, the higher star first', () => {
    const list = heroList(roster, { tab: 'all', sort: 'star', filter: NO_FILTER });
    expect(list).toHaveLength(HEROES.length);
    expect(list.slice(0, 3).map((c) => c.key)).toEqual(['hero_yuna', 'hero_rookie', 'hero_vail']);
  });

  it('tabs split specials and normals; filters by element, weapon and role', () => {
    expect(heroList(roster, { tab: 'special', sort: 'star', filter: NO_FILTER }).every((c) => c.special)).toBe(true);
    expect(heroList(roster, { tab: 'normal', sort: 'star', filter: NO_FILTER })).toHaveLength(12);
    const healers = heroList(roster, { tab: 'all', sort: 'role', filter: { ...NO_FILTER, role: 'healer' } });
    expect(healers.map((c) => c.key).sort()).toEqual(['hero_mora', 'hero_som', 'hero_yuna']);
    const f = { element: 'fire' as const, weapon: 'staff' as const, role: null };
    expect(heroList(roster, { tab: 'all', sort: 'element', filter: f }).map((c) => c.key).sort()).toEqual(['hero_karel', 'hero_nono']);
    expect(filterCount(f)).toBe(2);
  });
});

describe('editing a formation (6.3, 사용자 결정 11)', () => {
  const roster: HeroRoster = Object.fromEntries(HEROES.map((h) => [h.key, 1]));

  it('a hero tapped joins the row their role suits, the other when it is full, and leaves on a second tap', () => {
    let f = { front: [], back: [] } as { front: (typeof HEROES)[number]['key'][]; back: (typeof HEROES)[number]['key'][] };
    f = toggleMember(f, 'hero_rookie').formation;
    f = toggleMember(f, 'hero_tori').formation;
    expect(f).toEqual({ front: ['hero_rookie'], back: ['hero_tori'] });
    for (const k of ['hero_nea', 'hero_milo', 'hero_toma'] as const) f = toggleMember(f, k).formation;
    expect(f.back).toHaveLength(4);
    expect(memberCount(f)).toBe(5);
    expect(toggleMember(f, 'hero_bri').note).toBe('full');
    f = toggleMember(f, 'hero_toma').formation;
    expect(placeOf(f, 'hero_toma')).toBeNull();
    // Back row full (4): the next ranged hero stands in front.
    f = { front: [], back: ['hero_tori', 'hero_nea', 'hero_milo', 'hero_toma'] };
    expect(toggleMember(f, 'hero_hob').formation.front).toEqual(['hero_hob']);
  });

  it('a hero moved onto another swaps with them; onto an empty place joins that row', () => {
    const f = { front: ['hero_rookie', 'hero_bri'] as const, back: ['hero_tori'] as const };
    const base = { front: [...f.front], back: [...f.back] };
    expect(moveMember(base, 'hero_rookie', { row: 'back', index: 0 })).toEqual({ front: ['hero_tori', 'hero_bri'], back: ['hero_rookie'] });
    expect(moveMember(base, 'hero_rookie', { row: 'back', index: 3 })).toEqual({ front: ['hero_bri'], back: ['hero_tori', 'hero_rookie'] });
    expect(moveMember(base, 'hero_rookie', { row: 'front', index: 1 })).toEqual({ front: ['hero_bri', 'hero_rookie'], back: ['hero_tori'] });
    const full = { front: ['hero_rookie'], back: ['hero_tori', 'hero_nea', 'hero_milo', 'hero_toma'] } as typeof base;
    expect(moveMember(full, 'hero_rookie', { row: 'back', index: 9 })).toBe(full);
  });

  it('checks with the sim: can fight, the problems, who stands off their row', () => {
    const ok = checkFormation({ front: ['hero_rookie', 'hero_tori'], back: ['hero_som'] }, roster, formationProblemText);
    expect(ok.canFight).toBe(true);
    expect(ok.offRow).toEqual(['hero_tori']);
    const bad = checkFormation({ front: [], back: [] }, roster, formationProblemText);
    expect(bad.canFight).toBe(false);
    expect(bad.problems).toEqual(['아무도 서 있지 않다.']);
    const notOwned = checkFormation({ front: ['hero_odel'], back: [] }, { hero_rookie: 1 }, formationProblemText);
    expect(notOwned.problems[0]).toContain(heroSpec('hero_odel').name);
    expect(sameFormation({ front: ['hero_rookie'], back: [] }, { front: ['hero_rookie'], back: [] })).toBe(true);
  });
});

describe('추천 편성 (6.3, 16장의 28번)', () => {
  it('the five strongest in the rows their roles suit, a healer kept in, four a row at most', async () => {
    const { recommendedFormation } = await import('./formationEdit.ts');
    const owned = ['hero_rookie', 'hero_bri', 'hero_shu', 'hero_tori', 'hero_hob', 'hero_som', 'hero_vail', 'hero_nea', 'hero_karel'] as const;
    const power: Record<string, number> = { hero_vail: 900, hero_nea: 880, hero_karel: 870, hero_rookie: 500, hero_bri: 520, hero_shu: 480, hero_tori: 470, hero_hob: 460, hero_som: 200 };
    const f = recommendedFormation(owned, (k) => power[k] ?? 0);
    expect(f.front).toEqual(['hero_vail', 'hero_bri']);
    // 솜 (the healer) takes the fifth place (비코, 500).
    expect(f.back).toEqual(['hero_nea', 'hero_karel', 'hero_som']);
    expect(memberCount(f)).toBe(5);
    // Five ranged: four behind, the weakest non-healer goes in front.
    const ranged = ['hero_tori', 'hero_hob', 'hero_otto', 'hero_tessa', 'hero_som'] as const;
    const g = recommendedFormation(ranged, (k) => 1000 - ranged.indexOf(k as (typeof ranged)[number]));
    expect(g.back).toHaveLength(4);
    expect(g.back).toContain('hero_som');
    expect(g.front).toEqual(['hero_tessa']);
    // Fewer than five owned: all of them.
    expect(memberCount(recommendedFormation(['hero_rookie', 'hero_tori'], () => 1))).toBe(2);
  });
});
