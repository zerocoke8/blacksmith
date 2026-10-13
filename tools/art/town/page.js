// 마을 지도 시안의 합성기. 헤드리스 크롬 안에서 돈다 (compose.ts가 작은 HTTP 서버로 이 파일과 그림을 내준다).
// run(config)이 지도를 그리고 결과(그림, layout.json)를 POST로 돌려보낸다. config는 layout.ts + compose.ts가 붙인 것.
// 브라우저에 그대로 보내는 스크립트라 TypeScript가 아니다 (tsc는 tools의 .ts만 본다).
// 수치는 모두 원본 px(생성된 PNG 그대로의 좌표) 기준이다. 처리된 WebP를 쓸 때는 loadImage가 원본 캔버스로 되돌린다.
'use strict';

const INK = '#34231a';
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// 처리된 WebP(src/assets/art/town)를 원본 캔버스(ow x oh)의 trim 자리에 되돌릴 키: { key: { ow, oh, x, y, w, h } }.
let REBUILD = {};
// 내보낼 그림 형식: { type: 'image/webp' | 'image/png', quality, ext }.
let OUT = { type: 'image/png', quality: undefined, ext: '.png' };

function loadImage(name) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('load ' + name));
    i.src = '/f/' + encodeURIComponent(name);
  }).then((img) => {
    const r = REBUILD[name];
    if (!r) return img;
    const c = mk(r.ow, r.oh); ctx(c).drawImage(img, r.x, r.y, r.w, r.h);
    return c;
  });
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function ctx(c) { const g = c.getContext('2d', { willReadFrequently: false }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; return g; }
// 그림은 name + 확장자(OUT.ext)로, 글(layout.json)은 name 그대로. dir 'debug'는 compose.ts가 <out>/debug/에 쓴다.
async function post(name, canvasOrText, dir) {
  const text = typeof canvasOrText === 'string';
  const body = text ? canvasOrText : await new Promise((r) => canvasOrText.toBlob(r, OUT.type, OUT.quality));
  const file = text ? name : name + OUT.ext;
  const res = await fetch('/out/' + encodeURIComponent(file) + (dir ? '?dir=' + dir : ''), { method: 'POST', body });
  if (!res.ok) throw new Error('post ' + file);
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- sprite analysis
const luma = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;

// Splits a generated sprite into (sprite without its baked shadow, shadow mask), crops both to the same frame,
// optionally thickens the outer outline (people: they are drawn very small).
function analyze(img, opt) {
  const W = img.width, H = img.height, N = W * H;
  const c0 = mk(W, H); const g0 = c0.getContext('2d', { willReadFrequently: true }); g0.drawImage(img, 0, 0);
  const id = g0.getImageData(0, 0, W, H); const d = id.data;
  const mark = new Uint8Array(N); // 1 transparent, 2 shadow core, 3 shadow AA
  const info = { shadowPx: 0, comps: [] };
  if (opt.shadow) {
    const q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (d[i * 4 + 3] < 24) { mark[i] = 1; q[qt++] = i; }
    const cand = new Uint8Array(N);
    while (qh < qt) {
      const i = q[qh++]; const x = i % W;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const j of nb) {
        if (j < 0 || j >= N || mark[j] || cand[j]) continue;
        const o = j * 4;
        if (d[o + 3] >= 24 && luma(d[o], d[o + 1], d[o + 2]) > 58) { cand[j] = 1; q[qt++] = j; } // light pixels, incl. the shadow's own soft rim; the ink line (dark) stops the fill
      }
    }
    // connected components of candidates; keep the big ones (small ones are light anti-alias specks)
    const lab = new Int32Array(N); let nl = 0;
    for (let i = 0; i < N; i++) {
      if (!cand[i] || lab[i]) continue;
      nl++; const st = [i]; lab[i] = nl; const px = [];
      while (st.length) { const k = st.pop(); px.push(k); const x = k % W; for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) if (j >= 0 && j < N && cand[j] && !lab[j]) { lab[j] = nl; st.push(j); } }
      if (px.length >= 400) {
        let r = 0, gg = 0, b = 0; for (const k of px) { r += d[k * 4]; gg += d[k * 4 + 1]; b += d[k * 4 + 2]; }
        const mean = [r / px.length, gg / px.length, b / px.length];
        const sat = Math.max(...mean) - Math.min(...mean);
        info.comps.push({ n: px.length, mean: mean.map((v) => v | 0), sat: sat | 0 });
        if (sat < 60) { for (const k of px) mark[k] = 2; info.shadowPx += px.length; info.mean = mean; }
      }
    }
    // absorb the shadow's soft rim
    if (info.shadowPx) {
      const m = info.mean;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < N; i++) {
          if (mark[i] || d[i * 4 + 3] < 1 || d[i * 4 + 3] >= 240) continue;
          const x = i % W; let near = false;
          for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && (mark[j] === 2 || mark[j] === 3)) { near = true; break; }
          if (!near) continue;
          const o = i * 4; const dist = Math.abs(d[o] - m[0]) + Math.abs(d[o + 1] - m[1]) + Math.abs(d[o + 2] - m[2]);
          if (dist < 90) mark[i] = 3;
        }
      }
    }
  }
  // build sprite + shadow images, crop
  const sd = new ImageData(W, H); const hd = new ImageData(W, H);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) {
    const o = i * 4; const a = d[o + 3];
    if (mark[i] === 2 || mark[i] === 3) { hd.data[o + 3] = mark[i] === 2 && a >= 200 ? 255 : a; }
    else { sd.data[o] = d[o]; sd.data[o + 1] = d[o + 1]; sd.data[o + 2] = d[o + 2]; sd.data[o + 3] = a; }
    if (a >= 8 && mark[i] !== 1) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const full = mk(W, H); full.getContext('2d').putImageData(sd, 0, 0);
  let spr = mk(cw, ch); spr.getContext('2d').drawImage(full, -x0, -y0);
  let shd = null;
  if (info.shadowPx) { const fh = mk(W, H); fh.getContext('2d').putImageData(hd, 0, 0); shd = mk(cw, ch); shd.getContext('2d').drawImage(fh, -x0, -y0); }
  let pad = 0;
  if (opt.thicken) {
    const r = opt.thicken; pad = Math.ceil(r) + 2;
    const sil = mk(cw, ch); const gs = sil.getContext('2d'); gs.drawImage(spr, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = INK; gs.fillRect(0, 0, cw, ch);
    const out = mk(cw + pad * 2, ch + pad * 2); const go = out.getContext('2d');
    for (const rr of [r, r * 0.66, r * 0.33]) for (let k = 0; k < 32; k++) { const t = (k / 32) * Math.PI * 2; go.drawImage(sil, pad + Math.cos(t) * rr, pad + Math.sin(t) * rr); }
    go.drawImage(spr, pad, pad);
    spr = out;
    if (shd) { const s2 = mk(cw + pad * 2, ch + pad * 2); s2.getContext('2d').drawImage(shd, pad, pad); shd = s2; }
  }
  // measure the sprite (opaque) bbox, ground line and base width in the cropped frame
  const gd = spr.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, spr.width, spr.height).data;
  const SW = spr.width, SH = spr.height;
  let bx0 = SW, bx1 = -1, by0 = SH, by1 = -1;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (gd[(y * SW + x) * 4 + 3] >= 128) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const bh = by1 - by0 + 1;
  // base: the lowest 12% of the body
  let fx0 = SW, fx1 = -1;
  for (let y = Math.round(by1 - bh * 0.12); y <= by1; y++) for (let x = 0; x < SW; x++) if (gd[(y * SW + x) * 4 + 3] >= 128) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
  return {
    spr, shd, W: SW, H: SH,
    body: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: bh },
    cx: (bx0 + bx1) / 2, gy: by1 + 1,
    base: { x: (fx0 + fx1) / 2, w: fx1 - fx0 + 1 },
    crop: { x: x0 - pad, y: y0 - pad },
    info,
  };
}

