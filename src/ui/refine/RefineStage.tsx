// The refine screen's scene box: the PixiJS workshop (render/refine/scene.ts, loaded on demand)
// with a DOM layer on top for the finds. Each find pops off the lump on the anvil and lands on its
// spot on the floor round it (render/refine/layout.ts ITEM_SLOTS), its amount over it, heaped two or
// three high when the multiplier is big; when the batch is done they fly up into the bag or the gold
// in the top band. A rare find pops bigger with its name on a little tag; a very rare one rises over
// the anvil and hangs there, big, while he stops to look, then drops to its spot. The whole box
// shakes with a big find, finds and all. Positions come from render/refine/layout.ts, the numbers the scene uses.
// Everything shown is a result the engine already decided (CLAUDE.md 규칙 2).

import { type CSSProperties, type MutableRefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sceneArtUrl } from '../../render/forge/assets.ts';
import { itemArtUrl } from '../../render/refine/assets.ts';
import {
  amountFontPx,
  REFINE_ITEM_FX,
  REFINE_SHAKE,
  REFINE_SHOWCASE,
  type RefineLayout,
  refineLayout,
  stackOf,
} from '../../render/refine/layout.ts';
import type { RefineScene, StrikeFx } from '../../render/refine/scene.ts';
import { type RefineRarity, refineRow } from '../../sim/data/refine.ts';
import type { RefineDrop } from '../../sim/refine/index.ts';
import { amountLabel } from './text.ts';

export interface StageApi {
  strike(fx: StrikeFx): void;
  setHeld(held: boolean): void;
  shake(rarity: RefineRarity): void;
}

/** A find on the floor round the anvil, or on its way into the bag. */
export interface Find {
  key: number;
  drop: RefineDrop;
  /** Its spot (ITEM_SLOTS order). */
  slot: number;
  /** Set when the batch is done: it flies into the bag, the n-th of its batch. */
  fly: number | null;
  /** The flight it went with (set with fly), for the batch's '+n' on the bag and the gold. */
  group?: number;
}

interface Props {
  lumps: number;
  finds: Find[];
  say: { key: number; text: string } | null;
  reduced: boolean;
  apiRef: MutableRefObject<StageApi | null>;
  /** Where a find of this kind flies (viewport rect of the bag or the gold), null to fade where it is. */
  target(gold: boolean): DOMRect | null;
  /** A find reached the bag. */
  onArrive(key: number): void;
  /** The workshop scene is up. */
  onReady(): void;
  /** No scene (no WebGL): the stage stands still, the finds still come. */
  onUnavailable(): void;
}

/** Length of the small bounce a find makes as it lands (ms). */
const BOUNCE_MS = 200;

const tf = (x: number, y: number, s: number, r: number) =>
  `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${r.toFixed(1)}deg)`;

/** The squashy bounce on the floor, from offset `from` to 1. */
function bounceFrames(from: number): Keyframe[] {
  const b = (k: number) => from + (1 - from) * k;
  return [
    { offset: b(0.35), transform: 'translate(0px, 0px) scale(1.14, 0.84) rotate(0deg)' },
    { offset: b(0.7), transform: 'translate(0px, -5px) scale(0.96, 1.05) rotate(0deg)' },
    { offset: 1, transform: 'translate(0px, 0px) scale(1, 1) rotate(0deg)' },
  ];
}

/**
 * The pop-out: a parabola from (dx, dy) off the spot, up over and down onto it (lift px above the
 * straight line), swelling to `peak` × its size at the top of the arc, then one squashy bounce.
 */
function popFrames(dx: number, dy: number, lift: number, peak: number): Keyframe[] {
  const out: Keyframe[] = [];
  const land = REFINE_ITEM_FX.flyMs / (REFINE_ITEM_FX.flyMs + BOUNCE_MS);
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = dx * (1 - t);
    const y = dy * (1 - t) - lift * 4 * t * (1 - t);
    const grow = Math.min(1.1, 0.45 + 1.4 * t) - (t > 0.5 ? 0.2 * (t - 0.5) : 0);
    const s = grow + Math.max(0, peak - 1) * 4 * t * (1 - t);
    out.push({ offset: t * land, transform: tf(x, y, s, (1 - t) * -50) });
  }
  return [...out, ...bounceFrames(land)];
}

