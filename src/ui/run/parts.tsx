// Small pieces shared by the 육성 한 판 screens: faces, bars, the five-band strip, the weapon card,
// the 전설 용사 카드. They show what the engine computed (CLAUDE.md 규칙 2).

import type { CSSProperties, ReactNode } from 'react';
import type { Element, Weapon } from '../../sim/core/types.ts';
import { ELEMENT_LABEL, materialName, QUALITY, WEAPON_LABEL } from '../../sim/data/common.ts';
import { FAMILIES, type FamilyId } from '../../sim/data/families.ts';
import { BOND_MAX, SEASONS, type Star, STORY_BONDS, WALL_FLOORS } from '../../sim/data/run.ts';
import {
  factorText,
  type LegendCard,
  legendTitle,
  type RunWeaponView,
  type SeasonBandView,
  type WallView,
  weaponTitle,
} from '../../sim/run/index.ts';
import { END_KIND_LABEL, pct, starFlags, starText } from './text.ts';

export function FamilyFace({ family, size = 'md' }: { family: FamilyId; size?: 'sm' | 'md' | 'lg' }) {
  const fam = FAMILIES[family];
  return (
    <span className={`rn-face rn-face-${size}`} style={{ '--fam': fam.color } as CSSProperties} aria-hidden="true">
      {fam.emoji}
    </span>
  );
}

/** 성급: 가문 문장의 깃 수 (13.5). */
export function StarBadge({ star }: { star: Star }) {
  return (
    <span className="rn-star" aria-label={starText(star)}>
      <i aria-hidden="true">{starFlags(star)}</i> {starText(star)}
    </span>
  );
}

export function ElementTag({ element }: { element: Element }) {
  return <span className={`rn-el rn-el-${element}`}>{ELEMENT_LABEL[element]}</span>;
}

/** A 0..1 bar. `cap` draws the 부상 HP 상한; `ghost` a value it would move to. */
export function Meter(props: { value: number; cap?: number; ghost?: number | null; tone?: 'hp' | 'dur' | 'warm'; label?: ReactNode }) {
  const { value, cap, ghost, tone = 'warm', label } = props;
  const v = Math.max(0, Math.min(1, value));
  const g = ghost === undefined || ghost === null ? null : Math.max(0, Math.min(1, ghost));
  const low = tone !== 'warm' && v <= 0.25;
  return (
    <div className={`rn-meter rn-meter-${tone}${low ? ' low' : ''}`}>
      {label !== undefined && <span className="rn-meter-label">{label}</span>}
      <span className="rn-meter-bar">
        {g !== null && g > v && <span className="rn-meter-ghost" style={{ left: `${v * 100}%`, width: `${(g - v) * 100}%` }} />}
        <span className="rn-meter-fill" style={{ width: `${v * 100}%` }} />
        {g !== null && g < v && <span className="rn-meter-loss" style={{ left: `${g * 100}%`, width: `${(v - g) * 100}%` }} />}
        {cap !== undefined && cap < 1 && <span className="rn-meter-cap" style={{ left: `${cap * 100}%` }} />}
      </span>
    </div>
  );
}

/** 유대 0~5, with the 사연 단계 (1·3·5) marked and the opened ones filled. */
export function BondPips({ bond, stories }: { bond: number; stories: readonly number[] }) {
  return (
    <span className="rn-bond" aria-label={`유대 ${bond}`}>
      {Array.from({ length: BOND_MAX }, (_, i) => {
        const n = i + 1;
        const story = STORY_BONDS.includes(n);
        const cls = ['rn-pip', n <= bond ? 'on' : '', story ? 'story' : '', stories.includes(n) ? 'told' : ''].filter(Boolean).join(' ');
        return <i key={n} className={cls} />;
      })}
    </span>
  );
}

