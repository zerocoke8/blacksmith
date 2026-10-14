// 원본 PNG를 게임에 넣을 WebP로 다듬는다.
//   node tools/process.ts [--assets <프로젝트 파일>] [--raw <원본 폴더>] [--only key1,objects/key2] [--out <폴더>]
// 읽는 곳: <raw>/<그룹>/<key>.png  (그룹과 키는 프로젝트 파일의 PROJECT_ASSETS와 tools/manifest.ts의 예제)
// 쓰는 곳: <out>/<그룹>/<key>.webp 와 <out>/meta.json
// 무엇을: --only가 있으면 그 키만. 없으면 프로젝트 파일이 있을 때는 프로젝트 그림만(예제는 --only로 부른다),
//         프로젝트 파일이 없으면 키트 예제 모두. 원본이 없는 키는 건너뛴다.
//   - 투명 에셋: 알파 가장자리를 다듬고(알파 레벨, 아래), 투명 여백을 잘라 내고(PAD px 여유),
//     긴 변을 max에 맞춰 줄인다.
//     알파 레벨: ALPHA_CUT 미만은 0, ALPHA_SOLID 이상은 255, 그 사이는 0~255로 고르게 편다.
//     Codex가 뽑은 그림은 몸통 알파가 252~253이라(1% 비친다) 꽉 채우고, 캔버스 전체에 깔린
//     옅은 잡티(알파 1~7)는 지운다. 잡티를 두면 여백이 거의 잘리지 않는다.
//   - 불투명 에셋(배경, 카드 일러스트): 줄이기만 한다. 알파가 섞여 있으면 검은 바탕에 눌러 붙이고 알린다.
//   - 키마다 더 하는 일 (manifest.ts의 process):
//     edge     불투명 그림의 가장자리 n px 띠를 바로 안쪽 픽셀로 메우고 알파를 모두 불투명으로 한다
//              (Codex 카드의 1px 반투명 테두리·어두운 테두리). 이 띠의 알파는 알리지 않는다.
//     recolor  단색 배경의 색 바꾸기: 가장자리에서 원래 배경색을 읽고, 가장자리에 이어진 배경 영역과
//              그 안에 갇힌 넓은 배경 조각을 새 색으로 옮긴다. 외곽선과 맞닿은 경계 픽셀은 배경이 섞인
//              만큼만 옮긴다. 외곽선과 주제는 그대로 둔다.
//     widen    불투명 그림을 정한 가로÷세로까지 양옆으로 넓힌다. 양옆 가장자리 열의 색(평면 배경)으로 채운다.
//   - 줄일 때는 반씩 여러 번 줄이고 마지막에 크기를 맞춘다. 키우지는 않는다.
//   - WebP 품질 0.85, 알파 유지. 디코딩·축소·인코딩은 헤드리스 크롬의 canvas가 한다 (chrome.ts, 새 패키지 없음).
// 원본 PNG가 없는 키는 건너뛰고 목록을 알린다.
//
// 원래 게임의 tools/art/process.ts에서 옮겼다. 그 게임의 공방 화면에만 쓰던 두 기능은 뺐다:
//   alignTo (두 그림의 '막대'를 맞춰 같은 캔버스에 놓기: 달군 쇠 ↔ 갈라진 쇠)와
//   measure (결과 그림에서 막대·금·불덩이·카드 틀 칸의 자리를 재서 meta.json의 anchors에 적기).
//
// meta.json: { "<그룹>": { "<key>": { w, h, scale, alpha, trim: { x, y, w, h, ow, oh }, raw?: { w, h } } } }
//   w, h       결과 WebP 크기 (px)
//   trim       캔버스(ow × oh) 안에서 남긴 사각형. 불투명 에셋은 캔버스 전체, widen으로 넓혔으면 x가 음수(덧붙인 폭).
//              단위는 '요청한 캔버스'(매니페스트의 size)다. Codex는 1024x1024를 부탁해도 1254x1254로 낼 때가 많은데,
//              비율이 같으면 trim을 요청 크기(1024) 단위로 옮겨 적고 실제 원본 크기는 raw에 남긴다.
//              그래야 1024로 나온 그림과 1254로 나온 그림의 trim을 그대로 견줄 수 있다 (그림 자체는 원본 픽셀로 처리한다).
//              비율이 다르면 옮기지 않고(ow·oh = 원본 크기) 알린다.
//   raw        원본 PNG의 실제 크기. 요청 크기와 달랐을 때만 있다. 원본 픽셀 좌표 = trim × raw.w / ow.
//   scale      결과 px / 캔버스 px (≈ w / trim.w). 세트끼리 화면 크기를 맞출 때 쓴다
//              (예: 캐릭터 모두를 trim.h 기준 한 배율로 놓으면 그림 안 키 차이가 그대로 산다).
//   alpha      결과에 투명한 곳이 있는가
// 키는 그룹 안에서만 겹치지 않는다.
// 이번에 처리하지 않은 키의 항목은 그대로 둔다 (--only로 몇 개만 다시 처리해도 된다).
// 매니페스트에서 빠졌거나 WebP가 없는 항목은 지운다.
//
// Options:
//   --assets FILE   프로젝트 파일 (기본: ART_ASSETS_FILE, 없으면 키트 폴더 옆의 art-assets.ts가 있으면 그것)
//   --raw DIR       원본 폴더 (기본: ART_RAW_DIR → 프로젝트 파일의 PROJECT_DIRS.raw → <kit>/raw)
//   --only LIST     이 키만 (쉼표로, 'key' 또는 '그룹/key')
//   --out DIR       출력 폴더 (기본: ART_OUT_DIR → PROJECT_DIRS.out → <kit>/out)
//   --quality Q     WebP 품질 0~1 (기본 0.85)
//   --chrome PATH   크롬 실행 파일 (기본: CHROME_PATH, 그다음 흔한 설치 위치. Edge도 된다)
//   --tmp DIR       크롬 임시 프로필을 만들 곳 (기본: OS 임시 폴더). 끝나면 지운다.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Chrome, launchChrome } from './chrome.ts';
import { type ArtContext, describeContext, kb, loadContext, parseArgv, readImageHead, selectAssets, toolCommand } from './common.ts';
import { type ArtAsset, assetId, parseSize } from './manifest.ts';

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
/** 처리하지 않는 원본: 버린 판 <key>.rejected1.png …, 옛 화풍 <key>.painterly.png, 후보 <key>.try1.png … */
const SKIPPED = /\.(rejected\d*|painterly|try\d*)\.png$/i;

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
  /** 원본 PNG의 실제 크기 (요청한 캔버스와 달랐을 때만) */
  readonly raw?: { readonly w: number; readonly h: number };
}

