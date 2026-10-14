// 마을 지도의 손가락 연결 (기획서 9.1): the map's listeners on the page, and taking them all off
// again. The map box takes every finger (its name tags included) and passes them on as plain
// numbers; whether a touch is a tap or a drag is camera.ts's makeGesture. One more thing lives here:
// the browser's own click after a finger lifts off the map would land on whatever the touch just
// opened (a sheet's backdrop would close it at once), so the click that follows a touch the map
// took is dropped, once, within CLICK_DROP_MS. No PixiJS: tested with plain EventTargets.

/** A finger on the map: its pointer id, where it is (CSS px in the map box) and when (ms). */
export interface TownPointer {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface TownInputHandlers {
  /** A finger down, and the name tag it went down on (its data-tap), if any. */
  down(p: TownPointer, tag: string | null): void;
  move(p: TownPointer): void;
  /** The finger lifted. True when the map took the touch (a tap or a drag): the click after it is dropped. */
  up(p: TownPointer): boolean;
  cancel(id: number): void;
  /**
   * A mouse wheel or a trackpad (desktop testing; phones drag and pinch), CSS px. With ctrl held (a
   * trackpad pinch comes as that) it zooms round `at` (CSS px in the map box); otherwise `at` is null.
   */
  wheel(dx: number, dy: number, at: { x: number; y: number } | null): void;
}

export interface TownInputOptions {
  /** The map box: it takes the fingers. */
  readonly input: EventTarget;
  /** The window: the click after a touch the map took is caught there, before anything else sees it. */
  readonly win: EventTarget;
  /** A pointer's (or a wheel's) place in the map box (CSS px). */
  local(e: MouseEvent): { x: number; y: number };
  /** The name tag under a pointer (its data-tap), or null. */
  tagOf(e: Event): string | null;
  /** Keeps a finger's moves coming to the map box even when it leaves it. */
  capture?(id: number): void;
}

/** The click that follows a touch the map took is dropped within this long (ms) after it lifted. */
export const CLICK_DROP_MS = 800;

/** Puts the map's listeners on; the function returned takes every one of them off. */
export function attachTownInput(o: TownInputOptions, h: TownInputHandlers): () => void {
  const at = (e: PointerEvent): TownPointer => {
    const p = o.local(e);
    return { id: e.pointerId, x: p.x, y: p.y, t: e.timeStamp };
  };
  let ownClick = -Infinity;
  const onDown = (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.pointerType === 'mouse' && pe.button !== 0) return;
    try {
      o.capture?.(pe.pointerId);
    } catch {
      // a synthetic pointer
    }
    h.down(at(pe), o.tagOf(e));
  };
  const onMove = (e: Event) => h.move(at(e as PointerEvent));
  const onUp = (e: Event) => {
    if (h.up(at(e as PointerEvent))) ownClick = e.timeStamp;
  };
  const onCancel = (e: Event) => h.cancel((e as PointerEvent).pointerId);
  const onWheel = (e: Event) => {
    const we = e as WheelEvent;
    e.preventDefault();
    h.wheel(we.deltaX, we.deltaY, we.ctrlKey ? o.local(we) : null);
  };
  // Any new touch anywhere: the click that comes after it is its own.
  const onAnyDown = () => {
    ownClick = -Infinity;
  };
  const onAnyClick = (e: Event) => {
    // A keyboard's click (detail 0) is never a finger's.
    if ((e as MouseEvent).detail === 0 || e.timeStamp - ownClick > CLICK_DROP_MS) return;
    ownClick = -Infinity;
    e.stopPropagation();
    e.preventDefault();
  };
  const on: [EventTarget, string, (e: Event) => void, AddEventListenerOptions | boolean | undefined][] = [
    [o.win, 'pointerdown', onAnyDown, true],
    [o.win, 'click', onAnyClick, true],
    [o.input, 'pointerdown', onDown, undefined],
    [o.input, 'pointermove', onMove, undefined],
    [o.input, 'pointerup', onUp, undefined],
    [o.input, 'pointercancel', onCancel, undefined],
    [o.input, 'lostpointercapture', onCancel, undefined],
    [o.input, 'wheel', onWheel, { passive: false }],
  ];
  for (const [target, type, fn, opt] of on) target.addEventListener(type, fn, opt);
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    for (const [target, type, fn, opt] of on) target.removeEventListener(type, fn, typeof opt === 'boolean' ? opt : undefined);
  };
}
