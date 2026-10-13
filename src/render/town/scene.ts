// 마을 지도 장면 (PixiJS, 기획서 9장): the home screen's map. The composer's map, drawn from the
// baked pictures (baked.ts; tools/art/town/bake.ts makes them): sky, ground, paths and every shadow
// in one stretched picture, the horizon's clouds, the pictures back to front by where they stand,
// the clouds round the towers, the cloud band. Living a little: the forge's chimney smokes, the
// fountain splashes, the band drifts, the guests walk from the gate to the shop and back (9.3), the
// dwarf breathes at his door. One finger drags the map; it glides on, stops at the edges with a
// light bounce; a tap goes to whatever is under it (hit.ts), the building pressed squashes, a guest
// or the dwarf tapped hops. With less motion the map keeps still: no drifting, smoking or walking.
// Everything here is the screen's show (CLAUDE.md 규칙 2): nothing is counted or saved, and the map's
// place is not kept (9.1). Loaded with a dynamic import when the home screen opens.

import { Application, Container, EventsTicker, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import type { TownBuildingId, TownLock } from '../../sim/data/town.ts';
import { HERO_KEYS } from './assets.ts';
import { alphaOf, type BakedPic, loadTownPictures } from './baked.ts';
import {
  type Bounds,
  type Cam,
  CAMERA,
  camBounds,
  capSpeed,
  clampCam,
  makeGesture,
  rubberPos,
  settled,
  stepAxis,
  TAP,
  unrubberPos,
  zoomFor,
} from './camera.ts';
import { type AlphaMask, type HitTarget, hitTest } from './hit.ts';
import { attachTownInput } from './input.ts';
import {
  CLOUD_DRIFT,
  DWARF_BREATH,
  FOUNTAIN,
  groundEllipse,
  GUEST_ROAD,
  GUEST_STILL,
  homeCamera,
  HOP,
  type Insets,
  LOCK_TINT,
  MAP_BUILDINGS,
  MAP_H,
  MAP_ITEMS,
  MAP_W,
  PRESS,
  SMOKE,
  TOWN_LAYOUT,
} from './layout.ts';
import { type Crowd, startCrowd, stepCrowd, talkTo, walkerPose } from './walkers.ts';

/** What a tap landed on. */
export type TownTap =
  | { readonly kind: 'building'; readonly uid: string }
  | { readonly kind: 'guest'; readonly id: number; readonly hero: string; readonly x: number; readonly y: number }
  | { readonly kind: 'dwarf'; readonly x: number; readonly y: number }
  | { readonly kind: 'ground' };

export interface CameraView {
  /** The view's top-left (map px) and zoom (CSS px per map px). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TownSceneOptions {
  readonly reducedMotion: boolean;
  /** Where the camera was the last time the map was open this session; null: on the forge (9.1). */
  readonly camera: Cam | null;
  readonly locks: Readonly<Record<TownBuildingId, TownLock>>;
  /** The element that takes the fingers (the map's box, the name tags inside it). */
  readonly input: HTMLElement;
  /** What the top band and the quick entries cover (CSS px), so the first look keeps the forge and the shop clear of them. */
  insets(): Insets;
  onTap(tap: TownTap): void;
  /** The camera moved (every frame it moves): the DOM overlay follows. */
  onCamera(view: CameraView): void;
  /** A drag began / ended (ms it lasted), for the map's play log (17장의 15번). */
  onDrag?(phase: 'start' | 'end', ms: number): void;
}

export interface TownScene {
  resize(w: number, h: number): void;
  setLocks(locks: Readonly<Record<TownBuildingId, TownLock>>): void;
  /** Back to the forge (the 실험 panel, or the forge's quick entry while on the map). */
  home(): void;
  camera(): Cam;
  /** Stops drawing while something covers the map (a sheet), and starts again. */
  pause(on: boolean): void;
  /** How long the map took to get ready (ms by step). */
  readonly readyMs: Readonly<Record<string, number>>;
  destroy(): void;
}

const INK = 0x34231a;
/** Work at most this long (ms) sending pictures to the GPU before letting a frame (and a tap) through. */
const UPLOAD_SLICE_MS = 12;
const hex = (s: string) => parseInt(s.replace('#', ''), 16);

/** A picture drawn on the map, and where it stands. */
interface Placed {
  readonly sprite: Sprite;
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
  readonly pic: BakedPic;
  readonly img: HTMLImageElement;
  readonly uid: string | null;
  readonly building: TownBuildingId | null;
  readonly key: string;
}

/** A hero's picture for the guests. */
interface HeroPic {
  readonly key: string;
  readonly pic: BakedPic;
  readonly img: HTMLImageElement;
  readonly tex: Texture;
}

export async function createTownScene(host: HTMLElement, width: number, height: number, opts: TownSceneOptions): Promise<TownScene> {
  const t0 = performance.now();
  const pics = await loadTownPictures();
  const tPics = performance.now();
  const M = pics.manifest;
  const app = new Application();
  await app.init({
    width: Math.max(1, width),
    height: Math.max(1, height),
    background: TOWN_LAYOUT.map.skyColor,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: ['webgl'],
  });
  const tInit = performance.now();
  app.stage.eventMode = 'none';
  app.stage.interactiveChildren = false;
  // The map takes its fingers from the page (input.ts), not through PixiJS: PixiJS's own pointer
  // ticker would keep a frame loop running even while the map is paused under a sheet.
  EventsTicker.removeTickerListener();
  const view = app.canvas;
  view.style.display = 'block';
  view.style.width = '100%';
  view.style.height = '100%';
  view.style.touchAction = 'none';

  const reduced = opts.reducedMotion;
  // One texture per picture, freed with the scene (the images stay in memory for the session).
  const textures = new Map<string, Texture>();
  const texOf = (file: string): Texture | null => {
    let t = textures.get(file);
    if (t === undefined) {
      const img = pics.image(file);
      if (img === null) return null;
      t = Texture.from(img, true);
      textures.set(file, t);
    }
    return t;
  };

  // ---- The display tree, in the composer's order ----
  const world = new Container();
  app.stage.addChild(world);
  const layerSprite = (l: { file: string; x: number; y: number; scale: number }, into: Container) => {
    const t = texOf(l.file);
    if (t === null) return;
    const s = new Sprite(t);
    s.position.set(l.x, l.y);
    s.scale.set(l.scale);
    into.addChild(s);
  };
  layerSprite(M.ground, world);
  for (const l of M.horizon) layerSprite(l, world);
  // The guests' ground shadows (the rest are in the ground picture): one colour, multiplied.
  const guestShadows = new Container();
  world.addChild(guestShadows);
  const things = new Container();
  things.sortableChildren = true;
  world.addChild(things);
  const smoke = new Graphics();
  world.addChild(smoke);
  for (const l of M.rings) layerSprite(l, world);
  const band = new Container();
  world.addChild(band);

  // ---- The pictures ----
  const placed: Placed[] = [];
  const uidSeen = new Map<string, number>();
  MAP_ITEMS.forEach((item, i) => {
    const pic = M.pictures[item.key];
    const img = pic !== undefined ? pics.image(pic.file) : null;
    const t = pic !== undefined ? texOf(pic.file) : null;
    if (pic === undefined || img === null || t === null) return;
    const s = new Sprite(t);
    s.anchor.set(pic.ax / pic.w, pic.ay / pic.h);
    s.position.set(item.x, item.y);
    s.scale.set(pic.scale * (item.flip ? -1 : 1), pic.scale);
    s.zIndex = item.y + i * 1e-4;
    things.addChild(s);
    const n = (uidSeen.get(item.key) ?? 0) + 1;
    uidSeen.set(item.key, n);
    const uid = n === 1 ? item.key : `${item.key}#${n}`;
    const mb = MAP_BUILDINGS.find((m) => m.uid === uid);
    placed.push({ sprite: s, x: item.x, y: item.y, flip: item.flip, pic, img, uid: mb !== undefined ? uid : null, building: mb?.building ?? null, key: item.key });
  });
  const dwarf = placed.find((p) => p.key === 'dwarf') ?? null;

  // The fountain's drops: in front of the fountain, behind what stands before it.
  const fountain = placed.find((p) => p.building === 'fountain') ?? null;
  const drops = new Graphics();
  if (fountain !== null) {
    drops.zIndex = fountain.y + 0.5;
    things.addChild(drops);
  }

  // ---- Locks: a locked building is drawn greyed (9.2 '공사 중'처럼, [미정]) ----
  let locks = opts.locks;
  const applyLocks = () => {
    for (const p of placed) {
      if (p.building === null) continue;
      p.sprite.tint = locks[p.building].locked ? LOCK_TINT : 0xffffff;
    }
  };
  applyLocks();

  // ---- The cloud band: tiles across, every other one mirrored, drifting ----
  const bandTiles: Sprite[] = [];
  const bandTex = M.band !== null ? texOf(M.band.file) : null;
  if (M.band !== null && bandTex !== null) {
    const n = Math.ceil(MAP_W / M.band.w) + 3;
    for (let i = 0; i < n; i++) {
      const s = new Sprite(bandTex);
      s.width = M.band.w;
      s.height = M.band.h;
      band.addChild(s);
      bandTiles.push(s);
    }
  }
  let bandShift = 0;
  const placeBand = () => {
    const b = M.band;
    if (b === null) return;
    const period = b.w * 2;
    const shift = ((bandShift % period) + period) % period;
    bandTiles.forEach((s, i) => {
      const x = b.x0 - period + shift + i * b.w;
      const mirror = i % 2 === 1;
      s.scale.x = Math.abs(s.scale.x) * (mirror ? -1 : 1);
      s.position.set(mirror ? x + b.w : x, b.y);
    });
  };
  placeBand();

  // ---- The guests (9.3) ----
  const heroes: HeroPic[] = [];
  for (const key of HERO_KEYS) {
    const pic = M.heroes[key];
    const img = pic !== undefined ? pics.image(pic.file) : null;
    const tex = pic !== undefined ? texOf(pic.file) : null;
    if (pic !== undefined && img !== null && tex !== null) heroes.push({ key, pic, img, tex });
  }
  const disc = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    if (g !== null) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(64, 64, 63, 0, Math.PI * 2);
      g.fill();
    }
    const t = Texture.from(c, true);
    textures.set('#disc', t);
    return t;
  })();
  const rand = Math.random; // presentation only
  const crowdOpts = { road: GUEST_ROAD, heroes: heroes.length, rand };
  let crowd: Crowd = heroes.length > 0 && !reduced ? startCrowd(crowdOpts) : { walkers: [], nextIn: Infinity, nextId: 0 };
  interface GuestDraw {
    s: Sprite;
    shadow: Sprite;
  }
  const guestDraw = new Map<number, GuestDraw>();
  const shadowTint = hex(TOWN_LAYOUT.shadow.color);
  const newGuestDraw = (): GuestDraw => {
    const s = new Sprite(Texture.EMPTY);
    things.addChild(s);
    const shadow = new Sprite(disc);
    shadow.anchor.set(0.5);
    shadow.tint = shadowTint;
    shadow.blendMode = 'multiply';
    guestShadows.addChild(shadow);
    return { s, shadow };
  };
  /** Hops (a guest or the dwarf tapped): ms since each began, by guest id ('dwarf' for him). */
  const hops = new Map<number | 'dwarf', number>();
  const hopOf = (id: number | 'dwarf') => {
    const t = hops.get(id);
    if (t === undefined) return 0;
    const k = Math.min(1, t / HOP.ms);
    return Math.sin(k * Math.PI) * HOP.height;
  };
  const drawGuest = (g: GuestDraw, h: HeroPic, x: number, y: number, lift: number, tilt: number, flip: boolean, alpha: number) => {
    const b = h.pic;
    g.s.texture = h.tex;
    g.s.anchor.set(b.ax / b.w, b.ay / b.h);
    g.s.scale.set(b.scale * (flip ? -1 : 1), b.scale);
    g.s.position.set(x, y - lift);
    g.s.rotation = tilt;
    g.s.alpha = alpha;
    g.s.zIndex = y + 0.25;
    const e = groundEllipse(b.foot, flip);
    g.shadow.position.set(x + e.x, y + e.y);
    g.shadow.width = e.rx * 2 * (1 - Math.min(0.5, lift / 30));
    g.shadow.height = e.ry * 2;
    g.shadow.alpha = alpha;
  };
  // With less motion: a few guests stand still by the gate and the shop.
  const stillGuests = reduced && heroes.length > 0 ? GUEST_STILL.map((p, i) => ({ id: -1 - i, hero: (i * 3) % heroes.length, ...p })) : [];
  for (const g of stillGuests) {
    const d = newGuestDraw();
    guestDraw.set(g.id, d);
    const h = heroes[g.hero];
    if (h !== undefined) drawGuest(d, h, g.x, g.y, 0, 0, g.flip, 1);
  }
  const updateGuests = (dt: number) => {
    if (reduced) return;
    crowd = stepCrowd(crowd, dt, crowdOpts);
    const alive = new Set<number>();
    for (const w of crowd.walkers) {
      alive.add(w.id);
      let g = guestDraw.get(w.id);
      if (g === undefined) {
        g = newGuestDraw();
        guestDraw.set(w.id, g);
      }
      const h = heroes[w.hero];
      if (h === undefined) continue;
      const p = walkerPose(w, GUEST_ROAD);
      drawGuest(g, h, p.x, p.y, p.bob + hopOf(w.id), p.tilt, p.flip, p.alpha);
    }
    for (const [id, g] of guestDraw) {
      if (alive.has(id)) continue;
      g.s.destroy();
      g.shadow.destroy();
      guestDraw.delete(id);
      hops.delete(id);
    }
  };

  // ---- Smoke and water (flat shapes with the ink line, like the clouds) ----
  const smokeStyle = TOWN_LAYOUT.smoke.style;
  const first = TOWN_LAYOUT.smoke.puffs[0];
  interface Puff {
    age: number;
    /** Its own size, drift and wobble phase (0~1 each), so the puffs gather in a loose heap, not a row. */
    seed: number;
    vx: number;
    vy: number;
  }
  const newPuff = (age: number): Puff => {
    const k = (r: number) => 1 + (r * 2 - 1) * SMOKE.spread;
    return { age, seed: Math.random(), vx: SMOKE.vx * k(Math.random()), vy: SMOKE.vy * k(Math.random()) };
  };
  let puffs: Puff[] = [];
  let puffClock = 0;
  if (!reduced && first !== undefined) {
    // Already smoking when the map opens.
    for (let t = SMOKE.lifeMs - SMOKE.everyMs; t > 0; t -= SMOKE.everyMs) puffs.push(newPuff(t));
  }
  const puffAt = (p: Puff, from: { x: number; y: number }) => {
    const k = p.age / SMOKE.lifeMs;
    const sec = p.age / 1000;
    const size = SMOKE.minK + (1 - SMOKE.minK) * p.seed;
    const grow = size * (k < 0.75 ? SMOKE.r0 + (SMOKE.r1 - SMOKE.r0) * Math.sqrt(k / 0.75) : SMOKE.r1 * (1 - (k - 0.75) / 0.25) ** 0.7);
    return {
      x: from.x + p.vx * sec + Math.sin(((p.age + p.seed * SMOKE.wobbleMs) / SMOKE.wobbleMs) * Math.PI * 2) * SMOKE.wobble,
      y: from.y + p.vy * sec,
      r: Math.max(0, grow),
    };
  };
  const drawPuffs = (list: { x: number; y: number; r: number }[]) => {
    smoke.clear();
    const line = smokeStyle.line;
    for (const p of list) smoke.circle(p.x, p.y, p.r + line).fill(INK);
    for (const p of list) smoke.circle(p.x, p.y, p.r).fill(hex(smokeStyle.under));
    for (const p of list) {
      const cx = p.x - p.r * 0.06;
      const cy = p.y - p.r * 0.17;
      const rr = p.r * 0.82;
      smoke
        .moveTo(cx + Math.cos(Math.PI * 0.15) * rr, cy + Math.sin(Math.PI * 0.15) * rr)
        .arc(cx, cy, rr, Math.PI * 0.15, Math.PI * 0.85)
        .stroke({ width: Math.max(2, line * 0.55), color: INK, cap: 'round' });
    }
    for (const p of list) smoke.circle(p.x - p.r * 0.06, p.y - p.r * 0.17, p.r * 0.82).fill(hex(smokeStyle.top));
  };
  if (reduced) drawPuffs(TOWN_LAYOUT.smoke.puffs.map((p) => ({ ...p })));
  const updateSmoke = (dt: number) => {
    if (reduced || first === undefined) return;
    puffClock += dt;
    while (puffClock >= SMOKE.everyMs) {
      puffClock -= SMOKE.everyMs;
      puffs.push(newPuff(0));
    }
    for (const p of puffs) p.age += dt;
    puffs = puffs.filter((p) => p.age < SMOKE.lifeMs);
    // Oldest (highest) first, so a new puff sits in front of the one above it.
    drawPuffs(puffs.map((p) => puffAt(p, first)).filter((p) => p.r > 0.5));
  };

  interface Drop {
    age: number;
    vx: number;
  }
  let dropList: Drop[] = [];
  let dropClock = 0;
  const fountainBox = MAP_BUILDINGS.find((m) => m.building === 'fountain')?.item.box;
  const spout = fountain !== null && fountainBox !== undefined
    ? { x: fountainBox.x + fountainBox.w * FOUNTAIN.spout.x, y: fountainBox.y + fountainBox.h * FOUNTAIN.spout.y, w: fountainBox.w, h: fountainBox.h }
    : null;
  const updateDrops = (dt: number) => {
    if (reduced || spout === null) return;
    dropClock += dt;
    while (dropClock >= FOUNTAIN.everyMs) {
      dropClock -= FOUNTAIN.everyMs;
      dropList.push({ age: 0, vx: (Math.random() * 2 - 1) * spout.w * FOUNTAIN.spread });
    }
    for (const d of dropList) d.age += dt;
    dropList = dropList.filter((d) => d.age < FOUNTAIN.lifeMs);
    drops.clear();
    const fall = spout.h * FOUNTAIN.fall;
    for (const d of dropList) {
      const k = d.age / FOUNTAIN.lifeMs;
      // Up a little, then down into the bowl: a parabola from the spout to `fall` below it.
      const x = spout.x + d.vx * k;
      const y = spout.y - 4 * FOUNTAIN.rise * k * (1 - k) + fall * k * k;
      const r = (FOUNTAIN.size / 2) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
      if (r <= 0.3) continue;
      drops.circle(x, y, r + 1.6).fill(INK);
      drops.circle(x, y, r).fill(FOUNTAIN.color);
    }
  };

  let destroyed = false;

  // ---- Camera ----
  let W = Math.max(1, width);
  let H = Math.max(1, height);
  let z = zoomFor(W);
  let bounds: Bounds = camBounds(MAP_W, MAP_H, { w: W, h: H }, z);
  const homeCam = () => homeCamera({ w: W, h: H }, z, bounds, opts.insets());
  const start = opts.camera !== null ? clampCam(opts.camera, bounds) : homeCam();
  let ax = { p: start.x, v: 0 };
  let ay = { p: start.y, v: 0 };
  /** While dragging: the camera under the finger before the rubber band. */
  let raw: Cam | null = null;
  let lastShown = { x: NaN, y: NaN, z: NaN };
  const res = app.renderer.resolution;
  const applyCamera = () => {
    const x = ax.p;
    const y = ay.p;
    // Whole device px, so the pictures do not shimmer as the map moves.
    world.position.set(Math.round(-x * z * res) / res, Math.round(-y * z * res) / res);
    world.scale.set(z);
    if (x !== lastShown.x || y !== lastShown.y || z !== lastShown.z) {
      lastShown = { x, y, z };
      opts.onCamera({ x, y, z });
    }
  };
  applyCamera();

  // ---- Fingers ----
  const gesture = makeGesture();
  let pressed: Placed | null = null;
  let pop: { p: Placed; t: number } | null = null;
  let downTarget: string | null = null;
  let dragStartAt = 0;
  const toMap = (x: number, y: number) => ({ x: ax.p + x / z, y: ay.p + y / z });

  type Hit = TownTap | { kind: 'b'; p: Placed };
  /** A picture's box on the map, and its alpha (read back only when a tap lands in the box). */
  const maskOf = (b: BakedPic, img: HTMLImageElement, x: number, y: number, flip: boolean) => {
    const sc = b.scale;
    const left = flip ? x - (b.w - b.ax) * sc : x - b.ax * sc;
    const top = y - b.ay * sc;
    const mask: AlphaMask = {
      w: b.w,
      h: b.h,
      get data() {
        return alphaOf(img) ?? new Uint8Array(b.w * b.h).fill(255);
      },
      x: left,
      y: top,
      scale: sc,
      flip,
    };
    return { rect: { x: left, y: top, w: b.w * sc, h: b.h * sc }, mask };
  };
  const targets = (): HitTarget<Hit>[] => {
    const out: HitTarget<Hit>[] = [];
    for (const p of placed) {
      if (p.uid === null && p !== dwarf) continue;
      const m = maskOf(p.pic, p.img, p.x, p.y, p.flip);
      out.push({ id: p === dwarf ? { kind: 'dwarf', x: p.x, y: p.y } : { kind: 'b', p }, z: p.y, rect: m.rect, mask: m.mask });
    }
    for (const w of crowd.walkers) {
      const h = heroes[w.hero];
      if (h === undefined) continue;
      const pose = walkerPose(w, GUEST_ROAD);
      if (pose.alpha < 0.5) continue;
      const m = maskOf(h.pic, h.img, pose.x, pose.y - pose.bob, pose.flip);
      out.push({ id: { kind: 'guest', id: w.id, hero: h.key, x: pose.x, y: pose.y - h.pic.ay * h.pic.scale }, z: pose.y + 0.25, rect: m.rect, mask: m.mask });
    }
    for (const g of stillGuests) {
      const h = heroes[g.hero];
      if (h === undefined) continue;
      const m = maskOf(h.pic, h.img, g.x, g.y, g.flip);
      out.push({ id: { kind: 'guest', id: g.id, hero: h.key, x: g.x, y: g.y - h.pic.ay * h.pic.scale }, z: g.y + 0.25, rect: m.rect, mask: m.mask });
    }
    return out;
  };
  /** Under a finger at view px (x, y): a building (by its name tag or its picture), a guest, the dwarf. */
  const pick = (x: number, y: number, tag: string | null): Hit => {
    if (tag !== null) {
      const p = placed.find((q) => q.uid === tag);
      if (p !== undefined) return { kind: 'b', p };
    }
    const m = toMap(x, y);
    const hit = hitTest(targets(), m.x, m.y, TAP.slop / z);
    return hit?.id ?? { kind: 'ground' };
  };

  const squash = () => {
    for (const p of placed) {
      if (p.uid === null) continue;
      let kx = 1;
      let ky = 1;
      if (p === pressed) {
        kx = PRESS.squashX;
        ky = PRESS.squashY;
      } else if (pop !== null && pop.p === p) {
        // Springs back past its size and settles.
        const k = Math.min(1, pop.t / PRESS.popMs);
        const wob = Math.sin(k * Math.PI * 1.5) * (1 - k);
        kx = 1 - (PRESS.squashX - 1) * wob;
        ky = 1 + (1 - PRESS.squashY) * wob;
      }
      p.sprite.scale.set(p.pic.scale * kx * (p.flip ? -1 : 1), p.pic.scale * ky);
    }
  };
  const setPressed = (p: Placed | null) => {
    if (pressed === p) return;
    if (pressed !== null && p === null && !reduced) pop = { p: pressed, t: 0 };
    pressed = p;
    if (p !== null) pop = null;
    squash();
  };

  const gliding = () => ax.v !== 0 || ay.v !== 0 || !settled(ax, bounds.minX, bounds.maxX) || !settled(ay, bounds.minY, bounds.maxY);
  const endTouch = () => {
    raw = null;
    setPressed(null);
    downTarget = null;
  };

  const detach = attachTownInput(
    {
      input: opts.input,
      win: window,
      local: (e) => {
        const r = opts.input.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      },
      tagOf: (e) => (e.target instanceof Element ? (e.target.closest('[data-tap]')?.getAttribute('data-tap') ?? null) : null),
      capture: (id) => opts.input.setPointerCapture(id),
    },
    {
      down(p, tag) {
        const ev = gesture.down(p.id, p.x, p.y, p.t, Math.hypot(ax.v, ay.v) > CAMERA.catchSpeed);
        app.ticker.maxFPS = 0;
        if (ev.some((x) => x.type === 'cancel')) {
          // A second finger: the touch is off (no pinch zoom yet), the map settles where it is.
          endTouch();
          return;
        }
        if (gesture.driver() !== p.id) return;
        // The finger catches a gliding map, and holds one springing back from past an edge where it
        // is (the drag goes on from the finger position that shows there, so nothing jumps).
        ax = { p: ax.p, v: 0 };
        ay = { p: ay.p, v: 0 };
        raw = { x: unrubberPos(ax.p, bounds.minX, bounds.maxX, W / z), y: unrubberPos(ay.p, bounds.minY, bounds.maxY, H / z) };
        downTarget = tag;
        for (const x of ev) {
          if (x.type !== 'press') continue;
          const t = pick(x.x, x.y, tag);
          setPressed(t.kind === 'b' ? t.p : null);
        }
      },
      move(p) {
        for (const x of gesture.move(p.id, p.x, p.y, p.t)) {
          if (x.type === 'dragStart') {
            setPressed(null);
            dragStartAt = p.t;
            opts.onDrag?.('start', 0);
          } else if (x.type === 'drag' && raw !== null) {
            raw = { x: raw.x - x.dx / z, y: raw.y - x.dy / z };
            ax = { p: rubberPos(raw.x, bounds.minX, bounds.maxX, W / z), v: 0 };
            ay = { p: rubberPos(raw.y, bounds.minY, bounds.maxY, H / z), v: 0 };
          }
        }
      },
      up(p) {
        const events = gesture.up(p.id, p.x, p.y, p.t);
        for (const x of events) {
          if (x.type === 'release') {
            raw = null;
            if (x.dragged) {
              opts.onDrag?.('end', p.t - dragStartAt);
              const v = capSpeed(-x.vx / z, -x.vy / z);
              ax = { p: ax.p, v: v.vx };
              ay = { p: ay.p, v: v.vy };
            }
          } else if (x.type === 'tap') {
            const t = pick(x.x, x.y, downTarget);
            if (t.kind === 'b') {
              if (t.p.uid !== null) opts.onTap({ kind: 'building', uid: t.p.uid });
            } else {
              if (t.kind === 'guest') {
                if (t.id >= 0) crowd = talkTo(crowd, t.id);
                if (!reduced) hops.set(t.id, 0);
              }
              if (t.kind === 'dwarf' && !reduced) hops.set('dwarf', 0);
              opts.onTap(t);
            }
          }
        }
        endTouch();
        return events.length > 0;
      },
      cancel(id) {
        if (gesture.cancel(id).length > 0) endTouch();
      },
      wheel(dx, dy) {
        ax = { p: Math.max(bounds.minX, Math.min(bounds.maxX, ax.p + dx / z)), v: 0 };
        ay = { p: Math.max(bounds.minY, Math.min(bounds.maxY, ay.p + dy / z)), v: 0 };
      },
    },
  );

  // ---- Frame ----
  let time = 0;
  const tick = () => {
    const dt = Math.min(64, app.ticker.deltaMS);
    time += dt;
    if (raw === null && gliding()) {
      ax = stepAxis(ax, bounds.minX, bounds.maxX, dt);
      ay = stepAxis(ay, bounds.minY, bounds.maxY, dt);
      if (reduced) {
        // No bounce with less motion: the map stops at its edges.
        const c = clampCam({ x: ax.p, y: ay.p }, bounds);
        if (c.x !== ax.p) ax = { p: c.x, v: 0 };
        if (c.y !== ay.p) ay = { p: c.y, v: 0 };
      }
    }
    applyCamera();
    for (const [id, t] of hops) {
      if (t + dt >= HOP.ms) hops.delete(id);
      else hops.set(id, t + dt);
    }
    if (!reduced) {
      bandShift += (CLOUD_DRIFT * dt) / 1000;
      placeBand();
      if (dwarf !== null) {
        const k = 1 + DWARF_BREATH.amount * Math.sin((time / DWARF_BREATH.ms) * Math.PI);
        dwarf.sprite.scale.y = dwarf.pic.scale * k;
        dwarf.sprite.position.y = dwarf.y - hopOf('dwarf');
      }
    }
    updateSmoke(dt);
    updateDrops(dt);
    updateGuests(dt);
    if (pop !== null) {
      pop.t += dt;
      if (pop.t >= PRESS.popMs) pop = null;
      squash();
    }
    // The map idles at 30 frames a second (the smoke and the guests are slow); a finger, a glide or a hop gets 60.
    app.ticker.maxFPS = gesture.active() || gliding() || pop !== null || hops.size > 0 ? 0 : 30;
  };

  // The pictures go to the GPU a few at a time with a frame between, so no one frame holds the page
  // up (a tap on the quick entries still lands); then the first frame is drawn, before the map shows.
  app.ticker.stop();
  const tUpload = performance.now();
  let slice = tUpload;
  for (const t of textures.values()) {
    app.renderer.texture.initSource(t.source);
    if (performance.now() - slice > UPLOAD_SLICE_MS) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      slice = performance.now();
    }
  }
  const tDraw = performance.now();
  host.appendChild(view);
  app.ticker.add(tick);
  app.render();
  app.ticker.start();
  const tReady = performance.now();

  const relayout = () => {
    z = zoomFor(W);
    bounds = camBounds(MAP_W, MAP_H, { w: W, h: H }, z);
    const c = clampCam({ x: ax.p, y: ay.p }, bounds);
    ax = { p: c.x, v: 0 };
    ay = { p: c.y, v: 0 };
    applyCamera();
  };

  let paused = false;
  return {
    resize(w, h) {
      if (destroyed) return;
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      app.renderer.resize(W, H);
      relayout();
      if (paused) app.render();
    },
    setLocks(next) {
      locks = next;
      applyLocks();
      if (paused) app.render();
    },
    home() {
      const c = homeCam();
      ax = { p: c.x, v: 0 };
      ay = { p: c.y, v: 0 };
      applyCamera();
      if (paused) app.render();
    },
    camera: () => ({ x: ax.p, y: ay.p }),
    pause(on) {
      if (destroyed || on === paused) return;
      paused = on;
      // Nothing moves under a sheet: no frames at all (PixiJS's system ticker only runs its scheduler,
      // which has nothing to do while nothing is drawn; it starts again with the map or when it closes).
      if (on) {
        app.ticker.stop();
        Ticker.system.stop();
      } else {
        Ticker.system.start();
        app.ticker.start();
      }
    },
    readyMs: { pictures: tPics - t0, decode: pics.loadMs, gl: tInit - tPics, build: tUpload - tInit, upload: tDraw - tUpload, draw: tReady - tDraw },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (paused) Ticker.system.start();
      detach();
      app.ticker.remove(tick);
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
      // The images stay (baked.ts keeps them for the session); their GPU copies go.
      for (const t of textures.values()) t.destroy(true);
      textures.clear();
    },
  };
}
