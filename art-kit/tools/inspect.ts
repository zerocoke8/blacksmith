// 뽑은 원본 PNG를 검사한다 (npm 패키지 없이 node:zlib로 디코딩).
//   node tools/inspect.ts <png 또는 폴더>... [--json]
// 한 장마다: 크기, 알파 채널, 투명·가장자리 반투명·옅은 잡티 비율, 몸통 알파, 네 모서리 알파, 그림 상자와 여백, 외곽선 굵기.
// 원래 게임에서 그림마다 돌린 검사 스크립트(check.mjs, lw.mjs, halo.mjs)를 하나로 모았다.
//
// 읽는 법:
//   alpha      투명 에셋이면 'RGBA'여야 한다 (PNG 색 형식 6). 'RGB'면 배경째 나온 것이다: 다시 뽑는다.
//   corners    네 모서리의 알파. 투명 에셋이면 0,0,0,0. 아니면 배경이 남았을 수 있다.
//   투명       알파 0의 비율.
//   가장자리   알파 9~239의 비율: 외곽선 바깥의 부드러운 테 (보통 1~2%). 크면 반투명 구멍이나 흐린 그림자가 있는지 본다.
//   잡티       알파 1~8의 옅은 잡티 비율. Codex 그림은 캔버스 전체에 깔린다. process.ts가 지운다 (걱정할 것 없음).
//              검은 바탕 뷰어에서 그림 둘레가 갈색으로 번져 보이는 것이 이것과 알파 0 아래 남은 색이다. 해롭지 않다.
//   몸통 알파  불투명한 몸통의 알파 (240~255 가운데 가장 흔한 값. Codex는 보통 252~254로 1~2% 비친다). process.ts가 255로 채운다.
//              그래서 Codex 원본은 몸통 전체가 '255 미만'이다. 가장자리 비율에는 몸통(240 이상)을 넣지 않는다.
//   margins    그림 상자(알파 ≥ 9, process.ts가 남기는 픽셀과 같다) 바깥 여백 px (왼·위·오른·아래). 0에 가까우면 잘렸는지 본다.
//   outline    짙은 외곽선 픽셀이 가로·세로로 이어지는 길이의 중앙값(p75) px, 그리고 '짧은 변 1024 환산' 값
//              (= 중앙값 × 1024 ÷ 캔버스의 짧은 변). Codex는 1024x1024를 부탁해도 1254x1254로 낼 때가 많아,
//              캔버스 크기가 다른 그림끼리는 환산 값으로 비교한다. 1024x1536·1536x1024는 짧은 변이 1024라 환산 값 = 원래 값.
//              같은 세트끼리, 그리고 기준 그림(ref/d_dwarf_idle.png)이나 세트 기준 그림과 비교한다.
//              원래 게임에서는 세트 기준보다 2px 넘게 가늘면(예: 12 대 14, 11 대 15) 버리고 다시 뽑았다.
//              짙은 갈색(대략 r<110, g<90, b<80)만 세므로, 검은 무늬·짙은 털이 많은 그림에서는 크게 나올 수 있다.
// WebP는 크기와 알파만 알린다 (디코딩하지 않는다).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { parseArgv, readImageHead, shortPath } from './common.ts';

interface Decoded {
  readonly w: number;
  readonly h: number;
  /** RGBA 8비트 */
  readonly px: Uint8Array;
  readonly hasAlpha: boolean;
}

/** 8비트 RGB(2)·RGBA(6), 비월(interlace) 아닌 PNG만. 나머지는 null. */
function decodePng(buf: Buffer): Decoded | null {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const depth = buf[24];
  const ct = buf[25];
  const interlace = buf[28];
  if (depth !== 8 || (ct !== 2 && ct !== 6) || interlace !== 0) return null;
  const bpp = ct === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  for (let p = 8; p + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)] ?? 0;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? (cur[x - bpp] ?? 0) : 0;
      const up = prev[x] ?? 0;
      const c = x >= bpp ? (prev[x - bpp] ?? 0) : 0;
      let v = line[x] ?? 0;
      if (ft === 1) v += a;
      else if (ft === 2) v += up;
      else if (ft === 3) v += (a + up) >> 1;
      else if (ft === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - up);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      px[o] = cur[x * bpp] ?? 0;
      px[o + 1] = cur[x * bpp + 1] ?? 0;
      px[o + 2] = cur[x * bpp + 2] ?? 0;
      px[o + 3] = bpp === 4 ? (cur[x * bpp + 3] ?? 0) : 255;
    }
    prev = cur;
  }
  return { w, h, px, hasAlpha: ct === 6 };
}

