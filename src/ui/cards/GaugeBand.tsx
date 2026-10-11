// The gauge band of the art table: right over the cards, the 공정 and 품질 bars (★2~5 marks
// under 품질), 열기 and this turn's 화로 상태, with what is on (풀무질 2턴, 혼신 1장, 실험 …) and the
// next turn's fire just over it. A lifted card's share shows here, next to the card itself: a
// ghost on the bar, "공정 +100" by its name and the value it would reach. The floating numbers of
// a blow are drawn into these bars, which flash as they arrive. Every number is the engine's
// (CLAUDE.md 규칙 2); sizes come from TABLE_ROWS.

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { QualityTier } from '../../sim/core/types.ts';
import type { PlayPreview } from '../../sim/cards/index.ts';
import { QUALITY } from '../../sim/data/common.ts';
import { FIRE_HINT, FIRE_LABEL, type FireState, HEAT } from '../../sim/data/cards.ts';
import { uiArtUrl } from '../../render/forge/assets.ts';
import type { GaugeSnap } from '../../render/forge/fx.ts';
import { FLOAT_FLIGHT, type UiArtKey } from '../../render/forge/layout.ts';
import type { Floater } from './ForgeStage.tsx';
import { UiIcon } from './GameCard.tsx';

/** The band's parts a floating number flies into (stable refs: they stay attached across renders). */
export interface BandTargets {
  /** The band itself (it rises while a card is lifted). */
  band: RefObject<HTMLDivElement | null>;
  progress: RefObject<HTMLDivElement | null>;
  quality: RefObject<HTMLDivElement | null>;
  heat: RefObject<HTMLDivElement | null>;
}

interface Props {
  shown: GaugeSnap;
  engine: GaugeSnap;
  preview: PlayPreview | null;
  progressRequired: number;
  qualityCap: number;
  tierFx: { key: number; tier: QualityTier } | null;
  /** The craft is over: the bars stay, the fire and 열기 step back. */
  done: boolean;
  /** px the band rises (a card is lifted under it). */
  rise: number;
  chips: ReactNode;
  nextFire: FireState | null;
  floaters: readonly Floater[];
  reduced: boolean;
  /** The band's parts, for the floating numbers (ArtTable hands them to the scene). */
  targets: BandTargets;
  onFireTap(): void;
  onTap(): void;
}

const TIER_MARKS: readonly QualityTier[] = [2, 3, 4, 5];

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
}

