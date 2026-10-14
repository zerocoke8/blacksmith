// 전투 시뮬레이션 (기획서 6.4, 6.7, 8.2): heroes and monsters fight in fixed 0.1 s ticks until one
// side is down or time runs out. Deterministic (CLAUDE.md 규칙 1): the only randomness is crit,
// drawn from rngFor(battle seed, …key) in the battle's fixed order ('roll', the default,
// data/battle.ts CRIT_MODE), or none at all ('gauge'). The result is an event list — who hit whom,
// when, for how much; skills, heals, statuses, falls, the end — that the screen plays back as it
// is (규칙 2). Pure.
//
// A battle runs tick by tick (startBattle): the screen steps it a little ahead of what it shows, so
// a tap on a full signature card still changes what comes. What the player did is a list of inputs,
// each at the tick it took effect; the same setup, seed and inputs give the same battle, so
// runBattle (and the server, 13장) can replay it.
//
// Order inside a tick: expired statuses drop; the tick's inputs apply (the signature mode, then
// taps); heroes act in formation order (front row first), then monsters in line order. Each fighter
// does at most one thing a tick: 필살기 when its gauge is full and the mode is auto or the player
// tapped it, else the active skill when ready (and useful), else a normal attack when its swing is
// full. A swing fills by 공격 속도 ÷ interval a tick (사용자 결정 2026-10-14: every weapon has its own
// rhythm, and statuses speed it up or slow it down); a cast stops it for a moment
// (data/battle.ts CAST_SWING_PAUSE_TICKS), so it puts the next attack off by the same time whatever
// the weapon (사용자 결정 2026-10-14).
// Targets: heroes hit the front-most living monster (spread skills: the front-most n, or all). A
// monster keeps to one hero until that hero is down (so a melee monster can stand by them), then
// picks again among the living front row (6.3 '적은 앞열부터 친다'; the back row only once the front
// row is down): monster i's k-th pick is front[(i + k) mod n], so a group spreads from its places.

import { type KeyPart, rngFor } from '../core/rng.ts';
import type { BodyType, Element } from '../core/types.ts';
import {
  ATTACK_SPEED_REF_TICKS,
  CRIT_MODE,
  type CritMode,
  DEFENSE_WEIGHT,
  ENEMY_FIRST_ATTACK_STAGGER_TICKS,
  type EnemySkill,
  HEAL_TRIGGER_MISSING,
  HERO_FIRST_ATTACK_STAGGER_TICKS,
  CAST_SWING_PAUSE_TICKS,
  LAST_STAND_HP,
  SIGNATURE_GAUGE,
  SKILL_FIRST_READY_SHARE,
  type StatusSpec,
  type StatusStat,
} from '../data/battle.ts';
import type { FormationRow, HeroKey, HeroRole, PassiveSpec, SkillSpec } from '../data/heroes.ts';
import { bodyMultFor, elementMultFor, resonanceMult, type WeaponCombat } from '../hero/stats.ts';

// Statuses and monster skills are data (data/battle.ts, so the skill tables can carry them); the
// battle's types are read from here.
export type { EnemySkill, StatusSpec, StatusStat };

// ---------- Fighters ----------

interface Fighter {
  /** 'h0'.. heroes in formation order, 'e0'.. monsters front first. */
  id: string;
  maxHp: number;
  atk: number;
  def: number;
  /**
   * The attack the defender's defence is weighed against (6.4 방어 감쇠): a hero's attack; a
   * monster's floor reference attack, so a boss's slow heavy blows are not less blocked than a mob's.
   */
  pen: number;
  crit: number;
  critDamage: number;
  /**
   * Ticks between normal attacks at attack speed 1 (a hero's: its weapon type's, data/battle.ts
   * HERO_ATTACK_INTERVAL_TICKS). The real gap is this ÷ the attack speed of the moment.
   */
  intervalTicks: number;
  /** 공격 속도 (6.4, 사용자 결정 2026-10-14): 1 = the base interval. Statuses multiply it for a while. Absent: 1. */
  atkSpeed?: number;
}

