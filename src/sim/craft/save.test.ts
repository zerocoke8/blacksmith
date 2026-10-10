import { describe, expect, it } from 'vitest';
import type { Weapon } from '../core/types.ts';
import { applyAction, startCraft } from './engine.ts';
import { isRecipeInput, isToolLevels, restoreCraftState, restoreWeapon } from './save.ts';
import { makeSetup, runFromSetup } from './testkit.ts';

const roundTrip = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));

describe('restoreCraftState', () => {
  const mid = runFromSetup(makeSetup({ nodes: ['carefulObservation', 'wasteNot'] }), ['basicSynthesis', 'wasteNot', 'carefulObservation']);

  it('takes back a craft saved as JSON, and it plays on the same', () => {
    const back = restoreCraftState(roundTrip(mid));
    expect(back).toEqual(mid);
    expect(applyAction(back!, 'basicTouch')).toEqual(applyAction(mid, 'basicTouch'));
    expect(restoreCraftState(roundTrip(startCraft(makeSetup())))).not.toBeNull();
  });

  it('refuses anything that is not a whole CraftState of this version', () => {
    const broken: [string, (s: Record<string, unknown>) => void][] = [
      ['old version', (s) => (s.version = 0)],
      ['NaN durability', (s) => (s.durability = 'x')],
      ['unknown condition', (s) => (s.condition = 'stormy')],
      ['unknown status', (s) => (s.status = 'paused')],
      ['missing buffs', (s) => delete s.buffs],
      ['bad buff', (s) => ((s.buffs as Record<string, unknown>).innovation = null)],
      ['bad log', (s) => (s.log = [{ turn: 1 }])],
      ['unknown action in stats', (s) => ((s.stats as Record<string, unknown>).actions = ['fly'])],
      ['missing recipe cap', (s) => delete (s.recipe as Record<string, unknown>).qualityCap],
      ['bad setup tools', (s) => (((s.setup as Record<string, unknown>).smith as Record<string, unknown>).tools = { anvil: 'a' })],
      ['bad uses', (s) => (s.uses = { carefulObservation: -1 })],
    ];
    for (const [why, mutate] of broken) {
      const data = roundTrip(mid) as Record<string, unknown>;
      mutate(data);
      expect(restoreCraftState(data), why).toBeNull();
    }
    for (const v of [null, 3, 'craft', [], {}]) expect(restoreCraftState(v)).toBeNull();
  });
});

describe('restoreWeapon and small checks', () => {
  const weapon: Weapon = {
    id: 'w-1-1',
    type: 'staff',
    materialTier: 2,
    quality: 3,
    element: 'fire',
    enchants: ['bounty'],
    unique: null,
  };

  it('takes back a saved weapon', () => {
    expect(restoreWeapon(roundTrip(weapon))).toEqual(weapon);
  });

  it('refuses a broken weapon', () => {
    for (const patch of [{ quality: 6 }, { type: 'spear' }, { element: 'light' }, { enchants: ['element'] }, { unique: 'x' }, { id: 3 }]) {
      expect(restoreWeapon({ ...weapon, ...patch })).toBeNull();
    }
  });

  it('checks tool levels and recipe inputs', () => {
    expect(isToolLevels({ anvil: 1, whetstone: 0, furnace: 2 })).toBe(true);
    expect(isToolLevels({ anvil: Number.NaN, whetstone: 0, furnace: 2 })).toBe(false);
    expect(isToolLevels({ anvil: -1, whetstone: 0, furnace: 2 })).toBe(false);
    expect(isRecipeInput({ weaponType: 'bow', materialTier: 3, bossMaterial: null })).toBe(true);
    expect(isRecipeInput({ weaponType: 'bow', materialTier: 0, bossMaterial: null })).toBe(false);
    expect(isRecipeInput({ weaponType: 'bow', materialTier: 3, bossMaterial: 'gem' })).toBe(false);
  });
});
