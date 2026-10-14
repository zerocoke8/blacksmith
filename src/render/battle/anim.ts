// 전투 동작 한 겹 (사용자 결정 13): one fighter on the field. When a sprite sheet for an action exists
// (src/assets/art/anim/<key>@<action>.webp, motion.ts ANIM_SPEC, tools/art/README.md) it plays as an
// AnimatedSprite; without one, the still picture moves by coordinates (motion.ts): it breathes when
// idle, steps out and back to strike, kicks back on a shot, is pushed back with a white flash when
// hit, hops on a win, rises for a signature. The scene asks for actions; this layer picks how.
// A sheet's frames move with the same lunge, without the still's squash (the frames carry the pose).

import { AnimatedSprite, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { ANIM_ANCHOR, ANIM_SPEC, type AnimAction, actionMs, MOTION, type MotionAction, motionPose } from './motion.ts';

export { ANIM_ACTIONS, ANIM_ANCHOR, ANIM_SPEC, ANIM_DRAWN_FACING, actionMs } from './motion.ts';
export type { AnimAction, AnimSpec } from './motion.ts';

export interface ActorOptions {
  /** The still picture (null: a stand-in blob is drawn by the scene and passed in as a texture). */
  still: Texture;
  /** Sheets by action, already sliced into frames (sliceSheet). */
  sheets?: Partial<Record<AnimAction, Texture[]>>;
  /** On-screen height of the picture (px). */
  height: number;
  /** +1 looks right (a hero), −1 left (a monster). Pictures are drawn looking left. */
  facing: 1 | -1;
  /** Melee fighters lunge; the others recoil. */
  melee: boolean;
  /** 0..1: offsets the breathing so a row does not breathe as one. */
  phase: number;
}

export interface Actor {
  /** Put this at the fighter's feet. */
  readonly view: Container;
  /** The picture's on-screen height and width (px). */
  readonly height: number;
  readonly width: number;
  /** Draws it at another height (px), in the middle of whatever it is doing (the 크기 panel). */
  resize(height: number): void;
  /** Starts an action; one-shot ones last `durMs` (default: the sheet's length) and go back to idle. */
  play(action: AnimAction, durMs?: number): void;
  hit(): void;
  /** Falls and fades (stays down). */
  down(): void;
  /** Back on its feet, idle (a new fight). */
  revive(): void;
  isDown(): boolean;
  /** Advance by dt ms; `time` is the scene clock. */
  update(dt: number, time: number): void;
  destroy(): void;
}

/** Cuts a horizontal strip into `frames` equal cells (null when it does not divide). */
export function sliceSheet(tex: Texture, frames: number): Texture[] | null {
  const w = tex.frame.width;
  const h = tex.frame.height;
  if (frames < 1 || w % frames !== 0) return null;
  const cell = w / frames;
  const out: Texture[] = [];
  for (let i = 0; i < frames; i++) {
    out.push(new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + i * cell, tex.frame.y, cell, h) }));
  }
  return out;
}

