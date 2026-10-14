// 그림 여러 장을 한 장의 비교 시트로 붙인다 (헤드리스 크롬 canvas, npm 패키지 없음).
//   node tools/sheet.ts <그림 또는 폴더>... --out <sheet.png|.webp|.jpg> [--cols 6] [--tile 200] [--bg #f6ebd5]
//        [--title 글] [--trim] [--same-scale | --canvas-scale] [--labels a,b,c] [--no-labels] [--all] [--quality 0.9] [--chrome PATH]
// 원래 게임에서는 새 그림을 기준 드워프·세트 기준 그림과 나란히 놓고 보았다 (첫 칸에 기준을 둔다):
//   node tools/sheet.ts ref/d_dwarf_idle.png ref/hero_vail.png raw/characters --trim --canvas-scale --out check.png
//
//   --trim          투명 여백을 잘라 내고 놓는다 (원본 PNG는 여백이 크다)
//   --same-scale    모든 그림을 한 배율로 (가장 큰 그림이 칸에 맞게). 픽셀 그대로의 크기를 견줄 때 (다듬은 WebP끼리).
//                   없으면 그림마다 칸에 맞춘다 (작은 그림은 2배까지 키운다).
//   --canvas-scale  --same-scale처럼 한 배율로 놓되, 먼저 그림마다 캔버스 짧은 변을 1024로 환산한다.
//                   Codex 원본끼리 '틀 안의 크기'를 견줄 때 쓴다: 1024x1024를 부탁해 1254x1254로 나온 그림이
//                   1024 그림보다 약 22% 크게 보이지 않는다 (1024x1536 세로 캔버스는 그대로).
//   --labels a,b,c  칸 이름을 직접 준다 (쉼표로, 그림 순서대로). 없으면 파일 이름이고,
//                   이름이 겹치면(ref/hero_vail.png와 raw/characters/hero_vail.png) 겹치지 않을 때까지 폴더 이름을 앞에 붙인다.
//   --all           폴더에서 버린 판(<key>.rejected*.png)·옛 화풍·후보도 넣는다
//   --cols N        한 줄의 칸 수 (기본 6),  --tile PX  칸 크기 (기본 200),  --bg  바탕색 (기본 크림 #f6ebd5)
// 출력 형식은 --out의 확장자로 정한다 (.png, .webp, .jpg).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { launchChrome } from './chrome.ts';
import { kb, parseArgv } from './common.ts';

const SKIPPED = /\.(rejected\d*|painterly|try\d*)\.png$/i;
const MIME: Record<string, string> = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

interface Loaded {
  readonly w: number;
  readonly h: number;
}

/**
 * 크롬 안: 그림 하나를 불러(잘라) 칸 크기의 두 배까지 줄여 globalThis.__sheet에 쌓는다. 바깥 이름을 쓰지 않는다.
 * canvasNorm이면 쌓아 두는 크기(w, h)를 '캔버스 짧은 변 1024' 단위로 적는다 (--canvas-scale).
 */
async function pageLoad(dataUrl: string, trim: boolean, store: number, canvasNorm: boolean): Promise<Loaded> {
  const g = globalThis as unknown as { __sheet?: { c: OffscreenCanvas; w: number; h: number }[] };
  g.__sheet ??= [];
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  let sx = 0;
  let sy = 0;
  let sw = bmp.width;
  let sh = bmp.height;
  if (trim) {
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d', { willReadFrequently: true });
    if (x === null) throw new Error('canvas 2d를 얻지 못했다');
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, sw, sh).data;
    let x0 = sw;
    let y0 = sh;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < sh; y++) {
      for (let xx = 0; xx < sw; xx++) {
        if ((d[(y * sw + xx) * 4 + 3] ?? 0) >= 8) {
          if (xx < x0) x0 = xx;
          if (xx > x1) x1 = xx;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= 0) {
      sx = x0;
      sy = y0;
      sw = x1 - x0 + 1;
      sh = y1 - y0 + 1;
    }
  }
  const s = Math.min(1, store / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * s));
  const ch = Math.max(1, Math.round(sh * s));
  // 반씩 줄여 계단 현상을 줄인다.
  let src: CanvasImageSource = bmp;
  let srcW = sw;
  let srcH = sh;
  let ox = sx;
  let oy = sy;
  while (srcW >= cw * 2 && srcH >= ch * 2) {
    const nw = Math.round(srcW / 2);
    const nh = Math.round(srcH / 2);
    const half = new OffscreenCanvas(nw, nh);
    const hx = half.getContext('2d');
    if (hx === null) throw new Error('canvas 2d를 얻지 못했다');
    hx.imageSmoothingQuality = 'high';
    hx.drawImage(src, ox, oy, srcW, srcH, 0, 0, nw, nh);
    src = half;
    srcW = nw;
    srcH = nh;
    ox = 0;
    oy = 0;
  }
  const out = new OffscreenCanvas(cw, ch);
  const ox2 = out.getContext('2d');
  if (ox2 === null) throw new Error('canvas 2d를 얻지 못했다');
  ox2.imageSmoothingQuality = 'high';
  ox2.drawImage(src, ox, oy, srcW, srcH, 0, 0, cw, ch);
  const f = canvasNorm ? 1024 / Math.min(bmp.width, bmp.height) : 1;
  bmp.close();
  g.__sheet.push({ c: out, w: sw * f, h: sh * f });
  return { w: sw, h: sh };
}

