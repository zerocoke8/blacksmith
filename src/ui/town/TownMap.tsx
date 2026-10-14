// The home screen's map box (기획서 9장): the PixiJS town (render/town/scene.ts, loaded on demand)
// with a DOM layer over it that moves with the camera: the buildings' name tags (always shown,
// 9.1, except where the top band or the quick entries cover them), their to-do marks (9.2: the
// mine's lumps, a craft waiting at the forge), a locked building's floor, and the one-line bubbles
// (kept on screen). Fingers on the box (tags included) drive the map; a tap goes up to the home
// screen as what it landed on. Loaded with a dynamic import (this file carries the layout), so the
// first load stays small; as soon as it loads it starts on the map's code and pictures.

import { type MutableRefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefetchTownPictures } from '../../render/town/baked.ts';
import type { Cam } from '../../render/town/camera.ts';
import { bubblePoint, DWARF_BUBBLE_DY, type Insets, labelPoint, MAP_BUILDINGS, mapBuilding } from '../../render/town/layout.ts';
import type { CameraView, TownScene, TownTap } from '../../render/town/scene.ts';
import type { TownBuildingId, TownLock } from '../../sim/data/town.ts';
import { lockedTag, placeName } from './text.ts';

// The map's code and pictures start loading with this chunk, not after the first layout.
const sceneModule = import('../../render/town/scene.ts');
// A failed load is told by the map's own effect ('그리지 못했다'), not as an unhandled rejection here.
sceneModule.catch(() => undefined);
prefetchTownPictures();

/** What a tap on the map landed on, as the home screen needs it. */
export type MapTap =
  | {
      readonly kind: 'building';
      readonly uid: string;
      readonly building: TownBuildingId;
      readonly key: string;
      /** Where its bubble hangs (map px). */
      readonly at: { readonly x: number; readonly y: number };
    }
  | { readonly kind: 'guest'; readonly hero: string; readonly at: { readonly x: number; readonly y: number } }
  | { readonly kind: 'dwarf'; readonly at: { readonly x: number; readonly y: number } }
  | { readonly kind: 'ground' };

export interface MapApi {
  /** Back to the forge. */
  home(): void;
}