/**
 * A very rare find: up off the lump to (dx, dy - up) at `peak` × its size in riseMs, a little
 * wobble there for holdMs (he looks at it), then down onto its spot like any find.
 */
function showcaseFrames(dx: number, dy: number, up: number, peak: number, riseMs: number, holdMs: number): { frames: Keyframe[]; ms: number } {
  const ms = riseMs + holdMs + REFINE_ITEM_FX.flyMs + BOUNCE_MS;
  const at = (t: number) => t / ms;
  const hy = dy - up;
  const out: Keyframe[] = [
    { offset: 0, transform: tf(dx, dy, 0.45, -30), easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
    { offset: at(riseMs), transform: tf(dx, hy, peak, 0) },
    { offset: at(riseMs + holdMs * 0.3), transform: tf(dx, hy - 3, peak * 1.04, -5) },
    { offset: at(riseMs + holdMs * 0.65), transform: tf(dx, hy - 1, peak * 0.98, 4) },
    { offset: at(riseMs + holdMs), transform: tf(dx, hy, peak, 0) },
  ];
  // Down to its spot: a short hop up, then a fall, shrinking to its own size.
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = dx * (1 - t);
    const y = hy * (1 - t) - 18 * 4 * t * (1 - t);
    out.push({ offset: at(riseMs + holdMs + REFINE_ITEM_FX.flyMs * t), transform: tf(x, y, peak + (1 - peak) * t, 0) });
  }
  return { frames: [...out, ...bounceFrames(at(riseMs + holdMs + REFINE_ITEM_FX.flyMs))], ms };
}