interface Report {
  readonly file: string;
  readonly w: number;
  readonly h: number;
  readonly alpha: string;
  readonly transparentPct?: number;
  readonly partialPct?: number;
  readonly faintPct?: number;
  readonly bodyAlpha?: number;
  readonly corners?: readonly number[];
  readonly bbox?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly margins?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly outline?: { readonly median: number; readonly p75: number; readonly at1024: number };
  readonly warnings: readonly string[];
}

const pct = (n: number, d: number): number => Math.round((1000 * n) / d) / 10;

function inspect(file: string): Report {
  const buf = readFileSync(file);
  const head = readImageHead(buf);
  const name = basename(file);
  if (head === null) return { file: name, w: 0, h: 0, alpha: '?', warnings: ['PNG도 WebP도 아니다'] };
  if (head.format === 'webp') return { file: name, w: head.w, h: head.h, alpha: head.alpha ? 'WebP+알파' : 'WebP', warnings: [] };
  const dec = decodePng(buf);
  const ct = buf[25] ?? 0;
  const alphaName = ct === 6 ? 'RGBA' : ct === 2 ? 'RGB' : ct === 4 ? '회색+알파' : ct === 3 ? '팔레트' : '회색';
  if (dec === null) {
    return { file: name, w: head.w, h: head.h, alpha: alphaName, warnings: ['8비트 RGB/RGBA가 아니거나 비월 PNG라 픽셀은 검사하지 않았다'] };
  }
  const { w, h, px } = dec;
  const n = w * h;
  let transparent = 0;
  let partial = 0;
  let faint = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const bodyHist = new Uint32Array(16);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * 4 + 3] ?? 0;
      if (a === 0) transparent++;
      else if (a >= 9 && a < 240) partial++;
      if (a >= 1 && a <= 8) faint++;
      if (a >= 240) bodyHist[a - 240] = (bodyHist[a - 240] ?? 0) + 1;
      if (a >= 9) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  let bodyAlpha = 255;
  let best = -1;
  for (let i = 0; i < 16; i++) {
    if ((bodyHist[i] ?? 0) > best) {
      best = bodyHist[i] ?? 0;
      bodyAlpha = 240 + i;
    }
  }
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ].map(([x, y]) => px[((y ?? 0) * w + (x ?? 0)) * 4 + 3] ?? 0);

  // 외곽선: 짙은 갈색 픽셀이 이어지는 길이 (2줄마다 가로·세로, 3~59px만).
  const dark = (x: number, y: number): boolean => {
    const i = (y * w + x) * 4;
    return (px[i + 3] ?? 0) > 128 && (px[i] ?? 255) < 110 && (px[i + 1] ?? 255) < 90 && (px[i + 2] ?? 255) < 80;
  };
  const runs: number[] = [];
  for (let y = 0; y < h; y += 2) {
    let r = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && dark(x, y)) r++;
      else {
        if (r > 2 && r < 60) runs.push(r);
        r = 0;
      }
    }
  }
  for (let x = 0; x < w; x += 2) {
    let r = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && dark(x, y)) r++;
      else {
        if (r > 2 && r < 60) runs.push(r);
        r = 0;
      }
    }
  }
  runs.sort((a, b) => a - b);
  const q = (k: number): number => runs[Math.floor(runs.length * k)] ?? 0;
  const median = q(0.5);

  const warnings: string[] = [];
  const empty = maxX < 0;
  const bbox = empty ? undefined : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const margins = empty ? undefined : { left: minX, top: minY, right: w - 1 - maxX, bottom: h - 1 - maxY };
  if (!dec.hasAlpha) warnings.push('알파 채널이 없다: 투명 에셋이면 다시 뽑는다 (불투명 에셋이면 괜찮다)');
  if (dec.hasAlpha && corners.some((a) => a > 0)) warnings.push('모서리가 투명하지 않다: 배경이 남았거나 그림이 가장자리에 닿았다');
  if (dec.hasAlpha && empty) warnings.push('완전히 투명하다');
  if (dec.hasAlpha && margins !== undefined && Math.min(margins.left, margins.top, margins.right, margins.bottom) < Math.round(Math.min(w, h) * 0.01)) {
    warnings.push('그림이 가장자리에 거의 닿았다: 잘렸는지 본다');
  }
  if (dec.hasAlpha && transparent < n * 0.01) warnings.push('투명한 곳이 거의 없다: 배경이 칠해졌는지 본다');
  if (runs.length < 50) warnings.push('짙은 갈색 외곽선이 거의 없다: 외곽선 색이 다르거나(검정·회색) 선이 너무 가늘다');
  return {
    file: name,
    w,
    h,
    alpha: alphaName,
    transparentPct: pct(transparent, n),
    partialPct: pct(partial, n),
    faintPct: pct(faint, n),
    bodyAlpha,
    corners,
    ...(bbox !== undefined ? { bbox } : {}),
    ...(margins !== undefined ? { margins } : {}),
    outline: { median, p75: q(0.75), at1024: Math.round(((median * 1024) / Math.min(w, h)) * 10) / 10 },
    warnings,
  };
}

