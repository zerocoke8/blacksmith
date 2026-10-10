import { describe, expect, it } from 'vitest';
import { BASIC_ACTIONS, CRAFT_NODES, type CraftNodeId } from '../data/craft.ts';
import { recipeFor } from './recipe.ts';
import { checkLayout, enabledActions, NO_TOOLS, skillBoardCap, smithStats, toolMultiplier } from './smith.ts';

const recipe = (materialTier: number, boss = false) =>
  recipeFor({ weaponType: 'dagger', materialTier, bossMaterial: boss ? 'rebirth' : null });

describe('recipes (4.2.3)', () => {
  it('grades by band and 대보스 material', () => {
    for (const t of [1, 2, 3, 4]) expect(recipe(t).grade).toBe('basic');
    for (const t of [5, 6, 12]) expect(recipe(t).grade).toBe('advanced');
    expect(recipe(1, true).grade).toBe('legendary');
    expect(recipe(7, true).grade).toBe('legendary');
  });

  it('has durability 60 / 70 / 80', () => {
    expect(recipe(1).durability).toBe(60);
    expect(recipe(5).durability).toBe(70);
    expect(recipe(5, true).durability).toBe(80);
  });

  it('band 1 progress is four basic hammers at starting stats', () => {
    expect(recipe(1).progressRequired).toBe(4 * smithStats({ nodes: [], tools: NO_TOOLS }).craftsmanship);
  });

  it('progress and quality cap rise about 15~20% per band', () => {
    for (let t = 1; t < 10; t++) {
      const a = recipe(t);
      const b = recipe(t + 1);
      for (const ratio of [b.progressRequired / a.progressRequired, b.qualityCap / a.qualityCap]) {
        expect(ratio).toBeGreaterThanOrEqual(1.15 - 0.005);
        expect(ratio).toBeLessThanOrEqual(1.2 + 0.005);
      }
    }
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

  it('모루·숫돌 compound ×1.04 per level, 화로 adds 3 CP per level', () => {
    expect(toolMultiplier('anvil', 1)).toBeCloseTo(1.04);
    expect(toolMultiplier('anvil', 2)).toBeCloseTo(1.0816);
    expect(toolMultiplier('whetstone', 10)).toBeCloseTo(1.04 ** 10);
    expect(toolMultiplier('furnace', 10)).toBeCloseTo(1.3);
  });

  it('passives multiply on top of the tools', () => {
    const s = smithStats({
      nodes: ['trainedArm', 'deftHand', 'thickAnvil', 'flameReading'],
      tools: { anvil: 10, whetstone: 5, furnace: 10 },
    });
    expect(s.craftsmanship).toBe(Math.round(100 * 1.04 ** 10 * 1.1)); // 163
    expect(s.control).toBe(Math.round(100 * 1.04 ** 5 * 1.1)); // 134
    expect(s.maxCp).toBe(130);
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
