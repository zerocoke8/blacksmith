// The card as a real card: frame, cost bubble (내구도), name band, picture window, kind ribbon and
// text. One component for the hand, the sheets and the small thumbnails on the 작업대·준비
// screens. Pictures come from src/assets/art (render/forge/assets.ts); a card without one gets
// a flat backdrop in its kind's colour and an outlined glyph. Box positions live in render/forge/layout.ts (CARD_FACE).

import type { CSSProperties, ReactNode } from 'react';
import { cardName, cardText } from '../../sim/cards/index.ts';
import { CARD_KIND_LABEL, type CardEffect, type CardId, CARDS, KEYWORD_LABEL } from '../../sim/data/cards.ts';
import { cardArtKey, cardArtUrl, frameArtUrl } from '../../render/forge/assets.ts';
import { CARD_ART_FOCUS, CARD_ASPECT, CARD_FACE, CARD_MINI_CUT, CARD_TYPE } from '../../render/forge/layout.ts';
import './card.css';

export type Glyph = 'hammer' | 'sparkle' | 'finish' | 'flame' | 'drop' | 'eye' | 'cards' | 'ingot' | 'rune' | 'wind';

function glyphOfEffects(effects: readonly CardEffect[]): Glyph | null {
  for (const e of effects) {
    switch (e.type) {
      case 'progress':
      case 'fillProgress':
        return 'hammer';
      case 'finish':
        return 'finish';
      case 'quality':
        return 'sparkle';
      case 'restore':
        return 'drop';
      case 'heat':
      case 'buff':
        return 'flame';
      case 'setFire':
      case 'reroll':
        return 'eye';
      case 'draw':
      case 'drawNextTurn':
      case 'recall':
        return 'cards';
      case 'charge':
        return 'finish';
      case 'ifGoodFire':
        return glyphOfEffects(e.then);
      default:
        break;
    }
  }
  return null;
}

export function cardGlyph(id: CardId): Glyph {
  const spec = CARDS[id];
  if (spec.kind === 'imprint') return 'rune';
  if (spec.group === 'material') return 'ingot';
  return glyphOfEffects(spec.effects) ?? (spec.kind === 'progress' ? 'hammer' : spec.kind === 'quality' ? 'sparkle' : 'wind');
}

const GLYPH_PATH: Record<Glyph, string> = {
  hammer: 'M3.5 7.2 9.4 3.4l3.4 3.4-1.9 1.9 9.3 9.3-2.3 2.3-9.3-9.3-1.9 1.9z',
  sparkle: 'M12 1.8l2.3 7.9 7.9 2.3-7.9 2.3L12 22.2l-2.3-7.9L1.8 12l7.9-2.3z',
  finish: 'M12 2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.2l-6.2 3.5 1.6-6.9L2.1 9.1l7-.7z',
  flame: 'M12.4 1.8c1.2 4.2 6.1 6.4 6.1 12a6.5 6.5 0 0 1-13 0c0-3.2 1.7-5 3.1-6.6.2 2.4 1.2 3.7 2.6 4.4-.4-3.6.1-6.8 1.2-9.8z',
  drop: 'M12 2.2S5 10.3 5 15.2a7 7 0 0 0 14 0C19 10.3 12 2.2 12 2.2z',
  eye: 'M1.8 12C4.6 6.4 19.4 6.4 22.2 12 19.4 17.6 4.6 17.6 1.8 12zm10.2 3.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z',
  cards: 'M4 6.5 13 4l3 12-9 2.5zM15.4 5.4l4.6 1.3-3 11.5-1.7-.5 2.4-9.6z',
  ingot: 'M2.5 17.5 6.6 9h10.8l4.1 8.5zM8 10.6l-1.6 3.8h4.2l.8-3.8z',
  rune: 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm0 2a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM11 6h2v12h-2zM7.2 9.3l1-1.7 8.6 5-1 1.7z',
  wind: 'M3 8.5h11.5a2.6 2.6 0 1 0-2.6-2.6h-2a4.6 4.6 0 1 1 4.6 4.6H3zm0 4h15a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H3zm0 4h7v2H3z',
};

export function GlyphIcon({ name, className }: { name: Glyph; className?: string }) {
  return (
    <svg className={className ?? 'gc-glyph'} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GLYPH_PATH[name]} />
    </svg>
  );
}

export function CardGlyph({ id }: { id: CardId }) {
  return <GlyphIcon name={cardGlyph(id)} />;
}

/** A UI picture (icon_heat, fire_good …) or its glyph stand-in. */
export function UiIcon({ url, glyph, className }: { url: string | null; glyph: Glyph; className?: string }) {
  return url !== null ? (
    <img className={className} src={url} alt="" draggable={false} />
  ) : (
    <GlyphIcon name={glyph} className={className} />
  );
}

/** The card picture filling its box (cut to fit), or the flat stand-in. */
export function CardPicture({ id }: { id: CardId }) {
  const url = cardArtUrl(id);
  const focus = CARD_ART_FOCUS[cardArtKey(id)];
  return url !== null ? (
    <img
      className="gc-pic"
      src={url}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      style={focus !== undefined ? { objectPosition: `50% ${focus * 100}%` } : undefined}
    />
  ) : (
    <span className="gc-pic gc-pic-none">
      <CardGlyph id={id} />
    </span>
  );
}

