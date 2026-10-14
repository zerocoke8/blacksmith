import { describe, expect, it } from 'vitest';
import {
  ATTACK_SPEED_REF_TICKS,
  CAST_SWING_PAUSE_TICKS,
  CRIT_MODE,
  HERO_ATTACK_INTERVAL_TICKS,
  ROW_BONUS,
  RESONANCE_MULT,
  SIGNATURE_GAUGE,
  STAGE_TIME_LIMIT_TICKS,
  type StatusSpec,
} from '../data/battle.ts';
import { ACTIVE_SKILLS, type SkillSpec, SIGNATURES, STAR_STEP_COPIES } from '../data/heroes.ts';
import { DAILY_BOSS_ROAR } from '../data/monsters.ts';
import { addCopies, addWeapon, equipWeapon, heroPower, newArmory, newHeroesState, type HeroesState, weaponCombat, type WeaponItem } from '../hero/index.ts';
import {
  type BattleEvent,
  type BattleSetup,
  type EnemyUnit,
  type HeroUnit,
  mitigation,
  runBattle,
  startBattle,
} from './battle.ts';
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

const casts = (events: BattleEvent[], src?: string) =>
  events.filter((e): e is Extract<BattleEvent, { kind: 'cast' }> => e.kind === 'cast' && (src === undefined || e.src === src));

const statuses = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { kind: 'status' }> => e.kind === 'status');

/** The ticks of a fighter's normal attacks. */
const attackTicks = (events: BattleEvent[], src: string) => hits(events, src).filter((e) => e.via === 'attack').map((e) => e.t);

const gapsOf = (ts: readonly number[]) => ts.slice(1).map((t, i) => t - (ts[i] as number));

/** A skill that only puts a status on (a hit of power 0 on the front monster: 1 damage). */
function statusSkill(id: string, status: StatusSpec): SkillSpec {
  return { id, name: id, effect: { kind: 'hit', targets: 1, hits: 1, power: 0, status }, cooldownTicks: 0 };
}

const cheer = (ticks: number, id = 'cheer') => statusSkill(id, { stat: 'atkSpeed', mult: 2, ticks, on: 'allies' });

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

  it('rolls crits by default (사용자 결정 2026-10-14 확률 방식)', () => {
    expect(CRIT_MODE).toBe('roll');
    const crits = hits(runBattle(setup([hero(0, { crit: 0.25 })], [enemy(0)], { limitTicks: 200 })).events, 'h0').map((e) => e.crit);
    const gauge = hits(runBattle(setup([hero(0, { crit: 0.25 })], [enemy(0)], { critMode: 'gauge', limitTicks: 200 })).events, 'h0').map((e) => e.crit);
    expect(crits.filter(Boolean).length).toBeGreaterThan(0);
    expect(crits).not.toEqual(gauge);
  });
});

