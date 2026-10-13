// 광석 정제 그림: src/assets/art/refine/<key>.webp (tools/art/assets.ts, group 'refine'). Only the
// refine screen's chunk imports this, so these URLs (and the pictures, which load when shown)
// never weigh on the first load. A key with no picture returns null and the screen draws a
// stand-in.

import type { RefineItemId } from '../../sim/data/refine.ts';

export const REFINE_ART_KEYS = [
  'ore_chunk',
  'chunk_pile',
  'ore_iron',
  'ore_steel',
  'ore_mithril',
  'ore_orichalcum',
  'ore_adamant',
  'gold_coins',
  'gift_flowers',
  'gift_honey',
  'gift_pebble',
  'gift_gloves',
  'btn_hammer',
  'bag',
] as const;
export type RefineArtKey = (typeof REFINE_ART_KEYS)[number];

const FILES = import.meta.glob('/src/assets/art/refine/*.{webp,png}', {
  query: '?no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const URLS = new Map<string, string>();
for (const [path, url] of Object.entries(FILES)) {
  const m = /\/art\/refine\/([^/]+)\.(webp|png)$/.exec(path);
  if (m === null) continue;
  // .webp wins over a .png of the same key (the png is a work copy).
  if (m[2] === 'webp' || !URLS.has(m[1] as string)) URLS.set(m[1] as string, url);
}

export function refineArtUrl(key: RefineArtKey): string | null {
  return URLS.get(key) ?? null;
}

/** The icon of each row of the result table (a new row needs its icon here). */
export const REFINE_ITEM_ART: Record<RefineItemId, RefineArtKey> = {
  ironOre: 'ore_iron',
  gold: 'gold_coins',
  steelIngot: 'ore_steel',
  wildflowers: 'gift_flowers',
  honeyCake: 'gift_honey',
  mithrilOre: 'ore_mithril',
  orichalcumOre: 'ore_orichalcum',
  shinyPebble: 'gift_pebble',
  knitGloves: 'gift_gloves',
  adamantOre: 'ore_adamant',
  // 경험치 never reaches the bag (it fills the level bar, 5.3); no picture of its own yet, the lump stands in.
  exp: 'ore_chunk',
};

export function itemArtUrl(id: RefineItemId): string | null {
  return refineArtUrl(REFINE_ITEM_ART[id]);
}