function resample(src, s) {
  const tw = Math.max(1, Math.round(src.width * s)), th = Math.max(1, Math.round(src.height * s));
  let c = src, w = src.width, h = src.height;
  while (w / 2 >= tw && h / 2 >= th && w > 2) {
    const nw = Math.round(w / 2), nh = Math.round(h / 2);
    const n = mk(nw, nh); ctx(n).drawImage(c, 0, 0, nw, nh); c = n; w = nw; h = nh;
  }
  if (w !== tw || h !== th) { const n = mk(tw, th); ctx(n).drawImage(c, 0, 0, tw, th); c = n; }
  return { c, sx: tw / src.width, sy: th / src.height };
}

// ---------------------------------------------------------------- endless towers: repeat one storey band
// spec: { top, bot, n, shrink } in source px. Pieces: head [0,top), storey [top,bot), base [bot,H).
// Stacked bottom-up: base (scale 1), n storeys (scale shrink^(k-1)), head (scale of the last storey).
// Every piece is centred on the base's axis.
function rowCenter(d, W, y) {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] >= 128) { if (x0 < 0) x0 = x; x1 = x; }
  return x0 < 0 ? W / 2 : (x0 + x1) / 2;
}
function rowExtent(d, W, y) {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] >= 128) { if (x0 < 0) x0 = x; x1 = x; }
  return { c: (x0 + x1) / 2, w: x1 - x0 + 1 };
}
// The cuts go through plain wall (top = above a window, bot = top + one ring-to-ring period), so windows, sills
// and rings stay whole. Each storey is drawn as a cone in the source (narrower at its top); the storey is warped
// row by row so its wall goes from wb*shrink (top) to wb (bottom), then storey k is scaled by shrink^k: the wall
// outline runs on without steps, tapering a little per storey. Pieces are drawn top-down; each storey's OV extra
// rows above its cut fade in over the storey above (cross-fade, hides small tone differences at the join).
function stackTower(img, sp) {
  const W = img.width, H = img.height, OV = 10;
  const c0 = mk(W, H); const g0 = c0.getContext('2d', { willReadFrequently: true }); g0.drawImage(img, 0, 0);
  const d = g0.getImageData(0, 0, W, H).data;
  const ea = rowExtent(d, W, sp.top), eb = rowExtent(d, W, sp.bot - 1);
  const uh = sp.bot - sp.top, s = sp.shrink;
  const wall = (r) => ea.w + (eb.w - ea.w) * (r - sp.top) / (uh - 1);
  const cen = (r) => ea.c + (eb.c - ea.c) * (r - sp.top) / (uh - 1);
  const want = (r) => eb.w * (s + (1 - s) * (r - sp.top) / (uh - 1));
  // the warped storey (with OV extra rows on top), axis at x = W/2
  const U = mk(W, uh + OV); const gu = ctx(U);
  for (let i = 0; i < uh + OV; i++) {
    const r = sp.top - OV + i; const f = want(r) / wall(r);
    gu.globalAlpha = i < OV ? (i + 1) / (OV + 1) : 1; // the overlap rows fade in: a soft cross-fade over the join
    gu.drawImage(c0, 0, r, W, 1, W / 2 - cen(r) * f, i, W * f, 1);
  }
  const sc = []; for (let k = 0; k < sp.n; k++) sc.push(Math.pow(s, k));
  const hs = (eb.w * Math.pow(s, sp.n)) / ea.w; // head scale: its bottom meets the last storey's top
  const cHead = rowExtent(d, W, sp.top - 1).c;
  const base = H - sp.bot;
  const total = base + sc.reduce((a, k) => a + k * uh, 0) + hs * sp.top;
  const out = mk(W, Math.ceil(total) + 2); const g = ctx(out);
  const ax = rowExtent(d, W, sp.bot).c; // the base's axis (the base is drawn unscaled, unshifted)
  // positions bottom-up, then draw top-down
  const pos = []; let y = out.height - base;
  for (const k of sc) { y -= uh * k; pos.push({ y, k }); }
  const yHead = y - hs * sp.top;
  g.drawImage(c0, 0, 0, W, sp.top, ax - cHead * hs, yHead, W * hs, hs * sp.top);
  for (let i = pos.length - 1; i >= 0; i--) { const { y: yy, k } = pos[i]; g.drawImage(U, 0, 0, W, uh + OV, ax - (W / 2) * k, yy - OV * k, W * k, (uh + OV) * k); }
  g.drawImage(c0, 0, sp.bot - OV, W, base + OV, 0, out.height - base - OV, W, base + OV);
  return out;
}

