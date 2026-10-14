// The battle's box (기획서 6장, 8.2): the PixiJS field (render/battle/scene.ts, loaded on demand) sized
// to its box, handed up to the screen that drives it. The screen decides what to play; this box only
// keeps the scene alive while it is shown.

import { type MutableRefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FighterSize } from '../../render/battle/layout.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import type { Cue } from '../../render/battle/timeline.ts';

const sceneModule = import('../../render/battle/scene.ts');
sceneModule.catch(() => undefined);

export function BattleField(props: {
  reduced: boolean;
  sceneRef: MutableRefObject<BattleScene | null>;
  onReady(): void;
  onCue(cue: Cue): void;
  paused?: boolean;
  /** How big the fighters are drawn when the scene is made (SizeLab keeps them in step after). */
  sizes?: FighterSize;
  children?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const cb = useRef(props);
  cb.current = props;
  const sizeRef = useRef(size);
  sizeRef.current = size;

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
    let made: BattleScene | null = null;
    const host = canvasRef.current;
    if (host === null) return;
    sceneModule
      .then((m) => m.createBattleScene(host, sizeRef.current.w, sizeRef.current.h, { reducedMotion: cb.current.reduced, onCue: (c) => cb.current.onCue(c), sizes: cb.current.sizes }))
      .then((scene) => {
        made = scene;
        if (cancelled) {
          scene.destroy();
          return;
        }
        cb.current.sceneRef.current = scene;
        setReady(true);
        cb.current.onReady();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (made !== null) made.destroy();
      if (cb.current.sceneRef.current === made) cb.current.sceneRef.current = null;
      setReady(false);
    };
  }, [hasSize, props.reduced]);

  useEffect(() => {
    if (hasSize) props.sceneRef.current?.resize(size.w, size.h);
  }, [size, hasSize, props.sceneRef]);

  useEffect(() => {
    props.sceneRef.current?.pause(props.paused === true);
  }, [props.paused, props.sceneRef, ready]);

  return (
    <div ref={hostRef} className={`bt-field${ready ? ' ready' : ''}`}>
      <div ref={canvasRef} className="bt-canvas" aria-hidden="true" />
      {!ready && !failed && <p className="bt-loading">들판으로 나가는 중…</p>}
      {failed && <p className="bt-loading">전투 장면을 그리지 못했다.</p>}
      {props.children}
    </div>
  );
}
