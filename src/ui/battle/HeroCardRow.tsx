// 전투 화면의 용사 카드 줄 (사용자 결정 2026-10-14, 예시 사진의 기능을 낙서풍으로): one card per hero
// under the field, in formation order — the hero's face on its evolution colour (as on the hero
// cards, heroes.css), its HP as the field shows it, its signature gauge, its name. A full gauge makes
// the card glow and pulse gently (the glow stays still with reduced motion); a tap fires the
// signature (live.ts order); a doodle flame ring (Codex, ui/ult_ready) burns round it while it is
// ready. A hero without a signature shows a dimmed empty gauge. On the right, the round 자동 button
// (the signatures go off by themselves; the loop-arrow icon) and the playback speed (fast-forward).
// The cards read the feed every frame (cardFeed.ts) and redraw only when they would look different.

import { type CSSProperties, useEffect, useState } from 'react';
import { battleUiUrl, heroArtUrl, iconUrl } from '../../render/battle/assets.ts';
import { EVOLUTION_LABEL } from '../../sim/data/heroes.ts';
import { type CardFeed, type CardLook, cardLook, sameLook } from './cardFeed.ts';
import { DEFAULT_FACE, type FaceCut, loadFace } from './face.ts';
import type { CardHero } from './show.ts';
import './herorow.css';

/** The face cut from the hero's picture, mirrored to look right (toward the monsters). */
function Face(props: { heroKey: string }) {
  const url = heroArtUrl(props.heroKey);
  const [cut, setCut] = useState<FaceCut | null>(null);
  useEffect(() => {
    if (url === null) return;
    let on = true;
    void loadFace(url).then((c) => {
      if (on) setCut(c);
    });
    return () => {
      on = false;
    };
  }, [url]);
  const f = cut ?? DEFAULT_FACE;
  const style: CSSProperties = {
    height: `${(100 / f.size).toFixed(2)}%`,
    top: `${((-100 * f.top) / f.size).toFixed(2)}%`,
    transform: `translateX(${(-100 * (1 - f.cx)).toFixed(2)}%) scaleX(-1)`,
  };
  return (
    <span className="bc-face" aria-hidden="true">
      {url !== null && <img src={url} alt="" draggable={false} style={style} className={cut === null ? 'wait' : undefined} />}
    </span>
  );
}

const FLAME = battleUiUrl('ult_ready');
const AUTO_ICON = iconUrl('ui_auto');
const SPEED_ICON = iconUrl('ui_speed');

function looksOf(heroes: readonly CardHero[], feed: CardFeed): CardLook[] {
  return heroes.map((h) => cardLook(h, feed));
}

export function HeroCardRow(props: {
  heroes: readonly CardHero[];
  feed: CardFeed;
  /** AUTO: the signatures go off by themselves. */
  auto: boolean;
  onAuto(): void;
  speed: number;
  onSpeed(): void;
  /** Tapped a ready card (after the play has it): a sound, a buzz. */
  onFire?(id: string): void;
}) {
  const { heroes, feed } = props;
  const [looks, setLooks] = useState<CardLook[]>(() => looksOf(heroes, feed));
  useEffect(() => {
    let id = 0;
    let last: CardLook[] = [];
    const frame = () => {
      const next = looksOf(heroes, feed);
      if (!sameLook(next, last)) {
        last = next;
        setLooks(next);
      }
      id = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(id);
  }, [heroes, feed]);

  const fire = (h: CardHero, look: CardLook | undefined) => {
    if (look === undefined || !look.ready) return;
    feed.play?.order(h.id);
    if (feed.gauge(h.id).ordered) props.onFire?.(h.id);
  };

  return (
    <div className="bc-row">
      <div className="bc-cards" style={{ '--bc-n': Math.max(5, heroes.length) } as CSSProperties}>
        {heroes.map((h, i) => {
          const look = looks[i];
          const ready = look?.ready === true;
          const cls = [
            'bc-card',
            `hc-${h.color}`,
            h.special ? 'special' : '',
            h.signature ? '' : 'nosig',
            ready ? 'ready' : '',
            look?.ordered === true ? 'ordered' : '',
            look?.down === true ? 'down' : '',
            (look?.hp ?? 1) <= 0.3 ? 'low' : '',
          ]
            .filter((c) => c !== '')
            .join(' ');
          const sig = !h.signature ? '필살기 없음' : ready ? '필살기 준비됨, 누르면 쓴다' : look?.ordered === true ? '필살기 쓰는 중' : `필살기 ${Math.round((look?.gauge ?? 0) * 100)}%`;
          return (
            <button
              key={h.id}
              type="button"
              className={cls}
              aria-disabled={!ready}
              aria-label={`${h.name}, ${EVOLUTION_LABEL[h.color]}, 체력 ${Math.round((look?.hp ?? 1) * 100)}%, ${sig}`}
              onPointerDown={(e) => {
                if (e.button === 0) fire(h, look);
              }}
              onClick={(e) => {
                // A key press (a pointer already fired it on the way down).
                if (e.detail === 0) fire(h, look);
              }}
            >
              {ready && FLAME !== null && <img className="bc-flame" src={FLAME} alt="" draggable={false} aria-hidden="true" />}
              <Face heroKey={h.key} />
              <span className="bc-bars" aria-hidden="true">
                <span className="bc-hp">
                  <i style={{ width: `${((look?.hp ?? 1) * 100).toFixed(1)}%` }} />
                </span>
                <span className="bc-sig">
                  <i style={{ width: `${((look?.gauge ?? 0) * 100).toFixed(0)}%` }} />
                </span>
              </span>
              <span className="bc-name">{h.short}</span>
            </button>
          );
        })}
      </div>
      <div className="bc-side">
        <button type="button" role="switch" aria-checked={props.auto} aria-label="필살기 자동" className={`bc-round bc-auto${props.auto ? ' on' : ''}`} onClick={props.onAuto}>
          {AUTO_ICON !== null && <img src={AUTO_ICON} alt="" draggable={false} />}
          <small>자동</small>
        </button>
        <button type="button" className="bc-round bc-speed" onClick={props.onSpeed} aria-label={`재생 속도 ×${props.speed}. 다음 전투부터`}>
          {SPEED_ICON !== null && <img src={SPEED_ICON} alt="" draggable={false} />}
          <small>×{props.speed}</small>
        </button>
      </div>
    </div>
  );
}
