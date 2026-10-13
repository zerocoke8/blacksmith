// 광석 정제 장면 (PixiJS): the card craft's workshop (bg_workshop, the furnace, the anvil, the
// dwarf's poses) with a pile of lumps by the anvil and a lump on its face. Each blow the screen
// reports — a result the engine already decided (CLAUDE.md 규칙 2) — plays out here: the strike
// pose, a flat comic star sized by the find's rarity, sparks and crumbs, the next lump hopping
// from the pile onto the anvil. The finds themselves, their numbers and their flight into the bag
// are the DOM overlay's (RefineStage), so they stay crisp and can fly up into the top band.
// Loaded with a dynamic import when the refine screen opens; the effect shapes are the craft's
// (forge/procedural.ts), flat and outlined, never soft glows.

import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { acquireApp, holdAsset, releaseAssets } from '../app.ts';
import type { RefineRarity } from '../../sim/data/refine.ts';
import { sceneArtUrl } from '../forge/assets.ts';
import {
  type ArtPoint,
  DWARF_POSE_ART,
  DWARF_POSE_FALLBACK,
  DWARF_POSES,
  type DwarfPose,
  FX_COLOR,
  FX_REDUCED,
  type SceneArtKey,
} from '../forge/layout.ts';
import { artMeta } from '../forge/meta.ts';
import * as draw from '../forge/procedural.ts';
import { refineArtUrl } from './assets.ts';
import {
  pileScale,
  pileTop,
  REFINE_ASPECT,
  REFINE_BEAT,
  REFINE_BURST,
  REFINE_TINT,
  type RefineLayout,
  refineLayout,
} from './layout.ts';

export interface RefineSceneOptions {
  reducedMotion: boolean;
  /** The scene's real layout (picture sizes known), for the DOM overlay. */
  onLayout(layout: RefineLayout): void;
}

export interface StrikeFx {
  rarity: RefineRarity;
  /** Time to the next blow while the hammer is held (ms); a tap's beat when it is not. */
  beatMs: number;
  /** Lumps left on the pile after this blow (none: no lump hops onto the anvil). */
  lumpsAfter: number;
}

export interface RefineScene {
  resize(w: number, h: number): void;
  /** The pile's lumps (its size, and whether a lump waits on the anvil). */
  setLumps(lumps: number): void;
  /** The hammer is held down: between blows he keeps it raised; let go, he rests. */
  setHeld(held: boolean): void;
  /** A blow lands now. */
  strike(fx: StrikeFx): void;
  destroy(): void;
}

// ---------- Small math ----------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIn = (t: number) => clamp01(t) ** 2;
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
/** Overshoots a little before it settles (a pop). */
const easeBack = (t: number) => {
  const k = clamp01(t) - 1;
  return 1 + 2.4 * k ** 3 + 1.4 * k ** 2;
};
// Presentation only: where a spark flies never changes a result.
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

// ---------- Particles and pops (as in the craft scene, smaller) ----------

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  ay: number;
  drag: number;
  life: number;
  age: number;
  size0: number;
  size1: number;
  spin: number;
  align: boolean;
  live: boolean;
}

interface Spawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay?: number;
  drag?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  tint: number;
  align?: boolean;
  spin?: number;
}

interface Pop {
  s: Sprite;
  age: number;
  life: number;
  size: number;
  inAt: number;
  outAt: number;
  spin: number;
  live: boolean;
}

const MAX_PARTICLES = 220;

/** Loads a picture and notes this screen's hold on it (released on destroy, render/app.ts). */
async function loadTexture(url: string | null, holds: Set<string>): Promise<Texture | null> {
  if (url === null) return null;
  if (holds.has(url)) return Assets.get<Texture>(url) ?? null;
  holds.add(url);
  return holdAsset(url);
}

const SCENE_KEYS: readonly SceneArtKey[] = ['bg_workshop', 'anvil', 'furnace', ...DWARF_POSES.map((p) => `dwarf_${p}` as SceneArtKey)];