interface ComposeOptions {
  readonly cols: number;
  readonly tile: number;
  readonly bg: string;
  readonly title: string;
  readonly labels: readonly string[];
  readonly showLabels: boolean;
  readonly sameScale: boolean;
  readonly type: string;
  readonly quality: number;
}

/** 크롬 안: 쌓아 둔 그림을 격자로 놓고 인코딩한다. */
async function pageCompose(o: ComposeOptions): Promise<{ type: string; b64: string; w: number; h: number }> {
  const g = globalThis as unknown as { __sheet?: { c: OffscreenCanvas; w: number; h: number }[] };
  const items = g.__sheet ?? [];
  const gap = Math.round(o.tile * 0.06);
  const labelH = o.showLabels ? Math.max(14, Math.round(o.tile * 0.09)) : 0;
  const titleH = o.title !== '' ? Math.round(o.tile * 0.2) : 0;
  const cols = Math.min(o.cols, Math.max(1, items.length));
  const rows = Math.ceil(items.length / cols);
  const W = cols * (o.tile + gap) + gap;
  const H = titleH + rows * (o.tile + labelH + gap) + gap;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext('2d');
  if (x === null) throw new Error('canvas 2d를 얻지 못했다');
  x.fillStyle = o.bg;
  x.fillRect(0, 0, W, H);
  x.imageSmoothingQuality = 'high';
  const ink = '#4a3226';
  if (titleH > 0) {
    x.fillStyle = ink;
    x.font = `bold ${Math.round(titleH * 0.5)}px sans-serif`;
    x.textBaseline = 'middle';
    x.fillText(o.title, gap, titleH / 2 + gap / 2);
  }
  const common = Math.min(...items.map((it) => Math.min(o.tile / it.w, o.tile / it.h)));
  items.forEach((it, i) => {
    const cx = gap + (i % cols) * (o.tile + gap);
    const cy = titleH + gap + Math.floor(i / cols) * (o.tile + labelH + gap);
    const s = o.sameScale ? common : Math.min(2, o.tile / it.w, o.tile / it.h);
    const dw = Math.max(1, Math.round(it.w * s));
    const dh = Math.max(1, Math.round(it.h * s));
    // 같은 배율이면 발끝(아래)을 맞추고, 아니면 가운데.
    const dy = o.sameScale ? cy + o.tile - dh : cy + Math.round((o.tile - dh) / 2);
    x.drawImage(it.c, cx + Math.round((o.tile - dw) / 2), dy, dw, dh);
    if (labelH > 0) {
      x.fillStyle = ink;
      x.font = `${Math.round(labelH * 0.8)}px sans-serif`;
      x.textBaseline = 'top';
      x.textAlign = 'center';
      let label = o.labels[i] ?? '';
      while (label.length > 1 && x.measureText(label).width > o.tile) label = `${label.slice(0, -2)}…`;
      x.fillText(label, cx + o.tile / 2, cy + o.tile + 2);
      x.textAlign = 'left';
    }
  });
  const blob = await c.convertToBlob({ type: o.type, quality: o.quality });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  g.__sheet = [];
  return { type: blob.type, b64: btoa(bin), w: W, h: H };
}