function listInputs(inputs: readonly string[]): string[] {
  const files: string[] = [];
  for (const p of inputs) {
    if (!existsSync(p)) throw new Error(`없다: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) if (/\.(png|webp)$/i.test(f)) files.push(join(p, f));
    } else {
      files.push(p);
    }
  }
  return files;
}

function main(): void {
  const args = parseArgv(process.argv.slice(2), { valued: [], switches: ['json', 'help'] });
  if (args.has('help') || args.positional.length === 0) {
    console.log('node tools/inspect.ts <png 또는 폴더>... [--json]');
    if (!args.has('help')) process.exitCode = 1;
    return;
  }
  const files = listInputs(args.positional);
  // 파일 이름이 겹치면(ref/hero_vail.png와 raw/characters/hero_vail.png) 경로로 적는다.
  const names = files.map((f) => basename(f));
  const reports = files.map((f, i) => {
    const r = inspect(f);
    return names.filter((n) => n === names[i]).length > 1 ? { ...r, file: shortPath(f) } : r;
  });
  if (args.has('json')) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }
  console.log('읽는 법: 투명 에셋은 RGBA, 모서리 0,0,0,0이어야 한다 · 가장자리 = 알파 9~239 · 잡티 = 알파 1~8 (process.ts가 지운다)');
  console.log('         몸통 알파 252~254는 Codex의 버릇 (process.ts가 255로) · 여백 = 왼/위/오른/아래 px');
  console.log('         외곽선은 "짧은 변 1024 환산" 값끼리 비교한다 (세트 기준보다 2px 넘게 가늘면 다시 뽑았다)\n');
  for (const r of reports) {
    const parts = [`${r.file}`, `${r.w}x${r.h}`, r.alpha];
    if (r.transparentPct !== undefined) {
      parts.push(`투명 ${r.transparentPct}%`, `가장자리 ${r.partialPct}%`, `잡티 ${r.faintPct}%`, `몸통 알파 ${r.bodyAlpha}`, `모서리 ${r.corners?.join(',')}`);
    }
    if (r.bbox !== undefined && r.margins !== undefined) {
      parts.push(`그림 ${r.bbox.w}x${r.bbox.h}`, `여백 ${r.margins.left}/${r.margins.top}/${r.margins.right}/${r.margins.bottom}`);
    }
    if (r.outline !== undefined) parts.push(`외곽선 ${r.outline.median}px (p75 ${r.outline.p75}, 짧은 변 1024 환산 ${r.outline.at1024})`);
    console.log(parts.join('  '));
    for (const wmsg of r.warnings) console.log(`    주의: ${wmsg}`);
  }
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
