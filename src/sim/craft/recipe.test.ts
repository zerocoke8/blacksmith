import { describe, expect, it } from 'vitest';
import { BASE_SMITH, BASIC_ACTIONS, CRAFT_NODES, type CraftNodeId, RECIPE, type RecipeGrade, TOOL_BONUS } from '../data/craft.ts';
import { recipeFor, recipeSize } from './recipe.ts';
import { checkLayout, enabledActions, furnaceCp, NO_TOOLS, skillBoardCap, smithStats, toolMultiplier } from './smith.ts';

const recipe = (materialTier: number, boss = false) =>
  recipeFor({ weaponType: 'dagger', materialTier, bossMaterial: boss ? 'rebirth' : null });

describe('recipes (4.2.3)', () => {
  it('grades by band and 대보스 material', () => {
    for (const t of [1, 2, 3, 4]) expect(recipe(t).grade).toBe('basic');
    for (const t of [5, 6, 12]) expect(recipe(t).grade).toBe('advanced');
    expect(recipe(1, true).grade).toBe('legendary');
    expect(recipe(7, true).grade).toBe('legendary');
  });

  it('has durability 60 / 70 / 150', () => {
    expect(recipe(1).durability).toBe(60);
    expect(recipe(4).durability).toBe(60);
    expect(recipe(5).durability).toBe(70);
    expect(recipe(5, true).durability).toBe(150);
  });

  it('band 1 progress: three basic hammers at starting stats fall short, four finish (4.2.1)', () => {
    const { craftsmanship } = smithStats({ nodes: [], tools: NO_TOOLS });
    expect(recipe(1).progressRequired).toBeGreaterThan(3 * craftsmanship);
    expect(recipe(1).progressRequired).toBeLessThanOrEqual(4 * craftsmanship);
  });

  it('progress and quality cap rise about 15~20% per band within a size', () => {
    for (const boss of [false, true]) {
      for (let t = 1; t < 15; t++) {
        const a = recipe(t, boss);
        const b = recipe(t + 1, boss);
        if (recipeSize(a.materialTier, a.grade) !== recipeSize(b.materialTier, b.grade)) continue;
        for (const ratio of [b.progressRequired / a.progressRequired, b.qualityCap / a.qualityCap]) {
          expect(ratio).toBeGreaterThanOrEqual(1.15 - 0.005);
          expect(ratio).toBeLessThanOrEqual(1.2 + 0.005);
        }
      }
    }
  });

  it('고급 and 전설 are bigger recipes on top of the band growth, and 4구간 is part way to 고급', () => {
    expect(RECIPE.gradeMult.basic).toEqual({ progress: 1, quality: 1 });
    expect(recipeSize(3, 'basic')).toBe(RECIPE.gradeMult.basic);
    expect(recipeSize(RECIPE.advancedFromBand - 1, 'basic')).toBe(RECIPE.bridgeMult);
    expect(recipeSize(RECIPE.advancedFromBand - 1, 'legendary')).toBe(RECIPE.gradeMult.legendary);
    for (const k of ['progress', 'quality'] as const) {
      expect(RECIPE.bridgeMult[k]).toBeGreaterThan(RECIPE.gradeMult.basic[k]);
      expect(RECIPE.bridgeMult[k]).toBeLessThan(RECIPE.gradeMult.advanced[k]);
    }
    const band1 = recipe(1);
    for (let t = 1; t <= 12; t++) {
      for (const boss of [false, true]) {
        const r = recipe(t, boss);
        const m = recipeSize(t, r.grade);
        expect(r.progressRequired / (band1.progressRequired * RECIPE.progressGrowth ** (t - 1))).toBeCloseTo(m.progress, 2);
        expect(r.qualityCap / (band1.qualityCap * RECIPE.qualityGrowth ** (t - 1))).toBeCloseTo(m.quality, 2);
      }
    }
    expect(RECIPE.gradeMult.advanced.progress).toBeGreaterThan(1);
    expect(RECIPE.gradeMult.advanced.quality).toBeGreaterThan(1);
    expect(RECIPE.gradeMult.legendary.progress).toBeGreaterThan(RECIPE.gradeMult.advanced.progress);
    expect(RECIPE.gradeMult.legendary.quality).toBeGreaterThan(RECIPE.gradeMult.advanced.quality);
  });

  it('builds the band growth from repeated products, giving the numbers `**` gives (3.6)', () => {
    const grades: [RecipeGrade, boolean][] = [
      ['basic', false],
      ['advanced', false],
      ['legendary', true],
    ];
    for (let t = 1; t <= 40; t++) {
      for (const [grade, boss] of grades) {
        if (!boss && grade !== (t >= RECIPE.advancedFromBand ? 'advanced' : 'basic')) continue;
        const m = recipeSize(t, grade);
        const r = recipe(t, boss);
        expect(r.progressRequired).toBe(Math.round(RECIPE.progressBase * RECIPE.progressGrowth ** (t - 1) * m.progress));
        expect(r.qualityCap).toBe(Math.round(RECIPE.qualityCapBase * RECIPE.qualityGrowth ** (t - 1) * m.quality));
      }
    }
  });

  it('treats a broken band as band 1, and a huge one does not throw', () => {
    const at = (materialTier: number) => recipeFor({ weaponType: 'bow', materialTier, bossMaterial: null });
    expect(at(Number.NaN)).toEqual(at(1));
    expect(() => at(1e9)).not.toThrow();
  });

  it('lists the conditions each grade can show: 식음 joins at 고급, 잘 펴짐·불티 at 전설', () => {
    expect(recipe(1).conditions).toEqual(['normal', 'good', 'excellent']);
    expect(recipe(5).conditions).toEqual(['normal', 'good', 'excellent', 'poor', 'sturdy', 'pliant']);
    expect(recipe(5, true).conditions).toEqual([
      'normal',
      'good',
      'excellent',
      'poor',
      'sturdy',
      'pliant',
      'malleable',
      'goodOmen',
    ]);
  });
});