// ---------------------------------------------------------------- assets
const A = {};
const IMG = {};
let CFG = null;
async function asset(key, opt) {
  if (A[key]) return A[key];
  let img = IMG[key] ?? (IMG[key] = await loadImage(key));
  if (CFG && CFG.stack && CFG.stack[key]) img = stackTower(img, CFG.stack[key]);
  A[key] = analyze(img, opt);
  A[key].img = img;
  return A[key];
}
function kindOf(key) {
  if (key.startsWith('bld_') || key.startsWith('tower_')) return 'building';
  if (key.startsWith('prop_')) return 'prop';
  return 'person';
}

// ---------------------------------------------------------------- clouds
// (a) puff clusters drawn in the generated band's palette: blue-grey body, near-white top, thick ink rim.
function drawPuffs(g, puffs, spec) {
  const t = spec.line;
  g.save();
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = t * 2; g.lineJoin = 'round';
  for (const p of puffs) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.stroke(); g.fill(); }
  g.fillStyle = spec.under;
  for (const p of puffs) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
  // the white tops: each puff's own circle, shifted up, clipped to the union of the puffs
  const W = g.canvas.width, H = g.canvas.height;
  const top = mk(W, H); const gt = top.getContext('2d');
  gt.fillStyle = spec.top;
  for (const p of puffs) { gt.beginPath(); gt.arc(p.x - p.r * 0.06, p.y - p.r * 0.2, p.r * 0.86, 0, Math.PI * 2); gt.fill(); }
  // divider line between white and blue-grey (thin ink, like the band's)
  const ln = mk(W, H); const gl = ln.getContext('2d');
  gl.strokeStyle = INK; gl.lineWidth = Math.max(2, t * 0.55);
  for (const p of puffs) { gl.beginPath(); gl.arc(p.x - p.r * 0.06, p.y - p.r * 0.2, p.r * 0.86, Math.PI * 0.15, Math.PI * 0.85); gl.stroke(); }
  gl.globalCompositeOperation = 'destination-out'; gl.drawImage(top, 0, 0); // only the part of the divider outside the white
  const mask = mk(W, H); const gm = mask.getContext('2d'); gm.fillStyle = '#000';
  for (const p of puffs) { gm.beginPath(); gm.arc(p.x, p.y, p.r - 1, 0, Math.PI * 2); gm.fill(); }
  const both = mk(W, H); const gb = both.getContext('2d');
  gb.drawImage(top, 0, 0); gb.drawImage(ln, 0, 0);
  gb.globalCompositeOperation = 'destination-in'; gb.drawImage(mask, 0, 0);
  g.drawImage(both, 0, 0);
  g.restore();
}
function puffRow(spec, W) {
  const R = rng(spec.seed ?? 7); const puffs = [];
  for (let x = -40; x < W + 60; x += spec.step * (0.75 + R() * 0.5)) puffs.push({ x, y: spec.y + (R() - 0.5) * spec.jit, r: spec.r * (0.7 + R() * 0.55) });
  return puffs;
}
// (b) the generated band, tiled across the width; every other tile mirrored so the seams always meet.
function drawBand(g, img, spec, W) {
  const sh = spec.srcH ?? img.height;
  const src = mk(img.width, sh); src.getContext('2d').drawImage(img, 0, 0);
  const s = spec.h / sh; const tw = img.width * s;
  const r = resample(src, s).c;
  let i = 0;
  for (let x = spec.x0 ?? 0; x < W; x += tw - (spec.overlap ?? 0), i++) {
    g.save(); g.translate(x + (i % 2 ? tw : 0), spec.y); g.scale(i % 2 ? -1 : 1, 1); g.drawImage(r, 0, 0, tw, spec.h); g.restore();
  }
}

