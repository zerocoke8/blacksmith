import { describe, expect, it } from 'vitest';
import { ROW_BONUS, RESONANCE_MULT, SIGNATURE_GAUGE, STAGE_TIME_LIMIT_TICKS } from '../data/battle.ts';
import { ACTIVE_SKILLS, type SkillSpec, SIGNATURES, STAR_STEP_COPIES } from '../data/heroes.ts';
import { addCopies, addWeapon, equipWeapon, newArmory, newHeroesState, type HeroesState, weaponCombat, type WeaponItem } from '../hero/index.ts';
import { type BattleEvent, type BattleSetup, type EnemyUnit, type HeroUnit, mitigation, runBattle } from './battle.ts';
import type { Formation } from './formation.ts';
import { buildTeam, teamFingerprint, teamPower } from './team.ts';

const IDLE_SKILL: SkillSpec = { id: 'none', name: '없음', effect: { kind: 'hit', targets: 1, hits: 1, power: 0 }, cooldownTicks: 1_000_000 };

function hero(n: number, over: Partial<HeroUnit> = {}): HeroUnit {
  return {
    id: `h${n}`,
    heroKey: 'hero_rookie',
    name: `용사${n}`,
    row: 'front',
    role: 'melee',
    element: 'earth',
    maxHp: 1000,
    atk: 100,
    pen: 100,
    def: 0,
    crit: 0,
    critDamage: 1.5,
    intervalTicks: 10,
    weapon: weaponCombat(null, 'oneHandSword'),
    rowBonus: 1,
    active: IDLE_SKILL,
    activeCooldown: 1_000_000,
    passive: null,
    signature: null,
    ...over,
  };
}

function enemy(n: number, over: Partial<EnemyUnit> = {}): EnemyUnit {
  return {
    id: `e${n}`,
    key: 'mon_humanoid_fire',
    name: '불씨 고블린',
    body: 'armored', // ○ for a one-handed sword: no body bonus unless a test asks
    element: 'fire',
    boss: false,
    maxHp: 1_000_000,
    atk: 10,
    pen: 10,
    def: 0,
    crit: 0,
    critDamage: 1.5,
    intervalTicks: 10,
    ...over,
  };
}

function setup(heroes: HeroUnit[], enemies: EnemyUnit[], over: Partial<BattleSetup> = {}): BattleSetup {
  return { heroes, enemies, limitTicks: STAGE_TIME_LIMIT_TICKS, seed: 7, key: ['battle', 'test', 1], ...over };
}

const hits = (events: BattleEvent[], src?: string) =>
  events.filter((e): e is Extract<BattleEvent, { kind: 'hit' }> => e.kind === 'hit' && (src === undefined || e.src === src));

/** A normal attack's damage with this weapon against this enemy (def 0, so no mitigation). */
function firstHit(w: Partial<ReturnType<typeof weaponCombat>>, e: Partial<EnemyUnit>, h: Partial<HeroUnit> = {}): Extract<BattleEvent, { kind: 'hit' }> {
  // The hero's own element differs from the weapon's unless a test says so (no resonance by accident).
  const own = w.element === 'water' ? 'wind' : 'water';
  const r = runBattle(setup([hero(0, { element: own, weapon: { ...weaponCombat(null, 'oneHandSword'), ...w }, ...h })], [enemy(0, e)], { limitTicks: 1 }));
  const first = hits(r.events, 'h0')[0];
  if (first === undefined) throw new Error('no hit');
  return first;
}

describe('battle: determinism (CLAUDE.md 규칙 1)', () => {
  it('gives the same event list for the same input, and (rolling crits) another for another seed', () => {
    const make = () => setup([hero(0, { crit: 0.5 }), hero(1, { crit: 0.5, row: 'back' })], [enemy(0, { maxHp: 5000, atk: 50, pen: 50 }), enemy(1, { maxHp: 5000 })], { critMode: 'roll' });
    const a = runBattle(make());
    const b = runBattle(make());
    expect(b).toEqual(a);
    expect(a.events.length).toBeGreaterThan(50);
    const c = runBattle({ ...make(), seed: 8 });
    expect(hits(c.events).map((e) => e.crit)).not.toEqual(hits(a.events).map((e) => e.crit));
  });

  it('needs no randomness in gauge mode: crits fall on a fixed count', () => {
    const r = runBattle(setup([hero(0, { crit: 0.25 })], [enemy(0)], { critMode: 'gauge', limitTicks: 200 }));
    const crits = hits(r.events, 'h0').map((e) => e.crit);
    expect(crits.slice(0, 8)).toEqual([false, false, false, true, false, false, false, true]);
    expect(runBattle({ ...setup([hero(0, { crit: 0.25 })], [enemy(0)], { critMode: 'gauge', limitTicks: 200 }), seed: 99 }).events).toEqual(r.events);
  });
});

