// Rebuilds the doc's worked examples from a real simulation, in the doc's table formats:
// 7.11 원정 예시 (one expedition, floor by floor) and 6.6 커리어 예시 (① B급, ② 게임 2일차의 고정 S급).
//   node tools/balance/examples.ts
// Options:
//   --policy P          supply policy standing in for the player (default matched)
//   --seeds K           search seeds 1..K for fitting examples (default 40)
//   --expedition S:H:N  pin the 7.11 example: seed S, hero id H, expedition number N
//   --b S:H             pin the 6.6 ① example: seed S, hero id H
//   --s S               pin the 6.6 ② example: the fixed S-grade hero of seed S
// The search is deterministic, so the same tuning always prints the same examples.

import { pathToFileURL } from 'node:url';
import { rngFor } from '../../src/sim/core/rng.ts';
import type { BodyType, Grade, TowerId, Weapon, WeaponType } from '../../src/sim/core/types.ts';
import {
  BODY_FIT_MULT,
  BODY_LABEL,
  type BodyFit,
  ELEMENT_LABEL,
  listPrice,
  MASTERY_MASTER_FLOOR,
  MASTERY_SKILLED_FLOOR,
  materialName,
  QUALITY,
  TOWER_LABEL,
  WEAPON_LABEL,
  WEAPON_SPEC,
} from '../../src/sim/data/common.ts';
import { ENCHANTS } from '../../src/sim/data/enchants.ts';
import { greatBossAt } from '../../src/sim/data/uniques.ts';
import {
  BAND_FLOORS,
  DAY_MINUTES,
  DISCIPLE_DELAY_MINUTES,
  type FailOdds,
  FIXED_S_ARRIVAL_MINUTE,
  FLOOR_MINUTES,
  HOUR_MINUTES,
  REPAIR_VISIT_BELOW,
  STAT_TIER_LABEL,
} from '../../src/sim/data/world.ts';
import { clearChance, failOdds, partyPower, weaponProfile } from '../../src/sim/world/combat.ts';
import { gradeShares } from '../../src/sim/world/fame.ts';
import { basicWeapon, fighterOf, levelOf, masteryFloorOf, powerOf, rollRookie } from '../../src/sim/world/hero.ts';
import { josa } from '../../src/sim/world/messages.ts';
import { advantageElement, createPolicy, type PolicyId } from '../../src/sim/world/supply.ts';
import { bandLayout, floorInfo } from '../../src/sim/world/tower.ts';
import type {
  FailOutcome,
  FloorKind,
  HeroState,
  RetireReason,
  ReturnReason,
  WorldEvent,
  WorldRules,
} from '../../src/sim/world/types.ts';
import { advanceWorld, createWorld, heroById, repairCost } from '../../src/sim/world/world.ts';

// ---------- formatting ----------

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const r2 = (v: number): string => v.toFixed(2);

/** Josa after a number read aloud in Korean (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 end in a consonant). */
function numberJosa(num: string, withFinal: string, withoutFinal: string): string {
  return '013678'.includes(num.charAt(num.length - 1)) ? withFinal : withoutFinal;
}

function clock(minute: number): string {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function gameDay(minute: number): number {
  return Math.floor(minute / DAY_MINUTES) + 1;
}

/** ★3 역작 수속성 미스릴 대검 (응급 회복·선제) */
export function weaponName(w: Omit<Weapon, 'id'>): string {
  const element = w.element === null ? '무속성' : `${ELEMENT_LABEL[w.element]}속성`;
  const enchants = w.enchants.length > 0 ? ` (${w.enchants.map((id) => ENCHANTS[id].name).join('·')})` : '';
  return `★${w.quality} ${QUALITY[w.quality].name} ${element} ${materialName(w.materialTier)} ${WEAPON_LABEL[w.type]}${enchants}`;
}

const FIT_MARK = { good: '◎', normal: '○', bad: '△' } as const;

/** ◎/○/△ as the tower calculation sees it: an elemental weapon reaches spirits at ○ (4.5). */
function effectiveFit(w: Pick<Weapon, 'type' | 'element'>, body: BodyType): BodyFit {
  const fit = WEAPON_SPEC[w.type].bodyFit[body];
  return fit === 'bad' && body === 'spirit' && w.element !== null ? 'normal' : fit;
}

function bossLabel(tower: TowerId, floor: number, kind: FloorKind): string {
  if (kind === 'demonLord') return `${floor}층 마왕`;
  const great = greatBossAt(tower, floor);
  if (kind === 'greatBoss' && great !== null) return `${floor}층 대보스 '${great.boss}'`;
  return `${floor}층 보스`;
}

const RETIRE_LABEL: Record<RetireReason, string> = {
  stagnant: '기록 정체',
  injuries: '부상 5회',
  maxDays: '커리어 10일',
};

function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  // The doc's own separator style: |---|---|
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n');
}

// ---------- 7.11 원정 예시 ----------

export interface ExpeditionPick {
  seed: number;
  heroId: string;
  expeditionNo: number;
}

/** Days simulated when looking for an expedition example. */
const EXPEDITION_SEARCH_DAYS = 12;
/** Like the doc: a B-grade first-generation hero setting out from floor 31. */
const EXPEDITION_GRADE: Grade = 'B';
const EXPEDITION_START = 31;

interface HeroFacts {
  grade: Grade;
  disciple: boolean;
  tower: TowerId | null;
  weapon: Omit<Weapon, 'id'> | null;
}

