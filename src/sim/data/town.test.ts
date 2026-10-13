import { describe, expect, it } from 'vitest';
import { TOWN_BUILDING, TOWN_BUILDINGS, townLock, townLocks, townOpenedAt } from './town.ts';

describe('town unlocks (9.2)', () => {
  it('opens the forge, the guild, the gate and the mine from the start (9.2 추천)', () => {
    for (const id of ['forge', 'guild', 'gate', 'mine'] as const) {
      expect(TOWN_BUILDING[id].opensAt).toBe(0);
      expect(townLock(id, 0)).toEqual({ locked: false, opensAt: 0 });
    }
  });

  it('keeps the towers shut until the stage has climbed a little', () => {
    const at = TOWN_BUILDING.tower.opensAt;
    expect(at).toBeGreaterThan(0);
    expect(townLock('tower', 0).locked).toBe(true);
    expect(townLock('tower', at - 1).locked).toBe(true);
    expect(townLock('tower', at)).toEqual({ locked: false, opensAt: at });
    expect(townLock('tower', at + 50).locked).toBe(false);
  });

  it('opens everything while there is no stage yet (the prototype)', () => {
    const all = townLocks(null);
    for (const id of TOWN_BUILDINGS) expect(all[id].locked).toBe(false);
    // The floor it would open at is still known, for the label.
    expect(all.tower.opensAt).toBe(TOWN_BUILDING.tower.opensAt);
  });

  it('draws the locked look from a given best stage', () => {
    const fresh = townLocks(0);
    const locked = TOWN_BUILDINGS.filter((id) => fresh[id].locked);
    expect(locked).toEqual(TOWN_BUILDINGS.filter((id) => TOWN_BUILDING[id].opensAt > 0));
    expect(locked.length).toBeGreaterThan(0);
  });

  it('names the buildings that open at a floor, never at 0', () => {
    expect(townOpenedAt(0)).toEqual([]);
    expect(townOpenedAt(TOWN_BUILDING.tower.opensAt)).toContain('tower');
  });
});