function num(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** When (ms after it appears) a floating number reaches its bar (or the durability orb). */
export function absorbDelay(f: Floater, reduced: boolean): number {
  const F = FLOAT_FLIGHT;
  return f.order * F.stagger + (reduced ? F.reducedPeak * F.reducedMs : F.absorb * F.ms);
}

/** A flash on the bar for each number flying into it (keyed by the number, so it plays once). */
function Absorbs({ floaters, kind, reduced }: { floaters: readonly Floater[]; kind: Floater['kind']; reduced: boolean }) {
  return (
    <>
      {floaters
        .filter((f) => f.kind === kind && f.hush !== true)
        .map((f) => (
          <span key={f.id} className="gb-absorb" style={{ animationDelay: `${absorbDelay(f, reduced)}ms` }} />
        ))}
    </>
  );
}

/** The bar's name at its left end; while a card is lifted, what that card adds to it (공정 +100). */
function BarName({ name, gain }: { name: string; gain: number }) {
  return (
    <span className="gb-name" aria-hidden="true">
      {name}
      {gain > 0 && <em key="gain">+{num(gain)}</em>}
    </span>
  );
}

/** The bar's value over its end (a lifted card's: the value it would reach, bright). */
function BarNum({ value, max, after }: { value: number; max: number; after: boolean }) {
  return (
    <span className={`gb-num${after ? ' after' : ''}`}>
      <b>{num(value)}</b>
      <small> / {num(max)}</small>
    </span>
  );
}

export function GaugeBand(props: Props) {
  const { shown, engine, preview, progressRequired, qualityCap, floaters, reduced } = props;
  const targets = props.targets;

  const progressPct = pct(shown.progress, progressRequired);
  const qualityPct = pct(shown.quality, qualityCap);
  const ghostProgress = preview !== null && preview.progress !== 0 ? pct(engine.progress + preview.progress, progressRequired) : null;
  const ghostQuality = preview !== null && preview.quality !== 0 ? pct(engine.quality + preview.quality, qualityCap) : null;
  const ghostTier =
    ghostQuality !== null && preview !== null
      ? TIER_MARKS.filter((t) => (engine.quality + preview.quality) / qualityCap >= QUALITY[t].threshold - 1e-9).pop()
      : undefined;
  // A lifted card's share: what it adds to each bar (as the bar would show it, so capped at the bar's end).
  const progressGain =
    preview !== null ? Math.min(engine.progress + preview.progress, progressRequired) - Math.min(engine.progress, progressRequired) : 0;
  const qualityGain = preview !== null ? Math.min(engine.quality + preview.quality, qualityCap) - Math.min(engine.quality, qualityCap) : 0;
  const progressValue = progressGain > 0 ? Math.min(engine.progress + progressGain, progressRequired) : Math.min(shown.progress, progressRequired);
  const qualityValue = qualityGain > 0 ? Math.min(engine.quality + qualityGain, qualityCap) : shown.quality;
  const heatAfter = preview !== null ? Math.max(0, Math.min(HEAT.max, engine.heat + preview.heat)) : shown.heat;
  const fire = shown.fire;
  const fireUrl = uiArtUrl(`fire_${fire}` as UiArtKey);
  const hint = FIRE_HINT[fire];

  return (
    <div
      ref={targets.band}
      className={`gb-band${props.done ? ' done' : ''}${props.rise > 0 ? ' risen' : ''}`}
      style={{ transform: props.rise > 0 ? `translateY(${-props.rise}px)` : undefined, '--gb-rise': `${props.rise}px` } as CSSProperties}
      onClick={props.onTap}
    >
      <div className="gb-ledge">
        {props.chips}
        {props.nextFire !== null && !props.done && <span className="fs-chip next">다음 화로 · {FIRE_LABEL[props.nextFire]}</span>}
      </div>

      <div className="gb-row gb-progress">
        <UiIcon className="gb-icon" url={uiArtUrl('icon_progress')} glyph="hammer" />
        <div
          ref={targets.progress}
          className="gb-track"
          role="meter"
          aria-label="공정"
          aria-valuenow={shown.progress}
          aria-valuemax={progressRequired}
        >
          {ghostProgress !== null && ghostProgress > progressPct && (
            <span className="gb-ghost" style={{ left: `${progressPct}%`, width: `${ghostProgress - progressPct}%` }} />
          )}
          <span className="gb-fill" style={{ width: `${progressPct}%` }} />
          <span className="gb-label">
            <BarName name="공정" gain={progressGain} />
            <BarNum value={progressValue} max={progressRequired} after={progressGain > 0} />
            {preview?.finishes === true && <span className="gb-tag">완성</span>}
          </span>
          <Absorbs floaters={floaters} kind="progress" reduced={reduced} />
        </div>
      </div>

      <div className="gb-row gb-quality">
        <UiIcon className="gb-icon" url={uiArtUrl('icon_quality')} glyph="sparkle" />
        <div
          ref={targets.quality}
          className="gb-track"
          role="meter"
          aria-label="품질"
          aria-valuenow={shown.quality}
          aria-valuemax={qualityCap}
        >
          {ghostQuality !== null && ghostQuality > qualityPct && (
            <span className="gb-ghost" style={{ left: `${qualityPct}%`, width: `${ghostQuality - qualityPct}%` }} />
          )}
          <span className="gb-fill" style={{ width: `${qualityPct}%` }} />
          {TIER_MARKS.filter((t) => t < 5).map((t) => (
            <span key={t} className="gb-tick" style={{ left: `${QUALITY[t].threshold * 100}%` }} />
          ))}
          <span className="gb-label">
            <BarName name="품질" gain={qualityGain} />
            <BarNum value={qualityValue} max={qualityCap} after={qualityGain > 0} />
          </span>
          {props.tierFx !== null && <span key={props.tierFx.key} className="gb-flash" />}
          <Absorbs floaters={floaters} kind="quality" reduced={reduced} />
        </div>
        <div className="gb-marks" aria-hidden="true">
          {TIER_MARKS.map((t) => {
            const lit = shown.quality / qualityCap >= QUALITY[t].threshold - 1e-9;
            const next = ghostTier !== undefined && ghostTier >= t && !lit;
            const pop = props.tierFx !== null && props.tierFx.tier === t;
            return (
              <span
                key={`${t}-${pop ? props.tierFx?.key : 0}`}
                className={`gb-mark${lit ? ' on' : ''}${next ? ' next' : ''}${pop ? ' pop' : ''}`}
                style={{ left: `${QUALITY[t].threshold * 100}%` }}
              >
                ★{t}
              </span>
            );
          })}
        </div>
      </div>

      <div
        ref={targets.heat}
        className={`gb-heat${heatAfter !== shown.heat ? ' change' : ''}`}
        role="meter"
        aria-label={`열기 ${shown.heat}`}
        aria-valuenow={shown.heat}
        aria-valuemax={HEAT.max}
      >
        <UiIcon className="gb-heat-icon" url={uiArtUrl('icon_heat')} glyph="flame" />
        <b key={shown.heat}>{heatAfter}</b>
        <small>열기</small>
        <Absorbs floaters={floaters} kind="heat" reduced={reduced} />
      </div>

      <button
        type="button"
        className={`gb-fire gb-fire-${fire}`}
        onClick={(e) => {
          e.stopPropagation();
          props.onFireTap();
        }}
        aria-label={`화로 ${FIRE_LABEL[fire]}${hint !== '' ? `, ${hint}` : ''}`}
      >
        <span key={fire} className={`gb-fire-icon${fireUrl !== null ? ' pic' : ''}`}>
          <UiIcon url={fireUrl} glyph="flame" />
        </span>
        <span className="gb-fire-text">
          <b>{FIRE_LABEL[fire]}</b>
          <small>{hint !== '' ? hint : '화로'}</small>
        </span>
      </button>
    </div>
  );
}
