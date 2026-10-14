// 용사 그림을 카드 칸에 넣는 법 (기획서 5.9): every hero's picture inside its box, head to feet.
// The pictures are cut from canvases of one size (tools/art/process.ts trims them), so their trim
// boxes (meta.json, the source canvas's px) say how big each hero is drawn. 'shared' puts everyone on
// one scale, the scale at which the widest and the tallest hero both fit (a big hero stays big, a
// small one small); 'each' fills the box with every hero on its own. Change HERO_ART_FIT to try
// another look: the card (HeroCard), the formation's cells and picks (FormationEditor) all follow.

export type HeroArtMode = 'shared' | 'each';

export interface HeroArtFit {
  readonly mode: HeroArtMode;
  /** Room kept inside the box (shares of its height, top and bottom; of its width, each side). */
  readonly pad: { readonly top: number; readonly bottom: number; readonly side: number };
}

/** [튜닝: 연출] How heroes sit in their boxes. */
export const HERO_ART_FIT: HeroArtFit = {
  mode: 'shared',
  pad: { top: 0.04, bottom: 0.03, side: 0.03 },
};

/**
 * The heroes' entries of meta.json. The bundler shares one chunk of meta.json with the art scenes
 * (render/forge/meta.ts), so the whole file (about 5 kB gzip) comes with this screen.
 */
const META = import.meta.glob('/src/assets/art/meta.json', { import: 'heroes', eager: true }) as Record<string, unknown>;

interface Size {
  readonly w: number;
  readonly h: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** A hero's size on its source canvas: the trim box, or the picture's own size over its scale. */
function sizeOf(raw: unknown): Size | null {
  if (!isObj(raw)) return null;
  if (isObj(raw.trim)) {
    const w = num(raw.trim.w);
    const h = num(raw.trim.h);
    if (w !== null && h !== null) return { w, h };
  }
  const w = num(raw.w);
  const h = num(raw.h);
  const s = num(raw.scale) ?? 1;
  return w !== null && h !== null ? { w: w / s, h: h / s } : null;
}

function readSizes(): Map<string, Size> {
  const out = new Map<string, Size>();
  const heroes = Object.values(META)[0];
  if (!isObj(heroes)) return out;
  for (const [key, raw] of Object.entries(heroes)) {
    const s = sizeOf(raw);
    if (s !== null) out.set(key, s);
  }
  return out;
}

const SIZES = readSizes();

/** The art pipeline gave this hero a size (a hero without one is drawn at the stage's full height). */
export function hasHeroArtSize(key: string): boolean {
  return SIZES.has(key);
}

/** The box every hero fits in on the shared scale (source canvas px): the widest and the tallest. */
export function heroStage(sizes: ReadonlyMap<string, Size> = SIZES): Size {
  let w = 1;
  let h = 1;
  for (const s of sizes.values()) {
    w = Math.max(w, s.w);
    h = Math.max(h, s.h);
  }
  return { w, h };
}

const STAGE = heroStage();

/**
 * How tall a hero's picture is drawn, as a share of the stage's height (the stage is a box of the
 * stage's shape, as big as fits inside the padded box). The picture's width follows from its own
 * shape, so it never comes out wider than the stage.
 */
export function heroArtHeight(key: string, fit: HeroArtFit = HERO_ART_FIT, sizes: ReadonlyMap<string, Size> = SIZES, stage: Size = STAGE): number {
  const s = sizes.get(key);
  if (s === undefined) return 1;
  if (fit.mode === 'shared') return Math.min(1, s.h / stage.h);
  // Each on its own: as tall as the stage, unless that makes it wider than the stage.
  return Math.min(1, stage.w / stage.h / (s.w / s.h));
}

/** The stage's shape (width over height) for the CSS. */
export function heroStageAspect(stage: Size = STAGE): number {
  return stage.w / stage.h;
}