describe('smith stats (9.3, 9.4)', () => {
  it('starts at 100 / 100 / CP 100', () => {
    const s = smithStats({ nodes: [], tools: NO_TOOLS });
    expect([s.craftsmanship, s.control, s.maxCp, s.durabilityBonus]).toEqual([100, 100, 100, 0]);
    expect(s.actions).toEqual([...BASIC_ACTIONS]);
  });

  it('모루·숫돌 multiply ×1.04 per level by repeated products, giving the numbers `**` gives (3.6)', () => {
    expect(toolMultiplier('anvil', 0)).toBe(1);
    expect(toolMultiplier('anvil', 1)).toBe(1.04);
    expect(toolMultiplier('anvil', 2)).toBe(1.04 * 1.04);
    let product = 1;
    for (let lv = 1; lv <= 200; lv++) {
      product *= 1 + TOOL_BONUS.whetstone.perLevel;
      expect(toolMultiplier('whetstone', lv)).toBe(product);
      expect(toolMultiplier('whetstone', lv) / 1.04 ** lv).toBeCloseTo(1, 12);
      const stats = smithStats({ nodes: [], tools: { anvil: lv, whetstone: lv, furnace: 0 } });
      expect(stats.control).toBe(Math.round(100 * 1.04 ** lv));
      expect(stats.craftsmanship).toBe(Math.round(100 * 1.04 ** lv));
    }
  });

  it('화로 adds 1 CP per level up to level 20, then 1 per 2 levels (9.4)', () => {
    expect([0, 1, 4, 6, 10, 20, 21, 22, 35, 55].map(furnaceCp)).toEqual([0, 1, 4, 6, 10, 20, 20, 21, 27, 37]);
    expect(smithStats({ nodes: [], tools: { anvil: 0, whetstone: 0, furnace: 20 } }).maxCp).toBe(BASE_SMITH.cp + 20);
    for (let lv = 1; lv <= 100; lv++) expect(furnaceCp(lv)).toBeGreaterThanOrEqual(furnaceCp(lv - 1));
  });

  it('passives multiply on top of the tools', () => {
    const s = smithStats({
      nodes: ['trainedArm', 'deftHand', 'thickAnvil', 'flameReading'],
      tools: { anvil: 10, whetstone: 5, furnace: 10 },
    });
    expect(s.craftsmanship).toBe(Math.round(100 * 1.04 ** 10 * 1.1)); // 163
    expect(s.control).toBe(Math.round(100 * 1.04 ** 5 * 1.1)); // 134
    expect(s.maxCp).toBe(110);
    expect(s.durabilityBonus).toBe(15);
    expect(s.foresight).toBe(true);
  });

  it('treats broken tool levels as 0 instead of making NaN stats', () => {
    const s = smithStats({ nodes: [], tools: { anvil: Number.NaN, whetstone: -3, furnace: Number.POSITIVE_INFINITY } });
    expect([s.craftsmanship, s.control, s.maxCp]).toEqual([100, 100, 100]);
  });

  it('every action node unlocks its action; passives unlock none', () => {
    const nodes = Object.values(CRAFT_NODES);
    const all = enabledActions(nodes.map((n) => n.id));
    expect(all).toHaveLength(18);
    expect(nodes.filter((n) => n.action === null).map((n) => n.id)).toEqual([
      'thickAnvil',
      'trainedArm',
      'deftHand',
      'flameReading',
    ]);
  });

  it('↔ nodes point at each other', () => {
    for (const n of Object.values(CRAFT_NODES)) {
      if (n.pair) expect(CRAFT_NODES[n.pair].pair).toBe(n.id);
    }
  });
});