/** 다섯 구간 진행 막대 (13.17): each band with its element and wall, the record marked. */
export function BandStrip({ bands, walls, record }: { bands: readonly SeasonBandView[]; walls: readonly WallView[]; record: number }) {
  return (
    <div className="rn-bands" role="list" aria-label="다섯 구간">
      {bands.map((b, i) => {
        const w = walls[i];
        const state = w?.state ?? 'later';
        const fill = Math.max(0, Math.min(1, (record - b.firstFloor + 1) / (b.lastFloor - b.firstFloor + 1)));
        return (
          <div key={b.band} role="listitem" className={`rn-band ${state} rn-el-bg-${b.element}`}>
            <span className="rn-band-fill" style={{ width: `${fill * 100}%` }} />
            <span className="rn-band-text">
              <b>{b.demon ? '악마' : `${b.lastFloor}층`}</b>
              <small>{state === 'passed' ? `${w?.passedTurn}턴 ✓` : w !== undefined ? `${w.deadline}턴까지` : ''}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** '화속성 강철 단검': the weapon without its ★ and enchants. */
export function weaponBody(w: Pick<Weapon, 'type' | 'materialTier' | 'element'>): string {
  return `${w.element === null ? '' : `${ELEMENT_LABEL[w.element]}속성 `}${materialName(w.materialTier)} ${WEAPON_LABEL[w.type]}`;
}

/** The held weapon (13.17 무기 카드): 공격력, 속성, 인챈트, 내구도. */
export function WeaponCard({ view, children }: { view: RunWeaponView; children?: ReactNode }) {
  return (
    <section className={`rn-weapon q${view.weapon.quality}`}>
      <div className="rn-weapon-head">
        <span className={`rn-q rn-q${view.weapon.quality}`}>
          ★{view.weapon.quality} {QUALITY[view.weapon.quality].name}
        </span>
        <b>{weaponBody(view.weapon)}</b>
      </div>
      {view.name !== null && <p className="rn-weapon-name">「{view.name}」</p>}
      <div className="rn-chips">
        <span className="rn-chip">공격 {Math.round(view.attack)}</span>
        {view.enchants.map((e) => (
          <span key={e.id} className={e.locked ? 'rn-chip locked' : 'rn-chip'}>
            {e.name}
            {e.locked && <small> ({e.lockText})</small>}
          </span>
        ))}
        {view.unique !== null && (
          <span className={view.unique.locked ? 'rn-chip unique locked' : 'rn-chip unique'}>
            {view.unique.name}
            {view.unique.locked && <small> (달인 필요)</small>}
          </span>
        )}
        {view.freeSlots > 0 && <span className="rn-chip empty">빈 슬롯 {view.freeSlots}</span>}
        {view.maintainBuff && <span className="rn-chip good">정비 ×1.2</span>}
      </div>
      <Meter value={view.durability} tone="dur" label={<>내구도 {pct(view.durability)}</>} />
      {children}
    </section>
  );
}

/** One line for an ended run: '30층 벽에서 은퇴', '마지막 등반 63층'. */
export function legendEndText(card: Pick<LegendCard, 'end' | 'endFloor' | 'wallsPassed'>): string {
  switch (card.end) {
    case 'climb':
      return `마지막 등반 ${card.endFloor}층`;
    case 'dead':
      return `${card.endFloor}층에서 돌아오지 않았다`;
    case 'turns':
      return `턴이 다했다 (${card.endFloor}층)`;
    case 'wall':
      return `${WALL_FLOORS[card.wallsPassed] ?? card.endFloor}층 벽 앞에서 은퇴`;
    case 'retired':
      return `${card.endFloor}층에서 ${END_KIND_LABEL.retired}`;
  }
}

/**
 * 전설 용사 카드 (13.12): 얼굴, 칭호, 기록, 인자, 이름 붙은 무기. `flip` turns the 인자 over one by one
 * (판 끝 화면). `generation` is shown when known.
 */
export function LegendCardView(props: {
  card: LegendCard;
  generation?: number | null;
  flip?: boolean;
  compact?: boolean;
  /** The 인자 are shown by the caller (준비 화면's pick buttons). */
  hideFactors?: boolean;
  children?: ReactNode;
}) {
  const { card, flip, compact, hideFactors, children } = props;
  const generation = props.generation ?? card.generation ?? null;
  const fam = FAMILIES[card.family];
  return (
    <article className={`rn-legend g-${card.grade}${compact === true ? ' compact' : ''}`} style={{ '--fam': fam.color } as CSSProperties}>
      <header className="rn-legend-head">
        <FamilyFace family={card.family} size={compact === true ? 'md' : 'lg'} />
        <div>
          <b className="rn-legend-title">{legendTitle(card)}</b>
          <small>
            {generation !== null ? `${generation}대 · ` : ''}
            {starText(card.star)} · {SEASONS[card.season].name}
          </small>
        </div>
      </header>
      <div className="rn-legend-stats">
        <span>
          최고 <b>{card.record}층</b>
        </span>
        <span>
          <b>{card.score.toLocaleString('ko-KR')}</b>점
        </span>
        <span>
          벽 <b>{card.wallsPassed}</b>/5
        </span>
      </div>
      <p className="rn-legend-end">{legendEndText(card)}</p>
      {hideFactors !== true && (
      <ul className={flip === true ? 'rn-factors flip' : 'rn-factors'}>
        {card.factors.map((f, i) => (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            {factorText(f)}
          </li>
        ))}
        {card.factors.length === 0 && <li className="none">남긴 인자 없음</li>}
      </ul>
      )}
      <p className="rn-legend-weapon">
        「{card.weaponName}」
        {card.weaponInherited === true && <small className="rn-inherited">선대에게서 이은 이름</small>}
        <small>{weaponTitle(card.weapon)}</small>
      </p>
      {compact !== true && <p className="rn-legend-deck">덱 {card.deck.length}장</p>}
      {children}
    </article>
  );
}

