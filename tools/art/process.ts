// 원본 PNG를 게임에 넣을 WebP로 다듬는다.
//   node tools/art/process.ts --raw <원본 폴더> [--only key1,scene/key2] [--out <폴더>]
// 읽는 곳: <raw>/<그룹>/<key>.png  (그룹: scene, ui, cards, 키는 tools/art/assets.ts)
// 쓰는 곳: <out>/<그룹>/<key>.webp 와 <out>/meta.json  (기본 out: src/assets/art)
//   - 투명 에셋: 알파 가장자리를 다듬고(알파 레벨, 아래), 투명 여백을 잘라 내고(PAD px 여유),
//     긴 변을 max에 맞춰 줄인다.
//     알파 레벨: ALPHA_CUT 미만은 0, ALPHA_SOLID 이상은 255, 그 사이는 0~255로 고르게 편다.
//     Codex가 뽑은 그림은 몸통 알파가 252~253이라(1% 비친다) 꽉 채우고, 캔버스 전체에 깔린
//     옅은 잡티(알파 1~7)는 지운다. 잡티를 두면 여백이 거의 잘리지 않는다.
//   - 불투명 에셋(배경, 카드 일러스트): 줄이기만 한다. 알파가 섞여 있으면 검은 바탕에 눌러 붙이고 알린다.
//   - 줄일 때는 반씩 여러 번 줄이고 마지막에 크기를 맞춘다. 키우지는 않는다.
//   - WebP 품질 0.85, 알파 유지. 디코딩·축소·인코딩은 헤드리스 크롬의 canvas가 한다 (chrome.ts, 새 패키지 없음).
// 원본 PNG가 없는 키는 건너뛰고 목록을 알린다.
//
// meta.json: { "<그룹>": { "<key>": { w, h, scale, alpha, trim: { x, y, w, h, ow, oh } } } }
//   w, h    결과 WebP 크기 (px)
//   trim    원본 PNG(ow × oh) 안에서 남긴 사각형. 불투명 에셋은 원본 전체.
//   scale   결과 px / 원본 px (≈ w / trim.w). 원본 좌표로 되돌리거나 자세끼리 크기를 맞출 때 쓴다.
//   alpha   결과에 투명한 곳이 있는가
// 키는 그룹 안에서만 겹치지 않는다 (bellows, quench는 scene과 cards에 다 있다).
// 이번에 처리하지 않은 키의 항목은 그대로 둔다 (--only로 몇 개만 다시 처리해도 된다).
//
// Options:
//   --raw DIR       원본 폴더 (기본: OS 임시 폴더/blacksmith-art/raw, gen.ts --out의 기본값과 같다)
//   --only LIST     이 키만 (쉼표로, 'key' 또는 '그룹/key')
//   --out DIR       출력 폴더 (기본 src/assets/art)
//   --quality Q     WebP 품질 0~1 (기본 0.85)
//   --chrome PATH   크롬 실행 파일 (기본: CHROME_PATH, 그다음 흔한 설치 위치)
//   --tmp DIR       크롬 임시 프로필을 만들 곳 (기본: OS 임시 폴더). 끝나면 지운다.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ART_ASSETS, ART_GROUPS, type ArtAsset, type ArtGroup, assetId } from './assets.ts';
import { type Chrome, launchChrome } from './chrome.ts';
import { ASSETS_OUT_DIR, DEFAULT_RAW_DIR, kb, parseArgv, readImageHead, selectAssets } from './common.ts';

/** 알파(0~255)가 이보다 작으면 완전히 투명하게 비운다. 캔버스에 깔린 잡티가 여백을 넓히지 않게. */
const ALPHA_CUT = 8;
/** 알파가 이 이상이면 완전히 불투명하게 채운다. 몸통이 살짝 비치지 않게. */
const ALPHA_SOLID = 240;
/** 잘라 낸 사각형 둘레에 남길 여유 (px). */
const PAD = 2;
const DEFAULT_QUALITY = 0.85;
/** 다시 뽑으면서 버린 판: <key>.rejected1.png, <key>.rejected2.png … */
const REJECTED = /\.rejected\d*\.png$/i;

