import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BakedManifest } from '../../../src/render/town/baked.ts';
import { GUESTS, MAP_ITEMS } from '../../../src/render/town/layout.ts';
import { TOWN_GUEST_HEROES } from '../assets.ts';
import { readImageHead } from '../common.ts';
import { BAKED_DIR, BAKED_MANIFEST, bakeSourcesHash } from './sources.ts';

const manifest = JSON.parse(readFileSync(BAKED_MANIFEST, 'utf8')) as BakedManifest;

describe('the baked map (src/assets/art/town-map, tools/art/town/bake.ts)', () => {
  it('is baked from today’s layout and pictures: after changing them, run node tools/art/town/bake.ts', () => {
    expect(manifest.sources).toBe(bakeSourcesHash());
    expect(manifest.guestHeight).toBe(GUESTS.height);
  });

  it('has a picture for every place in the layout and for every town guest hero (TOWN_GUEST_HEROES), and no other hero', () => {
    for (const it of MAP_ITEMS) expect(manifest.pictures[it.key], it.key).toBeDefined();
    const processed = new Set(
      readdirSync(join(BAKED_DIR, '..', 'heroes'))
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.replace(/\.webp$/, '')),
    );
    for (const k of TOWN_GUEST_HEROES) expect(processed.has(k), `src/assets/art/heroes/${k}.webp`).toBe(true);
    expect(Object.keys(manifest.heroes).sort()).toEqual([...TOWN_GUEST_HEROES].sort());
  });

  it('every file it names is there, at the size it says, no side over 2048 px (old phones’ GPUs)', () => {
    const all = [
      manifest.ground,
      ...manifest.horizon,
      ...manifest.rings,
      ...Object.values(manifest.pictures),
      ...Object.values(manifest.heroes),
      ...(manifest.band !== null ? [{ file: manifest.band.file, w: 0, h: 0 }] : []),
    ];
    for (const p of all) {
      const file = join(BAKED_DIR, `${p.file}.webp`);
      expect(existsSync(file), p.file).toBe(true);
      const head = readImageHead(readFileSync(file));
      expect(head, p.file).not.toBeNull();
      if (head === null) continue;
      if (p.w > 0) {
        expect(head.w, p.file).toBe(p.w);
        expect(head.h, p.file).toBe(p.h);
      }
      expect(Math.max(head.w, head.h), p.file).toBeLessThanOrEqual(2048);
    }
  });

  it('draws the pictures at map resolution (about one px per map px), so nothing shimmers as the map moves', () => {
    for (const p of [...Object.values(manifest.pictures), ...Object.values(manifest.heroes)]) {
      expect(p.scale, p.file).toBeGreaterThan(0.9);
      expect(p.scale, p.file).toBeLessThan(1.1);
    }
  });
});