/**
 * The rules text without the keywords shown as pills under it: the engine writes each keyword as a
 * sentence of its own ('좋음 전용. 품질 +150%', '… 열기 +1. 소멸'), so it would show twice.
 */
function withoutKeywords(text: string, keys: readonly string[]): string {
  if (keys.length === 0) return text;
  return text
    .split('. ')
    .filter((part) => !keys.includes(part))
    .join('. ');
}

function keywordsOf(id: CardId): string[] {
  const k = CARDS[id].keywords;
  const out: string[] = [];
  if (k.firstHand === true) out.push(KEYWORD_LABEL.firstHand);
  if (k.exhaust === true && k.firstHand !== true) out.push(KEYWORD_LABEL.exhaust);
  if (k.retain === true) out.push(KEYWORD_LABEL.retain);
  if (k.goodOnly === true) out.push(KEYWORD_LABEL.goodOnly);
  return out;
}

export type GameCardState = 'blocked' | 'finish' | 'breaks' | null;

export interface GameCardProps {
  id: CardId;
  /** 주재료 구간, for names and numbers that depend on it. */
  tier?: number;
  /** Width in px; the card is 2:3. */
  width: number;
  /** Cost now (the hand); defaults to the printed cost. */
  cost?: number;
  name?: string;
  /** Shown text; defaults to the short card text. */
  text?: string;
  state?: GameCardState;
  /** One line over the text box: why it cannot be played, "이 한 방으로 완성" … */
  note?: string | null;
  count?: number;
  selected?: boolean;
  /**
   * 'mini': the top of the card, cost and picture only (rows of small cards on the 준비 and 완성
   * screens, the name goes under it: CardStrip).
   */
  variant?: 'full' | 'mini';
  /** Small cards that are read (the hand, the 작업대 grid): text and notes keep their floor sizes (CARD_TYPE). */
  floor?: boolean;
  /**
   * A card half under the next one in the fan: the share of its width that shows from the left.
   * A short text wraps inside that strip, so it shows whole ("공정 / +100%"), not a number cut
   * short ("공정 +10").
   */
  shown?: number;
  className?: string;
  children?: ReactNode;
}

function px(n: number): string {
  return `${Math.round(n * 10) / 10}px`;
}

/** Rough width of a name in ems (Korean glyphs are about 1em, spaces and digits narrower). */
function nameEms(name: string): number {
  let ems = 0;
  for (const ch of name) ems += ch === ' ' ? 0.3 : /[0-9+\-·]/.test(ch) ? 0.6 : 0.97;
  return Math.max(1, ems);
}

