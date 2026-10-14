// art-kit 도구(gen.ts, process.ts, inspect.ts, sheet.ts)가 같이 쓰는 것: 프로젝트 파일 읽기, 폴더, 인자, 에셋 찾기, 그림 머리 읽기.
//
// 프로젝트 파일 (이 프로젝트의 그림 목록. 키트 밖에 둔다. node tools/init.ts가 만든다):
//   --assets FILE   ART_ASSETS_FILE   기본 <kit>/../art-assets.ts (또는 .mts, 키트 폴더 옆). 없으면 키트 예제만 쓴다.
//   내보내는 이름은 manifest.ts의 ArtProjectModule: PROJECT_ASSETS, PROJECT_DIRS, PROJECT_GROUPS, PROJECT_REFS.
//
// 폴더: 명령줄 옵션 → 환경 변수 → 프로젝트 파일의 PROJECT_DIRS(그 파일의 폴더 기준) → 키트 기본값 순서로 정한다.
//   원본 PNG (Codex가 뽑은 그대로)   --raw DIR   ART_RAW_DIR   기본 <kit>/raw
//   처리 결과 (WebP + meta.json)      --out DIR   ART_OUT_DIR   기본 <kit>/out
//   참조 그림 (D 드워프, 세트 기준)    --ref DIR   ART_REF_DIR   기본 <kit>/ref
// 명령줄과 환경 변수의 상대 경로는 명령을 실행한 폴더 기준이다.
//
// 원본 폴더는 오래 남는 곳에 둔다 (임시 폴더도, 통째로 바꿀 키트 폴더 안도 피한다). 원래 게임은 OS 임시 폴더에 두었다가
// 원본이 여러 곳에 흩어졌다. Codex는 같은 프롬프트로도 같은 그림을 다시 내지 않으므로, 원본을 잃으면 되살릴 수 없다.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type ArtAsset,
  type ArtProjectModule,
  assetId,
  EXAMPLE_ASSETS,
  GROUP_RULES,
  type GroupRule,
  REF_IMAGES,
} from './manifest.ts';

/** 키트 폴더 (tools/의 한 단계 위). */
export const KIT_ROOT = resolve(import.meta.dirname, '..');

/**
 * --assets도 ART_ASSETS_FILE도 없을 때 찾는 프로젝트 파일: 키트 폴더 옆. 키트를 통째로 바꿔도 남는 자리다.
 * art-assets.mts도 찾는다 (프로젝트의 package.json이 "type": "commonjs"면 .ts 파일의 import 문을 Node가 읽지 못한다).
 */
export const DEFAULT_PROJECT_FILE = join(KIT_ROOT, '..', 'art-assets.ts');
const DEFAULT_PROJECT_FILES = [DEFAULT_PROJECT_FILE, join(KIT_ROOT, '..', 'art-assets.mts')];

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

// ── 프로젝트 파일과 폴더 ─────────────────────────────────────────────────

const GROUP_RULE_VALUES: readonly string[] = ['style', 'style+refOnly', 'style+card'];
const NAME = /^[A-Za-z0-9_-]+$/;

export interface ArtContext {
  /** 읽은 프로젝트 파일. 없으면 null (키트 예제만). */
  readonly projectFile: string | null;
  /** 예제 + 프로젝트 그림 (같은 '그룹/key'면 프로젝트 쪽). 그룹 순서, 그 안에서 적은 순서. */
  readonly assets: readonly ArtAsset[];
  /** 프로젝트 파일의 그림 ('그룹/key'). */
  readonly projectIds: ReadonlySet<string>;
  /** 그룹 이름 → 규칙 (키트 그룹 다음에 프로젝트 그룹). */
  readonly groupRules: Readonly<Record<string, GroupRule>>;
  readonly groups: readonly string[];
  /** 참조 이름 → 파일의 절대 경로 (키트 ref 폴더의 REF_IMAGES + 프로젝트 파일의 PROJECT_REFS). */
  readonly refFiles: Readonly<Record<string, string>>;
  readonly rawDir: string;
  readonly outDir: string;
  readonly refDir: string;
  /** 폴더를 어디서 정했나 (안내 문구용): '--raw', 'ART_RAW_DIR', '프로젝트 파일', '키트 기본'. */
  readonly dirFrom: { readonly raw: string; readonly out: string; readonly ref: string };
}

function envValue(name: string): string | undefined {
  const v = process.env[name];
  return v !== undefined && v.trim() !== '' ? v : undefined;
}

