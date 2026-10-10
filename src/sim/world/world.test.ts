import { describe, expect, it } from 'vitest';
import type { Grade, TowerId, Weapon } from '../core/types.ts';
import { listPrice } from '../data/common.ts';
import {
  CREDIT_PREMIUM_FIRST_VISIT,
  CREDIT_PREMIUM_LATER,
  DAY_MINUTES,
  DEMON_LORD_REVIVE_MINUTES,
  FLOOR_MINUTES,
  HOUR_MINUTES,
  INJURY_REST_MINUTES,
  RETIRE_AT_DAYS,
  RETIRE_AT_INJURIES,
  RETIRE_MIN_DAYS,
  RETIRE_STAGNANT_MINUTES,
  TOWN_STAY_MINUTES,
} from '../data/world.ts';
import { DEMON_LORD_LINE } from './messages.ts';
import { newHero, NO_INHERIT } from './hero.ts';
import {
  createPolicy,
  isUpgrade,
  type PolicyId,
  type SupplyContext,
  type SupplyPolicy,
  targetFloors,
  targetPower,
  type WeaponDraft,
} from './supply.ts';
import { floorInfo } from './tower.ts';
import type { HeroState, WorldEvent, WorldRules, WorldState } from './types.ts';
import {
  advanceWorld,
  createWorld,
  openCredits,
  retireReason,
  returnReason,
  type SaleInput,
  saleTerms,
  visitReasons,
} from './world.ts';

function run(seed: number, days: number, policy: PolicyId | SupplyPolicy, stepMinutes = days * DAY_MINUTES) {
  const world = createWorld(seed);
  const p = typeof policy === 'string' ? createPolicy(policy) : policy;
  const events: WorldEvent[] = [];
  for (let t = stepMinutes; t <= days * DAY_MINUTES; t += stepMinutes) events.push(...advanceWorld(world, t, p));
  return { world, events };
}

/** A world with one hero and no arrivals, for small fixed scenarios. */
function soloWorld(
  seed: number,
  o: { grade: Grade; tower: TowerId; weapon: Omit<Weapon, 'id'>; mine: boolean; durability?: number },
  rules: Partial<WorldRules> = {},
): { world: WorldState; hero: HeroState } {
  const world = createWorld(seed, rules);
  world.nextSpawnAt = Number.MAX_SAFE_INTEGER;
  world.fixedSArrived = true;
  const hero = newHero({
    id: 'h1',
    seq: 1,
    at: 0,
    grade: o.grade,
    growth: 0.65,
    charisma: 'mid',
    luck: 'mid',
    weaponType: o.weapon.type,
    tower: o.tower,
    gold: 0,
    held: { weapon: { ...o.weapon, id: 'w0' }, mine: o.mine, durability: o.durability ?? 1 },
    generation: 1,
    masterId: null,
    inherit: { ...NO_INHERIT, picks: [] },
  });
  hero.firstVisitDone = true;
  world.heroes.push(hero);
  world.nextSeq = 2;
  return { world, hero };
}

const sword = (materialTier: number): Omit<Weapon, 'id'> => ({
  type: 'oneHandSword',
  materialTier,
  quality: 3,
  element: null,
  enchants: [],
  unique: null,
});

const sum1to = (n: number): number => (n * (n + 1)) / 2;

const snapshot = (w: WorldState): string => JSON.stringify(w);