export interface MapBubble {
  readonly key: number;
  /** Map px of the point it hangs from. */
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

interface Props {
  reduced: boolean;
  locks: Readonly<Record<TownBuildingId, TownLock>>;
  /** To-do marks: lumps on the mine's tag, a craft still on the anvil on the forge's. */
  badges: { readonly mine: number; readonly forge: boolean };
  bubble: MapBubble | null;
  /** What the top band and the quick entries cover (CSS px from the top and the bottom of the box). */
  insets: Insets;
  /** Something covers the map (a sheet): it stops drawing. */
  paused: boolean;
  apiRef: MutableRefObject<MapApi | null>;
  onTap(tap: MapTap): void;
  onDrag(phase: 'start' | 'end', ms: number): void;
  /** The map is drawn (how long it took to get ready, by step). */
  onReady(ms: Readonly<Record<string, number>>): void;
}

/** Where the camera was, and its zoom, when the map last closed this session (memory only: 9.1 does not keep it). */
let lastCamera: Cam | null = null;
let lastZoomShare: number | null = null;
/** The map faded in once this session; coming back to it, it is just there. */
let shownOnce = false;

/** A bubble keeps this far (CSS px) from the screen's sides, and its tail this far from its own corners. */
const BUBBLE_EDGE = 16;
const TAIL_EDGE = 18;
/** …and this far under the top band. */
const BUBBLE_TOP_GAP = 6;
/** A tag closer than this (CSS px) to the top band or the quick entries hides under them. */
const TAG_CLEAR = { top: 10, bottom: 4 } as const;

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function TownMap(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TownScene | null>(null);
  const tagEls = useRef(new Map<string, HTMLElement>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** The camera has reported once: the layer can show. */
  const [camUp, setCamUp] = useState(false);
  const [ready, setReady] = useState(false);
  const [fade, setFade] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef(props);
  cb.current = props;
  const locksRef = useRef(props.locks);
  locksRef.current = props.locks;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  /** The camera last reported: the layer follows it every frame without React. */
  const camRef = useRef<CameraView | null>(null);
  const follow = () => {
    const layer = layerRef.current;
    const v = camRef.current;
    if (layer === null || v === null) return;
    layer.style.transform = `translate3d(${(-v.x * v.z).toFixed(2)}px, ${(-v.y * v.z).toFixed(2)}px, 0)`;
    // The tags and the bubble stand at map px × --z, set here in the same frame as the move (a pinch
    // would leave them a frame behind the map if the zoom went through React).
    const z = String(v.z);
    if (layer.style.getPropertyValue('--z') !== z) {
      layer.style.setProperty('--z', z);
      placeBubble();
    }
    // Tags under the top band or the quick entries hide (their buildings still take the taps).
    const { top, bottom } = cb.current.insets;
    const h = sizeRef.current.h;
    for (const b of MAP_BUILDINGS) {
      const el = tagEls.current.get(b.uid);
      const at = labelPoint(b);
      if (el === undefined || at === null) continue;
      const sy = (at.y - v.y) * v.z;
      const under = sy < top + TAG_CLEAR.top || sy > h - bottom - TAG_CLEAR.bottom;
      if (under !== el.hasAttribute('data-under')) el.toggleAttribute('data-under', under);
    }
  };

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (el === null) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasSize = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (!hasSize) return;
    let cancelled = false;
    const host = canvasRef.current;
    const input = hostRef.current;
    if (host === null || input === null) return;
    const onCamera = (v: CameraView) => {
      camRef.current = v;
      follow();
      setCamUp(true);
    };
    const toTap = (t: TownTap): MapTap => {
      if (t.kind === 'building') {
        const b = mapBuilding(t.uid);
        if (b === null) return { kind: 'ground' };
        return { kind: 'building', uid: t.uid, building: b.building, key: b.key, at: bubblePoint(b) };
      }
      if (t.kind === 'guest') return { kind: 'guest', hero: t.hero, at: { x: t.x, y: t.y } };
      if (t.kind === 'dwarf') return { kind: 'dwarf', at: { x: t.x, y: t.y - DWARF_BUBBLE_DY } };
      return { kind: 'ground' };
    };
    sceneModule
      .then((m) =>
        m.createTownScene(host, sizeRef.current.w, sizeRef.current.h, {
          reducedMotion: cb.current.reduced,
          camera: lastCamera,
          zoomShare: lastZoomShare,
          locks: locksRef.current,
          input,
          insets: () => cb.current.insets,
          onTap: (t) => cb.current.onTap(toTap(t)),
          onCamera,
          onDrag: (phase, ms) => cb.current.onDrag(phase, ms),
        }),
      )
      .then((scene) => {
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        cb.current.apiRef.current = { home: () => scene.home() };
        scene.pause(cb.current.paused);
        setFade(!shownOnce && !cb.current.reduced);
        shownOnce = true;
        setReady(true);
        cb.current.onReady(scene.readyMs);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      const s = sceneRef.current;
      if (s !== null) {
        lastCamera = s.camera();
        lastZoomShare = s.zoomShare();
      }
      s?.destroy();
      sceneRef.current = null;
      cb.current.apiRef.current = null;
    };
    // The scene is made once per mount (and again if the motion setting changes).
  }, [hasSize, props.reduced]);

  useEffect(() => {
    if (hasSize) sceneRef.current?.resize(size.w, size.h);
  }, [size, hasSize]);

  useEffect(() => {
    sceneRef.current?.setLocks(props.locks);
  }, [props.locks]);

  useEffect(() => {
    sceneRef.current?.pause(props.paused);
  }, [props.paused]);

  // The layer appears once the map is ready: put it where the camera already is (and re-check the tags after any change).
  useLayoutEffect(follow);

  // A bubble stays on screen: pulled in from the sides (its tail still points at what spoke), and
  // turned to hang below its point when it would go under the top band.
  function placeBubble() {
    const el = bubbleRef.current;
    const v = camRef.current;
    const bubble = cb.current.bubble;
    if (el === null || v === null || bubble === null) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const sx = (bubble.x - v.x) * v.z;
    const sy = (bubble.y - v.y) * v.z;
    const W = sizeRef.current.w;
    const lo = BUBBLE_EDGE + w / 2;
    const hi = W - BUBBLE_EDGE - w / 2;
    const want = lo > hi ? W / 2 : Math.min(hi, Math.max(lo, sx));
    const dx = want - sx;
    el.style.marginLeft = `${dx.toFixed(1)}px`;
    const tail = Math.max(-(w / 2 - TAIL_EDGE), Math.min(w / 2 - TAIL_EDGE, -dx));
    el.style.setProperty('--tail-dx', `${tail.toFixed(1)}px`);
    const top = cb.current.insets.top + BUBBLE_TOP_GAP;
    const below = sy - h - 14 < top;
    el.classList.toggle('below', below);
    // Hanging below a point that is itself under the band: down to just under the band.
    el.style.marginTop = below && sy + 12 < top ? `${(top - sy - 12).toFixed(1)}px` : '';
  }
  const bubble = props.bubble;
  useLayoutEffect(placeBubble, [bubble]);

  return (
    <div ref={hostRef} className={`tm-host${ready ? ' ready' : ''}${fade ? ' fade' : ''}`}>
      <div ref={canvasRef} className="tm-canvas" aria-hidden="true" />
      {ready && camUp && (
        <div ref={layerRef} className="tm-layer">
          {MAP_BUILDINGS.map((b) => {
            const at = labelPoint(b);
            if (at === null) return null;
            const lock = props.locks[b.building];
            const name = placeName(b.building, b.key);
            const mine = b.building === 'mine' && props.badges.mine > 0 && !lock.locked;
            const forge = b.building === 'forge' && props.badges.forge && !lock.locked;
            return (
              <button
                key={b.uid}
                ref={(el) => {
                  if (el !== null) tagEls.current.set(b.uid, el);
                  else tagEls.current.delete(b.uid);
                }}
                type="button"
                className={`tm-tag tm-tag-${b.building}${lock.locked ? ' locked' : ''}`}
                data-tap={b.uid}
                style={{ left: `calc(${at.x}px * var(--z))`, top: `calc(${at.y}px * var(--z))` }}
                aria-label={lock.locked ? `${name}: ${lockedTag(lock.opensAt)}` : name}
                onClick={() => {
                  // A click the map did not take: a keyboard, a screen reader. A finger's tap is the
                  // map's (scene.ts), and the click after it never gets here (input.ts drops it).
                  props.onTap({ kind: 'building', uid: b.uid, building: b.building, key: b.key, at: bubblePoint(b) });
                }}
              >
                <span className="tm-tag-name">{name}</span>
                {lock.locked && <small className="tm-tag-lock">{lockedTag(lock.opensAt)}</small>}
                {mine && <b className="tm-tag-badge">{fmt(props.badges.mine)}</b>}
                {forge && (
                  <b className="tm-tag-badge tm-tag-wait" aria-label="모루 위에 쇠가 기다린다">
                    !
                  </b>
                )}
              </button>
            );
          })}
          {bubble !== null && (
            <div ref={bubbleRef} key={bubble.key} className="tm-bubble" style={{ left: `calc(${bubble.x}px * var(--z))`, top: `calc(${bubble.y}px * var(--z))` }} role="status">
              {bubble.text}
            </div>
          )}
        </div>
      )}
      {!ready && !failed && <p className="tm-loading">마을을 둘러보는 중…</p>}
      {failed && <p className="tm-loading">마을 지도를 그리지 못했다. 아래 메뉴로 다닐 수 있다.</p>}
    </div>
  );
}