// ---------------------------------------------------------------- dirt paths from the doors to the roads
// fill = road sand colour; ink outline only where the path crosses grass, so the fill can open the road's outline.
function drawPaths(g, W, H, paths, st) {
  if (!paths || !paths.length) return;
  const base = g.getImageData(0, 0, W, H); const d = base.data;
  const grass = new ImageData(W, H); const gd = grass.data;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (gg > r + 6 && gg > b + 6) gd[i + 3] = 255; }
  const gm = mk(W, H); gm.getContext('2d').putImageData(grass, 0, 0);
  const trace = (gg, p) => {
    gg.beginPath(); const pts = p.pts; gg.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) gg.lineTo(pts[1][0], pts[1][1]);
    else { for (let k = 1; k < pts.length - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; gg.quadraticCurveTo(pts[k][0], pts[k][1], k === pts.length - 2 ? pts[k + 1][0] : mx, k === pts.length - 2 ? pts[k + 1][1] : my); } }
  };
  const ink = mk(W, H); const gi = ink.getContext('2d'); gi.lineCap = 'round'; gi.lineJoin = 'round'; gi.strokeStyle = st.ink;
  for (const p of paths) { gi.lineWidth = p.w + st.line * 2; trace(gi, p); gi.stroke(); }
  // keep the ink only on grass, and never inside any path's own fill
  gi.globalCompositeOperation = 'destination-in'; gi.drawImage(gm, 0, 0);
  g.drawImage(ink, 0, 0);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = st.fill;
  for (const p of paths) { g.lineWidth = p.w; trace(g, p); g.stroke(); }
  // a few pebble dots, like the roads
  const R = rng(st.seed ?? 5); g.fillStyle = st.dot;
  for (const p of paths) for (let k = 0; k < (p.dots ?? 2); k++) {
    const a = p.pts[0], b = p.pts[p.pts.length - 1]; const t = 0.3 + R() * 0.4;
    g.beginPath(); g.ellipse(a[0] + (b[0] - a[0]) * t + (R() - 0.5) * p.w * 0.4, a[1] + (b[1] - a[1]) * t + (R() - 0.5) * p.w * 0.3, 7, 5, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// Thin the ground's dark-brown ink lines by r px on each side, on the upscaled picture (smooth contours).
// Every ink pixel finds its nearest non-ink pixel (two-pass nearest-seed propagation); within r it takes the
// fill colour found a few px beyond that seed (past the anti-alias rim), blended over the last px for a soft edge.
// Grass tufts (green), water (blue), sand pebbles and the cliff fill are lighter or not brown, so never ink.
function thinInk(c, r) {
  const W = c.width, H = c.height, N = W * H;
  const g = c.getContext('2d', { willReadFrequently: true });
  const im = g.getImageData(0, 0, W, H); const d = im.data;
  const ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const o = i * 4, R = d[o], G = d[o + 1], B = d[o + 2]; const L = R * 0.3 + G * 0.59 + B * 0.11; const cliff = Math.abs(R - 162) < 16 && Math.abs(G - 142) < 16 && Math.abs(B - 125) < 16; ink[i] = L < 162 && R >= G - 2 && B <= R + 10 && !cliff ? 1 : 0; }
  const sx = new Int32Array(N).fill(-1), sy = new Int32Array(N), dist = new Float64Array(N).fill(1e12);
  for (let i = 0; i < N; i++) if (!ink[i]) { sx[i] = i % W; sy[i] = (i / W) | 0; dist[i] = 0; }
  const relax = (i, j, x, y) => { if (sx[j] < 0) return; const dx = x - sx[j], dy = y - sy[j], dd = dx * dx + dy * dy; if (dd < dist[i]) { dist[i] = dd; sx[i] = sx[j]; sy[i] = sy[j]; } };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) { const i = y * W + x; if (!ink[i]) continue; if (x > 0) relax(i, i - 1, x, y); if (y > 0) { relax(i, i - W, x, y); if (x > 0) relax(i, i - W - 1, x, y); if (x < W - 1) relax(i, i - W + 1, x, y); } }
    for (let x = W - 2; x >= 0; x--) { const i = y * W + x; if (ink[i]) relax(i, i + 1, x, y); }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!ink[i]) continue; if (x < W - 1) relax(i, i + 1, x, y); if (y < H - 1) { relax(i, i + W, x, y); if (x < W - 1) relax(i, i + W + 1, x, y); if (x > 0) relax(i, i + W - 1, x, y); } }
    for (let x = 1; x < W; x++) { const i = y * W + x; if (ink[i]) relax(i, i - 1, x, y); }
  }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < N; i++) {
    if (!ink[i] || sx[i] < 0) continue;
    const dd = Math.sqrt(dist[i]); const t = Math.min(1, r + 0.5 - dd); if (t <= 0) continue;
    const x = i % W, y = (i / W) | 0; const vx = sx[i] - x, vy = sy[i] - y; const len = Math.hypot(vx, vy) || 1;
    let px = sx[i], py = sy[i];
    for (const step of [3, 2, 1]) { const qx = Math.round(sx[i] + (vx / len) * step), qy = Math.round(sy[i] + (vy / len) * step); if (qx >= 0 && qy >= 0 && qx < W && qy < H && !ink[qy * W + qx]) { px = qx; py = qy; break; } }
    const j = (py * W + px) * 4, o = i * 4;
    for (let k = 0; k < 3; k++) out[o + k] = d[o + k] * (1 - t) + d[j + k] * t;
  }
  im.data.set(out); g.putImageData(im, 0, 0);
}