describe('determinism (3.6)', () => {
  it('replays the same world from the same seed', () => {
    const a = run(11, 4, 'matched');
    const b = run(11, 4, 'matched');
    expect(a.events).toEqual(b.events);
    expect(snapshot(a.world)).toBe(snapshot(b.world));
    expect(a.events.length).toBeGreaterThan(1000);
  });

  it('gives a different world for a different seed', () => {
    expect(snapshot(run(11, 2, 'standard').world)).not.toBe(snapshot(run(12, 2, 'standard').world));
  });

  it('does not depend on how often the world is advanced', () => {
    const once = run(5, 3, 'standard');
    const hourly = run(5, 3, 'standard', 60);
    const odd = run(5, 3, 'standard', 37 * 9);
    expect(hourly.events).toEqual(once.events);
    expect(snapshot(hourly.world)).toBe(snapshot(once.world));
    // A step that does not divide the period still matches up to the last call.
    const cut = odd.world.now;
    expect(odd.events).toEqual(once.events.filter((e) => e.at <= cut));
  });

  it('survives a save round trip', () => {
    const p = createPolicy('matched');
    const a = createWorld(21);
    advanceWorld(a, DAY_MINUTES * 2, p);
    const b = JSON.parse(JSON.stringify(a)) as WorldState;
    expect(advanceWorld(b, DAY_MINUTES * 4, p)).toEqual(advanceWorld(a, DAY_MINUTES * 4, p));
  });

  it('never moves time backwards', () => {
    const w = createWorld(1);
    const p = createPolicy('none');
    advanceWorld(w, 600, p);
    expect(advanceWorld(w, 100, p)).toEqual([]);
    expect(w.now).toBe(600);
  });
});

describe('return rules (7.10)', () => {
  const base = { hp: 1, durability: 1, floorsEntered: 3, maxFloors: 12, nextClearChance: 0.9 };
  it('keeps climbing while every criterion is fine', () => {
    expect(returnReason(base)).toBeNull();
  });
  it('turns back on each criterion', () => {
    expect(returnReason({ ...base, hp: 0.4 })).toBe('hp');
    expect(returnReason({ ...base, durability: 0.2 })).toBe('durability');
    expect(returnReason({ ...base, floorsEntered: 12 })).toBe('maxFloors');
    expect(returnReason({ ...base, nextClearChance: 0.49 })).toBe('risk');
    expect(returnReason({ ...base, nextClearChance: 0.5 })).toBeNull();
  });
});

describe('retirement (6.3)', () => {
  const day = DAY_MINUTES;
  it('needs 24h of stagnant record and the grade minimum', () => {
    const h = { grade: 'B' as const, arrivedAt: 0, recordAt: 2 * day, injuries: 0 };
    expect(retireReason(h, 5 * day)).toBeNull(); // stagnant 3 days but only day 5 of 6
    expect(retireReason(h, RETIRE_MIN_DAYS.B * day)).toBe('stagnant');
    expect(retireReason({ ...h, recordAt: 5.5 * day }, 6 * day)).toBeNull(); // only 12h stagnant
    expect(retireReason({ ...h, grade: 'N', recordAt: 1 * day }, 3 * day)).toBe('stagnant');
  });
  it('retires on the fifth injury or the tenth day', () => {
    expect(retireReason({ grade: 'S', arrivedAt: 0, recordAt: 0, injuries: 5 }, day)).toBe('injuries');
    expect(retireReason({ grade: 'S', arrivedAt: 0, recordAt: 9.9 * day, injuries: 0 }, 10 * day)).toBe('maxDays');
  });
});

describe('visits (6.3)', () => {
  const held = { weapon: { id: 'w', type: 'bow' as const, materialTier: 1, quality: 1 as const, element: null, enchants: [], unique: null }, mine: true };
  it('comes in for repair, stagnation or debt', () => {
    expect(visitReasons({ held: { ...held, durability: 0.6 }, stagnation: 1, debt: 0 })).toEqual([]);
    expect(visitReasons({ held: { ...held, durability: 0.49 }, stagnation: 2, debt: 10 })).toEqual([
      'repair',
      'stagnation',
      'debt',
    ]);
  });
});

