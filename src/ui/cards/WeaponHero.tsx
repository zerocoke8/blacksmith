// The head of the result screen: the finished weapon on its paper sign with its stars, or, when
// the iron broke, the split bar (put down: the cold bar, whole), quietly. The weapon picture is weapon_<type> from
// src/assets/art/scene; a drawn silhouette stands in until it arrives.

import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import { sceneArtUrl } from '../../render/forge/assets.ts';
import { type SceneArtKey, WEAPON_ART } from '../../render/forge/layout.ts';
import { stars, tierName } from './text.ts';
import './card.css';
import './hero.css';

const WEAPON_PATH: Record<WeaponType, string> = {
  oneHandSword: 'M18 27h22l3-7h5l-2 8h104l14 2-14 2H46l2 8h-5l-3-7H18a3 3 0 0 1 0-6z',
  greatsword: 'M8 26h26l4-9h6l-3 10h122l18 3-18 3H41l3 10h-6l-4-9H8a4 4 0 0 1 0-8z',
  dagger: 'M48 27h20l3-6h4l-2 7h66l12 2-12 2H73l2 7h-4l-3-6H48a3 3 0 0 1 0-6z',
  bow: 'M30 8c50 4 90 4 140 0-8 6-12 14-14 22 2 8 6 16 14 22-50-4-90-4-140 0 8-6 12-14 14-22-2-8-6-16-14-22zm4 22h132',
  crossbow: 'M20 27h130v6H20zM120 6c8 8 10 16 10 24s-2 16-10 24l-4-2c7-7 9-14 9-22s-2-15-9-22z',
  staff: 'M14 28h140v4H14zM160 18a12 12 0 1 1 0 24 12 12 0 0 1 0-24z',
};

/** The weapon's flat silhouette under an ink line, until its picture arrives. */
function WeaponDrawing({ type }: { type: WeaponType }) {
  return (
    <svg className="wh-weapon-svg" viewBox="0 0 190 60" aria-hidden="true">
      <path d={WEAPON_PATH[type]} fill="var(--dd-steel)" stroke="var(--dd-ink)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** The bar put down whole: the drawn cold bar (iron_cold, no sparkle, no shine), else a drawing. */
function ColdIron() {
  const url = sceneArtUrl('iron_cold');
  if (url === null) return <IronDrawing cracked={false} />;
  return (
    <span className="wh-iron-art">
      <img src={url} alt="" draggable={false} />
    </span>
  );
}

/** The cold, split bar: the drawn iron_cracked, else a drawing. */
function CrackedIron() {
  const url = sceneArtUrl('iron_cracked');
  if (url === null) return <IronDrawing cracked />;
  return (
    <span className="wh-iron-art">
      <img src={url} alt="" draggable={false} />
    </span>
  );
}

/** A flat grey bar under an ink line (the pictures' stand-in), split by a crack or whole. */
function IronDrawing({ cracked }: { cracked: boolean }) {
  return (
    <svg className="wh-iron-svg" viewBox="0 0 190 60" aria-hidden="true">
      <rect x="12" y="20" width="166" height="22" rx="9" fill="var(--dd-ash)" stroke="var(--dd-ink)" strokeWidth="4" />
      {cracked && (
        <path d="M92 18l7 8-6 6 8 6-5 7" fill="none" stroke="var(--dd-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function WeaponHero(props: {
  weaponType: WeaponType;
  tier: QualityTier | null;
  success: boolean;
  abandoned: boolean;
  legendary?: boolean;
  title: string;
}) {
  const { weaponType, tier, success, abandoned, legendary, title } = props;
  const url = sceneArtUrl(`weapon_${weaponType}` as SceneArtKey);
  const cls = ['wh', success ? 'wh-ok' : 'wh-fail', tier !== null ? `wh-tier-${tier}` : '', legendary === true ? 'wh-legend' : '']
    .filter((c) => c !== '')
    .join(' ');
  return (
    <div className={cls}>
      <div className="wh-stage" aria-hidden="true">
        <span className="wh-glow" />
        {success ? (
          url !== null ? (
            <img
              className="wh-weapon-img"
              src={url}
              alt=""
              draggable={false}
              // Painted tip-down-left (the crossbow): mirror it so every weapon points up and right.
              style={WEAPON_ART[weaponType].flip === true ? { scale: '-1 1' } : undefined}
            />
          ) : (
            <WeaponDrawing type={weaponType} />
          )
        ) : abandoned ? (
          <ColdIron />
        ) : (
          <CrackedIron />
        )}
      </div>
      {success && tier !== null ? (
        <>
          <div className={`wh-stars kc-tier-${tier}`}>{stars(tier)}</div>
          <div className="wh-tier">{tierName(tier)}</div>
        </>
      ) : (
        <div className="wh-tier">{abandoned ? '그만둠' : '쇠가 갈라졌다'}</div>
      )}
      <div className="wh-title">{title}</div>
    </div>
  );
}
