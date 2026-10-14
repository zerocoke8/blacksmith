// 용사 카드 (기획서 5.9): the picture on the evolution colour, the element and weapon icons down the
// left side (a healer's weapon icon with a small mark), the star row under it and the bar of copies
// toward the next step. A special has a decorated frame. An unowned hero is dimmed ([미정] 5.9).
// The picture sits whole in its box, head to feet (HeroPic, heroArt.ts HERO_ART_FIT).

import type { CSSProperties } from 'react';
import { heroArtUrl, iconUrl } from '../../render/battle/assets.ts';
import { ELEMENT_LABEL, WEAPON_LABEL } from '../../sim/data/common.ts';
import { EVOLUTION_LABEL, HERO_RARITY_LABEL, STAR_MARK_LABEL } from '../../sim/data/heroes.ts';
import { HERO_ART_FIT, heroArtHeight, heroStageAspect } from './heroArt.ts';
import { type HeroCardView, starIconKey } from './view.ts';
import './heroes.css';

/**
 * A hero's picture, whole, in a box the caller sizes (className): a stage of one shape for everyone
 * stands on the box's floor, and the picture stands in it at its share of the stage's height
 * (heroArt.ts). It looks right (the pictures are drawn looking left).
 */
export function HeroPic(props: { heroKey: string; className: string }) {
  const url = heroArtUrl(props.heroKey);
  const pad = HERO_ART_FIT.pad;
  const box = {
    '--hp-ar': heroStageAspect().toFixed(4),
    '--hp-top': pad.top,
    '--hp-bottom': pad.bottom,
    '--hp-side': pad.side,
  } as CSSProperties;
  return (
    <span className={`hp-box ${props.className}`} style={box}>
      <span className="hp-stage">
        {url !== null && (
          <img src={url} alt="" draggable={false} loading="lazy" style={{ height: `${(heroArtHeight(props.heroKey) * 100).toFixed(2)}%` }} />
        )}
      </span>
    </span>
  );
}

export function StarRow(props: { mark: HeroCardView['mark']; pips: number; dim?: boolean; size?: 's' | 'm' }) {
  const url = iconUrl(starIconKey(props.mark));
  return (
    <span className={`hc-stars${props.size === 'm' ? ' m' : ''}${props.dim === true ? ' dim' : ''}`} aria-label={`${STAR_MARK_LABEL[props.mark]} ${props.pips}`}>
      {Array.from({ length: props.pips }, (_, i) => (url !== null ? <img key={i} src={url} alt="" draggable={false} /> : <i key={i}>★</i>))}
    </span>
  );
}

export function TypeIcons(props: { element: HeroCardView['element']; weapon: HeroCardView['weapon']; healer: boolean }) {
  const e = iconUrl(`element_${props.element}`);
  const w = iconUrl(`weapon_${props.weapon}`);
  return (
    <span className="hc-icons">
      <span className="hc-icon" aria-label={`${ELEMENT_LABEL[props.element]} 속성`}>
        {e !== null ? <img src={e} alt="" draggable={false} /> : ELEMENT_LABEL[props.element]}
      </span>
      <span className="hc-icon" aria-label={props.healer ? `${WEAPON_LABEL[props.weapon]} · 힐러` : WEAPON_LABEL[props.weapon]}>
        {w !== null ? <img src={w} alt="" draggable={false} /> : WEAPON_LABEL[props.weapon]}
        {props.healer && <i className="hc-heal">+</i>}
      </span>
    </span>
  );
}

export function HeroCard(props: { card: HeroCardView; onTap(): void; selected?: boolean; badge?: string | null; compact?: boolean }) {
  const c = props.card;
  return (
    <button
      type="button"
      className={`hc hc-${c.color}${c.special ? ' special' : ''}${c.owned ? '' : ' unowned'}${props.selected === true ? ' selected' : ''}${props.compact === true ? ' compact' : ''}`}
      onClick={props.onTap}
      aria-label={`${c.name}, ${HERO_RARITY_LABEL[c.rarity]}, ${EVOLUTION_LABEL[c.color]}${c.owned ? '' : ', 아직 없음'}`}
    >
      <HeroPic heroKey={c.key} className="hc-pic" />
      <TypeIcons element={c.element} weapon={c.weapon} healer={c.role === 'healer'} />
      {c.special && <span className="hc-gem" aria-hidden="true" />}
      {props.badge != null && <b className="hc-badge">{props.badge}</b>}
      <span className="hc-foot">
        <span className="hc-name">{c.name}</span>
        {props.compact !== true && (
          <>
            <StarRow mark={c.mark} pips={c.pips} dim={!c.owned} />
            <span className="hc-bar" aria-label={`다음 별까지 ${c.barText}`}>
              <i style={{ width: `${Math.round(c.ratio * 100)}%` }} />
              <small>{c.barText}</small>
            </span>
          </>
        )}
      </span>
    </button>
  );
}