describe('battle: targets (6.3 적은 앞열부터 친다)', () => {
  it('hits the front row in turn and the back row only once the front is down', () => {
    const heroes = [hero(0, { maxHp: 50 }), hero(1, { maxHp: 50 }), hero(2, { row: 'back', maxHp: 50 })];
    const r = runBattle(setup(heroes, [enemy(0, { atk: 20, pen: 20 })]));
    const onHeroes = hits(r.events).filter((e) => e.src === 'e0').map((e) => e.dst);
    // h0, h1, h0, h1, h0 (down at 50) … then h1 alone, then the back row.
    expect(onHeroes.slice(0, 4)).toEqual(['h0', 'h1', 'h0', 'h1']);
    const firstBack = onHeroes.indexOf('h2');
    const downs = r.events.filter((e) => e.kind === 'down').map((e) => (e as { unit: string }).unit);
    expect(downs.slice(0, 2).sort()).toEqual(['h0', 'h1']);
    expect(firstBack).toBeGreaterThan(onHeroes.lastIndexOf('h1'));
    expect(r.outcome).toBe('wiped');
  });

  it('spreads monsters over the front row from their own place', () => {
    const r = runBattle(setup([hero(0), hero(1)], [enemy(0), enemy(1)], { limitTicks: 11 }));
    const firsts = hits(r.events).filter((e) => e.src.startsWith('e'));
    expect(firsts.map((e) => `${e.src}>${e.dst}`)).toEqual(['e0>h0', 'e1>h1']);
  });

  it('hits the front-most living monster with a normal attack', () => {
    const r = runBattle(setup([hero(0)], [enemy(0, { maxHp: 150 }), enemy(1)], { limitTicks: 40 }));
    expect(hits(r.events, 'h0').map((e) => e.dst)).toEqual(['e0', 'e0', 'e1', 'e1']);
  });
});

describe('battle: matchups (6.5, 6.6)', () => {
  it('uses the weapon element: ×1.3 / ×1.0 / ×0.75, none ×1', () => {
    expect(firstHit({ element: 'water' }, { element: 'fire' })).toMatchObject({ elementMult: 1.3, amount: 130 });
    expect(firstHit({ element: 'wind' }, { element: 'fire' })).toMatchObject({ elementMult: 1, amount: 100 });
    expect(firstHit({ element: 'earth' }, { element: 'fire' })).toMatchObject({ elementMult: 0.75, amount: 75 });
    expect(firstHit({ element: 'fire' }, { element: 'fire' })).toMatchObject({ elementMult: 0.75 });
    expect(firstHit({ element: null }, { element: 'fire' })).toMatchObject({ elementMult: 1, amount: 100 });
    // 속성 증폭 adds to the advantage only.
    expect(firstHit({ element: 'water', advantageAdd: 0.3 }, { element: 'fire' }).amount).toBe(160);
  });

  it('uses the weapon type against the body, and an element lifts spirit △ to ○', () => {
    expect(firstHit({}, { body: 'humanoid' }).bodyMult).toBe(1.3);
    expect(firstHit({}, { body: 'flying' }).bodyMult).toBe(0.75);
    expect(firstHit({}, { body: 'spirit' }).bodyMult).toBe(0.75);
    expect(firstHit({ element: 'wind' }, { body: 'spirit', element: 'fire' }).bodyMult).toBe(1);
    expect(firstHit({ ...weaponCombat(null, 'staff') }, { body: 'spirit' }).bodyMult).toBe(1.3);
    expect(firstHit({ badBodyMult: 0.875 }, { body: 'flying' }).bodyMult).toBe(0.875);
    expect(firstHit({ allPierce: true }, { body: 'flying' }).bodyMult).toBe(1);
  });

  it('adds resonance when the weapon element is the hero element', () => {
    const plain = firstHit({ element: 'wind' }, { element: 'fire', body: 'armored' }, { element: 'earth' }).amount;
    const res = firstHit({ element: 'wind' }, { element: 'fire', body: 'armored' }, { element: 'wind' }).amount;
    expect(res).toBe(Math.round(plain * RESONANCE_MULT));
  });

  it('weighs defence against the attacker: pen ÷ (pen + def)', () => {
    expect(mitigation(100, 100)).toBe(0.5);
    expect(mitigation(100, 0)).toBe(1);
    expect(firstHit({}, { def: 100, body: 'armored' }).amount).toBe(50);
  });

  it('crits for ×critDamage', () => {
    const r = runBattle(setup([hero(0, { crit: 1, critDamage: 1.5 })], [enemy(0, { body: 'armored' })], { limitTicks: 1 }));
    expect(hits(r.events, 'h0')[0]).toMatchObject({ crit: true, amount: 150 });
  });
});