// unsharp mask (the ground is upscaled from 1024 px; this puts back some of the crispness of its edges)
function sharpen(c, amount, radius) {
  const W = c.width, H = c.height; const g = c.getContext('2d', { willReadFrequently: true });
  const src = g.getImageData(0, 0, W, H);
  const b = mk(W, H); const gb = b.getContext('2d', { willReadFrequently: true }); gb.filter = `blur(${radius}px)`; gb.drawImage(c, 0, 0);
  const bl = gb.getImageData(0, 0, W, H).data; const d = src.data;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k] + amount * (d[i + k] - bl[i + k]); d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
  g.putImageData(src, 0, 0);
}

// ---------------------------------------------------------------- the map
async function groundCanvas(cfg) {
  const ground = IMG[cfg.ground] ?? (IMG[cfg.ground] = await loadImage(cfg.ground));
  const gs = cfg.groundScale;
  const GW = Math.round(ground.width * gs), GH = Math.round(ground.height * gs);
  const W = GW, H = cfg.sky + GH + (cfg.bottomPad ?? 0);
  const map = mk(W, H); const g = ctx(map);
  g.fillStyle = cfg.skyColor; g.fillRect(0, 0, W, cfg.sky + 4);
  const gc = mk(GW, GH); ctx(gc).drawImage(ground, 0, 0, GW, GH);
  if (cfg.thin) thinInk(gc, cfg.thin.r);
  if (cfg.sharpen) sharpen(gc, cfg.sharpen.amount, cfg.sharpen.radius);
  g.drawImage(gc, 0, cfg.sky);
  return { map, g, W, H };
}

