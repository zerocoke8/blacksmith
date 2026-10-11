// Small shared pieces for the card craft screens: bottom sheet, segmented choice, stepper,
// and the long-press hook (touch first: nothing needs a mouse hover, CLAUDE.md).

import { cardName, cardText } from '../../sim/cards/index.ts';
import { CARD_KIND_LABEL, CARDS, type CardId } from '../../sim/data/cards.ts';
import { CardThumb } from './GameCard.tsx';
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef } from 'react';

export function Sheet(props: { title?: string; onClose(): void; children: ReactNode; tone?: 'danger' }) {
  const { title, onClose, children, tone } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="kc-backdrop" onClick={onClose}>
      <div
        className={`kc-sheet${tone === 'danger' ? ' kc-sheet--danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && <p className="kc-sheet-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>(props: {
  value: T;
  options: readonly { value: T; label: ReactNode; sub?: ReactNode; disabled?: boolean }[];
  onChange(v: T): void;
  cols?: number;
  label?: string;
}) {
  const { value, options, onChange, cols, label } = props;
  return (
    <div className="kc-seg" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'kc-seg-btn on' : 'kc-seg-btn'}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.sub !== undefined && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

export function Stepper(props: {
  value: ReactNode;
  sub?: ReactNode;
  onDown(): void;
  onUp(): void;
  downDisabled?: boolean;
  upDisabled?: boolean;
  label: string;
}) {
  const { value, sub, onDown, onUp, downDisabled, upDisabled, label } = props;
  return (
    <div className="kc-stepper">
      <button type="button" className="kc-btn kc-step" onClick={onDown} disabled={downDisabled} aria-label={`${label} 내리기`}>
        −
      </button>
      <div className="kc-stepper-val">
        <b>{value}</b>
        {sub !== undefined && <small>{sub}</small>}
      </div>
      <button type="button" className="kc-btn kc-step" onClick={onUp} disabled={upDisabled} aria-label={`${label} 올리기`}>
        +
      </button>
    </div>
  );
}

export function Toggle(props: { on: boolean; onChange(on: boolean): void; label: ReactNode; sub?: ReactNode }) {
  const { on, onChange, label, sub } = props;
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'kc-toggle on' : 'kc-toggle'} onClick={() => onChange(!on)}>
      <span className="kc-toggle-text">
        {label}
        {sub !== undefined && <small>{sub}</small>}
      </span>
      <span className="kc-toggle-knob" aria-hidden="true" />
    </button>
  );
}

export const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE_PX = 10;

/**
 * Tap and long press on one element. A long press never also counts as a tap; moving the
 * finger (a scroll) cancels it. `onPress(true/false)` tells when a finger is down, so the
 * screen can preview while it is held.
 */
export function usePress(handlers: { onTap(): void; onLong(): void; onPress?(down: boolean): void }) {
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    latest.current.onPress?.(false);
  };

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      longFired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      latest.current.onPress?.(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        longFired.current = true;
        latest.current.onPress?.(false);
        latest.current.onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = start.current;
      if (s !== null && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE_PX) {
        longFired.current = false;
        cancel();
      }
    },
    onPointerUp: () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      latest.current.onPress?.(false);
    },
    onPointerCancel: cancel,
    onPointerLeave: () => {
      if (timer.current !== null) cancel();
    },
    onClick: () => {
      if (longFired.current) {
        longFired.current = false;
        return;
      }
      latest.current.onTap();
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}

/** True when the player asked the system for less motion. */
export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** A card laid flat in a list: cost, name, kind and its text (recipe, 작업대, piles). */
export function CardFace(props: {
  id: CardId;
  tier?: number;
  count?: number;
  cost?: number;
  dim?: boolean;
  children?: ReactNode;
}) {
  const { id, tier = 1, count, cost, dim, children } = props;
  const spec = CARDS[id];
  return (
    <div className={`kc-face kc-kind-${spec.kind}${dim === true ? ' dim' : ''}`}>
      <span className="kc-face-thumb" aria-label={spec.cost === null ? '각인' : `코스트 ${cost ?? spec.cost}`}>
        <CardThumb id={id} cost={cost} />
      </span>
      <span className="kc-face-main">
        <span className="kc-face-name">
          <b>{cardName(id, tier)}</b>
          {count !== undefined && count > 1 && <i> ×{count}</i>}
          <span className="kc-face-kind">{CARD_KIND_LABEL[spec.kind]}</span>
        </span>
        <small>{cardText(id, tier)}</small>
      </span>
      {children}
    </div>
  );
}
