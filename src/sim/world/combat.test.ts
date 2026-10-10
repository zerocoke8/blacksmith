import { describe, expect, it } from 'vitest';
import type { Rng } from '../core/rng.ts';
import {
  type BodyType,
  ELEMENTS,
  UNIQUE_IDS,
  type UniqueId,
  type Weapon,
  type WeaponType,
  WEAPON_TYPES,
} from '../core/types.ts';
import {
  BOSS_POWER_MULT,
  enemyBasePower,
  MASTERY_MASTER_FLOOR,
  MASTERY_SKILLED_FLOOR,
  WEAPON_SPEC,
} from '../data/common.ts';
import { ENCHANT_AFFINITY_SCALE } from '../data/enchants.ts';
import { UNIQUES } from '../data/uniques.ts';
import { PARTY_BONUS, type StatTier } from '../data/world.ts';
import {
  bodyFactor,
  clearChance,
  critFactor,
  failOdds,
  type Fighter,
  hpLossOnClear,
  partyPower,
  rollFailOutcome,
  weaponProfile,
} from './combat.ts';
import { basicWeapon } from './hero.ts';
import { floorInfo } from './tower.ts';
import type { FloorInfo } from './types.ts';

const weapon = (over: Partial<Weapon> = {}): Weapon => ({
  id: 't',
  type: 'oneHandSword',
  materialTier: 1,
  quality: 1,
  element: null,
  enchants: [],
  unique: null,
  ...over,
});

/** A scripted stand-in for Rng that returns the given numbers in order. */
function scripted(values: number[]): Rng {
  let i = 0;
  return { next: () => values[i++] ?? 0.5 } as unknown as Rng;
}

describe('clear chance table (7.9)', () => {
  it('hits the table points', () => {
    expect(clearChance(0.7)).toBeCloseTo(0.1);
    expect(clearChance(0.85)).toBeCloseTo(0.35);
    expect(clearChance(1.0)).toBeCloseTo(0.6);
    expect(clearChance(1.2)).toBeCloseTo(0.85);
    expect(clearChance(1.5)).toBeCloseTo(0.95);
    expect(clearChance(2.0)).toBeCloseTo(0.99);
  });

  it('clamps outside the table', () => {
    expect(clearChance(0.3)).toBeCloseTo(0.1);
    expect(clearChance(5)).toBeCloseTo(0.99);
  });

  it('joins points with straight lines', () => {
    expect(clearChance(0.775)).toBeCloseTo(0.225);
    expect(clearChance(1.1)).toBeCloseTo(0.725);
    expect(clearChance(1.75)).toBeCloseTo(0.97);
    // Monotone over the whole range.
    let prev = 0;
    for (let r = 0.5; r <= 2.5; r += 0.01) {
      const c = clearChance(r);
      expect(c).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = c;
    }
  });
});

describe('HP loss and failure table (7.9)', () => {
  it('loses 10% ÷ R on a clear, boss ×2', () => {
    expect(hpLossOnClear(2, false)).toBeCloseTo(0.05);
    expect(hpLossOnClear(1, true)).toBeCloseTo(0.2);
  });

  it('uses the HP row at entry', () => {
    expect(failOdds(0.7, false)).toEqual({ safe: expect.closeTo(0.85), injury: 0.14, death: 0.01 });
    expect(failOdds(0.69, false)).toEqual({ safe: expect.closeTo(0.7), injury: 0.28, death: 0.02 });
  });

  it('doubles death on boss floors and moves the difference out of safe return', () => {
    const o = failOdds(1, true);
    expect(o.death).toBeCloseTo(0.02);
    expect(o.injury).toBeCloseTo(0.14);
    expect(o.safe).toBeCloseTo(0.84);
  });

  it('applies risk to injury and death, toughness to injury only', () => {
    const r = failOdds(1, false, 0.8);
    expect(r.injury).toBeCloseTo(0.112);
    expect(r.death).toBeCloseTo(0.008);
    expect(r.safe).toBeCloseTo(0.88);
    const t = failOdds(1, false, 1, 0.8);
    expect(t.injury).toBeCloseTo(0.112);
    expect(t.death).toBeCloseTo(0.01);
  });

  it('rolls table → luck → indomitable in that order', () => {
    const odds = { safe: 0.85, injury: 0.14, death: 0.01 };
    expect(rollFailOutcome(scripted([0.5]), odds, 0.2, false).outcome).toBe('safe');
    expect(rollFailOutcome(scripted([0.1]), odds, 0.2, false).outcome).toBe('injury');
    // Death, luck fails, no indomitable.
    expect(rollFailOutcome(scripted([0.001, 0.9]), odds, 0.2, false).outcome).toBe('death');
    // Death, luck saves.
    const lucky = rollFailOutcome(scripted([0.001, 0.1]), odds, 0.2, true);
    expect(lucky).toEqual({ outcome: 'injury', luckSaved: true, indomitableUsed: false });
    // Death, luck fails, indomitable turns it into an injury.
    const stubborn = rollFailOutcome(scripted([0.001, 0.9]), odds, 0.2, true);
    expect(stubborn).toEqual({ outcome: 'injury', luckSaved: false, indomitableUsed: true });
  });
});

