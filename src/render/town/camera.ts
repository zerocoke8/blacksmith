// 마을 지도의 카메라와 손가락 (기획서 9.1): one finger drags the map, a let-go glides on and slows to
// a stop, the edges hold it (a drag past them gives way like rubber, a glide into them bounces back
// lightly), and a short touch that hardly moved is a tap, never a drag. Two fingers pinch: the map
// zooms out from its first look (the closest it gets) down to CAMERA.zoomOut of it, round the point
// between the fingers (사용자 결정 2026-10-14). Pure math on plain numbers: no PixiJS, no DOM, so it
// is tested on its own and the scene only feeds it pointer positions and frame times. Map px are the
// layout's (docs/mockups/town/layout.json); the view is in CSS px; zoom is CSS px per map px.

/** How the camera feels (presentation only, [튜닝] by eye on a phone). */
export const CAMERA = {
  /** The view shows this many map px across (the mockup's phone view: 780 map px on a 390 pt phone). */
  viewMapW: 780,
  /**
   * The first look's zoom bounds (CSS px per map px), so a tablet or a tiny phone does not see too
   * much or too little. The first look is also the closest the map gets.
   */
  minZoom: 0.4,
  maxZoom: 0.62,
  /** A pinch zooms out down to this share of the first look's zoom [튜닝] (never past the whole map). */
  zoomOut: 0.55,
  /** A trackpad pinch (a wheel with ctrl, desktop testing): zoom × e^(−delta × this) per wheel px. */
  wheelZoom: 0.01,
  /**
   * A glide slows by e^(-t/glideTau) (ms): a throw of v map px per ms runs on about v × glideTau.
   * 400: a 1 CSS px/ms flick goes about 400 CSS px (an iOS list goes about 500) [튜닝] on a phone.
   */
  glideTau: 400,
  /** Below this speed (map px per ms) a glide stops. */
  stopSpeed: 0.03,
  /** A finger that comes down while the map moves faster than this (map px per ms) only stops it: no tap. */
  catchSpeed: 0.15,
  /** The fastest let-go (map px per ms), so a flick does not throw the map across the town. */
  maxSpeed: 5.5,
  /** Finger samples older than this (ms) do not count toward the let-go speed. */
  sampleMs: 90,
  /** A finger held still this long before letting go throws nothing (ms). */
  restMs: 60,
  /** Past an edge: the spring that brings it back (per ms²) and its damping (0~1 of critical). */
  spring: 0.00055,
  damping: 0.82,
  /** A glide that runs into an edge keeps this much of its speed (a light bounce, not a long one). */
  edgeKeep: 0.45,
  /** A drag past an edge moves the map this much per px of finger, falling off (rubber band). */
  rubber: 0.55,
} as const;

/**
 * A tap: a touch that moved at most slop CSS px and lifted within tapMs (a press held a while and
 * let go where it was still counts: the map has nothing on a long press).
 */
export const TAP = { slop: 9, tapMs: 1200 } as const;

export interface View {
  /** CSS px */
  readonly w: number;
  readonly h: number;
}

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface Cam {
  /** The view's top-left corner (map px). */
  x: number;
  y: number;
}

/** CSS px per map px of the first look for a view this wide (the closest the map gets). */
export function zoomFor(viewW: number): number {
  return Math.max(CAMERA.minZoom, Math.min(CAMERA.maxZoom, viewW / CAMERA.viewMapW));
}

export interface ZoomRange {
  readonly min: number;
  readonly max: number;
}

/**
 * How far a pinch zooms: in to the first look, out to CAMERA.zoomOut of it, but never so far that
 * the view shows past the map's edges (the whole map's width or height fills the view at most).
 */
export function zoomRange(view: View, mapW: number, mapH: number): ZoomRange {
  const max = zoomFor(view.w);
  const cover = Math.max(view.w / mapW, view.h / mapH);
  return { min: Math.min(max, Math.max(max * CAMERA.zoomOut, cover)), max };
}

export function clampZoom(z: number, r: ZoomRange): number {
  return Math.max(r.min, Math.min(r.max, z));
}

