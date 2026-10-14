// 용사·몬스터·아이콘 그림 (tools/art/assets.ts groups heroes, monsters, icons) and the battle's
// sprite sheets (src/assets/art/anim/, tools/art/README.md). Only URLs live here: a picture is
// fetched when a screen shows it, and a screen that loaded one into the GPU unloads it on leaving
// (scene.ts). '?no-inline': a small icon would otherwise ride in the JS as base64.

import { type AnimAction, ANIM_ACTIONS } from './motion.ts';

const HEROES = import.meta.glob('/src/assets/art/heroes/*.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;
const MONSTERS = import.meta.glob('/src/assets/art/monsters/*.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;
const ICONS = import.meta.glob('/src/assets/art/icons/*.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;
/** The battle UI's own pictures in ui/ (the flame ring round a ready signature card). */
const UI = import.meta.glob('/src/assets/art/ui/ult_ready.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;
/** Sheets: anim/<key>@<action>.webp (a horizontal strip, ANIM_SPEC frames). None are drawn yet. */
const SHEETS = import.meta.glob('/src/assets/art/anim/*.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;

function byName(files: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const m = /\/([^/]+)\.webp$/.exec(path);
    if (m !== null && m[1] !== undefined) out.set(m[1], url);
  }
  return out;
}

const HERO_URLS = byName(HEROES);
const MONSTER_URLS = byName(MONSTERS);
const ICON_URLS = byName(ICONS);
const SHEET_URLS = byName(SHEETS);

/** A hero's picture (src/assets/art/heroes/<key>.webp), or null. */
export function heroArtUrl(key: string): string | null {
  return HERO_URLS.get(key) ?? null;
}

/** A monster's picture (src/assets/art/monsters/<key>.webp), or null. */
export function monsterArtUrl(key: string): string | null {
  return MONSTER_URLS.get(key) ?? null;
}

/** A battle UI picture (src/assets/art/ui/<key>.webp: ult_ready), or null. */
export function battleUiUrl(key: 'ult_ready'): string | null {
  return byName(UI).get(key) ?? null;
}

/** An icon (src/assets/art/icons/<key>.webp: element_*, weapon_*, role_*, star_*, ui_auto, ui_speed, status_fast, status_slow), or null. */
export function iconUrl(key: string): string | null {
  return ICON_URLS.get(key) ?? null;
}

/** The file name of a fighter's sheet for an action (tools/art/README.md). */
export function sheetName(key: string, action: AnimAction): string {
  return `${key}@${action}`;
}

/** The sheets a fighter has, by action (empty today: the coordinate motion stands in). */
export function sheetUrls(key: string): Partial<Record<AnimAction, string>> {
  const out: Partial<Record<AnimAction, string>> = {};
  for (const a of ANIM_ACTIONS) {
    const url = SHEET_URLS.get(sheetName(key, a));
    if (url !== undefined) out[a] = url;
  }
  return out;
}
