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
//   - 키마다 더 하는 일 (assets.ts의 process):
//     edge     불투명 그림의 가장자리 n px 띠를 바로 안쪽 픽셀로 메우고 알파를 모두 불투명으로 한다
//              (Codex 카드의 1px 반투명 테두리·어두운 테두리). 이 띠의 알파는 알리지 않는다.
//     recolor  단색 배경의 색 바꾸기: 가장자리에서 원래 배경색을 읽고, 가장자리에 이어진 배경 영역과
//              그 안에 갇힌 넓은 배경 조각을 새 색으로 옮긴다. 외곽선과 맞닿은 경계 픽셀은 배경이 섞인
//              만큼만 옮긴다. 외곽선과 주제는 그대로 둔다.
//     widen    불투명 그림을 정한 가로÷세로까지 양옆으로 넓힌다. 양옆 가장자리 열의 색(평면 배경)으로 채운다.
//              카드 일러스트(정사각)를 카드 틀의 넓은 그림 창에 덜 잘리게 넣으려고 1.35:1로 넓힌다.
//     alignTo  같은 그룹의 다른 에셋(먼저 처리된)과 같은 자리에: 두 그림의 막대(알파>128에서 가장 넓은
//              줄의 길이, 그 줄 둘레의 밑변)를 맞춰 그 에셋의 원본 좌표에 다시 그리고, 그 에셋과 같은
//              사각형으로 잘라 같은 크기로 줄인다. meta.json의 trim·scale도 그 에셋과 같다.
//              --only로 기준 에셋(iron_hot)만 다시 처리해도 그것에 맞추는 에셋(iron_cracked, iron_cold)을
//              함께 다시 처리한다 (기준이 바뀌면 맞춘 자리도 바뀐다).
//     measure  결과 그림에서 기준점(막대 상자, 갈라진 금, 계기의 불덩이, 카드 틀의 칸)을 재서 meta.json의
//              anchors에 적는다. layout.ts의 손으로 적은 값이 그림과 맞는지 layout.test.ts가 본다.
//   - 줄일 때는 반씩 여러 번 줄이고 마지막에 크기를 맞춘다. 키우지는 않는다.
//   - WebP 품질 0.85, 알파 유지. 디코딩·축소·인코딩은 헤드리스 크롬의 canvas가 한다 (chrome.ts, 새 패키지 없음).
// 원본 PNG가 없는 키는 건너뛰고 목록을 알린다.
//
// meta.json: { "<그룹>": { "<key>": { w, h, scale, alpha, trim: { x, y, w, h, ow, oh }, alignedTo?, anchors? } } }
//   w, h       결과 WebP 크기 (px)
//   trim       원본 PNG(ow × oh) 안에서 남긴 사각형. 불투명 에셋은 원본 전체, widen으로 넓혔으면 x가 음수(덧붙인 폭).
//   scale      결과 px / 원본 px (≈ w / trim.w). 원본 좌표로 되돌리거나 자세끼리 크기를 맞출 때 쓴다.
//   alpha      결과에 투명한 곳이 있는가
//   alignedTo  alignTo로 맞춘 에셋의 키. trim·scale은 그 에셋의 원본 좌표다.
//   anchors    measure로 잰 기준점 (결과 그림의 너비·높이에 대한 비율, assets.ts ArtProcess.measure).
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
/** recolor: 원래 배경색과 이 색 거리(RGB 유클리드) 안이면 배경으로 본다. */
const RECOLOR_TOL = 40;
/** recolor: 가장자리에 이어지지 않은 배경 조각은 이 넓이(그림 넓이에 대한 비율) 이상이고 색이 더 가까워야 바꾼다. */
const POCKET_MIN = 0.0003;
/** 다시 뽑으면서 버린 판: <key>.rejected1.png, <key>.rejected2.png … 옛 화풍: <key>.painterly.png */
const SKIPPED = /\.(rejected\d*|painterly)\.png$/i;

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
  /** alignTo로 맞춘 에셋의 키. trim·scale은 그 에셋의 원본 좌표. */
  readonly alignedTo?: string;
  /** measure로 잰 기준점 (결과 그림의 너비·높이에 대한 비율). */
  readonly anchors?: Record<string, unknown>;
}

