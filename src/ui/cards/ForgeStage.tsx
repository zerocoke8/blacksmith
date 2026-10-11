// The scene box of the art table: the PixiJS workshop (render/forge/scene.ts, loaded on demand)
// with a DOM layer on top for what must stay crisp and tappable: the gauge plate over the anvil
// (like an enemy's HP bar), the fire badge over the furnace (like an enemy's intent), the
// dwarf's speech bubble and the floating numbers. Positions come from
// render/forge/layout.ts, the same numbers the scene uses.

import { type CSSProperties, type MutableRefObject, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { QualityTier } from '../../sim/core/types.ts';
import type { PlayPreview } from '../../sim/cards/index.ts';
import { QUALITY } from '../../sim/data/common.ts';
import { FIRE_HINT, FIRE_LABEL, type FireState, HEAT } from '../../sim/data/cards.ts';
import { sceneArtUrl, uiArtUrl } from '../../render/forge/assets.ts';
import type { FxStep, GaugeSnap } from '../../render/forge/fx.ts';
import { floatAt, type SceneLayout, sceneLayout, type UiArtKey } from '../../render/forge/layout.ts';
import type { ForgeScene, SceneView } from '../../render/forge/scene.ts';
import { type Glyph, UiIcon } from './GameCard.tsx';
import { reducedMotion } from './parts.tsx';

export interface StageApi {
  enqueue(steps: readonly FxStep[]): void;
  skip(): void;
  busy(): boolean;
  /**
   * Where a played card hovers, in viewport coordinates: its centre, and the most height it may
   * take (the gap between the gauge plate and the iron, so neither the numbers nor the blow hide).
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
  shown: GaugeSnap;
  progressRequired: number;
  qualityCap: number;
  /** Gauge values the engine has now (ghost bars start from these). */
  engine: GaugeSnap;
  preview: PlayPreview | null;
  floaters: Floater[];
  say: { key: number; text: string } | null;
  tierFx: { key: number; tier: QualityTier } | null;
  /** The craft is over and its end is shown (the plate dims). */
  done: boolean;
  chips: ReactNode;
  nextFire: FireState | null;
  apiRef: MutableRefObject<StageApi | null>;
  /** The scene is up and takes steps. */
  onReady(): void;
  /** A step's blow landed; skipped = the player tapped through it. */
  onBeat(step: FxStep, skipped?: boolean): void;
  onIdle(): void;
  onUnavailable(): void;
  onTap(): void;
  onFireTap(): void;
}

const TIER_MARKS: readonly QualityTier[] = [2, 3, 4, 5];

const FIRE_GLYPH: Glyph = 'flame';


function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
}

