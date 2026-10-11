// 원정 (기획서 13.6): 7장의 탑 계산을 그대로 부르고 (7.3 전투력, 7.9 판정, 7.12 내구도), 층 정보만
// 시즌 배치에서 만든다. 다른 것은 13장대로: 방침 3개, HP가 턴을 넘어 이어짐, 실패 결과의 사망은
// 중상, 벽 도전 (귀환 기준을 끔), 마지막 등반 (51층부터 끝까지). Random: (판 시드, 'expedition',
// 원정 번호, 층); 재료 발견 is an event: (판 시드, 'event', 턴, 'find', 층).

import type { EnchantMaterialKey } from '../cards/index.ts';
import { rngFor } from '../core/rng.ts';
import type { BodyType } from '../core/types.ts';
import { materialPrice } from '../data/common.ts';
import { FAMILY_BODY } from '../data/enchants.ts';
import {
  type ExpeditionPolicy,
  FINAL_CLIMB_START,
  FIND_CHANCE_PER_FLOOR,
  LATE_GOLD_FROM_FLOOR,
  POLICY_RETURN,
  SEASONS,
  UPPER_MATERIAL_FROM_FLOOR,
} from '../data/run.ts';
import {
  INCOME_UNITS_PER_FLOOR,
  MAX_FLOORS_PER_EXPEDITION,
  RETURN_AT_DURABILITY,
  WEAR_BOSS_MAX,
  WEAR_BOSS_MIN,
  WEAR_NORMAL_FLOOR,
} from '../data/world.ts';
import {
  clearChance,
  effectiveClearChance,
  failOdds,
  hpLossOnClear,
  partyPower,
  rollClear,
  rollFailOutcome,
} from '../world/combat.ts';
import type { BodyMaterialFamily } from '../cards/enchant.ts';
import { bossReward, EVENT_STREAM } from './events.ts';
import { heroLevel, injuryMult, luckSave, profileOf, runFighter } from './hero.ts';
import { isSeasonBossFloor, seasonFloor } from './season.ts';
import { addMaterial, injure, nextWall, wallIndex } from './state.ts';
import type { ExpeditionEnd, ExpeditionMode, FloorResult, RunExpeditionLog, RunFloorLog, RunState } from './types.ts';

export const EXPEDITION_STREAM = 'expedition';

/** 출발 층 = 마지막으로 잡은 보스의 다음 층 (7.8); 마지막 등반은 51층. */
export function expeditionStart(s: Pick<RunState, 'lastBossFloor'>, mode: ExpeditionMode): number {
  return mode === 'climb' ? FINAL_CLIMB_START : s.lastBossFloor + 1;
}

export interface ReturnCheckInput {
  hp: number;
  durability: number;
  floorsEntered: number;
  maxFloors: number;
  nextClearChance: number;
  policy: ExpeditionPolicy;
}

/** 귀환 기준 (7.10) with the 방침's HP and 돌파 확률 (13.4.4). Same order as the world's check. */
export function policyReturn(c: ReturnCheckInput): ExpeditionEnd | null {
  const p = POLICY_RETURN[c.policy];
  if (c.hp <= p.hp) return 'hp';
  if (c.durability <= RETURN_AT_DURABILITY) return 'durability';
  if (c.floorsEntered >= c.maxFloors) return 'maxFloors';
  if (c.nextClearChance < p.clearChance) return 'risk';
  return null;
}

const BODY_FAMILY: Record<BodyType, BodyMaterialFamily> = Object.fromEntries(
  (Object.entries(FAMILY_BODY) as [BodyMaterialFamily, BodyType][]).map(([family, body]) => [body, family]),
) as Record<BodyType, BodyMaterialFamily>;

/** 재료 발견 확률 per cleared floor: 5% × 시즌 규칙 (재 냄새 ×2) × [검증] 사건 빈도 (13.11, 13.2.1). */
export function findChance(s: Pick<RunState, 'setup' | 'rules'>): number {
  return FIND_CHANCE_PER_FLOOR * SEASONS[s.setup.season].rule.findMult * s.rules.eventRate;
}

/** 재료 발견 (13.11): 그 층 체형 계열의 인챈트 재료 1개, 31층부터 상급. */
function rollFind(s: RunState, floor: number, body: BodyType): EnchantMaterialKey | null {
  const rng = rngFor(s.setup.seed, EVENT_STREAM, s.turn, 'find', floor);
  if (rng.next() >= findChance(s)) return null;
  return `${BODY_FAMILY[body]}:${floor >= UPPER_MATERIAL_FROM_FLOOR ? 'high' : 'low'}`;
}

/** [검증] 후반 층 수입 배율: ×1 below LATE_GOLD_FROM_FLOOR (13.4.3), the switch's rate from there up. */
export function floorGoldRate(s: Pick<RunState, 'rules'>, floor: number): number {
  return floor >= LATE_GOLD_FROM_FLOOR ? s.rules.lateGoldRate : 1;
}

export interface ExpeditionOutcome {
  log: RunExpeditionLog;
  /** The wall the 벽 도전 had to beat and did not: the run ends in 은퇴. */
  wallFailed: boolean;
  /** 사망 (only with the [검증] switch '사망'). */
  died: boolean;
}