/**
 * Expeditions shaped like the doc's: B grade, first generation, a weapon with the tower's
 * weak element, starting at 31, 3~6 floors cleared over both ◎ and ○ bodies, ending in a
 * failed floor (not a boss) with a safe return. Among those, the best fit to the doc
 * (main material of the band, 대검 in the 화의 탑) wins; ties go to the earlier seed.
 */
export function findExpeditionExample(
  policyId: PolicyId,
  seeds: readonly number[],
  rules: Partial<WorldRules> = {},
): ExpeditionPick | null {
  const band = Math.ceil(EXPEDITION_START / BAND_FLOORS);
  const ranked = [...expeditionCandidates(policyId, seeds, rules)]
    .map((c) => ({
      pick: c.pick,
      score:
        (c.weapon.materialTier === band ? 3 : c.weapon.materialTier === band - 1 ? 2 : -5) +
        (c.weapon.type === 'greatsword' ? 2 : c.weapon.type === 'staff' ? -3 : 0) +
        (c.tower === 'fire' ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score); // stable: ties keep seed order
  // The failure should be a real gamble, not a 2% slip: replay the best few and keep the first that is.
  for (const c of ranked.slice(0, EXPEDITION_TRACE_LIMIT)) {
    const t = traceExpedition(c.pick, policyId, rules);
    const failed = t.rows.find((r) => !r.cleared);
    if (failed !== undefined && failed.chance >= FAILED_CHANCE_RANGE[0] && failed.chance <= FAILED_CHANCE_RANGE[1]) {
      return c.pick;
    }
  }
  return ranked[0]?.pick ?? null;
}

/** How many top candidates to replay when looking for a telling failure. */
const EXPEDITION_TRACE_LIMIT = 80;
/** Clear chance of the failed floor in the example. */
const FAILED_CHANCE_RANGE: readonly [number, number] = [0.5, 0.85];

export function* expeditionCandidates(
  policyId: PolicyId,
  seeds: readonly number[],
  rules: Partial<WorldRules>,
): Generator<{ pick: ExpeditionPick; weapon: Omit<Weapon, 'id'>; tower: TowerId }> {
  for (const seed of seeds) {
    const world = createWorld(seed, rules);
    const events = advanceWorld(world, EXPEDITION_SEARCH_DAYS * DAY_MINUTES, createPolicy(policyId));
    const towers = new Map<string, TowerId>();
    for (const h of [...world.heroes, ...world.careers]) towers.set(h.id, h.tower);
    const facts = new Map<string, HeroFacts>();
    const departs = new Map<string, { no: number; start: number }>();
    for (const e of events) {
      if (e.kind === 'arrival') {
        facts.set(e.heroId, { grade: e.grade, disciple: e.disciple, tower: towers.get(e.heroId) ?? null, weapon: null });
      } else if (e.kind === 'visit' && e.bought !== null) {
        const f = facts.get(e.heroId);
        if (f !== undefined) f.weapon = e.bought;
      } else if (e.kind === 'depart') {
        departs.set(e.heroId, { no: e.expeditionNo, start: e.startFloor });
      } else if (e.kind === 'return') {
        const d = departs.get(e.heroId);
        const f = facts.get(e.heroId);
        if (d === undefined || f === undefined || f.tower === null || f.weapon === null) continue;
        if (d.start !== EXPEDITION_START || f.grade !== EXPEDITION_GRADE || f.disciple) continue;
        if (f.weapon.element !== advantageElement(f.tower)) continue;
        if (e.reason !== 'failed' || e.outcome !== 'safe' || e.floorsCleared < 3 || e.floorsCleared > 6) continue;
        const failed = d.start + e.floorsCleared;
        if (failed % BAND_FLOORS === 0) continue;
        const fits = new Set<BodyFit>();
        for (let fl = d.start; fl <= failed; fl++) fits.add(effectiveFit(f.weapon, floorInfo(seed, f.tower, fl).body));
        if (!fits.has('good') || !fits.has('normal')) continue;
        yield { pick: { seed, heroId: e.heroId, expeditionNo: d.no }, weapon: f.weapon, tower: f.tower };
      }
    }
  }
}

export interface FloorRow {
  floor: number;
  kind: FloorKind;
  body: BodyType;
  r: number;
  chance: number;
  cleared: boolean;
  outcome: FailOutcome | null;
  dull: boolean;
  hpAtEntry: number;
  hpAfter: number;
  durabilityAfter: number;
}

export interface ExpeditionTrace {
  pick: ExpeditionPick;
  grade: Grade;
  tower: TowerId;
  weapon: Omit<Weapon, 'id'>;
  power: number;
  level: number;
  startFloor: number;
  durabilityStart: number;
  rows: FloorRow[];
  reason: ReturnReason;
  outcome: FailOutcome | null;
  /** Odds rolled on the failed floor. */
  failOdds: FailOdds | null;
  /** The floor the hero turned back from without entering (risk), with its R. */
  turnedBack: { floor: number; r: number; chance: number } | null;
  repaired: boolean;
  durabilityEnd: number;
  nextBoss: { floor: number; label: string; r: number; chance: number };
  /** Same hero, same weapon without its element, on the first floor. */
  plainFirst: { r: number; chance: number };
  band: { main: BodyType; sub: BodyType; bossBody: BodyType };
}

/** Replays the world up to the expedition and steps it floor by floor (results do not depend on step size). */
export function traceExpedition(pick: ExpeditionPick, policyId: PolicyId, rules: Partial<WorldRules> = {}): ExpeditionTrace {
  const world = createWorld(pick.seed, rules);
  const policy = createPolicy(policyId);
  // Step by hour until the departure of that expedition is the hero's next event.
  let hero: HeroState | undefined;
  for (let t = 0; ; t += HOUR_MINUTES) {
    if (t > 40 * DAY_MINUTES) throw new Error(`expedition ${pick.expeditionNo} of ${pick.heroId} not found`);
    advanceWorld(world, t, policy);
    hero = heroById(world, pick.heroId);
    if (hero !== undefined && hero.phase === 'town' && hero.expeditionNo === pick.expeditionNo - 1 && hero.nextAt - t <= HOUR_MINUTES) {
      advanceWorld(world, hero.nextAt - 1, policy);
      break;
    }
  }
  if (hero === undefined) throw new Error('hero missing');
  const h = hero;
  const seed = pick.seed;
  const departAt = h.nextAt;
  const weapon = { ...h.held.weapon, enchants: [...h.held.weapon.enchants] };
  const startFloor = h.lastBossFloor + 1;
  const durabilityStart = h.held.durability;
  const power = powerOf(h);
  const level = levelOf(h);

  const firstInfo = floorInfo(seed, h.tower, startFloor, departAt, world.demonLordsDown);
  const plain = weaponProfile({ ...weapon, element: null }, masteryFloorOf(h));
  const plainR = partyPower(plain, fighterOf(h), firstInfo) / firstInfo.enemyPower;

  const events: WorldEvent[] = [...advanceWorld(world, departAt, policy)];
  const rows: FloorRow[] = [];
  for (;;) {
    const exp = h.expedition;
    if (exp === null || exp.pending === null) break;
    const p = exp.pending;
    const body = floorInfo(seed, h.tower, p.floor, h.nextAt - FLOOR_MINUTES, world.demonLordsDown).body;
    rows.push({
      floor: p.floor,
      kind: p.kind,
      body,
      r: p.r,
      chance: p.chance,
      cleared: p.cleared,
      outcome: p.outcome,
      dull: p.dull,
      hpAtEntry: exp.hp,
      hpAfter: p.cleared ? Math.max(0, exp.hp - p.hpLoss) : exp.hp,
      durabilityAfter: h.held.durability,
    });
    events.push(...advanceWorld(world, h.nextAt, policy));
  }
  const back = events.find((e) => e.kind === 'return' && e.heroId === h.id && e.expeditionNo === pick.expeditionNo);
  if (back === undefined || back.kind !== 'return') throw new Error('expedition did not end');
  const visit = events.find((e) => e.kind === 'visit' && e.heroId === h.id && e.at === back.at);

  const profile = weaponProfile(weapon, masteryFloorOf(h));
  const fighter = fighterOf(h);
  const last = rows[rows.length - 1];
  const failed = last !== undefined && !last.cleared ? last : null;
  const turnedBack =
    back.reason === 'risk'
      ? (() => {
          const fl = startFloor + back.floorsCleared;
          const info = floorInfo(seed, h.tower, fl, back.at, world.demonLordsDown);
          const r = partyPower(profile, fighter, info) / info.enemyPower;
          return { floor: fl, r, chance: clearChance(r) };
        })()
      : null;
  const bossFloor = Math.ceil(startFloor / BAND_FLOORS) * BAND_FLOORS;
  const bossInfo = floorInfo(seed, h.tower, bossFloor, back.at, world.demonLordsDown);
  const bossR = partyPower(profile, fighter, bossInfo) / bossInfo.enemyPower;
  const layout = bandLayout(seed, h.tower, Math.ceil(startFloor / BAND_FLOORS));

  return {
    pick,
    grade: h.grade,
    tower: h.tower,
    weapon,
    power,
    level,
    startFloor,
    durabilityStart,
    rows,
    reason: back.reason,
    outcome: back.outcome,
    failOdds:
      failed === null
        ? null
        : failOdds(failed.hpAtEntry, failed.kind !== 'normal', profile.riskMult, h.inherit.injuryMult),
    turnedBack,
    repaired: visit !== undefined && visit.kind === 'visit' && visit.repaired,
    durabilityEnd: last?.durabilityAfter ?? durabilityStart,
    nextBoss: { floor: bossFloor, label: bossLabel(h.tower, bossFloor, bossInfo.kind), r: bossR, chance: clearChance(bossR) },
    plainFirst: { r: plainR, chance: clearChance(plainR) },
    band: { main: layout.main, sub: layout.sub, bossBody: bossInfo.body },
  };
}

const OUTCOME_LINE: Record<FailOutcome, string> = {
  safe: '무사 귀환했다',
  injury: '부상을 입고 돌아와 12시간 쉰다',
  death: '돌아오지 않았다',
};

export function renderExpedition(t: ExpeditionTrace): string {
  const type = WEAPON_LABEL[t.weapon.type];
  const lastBand = Math.ceil(t.startFloor / BAND_FLOORS) * BAND_FLOORS;
  const intro =
    `${t.grade}급 용사. ${type}, ${weaponName(t.weapon)}, 힘 ${r2(t.power)} (레벨 ${t.level}). ` +
    `${TOWER_LABEL[t.tower]}, 마지막으로 잡은 보스는 ${t.startFloor - 1}층이라 ${t.startFloor}층에서 출발한다. ` +
    `${t.startFloor}~${lastBand}층은 ${BODY_LABEL[t.band.main]} 6층·${BODY_LABEL[t.band.sub]} 3층이고 보스는 ${BODY_LABEL[t.band.bossBody]}. ` +
    `출발할 때 HP 100%, 내구도 ${pct(t.durabilityStart)}.`;
  const rows = t.rows.map((r) => [
    String(r.floor),
    BODY_LABEL[r.body] + (r.kind === 'normal' ? '' : ' (보스)'),
    r2(r.r),
    pct(r.chance),
    r.cleared ? '돌파' : '실패',
    pct(r.hpAfter),
    pct(r.durabilityAfter),
  ]);

  const notes: string[] = [];
  const seen = [...new Set(t.rows.map((r) => r.body))];
  const good = seen.find((b) => effectiveFit(t.weapon, b) === 'good');
  const normal = seen.find((b) => effectiveFit(t.weapon, b) === 'normal');
  if (good !== undefined && normal !== undefined) {
    const ratio = BODY_FIT_MULT.good / BODY_FIT_MULT.normal;
    notes.push(
      WEAPON_SPEC[t.weapon.type].bodyFit[normal] === 'bad'
        ? `${BODY_LABEL[normal]} 층은 속성 무기라 △가 ${FIT_MARK.normal}로 올라도 ${BODY_LABEL[good]} 층(${FIT_MARK.good})보다 R이 ${ratio.toFixed(1)}배 낮다.`
        : `${BODY_LABEL[normal]} 층은 ${type}${josa(type, '이', '가')} ${FIT_MARK.normal}라 ${BODY_LABEL[good]} 층(${FIT_MARK.good})보다 R이 ${ratio.toFixed(1)}배 낮다.`,
    );
  }
  const failed = t.rows.find((r) => !r.cleared);
  if (failed !== undefined && t.failOdds !== null && t.outcome !== null) {
    const o = t.failOdds;
    notes.push(
      `${failed.floor}층 실패: HP ${pct(failed.hpAtEntry)}로 들어갔으니 무사 귀환 ${pct(o.safe)} · 부상 ${pct(o.injury)} · 사망 ${pct(o.death)}. ${OUTCOME_LINE[t.outcome]}.`,
    );
  }
  if (t.turnedBack !== null) {
    notes.push(`${t.turnedBack.floor}층은 R ${r2(t.turnedBack.r)}(돌파 ${pct(t.turnedBack.chance)})${numberJosa(r2(t.turnedBack.r), '이라', '라')} 들어가지 않고 돌아선다.`);
  }
  notes.push(
    t.durabilityEnd < REPAIR_VISIT_BELOW
      ? `내구도 ${pct(t.durabilityEnd)}라 가게에 들러 수리를 받는다.`
      : `내구도 ${pct(t.durabilityEnd)}라 수리 없이 다음 원정을 나간다.`,
  );
  const b = t.nextBoss;
  notes.push(
    b.chance < 0.5
      ? `${b.label}는 R ${r2(b.r)}(돌파 약 ${pct(b.chance)})${numberJosa(r2(b.r), '이라', '라')} 아직 들어가지 않는다. 레벨이나 무기가 올라야 넘는 벽이다.`
      : `${b.label}는 R ${r2(b.r)}(돌파 약 ${pct(b.chance)})${numberJosa(r2(b.r), '이라', '라')} 다음 원정에서 닿으면 도전한다.`,
  );
  notes.push(
    `같은 용사가 무속성 ${type}${josa(type, '을', '를')} 들었다면 ${t.startFloor}층 R은 ${r2(t.plainFirst.r)}(돌파 ${pct(t.plainFirst.chance)})${numberJosa(r2(t.plainFirst.r), '이다', '다')}.`,
  );
  const minutes = t.rows.length * FLOOR_MINUTES;
  notes.push(
    `이 원정은 ${t.rows.length}층 × ${FLOOR_MINUTES}분 = 약 ${Math.floor(minutes / 60)}시간${minutes % 60 > 0 ? ` ${minutes % 60}분` : ''}이다.`,
  );

  return [
    intro,
    '',
    table(['층', '적', 'R', '돌파 확률', '결과', 'HP', '내구도'], rows),
    '',
    ...notes.map((n) => `- ${n}`),
  ].join('\n');
}

// ---------- 6.6 커리어 예시 ----------

export interface CareerPick {
  seed: number;
  heroId: string;
}

/** Days simulated when looking for a career: the hero arrives early and a career lasts at most 10 days. */
const CAREER_SEARCH_DAYS = 13;
/** '숨은 성장률 높음'. */
const HIGH_GROWTH = 0.8;

interface CareerSummary {
  grade: Grade;
  weaponType: WeaponType;
  tower: TowerId;
  growth: number;
  record: number;
  retired: boolean;
  firstGen: boolean;
  arrivedAt: number;
  firstCredit: boolean;
  stagnationBuy: boolean;
  injuries: number;
  bossFailInjury: boolean;
  retireStagnant: boolean;
}

function summarizeCareers(seed: number, policyId: PolicyId, rules: Partial<WorldRules>): Map<string, CareerSummary> {
  const world = createWorld(seed, rules);
  const events = advanceWorld(world, CAREER_SEARCH_DAYS * DAY_MINUTES, createPolicy(policyId));
  const out = new Map<string, CareerSummary>();
  for (const c of world.careers) {
    out.set(c.id, {
      grade: c.grade,
      weaponType: c.weaponType,
      tower: c.tower,
      growth: c.growth,
      record: c.record,
      retired: c.end === 'retired',
      firstGen: c.generation === 1,
      arrivedAt: c.arrivedAt,
      firstCredit: false,
      stagnationBuy: false,
      injuries: c.injuries,
      bossFailInjury: false,
      retireStagnant: false,
    });
  }
  const departs = new Map<string, number>();
  for (const e of events) {
    const s = 'heroId' in e ? out.get(e.heroId) : undefined;
    if (s === undefined) continue;
    if (e.kind === 'visit' && e.bought !== null) {
      if (e.reasons.includes('first') && e.credit > 0) s.firstCredit = true;
      if (e.reasons.includes('stagnation')) s.stagnationBuy = true;
    } else if (e.kind === 'depart') departs.set(e.heroId, e.startFloor);
    else if (e.kind === 'return' && e.reason === 'failed' && e.outcome === 'injury') {
      const floor = (departs.get(e.heroId) ?? 1) + e.floorsCleared;
      if (floor % BAND_FLOORS === 0) s.bossFailInjury = true;
    } else if (e.kind === 'retire' && e.reason === 'stagnant') s.retireStagnant = true;
  }
  return out;
}

function careerScore(s: CareerSummary, like: { weaponType: WeaponType; tower: TowerId }): number {
  return (
    (s.firstCredit ? 3 : 0) +
    (s.stagnationBuy ? 2 : 0) +
    (s.bossFailInjury ? 2 : 0) +
    (s.injuries > 0 ? 1 : 0) +
    (s.retireStagnant ? 1 : 0) +
    (s.weaponType === like.weaponType ? 1 : 0) +
    (s.tower === like.tower ? 1 : 0)
  );
}

/** ① B급: first generation, high growth, arrived on day 1, retired; best fit to the doc's story ('로안', 한손검 · 화의 탑). */
export function findBCareer(policyId: PolicyId, seeds: readonly number[], rules: Partial<WorldRules> = {}): CareerPick | null {
  let best: { pick: CareerPick; score: number } | null = null;
  for (const seed of seeds) {
    for (const [id, s] of summarizeCareers(seed, policyId, rules)) {
      if (s.grade !== 'B' || !s.firstGen || !s.retired || s.growth < HIGH_GROWTH || s.arrivedAt >= DAY_MINUTES) continue;
      const score = careerScore(s, { weaponType: 'oneHandSword', tower: 'fire' });
      if (best === null || score > best.score) best = { pick: { seed, heroId: id }, score };
    }
  }
  return best?.pick ?? null;
}

/** The fixed S-grade hero of a seed arrives at FIXED_S_ARRIVAL_MINUTE; its roll is fixed by the seed. */
export function fixedSRoll(seed: number) {
  return rollRookie(rngFor(seed, 'fixedS', 0), gradeShares(1), 'S');
}

/**
 * Id of the fixed S-grade hero. Earlier arrivals depend on the fame stage and so on the
 * policy, hence the replay; the fixed S is the first non-disciple arrival at its minute.
 */
export function fixedSHeroId(seed: number, policyId: PolicyId = 'matched', rules: Partial<WorldRules> = {}): string {
  const world = createWorld(seed, rules);
  const events = advanceWorld(world, FIXED_S_ARRIVAL_MINUTE, createPolicy(policyId));
  const e = events.find((x) => x.kind === 'arrival' && x.at === FIXED_S_ARRIVAL_MINUTE && !x.disciple);
  if (e === undefined || e.kind !== 'arrival' || e.grade !== 'S') throw new Error(`no fixed S hero in seed ${seed}`);
  return e.heroId;
}

/** ② 게임 2일차의 고정 S급: high growth, retired; best fit to the doc's story ('세라', 대검 · 지의 탑). */
export function findSCareer(policyId: PolicyId, seeds: readonly number[], rules: Partial<WorldRules> = {}): CareerPick | null {
  let best: { pick: CareerPick; score: number } | null = null;
  for (const seed of seeds) {
    if (fixedSRoll(seed).growth < HIGH_GROWTH) continue;
    const careers = summarizeCareers(seed, policyId, rules);
    for (const [id, s] of careers) {
      if (s.grade !== 'S' || s.arrivedAt !== FIXED_S_ARRIVAL_MINUTE || !s.firstGen || !s.retired) continue;
      const score = careerScore(s, { weaponType: 'greatsword', tower: 'earth' });
      if (best === null || score > best.score) best = { pick: { seed, heroId: id }, score };
      break;
    }
  }
  return best?.pick ?? null;
}

interface Snapshot {
  at: number;
  debt: number;
  gold: number;
  record: number;
  power: number;
  level: number;
  masteryFloor: number;
}

export interface CareerTrace {
  pick: CareerPick;
  hero: HeroState;
  events: WorldEvent[];
  snaps: Snapshot[];
  /** The disciple's arrival, when one came. */
  disciple: (WorldEvent & { kind: 'arrival' }) | null;
}

/**
 * Replays the world and keeps everything about one hero. It stops on every hour and on
 * each of the hero's own events, so there is a snapshot right after every return, and
 * one more from the hero's final state when the career ends (results do not depend on
 * step size, 3.6).
 */
export function traceCareer(pick: CareerPick, policyId: PolicyId, rules: Partial<WorldRules> = {}): CareerTrace {
  const world = createWorld(pick.seed, rules);
  const policy = createPolicy(policyId);
  const events: WorldEvent[] = [];
  const snaps: Snapshot[] = [];
  let hero: HeroState | null = null;
  let endedAt: number | null = null;
  let finalTaken = false;
  let disciple: (WorldEvent & { kind: 'arrival' }) | null = null;
  const snap = (h: HeroState, at: number): void => {
    snaps.push({
      at,
      debt: h.debt,
      gold: h.gold,
      record: h.record,
      power: powerOf(h),
      level: levelOf(h),
      masteryFloor: masteryFloorOf(h),
    });
  };
  for (let t = HOUR_MINUTES; ; ) {
    if (t > 40 * DAY_MINUTES) throw new Error(`career of ${pick.heroId} did not end`);
    for (const e of advanceWorld(world, t, policy)) {
      if (e.kind === 'arrival' && e.masterId === pick.heroId) disciple = e;
      if (!('heroId' in e) || e.heroId !== pick.heroId) continue;
      events.push(e);
      if (e.kind === 'retire' || e.kind === 'death') endedAt = e.at;
    }
    const live = heroById(world, pick.heroId);
    if (live !== undefined) {
      hero = live;
      snap(live, t);
    } else if (hero !== null && endedAt !== null && !finalTaken) {
      // The hero left the world at endedAt; the object keeps its last state.
      snap(hero, endedAt);
      finalTaken = true;
    }
    if (endedAt !== null && t >= endedAt + DISCIPLE_DELAY_MINUTES + HOUR_MINUTES) break;
    const nextHour = (Math.floor(t / HOUR_MINUTES) + 1) * HOUR_MINUTES;
    t = live !== undefined && live.nextAt > t ? Math.min(nextHour, live.nextAt) : nextHour;
  }
  if (hero === null) throw new Error(`hero ${pick.heroId} never arrived`);
  return { pick, hero, events, snaps, disciple };
}

/**
 * The career day (1 = the first 24 hours after arrival) each event belongs to in the 6.6
 * table. An expedition belongs to the day it comes back: its departure and the records
 * set on the way go to that row too, so a row lists whole expeditions and its 기록 column
 * is the state after the last of them.
 */
export function careerDayOf(t: Pick<CareerTrace, 'hero' | 'events'>): (e: WorldEvent) => number {
  const arrivedAt = t.hero.arrivedAt;
  const day = (at: number): number => Math.floor((at - arrivedAt) / DAY_MINUTES) + 1;
  const backAt = new Map<number, number>();
  const departs: { at: number; no: number }[] = [];
  for (const e of t.events) {
    if (e.kind === 'return') backAt.set(e.expeditionNo, e.at);
    else if (e.kind === 'depart') departs.push({ at: e.at, no: e.expeditionNo });
  }
  /** Return time of the expedition under way at `at` (the last departure at or before it). */
  const backOfExpeditionAt = (at: number): number | undefined => {
    let no: number | undefined;
    for (const d of departs) if (d.at <= at) no = d.no;
    return no === undefined ? undefined : backAt.get(no);
  };
  return (e) => {
    if (e.kind === 'depart') return day(backAt.get(e.expeditionNo) ?? e.at);
    if (e.kind === 'record' || e.kind === 'shopRecord' || e.kind === 'dull') return day(backOfExpeditionAt(e.at) ?? e.at);
    return day(e.at);
  };
}

function expeditionText(start: number, back: WorldEvent & { kind: 'return' }): string {
  const n = back.floorsCleared;
  const span = n === 0 ? '' : n === 1 ? `${start}층` : `${start}~${start + n - 1}층`;
  const lead = span === '' ? '' : `${span}, `;
  const next = start + n;
  switch (back.reason) {
    case 'failed':
      return `${lead}${next}층 실패${back.outcome === 'injury' ? '(부상)' : back.outcome === 'death' ? '(사망)' : ''}`;
    case 'risk':
      return `${lead}${next}층 앞에서 돌아섬`;
    case 'maxFloors':
      return `${span} 꽉 채움`;
    case 'hp':
      return `${lead}HP 40% 이하로 귀환`;
    case 'durability':
      return `${lead}내구도 20% 이하로 귀환`;
    case 'dull':
      return `${lead}날이 무뎌져 귀환`;
  }
}

/** 을/를 after a label that may end in a quote: '심해룡' → 를. */
function objectJosa(text: string): string {
  return josa(text.replace(/['"\s)]+$/u, ''), '을', '를');
}

export function renderCareer(t: CareerTrace, title: string): string {
  const h = t.hero;
  const dayOf = careerDayOf(t);
  const days = t.events.reduce((m, e) => Math.max(m, dayOf(e)), 1);
  // A row's 기록 is the state right after the last return listed in it (or on an earlier row).
  const returnTimes = t.events.filter((e) => e.kind === 'return').map((e) => ({ day: dayOf(e), at: e.at }));
  const lastReturnBy = (d: number): number | undefined => {
    let at: number | undefined;
    for (const r of returnTimes) if (r.day <= d) at = r.at;
    return at;
  };
  const snapAtOrBefore = (at: number): Snapshot | undefined => {
    let s: Snapshot | undefined;
    for (const x of t.snaps) if (x.at <= at) s = x;
    return s;
  };
  const snapAfter = (at: number): Snapshot | undefined => t.snaps.find((x) => x.at >= at);
  const type = WEAPON_LABEL[h.weaponType];
  const handOver = (w: Omit<Weapon, 'id'>, credit: number): string => {
    const price = listPrice(w.materialTier, w.quality);
    return credit > 0
      ? `${weaponName(w)}${josa(type, '을', '를')} 외상으로 준다 (정가 ${price}G, 웃돈 포함 ${Math.round(credit)}G)`
      : `${weaponName(w)}${josa(type, '을', '를')} 현금 ${price}G에 산다`;
  };

  const rows: string[][] = [];
  const startOf = new Map<number, number>();
  let mastery = 0;
  let debtBefore = 0;
  const visitCounts = { first: 0, repair: 0, stagnation: 0, debt: 0, farewell: 0 };
  const bought: string[] = [];
  let creditCleared: number | null = null;

  for (let d = 1; d <= days; d++) {
    const first: string[] = [];
    const happenings: string[] = [];
    const closing: string[] = [];
    const expeditions: string[] = [];
    const bosses: string[] = [];
    let repairs = 0;
    let debtPaid = 0;
    let stuckNoBuy = 0;
    let injuries = 0;
    for (const e of t.events) {
      if (dayOf(e) !== d) continue;
      switch (e.kind) {
        case 'visit': {
          for (const r of e.reasons) visitCounts[r]++;
          const after = snapAfter(e.at);
          const debtAfter = after?.debt ?? 0;
          debtPaid += Math.max(0, debtBefore - (debtAfter - e.credit));
          if (debtBefore > 0 && debtAfter - e.credit <= 1e-9 && creditCleared === null) creditCleared = d;
          debtBefore = debtAfter;
          if (e.repaired) repairs++;
          if (e.reasons.includes('first')) {
            const when = `첫 방문 (게임 ${gameDay(e.at)}일 ${clock(e.at)})`;
            if (e.bought === null) {
              first.push(`${when}. 더 나은 무기를 사지 않고 기본 무기로 나간다`);
            } else {
              const price = listPrice(e.bought.materialTier, e.bought.quality);
              const gold = (after?.gold ?? 0) + (e.credit > 0 ? 0 : price);
              const budget = gold - repairCost(basicWeapon('b', h.weaponType));
              first.push(`${when}. 예산 ${Math.round(budget)}G. ${handOver(e.bought, e.credit)}`);
            }
          } else if (e.bought !== null) {
            happenings.push(
              e.reasons.includes('stagnation')
                ? `공략이 막혀 새 무기를 사러 온다. ${handOver(e.bought, e.credit)}`
                : `수리하러 와서 진열대의 ${handOver(e.bought, e.credit)}`,
            );
          } else if (e.reasons.includes('stagnation')) {
            stuckNoBuy++;
          }
          if (e.bought !== null) bought.push(weaponName(e.bought));
          break;
        }
        case 'depart':
          startOf.set(e.expeditionNo, e.startFloor);
          break;
        case 'return': {
          const start = startOf.get(e.expeditionNo) ?? 1;
          expeditions.push(expeditionText(start, e));
          const floor = start + e.floorsCleared;
          if (e.reason === 'failed' && floor % BAND_FLOORS === 0) {
            const label = bossLabel(h.tower, floor, floorInfo(t.pick.seed, h.tower, floor, e.at).kind);
            happenings.push(`${label}에서 실패${e.outcome === 'injury' ? ', 부상' : ''}`);
          }
          if (e.outcome === 'injury') injuries++;
          break;
        }
        case 'record':
          if (e.floor % BAND_FLOORS === 0) {
            bosses.push(bossLabel(h.tower, e.floor, floorInfo(t.pick.seed, h.tower, e.floor, e.at).kind));
          }
          break;
        case 'retireHint':
          happenings.push('기록이 12시간 멈춰 "슬슬 은퇴를…"');
          break;
        case 'retire':
          closing.push(`은퇴 (${RETIRE_LABEL[e.reason]}, 게임 ${gameDay(e.at)}일 ${clock(e.at)}). 은퇴 인사 방문`);
          if (t.disciple !== null) {
            const hours = Math.round((t.disciple.at - e.at) / HOUR_MINUTES);
            closing.push(`${hours}시간 뒤 제자가 스승의 ${type}${josa(type, '을', '를')} 들고 온다`);
          }
          break;
        case 'death':
          closing.push(`${e.floor}층에서 돌아오지 않았다`);
          break;
        default:
          break;
      }
    }
    const phrases = [...first];
    if (expeditions.length > 0) phrases.push(`원정 ${expeditions.length}번: ${expeditions.join(' · ')}`);
    if (bosses.length > 0) {
      const last = bosses[bosses.length - 1] as string;
      phrases.push(`${bosses.join(', ')}${objectJosa(last)} 넘는다`);
    }
    const backAt = lastReturnBy(d);
    const end = backAt === undefined ? t.snaps[0] : snapAtOrBefore(backAt);
    if (end !== undefined) {
      if (mastery < MASTERY_SKILLED_FLOOR && end.masteryFloor >= MASTERY_SKILLED_FLOOR) phrases.push("숙련 '능숙'");
      if (mastery < MASTERY_MASTER_FLOOR && end.masteryFloor >= MASTERY_MASTER_FLOOR) phrases.push("숙련 '달인'");
      mastery = Math.max(mastery, end.masteryFloor);
    }
    phrases.push(...happenings);
    if (injuries === 1) phrases.push('부상으로 12시간 휴식');
    if (injuries > 1) phrases.push(`부상 ${injuries}번, 그때마다 12시간 휴식`);
    if (stuckNoBuy > 0) {
      phrases.push(`공략이 막혀 ${stuckNoBuy > 1 ? `${stuckNoBuy}번 ` : ''}찾아오지만 지금 무기보다 나은 걸 사지 못한다`);
    }
    if (repairs > 0) phrases.push(`수리 ${repairs}번`);
    if (debtPaid > 0) {
      phrases.push(creditCleared === d ? `외상을 다 갚는다 (이날 ${Math.round(debtPaid)}G)` : `외상 ${Math.round(debtPaid)}G 상환`);
    }
    phrases.push(...closing);
    const record = end !== undefined && end.record > 0 ? `${end.record}층 · 힘 ${r2(end.power)}` : '—';
    rows.push([`${d}일`, phrases.join('. '), record]);
  }

  const stats = h.stats;
  const visitLabel: Record<keyof typeof visitCounts, string> = {
    first: '첫 방문',
    repair: '수리',
    stagnation: '공략 정체',
    debt: '외상 상환',
    farewell: '은퇴 인사',
  };
  const visits = (Object.keys(visitCounts) as (keyof typeof visitCounts)[])
    .filter((k) => visitCounts[k] > 0)
    .map((k) => `${visitLabel[k]} ${visitCounts[k]}`)
    .join(', ');
  const last = t.snaps[t.snaps.length - 1];
  const notes = [
    `가게 방문은 ${stats.visits}번이다 (${visits}; 이유가 겹친 방문은 각각 센다).`,
    `원정 ${stats.expeditions}번, 돌파 ${stats.floorsCleared}층 (이미 넘은 층 포함), 실패 ${stats.failures}번, 부상 ${h.injuries}번. ` +
      `마지막 레벨 ${last?.level ?? 1} · 힘 ${r2(last?.power ?? 1)}.`,
    `산 무기 ${bought.length}자루: ${bought.join(' → ') || '없음'}.`,
  ];
  if (creditCleared !== null) notes.push(`첫 외상은 경력 ${creditCleared}일에 다 갚았다.`);

  const head = `${title} (${type} · ${TOWER_LABEL[h.tower]} · 숨은 성장률 ${pct(h.growth)} · 인망 ${STAT_TIER_LABEL[h.charisma]} · 운 ${STAT_TIER_LABEL[h.luck]})`;
  const source = `시뮬레이터 시드 ${t.pick.seed}, 용사 ${t.pick.heroId}, 게임 ${gameDay(h.arrivedAt)}일 ${clock(h.arrivedAt)} 도착.`;
  return [head, '', source, '', table(['경력', '무슨 일', '기록'], rows), '', ...notes.map((n) => `- ${n}`)].join('\n');
}

// ---------- CLI ----------

export interface ExampleOptions {
  policy: PolicyId;
  seeds: number;
  expedition: ExpeditionPick | null;
  b: CareerPick | null;
  s: number | null;
  rules: Partial<WorldRules>;
}

export function buildExamples(o: ExampleOptions): string {
  const seeds = Array.from({ length: o.seeds }, (_, i) => i + 1);
  const parts: string[] = [
    `# 기획서 예시 (정책 \`${o.policy}\`, 기획서 경제)`,
    '',
    '정책 matched = ★3 역작 · 탑 약점 속성 · 무기에 어울리는 인챈트를 그 층대 주재료로 넘긴다 (예산이 모자라면 B급 이상에게 외상).',
  ];

  const exPick = o.expedition ?? findExpeditionExample(o.policy, seeds, o.rules);
  parts.push('', '## 7.11 원정 예시', '');
  if (exPick === null) parts.push('조건에 맞는 원정을 찾지 못했다.');
  else {
    parts.push(`시뮬레이터 시드 ${exPick.seed}, 용사 ${exPick.heroId}, 원정 ${exPick.expeditionNo}번.`, '');
    parts.push(renderExpedition(traceExpedition(exPick, o.policy, o.rules)));
  }

  const bPick = o.b ?? findBCareer(o.policy, seeds, o.rules);
  parts.push('', '## 6.6 ① B급', '');
  parts.push(bPick === null ? '조건에 맞는 B급을 찾지 못했다.' : renderCareer(traceCareer(bPick, o.policy, o.rules), '#### ① B급'));

  const sPick = o.s !== null ? { seed: o.s, heroId: fixedSHeroId(o.s, o.policy, o.rules) } : findSCareer(o.policy, seeds, o.rules);
  parts.push('', '## 6.6 ② S급 (게임 2일차의 고정 S급)', '');
  parts.push(sPick === null ? '조건에 맞는 S급을 찾지 못했다.' : renderCareer(traceCareer(sPick, o.policy, o.rules), '#### ② S급'));
  return parts.join('\n');
}

function parseArgs(argv: readonly string[]): ExampleOptions {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const policy = (get('policy') ?? 'matched') as PolicyId;
  const ex = get('expedition')?.split(':');
  const b = get('b')?.split(':');
  const s = get('s');
  return {
    policy,
    seeds: Math.max(1, Number.parseInt(get('seeds') ?? '40', 10)),
    expedition:
      ex !== undefined && ex.length === 3
        ? { seed: Number(ex[0]), heroId: ex[1] as string, expeditionNo: Number(ex[2]) }
        : null,
    b: b !== undefined && b.length === 2 ? { seed: Number(b[0]), heroId: b[1] as string } : null,
    s: s === undefined ? null : Number(s),
    rules: {},
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${buildExamples(parseArgs(process.argv.slice(2)))}\n`);
}
