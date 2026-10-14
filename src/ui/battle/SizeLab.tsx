// [검증] 크기 panel (실험): how big the fighters are drawn, tried live on the field. A small chip in the
// field's corner opens three sliders (용사, 몬스터, 보스, times layout.ts FIGHTER_SIZE's unit) and a
// 기본값 button; the field redraws at once and the sizes stay on this device (feel.ts). Only the
// show changes (CLAUDE.md 규칙 2): the fight is the same at any size. When a size is settled, it goes
// into FIGHTER_SIZE and this panel can go.

import { type MutableRefObject, useCallback, useEffect, useState } from 'react';
import { FIGHTER_SIZE, FIGHTER_SIZE_RANGE, type FighterSize } from '../../render/battle/layout.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import { loadFighterSize, saveFighterSize } from './feel.ts';

const ROWS: readonly (readonly [keyof FighterSize, string])[] = [
  ['hero', '용사'],
  ['enemy', '몬스터'],
  ['boss', '보스'],
];

/** The sizes this device uses, handed to the scene as soon as it is up and whenever they change. */
export function useFighterSize(sceneRef: MutableRefObject<BattleScene | null>, sceneUp: boolean): [FighterSize, (s: FighterSize) => void] {
  const [sizes, setSizes] = useState<FighterSize>(FIGHTER_SIZE);
  useEffect(() => {
    let on = true;
    void loadFighterSize().then((s) => {
      if (on) setSizes(s);
    });
    return () => {
      on = false;
    };
  }, []);
  useEffect(() => {
    if (sceneUp) sceneRef.current?.setSizes(sizes);
  }, [sizes, sceneUp, sceneRef]);
  const set = useCallback((s: FighterSize) => {
    setSizes(s);
    saveFighterSize(s);
  }, []);
  return [sizes, set];
}

export function SizeLab(props: { sizes: FighterSize; onChange(s: FighterSize): void }) {
  const [open, setOpen] = useState(false);
  const s = props.sizes;
  const same = ROWS.every(([k]) => s[k] === FIGHTER_SIZE[k]);
  return (
    <div className={`bt-size${open ? ' open' : ''}`}>
      <button type="button" className="bt-size-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        크기
      </button>
      {open && (
        <div className="bt-size-panel" role="group" aria-label="캐릭터 크기 (실험)">
          {ROWS.map(([k, label]) => (
            <label key={k} className="bt-size-row">
              <span>{label}</span>
              <input
                type="range"
                min={FIGHTER_SIZE_RANGE.min}
                max={FIGHTER_SIZE_RANGE.max}
                step={FIGHTER_SIZE_RANGE.step}
                value={s[k]}
                onChange={(e) => props.onChange({ ...s, [k]: Math.round(Number(e.target.value) * 100) / 100 })}
              />
              <b>×{s[k].toFixed(2)}</b>
            </label>
          ))}
          <button type="button" className="bt-size-reset" disabled={same} onClick={() => props.onChange(FIGHTER_SIZE)}>
            기본값
          </button>
        </div>
      )}
    </div>
  );
}