describe('skill-board layout rules (9.2, 9.3)', () => {
  it('caps nodes per layout by fame stage: 3 at stage 1, 9 at stage 7, +1 per ★n up to 12', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(skillBoardCap)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(skillBoardCap(8)).toBe(10);
    expect(skillBoardCap(10)).toBe(12);
    expect(skillBoardCap(20)).toBe(12);
  });

  it('accepts a layout that walks each branch in order', () => {
    expect(checkLayout([], 1)).toBeNull();
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'reflect'], 1)).toBeNull();
    const deep: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'groundwork', 'reflect'];
    expect(checkLayout(deep, 4)).toBeNull();
  });

  it('needs the node before it in the branch', () => {
    expect(checkLayout(['reflect', 'deftHand'], 7)).toBe('섬세한 손: 앞 노드가 꺼져 있다');
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'muscleMemory', 'groundwork'], 7)).toBe(
      '크게 내려치기: 앞 노드가 꺼져 있다',
    );
  });

  it('either side of a ↔ fills the step, but not both', () => {
    const base: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory'];
    expect(checkLayout([...base, 'manipulation', 'veneration'], 7)).toBeNull();
    expect(checkLayout([...base, 'thickAnvil', 'veneration'], 7)).toBeNull();
    expect(checkLayout([...base, 'manipulation', 'thickAnvil'], 7)).toBe('단조 유지: ↔ 둘 중 하나만');
  });

  it('nodes appear at their fame stage and the stage cap holds', () => {
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'muscleMemory'], 1)).toBe('첫 망치: 명성 단계 2부터');
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'muscleMemory', 'reflect'], 2)).toBeNull();
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'muscleMemory', 'reflect', 'greatStrides'], 3)).toBeNull();
    expect(checkLayout(['wasteNot', 'carefulSynthesis', 'muscleMemory', 'reflect'], 1)).not.toBeNull();
    const six: CraftNodeId[] = ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'reflect', 'greatStrides'];
    expect(checkLayout(six, 3)).toBe('상한 5개를 넘는다');
  });

  it('refuses the same node twice', () => {
    expect(checkLayout(['reflect', 'reflect'], 7)).toBe('같은 노드가 두 번 켜져 있다');
  });
});