export type ArtMeta = Record<string, Record<string, ArtMetaEntry>>;

// ── 크롬 페이지 안에서 도는 부분 ─────────────────────────────────────────────

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
  /** 0이면 하지 않는다: 불투명 그림을 이 가로÷세로까지 양옆으로 넓힌다 */
  readonly widen: number;
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
  /** widen: 왼쪽에 덧붙인 폭 (원본 px), 넓히지 않았으면 0 */
  readonly widened: number;
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
 * 디코딩 → (불투명이면) 가장자리 메우기·배경 색 바꾸기 / (투명이면) 알파 레벨
 * → (투명이면) 여백 자르기 / (불투명인데 알파가 있으면) 검은 바탕에 붙이기 → (넓히기)
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
    const core = joined.length;
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
  if (o.transparent) {
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
  return { ow, oh, trim, w, h, sourceAlpha, cleared, leveled, edgeAlpha, recolored, widened, clearRatio, halvings, type: out.type, b64: btoa(bin) };
}

// ── Node 쪽 ─────────────────────────────────────────────────────────────

interface Done {
  readonly asset: ArtAsset;
  readonly entry: ArtMetaEntry;
  readonly bytes: number;
}

function usage(): string {
  return [
    `${toolCommand('process.ts')} [--assets <프로젝트 파일>] [--raw <원본 폴더>] [--only key1,objects/key2] [--out <폴더>]`,
    '  [--quality 0.85] [--chrome <크롬 경로>] [--tmp <임시 폴더>]',
  ].join('\n');
}

function readMeta(file: string, groups: readonly string[]): ArtMeta {
  const meta: ArtMeta = Object.fromEntries(groups.map((g) => [g, {}]));
  if (!existsSync(file)) return meta;
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Record<string, Record<string, ArtMetaEntry>>>;
  // 지금 그룹에 없는 그룹(이름을 바꿨거나 프로젝트 그룹을 뺐다)도 남겨 둔다. 지울지는 아래에서 정한다.
  for (const [g, rows] of Object.entries(parsed)) meta[g] = { ...(meta[g] ?? {}), ...(rows ?? {}) };
  return meta;
}

