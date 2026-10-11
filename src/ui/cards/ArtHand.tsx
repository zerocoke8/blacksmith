// The hand as a fan of real cards (슬레이 더 스파이어처럼). Tap lifts a card and shows what it
// would do; tap it again, or drag it up onto the scene, to play it. Long press opens the card.
// Played cards fly to the anvil and on to their pile (a 소멸 card burns away there); at 다시 달구기
// the hand flies to the 버린 더미 and the new hand is dealt from the 뽑을 더미. Which cards were
// played and which pile they went to is read from the engine state, never worked out here.

import { type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardCraftState, HandCardView } from '../../sim/cards/index.ts';
import type { CardId } from '../../sim/data/cards.ts';
import { CARD_ASPECT, CARD_FLIGHT, HAND_FAN } from '../../render/forge/layout.ts';
import { fanPlaces, handCardWidth, shownWidths } from './fan.ts';
import { GameCard, type GameCardState } from './GameCard.tsx';
import { LONG_PRESS_MS } from './parts.tsx';

export interface HandApi {
  /**
   * The player is playing this card: remember where it is. It flies once the engine has played
   * it (a play the host refuses leaves it in the hand, unmoved).
   */
  launch(uid: string): void;
}

export type PileKind = 'draw' | 'discard' | 'exhaust';

interface Props {
  views: HandCardView[];
  craft: CardCraftState;
  active: boolean;
  selected: string | null;
  onSelect(uid: string | null): void;
  onPlay(v: HandCardView): void;
  onInfo(uid: string): void;
  onDrag(uid: string | null): void;
  apiRef: MutableRefObject<HandApi | null>;
  pileEl(kind: PileKind): HTMLElement | null;
  /** Where a played card flies to and hovers (its centre, and its most height) while the blow lands, viewport coordinates. */
  target(): { x: number; y: number; maxH: number } | null;
  /** The tallest the lifted card may be (the gauge band over the hand rises only so far: tableLayout.ts). */
  liftMaxH: number;
  reduced: boolean;
}

/** Where a card was on screen: its centre, turn and size (px, as drawn). */
interface Seen {
  cx: number;
  cy: number;
  rot: number;
  w: number;
}

interface Flight {
  id: number;
  uid: string;
  card: CardId;
  view: HandCardView | null;
  from: Seen;
  /** 'play': to the anvil, then to its pile. 'throw': straight to its pile (다시 달구기). */
  mode: 'play' | 'throw';
  delay: number;
}

function cardStateOf(v: HandCardView): GameCardState {
  if (v.block !== null) return 'blocked';
  if (v.finishes) return 'finish';
  if (v.breaks) return 'breaks';
  return null;
}

function noteOf(v: HandCardView, durability: number): string | null {
  if (v.block !== null) return v.block;
  if (v.finishes) return v.cost > durability ? '막타 · 이 한 방으로 완성' : '이 한 방으로 완성';
  if (v.breaks) return '내면 쇠가 갈라진다';
  return null;
}

/** Which side the tip lines up with, for a card centred at cx in a hand w wide. */
function tipSide(cx: number, w: number): string {
  if (cx < HAND_FAN.tipW / 2 + 4) return ' left';
  if (cx > w - HAND_FAN.tipW / 2 - 4) return ' right';
  return '';
}

function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const LIFT_EASE = 'cubic-bezier(0.2, 0.8, 0.25, 1)';

