// 전투 장면 (PixiJS, 기획서 6장 · 8.2): the field in front of the tower, the heroes on the left looking
// right (front row nearer the middle), the monsters on the right, and the battle played back from the
// engine's event list (timeline.ts) — the blows, the shots, the numbers (a crit bigger), the skills'
// names, the heals' sparkles, the signatures' sunbursts, a shake on the heavy blows, the falls, and a
// hop for a win. Everything shown is decided already (CLAUDE.md 규칙 2): this file never changes an
// HP, it shows the HP each cue carries. The effects are the forge's flat doodle shapes
// (render/forge/procedural.ts). Pictures load per screen and are unloaded when it closes.
// The canvas is the shared app's (render/app.ts).
// Numbers: each fighter keeps a short stack of them (a new one pushes the older ones up, left and
// right in turn, at most NUMBERS.perTarget at once), so five heroes hitting one foe stay readable;
// on a lone boss the plain hits close together add up into one number and crits stand apart. They
// are bitmap text from one baked font, reused from a pool (a Text per hit costs a canvas draw and a
// GPU upload each).

import { BitmapFont, BitmapText, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Element } from '../../sim/core/types.ts';
import type { BattleOutcome } from '../../sim/stage/battle.ts';
import { acquireApp, type AppLease, holdAsset, releaseAssets } from '../app.ts';
import * as draw from '../forge/procedural.ts';
import { townMapUrl } from '../town/assets.ts';
import { type Actor, makeActor, sliceSheet } from './anim.ts';
import { heroArtUrl, monsterArtUrl, sheetUrls } from './assets.ts';
import { bossCenterX, bossFeetY, enemySpots, FIELD, FIGHTER_SIZE, type FieldSpot, type FighterSize, fighterHeight, heroSpots, unitHeight } from './layout.ts';
import { ANIM_SPEC, type AnimAction } from './motion.ts';
import type { Cue, ShotStyle, Timeline } from './timeline.ts';

const INK = 0x3b2a20;
const SKY = 0xcfe3ea;
const FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

/** The damage and heal numbers [튜닝: 연출]. */
export const NUMBERS = {
  /** At most this many numbers float over one fighter; a newer one makes the oldest go quickly. */
  perTarget: 4,
  /** A new number pushes the older ones up by this share of its own size. */
  lineGap: 0.95,
  /** Left and right of the middle in turn, this share of the fighter's height. */
  side: 0.17,
  /** On a lone boss, plain hits within this many ms (screen time) add up into one number. */
  bossMergeMs: 360,
  /** How long a number stays (ms), a crit's. */
  life: 820,
  critLife: 1000,
  /** The baked font's size (px); numbers scale from it. */
  fontSize: 48,
  /** How much of the playback speed shortens words in the air (lifeAt): ×2 → ÷1.2, ×4 → ÷2.4. */
  speedShare: 0.6,
} as const;

const NUMBER_FONT = 'BattleNumbers';
let numberFont: Promise<void> | null = null;