export async function createRefineScene(host: HTMLElement, width: number, height: number, opts: RefineSceneOptions): Promise<RefineScene> {
  // The shared app (render/app.ts): one GL context for every screen; see-through, fingers pass.
  const lease = await acquireApp(host, width, height, { background: null, passThrough: true });
  const app = lease.app;

  // ---- Textures ----
  const made: Texture[] = [];
  /** The pictures this screen holds (render/app.ts holdAsset): given back on destroy. */
  const holds = new Set<string>();
  const fromCanvas = (c: HTMLCanvasElement): Texture => {
    const t = Texture.from(c, true);
    made.push(t);
    return t;
  };
  const pics: Partial<Record<SceneArtKey, Texture>> = {};
  const [chunkPic, pilePic] = await Promise.all([
    loadTexture(refineArtUrl('ore_chunk'), holds),
    loadTexture(refineArtUrl('chunk_pile'), holds),
    ...SCENE_KEYS.map(async (k) => {
      const t = await loadTexture(sceneArtUrl(k), holds);
      if (t !== null) pics[k] = t;
      return null;
    }),
  ]);
  let destroyed = false;

  const tex = {
    star: fromCanvas(draw.doodle('star', 64)),
    cross: fromCanvas(draw.doodle('cross', 64)),
    drop: fromCanvas(draw.doodle('drop', 64)),
    dot: fromCanvas(draw.doodle('dot', 48)),
    diamond: fromCanvas(draw.doodle('diamond', 64)),
    burst: fromCanvas(draw.burst(256)),
    speed: fromCanvas(draw.speedLines(256)),
    cloud: fromCanvas(draw.cloud(128)),
    sunburst: fromCanvas(draw.sunburst(256)),
  };
  const SPARK_SHAPES = [tex.star, tex.cross, tex.drop, tex.drop];
  const sceneTex = (k: SceneArtKey, make: () => HTMLCanvasElement): Texture => pics[k] ?? fromCanvas(make());
  const bgTex = sceneTex('bg_workshop', () => draw.background(600, 400));
  const anvilTex = sceneTex('anvil', () => draw.anvil(320, 280));
  const furnaceTex = sceneTex('furnace', () => draw.furnace(260, 330));
  // Stand-ins for the lump and the pile: the craft's flat crumbs.
  const chunkTex = chunkPic ?? fromCanvas(draw.doodle('dot', 64));
  const pileTex = pilePic ?? chunkTex;

  // Dwarf poses: a picture, else the next pose in the fallback chain, else a drawn stand-in
  // (the same rule as the craft scene: every pose at the one scale they were drawn at).
  const anyDwarf = DWARF_POSES.some((p) => pics[`dwarf_${p}` as SceneArtKey] !== undefined);
  interface PoseArt {
    tex: Texture;
    foot: ArtPoint;
    /** Display px per texture px for a dwarf of head→foot height 1. */
    k: number;
  }
  const idleArt = DWARF_POSE_ART.idle;
  const srcH = (p: DwarfPose): number => artMeta('scene', `dwarf_${p}`)?.trimH ?? DWARF_POSE_ART[p].src;
  const idleBody = (idleArt.foot.y - idleArt.head) * srcH('idle');
  const poseCache = new Map<DwarfPose, PoseArt>();
  const poseArt = (p: DwarfPose): PoseArt => {
    const hit = poseCache.get(p);
    if (hit !== undefined) return hit;
    let out: PoseArt | null = null;
    const chain: DwarfPose[] = [p, ...DWARF_POSE_FALLBACK[p], ...DWARF_POSES];
    for (const q of anyDwarf ? chain : []) {
      const t = pics[`dwarf_${q}` as SceneArtKey];
      if (t === undefined) continue;
      out = { tex: t, foot: DWARF_POSE_ART[q].foot, k: srcH(q) / t.height / idleBody };
      break;
    }
    if (out === null) {
      const t = fromCanvas(draw.dwarf(p, 220, 300));
      out = { tex: t, foot: { x: 0.5, y: 0.985 }, k: 1 / (0.965 * t.height) };
    }
    poseCache.set(p, out);
    return out;
  };

  // ---- Display tree ----
  const world = new Container();
  app.stage.addChild(world);
  const bg = new Sprite(bgTex);
  const furnace = new Sprite(furnaceTex);
  const pile = new Sprite(pileTex);
  const dwarf = new Sprite(poseArt('idle').tex);
  const sun = new Sprite(tex.sunburst);
  const anvil = new Sprite(anvilTex);
  const chunk = new Sprite(chunkTex);
  const hopper = new Sprite(chunkTex);
  const fxLayer = new Container();
  const popLayer = new Container();
  // The sunburst of a very rare find turns behind him and the anvil.
  world.addChild(bg, furnace, pile, sun, dwarf, anvil, chunk, hopper, fxLayer, popLayer);
  bg.anchor.set(0.5);
  pile.anchor.set(0.5, 0.97);
  chunk.anchor.set(0.5, 1);
  hopper.anchor.set(0.5, 0.5);
  sun.anchor.set(0.5);
  sun.tint = REFINE_TINT.sun;
  sun.alpha = 0;
  hopper.visible = false;

  // ---- State ----
  let W = Math.max(1, width);
  let H = Math.max(1, height);
  let L: RefineLayout = refineLayout(W, H);
  const reduced = opts.reducedMotion;
  let lumps = 0;
  let held = false;
  let time = 0;
  /** The pose now, and until when a blow's pose (strike, cheer, look) holds before the rest pose. */
  let pose: DwarfPose = 'idle';
  let poseUntil = 0;
  let after: 'rest' | 'cheer' | 'look' = 'rest';
  let afterUntil = 0;
  let lean = 0;
  /** The lump on the anvil: shown, and its squash (1 = just landed, settling). */
  let chunkShown = false;
  let chunkSquash = 0;
  /** The lump in flight from the pile: start, end, elapsed and length (ms). */
  let hop: { from: ArtPoint; to: ArtPoint; t: number; ms: number } | null = null;
  /** The pile's bounce when it changes size (1 = just changed). */
  let pileBounce = 0;
  let shownPile = 0;
  let sunLeft = 0;
  let sunMs = 1;

  const unit = () => Math.max(0.6, Math.min(1.6, L.dwarf.bodyH / 220));
  const count = (n: number) => Math.max(1, Math.round(reduced ? n * 0.4 : n));

  // ---- Particles ----
  const parts: Particle[] = [];
  const spawn = (t: Texture, o: Spawn): void => {
    let p = parts.find((x) => !x.live);
    if (p === undefined) {
      if (parts.length >= MAX_PARTICLES) {
        p = parts.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
      } else {
        const s = new Sprite(t);
        s.anchor.set(0.5);
        fxLayer.addChild(s);
        p = { s, vx: 0, vy: 0, ay: 0, drag: 0, life: 1, age: 0, size0: 1, size1: 1, spin: 0, align: false, live: false };
        parts.push(p);
      }
    }
    const s = p.s;
    s.texture = t;
    s.tint = o.tint;
    s.position.set(o.x, o.y);
    s.rotation = o.align === true ? Math.atan2(o.vy, o.vx) : rand(-0.4, 0.4);
    s.visible = true;
    p.vx = o.vx;
    p.vy = o.vy;
    p.ay = o.ay ?? 0;
    p.drag = o.drag ?? 0;
    p.life = o.life;
    p.age = 0;
    p.size0 = o.size;
    p.size1 = o.sizeEnd ?? o.size;
    p.spin = o.spin ?? 0;
    p.align = o.align ?? false;
    p.live = true;
    s.scale.set(0.01);
  };
  const stepParticles = (dt: number) => {
    const sec = dt / 1000;
    for (const p of parts) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.live = false;
        p.s.visible = false;
        continue;
      }
      const k = p.age / p.life;
      const drag = Math.max(0, 1 - p.drag * sec);
      p.vx *= drag;
      p.vy = p.vy * drag + p.ay * sec;
      p.s.x += p.vx * sec;
      p.s.y += p.vy * sec;
      if (p.align) p.s.rotation = Math.atan2(p.vy, p.vx);
      else p.s.rotation += p.spin * sec;
      const grow = k < 0.12 ? easeBack(k / 0.12) : 1;
      const shrink = k > 0.66 ? 1 - easeIn((k - 0.66) / 0.34) : 1;
      p.s.scale.set(Math.max(0.001, (lerp(p.size0, p.size1, k) * grow * shrink) / p.s.texture.width));
    }
  };

  const pops: Pop[] = [];
  const pop = (t: Texture, x: number, y: number, size: number, tint: number, life: number, inAt = 0.2, outAt = 0.55) => {
    let q = pops.find((x) => !x.live);
    if (q === undefined) {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      popLayer.addChild(s);
      q = { s, age: 0, life: 1, size: 1, inAt, outAt, spin: 0, live: false };
      pops.push(q);
    }
    q.s.texture = t;
    q.s.tint = tint;
    q.s.position.set(x, y);
    q.s.rotation = rand(-0.3, 0.3);
    q.s.visible = true;
    q.s.scale.set(0.01);
    q.age = 0;
    q.life = reduced ? life * FX_REDUCED : life;
    q.size = size;
    q.inAt = inAt;
    q.outAt = outAt;
    q.spin = 0;
    q.live = true;
  };
  const stepPops = (dt: number) => {
    for (const q of pops) {
      if (!q.live) continue;
      q.age += dt;
      const k = q.age / q.life;
      if (k >= 1) {
        q.live = false;
        q.s.visible = false;
        continue;
      }
      const grow = k < q.inAt ? easeBack(k / q.inAt) : 1;
      const shrink = k > q.outAt ? 1 - easeIn((k - q.outAt) / (1 - q.outAt)) : 1;
      q.s.scale.set(Math.max(0.001, (q.size * grow * shrink) / q.s.texture.width));
    }
  };

  /** Sparks off a blow, flung up and falling back. */
  const sparks = (x: number, y: number, n: number, power: number) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const ang = rand(-Math.PI * 0.94, -Math.PI * 0.06);
      const v = rand(150, 340) * power * u;
      const t = pick(SPARK_SHAPES);
      spawn(t, {
        x: x + rand(-5, 5) * u,
        y: y + rand(-3, 3) * u,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        ay: 700 * u,
        drag: 1.1,
        life: rand(340, 640),
        size: (t === tex.drop ? rand(11, 15) : rand(9, 14)) * u * Math.min(1.35, power),
        sizeEnd: 5 * u,
        tint: pick(FX_COLOR.spark),
        align: t === tex.drop,
        spin: rand(-5, 5),
      });
    }
  };
  /** The lump's crumbs: little grey-brown bits and a puff of dust off the anvil. */
  const crumbs = (x: number, y: number) => {
    const u = unit();
    for (let i = 0; i < count(6); i++) {
      const ang = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const v = rand(90, 200) * u;
      spawn(pick([tex.dot, tex.diamond]), {
        x: x + rand(-L.chunk.w * 0.3, L.chunk.w * 0.3),
        y: y - L.chunk.h * 0.4,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        ay: 820 * u,
        drag: 0.6,
        life: rand(300, 520),
        size: rand(6, 10) * u,
        sizeEnd: 4 * u,
        tint: pick(REFINE_TINT.crumbs),
        spin: rand(-6, 6),
      });
    }
    if (!reduced) {
      for (let i = 0; i < 2; i++) {
        spawn(tex.cloud, {
          x: x + rand(-L.chunk.w * 0.5, L.chunk.w * 0.5),
          y: y - L.chunk.h * 0.2,
          vx: rand(-30, 30) * u,
          vy: -rand(20, 45) * u,
          drag: 0.8,
          life: rand(380, 560),
          size: rand(14, 20) * u,
          sizeEnd: rand(24, 32) * u,
          tint: REFINE_TINT.dust,
          spin: rand(-0.4, 0.4),
        });
      }
    }
  };
  /** ✦ ring flung out round a rare find. */
  const twinkles = (x: number, y: number, n: number, colors: readonly number[], size: number) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2 + rand(-0.2, 0.2);
      const v = rand(90, 170) * u * size;
      spawn(pick([tex.star, tex.star, tex.diamond]), {
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v * 0.8 - 30 * u,
        drag: 2.2,
        life: rand(520, 860),
        size: rand(12, 18) * u * size,
        sizeEnd: rand(7, 10) * u,
        tint: pick(colors),
        spin: rand(-2, 2),
      });
    }
  };

  // ---- Layout ----
  const aspectOf = (t: Texture) => t.width / Math.max(1, t.height);
  const place = (s: Sprite, r: { x: number; y: number; w: number; h: number }) => {
    s.anchor.set(0, 0);
    s.position.set(r.x, r.y);
    s.width = r.w;
    s.height = r.h;
  };

  const poseScale = (a: PoseArt): number => {
    let scale = L.dwarf.bodyH * a.k;
    // A pose drawn wider than the idle one may take this much of the width at most.
    const maxW = 0.58 * 1.4 * W;
    if (a.tex.width * scale > maxW) scale = maxW / a.tex.width;
    return scale;
  };
  const placeDwarf = () => {
    const a = poseArt(pose);
    const scale = poseScale(a);
    dwarf.texture = a.tex;
    dwarf.anchor.set(a.foot.x, a.foot.y);
    const breathe = pose === 'idle' && !reduced ? 1 + 0.008 * Math.sin(time / 650) : 1;
    dwarf.scale.set(scale, scale * breathe);
    dwarf.rotation = 0;
    const left = a.foot.x * a.tex.width * scale;
    dwarf.position.set(Math.max(L.dwarf.x + lean, left + 2), L.dwarf.y);
  };

  const chunkSize = () => ({ w: L.chunk.w, h: L.chunk.w / aspectOf(chunkTex) });
  const placeChunk = () => {
    const c = chunkSize();
    chunk.position.set(L.chunk.x, L.chunk.y);
    const sq = reduced ? 0 : chunkSquash;
    chunk.width = c.w * (1 + 0.18 * sq);
    chunk.height = c.h * (1 - 0.2 * sq);
    chunk.visible = chunkShown;
  };
  const placePile = () => {
    const s = pileScale(shownPile);
    pile.visible = s > 0;
    const b = reduced ? 0 : pileBounce;
    const pw = L.pile.w * s;
    pile.position.set(L.pile.x, L.pile.y);
    pile.width = pw * (1 + 0.06 * b);
    pile.height = (pw / aspectOf(pileTex)) * (1 - 0.08 * b);
  };

  const relayout = () => {
    L = refineLayout(W, H, {
      anvil: aspectOf(anvilTex),
      furnace: aspectOf(furnaceTex),
      ore_chunk: aspectOf(chunkTex),
      chunk_pile: pilePic !== null ? aspectOf(pilePic) : REFINE_ASPECT.chunk_pile,
      ...(pics.dwarf_strike !== undefined ? { dwarf_strike: aspectOf(pics.dwarf_strike) } : {}),
    });
    const cover = Math.max(W / bgTex.width, H / bgTex.height);
    bg.scale.set(cover);
    bg.position.set(W / 2, H / 2);
    place(furnace, L.furnace);
    place(anvil, L.anvil);
    sun.position.set(L.hit.x, L.hit.y);
    sun.scale.set((L.anvil.w * 2.2) / sun.texture.width);
    const c = chunkSize();
    hopper.width = c.w;
    hopper.height = c.h;
    placeChunk();
    placePile();
    placeDwarf();
    opts.onLayout(L);
  };

  // ---- A blow ----
  const restPose = (): DwarfPose => (held ? 'raise' : 'idle');

  const strike = (fx: StrikeFx) => {
    const b = REFINE_BURST[fx.rarity];
    const u = unit();
    const now = time;
    // The strike pose holds part of the beat, then the hammer goes up again (or down).
    pose = 'strike';
    lean = reduced ? 0 : L.lean;
    const hold = held ? Math.min(REFINE_BEAT.strikeMax, fx.beatMs * REFINE_BEAT.strikeShare) : REFINE_BEAT.tapMs;
    poseUntil = now + hold;
    after = fx.rarity === 'veryRare' ? 'look' : fx.rarity === 'rare' ? 'cheer' : 'rest';
    afterUntil = poseUntil + (after === 'look' ? fx.beatMs : after === 'cheer' ? REFINE_BEAT.cheerMs : 0);
    // The star, the sparks, the crumbs of the lump.
    pop(tex.burst, L.hit.x, L.hit.y, b.size * u, REFINE_TINT.burst[fx.rarity], fx.rarity === 'veryRare' ? 520 : 280, 0.22, 0.55);
    if (!reduced) pop(tex.speed, L.hit.x, L.hit.y, b.size * 1.3 * u, 0xffffff, 280, 0.3, 0.5);
    sparks(L.hit.x, L.hit.y, b.sparks, b.power);
    if (b.ring > 0) twinkles(L.hit.x, L.hit.y - L.chunk.h * 0.3, b.ring, REFINE_TINT.twinkle[fx.rarity], fx.rarity === 'veryRare' ? 1.4 : 1);
    if (fx.rarity === 'veryRare') {
      sunLeft = sunMs = reduced ? 600 : 1300;
    }
    crumbs(L.chunk.x, L.chunk.y);
    chunkShown = false;
    hop = null;
    hopper.visible = false;
    // The next lump hops from the pile onto the anvil, unless the pile is empty.
    lumps = Math.max(0, fx.lumpsAfter);
    if (lumps > 0) {
      const ms = reduced ? 0 : Math.max(REFINE_BEAT.hopMin, Math.min(REFINE_BEAT.hopMax, fx.beatMs * REFINE_BEAT.hopShare));
      if (ms === 0) {
        chunkShown = true;
      } else {
        hop = { from: pileTop(L, lumps), to: { x: L.chunk.x, y: L.chunk.y - chunkSize().h / 2 }, t: 0, ms };
      }
    }
    if (pileScale(lumps) !== pileScale(shownPile)) pileBounce = 1;
    shownPile = lumps;
    placePile();
    placeChunk();
    placeDwarf();
  };

  // ---- Frame ----
  const tick = () => {
    const dt = Math.min(64, app.ticker.deltaMS);
    time += dt;
    if (pose === 'strike' && time >= poseUntil) {
      // A very rare find: he bends in over it, eyes open (the work pose), leaning toward the anvil.
      lean = after === 'look' && !reduced ? L.lean * REFINE_BEAT.look : 0;
      pose = after === 'cheer' ? 'cheer' : after === 'look' ? 'work' : restPose();
    }
    if (pose !== 'strike' && after !== 'rest' && time >= afterUntil) {
      lean = 0;
      if (after === 'look') {
        // Having looked, he is pleased with it (unless the next blow comes first).
        after = 'cheer';
        afterUntil = time + REFINE_BEAT.cheerMs;
        pose = 'cheer';
      } else {
        after = 'rest';
        pose = restPose();
      }
    }
    if (pose !== 'strike' && after === 'rest') pose = restPose();
    if (hop !== null) {
      hop.t += dt;
      const k = clamp01(hop.t / hop.ms);
      const arc = L.anvil.w * 0.55;
      hopper.visible = true;
      hopper.position.set(lerp(hop.from.x, hop.to.x, easeOut(k)), lerp(hop.from.y, hop.to.y, k) - Math.sin(k * Math.PI) * arc);
      hopper.rotation = reduced ? 0 : -k * 2.4;
      if (k >= 1) {
        hop = null;
        hopper.visible = false;
        chunkShown = true;
        chunkSquash = 1;
      }
    }
    if (chunkSquash > 0) {
      chunkSquash = Math.max(0, chunkSquash - dt / 140);
      placeChunk();
    } else if (chunk.visible !== chunkShown) {
      placeChunk();
    }
    if (pileBounce > 0) {
      pileBounce = Math.max(0, pileBounce - dt / 260);
      placePile();
    }
    if (sunLeft > 0) {
      sunLeft = Math.max(0, sunLeft - dt);
      const k = 1 - sunLeft / sunMs;
      sun.alpha = 0.6 * (k < 0.15 ? easeOut(k / 0.15) : 1 - easeIn((k - 0.15) / 0.85));
      if (!reduced) sun.rotation += dt / 2600;
    } else {
      sun.alpha = 0;
    }
    stepParticles(dt);
    stepPops(dt);
    placeDwarf();
  };

  relayout();
  app.ticker.add(tick);

  return {
    resize(w, h) {
      if (destroyed) return;
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      lease.resize(W, H);
      relayout();
    },
    setLumps(n) {
      if (destroyed) return;
      lumps = Math.max(0, n);
      // A lump waits on the anvil whenever there is one (and none is in flight).
      if (hop === null) chunkShown = lumps > 0;
      if (pileScale(lumps) !== pileScale(shownPile) && shownPile > 0) pileBounce = 1;
      shownPile = lumps;
      placePile();
      placeChunk();
    },
    setHeld(v) {
      held = v;
      if (pose !== 'strike' && after === 'rest') pose = restPose();
      placeDwarf();
    },
    strike(fx) {
      if (destroyed) return;
      strike(fx);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      app.ticker.remove(tick);
      app.stage.removeChild(world);
      world.destroy({ children: true });
      lease.release();
      for (const t of made) t.destroy(true);
      // The pictures this screen loaded leave memory and the GPU unless another screen still holds them.
      releaseAssets(holds);
      holds.clear();
    },
  };
}