export type ArtMeta = Record<ArtGroup, Record<string, ArtMetaEntry>>;

// ── 크롬 페이지 안에서 도는 부분 ─────────────────────────────────────────────

interface PageAlign {
  /** 맞출 에셋의 원본 PNG */
  readonly dataUrl: string;
  /** 그 에셋의 처리 결과: 원본 안의 사각형과 결과 크기 */
  readonly trim: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly w: number;
  readonly h: number;
}

interface PageOptions {
  readonly transparent: boolean;
  readonly max: number;
  readonly quality: number;
  readonly alphaCut: number;
  readonly alphaSolid: number;
  readonly pad: number;
  /** 0이면 하지 않는다 */
  readonly edge: number;
  readonly recolor: { readonly to: readonly [number, number, number]; readonly tol: number; readonly pocketMin: number } | null;
  readonly align: PageAlign | null;
  /** 0이면 하지 않는다: 불투명 그림을 이 가로÷세로까지 양옆으로 넓힌다 */
  readonly widen: number;
  /** 결과 그림에서 잴 기준점 (assets.ts ArtProcess.measure) */
  readonly measure: readonly string[];
}

interface PageResult {
  readonly ow: number;
  readonly oh: number;
  readonly trim: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly w: number;
  readonly h: number;
  /** 원본에 알파 < 255인 픽셀이 있었나 (edge 띠 밖) */
  readonly sourceAlpha: boolean;
  /** 알파 레벨로 완전히 비운 옅은 픽셀 수 */
  readonly cleared: number;
  /** 알파 레벨로 알파가 바뀐 나머지 픽셀 수 (대부분 꽉 채운 몸통) */
  readonly leveled: number;
  /** edge로 메운 픽셀 가운데 반투명이던 것의 수 */
  readonly edgeAlpha: number;
  /** recolor: 읽은 배경색, 바꾼 픽셀 수 (이어진 영역, 갇힌 조각, 경계) */
  readonly recolored: { readonly from: readonly number[]; readonly core: number; readonly pockets: number; readonly ring: number } | null;
  /** alignTo: 배율과 옮긴 거리 (원본 px) */
  readonly aligned: { readonly s: number; readonly dx: number; readonly dy: number } | null;
  /** widen: 왼쪽에 덧붙인 폭 (원본 px), 넓히지 않았으면 0 */
  readonly widened: number;
  /** 결과에서 완전히 투명한 픽셀의 비율 */
  readonly clearRatio: number;
  /** 반씩 줄인 횟수 */
  readonly halvings: number;
  /** measure로 잰 기준점 (결과 그림의 너비·높이에 대한 비율), 재지 못한 것은 빠진다 */
  readonly anchors: Record<string, unknown> | null;
  /** 인코딩된 형식. image/webp가 아니면 크롬이 WebP를 못 만든 것이다. */
  readonly type: string;
  readonly b64: string;
}