describe('battle: stepping and inputs (13장: the server replays a battle)', () => {
  const sig = { skill: SIGNATURES.oneHandSword, mult: 1 };

  it('steps tick by tick to the same battle runBattle gives', () => {
    const make = (): BattleSetup =>
      setup(
        [hero(0, { crit: 0.3, signature: sig }), hero(1, { row: 'back', crit: 0.3, intervalTicks: 7 })],
        [enemy(0, { maxHp: 20_000, atk: 30, pen: 30 }), enemy(1, { maxHp: 20_000, skill: { id: 'roar', name: '쿵', firstTick: 50, everyTicks: 60, status: { stat: 'atkSpeed', mult: 0.8, ticks: 20, on: 'foes' } } })],
        { critMode: 'roll' },
      );
    const run = startBattle(make());
    expect([run.tick, run.done]).toEqual([0, false]);
    const stepped: BattleEvent[] = [];
    while (!run.done) {
      const events = run.step();
      for (const e of events) expect(e.t).toBe(run.tick);
      stepped.push(...events);
    }
    expect(run.step()).toEqual([]);
    const all = runBattle(make());
    expect(stepped).toEqual(all.events);
    expect(run.result()).toEqual(all);
    expect(stepped[stepped.length - 1]).toMatchObject({ kind: 'end' });
  });

  it('has no result before the end', () => {
    const run = startBattle(setup([hero(0)], [enemy(0)]));
    run.step();
    expect(() => run.result()).toThrow();
  });

  it('replays the inputs to the same battle', () => {
    const make = (): BattleSetup =>
      setup([hero(0, { crit: 0.3, signature: sig }), hero(1, { crit: 0.3, signature: sig })], [enemy(0, { atk: 30, pen: 30 })], { critMode: 'roll', signatures: 'manual' });
    const run = startBattle(make());
    // h0's gauge is full at about 15 s (tapped by hand); h1's goes off by itself once auto is on.
    while (!run.done) {
      if (run.gauge('h0').ready) run.order('h0');
      if (run.tick === 200) run.setAuto(true);
      if (run.tick === 260) run.setAuto(false);
      run.step();
    }
    const live = run.result();
    // A fight begun by hand says so first: the server rebuilds the setup without the device's switch.
    expect(live.inputs.map((i) => i.kind)).toEqual(['auto', 'cast', 'auto', 'auto']);
    expect(live.inputs[0]).toEqual({ t: 1, kind: 'auto', on: false });
    expect(live.inputs).toEqual(run.inputs);
    expect(runBattle({ ...make(), inputs: live.inputs })).toEqual(live);
    const { signatures: _device, ...server } = make();
    expect(runBattle({ ...server, inputs: live.inputs })).toEqual(live);
    // Without them it is another battle.
    expect(runBattle(make()).events).not.toEqual(live.events);
  });
});

describe('battle: signatures by hand (사용자 결정 2026-10-14)', () => {
  const sig = { skill: SIGNATURES.oneHandSword, mult: 1 };
  const isSignature = (e: BattleEvent) => e.kind === 'cast' && e.via === 'signature';

  it('waits with a full gauge in manual mode', () => {
    const run = startBattle(setup([hero(0, { signature: sig })], [enemy(0)], { signatures: 'manual' }));
    expect(run.auto).toBe(false);
    while (run.tick < 250) run.step();
    expect(run.gauge('h0')).toEqual({ has: true, share: 1, ready: true });
    while (!run.done) run.step();
    expect(run.result().events.some(isSignature)).toBe(false);
    expect(run.gauge('h0').ready).toBe(false);
  });

  it('fires on the tick after the tap; a tap before the gauge is full is dropped', () => {
    const run = startBattle(setup([hero(0, { signature: sig })], [enemy(0)], { signatures: 'manual' }));
    for (let i = 0; i < 5; i++) run.step();
    run.order('h0');
    run.order('h0'); // the same tap twice is one input
    expect(run.inputs).toEqual([
      { t: 1, kind: 'auto', on: false },
      { t: 6, kind: 'cast', unit: 'h0' },
    ]);
    while (!run.gauge('h0').ready) expect(run.step().some(isSignature)).toBe(false);
    for (let i = 0; i < 20; i++) expect(run.step().some(isSignature)).toBe(false);
    run.order('h0');
    const t = run.tick + 1;
    const events = run.step();
    expect(events.filter((e) => e.kind === 'cast').map((e) => [e.t, (e as { via: string }).via])).toEqual([[t, 'signature']]);
    expect(run.gauge('h0').share).toBe(0);
    expect(run.inputs.map((i) => i.t)).toEqual([1, 6, t]);
    // The cast stops the swing for a moment: no blow during the pause, then the swing goes on.
    const after: BattleEvent[] = [];
    while (run.tick < t + CAST_SWING_PAUSE_TICKS.signature + 10) after.push(...run.step());
    const next = attackTicks(after, 'h0');
    expect(next.every((x) => x > t + CAST_SWING_PAUSE_TICKS.signature)).toBe(true);
    expect(next).toHaveLength(1);
  });

  it('ignores a tap on a hero without a signature, or one not in the battle', () => {
    const run = startBattle(setup([hero(0), hero(1, { signature: sig })], [enemy(0)], { signatures: 'manual' }));
    run.order('h0');
    run.order('e0');
    run.order('h9');
    expect(run.inputs).toEqual([{ t: 1, kind: 'auto', on: false }]);
    expect(run.gauge('h0')).toEqual({ has: false, share: 0, ready: false });
    expect(run.gauge('h1').has).toBe(true);
  });

  it('turns auto on and off from the next tick', () => {
    const run = startBattle(setup([hero(0, { signature: sig })], [enemy(0)], { signatures: 'manual', limitTicks: 400 }));
    while (!run.gauge('h0').ready) run.step();
    run.step();
    run.setAuto(true);
    expect(run.auto).toBe(true);
    const t = run.tick + 1;
    expect(run.step().some(isSignature)).toBe(true);
    expect(run.inputs).toEqual([
      { t: 1, kind: 'auto', on: false },
      { t, kind: 'auto', on: true },
    ]);
    run.setAuto(true); // no change, no input
    expect(run.inputs).toHaveLength(2);
    run.setAuto(false);
    expect(run.auto).toBe(false);
    while (!run.done) run.step();
    // The gauge filled again before the end, but manual mode let it wait.
    expect(run.result().events.filter(isSignature)).toHaveLength(1);
    expect(run.gauge('h0').share).toBe(1);
  });
});