/** Bakes the number font once (white fill and the ink line: a number takes its colour as a tint). */
function ensureNumberFont(): Promise<void> {
  numberFont ??= (async () => {
    // The UI font first, when it comes in time (a fallback font is baked otherwise).
    try {
      await Promise.race([document.fonts.load(`${NUMBERS.fontSize}px Jua`), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      // no font loading API: the fallback is fine
    }
    BitmapFont.install({
      name: NUMBER_FONT,
      style: { fontFamily: FONT, fontSize: NUMBERS.fontSize, fill: 0xffffff, stroke: { color: INK, width: 9, join: 'round' } },
      chars: [['0', '9'], ',', '+', '!'],
      resolution: 2,
      padding: 6,
    });
  })();
  return numberFont;
}

/** The colours of the field and the effects [튜닝: 연출]. */
export const BATTLE_COLORS = {
  sky: SKY,
  hill: 0xb7d3b6,
  hillFar: 0xc7dccd,
  ground: 0xd9cf9a,
  groundNear: 0xcdbf86,
  path: 0xe6dcb0,
  tuft: 0x8fb86a,
  heroHp: 0x8cc47a,
  enemyHp: 0xe46f5a,
  hpTrail: 0xfff1b0,
  hpBack: 0xf6ebd5,
  number: 0xffffff,
  numberGood: 0xffb347,
  numberCrit: 0xffd84a,
  numberHurt: 0xffd2c4,
  heal: 0x9fe3a0,
  burst: 0xfff4c2,
  burstCrit: 0xffd84a,
  sunburst: 0xfff1b0,
  ring: 0xb9a0e6,
  speed: INK,
  element: { water: 0x7fc2f0, fire: 0xff8a5a, earth: 0xd2a56a, wind: 0x8fe0bd } as Record<Element, number>,
} as const;

export interface BattleUnitSpec {
  id: string;
  /** Art key: hero_*, mon_*, boss_*, daily_*. */
  key: string;
  side: 'hero' | 'enemy';
  name: string;
  maxHp: number;
  /** HP at the start of the fight. */
  hp: number;
  /** null: melee; else what it shoots (timeline.ts). */
  shot: ShotStyle | null;
  /** The weapon's (or the monster's) element: an orb's colour. */
  element: Element | null;
  /** Hero rows (front first) / a monster's picture size against a hero (data/monsters.ts scale). */
  row?: 'front' | 'back';
  size?: number;
  boss?: boolean;
}

export interface BattleShow {
  heroes: BattleUnitSpec[];
  enemies: BattleUnitSpec[];
  /** The floor's element: which tower stands behind (tower_<element>). */
  element: Element | null;
}

export type RunEnd = 'done' | 'skipped' | 'stopped';

export interface BattleSceneOptions {
  reducedMotion: boolean;
  /** Every cue as it plays (sounds, the running damage total). */
  onCue?(cue: Cue): void;
  /** How big the fighters are drawn (layout.ts FIGHTER_SIZE when not given). */
  sizes?: FighterSize;
}

export interface BattleScene {
  /** Puts a fight's fighters on the field (pictures load first). `march`: the field scrolls as they come in (a new floor). */
  setup(show: BattleShow, march: boolean): Promise<void>;
  /** Plays a timeline; resolves when its end cue has played (or it is skipped or stopped). */
  run(tl: Timeline): Promise<RunEnd>;
  /** Jumps to the end of the running fight. */
  skip(): void;
  /** Stops the running fight where it is. */
  stop(): void;
  /** The running fight's playback clock (ms since its start, the timeline's time), or null between fights. */
  clockMs(): number | null;
  /** The monsters still standing go off in a puff (the idle hunt's end, 6.8). */
  scatter(): void;
  /** After the end: the heroes hop (a win) or stand. */
  finish(outcome: BattleOutcome): void;
  resize(w: number, h: number): void;
  /** Draws the fighters at other sizes, now (the 크기 panel). */
  setSizes(sizes: FighterSize): void;
  pause(on: boolean): void;
  /** How long the pictures and the GPU took to get ready (ms). */
  readonly readyMs: number;
  destroy(): void;
}


/** A plain doodle blob for a fighter with no picture (never expected; keeps the field whole). */
function standIn(side: 'hero' | 'enemy'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 160;
  const g = c.getContext('2d');
  if (g !== null) {
    g.lineWidth = 8;
    g.strokeStyle = '#3b2a20';
    g.fillStyle = side === 'hero' ? '#f6ebd5' : '#e46f5a';
    g.beginPath();
    g.ellipse(60, 92, 44, 62, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  return c;
}

/** An arrow or a crossbow bolt, pointing right, in the doodle line. */
function shotCanvas(style: 'arrow' | 'bolt'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 32;
  const g = c.getContext('2d');
  if (g === null) return c;
  const len = style === 'arrow' ? 80 : 60;
  const y = 16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const shaft = (w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(8, y);
    g.lineTo(8 + len, y);
    g.stroke();
  };
  shaft(style === 'arrow' ? 9 : 11, '#3b2a20');
  shaft(style === 'arrow' ? 4 : 6, style === 'arrow' ? '#d7b98a' : '#b9b2aa');
  // The head.
  g.fillStyle = '#e9e9ee';
  g.strokeStyle = '#3b2a20';
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(8 + len + 12, y);
  g.lineTo(8 + len - 4, y - 8);
  g.lineTo(8 + len - 4, y + 8);
  g.closePath();
  g.fill();
  g.stroke();
  if (style === 'arrow') {
    // Feathers.
    g.fillStyle = '#f6ebd5';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(10, y);
      g.lineTo(2, y + s * 9);
      g.lineTo(20, y + s * 2);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  return c;
}

// ---------- The scene ----------

interface Fighter {
  spec: BattleUnitSpec;
  actor: Actor;
  spot: FieldSpot;
  shadow: Graphics;
  bar: Graphics;
  /** The numbers floating over it, oldest first (NUMBERS). */
  nums: Float[];
  /** Its skill name in the air (a newer one replaces it). */
  label: Float | null;
  /** Numbers shown on it so far (left, right in turn). */
  numCount: number;
  hp: number;
  /** The bar's shown fill, easing toward hp (a pale trail behind it). */
  shownHp: number;
  trailHp: number;
  /** While walking in: from x (px), ms left. */
  enter: { fromX: number; t: number; dur: number } | null;
}

interface Float {
  obj: Container;
  t: number;
  dur: number;
  vy: number;
  kind: 'number' | 'burst' | 'spark' | 'puff' | 'label' | 'ring' | 'sun' | 'speed';
  x0: number;
  y0: number;
  scale0: number;
  /** Numbers: whose stack it is in, how far newer ones pushed it up (and where it is on the way), a boss's running sum. */
  owner?: Fighter;
  lift?: number;
  liftNow?: number;
  sum?: { amount: number; at: number } | null;
}

interface Flying {
  sprite: Sprite;
  t: number;
  dur: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  arc: number;
}

export async function createBattleScene(host: HTMLElement, width: number, height: number, opts: BattleSceneOptions): Promise<BattleScene> {
  const t0 = performance.now();
  const lease: AppLease = await acquireApp(host, width, height, { background: BATTLE_COLORS.sky });
  await ensureNumberFont();
  const app = lease.app;
  const reduced = opts.reducedMotion;
  let sizes: FighterSize = opts.sizes ?? FIGHTER_SIZE;
  let W = Math.max(1, Math.round(width));
  let H = Math.max(1, Math.round(height));
  let destroyed = false;

  const root = new Container();
  app.stage.addChild(root);
  const shakeLayer = new Container();
  root.addChild(shakeLayer);
  const backdrop = new Container();
  const field = new Graphics();
  const tufts = new Graphics();
  const units = new Container();
  units.sortableChildren = true;
  const fx = new Container();
  const hud = new Container();
  shakeLayer.addChild(backdrop, field, tufts, units, fx);
  root.addChild(hud);

  // ---- Textures made here (freed on destroy) and pictures loaded here (unloaded on destroy) ----
  const made: Texture[] = [];
  const fromCanvas = (c: HTMLCanvasElement): Texture => {
    const t = Texture.from(c, true);
    made.push(t);
    return t;
  };
  const tex = {
    burst: fromCanvas(draw.burst(128, 9)),
    star: fromCanvas(draw.doodle('star', 48)),
    cross: fromCanvas(draw.doodle('cross', 48)),
    dot: fromCanvas(draw.doodle('dot', 40)),
    cloud: fromCanvas(draw.cloud(96)),
    speed: fromCanvas(draw.speedLines(192, 12)),
    sun: fromCanvas(draw.sunburst(256, 14)),
    ring: fromCanvas(draw.runeRing(192)),
    arrow: fromCanvas(shotCanvas('arrow')),
    bolt: fromCanvas(shotCanvas('bolt')),
    heroStandIn: fromCanvas(standIn('hero')),
    enemyStandIn: fromCanvas(standIn('enemy')),
  };
  /** Sheet frames: views on a loaded picture's source (freed without it). */
  const frameTex: Texture[] = [];
  const loaded = new Map<string, Promise<Texture | null>>();
  /** A picture this screen holds (render/app.ts): given back on destroy. */
  const picture = (url: string | null): Promise<Texture | null> => {
    if (url === null) return Promise.resolve(null);
    const had = loaded.get(url);
    if (had !== undefined) return had;
    const t = holdAsset(url);
    loaded.set(url, t);
    return t;
  };
  const sheetsFor = async (key: string): Promise<Partial<Record<AnimAction, Texture[]>>> => {
    const out: Partial<Record<AnimAction, Texture[]>> = {};
    for (const [action, url] of Object.entries(sheetUrls(key)) as [AnimAction, string][]) {
      const t = await picture(url);
      const frames = t !== null ? sliceSheet(t, ANIM_SPEC[action].frames) : null;
      if (frames !== null) {
        frameTex.push(...frames);
        out[action] = frames;
      }
    }
    return out;
  };

  // ---- The field: sky, far hills, the tower, the ground, tufts (flat shapes, ink line) ----
  let towerSprite: Sprite | null = null;
  let towerElement: Element | null = null;
  const clouds: Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new Sprite(tex.cloud);
    s.anchor.set(0.5);
    s.alpha = 0.95;
    backdrop.addChild(s);
    clouds.push(s);
  }
  const hills = new Graphics();
  backdrop.addChild(hills);
  let groundShift = 0;
  const drawField = () => {
    const hy = H * FIELD.horizon;
    hills.clear();
    // Far hills, then near ones, each a row of humps with the ink line on top.
    const hump = (g: Graphics, base: number, amp: number, n: number, color: number, phase: number) => {
      g.moveTo(-10, H);
      g.lineTo(-10, base);
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * (W + 20) - 10;
        const y = base - amp * (0.6 + 0.4 * Math.sin(i * 1.7 + phase));
        g.quadraticCurveTo(x - W / n / 2, y - amp * 0.4, x, base - amp * 0.2);
      }
      g.lineTo(W + 10, H);
      g.closePath();
      g.fill(color).stroke({ width: 3, color: INK, join: 'round' });
    };
    hump(hills, hy - 2, H * 0.06, 4, BATTLE_COLORS.hillFar, 0.4);
    hump(hills, hy + 2, H * 0.035, 6, BATTLE_COLORS.hill, 2.1);
    field.clear();
    field.rect(-10, hy, W + 20, H - hy + 10).fill(BATTLE_COLORS.ground);
    field.rect(-10, H * 0.75, W + 20, H * 0.3).fill(BATTLE_COLORS.groundNear);
    field.moveTo(-10, hy).lineTo(W + 10, hy).stroke({ width: 3, color: INK });
    // A worn path along the middle.
    field.ellipse(W / 2, H * 0.74, W * 0.62, H * 0.08).fill(BATTLE_COLORS.path);
    drawTufts();
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i] as Sprite;
      c.width = W * (0.22 - i * 0.03);
      c.height = c.width * 0.62;
      c.position.set(((i * 0.37 + 0.12) * W + cloudShift * (1 + i * 0.4)) % (W + c.width) - c.width / 2, H * (0.1 + i * 0.07));
    }
    if (towerSprite !== null) {
      // Far off behind the hills: the tower the heroes climb (9.2), small.
      const th = Math.min(H * 0.34, W * 0.75);
      towerSprite.height = th;
      towerSprite.scale.x = towerSprite.scale.y;
      towerSprite.position.set(W * 0.56, hy + H * 0.01);
    }
  };
  /** Grass tufts and pebbles, in fixed places (they scroll on a march). */
  const TUFTS: readonly [number, number, number][] = [
    [0.05, 0.5, 1], [0.21, 0.63, 0.8], [0.33, 0.95, 1.1], [0.47, 0.55, 0.7], [0.58, 0.97, 1],
    [0.7, 0.6, 0.9], [0.82, 0.93, 1.2], [0.93, 0.68, 0.8], [0.12, 0.83, 0.9], [0.4, 0.78, 0.6],
    [0.66, 0.79, 0.7], [0.88, 0.52, 0.6],
  ];
  const drawTufts = () => {
    tufts.clear();
    const hy = H * FIELD.horizon;
    const s = Math.max(4, H * 0.018);
    for (const [fx0, fy, k] of TUFTS) {
      const x = ((((fx0 * W - groundShift) % W) + W) % W);
      const y = hy + (H - hy) * fy * 0.98;
      const sz = s * k;
      tufts
        .moveTo(x - sz, y)
        .quadraticCurveTo(x - sz * 0.8, y - sz * 1.2, x - sz * 1.1, y - sz * 1.9)
        .moveTo(x, y)
        .quadraticCurveTo(x, y - sz * 1.4, x + sz * 0.2, y - sz * 2.3)
        .moveTo(x + sz, y)
        .quadraticCurveTo(x + sz * 0.9, y - sz * 1.1, x + sz * 1.3, y - sz * 1.7)
        .stroke({ width: Math.max(2, sz * 0.45), color: INK, cap: 'round' });
      tufts
        .moveTo(x - sz, y)
        .quadraticCurveTo(x - sz * 0.8, y - sz * 1.2, x - sz * 1.1, y - sz * 1.9)
        .moveTo(x, y)
        .quadraticCurveTo(x, y - sz * 1.4, x + sz * 0.2, y - sz * 2.3)
        .moveTo(x + sz, y)
        .quadraticCurveTo(x + sz * 0.9, y - sz * 1.1, x + sz * 1.3, y - sz * 1.7)
        .stroke({ width: Math.max(1, sz * 0.18), color: BATTLE_COLORS.tuft, cap: 'round' });
    }
  };
  let cloudShift = 0;
  const setTower = async (el: Element | null) => {
    if (el === towerElement && towerSprite !== null) return;
    towerElement = el;
    const t = await picture(townMapUrl(`tower_${el ?? 'fire'}`));
    if (destroyed) return;
    if (towerSprite !== null) {
      towerSprite.destroy();
      towerSprite = null;
    }
    if (t === null) return;
    towerSprite = new Sprite(t);
    towerSprite.anchor.set(0.5, 1);
    towerSprite.alpha = 0.85;
    backdrop.addChildAt(towerSprite, clouds.length);
    drawField();
  };

  // ---- The boss's big bar (a lone boss) ----
  const bossBar = new Graphics();
  const bossName = new Text({ text: '', style: { fontFamily: FONT, fontSize: 15, fill: 0xffffff, stroke: { color: INK, width: 4, join: 'round' } } });
  bossName.anchor.set(0, 1);
  hud.addChild(bossBar, bossName);

  // ---- Fighters ----
  let fighters: Fighter[] = [];
  const byId = new Map<string, Fighter>();
  const clearFighters = () => {
    for (const f of fighters) {
      f.actor.destroy();
      f.shadow.destroy();
      f.bar.destroy();
    }
    fighters = [];
    byId.clear();
  };
  let boss: Fighter | null = null;

  const barW = (f: Fighter) => Math.max(34, Math.min(72, f.actor.height * 0.62));
  const drawBar = (f: Fighter) => {
    const g = f.bar;
    g.clear();
    if (f === boss || f.actor.isDown()) return;
    const w = barW(f);
    const h = 7;
    const x = -w / 2;
    g.roundRect(x - 2, -2, w + 4, h + 4, 5).fill(INK);
    g.roundRect(x, 0, w, h, 3).fill(BATTLE_COLORS.hpBack);
    const max = Math.max(1, f.spec.maxHp);
    if (f.trailHp > f.shownHp) g.roundRect(x, 0, (w * f.trailHp) / max, h, 3).fill(BATTLE_COLORS.hpTrail);
    if (f.shownHp > 0) g.roundRect(x, 0, Math.max(3, (w * f.shownHp) / max), h, 3).fill(f.spec.side === 'hero' ? BATTLE_COLORS.heroHp : BATTLE_COLORS.enemyHp);
  };
  const drawBossBar = () => {
    bossBar.clear();
    bossName.visible = boss !== null;
    if (boss === null) return;
    const w = Math.min(W - 32, 420);
    const x = (W - w) / 2;
    const y = 30;
    const h = 14;
    const max = Math.max(1, boss.spec.maxHp);
    bossBar.roundRect(x - 3, y - 3, w + 6, h + 6, 9).fill(INK);
    bossBar.roundRect(x, y, w, h, 6).fill(BATTLE_COLORS.hpBack);
    if (boss.trailHp > boss.shownHp) bossBar.roundRect(x, y, (w * boss.trailHp) / max, h, 6).fill(BATTLE_COLORS.hpTrail);
    if (boss.shownHp > 0) bossBar.roundRect(x, y, Math.max(6, (w * boss.shownHp) / max), h, 6).fill(BATTLE_COLORS.enemyHp);
    bossName.text = boss.spec.name;
    bossName.position.set(x + 2, y - 4);
  };

  const place = (f: Fighter, dx = 0) => {
    const x = f.spot.x + dx;
    f.actor.view.position.set(x, f.spot.y);
    f.actor.view.zIndex = f.spot.y;
    f.shadow.position.set(x, f.spot.y);
    f.shadow.alpha = f.actor.view.alpha;
    f.bar.position.set(x, f.spot.y - f.actor.height * 1.0 - 12);
  };

  const heightOf = (spec: BattleUnitSpec, aspect: number) =>
    fighterHeight(W, H, { side: spec.side, boss: spec.boss === true, size: spec.side === 'hero' ? 1 : (spec.size ?? 0.65) }, aspect, sizes);

  const layoutFighters = () => {
    for (const f of fighters) f.actor.resize(heightOf(f.spec, f.actor.width / Math.max(1, f.actor.height)));
    const heroes = fighters.filter((f) => f.spec.side === 'hero');
    const front = heroes.filter((f) => f.spec.row !== 'back');
    const back = heroes.filter((f) => f.spec.row === 'back');
    const hs = heroSpots(W, H, front.length, back.length);
    front.forEach((f, i) => (f.spot = hs.front[i] as FieldSpot));
    back.forEach((f, i) => (f.spot = hs.back[i] as FieldSpot));
    const enemies = fighters.filter((f) => f.spec.side === 'enemy');
    const es = enemySpots(W, H, enemies.length, enemies.length === 1 && enemies[0]?.spec.boss === true);
    enemies.forEach((f, i) => (f.spot = es[i] as FieldSpot));
    // A big lone boss stands in the middle of the fight: its body level with the heroes', its left
    // edge clear of the front row, its right of the field's edge.
    for (const f of enemies) {
      if (f.spec.boss !== true) continue;
      f.spot = { ...f.spot, x: bossCenterX(W, f.actor.width, f.spot.x), y: bossFeetY(H, f.actor.height, unitHeight(W, H) * sizes.hero) };
    }
    for (const f of fighters) {
      f.shadow.clear();
      const rx = f.actor.height * (f.spec.side === 'enemy' && f.spec.boss === true ? 0.42 : 0.3) * f.spot.depth;
      f.shadow.ellipse(0, 0, rx, rx * 0.28).fill({ color: INK, alpha: 0.16 });
      place(f);
      drawBar(f);
    }
  };

  const setup = async (show: BattleShow, march: boolean) => {
    const all = [...show.heroes, ...show.enemies];
    const pics = await Promise.all(
      all.map(async (u) => ({
        still: await picture(u.side === 'hero' ? heroArtUrl(u.key) : monsterArtUrl(u.key)),
        sheets: await sheetsFor(u.key),
      })),
    );
    void setTower(show.element);
    if (destroyed) return;
    clearFighters();
    all.forEach((spec, i) => {
      const p = pics[i];
      const still = p?.still ?? (spec.side === 'hero' ? tex.heroStandIn : tex.enemyStandIn);
      const actor = makeActor({
        still,
        sheets: p?.sheets,
        // A lone boss keeps to the monsters' side of the field, clear of the front row (layout.ts bossBox).
        height: heightOf(spec, still.width / Math.max(1, still.height)),
        facing: spec.side === 'hero' ? 1 : -1,
        melee: spec.shot === null,
        phase: (i * 0.37) % 1,
      });
      const shadow = new Graphics();
      const bar = new Graphics();
      units.addChild(shadow, actor.view);
      fx.addChild(bar);
      shadow.zIndex = -1;
      const f: Fighter = { spec, actor, spot: { x: 0, y: 0, depth: 1 }, shadow, bar, nums: [], label: null, numCount: 0, hp: spec.hp, shownHp: spec.hp, trailHp: spec.hp, enter: null };
      if (spec.hp <= 0) actor.down();
      fighters.push(f);
      byId.set(spec.id, f);
    });
    boss = fighters.find((f) => f.spec.side === 'enemy' && f.spec.boss === true) ?? null;
    layoutFighters();
    drawBossBar();
    // Coming in: the monsters slide in from the right; on a march the heroes walk in too and the ground scrolls.
    for (const f of fighters) {
      if (f.spec.side === 'enemy') f.enter = { fromX: W + f.actor.height, t: 0, dur: reduced ? 0 : 520 };
      else if (march) f.enter = { fromX: f.spot.x - W * 0.35, t: 0, dur: reduced ? 0 : 520 };
    }
    marchLeft = march && !reduced ? 520 : 0;
  };
  let marchLeft = 0;

  // ---- Floats: numbers, bursts, sparkles, puffs, names ----
  const floats: Float[] = [];
  const addFloat = (obj: Container, kind: Float['kind'], dur: number, vy = 0) => {
    fx.addChild(obj);
    floats.push({ obj, kind, t: 0, dur, vy, x0: obj.position.x, y0: obj.position.y, scale0: obj.scale.x });
  };
  const bodyPoint = (f: Fighter) => ({ x: f.actor.view.position.x, y: f.spot.y - f.actor.height * 0.5 });
  // ---- Numbers: a pool of bitmap texts, a short stack over each fighter ----
  const numPool: BitmapText[] = [];
  const takeNumber = (): BitmapText => {
    const n = numPool.pop() ?? new BitmapText({ text: '', style: { fontFamily: NUMBER_FONT, fontSize: NUMBERS.fontSize } });
    n.anchor.set(0.5);
    n.alpha = 1;
    n.visible = true;
    return n;
  };
  /** A float leaves: a number goes back to the pool (and out of its stack), anything else is destroyed. */
  const dropFloat = (f: Float) => {
    if (f.kind === 'number' && f.obj instanceof BitmapText) {
      f.obj.removeFromParent();
      f.obj.visible = false;
      numPool.push(f.obj);
      if (f.owner !== undefined) {
        const i = f.owner.nums.indexOf(f);
        if (i >= 0) f.owner.nums.splice(i, 1);
      }
      return;
    }
    f.obj.destroy({ children: true });
  };
  const fmtNum = (n: number) => n.toLocaleString('ko-KR');

  /**
   * A number over a fighter: it takes the bottom of the fighter's stack and pushes the ones there up.
   * `merge`: a lone boss's plain hit joins the newest plain number when that came within bossMergeMs.
   */
  const numberAt = (f: Fighter, amount: number, opts: { prefix?: string; crit?: boolean; tint: number; size: number; merge?: boolean }) => {
    if (opts.merge === true) {
      const last = f.nums[f.nums.length - 1];
      if (last !== undefined && last.sum != null && time - last.sum.at <= NUMBERS.bossMergeMs) {
        last.sum.amount += amount;
        last.sum.at = time;
        (last.obj as BitmapText).text = fmtNum(last.sum.amount);
        last.t = Math.min(last.t, last.dur * 0.15);
        return;
      }
    }
    const n = takeNumber();
    n.text = `${opts.prefix ?? ''}${fmtNum(amount)}${opts.crit === true ? '!' : ''}`;
    n.tint = opts.tint;
    const scale = opts.size / NUMBERS.fontSize;
    n.scale.set(scale);
    const p = bodyPoint(f);
    const side = f.numCount % 2 === 0 ? -1 : 1;
    f.numCount += 1;
    const x = Math.max(24, Math.min(W - 24, p.x + side * f.actor.height * NUMBERS.side));
    const y = p.y - f.actor.height * 0.12;
    n.position.set(x, y);
    // The ones already there go up a line; past the stack's size the oldest hurries away.
    const step = opts.size * NUMBERS.lineGap;
    for (const o of f.nums) o.lift = (o.lift ?? 0) + step;
    while (f.nums.length >= NUMBERS.perTarget) {
      const old = f.nums.shift() as Float;
      old.owner = undefined;
      old.t = Math.max(old.t, old.dur * 0.9);
    }
    fx.addChild(n);
    const fl: Float = {
      obj: n,
      kind: 'number',
      t: 0,
      dur: lifeAt(opts.crit === true ? NUMBERS.critLife : NUMBERS.life),
      vy: -f.actor.height * 0.18,
      x0: x,
      y0: y,
      scale0: scale,
      owner: f,
      lift: 0,
      liftNow: 0,
      sum: opts.merge === true ? { amount, at: time } : null,
    };
    f.nums.push(fl);
    floats.push(fl);
  };

  const burstAt = (x: number, y: number, size: number, tint: number, dur = 220) => {
    const s = new Sprite(tex.burst);
    s.anchor.set(0.5);
    s.tint = tint;
    s.width = size;
    s.height = size;
    s.rotation = Math.random() * Math.PI;
    s.position.set(x, y);
    addFloat(s, 'burst', dur);
  };

  const sparkAt = (f: Fighter, n: number, tint: number) => {
    const p = bodyPoint(f);
    for (let i = 0; i < n; i++) {
      const s = new Sprite(i % 2 === 0 ? tex.star : tex.cross);
      s.anchor.set(0.5);
      s.tint = tint;
      const sz = f.actor.height * (0.14 + Math.random() * 0.1);
      s.width = sz;
      s.height = sz;
      s.position.set(p.x + (Math.random() - 0.5) * f.actor.height * 0.7, p.y + (Math.random() - 0.2) * f.actor.height * 0.5);
      addFloat(s, 'spark', 700 + Math.random() * 300, -f.actor.height * 0.5);
    }
  };

  const puffAt = (f: Fighter) => {
    const p = bodyPoint(f);
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(tex.cloud);
      s.anchor.set(0.5);
      const sz = f.actor.height * (0.45 + i * 0.12);
      s.width = sz;
      s.height = sz * 0.75;
      s.position.set(p.x + (i - 1) * f.actor.height * 0.25, p.y + f.actor.height * 0.2 - i * 6);
      addFloat(s, 'puff', 520, -f.actor.height * 0.25);
    }
  };

  /**
   * Words in the air last less at a faster playback (×2, ×4), so skills and numbers coming four times
   * as often do not pile up: life ÷ (speed × NUMBERS.speedShare), never below a third.
   */
  const lifeAt = (ms: number) => ms / Math.min(3, Math.max(1, playSpeed * NUMBERS.speedShare));
  const labelAt = (f: Fighter, text: string, big: boolean) => {
    // A newer name from the same fighter takes the old one's place.
    if (f.label !== null && floats.includes(f.label)) f.label.t = f.label.dur;
    const c = new Container();
    const t = new Text({ text, style: { fontFamily: FONT, fontSize: big ? 17 : 14, fill: INK } });
    t.anchor.set(0.5);
    const g = new Graphics();
    const w = t.width + 18;
    const h = t.height + 8;
    g.roundRect(-w / 2, -h / 2 + 2, w, h, 10).fill(INK);
    g.roundRect(-w / 2, -h / 2, w, h, 10).fill(big ? 0xfbe8a6 : 0xfff8ea).stroke({ width: 2.5, color: INK });
    c.addChild(g, t);
    const x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, f.actor.view.position.x));
    c.position.set(x, f.spot.y - f.actor.height - 34);
    addFloat(c, 'label', lifeAt(big ? 1300 : 950), -10);
    f.label = floats[floats.length - 1] ?? null;
  };

  const sunAt = (f: Fighter) => {
    const p = bodyPoint(f);
    const s = new Sprite(tex.sun);
    s.anchor.set(0.5);
    s.tint = BATTLE_COLORS.sunburst;
    s.width = f.actor.height * 2.6;
    s.height = f.actor.height * 2.6;
    s.position.set(p.x, p.y);
    s.alpha = 0.7;
    fx.addChildAt(s, 0);
    floats.push({ obj: s, kind: 'sun', t: 0, dur: 1000, vy: 0, x0: p.x, y0: p.y, scale0: s.scale.x });
    const r = new Sprite(tex.ring);
    r.anchor.set(0.5);
    r.tint = BATTLE_COLORS.ring;
    r.width = f.actor.height * 1.5;
    r.height = f.actor.height * 0.5;
    r.position.set(f.actor.view.position.x, f.spot.y);
    addFloat(r, 'ring', 900);
  };

  const speedAt = (f: Fighter) => {
    const p = bodyPoint(f);
    const s = new Sprite(tex.speed);
    s.anchor.set(0.5);
    s.width = f.actor.height * 1.5;
    s.height = f.actor.height * 1.5;
    s.position.set(p.x, p.y);
    addFloat(s, 'speed', 360);
  };

  // ---- Shots ----
  const flying: Flying[] = [];
  const shoot = (src: Fighter, dst: Fighter, dur: number, style: ShotStyle) => {
    const a = bodyPoint(src);
    const b = bodyPoint(dst);
    const from = { x: a.x + src.actor.height * 0.25 * (src.spec.side === 'hero' ? 1 : -1), y: a.y - src.actor.height * 0.1 };
    const s = new Sprite(style === 'orb' ? tex.dot : style === 'arrow' ? tex.arrow : tex.bolt);
    s.anchor.set(0.5);
    if (style === 'orb') {
      const sz = Math.max(16, src.actor.height * 0.24);
      s.width = sz;
      s.height = sz;
      s.tint = src.spec.element !== null ? BATTLE_COLORS.element[src.spec.element] : 0xfff4c2;
    } else {
      const k = Math.max(0.45, src.actor.height / 150);
      s.scale.set(k * (b.x < from.x ? -1 : 1), k);
    }
    s.position.set(from.x, from.y);
    fx.addChild(s);
    flying.push({ sprite: s, t: 0, dur: Math.max(16, dur), from, to: b, arc: style === 'arrow' ? src.actor.height * 0.25 : style === 'orb' ? src.actor.height * 0.1 : 0 });
  };

  // ---- Shake ----
  let shake = 0;
  const kick = (amount: number) => {
    if (reduced) return;
    shake = Math.max(shake, amount);
  };

  // ---- Playing a timeline ----
  let running: { tl: Timeline; clock: number; next: number; resolve(end: RunEnd): void } | null = null;
  /** The playing timeline's speed (the words in the air follow it). */
  let playSpeed = 1;
  const applyCue = (c: Cue, quiet: boolean) => {
    switch (c.kind) {
      case 'act': {
        const f = byId.get(c.unit);
        if (f === undefined || quiet) return;
        f.actor.play(c.action, c.dur);
        if (c.action === 'ultimate') {
          sunAt(f);
          kick(f.actor.height * 0.08);
        } else if (c.action === 'skill' && f.spec.shot === null) speedAt(f);
        return;
      }
      case 'cast': {
        const f = byId.get(c.unit);
        if (f !== undefined && !quiet) labelAt(f, c.via === 'signature' ? `${c.name}!!` : `${c.name}!`, c.via === 'signature');
        return;
      }
      case 'shot': {
        const s = byId.get(c.src);
        const d = byId.get(c.dst);
        if (s !== undefined && d !== undefined && !quiet) shoot(s, d, c.dur, c.style);
        return;
      }
      case 'impact': {
        const d = byId.get(c.dst);
        if (d === undefined) return;
        d.hp = c.hpAfter;
        if (quiet) return;
        d.actor.hit();
        const p = bodyPoint(d);
        const heroHit = d.spec.side === 'hero';
        burstAt(p.x + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10, d.actor.height * (c.crit ? 0.75 : 0.5), c.crit ? BATTLE_COLORS.burstCrit : BATTLE_COLORS.burst, c.crit ? 280 : 200);
        const size = Math.round(Math.max(16, Math.min(26, d.actor.height * 0.2)) * (c.crit ? 1.45 : 1) * (heroHit ? 0.85 : 1));
        const fill = heroHit ? BATTLE_COLORS.numberHurt : c.crit ? BATTLE_COLORS.numberCrit : c.good ? BATTLE_COLORS.numberGood : BATTLE_COLORS.number;
        // A lone boss: the plain hits close together add up into one number; a crit stands apart.
        const merge = !heroHit && !c.crit && d === boss;
        numberAt(d, c.amount, { crit: c.crit, tint: fill, size, merge });
        if (c.crit) kick(d.actor.height * 0.06);
        else if (heroHit && byId.get(c.src)?.spec.boss === true) kick(d.actor.height * 0.05);
        return;
      }
      case 'heal': {
        const d = byId.get(c.dst);
        if (d === undefined) return;
        d.hp = c.hpAfter;
        if (quiet) return;
        sparkAt(d, 3, BATTLE_COLORS.heal);
        numberAt(d, c.amount, { prefix: '+', tint: BATTLE_COLORS.heal, size: Math.round(Math.max(15, d.actor.height * 0.18)) });
        return;
      }
      case 'down': {
        const f = byId.get(c.unit);
        if (f === undefined) return;
        f.hp = 0;
        f.actor.down();
        f.bar.clear();
        if (!quiet && f.spec.side === 'enemy') puffAt(f);
        return;
      }
      case 'end':
        return;
    }
  };

  // ---- Frame ----
  let time = 0;
  const tick = () => {
    if (destroyed) return;
    const dt = Math.min(64, app.ticker.deltaMS);
    time += dt;
    // The fight's clock.
    if (running !== null) {
      running.clock += dt;
      const cues = running.tl.cues;
      while (running !== null && running.next < cues.length && (cues[running.next] as Cue).at <= running.clock) {
        const c = cues[running.next] as Cue;
        running.next += 1;
        applyCue(c, false);
        opts.onCue?.(c);
        if (c.kind === 'end') {
          const r = running;
          running = null;
          r.resolve('done');
        }
      }
    }
    // A march: the ground and the clouds move as the heroes come in.
    if (marchLeft > 0) {
      const step = Math.min(marchLeft, dt);
      marchLeft -= step;
      groundShift += (W * 0.6 * step) / 520;
      drawTufts();
    }
    cloudShift += dt * 0.004;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i] as Sprite;
      const span = W + c.width;
      c.position.x = ((((i * 0.37 + 0.12) * W + cloudShift * (1 + i * 0.4)) % span) + span) % span - c.width / 2;
    }
    for (const f of fighters) {
      let dx = 0;
      if (f.enter !== null) {
        f.enter.t += dt;
        const k = f.enter.dur <= 0 ? 1 : Math.min(1, f.enter.t / f.enter.dur);
        const e = 1 - (1 - k) ** 3;
        dx = (f.enter.fromX - f.spot.x) * (1 - e);
        if (k >= 1) f.enter = null;
      }
      f.actor.update(dt, time);
      place(f, dx);
      // The bar eases to the HP; its pale trail follows a little later.
      const before = `${f.shownHp}|${f.trailHp}`;
      f.shownHp += (f.hp - f.shownHp) * Math.min(1, dt / 70);
      if (Math.abs(f.shownHp - f.hp) < 0.5) f.shownHp = f.hp;
      if (f.trailHp < f.shownHp) f.trailHp = f.shownHp;
      else f.trailHp += (f.shownHp - f.trailHp) * Math.min(1, dt / 380);
      if (Math.abs(f.trailHp - f.shownHp) < 0.5) f.trailHp = f.shownHp;
      if (`${f.shownHp}|${f.trailHp}` !== before) {
        if (f === boss) drawBossBar();
        else drawBar(f);
      }
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const s = flying[i] as Flying;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const x = s.from.x + (s.to.x - s.from.x) * k;
      const y = s.from.y + (s.to.y - s.from.y) * k - Math.sin(k * Math.PI) * s.arc;
      const dy = (s.to.y - s.from.y) - Math.cos(k * Math.PI) * Math.PI * s.arc;
      s.sprite.position.set(x, y);
      if (s.sprite.texture !== tex.dot) s.sprite.rotation = Math.atan2(dy, s.to.x - s.from.x) - (s.to.x < s.from.x ? Math.PI : 0);
      else s.sprite.rotation += dt * 0.01;
      if (k >= 1) {
        s.sprite.destroy();
        flying.splice(i, 1);
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i] as Float;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const o = f.obj;
      switch (f.kind) {
        case 'number': {
          // Pops up, drifts up a little, moves up a line when a newer one comes under it, fades at the end.
          const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : k < 0.3 ? 1.15 - ((k - 0.15) / 0.15) * 0.15 : 1;
          o.scale.set(f.scale0 * pop);
          f.liftNow = (f.liftNow ?? 0) + ((f.lift ?? 0) - (f.liftNow ?? 0)) * Math.min(1, dt / 45);
          o.position.y = f.y0 - f.liftNow + f.vy * (1 - (1 - k) ** 2);
          o.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
          break;
        }
        case 'burst':
          o.scale.set(f.scale0 * (0.6 + 0.6 * k));
          o.alpha = 1 - k;
          break;
        case 'spark':
          o.position.y = f.y0 + f.vy * k;
          o.rotation += dt * 0.004;
          o.alpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
          break;
        case 'puff':
          o.scale.set(f.scale0 * (0.7 + 0.6 * k));
          o.position.y = f.y0 + f.vy * k;
          o.alpha = 1 - k * k;
          break;
        case 'label':
          o.position.y = f.y0 + f.vy * Math.min(1, k * 4);
          o.alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : Math.min(1, k * 8);
          break;
        case 'sun':
          o.rotation += dt * 0.0012;
          o.scale.set(f.scale0 * (0.6 + 0.5 * Math.min(1, k * 3)));
          o.alpha = 0.7 * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
          break;
        case 'ring':
          o.scale.set(f.scale0 * (0.5 + k * 0.8), o.scale.y);
          o.alpha = 1 - k;
          break;
        case 'speed':
          o.scale.set(f.scale0 * (0.8 + 0.4 * k));
          o.alpha = 1 - k;
          break;
      }
      if (k >= 1) {
        dropFloat(f);
        floats.splice(i, 1);
      }
    }
    if (shake > 0.2) {
      shakeLayer.position.set((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
      shake *= Math.pow(0.86, dt / 16);
    } else if (shake !== 0) {
      shake = 0;
      shakeLayer.position.set(0, 0);
    }
  };

  drawField();
  app.ticker.add(tick);
  const readyMs = performance.now() - t0;

  const clearFx = () => {
    for (const f of floats) dropFloat(f);
    floats.length = 0;
    for (const f of fighters) f.nums.length = 0;
    for (const s of flying) s.sprite.destroy();
    flying.length = 0;
  };

  return {
    setup,
    run(tl) {
      if (running !== null) running.resolve('stopped');
      playSpeed = tl.speed;
      return new Promise<RunEnd>((resolve) => {
        running = { tl, clock: 0, next: 0, resolve };
      });
    },
    skip() {
      const r = running;
      if (r === null) return;
      running = null;
      for (let i = r.next; i < r.tl.cues.length; i++) applyCue(r.tl.cues[i] as Cue, true);
      clearFx();
      r.resolve('skipped');
    },
    stop() {
      const r = running;
      if (r === null) return;
      running = null;
      r.resolve('stopped');
    },
    clockMs() {
      return running !== null ? running.clock : null;
    },
    scatter() {
      // The monsters still standing puff away (the idle hunt never shows a group left over, 6.8).
      for (const f of fighters) {
        if (f.spec.side !== 'enemy' || f.actor.isDown()) continue;
        f.hp = 0;
        f.actor.down();
        f.bar.clear();
        if (!reduced) puffAt(f);
      }
      if (boss !== null) drawBossBar();
    },
    finish(outcome) {
      for (const f of fighters) {
        if (f.actor.isDown()) continue;
        if (outcome === 'win' && f.spec.side === 'hero') f.actor.play('victory');
        else f.actor.play('idle');
      }
    },
    resize(w, h) {
      if (destroyed) return;
      W = Math.max(1, Math.round(w));
      H = Math.max(1, Math.round(h));
      lease.resize(W, H);
      drawField();
      layoutFighters();
      drawBossBar();
    },
    setSizes(next) {
      if (destroyed) return;
      sizes = next;
      layoutFighters();
    },
    pause(on) {
      if (destroyed) return;
      lease.pause(on);
    },
    readyMs,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (running !== null) {
        const r = running;
        running = null;
        r.resolve('stopped');
      }
      app.ticker.remove(tick);
      clearFx();
      app.stage.removeChild(root);
      root.destroy({ children: true });
      for (const n of numPool) n.destroy();
      numPool.length = 0;
      lease.release();
      for (const t of made) t.destroy(true);
      for (const t of frameTex) t.destroy(false);
      // The pictures this screen loaded go from memory and the GPU (화면별로 불러오고 내린다) unless another screen holds them.
      const urls = [...loaded.keys()];
      loaded.clear();
      releaseAssets(urls);
    },
  };
}