/**
 * 크롬 페이지 안에서 돈다. toString()으로 보내므로 바깥의 이름(import, 상수)을 쓰면 안 된다.
 * 디코딩 → (불투명이면) 가장자리 메우기·배경 색 바꾸기 / (투명이면) 알파 레벨
 * → (맞출 에셋이 있으면) 그 자리에 다시 그리기 / (투명이면) 여백 자르기 / (불투명인데 알파가 있으면) 검은 바탕에 붙이기
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
  const load = async (url: string): Promise<Surface> => {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    const s = surface(bmp.width, bmp.height);
    s.x.drawImage(bmp, 0, 0);
    bmp.close();
    return s;
  };

  const src = await load(dataUrl);
  const ow = src.c.width;
  const oh = src.c.height;
  const img = src.x.getImageData(0, 0, ow, oh);
  const d = img.data;
  let dirty = false;

  // 가장자리 메우기: 띠 안의 픽셀은 띠 바로 안쪽 픽셀을 그대로 옮기고, 알파는 모두 불투명으로.
  let edgeAlpha = 0;
  if (!o.transparent && o.edge > 0) {
    const e = o.edge;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const i = (y * ow + x) * 4;
        const inRing = x < e || y < e || x >= ow - e || y >= oh - e;
        if (inRing) {
          if ((d[i + 3] ?? 255) < 255) edgeAlpha++;
          const sx = Math.min(ow - 1 - e, Math.max(e, x));
          const sy = Math.min(oh - 1 - e, Math.max(e, y));
          const j = (sy * ow + sx) * 4;
          d[i] = d[j] ?? 0;
          d[i + 1] = d[j + 1] ?? 0;
          d[i + 2] = d[j + 2] ?? 0;
        }
        d[i + 3] = inRing ? 255 : (d[i + 3] ?? 255);
      }
    }
    dirty = true;
  }

  // 배경 색 바꾸기.
  let recolored: PageResult['recolored'] = null;
  if (!o.transparent && o.recolor !== null) {
    const n = ow * oh;
    // 원래 배경색: 가장자리에서 4px 안쪽 둘레의 중앙값.
    const ring: number[][] = [[], [], []];
    const k = Math.min(4, Math.floor(Math.min(ow, oh) / 4));
    for (let x = k; x < ow - k; x += 3) {
      for (const y of [k, oh - 1 - k]) for (let c = 0; c < 3; c++) ring[c]?.push(d[(y * ow + x) * 4 + c] ?? 0);
    }
    for (let y = k; y < oh - k; y += 3) {
      for (const x of [k, ow - 1 - k]) for (let c = 0; c < 3; c++) ring[c]?.push(d[(y * ow + x) * 4 + c] ?? 0);
    }
    const median = (v: number[]): number => {
      const s = [...v].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)] ?? 0;
    };
    const bg = ring.map(median) as [number, number, number];
    const to = o.recolor.to;
    const tol2 = o.recolor.tol * o.recolor.tol;
    const dist2 = (i: number): number => {
      const r = (d[i] ?? 0) - bg[0];
      const g = (d[i + 1] ?? 0) - bg[1];
      const b = (d[i + 2] ?? 0) - bg[2];
      return r * r + g * g + b * b;
    };
    // 1 = 배경. 가장자리에서 퍼진다.
    const mark = new Uint8Array(n);
    const stack: number[] = [];
    const seed = (p: number) => {
      if (mark[p] === 0 && dist2(p * 4) <= tol2) {
        mark[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < ow; x++) {
      seed(x);
      seed((oh - 1) * ow + x);
    }
    for (let y = 0; y < oh; y++) {
      seed(y * ow);
      seed(y * ow + ow - 1);
    }
    let core = 0;
    const flood = (target: Uint8Array, value: number, limit2: number, out: number[]) => {
      while (stack.length > 0) {
        const p = stack.pop() as number;
        out.push(p);
        const x = p % ow;
        const y = (p - x) / ow;
        const visit = (q: number) => {
          if (target[q] === 0 && dist2(q * 4) <= limit2) {
            target[q] = value;
            stack.push(q);
          }
        };
        if (x > 0) visit(p - 1);
        if (x < ow - 1) visit(p + 1);
        if (y > 0) visit(p - ow);
        if (y < oh - 1) visit(p + ow);
      }
    };
    const joined: number[] = [];
    flood(mark, 1, tol2, joined);
    core = joined.length;
    // 갇힌 배경 조각: 더 가까운 색이고 넓을 때만.
    const pocketTol2 = tol2 * 0.36;
    const minArea = Math.max(64, Math.round(n * o.recolor.pocketMin));
    let pockets = 0;
    for (let p = 0; p < n; p++) {
      if (mark[p] !== 0 || dist2(p * 4) > pocketTol2) continue;
      mark[p] = 2;
      stack.push(p);
      const comp: number[] = [];
      flood(mark, 2, pocketTol2, comp);
      if (comp.length >= minArea) {
        for (const q of comp) mark[q] = 1;
        pockets += comp.length;
      }
    }
    // 바꾸기: 배경은 통째로 옮기고(작은 얼룩은 그대로 남는다), 2px 안의 경계 픽셀은 섞인 만큼만.
    const shift = [to[0] - bg[0], to[1] - bg[1], to[2] - bg[2]];
    let ringN = 0;
    const isBg = (q: number) => mark[q] === 1;
    const out = new Uint8ClampedArray(d);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      if (isBg(p)) {
        for (let c = 0; c < 3; c++) out[i + c] = (d[i + c] ?? 0) + (shift[c] ?? 0);
        continue;
      }
      const x = p % ow;
      const y = (p - x) / ow;
      let near = false;
      let qi = -1;
      let far = -1;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= ow || yy >= oh) continue;
          const q = yy * ow + xx;
          if (isBg(q)) {
            near = true;
          } else {
            const dq = dist2(q * 4);
            if (dq > far) {
              far = dq;
              qi = q * 4;
            }
          }
        }
      }
      if (!near || qi < 0) continue;
      // p ≈ a·배경 + (1−a)·q (q = 둘레에서 배경과 가장 먼 색, 곧 외곽선).
      const v = [(d[i] ?? 0) - (d[qi] ?? 0), (d[i + 1] ?? 0) - (d[qi + 1] ?? 0), (d[i + 2] ?? 0) - (d[qi + 2] ?? 0)];
      const u = [bg[0] - (d[qi] ?? 0), bg[1] - (d[qi + 1] ?? 0), bg[2] - (d[qi + 2] ?? 0)];
      const uu = (u[0] ?? 0) ** 2 + (u[1] ?? 0) ** 2 + (u[2] ?? 0) ** 2;
      if (uu < 1) continue;
      const a = Math.max(0, Math.min(1, ((v[0] ?? 0) * (u[0] ?? 0) + (v[1] ?? 0) * (u[1] ?? 0) + (v[2] ?? 0) * (u[2] ?? 0)) / uu));
      if (a <= 0.02) continue;
      for (let c = 0; c < 3; c++) out[i + c] = (d[i + c] ?? 0) + a * (shift[c] ?? 0);
      ringN++;
    }
    d.set(out);
    dirty = true;
    recolored = { from: bg, core, pockets, ring: ringN };
  }

  // 알파 레벨 (투명 에셋): cut 미만 → 0, solid 이상 → 255, 사이는 고르게 편다.
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
        dirty = true;
      }
      if (a === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (dirty) src.x.putImageData(img, 0, 0);

  let cur = src;
  let widened = 0;
  let trim = { x: 0, y: 0, w: ow, h: oh };
  let fixed: { w: number; h: number } | null = null;
  let aligned: PageResult['aligned'] = null;
  if (o.align !== null) {
    // 막대: 알파>128 픽셀이 가장 많은 줄의 왼끝·오른끝, 그 줄 수의 70%를 넘는 마지막 줄 = 밑변.
    const barOf = (data: Uint8ClampedArray, w: number, h: number) => {
      const count = new Int32Array(h);
      const lo = new Int32Array(h).fill(-1);
      const hi = new Int32Array(h).fill(-1);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if ((data[(y * w + x) * 4 + 3] ?? 0) > 128) {
            if (lo[y] === -1) lo[y] = x;
            hi[y] = x;
            count[y] = (count[y] ?? 0) + 1;
          }
        }
      }
      let best = 0;
      for (let y = 1; y < h; y++) if ((count[y] ?? 0) > (count[best] ?? 0)) best = y;
      let bottom = best;
      for (let y = best; y < h; y++) if ((count[y] ?? 0) > 0.7 * (count[best] ?? 0)) bottom = y;
      return { l: lo[best] ?? 0, r: (hi[best] ?? 0) + 1, bottom: bottom + 1 };
    };
    const ref = await load(o.align.dataUrl);
    const rw = ref.c.width;
    const rh = ref.c.height;
    const rb = barOf(ref.x.getImageData(0, 0, rw, rh).data, rw, rh);
    const sb = barOf(d, ow, oh);
    const s = (rb.r - rb.l) / Math.max(1, sb.r - sb.l);
    const dx = (rb.l + rb.r) / 2 - ((sb.l + sb.r) / 2) * s;
    const dy = rb.bottom - sb.bottom * s;
    const placedS = surface(rw, rh);
    placedS.x.setTransform(s, 0, 0, s, dx, dy);
    placedS.x.drawImage(src.c, 0, 0);
    placedS.x.setTransform(1, 0, 0, 1, 0, 0);
    trim = { ...o.align.trim };
    const crop = surface(trim.w, trim.h);
    crop.x.drawImage(placedS.c, trim.x, trim.y, trim.w, trim.h, 0, 0, trim.w, trim.h);
    cur = crop;
    fixed = { w: o.align.w, h: o.align.h };
    aligned = { s: Math.round(s * 10000) / 10000, dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 };
  } else if (o.transparent) {
    if (maxX < 0) throw new Error('완전히 투명한 그림이다');
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

  // 가로로 넓히기 (불투명): 양옆을 그 옆 가장자리 열의 색(중앙값)으로 채운다. 배경이 평면이라 이음매가 없다.
  if (!o.transparent && o.widen > 0 && ow / oh < o.widen - 1e-3) {
    const nw = Math.round(oh * o.widen);
    const padL = Math.floor((nw - ow) / 2);
    const cd = cur.x.getImageData(0, 0, ow, oh).data;
    const colour = (x: number): string => {
      const ch: number[][] = [[], [], []];
      for (let y = 0; y < oh; y += 2) for (let c = 0; c < 3; c++) ch[c]?.push(cd[(y * ow + x) * 4 + c] ?? 0);
      const m = ch.map((v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0);
      return `rgb(${m.join(',')})`;
    };
    const wide = surface(nw, oh);
    wide.x.fillStyle = colour(0);
    wide.x.fillRect(0, 0, padL + 1, oh);
    wide.x.fillStyle = colour(ow - 1);
    wide.x.fillRect(padL + ow - 1, 0, nw - padL - ow + 1, oh);
    wide.x.drawImage(cur.c, padL, 0);
    cur = wide;
    trim = { x: -padL, y: 0, w: nw, h: oh };
    widened = padL;
  }

  const s = Math.min(1, o.max / Math.max(trim.w, trim.h));
  const w = fixed?.w ?? Math.max(1, Math.round(trim.w * s));
  const h = fixed?.h ?? Math.max(1, Math.round(trim.h * s));
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

  // 기준점 재기 (결과 그림 위에서, 너비·높이에 대한 비율, 소수 셋째 자리).
  let anchors: Record<string, unknown> | null = null;
  if (o.measure.length > 0) {
    const md = cur.x.getImageData(0, 0, w, h).data;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const px = (x: number, y: number) => (y * w + x) * 4;
    const found: Record<string, unknown> = {};
    for (const kind of o.measure) {
      if (kind === 'bar') {
        // 막대: 알파>128 픽셀이 가장 많은 줄의 70%를 넘는 줄들 (반짝이·김은 그보다 좁다).
        const count = new Int32Array(h);
        const lo = new Int32Array(h).fill(-1);
        const hi = new Int32Array(h).fill(-1);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if ((md[px(x, y) + 3] ?? 0) > 128) {
              if (lo[y] === -1) lo[y] = x;
              hi[y] = x;
              count[y] = (count[y] ?? 0) + 1;
            }
          }
        }
        let best = 0;
        for (let y = 1; y < h; y++) if ((count[y] ?? 0) > (count[best] ?? 0)) best = y;
        let y0 = -1;
        let y1 = -1;
        const lefts: number[] = [];
        const rights: number[] = [];
        for (let y = 0; y < h; y++) {
          if ((count[y] ?? 0) <= 0.7 * (count[best] ?? 0)) continue;
          if (y0 < 0) y0 = y;
          y1 = y;
          lefts.push(lo[y] ?? 0);
          rights.push(hi[y] ?? 0);
        }
        // Ends: the middle of the rows' ends (a sparkle beside the bar on a few rows does not count).
        const median = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1] ?? 0;
        if (y0 >= 0) found.bar = { x0: r3(median(lefts) / w), x1: r3((median(rights) + 1) / w), y0: r3(y0 / h), y1: r3((y1 + 1) / h) };
      } else if (kind === 'crack') {
        // 붉은 금: 채도 높은 빨강 픽셀의 x 중앙값.
        const xs: number[] = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = px(x, y);
            const r = md[i] ?? 0;
            if ((md[i + 3] ?? 0) > 200 && r > 150 && r - (md[i + 1] ?? 0) > 60 && r - (md[i + 2] ?? 0) > 60) xs.push(x);
          }
        }
        xs.sort((a, b) => a - b);
        if (xs.length > 0) found.crack = { x: r3((xs[xs.length >> 1] ?? 0) / w) };
      } else if (kind === 'ring') {
        // 안쪽 불덩이: 따뜻한 색(주황·노랑) 픽셀의 상자.
        let x0 = w;
        let x1 = -1;
        let y0 = h;
        let y1 = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = px(x, y);
            const r = md[i] ?? 0;
            const b = md[i + 2] ?? 0;
            if ((md[i + 3] ?? 0) > 200 && r > 200 && (md[i + 1] ?? 0) > 80 && r - b > 90) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
          }
        }
        if (x1 >= 0) found.ring = { cx: r3((x0 + x1 + 1) / 2 / w), cy: r3((y0 + y1 + 1) / 2 / h), r: r3(Math.max(x1 + 1 - x0, y1 + 1 - y0) / 2 / w) };
      } else if (kind === 'frame') {
        // 크림색 칸: 이어진 크림 픽셀 덩어리(그림의 0.2% 이상)의 상자를 자리로 가른다.
        const cream = new Uint8Array(w * h);
        for (let p = 0; p < w * h; p++) {
          const i = p * 4;
          const r = md[i] ?? 0;
          const g = md[i + 1] ?? 0;
          const b = md[i + 2] ?? 0;
          if ((md[i + 3] ?? 0) > 200 && r > 235 && g > 222 && b > 195 && r - b < 50) cream[p] = 1;
        }
        const boxes: { x0: number; x1: number; y0: number; y1: number; n: number }[] = [];
        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        for (let p0 = 0; p0 < w * h; p0++) {
          if (cream[p0] === 0 || seen[p0] === 1) continue;
          seen[p0] = 1;
          stack.push(p0);
          const bx = { x0: w, x1: -1, y0: h, y1: -1, n: 0 };
          while (stack.length > 0) {
            const p = stack.pop() as number;
            const x = p % w;
            const y = (p - x) / w;
            bx.n++;
            bx.x0 = Math.min(bx.x0, x);
            bx.x1 = Math.max(bx.x1, x);
            bx.y0 = Math.min(bx.y0, y);
            bx.y1 = Math.max(bx.y1, y);
            for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
              if (q >= 0 && cream[q] === 1 && seen[q] === 0) {
                seen[q] = 1;
                stack.push(q);
              }
            }
          }
          if (bx.n >= w * h * 0.002) boxes.push(bx);
        }
        const rect = (b: (typeof boxes)[number]) => ({ x: r3(b.x0 / w), y: r3(b.y0 / h), w: r3((b.x1 + 1 - b.x0) / w), h: r3((b.y1 + 1 - b.y0) / h) });
        const mid = (b: (typeof boxes)[number]) => ({ x: (b.x0 + b.x1 + 1) / 2 / w, y: (b.y0 + b.y1 + 1) / 2 / h });
        const biggest = (list: typeof boxes) => list.reduce<(typeof boxes)[number] | null>((a, b) => (a === null || b.n > a.n ? b : a), null);
        const cost = biggest(boxes.filter((b) => mid(b).x < 0.3 && mid(b).y < 0.2 && (b.x1 - b.x0) / Math.max(1, b.y1 - b.y0) < 1.6));
        const name = biggest(boxes.filter((b) => mid(b).y < 0.15 && (b.x1 - b.x0) / w > 0.4));
        const art = biggest(boxes.filter((b) => mid(b).y > 0.15 && mid(b).y < 0.55));
        const text = biggest(boxes.filter((b) => mid(b).y > 0.6));
        const ribbon =
          art !== null && text !== null ? biggest(boxes.filter((b) => b.y0 > art.y1 && b.y1 < text.y0)) : null;
        const out: Record<string, unknown> = {};
        if (cost !== null) out.cost = { cx: r3(mid(cost).x), cy: r3(mid(cost).y), d: r3((cost.x1 + 1 - cost.x0) / w) };
        if (name !== null) out.name = rect(name);
        if (art !== null) out.art = rect(art);
        if (ribbon !== null) out.ribbon = rect(ribbon);
        if (text !== null) out.text = rect(text);
        found.frame = out;
      }
    }
    anchors = found;
  }

  const out = await cur.c.convertToBlob({ type: 'image/webp', quality: o.quality });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    ow,
    oh,
    trim,
    w,
    h,
    sourceAlpha,
    cleared,
    leveled,
    edgeAlpha,
    recolored,
    aligned,
    widened,
    clearRatio,
    halvings,
    anchors,
    type: out.type,
    b64: btoa(bin),
  };
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

/** '#RRGGBB' → [r, g, b]. */
function hexRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`색은 #RRGGBB로: ${hex}`);
  return [parseInt(m[1] ?? '0', 16), parseInt(m[2] ?? '0', 16), parseInt(m[3] ?? '0', 16)];
}

