// 용사 자세히 (기획서 5.9): the picture large, the four stats (체력·공격·방어·치명타), the active skill,
// the passive and the signature (with when they open), the star and evolution progress, the line,
// and the weapon held with the list to swap it for (4.11: any time, the old one goes back to the
// list, a weapon another hero held leaves their hands). No level-up button (5.3).

import { useState } from 'react';
import { heroArtUrl, iconUrl } from '../../render/battle/assets.ts';
import { ELEMENT_LABEL, WEAPON_LABEL } from '../../sim/data/common.ts';
import {
  ACTIVE_SKILLS,
  EVOLUTION_AT_STAR,
  EVOLUTION_LABEL,
  EVOLUTION_LADDER,
  HERO_RARITY_LABEL,
  HERO_ROLE_LABEL,
  type HeroKey,
  heroSpec,
  passiveText,
  SIGNATURE_RED_MULT,
  SIGNATURES,
  skillKeyOf,
  skillText,
  STAR_MARK_LABEL,
  STAR_MARKS,
  STAR_PIPS_PER_MARK,
} from '../../sim/data/heroes.ts';
import { BATTLE_TICK_MS } from '../../sim/data/battle.ts';
import {
  equipWeapon,
  type HeroesState,
  heroPower,
  heroStats,
  heroWeapon,
  holderOf,
  unequipWeapon,
  type WeaponItem,
  weaponItemAttack,
  weaponItemName,
} from '../../sim/hero/index.ts';
import { Sheet } from '../cards/parts.tsx';
import { HERO_LINES } from '../battle/text.ts';
import { StarRow, TypeIcons } from './HeroCard.tsx';
import { heroCardView } from './view.ts';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

function WeaponLine(props: { w: WeaponItem; heroElement: string; holder?: string | null; on?: boolean; onTap?(): void }) {
  const { w } = props;
  const el = w.element !== null ? iconUrl(`element_${w.element}`) : null;
  const ty = iconUrl(`weapon_${w.type}`);
  const resonance = w.element !== null && w.element === props.heroElement;
  const body = (
    <>
      <span className="hd-w-icon">{ty !== null && <img src={ty} alt="" draggable={false} />}</span>
      <span className="hd-w-name">
        <b>{weaponItemName(w)}</b>
        <small>
          공격 {fmt(weaponItemAttack(w))} · ★{w.quality}
          {/* The element is in the name ('화 · 철 한손검') and the icon; only its absence is said. */}
          {w.element === null ? ' · 무속성' : ''}
          {props.holder != null ? ` · ${props.holder}` : ''}
        </small>
      </span>
      {el !== null && w.element !== null && <img className="hd-w-el" src={el} alt={`${ELEMENT_LABEL[w.element]} 속성`} draggable={false} />}
      {resonance && <em className="hd-w-res">{HERO_LINES.resonance}</em>}
    </>
  );
  if (props.onTap === undefined) return <div className="hd-weapon">{body}</div>;
  return (
    <button type="button" className={`hd-weapon hd-pick${props.on === true ? ' on' : ''}`} onClick={props.onTap}>
      {body}
    </button>
  );
}

