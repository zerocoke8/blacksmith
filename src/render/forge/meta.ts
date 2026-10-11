// meta.json from the art pipeline (tools/art/process.ts): per picture its size and trim box, and
// optional anchor overrides. Only the scene reads it, so it ships in the scene's chunk, not in
// the first load. layout.ts has the anchors; an entry here wins for the dwarf poses.

import type { ArtGroup } from './assets.ts';
import type { ArtPoint } from './layout.ts';

const META_FILES = import.meta.glob('/src/assets/art/meta.json', { import: 'default', eager: true }) as Record<string, unknown>;

/** Anchor overrides from meta.json (optional; layout.ts has the defaults). */
export interface ArtMeta {
  w?: number;
  h?: number;
  foot?: ArtPoint;
  head?: number;
  hammer?: ArtPoint;
  face?: ArtPoint;
  mouth?: ArtPoint;
  top?: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function point(v: unknown): ArtPoint | undefined {
  return isObj(v) && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * meta.json may key entries as "scene/dwarf_idle", group → key, or the bare key. Unknown fields
 * are ignored, so the art pipeline can add its own (trim boxes, sources).
 */
export function artMeta(group: ArtGroup, key: string): ArtMeta | null {
  const root = Object.values(META_FILES)[0];
  if (!isObj(root)) return null;
  const nested = isObj(root[group]) ? (root[group] as Record<string, unknown>)[key] : undefined;
  const raw = root[`${group}/${key}`] ?? nested ?? root[key];
  if (!isObj(raw)) return null;
  return {
    w: num(raw.w ?? raw.width),
    h: num(raw.h ?? raw.height),
    foot: point(raw.foot),
    head: num(raw.head),
    hammer: point(raw.hammer),
    face: point(raw.face),
    mouth: point(raw.mouth),
    top: num(raw.top),
  };
}
