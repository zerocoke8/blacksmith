// The scene box of the art table: the PixiJS workshop (render/forge/scene.ts, loaded on demand)
// with a DOM layer on top for what must stay crisp: the dwarf's speech bubble and the floating
// numbers, which rise by the anvil and are then drawn down into their bars in the gauge band
// under the scene (GaugeBand). The gauges and the fire's state are not over the scene: the
// furnace shows its state by its flame. Positions come from render/forge/layout.ts, the same
// numbers the scene uses.

import { type CSSProperties, type MutableRefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sceneArtUrl } from '../../render/forge/assets.ts';
import type { FxStep } from '../../render/forge/fx.ts';
import { FLOAT_FLIGHT, floatAt, type SceneLayout, sceneLayout } from '../../render/forge/layout.ts';
import type { ForgeScene, SceneView } from '../../render/forge/scene.ts';
import { reducedMotion } from './parts.tsx';

export interface StageApi {
  enqueue(steps: readonly FxStep[]): void;
  skip(): void;
  busy(): boolean;
  /**
   * Where a played card hovers, in viewport coordinates: its centre, and the most height it may
   * take (the gap between the scene's top and the iron, so neither the numbers nor the blow hide).
   */
  cardClient(): { x: number; y: number; maxH: number };
}

export interface Floater {
  id: number;
  kind: 'progress' | 'quality' | 'heat' | 'restore' | 'note';
  text: string;
  /** Order within one beat (stacks them). */
  order: number;
  /** The dwarf started to speak: fade out at once. */
  hush?: boolean;
}

interface Props {
  view: SceneView;
  floaters: Floater[];
  say: { key: number; text: string } | null;
  reduced: boolean;
  /** Where a floating number of this kind is drawn to (viewport coordinates), or null to fade where it rose. */
  floatTarget(kind: Floater['kind']): { x: number; y: number } | null;
  apiRef: MutableRefObject<StageApi | null>;
  /** The scene is up and takes steps. */
  onReady(): void;
  /** A step's blow landed; skipped = the player tapped through it. */
  onBeat(step: FxStep, skipped?: boolean): void;
  onIdle(): void;
  onUnavailable(): void;
  onTap(): void;
}

/** A floating number's text is about this tall (px): it flies so its middle lands on the target. */
const FLOAT_HALF_H = 11;

