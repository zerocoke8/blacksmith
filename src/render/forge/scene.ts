// The forge scene (PixiJS): workshop, dwarf, anvil and hot iron, furnace, bellows, quench tub,
// and the effects a card's result plays out. It only shows what the engine already computed
// (CLAUDE.md 규칙 2): steps come from fx.ts, and when the queue runs dry the scene settles on
// the latest engine view. Loaded with a dynamic import when the craft screen opens, so PixiJS
// never weighs on the first load.
// The look is the art's doodle style: flat colours under a fat dark line. Effects are flat
// outlined shapes (procedural.ts) that pop, fly and shrink away, never soft glows or flashes; the
// hot bar is painted one flat colour by its heat, the furnace's flame one flat colour by its state.

import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { acquireApp, holdAsset, releaseAssets } from '../app.ts';
import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import type { FireState } from '../../sim/data/cards.ts';
import { sceneArtUrl } from './assets.ts';
import type { FxStep, Motion, PlayFx } from './fx.ts';
import {
  type ArtPoint,
  DONE_POSE,
  DWARF_POSE_ART,
  DWARF_POSE_FALLBACK,
  DWARF_POSES,
  type DwarfPose,
  FIRE_FLAME,
  FX_COLOR,
  FX_LEGENDARY_STRIKE_AT,
  FX_REDUCED,
  FX_SECOND_AT,
  FX_SPEEDUP,
  FX_TIMING,
  type FxTiming,
  HEAT_TINT,
  IRON_COLD,
  IRON_SPLIT,
  METAL_TINT,
  PROP_ART,
  QUENCH_DIP,
  SCENE_ART_KEYS,
  SCENE_PLACE,
  type SceneArtKey,
  type SceneLayout,
  sceneLayout,
  SHAKE,
  STRIKE_AT,
  WEAPON_ART,
  WEAPON_REST,
  WEAPON_STANDIN,
  weaponRest,
} from './layout.ts';
import { artMeta } from './meta.ts';
import * as draw from './procedural.ts';

/** What the scene rests on when no effect is playing: the engine's state. */
export interface SceneView {
  heat: number;
  fire: FireState;
  status: 'active' | 'success' | 'failed';
  abandoned: boolean;
  weaponType: WeaponType;
  tier: QualityTier;
  legendary: boolean;
  /** A 열기 buff is on (풀무질 …): the fire burns higher. */
  stoked: boolean;
}

export interface ForgeSceneOptions {
  reducedMotion: boolean;
  /**
   * A step lands (the blow hits, the iron comes out of the fire …): the bars move now. skipped:
   * the player tapped through it (skip), so it never played.
   */
  onBeat(step: FxStep, skipped?: boolean): void;
  /** Every queued step has played; the screen goes back to the engine's numbers. */
  onIdle(): void;
  /** The scene's real layout (picture sizes known), for the DOM overlay. */
  onLayout(layout: SceneLayout): void;
}

export interface ForgeScene {
  resize(w: number, h: number): void;
  setView(view: SceneView): void;
  enqueue(steps: readonly FxStep[]): void;
  /** Jump to the end of every queued step (each one not yet landed still lands, as skipped). */
  skip(): void;
  busy(): boolean;
  destroy(): void;
}

// ---------- Small math ----------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeIn = (t: number) => clamp01(t) ** 2;
/** Overshoots a little before it settles (a pop). */
const easeBack = (t: number) => {
  const k = clamp01(t) - 1;
  return 1 + 2.4 * k ** 3 + 1.4 * k ** 2;
};
/** 0 → 1 → 0 across [a, b]. */
const pulse = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

function mixColor(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k));
  const bl = Math.round(lerp(a & 255, b & 255, k));
  return (r << 16) | (g << 8) | bl;
}

// ---------- Particles and pops ----------

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
  /** Turned along its flight (drops). */
  align: boolean;
  /** Share of the life spent popping in (scale from nothing). */
  popIn: number;
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
  rotation?: number;
  popIn?: number;
}

/** A shape that pops up in place, holds and shrinks away (the impact star, its speed lines, the rune ring). */
interface Pop {
  s: Sprite;
  age: number;
  life: number;
  size: number;
  /** Share of the life spent popping in, and where it starts shrinking away. */
  inAt: number;
  outAt: number;
  spin: number;
  live: boolean;
}

const MAX_PARTICLES = 260;

// ---------- The scene ----------

type Runner = {
  timing: FxTiming;
  /** Local progress 0..1. */
  update(t: number): void;
  impact(): void;
  end(): void;
};

interface Part {
  runner: Runner;
  offsetMs: number;
  ms: number;
  hitDone: boolean;
  ended: boolean;
}

interface Running {
  step: FxStep;
  parts: Part[];
  elapsed: number;
  total: number;
  beatMs: number;
  beatDone: boolean;
}

const SCENE_ESSENTIAL: readonly SceneArtKey[] = SCENE_ART_KEYS.filter((k) => !k.startsWith('weapon_'));

/** Loads a picture and notes this screen's hold on it (released on destroy, render/app.ts). */
async function loadTexture(url: string, holds: Set<string>): Promise<Texture | null> {
  if (holds.has(url)) return Assets.get<Texture>(url) ?? null;
  holds.add(url);
  return holdAsset(url);
}