describe('battle: skills, healing, signature', () => {
  it('casts the active skill on its cooldown', () => {
    const skill = ACTIVE_SKILLS.oneHandSword;
    const r = runBattle(setup([hero(0, { active: skill, activeCooldown: skill.cooldownTicks })], [enemy(0, { body: 'armored' })], { limitTicks: 200 }));
    const casts = r.events.filter((e) => e.kind === 'cast');
    expect(casts.length).toBeGreaterThanOrEqual(3);
    expect(casts.map((e) => e.t)).toEqual([30, 90, 150].slice(0, casts.length));
    const skillHit = hits(r.events, 'h0').find((e) => e.via === 'skill');
    expect(skillHit?.amount).toBe(240);
  });

  it('spreads a sweep over the front three', () => {
    const skill = ACTIVE_SKILLS.greatsword;
    const r = runBattle(setup([hero(0, { active: skill, activeCooldown: 10 })], [enemy(0), enemy(1), enemy(2), enemy(3)], { limitTicks: 5 }));
    expect(hits(r.events, 'h0').filter((e) => e.via === 'skill').map((e) => e.dst)).toEqual(['e0', 'e1', 'e2']);
  });

  it('heals the hurt, never past max HP, and only when someone is hurt', () => {
    const heal = ACTIVE_SKILLS.healer;
    const healer = hero(1, { row: 'back', role: 'healer', active: heal, activeCooldown: 20, atk: 1, pen: 1 });
    const quiet = runBattle(setup([hero(0), healer], [enemy(0, { atk: 0, pen: 1 })], { limitTicks: 100 }));
    expect(quiet.events.some((e) => e.kind === 'heal')).toBe(false);
    const r = runBattle(setup([hero(0, { maxHp: 1000 }), healer], [enemy(0, { atk: 60, pen: 60, intervalTicks: 5 })], { limitTicks: 300 }));
    const heals = r.events.filter((e): e is Extract<BattleEvent, { kind: 'heal' }> => e.kind === 'heal');
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) {
      expect(h.amount).toBeGreaterThan(0);
      expect(h.amount).toBeLessThanOrEqual(150);
      expect(h.hpAfter).toBeLessThanOrEqual(1000);
    }
  });

  it('fires the signature when its gauge is full', () => {
    const sig = SIGNATURES.oneHandSword;
    const r = runBattle(setup([hero(0, { signature: { skill: sig, mult: 1.5 } })], [enemy(0, { body: 'armored' })], { limitTicks: 300 }));
    const casts = r.events.filter((e) => e.kind === 'cast' && e.via === 'signature');
    expect(casts.length).toBeGreaterThan(0);
    // perTick × t + perAttack × attacks reaches full first around 10 s.
    const t = (casts[0] as { t: number }).t;
    expect(t).toBeLessThan(SIGNATURE_GAUGE.full / SIGNATURE_GAUGE.perTick);
    expect(hits(r.events, 'h0').find((e) => e.via === 'signature')?.amount).toBe(900);
  });

  it('applies opener, boss and lastStand passives', () => {
    const opener = runBattle(setup([hero(0, { passive: { name: 'x', kind: 'opener', value: 2 } })], [enemy(0, { body: 'armored' })], { limitTicks: 15 }));
    expect(hits(opener.events, 'h0').map((e) => e.amount)).toEqual([300, 100]);
    const boss = firstHit({}, { boss: true, body: 'armored' }, { passive: { name: 'x', kind: 'boss', value: 0.2 } });
    expect(boss.amount).toBe(120);
  });
});

