// Art lookup: src/assets/art/<scene|ui|cards>/<key>.webp (or .png). A key with no picture yet
// returns null and the caller draws its stand-in. Only URLs live here (no image is fetched
// until something shows it), so React screens can import this without growing the first load.
// meta.json is read by meta.ts, which only the scene (a chunk of its own) imports.
// '?no-inline': the doodle icons are small (3–4 KB), under Vite's inline limit; inlined, they would
// ride in the first load's JS as base64. As files, they load only when shown.

import { type CardId, type CardKind, CARDS } from '../../sim/data/cards.ts';
import { CARD_FRAME_ART, type SceneArtKey, type UiArtKey } from './layout.ts';

export type ArtGroup = 'scene' | 'ui' | 'cards';

const FILES = import.meta.glob('/src/assets/art/**/*.{webp,png}', {
  query: '?no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const URLS = new Map<string, string>();
for (const [path, url] of Object.entries(FILES)) {
  const m = /\/art\/(scene|ui|cards)\/([^/]+)\.(webp|png)$/.exec(path);
  if (m === null) continue;
  const id = `${m[1]}/${m[2]}`;
  // .webp wins over a .png of the same key (the png is a work copy).
  if (m[3] === 'webp' || !URLS.has(id)) URLS.set(id, url);
}

export function artUrl(group: ArtGroup, key: string): string | null {
  return URLS.get(`${group}/${key}`) ?? null;
}

export function sceneArtUrl(key: SceneArtKey): string | null {
  return artUrl('scene', key);
}

export function uiArtUrl(key: UiArtKey): string | null {
  return artUrl('ui', key);
}

/**
 * The picture a card uses: its own id, an evolved card its original card's (CARDS[id].family),
 * a family card (repayStrike1~5) its name without the level.
 */
export function cardArtKey(id: CardId): string {
  const spec = CARDS[id];
  if (spec.group === 'evolved') return spec.family;
  if (spec.group === 'family') return id.replace(/\d+$/, '');
  return id;
}

export function cardArtUrl(id: CardId): string | null {
  return artUrl('cards', cardArtKey(id));
}

/** The frame picture for a card kind, or null to draw the frame with CSS. */
export function frameArtUrl(kind: CardKind): string | null {
  if (CARD_FRAME_ART === 'css') return null;
  return uiArtUrl(`frame_${kind}`);
}