export function makeActor(opts: ActorOptions): Actor {
  const view = new Container();
  const body = new Container();
  view.addChild(body);
  const still = new Sprite(opts.still);
  still.anchor.set(ANIM_ANCHOR.x, ANIM_ANCHOR.y);
  let height = opts.height;
  let k = height / Math.max(1, opts.still.height);
  // The flash: the same picture added over itself (brightens toward white), shown on a hit.
  const flash = new Sprite(opts.still);
  flash.anchor.set(ANIM_ANCHOR.x, ANIM_ANCHOR.y);
  flash.blendMode = 'add';
  flash.alpha = 0;
  body.addChild(still, flash);
  const mirror = opts.facing === 1 ? -1 : 1;
  /** px per motion unit (MOTION is in px at a fighter 100 px tall). */
  let u = height / 100;

  const sheets = new Map<AnimAction, AnimatedSprite>();
  /** A sheet's frame height (px of the picture). */
  const frameH = new Map<AnimatedSprite, number>();
  for (const [action, frames] of Object.entries(opts.sheets ?? {}) as [AnimAction, Texture[]][]) {
    if (frames.length === 0) continue;
    const a = new AnimatedSprite(frames);
    a.anchor.set(ANIM_ANCHOR.x, ANIM_ANCHOR.y);
    a.animationSpeed = ANIM_SPEC[action].fps / 60;
    a.loop = ANIM_SPEC[action].loop;
    a.visible = false;
    a.autoUpdate = false;
    frameH.set(a, frames[0]?.height ?? 1);
    body.addChild(a);
    sheets.set(action, a);
  }

  const scaleSheets = () => {
    for (const a of sheets.values()) {
      const fh = frameH.get(a) ?? 1;
      a.scale.set((height / fh) * mirror, height / fh);
    }
  };
  scaleSheets();

  let action: MotionAction = 'idle';
  let t = 0;
  let dur = 0;
  let flashLeft = 0;
  let hitT = -1;
  let fallen = false;

  const showSheet = (a: MotionAction) => {
    const s = a === 'down' ? undefined : sheets.get(a);
    for (const [key, sp] of sheets) {
      sp.visible = sp === s;
      if (sp === s && key === a) sp.gotoAndPlay(0);
    }
    still.visible = s === undefined;
    return s !== undefined;
  };
  showSheet('idle');

  const api: Actor = {
    view,
    get height() {
      return height;
    },
    get width() {
      return height * (opts.still.width / Math.max(1, opts.still.height));
    },
    resize(next) {
      height = Math.max(1, next);
      k = height / Math.max(1, opts.still.height);
      u = height / 100;
      scaleSheets();
    },
    play(next, durMs) {
      if (fallen) return;
      action = next;
      t = 0;
      dur = durMs ?? (ANIM_SPEC[next].loop ? Number.POSITIVE_INFINITY : actionMs(next));
      showSheet(next);
    },
    hit() {
      if (fallen) return;
      // A hit shows over whatever it is doing (a lunge is not cut short): a push back and a flash.
      hitT = 0;
      flashLeft = 1;
    },
    down() {
      if (fallen) return;
      fallen = true;
      action = 'down';
      t = 0;
      dur = MOTION.downMs;
      showSheet('down');
    },
    revive() {
      fallen = false;
      action = 'idle';
      t = 0;
      dur = Number.POSITIVE_INFINITY;
      hitT = -1;
      flashLeft = 0;
      view.alpha = 1;
      showSheet('idle');
    },
    isDown: () => fallen,
    update(dt, time) {
      t += dt;
      if (action !== 'down' && action !== 'idle' && action !== 'victory' && t >= dur) {
        action = 'idle';
        t = 0;
        dur = Number.POSITIVE_INFINITY;
        showSheet('idle');
      }
      const sheet = action === 'down' ? undefined : sheets.get(action);
      const pose = motionPose(action, t, dur, { melee: opts.melee, time, phase: opts.phase });
      let dx = pose.dx;
      let rot = pose.rot;
      let sx = pose.sx;
      let sy = pose.sy;
      if (hitT >= 0) {
        hitT += dt;
        const hp = motionPose('hit', hitT, actionMs('hit'), { melee: opts.melee, time });
        dx += hp.dx;
        rot += hp.rot;
        sx *= hp.sx;
        sy *= hp.sy;
        if (hitT >= actionMs('hit')) hitT = -1;
      }
      if (flashLeft > 0) flashLeft = Math.max(0, flashLeft - dt / (actionMs('hit') * 0.5));
      body.position.set(dx * u * opts.facing, pose.dy * u);
      body.rotation = rot * opts.facing;
      view.alpha = pose.alpha;
      if (sheet !== undefined) {
        sheet.update({ deltaTime: dt / (1000 / 60) } as never);
      } else {
        still.scale.set(k * sx * mirror, k * sy);
        flash.scale.copyFrom(still.scale);
      }
      flash.visible = still.visible;
      flash.alpha = flashLeft * 0.5;
    },
    destroy() {
      view.destroy({ children: true });
    },
  };
  return api;
}