describe('expedition flow (7.8, 3.4)', () => {
  const { world, events } = run(3, 8, 'standard');

  it('starts every expedition one floor above a boss floor', () => {
    const departs = events.filter((e) => e.kind === 'depart');
    expect(departs.length).toBeGreaterThan(100);
    for (const d of departs) expect((d.startFloor - 1) % 10).toBe(0);
  });

  it('caps an expedition at 12 floors', () => {
    for (const e of events) if (e.kind === 'return') expect(e.floorsCleared).toBeLessThanOrEqual(12);
    expect(events.some((e) => e.kind === 'return' && e.reason === 'maxFloors' && e.floorsCleared === 12)).toBe(true);
  });

  it('stays in town 3 hours, 12 after an injury', () => {
    const lastReturn = new Map<string, WorldEvent & { kind: 'return' }>();
    const injured = new Set<string>();
    for (const e of events) {
      if (e.kind === 'return') {
        lastReturn.set(e.heroId, e);
        if (e.outcome === 'injury') injured.add(e.heroId);
        else injured.delete(e.heroId);
      }
      if (e.kind === 'depart') {
        const r = lastReturn.get(e.heroId);
        if (r === undefined) continue;
        expect(e.at - r.at).toBeGreaterThanOrEqual(injured.has(e.heroId) ? INJURY_REST_MINUTES : TOWN_STAY_MINUTES);
      }
    }
  });

  it('ends careers only by the doc rules', () => {
    const arrivals = new Map(events.filter((e) => e.kind === 'arrival').map((e) => [e.heroId, e]));
    const lastRecordAt = new Map<string, number>();
    const retires = new Map<string, WorldEvent & { kind: 'retire' }>();
    const reasons = new Set<string>();
    for (const e of events) {
      if (e.kind === 'arrival') lastRecordAt.set(e.heroId, e.at);
      if (e.kind === 'record') lastRecordAt.set(e.heroId, e.at);
      if (e.kind !== 'retire') continue;
      retires.set(e.heroId, e);
      reasons.add(e.reason);
      const arrival = arrivals.get(e.heroId);
      const career = world.careers.find((c) => c.id === e.heroId);
      expect(arrival).toBeDefined();
      expect(career?.end).toBe('retired');
      if (arrival === undefined || career === undefined) continue;
      const days = (e.at - arrival.at) / DAY_MINUTES;
      if (e.reason === 'stagnant') {
        // 기록 24시간 정체 and the grade's minimum career days (6.3).
        expect(e.at - (lastRecordAt.get(e.heroId) ?? 0)).toBeGreaterThanOrEqual(RETIRE_STAGNANT_MINUTES);
        expect(days).toBeGreaterThanOrEqual(RETIRE_MIN_DAYS[arrival.grade]);
      } else if (e.reason === 'injuries') {
        expect(career.injuries).toBeGreaterThanOrEqual(RETIRE_AT_INJURIES);
      } else {
        expect(days).toBeGreaterThanOrEqual(RETIRE_AT_DAYS);
      }
    }
    for (const c of world.careers) if (c.end === 'retired') expect(retires.has(c.id)).toBe(true);
    expect(reasons.has('stagnant')).toBe(true);
  });

  it('reveals each floor one floor-time after entering it (3.6)', () => {
    const departAt = new Map<string, number>();
    let records = 0;
    for (const e of events) {
      if (e.kind === 'depart') departAt.set(e.heroId, e.at);
      if (e.kind === 'record' || (e.kind === 'return' && e.reason === 'failed')) {
        const since = e.at - (departAt.get(e.heroId) ?? Number.NaN);
        expect(since).toBeGreaterThanOrEqual(FLOOR_MINUTES);
        expect(since % FLOOR_MINUTES).toBe(0);
        records++;
      }
    }
    expect(records).toBeGreaterThan(100);
  });

  it('sends a disciple after each retirement', () => {
    const retired = world.careers.filter((c) => c.end === 'retired' && c.endedAt < 7 * DAY_MINUTES).map((c) => c.id);
    const disciples = new Set<string | null>();
    for (const e of events) if (e.kind === 'arrival' && e.disciple) disciples.add(e.masterId);
    for (const id of retired) expect(disciples.has(id)).toBe(true);
  });

});