describe('weapon profile (4.5, 4.8)', () => {
  it('gives suited enchants 1.5x of their change', () => {
    expect(weaponProfile(weapon({ quality: 2, enchants: ['firstStrike'] }), 0).attackMult).toBeCloseTo(1.15);
    expect(weaponProfile(weapon({ type: 'dagger', quality: 2, enchants: ['combo'] }), 0).attackMult).toBeCloseTo(1.18);
    expect(weaponProfile(weapon({ type: 'greatsword', quality: 2, enchants: ['combo'] }), 0).attackMult).toBeCloseTo(1.12);
    expect(weaponProfile(weapon({ quality: 2, enchants: ['firstAid'] }), 0).riskMult).toBeCloseTo(0.7);
    expect(weaponProfile(weapon({ quality: 2, enchants: ['sturdy'] }), 0).wearMult).toBeCloseTo(0.55);
    expect(weaponProfile(weapon({ type: 'greatsword', quality: 2, enchants: ['pierce'] }), 0).badBodyMult).toBeCloseTo(0.9375);
    expect(weaponProfile(weapon({ type: 'dagger', quality: 2, enchants: ['keen'] }), 0).critRate).toBeCloseTo(0.3);
  });

  it('keeps upper enchants and uniques asleep until mastery', () => {
    const w = weapon({ type: 'dagger', quality: 5, enchants: ['gale'], unique: 'dragonFury' });
    expect(weaponProfile(w, 0).attackMult).toBeCloseTo(1);
    expect(weaponProfile(w, 15).attackMult).toBeCloseTo(1.45);
    expect(weaponProfile(w, 15).bossPowerMult).toBe(1);
    expect(weaponProfile(w, 40).bossPowerMult).toBeCloseTo(1.5);
  });

  it('reads 고유능력 numbers from data/uniques.ts, awake only at 달인', () => {
    const at = (unique: UniqueId, mastery = MASTERY_MASTER_FLOOR) =>
      weaponProfile(weapon({ quality: 5, unique }), mastery);
    const value = (unique: UniqueId): number => {
      const e = UNIQUES[unique].effect;
      return 'value' in e ? e.value : Number.NaN;
    };
    expect(at('dragonFury').bossPowerMult).toBe(value('dragonFury'));
    expect(at('tidalWave').nonBossPowerMult).toBe(value('tidalWave'));
    expect(at('earthBlessing').partyAdd).toBe(value('earthBlessing'));
    expect(at('dash').extraFloors).toBe(value('dash'));
    expect(at('iceArmor').riskMult).toBe(value('iceArmor'));
    expect(at('rebirth').rebirth).toBe(true);
    expect(at('allPierce').allPierce).toBe(true);
    expect(at('fairWind').fairWind).toBe(true);
    // 4.6 starting values.
    expect([value('dragonFury'), value('tidalWave'), value('earthBlessing'), value('dash'), value('iceArmor')]).toEqual([
      1.5, 1.5, 0.2, 4, 0.5,
    ]);
    expect(UNIQUES.dash.description).toBe('원정 최대 층수 +4');
    // One floor short of 달인: nothing wakes.
    for (const u of UNIQUE_IDS) {
      const asleep = at(u, MASTERY_MASTER_FLOOR - 1);
      expect([asleep.bossPowerMult, asleep.nonBossPowerMult, asleep.partyAdd, asleep.extraFloors, asleep.riskMult]).toEqual([
        1, 1, 0, 0, 1,
      ]);
      expect(asleep.rebirth || asleep.allPierce || asleep.fairWind).toBe(false);
    }
  });

  it('wakes upper enchants at 능숙 (4.7 floors from data/common.ts)', () => {
    const w = weapon({ type: 'dagger', quality: 2, enchants: ['gale'] });
    expect(weaponProfile(w, MASTERY_SKILLED_FLOOR - 1).attackMult).toBe(1);
    expect(weaponProfile(w, MASTERY_SKILLED_FLOOR).attackMult).toBeCloseTo(1 + 0.3 * ENCHANT_AFFINITY_SCALE);
    expect([MASTERY_SKILLED_FLOOR, MASTERY_MASTER_FLOOR]).toEqual([15, 40]);
  });

  it('scales 추격 with the final crit rate and 급소 with crit damage', () => {
    const p = weaponProfile(weapon({ type: 'dagger', quality: 4, enchants: ['keen', 'pursuit', 'vital'] }), 15);
    expect(p.critRate).toBeCloseTo(0.3);
    expect(p.attackMult).toBeCloseTo(1 + 0.3 * 0.75);
    expect(critFactor(p)).toBeCloseTo(1 + 0.3 * 2.0);
  });

  it('lets elements reach spirits and keeps staves at ◎', () => {
    const plain = weaponProfile(weapon(), 0);
    const watery = weaponProfile(weapon({ quality: 2, element: 'water' }), 0);
    expect(bodyFactor(plain, 'spirit')).toBeCloseTo(0.75);
    expect(bodyFactor(watery, 'spirit')).toBeCloseTo(1.0);
    expect(bodyFactor(weaponProfile(weapon({ type: 'staff' }), 0), 'spirit')).toBeCloseTo(1.3);
  });
});