export async function createForgeScene(
  host: HTMLElement,
  width: number,
  height: number,
  opts: ForgeSceneOptions,
): Promise<ForgeScene> {
  // The shared app (render/app.ts): one GL context for every screen; see-through, fingers pass.
  const lease = await acquireApp(host, width, height, { background: null, passThrough: true });
  const app = lease.app;

  // ---- Textures: pictures where they exist, stand-ins elsewhere ----
  const made: Texture[] = [];
  /** The pictures this screen holds (render/app.ts holdAsset): given back on destroy. */
  const holds = new Set<string>();
  const fromCanvas = (c: HTMLCanvasElement): Texture => {
    const t = Texture.from(c, true);
    made.push(t);
    return t;
  };
  const pics: Partial<Record<SceneArtKey, Texture>> = {};
  await Promise.all(
    SCENE_ESSENTIAL.map(async (k) => {
      const url = sceneArtUrl(k);
      if (url === null) return;
      const t = await loadTexture(url, holds);
      if (t !== null) pics[k] = t;
    }),
  );
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
    flame: fromCanvas(draw.flame(128, 160)),
    flameCore: fromCanvas(draw.flame(128, 160, true)),
    rune: fromCanvas(draw.runeRing(256)),
    crack: fromCanvas(draw.crack(256, 80)),
    sunburst: fromCanvas(draw.sunburst(256)),
  };
  /** Spark shapes off a blow. */
  const SPARK_SHAPES = [tex.star, tex.cross, tex.drop, tex.drop];
  const sceneTex = (k: SceneArtKey, make: () => HTMLCanvasElement): Texture => pics[k] ?? fromCanvas(make());
  const bgTex = sceneTex('bg_workshop', () => draw.background(600, 400));
  const anvilTex = sceneTex('anvil', () => draw.anvil(320, 280));
  const furnaceTex = sceneTex('furnace', () => draw.furnace(260, 330));
  const bellowsTex = sceneTex('bellows', () => draw.bellows(280, 200));
  const quenchTex = sceneTex('quench', () => draw.quench(250, 200));
  // The hot bar: its picture made tintable (one flat colour by its heat), else the drawn white bar.
  const ironPic = pics.iron_hot;
  const ironTex = (() => {
    if (ironPic === undefined) return fromCanvas(draw.ironBar(320, 130));
    const src = ironPic.source.resource as CanvasImageSource | undefined;
    if (src === undefined) return ironPic;
    try {
      return fromCanvas(draw.tintable(src, ironPic.width, ironPic.height));
    } catch {
      return ironPic;
    }
  })();
  /** The painted cold, split bar for a broken iron (same canvas as the hot bar); without it the drawn crack goes over the grey bar. */
  const crackedTex = pics.iron_cracked ?? null;
  /** The painted cold bar, whole, for an iron put down (same canvas); without it the hot bar is painted grey. */
  const coldTex = pics.iron_cold ?? null;
  /**
   * The split bar cut at its crack into two halves that part as it splits. They share the picture's
   * source, so they are destroyed without it (the picture stays in the loader's cache).
   */
  const subTex: Texture[] = [];
  const crackCut = PROP_ART.iron.crack;
  const halfTex = (() => {
    if (crackedTex === null) return null;
    const fr = crackedTex.frame;
    const cut = Math.round(fr.width * crackCut);
    const left = new Texture({ source: crackedTex.source, frame: new Rectangle(fr.x, fr.y, cut, fr.height) });
    const right = new Texture({ source: crackedTex.source, frame: new Rectangle(fr.x + cut, fr.y, fr.width - cut, fr.height) });
    subTex.push(left, right);
    return { left, right, cut: cut / fr.width };
  })();
  /** The furnace picture's own painted flames painted out (procedural.ts furnaceMouth), so the drawn flame shows the fire's state. */
  const mouthTex = (() => {
    const pic = pics.furnace;
    const src = pic?.source.resource as CanvasImageSource | undefined;
    if (pic === undefined || src === undefined) return null;
    try {
      const c = draw.furnaceMouth(src, pic.width, pic.height, PROP_ART.furnace.arch, PROP_ART.furnace.mouth);
      return c === null ? null : fromCanvas(c);
    } catch {
      return null;
    }
  })();

  // Dwarf poses: a picture, else the next pose in the fallback chain, else a drawn stand-in.
  const anyDwarf = DWARF_POSES.some((p) => pics[`dwarf_${p}` as SceneArtKey] !== undefined);
  interface PoseArt {
    tex: Texture;
    foot: ArtPoint;
    /** Display px per texture px for a dwarf of head→foot height 1 (× L.dwarf.bodyH gives the scale). */
    k: number;
    hammer?: ArtPoint;
    reach?: ArtPoint;
    tilt?: number;
  }
  /**
   * All poses share one scale: the idle picture's head→foot is the dwarf's height, and every pose
   * keeps the size it was drawn at on the shared canvas (meta.json trims, else layout.ts src).
   */
  const idleArt = DWARF_POSE_ART.idle;
  const srcH = (p: DwarfPose): number => artMeta('scene', `dwarf_${p}`)?.trimH ?? DWARF_POSE_ART[p].src;
  const idleBody = (idleArt.foot.y - idleArt.head) * srcH('idle');
  const poseCache = new Map<DwarfPose, PoseArt>();
  const poseArt = (p: DwarfPose): PoseArt => {
    const hit = poseCache.get(p);
    if (hit !== undefined) return hit;
    let out: PoseArt | null = null;
    // The pose's own picture, then its stand-in poses, then any dwarf picture there is.
    const chain: DwarfPose[] = [p, ...DWARF_POSE_FALLBACK[p], ...DWARF_POSES];
    for (const q of anyDwarf ? chain : []) {
      const key = `dwarf_${q}` as SceneArtKey;
      const t = pics[key];
      if (t === undefined) continue;
      const base = DWARF_POSE_ART[q];
      // Source px per texture px, over the idle body's source height.
      out = { tex: t, foot: base.foot, k: srcH(q) / t.height / idleBody, hammer: base.hammer, reach: base.reach, tilt: base.tilt };
      break;
    }
    if (out === null) {
      // Drawn stand-in: the same anchors for every pose (procedural.ts dwarf()).
      const t = fromCanvas(draw.dwarf(p, 220, 300));
      out = { tex: t, foot: { x: 0.5, y: 0.985 }, k: 1 / (0.965 * t.height), hammer: p === 'strike' ? { x: 0.96, y: 0.52 } : undefined };
    }
    poseCache.set(p, out);
    return out;
  };

  const weaponTex = new Map<WeaponType, Texture>();
  /** Weapons whose picture has loaded (the rest show the drawn stand-in). */
  const weaponPic = new Set<WeaponType>();
  const weaponFor = (type: WeaponType): Texture => {
    const hit = weaponTex.get(type);
    if (hit !== undefined) return hit;
    const t = fromCanvas(draw.weapon(type, 360, 120));
    weaponTex.set(type, t);
    // The picture, when there is one, replaces the stand-in once it has loaded.
    const url = sceneArtUrl(`weapon_${type}` as SceneArtKey);
    if (url !== null) {
      void loadTexture(url, holds).then((pic) => {
        if (pic === null || destroyed) return;
        weaponTex.set(type, pic);
        weaponPic.add(type);
        if (shownWeapon === type) {
          weapon.texture = pic;
          placeWeapon();
        }
      });
    }
    return t;
  };

  // ---- Display tree ----
  const world = new Container();
  app.stage.addChild(world);
  const bg = new Sprite(bgTex);
  const furnace = new Sprite(furnaceTex);
  // The furnace's own fire: its painted flames painted out, a flame of the fire's colour with a lighter core.
  const mouthS = new Sprite(mouthTex ?? Texture.EMPTY);
  const flameS = new Sprite(tex.flame);
  const flameCore = new Sprite(tex.flameCore);
  const bellows = new Sprite(bellowsTex);
  const quench = new Sprite(quenchTex);
  const anvil = new Sprite(anvilTex);
  const ironGroup = new Container();
  const iron = new Sprite(ironTex);
  const crackS = new Sprite(tex.crack);
  // The split bar: its two halves in one group (they part when it splits).
  const cracked = new Container();
  const crackL = new Sprite(halfTex?.left ?? Texture.EMPTY);
  const crackR = new Sprite(halfTex?.right ?? Texture.EMPTY);
  cracked.addChild(crackL, crackR);
  const cold = new Sprite(coldTex ?? Texture.EMPTY);
  const sunS = new Sprite(tex.sunburst);
  const weapon = new Sprite(weaponFor('oneHandSword'));
  ironGroup.addChild(iron, cracked, cold, crackS);
  const runes = new Sprite(tex.rune);
  const dwarf = new Sprite(poseArt('idle').tex);
  const smokeLayer = new Container();
  const fxLayer = new Container();
  const popLayer = new Container();
  /** The ✦ that slides along the bar while he polishes it. */
  const glint = new Sprite(tex.star);
  // The dwarf stands a step behind the anvil (layout.ts SCENE_PLACE); the bellows and the tub stand in front.
  world.addChild(bg, furnace, mouthS, flameS, flameCore, dwarf, sunS, anvil, ironGroup, weapon, runes, bellows, quench, smokeLayer, fxLayer, popLayer, glint);
  for (const s of [crackS, cracked, cold, sunS, weapon, runes, glint]) s.alpha = 0;
  for (const s of [iron, crackS, cold, sunS, weapon, runes, glint]) s.anchor.set(0.5);
  bg.anchor.set(0.5);
  mouthS.visible = mouthTex !== null;
  flameS.anchor.set(0.5, 1);
  flameCore.anchor.set(0.5, 1);
  sunS.tint = FX_COLOR.burst;
  glint.tint = 0xffffff;

  // ---- State ----
  let W = Math.max(1, width);
  let H = Math.max(1, height);
  let L: SceneLayout = sceneLayout(W, H);
  const state: SceneView = {
    heat: 0,
    fire: 'normal',
    status: 'active',
    abandoned: false,
    weaponType: 'oneHandSword',
    tier: 1,
    legendary: false,
    stoked: false,
  };
  /** The weapon type the weapon sprite shows. */
  let shownWeapon: WeaponType = 'oneHandSword';
  /** What the iron and fire show right now (moves with the beats). */
  let shownHeat = 0;
  let shownFire: FireState = 'normal';
  let finished: 'none' | 'weapon' | 'broken' | 'abandoned' = 'none';
  let pose: DwarfPose = 'idle';
  let lean = 0;
  /** A small nod over a finished weapon he does not cheer for (0..1, DONE_POSE). */
  let nod = 0;
  let fireFlare = 0;
  let shakeLeft = 0;
  let shakeAmp = 0;
  /** A low drop of the whole scene (legendary blow): ms left. */
  let thumpLeft = 0;
  let time = 0;
  let emberDebt = 0;
  /** The bar quenched: 1 = grey, fading back to its heat's colour. */
  let ironCool = 0;
  /** A blow lit the bar up: 1 = pale, fading. */
  let ironFlash = 0;
  let ironFlashTint = 0xffffff;
  /** A material's colour soaking into the bar: 1 = its colour, fading. */
  let metal = 0;
  let metalTint = 0xffffff;
  /** The sunburst behind a 걸작 or a legendary weapon (0..1). */
  let sun = 0;
  let ironHome = { x: 0, y: 0 };
  const queue: FxStep[] = [];
  let running: Running | null = null;
  const reduced = opts.reducedMotion;

  // ---- Particles ----
  const parts: Particle[] = [];
  const spawn = (layer: Container, t: Texture, o: Spawn): void => {
    let p = parts.find((x) => !x.live);
    if (p === undefined) {
      if (parts.length >= MAX_PARTICLES) {
        p = parts.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
      } else {
        const s = new Sprite(t);
        s.anchor.set(0.5);
        p = { s, vx: 0, vy: 0, ay: 0, drag: 0, life: 1, age: 0, size0: 1, size1: 1, spin: 0, align: false, popIn: 0, live: false };
        parts.push(p);
      }
    }
    const s = p.s;
    if (s.parent !== layer) layer.addChild(s);
    s.texture = t;
    s.tint = o.tint;
    s.position.set(o.x, o.y);
    s.rotation = o.rotation ?? (o.align === true ? Math.atan2(o.vy, o.vx) : rand(-0.4, 0.4));
    s.visible = true;
    s.alpha = 1;
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
    p.popIn = o.popIn ?? 0.12;
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
      // Pops in, then shrinks away over the last third (no fading glow: a flat shape just gets smaller).
      const grow = p.popIn > 0 && k < p.popIn ? easeBack(k / p.popIn) : 1;
      const shrink = k > 0.66 ? 1 - easeIn((k - 0.66) / 0.34) : 1;
      const size = lerp(p.size0, p.size1, k) * grow * shrink;
      p.s.scale.set(Math.max(0.001, size / p.s.texture.width));
    }
  };

  const pops: Pop[] = [];
  /** A shape popping up at x, y (size px), held, then shrinking away over life ms. */
  const pop = (t: Texture, x: number, y: number, size: number, tint: number, life: number, o: { spin?: number; rotation?: number; inAt?: number; outAt?: number } = {}) => {
    let q = pops.find((x) => !x.live);
    if (q === undefined) {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      popLayer.addChild(s);
      q = { s, age: 0, life: 1, size: 1, inAt: 0.2, outAt: 0.6, spin: 0, live: false };
      pops.push(q);
    }
    q.s.texture = t;
    q.s.tint = tint;
    q.s.position.set(x, y);
    q.s.rotation = o.rotation ?? rand(-0.3, 0.3);
    q.s.visible = true;
    q.s.alpha = 1;
    q.s.scale.set(0.01);
    q.age = 0;
    q.life = reduced ? life * FX_REDUCED : life;
    q.size = size;
    q.inAt = o.inAt ?? 0.2;
    q.outAt = o.outAt ?? 0.6;
    q.spin = reduced ? 0 : (o.spin ?? 0);
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
      q.s.rotation += (q.spin * dt) / 1000;
    }
  };

  const count = (n: number) => Math.max(1, Math.round(reduced ? n * 0.4 : n));
  const unit = () => Math.max(0.6, Math.min(1.6, H / 380));

  /** Sparks off a blow: little stars, crosses and drops flung up and falling back. */
  const sparks = (x: number, y: number, n: number, colors: readonly number[], power = 1) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const a = rand(-Math.PI * 0.92, -Math.PI * 0.08);
      const v = rand(150, 360) * power * u;
      const t = pick(SPARK_SHAPES);
      spawn(fxLayer, t, {
        x: x + rand(-6, 6) * u,
        y: y + rand(-3, 3) * u,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        ay: 680 * u,
        drag: 1.1,
        life: rand(380, 720),
        size: (t === tex.drop ? rand(12, 17) : rand(10, 15)) * u * Math.min(1.4, power),
        sizeEnd: 6 * u,
        tint: pick(colors),
        align: t === tex.drop,
        spin: rand(-5, 5),
      });
    }
  };
  /** ✦ that pop up round a place and drift a little (품질, 마무리, 완성). */
  const twinkles = (x: number, y: number, w: number, n: number, colors: readonly number[], size = 1) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      spawn(fxLayer, pick([tex.star, tex.star, tex.diamond]), {
        x: x + rand(-w / 2, w / 2),
        y: y + rand(-18, 8) * u,
        vx: rand(-14, 14),
        vy: rand(-46, -12) * u,
        life: rand(520, 900),
        size: rand(11, 19) * u * size,
        sizeEnd: rand(8, 12) * u * size,
        tint: pick(colors),
        spin: rand(-1.5, 1.5),
        popIn: 0.25,
      });
    }
  };
  /** Little sparks rising off the fire. */
  const embers = (x: number, y: number, n: number, spread = 18) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const t = pick([tex.dot, tex.star, tex.drop]);
      spawn(fxLayer, t, {
        x: x + rand(-spread, spread) * u,
        y: y + rand(-6, 6) * u,
        vx: rand(-18, 18) * u,
        vy: rand(-110, -50) * u,
        ay: -16 * u,
        drag: 0.4,
        life: rand(700, 1300),
        size: rand(7, 11) * u,
        sizeEnd: 4 * u,
        tint: pick(FX_COLOR.spark),
        align: t === tex.drop,
        spin: rand(-3, 3),
      });
    }
  };
  /** Puffy outlined clouds rising (steam, smoke). */
  const clouds = (x: number, y: number, n: number, tint: number, rise: number, spread = L.iron.w * 0.45) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      spawn(smokeLayer, tex.cloud, {
        x: x + rand(-spread, spread),
        y: y + rand(-4, 4) * u,
        vx: rand(-16, 16) * u,
        vy: -rand(28, 60) * rise * u,
        drag: 0.6,
        life: rand(900, 1500),
        size: rand(20, 30) * u,
        sizeEnd: rand(40, 56) * u,
        tint,
        spin: rand(-0.4, 0.4),
        popIn: 0.2,
      });
    }
  };
  /** Shapes drawn in from all round into the bar (a material soaking in). */
  const converge = (x: number, y: number, n: number, tint: number, radius: number, life: number) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const a = rand(0, Math.PI * 2);
      const r = radius * rand(0.7, 1.1);
      const sec = life / 1000;
      spawn(fxLayer, pick([tex.diamond, tex.star, tex.dot]), {
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * 0.6,
        vx: (-Math.cos(a) * r) / sec,
        vy: (-Math.sin(a) * r * 0.6) / sec,
        life,
        size: rand(11, 16) * u,
        sizeEnd: 7 * u,
        tint,
        spin: rand(-2, 2),
        popIn: 0.3,
      });
    }
  };
  /** The comic impact of a blow: a spiky star with speed lines round it, popping and gone. */
  const impact = (x: number, y: number, size: number, tint: number, life = 300) => {
    pop(tex.burst, x, y, size, tint, life, { inAt: 0.22, outAt: 0.55 });
    if (!reduced) pop(tex.speed, x, y, size * 1.3, 0xffffff, life, { inAt: 0.3, outAt: 0.5 });
  };
  const shake = (amp: number) => {
    if (reduced) return;
    shakeAmp = Math.max(shakeAmp, amp * unit());
    shakeLeft = SHAKE.ms;
  };
  /** One heavy, low drop and settle of the whole scene (not a rattle). */
  const thump = () => {
    if (reduced) return;
    thumpLeft = SHAKE.thumpMs;
  };

  // ---- Layout ----
  const aspectOf = (t: Texture) => t.width / Math.max(1, t.height);
  const place = (s: Sprite, r: { x: number; y: number; w: number; h: number }) => {
    s.anchor.set(0, 0);
    s.position.set(r.x, r.y);
    s.width = r.w;
    s.height = r.h;
  };

  /** Display scale of a pose's texture. */
  const poseScale = (a: PoseArt): number => {
    let scale = L.dwarf.bodyH * a.k;
    const maxW = SCENE_PLACE.dwarf.maxW * SCENE_PLACE.dwarf.maxWide * W;
    if (a.tex.width * scale > maxW) scale = maxW / a.tex.width;
    return scale;
  };

  const placeDwarf = () => {
    const a = poseArt(pose);
    const scale = poseScale(a);
    dwarf.texture = a.tex;
    dwarf.anchor.set(a.foot.x, a.foot.y);
    const breathe = pose === 'idle' && !reduced ? 1 + 0.008 * Math.sin(time / 650) : 1;
    // A nod: he dips a little and leans in toward the anvil.
    dwarf.scale.set(scale, scale * breathe * (1 - DONE_POSE.nod * nod));
    dwarf.rotation = reduced ? 0 : (a.tilt ?? 0) + DONE_POSE.nodTilt * nod;
    // A pose that reaches back (the raised hammer) steps in so it stays inside the scene's left edge.
    const left = a.foot.x * a.tex.width * scale;
    dwarf.position.set(Math.max(L.dwarf.x + lean, left + 2), L.dwarf.y);
  };

  /**
   * How far the dwarf leans so the strike pose's hammer (or the work pose's whetstone) meets the
   * iron: the hammer on the bar's middle, the whetstone at its left end.
   */
  const lungeFor = (p: DwarfPose): number => {
    if (reduced) return 0;
    const a = poseArt(p);
    const tip = a.hammer ?? a.reach;
    if (tip === undefined) return 6 * unit();
    const scale = poseScale(a);
    const dx = (tip.x - a.foot.x) * a.tex.width * scale;
    const dy = (tip.y - a.foot.y) * a.tex.height * scale;
    const tilt = a.tilt ?? 0;
    const tipX = L.dwarf.x + dx * Math.cos(tilt) - dy * Math.sin(tilt);
    const want = (a.hammer !== undefined ? L.iron.x - L.iron.w * STRIKE_AT : L.iron.x - L.iron.w * SCENE_PLACE.workReach) - tipX;
    const max = SCENE_PLACE.lunge * W;
    return Math.max(-max, Math.min(max, want));
  };

  /** The finished weapon lies across the anvil, tip to the right (layout.ts WEAPON_ART). */
  const weaponLen = () => L.anvil.w * WEAPON_ART[shownWeapon].len;
  const placeWeapon = () => {
    const t = weapon.texture;
    const art = WEAPON_ART[shownWeapon];
    const pic = weaponPic.has(shownWeapon);
    const from = pic ? art.from : WEAPON_STANDIN.from;
    const to = pic ? art.to : WEAPON_STANDIN.to;
    const flip = pic && art.flip === true ? -1 : 1;
    // The butt→tip line in picture pixels, after the mirror.
    const dx = (to.x - from.x) * t.width * flip;
    const dy = (to.y - from.y) * t.height;
    const len = weaponLen();
    const k = len / Math.max(1, Math.hypot(dx, dy));
    weapon.anchor.set((from.x + to.x) / 2, (from.y + to.y) / 2);
    weapon.scale.set(k * flip, k);
    weapon.rotation = WEAPON_REST.tilt - Math.atan2(dy, dx);
    // Over the anvil's face, the hilt on the anvil clear of his beard (layout.ts weaponRest).
    const rest = weaponRest(L, len);
    weapon.position.set(rest.x, rest.y);
    sunS.position.copyFrom(weapon.position);
    sunS.scale.set((len * 1.9) / sunS.texture.width);
  };
  const showWeapon = (type: WeaponType) => {
    if (shownWeapon === type && weapon.texture === weaponFor(type)) return;
    shownWeapon = type;
    weapon.texture = weaponFor(type);
    placeWeapon();
  };

  /** The bar picture's scale (the bar, not its sparkles, is L.iron.w wide). */
  const ironScale = () => {
    const bar = PROP_ART.iron.bar;
    return L.iron.w / ((bar.x1 - bar.x0) * ironTex.width);
  };
  /** The flame's size: its base width and height at this power. */
  const placeFire = (power: number, flicker: number) => {
    const f = PROP_ART.furnace.flame;
    const fw = f.w * L.furnace.w * (1 + f.grow * (power - 1));
    const fh = f.h * L.furnace.h * power;
    flameS.width = fw * (1 - flicker * 0.4);
    flameS.height = fh * (1 + flicker);
    flameCore.width = fw * 0.5 * (1 + flicker * 0.3);
    flameCore.height = fh * 0.58 * (1 - flicker * 0.6);
    // The core sits inside the flame's line, clear of its bottom edge.
    flameCore.position.set(flameS.x, flameS.y - fh * 0.08);
  };

  const relayout = () => {
    L = sceneLayout(W, H, {
      bg_workshop: aspectOf(bgTex),
      anvil: aspectOf(anvilTex),
      furnace: aspectOf(furnaceTex),
      bellows: aspectOf(bellowsTex),
      quench: aspectOf(quenchTex),
      iron_hot: aspectOf(ironTex),
      ...(pics.dwarf_strike !== undefined ? { dwarf_strike: aspectOf(pics.dwarf_strike) } : {}),
    });
    const cover = Math.max(W / bgTex.width, H / bgTex.height);
    bg.scale.set(cover);
    bg.position.set(W / 2, H / 2);
    place(furnace, L.furnace);
    place(anvil, L.anvil);
    place(bellows, L.bellows);
    place(quench, L.quench);
    // Bellows squeeze around their nozzle side: pivot at the board hinge (left middle).
    bellows.pivot.set(0, bellows.texture.height * 0.5);
    bellows.position.set(L.bellows.x, L.bellows.y + L.bellows.h * 0.5);
    // The painted-out flames lie over the furnace picture exactly.
    place(mouthS, L.furnace);
    const fl = PROP_ART.furnace.flame;
    flameS.position.set(L.furnace.x + fl.x * L.furnace.w, L.furnace.y + fl.y * L.furnace.h);
    placeFire(FIRE_FLAME[shownFire].power, 0);
    ironHome = { x: L.iron.x, y: L.iron.y };
    ironGroup.position.set(ironHome.x, ironHome.y);
    // The bar's middle sits on the group's origin; the picture around it hangs off that point.
    const bar = PROP_ART.iron.bar;
    const ax = (bar.x0 + bar.x1) / 2;
    const ay = (bar.y0 + bar.y1) / 2;
    const ik = ironScale();
    iron.anchor.set(ax, ay);
    iron.scale.set(ik);
    if (crackedTex !== null && halfTex !== null) {
      // Each half hangs off the bar's middle, as the whole picture does.
      const k = (ik * ironTex.width) / crackedTex.width;
      crackL.anchor.set(ax / halfTex.cut, ay);
      crackR.anchor.set((ax - halfTex.cut) / (1 - halfTex.cut), ay);
      crackL.scale.set(k);
      crackR.scale.set(k);
    }
    if (coldTex !== null) {
      cold.anchor.set(ax, ay);
      cold.scale.set((ik * ironTex.width) / coldTex.width);
    }
    crackS.scale.set((L.iron.w * 0.9) / crackS.texture.width, (L.iron.h * 1.3) / crackS.texture.height);
    runes.position.set(L.face.x, L.face.y - L.iron.h * 0.2);
    placeWeapon();
    placeDwarf();
    opts.onLayout(L);
  };

  // ---- Resting state ----
  /** The bar's flat colour: its heat's, cooled toward grey, lit up by a blow, soaked by a metal. */
  const tintIron = () => {
    const heat = Math.max(0, Math.min(HEAT_TINT.length - 1, Math.round(shownHeat)));
    let c = HEAT_TINT[heat] as number;
    if (finished === 'broken' || finished === 'abandoned') c = IRON_COLD;
    c = mixColor(c, IRON_COLD, ironCool * 0.85);
    c = mixColor(c, metalTint, metal * 0.75);
    c = mixColor(c, ironFlashTint, ironFlash * 0.7);
    iron.tint = c;
  };
  /** The split bar's halves parted by k (0 = whole, 1 = apart as it rests): IRON_SPLIT. */
  const partHalves = (k: number) => {
    const gap = IRON_SPLIT.gap * L.iron.w * k;
    crackL.position.set(-gap / 2, 0);
    crackR.position.set(gap / 2, 0);
    crackR.rotation = IRON_SPLIT.tilt * k;
  };
  /** He cheers over a fine weapon; over a plainer one he looks at it quietly (DONE_POSE). */
  const cheersFor = (tier: QualityTier) => tier >= DONE_POSE.cheerFrom;
  /** The resting anvil: the bar (hot, split, put down cold) or the finished weapon, as the craft stands. */
  const refreshIron = () => {
    tintIron();
    const split = finished === 'broken' && halfTex !== null;
    const putDown = finished === 'abandoned' && coldTex !== null;
    iron.visible = finished !== 'weapon' && !split && !putDown;
    cracked.alpha = split ? 1 : 0;
    partHalves(split ? 1 : 0);
    cold.alpha = putDown ? 1 : 0;
    crackS.alpha = finished === 'broken' && !split ? 1 : 0;
    crackS.tint = FX_COLOR.crack;
    weapon.alpha = finished === 'weapon' ? 1 : 0;
    weapon.visible = finished === 'weapon';
    sun = finished === 'weapon' && (state.tier === 5 || state.legendary) ? 1 : 0;
  };

  const settle = () => {
    shownHeat = state.heat;
    shownFire = state.fire;
    finished = state.status === 'success' ? 'weapon' : state.status === 'failed' ? (state.abandoned ? 'abandoned' : 'broken') : 'none';
    showWeapon(state.weaponType);
    pose = finished === 'weapon' ? (cheersFor(state.tier) ? 'cheer' : 'idle') : finished === 'none' ? 'idle' : 'slump';
    lean = 0;
    nod = 0;
    ironGroup.position.set(ironHome.x, ironHome.y);
    ironGroup.scale.set(1);
    ironGroup.alpha = 1;
    ironGroup.rotation = 0;
    iron.alpha = 1;
    bellows.scale.set(L.bellows.w / bellows.texture.width, L.bellows.h / bellows.texture.height);
    glint.alpha = 0;
    runes.alpha = 0;
    refreshIron();
    placeDwarf();
  };

  // ---- Runners ----
  const timingFor = (k: keyof typeof FX_TIMING): FxTiming => FX_TIMING[k];
  const ironPoint = () => ({ x: ironGroup.x, y: ironGroup.y });
  /** Where the hammer meets the bar: its top, a little left of the middle. */
  const hitPoint = () => ({ x: ironGroup.x - L.iron.w * STRIKE_AT, y: ironGroup.y - L.iron.h * 0.5 });

  const runners: Record<Motion, (step: PlayFx) => Runner> = {
    strike: (step) => {
      // A legendary material: he raises slowly while the iron takes the metal's colour, then the heaviest blow.
      const big = step.legendary;
      const timing = timingFor(big ? 'strikeBig' : 'strike');
      const h = timing.hit;
      const reach = lungeFor('strike');
      // A big printed blow (크게 내려치기, 거인의 망치 …) shakes harder.
      const heavy = step.cost >= 5;
      const tint = (step.material !== null ? METAL_TINT[step.material] : undefined) ?? FX_COLOR.metalDefault.strike;
      return {
        timing,
        update: (t) => {
          if (big && t < h) {
            metalTint = tint;
            metal = Math.max(metal, 0.6 + 0.3 * Math.sin(t * Math.PI * 3));
          }
          if (t < h - 0.1) {
            pose = 'raise';
            lean = lerp(0, -4 * unit(), easeOut(t / (h - 0.1)));
          } else if (t < h + 0.32) {
            pose = 'strike';
            lean = lerp(-4 * unit(), reach, easeOut(span(t, h - 0.1, h)));
          } else {
            pose = 'idle';
            lean = lerp(reach, 0, easeOut(span(t, h + 0.32, 1)));
          }
        },
        impact: () => {
          const p = hitPoint();
          const u = unit();
          impact(p.x, p.y, (big ? 120 : heavy ? 92 : 70) * u, FX_COLOR.impact, big ? 380 : 300);
          sparks(p.x, p.y, big ? 30 : heavy ? 22 : 15, FX_COLOR.spark, big ? 1.35 : heavy ? 1.2 : 1);
          // The metal's own colour flies off a legendary blow too.
          if (big) twinkles(p.x, p.y - L.iron.h, L.iron.w * 1.6, 10, [tint, 0xffffff], 1.3);
          ironFlash = 1;
          ironFlashTint = FX_COLOR.flash.strike;
          if (big) {
            // Dust off the stump and one low drop of the whole room, instead of a longer rattle.
            clouds(L.anvil.x + L.anvil.w * 0.55, L.anvil.y + L.anvil.h * 0.9, 5, FX_COLOR.smoke, 0.3, L.anvil.w * 0.4);
            thump();
          }
          shake(heavy || big ? SHAKE.heavy : SHAKE.strike);
        },
        end: () => {
          pose = 'idle';
          lean = 0;
        },
      };
    },
    polish: () => {
      const timing = timingFor('polish');
      const reach = lungeFor('work');
      let twinkled = 0;
      return {
        timing,
        update: (t) => {
          pose = t > 0.05 && t < 0.86 ? 'work' : 'idle';
          lean = reach * easeOut(span(t, 0, 0.2)) * (1 - easeIn(span(t, 0.8, 1)));
          // A ✦ glint slides along the bar's top edge.
          const k = span(t, 0.22, 0.78);
          const size = L.iron.h * 2.2 * Math.sin(k * Math.PI);
          glint.alpha = k > 0 && k < 1 ? 1 : 0;
          glint.tint = 0xffffff;
          glint.position.set(ironGroup.x - L.iron.w * 0.42 + L.iron.w * 0.84 * k, ironGroup.y - L.iron.h * 0.35);
          glint.scale.set(Math.max(0.001, size / glint.texture.width));
          glint.rotation = reduced ? 0 : k * 1.2;
          if (twinkled === 0 && t > 0.25) {
            twinkled = 1;
            twinkles(ironGroup.x, ironGroup.y - L.iron.h, L.iron.w, 4, FX_COLOR.silver);
          }
        },
        impact: () => {
          twinkles(ironGroup.x, ironGroup.y - L.iron.h, L.iron.w * 1.2, 9, FX_COLOR.silver);
          ironFlash = 0.7;
          ironFlashTint = FX_COLOR.flash.polish;
        },
        end: () => {
          pose = 'idle';
          lean = 0;
          glint.alpha = 0;
        },
      };
    },
    finish: () => {
      const timing = timingFor('finish');
      const h = timing.hit;
      const reach = lungeFor('strike') * 0.7;
      return {
        timing,
        update: (t) => {
          if (t < h - 0.1) pose = 'raise';
          else if (t < h + 0.3) pose = 'strike';
          else pose = 'idle';
          lean = t < h ? lerp(0, reach, easeIn(span(t, h - 0.1, h))) : lerp(reach, 0, easeOut(span(t, h + 0.3, 1)));
          if (t >= h) {
            // One long ✦ glint across the bar.
            const k = span(t, h, 1);
            glint.alpha = k < 1 ? 1 : 0;
            glint.tint = FX_COLOR.gold[1];
            glint.position.set(ironGroup.x - L.iron.w * 0.45 + L.iron.w * 0.9 * easeOut(k), ironGroup.y - L.iron.h * 0.4);
            glint.scale.set(Math.max(0.001, (L.iron.h * 3 * Math.sin(k * Math.PI)) / glint.texture.width));
            glint.rotation = 0;
          }
        },
        impact: () => {
          const p = hitPoint();
          impact(p.x, p.y, 76 * unit(), FX_COLOR.gold[1], 320);
          twinkles(p.x, p.y - L.iron.h, L.iron.w * 1.4, 14, FX_COLOR.gold, 1.15);
          sparks(p.x, p.y, 8, FX_COLOR.gold, 0.8);
          ironFlash = 1;
          ironFlashTint = FX_COLOR.flash.finish;
          shake(SHAKE.strike);
        },
        end: () => {
          pose = 'idle';
          lean = 0;
          glint.alpha = 0;
        },
      };
    },
    bellows: () => {
      const timing = timingFor('bellows');
      let puffed = false;
      return {
        timing,
        update: (t) => {
          const squeeze = pulse(t, 0, 0.62);
          bellows.scale.set(
            (L.bellows.w / bellows.texture.width) * (1 + 0.05 * squeeze),
            (L.bellows.h / bellows.texture.height) * (1 - (reduced ? 0.12 : 0.28) * squeeze),
          );
          if (!puffed && t > 0.18) {
            puffed = true;
            // Puffs of air from the nozzle into the fire, one after another.
            const u = unit();
            for (let i = 0; i < count(3); i++) {
              spawn(smokeLayer, tex.cloud, {
                x: L.nozzle.x - i * 4 * u,
                y: L.nozzle.y,
                vx: (L.mouth.x - L.nozzle.x) * rand(1.6, 2.2) * (1 - i * 0.15),
                vy: (L.mouth.y - L.nozzle.y) * rand(1.6, 2.2) - rand(10, 30) * u,
                life: rand(380, 520),
                size: rand(17, 23) * u,
                sizeEnd: rand(30, 36) * u,
                tint: FX_COLOR.wind,
                spin: rand(-1, 1),
                popIn: 0.2,
              });
            }
          }
        },
        impact: () => {
          // The fire leaps up for a moment, throwing embers.
          fireFlare = Math.max(fireFlare, 1.6);
          embers(L.mouth.x, L.mouth.y, 16, L.furnace.w * 0.14);
          ironFlash = 0.4;
          ironFlashTint = FX_COLOR.flash.bellows;
        },
        end: () => {
          bellows.scale.set(L.bellows.w / bellows.texture.width, L.bellows.h / bellows.texture.height);
        },
      };
    },
    quench: () => {
      // The bar dips into the tub and comes back cold: the steam and the drops rise off the water.
      const timing = timingFor('quench');
      const D = QUENCH_DIP;
      return {
        timing,
        update: (t) => {
          if (reduced) {
            ironGroup.alpha = t > 0.15 && t < 0.75 ? 0 : 1;
            return;
          }
          const k = t < D.back ? easeOut(span(t, 0, D.out)) : 1 - easeOut(span(t, D.back, 0.92));
          const lift = Math.sin(k * Math.PI) * L.anvil.h * D.lift;
          // Just under the water, behind the front of the tub (drawn over it).
          ironGroup.position.set(lerp(ironHome.x, L.water.x, k), lerp(ironHome.y, L.water.y + L.iron.h, k) - lift);
          ironGroup.scale.set(lerp(1, D.scale, k));
          ironGroup.alpha = t > D.out - 0.02 && t < D.back ? 0 : 1;
        },
        impact: () => {
          const p = L.water;
          clouds(p.x, p.y - L.iron.h, 7, FX_COLOR.steam, 1, L.quench.w * 0.3);
          ironCool = 1;
          const u = unit();
          for (let i = 0; i < count(8); i++) {
            spawn(fxLayer, tex.drop, {
              x: p.x + rand(-L.quench.w * 0.25, L.quench.w * 0.25),
              y: p.y,
              vx: rand(-70, 70) * u,
              vy: rand(-230, -130) * u,
              ay: 640 * u,
              life: rand(420, 640),
              size: rand(11, 15) * u,
              sizeEnd: 7 * u,
              tint: FX_COLOR.water,
              align: true,
            });
          }
        },
        end: () => {
          ironGroup.position.set(ironHome.x, ironHome.y);
          ironGroup.scale.set(1);
          ironGroup.alpha = 1;
        },
      };
    },
    infuse: (step) => {
      const big = step.legendary;
      const timing = timingFor(big ? 'infuseBig' : 'infuse');
      const tint = (step.material !== null ? METAL_TINT[step.material] : undefined) ?? FX_COLOR.metalDefault.infuse;
      let started = false;
      return {
        timing,
        update: (t) => {
          if (!started) {
            started = true;
            const p = ironPoint();
            converge(p.x, p.y, big ? 18 : 10, tint, L.iron.w * (big ? 1.2 : 0.9), timing.ms * timing.hit * (reduced ? FX_REDUCED : 1));
          }
          metalTint = tint;
          metal = Math.max(metal, 0.8 * easeIn(span(t, 0, timing.hit)));
          if (big) sun = Math.max(finished === 'weapon' ? sun : 0, 0.7 * pulse(t, 0.3, 1));
        },
        impact: () => {
          const p = ironPoint();
          metal = 1;
          twinkles(p.x, p.y - L.iron.h, L.iron.w, big ? 14 : 7, [tint, 0xffffff], big ? 1.3 : 1);
          if (big) {
            impact(p.x, p.y - L.iron.h * 0.5, 110 * unit(), mixColor(FX_COLOR.impact, tint, 0.35), 400);
            shake(SHAKE.strike);
          }
        },
        end: () => {
          if (finished !== 'weapon') sun = 0;
        },
      };
    },
    fire: () => {
      const timing = timingFor('fire');
      return {
        timing,
        update: () => {},
        impact: () => {
          fireFlare = Math.max(fireFlare, 1.3);
          embers(L.mouth.x, L.mouth.y, 12, L.furnace.w * 0.15);
        },
        end: () => {},
      };
    },
    focus: () => {
      const timing = timingFor('focus');
      let shown = false;
      return {
        timing,
        update: (t) => {
          if (!shown && t > 0.1) {
            shown = true;
            twinkles(L.dwarf.x, L.dwarf.y - L.dwarf.bodyH * 0.95, L.dwarf.bodyH * 0.6, 4, FX_COLOR.gold);
          }
        },
        impact: () => {
          twinkles(L.dwarf.x, L.dwarf.y - L.dwarf.bodyH * 0.9, L.dwarf.bodyH * 0.7, 6, FX_COLOR.gold, 1.1);
        },
        end: () => {},
      };
    },
  };

  const stepRunner = (step: FxStep): { parts: Part[]; beatMs: number } => {
    const scale = reduced ? FX_REDUCED : 1;
    const one = (r: Runner): Part => ({ runner: r, offsetMs: 0, ms: r.timing.ms * scale, hitDone: false, ended: false });
    switch (step.kind) {
      case 'play': {
        const list = step.motions.map((m) => runners[m](step));
        const first = list[0];
        if (first === undefined) return { parts: [], beatMs: 0 };
        const partsOut: Part[] = [one(first)];
        const second = list[1];
        if (second !== undefined) {
          // A legendary material's own motion waits for its metal to soak in, and its blow brings the numbers.
          const at = step.legendary ? FX_LEGENDARY_STRIKE_AT : FX_SECOND_AT;
          const offsetMs = first.timing.ms * scale * at;
          partsOut.push({ ...one(second), offsetMs });
          if (step.legendary) return { parts: partsOut, beatMs: offsetMs + second.timing.ms * scale * second.timing.hit };
        }
        return { parts: partsOut, beatMs: first.timing.ms * scale * first.timing.hit };
      }
      case 'imprint': {
        const timing = timingFor('imprint');
        const r: Runner = {
          timing,
          update: (t) => {
            runes.tint = FX_COLOR.rune[0];
            runes.alpha = t > 0 && t < 0.95 ? 1 : 0;
            const k = easeBack(span(t, 0, 0.3)) * (1 - easeIn(span(t, 0.75, 0.95)));
            runes.scale.set(Math.max(0.001, (L.anvil.w * 0.95 * k) / runes.texture.width), Math.max(0.001, (L.anvil.w * 0.38 * k) / runes.texture.width));
            runes.rotation = 0;
          },
          impact: () => {
            twinkles(runes.x, runes.y - L.iron.h, L.anvil.w * 0.8, 10, FX_COLOR.rune);
          },
          end: () => {
            runes.alpha = 0;
          },
        };
        return { parts: [one(r)], beatMs: timing.ms * scale * timing.hit };
      }
      case 'reheat': {
        const timing = timingFor('reheat');
        const r: Runner = {
          timing,
          update: (t) => {
            if (reduced) {
              ironGroup.alpha = t > 0.1 && t < 0.9 ? 0 : 1;
              return;
            }
            const out = easeOut(span(t, 0, 0.34));
            const back = easeOut(span(t, 0.58, 0.92));
            const k = t < 0.58 ? out : 1 - back;
            const lift = Math.sin(k * Math.PI) * -L.furnace.h * 0.15;
            ironGroup.position.set(lerp(ironHome.x, L.mouth.x, k), lerp(ironHome.y, L.mouth.y, k) + (t < 0.58 ? lift : lift * 0.5));
            ironGroup.scale.set(lerp(1, 0.55, k));
            // In the fire it is gone from sight (a flat shape does not half-fade): hidden at the mouth.
            ironGroup.alpha = t > 0.3 && t < 0.6 ? 0 : 1;
            if (t > 0.34 && t < 0.58) fireFlare = Math.max(fireFlare, 0.8);
          },
          impact: () => {
            embers(L.mouth.x, L.mouth.y, 8, L.furnace.w * 0.12);
            ironFlash = 0.6;
            ironFlashTint = FX_COLOR.flash.reheat;
            ironCool = 0;
          },
          end: () => {
            ironGroup.position.set(ironHome.x, ironHome.y);
            ironGroup.scale.set(1);
            ironGroup.alpha = 1;
          },
        };
        return { parts: [one(r)], beatMs: timing.ms * scale * timing.hit };
      }
      case 'turn': {
        const timing = timingFor(step.fireChanged ? 'turnFire' : 'turn');
        const r: Runner = {
          timing,
          update: () => {},
          impact: () => {
            if (step.fireChanged) {
              fireFlare = Math.max(fireFlare, 0.9);
              embers(L.mouth.x, L.mouth.y, 8, L.furnace.w * 0.15);
            }
          },
          end: () => {},
        };
        return { parts: [one(r)], beatMs: timing.ms * scale * timing.hit };
      }
      case 'shuffle':
        return { parts: [], beatMs: 0 };
      case 'complete': {
        const big = step.tier === 5 || step.legendary;
        const timing = timingFor(big ? 'completeBig' : 'complete');
        const h = timing.hit;
        const reach = lungeFor('strike');
        showWeapon(step.weaponType);
        const cheers = cheersFor(step.tier);
        let starred = false;
        const r: Runner = {
          timing,
          update: (t) => {
            if (t < h - 0.1) pose = 'raise';
            else if (t < h + 0.16) pose = 'strike';
            else pose = cheers ? 'cheer' : 'idle';
            nod = cheers || reduced ? 0 : pulse(t, DONE_POSE.nodAt, DONE_POSE.nodTo);
            lean = t < h ? lerp(0, reach, easeIn(span(t, h - 0.1, h))) : lerp(reach, 0, easeOut(span(t, h + 0.16, h + 0.4)));
            if (t >= h) {
              // The bar is gone, the weapon pops up in its place.
              const s = Math.max(0.05, easeBack(span(t, h, h + 0.16)));
              weapon.visible = true;
              weapon.alpha = 1;
              ironGroup.alpha = 0;
              placeWeapon();
              weapon.scale.set(weapon.scale.x * s, weapon.scale.y * s);
              if (big) sun = Math.max(sun, easeOut(span(t, h + 0.05, h + 0.3)));
              if (!starred && t > h + 0.2) {
                starred = true;
                twinkles(weapon.x, weapon.y - L.anvil.h * 0.2, weaponLen(), big ? 16 : 8, FX_COLOR.gold, big ? 1.5 : 1.15);
              }
            }
          },
          impact: () => {
            const p = hitPoint();
            impact(p.x, p.y, (big ? 140 : 96) * unit(), FX_COLOR.gold[1], big ? 460 : 360);
            sparks(p.x, p.y, big ? 26 : 16, FX_COLOR.gold, 1.15);
            twinkles(p.x, p.y - L.iron.h, L.anvil.w * 1.2, big ? 16 : 8, FX_COLOR.gold, big ? 1.45 : 1.1);
            fireFlare = Math.max(fireFlare, big ? 1.4 : 0.9);
            shake(SHAKE.strike);
          },
          end: () => {
            finished = 'weapon';
            nod = 0;
            ironGroup.alpha = 1;
            placeWeapon();
            refreshIron();
          },
        };
        return { parts: [one(r)], beatMs: timing.ms * scale * timing.hit };
      }
      case 'break': {
        const timing = timingFor('break');
        const h = timing.hit;
        const r: Runner = {
          timing,
          update: (t) => {
            pose = t < h + 0.12 ? 'idle' : 'slump';
            lean = 0;
            if (t >= h) {
              const k = span(t, h, 1);
              ironCool = Math.max(ironCool, easeOut(k));
              tintIron();
              if (!step.abandoned && halfTex !== null) {
                // The split bar comes in with a little jolt, and its halves part.
                cracked.alpha = 1;
                iron.alpha = 0;
                partHalves(reduced ? 1 : easeOut(span(t, h, h + IRON_SPLIT.part)));
                ironGroup.rotation = reduced ? 0 : 0.05 * Math.sin(span(t, h, h + 0.25) * Math.PI * 3) * (1 - span(t, h, h + 0.25));
              } else if (!step.abandoned) {
                crackS.alpha = 1;
              } else if (coldTex !== null && span(t, h, h + 0.15) >= 1) {
                // Put down: once its colour has gone, the cold bar (no sparkle, no shine).
                cold.alpha = 1;
                iron.alpha = 0;
              }
            }
          },
          impact: () => {
            const p = ironPoint();
            if (!step.abandoned) {
              impact(p.x, p.y - L.iron.h * 0.3, 60 * unit(), FX_COLOR.crack, 260);
              sparks(p.x, p.y - L.iron.h * 0.5, 6, FX_COLOR.crackSparks, 0.6);
              shake(SHAKE.break);
            }
            clouds(p.x, p.y - L.iron.h * 0.6, step.abandoned ? 3 : 5, FX_COLOR.smoke, 0.6, L.iron.w * 0.3);
          },
          end: () => {
            finished = step.abandoned ? 'abandoned' : 'broken';
            iron.alpha = 1;
            ironGroup.rotation = 0;
            refreshIron();
          },
        };
        return { parts: [one(r)], beatMs: timing.ms * scale * timing.hit };
      }
    }
  };

  // ---- Queue ----
  const startNext = () => {
    const step = queue.shift();
    if (step === undefined) {
      running = null;
      settle();
      opts.onIdle();
      return;
    }
    const { parts: list, beatMs } = stepRunner(step);
    const total = list.reduce((m, p) => Math.max(m, p.offsetMs + p.ms), 0);
    running = { step, parts: list, elapsed: 0, total, beatMs, beatDone: false };
  };

  const beat = (step: FxStep) => {
    shownHeat = step.snap.heat;
    shownFire = step.snap.fire;
    tintIron();
    opts.onBeat(step);
  };

  const advance = (dt: number) => {
    let budget = dt;
    // Zero-length steps (shuffle) resolve in the same frame.
    for (let guard = 0; guard < 64 && running !== null; guard++) {
      const r = running;
      // Only the player's later actions hurry the show: a reheat's own turn, or the 완성 after
      // the last blow, are part of the same action and wait their turn at full length.
      const waiting = queue.reduce((n, s) => n + (s.kind === 'play' || s.kind === 'reheat' ? 1 : 0), 0);
      const rate = Math.min(FX_SPEEDUP.max, 1 + FX_SPEEDUP.per * waiting);
      r.elapsed += budget * rate;
      budget = 0;
      for (const p of r.parts) {
        if (p.ended) continue;
        const local = (r.elapsed - p.offsetMs) / Math.max(1, p.ms);
        if (local < 0) continue;
        p.runner.update(Math.min(1, local));
        if (!p.hitDone && local >= p.runner.timing.hit) {
          p.hitDone = true;
          p.runner.impact();
        }
        if (local >= 1) {
          p.ended = true;
          p.runner.end();
        }
      }
      if (!r.beatDone && r.elapsed >= r.beatMs) {
        r.beatDone = true;
        beat(r.step);
      }
      if (r.elapsed >= r.total) {
        for (const p of r.parts) {
          if (!p.hitDone) p.runner.impact();
          if (!p.ended) p.runner.end();
        }
        if (!r.beatDone) beat(r.step);
        startNext();
        continue;
      }
      break;
    }
  };

  // ---- Frame ----
  const tick = () => {
    const dt = Math.min(64, app.ticker.deltaMS);
    time += dt;
    advance(dt);
    // The fire: its flat flame breathes; a flare (bellows, a new state) makes it leap.
    const fire = FIRE_FLAME[shownFire];
    const flicker = reduced ? 0 : Math.sin(time / 110) * 0.05 + Math.sin(time / 47) * 0.03;
    const power = fire.power * (state.stoked ? 1.12 : 1) * (1 + fireFlare * 0.5);
    fireFlare *= Math.exp(-dt / 380);
    flameS.tint = fire.color;
    flameCore.tint = mixColor(fire.color, 0xffffff, 0.6);
    placeFire(power, flicker);
    emberDebt += (dt / 1000) * (reduced ? 0.5 : 1.2 * power);
    while (emberDebt >= 1) {
      emberDebt -= 1;
      embers(L.mouth.x, L.mouth.y - L.furnace.h * 0.08, 1, L.furnace.w * 0.1);
    }
    // The bar's colour settles back after a blow, a quench, a metal.
    if (ironFlash > 0 || ironCool > 0 || metal > 0) {
      ironFlash *= Math.exp(-dt / 120);
      metal *= Math.exp(-dt / 520);
      ironCool *= Math.exp(-dt / 700);
      if (ironFlash < 0.02) ironFlash = 0;
      if (metal < 0.02) metal = 0;
      if (ironCool < 0.02) ironCool = 0;
      tintIron();
    }
    // The sunburst behind a 걸작 turns slowly.
    sunS.alpha = sun * 0.55;
    if (sun > 0 && !reduced) sunS.rotation += dt / 9000;
    // Shake, and the legendary blow's low drop (down, a small rebound, settle).
    let dropY = 0;
    if (thumpLeft > 0) {
      thumpLeft = Math.max(0, thumpLeft - dt);
      const u = 1 - thumpLeft / SHAKE.thumpMs;
      dropY = SHAKE.thump * unit() * Math.exp(-u * 4.2) * Math.cos(u * Math.PI * 2.5);
    }
    if (shakeLeft > 0) {
      shakeLeft -= dt;
      const k = Math.max(0, shakeLeft / SHAKE.ms);
      world.position.set(rand(-1, 1) * shakeAmp * k, rand(-1, 1) * shakeAmp * k + dropY);
      if (shakeLeft <= 0) shakeAmp = 0;
    } else {
      world.position.set(0, dropY);
    }
    stepParticles(dt);
    stepPops(dt);
    placeDwarf();
  };

  relayout();
  settle();
  app.ticker.add(tick);

  return {
    resize(w, h) {
      if (destroyed) return;
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      lease.resize(W, H);
      relayout();
      if (running === null) settle();
    },
    setView(v) {
      Object.assign(state, v);
      if (running === null && queue.length === 0) settle();
    },
    enqueue(steps) {
      if (destroyed) return;
      queue.push(...steps);
      if (running === null) startNext();
    },
    skip() {
      // Steps that had not landed yet still land (their lines, the ★ mark, the end), without effects.
      const unlanded: FxStep[] = [];
      if (running !== null) {
        for (const p of running.parts) {
          if (!p.ended) p.runner.end();
        }
        if (!running.beatDone) unlanded.push(running.step);
      }
      unlanded.push(...queue);
      queue.length = 0;
      running = null;
      fireFlare = 0;
      thumpLeft = 0;
      for (const step of unlanded) opts.onBeat(step, true);
      settle();
      opts.onIdle();
    },
    busy() {
      return running !== null || queue.length > 0;
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
      // The split bar's halves share the loaded picture's source: only the frames go.
      for (const t of subTex) t.destroy(false);
    },
  };
}