export interface ArtTrim {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 원본 PNG 크기 */
  readonly ow: number;
  readonly oh: number;
}

export interface ArtMetaEntry {
  readonly w: number;
  readonly h: number;
  readonly scale: number;
  readonly alpha: boolean;
  readonly trim: ArtTrim;
}

export type ArtMeta = Record<ArtGroup, Record<string, ArtMetaEntry>>;

// ── 크롬 페이지 안에서 도는 부분 ─────────────────────────────────────────────

interface PageOptions {
  readonly transparent: boolean;
  readonly max: number;
  readonly quality: number;
  readonly alphaCut: number;
  readonly alphaSolid: number;
  readonly pad: number;
}

interface PageResult {
  readonly ow: number;
  readonly oh: number;
  readonly trim: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly w: number;
  readonly h: number;
  /** 원본에 알파 < 255인 픽셀이 있었나 */
  readonly sourceAlpha: boolean;
  /** 알파 레벨로 완전히 비운 옅은 픽셀 수 */
  readonly cleared: number;
  /** 알파 레벨로 알파가 바뀐 나머지 픽셀 수 (대부분 꽉 채운 몸통) */
  readonly leveled: number;
  /** 결과에서 완전히 투명한 픽셀의 비율 */
  readonly clearRatio: number;
  /** 반씩 줄인 횟수 */
  readonly halvings: number;
  /** 인코딩된 형식. image/webp가 아니면 크롬이 WebP를 못 만든 것이다. */
  readonly type: string;
  readonly b64: string;
}

/**
 * 크롬 페이지 안에서 돈다. toString()으로 보내므로 바깥의 이름(import, 상수)을 쓰면 안 된다.
 * 디코딩 → (투명이면) 알파 레벨·여백 자르기 / (불투명인데 알파가 있으면) 검은 바탕에 붙이기
 * → 반씩 줄이기 → 마지막 크기 맞추기 → WebP.
 */
