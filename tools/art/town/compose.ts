// 마을 지도 시안을 합성한다 (기획서 3.8, 결과와 설명은 docs/mockups/town).
//   node tools/art/town/compose.ts [--out <폴더>] [--raw <원본 폴더>] [--heroes <폴더>] [--png] [--debug] [--grid]
// 바닥 위에 건물·탑·소품·사람을 놓고 오솔길·그림자·구름·연기를 그려 다음을 쓴다:
//   full        지도 한 장 (WebP는 세로 2400px로 줄인다)
//   overview    줄인 전체 (세로 1400px)
//   view_forge, view_plaza, view_towers   폰 화면 셋 (지도 1:1, 780x1688, 위 칩과 아래 메뉴의 UI 목업)
//   assets      쓴 그림 목록
//   layout.json 놓은 자리 (지도 px), 탑의 층, 구름, 오솔길, 화면 자리
// 배치와 수치는 layout.ts, 그리는 일은 page.js (헤드리스 크롬 안의 canvas, ../chrome.ts). 새 패키지는 없다.
//
// 그림 찾기:
//   town 그림  --raw 폴더의 <key>.png (<raw>/, <raw>/town/, <raw>/ground|buildings|props/ 순서. 앞은 gen.ts의 구조,
//              뒤는 처음 뽑을 때의 구조). 없으면 src/assets/art/town/<key>.webp를 meta.json의 trim 자리에 놓아 원본
//              캔버스로 되돌려 쓴다 (원본 px 수치가 그대로 맞는다). 처리된 그림은 줄이고 압축한 것이라 조금 흐리고,
//              그림자 떼기·층 쌓기 결과도 조금 다르다.
//   이전 판    그림 목록의 '이전 → 새' 칸 (layout.ts OLD_VERSIONS): --raw 폴더의 버린 판. 없으면 그 칸을 뺀다.
//   사람       --heroes 폴더의 hero_<이름>.png (영웅 예제 그림, 이 저장소 밖). 없으면 사람 없이 그린다.
//              드워프는 tools/art/ref/d_dwarf_idle.png.
//   UI 목업    src/assets/art/refine의 골드·덩어리·가방 아이콘.
// 같은 원본과 같은 크롬이면 같은 그림이 나온다 (구름·오솔길의 흔들림은 씨앗 고정 난수).
//
// Options:
//   --out DIR     결과 폴더 (기본: OS 임시 폴더/blacksmith-art/town-mockup). 보존한 시안을 바꾸려면 docs/mockups/town.
//   --raw DIR     원본 PNG 폴더 (위 '그림 찾기')
//   --heroes DIR  영웅 예제 그림 폴더
//   --png         WebP(품질 0.85) 대신 PNG로, full도 줄이지 않는다 (1:1로 살펴볼 때)
//   --debug       <out>/debug/에 상자와 기준점을 그린 지도(debug_boxes)와 그림마다 잰 값(diag.json)도 쓴다
//   --grid        지도 대신 바닥에 좌표 격자만 그려 <out>/debug/debug_grid로 (자리를 잡을 때)
//   --chrome PATH 크롬 실행 파일, --tmp DIR 크롬 임시 프로필을 만들 곳 (../chrome.ts)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { ART_ASSETS } from '../assets.ts';
import { launchChrome } from '../chrome.ts';
import { ASSETS_OUT_DIR, kb, parseArgv, REPO_ROOT } from '../common.ts';
import { config, HERO_NAMES, OLD_VERSIONS } from './layout.ts';

const HERE = import.meta.dirname;
const DEFAULT_OUT = join(tmpdir(), 'blacksmith-art', 'town-mockup');
/** WebP 품질 (tools/art/process.ts와 같다). */
const QUALITY = 0.85;
/** WebP로 쓸 때 full의 최대 높이 (px). */
const FULL_MAX_H = 2400;

