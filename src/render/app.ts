// 공유 PixiJS 앱 (기획서 14장 연출): one Application, one WebGL context, for every screen that draws
// with PixiJS. A screen leases it (acquireApp), puts its own root container on the stage, adds its
// own ticker callbacks, and on leaving removes both and gives the lease back. The canvas moves into
// the leasing screen's box; between screens it waits outside the page with its tickers stopped.
// Opening a screen no longer starts a new GPU context (a phone allows only a few, and a new one
// costs a beat of black), and the first screen's warm-up is shared.
//
// A newer lease takes the canvas from an older one (React's development double mount builds a
// scene twice); the older lease's release is then a no-op, so each scene must remove its own root
// container and ticker callbacks itself (which it does on destroy).
//
// The context is made with an alpha channel, so a screen may be see-through (the workshop scenes
// draw over a CSS background) or opaque (the map, the battle field) by its lease's background.
//
// Text: PixiJS registers its text renderers as a side effect of the module that uses Text. In a
// built game that module sits in a screen's own chunk, loaded after the shared renderer was made,
// so the renderer never learnt to draw text (no damage numbers, no names). Importing them here,
// before the Application, puts them in the renderer from the start, whichever screen comes first.
//
// Between screens nothing runs: release() stops the app's ticker and PixiJS's system ticker (its
// frame loop), so a screen without a canvas (the hero list, the card screens) costs no frames.
//
// Pictures: several screens load the same files through PixiJS's Assets cache (the workshop's bench
// and anvil, the towers). holdAsset / releaseAssets count who holds each one, so a screen leaving
// unloads only what no other screen (an overlapping lease, React's double mount) still shows.

import 'pixi.js/text';
import 'pixi.js/text-bitmap';
import 'pixi.js/graphics';
import { Application, Assets, EventsTicker, type Texture, Ticker } from 'pixi.js';

export interface AppLeaseOptions {
  /** Opaque background colour, or null for a see-through canvas. */
  background: number | string | null;
  /** The canvas lets fingers through to what is under it (the workshop scenes). Default false. */
  passThrough?: boolean;
}

export interface AppLease {
  readonly app: Application;
  /** Still the lease that holds the canvas (a newer one takes it). */
  active(): boolean;
  /** Resize the canvas (CSS px). Ignored once inactive. */
  resize(w: number, h: number): void;
  /** Stops (true) or starts (false) the frames: the app's ticker and PixiJS's system ticker. Ignored once inactive. */
  pause(on: boolean): void;
  /** Gives the canvas back: out of the page, tickers stopped. A no-op when no longer active. */
  release(): void;
}

let appPromise: Promise<Application> | null = null;
let current: symbol | null = null;

/** Pixel density the canvas draws at (at most 2: a 3× phone does not need 9× the pixels). */
export function appResolution(): number {
  return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
}

function makeApp(): Promise<Application> {
  const app = new Application();
  return app
    .init({
      width: 1,
      height: 1,
      backgroundAlpha: 0,
      antialias: true,
      resolution: appResolution(),
      autoDensity: true,
      preference: ['webgl'],
    })
    .then(() => {
      app.stage.eventMode = 'none';
      app.stage.interactiveChildren = false;
      // Screens take their fingers from the page, not through PixiJS: its pointer ticker would keep a
      // frame loop running even while a screen is paused.
      EventsTicker.removeTickerListener();
      const view = app.canvas;
      view.style.display = 'block';
      view.style.width = '100%';
      view.style.height = '100%';
      app.ticker.stop();
      Ticker.system.stop();
      return app;
    });
}

/** The shared app (made on the first lease). */
export function sharedApp(): Promise<Application> {
  if (appPromise === null) {
    appPromise = makeApp();
    // A failed start can be tried again by the next screen.
    appPromise.catch(() => {
      appPromise = null;
    });
  }
  return appPromise;
}

/** Leases the shared app for a screen: the canvas goes into `host` at w×h (CSS px). */
export async function acquireApp(host: HTMLElement, w: number, h: number, opts: AppLeaseOptions): Promise<AppLease> {
  const app = await sharedApp();
  const token = Symbol('lease');
  current = token;
  const r = app.renderer;
  if (opts.background === null) {
    r.background.alpha = 0;
  } else {
    r.background.color = opts.background;
    r.background.alpha = 1;
  }
  r.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  const view = app.canvas;
  view.style.pointerEvents = opts.passThrough === true ? 'none' : '';
  view.style.touchAction = 'none';
  host.appendChild(view);
  app.ticker.maxFPS = 0;
  Ticker.system.start();
  app.ticker.start();
  const active = () => current === token;
  return {
    app,
    active,
    resize(nw, nh) {
      if (!active()) return;
      r.resize(Math.max(1, Math.round(nw)), Math.max(1, Math.round(nh)));
    },
    pause(on) {
      if (!active()) return;
      if (on) {
        app.ticker.stop();
        Ticker.system.stop();
      } else {
        Ticker.system.start();
        app.ticker.start();
      }
    },
    release() {
      if (!active()) return;
      current = null;
      app.ticker.stop();
      app.ticker.maxFPS = 0;
      // The system ticker's frame loop too: nothing draws until the next lease starts it again.
      Ticker.system.stop();
      view.remove();
    },
  };
}

// ---------- Pictures held by screens ----------

const held = new Map<string, number>();

/**
 * Loads a picture through PixiJS's Assets and counts this hold (a screen keeps its own set of urls
 * and calls this once per url). null when it cannot be loaded.
 */
export async function holdAsset(url: string): Promise<Texture | null> {
  held.set(url, (held.get(url) ?? 0) + 1);
  try {
    return await Assets.load<Texture>(url);
  } catch {
    return null;
  }
}

/** Gives back a screen's holds; a picture nobody holds any more leaves memory and the GPU. */
export function releaseAssets(urls: Iterable<string>): void {
  const free: string[] = [];
  for (const url of urls) {
    const n = (held.get(url) ?? 0) - 1;
    if (n > 0) held.set(url, n);
    else {
      held.delete(url);
      free.push(url);
    }
  }
  if (free.length > 0) void Assets.unload(free).catch(() => undefined);
}

/** How many screens hold a url (tests, the lab). */
export function assetHolds(url: string): number {
  return held.get(url) ?? 0;
}