describe('buying (5.1)', () => {
  // Wrap the policy to see each hero exactly as it stood when the offer was made.
  const seen: { hero: HeroState; ctx: SupplyContext; offer: WeaponDraft | null }[] = [];
  const inner = createPolicy('standard');
  const recording: SupplyPolicy = {
    id: 'recording',
    offer(hero, ctx) {
      const offer = inner.offer(hero, ctx);
      seen.push({ hero: structuredClone(hero), ctx: { ...ctx, demonLordsDown: [...ctx.demonLordsDown] }, offer });
      return offer;
    },
  };
  const { events } = run(3, 8, recording);
  const offerAt = (heroId: string, at: number) => seen.find((s) => s.hero.id === heroId && s.ctx.now === at);

  it('buys a weapon only when its 목표 기대 전투력 beats the current one', () => {
    let bought = 0;
    for (const e of events) {
      if (e.kind !== 'visit' || e.bought === null) continue;
      const s = offerAt(e.heroId, e.at);
      expect(s).toBeDefined();
      if (s === undefined) continue;
      const floors = targetFloors(s.hero, s.ctx);
      expect(targetPower(e.bought, s.hero, floors)).toBeGreaterThan(targetPower(s.hero.held.weapon, s.hero, floors));
      bought++;
    }
    expect(bought).toBeGreaterThan(50);
  });

  it('walks away from an offer that is not better', () => {
    let refused = 0;
    for (const s of seen) {
      if (s.offer === null || isUpgrade(s.offer, s.hero, s.ctx)) continue;
      const visit = events.find((e) => e.kind === 'visit' && e.heroId === s.hero.id && e.at === s.ctx.now);
      expect(visit?.kind === 'visit' && visit.bought).toBe(null);
      refused++;
    }
    expect(refused).toBeGreaterThan(10);
  });
});

describe('credit (5.3)', () => {
  const base: SaleInput = {
    price: 1000,
    budget: 300,
    grade: 'B',
    disciple: false,
    reasons: ['first'],
    debt: 0,
    firstVisitDone: false,
    openCredits: 0,
    creditSlots: 2,
  };

  it('takes cash whenever the budget covers the price', () => {
    expect(saleTerms({ ...base, budget: 1000 })).toEqual({ kind: 'cash' });
    expect(saleTerms({ ...base, budget: 1000, grade: 'N', reasons: ['repair'], debt: 50 })).toEqual({ kind: 'cash' });
  });

  it('puts the whole price on credit with the visit premium', () => {
    expect(saleTerms(base)).toEqual({ kind: 'credit', owed: 1000 * (1 + CREDIT_PREMIUM_FIRST_VISIT) });
    expect(saleTerms({ ...base, firstVisitDone: true, reasons: ['stagnation'] })).toEqual({
      kind: 'credit',
      owed: 1000 * (1 + CREDIT_PREMIUM_LATER),
    });
  });

  it('gives credit only to queued heroes with no open credit, while a slot is free', () => {
    expect(saleTerms({ ...base, grade: 'C' })).toBeNull(); // N·C just leave (5.1)
    expect(saleTerms({ ...base, grade: 'N', disciple: true })).not.toBeNull(); // disciple's first visit queues
    expect(saleTerms({ ...base, grade: 'N', disciple: true, reasons: ['stagnation'] })).toBeNull();
    expect(saleTerms({ ...base, debt: 1 })).toBeNull(); // one per hero
    expect(saleTerms({ ...base, openCredits: 2 })).toBeNull(); // shop-wide slots
    expect(saleTerms({ ...base, reasons: ['repair', 'debt'] })).toBeNull();
  });

  it('keeps the shop within its credit slots and balances the ledger', () => {
    const world = createWorld(3);
    const p = createPolicy('standard');
    const events: WorldEvent[] = [];
    let credits = 0;
    for (let t = HOUR_MINUTES; t <= 8 * DAY_MINUTES; t += HOUR_MINUTES) {
      events.push(...advanceWorld(world, t, p));
      expect(openCredits(world)).toBeLessThanOrEqual(world.rules.creditSlots);
    }
    const grades = new Map(events.filter((e) => e.kind === 'arrival').map((e) => [e.heroId, e]));
    for (const e of events) {
      if (e.kind !== 'visit' || e.credit === 0 || e.bought === null) continue;
      credits++;
      const arrival = grades.get(e.heroId);
      expect(['B', 'A', 'S'].includes(arrival?.grade ?? 'N') || (arrival?.disciple && e.reasons.includes('first'))).toBe(true);
      const ratio = e.credit / listPrice(e.bought.materialTier, e.bought.quality);
      expect([1 + CREDIT_PREMIUM_FIRST_VISIT, 1 + CREDIT_PREMIUM_LATER].some((r) => Math.abs(r - ratio) < 1e-9)).toBe(true);
    }
    expect(credits).toBeGreaterThan(0);
    const l = world.ledger;
    const open = world.heroes.reduce((s, h) => s + h.debt, 0);
    expect(l.creditRepaid + l.creditLost + open).toBeCloseTo(l.creditOwed, 6);
  });

  it('gives no credit without slots', () => {
    const world = createWorld(3, { creditSlots: 0 });
    const events = advanceWorld(world, 5 * DAY_MINUTES, createPolicy('standard'));
    expect(events.some((e) => e.kind === 'visit' && e.credit > 0)).toBe(false);
    expect(world.ledger.creditGiven).toBe(0);
  });
});