export function HeroDetail(props: {
  heroKey: HeroKey;
  heroes: HeroesState;
  onChange(next: HeroesState): void;
  onClose(): void;
  onLab(kind: 'star' | 'evolve'): void;
}) {
  const { heroKey: key, heroes } = props;
  const spec = heroSpec(key);
  const card = heroCardView(heroes.roster, key);
  const weapon = heroWeapon(heroes.armory, key);
  const stats = heroStats(key, Math.max(1, card.copies), heroes.level.level, weapon);
  const [swap, setSwap] = useState(false);
  const pic = heroArtUrl(key);
  const sk = skillKeyOf(spec);
  const active = ACTIVE_SKILLS[sk];
  const haste = card.passiveOpen && spec.passive.kind === 'haste' ? spec.passive.value : 0;
  const cd = (Math.max(1, Math.round(active.cooldownTicks * (1 - haste))) * BATTLE_TICK_MS) / 1000;
  const sig = SIGNATURES[sk];
  const nextColor = EVOLUTION_LADDER[spec.rarity].find((c) => EVOLUTION_AT_STAR[c] > card.starIndex);
  const nextAt = nextColor !== undefined ? EVOLUTION_AT_STAR[nextColor] : null;
  const spares = heroes.armory.weapons.filter((w) => w.type === spec.weapon);

  const equip = (id: string) => {
    props.onChange({ ...heroes, armory: equipWeapon(heroes.armory, key, id) });
    setSwap(false);
  };

  return (
    <div className={`hd-root hc-${card.color}${card.special ? ' special' : ''}`} role="dialog" aria-label={spec.name}>
      <header className="hd-top">
        <button type="button" className="hs-iconbtn" onClick={props.onClose} aria-label="목록으로">
          ←
        </button>
        <b className="hd-title">{spec.name}</b>
        <span className="hd-tag">
          {HERO_RARITY_LABEL[spec.rarity]} · {EVOLUTION_LABEL[card.color]}
        </span>
      </header>
      <div className="hd-scroll">
        <section className="hd-hero">
          <span className="hd-pic">{pic !== null && <img src={pic} alt="" draggable={false} />}</span>
          <TypeIcons element={spec.element} weapon={spec.weapon} healer={spec.role === 'healer'} />
          <p className="hd-line">“{spec.line}”</p>
        </section>
        {!card.owned && <p className="hd-note">{HERO_LINES.notOwned}</p>}

        <section className="hd-card">
          <div className="hd-stars">
            <StarRow mark={card.mark} pips={card.pips} dim={!card.owned} size="m" />
            <span className="hc-bar big">
              <i style={{ width: `${Math.round(card.ratio * 100)}%` }} />
              <small>{card.barText}</small>
            </span>
          </div>
          <p className="hd-sub">
            {STAR_MARK_LABEL[card.mark]} {card.pips} · {ELEMENT_LABEL[spec.element]} 속성 · {WEAPON_LABEL[spec.weapon]} · {HERO_ROLE_LABEL[spec.role]}
            {nextColor !== undefined && nextAt !== null
              ? ` · ${STAR_MARK_LABEL[STAR_MARKS[Math.floor(nextAt / STAR_PIPS_PER_MARK)] ?? 'moon']} 1에서 ${EVOLUTION_LABEL[nextColor]} 진화`
              : ' · 진화 끝'}
          </p>
          <dl className="hd-stats">
            <div>
              <dt>체력</dt>
              <dd>{fmt(stats.maxHp)}</dd>
            </div>
            <div>
              <dt>공격</dt>
              <dd>{fmt(stats.atk)}</dd>
            </div>
            <div>
              <dt>방어</dt>
              <dd>{fmt(stats.def)}</dd>
            </div>
            <div>
              <dt>치명타</dt>
              <dd>
                {Math.round(stats.crit * 100)}%<small> ×{stats.critDamage.toFixed(1)}</small>
              </dd>
            </div>
          </dl>
          <p className="hd-power">
            전투력 <b>{fmt(heroPower(stats))}</b> · 레벨 {heroes.level.level} (모두 같다)
          </p>
        </section>

        <section className="hd-card">
          <h4>무기</h4>
          {weapon !== null ? <WeaponLine w={weapon} heroElement={spec.element} /> : <p className="hd-note">{HERO_LINES.noWeapon}</p>}
          <div className="hd-row">
            <button type="button" className="kc-btn small" onClick={() => setSwap(true)} disabled={!card.owned}>
              {HERO_LINES.swap}
            </button>
            {weapon !== null && (
              <button type="button" className="kc-btn small ghost" onClick={() => props.onChange({ ...heroes, armory: unequipWeapon(heroes.armory, key) })}>
                {HERO_LINES.unequip}
              </button>
            )}
          </div>
        </section>

        <section className="hd-card">
          <h4>스킬</h4>
          <div className="hd-skill">
            <b>{active.name}</b>
            <small>
              {skillText(active)} · {cd}초마다 저절로
            </small>
          </div>
          <div className={`hd-skill${card.passiveOpen ? '' : ' locked'}`}>
            <b>
              패시브 · {spec.passive.name}
            </b>
            <small>
              {passiveText(spec.passive)}
              {card.passiveOpen ? '' : ` · ${HERO_LINES.passiveLocked}`}
            </small>
          </div>
          <div className={`hd-skill${card.signature !== null ? ' sig' : ' locked'}`}>
            <b>필살기 · {spec.rarity === 'special' ? sig.name : '—'}</b>
            <small>
              {spec.rarity !== 'special'
                ? HERO_LINES.signatureNone
                : `${skillText(sig, card.signature === 'strong' ? SIGNATURE_RED_MULT : 1)} · 게이지가 차면 저절로${
                    card.signature === null ? ` · ${HERO_LINES.signatureLocked}` : card.signature === 'strong' ? ` · ${HERO_LINES.signatureStrong}` : ''
                  }`}
            </small>
          </div>
        </section>

        <section className="hd-card hd-lab">
          <h4>실험</h4>
          <div className="hd-row">
            <button type="button" className="kc-btn small" onClick={() => props.onLab('star')}>
              별 +1
            </button>
            <button type="button" className="kc-btn small" onClick={() => props.onLab('evolve')}>
              진화
            </button>
          </div>
        </section>
      </div>

      {swap && (
        <Sheet title={`${WEAPON_LABEL[spec.weapon]} 고르기`} onClose={() => setSwap(false)}>
          {spares.length === 0 ? (
            <p className="kc-hint">{HERO_LINES.noSpare}</p>
          ) : (
            <div className="hd-wlist">
              {spares.map((w) => {
                const holder = holderOf(heroes.armory, w.id);
                return (
                  <WeaponLine
                    key={w.id}
                    w={w}
                    heroElement={spec.element}
                    holder={holder !== null && holder !== key ? HERO_LINES.heldBy(heroSpec(holder).name) : holder === key ? '지금 쥐고 있다' : null}
                    on={holder === key}
                    onTap={() => equip(w.id)}
                  />
                );
              })}
            </div>
          )}
          <button type="button" className="kc-btn" onClick={() => setSwap(false)}>
            닫기
          </button>
        </Sheet>
      )}
    </div>
  );
}