describe('battle: attack speed (사용자 결정 2026-10-14)', () => {
  it('gives each weapon its rhythm and every weapon the same normal-attack damage a second', () => {
    const fast = HERO_ATTACK_INTERVAL_TICKS.dagger;
    const slow = HERO_ATTACK_INTERVAL_TICKS.crossbow;
    expect(fast).toBeLessThan(slow);
    const span = fast * slow;
    const r = runBattle(setup([hero(0, { intervalTicks: fast }), hero(1, { intervalTicks: slow })], [enemy(0, { body: 'armored' })], { limitTicks: 3 + span }));
    const inSpan = (src: string) => {
      const mine = hits(r.events, src);
      const first = (mine[0] as { t: number }).t;
      return mine.filter((e) => e.t > first && e.t <= first + span);
    };
    const quick = inSpan('h0');
    const heavy = inSpan('h1');
    expect([quick.length, heavy.length]).toEqual([span / fast, span / slow]);
    expect(quick[0]?.amount).toBe(Math.round((100 * fast) / ATTACK_SPEED_REF_TICKS));
    expect(heavy[0]?.amount).toBe(Math.round((100 * slow) / ATTACK_SPEED_REF_TICKS));
    const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
    expect(sum(quick)).toBe(sum(heavy));
    // The first blows still land on 1 + slot × 2.
    expect([hits(r.events, 'h0')[0]?.t, hits(r.events, 'h1')[0]?.t]).toEqual([1, 3]);
  });

  it('swings faster with more attack speed', () => {
    const r = runBattle(setup([hero(0, { atkSpeed: 2 })], [enemy(0)], { limitTicks: 30 }));
    expect(attackTicks(r.events, 'h0')).toEqual([1, 6, 11, 16, 21, 26]);
  });

  it('fills the signature gauge by the blow\'s weight, so as fast for every weapon', () => {
    const run = startBattle(setup([hero(0, { signature: { skill: SIGNATURES.oneHandSword, mult: 1 }, intervalTicks: 15 })], [enemy(0)]));
    run.step(); // tick 1: a tick's worth and one blow
    const want = (SIGNATURE_GAUGE.perTick + (SIGNATURE_GAUGE.perAttack * 15) / ATTACK_SPEED_REF_TICKS) / SIGNATURE_GAUGE.full;
    expect(run.gauge('h0').share).toBeCloseTo(want, 12);
  });

  it('puts the next attack off by the cast pause after a skill', () => {
    const skill = ACTIVE_SKILLS.oneHandSword; // cooldown 60: first ready at 30, then 90
    const r = runBattle(setup([hero(0, { active: skill, activeCooldown: skill.cooldownTicks })], [enemy(0, { body: 'armored' })], { limitTicks: 120 }));
    expect(casts(r.events, 'h0').map((e) => e.t)).toEqual([30, 90]);
    // Without casts: 1, 11, 21, 31… Each cast holds the swing CAST_SWING_PAUSE_TICKS.skill (6) ticks.
    expect(CAST_SWING_PAUSE_TICKS.skill).toBe(6);
    expect(attackTicks(r.events, 'h0')).toEqual([1, 11, 21, 37, 47, 57, 67, 77, 87, 103, 113]);
  });

  it('costs every weapon the same time per cast, even when a cooldown is a multiple of the interval', () => {
    // 힘껏 베기 (60) on a sword (10) and 휘둘러 베기 (70) on a greatsword (14) would land on a due blow every
    // time; the pause takes the same ticks from each, so normal-attack damage a second stays even.
    const lost = (interval: number, cooldown: number) => {
      const skill = { ...ACTIVE_SKILLS.oneHandSword, effect: { kind: 'hit' as const, targets: 1, hits: 1, power: 0 }, cooldownTicks: cooldown };
      const run = (active: typeof skill | null) =>
        runBattle(setup([hero(0, { intervalTicks: interval, ...(active !== null ? { active, activeCooldown: cooldown } : {}) })], [enemy(0)], { limitTicks: 600, critMode: 'gauge' }));
      const dmg = (r: ReturnType<typeof runBattle>) => hits(r.events, 'h0').filter((e) => e.via === 'attack').reduce((n, e) => n + e.amount, 0);
      return 1 - dmg(run(skill)) / dmg(run(null));
    };
    const sword = lost(10, 60);
    const greatsword = lost(14, 70);
    const dagger = lost(7, 50);
    for (const x of [sword, greatsword, dagger]) expect(x).toBeGreaterThan(0.05);
    expect(Math.max(sword, greatsword, dagger) - Math.min(sword, greatsword, dagger)).toBeLessThan(0.04);
  });
});

