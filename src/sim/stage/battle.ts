// 전투 시뮬레이션 (기획서 6.4, 6.7, 8.2): heroes and monsters fight in fixed 0.1 s ticks until one
// side is down or time runs out. Deterministic (CLAUDE.md 규칙 1): the only randomness is crit,
// none in 'gauge' mode (the default, data/battle.ts CRIT_MODE), or drawn from rngFor(battle seed, …key) in a fixed order in 'roll' mode. The result is an
// event list — who hit whom, when, for how much; skills, heals, falls, the end — that the screen
// plays back as it is (규칙 2). Pure.
//
// Order inside a tick: heroes in formation order (front row first), then monsters in line order.
// Each fighter does at most one thing a tick: 필살기 when its gauge is full, else the active skill
// when ready (and useful), else a normal attack when its interval is up.
// Targets: heroes hit the front-most living monster (spread skills: the front-most n, or all);
// monsters hit the front row (6.3 '적은 앞열부터 친다'), each monster going round the living
// front-row heroes from its own place (monster i's k-th blow: front[(i + k) mod n]), and the back
// row only once the front row is down.

import { type KeyPart, rngFor } from '../core/rng.ts';
import type { BodyType, Element } from '../core/types.ts';
import {
  CRIT_MODE,
  type CritMode,
  DEFENSE_WEIGHT,
  ENEMY_FIRST_ATTACK_STAGGER_TICKS,
  HEAL_TRIGGER_MISSING,
  HERO_FIRST_ATTACK_STAGGER_TICKS,
  LAST_STAND_HP,
  SIGNATURE_GAUGE,
  SKILL_FIRST_READY_SHARE,
} from '../data/battle.ts';
import type { FormationRow, HeroKey, HeroRole, PassiveSpec, SkillSpec } from '../data/heroes.ts';
import { bodyMultFor, elementMultFor, resonanceMult, type WeaponCombat } from '../hero/stats.ts';

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
  intervalTicks: number;
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
}

export interface BattleSetup {
  heroes: HeroUnit[];
  enemies: EnemyUnit[];
  limitTicks: number;
  /** The battle seed (서버가 준다) and the stream key, e.g. ['battle', 'stage', 층, 도전 번호]. */
  seed: number;
  key: readonly KeyPart[];
  critMode?: CritMode;
}

// ---------- Events ----------

export type HitVia = 'attack' | 'skill' | 'signature';

export type BattleEvent =
  /** A skill or signature goes off (the hits or heals follow on the same tick). */
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
}

// ---------- The simulation ----------

/** 방어 감쇠 (6.4, changed to be scale-free): pen ÷ (pen + 방어). */
export function mitigation(pen: number, def: number): number {
  const d = Math.max(0, def) * DEFENSE_WEIGHT;
  return pen > 0 ? pen / (pen + d) : 0;
}

interface Live {
  hp: number;
  nextAttack: number;
  skillReady: number;
  gauge: number;
  /** Normal attacks made (monsters: the round of targets). */
  attacks: number;
  critAcc: number;
}