async function buildMap(cfg) {
  const { map, g, W, H } = await groundCanvas(cfg);
  drawPaths(g, W, H, cfg.paths, cfg.pathStyle);
  // a low cloud bank lying on the far edge of the plateau (behind the towers), hides the ground's top cut
  if (cfg.horizon) drawPuffs(g, puffRow(cfg.horizon, W), cfg.cloudStyle);

  // resolve items
  const placed = [];
  for (const it of cfg.items) {
    const kind = kindOf(it.key);
    const a = await asset(it.key, { shadow: kind !== 'person', thicken: kind === 'person' ? (it.key === 'dwarf' ? cfg.people.dwarfLine : cfg.people.line) : (cfg.lines[it.key] ?? 0) });
    let s;
    if (it.s) s = it.s;
    else if (it.rel) s = cfg.F * it.rel;
    else if (it.h) s = it.h / a.body.h;
    else if (kind === 'person') s = it.key === 'dwarf' ? cfg.people.dwarfScale : cfg.people.scale;
    else throw new Error('no size for ' + it.key);
    placed.push({ ...it, kind, a, s });
  }
  // shadows: one layer, one colour, composited once (no double darkening, no blur)
  const sh = mk(W, H); const gs = ctx(sh);
  gs.fillStyle = '#000';
  const tf = (gg, p) => {
    gg.translate(p.x, p.y);
    if (p.shear) gg.transform(1, p.shear, 0, 1, 0, 0);
    gg.scale(p.flip ? -1 : 1, 1);
  };
  for (const p of placed) {
    const a = p.a;
    if (p.shadow === 'none') continue;
    if (p.spots) { // explicit contact shadows (map px, relative to the anchor), e.g. one per gate pillar
      for (const sp of p.spots) { gs.beginPath(); gs.ellipse(p.x + sp.dx, p.y + sp.dy, sp.rx, sp.ry, 0, 0, Math.PI * 2); gs.fill(); }
      continue;
    }
    // contact ellipse under the base, nudged to the lower right (light from the upper left)
    const bw = Math.max(a.base.w, a.body.w * (p.kind === 'prop' && p.key.includes('tree') ? 0.55 : 0.3)) * p.s;
    const bxl = (a.base.x - a.cx) * p.s * (p.flip ? -1 : 1);
    const k = p.ell ?? 1;
    gs.save(); gs.translate(p.x, p.y); if (p.shear) gs.transform(1, p.shear, 0, 1, 0, 0);
    gs.beginPath();
    gs.ellipse(bxl + bw * 0.1, -bw * 0.04, bw * 0.56 * k, bw * 0.17 * k, 0, 0, Math.PI * 2);
    gs.fill(); gs.restore();
    if (a.shd && !p.flip && p.shadow !== 'ellipse') {
      p._shd = p._shd ?? resample(a.shd, p.s);
      gs.save(); tf(gs, p); gs.drawImage(p._shd.c, -a.cx * p.s, -a.gy * p.s); gs.restore();
    }
  }
  const tint = mk(W, H); const gt = tint.getContext('2d');
  gt.drawImage(sh, 0, 0); gt.globalCompositeOperation = 'source-in'; gt.fillStyle = cfg.shadow.color; gt.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(tint, 0, 0); g.restore();

  // sprites, back to front
  const order = placed.map((p, i) => ({ p, i })).sort((u, v) => (u.p.y + (u.p.z ?? 0)) - (v.p.y + (v.p.z ?? 0)) || u.i - v.i);
  const out = [];
  for (const { p } of order) {
    const a = p.a;
    const r = resample(a.spr, p.s);
    g.save(); tf(g, p); g.drawImage(r.c, -a.cx * r.sx, -a.gy * r.sy, r.c.width, r.c.height); g.restore();
    // the drawn body box in map px (for layout.json and the overlap check)
    // corners of the body box through the same transform (translate, shear, flip, scale)
    const xs = [], ys = [];
    for (const [u, v] of [[a.body.x, a.body.y], [a.body.x + a.body.w, a.body.y], [a.body.x, a.body.y + a.body.h], [a.body.x + a.body.w, a.body.y + a.body.h]]) {
      const lx = (u - a.cx) * p.s * (p.flip ? -1 : 1), ly = (v - a.gy) * p.s;
      xs.push(p.x + lx); ys.push(p.y + ly + (p.shear ?? 0) * lx);
    }
    const left = Math.min(...xs), top = Math.min(...ys);
    out.push({ key: p.key, kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), scale: +p.s.toFixed(4), flip: !!p.flip, shear: p.shear ?? 0,
      box: { x: Math.round(left), y: Math.round(top), w: Math.round(Math.max(...xs) - left), h: Math.round(Math.max(...ys) - top) },
      anchor: { cx: +(a.cx / a.W).toFixed(4), gy: +(a.gy / a.H).toFixed(4) }, ell: p.ell, spots: p.spots, note: p.note });
  }
  // the forge's chimney smoke (the new forge art has none, by request)
  if (cfg.smoke) drawPuffs(g, cfg.smoke, cfg.smokeStyle);
  // cloud rings where the towers go into the clouds, then the generated band over the top of the map
  if (cfg.rings) {
    const R = rng(cfg.cloudStyle.seed ?? 3); const puffs = [];
    for (const t of cfg.rings) {
      for (let k = 0; k < t.n; k++) {
        const u = (k / (t.n - 1)) - 0.5; // -0.5 .. 0.5 across the tower
        puffs.push({ x: t.x + u * t.w + (R() - 0.5) * 16, y: t.y + Math.abs(u) * t.r * 0.5 + (R() - 0.5) * 14, r: t.r * (0.62 + R() * 0.3) * (1 - Math.abs(u) * 0.5) });
      }
    }
    drawPuffs(g, puffs, cfg.cloudStyle);
  }
  if (cfg.band) {
    const img = IMG[cfg.band.key] ?? (IMG[cfg.band.key] = await loadImage(cfg.band.key));
    drawBand(g, img, cfg.band, W);
  }
  return { map, W, H, placed: out };
}