describe('base attack calibration (7.3)', () => {
  const rookie: Fighter = { power: 1, partyBonus: PARTY_BONUS.mid, powerMult: 1 };
  const neutralBody = (t: WeaponType): BodyType =>
    (Object.keys(WEAPON_SPEC[t].bodyFit) as BodyType[]).find((b) => WEAPON_SPEC[t].bodyFit[b] === 'normal') as BodyType;
  const floor = (f: number, body: BodyType): FloorInfo => ({
    tower: 'fire',
    floor: f,
    band: Math.ceil(f / 10),
    kind: f % 10 === 0 ? 'sectionBoss' : 'normal',
    body,
    enemyPower: enemyBasePower(f) * (f % 10 === 0 ? BOSS_POWER_MULT : 1),
  });

  it('stalls a strength-1.0 rookie with the basic weapon near floor 10', () => {
    for (const t of ['oneHandSword', 'greatsword', 'dagger', 'bow', 'crossbow', 'staff'] as const) {
      const p = weaponProfile(basicWeapon('b', t), 0);
      const body = neutralBody(t);
      let stall = 0;
      for (let f = 1; f <= 30 && stall === 0; f++) {
        const fl = floor(f, body);
        if (clearChance(partyPower(p, rookie, fl) / fl.enemyPower) < 0.5) stall = f;
      }
      expect(stall, t).toBeGreaterThanOrEqual(9);
      expect(stall, t).toBeLessThanOrEqual(11);
    }
  });

  it('pins where rookies stall on real tower layouts, by 인망', () => {
    // First floor whose clear chance drops below 50%, over 20 seeds × 6 weapons × 4 towers.
    const stallFloors = (tier: StatTier): number[] => {
      const out: number[] = [];
      const fighter: Fighter = { power: 1, partyBonus: PARTY_BONUS[tier], powerMult: 1 };
      for (let seed = 1; seed <= 20; seed++) {
        for (const t of WEAPON_TYPES) {
          const p = weaponProfile(basicWeapon('b', t), 0);
          for (const tower of ELEMENTS) {
            let stall = 0;
            for (let f = 1; f <= 40 && stall === 0; f++) {
              const info = floorInfo(seed, tower, f);
              if (clearChance(partyPower(p, fighter, info) / info.enemyPower) < 0.5) stall = f;
            }
            out.push(stall);
          }
        }
      }
      return out.sort((a, b) => a - b);
    };
    const median = (v: number[]): number => v[Math.floor((v.length - 1) / 2)] as number;
    const low = stallFloors('low');
    const mid = stallFloors('mid');
    const high = stallFloors('high');
    // 7.3 '10층 근처' holds for 인망 중 and for the 1:2:1 population; 인망 하 stalls
    // around 8 (6~9 most often). About half of 인망 상 still stall at the floor 10 boss,
    // the rest around 13 (BASE_ATTACK 120).
    expect(median(mid)).toBeGreaterThanOrEqual(9);
    expect(median(mid)).toBeLessThanOrEqual(11);
    const population = median([...low, ...mid, ...mid, ...high].sort((a, b) => a - b));
    expect(population).toBeGreaterThanOrEqual(9);
    expect(population).toBeLessThanOrEqual(11);
    expect(median(low)).toBeGreaterThanOrEqual(7);
    expect(median(low)).toBeLessThanOrEqual(9);
    expect(median(high)).toBeGreaterThanOrEqual(12);
    expect(median(high)).toBeLessThanOrEqual(14);
    const highAtBoss10 = high.filter((f) => f <= 10).length / high.length;
    expect(highAtBoss10).toBeGreaterThanOrEqual(0.3);
    expect(highAtBoss10).toBeLessThanOrEqual(0.6);
  });
});