async function pageProcess(dataUrl: string, o: PageOptions): Promise<PageResult> {
  type Surface = { readonly c: OffscreenCanvas; readonly x: OffscreenCanvasRenderingContext2D };
  const surface = (w: number, h: number): Surface => {
    const c = new OffscreenCanvas(w, h);
    const x = c.getContext('2d', { willReadFrequently: true });
    if (x === null) throw new Error('canvas 2d를 얻지 못했다');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    return { c, x };
  };

  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const ow = bmp.width;
  const oh = bmp.height;
  const src = surface(ow, oh);
  src.x.drawImage(bmp, 0, 0);
  bmp.close();
  const img = src.x.getImageData(0, 0, ow, oh);
  const d = img.data;

  // 알파 레벨: cut 미만 → 0, solid 이상 → 255, 사이는 고르게 편다.
  const span = o.alphaSolid - o.alphaCut;
  const level = (a: number): number =>
    a < o.alphaCut ? 0 : a >= o.alphaSolid ? 255 : Math.round(((a - o.alphaCut) * 255) / span);
  let sourceAlpha = false;
  let cleared = 0;
  let leveled = 0;
  let minX = ow;
  let minY = oh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const i = (y * ow + x) * 4;
      let a = d[i + 3] ?? 0;
      if (a < 255) sourceAlpha = true;
      if (o.transparent && a > 0 && a < 255) {
        const na = level(a);
        if (na === 0) {
          d[i] = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          cleared++;
        } else if (na !== a) {
          leveled++;
        }
        d[i + 3] = na;
        a = na;
      }
      if (a === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  let cur = src;
  let trim = { x: 0, y: 0, w: ow, h: oh };
  if (o.transparent) {
    if (maxX < 0) throw new Error('완전히 투명한 그림이다');
    if (cleared > 0 || leveled > 0) src.x.putImageData(img, 0, 0);
    const x0 = Math.max(0, minX - o.pad);
    const y0 = Math.max(0, minY - o.pad);
    const x1 = Math.min(ow, maxX + 1 + o.pad);
    const y1 = Math.min(oh, maxY + 1 + o.pad);
    trim = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (trim.w !== ow || trim.h !== oh) {
      const crop = surface(trim.w, trim.h);
      crop.x.drawImage(src.c, x0, y0, trim.w, trim.h, 0, 0, trim.w, trim.h);
      cur = crop;
    }
  } else if (sourceAlpha) {
    const flat = surface(ow, oh);
    flat.x.fillStyle = '#000';
    flat.x.fillRect(0, 0, ow, oh);
    flat.x.drawImage(src.c, 0, 0);
    cur = flat;
  }

  const s = Math.min(1, o.max / Math.max(trim.w, trim.h));
  const w = Math.max(1, Math.round(trim.w * s));
  const h = Math.max(1, Math.round(trim.h * s));
  let cw = trim.w;
  let ch = trim.h;
  let halvings = 0;
  while (cw >= w * 2 && ch >= h * 2) {
    const nw = Math.round(cw / 2);
    const nh = Math.round(ch / 2);
    const next = surface(nw, nh);
    next.x.drawImage(cur.c, 0, 0, nw, nh);
    cur = next;
    cw = nw;
    ch = nh;
    halvings++;
  }
  if (cw !== w || ch !== h) {
    const fin = surface(w, h);
    fin.x.drawImage(cur.c, 0, 0, w, h);
    cur = fin;
  }

  let clearRatio = 0;
  if (o.transparent) {
    const fd = cur.x.getImageData(0, 0, w, h).data;
    let clear = 0;
    for (let i = 3; i < fd.length; i += 4) if (fd[i] === 0) clear++;
    clearRatio = clear / (w * h);
  }

  const out = await cur.c.convertToBlob({ type: 'image/webp', quality: o.quality });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { ow, oh, trim, w, h, sourceAlpha, cleared, leveled, clearRatio, halvings, type: out.type, b64: btoa(bin) };
}

// ── Node 쪽 ─────────────────────────────────────────────────────────────

interface Done {
  readonly asset: ArtAsset;
  readonly entry: ArtMetaEntry;
  readonly bytes: number;
}

function usage(): string {
  return [
    'node tools/art/process.ts --raw <원본 폴더> [--only key1,scene/key2] [--out <폴더>]',
    '  [--quality 0.85] [--chrome <크롬 경로>] [--tmp <임시 폴더>]',
  ].join('\n');
}

function emptyMeta(): ArtMeta {
  return { scene: {}, ui: {}, cards: {} };
}

function readMeta(file: string): ArtMeta {
  const meta = emptyMeta();
  if (!existsSync(file)) return meta;
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Record<string, Record<string, ArtMetaEntry>>>;
  for (const g of ART_GROUPS) Object.assign(meta[g], parsed[g] ?? {});
  return meta;
}

/** 키마다 한 줄. 그룹 순서와 매니페스트 순서를 지켜 바뀐 곳만 diff에 보이게. */
function formatMeta(meta: ArtMeta): string {
  const groups = ART_GROUPS.map((g) => {
    const rows = ART_ASSETS.filter((a) => a.group === g && meta[g][a.key] !== undefined).map(
      (a) => `    ${JSON.stringify(a.key)}: ${JSON.stringify(meta[g][a.key])}`,
    );
    return rows.length === 0 ? `  ${JSON.stringify(g)}: {}` : `  ${JSON.stringify(g)}: {\n${rows.join(',\n')}\n  }`;
  });
  return `{\n${groups.join(',\n')}\n}\n`;
}

async function processOne(chrome: Chrome, a: ArtAsset, file: string, outDir: string, quality: number, warn: (m: string) => void): Promise<Done> {
  const id = assetId(a);
  const buf = readFileSync(file);
  const head = readImageHead(buf);
  if (head === null || head.format !== 'png') throw new Error('PNG가 아니다');
  if (a.transparent && !head.alpha) {
    warn(`${id}: 투명 에셋인데 원본 PNG에 알파 채널이 없다 (배경째 들어간다). 다시 뽑아야 한다.`);
  }
  const opts: PageOptions = {
    transparent: a.transparent,
    max: a.max,
    quality,
    alphaCut: ALPHA_CUT,
    alphaSolid: ALPHA_SOLID,
    pad: PAD,
  };
  const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  const r = await chrome.evaluate<PageResult>(`(${pageProcess.toString()})(${JSON.stringify(dataUrl)}, ${JSON.stringify(opts)})`);
  if (r.type !== 'image/webp') throw new Error(`크롬이 WebP를 만들지 못했다 (${r.type})`);
  const webp = Buffer.from(r.b64, 'base64');
  const outHead = readImageHead(webp);
  if (outHead === null || outHead.format !== 'webp' || outHead.w !== r.w || outHead.h !== r.h) {
    throw new Error('만든 WebP의 머리가 맞지 않는다');
  }
  if (a.transparent && head.alpha && r.clearRatio < 0.01) {
    warn(`${id}: 투명 에셋인데 결과에 투명한 곳이 거의 없다 (${(r.clearRatio * 100).toFixed(1)}%). 배경이 남았는지 봐야 한다.`);
  }
  if (a.transparent && head.alpha && !outHead.alpha && r.clearRatio > 0) {
    throw new Error('투명한 곳이 있는데 WebP에 알파가 빠졌다');
  }
  if (!a.transparent && r.sourceAlpha) {
    warn(`${id}: 불투명 에셋인데 원본에 투명한 곳이 있어 검은 바탕에 붙였다.`);
  }

  mkdirSync(join(outDir, a.group), { recursive: true });
  writeFileSync(join(outDir, a.group, `${a.key}.webp`), webp);
  const entry: ArtMetaEntry = {
    w: r.w,
    h: r.h,
    scale: Math.round((r.w / r.trim.w) * 10000) / 10000,
    alpha: outHead.alpha,
    trim: { ...r.trim, ow: r.ow, oh: r.oh },
  };
  const trimText = a.transparent ? `잘라 ${r.trim.w}x${r.trim.h}@${r.trim.x},${r.trim.y}` : '자르지 않음';
  const alphaText = outHead.alpha ? `알파 (투명 ${(r.clearRatio * 100).toFixed(0)}%)` : '불투명';
  const extra = r.cleared + r.leveled > 0 ? `, 알파 다듬음 (비움 ${r.cleared}, 고침 ${r.leveled})` : '';
  console.log(
    `  ${id.padEnd(28)} ${`${r.ow}x${r.oh}`.padStart(9)} → ${trimText.padEnd(26)} → ${`${r.w}x${r.h}`.padStart(9)}` +
      `  ${kb(webp.length).padStart(9)}  ${alphaText}${extra}`,
  );
  return { asset: a, entry, bytes: webp.length };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgv(argv, { valued: ['raw', 'only', 'out', 'quality', 'chrome', 'tmp'], switches: ['help'] });
  if (args.has('help') || args.positional.length > 0) {
    console.log(usage());
    if (args.positional.length > 0) process.exitCode = 1;
    return;
  }
  const raw = resolve(args.get('raw') ?? DEFAULT_RAW_DIR);
  const out = resolve(args.get('out') ?? ASSETS_OUT_DIR);
  const quality = Number(args.get('quality') ?? DEFAULT_QUALITY);
  if (!(quality > 0 && quality <= 1)) throw new Error(`--quality는 0보다 크고 1 이하: ${args.get('quality')}`);
  if (!existsSync(raw)) throw new Error(`원본 폴더가 없다: ${raw}`);
  const only = args.get('only');
  const assets = only === undefined ? ART_ASSETS : selectAssets(only);

  const todo: { asset: ArtAsset; file: string }[] = [];
  const missing: ArtAsset[] = [];
  for (const a of assets) {
    const file = join(raw, a.group, `${a.key}.png`);
    if (existsSync(file)) todo.push({ asset: a, file });
    else missing.push(a);
  }
  // 매니페스트에 없는 PNG (이름 오타 등). 버린 판(<key>.rejected1.png …)은 셈하지 않는다.
  const known = new Set(ART_ASSETS.map(assetId));
  const strays: string[] = [];
  let rejected = 0;
  if (only === undefined) {
    for (const g of ART_GROUPS) {
      const dir = join(raw, g);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.toLowerCase().endsWith('.png')) continue;
        if (REJECTED.test(f)) {
          rejected++;
          continue;
        }
        if (!known.has(`${g}/${f.slice(0, -4)}`)) strays.push(`${g}/${f}`);
      }
    }
  }

  console.log(`원본 ${raw}`);
  console.log(`출력 ${out}`);
  console.log(`처리 ${todo.length}개, 원본 없음 ${missing.length}개, WebP 품질 ${quality}\n`);

  const warnings: string[] = [];
  const failures: string[] = [];
  const done: Done[] = [];
  if (todo.length > 0) {
    const chrome = await launchChrome({ chromePath: args.get('chrome'), tmpDir: args.get('tmp') });
    try {
      for (const { asset, file } of todo) {
        try {
          done.push(await processOne(chrome, asset, file, out, quality, (m) => warnings.push(m)));
        } catch (e) {
          const msg = `${assetId(asset)}: ${e instanceof Error ? e.message : String(e)}`;
          failures.push(msg);
          console.log(`  ${assetId(asset).padEnd(28)} 실패: ${msg}`);
        }
      }
    } finally {
      await chrome.close();
    }
  }

  if (done.length > 0) {
    const metaFile = join(out, 'meta.json');
    const meta = readMeta(metaFile);
    for (const { asset, entry } of done) meta[asset.group][asset.key] = entry;
    // 매니페스트에서 빠졌거나 WebP가 없어진 항목은 지운다.
    for (const g of ART_GROUPS) {
      for (const key of Object.keys(meta[g])) {
        if (!known.has(`${g}/${key}`) || !existsSync(join(out, g, `${key}.webp`))) {
          delete meta[g][key];
          warnings.push(`meta.json에서 ${g}/${key}를 지웠다 (매니페스트에 없거나 WebP가 없다)`);
        }
      }
    }
    writeFileSync(metaFile, formatMeta(meta));
    const total = done.reduce((s, d) => s + d.bytes, 0);
    const shown = relative(process.cwd(), metaFile);
    console.log(`\n${done.length}개를 썼다, 합계 ${kb(total)}. ${shown.startsWith('..') ? metaFile : shown}`);
  }

  if (missing.length > 0) {
    console.log(`\n원본 PNG가 없어 건너뛴 키 (${missing.length}):`);
    for (const g of ART_GROUPS) {
      const keys = missing.filter((a) => a.group === g).map((a) => a.key);
      if (keys.length > 0) console.log(`  ${g}: ${keys.join(', ')}`);
    }
  }
  if (rejected > 0) console.log(`\n버린 판 ${rejected}장은 건너뛰었다 (<key>.rejected*.png).`);
  if (strays.length > 0) console.log(`\n매니페스트에 없는 PNG (처리하지 않았다): ${strays.join(', ')}`);
  if (warnings.length > 0) console.log(`\n알림:\n${warnings.map((w) => `  - ${w}`).join('\n')}`);
  if (failures.length > 0) {
    console.log(`\n실패 ${failures.length}개.`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
