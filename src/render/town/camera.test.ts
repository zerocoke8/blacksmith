import { describe, expect, it } from 'vitest';
import {
  CAMERA,
  camBounds,
  capSpeed,
  centerOn,
  clampCam,
  makeGesture,
  releaseVelocity,
  rubberband,
  rubberPos,
  settled,
  stepAxis,
  TAP,
  unrubberPos,
  zoomFor,
} from './camera.ts';

const MAP_W = 2458;
const MAP_H = 4446;

describe('camera bounds (9.1: the edges hold the map)', () => {
  it('shows the mockup phone view: 780 map px across a 390 pt phone', () => {
    expect(zoomFor(390)).toBe(0.5);
    expect(zoomFor(360)).toBeCloseTo(360 / 780);
    // A tablet does not zoom in without end, a tiny phone not out.
    expect(zoomFor(2000)).toBe(CAMERA.maxZoom);
    expect(zoomFor(200)).toBe(CAMERA.minZoom);
  });

  it('keeps the view on the map', () => {
    const b = camBounds(MAP_W, MAP_H, { w: 390, h: 844 }, 0.5);
    expect(b).toEqual({ minX: 0, maxX: MAP_W - 780, minY: 0, maxY: MAP_H - 1688 });
    expect(clampCam({ x: -50, y: 99999 }, b)).toEqual({ x: 0, y: MAP_H - 1688 });
    expect(clampCam({ x: 300, y: 400 }, b)).toEqual({ x: 300, y: 400 });
  });

  it('holds a view bigger than the map at its middle', () => {
    const b = camBounds(1000, 800, { w: 1200, h: 400 }, 1);
    expect(b.minX).toBe(-100);
    expect(b.maxX).toBe(-100);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(400);
  });

  it('centres on a point as far as the edges allow', () => {
    const view = { w: 390, h: 844 };
    const b = camBounds(MAP_W, MAP_H, view, 0.5);
    expect(centerOn(1200, 2000, view, 0.5, b)).toEqual({ x: 1200 - 390, y: 2000 - 844 });
    expect(centerOn(10, 10, view, 0.5, b)).toEqual({ x: 0, y: 0 });
    expect(centerOn(MAP_W, MAP_H, view, 0.5, b)).toEqual({ x: b.maxX, y: b.maxY });
  });
});

describe('rubber band (a drag past an edge gives way less and less)', () => {
  it('is zero at the edge, never past dim, and grows ever slower', () => {
    expect(rubberband(0, 1000)).toBe(0);
    const a = rubberband(100, 1000);
    const b = rubberband(200, 1000);
    const c = rubberband(5000, 1000);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(100);
    expect(b - a).toBeLessThan(a);
    expect(c).toBeLessThan(1000);
    expect(rubberband(-100, 1000)).toBeCloseTo(-a);
  });

  it('only touches the part past the edges', () => {
    expect(rubberPos(500, 0, 1000, 800)).toBe(500);
    expect(rubberPos(-200, 0, 1000, 800)).toBeGreaterThan(-200);
    expect(rubberPos(-200, 0, 1000, 800)).toBeLessThan(0);
    expect(rubberPos(1200, 0, 1000, 800)).toBeLessThan(1200);
    expect(rubberPos(1200, 0, 1000, 800)).toBeGreaterThan(1000);
  });

  it('a finger catching a map past its edge holds it where it shows (no jump against the finger)', () => {
    // The inverse: the finger position that shows at the map's place.
    for (const shown of [-300, -82.8, -1, 0, 500, 1000.5, 1100, 1400]) {
      const raw = unrubberPos(shown, 0, 1000, 1688);
      expect(rubberPos(raw, 0, 1000, 1688)).toBeCloseTo(shown, 6);
    }
    // The code review's case: a map 82.8 map px past its top (41.4 CSS px at zoom 0.5), caught and
    // dragged on 11 CSS px (22 map px) further out: it goes further out, a little, never back in.
    const dim = 1688;
    const raw = unrubberPos(-82.8, 0, 1000, dim);
    const next = rubberPos(raw - 22, 0, 1000, dim);
    expect(next).toBeLessThan(-82.8);
    expect(next).toBeGreaterThan(-82.8 - 22);
  });
});

