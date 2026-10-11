// tools/art의 두 명령(gen.ts, process.ts)이 같이 쓰는 경로, 인자, 에셋 찾기, 그림 머리 읽기.

import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ART_ASSETS, type ArtAsset, assetId } from './assets.ts';

/** 저장소 뿌리 (tools/art의 두 단계 위). */
export const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** 처리된 그림이 가는 곳: <여기>/<그룹>/<key>.webp, <여기>/meta.json */
export const ASSETS_OUT_DIR = join(REPO_ROOT, 'src', 'assets', 'art');

/** 원본 PNG 폴더의 기본값 (gen.ts --out, process.ts --raw). 저장소 밖에 둔다. */
export const DEFAULT_RAW_DIR = join(tmpdir(), 'blacksmith-art', 'raw');

// ── 인자 ────────────────────────────────────────────────────────────────

export interface Argv {
  /** --이름 뒤의 값. 없으면 undefined. */
  get(name: string): string | undefined;
  /** 값 없는 옵션(--dry 같은)이 있는가. */
  has(name: string): boolean;
  /** -- 로 시작하지 않고 어느 옵션의 값도 아닌 인자. */
  readonly positional: readonly string[];
}

/**
 * valued: 값을 받는 옵션 (그 다음 인자를 값으로 먹는다). switches: 값 없는 옵션.
 * 모르는 옵션은 멈춘다 (오타로 --dry가 빠져 진짜로 도는 일을 막는다).
 */
export function parseArgv(
  argv: readonly string[],
  known: { readonly valued: readonly string[]; readonly switches: readonly string[] },
): Argv {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    if (known.valued.includes(name)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`--${name} 뒤에 값이 필요하다`);
      values.set(name, v);
      i++;
    } else if (known.switches.includes(name)) {
      flags.add(name);
    } else {
      throw new Error(`모르는 옵션: ${a}`);
    }
  }
  return { get: (n) => values.get(n), has: (n) => flags.has(n), positional };
}

// ── 에셋 찾기 ───────────────────────────────────────────────────────────

/**
 * 'key' 또는 '그룹/key'로 에셋을 찾는다. 'key'가 여러 그룹에 있으면(bellows, quench) 모두 돌려준다.
 * 없는 이름이면 멈춘다.
 */
export function findAssets(query: string): ArtAsset[] {
  const q = query.trim();
  const found = q.includes('/') ? ART_ASSETS.filter((a) => assetId(a) === q) : ART_ASSETS.filter((a) => a.key === q);
  if (found.length === 0) throw new Error(`매니페스트(tools/art/assets.ts)에 없는 에셋: ${q}`);
  return found;
}

/** 쉼표 목록(--only a,b,scene/c)을 에셋 목록으로. 매니페스트 순서를 지키고 겹치면 한 번만. */
export function selectAssets(list: string): ArtAsset[] {
  const ids = new Set<string>();
  for (const q of list.split(',')) if (q.trim() !== '') for (const a of findAssets(q)) ids.add(assetId(a));
  return ART_ASSETS.filter((a) => ids.has(assetId(a)));
}

// ── 그림 머리 읽기 (디코딩 없이 크기와 알파만) ────────────────────────────────

export interface ImageHead {
  readonly format: 'png' | 'webp';
  readonly w: number;
  readonly h: number;
  /** 알파 채널이 있는가 (PNG: 색 형식 4·6 또는 tRNS, WebP: VP8X 알파 표시 또는 VP8L 알파 비트). */
  readonly alpha: boolean;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readImageHead(buf: Uint8Array): ImageHead | null {
  return pngHead(buf) ?? webpHead(buf);
}

function view(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

function ascii(buf: Uint8Array, at: number, len: number): string {
  return String.fromCharCode(...buf.subarray(at, at + len));
}

function pngHead(buf: Uint8Array): ImageHead | null {
  if (buf.length < 33 || PNG_SIG.some((b, i) => buf[i] !== b) || ascii(buf, 12, 4) !== 'IHDR') return null;
  const dv = view(buf);
  const colorType = buf[25] ?? 0;
  let alpha = colorType === 4 || colorType === 6;
  for (let at = 8; !alpha && at + 8 <= buf.length; ) {
    const len = dv.getUint32(at);
    const type = ascii(buf, at + 4, 4);
    if (type === 'tRNS') alpha = true;
    if (type === 'IDAT' || type === 'IEND') break;
    at += 12 + len;
  }
  return { format: 'png', w: dv.getUint32(16), h: dv.getUint32(20), alpha };
}

function webpHead(buf: Uint8Array): ImageHead | null {
  if (buf.length < 30 || ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WEBP') return null;
  const dv = view(buf);
  const chunk = ascii(buf, 12, 4);
  const u24 = (at: number): number => (buf[at] ?? 0) | ((buf[at + 1] ?? 0) << 8) | ((buf[at + 2] ?? 0) << 16);
  if (chunk === 'VP8X') {
    return { format: 'webp', w: 1 + u24(24), h: 1 + u24(27), alpha: ((buf[20] ?? 0) & 0x10) !== 0 };
  }
  if (chunk === 'VP8 ') {
    return { format: 'webp', w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff, alpha: false };
  }
  if (chunk === 'VP8L') {
    const bits = dv.getUint32(21, true);
    return { format: 'webp', w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1, alpha: ((bits >>> 28) & 1) === 1 };
  }
  return null;
}

export function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
