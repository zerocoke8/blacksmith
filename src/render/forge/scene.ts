// The forge scene (PixiJS): workshop, dwarf, anvil and hot iron, furnace, bellows, quench tub,
// and the effects a card's result plays out. It only shows what the engine already computed
// (CLAUDE.md 규칙 2): steps come from fx.ts, and when the queue runs dry the scene settles on
// the latest engine view. Loaded with a dynamic import when the craft screen opens, so PixiJS
// never weighs on the first load.

import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';
import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import type { FireState } from '../../sim/data/cards.ts';
import { sceneArtUrl } from './assets.ts';
import type { FxStep, Motion, PlayFx } from './fx.ts';
import {
  type ArtPoint,
  DWARF_POSE_ART,
  DWARF_POSE_FALLBACK,
  type DwarfPose,
  FIRE_GLOW,
  FX_COLOR,
  FX_LEGENDARY_STRIKE_AT,
  FX_REDUCED,
  FX_SECOND_AT,
  FX_SPEEDUP,
  FX_TIMING,
  type FxTiming,
  HEAT_TINT,
  METAL_TINT,
  SCENE_ART_KEYS,
  SCENE_PLACE,
  type SceneArtKey,
  type SceneLayout,
  sceneLayout,
  SHAKE,
  WEAPON_ART,
  WEAPON_REST,
  WEAPON_STANDIN,
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
  /** A 열기 buff is on (풀무질 …): the fire breathes harder. */
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

const COLD_IRON = 0x6d6560;

// ---------- Particles ----------

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
  alpha0: number;
  spin: number;
  stretch: boolean;
  /** Share of the life spent fading in. */
  fadeIn: number;
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
  alpha?: number;
  tint: number;
  stretch?: boolean;
  spin?: number;
  fadeIn?: number;
}

const MAX_PARTICLES = 320;

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

async function loadTexture(url: string): Promise<Texture | null> {
  try {
    return await Assets.load<Texture>(url);
  } catch {
    return null;
  }
}