/**
 * Climbs on a draft state. 원정 (방침), 벽 도전 (귀환 기준 off until the wall boss falls, then
 * 보통), 마지막 등반 (no 귀환 기준, no floor cap). Bosses beaten for the first time give their
 * reward at once and leave a card choice on s.pending.
 */
export function climb(s: RunState, mode: ExpeditionMode, policy: ExpeditionPolicy): ExpeditionOutcome {
  s.expeditionNo += 1;
  const no = s.expeditionNo;
  const start = expeditionStart(s, mode);
  const wall = mode === 'wall' ? nextWall(s) : null;
  const log: RunExpeditionLog = {
    no,
    mode,
    policy: mode === 'normal' ? policy : 'normal',
    startFloor: start,
    floors: [],
    end: 'maxFloors',
    result: null,
    gold: 0,
    levelBefore: heroLevel(s),
    levelAfter: heroLevel(s),
    bosses: [],
    finds: [],
    maintain: s.maintainBuff,
    escort: s.escort,
  };
  let wallCleared = wall === null;
  let rebirthUsed = false;
  let indomitableUsed = false;
  let entered = 0;
  let wallFailed = false;
  let died = false;

  for (let floor = start; ; floor++) {
    const info = seasonFloor(s.setup.season, floor);
    const profile = profileOf(s);
    const fighter = runFighter(s, info.body);
    const checks = mode === 'normal' || (mode === 'wall' && wallCleared);
    if (checks) {
      const next = clearChance(partyPower(profile, fighter, info) / info.enemyPower);
      const reason = policyReturn({
        hp: s.hp,
        durability: s.weapon.durability,
        floorsEntered: entered,
        maxFloors: MAX_FLOORS_PER_EXPEDITION + profile.extraFloors,
        nextClearChance: effectiveClearChance(next, profile.fairWind),
        policy: log.policy,
      });
      if (reason !== null) {
        log.end = reason;
        break;
      }
    }

    // Enter the floor: wear first, then judge with the floor's own stream (7.8, 7.12).
    const rng = rngFor(s.setup.seed, EXPEDITION_STREAM, no, floor);
    const boss = info.kind !== 'normal';
    const wear = boss ? WEAR_BOSS_MIN + rng.next() * (WEAR_BOSS_MAX - WEAR_BOSS_MIN) : WEAR_NORMAL_FLOOR;
    s.weapon.durability = Math.max(0, s.weapon.durability - wear * profile.wearMult);
    const dull = s.weapon.durability <= 0;
    const r = partyPower(profile, fighter, info, dull) / info.enemyPower;
    const chance = clearChance(r);
    let cleared = rollClear(rng, chance, profile.fairWind);
    if (!cleared && profile.rebirth && !rebirthUsed) {
      rebirthUsed = true; // 환생: judge the same floor once more, HP unchanged
      cleared = rollClear(rng, chance, profile.fairWind);
    }
    entered += 1;
    const entry: RunFloorLog = {
      floor,
      band: info.band,
      kind: info.kind,
      body: info.body,
      element: info.element,
      name: info.name,
      r,
      // What the roll above amounts to (순풍의 운 rolls twice), the same number the previews show.
      chance: effectiveClearChance(chance, profile.fairWind),
      cleared,
      hp: s.hp,
      hpLoss: 0,
      durability: s.weapon.durability,
      dull,
      gold: 0,
      level: heroLevel(s),
      find: null,
      result: null,
    };

    if (!cleared) {
      const odds = failOdds(s.hp, boss, profile.riskMult, injuryMult(s));
      const roll = rollFailOutcome(rng, odds, luckSave(s), profile.indomitable && !indomitableUsed);
      if (roll.indomitableUsed) indomitableUsed = true;
      let result: FloorResult = roll.outcome;
      if (roll.outcome === 'death') result = s.rules.deathMode === 'death' ? 'death' : 'severe';
      entry.result = result;
      log.result = result;
      log.end = 'failed';
      log.floors.push(entry);
      break;
    }

    // Cleared: HP, 판 누적 층 (레벨), 판 골드, 기록 (13.4.1, 13.5).
    entry.hpLoss = hpLossOnClear(r, boss);
    s.hp = Math.max(0, s.hp - entry.hpLoss);
    s.cumulativeFloors += 1;
    entry.level = heroLevel(s);
    entry.gold = Math.round(materialPrice(info.band) * INCOME_UNITS_PER_FLOOR * profile.incomeMult * floorGoldRate(s, floor));
    s.gold += entry.gold;
    s.stats.goldEarned += entry.gold;
    log.gold += entry.gold;
    if (floor > s.record) s.record = floor;
    entry.find = rollFind(s, floor, info.body);
    if (entry.find !== null) {
      addMaterial(s, entry.find, 1);
      log.finds.push(entry.find);
      s.stats.finds += 1;
    }
    if (isSeasonBossFloor(floor) && floor > s.lastBossFloor) {
      s.lastBossFloor = floor;
      log.bosses.push(floor);
      s.stats.bossesCleared.push(floor);
      const w = s.walls[wallIndex(floor)];
      if (w !== undefined && w.passedTurn === null) w.passedTurn = s.turn;
      s.pending.push(bossReward(s, floor));
      if (wall !== null && floor === wall.floor) wallCleared = true;
    }
    log.floors.push(entry);
    if (dull) {
      log.end = 'dull'; // 무뎌짐: 판정 뒤에는 결과와 관계없이 돌아온다 (7.12)
      break;
    }
    if (s.hp <= 0) {
      log.end = 'hpZero';
      break;
    }
  }

  // The buffs were for this expedition (정비 ×1.2, 동행 원정).
  s.maintainBuff = false;
  s.escort = 0;
  log.levelAfter = heroLevel(s);

  if (log.result === 'injury' || log.result === 'severe') {
    injure(s);
    s.stats.injuries += 1;
    if (log.result === 'severe') {
      s.forcedRest = true;
      s.stats.severe += 1;
    }
  }
  if (log.result === 'death') died = true;
  if (mode === 'wall' && !wallCleared) wallFailed = true;
  return { log, wallFailed, died };
}