/** Runs a glide frame by frame until it rests (or ms run out). */
function glide(p: number, v: number, min: number, max: number, ms = 6000, dt = 16) {
  let a = { p, v };
  const path: number[] = [p];
  for (let t = 0; t < ms; t += dt) {
    a = stepAxis(a, min, max, dt);
    path.push(a.p);
    if (settled(a, min, max)) break;
  }
  return { a, path };
}

describe('glide (inertia)', () => {
  it('slides on in the throw direction and slows to a stop', () => {
    const { a, path } = glide(1000, 2, 0, 3000);
    expect(a.v).toBe(0);
    expect(a.p).toBeGreaterThan(1000 + 2 * CAMERA.glideTau * 0.8);
    expect(a.p).toBeLessThan(1000 + 2 * CAMERA.glideTau * 1.05);
    // Never turns back.
    for (let i = 1; i < path.length; i++) expect(path[i] as number).toBeGreaterThanOrEqual(path[i - 1] as number);
  });

  it('does not depend much on the frame rate', () => {
    const fast = glide(1000, 2, 0, 3000, 6000, 8).a.p;
    const slow = glide(1000, 2, 0, 3000, 6000, 33).a.p;
    expect(Math.abs(fast - slow)).toBeLessThan(5);
  });

  it('runs into an edge, bounces a little past it, and rests exactly on it', () => {
    const { a, path } = glide(100, -3, 0, 3000);
    const lowest = Math.min(...path);
    expect(lowest).toBeLessThan(0);
    expect(lowest).toBeGreaterThan(-80); // a light bounce
    expect(a.p).toBe(0);
    expect(a.v).toBe(0);
  });

  it('springs back from a drag left past the edge', () => {
    const { a } = glide(-150, 0, 0, 3000, 3000);
    expect(a.p).toBe(0);
    const { a: b } = glide(3200, 0, 0, 3000, 3000);
    expect(b.p).toBe(3000);
  });

  it('a resting camera inside its edges stays', () => {
    expect(stepAxis({ p: 500, v: 0 }, 0, 1000, 16)).toEqual({ p: 500, v: 0 });
    expect(settled({ p: 500, v: 0 }, 0, 1000)).toBe(true);
    expect(settled({ p: -1, v: 0 }, 0, 1000)).toBe(false);
  });
});

describe('let-go speed', () => {
  it('is the finger’s speed over its last moves', () => {
    const s = [
      { t: 0, x: 0, y: 0 },
      { t: 20, x: 10, y: 20 },
      { t: 40, x: 20, y: 40 },
      { t: 60, x: 30, y: 60 },
    ];
    const v = releaseVelocity(s, 70);
    expect(v.vx).toBeCloseTo(0.5);
    expect(v.vy).toBeCloseTo(1);
  });

  it('is nothing after the finger rested', () => {
    const s = [
      { t: 0, x: 0, y: 0 },
      { t: 30, x: 0, y: 50 },
    ];
    expect(releaseVelocity(s, 30 + CAMERA.restMs + 1)).toEqual({ vx: 0, vy: 0 });
  });

  it('caps a wild flick, keeping its direction', () => {
    const v = capSpeed(30, 40, 5);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(5);
    expect(v.vx / v.vy).toBeCloseTo(0.75);
    expect(capSpeed(1, 1, 5)).toEqual({ vx: 1, vy: 1 });
  });
});