export interface HeroUnit extends Fighter {
  heroKey: HeroKey;
  name: string;
  row: FormationRow;
  role: HeroRole;
  element: Element;
  weapon: WeaponCombat;
  /** 열 보너스 (6.3) on damage and healing. */
  rowBonus: number;
  active: SkillSpec;
  /** The active's cooldown after 'haste'. */
  activeCooldown: number;
  /** null: a normal hero before gold. Team passives are already in the stats. */
  passive: PassiveSpec | null;
  /** 필살기 and its multiplier (×1, or the red evolution's), or null. */
  signature: { skill: SkillSpec; mult: number } | null;
}

export interface EnemyUnit extends Fighter {
  key: string;
  name: string;
  body: BodyType;
  element: Element | null;
  boss: boolean;
  /** Its own skill, if any (data/monsters.ts). */
  skill?: EnemySkill;
}

/** 필살기 (5.4, 사용자 결정 2026-10-14): fired by itself when full ('auto'), or when the player taps it ('manual'). */
export type SignatureMode = 'auto' | 'manual';

/**
 * What the player did during a battle, at the tick it took effect: the server replays a battle from
 * its setup, seed and these (13장). 'cast': fire that hero's full signature this tick. 'auto': the
 * signature mode from this tick on.
 */
export type BattleInput = { t: number; kind: 'cast'; unit: string } | { t: number; kind: 'auto'; on: boolean };

/** A hero's signature gauge as of the last simulated tick (the battle screen's cards). */
export interface SignatureGauge {
  /** The hero has a signature (a special at gold or above). */
  has: boolean;
  /** 0..1 */
  share: number;
  ready: boolean;
}

/**
 * A battle run tick by tick (the screen steps it a little ahead of what it shows, so a tap can
 * still change what comes). runBattle is startBattle stepped to the end with setup.inputs replayed.
 */
export interface BattleRun {
  /** The last simulated tick (0 before the first step). */
  readonly tick: number;
  readonly done: boolean;
  /** Simulates the next tick and returns its events ([] once done; the last step's include 'end'). */
  step(): BattleEvent[];
  /** Fires this hero's signature on the next tick if it is full then (recorded as an input). */
  order(unit: string): void;
  /** The signature mode from the next tick on (recorded as an input). */
  setAuto(on: boolean): void;
  /** The signature mode the next tick runs with (what the AUTO button shows). */
  readonly auto: boolean;
  gauge(unit: string): SignatureGauge;
  /** Every input so far, each with the tick it took effect. */
  readonly inputs: readonly BattleInput[];
  /** The result; only once done. */
  result(): BattleResult;
}

export interface BattleSetup {
  heroes: HeroUnit[];
  enemies: EnemyUnit[];
  limitTicks: number;
  /** The battle seed (서버가 준다) and the stream key, e.g. ['battle', 'stage', 층, 도전 번호]. */
  seed: number;
  key: readonly KeyPart[];
  critMode?: CritMode;
  /** The signature mode at the start (default 'auto'). */
  signatures?: SignatureMode;
  /** Inputs to replay at their ticks (runBattle; a server's re-check). */
  inputs?: readonly BattleInput[];
}

// ---------- Events ----------

export type HitVia = 'attack' | 'skill' | 'signature';

export type BattleEvent =
  /** A skill or signature goes off (the hits, heals and statuses follow on the same tick). A monster's skill: via 'skill'. */
  | { t: number; kind: 'cast'; src: string; via: 'skill' | 'signature'; skill: string; name: string }
  | {
      t: number;
      kind: 'hit';
      src: string;
      dst: string;
      via: HitVia;
      amount: number;
      crit: boolean;
      /** Hero hits: 속성 and 체형 배율 (the screen colours a ◎ hit). Monster hits: 1. */
      elementMult: number;
      bodyMult: number;
      hpAfter: number;
    }
  | { t: number; kind: 'heal'; src: string; dst: string; via: 'skill' | 'signature'; amount: number; hpAfter: number }
  /** A status put on `dst` (or refreshed): `stat` × `mult` through tick `until`. */
  | { t: number; kind: 'status'; src: string; dst: string; stat: StatusStat; mult: number; until: number }
  | { t: number; kind: 'down'; unit: string }
  | { t: number; kind: 'end'; outcome: BattleOutcome };

