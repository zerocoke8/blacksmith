import { describe, expect, it } from 'vitest';
import { TOWN_BUILDINGS } from '../../sim/data/town.ts';
import { camBounds, zoomFor } from './camera.ts';
import {
  buildingOf,
  GUEST_ROAD,
  homeCamera,
  labelPoint,
  MAP_BUILDINGS,
  MAP_H,
  MAP_ITEMS,
  MAP_W,
  TOWN_LAYOUT,
} from './layout.ts';

// These hold for any re-composed mockup (docs/mockups/town/layout.json): no counts or sizes copied from it.
describe('the map is the composer’s layout.json (9.1 배치는 고정)', () => {
  it('every picture stands on the map, its body box around its feet', () => {
    expect(MAP_W).toBe(TOWN_LAYOUT.map.width);
    expect(MAP_H).toBe(TOWN_LAYOUT.map.height);
    expect(MAP_ITEMS.length).toBeGreaterThan(0);
    for (const it of MAP_ITEMS) {
      expect(it.x).toBeGreaterThanOrEqual(0);
      expect(it.x).toBeLessThanOrEqual(MAP_W);
      expect(it.y).toBeGreaterThan(0);
      expect(it.y).toBeLessThanOrEqual(MAP_H);
      // The feet are the box's bottom middle (within a few px: the composer measured after outlining).
      expect(Math.abs(it.box.y + it.box.h - it.y)).toBeLessThanOrEqual(4);
      expect(Math.abs(it.box.x + it.box.w / 2 - it.x)).toBeLessThanOrEqual(4);
    }
  });

  it('the mockup’s standing heroes give way to the walking guests; the dwarf stays at his door', () => {
    expect(MAP_ITEMS.some((i) => i.key.startsWith('hero_'))).toBe(false);
    expect(MAP_ITEMS.filter((i) => i.key === 'dwarf')).toHaveLength(1);
  });

  it('keeps what the composer drew the shadows, smoke and outlines with', () => {
    expect(TOWN_LAYOUT.smoke.puffs.length).toBeGreaterThan(0);
    expect(TOWN_LAYOUT.paths.list.some((p) => p.key === 'shop')).toBe(true);
    for (const it of MAP_ITEMS) if (it.spots !== undefined) for (const s of it.spots) expect(s.rx).toBeGreaterThan(0);
    for (const line of Object.values(TOWN_LAYOUT.outlines.props)) expect(line).toBeGreaterThan(0);
  });

  it('every building of 9.2 is on the map, and only buildings are tappable', () => {
    const on = new Set(MAP_BUILDINGS.map((b) => b.building));
    for (const id of TOWN_BUILDINGS) expect(on.has(id)).toBe(true);
    expect(buildingOf('prop_tree_pine')).toBeNull();
    expect(buildingOf('dwarf')).toBeNull();
    // Unique ids; a second picture of a kind is numbered.
    const uids = MAP_BUILDINGS.map((b) => b.uid);
    expect(new Set(uids).size).toBe(uids.length);
    for (const b of MAP_BUILDINGS) expect(b.uid.startsWith(b.key)).toBe(true);
  });

  it('every place you go into has a name tag on the map', () => {
    for (const b of MAP_BUILDINGS) {
      const at = labelPoint(b);
      if (['forge', 'guild', 'gate', 'mine', 'tower', 'shop', 'inn', 'market'].includes(b.building)) expect(at).not.toBeNull();
      if (at !== null) {
        expect(at.x).toBeGreaterThan(0);
        expect(at.x).toBeLessThan(MAP_W);
        expect(at.y).toBeGreaterThan(0);
        expect(at.y).toBeLessThan(MAP_H);
      }
    }
  });

  it('the guests’ road comes in from below the map and ends at the shop’s door', () => {
    const first = GUEST_ROAD[0] as readonly [number, number];
    const last = GUEST_ROAD[GUEST_ROAD.length - 1] as readonly [number, number];
    expect(first[1]).toBeGreaterThan(MAP_H);
    const shop = MAP_BUILDINGS.find((b) => b.building === 'shop')?.item;
    expect(shop).toBeDefined();
    if (shop !== undefined) {
      expect(last[0]).toBeGreaterThan(shop.box.x);
      expect(last[0]).toBeLessThan(shop.box.x + shop.box.w);
      expect(Math.abs(last[1] - shop.y)).toBeLessThan(40);
    }
  });
});

describe('the first look (9.1 접속하면 대장간이 화면 가운데)', () => {
  const forge = MAP_BUILDINGS.find((b) => b.building === 'forge');
  const shop = MAP_BUILDINGS.find((b) => b.building === 'shop');
  const look = (w: number, h: number) => {
    const insets = { top: 52, bottom: 82 };
    const z = zoomFor(w);
    const cam = homeCamera({ w, h }, z, camBounds(MAP_W, MAP_H, { w, h }, z), insets);
    const sy = (y: number) => (y - cam.y) * z;
    const sx = (x: number) => (x - cam.x) * z;
    return { cam, z, insets, sx, sy };
  };

  it('has the forge in the middle across, below the top band, and the shop’s tag above the quick entries', () => {
    if (forge === undefined || shop === undefined) throw new Error('no forge or shop');
    const tag = labelPoint(shop);
    if (tag === null) throw new Error('the shop has no tag');
    for (const [w, h] of [
      [390, 844],
      [412, 915],
      [360, 640],
    ] as const) {
      const v = look(w, h);
      const box = forge.item.box;
      expect(v.sx(box.x + box.w / 2)).toBeCloseTo(w / 2, 0);
      expect(v.sy(box.y)).toBeGreaterThanOrEqual(v.insets.top);
      expect(v.sy(tag.y)).toBeLessThanOrEqual(h - v.insets.bottom - 10);
    }
  });

  it('on a tall phone it is the forge a little low, as the mockup’s phone view', () => {
    if (forge === undefined) throw new Error('no forge');
    const v = look(390, 844);
    const box = forge.item.box;
    const mid = v.sy(box.y + box.h / 2);
    expect(mid).toBeGreaterThan(844 * 0.3);
    expect(mid).toBeLessThan(844 * 0.5);
  });
});