describe('battle: statuses (사용자 결정 2026-10-14)', () => {
  it('puts a status on the caster\'s side and refreshes it from the same skill instead of stacking', () => {
    // h0 cheers (×2 for 100 s) on ticks 10, 30, 50, 70; h1 swings every 10 ticks, then every 5.
    const r = runBattle(setup([hero(0, { active: cheer(1000), activeCooldown: 20 }), hero(1)], [enemy(0)], { limitTicks: 80 }));
    const st = statuses(r.events);
    expect(st.filter((e) => e.t === 10).map((e) => [e.src, e.dst, e.stat, e.mult, e.until])).toEqual([
      ['h0', 'h0', 'atkSpeed', 2, 1010],
      ['h0', 'h1', 'atkSpeed', 2, 1010],
    ]);
    expect([...new Set(st.map((e) => e.t))]).toEqual([10, 30, 50, 70]);
    expect(attackTicks(r.events, 'h1')).toEqual([3, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76]);
  });

  it('multiplies statuses from different casters', () => {
    const r = runBattle(setup([hero(0, { active: cheer(1000), activeCooldown: 20 }), hero(1, { active: cheer(1000), activeCooldown: 20 }), hero(2)], [enemy(0)], { limitTicks: 60 }));
    // ×2 × ×2 from tick 10: 0.4 of a swing a tick, 20 blows in ticks 11~60 (×2 alone: 10).
    expect(attackTicks(r.events, 'h2').filter((t) => t > 10)).toHaveLength(20);
  });

  it('drops a status after its last tick', () => {
    // One cheer at tick 50 for 30 ticks: on through tick 80.
    const r = runBattle(setup([hero(0, { active: cheer(30), activeCooldown: 100 }), hero(1)], [enemy(0)], { limitTicks: 140 }));
    expect(statuses(r.events).map((e) => [e.t, e.dst, e.until])).toEqual([
      [50, 'h0', 80],
      [50, 'h1', 80],
    ]);
    expect(attackTicks(r.events, 'h1')).toEqual([3, 13, 23, 33, 43, 51, 56, 61, 66, 71, 76, 82, 92, 102, 112, 122, 132]);
  });

  it('slows the enemies a skill hit that still stand (땅 가르기)', () => {
    const split = SIGNATURES.greatsword;
    expect(split.effect.status).toMatchObject({ stat: 'atkSpeed', on: 'targets' });
    const run = startBattle(setup([hero(0, { signature: { skill: split, mult: 1 }, atk: 1000, pen: 1000 })], [enemy(0, { maxHp: 1e9 }), enemy(1, { maxHp: 2000 }), enemy(2, { maxHp: 1e9 })]));
    let cast: BattleEvent[] = [];
    while (!run.done && cast.length === 0) {
      const events = run.step();
      if (events.some((e) => e.kind === 'cast' && e.via === 'signature')) cast = events;
    }
    // e1 falls to the blow (it had taken blows already); e0 and e2 are slowed.
    expect(cast.filter((e) => e.kind === 'down').map((e) => (e as { unit: string }).unit)).toEqual(['e1']);
    const st = statuses(cast);
    const spec = split.effect.status as StatusSpec;
    expect(st.map((e) => [e.src, e.dst, e.mult, e.until - e.t])).toEqual([
      ['h0', 'e0', spec.mult, spec.ticks],
      ['h0', 'e2', spec.mult, spec.ticks],
    ]);
  });

  it('hurries the formation with 다들 일어나', () => {
    const allUp = SIGNATURES.healer;
    const healer = hero(1, { row: 'back', role: 'healer', signature: { skill: allUp, mult: 1 } });
    const r = runBattle(setup([hero(0, { maxHp: 100_000 }), healer], [enemy(0, { atk: 2000, pen: 2000, intervalTicks: 5 })]));
    const up = casts(r.events, 'h1').find((e) => e.via === 'signature');
    expect(up).toBeDefined();
    const st = statuses(r.events).filter((e) => e.t === up?.t);
    expect(st.map((e) => [e.dst, e.mult])).toEqual([
      ['h0', 1.3],
      ['h1', 1.3],
    ]);
  });
});