/** 프로젝트 파일 경로: --assets → ART_ASSETS_FILE → <kit>/../art-assets.ts (있을 때만). */
export function projectFilePath(args: Argv): string | null {
  const given = args.get('assets') ?? envValue('ART_ASSETS_FILE');
  if (given !== undefined) {
    const p = resolve(given);
    if (!existsSync(p)) throw new Error(`프로젝트 파일이 없다: ${p} (--assets 또는 ART_ASSETS_FILE)`);
    return p;
  }
  return DEFAULT_PROJECT_FILES.find((f) => existsSync(f)) ?? null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkAsset(file: string, a: unknown, i: number, rules: Readonly<Record<string, GroupRule>>): ArtAsset {
  const bad = (msg: string): never => {
    throw new Error(`프로젝트 파일 ${file}: PROJECT_ASSETS[${i}]${isRecord(a) && typeof a['key'] === 'string' ? ` (${a['key']})` : ''}${msg}`);
  };
  if (!isRecord(a)) return bad('가 객체가 아니다');
  if (typeof a['key'] !== 'string' || !NAME.test(a['key'])) bad('의 key는 영문·숫자·_·- 로 된 이름이어야 한다 (파일 이름이 된다)');
  const group = a['group'];
  if (typeof group !== 'string' || rules[group] === undefined) {
    bad(`의 그룹 '${String(group)}'이 없다. 쓸 수 있는 그룹: ${Object.keys(rules).join(', ')} (더하려면 PROJECT_GROUPS)`);
  }
  if (typeof a['size'] !== 'string' || !/^\d+x\d+$/.test(a['size'])) bad("의 size는 '1024x1024' 꼴이어야 한다");
  if (typeof a['transparent'] !== 'boolean') bad('의 transparent가 없다 (true/false)');
  if (typeof a['max'] !== 'number' || !(a['max'] > 0)) bad('의 max(처리 뒤 긴 변 px)가 없다');
  if (typeof a['prompt'] !== 'string' || a['prompt'].trim() === '') bad('의 prompt가 없다');
  const refs = a['refs'];
  if (refs !== undefined && (!Array.isArray(refs) || refs.some((r) => typeof r !== 'string'))) bad('의 refs는 문자열 목록이어야 한다');
  return a as unknown as ArtAsset;
}

/**
 * 프로젝트 파일을 읽고(있으면) 예제와 합친 에셋 목록, 그룹, 참조, 폴더를 정한다.
 * args에서 쓰는 옵션: --assets, --raw, --out, --ref (도구가 parseArgv에 넣어 둔 것만 들어온다).
 */
export async function loadContext(args: Argv): Promise<ArtContext> {
  const projectFile = projectFilePath(args);
  const file = projectFile ?? '';
  let mod: Partial<ArtProjectModule> = {};
  if (projectFile !== null) {
    try {
      mod = (await import(pathToFileURL(projectFile).href)) as Partial<ArtProjectModule>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint = /import statement outside a module|Unexpected token 'export'/.test(msg)
        ? ' 프로젝트의 package.json이 "type": "commonjs"라 .ts를 ES 모듈로 읽지 못한 것이다. 파일 이름을 art-assets.mts로 바꾼다 (도구는 .mts도 찾는다).'
        : '';
      throw new Error(`프로젝트 파일 ${projectFile}를 읽지 못했다: ${msg}${hint}`);
    }
    if (!Array.isArray(mod.PROJECT_ASSETS)) throw new Error(`프로젝트 파일 ${projectFile}: PROJECT_ASSETS(그림 목록 배열)를 내보내지 않는다`);
  }
  const projectDir = projectFile === null ? KIT_ROOT : dirname(projectFile);

  const groupRules: Record<string, GroupRule> = { ...GROUP_RULES };
  for (const [g, rule] of Object.entries(mod.PROJECT_GROUPS ?? {})) {
    if (!NAME.test(g)) throw new Error(`프로젝트 파일 ${file}: PROJECT_GROUPS의 '${g}'는 폴더 이름이 된다 (영문·숫자·_·-만)`);
    if (!GROUP_RULE_VALUES.includes(rule)) {
      throw new Error(`프로젝트 파일 ${file}: PROJECT_GROUPS.${g}의 규칙은 ${GROUP_RULE_VALUES.join(', ')} 가운데 하나`);
    }
    groupRules[g] = rule;
  }
  const groups = Object.keys(groupRules);

  const project = (mod.PROJECT_ASSETS ?? []).map((a, i) => checkAsset(file, a, i, groupRules));
  const projectIds = new Set<string>();
  for (const a of project) {
    const id = assetId(a);
    if (projectIds.has(id)) throw new Error(`프로젝트 파일 ${file}: '${id}'가 두 번 있다`);
    projectIds.add(id);
  }
  const all = [...EXAMPLE_ASSETS.filter((a) => !projectIds.has(assetId(a))), ...project];
  const assets = groups.flatMap((g) => all.filter((a) => a.group === g));

  const dir = (opt: 'raw' | 'out' | 'ref', env: string, kitDefault: string): { path: string; from: string } => {
    const flag = args.get(opt);
    if (flag !== undefined) return { path: resolve(flag), from: `--${opt}` };
    const e = envValue(env);
    if (e !== undefined) return { path: resolve(e), from: env };
    const p = mod.PROJECT_DIRS?.[opt];
    if (p !== undefined && p.trim() !== '') return { path: resolve(projectDir, p), from: '프로젝트 파일' };
    return { path: kitDefault, from: '키트 기본' };
  };
  const raw = dir('raw', 'ART_RAW_DIR', join(KIT_ROOT, 'raw'));
  const out = dir('out', 'ART_OUT_DIR', join(KIT_ROOT, 'out'));
  const ref = dir('ref', 'ART_REF_DIR', join(KIT_ROOT, 'ref'));

  const refFiles: Record<string, string> = {};
  for (const [name, r] of Object.entries(REF_IMAGES)) refFiles[name] = join(ref.path, r.file);
  for (const [name, r] of Object.entries(mod.PROJECT_REFS ?? {})) {
    refFiles[name] = isAbsolute(r.file) ? r.file : resolve(projectDir, r.file);
  }

  return {
    projectFile,
    assets,
    projectIds,
    groupRules,
    groups,
    refFiles,
    rawDir: raw.path,
    outDir: out.path,
    refDir: ref.path,
    dirFrom: { raw: raw.from, out: out.from, ref: ref.from },
  };
}

/** 폴더 줄 (도구가 처음에 찍는다): 어디를 쓰고 어디서 정했는지. */
export function describeContext(ctx: ArtContext, which: readonly ('raw' | 'out' | 'ref')[]): string {
  const name = { raw: '원본 폴더', out: '출력 폴더', ref: '참조 폴더' } as const;
  const path = { raw: ctx.rawDir, out: ctx.outDir, ref: ctx.refDir } as const;
  const lines = [`프로젝트 파일 ${ctx.projectFile ?? '(없음: 키트 예제만)'}${ctx.projectFile !== null ? ` (그림 ${ctx.projectIds.size}장)` : ''}`];
  for (const w of which) lines.push(`${name[w]} ${path[w]}  (${ctx.dirFrom[w]})`);
  return lines.join('\n');
}

function realOrResolved(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return resolve(p);
  }
}