// ---------------------------------------------------------------- phone UI mock (cream paper, fat brown line)
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function sticker(g, x, y, w, h, r, fill) {
  g.fillStyle = INK; rrect(g, x, y + 6, w, h, r); g.fill(); // hard drop, no blur
  g.fillStyle = fill; g.strokeStyle = '#3b2a20'; g.lineWidth = 5; rrect(g, x, y, w, h, r); g.fill(); g.stroke();
}
async function phoneView(map, crop, cfg) {
  const V = mk(780, 1688); const g = ctx(V);
  g.drawImage(map, crop.x, crop.y, 780, 1688, 0, 0, 780, 1688);
  const ui = cfg.ui;
  const icon = async (k) => (A[k] ? A[k].spr : (IMG[k] ?? (IMG[k] = await loadImage(k))));
  // top: notch strip stays clear (47pt safe area x2), chips under it
  const chip = async (x, y, w, ic, text) => {
    sticker(g, x, y, w, 76, 38, '#f6ebd5');
    const im = await icon(ic); const s = 62 / Math.max(im.width, im.height);
    g.drawImage(im, x + 12, y + 38 - (im.height * s) / 2, im.width * s, im.height * s);
    g.fillStyle = '#3b2a20'; g.font = `bold 34px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(text, x + 84, y + 40);
  };
  await chip(28, 108, 250, 'ui_gold', ui.gold);
  await chip(296, 108, 220, 'ui_chunk', ui.chunk);
  // place name tag on the right
  sticker(g, 560, 108, 192, 76, 38, '#fbe8a6');
  g.fillStyle = '#3b2a20'; g.font = `bold 32px ${FONT}`; g.textAlign = 'center'; g.fillText(crop.label, 656, 148);
  // bottom: menu buttons above the home indicator (34pt x2)
  const by = 1688 - 68 - 176;
  const btns = ui.buttons;
  const bw = 168, gap = (780 - 32 * 2 - bw * btns.length) / (btns.length - 1);
  for (let i = 0; i < btns.length; i++) {
    const b = btns[i]; const x = 32 + i * (bw + gap);
    sticker(g, x, by, bw, 160, 32, b.on ? '#fdeec8' : '#f6ebd5');
    if (b.icon) {
      const im = await icon(b.icon); const s = 84 / Math.max(im.width, im.height);
      g.drawImage(im, x + bw / 2 - (im.width * s) / 2, by + 14 + 42 - (im.height * s) / 2, im.width * s, im.height * s);
    }
    g.fillStyle = '#3b2a20'; g.font = `bold 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(b.label, x + bw / 2, by + 126);
  }
  return V;
}