describe('tap or drag', () => {
  it('a short touch that hardly moves is a tap where it went down', () => {
    const g = makeGesture();
    expect(g.down(1, 100, 200, 0, false)).toEqual([{ type: 'press', x: 100, y: 200 }]);
    expect(g.move(1, 103, 202, 30)).toEqual([]);
    const up = g.up(1, 104, 203, 90);
    expect(up).toContainEqual({ type: 'tap', x: 100, y: 200 });
    expect(up.find((e) => e.type === 'release')).toMatchObject({ dragged: false });
    expect(g.active()).toBe(false);
  });

  it('moving past the slop makes it a drag for good: no tap, even if it comes back', () => {
    const g = makeGesture();
    g.down(1, 100, 200, 0, false);
    const m = g.move(1, 100, 200 + TAP.slop + 5, 30);
    expect(m[0]).toEqual({ type: 'dragStart' });
    // The drag starts from where the finger went down (no jump by the slop).
    expect(m[1]).toEqual({ type: 'drag', dx: 0, dy: TAP.slop + 5 });
    expect(g.move(1, 100, 200, 60)).toEqual([{ type: 'drag', dx: 0, dy: -(TAP.slop + 5) }]);
    const up = g.up(1, 100, 200, 80);
    expect(up.some((e) => e.type === 'tap')).toBe(false);
    expect(up[0]).toMatchObject({ type: 'release', dragged: true });
  });

  it('a flick lets go with the finger’s speed', () => {
    const g = makeGesture();
    g.down(1, 100, 100, 0, false);
    for (let i = 1; i <= 5; i++) g.move(1, 100, 100 + i * 20, i * 16);
    const up = g.up(1, 100, 200, 96);
    const r = up[0];
    expect(r?.type).toBe('release');
    if (r?.type === 'release') {
      expect(r.vy).toBeCloseTo(20 / 16, 1);
      expect(r.vx).toBe(0);
    }
  });

  it('a touch that catches a gliding map only stops it', () => {
    const g = makeGesture();
    expect(g.down(1, 50, 50, 0, true)).toEqual([]);
    const up = g.up(1, 50, 50, 60);
    expect(up.some((e) => e.type === 'tap')).toBe(false);
  });

  it('a touch held too long is no tap', () => {
    const g = makeGesture();
    g.down(1, 50, 50, 0, false);
    expect(g.up(1, 50, 50, TAP.tapMs + 1).some((e) => e.type === 'tap')).toBe(false);
  });

  it('a cancel ends the touch', () => {
    const g = makeGesture();
    g.down(1, 10, 10, 0, false);
    expect(g.driver()).toBe(1);
    expect(g.cancel(1)).toEqual([{ type: 'cancel' }]);
    expect(g.active()).toBe(false);
    expect(g.driver()).toBeNull();
  });

  it('a second finger (a pinch, no zoom yet) cancels the drag: the map does not slide under it', () => {
    const g = makeGesture();
    g.down(1, 200, 400, 0, false);
    g.move(1, 180, 400, 16);
    expect(g.move(1, 150, 400, 32).some((e) => e.type === 'drag')).toBe(true);
    // The second finger comes down: the touch is off.
    expect(g.down(2, 260, 400, 40, false)).toEqual([{ type: 'cancel' }]);
    expect(g.driver()).toBeNull();
    // The fingers spread: nothing moves, nothing is tapped, and no throw on the lift.
    expect(g.move(1, 80, 400, 56)).toEqual([]);
    expect(g.move(2, 380, 400, 56)).toEqual([]);
    expect(g.up(2, 380, 400, 80)).toEqual([]);
    // One finger still down: still nothing until every finger has lifted.
    expect(g.active()).toBe(true);
    expect(g.move(1, 20, 400, 90)).toEqual([]);
    expect(g.up(1, 20, 400, 100)).toEqual([]);
    expect(g.active()).toBe(false);
    // Then a new touch works as ever.
    g.down(3, 100, 100, 200, false);
    expect(g.up(3, 101, 100, 260).map((e) => e.type)).toEqual(['release', 'tap']);
  });

  it('two fingers landing for a tap tap nothing', () => {
    const g = makeGesture();
    g.down(1, 100, 100, 0, false);
    g.down(2, 140, 100, 10, false);
    expect(g.up(1, 100, 100, 60)).toEqual([]);
    expect(g.up(2, 140, 100, 70)).toEqual([]);
  });
});