/** child가 parent 폴더 안(같은 폴더 포함)인가. Windows는 대소문자를 가리지 않는다. 아직 없는 폴더도 된다. */
export function isInside(child: string, parent: string): boolean {
  const norm = (p: string): string => {
    const s = realOrResolved(p).replace(/\\/g, '/').replace(/\/$/, '');
    return process.platform === 'win32' ? s.toLowerCase() : s;
  };
  // child가 아직 없으면 있는 조상까지 올라가 실제 경로를 맞춘다 (임시 폴더의 8.3 짧은 이름 등).
  let c = resolve(child);
  const tail: string[] = [];
  while (!existsSync(c) && dirname(c) !== c) {
    tail.unshift(c.slice(dirname(c).length).replace(/^[\\/]/, ''));
    c = dirname(c);
  }
  const full = [norm(c), ...tail.map((t) => (process.platform === 'win32' ? t.toLowerCase() : t))].join('/');
  const p = norm(parent);
  return full === p || full.startsWith(`${p}/`);
}

/** 폴더가 OS 임시 폴더 안이면 그 임시 폴더, 아니면 null. */
export function tempParent(dir: string): string | null {
  const temps = [tmpdir(), envValue('TEMP'), envValue('TMP'), envValue('TMPDIR')].filter(
    (t): t is string => t !== undefined && existsSync(t) && statSync(t).isDirectory(),
  );
  return temps.find((t) => isInside(dir, t)) ?? null;
}

// ── 에셋 찾기 ───────────────────────────────────────────────────────────

/**
 * 'key' 또는 '그룹/key'로 에셋을 찾는다. 'key'가 여러 그룹에 있으면 모두 돌려준다.
 * 없는 이름이면 멈춘다.
 */
export function findAssets(assets: readonly ArtAsset[], query: string): ArtAsset[] {
  const q = query.trim();
  const found = q.includes('/') ? assets.filter((a) => assetId(a) === q) : assets.filter((a) => a.key === q);
  if (found.length === 0) throw new Error(`없는 에셋: ${q} (프로젝트 파일의 PROJECT_ASSETS에도 키트 예제에도 없다)`);
  return found;
}

/** 쉼표 목록(--only a,b,objects/c)을 에셋 목록으로. 목록 순서를 지키고 겹치면 한 번만. */
export function selectAssets(assets: readonly ArtAsset[], list: string): ArtAsset[] {
  const ids = new Set<string>();
  for (const q of list.split(',')) if (q.trim() !== '') for (const a of findAssets(assets, q)) ids.add(assetId(a));
  return assets.filter((a) => ids.has(assetId(a)));
}

/** 경로를 지금 폴더 기준으로 짧게 (안쪽이면 상대 경로, 아니면 그대로). 안내 문구용. */
export function shortPath(p: string): string {
  const rel = relative(process.cwd(), p);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) ? rel : p;
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

/** 이 도구 파일을 지금 폴더에서 부르는 경로 (안내 문구용). 예: 'node art-kit/tools/process.ts'. */
export function toolCommand(file: string): string {
  const rel = relativeFromCwd(join(import.meta.dirname, file));
  return `node ${/\s/.test(rel) ? `"${rel}"` : rel}`;
}

function relativeFromCwd(p: string): string {
  const cwd = process.cwd();
  const norm = (s: string) => s.replace(/\\/g, '/');
  const a = norm(p);
  const c = norm(cwd).replace(/\/$/, '');
  return a.toLowerCase().startsWith(`${c.toLowerCase()}/`) ? a.slice(c.length + 1) : a;
}
