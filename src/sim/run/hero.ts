// 용사의 능력과 성장 in a run (기획서 13.5): 힘은 7.4 공식 (성장률 100%, 시작 힘과 상한은 성급),
// 레벨은 판 누적 돌파 층 수 (7.4 표 그대로), 숙련은 판 최고 도달층 + 숙련 인자 (4.7), 인망·운은
// 가문 고정 + 인자. Party power and the floor judgement are the 7장 functions (world/combat.ts).

import type { BodyType, Weapon } from '../core/types.ts';
import { FAMILIES } from '../data/families.ts';
import { FACTOR_VALUES, type FactorKind, MAINTAIN_POWER_MULT, STAR_SPEC, type Star } from '../data/run.ts';
import { LUCK_DEATH_TO_INJURY, MAX_LEVEL, PARTY_BONUS } from '../data/world.ts';
import { clearChance, effectiveClearChance, type Fighter, partyPower, weaponProfile, type WeaponProfile } from '../world/combat.ts';
import { levelFor } from '../world/hero.ts';
import { type SeasonFloor, seasonFloor } from './season.ts';
import type { Factor, RunState } from './types.ts';

// ---------- 인자 (13.10) ----------

function factorValue(kind: Exclude<FactorKind, 'card'>, level: number): number {
  const table = FACTOR_VALUES[kind];
  return table[Math.min(table.length, Math.max(1, level)) - 1] as number;
}

/** Sum of an additive factor (강함, 숙련, 인망). */
export function factorAdd(factors: readonly Factor[], kind: 'strength' | 'mastery' | 'charisma'): number {
  let sum = 0;
  for (const f of factors) if (f.kind === kind) sum += factorValue(kind, f.level);
  return sum;
}

/** Product of a multiplying factor (강인함, 탑 적응; 사냥꾼 only against its body). */
export function factorMult(factors: readonly Factor[], kind: 'toughness' | 'towerAdapt' | 'hunter', body?: BodyType): number {
  let m = 1;
  for (const f of factors) {
    if (f.kind !== kind) continue;
    if (kind === 'hunter' && f.body !== body) continue;
    m *= factorValue(kind, f.level);
  }
  return m;
}

// ---------- 힘과 레벨 (13.5) ----------

export function runLevel(cumulativeFloors: number): number {
  return levelFor(cumulativeFloors);
}

/** 시작 힘 = 성급의 시작 힘 + 강함 인자 (상한은 그대로, 13.10). */
export function runStartPower(star: Star, factors: readonly Factor[]): number {
  const spec = STAR_SPEC[star];
  return Math.min(spec.powerCap, spec.startPower + factorAdd(factors, 'strength'));
}

/** 힘 = 시작 힘 + (상한 − 시작 힘) × (레벨 − 1) ÷ 29 (13.5, 성장률 100%). */
export function runPower(star: Star, level: number, factors: readonly Factor[] = []): number {
  const start = runStartPower(star, factors);
  const cap = STAR_SPEC[star].powerCap;
  const lv = Math.min(MAX_LEVEL, Math.max(1, level));
  return start + ((cap - start) * (lv - 1)) / (MAX_LEVEL - 1);
}

export function heroLevel(state: Pick<RunState, 'cumulativeFloors'>): number {
  return runLevel(state.cumulativeFloors);
}

export function heroPower(state: Pick<RunState, 'cumulativeFloors' | 'factors' | 'setup'>): number {
  return runPower(state.setup.hero.star, heroLevel(state), state.factors);
}

/** 숙련 판정 층 = 판 최고 도달층 + 숙련 인자 (4.7, 13.5). */
export function masteryFloor(state: Pick<RunState, 'record' | 'factors'>): number {
  return state.record + factorAdd(state.factors, 'mastery');
}

/** 파티 보정 = 인망 (가문 고정) + 인망 인자 (13.5). 동행 원정 is added per expedition. */
export function partyBonus(state: Pick<RunState, 'setup' | 'factors'>): number {
  return PARTY_BONUS[FAMILIES[state.setup.hero.family].charisma] + factorAdd(state.factors, 'charisma');
}

/** 운: chance a 사망 (판에서는 중상) turns into 부상 (6.1, 13.4.2). */
export function luckSave(state: Pick<RunState, 'setup'>): number {
  return LUCK_DEATH_TO_INJURY[FAMILIES[state.setup.hero.family].luck];
}

/** 부상 확률 배율 (강인함 인자). */
export function injuryMult(state: Pick<RunState, 'factors'>): number {
  return factorMult(state.factors, 'toughness');
}

export interface FighterOptions {
  /** 정비 버프 ×1.2 on this expedition. Default: the state's buff. */
  maintain?: boolean;
  /** 동행 원정's 파티 보정. Default: the state's escort. */
  escort?: number;
  /** Judge as if this many floors were climbed (level). Default: the state's. */
  cumulativeFloors?: number;
}

/** The 7.3 Fighter against one body: 힘, 파티 보정, 기타 배율 (정비 버프 × 탑 적응 × 사냥꾼). */
export function runFighter(state: RunState, body: BodyType, opts: FighterOptions = {}): Fighter {
  const cumulative = opts.cumulativeFloors ?? state.cumulativeFloors;
  const maintain = opts.maintain ?? state.maintainBuff;
  return {
    power: runPower(state.setup.hero.star, runLevel(cumulative), state.factors),
    partyBonus: partyBonus(state) + (opts.escort ?? state.escort),
    powerMult:
      (maintain ? MAINTAIN_POWER_MULT : 1) *
      factorMult(state.factors, 'towerAdapt') *
      factorMult(state.factors, 'hunter', body),
  };
}

export function profileOf(state: RunState, weapon: Weapon = state.weapon.weapon): WeaponProfile {
  return weaponProfile(weapon, masteryFloor(state));
}

export interface FloorOddsOptions extends FighterOptions {
  weapon?: Weapon;
  /** 무뎌짐: weapon attack ×0.5 (7.12). */
  dull?: boolean;
}

export interface FloorOdds {
  info: SeasonFloor;
  power: number;
  r: number;
  /** 돌파 확률 (7.9), with 순풍의 운's second roll counted in (the same as the climb and the forecast). */
  chance: number;
}

/** R and 돌파 확률 of one floor with the current (or given) weapon and level (13.6 = 7.3, 7.9). */
export function floorOdds(state: RunState, floor: number, opts: FloorOddsOptions = {}): FloorOdds {
  const info = seasonFloor(state.setup.season, floor);
  const profile = profileOf(state, opts.weapon);
  const power = partyPower(profile, runFighter(state, info.body, opts), info, opts.dull === true);
  const r = power / info.enemyPower;
  return { info, power, r, chance: effectiveClearChance(clearChance(r), profile.fairWind) };
}