/** win: every monster down. wiped: every hero down. timeout: the limit came first. */
export type BattleOutcome = 'win' | 'wiped' | 'timeout';

export interface BattleResult {
  outcome: BattleOutcome;
  /** The tick it ended on. */
  ticks: number;
  events: BattleEvent[];
  /** HP removed from monsters, overkill not counted (일일 보스의 데미지, 8.3). */
  damageDealt: number;
  heroHp: Record<string, number>;
  enemyHp: Record<string, number>;
  /** The inputs the battle ran with (13장: the server replays them). */
  inputs: BattleInput[];
}

// ---------- The simulation ----------

/** 방어 감쇠 (6.4, changed to be scale-free): pen ÷ (pen + 방어). */
export function mitigation(pen: number, def: number): number {
  const d = Math.max(0, def) * DEFENSE_WEIGHT;
  return pen > 0 ? pen / (pen + d) : 0;
}

/** Sums of 1/interval drift below 1 in floating point (ten × 0.1 = 0.999…); a full swing is this close. */
const SWING_EPSILON = 1e-9;

interface Status {
  /** The caster's id and the skill's id: the same pair refreshes instead of stacking. */
  src: string;
  skill: string;
  stat: StatusStat;
  mult: number;
  /** The last tick it is on. */
  until: number;
}

interface Live {
  hp: number;
  /** The swing meter: fills by attack speed ÷ interval a tick; a normal attack goes at 1. */
  swing: number;
  /** Ticks the swing stands still after a cast. */
  pause: number;
  skillReady: number;
  gauge: number;
  /** Normal attacks made (the opener passive counts the first). */
  attacks: number;
  critAcc: number;
  statuses: Status[];
  /** Monsters: the hero index it keeps to (-1: none yet) and how many times it has picked. */
  target: number;
  picks: number;
}

function sortedInputs(inputs: readonly BattleInput[]): BattleInput[] {
  // Array sort is stable: inputs on the same tick keep their order.
  return inputs.map((i) => ({ ...i })).sort((a, b) => a.t - b.t);
}