describe('fame and merchant (9.1, 4.4)', () => {
  it('pays 층 번호 per first clear, ×2 for a shop record and 기록 × 10 on retiring', () => {
    // 9.1 example: 40층 은퇴 = 820 + 400, and +1,640 when it was the tower record.
    expect(sum1to(40) + 40 * 10).toBe(1220);
    expect(sum1to(40) * 2).toBe(1640);

    const { world, hero } = soloWorld(2, { grade: 'N', tower: 'fire', weapon: sword(4), mine: true });
    // Stop at the retirement: the disciple arrives 6 hours later and starts its own climb.
    const events: WorldEvent[] = [];
    const p = createPolicy('none');
    for (let t = HOUR_MINUTES; t <= (RETIRE_AT_DAYS + 1) * DAY_MINUTES; t += HOUR_MINUTES) {
      events.push(...advanceWorld(world, t, p));
      if (events.some((e) => e.kind === 'retire' || e.kind === 'death')) break;
    }
    const retire = events.find((e) => e.kind === 'retire');
    expect(retire).toBeDefined();
    const record = retire?.kind === 'retire' ? retire.record : 0;
    expect(record).toBeGreaterThan(20);
    const by = { firstClear: 0, towerRecord: 0, retire: 0 };
    for (const e of events) if (e.kind === 'fame') by[e.source] += e.amount;
    expect(by).toEqual({ firstClear: sum1to(record), towerRecord: 2 * sum1to(record), retire: 10 * record });
    expect(world.fame).toBe(3 * sum1to(record) + 10 * record);
    expect(world.shopRecord[hero.tower]).toBe(record);

    // Each band cleared with our weapon brings the next band's material (4.4).
    const bands = events.filter((e) => e.kind === 'merchantBand').map((e) => (e.kind === 'merchantBand' ? e.band : 0));
    expect(bands).toEqual(Array.from({ length: Math.floor(record / 10) }, (_, i) => i + 2));
  });

  it('gives nothing for floors climbed with another shop’s weapon', () => {
    const { world } = soloWorld(2, { grade: 'N', tower: 'fire', weapon: sword(4), mine: false });
    const events = advanceWorld(world, (RETIRE_AT_DAYS + 1) * DAY_MINUTES, createPolicy('none'));
    expect(events.some((e) => e.kind === 'record')).toBe(true);
    expect(events.some((e) => e.kind === 'retire')).toBe(true);
    expect(events.some((e) => e.kind === 'fame' || e.kind === 'merchantBand' || e.kind === 'shopRecord')).toBe(false);
    expect(world.fame).toBe(0);
    expect(world.merchantBand).toBe(1);
  });
});