/** 칸 이름: 파일 이름. 겹치면 겹치지 않을 때까지 폴더 이름을 하나씩 앞에 붙인다 (ref/hero_vail, characters/hero_vail). */
function labelsFor(files: readonly string[]): string[] {
  const parts = files.map((f) => resolve(f).replace(/\\/g, '/').replace(/\.(png|webp|jpe?g)$/i, '').split('/'));
  const depth = files.map(() => 1);
  const label = (i: number): string => (parts[i] ?? []).slice(-(depth[i] ?? 1)).join('/');
  for (let round = 0; round < 8; round++) {
    const seen = new Map<string, number[]>();
    files.forEach((_, i) => seen.set(label(i), [...(seen.get(label(i)) ?? []), i]));
    const clashes = [...seen.values()].filter((ix) => ix.length > 1);
    if (clashes.length === 0) break;
    for (const ix of clashes) for (const i of ix) depth[i] = Math.min((depth[i] ?? 1) + 1, (parts[i] ?? []).length);
  }
  return files.map((_, i) => label(i));
}

function listInputs(inputs: readonly string[], all: boolean): string[] {
  const files: string[] = [];
  for (const p of inputs) {
    if (!existsSync(p)) throw new Error(`없다: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) {
        if (!/\.(png|webp|jpe?g)$/i.test(f)) continue;
        if (!all && SKIPPED.test(f)) continue;
        files.push(join(p, f));
      }
    } else {
      files.push(p);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2), {
    valued: ['out', 'cols', 'tile', 'bg', 'title', 'labels', 'quality', 'chrome', 'tmp'],
    switches: ['trim', 'same-scale', 'canvas-scale', 'no-labels', 'all', 'help'],
  });
  const outArg = args.get('out');
  if (args.has('help') || args.positional.length === 0 || outArg === undefined) {
    console.log(
      'node tools/sheet.ts <그림 또는 폴더>... --out <sheet.png|.webp|.jpg> [--cols 6] [--tile 200] [--bg #f6ebd5] [--title 글] [--trim] [--same-scale | --canvas-scale] [--labels a,b,c] [--no-labels] [--all]',
    );
    if (!args.has('help')) process.exitCode = 1;
    return;
  }
  const out = resolve(outArg);
  const type = MIME[extname(out).toLowerCase()];
  if (type === undefined) throw new Error(`--out은 .png, .webp, .jpg 가운데 하나: ${outArg}`);
  const files = listInputs(args.positional, args.has('all'));
  if (files.length === 0) throw new Error('그림이 없다');
  const given = args.get('labels')?.split(',').map((s) => s.trim());
  if (given !== undefined && given.length !== files.length) {
    throw new Error(`--labels는 그림 수(${files.length})만큼: ${given.length}개를 받았다`);
  }
  const labels = given ?? labelsFor(files);
  const canvasScale = args.has('canvas-scale');
  const tile = Number(args.get('tile') ?? 200);
  const cols = Number(args.get('cols') ?? 6);
  const quality = Number(args.get('quality') ?? 0.9);
  if (!(tile >= 32 && cols >= 1 && quality > 0 && quality <= 1)) throw new Error('--tile ≥ 32, --cols ≥ 1, 0 < --quality ≤ 1');

  const chrome = await launchChrome({ chromePath: args.get('chrome'), tmpDir: args.get('tmp') });
  try {
    for (const f of files) {
      const mime = MIME[extname(f).toLowerCase()] ?? 'image/png';
      const dataUrl = `data:${mime};base64,${readFileSync(f).toString('base64')}`;
      await chrome.evaluate<Loaded>(`(${pageLoad.toString()})(${JSON.stringify(dataUrl)}, ${args.has('trim')}, ${tile * 2}, ${canvasScale})`);
    }
    const opts: ComposeOptions = {
      cols,
      tile,
      bg: args.get('bg') ?? '#f6ebd5',
      title: args.get('title') ?? '',
      labels,
      showLabels: !args.has('no-labels'),
      sameScale: args.has('same-scale') || canvasScale,
      type,
      quality,
    };
    const r = await chrome.evaluate<{ type: string; b64: string; w: number; h: number }>(`(${pageCompose.toString()})(${JSON.stringify(opts)})`);
    if (r.type !== type) throw new Error(`크롬이 ${type}를 만들지 못했다 (${r.type})`);
    const bytes = Buffer.from(r.b64, 'base64');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bytes);
    console.log(`${files.length}장 → ${out} (${r.w}x${r.h}, ${kb(bytes.length)})`);
  } finally {
    await chrome.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