export function ArtHand(props: Props) {
  const { views, craft, active, selected, onSelect, onPlay, onInfo, onDrag, apiRef, pileEl, target, liftMaxH, reduced } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ uid: string; x: number; y: number; ready: boolean } | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  const seen = useRef(new Map<string, Seen>());
  const prevHand = useRef<string[]>(craft.hand);
  const prevLog = useRef(craft.log.length);
  const prevDiscard = useRef<string[]>(craft.discard);
  const prevSelected = useRef<string | null>(selected);
  /** Cards the player has just played, where they were when tapped (they fly once the engine has played them). */
  const pending = useRef(new Map<string, { from: Seen; view: HandCardView | null }>());
  const flightId = useRef(0);
  const press = useRef<{ uid: string; x0: number; y0: number; moved: boolean; long: boolean; timer: number | null } | null>(null);
  const craftRef = useRef(craft);
  craftRef.current = craft;

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el === null) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A long press still waiting when the hand goes away must not open a sheet afterwards.
  useEffect(
    () => () => {
      const p = press.current;
      if (p !== null && p.timer !== null) window.clearTimeout(p.timer);
      press.current = null;
    },
    [],
  );

  const bw = box.w || 360;
  const bh = box.h || 240;
  const cw = handCardWidth(bw, bh, views.length);
  const ch = cw / CARD_ASPECT;
  const selIndex = selected === null ? -1 : views.findIndex((v) => v.uid === selected);
  const places = fanPlaces(views.length, bw, bh, cw, selIndex, liftMaxH);
  // How much of each resting card shows from under the next (its text keeps to that strip). Taken
  // from the fan at rest, so the text does not rewrap when a card is lifted and its neighbours step aside.
  const shown = shownWidths(selIndex >= 0 ? fanPlaces(views.length, bw, bh, cw, -1, liftMaxH) : places);

  const measureCard = (uid: string): Seen | null => {
    const el = cardEls.current.get(uid);
    if (el === undefined) return seen.current.get(uid) ?? null;
    const c = centerOf(el);
    const i = views.findIndex((v) => v.uid === uid);
    const p = places[i];
    const dragging = drag?.uid === uid;
    const w = p?.w ?? cw;
    return { cx: c.x, cy: c.y, rot: dragging ? 0 : (p?.rot ?? 0), w: dragging ? w * 1.08 : w };
  };

  apiRef.current = {
    launch: (uid) => {
      if (reduced) return;
      const from = measureCard(uid);
      if (from === null) return;
      pending.current.set(uid, { from, view: views.find((x) => x.uid === uid) ?? null });
    },
  };

  // After each render: remember where every card is (for the flights), fly the cards the engine
  // played and those that left the hand without being played (다시 달구기), deal in the new ones,
  // and grow or shrink the card that was lifted or put back.
  useLayoutEffect(() => {
    const now = craft.hand;
    const before = prevHand.current;
    const engineMoved = craft.log.length !== prevLog.current || now !== before;
    const fresh = craft.log.slice(prevLog.current);
    const reheated = fresh.some((e) => e.kind === 'reheat');
    const played = new Set(fresh.flatMap((e) => (e.kind === 'play' ? [e.uid] : [])));
    if (engineMoved) {
      const add: Flight[] = [];
      for (const uid of played) {
        const p = pending.current.get(uid);
        const card = craft.cards[uid];
        const from = p?.from ?? seen.current.get(uid);
        if (reduced || from === undefined || card === undefined) continue;
        add.push({ id: ++flightId.current, uid, card, view: p?.view ?? null, from, mode: 'play', delay: 0 });
      }
      // Played by the engine or refused: either way these taps are settled.
      pending.current.clear();
      const gone = before.filter((u) => !now.includes(u) && !played.has(u));
      if (!reduced) {
        gone.forEach((uid, i) => {
          const from = seen.current.get(uid);
          const card = craft.cards[uid];
          if (from === undefined || card === undefined) return;
          add.push({ id: ++flightId.current, uid, card, view: null, from, mode: 'throw', delay: i * 45 });
        });
      }
      if (add.length > 0) setFlights((f) => [...f, ...add]);
    }
    // Deal the new cards from the pile they came from.
    const added = now.filter((u) => !before.includes(u));
    if (added.length > 0 && !reduced && box.w > 0) {
      const boxRect = boxRef.current?.getBoundingClientRect();
      added.forEach((uid, k) => {
        const el = cardEls.current.get(uid);
        const i = now.indexOf(uid);
        const p = places[i];
        if (el === undefined || boxRect === undefined || p === undefined) return;
        const fromDiscard = prevDiscard.current.includes(uid);
        const pile = pileEl(fromDiscard ? 'discard' : 'draw');
        const pc = pile !== null ? centerOf(pile) : { x: boxRect.left + box.w * 0.08, y: boxRect.bottom };
        const dx = pc.x - (boxRect.left + p.x + p.w / 2);
        const dy = pc.y - (boxRect.top + p.y + p.h * 0.85);
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) rotate(-20deg) scale(0.3)`, opacity: 0 },
            { transform: `rotate(${p.rot}deg)`, opacity: 1 },
          ],
          {
            duration: CARD_FLIGHT.deal,
            delay: (reheated ? 260 : 0) + k * CARD_FLIGHT.dealStagger,
            easing: 'cubic-bezier(.2,.8,.25,1)',
            fill: 'backwards',
          },
        );
      });
    }
    // Lifted or put back: the card is laid out at its new size at once; play the change from
    // how it looked (FLIP), in step with the slot's own move (art.css .ah-slot transition).
    const was = prevSelected.current;
    if (was !== selected && !reduced) {
      for (const uid of [was, selected]) {
        if (uid === null) continue;
        const el = cardEls.current.get(uid);
        const old = seen.current.get(uid);
        const i = views.findIndex((v) => v.uid === uid);
        const p = places[i];
        if (el === undefined || old === undefined || p === undefined || Math.abs(old.w - p.w) < 1) continue;
        const k = old.w / p.w;
        const oldH = old.w / CARD_ASPECT;
        // The slot starts its move from where it was; the card is anchored at its bottom middle.
        el.animate(
          [
            { transform: `translate(${(old.w - p.w) / 2}px, ${oldH - p.h}px) rotate(${old.rot}deg) scale(${k})` },
            { transform: `rotate(${p.rot}deg) scale(1)` },
          ],
          { duration: HAND_FAN.liftMs, easing: LIFT_EASE },
        );
      }
    }
    prevSelected.current = selected;
    prevHand.current = now;
    prevLog.current = craft.log.length;
    prevDiscard.current = craft.discard;
    // Where each card is now.
    const map = new Map<string, Seen>();
    views.forEach((v, i) => {
      const el = cardEls.current.get(v.uid);
      const p = places[i];
      if (el === undefined || p === undefined) return;
      const c = centerOf(el);
      map.set(v.uid, { cx: c.x, cy: c.y, rot: p.rot, w: p.w });
    });
    seen.current = map;
  });

  // ---- Pointer: tap, long press, drag up to play ----
  const clearPress = () => {
    const p = press.current;
    if (p !== null && p.timer !== null) window.clearTimeout(p.timer);
    press.current = null;
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>, v: HandCardView) => {
    if (!active || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    clearPress();
    const p = { uid: v.uid, x0: e.clientX, y0: e.clientY, moved: false, long: false, timer: null as number | null };
    p.timer = window.setTimeout(() => {
      p.long = true;
      p.timer = null;
      setDrag(null);
      onDrag(null);
      onInfo(v.uid);
    }, LONG_PRESS_MS);
    press.current = p;
  };

  const overScene = (y: number): boolean => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r === undefined) return false;
    return y < r.top + Math.min(r.height * 0.3, ch * 0.5) - HAND_FAN.playLinePx;
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>, v: HandCardView) => {
    const p = press.current;
    if (p === null || p.uid !== v.uid || p.long) return;
    if (!p.moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > HAND_FAN.dragPx) {
      p.moved = true;
      if (p.timer !== null) window.clearTimeout(p.timer);
      p.timer = null;
      onDrag(v.uid);
    }
    if (p.moved) setDrag({ uid: v.uid, x: e.clientX, y: e.clientY, ready: overScene(e.clientY) });
  };

  const up = (e: ReactPointerEvent<HTMLDivElement>, v: HandCardView) => {
    const p = press.current;
    clearPress();
    if (p === null || p.uid !== v.uid || p.long) return;
    if (p.moved) {
      const ready = overScene(e.clientY);
      setDrag(null);
      onDrag(null);
      if (!ready) return;
      if (v.block !== null) onInfo(v.uid);
      else onPlay(v);
      return;
    }
    // A tap.
    if (v.block !== null) {
      onInfo(v.uid);
      return;
    }
    if (selected === v.uid) onPlay(v);
    else onSelect(v.uid);
  };

  const cancel = () => {
    clearPress();
    setDrag(null);
    onDrag(null);
  };

  const boxRect = boxRef.current?.getBoundingClientRect();

  return (
    <div ref={boxRef} className={`ah-box${active ? '' : ' over'}`} role="group" aria-label="손패">
      {views.map((v, i) => {
        const p = places[i] as (typeof places)[number];
        const dragging = drag?.uid === v.uid && boxRect !== undefined;
        const x = dragging ? drag.x - boxRect.left - p.w / 2 : p.x;
        const y = dragging ? drag.y - boxRect.top - p.h * 0.62 : p.y;
        const slotStyle: CSSProperties = {
          width: p.w,
          height: p.h,
          transform: `translate(${x}px, ${y}px)`,
          zIndex: dragging ? 300 : p.z,
        };
        const cardStyle: CSSProperties = {
          transform: dragging ? 'rotate(0deg) scale(1.08)' : `rotate(${p.rot}deg)`,
        };
        return (
          <div
            key={v.uid}
            className={`ah-slot${dragging ? ' dragging' : ''}${dragging && drag.ready ? ' ready' : ''}${selected === v.uid ? ' lifted' : ''}`}
            style={slotStyle}
          >
            <div
              ref={(el) => {
                if (el === null) cardEls.current.delete(v.uid);
                else cardEls.current.set(v.uid, el);
              }}
              className="ah-card"
              style={cardStyle}
              role="button"
              tabIndex={0}
              aria-disabled={v.block !== null}
              aria-pressed={selected === v.uid}
              aria-label={`${v.name}, 내구도 ${v.cost}${v.block !== null ? `, ${v.block}` : ''}`}
              onPointerDown={(e) => down(e, v)}
              onPointerMove={(e) => move(e, v)}
              onPointerUp={(e) => up(e, v)}
              onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (v.block !== null) onInfo(v.uid);
                  else if (selected === v.uid) onPlay(v);
                  else onSelect(v.uid);
                }
              }}
            >
              <GameCard
                id={v.card}
                tier={craft.recipe.materialTier}
                width={p.w}
                cost={active ? v.cost : v.baseCost}
                name={v.name}
                text={v.shortText}
                state={active ? cardStateOf(v) : null}
                note={active ? noteOf(v, craft.durability) : null}
                selected={selected === v.uid}
                shown={selected === v.uid || dragging ? undefined : (shown[i] ?? p.w) / p.w}
                floor
              />
              {selected === v.uid && !dragging && (
                <span className={`ah-tip under${tipSide(p.x + p.w / 2, bw)}`}>한 번 더 누르거나 위로 끌어 올리면 낸다</span>
              )}
              {dragging && drag.ready && <span className="ah-tip ready">놓으면 낸다</span>}
            </div>
          </div>
        );
      })}
      {views.length === 0 && active && <p className="ah-empty">손이 비었다.</p>}
      <div className="ah-flights" aria-hidden="true">
        {flights.map((f) => (
          <FlyingCard
            key={f.id}
            flight={f}
            width={cw}
            tier={craft.recipe.materialTier}
            durability={craft.durability}
            target={target}
            pileEl={pileEl}
            whereIs={(uid) => (craftRef.current.exhausted.includes(uid) ? 'exhaust' : 'discard')}
            onDone={() => setFlights((list) => list.filter((x) => x.id !== f.id))}
          />
        ))}
      </div>
    </div>
  );
}

/** Ember sparks for a burning card: where they start (share of the card) and where they drift (px). */
const EMBERS = Array.from({ length: CARD_FLIGHT.embers }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  return {
    x: 0.5 + 0.42 * Math.cos(a) * ((i % 3) / 3 + 0.4),
    y: 0.5 + 0.45 * Math.sin(a) * ((i % 4) / 4 + 0.35),
    dx: Math.cos(a) * 18,
    dy: -40 - (i % 5) * 12,
    delay: (i % 6) * 55,
  };
});

function FlyingCard(props: {
  flight: Flight;
  width: number;
  tier: number;
  durability: number;
  target(): { x: number; y: number; maxH: number } | null;
  pileEl(kind: PileKind): HTMLElement | null;
  whereIs(uid: string): 'discard' | 'exhaust';
  onDone(): void;
}) {
  const { flight, width, tier, durability, target, pileEl, whereIs, onDone } = props;
  const ref = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const embersRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const h = width / CARD_ASPECT;
  const from = flight.from;

  useLayoutEffect(() => {
    const el = ref.current;
    const face = faceRef.current;
    if (el === null || face === null) return;
    const k0 = from.w / width;
    const start = `translate(${from.cx - width / 2}px, ${from.cy - h / 2}px) rotate(${from.rot}deg) scale(${k0})`;
    let alive = true;
    const anims: Animation[] = [];
    const finish = (a: Animation) => {
      a.onfinish = () => {
        if (alive) doneRef.current();
      };
    };
    const toPile = (at: string, delay: number) => {
      const dest = whereIs(flight.uid);
      if (dest === 'exhaust') {
        // 소멸: it chars from the edges in, with embers rising off it, then is gone.
        el.classList.add('burning');
        const burn = face.animate(
          [
            { filter: 'brightness(1) sepia(0) saturate(1)', maskSize: '260% 260%', webkitMaskSize: '260% 260%', offset: 0 },
            { filter: 'brightness(1.25) sepia(0.7) saturate(1.8)', maskSize: '170% 170%', webkitMaskSize: '170% 170%', offset: 0.3 },
            { filter: 'brightness(0.55) sepia(1) saturate(2.2)', maskSize: '0% 0%', webkitMaskSize: '0% 0%', offset: 1 },
          ] as Keyframe[],
          { duration: CARD_FLIGHT.burn, delay, easing: 'ease-in', fill: 'both' },
        );
        anims.push(burn);
        const rise = el.animate([{ transform: at }, { transform: `${at} translateY(-14px)` }], {
          duration: CARD_FLIGHT.burn,
          delay,
          easing: 'ease-out',
          fill: 'forwards',
        });
        anims.push(rise);
        const sparks = embersRef.current;
        if (sparks !== null) {
          sparks.querySelectorAll<HTMLElement>('.ah-ember').forEach((s, i) => {
            const e = EMBERS[i];
            if (e === undefined) return;
            const a = s.animate(
              [
                { opacity: 0, transform: 'translate(0, 0) scale(1)' },
                { opacity: 1, transform: `translate(${e.dx * 0.3}px, ${e.dy * 0.3}px) scale(1)`, offset: 0.25 },
                { opacity: 0, transform: `translate(${e.dx}px, ${e.dy}px) scale(0.4)` },
              ],
              { duration: CARD_FLIGHT.burn, delay: delay + e.delay, easing: 'ease-out', fill: 'both' },
            );
            anims.push(a);
          });
        }
        finish(burn);
        return;
      }
      const pile = pileEl(dest);
      const pc = pile !== null ? centerOf(pile) : { x: window.innerWidth - 40, y: window.innerHeight - 30 };
      const end: Keyframe = { transform: `translate(${pc.x - width / 2}px, ${pc.y - h / 2}px) rotate(28deg) scale(0.14)`, opacity: 0.25 };
      const a = el.animate([{ transform: at, opacity: 1 }, end], {
        duration: CARD_FLIGHT.toPile,
        delay,
        easing: 'cubic-bezier(.5,0,.75,.4)',
        fill: 'forwards',
      });
      anims.push(a);
      finish(a);
    };
    if (flight.mode === 'play') {
      // It hovers over the scene, clear of the iron (the blow must show), then leaves.
      const t = target() ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.25, maxH: h * 0.5 };
      const k = Math.max(0.3, Math.min(0.5, t.maxH / h));
      const mid = `translate(${t.x - width / 2}px, ${t.y - h / 2}px) rotate(0deg) scale(${k})`;
      const a = el.animate([{ transform: start }, { transform: mid }], {
        duration: CARD_FLIGHT.toScene,
        easing: 'cubic-bezier(.25,.75,.3,1)',
        fill: 'forwards',
      });
      anims.push(a);
      a.onfinish = () => {
        if (alive) toPile(mid, CARD_FLIGHT.hold);
      };
    } else {
      el.style.transform = start;
      toPile(start, flight.delay);
    }
    return () => {
      alive = false;
      for (const a of anims) a.cancel();
    };
    // One flight per mount.
  }, []);

  const v = flight.view;
  return (
    <div ref={ref} className="ah-flight" style={{ width, height: h }}>
      <div ref={faceRef} className="ah-flight-face">
        <GameCard
          id={flight.card}
          tier={tier}
          width={width}
          cost={v?.cost}
          name={v?.name}
          text={v?.shortText}
          note={v !== null ? noteOf(v, durability) : null}
          state={v !== null ? cardStateOf(v) : null}
          floor
        />
      </div>
      <div ref={embersRef} className="ah-embers">
        {EMBERS.map((e, i) => (
          <i key={i} className="ah-ember" style={{ left: `${e.x * 100}%`, top: `${e.y * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
