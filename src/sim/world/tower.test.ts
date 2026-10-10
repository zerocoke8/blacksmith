import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../core/types.ts';
import { BOSS_POWER_MULT, DEMON_LORD_POWER_MULT, enemyBasePower } from '../data/common.ts';
import { UNIQUES } from '../data/uniques.ts';
import { bandLayout, floorInfo } from './tower.ts';

describe('tower layout (7.2)', () => {
  it('is fixed by seed, tower and band', () => {
    const a = Array.from({ length: 60 }, (_, i) => floorInfo(7, 'fire', i + 1).body);
    const b = Array.from({ length: 60 }, (_, i) => floorInfo(7, 'fire', i + 1).body);
    expect(a).toEqual(b);
    const other = Array.from({ length: 60 }, (_, i) => floorInfo(8, 'fire', i + 1).body);
    expect(other).not.toEqual(a);
  });

  it('splits each band 6 main + 3 sub and never repeats the previous main', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const tower of ELEMENTS) {
        for (let band = 1; band <= 15; band++) {
          const l = bandLayout(seed, tower, band);
          expect(l.bodies.filter((b) => b === l.main)).toHaveLength(6);
          expect(l.bodies.filter((b) => b === l.sub)).toHaveLength(3);
          expect(l.sub).not.toBe(l.main);
          if (band > 1) expect(l.main).not.toBe(bandLayout(seed, tower, band - 1).main);
        }
      }
    }
  });

  it('keeps spirits out of floors 1~20, even in the water tower', () => {
    let spiritsAbove = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const tower of ELEMENTS) {
        for (let f = 1; f <= 20; f++) expect(floorInfo(seed, tower, f).body).not.toBe('spirit');
        for (let f = 21; f <= 60; f++) if (floorInfo(seed, tower, f).body === 'spirit') spiritsAbove++;
      }
    }
    expect(spiritsAbove).toBeGreaterThan(0);
  });

  it('favours the home body as main body', () => {
    const counts = { humanoid: 0, armored: 0, flying: 0, spirit: 0 };
    for (let seed = 1; seed <= 200; seed++) for (let band = 3; band <= 8; band++) counts[bandLayout(seed, 'earth', band).main]++;
    const max = Math.max(...Object.values(counts));
    expect(counts.armored).toBe(max);
  });
});

describe('bosses (7.2)', () => {
  it('puts section bosses on 10~40 with the band main body', () => {
    const f = floorInfo(3, 'wind', 30);
    expect(f.kind).toBe('sectionBoss');
    expect(f.body).toBe(bandLayout(3, 'wind', 3).main);
    expect(f.enemyPower).toBeCloseTo(enemyBasePower(30) * BOSS_POWER_MULT);
    expect(floorInfo(3, 'wind', 29).kind).toBe('normal');
  });

  it('alternates the two 대보스 from 50 with fixed bodies', () => {
    const f50 = floorInfo(3, 'fire', 50);
    const f60 = floorInfo(3, 'fire', 60);
    expect(f50.kind).toBe('greatBoss');
    expect(f50.body).toBe(UNIQUES.dragonFury.bossBody);
    expect(f60.body).toBe(UNIQUES.rebirth.bossBody);
    expect(f50.enemyPower).toBeCloseTo(enemyBasePower(50) * BOSS_POWER_MULT);
  });

  it('makes the demon lord ×2.0, and a section boss for 72 hours after it falls', () => {
    const lord = floorInfo(3, 'water', 100);
    expect(lord.kind).toBe('demonLord');
    expect(lord.enemyPower).toBeCloseTo(enemyBasePower(100) * DEMON_LORD_POWER_MULT);
    const downs = [{ tower: 'water' as const, floor: 100, until: 5000 }];
    const down = floorInfo(3, 'water', 100, 4999, downs);
    expect(down.kind).toBe('sectionBoss');
    expect(down.enemyPower).toBeCloseTo(enemyBasePower(100) * BOSS_POWER_MULT);
    expect(down.body).toBe(bandLayout(3, 'water', 10).main);
    expect(floorInfo(3, 'water', 100, 5000, downs).kind).toBe('demonLord');
    expect(floorInfo(3, 'fire', 100, 4999, downs).kind).toBe('demonLord');
  });
});