// ---------------------------------------------------------------- asset sheet
async function assetSheet(cfg) {
  const groups = cfg.sheet;
  const COLS = 7, CW = 250, CH = 280, GAP = 12, M = 28, HEAD = 48;
  const W = M * 2 + COLS * CW + (COLS - 1) * GAP;
  let H = M;
  for (const gr of groups) { const cols = gr.cols ?? COLS; const cw = gr.cw ?? CW; const ch = gr.ch ?? CH; H += HEAD + Math.ceil(gr.items.length / cols) * (ch + GAP); }
  H += M;
  const c = mk(W, H); const g = ctx(c);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, W, H);
  let y = M;
  for (const gr of groups) {
    g.fillStyle = '#2e2018'; g.font = `bold 28px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(gr.title, M, y + 22);
    y += HEAD;
    const cols = gr.cols ?? COLS; const cw = gr.cw ?? ((W - M * 2 - (cols - 1) * GAP) / cols); const ch = gr.ch ?? CH;
    for (let i = 0; i < gr.items.length; i++) {
      const it = gr.items[i];
      const x = M + (i % cols) * (cw + GAP), yy = y + Math.floor(i / cols) * (ch + GAP);
      g.fillStyle = it.tag ? '#b4b09a' : '#a9a9a9'; rrect(g, x, yy, cw, ch, 14); g.fill();
      const a = A[it.key];
      const img = it.stacked && a ? a.img : (IMG[it.key] ?? (IMG[it.key] = await loadImage(it.key)));
      // fit the visible part
      const src = a && !it.whole ? { x: Math.max(0, a.crop.x), y: Math.max(0, a.crop.y), w: Math.min(img.width, a.W), h: Math.min(img.height, a.H) } : { x: 0, y: 0, w: img.width, h: img.height };
      const bw = cw - 24, bh = ch - 70;
      const f = Math.min(bw / src.w, bh / src.h);
      const r = resample(img, f);
      g.drawImage(r.c, src.x * r.sx, src.y * r.sy, src.w * r.sx, src.h * r.sy, x + (cw - src.w * f) / 2, yy + 12 + (bh - src.h * f) / 2, src.w * f, src.h * f);
      g.fillStyle = '#2e2018'; g.textAlign = 'center';
      g.font = `bold 21px ${FONT}`; g.fillText(it.name, x + cw / 2, yy + ch - 44);
      g.font = `15px ${FONT}`; g.fillStyle = '#4a3a30'; g.fillText(it.key + (it.tag ? '  · ' + it.tag : ''), x + cw / 2, yy + ch - 18);
    }
    y += Math.ceil(gr.items.length / cols) * (ch + GAP);
  }
  return c;
}

// ---------------------------------------------------------------- run
async function run(cfg) {
  CFG = cfg;
  REBUILD = cfg.rebuild ?? {};
  if (cfg.output) OUT = cfg.output;
  if (cfg.mode === 'grid') {
    const { map: c, g, W, H } = await groundCanvas(cfg);
    for (let x = 0; x <= W; x += 100) { g.strokeStyle = x % 500 === 0 ? 'rgba(255,0,0,.9)' : 'rgba(255,255,255,.6)'; g.lineWidth = x % 500 === 0 ? 5 : 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 100) { g.strokeStyle = y % 500 === 0 ? 'rgba(255,0,0,.9)' : 'rgba(255,255,255,.6)'; g.lineWidth = y % 500 === 0 ? 5 : 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.font = 'bold 46px sans-serif'; g.fillStyle = '#000';
    for (let x = 0; x < W; x += 500) for (let y = 0; y < H; y += 500) g.fillText(`${x},${y}`, x + 6, y + 46);
    await post('debug_grid', resample(c, 0.4).c, 'debug');
    return { W, H };
  }

  const { map, W, H, placed } = await buildMap(cfg);
  // the whole map (cfg.fullMaxH: shrink a taller map to this height)
  await post('full', cfg.fullMaxH && H > cfg.fullMaxH ? resample(map, cfg.fullMaxH / H).c : map);
  // overview
  const oh = cfg.overviewH, ow = Math.round((W * oh) / H);
  const ov = resample(map, oh / H).c;
  await post('overview', ov);
  // debug overlay (cfg.debug): boxes + keys, small
  if (cfg.debug) {
    const s = 0.5; const d = mk(W * s, H * s); const g = ctx(d);
    g.drawImage(resample(map, s).c, 0, 0);
    g.lineWidth = 2; g.font = `bold 13px ${FONT}`;
    for (const p of placed) {
      g.strokeStyle = p.kind === 'building' ? 'rgba(255,0,0,.8)' : p.kind === 'person' ? 'rgba(0,0,255,.9)' : 'rgba(255,255,0,.8)';
      g.strokeRect(p.box.x * s, p.box.y * s, p.box.w * s, p.box.h * s);
      g.fillStyle = '#000'; g.fillText(p.key.replace(/^(bld_|prop_|hero_)/, ''), p.box.x * s + 2, p.box.y * s + 12);
      g.fillStyle = '#f0f'; g.fillRect(p.x * s - 3, p.y * s - 3, 6, 6);
    }
    for (const v of cfg.views) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([10, 6]); g.strokeRect(v.x * s, v.y * s, 780 * s, 1688 * s); g.setLineDash([]); }
    await post('debug_boxes', d, 'debug');
  }
  // phone views
  for (const v of cfg.views) {
    const c = await phoneView(map, v, cfg);
    await post(v.file, c);
  }
  // asset sheet (uses the analysis crops)
  for (const gr of cfg.sheet) for (const it of gr.items) if (!A[it.key] && !it.whole) await asset(it.key, { shadow: kindOf(it.key) !== 'person', thicken: 0 });
  const sheet = await assetSheet(cfg);
  await post('assets', sheet);

  const layout = {
    map: { width: W, height: H, ground: cfg.ground, groundScale: cfg.groundScale, groundY: cfg.sky, skyColor: cfg.skyColor, sharpen: cfg.sharpen, thin: cfg.thin,
      note: 'Map px. The ground picture is scaled by groundScale and drawn at y = groundY; above it is flat sky. x,y = ground anchor (the middle of the body, at the lowest point it touches the ground). scale = map px per source px. Draw order: sky, ground, paths, horizon puffs, shadow layer (multiply), sprites back to front by y, tower cloud rings, cloud band.' },
    baseScale: cfg.F,
    shadow: cfg.shadow,
    paths: { style: cfg.pathStyle, list: cfg.paths, note: 'dirt paths: fill = road sand, ink outline only over grass; round caps, pts are a quadratic-smoothed polyline' },
    towers: { stack: cfg.stack, note: 'stack: source rows [top,bot) = one storey band, repeated n times, each one shrink x smaller than the one below; head and base unchanged' },
    clouds: { style: cfg.cloudStyle, horizon: cfg.horizon, rings: cfg.rings, band: cfg.band, note: 'band = cloud_band.png rows [0,srcH) scaled to h, tiled across, every other tile mirrored' },
    smoke: { puffs: cfg.smoke, style: cfg.smokeStyle, note: "the forge's chimney smoke: puffs (map px) drawn like the clouds, after the sprites" },
    outlines: { props: cfg.lines, people: cfg.people, note: 'extra outer ink added to small props and people (source px), so their lines match the buildings; people.scale / dwarfScale = map px per source px' },
    views: cfg.views.map((v) => ({ file: v.file + OUT.ext, x: v.x, y: v.y, w: 780, h: 1688, label: v.label })),
    items: placed,
  };
  await post('layout.json', JSON.stringify(layout, null, 1));
  const diag = Object.fromEntries(Object.entries(A).map(([k, a]) => [k, { shadowPx: a.info.shadowPx, comps: a.info.comps, mean: a.info.mean && a.info.mean.map((v) => v | 0), body: a.body, base: a.base }]));
  return { W, H, n: placed.length, overview: [ow, oh], diag };
}
window.run = run;