export function runBattle(setup: BattleSetup): BattleResult {
  const mode = setup.critMode ?? CRIT_MODE;
  const rng = mode === 'roll' ? rngFor(setup.seed, ...setup.key) : null;
  const heroes = setup.heroes;
  const enemies = setup.enemies;
  const events: BattleEvent[] = [];
  const hl: Live[] = heroes.map((h, i) => ({
    hp: h.maxHp,
    nextAttack: 1 + i * HERO_FIRST_ATTACK_STAGGER_TICKS,
    skillReady: Math.max(1, Math.round(h.activeCooldown * SKILL_FIRST_READY_SHARE)),
    gauge: 0,
    attacks: 0,
    critAcc: 0,
  }));
  const el: Live[] = enemies.map((e, i) => ({
    hp: e.maxHp,
    nextAttack: e.intervalTicks + i * ENEMY_FIRST_ATTACK_STAGGER_TICKS,
    skillReady: 0,
    gauge: 0,
    attacks: 0,
    critAcc: 0,
  }));
  let damageDealt = 0;

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
      return true;
    }
    const living = livingEnemies();
    if (living.length === 0) return false;
    events.push({ t, kind: 'cast', src: h.id, via, skill: skill.id, name: skill.name });
    const targets = fx.targets === 'all' ? living : living.slice(0, fx.targets);
    for (const ei of targets) for (let k = 0; k < fx.hits; k++) heroHit(t, hi, ei, fx.power * mult, via);
    return true;
  };

  const heroAct = (t: number, hi: number): void => {
    const h = heroes[hi] as HeroUnit;
    const me = hl[hi] as Live;
    if (h.signature !== null) {
      me.gauge = Math.min(SIGNATURE_GAUGE.full, me.gauge + SIGNATURE_GAUGE.perTick);
      if (me.gauge >= SIGNATURE_GAUGE.full && cast(t, hi, h.signature.skill, h.signature.mult, 'signature')) {
        me.gauge = 0;
        return;
      }
    }
    if (t >= me.skillReady && cast(t, hi, h.active, 1, 'skill')) {
      me.skillReady = t + h.activeCooldown;
      return;
    }
    if (t >= me.nextAttack) {
      const living = livingEnemies();
      if (living.length === 0) return;
      const opener = h.passive !== null && h.passive.kind === 'opener' && me.attacks === 0 ? 1 + h.passive.value : 1;
      heroHit(t, hi, living[0] as number, opener, 'attack');
      me.attacks += 1;
      me.nextAttack = t + h.intervalTicks;
      if (h.signature !== null) me.gauge = Math.min(SIGNATURE_GAUGE.full, me.gauge + SIGNATURE_GAUGE.perAttack);
    }
  };

  const enemyTarget = (ei: number): number | null => {
    const me = el[ei] as Live;
    for (const row of ['front', 'back'] as const) {
      const cands: number[] = [];
      for (let i = 0; i < heroes.length; i++) if ((heroes[i] as HeroUnit).row === row && (hl[i] as Live).hp > 0) cands.push(i);
      if (cands.length > 0) return cands[(ei + me.attacks) % cands.length] as number;
    }
    return null;
  };

  const enemyAct = (t: number, ei: number): void => {
    const e = enemies[ei] as EnemyUnit;
    const me = el[ei] as Live;
    if (t < me.nextAttack) return;
    const hi = enemyTarget(ei);
    if (hi === null) return;
    const h = heroes[hi] as HeroUnit;
    const target = hl[hi] as Live;
    const crit = rollCrit(me, e.crit);
    const atk = e.atk;
    const amount = Math.max(1, Math.round(atk * (crit ? e.critDamage : 1) * mitigation(e.pen, h.def)));
    target.hp = Math.max(0, target.hp - amount);
    events.push({ t, kind: 'hit', src: e.id, dst: h.id, via: 'attack', amount, crit, elementMult: 1, bodyMult: 1, hpAfter: target.hp });
    if (target.hp === 0) events.push({ t, kind: 'down', unit: h.id });
    me.attacks += 1;
    me.nextAttack = t + e.intervalTicks;
  };

  const alive = (list: Live[]): boolean => list.some((l) => l.hp > 0);

  let outcome: BattleOutcome = 'timeout';
  let endTick = setup.limitTicks;
  if (!alive(el)) {
    outcome = 'win';
    endTick = 0;
  } else if (!alive(hl)) {
    outcome = 'wiped';
    endTick = 0;
  } else {
    outer: for (let t = 1; t <= setup.limitTicks; t++) {
      for (let i = 0; i < heroes.length; i++) {
        if ((hl[i] as Live).hp <= 0) continue;
        heroAct(t, i);
        if (!alive(el)) {
          outcome = 'win';
          endTick = t;
          break outer;
        }
      }
      for (let i = 0; i < enemies.length; i++) {
        if ((el[i] as Live).hp <= 0) continue;
        enemyAct(t, i);
        if (!alive(hl)) {
          outcome = 'wiped';
          endTick = t;
          break outer;
        }
      }
    }
  }
  events.push({ t: endTick, kind: 'end', outcome });
  const heroHp: Record<string, number> = {};
  heroes.forEach((h, i) => (heroHp[h.id] = (hl[i] as Live).hp));
  const enemyHp: Record<string, number> = {};
  enemies.forEach((e, i) => (enemyHp[e.id] = (el[i] as Live).hp));
  return { outcome, ticks: endTick, events, damageDealt, heroHp, enemyHp };
}