/**
 * What a 원정 would do, judged on the path where every floor is cleared (expected HP and wear, no
 * dice), with the chances along it multiplied in. Turn-screen numbers only; the climb itself rolls.
 */
export interface ExpeditionForecast {
  policy: ExpeditionPolicy;
  startFloor: number;
  /** Floors it would enter before a 귀환 기준 (or the floor cap) turns it back. */
  floors: number;
  /** Expected floors cleared (each floor's 돌파 확률 multiplied along). */
  expectedCleared: number;
  /** Why it would turn back. */
  end: ExpeditionEnd;
  /** The next wall's boss on the way: its R and 돌파 확률 when the climb would get there. */
  boss: { floor: number; r: number; chance: number } | null;
  /** Chance it gets past that boss on this climb: every floor up to it and the boss itself. 0 if it turns back first. */
  bossPass: number;
  /** Chance every floor it enters is cleared. */
  clearAll: number;
  /** Chance it comes back hurt: a floor fails and the 실패 결과 (7.9) is 부상 or 중상 (사망). */
  hurt: number;
  /** HP and 무기 내구도 when it turns back, if every floor is cleared. */
  hpEnd: number;
  durabilityEnd: number;
}

/** 방침별 예상 층수, 다음 보스까지 넘을 확률, 다칠 확률 (13.17 턴 화면의 원정 미리보기). */
export function forecastExpedition(s: RunState, policy: ExpeditionPolicy, mode: ExpeditionMode = 'normal'): ExpeditionForecast {
  const start = expeditionStart(s, mode);
  const wall = nextWall(s);
  let hp = s.hp;
  let durability = s.weapon.durability;
  let cumulative = s.cumulativeFloors;
  let entered = 0;
  let reach = 1;
  let expected = 0;
  let hurt = 0;
  let bossPass = 0;
  let end: ExpeditionEnd = 'maxFloors';
  let boss: ExpeditionForecast['boss'] = null;
  const profile = profileOf(s);
  const wearBoss = (WEAR_BOSS_MIN + WEAR_BOSS_MAX) / 2;
  for (let floor = start; floor < start + 200; floor++) {
    const info = seasonFloor(s.setup.season, floor);
    const fighter = runFighter(s, info.body, { cumulativeFloors: cumulative });
    const r = partyPower(profile, fighter, info) / info.enemyPower;
    const chance = effectiveClearChance(clearChance(r), profile.fairWind);
    if (wall !== null && floor === wall.floor && boss === null) boss = { floor, r, chance };
    if (mode === 'normal' || (mode === 'wall' && bossPass > 0)) {
      const reason = policyReturn({
        hp,
        durability,
        floorsEntered: entered,
        maxFloors: MAX_FLOORS_PER_EXPEDITION + profile.extraFloors,
        nextClearChance: chance,
        policy,
      });
      if (reason !== null) {
        end = reason;
        break;
      }
    }
    const isBoss = info.kind !== 'normal';
    durability = Math.max(0, durability - (isBoss ? wearBoss : WEAR_NORMAL_FLOOR) * profile.wearMult);
    entered += 1;
    const odds = failOdds(hp, isBoss, profile.riskMult, injuryMult(s));
    hurt += reach * (1 - chance) * (odds.injury + odds.death);
    reach *= chance;
    expected += reach;
    if (wall !== null && floor === wall.floor) bossPass = reach;
    hp = Math.max(0, hp - hpLossOnClear(r, isBoss));
    cumulative += 1;
    if (durability <= 0) {
      end = 'dull';
      break;
    }
    if (hp <= 0) {
      end = 'hpZero';
      break;
    }
    if (mode !== 'normal' && reach < 0.01) {
      end = 'failed';
      break;
    }
  }
  return {
    policy,
    startFloor: start,
    floors: entered,
    expectedCleared: expected,
    end,
    boss,
    bossPass,
    clearAll: reach,
    hurt,
    hpEnd: hp,
    durabilityEnd: durability,
  };
}