describe('battle: the daily boss roar', () => {
  const roar = { id: 'roar', name: '쿵쿵 울부짖기', firstTick: 80, everyTicks: 120, status: { stat: 'atkSpeed', mult: 0.8, ticks: 40, on: 'foes' } } as const;

  it('roars on its ticks as its action: a cast, every hero slowed, its own next blow held by the cast pause', () => {
    const boss = enemy(0, { boss: true, intervalTicks: 20, skill: roar });
    const r = runBattle(setup([hero(0), hero(1, { row: 'back' })], [boss], { limitTicks: 300 }));
    expect(casts(r.events, 'e0').map((e) => [e.t, e.via, e.skill, e.name])).toEqual([
      [80, 'skill', 'roar', '쿵쿵 울부짖기'],
      [200, 'skill', 'roar', '쿵쿵 울부짖기'],
    ]);
    expect(statuses(r.events).filter((e) => e.t === 80).map((e) => [e.src, e.dst, e.mult, e.until])).toEqual([
      ['e0', 'h0', 0.8, 120],
      ['e0', 'h1', 0.8, 120],
    ]);
    // The blow due on 80 waits out the pause (81~86) and lands on 87; the roar on 200 holds a swing that is 0.7 full, so its next blow is on 212.
    expect(attackTicks(r.events, 'e0')).toEqual([20, 40, 60, 87, 106, 126, 146, 166, 186, 212, 232, 252, 272, 292]);
    // While it lasts the heroes swing slower than every 10 ticks; after it, every 10 again.
    const h0 = attackTicks(r.events, 'h0');
    expect(gapsOf(h0.filter((t) => t > 81 && t <= 120)).every((g) => g > 10)).toBe(true);
    expect(gapsOf(h0.filter((t) => t > 130 && t <= 200))).toEqual(Array.from({ length: gapsOf(h0.filter((t) => t > 130 && t <= 200)).length }, () => 10));
  });

  it('is every daily boss\'s (data/monsters.ts)', () => {
    expect(DAILY_BOSS_ROAR).toMatchObject({ name: '쿵쿵 울부짖기', status: { stat: 'atkSpeed', on: 'foes' } });
    expect(DAILY_BOSS_ROAR.status.mult).toBeLessThan(1);
  });
});

