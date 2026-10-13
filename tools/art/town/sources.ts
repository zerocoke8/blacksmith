// What the baked map (src/assets/art/town-map) is made from, and one hash of it: layout.json, the
// processed town pictures and the town guests' hero pictures (tools/art/assets.ts TOWN_GUEST_HEROES)
// with their meta.json entries, the dwarf. bake.ts writes the hash into map.json; bake.test.ts checks
// it still matches, so a changed layout or picture is never shipped with an old bake. The roster's
// other heroes (src/assets/art/heroes, not baked) do not count. (Node only.)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOWN_GUEST_HEROES } from '../assets.ts';
import { ASSETS_OUT_DIR, REPO_ROOT } from '../common.ts';

/** Where the baked map goes. */
export const BAKED_DIR = join(ASSETS_OUT_DIR, 'town-map');
export const BAKED_MANIFEST = join(BAKED_DIR, 'map.json');
export const LAYOUT_FILE = join(REPO_ROOT, 'docs', 'mockups', 'town', 'layout.json');

/** The bake's inputs, hashed. JSON is hashed as parsed (line endings and spacing do not count). */
export function bakeSourcesHash(): string {
  const h = createHash('sha256');
  const add = (name: string, data: string | Uint8Array) => {
    h.update(name);
    h.update('\0');
    h.update(data);
    h.update('\0');
  };
  add('layout.json', JSON.stringify(JSON.parse(readFileSync(LAYOUT_FILE, 'utf8'))));
  const meta = JSON.parse(readFileSync(join(ASSETS_OUT_DIR, 'meta.json'), 'utf8')) as {
    town?: unknown;
    heroes?: Record<string, unknown>;
    scene?: Record<string, unknown>;
  };
  const guests = new Set(TOWN_GUEST_HEROES);
  // Only the guests' entries, in meta.json's own order (so the hash is the one the ten-hero bake wrote).
  const heroes = meta.heroes === undefined ? null : Object.fromEntries(Object.entries(meta.heroes).filter(([k]) => guests.has(k)));
  add('meta.json', JSON.stringify({ town: meta.town ?? null, heroes, dwarf: meta.scene?.dwarf_idle ?? null }));
  for (const group of ['town', 'heroes']) {
    const dir = join(ASSETS_OUT_DIR, group);
    const files = readdirSync(dir).filter((n) => n.endsWith('.webp') && (group !== 'heroes' || guests.has(n.slice(0, -'.webp'.length))));
    for (const f of files.sort()) add(`${group}/${f}`, readFileSync(join(dir, f)));
  }
  add('scene/dwarf_idle.webp', readFileSync(join(ASSETS_OUT_DIR, 'scene', 'dwarf_idle.webp')));
  return h.digest('hex').slice(0, 20);
}