describe('dull weapon (7.12)', () => {
  it('turns back right after the floor where the blade went dull', () => {
    let dulls = 0;
    for (let seed = 1; seed <= 40; seed++) {
      // 21% durability on entering the floor-10 boss: boss wear (10~30%) can take it to 0.
      const { world, hero } = soloWorld(seed, { grade: 'B', tower: 'fire', weapon: sword(3), mine: true, durability: 0.21 });
      hero.lastBossFloor = 9;
      const events = advanceWorld(world, 2 * HOUR_MINUTES, createPolicy('none'));
      const dull = events.find((e) => e.kind === 'dull');
      if (dull === undefined) continue;
      dulls++;
      const back = events.find((e) => e.kind === 'return');
      expect(back?.at).toBe(dull.at);
      expect(back?.kind === 'return' && ['dull', 'failed'].includes(back.reason)).toBe(true);
      expect(back?.kind === 'return' && back.floorsCleared).toBeLessThanOrEqual(1);
    }
    expect(dulls).toBeGreaterThan(5);
  });
});

describe('demon lord (7.2)', () => {
  it('is a section boss for 72 hours after it falls, then comes back', () => {
    // Tier 28 makes R ≈ 2.8 against the ×2.0 lord on floor 100.
    const { world, hero } = soloWorld(5, { grade: 'S', tower: 'earth', weapon: sword(28), mine: true });
    hero.lastBossFloor = 90;
    hero.record = 90;
    const events = advanceWorld(world, DAY_MINUTES, createPolicy('none'));
    const slain = events.find((e) => e.kind === 'demonLordSlain');
    expect(slain).toBeDefined();
    if (slain?.kind !== 'demonLordSlain') return;
    expect(slain.floor).toBe(100);
    expect(slain.message).toBe(DEMON_LORD_LINE);
    const downs = world.demonLordsDown;
    expect(downs).toEqual([{ tower: 'earth', floor: 100, until: slain.at + DEMON_LORD_REVIVE_MINUTES }]);
    expect(floorInfo(world.seed, 'earth', 100, slain.at, downs).kind).toBe('sectionBoss');
    expect(floorInfo(world.seed, 'earth', 100, slain.at + DEMON_LORD_REVIVE_MINUTES - 1, downs).kind).toBe('sectionBoss');
    expect(floorInfo(world.seed, 'earth', 100, slain.at + DEMON_LORD_REVIVE_MINUTES, downs).kind).toBe('demonLord');
    expect(floorInfo(world.seed, 'fire', 100, slain.at + 1, downs).kind).toBe('demonLord'); // other towers untouched
  });
});

describe('rookies with the basic weapon (7.3)', () => {
  it('get stuck around floor 10 without a shop', () => {
    const { world } = run(2, 6, 'none');
    const records = [...world.careers, ...world.heroes]
      .filter((h) => h.grade === 'N' || h.grade === 'C')
      .map((h) => h.record)
      .sort((a, b) => a - b);
    const mid = records[Math.floor(records.length / 2)] ?? 0;
    expect(records.length).toBeGreaterThan(20);
    expect(mid).toBeGreaterThanOrEqual(7);
    expect(mid).toBeLessThanOrEqual(13);
  });
});

describe('disciples taking new-hero arrivals (rule switch)', () => {
  it('keeps the arrival count close to the daily rate', () => {
    const p = createPolicy('standard');
    const extra = createWorld(4);
    const replace = createWorld(4, { disciplesReplaceNewHeroes: true });
    const e1 = advanceWorld(extra, 12 * DAY_MINUTES, p).filter((e) => e.kind === 'arrival').length;
    const e2 = advanceWorld(replace, 12 * DAY_MINUTES, p).filter((e) => e.kind === 'arrival').length;
    expect(e2).toBeLessThan(e1);
  });
});