describe('battle: the end', () => {
  it('times out at the limit with monsters standing', () => {
    const r = runBattle(setup([hero(0)], [enemy(0)]));
    expect(r.outcome).toBe('timeout');
    expect(r.ticks).toBe(STAGE_TIME_LIMIT_TICKS);
    expect(r.events[r.events.length - 1]).toEqual({ t: STAGE_TIME_LIMIT_TICKS, kind: 'end', outcome: 'timeout' });
  });

  it('wins when every monster is down and counts damage without overkill', () => {
    const r = runBattle(setup([hero(0)], [enemy(0, { maxHp: 250, body: 'armored' })]));
    expect(r.outcome).toBe('win');
    expect(r.damageDealt).toBe(250);
    expect(r.enemyHp.e0).toBe(0);
    expect(r.events.filter((e) => e.kind === 'down')).toHaveLength(1);
  });

  it('is wiped when every hero is down', () => {
    const r = runBattle(setup([hero(0, { maxHp: 30 })], [enemy(0, { atk: 50, pen: 50 })]));
    expect(r.outcome).toBe('wiped');
  });
});

describe('team (6.3, 6.4)', () => {
  function heroesWith(keys: readonly (typeof formationKeys)[number][], copies = 1): HeroesState {
    const s = newHeroesState();
    let a = newArmory();
    for (const k of keys) {
      s.roster = addCopies(s.roster, k, copies).roster;
    }
    const w: WeaponItem = { id: 'sword', type: 'oneHandSword', materialTier: 1, quality: 1, element: null, enchants: [], unique: null, enhance: 0 };
    a = equipWeapon(addWeapon(a, w), 'hero_rookie', 'sword');
    s.armory = a;
    return s;
  }
  const formationKeys = ['hero_rookie', 'hero_bri', 'hero_tori', 'hero_tessa', 'hero_som', 'hero_vail', 'hero_mora'] as const;

  it('gives the row bonus to melee in front and ranged and healers behind', () => {
    const s = heroesWith(formationKeys);
    const f: Formation = { front: ['hero_rookie', 'hero_tori'], back: ['hero_bri', 'hero_tessa', 'hero_som'] };
    const team = buildTeam(s, f);
    const bonus = Object.fromEntries(team.map((u) => [u.heroKey, u.rowBonus]));
    expect(bonus).toEqual({ hero_rookie: ROW_BONUS, hero_tori: 1, hero_bri: 1, hero_tessa: ROW_BONUS, hero_som: ROW_BONUS });
    expect(team.map((u) => u.id)).toEqual(['h0', 'h1', 'h2', 'h3', 'h4']);
    // The held sword counts; the others fight bare-handed.
    expect(team[0]?.atk).toBeGreaterThan(team[2]?.atk ?? 0);
    expect(teamPower(team)).toBeGreaterThan(0);
  });

  it('keeps a normal hero\'s passive shut until gold; specials have theirs and team passives reach all', () => {
    const s = heroesWith(formationKeys);
    const f: Formation = { front: ['hero_rookie', 'hero_vail'], back: ['hero_mora'] };
    const team = buildTeam(s, f);
    expect(team[0]?.passive).toBeNull();
    expect(team[1]?.passive?.kind).toBe('lastStand');
    expect(team[1]?.signature).toBeNull();
    const plain = buildTeam(s, { front: ['hero_rookie', 'hero_vail'], back: [] });
    // 모라 (teamHp +10%) lifts everyone.
    expect(team[0]?.maxHp).toBe(Math.round((plain[0]?.maxHp ?? 0) * 1.1));
    const gold = heroesWith(formationKeys, 1 + 15 * STAR_STEP_COPIES.normal);
    expect(buildTeam(gold, { front: ['hero_rookie'], back: [] })[0]?.passive?.kind).toBe('def');
    const red = heroesWith(['hero_vail'], 1 + 20 * STAR_STEP_COPIES.special);
    expect(buildTeam(red, { front: ['hero_vail'], back: [] })[0]?.signature?.mult).toBe(1.5);
  });

  it('changes the fingerprint when level, stars, rows or weapons change', () => {
    const s = heroesWith(formationKeys);
    const f: Formation = { front: ['hero_rookie'], back: ['hero_tori'] };
    const base = teamFingerprint(buildTeam(s, f));
    expect(teamFingerprint(buildTeam(s, f))).toBe(base);
    expect(teamFingerprint(buildTeam({ ...s, level: { level: 2, exp: 0 } }, f))).not.toBe(base);
    expect(teamFingerprint(buildTeam(s, { front: ['hero_rookie', 'hero_tori'], back: [] }))).not.toBe(base);
    expect(teamFingerprint(buildTeam({ ...s, roster: addCopies(s.roster, 'hero_tori', 13).roster }, f))).not.toBe(base);
    expect(() => buildTeam(s, { front: [], back: [] })).toThrow();
  });
});