/** 키마다 한 줄. 그룹 순서와 목록 순서를 지켜 바뀐 곳만 diff에 보이게. */
function formatMeta(meta: ArtMeta, ctx: ArtContext): string {
  const groups = [...ctx.groups, ...Object.keys(meta).filter((g) => !ctx.groups.includes(g))].map((g) => {
    const rows = meta[g] ?? {};
    const order = [...ctx.assets.filter((a) => a.group === g).map((a) => a.key), ...Object.keys(rows).sort()];
    const keys = [...new Set(order)].filter((k) => rows[k] !== undefined);
    const lines = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(rows[k])}`);
    return lines.length === 0 ? `  ${JSON.stringify(g)}: {}` : `  ${JSON.stringify(g)}: {\n${lines.join(',\n')}\n  }`;
  });
  return `{\n${groups.join(',\n')}\n}\n`;
}

/** '#RRGGBB' → [r, g, b]. */
function hexRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`색은 #RRGGBB로: ${hex}`);
  return [parseInt(m[1] ?? '0', 16), parseInt(m[2] ?? '0', 16), parseInt(m[3] ?? '0', 16)];
}

async function processOne(chrome: Chrome, a: ArtAsset, file: string, outDir: string, quality: number, warn: (m: string) => void): Promise<Done> {
  const id = assetId(a);
  const buf = readFileSync(file);
  const head = readImageHead(buf);
  if (head === null || head.format !== 'png') throw new Error('PNG가 아니다');
  if (a.transparent && !head.alpha) {
    warn(`${id}: 투명 에셋인데 원본 PNG에 알파 채널이 없다 (배경째 들어간다). 다시 뽑아야 한다.`);
  }
  const p = a.process ?? {};
  const opts: PageOptions = {
    transparent: a.transparent,
    max: a.max,
    quality,
    alphaCut: ALPHA_CUT,
    alphaSolid: ALPHA_SOLID,
    pad: PAD,
    edge: p.edge ?? 0,
    widen: p.widen ?? 0,
    recolor: p.recolor !== undefined ? { to: hexRgb(p.recolor.to), tol: p.recolor.tol ?? RECOLOR_TOL, pocketMin: POCKET_MIN } : null,
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

  // 캔버스: 요청 크기와 비율이 같고 크기만 다르면(1024x1024 요청 → 1254x1254) trim을 요청 크기 단위로 옮겨 적는다.
  const req = parseSize(a.size);
  const sameSize = r.ow === req.w && r.oh === req.h;
  const sameRatio = Math.abs(r.ow / r.oh - req.w / req.h) < 0.01;
  const fx = !sameSize && sameRatio ? req.w / r.ow : 1;
  const fy = !sameSize && sameRatio ? req.h / r.oh : 1;
  if (!sameSize && !sameRatio) {
    warn(`${id}: 원본 ${r.ow}x${r.oh}가 요청 ${a.size}와 비율이 다르다. trim은 원본 크기 단위로 적었다 (같은 세트와 견주기 어렵다: 다시 뽑는 편이 낫다).`);
  }
  const trim: ArtTrim = {
    x: Math.round(r.trim.x * fx),
    y: Math.round(r.trim.y * fy),
    w: Math.round(r.trim.w * fx),
    h: Math.round(r.trim.h * fy),
    ow: Math.round(r.ow * fx),
    oh: Math.round(r.oh * fy),
  };

  mkdirSync(join(outDir, a.group), { recursive: true });
  writeFileSync(join(outDir, a.group, `${a.key}.webp`), webp);
  const entry: ArtMetaEntry = {
    w: r.w,
    h: r.h,
    scale: Math.round((r.w / trim.w) * 10000) / 10000,
    alpha: outHead.alpha,
    trim,
    ...(fx !== 1 || fy !== 1 ? { raw: { w: r.ow, h: r.oh } } : {}),
  };
  const trimText = a.transparent ? `잘라 ${r.trim.w}x${r.trim.h}@${r.trim.x},${r.trim.y}` : r.widened > 0 ? `양옆 ${r.widened}px 넓힘` : '자르지 않음';
  const alphaText = outHead.alpha ? `알파 (투명 ${(r.clearRatio * 100).toFixed(0)}%)` : '불투명';
  const extra = [
    fx !== 1 || fy !== 1 ? `meta는 요청 ${a.size} 단위` : '',
    r.cleared + r.leveled > 0 ? `알파 다듬음 (비움 ${r.cleared}, 고침 ${r.leveled})` : '',
    r.edgeAlpha > 0 ? `가장자리 반투명 ${r.edgeAlpha}px 메움` : '',
    r.recolored !== null
      ? `배경 rgb(${r.recolored.from.join(',')})→${p.recolor?.to} (${r.recolored.core}+조각 ${r.recolored.pockets}+경계 ${r.recolored.ring}px)`
      : '',
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
  const args = parseArgv(argv, { valued: ['assets', 'raw', 'only', 'out', 'quality', 'chrome', 'tmp'], switches: ['help'] });
  if (args.has('help') || args.positional.length > 0) {
    console.log(usage());
    if (args.positional.length > 0) process.exitCode = 1;
    return;
  }
  const ctx = await loadContext(args);
  const raw = ctx.rawDir;
  const out = ctx.outDir;
  const quality = Number(args.get('quality') ?? DEFAULT_QUALITY);
  if (!(quality > 0 && quality <= 1)) throw new Error(`--quality는 0보다 크고 1 이하: ${args.get('quality')}`);
  console.log(describeContext(ctx, ['raw', 'out']));
  if (!existsSync(raw)) throw new Error(`원본 폴더가 없다: ${raw}`);
  const only = args.get('only');
  const projectOnly = only === undefined && ctx.projectFile !== null;
  const assets =
    only !== undefined ? selectAssets(ctx.assets, only) : projectOnly ? ctx.assets.filter((a) => ctx.projectIds.has(assetId(a))) : ctx.assets;

  const todo: { asset: ArtAsset; file: string }[] = [];
  const missing: ArtAsset[] = [];
  for (const a of assets) {
    const file = join(raw, a.group, `${a.key}.png`);
    if (existsSync(file)) todo.push({ asset: a, file });
    else missing.push(a);
  }
  // 목록에 없는 PNG (이름 오타 등). 버린 판·옛 화풍·후보(SKIPPED)는 셈하지 않는다.
  const known = new Set(ctx.assets.map(assetId));
  const strays: string[] = [];
  const examplesSkipped: string[] = [];
  let skipped = 0;
  if (only === undefined) {
    for (const g of ctx.groups) {
      const dir = join(raw, g);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.toLowerCase().endsWith('.png')) continue;
        if (SKIPPED.test(f)) {
          skipped++;
          continue;
        }
        const id = `${g}/${f.slice(0, -4)}`;
        if (!known.has(id)) strays.push(`${g}/${f}`);
        else if (projectOnly && !ctx.projectIds.has(id)) examplesSkipped.push(id);
      }
    }
  }

  console.log(`처리 ${todo.length}개, 원본 없음 ${missing.length}개, WebP 품질 ${quality}${projectOnly ? ' (프로젝트 그림만. 예제는 --only로)' : ''}\n`);

  const metaFile = join(out, 'meta.json');
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
    const meta = readMeta(metaFile, ctx.groups);
    for (const { asset, entry } of done) (meta[asset.group] ??= {})[asset.key] = entry;
    // 목록에서 빠졌거나 WebP가 없어진 항목은 지운다.
    for (const g of Object.keys(meta)) {
      const rows = meta[g] ?? {};
      for (const key of Object.keys(rows)) {
        if (!known.has(`${g}/${key}`) || !existsSync(join(out, g, `${key}.webp`))) {
          delete rows[key];
          warnings.push(`meta.json에서 ${g}/${key}를 지웠다 (목록에 없거나 WebP가 없다)`);
        }
      }
      if (!ctx.groups.includes(g) && Object.keys(rows).length === 0) delete meta[g];
    }
    writeFileSync(metaFile, formatMeta(meta, ctx));
    const total = done.reduce((s, d) => s + d.bytes, 0);
    const shown = relative(process.cwd(), metaFile);
    console.log(`\n${done.length}개를 썼다, 합계 ${kb(total)}. ${shown.startsWith('..') ? metaFile : shown}`);
  }

  if (missing.length > 0) {
    console.log(`\n원본 PNG가 없어 건너뛴 키 (${missing.length}):`);
    for (const g of ctx.groups) {
      const keys = missing.filter((a) => a.group === g).map((a) => a.key);
      if (keys.length > 0) console.log(`  ${g}: ${keys.join(', ')}`);
    }
  }
  if (examplesSkipped.length > 0) {
    console.log(`\n원본 폴더에 키트 예제의 원본도 있다 (처리하지 않았다. 필요하면 --only로): ${examplesSkipped.join(', ')}`);
  }
  if (skipped > 0) console.log(`\n버린 판·옛 화풍·후보 ${skipped}장은 건너뛰었다 (<key>.rejected*.png, <key>.painterly.png, <key>.try*.png).`);
  if (strays.length > 0) console.log(`\n목록에 없는 PNG (처리하지 않았다): ${strays.join(', ')}`);
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