/**
 * A pinch: the zoom the fingers ask for (the first zoom times how far apart they are now over at
 * the start), and the camera that keeps the map point first under their middle under it now.
 */
export function pinchView(start: { z: number; d: number; mx: number; my: number }, now: { x: number; y: number; d: number }, r: ZoomRange): Cam & { z: number } {
  const z = clampZoom(start.z * (now.d / Math.max(1, start.d)), r);
  return { x: start.mx - now.x / z, y: start.my - now.y / z, z };
}

/**
 * Where the camera's top-left may be so the view stays on the map. A view wider (or taller) than
 * the map is held at the middle.
 */
export function camBounds(mapW: number, mapH: number, view: View, zoom: number): Bounds {
  const vw = view.w / zoom;
  const vh = view.h / zoom;
  const axis = (map: number, v: number): [number, number] => (v >= map ? [(map - v) / 2, (map - v) / 2] : [0, map - v]);
  const [minX, maxX] = axis(mapW, vw);
  const [minY, maxY] = axis(mapH, vh);
  return { minX, maxX, minY, maxY };
}

export function clampCam(c: Cam, b: Bounds): Cam {
  return { x: Math.max(b.minX, Math.min(b.maxX, c.x)), y: Math.max(b.minY, Math.min(b.maxY, c.y)) };
}

/** The camera that puts this map point at the view's middle (as near as the edges allow). */
export function centerOn(px: number, py: number, view: View, zoom: number, b: Bounds): Cam {
  return clampCam({ x: px - view.w / zoom / 2, y: py - view.h / zoom / 2 }, b);
}

/**
 * A drag `over` map px past an edge shows as this much (it gives way less the further it goes,
 * never more than `dim`): the iOS rubber band, 1 - 1/(over·k/dim + 1), times dim.
 */
export function rubberband(over: number, dim: number, k: number = CAMERA.rubber): number {
  if (over === 0 || dim <= 0) return 0;
  const s = Math.sign(over);
  const d = Math.abs(over);
  return s * (1 - 1 / ((d * k) / dim + 1)) * dim;
}

/** A position under the finger, with the part past the edges given the rubber band. */
export function rubberPos(p: number, min: number, max: number, dim: number): number {
  if (p < min) return min + rubberband(p - min, dim);
  if (p > max) return max + rubberband(p - max, dim);
  return p;
}

/**
 * The finger position that shows as `shown` (rubberPos's inverse): a finger catching a map that is
 * still springing back from past an edge holds it where it is, and the drag goes on from there.
 */
export function unrubberPos(shown: number, min: number, max: number, dim: number, k: number = CAMERA.rubber): number {
  if (dim <= 0) return shown;
  // shown = dim·(1 − 1/(over·k/dim + 1))  ⇒  over = dim·u / (k·(1 − u)), u = |shown|/dim (< 1).
  const back = (d: number) => {
    const u = Math.min(0.999, Math.abs(d) / dim);
    return Math.sign(d) * ((dim * u) / (k * (1 - u)));
  };
  if (shown < min) return min + back(shown - min);
  if (shown > max) return max + back(shown - max);
  return shown;
}

export interface Axis {
  /** Position (map px) and speed (map px per ms). */
  p: number;
  v: number;
}

/**
 * One frame of a glide on one axis. Inside the edges it slows by friction; past one, a damped
 * spring pulls it back, and it settles exactly on the edge (it never drifts back in past it).
 * Long frames are cut into short steps so a slow phone glides the same way.
 */
export function stepAxis(a: Axis, min: number, max: number, dtMs: number): Axis {
  let { p, v } = a;
  let left = Math.max(0, dtMs);
  const omega = Math.sqrt(CAMERA.spring);
  while (left > 0) {
    const dt = Math.min(8, left);
    left -= dt;
    const bound = p < min ? min : p > max ? max : null;
    if (bound === null) {
      const next = p + v * dt;
      v *= Math.exp(-dt / CAMERA.glideTau);
      if (next < min || next > max) {
        // Runs into an edge: a light bounce keeps only part of the speed.
        v *= CAMERA.edgeKeep;
      }
      p = next;
      if (Math.abs(v) < CAMERA.stopSpeed) v = 0;
    } else {
      const x = p - bound;
      const acc = -CAMERA.spring * x - 2 * CAMERA.damping * omega * v;
      v += acc * dt;
      const next = p + v * dt;
      // Back inside: it rests on the edge.
      if ((x < 0 && next >= bound) || (x > 0 && next <= bound)) {
        p = bound;
        v = 0;
      } else {
        p = next;
        if (Math.abs(x) < 0.25 && Math.abs(v) < CAMERA.stopSpeed) {
          p = bound;
          v = 0;
        }
      }
    }
  }
  return { p, v };
}