/** 맞출 에셋: 원본 PNG와 그 처리 결과 (이번에 처리했으면 그것, 아니면 meta.json). */
interface AlignRef {
  readonly file: string;
  readonly entry: ArtMetaEntry;
}

async function processOne(
  chrome: Chrome,
  a: ArtAsset,
  file: string,
  outDir: string,
  quality: number,
  warn: (m: string) => void,
  alignRef: AlignRef | null,
): Promise<Done> {
  const id = assetId(a);
  const buf = readFileSync(file);
  const head = readImageHead(buf);
  if (head === null || head.format !== 'png') throw new Error('PNG가 아니다');
  if (a.transparent && !head.alpha) {
    warn(`${id}: 투명 에셋인데 원본 PNG에 알파 채널이 없다 (배경째 들어간다). 다시 뽑아야 한다.`);
  }
  const p = a.process ?? {};
  if (p.alignTo !== undefined && alignRef === null) throw new Error(`맞출 에셋 ${a.group}/${p.alignTo}의 원본이나 처리 결과가 없다`);
  const opts: PageOptions = {
    transparent: a.transparent,
    max: a.max,
    quality,
    alphaCut: ALPHA_CUT,
    alphaSolid: ALPHA_SOLID,
    pad: PAD,
    edge: p.edge ?? 0,
    widen: p.widen ?? 0,
    measure: p.measure ?? [],
    recolor: p.recolor !== undefined ? { to: hexRgb(p.recolor.to), tol: p.recolor.tol ?? RECOLOR_TOL, pocketMin: POCKET_MIN } : null,
    align:
      alignRef !== null
        ? {
            dataUrl: `data:image/png;base64,${readFileSync(alignRef.file).toString('base64')}`,
            trim: { x: alignRef.entry.trim.x, y: alignRef.entry.trim.y, w: alignRef.entry.trim.w, h: alignRef.entry.trim.h },
            w: alignRef.entry.w,
            h: alignRef.entry.h,
          }
        : null,
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
  const entry: ArtMetaEntry =
    alignRef !== null
      ? {
          w: r.w,
          h: r.h,
          scale: alignRef.entry.scale,
          alpha: outHead.alpha,
          trim: alignRef.entry.trim,
          alignedTo: p.alignTo,
          ...(r.anchors !== null ? { anchors: r.anchors } : {}),
        }
      : {
          w: r.w,
          h: r.h,
          scale: Math.round((r.w / r.trim.w) * 10000) / 10000,
          alpha: outHead.alpha,
          trim: { ...r.trim, ow: r.ow, oh: r.oh },
          ...(r.anchors !== null ? { anchors: r.anchors } : {}),
        };
  const trimText =
    r.aligned !== null
      ? `${p.alignTo}에 맞춤 ×${r.aligned.s} (${r.aligned.dx},${r.aligned.dy})`
      : a.transparent
        ? `잘라 ${r.trim.w}x${r.trim.h}@${r.trim.x},${r.trim.y}`
        : r.widened > 0
          ? `양옆 ${r.widened}px 넓힘`
          : '자르지 않음';
  const alphaText = outHead.alpha ? `알파 (투명 ${(r.clearRatio * 100).toFixed(0)}%)` : '불투명';
  const extra = [
    r.cleared + r.leveled > 0 ? `알파 다듬음 (비움 ${r.cleared}, 고침 ${r.leveled})` : '',
    r.edgeAlpha > 0 ? `가장자리 반투명 ${r.edgeAlpha}px 메움` : '',
    r.recolored !== null
      ? `배경 rgb(${r.recolored.from.join(',')})→${p.recolor?.to} (${r.recolored.core}+조각 ${r.recolored.pockets}+경계 ${r.recolored.ring}px)`
      : '',
    r.anchors !== null ? `잼 ${JSON.stringify(r.anchors)}` : '',
  ]
    .filter((x) => x !== '')
    .join(', ');
  console.log(
    `  ${id.padEnd(28)} ${`${r.ow}x${r.oh}`.padStart(9)} → ${trimText.padEnd(26)} → ${`${r.w}x${r.h}`.padStart(9)}` +
      `  ${kb(webp.length).padStart(9)}  ${alphaText}${extra !== '' ? `, ${extra}` : ''}`,
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
  const picked = only === undefined ? ART_ASSETS : selectAssets(only);
  // 고른 에셋에 맞추는(alignTo) 에셋도 함께: 기준이 바뀌면 맞춘 자리도 다시 잡아야 한다. 매니페스트 순서(기준이 먼저).
  const pickedIds = new Set(picked.map(assetId));
  const dependents = ART_ASSETS.filter(
    (a) => !pickedIds.has(assetId(a)) && a.process?.alignTo !== undefined && pickedIds.has(`${a.group}/${a.process.alignTo}`),
  );
  const assets = dependents.length === 0 ? picked : ART_ASSETS.filter((a) => pickedIds.has(assetId(a)) || dependents.includes(a));
  if (dependents.length > 0) {
    console.log(`맞추는 에셋도 함께 다시 처리한다: ${dependents.map((a) => `${assetId(a)} (→ ${a.process?.alignTo})`).join(', ')}`);
  }

  const todo: { asset: ArtAsset; file: string }[] = [];
  const missing: ArtAsset[] = [];
  for (const a of assets) {
    const file = join(raw, a.group, `${a.key}.png`);
    if (existsSync(file)) todo.push({ asset: a, file });
    else missing.push(a);
  }
  // 매니페스트에 없는 PNG (이름 오타 등). 버린 판(<key>.rejected1.png …)과 옛 화풍(<key>.painterly.png)은 셈하지 않는다.
  const known = new Set(ART_ASSETS.map(assetId));
  const strays: string[] = [];
  let skipped = 0;
  if (only === undefined) {
    for (const g of ART_GROUPS) {
      const dir = join(raw, g);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.toLowerCase().endsWith('.png')) continue;
        if (SKIPPED.test(f)) {
          skipped++;
          continue;
        }
        if (!known.has(`${g}/${f.slice(0, -4)}`)) strays.push(`${g}/${f}`);
      }
    }
  }

  console.log(`원본 ${raw}`);
  console.log(`출력 ${out}`);
  console.log(`처리 ${todo.length}개, 원본 없음 ${missing.length}개, WebP 품질 ${quality}\n`);

  const metaFile = join(out, 'meta.json');
  const oldMeta = readMeta(metaFile);
  const warnings: string[] = [];
  const failures: string[] = [];
  const done: Done[] = [];
  if (todo.length > 0) {
    const chrome = await launchChrome({ chromePath: args.get('chrome'), tmpDir: args.get('tmp') });
    try {
      for (const { asset, file } of todo) {
        try {
          // alignTo: 이번에 처리한 결과가 먼저, 없으면 meta.json의 것.
          const to = asset.process?.alignTo;
          let alignRef: AlignRef | null = null;
          if (to !== undefined) {
            const refFile = join(raw, asset.group, `${to}.png`);
            const entry = done.find((x) => x.asset.group === asset.group && x.asset.key === to)?.entry ?? oldMeta[asset.group][to];
            if (existsSync(refFile) && entry !== undefined) alignRef = { file: refFile, entry };
          }
          done.push(await processOne(chrome, asset, file, out, quality, (m) => warnings.push(m), alignRef));
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
  if (skipped > 0) console.log(`\n버린 판과 옛 화풍 ${skipped}장은 건너뛰었다 (<key>.rejected*.png, <key>.painterly.png).`);
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
