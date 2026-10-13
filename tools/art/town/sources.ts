// What the baked map (src/assets/art/town-map) is made from, and one hash of it: layout.json, the
// processed town and hero pictures with their meta.json entries, the dwarf. bake.ts writes the hash
// into map.json; bake.test.ts checks it still matches, so a changed layout or picture is never
// shipped with an old bake. (Node only.)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    heroes?: unknown;
    scene?: Record<string, unknown>;
  };
  add('meta.json', JSON.stringify({ town: meta.town ?? null, heroes: meta.heroes ?? null, dwarf: meta.scene?.dwarf_idle ?? null }));
  for (const group of ['town', 'heroes']) {
    const dir = join(ASSETS_OUT_DIR, group);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.webp')).sort()) add(`${group}/${f}`, readFileSync(join(dir, f)));
  }
  add('scene/dwarf_idle.webp', readFileSync(join(ASSETS_OUT_DIR, 'scene', 'dwarf_idle.webp')));
  return h.digest('hex').slice(0, 20);
}
