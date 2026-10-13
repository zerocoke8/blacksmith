// 마을 지도 그림: the map's pictures as tools/art/town/bake.ts bakes them, at map resolution,
// shadows lifted, towers stacked, outlined (src/assets/art/town-map/<name>.webp; what is where is
// its map.json, read by baked.ts). The sources they are baked from (src/assets/art/town, heroes)
// are not imported by the game. Only URLs live here (nothing is fetched until shown), so the home
// screen's quick entries can borrow a picture or two without growing the first load.
// '?no-inline': a small prop would otherwise ride in the JS as base64.

const FILES = import.meta.glob('/src/assets/art/town-map/*.webp', {
  query: '?no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const URLS = new Map<string, string>();
for (const [path, url] of Object.entries(FILES)) {
  const m = /\/town-map\/([^/]+)\.webp$/.exec(path);
  if (m !== null && m[1] !== undefined) URLS.set(m[1], url);
}

/** A baked picture's URL by its name (a layout key such as 'bld_forge', a hero 'hero_vail', 'ground'). */
export function townMapUrl(name: string): string | null {
  return URLS.get(name) ?? null;
}

/** The example heroes the map has a picture of, in a fixed order (their keys). */
export const HERO_KEYS: readonly string[] = [...URLS.keys()].filter((k) => k.startsWith('hero_')).sort();