/** The text: its left edge where it rose (layout.ts floatAt), moved by x, y. */
const at = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s})`;
/** The spark: centred on the text's middle, moved by x, y. */
const atSpark = (x: number, y: number, s: number) => `translate(calc(-50% + ${x}px), ${y}px) scale(${s})`;
/** Where a number holds over the anvil before it is drawn into its bar (px from where it rose). */
const HOLD_Y = -16;
/** The pull into the bar: slow, then faster and faster. */
const PULL = 'cubic-bezier(0.55, 0, 0.9, 0.45)';

/** Rise by the anvil and hold (the first `fly` of its life); reduced motion: show and fade where it rose. */
function riseKeyframes(fly: boolean): Keyframe[] {
  if (!fly) {
    return [
      { offset: 0, opacity: 0, transform: at(0, 6, 0.85) },
      { offset: FLOAT_FLIGHT.reducedPeak, opacity: 1, transform: at(0, 0, 1) },
      { offset: 0.8, opacity: 1, transform: at(0, -4, 1) },
      { offset: 1, opacity: 0, transform: at(0, -6, 1) },
    ];
  }
  const k = 1 / FLOAT_FLIGHT.fly;
  return [
    { offset: 0, opacity: 0, transform: at(0, 10, 0.7), easing: 'ease-out' },
    { offset: 0.1 * k, opacity: 1, transform: at(0, 0, 1.18) },
    { offset: 0.22 * k, opacity: 1, transform: at(0, -5, 1) },
    { offset: 1, opacity: 1, transform: at(0, HOLD_Y, 1) },
  ];
}

/** Share of the pull (the rest of its life) where it lands on its bar. */
const LAND = (FLOAT_FLIGHT.absorb - FLOAT_FLIGHT.fly) / (1 - FLOAT_FLIGHT.fly);

/** The text (or its spark) is drawn into the target (dx, dy from where it held): slow, then faster and faster. */
function pullKeyframes(move: typeof at, dx: number, dy: number, s0: number, s1: number, s2: number): Keyframe[] {
  return [
    { offset: 0, transform: move(0, HOLD_Y, s0), easing: PULL },
    { offset: LAND, transform: move(dx, dy, s1) },
    { offset: 1, transform: move(dx, dy, s2) },
  ];
}

/**
 * On the way the text fades out (gone well before it reaches the bar, so it never sits on the
 * bar's own number) and a spark fades in from it, lands, and flares out.
 */
const TEXT_FADE: Keyframe[] = [
  { offset: 0, opacity: 1 },
  { offset: LAND * 0.45, opacity: 1 },
  { offset: LAND * 0.85, opacity: 0 },
  { offset: 1, opacity: 0 },
];
const SPARK_FADE: Keyframe[] = [
  { offset: 0, opacity: 0 },
  { offset: LAND * 0.4, opacity: 0 },
  { offset: LAND * 0.8, opacity: 1 },
  { offset: LAND, opacity: 1 },
  { offset: 1, opacity: 0 },
];

export function ForgeStage(props: Props) {
  const { view, apiRef } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ForgeScene | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [sceneLayoutState, setSceneLayout] = useState<SceneLayout | null>(null);
  const cb = useRef(props);
  cb.current = props;
  const viewRef = useRef(view);
  viewRef.current = view;
  const floatEls = useRef(new Map<number, HTMLSpanElement>());
  const flown = useRef(new Set<number>());

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

  // The scene's own layout (pictures measured) for its box; a stand-in until it is up or after a resize.
  const fresh =
    sceneLayoutState !== null && Math.abs(sceneLayoutState.w - size.w) < 0.5 && Math.abs(sceneLayoutState.h - size.h) < 0.5;
  const L = fresh ? sceneLayoutState : sceneLayout(size.w || 390, size.h || 360);
  const layoutRef = useRef(L);
  layoutRef.current = L;

  // The scene: created once the box has a size, destroyed with the screen.
  const hasSize = size.w > 0 && size.h > 0;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    if (!hasSize) return;
    let cancelled = false;
    const host = canvasRef.current;
    if (host === null) return;
    import('../../render/forge/scene.ts')
      .then((m) =>
        m.createForgeScene(host, sizeRef.current.w, sizeRef.current.h, {
          reducedMotion: reducedMotion(),
          onBeat: (step, skipped) => cb.current.onBeat(step, skipped),
          onIdle: () => cb.current.onIdle(),
          onLayout: (l) => {
            if (!cancelled) setSceneLayout(l);
          },
        }),
      )
      .then((scene) => {
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        scene.setView(viewRef.current);
        apiRef.current = {
          enqueue: (steps) => scene.enqueue(steps),
          skip: () => scene.skip(),
          busy: () => scene.busy(),
          cardClient: () => {
            const r = hostRef.current?.getBoundingClientRect();
            const l = layoutRef.current;
            return { x: (r?.left ?? 0) + l.cardHover.x, y: (r?.top ?? 0) + l.cardHover.y, maxH: l.cardHover.maxH };
          },
        };
        cb.current.onReady();
      })
      .catch(() => {
        if (!cancelled) cb.current.onUnavailable();
      });
    return () => {
      cancelled = true;
      apiRef.current = null;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [hasSize, apiRef]);

  useEffect(() => {
    if (hasSize) sceneRef.current?.resize(size.w, size.h);
  }, [size, hasSize]);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view]);

  // A new floating number: rise by the anvil and hold, then be drawn into its bar, aimed where
  // the bar is when it sets off (the band may have risen or come down meanwhile).
  useLayoutEffect(() => {
    const ids = new Set(props.floaters.map((f) => f.id));
    for (const id of flown.current) if (!ids.has(id)) flown.current.delete(id);
    for (const f of props.floaters) {
      if (flown.current.has(f.id)) continue;
      const el = floatEls.current.get(f.id);
      if (el === undefined) continue;
      flown.current.add(f.id);
      const inner = el.querySelector<HTMLElement>('.fs-float-in');
      const spark = el.querySelector<HTMLElement>('.fs-float-spark');
      if (inner === null) continue;
      const flies = !props.reduced && f.kind !== 'note';
      const delay = f.order * FLOAT_FLIGHT.stagger;
      const rise = inner.animate(riseKeyframes(flies), {
        duration: flies ? FLOAT_FLIGHT.ms * FLOAT_FLIGHT.fly : FLOAT_FLIGHT.reducedMs,
        delay,
        fill: 'both',
      });
      if (!flies) continue;
      const order = f.order;
      rise.onfinish = () => {
        const host = hostRef.current;
        if (host === null || !el.isConnected) return;
        const to = cb.current.floatTarget(f.kind);
        if (to === null) {
          inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
          return;
        }
        const box = host.getBoundingClientRect();
        const from = floatAt(layoutRef.current, order);
        // The text's middle (it reads rightward from its left edge) lands on the target.
        const dx = to.x - box.left - (from.x + inner.offsetWidth / 2);
        const dy = to.y - box.top - (from.y + FLOAT_HALF_H);
        const timing = { duration: FLOAT_FLIGHT.ms * (1 - FLOAT_FLIGHT.fly), fill: 'forwards' as const };
        inner.animate(pullKeyframes(at, dx, dy, 1, 0.4, 0.4), timing);
        inner.animate(TEXT_FADE, timing);
        spark?.animate(pullKeyframes(atSpark, dx, dy, 0.6, 1, 2.2), timing);
        spark?.animate(SPARK_FADE, timing);
      };
    }
  }, [props.floaters]);

  const bg = sceneArtUrl('bg_workshop');

  return (
    <div
      ref={hostRef}
      className="fs-stage"
      style={bg !== null ? ({ '--fs-bg': `url("${bg}")` } as CSSProperties) : undefined}
      onClick={props.onTap}
    >
      <div ref={canvasRef} className="fs-canvas" aria-hidden="true" />

      {props.say !== null && (
        <div
          key={props.say.key}
          className="fs-say"
          style={{ left: L.bubble.x, top: L.bubble.y, maxWidth: L.bubble.maxW }}
          role="status"
        >
          {props.say.text}
        </div>
      )}

      <div className="fs-floats" aria-hidden="true">
        {props.floaters.map((f) => {
          const at = floatAt(L, f.order);
          return (
            <span
              key={f.id}
              ref={(el) => {
                if (el === null) floatEls.current.delete(f.id);
                else floatEls.current.set(f.id, el);
              }}
              className={`fs-float fs-float-${f.kind}${f.hush === true ? ' hush' : ''}`}
              style={{ left: at.x, top: at.y }}
            >
              <span className="fs-float-in">{f.text}</span>
              <span
                className="fs-float-spark"
                style={{ top: FLOAT_HALF_H - FLOAT_FLIGHT.spark / 2, width: FLOAT_FLIGHT.spark, height: FLOAT_FLIGHT.spark }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
