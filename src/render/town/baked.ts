// The map's pictures, baked ahead (기획서 9장): tools/art/town/bake.ts runs the composer's steps once
// on the processed WebPs (shadows lifted and laid in one layer on the ground, towers stacked into
// the clouds, small props and people outlined, all shrunk to map resolution) and writes the results
// to src/assets/art/town-map/ with map.json, which says where each one stands. The game only loads
// and draws them: nothing is computed from pixels as the map opens (bake.test.ts checks the bake
// is not older than its sources). The images are kept for the session once loaded (memory only),
// so coming back to the map does not fetch or decode them again.

import { townMapUrl } from './assets.ts';

/** A picture standing on the map (a building, a prop, the dwarf, a guest). */
export interface BakedPic {
  readonly file: string;
  /** Its size (px), and where it stands in it (px): its body's middle and its ground line. */
  readonly w: number;
  readonly h: number;
  readonly ax: number;
  readonly ay: number;
  /** Map px per px (about 1). */
  readonly scale: number;
  /** Its ground shadow's basis (map px): its base's offset from the middle and the ellipse's width basis (layout groundEllipse). */
  readonly foot: { readonly off: number; readonly bw: number };
}

/** A flat layer laid on the map: its top-left (map px) and map px per px. */
export interface BakedLayer {
  readonly file: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly scale: number;
}

export interface BakedManifest {
  readonly version: 1;
  /** The hash of what it was baked from (tools/art/town/sources.ts). */
  readonly sources: string;
  /** GUESTS.height the heroes were baked at (map px). */
  readonly guestHeight: number;
  /** Sky, ground, dirt paths and every shadow: the ground picture's resolution, stretched `scale`×. */
  readonly ground: BakedLayer;
  /** The clouds on the horizon and round the towers (strips no wider than 2048 px, for old GPUs). */
  readonly horizon: readonly BakedLayer[];
  readonly rings: readonly BakedLayer[];
  /** One cloud band tile: its size and where the first one starts (map px). The scene lays it across, every other one mirrored. */
  readonly band: { readonly file: string; readonly w: number; readonly h: number; readonly x0: number; readonly y: number } | null;
  /** The map's pictures by layout key (the dwarf among them). */
  readonly pictures: Readonly<Record<string, BakedPic>>;
  /** The guests' pictures by hero key. */
  readonly heroes: Readonly<Record<string, BakedPic>>;
}

const MANIFEST = import.meta.glob('/src/assets/art/town-map/map.json', { import: 'default', eager: true }) as Record<string, unknown>;

export function bakedManifest(): BakedManifest {
  const m = Object.values(MANIFEST)[0] as BakedManifest | undefined;
  if (m === undefined || m.version !== 1 || m.ground === undefined) throw new Error('src/assets/art/town-map/map.json is missing: run node tools/art/town/bake.ts');
  return m;
}

/** Every file the map draws. */
export function bakedFiles(m: BakedManifest): string[] {
  const out = new Set<string>([m.ground.file, ...m.horizon.map((l) => l.file), ...m.rings.map((l) => l.file)]);
  if (m.band !== null) out.add(m.band.file);
  for (const p of Object.values(m.pictures)) out.add(p.file);
  for (const p of Object.values(m.heroes)) out.add(p.file);
  return [...out];
}

export interface TownPictures {
  readonly manifest: BakedManifest;
  /** A loaded, decoded picture by file name (null: missing, that place stays empty). */
  image(file: string): HTMLImageElement | null;
  /** How long loading and decoding took (ms), for the 실험 panel. */
  readonly loadMs: number;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  // decode() decodes off the main thread; a picture that fails leaves its place empty.
  return img.decode().then(
    () => img,
    () => null,
  );
}

let cached: Promise<TownPictures> | null = null;

/** Loads and decodes the map's pictures once per session (memory only). */
export function loadTownPictures(): Promise<TownPictures> {
  if (cached !== null) return cached;
  const t0 = performance.now();
  const job = (async (): Promise<TownPictures> => {
    const manifest = bakedManifest();
    const files = bakedFiles(manifest);
    const imgs = await Promise.all(files.map((f) => {
      const url = townMapUrl(f);
      return url === null ? Promise.resolve(null) : loadImage(url);
    }));
    const byFile = new Map<string, HTMLImageElement>();
    files.forEach((f, i) => {
      const img = imgs[i];
      if (img !== null && img !== undefined) byFile.set(f, img);
    });
    if (!byFile.has(manifest.ground.file)) throw new Error('the map’s ground did not load');
    return { manifest, image: (f) => byFile.get(f) ?? null, loadMs: performance.now() - t0 };
  })();
  cached = job.catch((e: unknown) => {
    cached = null;
    throw e;
  });
  return cached;
}

/** Starts loading early (the home screen asks as it opens, before the map's own code is up). */
export function prefetchTownPictures(): void {
  void loadTownPictures().catch(() => undefined);
}

const alphas = new WeakMap<HTMLImageElement, Uint8Array>();

/** A picture's alpha, row by row, for taps (read back once, the first time a tap needs it). */
export function alphaOf(img: HTMLImageElement): Uint8Array | null {
  const known = alphas.get(img);
  if (known !== undefined) return known;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (g === null) return null;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const a = new Uint8Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] ?? 0;
  alphas.set(img, a);
  return a;
}