export function RefineStage(props: Props) {
  const { apiRef, reduced } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RefineScene | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [measured, setMeasured] = useState<RefineLayout | null>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef(props);
  cb.current = props;
  const lumpsRef = useRef(props.lumps);
  lumpsRef.current = props.lumps;
  const findEls = useRef(new Map<number, HTMLDivElement>());
  const popped = useRef(new Set<number>());
  const flown = useRef(new Set<number>());
  /** The tag naming the latest rare find, and where it hangs. */
  const [tag, setTag] = useState<{ key: number; text: string; rarity: 'rare' | 'veryRare'; x: number; y: number } | null>(null);
  const tagTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (tagTimer.current !== null) window.clearTimeout(tagTimer.current);
    },
    [],
  );

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

  const fresh = measured !== null && Math.abs(measured.w - size.w) < 0.5 && Math.abs(measured.h - size.h) < 0.5;
  const L = fresh ? measured : refineLayout(size.w || 390, size.h || 560);
  const layoutRef = useRef(L);
  layoutRef.current = L;

  // The shake: the whole box, so the finds on the floor move with the room.
  const shake = (rarity: RefineRarity) => {
    const el = shakeRef.current;
    if (el === null || reduced) return;
    const { px, ms } = REFINE_SHAKE[rarity];
    el.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${px}px, ${-px * 0.6}px)` },
        { transform: `translate(${-px * 0.8}px, ${px * 0.5}px)` },
        { transform: `translate(${px * 0.5}px, ${px * 0.3}px)` },
        { transform: `translate(${-px * 0.25}px, 0)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: ms, easing: 'ease-out' },
    );
  };

  const hasSize = size.w > 0 && size.h > 0;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    if (!hasSize) return;
    let cancelled = false;
    const host = canvasRef.current;
    if (host === null) return;
    import('../../render/refine/scene.ts')
      .then((m) =>
        m.createRefineScene(host, sizeRef.current.w, sizeRef.current.h, {
          reducedMotion: reduced,
          onLayout: (l) => {
            if (!cancelled) setMeasured(l);
          },
        }),
      )
      .then((scene) => {
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        scene.setLumps(lumpsRef.current);
        cb.current.onReady();
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        cb.current.onUnavailable();
      });
    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [hasSize, reduced]);

  // The API works before the scene is up (or without it): the finds and the shake are the DOM's.
  useEffect(() => {
    apiRef.current = {
      strike: (fx) => sceneRef.current?.strike(fx),
      setHeld: (held) => sceneRef.current?.setHeld(held),
      shake,
    };
    return () => {
      apiRef.current = null;
    };
  });

  useEffect(() => {
    if (hasSize) sceneRef.current?.resize(size.w, size.h);
  }, [size, hasSize]);

  useEffect(() => {
    sceneRef.current?.setLumps(props.lumps);
  }, [props.lumps]);

  // A new find pops off the lump and lands on its spot; a find set to fly goes into the bag.
  useLayoutEffect(() => {
    const keys = new Set(props.finds.map((f) => f.key));
    for (const k of popped.current) if (!keys.has(k)) popped.current.delete(k);
    for (const k of flown.current) if (!keys.has(k)) flown.current.delete(k);
    const l = layoutRef.current;
    for (const f of props.finds) {
      const el = findEls.current.get(f.key);
      if (el === undefined) continue;
      const spot = l.slots[f.slot % l.slots.length] ?? { x: l.hit.x, y: l.hit.y };
      if (!popped.current.has(f.key)) {
        popped.current.add(f.key);
        const pic = el.querySelector<HTMLElement>('.rf-find-pic');
        const amt = el.querySelector<HTMLElement>('.rf-find-amt');
        const rarity = f.drop.rarity;
        const show = rarity === 'rare' || rarity === 'veryRare' ? REFINE_SHOWCASE[rarity] : null;
        if (show !== null && (rarity === 'rare' || rarity === 'veryRare')) {
          // Its name on a little tag: over the lump for a rare one; under a very rare one where it
          // hangs (over it is where he speaks his line).
          const hang = l.hit.y - show.up * l.item;
          const tagY = rarity === 'veryRare' ? hang + (l.item * show.scale) / 2 + 4 : l.hit.y - l.item * 0.6 - 10;
          const name = refineRow(f.drop.item).name;
          const key = f.key;
          if (tagTimer.current !== null) window.clearTimeout(tagTimer.current);
          setTag({ key, text: rarity === 'veryRare' ? `${name}!` : name, rarity, x: l.hit.x, y: Math.max(16, tagY) });
          tagTimer.current = window.setTimeout(() => {
            tagTimer.current = null;
            setTag((t) => (t?.key === key ? null : t));
          }, show.tagMs);
        }
        if (reduced) {
          pic?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REFINE_ITEM_FX.reducedMs, fill: 'both' });
          amt?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REFINE_ITEM_FX.reducedMs, fill: 'both' });
        } else {
          const dx = l.hit.x - spot.x;
          const dy = l.hit.y - spot.y;
          let landMs: number = REFINE_ITEM_FX.flyMs;
          if (rarity === 'veryRare' && show !== null) {
            const sc = showcaseFrames(dx, dy, show.up * l.item, show.scale, show.riseMs, show.holdMs);
            // Over every other find while it hangs there.
            el.style.zIndex = '5';
            const a = pic?.animate(sc.frames, { duration: sc.ms, easing: 'linear', fill: 'both' });
            a?.finished.then(
              () => {
                el.style.zIndex = '';
              },
              () => undefined,
            );
            landMs = show.riseMs + show.holdMs + REFINE_ITEM_FX.flyMs;
          } else {
            const lift = Math.max(l.item * REFINE_ITEM_FX.arc, -Math.min(dy, 0) * 0.35 + l.item);
            pic?.animate(popFrames(dx, dy, lift, show?.scale ?? 1), { duration: REFINE_ITEM_FX.flyMs + BOUNCE_MS, easing: 'linear', fill: 'both' });
          }
          // The amount pops over it as it lands.
          amt?.animate(
            [
              { opacity: 0, transform: 'translate(-50%, 6px) scale(0.6)' },
              { opacity: 1, transform: 'translate(-50%, -2px) scale(1.15)', offset: 0.6 },
              { opacity: 1, transform: 'translate(-50%, 0) scale(1)' },
            ],
            { duration: 240, delay: landMs * 0.85, fill: 'both' },
          );
        }
      }
      if (f.fly !== null && !flown.current.has(f.key)) {
        flown.current.add(f.key);
        const key = f.key;
        const to = cb.current.target(refineRow(f.drop.item).kind === 'gold');
        const box = hostRef.current?.getBoundingClientRect();
        const done = () => cb.current.onArrive(key);
        if (reduced || to === null || box === undefined) {
          const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REFINE_ITEM_FX.reducedMs, fill: 'forwards' });
          a.onfinish = done;
          continue;
        }
        const tx = to.left + to.width / 2 - (box.left + spot.x);
        const ty = to.top + to.height / 2 - (box.top + spot.y);
        const a = el.animate(
          [
            { transform: 'translate(0, 0) scale(1)', opacity: 1, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' },
            { transform: `translate(${tx * 0.08}px, ${ty * 0.04 - 18}px) scale(1.12)`, opacity: 1, offset: 0.18 },
            { transform: `translate(${tx}px, ${ty}px) scale(0.38)`, opacity: 0.9 },
          ],
          { duration: REFINE_ITEM_FX.collectMs, delay: f.fly * REFINE_ITEM_FX.stagger, fill: 'forwards' },
        );
        a.onfinish = done;
      }
    }
  }, [props.finds, reduced]);

  const bg = sceneArtUrl('bg_workshop');
  const dwarfUrl = sceneArtUrl('dwarf_idle');
  const anvilUrl = sceneArtUrl('anvil');

  return (
    <div ref={hostRef} className="rf-stage" style={bg !== null ? ({ '--rf-bg': `url("${bg}")` } as CSSProperties) : undefined}>
      <div ref={shakeRef} className="rf-shake">
        <div ref={canvasRef} className="rf-canvas" aria-hidden="true" />
        {failed && (
          // No WebGL: the dwarf and the anvil stand still; the finds still come.
          <div className="rf-still" aria-hidden="true">
            {dwarfUrl !== null && (
              <img src={dwarfUrl} alt="" draggable={false} style={{ left: L.dwarf.x - L.dwarf.bodyH * 0.46, top: L.dwarf.y - L.dwarf.bodyH, height: L.dwarf.bodyH }} />
            )}
            {anvilUrl !== null && (
              <img src={anvilUrl} alt="" draggable={false} style={{ left: L.anvil.x, top: L.anvil.y, width: L.anvil.w, height: L.anvil.h }} />
            )}
          </div>
        )}
        <div className="rf-finds" aria-hidden="true">
          {props.finds.map((f) => {
            const spot = L.slots[f.slot % L.slots.length] ?? { x: L.hit.x, y: L.hit.y };
            const url = itemArtUrl(f.drop.item);
            const label = amountLabel(f.drop);
            const stack = url !== null ? stackOf(f.drop.mult) : 1;
            return (
              <div
                key={f.key}
                ref={(el) => {
                  if (el === null) findEls.current.delete(f.key);
                  else findEls.current.set(f.key, el);
                }}
                className={`rf-find rf-r-${f.drop.rarity}${f.fly !== null ? ' flying' : ''}`}
                style={{ left: spot.x - L.item / 2, top: spot.y - L.item / 2, width: L.item, height: L.item }}
              >
                <span className="rf-find-spot" />
                <span className={`rf-find-pic${stack > 1 ? ` rf-stack-${stack}` : ''}`}>
                  {url !== null && stack >= 3 && <img className="rf-stack-b" src={url} alt="" draggable={false} />}
                  {url !== null && stack >= 2 && <img className="rf-stack-a" src={url} alt="" draggable={false} />}
                  {url !== null ? (
                    <img className="rf-stack-main" src={url} alt="" draggable={false} />
                  ) : (
                    <i className="rf-find-standin">{refineRow(f.drop.item).name.slice(0, 1)}</i>
                  )}
                </span>
                {(f.drop.rarity === 'rare' || f.drop.rarity === 'veryRare') && <span className="rf-find-star">✦</span>}
                {label !== '' && (
                  <b className="rf-find-amt" style={{ fontSize: `${amountFontPx(L.item, label).toFixed(1)}px` }}>
                    {label}
                  </b>
                )}
              </div>
            );
          })}
        </div>
        {tag !== null && (
          <div key={tag.key} className={`rf-tag rf-r-${tag.rarity}`} style={{ left: tag.x, top: tag.y }} aria-hidden="true">
            {tag.text}
          </div>
        )}
        {props.say !== null && (
          <div
            key={props.say.key}
            className="rf-say"
            style={{ left: L.bubble.x, top: L.bubble.y, maxWidth: L.bubble.maxW }}
            role="status"
          >
            {props.say.text}
          </div>
        )}
      </div>
    </div>
  );
}