function num(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function ForgeStage(props: Props) {
  const { view, shown, engine, preview, progressRequired, qualityCap, apiRef } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gaugesRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ForgeScene | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [sceneLayoutState, setSceneLayout] = useState<SceneLayout | null>(null);
  /** The gauge plate's bottom edge inside the stage (px): the floating numbers stay under it. */
  const [plateBottom, setPlateBottom] = useState(0);
  const cb = useRef(props);
  cb.current = props;
  const viewRef = useRef(view);
  viewRef.current = view;

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

  const L = sceneLayoutState ?? sceneLayout(size.w || 390, size.h || 360);
  const layoutRef = useRef(L);
  layoutRef.current = L;

  useLayoutEffect(() => {
    const plate = gaugesRef.current;
    const host = hostRef.current;
    if (plate === null || host === null) return;
    const bottom = plate.getBoundingClientRect().bottom - host.getBoundingClientRect().top;
    setPlateBottom((b) => (Math.abs(b - bottom) < 0.5 ? b : bottom));
  }, [size.w, size.h, L.gauges.y]);

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
            const left = r?.left ?? 0;
            const top = r?.top ?? 0;
            const plate = gaugesRef.current?.getBoundingClientRect();
            const from = (plate?.bottom ?? top + l.cardHover.y - 60) + 6;
            const to = top + l.iron.y - l.iron.h * 0.7;
            if (to - from < 40) return { x: left + l.cardHover.x, y: top + l.cardHover.y, maxH: 120 };
            return { x: left + l.cardHover.x, y: (from + to) / 2, maxH: to - from };
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

  // ---- Gauges ----
  const progressPct = pct(shown.progress, progressRequired);
  const qualityPct = pct(shown.quality, qualityCap);
  const ghostProgress = preview !== null && preview.progress !== 0 ? pct(engine.progress + preview.progress, progressRequired) : null;
  const ghostQuality = preview !== null && preview.quality !== 0 ? pct(engine.quality + preview.quality, qualityCap) : null;
  const ghostTier =
    ghostQuality !== null && preview !== null
      ? TIER_MARKS.filter((t) => (engine.quality + preview.quality) / qualityCap >= QUALITY[t].threshold - 1e-9).pop()
      : undefined;
  const heatAfter = preview !== null ? Math.max(0, Math.min(HEAT.max, engine.heat + preview.heat)) : shown.heat;
  const bg = sceneArtUrl('bg_workshop');
  const fireUrl = uiArtUrl(`fire_${shown.fire}` as UiArtKey);

  return (
    <div
      ref={hostRef}
      className="fs-stage"
      style={bg !== null ? ({ '--fs-bg': `url("${bg}")` } as CSSProperties) : undefined}
      onClick={props.onTap}
    >
      <div ref={canvasRef} className="fs-canvas" aria-hidden="true" />

      <div
        ref={gaugesRef}
        className={`fs-gauges${props.done ? ' done' : ''}`}
        style={{ left: L.gauges.x, top: L.gauges.y, width: L.gauges.w }}
      >
        <div className="fs-gbar fs-gbar-progress">
          <UiIcon className="fs-gicon" url={uiArtUrl('icon_progress')} glyph="hammer" />
          <div className="fs-track" role="meter" aria-label="공정" aria-valuenow={shown.progress} aria-valuemax={progressRequired}>
            {ghostProgress !== null && ghostProgress > progressPct && (
              <span className="fs-ghost" style={{ left: `${progressPct}%`, width: `${ghostProgress - progressPct}%` }} />
            )}
            <span className="fs-fill" style={{ width: `${progressPct}%` }} />
            <span className="fs-num">
              <span>
                {ghostProgress !== null && preview !== null ? (
                  <>
                    {num(Math.min(engine.progress, progressRequired))} → <em>{num(Math.min(engine.progress + preview.progress, progressRequired))}</em>
                  </>
                ) : (
                  num(Math.min(shown.progress, progressRequired))
                )}
                <small> / {num(progressRequired)}</small>
              </span>
            </span>
            {preview?.finishes === true && <span className="fs-tag fs-tag-fin">완성</span>}
          </div>
        </div>
        <div className="fs-gbar fs-gbar-quality">
          <UiIcon className="fs-gicon" url={uiArtUrl('icon_quality')} glyph="sparkle" />
          <div className="fs-track" role="meter" aria-label="품질" aria-valuenow={shown.quality} aria-valuemax={qualityCap}>
            {ghostQuality !== null && ghostQuality > qualityPct && (
              <span className="fs-ghost" style={{ left: `${qualityPct}%`, width: `${ghostQuality - qualityPct}%` }} />
            )}
            <span className="fs-fill" style={{ width: `${qualityPct}%` }} />
            {TIER_MARKS.filter((t) => t < 5).map((t) => (
              <span key={t} className="fs-tick" style={{ left: `${QUALITY[t].threshold * 100}%` }} />
            ))}
            <span className="fs-num">
              <span>
                {ghostQuality !== null && preview !== null ? (
                  <>
                    {num(engine.quality)} → <em>{num(Math.min(engine.quality + preview.quality, qualityCap))}</em>
                  </>
                ) : (
                  num(shown.quality)
                )}
                <small> / {num(qualityCap)}</small>
              </span>
            </span>
            {props.tierFx !== null && <span key={props.tierFx.key} className="fs-track-flash" />}
          </div>
          <div className="fs-marks" aria-hidden="true">
            {TIER_MARKS.map((t) => {
              const lit = shown.quality / qualityCap >= QUALITY[t].threshold - 1e-9;
              const next = ghostTier !== undefined && ghostTier >= t && !lit;
              const pop = props.tierFx !== null && props.tierFx.tier === t;
              return (
                <span
                  key={`${t}-${pop ? props.tierFx?.key : 0}`}
                  className={`fs-mark${lit ? ' on' : ''}${next ? ' next' : ''}${pop ? ' pop' : ''}`}
                  style={{ left: `${QUALITY[t].threshold * 100}%` }}
                >
                  ★{t}
                </span>
              );
            })}
          </div>
        </div>
        <div className={`fs-heat${heatAfter !== shown.heat ? ' change' : ''}`} aria-label={`열기 ${shown.heat}`}>
          <UiIcon className="fs-heat-icon" url={uiArtUrl('icon_heat')} glyph="flame" />
          <b key={shown.heat}>{heatAfter !== shown.heat ? heatAfter : shown.heat}</b>
          <small>열기</small>
        </div>
        {/* What is on (풀무질 2턴, 혼신 1장 …) sits under the bars, like buffs under an HP bar. */}
        <div className="fs-chips">{props.chips}</div>
      </div>

      <button
        type="button"
        className={`fs-fire fs-fire-${shown.fire}`}
        style={{ left: L.fire.x, top: L.fire.y }}
        onClick={(e) => {
          e.stopPropagation();
          props.onFireTap();
        }}
        aria-label={`화로 ${FIRE_LABEL[shown.fire]}${FIRE_HINT[shown.fire] !== '' ? `, ${FIRE_HINT[shown.fire]}` : ''}`}
      >
        <span key={shown.fire} className={`fs-fire-icon${fireUrl !== null ? ' pic' : ''}`}>
          <UiIcon url={fireUrl} glyph={FIRE_GLYPH} />
        </span>
        <span className="fs-fire-label">{FIRE_LABEL[shown.fire]}</span>
        {FIRE_HINT[shown.fire] !== '' && <span className="fs-fire-hint">{FIRE_HINT[shown.fire]}</span>}
        {props.nextFire !== null && <span className="fs-fire-next">다음 {FIRE_LABEL[props.nextFire]}</span>}
      </button>

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
          const at = floatAt(L, f.order, plateBottom);
          return (
            <span
              key={f.id}
              className={`fs-float fs-float-${f.kind}${f.hush === true ? ' hush' : ''}`}
              style={{ left: at.x, top: at.y, animationDelay: `${f.order * 90}ms` }}
            >
              {f.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
