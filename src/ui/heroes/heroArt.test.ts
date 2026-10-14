import { describe, expect, it } from 'vitest';
import { HEROES } from '../../sim/data/heroes.ts';
import { HERO_ART_FIT, hasHeroArtSize, heroArtHeight, heroStage, heroStageAspect } from './heroArt.ts';

const sizes = new Map([
  ['tall', { w: 600, h: 1300 }],
  ['wide', { w: 1000, h: 850 }],
  ['small', { w: 500, h: 650 }],
]);
const stage = heroStage(sizes);

describe('heroArt: every hero whole in its box', () => {
  it('the stage is the widest and the tallest hero', () => {
    expect(stage).toEqual({ w: 1000, h: 1300 });
  });

  it("'shared': one scale, the tallest fills the stage and the rest keep their size against it", () => {
    const fit = { ...HERO_ART_FIT, mode: 'shared' as const };
    expect(heroArtHeight('tall', fit, sizes, stage)).toBe(1);
    expect(heroArtHeight('small', fit, sizes, stage)).toBeCloseTo(650 / 1300);
    // The widest fits across: its drawn width over the stage's is its width over the widest.
    const h = heroArtHeight('wide', fit, sizes, stage);
    expect(((h * stage.h) / 850) * 1000).toBeLessThanOrEqual(stage.w + 1e-9);
  });

  it("'each': every hero as big as the stage lets it", () => {
    const fit = { ...HERO_ART_FIT, mode: 'each' as const };
    expect(heroArtHeight('tall', fit, sizes, stage)).toBe(1);
    expect(heroArtHeight('small', fit, sizes, stage)).toBe(1);
    // Wider than the stage's shape at full height: held to the stage's width.
    const h = heroArtHeight('wide', fit, sizes, stage);
    expect(h).toBeLessThan(1);
    expect(h * stage.h * (1000 / 850)).toBeCloseTo(stage.w);
  });

  it('every hero of the roster has its size from the art pipeline, and fits the shared stage', () => {
    // The sizes really come from meta.json (an empty read would make every hero height 1 and pass the rest).
    expect(heroStage().h).toBeGreaterThan(800);
    for (const hero of HEROES) {
      expect(hasHeroArtSize(hero.key), hero.key).toBe(true);
      const h = heroArtHeight(hero.key);
      expect(h, hero.key).toBeGreaterThan(0.5);
      expect(h, hero.key).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...HEROES.map((h) => heroArtHeight(h.key)))).toBe(1);
    expect(heroStageAspect()).toBeGreaterThan(0.4);
    expect(heroStageAspect()).toBeLessThan(1.2);
  });
});