/** Starts a battle; each step() simulates one tick. Inputs in setup.inputs apply at their ticks. */
export function startBattle(setup: BattleSetup): BattleRun {
  const mode = setup.critMode ?? CRIT_MODE;
  const rng = mode === 'roll' ? rngFor(setup.seed, ...setup.key) : null;
  const heroes = setup.heroes;
  const enemies = setup.enemies;
  const heroIndex = new Map(heroes.map((h, i) => [h.id, i]));
  const events: BattleEvent[] = [];
  const fresh = (hp: number, swing: number, skillReady: number): Live => ({
    hp,
    swing,
    pause: 0,
    skillReady,
    gauge: 0,
    attacks: 0,
    critAcc: 0,
    statuses: [],
    target: -1,
    picks: 0,
  });
  // The swing starts where its first attack lands at speed 1 on the same tick as ever: heroes on
  // 1 + slot × stagger, monsters one interval in, + line place × stagger.
  const hl: Live[] = heroes.map((h, i) =>
    fresh(h.maxHp, 1 - (1 + i * HERO_FIRST_ATTACK_STAGGER_TICKS) / h.intervalTicks, Math.max(1, Math.round(h.activeCooldown * SKILL_FIRST_READY_SHARE))),
  );
  const el: Live[] = enemies.map((e, i) =>
    fresh(e.maxHp, 1 - (e.intervalTicks + i * ENEMY_FIRST_ATTACK_STAGGER_TICKS) / e.intervalTicks, e.skill?.firstTick ?? 0),
  );
  let damageDealt = 0;
  let tick = 0;
  let done = false;
  let outcome: BattleOutcome = 'timeout';

  // ----- Inputs -----

  /** Every input, sorted by tick; those before `nextInput` have been applied. */
  const recorded = sortedInputs(setup.inputs ?? []);
  let nextInput = 0;
  let autoNow = (setup.signatures ?? 'auto') === 'auto';
  /** Heroes the player tapped for this tick; a tap that cannot go off this tick is dropped. */
  const pending = new Set<number>();

  const record = (input: BattleInput): void => {
    let k = recorded.length;
    while (k > nextInput && (recorded[k - 1] as BattleInput).t > input.t) k--;
    recorded.splice(k, 0, input);
  };
  // A fight started by hand records that as its first input: the server rebuilds the setup from the
  // account (13장) and does not know the device's AUTO switch, so the inputs alone must replay it.
  if (!autoNow && !recorded.some((x) => x.kind === 'auto' && x.t <= 1)) record({ t: 1, kind: 'auto', on: false });

  /** The signature mode tick t would run with, counting inputs not applied yet. */
  const autoAt = (t: number): boolean => {
    let on = autoNow;
    for (let k = nextInput; k < recorded.length; k++) {
      const input = recorded[k] as BattleInput;
      if (input.t > t) break;
      if (input.kind === 'auto') on = input.on;
    }
    return on;
  };

  const applyInputs = (t: number): void => {
    const due: BattleInput[] = [];
    while (nextInput < recorded.length && (recorded[nextInput] as BattleInput).t <= t) due.push(recorded[nextInput++] as BattleInput);
    for (const input of due) if (input.kind === 'auto') autoNow = input.on;
    for (const input of due) {
      if (input.kind !== 'cast') continue;
      const i = heroIndex.get(input.unit);
      if (i !== undefined) pending.add(i);
    }
  };

  // ----- Rolls, statuses -----

  const rollCrit = (live: Live, rate: number): boolean => {
    if (rate <= 0) return false;
    if (rng !== null) return rng.chance(rate);
    live.critAcc += rate;
    if (live.critAcc >= 1 - 1e-9) {
      live.critAcc -= 1;
      return true;
    }
    return false;
  };

  const speedOf = (f: Fighter, l: Live): number => {
    let s = f.atkSpeed ?? 1;
    for (const st of l.statuses) if (st.stat === 'atkSpeed') s *= st.mult;
    return s;
  };

  const dropExpired = (t: number): void => {
    for (const l of [...hl, ...el]) if (l.statuses.length > 0) l.statuses = l.statuses.filter((s) => s.until >= t);
  };

  const putStatus = (t: number, src: string, skill: string, spec: StatusSpec, who: readonly { f: Fighter; l: Live }[]): void => {
    const until = t + spec.ticks;
    for (const { f, l } of who) {
      if (l.hp <= 0) continue;
      const s: Status = { src, skill, stat: spec.stat, mult: spec.mult, until };
      const k = l.statuses.findIndex((x) => x.src === src && x.skill === skill && x.stat === spec.stat);
      if (k >= 0) l.statuses[k] = s;
      else l.statuses.push(s);
      events.push({ t, kind: 'status', src, dst: f.id, stat: spec.stat, mult: spec.mult, until });
    }
  };

  const heroSide = (): { f: Fighter; l: Live }[] => heroes.map((f, i) => ({ f, l: hl[i] as Live }));
  const enemySide = (): { f: Fighter; l: Live }[] => enemies.map((f, i) => ({ f, l: el[i] as Live }));

  // ----- Heroes -----

  const livingEnemies = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < enemies.length; i++) if ((el[i] as Live).hp > 0) out.push(i);
    return out;
  };

  const heroHit = (t: number, hi: number, ei: number, power: number, via: HitVia): void => {
    const h = heroes[hi] as HeroUnit;
    const me = hl[hi] as Live;
    const e = enemies[ei] as EnemyUnit;
    const target = el[ei] as Live;
    if (target.hp <= 0) return;
    const p = h.passive;
    let atk = h.atk;
    if (p !== null && p.kind === 'lastStand' && me.hp <= h.maxHp * LAST_STAND_HP) atk *= 1 + p.value;
    const elementMult = elementMultFor(h.weapon.element, e.element, h.weapon.advantageAdd);
    const bodyMult = bodyMultFor(h.weapon, e.body);
    let mult = power * elementMult * bodyMult * resonanceMult(h.element, h.weapon.element) * h.rowBonus * h.weapon.attackMult;
    mult *= 1 + h.crit * h.weapon.pursuitPerCrit;
    mult *= e.boss ? h.weapon.bossMult : h.weapon.nonBossMult;
    if (p !== null && p.kind === 'boss' && e.boss) mult *= 1 + p.value;
    if (p !== null && p.kind === 'mob' && !e.boss) mult *= 1 + p.value;
    const crit = rollCrit(me, h.crit);
    if (crit) mult *= h.critDamage;
    const amount = Math.max(1, Math.round(atk * mult * mitigation(h.pen, e.def)));
    const before = target.hp;
    target.hp = Math.max(0, before - amount);
    damageDealt += before - target.hp;
    events.push({ t, kind: 'hit', src: h.id, dst: e.id, via, amount, crit, elementMult, bodyMult, hpAfter: target.hp });
    if (target.hp === 0) events.push({ t, kind: 'down', unit: e.id });
  };

  const someoneHurt = (): boolean => {
    for (let i = 0; i < heroes.length; i++) {
      const l = hl[i] as Live;
      const h = heroes[i] as HeroUnit;
      if (l.hp > 0 && h.maxHp - l.hp >= h.maxHp * HEAL_TRIGGER_MISSING) return true;
    }
    return false;
  };

  /** A hero skill's status, after its hits or heals: on its side, the enemies it hit, or all enemies. */
  const heroStatus = (t: number, hi: number, skill: SkillSpec, spec: StatusSpec, hitTargets: readonly number[]): void => {
    const who = spec.on === 'allies' ? heroSide() : spec.on === 'foes' ? enemySide() : hitTargets.map((ei) => ({ f: enemies[ei] as Fighter, l: el[ei] as Live }));
    putStatus(t, (heroes[hi] as HeroUnit).id, skill.id, spec, who);
  };

  /** Casts a skill; false when it has nothing to do (no target, nobody hurt). */
  const cast = (t: number, hi: number, skill: SkillSpec, mult: number, via: 'skill' | 'signature'): boolean => {
    const h = heroes[hi] as HeroUnit;
    const fx = skill.effect;
    if (fx.kind === 'heal') {
      if (!someoneHurt()) return false;
      events.push({ t, kind: 'cast', src: h.id, via, skill: skill.id, name: skill.name });
      const bonus = h.passive !== null && h.passive.kind === 'heal' ? 1 + h.passive.value : 1;
      for (let i = 0; i < heroes.length; i++) {
        const ally = heroes[i] as HeroUnit;
        const l = hl[i] as Live;
        if (l.hp <= 0 || l.hp >= ally.maxHp) continue;
        const want = Math.round(ally.maxHp * fx.share * mult * bonus * h.rowBonus);
        const amount = Math.min(ally.maxHp - l.hp, Math.max(0, want));
        if (amount <= 0) continue;
        l.hp += amount;
        events.push({ t, kind: 'heal', src: h.id, dst: ally.id, via, amount, hpAfter: l.hp });
      }
      if (fx.status !== undefined) heroStatus(t, hi, skill, fx.status, []);
      return true;
    }
    const living = livingEnemies();
    if (living.length === 0) return false;
    events.push({ t, kind: 'cast', src: h.id, via, skill: skill.id, name: skill.name });
    const targets = fx.targets === 'all' ? living : living.slice(0, fx.targets);
    for (const ei of targets) for (let k = 0; k < fx.hits; k++) heroHit(t, hi, ei, fx.power * mult, via);
    if (fx.status !== undefined) heroStatus(t, hi, skill, fx.status, targets);
    return true;
  };

  const heroAct = (t: number, hi: number): void => {
    const h = heroes[hi] as HeroUnit;
    const me = hl[hi] as Live;
    // A cast stops the swing for a moment: it neither fills nor strikes (a blow already due waits).
    const paused = me.pause > 0;
    if (paused) me.pause -= 1;
    else me.swing += speedOf(h, me) / h.intervalTicks;
    if (h.signature !== null) {
      me.gauge = Math.min(SIGNATURE_GAUGE.full, me.gauge + SIGNATURE_GAUGE.perTick);
      const fire = autoNow || pending.has(hi);
      if (fire && me.gauge >= SIGNATURE_GAUGE.full && cast(t, hi, h.signature.skill, h.signature.mult, 'signature')) {
        me.gauge = 0;
        me.pause = CAST_SWING_PAUSE_TICKS.signature;
        return;
      }
    }
    if (t >= me.skillReady && cast(t, hi, h.active, 1, 'skill')) {
      me.skillReady = t + h.activeCooldown;
      me.pause = CAST_SWING_PAUSE_TICKS.skill;
      return;
    }
    if (paused || me.swing < 1 - SWING_EPSILON) return;
    const living = livingEnemies();
    if (living.length === 0) return;
    const opener = h.passive !== null && h.passive.kind === 'opener' && me.attacks === 0 ? 1 + h.passive.value : 1;
    // A slow weapon's blow is heavier by as much as it is slower: every weapon's normal attacks do
    // the same damage a second (4.8 '기대 데미지는 같게').
    heroHit(t, hi, living[0] as number, (opener * h.intervalTicks) / ATTACK_SPEED_REF_TICKS, 'attack');
    me.attacks += 1;
    me.swing -= 1;
    // The gauge gains by the blow's weight too, so it fills as fast for every weapon.
    if (h.signature !== null) me.gauge = Math.min(SIGNATURE_GAUGE.full, me.gauge + (SIGNATURE_GAUGE.perAttack * h.intervalTicks) / ATTACK_SPEED_REF_TICKS);
  };

  // ----- Monsters -----

  /** The hero monster ei keeps to: the same one until it is down, then a new pick. */
  const enemyTarget = (ei: number): number | null => {
    const me = el[ei] as Live;
    if (me.target >= 0 && (hl[me.target] as Live).hp > 0) return me.target;
    for (const row of ['front', 'back'] as const) {
      const cands: number[] = [];
      for (let i = 0; i < heroes.length; i++) if ((heroes[i] as HeroUnit).row === row && (hl[i] as Live).hp > 0) cands.push(i);
      if (cands.length > 0) {
        me.target = cands[(ei + me.picks) % cands.length] as number;
        me.picks += 1;
        return me.target;
      }
    }
    me.target = -1;
    return null;
  };

  const enemyAct = (t: number, ei: number): void => {
    const e = enemies[ei] as EnemyUnit;
    const me = el[ei] as Live;
    const paused = me.pause > 0;
    if (paused) me.pause -= 1;
    else me.swing += speedOf(e, me) / e.intervalTicks;
    const sk = e.skill;
    if (sk !== undefined && t >= me.skillReady) {
      events.push({ t, kind: 'cast', src: e.id, via: 'skill', skill: sk.id, name: sk.name });
      const spec = sk.status;
      let who: { f: Fighter; l: Live }[];
      if (spec.on === 'foes') who = heroSide();
      else if (spec.on === 'allies') who = enemySide();
      else {
        const hi = enemyTarget(ei);
        who = hi === null ? [] : [{ f: heroes[hi] as Fighter, l: hl[hi] as Live }];
      }
      putStatus(t, e.id, sk.id, spec, who);
      me.skillReady = t + Math.max(1, sk.everyTicks);
      me.pause = CAST_SWING_PAUSE_TICKS.monster;
      return;
    }
    if (paused || me.swing < 1 - SWING_EPSILON) return;
    const hi = enemyTarget(ei);
    if (hi === null) return;
    const h = heroes[hi] as HeroUnit;
    const target = hl[hi] as Live;
    const crit = rollCrit(me, e.crit);
    const amount = Math.max(1, Math.round(e.atk * (crit ? e.critDamage : 1) * mitigation(e.pen, h.def)));
    target.hp = Math.max(0, target.hp - amount);
    events.push({ t, kind: 'hit', src: e.id, dst: h.id, via: 'attack', amount, crit, elementMult: 1, bodyMult: 1, hpAfter: target.hp });
    if (target.hp === 0) events.push({ t, kind: 'down', unit: h.id });
    me.attacks += 1;
    me.swing -= 1;
  };

  // ----- Ticks -----

  const alive = (list: Live[]): boolean => list.some((l) => l.hp > 0);

  const end = (o: BattleOutcome): void => {
    outcome = o;
    done = true;
    events.push({ t: tick, kind: 'end', outcome: o });
  };

  const step = (): BattleEvent[] => {
    if (done) return [];
    const from = events.length;
    if (!alive(el)) end('win');
    else if (!alive(hl)) end('wiped');
    else if (tick >= setup.limitTicks) end('timeout');
    else {
      tick += 1;
      const t = tick;
      dropExpired(t);
      applyInputs(t);
      let over: BattleOutcome | null = null;
      for (let i = 0; i < heroes.length && over === null; i++) {
        if ((hl[i] as Live).hp <= 0) continue;
        heroAct(t, i);
        if (!alive(el)) over = 'win';
      }
      for (let i = 0; i < enemies.length && over === null; i++) {
        if ((el[i] as Live).hp <= 0) continue;
        enemyAct(t, i);
        if (!alive(hl)) over = 'wiped';
      }
      pending.clear();
      if (over !== null) end(over);
      else if (t >= setup.limitTicks) end('timeout');
    }
    return events.slice(from);
  };

  const order = (unit: string): void => {
    if (done) return;
    const i = heroIndex.get(unit);
    if (i === undefined || (heroes[i] as HeroUnit).signature === null) return;
    const t = tick + 1;
    const twice = recorded.some((x, k) => k >= nextInput && x.t === t && x.kind === 'cast' && x.unit === unit);
    if (!twice) record({ t, kind: 'cast', unit });
  };

  const setAuto = (on: boolean): void => {
    if (done) return;
    // A switch not applied yet on the same tick is replaced, so the log keeps one per tick.
    const t = tick + 1;
    const same = recorded.findIndex((x, k) => k >= nextInput && x.t === t && x.kind === 'auto');
    if (same >= 0) recorded.splice(same, 1);
    if (autoAt(t) !== on) record({ t, kind: 'auto', on });
  };

  const gauge = (unit: string): SignatureGauge => {
    const i = heroIndex.get(unit);
    const h = i === undefined ? undefined : heroes[i];
    if (i === undefined || h === undefined || h.signature === null) return { has: false, share: 0, ready: false };
    const me = hl[i] as Live;
    const full = me.gauge >= SIGNATURE_GAUGE.full;
    // Ready only when a tap would do something now: a heal needs someone hurt, a blow a monster standing.
    const useful = h.signature.skill.effect.kind === 'heal' ? someoneHurt() : livingEnemies().length > 0;
    return { has: true, share: Math.min(1, me.gauge / SIGNATURE_GAUGE.full), ready: full && useful && me.hp > 0 && !done };
  };

  const result = (): BattleResult => {
    if (!done) throw new Error('the battle is not over yet');
    const heroHp: Record<string, number> = {};
    heroes.forEach((h, i) => (heroHp[h.id] = (hl[i] as Live).hp));
    const enemyHp: Record<string, number> = {};
    enemies.forEach((e, i) => (enemyHp[e.id] = (el[i] as Live).hp));
    return { outcome, ticks: tick, events: [...events], damageDealt, heroHp, enemyHp, inputs: recorded.map((x) => ({ ...x })) };
  };

  return {
    get tick() {
      return tick;
    },
    get done() {
      return done;
    },
    step,
    order,
    setAuto,
    get auto() {
      return autoAt(tick + 1);
    },
    gauge,
    get inputs() {
      return recorded.map((x) => ({ ...x }));
    },
    result,
  };
}

/** The whole battle at once: startBattle with setup.inputs replayed at their ticks, stepped to the end. */
export function runBattle(setup: BattleSetup): BattleResult {
  const run = startBattle(setup);
  while (!run.done) run.step();
  return run.result();
}
