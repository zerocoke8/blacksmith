// 마을 지도 그림을 미리 굽는다 (기획서 9장, docs/mockups/town/README.md '게임에서').
//   node tools/art/town/bake.ts [--quality 0.92] [--chrome <크롬 경로>] [--tmp <임시 폴더>]
// 게임은 지도를 열 때 그림을 가공하지 않고 여기서 구운 결과만 읽는다 (src/render/town/baked.ts).
// 합성기(page.js)의 단계를 처리된 WebP에 그대로 한다: 구워진 그림자를 떼어 바닥 한 장에 모으고,
// 탑을 쌓고, 작은 소품·사람에 바깥 잉크를 덧그리고, 모두 지도 해상도(지도 1 px = 그림 1 px)로 줄인다.
// 쓰는 곳: src/assets/art/town-map/<이름>.webp 와 map.json (어디에 서는지, 무엇으로 구웠는지의 해시).
//
// 다시 구울 때: docs/mockups/town/layout.json, src/assets/art/{town,heroes}의 그림이나 meta.json,
// 손님 키(src/render/town/layout.ts GUESTS.height), 굽는 코드(bake-map.ts, pixels.ts)를 바꾼 뒤.
// 앞의 셋이 바뀌었는데 굽지 않으면 tools/art/town/bake.test.ts가 실패한다.
//
// 굽는 코드는 브라우저 canvas가 필요해서 Vite 개발 서버(이미 쓰는 devDependency)로 bake-page.ts를 열고
// 헤드리스 크롬(../chrome.ts)에서 돌린다. 새 패키지는 없다. 같은 그림과 같은 크롬이면 같은 결과가 나온다.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { launchChrome } from '../chrome.ts';
import { kb, parseArgv, REPO_ROOT } from '../common.ts';
import { BAKED_DIR, BAKED_MANIFEST, bakeSourcesHash } from './sources.ts';

/** WebP 품질. 낙서풍의 굵은 선이 번지지 않을 만큼 [튜닝]. */
const QUALITY = 0.92;
const PAGE = '/__town-bake/';

function usage(): string {
  return 'node tools/art/town/bake.ts [--quality 0.92] [--chrome <크롬 경로>] [--tmp <임시 폴더>]';
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2), { valued: ['quality', 'chrome', 'tmp'], switches: ['help'] });
  if (args.has('help') || args.positional.length > 0) {
    console.log(usage());
    if (args.positional.length > 0) process.exitCode = 1;
    return;
  }
  const quality = Number(args.get('quality') ?? QUALITY);
  if (!(quality > 0 && quality <= 1)) throw new Error('--quality는 0보다 크고 1 이하');
  const tmpBase = args.get('tmp') ?? tmpdir();
  mkdirSync(tmpBase, { recursive: true });
  // 다 구워진 뒤에만 town-map을 바꾼다 (도중에 멈추면 이전 결과가 그대로 남는다).
  const stage = mkdtempSync(join(tmpBase, 'town-bake-'));

  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'GET' && url.pathname === PAGE) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><meta charset="utf-8"><body><script type="module" src="/tools/art/town/bake-page.ts"></script>');
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith(`${PAGE}out/`)) {
      const name = decodeURIComponent(url.pathname.slice(`${PAGE}out/`.length)).replace(/[^A-Za-z0-9_.-]/g, '_');
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        writeFileSync(join(stage, name), Buffer.concat(chunks));
        res.writeHead(200);
        res.end('ok');
      });
      return;
    }
    next();
  };

  const vite = await createServer({
    root: REPO_ROOT,
    configFile: false,
    logLevel: 'warn',
    clearScreen: false,
    appType: 'custom',
    server: { host: '127.0.0.1', port: 5431, strictPort: false, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'town-bake', configureServer: (server) => void server.middlewares.use(handle) }],
  });
  let chrome: Awaited<ReturnType<typeof launchChrome>> | null = null;
  try {
    await vite.listen();
    const base = vite.resolvedUrls?.local[0]?.replace(/\/$/, '');
    if (base === undefined) throw new Error('Vite 서버 주소를 얻지 못했다');
    chrome = await launchChrome({ chromePath: args.get('chrome'), tmpDir: args.get('tmp') });
    await chrome.evaluate(`location.href = ${JSON.stringify(`${base}${PAGE}`)}; 1`);
    for (let i = 0; ; i++) {
      await new Promise((r) => setTimeout(r, 100));
      let ok = false;
      try {
        ok = await chrome.evaluate<boolean>(`typeof window.__bakeTown === 'function'`);
      } catch {
        ok = false; // 페이지를 옮기는 동안에는 계산이 실패할 수 있다
      }
      if (ok) break;
      if (i >= 300) throw new Error('굽는 페이지가 30초 안에 열리지 않았다');
    }
    const started = Date.now();
    const r = await chrome.evaluate<{ manifest: Record<string, unknown>; ms: Record<string, number>; sizes: Record<string, number> }>(
      `window.__bakeTown(${quality})`,
    );
    const manifest = { ...r.manifest, sources: bakeSourcesHash() };
    // Map px to 1/10000: plenty for placing, and the file stays readable.
    const round = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v);
    writeFileSync(join(stage, 'map.json'), `${JSON.stringify(manifest, round, 1)}\n`);

    // town-map을 새 결과로 바꾼다 (이전 파일은 지운다).
    mkdirSync(BAKED_DIR, { recursive: true });
    for (const f of readdirSync(BAKED_DIR)) rmSync(join(BAKED_DIR, f), { force: true });
    for (const f of readdirSync(stage)) renameSync(join(stage, f), join(BAKED_DIR, f));

    const sizes = Object.entries(r.sizes).sort((a, b) => b[1] - a[1]);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    console.log(`구웠다: 그림 ${sizes.length}장 ${kb(total)} (품질 ${quality}), ${((Date.now() - started) / 1000).toFixed(1)}초`);
    console.log(`  단계 ms: ${Object.entries(r.ms).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}`);
    console.log(`  큰 것: ${sizes.slice(0, 6).map(([k, n]) => `${k} ${kb(n)}`).join(', ')}`);
    console.log(`  ${BAKED_MANIFEST}`);
  } finally {
    await chrome?.close();
    await vite.close();
    rmSync(stage, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exitCode = 1;
});