describe('battle: targets (6.3 적은 앞열부터 친다)', () => {
  it('keeps to one front-row hero until it is down, then the next, and the back row last', () => {
    const heroes = [hero(0, { maxHp: 50 }), hero(1, { maxHp: 50 }), hero(2, { row: 'back', maxHp: 50 })];
    const r = runBattle(setup(heroes, [enemy(0, { atk: 20, pen: 20 })]));
    const onHeroes = hits(r.events).filter((e) => e.src === 'e0').map((e) => e.dst);
    // 20 a blow: h0 three times (down at 50), then h1 three times, then the back row.
    expect(onHeroes).toEqual(['h0', 'h0', 'h0', 'h1', 'h1', 'h1', 'h2', 'h2', 'h2']);
    const downs = r.events.filter((e) => e.kind === 'down').map((e) => (e as { unit: string }).unit);
    expect(downs).toEqual(['h0', 'h1', 'h2']);
    expect(r.outcome).toBe('wiped');
  });

  it('spreads monsters over the front row from their own place, and each keeps to its own', () => {
    const r = runBattle(setup([hero(0), hero(1)], [enemy(0), enemy(1), enemy(2)], { limitTicks: 40 }));
    const blows = hits(r.events).filter((e) => e.src.startsWith('e'));
    const by = (src: string) => [...new Set(blows.filter((e) => e.src === src).map((e) => e.dst))];
    expect(blows.slice(0, 3).map((e) => `${e.src}>${e.dst}`)).toEqual(['e0>h0', 'e1>h1', 'e2>h0']);
    expect([by('e0'), by('e1'), by('e2')]).toEqual([['h0'], ['h1'], ['h0']]);
  });

  it('picks again from its own place when its hero goes down', () => {
    // e1 keeps to h1 (sturdy); e0 brings h0 down and moves on to what is left of the front row.
    const heroes = [hero(0, { maxHp: 30 }), hero(1, { maxHp: 1_000_000 }), hero(2, { maxHp: 1_000_000 })];
    const r = runBattle(setup(heroes, [enemy(0, { atk: 20, pen: 20 }), enemy(1)], { limitTicks: 60 }));
    const e0 = hits(r.events, 'e0').map((e) => e.dst);
    // Picks for e0: front[(0 + 0) mod 3] = h0; after h0: front of [h1, h2], (0 + 1) mod 2 = h2.
    expect(e0.slice(0, 3)).toEqual(['h0', 'h0', 'h2']);
    expect(new Set(hits(r.events, 'e1').map((e) => e.dst))).toEqual(new Set(['h1']));
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

  it('gives each hero the weapon type\'s interval and attack speed 1, and counts both', () => {
    const s = heroesWith(formationKeys);
    const team = buildTeam(s, { front: ['hero_rookie'], back: ['hero_tessa'] });
    expect(team.map((u) => [u.intervalTicks, u.atkSpeed])).toEqual([
      [HERO_ATTACK_INTERVAL_TICKS.oneHandSword, 1],
      [HERO_ATTACK_INTERVAL_TICKS.crossbow, 1],
    ]);
    const base = teamFingerprint(team);
    const first = team[0] as HeroUnit;
    expect(teamFingerprint([{ ...first, atkSpeed: 1.1 }, ...team.slice(1)])).not.toBe(base);
    expect(teamFingerprint([{ ...first, intervalTicks: 9 }, ...team.slice(1)])).not.toBe(base);
    // 전투력 counts attack speed as it counts attack (display only).
    expect(heroPower({ ...first, atkSpeed: 1.21 })).toBeCloseTo(heroPower(first) * 1.1, -1);
  });
});