/** 처리된 WebP를 원본 캔버스로 되돌릴 자리 (meta.json trim). */
interface Rebuild {
  readonly ow: number;
  readonly oh: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface TownMetaEntry {
  readonly trim: { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly ow: number; readonly oh: number };
}

function usage(): string {
  return 'node tools/art/town/compose.ts [--out <폴더>] [--raw <원본 폴더>] [--heroes <폴더>] [--png] [--debug] [--grid] [--chrome <크롬 경로>] [--tmp <임시 폴더>]';
}

const shown = (p: string): string => {
  const r = relative(process.cwd(), p);
  return r.startsWith('..') ? p : r;
};

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2), {
    valued: ['out', 'raw', 'heroes', 'chrome', 'tmp'],
    switches: ['png', 'debug', 'grid', 'help'],
  });
  if (args.has('help') || args.positional.length > 0) {
    console.log(usage());
    if (args.positional.length > 0) process.exitCode = 1;
    return;
  }
  const out = resolve(args.get('out') ?? DEFAULT_OUT);
  const rawArg = args.get('raw');
  const raw = rawArg === undefined ? null : resolve(rawArg);
  if (raw !== null && !existsSync(raw)) throw new Error(`원본 폴더가 없다: ${raw}`);
  const heroesArg = args.get('heroes');
  const heroes = heroesArg === undefined ? null : resolve(heroesArg);
  if (heroes !== null && !existsSync(heroes)) throw new Error(`영웅 그림 폴더가 없다: ${heroes}`);
  const png = args.has('png');

  const findRaw = (file: string): string | null => {
    if (raw === null) return null;
    for (const dir of ['', 'town', 'ground', 'buildings', 'props']) {
      const p = join(raw, dir, file);
      if (existsSync(p)) return p;
    }
    return null;
  };

  // 페이지가 이름으로 불러 갈 파일과, 원본 캔버스로 되돌릴 WebP.
  const files: Record<string, string> = {};
  const rebuild: Record<string, Rebuild> = {};
  const metaFile = join(ASSETS_OUT_DIR, 'meta.json');
  const meta = existsSync(metaFile)
    ? ((JSON.parse(readFileSync(metaFile, 'utf8')) as { town?: Record<string, TownMetaEntry> }).town ?? {})
    : {};
  let fromRaw = 0;
  let fromWebp = 0;
  const missing: string[] = [];
  for (const a of ART_ASSETS.filter((x) => x.group === 'town')) {
    const r = findRaw(`${a.key}.png`);
    const webp = join(ASSETS_OUT_DIR, 'town', `${a.key}.webp`);
    const m = meta[a.key];
    if (r !== null) {
      files[a.key] = r;
      fromRaw++;
    } else if (existsSync(webp) && m !== undefined) {
      files[a.key] = webp;
      rebuild[a.key] = { ow: m.trim.ow, oh: m.trim.oh, x: m.trim.x, y: m.trim.y, w: m.trim.w, h: m.trim.h };
      fromWebp++;
    } else {
      missing.push(a.key);
    }
  }
  // 그림 목록의 '바닥 (새, 원본)' 칸은 지도 바닥과 같은 그림이다.
  const ground = files[config.ground];
  const groundRebuild = rebuild[config.ground];
  if (ground !== undefined) files[`${config.ground}_raw`] = ground;
  if (groundRebuild !== undefined) rebuild[`${config.ground}_raw`] = groundRebuild;
  for (const [name, file] of Object.entries(OLD_VERSIONS)) {
    const p = findRaw(file);
    if (p !== null) files[name] = p;
  }
  let heroCount = 0;
  if (heroes !== null) {
    for (const h of HERO_NAMES) {
      const p = join(heroes, `hero_${h}.png`);
      if (existsSync(p)) {
        files[`hero_${h}`] = p;
        heroCount++;
      }
    }
  }
  files.dwarf = join(REPO_ROOT, 'tools', 'art', 'ref', 'd_dwarf_idle.png');
  files.ui_gold = join(ASSETS_OUT_DIR, 'refine', 'gold_coins.webp');
  files.ui_chunk = join(ASSETS_OUT_DIR, 'refine', 'ore_chunk.webp');
  files.ui_bag = join(ASSETS_OUT_DIR, 'refine', 'bag.webp');
  for (const [name, p] of Object.entries(files)) if (!existsSync(p)) delete files[name];

  console.log(`town 그림: 원본 ${fromRaw}, 처리된 WebP ${fromWebp}${missing.length > 0 ? `, 없음 ${missing.length} (${missing.join(', ')})` : ''}`);
  console.log(`사람: 영웅 예제 ${heroCount}/${HERO_NAMES.length}${heroes === null ? ' (--heroes 없음: 사람 없이 그린다)' : ''}, 드워프 ${files.dwarf !== undefined ? '있음' : '없음'}`);
  console.log(`출력 ${shown(out)} (${png ? 'PNG' : `WebP ${QUALITY}`})\n`);

  mkdirSync(out, { recursive: true });
  const written: string[] = [];
  const TYPES: Record<string, string> = { '.png': 'image/png', '.webp': 'image/webp' };
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/page.js"></script>');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/page.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(readFileSync(join(HERE, 'page.js')));
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/f/')) {
      const p = files[decodeURIComponent(url.pathname.slice(3))];
      if (p === undefined) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
      res.end(readFileSync(p));
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/out/')) {
      const name = decodeURIComponent(url.pathname.slice(5)).replace(/[^A-Za-z0-9_.-]/g, '_');
      const dir = url.searchParams.get('dir') === 'debug' ? join(out, 'debug') : out;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        mkdirSync(dir, { recursive: true });
        const buf = Buffer.concat(chunks);
        writeFileSync(join(dir, name), buf);
        written.push(`${shown(join(dir, name))} ${kb(buf.length)}`);
        res.writeHead(200);
        res.end('ok');
      });
      return;
    }
    res.writeHead(404);
    res.end();
  };
  const server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('HTTP 서버 주소를 얻지 못했다');
  const base = `http://127.0.0.1:${address.port}`;

  const chrome = await launchChrome({ chromePath: args.get('chrome'), tmpDir: args.get('tmp') });
  try {
    await chrome.evaluate(`location.href = ${JSON.stringify(`${base}/`)}; 1`);
    for (let i = 0; ; i++) {
      await new Promise((r) => setTimeout(r, 100));
      let ok = false;
      try {
        ok = await chrome.evaluate<boolean>(
          `location.href.startsWith(${JSON.stringify(base)}) && document.readyState === 'complete' && typeof run === 'function'`,
        );
      } catch {
        ok = false; // 페이지를 옮기는 동안에는 계산이 실패할 수 있다
      }
      if (ok) break;
      if (i >= 100) throw new Error('합성 페이지가 10초 안에 열리지 않았다');
    }
    // 없는 그림을 쓰는 자리와 칸은 빼고 그린다 (사람 없이, 이전 판 없이).
    const have = (k: string): boolean => files[k] !== undefined;
    const skipped = config.items.filter((it) => !have(it.key)).map((it) => it.key);
    const cfg = {
      ...config,
      mode: args.has('grid') ? 'grid' : 'full',
      debug: args.has('debug'),
      items: config.items.filter((it) => have(it.key)),
      sheet: config.sheet.map((g) => ({ ...g, items: g.items.filter((it) => have(it.key)) })).filter((g) => g.items.length > 0),
      band: have(config.band.key) ? config.band : null,
      rebuild,
      output: png ? { type: 'image/png', ext: '.png' } : { type: 'image/webp', quality: QUALITY, ext: '.webp' },
      fullMaxH: png ? 0 : FULL_MAX_H,
    };
    if (skipped.length > 0) console.log(`그림이 없어 뺀 자리 ${skipped.length}: ${[...new Set(skipped)].join(', ')}\n`);
    const started = Date.now();
    const r = await chrome.evaluate<{ W: number; H: number; n?: number; overview?: number[]; diag?: unknown }>(`run(${JSON.stringify(cfg)})`);
    if (args.has('debug') && r.diag !== undefined) {
      mkdirSync(join(out, 'debug'), { recursive: true });
      writeFileSync(join(out, 'debug', 'diag.json'), JSON.stringify(r.diag, null, 1));
      written.push(shown(join(out, 'debug', 'diag.json')));
    }
    console.log(`지도 ${r.W}x${r.H}${r.n !== undefined ? `, 놓은 그림 ${r.n}` : ''}, ${((Date.now() - started) / 1000).toFixed(1)}초`);
    for (const w of written) console.log(`  ${w}`);
  } finally {
    await chrome.close();
    server.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