export function GameCard(props: GameCardProps) {
  const { id, tier = 1, width, state = null, note, count, selected, className, children } = props;
  const mini = props.variant === 'mini';
  const spec = CARDS[id];
  const height = width / CARD_ASPECT;
  const printed = spec.cost;
  const cost = props.cost ?? printed ?? 0;
  const frame = frameArtUrl(spec.kind);
  const f = CARD_FACE;
  const T = CARD_TYPE;
  const box = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    left: px(b.x * width),
    top: px(b.y * height),
    width: px(b.w * width),
    height: px(b.h * height),
  });
  const gem = f.cost.d * width;
  const costCls = printed === null ? '' : cost < printed ? ' down' : cost > printed ? ' up' : '';
  const keywords = keywordsOf(id);
  const name = props.name ?? cardName(id, tier);
  const fullText = props.text ?? cardText(id, tier, { short: true });
  const base = width * T.base;
  // The name: the base size or its floor, but never wider than its band (then it shrinks to fit).
  const nameFit = (f.name.w * width * 0.94) / nameEms(name);
  const namePx = Math.min(nameFit, Math.max(T.nameMin, base));
  const notePx = Math.max(props.floor === true ? T.noteMin : 0, base * 0.7);
  const hasNote = note !== undefined && note !== null;
  const noteH = Math.max(width * 0.16, notePx * 1.6);
  // The text box: 3% of the card's width padding top and bottom (card.css), the note over its bottom.
  const padY = 0.03 * width;
  const room = f.text.h * height - padY - (hasNote ? noteH : padY);
  // Long rules text steps down a size and may take a fifth line (the long-press sheet has it all).
  const sizeOf = (len: number) => Math.max(props.floor === true ? T.textMin : 0, base * (len > T.veryLong ? 0.72 : len > T.longText ? 0.78 : 0.84));
  // Keywords as pills under the text on a big card that has a line to spare for them; else in the text.
  const pillLen = withoutKeywords(fullText, keywords).length + keywords.length * 5;
  const pillPx = sizeOf(pillLen);
  const keyPx = Math.max(T.keyMin, pillPx * 0.8);
  const keysH = keyPx * 1.35 + 0.03 * width;
  const pills = keywords.length > 0 && width >= T.keysMinW && room - keysH >= pillPx * T.lineH;
  const body = pills ? withoutKeywords(fullText, keywords) : fullText;
  const textLen = pills ? pillLen : body.length;
  const textPx = pills ? pillPx : sizeOf(textLen);
  const lineH = textPx * T.lineH;
  // As many whole lines as the box holds (the last one ends in …), never a line cut in half.
  const lines = Math.max(1, Math.min(textLen > T.longText ? 5 : 4, Math.floor((room - (pills ? keysH : 0)) / lineH)));
  // Half under the next card: a short text keeps to the strip that shows (its right edge a little
  // inside it, above the note) when it fits there whole; a longer one stays as it is, cut by the next card.
  const cutRight = (() => {
    const shown = props.shown;
    if (shown === undefined || shown >= f.text.x + f.text.w) return 0;
    const strip = (shown - f.text.x - 0.05) * width - T.cutPad;
    const need = Math.ceil((nameEms(body) * textPx * 1.15) / Math.max(1, strip));
    return strip > textPx * 3 && need <= lines ? f.text.x + f.text.w - shown : 0;
  })();
  const textStyle = {
    ...box(f.text),
    fontSize: px(textPx),
    '--gc-lines': lines,
    ...(cutRight > 0 ? { paddingRight: px(cutRight * width + T.cutPad) } : {}),
    // The note sits over the box's bottom: the text keeps above it.
    ...(hasNote ? { paddingBottom: px(noteH) } : {}),
  } as CSSProperties;
  // The kind's name in the ribbon, as small as the ribbon is thin.
  const ribbonPx = Math.min(f.ribbon.h * height, Math.max(T.ribbonMin, base * T.ribbon));
  const showRibbon = !mini;
  const cls = [
    'gc',
    `gc-${spec.kind}`,
    frame !== null ? 'gc-framed' : 'gc-cssframe',
    mini ? 'gc-mini' : '',
    state !== null ? `gc-${state}` : '',
    selected === true ? 'gc-selected' : '',
    className ?? '',
  ]
    .filter((c) => c !== '')
    .join(' ');
  return (
    <div className={cls} style={{ width: px(width), height: px(mini ? height * CARD_MINI_CUT : height), fontSize: px(base) }}>
      {frame !== null ? (
        <img className="gc-frame" src={frame} alt="" draggable={false} style={mini ? { height: px(height) } : undefined} />
      ) : (
        <span className="gc-frame-css" aria-hidden="true" style={mini ? { height: px(height), bottom: 'auto' } : undefined} />
      )}
      <span className="gc-art" style={box(f.art)}>
        <CardPicture id={id} />
      </span>
      {!mini && (
        <span className="gc-name" style={box(f.name)}>
          <b style={{ fontSize: px(namePx) }}>{name}</b>
        </span>
      )}
      {showRibbon && (
        <span className="gc-ribbon" style={{ ...box(f.ribbon), fontSize: px(ribbonPx) }}>
          {CARD_KIND_LABEL[spec.kind]}
        </span>
      )}
      {!mini && (
        <span className="gc-text" style={textStyle}>
          <span className="gc-text-body">{body}</span>
          {pills && (
            <span className="gc-keys" style={{ fontSize: px(keyPx) }}>
              {keywords.map((k) => (
                <i key={k}>{k}</i>
              ))}
            </span>
          )}
        </span>
      )}
      <span
        className={`gc-cost${costCls}`}
        style={{ left: px(f.cost.cx * width - gem / 2), top: px(f.cost.cy * height - gem / 2), width: px(gem), height: px(gem) }}
        aria-label={printed === null ? '각인' : `내구도 ${cost}`}
      >
        {printed === null ? '각' : cost}
      </span>
      {hasNote && (
        <span className="gc-note" style={{ top: px((f.text.y + f.text.h) * height - noteH), fontSize: px(notePx) }}>
          {note}
        </span>
      )}
      {count !== undefined && count > 1 && <span className="gc-count">×{count}</span>}
      {children}
    </div>
  );
}

/** A small picture chip with the cost bubble, for list rows (작업대, 준비, 원정의 덱). */
export function CardThumb({ id, cost }: { id: CardId; cost?: number }) {
  const spec = CARDS[id];
  const shown = spec.cost === null ? '각' : (cost ?? spec.cost);
  return (
    <span className={`gc-thumb gc-${spec.kind}`} aria-hidden="true">
      <span className="gc-thumb-art">
        <CardPicture id={id} />
      </span>
      <span className="gc-thumb-cost">{shown}</span>
    </span>
  );
}

/** A row of small cards (the card's top, its name under it) with their counts, scrolling sideways: a deck at a glance. */
export function CardStrip({ cards, tier = 1, width = 70, label }: { cards: readonly { id: CardId; count: number }[]; tier?: number; width?: number; label: string }) {
  return (
    <div className="gc-strip" role="list" aria-label={label}>
      {cards.map(({ id, count }) => (
        <div key={id} className="gc-strip-item" role="listitem" style={{ width }}>
          <GameCard id={id} tier={tier} width={width} variant="mini" count={count} />
          <span className="gc-strip-name">{cardName(id, tier)}</span>
        </div>
      ))}
    </div>
  );
}