export async function createForgeScene(
  host: HTMLElement,
  width: number,
  height: number,
  opts: ForgeSceneOptions,
): Promise<ForgeScene> {
  const app = new Application();
  await app.init({
    width: Math.max(1, width),
    height: Math.max(1, height),
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: ['webgl'],
  });
  app.stage.eventMode = 'none';
  app.stage.interactiveChildren = false;
  const view = app.canvas;
  view.style.display = 'block';
  view.style.width = '100%';
  view.style.height = '100%';
  view.style.pointerEvents = 'none';

  // ---- Textures: pictures where they exist, stand-ins elsewhere ----
  const made: Texture[] = [];
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
      const t = await loadTexture(url);
      if (t !== null) pics[k] = t;
    }),
  );
  let destroyed = false;

  const tex = {
    dot: fromCanvas(draw.softDot(64)),
    glow: fromCanvas(draw.softDot(256, 0.02)),
    puff: fromCanvas(draw.puff(128)),
    shine: fromCanvas(draw.shineLine(256, 24)),
    rune: fromCanvas(draw.runeRing(256)),
    crack: fromCanvas(draw.crack(256, 80)),
    rays: fromCanvas(draw.rays(256)),
    vignette: fromCanvas(draw.vignette(256)),
  };
  const sceneTex = (k: SceneArtKey, make: () => HTMLCanvasElement): Texture => pics[k] ?? fromCanvas(make());
  const bgTex = sceneTex('bg_workshop', () => draw.background(600, 400));
  const anvilTex = sceneTex('anvil', () => draw.anvil(320, 280));
  const furnaceTex = sceneTex('furnace', () => draw.furnace(260, 330));
  const bellowsTex = sceneTex('bellows', () => draw.bellows(280, 200));
  const quenchTex = sceneTex('quench', () => draw.quench(250, 200));
  const ironTex = sceneTex('iron_hot', () => draw.ironBar(320, 100));
  const ironIsPicture = pics.iron_hot !== undefined;
  /** The painted cold, split bar for a broken iron; without it the drawn crack goes over the greyed hot bar. */
  const crackedTex = pics.iron_cracked ?? null;

  // Dwarf poses: a picture, else the next pose in the fallback chain, else a drawn stand-in.
  const anyDwarf = (['idle', 'raise', 'strike', 'work', 'cheer'] as const).some((p) => pics[`dwarf_${p}` as SceneArtKey] !== undefined);
  interface PoseArt {
    tex: Texture;
    foot: ArtPoint;
    head: number;
    hammer?: ArtPoint;
    reach?: ArtPoint;
    tilt?: number;
  }
  const poseCache = new Map<DwarfPose, PoseArt>();
  const poseArt = (p: DwarfPose): PoseArt => {
    const hit = poseCache.get(p);
    if (hit !== undefined) return hit;
    let out: PoseArt | null = null;
    // The pose's own picture, then its stand-in poses, then any dwarf picture there is.
    const chain: DwarfPose[] = [p, ...DWARF_POSE_FALLBACK[p], 'idle', 'raise', 'strike', 'work', 'cheer'];
    for (const q of anyDwarf ? chain : []) {
      const key = `dwarf_${q}` as SceneArtKey;
      const t = pics[key];
      if (t === undefined) continue;
      const meta = artMeta('scene', key);
      const base = DWARF_POSE_ART[q];
      out = {
        tex: t,
        foot: meta?.foot ?? base.foot,
        head: meta?.head ?? base.head,
        hammer: meta?.hammer ?? base.hammer,
        reach: base.reach,
        tilt: base.tilt,
      };
      break;
    }
    if (out === null) {
      // Drawn stand-in: the same anchors for every pose (procedural.ts dwarf()).
      out = {
        tex: fromCanvas(draw.dwarf(p, 220, 300)),
        foot: { x: 0.5, y: 0.985 },
        head: 0.02,
        hammer: p === 'strike' ? { x: 0.96, y: 0.52 } : undefined,
      };
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
      void loadTexture(url).then((pic) => {
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
  const sprite = (t: Texture, add = false): Sprite => {
    const s = new Sprite(t);
    if (add) s.blendMode = 'add';
    return s;
  };
  const world = new Container();
  app.stage.addChild(world);
  const bg = sprite(bgTex);
  const wallGlow = sprite(tex.glow, true);
  const furnace = sprite(furnaceTex);
  const mouthGlow = sprite(tex.glow, true);
  const bellows = sprite(bellowsTex);
  const quench = sprite(quenchTex);
  const anvil = sprite(anvilTex);
  const ironGroup = new Container();
  const ironGlow = sprite(tex.glow, true);
  const iron = sprite(ironTex);
  const ironFlash = sprite(ironTex, true);
  const metalGlow = sprite(tex.glow, true);
  const crackS = sprite(tex.crack);
  const cracked = sprite(crackedTex ?? Texture.EMPTY);
  const raysS = sprite(tex.rays, true);
  const weapon = sprite(weaponFor('oneHandSword'));
  const weaponGlow = sprite(tex.glow, true);
  ironGroup.addChild(ironGlow, metalGlow, iron, ironFlash, cracked, crackS);
  const runes = sprite(tex.rune, true);
  const dwarfGlow = sprite(tex.glow, true);
  const dwarf = new Sprite(poseArt('idle').tex);
  const smokeLayer = new Container();
  const addLayer = new Container();
  const shine = sprite(tex.shine, true);
  const flash = sprite(tex.glow, true);
  const vig = sprite(tex.vignette);
  // The dwarf stands a step behind the anvil (layout.ts SCENE_PLACE); the bellows and the tub stand in front.
  world.addChild(bg, wallGlow, furnace, mouthGlow, dwarfGlow, dwarf, raysS, anvil, weaponGlow, ironGroup, weapon, runes, bellows, quench, smokeLayer, addLayer, shine);
  app.stage.addChild(flash, vig);
  for (const s of [ironGlow, metalGlow, ironFlash, crackS, cracked, raysS, weapon, weaponGlow, runes, dwarfGlow, shine, flash]) s.alpha = 0;
  for (const s of [ironGlow, metalGlow, iron, ironFlash, crackS, cracked, raysS, weapon, weaponGlow, runes, dwarfGlow, shine, flash, mouthGlow, wallGlow])
    s.anchor.set(0.5);
  bg.anchor.set(0.5);

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
  let bow = 0;
  let fireFlare = 0;
  let shakeLeft = 0;
  let shakeAmp = 0;
  /** A low drop of the whole scene (legendary blow): ms left. */
  let thumpLeft = 0;
  let time = 0;
  let emberDebt = 0;
  let ironCool = 0;
  let ironHome = { x: 0, y: 0 };
  const queue: FxStep[] = [];
  let running: Running | null = null;
  const reduced = opts.reducedMotion;

  // ---- Particles ----
  const parts: Particle[] = [];
  const spawn = (layer: Container, t: Texture, o: Spawn, add = true): void => {
    let p = parts.find((x) => !x.live);
    if (p === undefined) {
      if (parts.length >= MAX_PARTICLES) {
        p = parts.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
      } else {
        const s = new Sprite(t);
        s.anchor.set(0.5);
        p = {
          s,
          vx: 0,
          vy: 0,
          ay: 0,
          drag: 0,
          life: 1,
          age: 0,
          size0: 1,
          size1: 1,
          alpha0: 1,
          spin: 0,
          stretch: false,
          fadeIn: 0,
          live: false,
        };
        parts.push(p);
      }
    }
    const s = p.s;
    if (s.parent !== layer) layer.addChild(s);
    s.texture = t;
    s.blendMode = add ? 'add' : 'normal';
    s.tint = o.tint;
    s.position.set(o.x, o.y);
    s.rotation = 0;
    s.visible = true;
    p.vx = o.vx;
    p.vy = o.vy;
    p.ay = o.ay ?? 0;
    p.drag = o.drag ?? 0;
    p.life = o.life;
    p.age = 0;
    p.size0 = o.size;
    p.size1 = o.sizeEnd ?? o.size;
    p.alpha0 = o.alpha ?? 1;
    p.spin = o.spin ?? 0;
    p.stretch = o.stretch ?? false;
    p.fadeIn = o.fadeIn ?? 0;
    p.live = true;
    s.alpha = p.fadeIn > 0 ? 0 : p.alpha0;
    const k = o.size / t.width;
    s.scale.set(k);
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
      const size = lerp(p.size0, p.size1, k);
      const base = size / p.s.texture.width;
      if (p.stretch) {
        const speed = Math.hypot(p.vx, p.vy);
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(base * (1 + Math.min(4, speed / 140)), base * 0.7);
      } else {
        p.s.rotation += p.spin * sec;
        p.s.scale.set(base);
      }
      const fade = p.fadeIn > 0 && k < p.fadeIn ? k / p.fadeIn : 1 - easeIn((k - p.fadeIn) / (1 - p.fadeIn));
      p.s.alpha = p.alpha0 * Math.max(0, fade);
    }
  };
  const count = (n: number) => Math.max(1, Math.round(reduced ? n * 0.4 : n));
  const unit = () => Math.max(0.6, Math.min(1.6, H / 380));

  const sparks = (x: number, y: number, n: number, colors: readonly number[], power = 1) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = rand(160, 420) * power * u;
      spawn(addLayer, tex.dot, {
        x: x + rand(-6, 6) * u,
        y: y + rand(-3, 3) * u,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        ay: 620 * u,
        drag: 1.2,
        life: rand(320, 700),
        size: rand(5, 9) * u,
        sizeEnd: 2 * u,
        tint: pick(colors),
        stretch: true,
      });
    }
  };
  const twinkles = (x: number, y: number, w: number, n: number, colors: readonly number[]) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      spawn(addLayer, tex.dot, {
        x: x + rand(-w / 2, w / 2),
        y: y + rand(-14, 10) * u,
        vx: rand(-14, 14),
        vy: rand(-40, -10) * u,
        life: rand(420, 820),
        size: rand(6, 13) * u,
        sizeEnd: 1,
        tint: pick(colors),
        fadeIn: 0.25,
      });
    }
  };
  const embers = (x: number, y: number, n: number, spread = 18) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      spawn(addLayer, tex.dot, {
        x: x + rand(-spread, spread) * u,
        y: y + rand(-6, 6) * u,
        vx: rand(-20, 20) * u,
        vy: rand(-120, -50) * u,
        ay: -20 * u,
        drag: 0.4,
        life: rand(700, 1400),
        size: rand(3, 7) * u,
        sizeEnd: 1,
        tint: pick(FX_COLOR.spark),
      });
    }
  };
  const puffs = (x: number, y: number, n: number, tint: number, alpha: number, rise: number) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      spawn(
        smokeLayer,
        tex.puff,
        {
          x: x + rand(-L.iron.w * 0.4, L.iron.w * 0.4),
          y: y + rand(-4, 4) * u,
          vx: rand(-18, 18) * u,
          vy: -rand(30, 70) * rise * u,
          drag: 0.6,
          life: rand(900, 1600),
          size: rand(28, 44) * u,
          sizeEnd: rand(80, 120) * u,
          alpha,
          tint,
          spin: rand(-0.6, 0.6),
          fadeIn: 0.15,
        },
        false,
      );
    }
  };
  const converge = (x: number, y: number, n: number, tint: number, radius: number, life: number) => {
    const u = unit();
    for (let i = 0; i < count(n); i++) {
      const a = rand(0, Math.PI * 2);
      const r = radius * rand(0.7, 1.1);
      const sec = life / 1000;
      spawn(addLayer, tex.dot, {
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * 0.6,
        vx: (-Math.cos(a) * r) / sec,
        vy: (-Math.sin(a) * r * 0.6) / sec,
        life,
        size: rand(6, 11) * u,
        sizeEnd: 3 * u,
        tint,
        fadeIn: 0.3,
      });
    }
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
  const flashAt = (x: number, y: number, tint: number, alpha: number, size: number) => {
    flash.position.set(x, y);
    flash.tint = tint;
    flash.alpha = Math.max(flash.alpha, reduced ? alpha * 0.5 : alpha);
    flash.scale.set(size / flash.texture.width);
  };

  // ---- Layout ----
  const aspectOf = (t: Texture) => t.width / Math.max(1, t.height);
  const place = (s: Sprite, r: { x: number; y: number; w: number; h: number }) => {
    s.anchor.set(0, 0);
    s.position.set(r.x, r.y);
    s.width = r.w;
    s.height = r.h;
  };

  const placeDwarf = () => {
    const a = poseArt(pose);
    const displayH = L.dwarf.bodyH / Math.max(0.2, a.foot.y - a.head);
    let scale = displayH / a.tex.height;
    const maxW = SCENE_PLACE.dwarf.maxW * W * 1.25;
    if (a.tex.width * scale > maxW) scale = maxW / a.tex.width;
    dwarf.texture = a.tex;
    dwarf.anchor.set(a.foot.x, a.foot.y);
    const breathe = pose === 'idle' && !reduced ? 1 + 0.006 * Math.sin(time / 650) : 1;
    dwarf.scale.set(scale, scale * breathe);
    dwarf.rotation = bow * -0.05 + (reduced ? 0 : (a.tilt ?? 0));
    // A pose that reaches back (the raised hammer) steps in so it stays inside the scene's left edge.
    const left = a.foot.x * a.tex.width * scale;
    dwarf.position.set(Math.max(L.dwarf.x + lean, left + 2), L.dwarf.y + bow * 4);
    dwarfGlow.position.set(L.dwarf.x, L.dwarf.y - L.dwarf.bodyH * 0.5);
    dwarfGlow.scale.set((L.dwarf.bodyH * 1.3) / dwarfGlow.texture.width);
  };

  /**
   * How far the dwarf leans so the strike pose's hammer (or the work pose's tongs) meets the
   * iron: the hammer a little left of the bar's middle, the tongs at its left end.
   */
  const lungeFor = (p: DwarfPose): number => {
    if (reduced) return 0;
    const a = poseArt(p);
    const tip = a.hammer ?? a.reach;
    if (tip === undefined) return 6 * unit();
    const displayH = L.dwarf.bodyH / Math.max(0.2, a.foot.y - a.head);
    const scale = displayH / a.tex.height;
    const dx = (tip.x - a.foot.x) * a.tex.width * scale;
    const dy = (tip.y - a.foot.y) * a.tex.height * scale;
    const tilt = a.tilt ?? 0;
    const tipX = L.dwarf.x + dx * Math.cos(tilt) - dy * Math.sin(tilt);
    const want = (a.hammer !== undefined ? L.iron.x - L.iron.w * 0.18 : L.iron.x - L.iron.w * 0.42) - tipX;
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
    weapon.position.set(L.face.x - L.face.w * 0.05, L.face.y - L.anvil.w * WEAPON_REST.lift);
    weaponGlow.position.copyFrom(weapon.position);
    weaponGlow.scale.set((len * 1.4) / weaponGlow.texture.width, (len * 0.7) / weaponGlow.texture.width);
    raysS.position.copyFrom(weapon.position);
    raysS.scale.set((len * 1.9) / raysS.texture.width);
  };
  const showWeapon = (type: WeaponType) => {
    if (shownWeapon === type && weapon.texture === weaponFor(type)) return;
    shownWeapon = type;
    weapon.texture = weaponFor(type);
    placeWeapon();
  };

  const relayout = () => {
    L = sceneLayout(W, H, {
      bg_workshop: aspectOf(bgTex),
      anvil: aspectOf(anvilTex),
      furnace: aspectOf(furnaceTex),
      bellows: aspectOf(bellowsTex),
      quench: aspectOf(quenchTex),
      iron_hot: aspectOf(ironTex),
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
    wallGlow.position.set(L.mouth.x, L.mouth.y - L.furnace.h * 0.15);
    wallGlow.scale.set((L.furnace.w * 3.2) / wallGlow.texture.width);
    mouthGlow.position.set(L.mouth.x, L.mouth.y);
    ironHome = { x: L.iron.x, y: L.iron.y };
    ironGroup.position.set(ironHome.x, ironHome.y);
    const ik = L.iron.w / ironTex.width;
    iron.scale.set(ik);
    ironFlash.scale.set(ik);
    crackS.scale.set((L.iron.w * 0.9) / crackS.texture.width);
    if (crackedTex !== null) {
      // As wide as the hot bar, lying on the same face line (its bottom near its picture's bottom).
      const ck = (L.iron.w * 1.04) / crackedTex.width;
      cracked.scale.set(ck);
      cracked.position.set(0, L.iron.h / 2 - crackedTex.height * ck * 0.46);
    }
    ironGlow.scale.set((L.iron.w * 1.9) / ironGlow.texture.width, (L.iron.w * 1.1) / ironGlow.texture.width);
    metalGlow.scale.set((L.iron.w * 2.2) / metalGlow.texture.width, (L.iron.w * 1.4) / metalGlow.texture.width);
    runes.position.set(L.face.x, L.face.y - L.iron.h * 0.2);
    shine.position.set(L.iron.x, L.iron.y);
    vig.position.set(0, 0);
    vig.width = W;
    vig.height = H;
    placeWeapon();
    placeDwarf();
    opts.onLayout(L);
  };

  // ---- Resting state ----
  /** The bar's colour and glow from its heat and how far it has cooled (every frame while it cools). */
  const tintIron = () => {
    const heat = Math.max(0, Math.min(HEAT_TINT.length - 1, Math.round(shownHeat)));
    const hot = HEAT_TINT[heat] as number;
    const broken = finished === 'broken' || finished === 'abandoned';
    // A painted hot bar already glows: tint it lightly. The drawn stand-in is white and takes the colour.
    const body = ironIsPicture ? mixColor(0xffffff, hot, 0.35) : hot;
    iron.tint = broken ? COLD_IRON : mixColor(body, COLD_IRON, ironCool * 0.7);
    ironGlow.tint = hot;
    ironGlow.alpha = broken || finished === 'weapon' ? 0 : (0.22 + heat * 0.045) * (1 - ironCool * 0.6);
  };
  /** The resting anvil: the bar (hot, split or gone) or the finished weapon, as the craft stands. */
  const refreshIron = () => {
    tintIron();
    const split = finished === 'broken' && crackedTex !== null;
    iron.visible = finished !== 'weapon' && !split;
    ironFlash.visible = iron.visible;
    cracked.alpha = split ? 1 : 0;
    crackS.alpha = finished === 'broken' && !split ? 0.9 : 0;
    crackS.tint = 0x3a0c06;
    weapon.alpha = finished === 'weapon' ? 1 : 0;
    weapon.visible = finished === 'weapon';
    weaponGlow.alpha = finished === 'weapon' ? 0.35 : 0;
    weaponGlow.tint = 0xffc874;
    raysS.alpha = finished === 'weapon' && (state.tier === 5 || state.legendary) ? 0.28 : 0;
    raysS.tint = 0xffd88a;
  };

  const settle = () => {
    shownHeat = state.heat;
    shownFire = state.fire;
    finished = state.status === 'success' ? 'weapon' : state.status === 'failed' ? (state.abandoned ? 'abandoned' : 'broken') : 'none';
    showWeapon(state.weaponType);
    pose = finished === 'weapon' ? 'cheer' : 'idle';
    lean = 0;
    bow = finished === 'broken' || finished === 'abandoned' ? 1 : 0;
    ironGroup.position.set(ironHome.x, ironHome.y);
    ironGroup.scale.set(1);
    ironGroup.alpha = 1;
    iron.alpha = 1;
    bellows.scale.set(L.bellows.w / bellows.texture.width, L.bellows.h / bellows.texture.height);
    shine.alpha = 0;
    runes.alpha = 0;
    refreshIron();
    placeDwarf();
  };

  // ---- Runners ----
  const timingFor = (k: keyof typeof FX_TIMING): FxTiming => FX_TIMING[k];
  const ironPoint = () => ({ x: ironGroup.x, y: ironGroup.y });

  const runners: Record<Motion, (step: PlayFx) => Runner> = {
    strike: (step) => {
      // A legendary material: he raises slowly while the iron glows and holds, then the heaviest blow.
      const big = step.legendary;
      const timing = timingFor(big ? 'strikeBig' : 'strike');
      const h = timing.hit;
      const reach = lungeFor('strike');
      // A big printed blow (크게 내려치기, 거인의 망치 …) shakes harder.
      const heavy = step.cost >= 5;
      const glow = (step.material !== null ? METAL_TINT[step.material] : undefined) ?? 0xffb060;
      return {
        timing,
        update: (t) => {
          if (big && t < h) {
            metalGlow.tint = glow;
            metalGlow.alpha = Math.max(metalGlow.alpha, 0.85);
            ironGlow.alpha = Math.max(ironGlow.alpha, 0.55 + 0.2 * Math.sin(t * Math.PI * 3));
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
          const p = ironPoint();
          sparks(p.x - L.iron.w * 0.1, p.y - L.iron.h * 0.2, big ? 46 : heavy ? 36 : 24, FX_COLOR.spark, big ? 1.4 : heavy ? 1.2 : 1);
          ironFlash.alpha = 1;
          ironFlash.tint = big ? 0xfff0d0 : 0xffffff;
          flashAt(p.x, p.y, big ? 0xffd9a0 : 0xffe2a8, big ? 0.62 : 0.4, big ? Math.max(W, H) * 1.3 : L.iron.w * 3);
          if (big) {
            // Dust off the stump and one low drop of the whole room, instead of a longer rattle.
            puffs(L.anvil.x + L.anvil.w * 0.5, L.anvil.y + L.anvil.h * 0.93, 6, FX_COLOR.smoke, 0.35, 0.25);
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
          const k = span(t, 0.22, 0.78);
          shine.alpha = Math.sin(k * Math.PI) * 0.9;
          shine.tint = 0xe8f4ff;
          shine.position.set(ironGroup.x - L.iron.w * 0.45 + L.iron.w * 0.9 * k, ironGroup.y - L.iron.h * 0.12);
          shine.scale.set((L.iron.w * 0.55) / shine.texture.width, (L.iron.h * 0.5) / shine.texture.height);
          if (twinkled === 0 && t > 0.25) {
            twinkled = 1;
            twinkles(ironGroup.x, ironGroup.y, L.iron.w, 6, FX_COLOR.silver);
          }
        },
        impact: () => {
          twinkles(ironGroup.x, ironGroup.y - L.iron.h * 0.1, L.iron.w, 14, FX_COLOR.silver);
          ironFlash.alpha = 0.55;
          ironFlash.tint = 0xd8ecff;
        },
        end: () => {
          pose = 'idle';
          lean = 0;
          shine.alpha = 0;
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
            const k = span(t, h, 1);
            shine.alpha = (1 - k) * 1.1;
            shine.tint = 0xffdc7a;
            shine.position.set(ironGroup.x, ironGroup.y - L.iron.h * 0.05);
            shine.scale.set((L.iron.w * lerp(1.4, 2.6, easeOut(k))) / shine.texture.width, (L.iron.h * 0.7) / shine.texture.height);
          }
        },
        impact: () => {
          const p = ironPoint();
          flashAt(p.x, p.y, 0xffd27a, 0.65, Math.max(W, H) * 1.2);
          twinkles(p.x, p.y, L.iron.w * 1.3, 26, FX_COLOR.gold);
          sparks(p.x, p.y - L.iron.h * 0.2, 14, FX_COLOR.gold, 0.8);
          ironFlash.alpha = 1;
          ironFlash.tint = 0xffe8a0;
          shake(SHAKE.strike);
        },
        end: () => {
          pose = 'idle';
          lean = 0;
          shine.alpha = 0;
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
          if (!puffed && t > 0.2) {
            puffed = true;
            const u = unit();
            for (let i = 0; i < count(6); i++) {
              spawn(addLayer, tex.dot, {
                x: L.nozzle.x,
                y: L.nozzle.y,
                vx: (L.mouth.x - L.nozzle.x) * rand(1.6, 2.4),
                vy: (L.mouth.y - L.nozzle.y) * rand(1.6, 2.4),
                life: rand(300, 450),
                size: rand(5, 9) * u,
                sizeEnd: 14 * u,
                alpha: 0.5,
                tint: 0xfff0d8,
              });
            }
          }
        },
        impact: () => {
          fireFlare = Math.max(fireFlare, 1);
          embers(L.mouth.x, L.mouth.y, 18, L.furnace.w * 0.2);
          ironFlash.alpha = 0.3;
          ironFlash.tint = 0xffb060;
        },
        end: () => {
          bellows.scale.set(L.bellows.w / bellows.texture.width, L.bellows.h / bellows.texture.height);
        },
      };
    },
    quench: () => {
      const timing = timingFor('quench');
      const reach = lungeFor('work');
      return {
        timing,
        update: (t) => {
          pose = t > 0.05 && t < 0.6 ? 'work' : 'idle';
          lean = t < 0.6 ? reach * easeOut(span(t, 0, 0.25)) : reach * (1 - easeOut(span(t, 0.6, 0.85)));
        },
        impact: () => {
          const p = ironPoint();
          puffs(p.x, p.y - L.iron.h * 0.2, 11, FX_COLOR.steam, 0.75, 1);
          ironCool = 1;
          const u = unit();
          for (let i = 0; i < count(10); i++) {
            spawn(addLayer, tex.dot, {
              x: p.x + rand(-L.iron.w * 0.4, L.iron.w * 0.4),
              y: p.y,
              vx: rand(-60, 60) * u,
              vy: rand(-220, -120) * u,
              ay: 600 * u,
              life: rand(380, 620),
              size: rand(4, 6) * u,
              tint: 0x9fd0ff,
            });
          }
        },
        end: () => {
          pose = 'idle';
          lean = 0;
        },
      };
    },
    infuse: (step) => {
      const big = step.legendary;
      const timing = timingFor(big ? 'infuseBig' : 'infuse');
      const tint = (step.material !== null ? METAL_TINT[step.material] : undefined) ?? 0xffc080;
      let started = false;
      return {
        timing,
        update: (t) => {
          if (!started) {
            started = true;
            const p = ironPoint();
            converge(p.x, p.y, big ? 30 : 16, tint, L.iron.w * (big ? 1.1 : 0.8), timing.ms * timing.hit * (reduced ? FX_REDUCED : 1));
          }
          metalGlow.tint = tint;
          metalGlow.alpha = Math.max(metalGlow.alpha, 0.55 * easeIn(span(t, 0, timing.hit)));
          if (big) {
            raysS.tint = tint;
            raysS.alpha = Math.max(finished === 'weapon' ? raysS.alpha : 0, 0.35 * pulse(t, 0.3, 1));
            raysS.position.set(ironGroup.x, ironGroup.y);
            raysS.scale.set((L.iron.w * 2.2) / raysS.texture.width);
          }
        },
        impact: () => {
          const p = ironPoint();
          metalGlow.alpha = 1;
          ironFlash.alpha = 0.8;
          ironFlash.tint = tint;
          twinkles(p.x, p.y, L.iron.w, big ? 22 : 10, [tint, 0xffffff]);
          if (big) {
            flashAt(p.x, p.y, tint, 0.55, Math.max(W, H) * 1.3);
            shake(SHAKE.strike);
          }
        },
        end: () => {
          if (finished !== 'weapon') raysS.alpha = 0;
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
          embers(L.mouth.x, L.mouth.y, 22, L.furnace.w * 0.25);
        },
        end: () => {},
      };
    },
    focus: () => {
      const timing = timingFor('focus');
      return {
        timing,
        update: (t) => {
          dwarfGlow.tint = 0xffd890;
          dwarfGlow.alpha = 0.4 * pulse(t, 0, 1);
        },
        impact: () => {
          twinkles(L.dwarf.x, L.dwarf.y - L.dwarf.bodyH * 0.55, L.dwarf.bodyH * 0.5, 8, FX_COLOR.gold);
        },
        end: () => {
          dwarfGlow.alpha = 0;
        },
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
          // A legendary material's own motion waits for its metal to glow, and its blow brings the numbers.
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
            runes.tint = pick(FX_COLOR.rune);
            runes.alpha = 0.9 * pulse(t, 0, 1);
            const k = lerp(0.7, 1.1, easeOut(t));
            runes.scale.set((L.anvil.w * 0.9 * k) / runes.texture.width, (L.anvil.w * 0.35 * k) / runes.texture.width);
            runes.rotation = 0;
          },
          impact: () => {
            twinkles(runes.x, runes.y, L.anvil.w * 0.7, 16, FX_COLOR.rune);
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
              ironGroup.alpha = 1 - pulse(t, 0.1, 0.9);
              return;
            }
            const out = easeOut(span(t, 0, 0.34));
            const back = easeOut(span(t, 0.58, 0.92));
            const k = t < 0.58 ? out : 1 - back;
            const lift = Math.sin(k * Math.PI) * -L.furnace.h * 0.15;
            ironGroup.position.set(lerp(ironHome.x, L.mouth.x, k), lerp(ironHome.y, L.mouth.y, k) + (t < 0.58 ? lift : lift * 0.5));
            ironGroup.scale.set(lerp(1, 0.55, k));
            ironGroup.alpha = 1 - 0.55 * pulse(t, 0.3, 0.6);
            if (t > 0.34 && t < 0.58) fireFlare = Math.max(fireFlare, 0.8);
          },
          impact: () => {
            embers(L.mouth.x, L.mouth.y, 12, L.furnace.w * 0.15);
            ironFlash.alpha = 0.6;
            ironFlash.tint = 0xffd080;
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
              embers(L.mouth.x, L.mouth.y, 14, L.furnace.w * 0.2);
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
        const r: Runner = {
          timing,
          update: (t) => {
            if (t < h - 0.1) pose = 'raise';
            else if (t < h + 0.16) pose = 'strike';
            else pose = 'cheer';
            lean = t < h ? lerp(0, reach, easeIn(span(t, h - 0.1, h))) : lerp(reach, 0, easeOut(span(t, h + 0.16, h + 0.4)));
            if (t >= h) {
              const k = easeOut(span(t, h, h + 0.18));
              weapon.visible = true;
              weapon.alpha = k;
              ironGroup.alpha = 1 - k;
              weaponGlow.alpha = 0.35 + 0.4 * (1 - span(t, h, 1));
              if (big) raysS.alpha = 0.28 + 0.35 * (1 - span(t, h + 0.2, 1));
              raysS.rotation = time / 4000;
            }
          },
          impact: () => {
            const p = ironPoint();
            flashAt(p.x, p.y, big ? 0xfff0c0 : 0xffe0a0, big ? 0.85 : 0.5, Math.max(W, H) * 1.4);
            sparks(p.x, p.y - L.iron.h * 0.2, big ? 40 : 24, FX_COLOR.gold, 1.1);
            twinkles(p.x, p.y, L.anvil.w, big ? 26 : 12, FX_COLOR.gold);
            fireFlare = Math.max(fireFlare, big ? 1.4 : 0.9);
            shake(SHAKE.strike);
            weaponGlow.tint = 0xffc874;
            raysS.tint = 0xffd88a;
            raysS.position.copyFrom(weapon.position);
            raysS.scale.set((weaponLen() * 1.9) / raysS.texture.width);
          },
          end: () => {
            finished = 'weapon';
            ironGroup.alpha = 1;
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
            pose = 'idle';
            lean = 0;
            if (t >= h) {
              const k = span(t, h, 1);
              iron.tint = mixColor(iron.tint as number, COLD_IRON, k * 0.2);
              ironGlow.alpha *= 0.94;
              bow = reduced ? 0 : easeOut(span(t, h + 0.15, 0.8));
              if (!step.abandoned && crackedTex !== null) {
                // The painted split bar comes through as the glow dies.
                const c = easeOut(span(t, h, h + 0.3));
                cracked.alpha = c;
                iron.alpha = 1 - c;
              } else {
                if (!step.abandoned) crackS.alpha = Math.max(crackS.alpha, 0.9);
                crackS.tint = mixColor(FX_COLOR.crack, 0x3a0c06, easeIn(k));
              }
            }
          },
          impact: () => {
            const p = ironPoint();
            if (!step.abandoned) {
              ironFlash.alpha = 1;
              ironFlash.tint = 0xff3a1a;
              flashAt(p.x, p.y, 0xff4a2a, 0.35, L.iron.w * 3);
              sparks(p.x, p.y, 10, [0xff6a3a, 0xffb060], 0.7);
              shake(SHAKE.break);
            }
            puffs(p.x, p.y - L.iron.h * 0.2, step.abandoned ? 4 : 8, FX_COLOR.smoke, 0.55, 0.7);
          },
          end: () => {
            finished = step.abandoned ? 'abandoned' : 'broken';
            iron.alpha = 1;
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
    refreshIron();
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
    // Fire breathing.
    const glow = FIRE_GLOW[shownFire];
    const flicker = reduced ? 0 : Math.sin(time / 90) * 0.04 + Math.sin(time / 37) * 0.03 + rand(-0.03, 0.03);
    const power = glow.power * (state.stoked ? 1.15 : 1) + fireFlare * 0.6;
    fireFlare *= Math.exp(-dt / 380);
    mouthGlow.tint = glow.color;
    mouthGlow.alpha = Math.min(1, 0.5 + 0.25 * power + flicker);
    mouthGlow.scale.set(((L.furnace.w * (0.9 + 0.25 * power)) / mouthGlow.texture.width) * (1 + flicker));
    wallGlow.tint = glow.color;
    wallGlow.alpha = Math.min(0.75, 0.18 + 0.14 * power + flicker * 0.5);
    emberDebt += (dt / 1000) * (reduced ? 1 : 2.2 * power);
    while (emberDebt >= 1) {
      emberDebt -= 1;
      embers(L.mouth.x, L.mouth.y - L.furnace.h * 0.05, 1, L.furnace.w * 0.18);
    }
    // Iron.
    ironFlash.alpha *= Math.exp(-dt / 140);
    metalGlow.alpha *= Math.exp(-dt / 420);
    flash.alpha *= Math.exp(-dt / 160);
    if (ironCool > 0) {
      ironCool *= Math.exp(-dt / 700);
      if (ironCool < 0.02) ironCool = 0;
      // Only the colour: a running step (the finishing blow bringing in the weapon) owns what is shown.
      tintIron();
    }
    if (finished === 'none' && !reduced) ironGlow.alpha *= 1 + Math.sin(time / 260) * 0.004;
    if (raysS.alpha > 0) raysS.rotation += dt / 9000;
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
    placeDwarf();
  };

  relayout();
  settle();
  host.appendChild(view);
  app.ticker.add(tick);

  return {
    resize(w, h) {
      if (destroyed) return;
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      app.renderer.resize(W, H);
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
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
      for (const t of made) t.destroy(true);
    },
  };
}