/** The glide has stopped and the camera rests inside its edges. */
export function settled(a: Axis, min: number, max: number): boolean {
  return a.v === 0 && a.p >= min && a.p <= max;
}

export interface Sample {
  /** ms */
  readonly t: number;
  /** CSS px */
  readonly x: number;
  readonly y: number;
}

/**
 * The finger's speed as it lets go (CSS px per ms), from its moves in the last sampleMs before its
 * last move (the lift itself, at the last move's place, adds no motion). A finger that rested
 * restMs before lifting throws nothing.
 */
export function releaseVelocity(samples: readonly Sample[], now: number): { vx: number; vy: number } {
  const last = samples[samples.length - 1];
  if (last === undefined || now - last.t > CAMERA.restMs) return { vx: 0, vy: 0 };
  const recent = samples.filter((s) => last.t - s.t <= CAMERA.sampleMs);
  const first = recent[0];
  if (first === undefined || last.t - first.t < 8) return { vx: 0, vy: 0 };
  const dt = last.t - first.t;
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/** Limits a throw to maxSpeed (map px per ms), keeping its direction. */
export function capSpeed(vx: number, vy: number, max: number = CAMERA.maxSpeed): { vx: number; vy: number } {
  const s = Math.hypot(vx, vy);
  if (s <= max || s === 0) return { vx, vy };
  return { vx: (vx / s) * max, vy: (vy / s) * max };
}

// ---------- Tap or drag ----------

export type GestureEvent =
  | { readonly type: 'press'; readonly x: number; readonly y: number }
  | { readonly type: 'dragStart' }
  | { readonly type: 'drag'; readonly dx: number; readonly dy: number }
  | { readonly type: 'tap'; readonly x: number; readonly y: number }
  | { readonly type: 'release'; readonly dragged: boolean; readonly vx: number; readonly vy: number }
  | { readonly type: 'cancel' }
  /** Two fingers: where their middle is (CSS px) and how far apart they are. */
  | { readonly type: 'pinchStart'; readonly x: number; readonly y: number; readonly d: number }
  | { readonly type: 'pinch'; readonly x: number; readonly y: number; readonly d: number }
  | { readonly type: 'pinchEnd' };

export interface Gesture {
  /** A finger down (CSS px in the view). `gliding`: the map was still moving, so this touch only stops it (no tap). */
  down(id: number, x: number, y: number, t: number, gliding: boolean): GestureEvent[];
  move(id: number, x: number, y: number, t: number): GestureEvent[];
  up(id: number, x: number, y: number, t: number): GestureEvent[];
  cancel(id: number): GestureEvent[];
  /** A finger is on the map. */
  active(): boolean;
  /** The finger driving the touch, or null (none, or a second finger cancelled it). */
  driver(): number | null;
  /** Two fingers are pinching. */
  pinching(): boolean;
}

/**
 * One finger drives. A press is a tap while it stays within slop and lifts within tapMs; once it
 * moves further it is a drag for good, and a drag never ends in a tap. The drag's `dx, dy` are the
 * finger's moves (CSS px) since the last event; the release carries the let-go speed (CSS px per ms).
 * A second finger cancels the one-finger touch (the map does not slide sideways under it) and the two
 * pinch: `pinchStart`, then a `pinch` on every move of either (their middle and their distance), and
 * `pinchEnd` when one lifts. A third finger changes nothing. After a pinch nothing moves and nothing is
 * tapped until every finger has lifted (the finger left on the glass does not start a drag).
 */
export function makeGesture(opts: { slop?: number; tapMs?: number } = {}): Gesture {
  const slop = opts.slop ?? TAP.slop;
  const tapMs = opts.tapMs ?? TAP.tapMs;
  let id: number | null = null;
  let start = { x: 0, y: 0, t: 0 };
  let last = { x: 0, y: 0 };
  let dragging = false;
  let stopper = false;
  let samples: Sample[] = [];
  /** Every finger on the map and where it is, and whether a second one came down since they last all lifted. */
  const fingers = new Map<number, { x: number; y: number }>();
  let blocked = false;
  /** The two pinching fingers, or null. */
  let pinch: [number, number] | null = null;
  const lift = (pid: number) => {
    fingers.delete(pid);
    if (fingers.size === 0) blocked = false;
  };
  const pinchAt = (type: 'pinchStart' | 'pinch'): GestureEvent[] => {
    if (pinch === null) return [];
    const a = fingers.get(pinch[0]);
    const b = fingers.get(pinch[1]);
    if (a === undefined || b === undefined) return [];
    return [{ type, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }];
  };
  /** One of the pinching fingers lifted (or was lost). */
  const endPinch = (pid: number): GestureEvent[] => {
    if (pinch === null || (pinch[0] !== pid && pinch[1] !== pid)) return [];
    pinch = null;
    return [{ type: 'pinchEnd' }];
  };

  const reset = () => {
    id = null;
    dragging = false;
    stopper = false;
    samples = [];
  };

  return {
    down(pid, x, y, t, gliding) {
      fingers.set(pid, { x, y });
      if (fingers.size > 1 || blocked) {
        blocked = true;
        const out: GestureEvent[] = [];
        if (id !== null) {
          reset();
          out.push({ type: 'cancel' });
        }
        // The second finger on the glass: the two pinch (a third changes nothing; after a pinch, two
        // fingers on the glass again pinch again).
        if (pinch === null && fingers.size === 2) {
          const [a, b] = [...fingers.keys()];
          if (a !== undefined && b !== undefined) {
            pinch = [a, b];
            out.push(...pinchAt('pinchStart'));
          }
        }
        return out;
      }
      id = pid;
      start = { x, y, t };
      last = { x, y };
      dragging = false;
      stopper = gliding;
      samples = [{ t, x, y }];
      return stopper ? [] : [{ type: 'press', x, y }];
    },
    move(pid, x, y, t) {
      if (fingers.has(pid)) fingers.set(pid, { x, y });
      if (pinch !== null) return pinch[0] === pid || pinch[1] === pid ? pinchAt('pinch') : [];
      if (pid !== id) return [];
      samples.push({ t, x, y });
      if (samples.length > 24) samples.shift();
      const out: GestureEvent[] = [];
      if (!dragging) {
        if (Math.hypot(x - start.x, y - start.y) <= slop) return [];
        dragging = true;
        out.push({ type: 'dragStart' });
        // The drag starts from where the finger went down, so the map does not jump by the slop.
        last = { x: start.x, y: start.y };
      }
      out.push({ type: 'drag', dx: x - last.x, dy: y - last.y });
      last = { x, y };
      return out;
    },
    up(pid, x, y, t) {
      const ended = endPinch(pid);
      lift(pid);
      if (pid !== id) return ended;
      // A lift somewhere else than the last move is one more move.
      const lastMove = samples[samples.length - 1];
      if (lastMove !== undefined && (lastMove.x !== x || lastMove.y !== y)) samples.push({ t, x, y });
      const out: GestureEvent[] = [];
      if (dragging) {
        const v = releaseVelocity(samples, t);
        out.push({ type: 'release', dragged: true, vx: v.vx, vy: v.vy });
      } else {
        const near = Math.hypot(x - start.x, y - start.y) <= slop;
        out.push({ type: 'release', dragged: false, vx: 0, vy: 0 });
        if (near && !stopper && t - start.t <= tapMs) out.push({ type: 'tap', x: start.x, y: start.y });
      }
      reset();
      return out;
    },
    cancel(pid) {
      const ended = endPinch(pid);
      lift(pid);
      if (pid !== id) return ended;
      reset();
      return [{ type: 'cancel' }];
    },
    active: () => fingers.size > 0,
    driver: () => id,
    pinching: () => pinch !== null,
  };
}
