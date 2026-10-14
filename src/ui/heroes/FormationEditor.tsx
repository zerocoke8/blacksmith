// 편성 화면 (기획서 6.3, 사용자 결정 11): a front row and a back row of four places, five heroes. The
// stage and the daily boss keep their own formation, and one button copies this one to the other.
// Tap a hero below to stand them in (the row their role suits) or take them out; drag a placed hero
// onto another place, or tap one and then a place, to move them (onto someone: the two swap).
// Touch first: nothing needs a hover. The list below shows what choosing needs: each hero's power,
// stars and whether they hold a weapon ('맨손'); the ones standing come first with their row, the
// rest strongest first. '추천 편성' stands the five strongest (a healer kept in) in their rows.

import { type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react';
import { heroArtUrl } from '../../render/battle/assets.ts';
import { FORMATION_ROW_MAX, FORMATION_SIZE } from '../../sim/data/battle.ts';
import { FORMATION_ROW_LABEL, type FormationRow, type HeroKey, HEROES, heroSpec } from '../../sim/data/heroes.ts';
import { heroPower, heroStats, heroWeapon, type HeroesState } from '../../sim/hero/index.ts';
import { buildTeam, type Formation, formationProblemText, teamPower } from '../../sim/stage/index.ts';
import { Seg } from '../cards/parts.tsx';
import { HERO_LINES } from '../battle/text.ts';
import { HeroPic, StarRow, TypeIcons } from './HeroCard.tsx';
import {
  checkFormation,
  memberCount,
  moveMember,
  type Place,
  placeOf,
  recommendedFormation,
  sameFormation,
  toggleMember,
} from './formationEdit.ts';
import { heroCardView } from './view.ts';
import './heroes.css';

export type FormationKind = 'stage' | 'daily';
export type Formations = { stage: Formation; daily: Formation };

const DRAG_PX = 8;

const ROW_NOTE: Record<FormationRow, string> = { front: '적이 먼저 친다 · 근접 +10%', back: '원거리·힐러 +10%' };

export function FormationEditor(props: {
  heroes: HeroesState;
  formations: Formations;
  kind: FormationKind;
  onKind?(kind: FormationKind): void;
  onChange(next: Formations): void;
  /** Hide the stage/daily switch (inside a battle screen). */
  fixedKind?: boolean;
}) {
  const { heroes, formations, kind } = props;
  const f = formations[kind];
  const other: FormationKind = kind === 'stage' ? 'daily' : 'stage';
  const [selected, setSelected] = useState<HeroKey | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ key: HeroKey; x: number; y: number } | null>(null);
  const press = useRef<{ key: HeroKey; x: number; y: number; dragging: boolean } | null>(null);

  const set = (next: Formation) => props.onChange({ ...formations, [kind]: next });
  const check = useMemo(() => checkFormation(f, heroes.roster, formationProblemText), [f, heroes.roster]);
  const power = useMemo(() => (check.canFight ? teamPower(buildTeam(heroes, f)) : 0), [check.canFight, heroes, f]);
  /** Each owned hero's power (6.4 전투력: level, stars, weapon), for the list and the recommendation. */
  const powers = useMemo(() => {
    const out = new Map<HeroKey, number>();
    for (const h of HEROES) {
      const copies = heroes.roster[h.key] ?? 0;
      if (copies >= 1) out.set(h.key, heroPower(heroStats(h.key, copies, heroes.level.level, heroWeapon(heroes.armory, h.key))));
    }
    return out;
  }, [heroes]);
  const owned = HEROES.filter((h) => powers.has(h.key)).map((h) => h.key);
  // The ones standing first (front, then back, in place), then the rest strongest first.
  const standing = [...f.front, ...f.back].filter((k) => powers.has(k));
  const listed = [...standing, ...owned.filter((k) => !standing.includes(k)).sort((a, b) => (powers.get(b) ?? 0) - (powers.get(a) ?? 0))];
  const recommended = useMemo(() => recommendedFormation(owned, (k) => powers.get(k) ?? 0), [owned.join(), powers]);

  const placeAt = (to: Place) => {
    if (selected === null) return;
    set(moveMember(f, selected, to));
    setSelected(null);
  };

  const onCellDown = (e: ReactPointerEvent, key: HeroKey) => {
    if (e.button !== 0) return;
    press.current = { key, x: e.clientX, y: e.clientY, dragging: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // a synthetic pointer
    }
  };
  const onCellMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (p === null) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_PX) p.dragging = true;
    if (p.dragging) setGhost({ key: p.key, x: e.clientX, y: e.clientY });
  };
  const onCellUp = (e: ReactPointerEvent, key: HeroKey, place: Place) => {
    const p = press.current;
    press.current = null;
    setGhost(null);
    if (p === null) return;
    if (p.dragging) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-place]');
      const at = el?.getAttribute('data-place');
      if (at != null) {
        const [row, idx] = at.split(':');
        set(moveMember(f, p.key, { row: row as FormationRow, index: Number(idx) }));
      }
      setSelected(null);
      return;
    }
    // A tap: pick this one up, put it down, or swap the one held with it.
    if (selected === null) setSelected(key);
    else if (selected === key) setSelected(null);
    else placeAt(place);
  };

  const row = (r: FormationRow) => (
    <div className="fe-row">
      <div className="fe-row-label">
        <b>{FORMATION_ROW_LABEL[r]}</b>
        <small>{ROW_NOTE[r]}</small>
      </div>
      <div className="fe-cells">
        {Array.from({ length: FORMATION_ROW_MAX }, (_, i) => {
          const key = f[r][i];
          const place = { row: r, index: i };
          if (key === undefined) {
            return (
              <button
                key={i}
                type="button"
                className={`fe-cell empty${selected !== null ? ' target' : ''}`}
                data-place={`${r}:${i}`}
                onClick={() => placeAt(place)}
                aria-label={`${FORMATION_ROW_LABEL[r]} 빈자리`}
              />
            );
          }
          const spec = heroSpec(key);
          const off = check.offRow.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`fe-cell hc-${heroCardView(heroes.roster, key).color}${selected === key ? ' selected' : ''}${ghost?.key === key ? ' lifted' : ''}`}
              data-place={`${r}:${i}`}
              onPointerDown={(e) => onCellDown(e, key)}
              onPointerMove={onCellMove}
              onPointerUp={(e) => onCellUp(e, key, place)}
              onPointerCancel={() => {
                press.current = null;
                setGhost(null);
              }}
              aria-label={`${FORMATION_ROW_LABEL[r]} ${i + 1}: ${spec.name}`}
            >
              <HeroPic heroKey={key} className="fe-pic" />
              <TypeIcons element={spec.element} weapon={spec.weapon} healer={spec.role === 'healer'} />
              <span className="fe-name">{spec.name.split(' ').pop()}</span>
              {off && <i className="fe-off" title={HERO_LINES.offRow} aria-label={HERO_LINES.offRow} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fe-root">
      {props.fixedKind !== true && (
        <Seg
          value={kind}
          onChange={(k) => {
            setSelected(null);
            props.onKind?.(k);
          }}
          options={[
            { value: 'stage', label: HERO_LINES.formationStage },
            { value: 'daily', label: HERO_LINES.formationDaily },
          ]}
          label="편성"
        />
      )}
      <div className="fe-head">
        <span>
          {memberCount(f)}/{FORMATION_SIZE}명 · 전투력 <b>{power.toLocaleString('ko-KR')}</b>
        </span>
        <div className="fe-actions">
          <button
            type="button"
            className="kc-btn small"
            disabled={sameFormation(f, recommended)}
            onClick={() => {
              set(recommended);
              setSelected(null);
              setNote(HERO_LINES.recommended);
            }}
          >
            {HERO_LINES.recommend}
          </button>
          <button
            type="button"
            className="kc-btn small"
            disabled={sameFormation(f, formations[other])}
            onClick={() => {
              props.onChange({ ...formations, [other]: { front: [...f.front], back: [...f.back] } });
              const to = other === 'stage' ? HERO_LINES.formationStage : HERO_LINES.formationDaily;
              setNote(HERO_LINES.copied(to));
            }}
          >
            {HERO_LINES.copyTo(other === 'stage' ? HERO_LINES.formationStage : HERO_LINES.formationDaily)}
          </button>
        </div>
      </div>
      {row('front')}
      {row('back')}
      {check.problems.length > 0 ? (
        <p className="fe-warn">{check.problems.join(' ')}</p>
      ) : memberCount(f) < FORMATION_SIZE && owned.length > memberCount(f) ? (
        <p className="fe-warn soft">{HERO_LINES.notFull(memberCount(f))}</p>
      ) : check.offRow.length > 0 ? (
        <p className="fe-hint">
          {check.offRow.map((k) => heroSpec(k).name).join(', ')}: {HERO_LINES.offRow}
        </p>
      ) : (
        <p className="fe-hint">{note ?? HERO_LINES.pickHint}</p>
      )}
      <div className="fe-pick">
        {listed.map((key) => {
          const spec = heroSpec(key);
          const at = placeOf(f, key);
          const card = heroCardView(heroes.roster, key);
          const bare = heroWeapon(heroes.armory, key) === null;
          const pw = powers.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              className={`fe-pick-card hc-${card.color}${at !== null ? ' in' : ''}${spec.rarity === 'special' ? ' special' : ''}`}
              onClick={() => {
                const r = toggleMember(f, key);
                if (r.note === 'full') setNote(HERO_LINES.full);
                else {
                  setNote(null);
                  set(r.formation);
                }
                setSelected(null);
              }}
              aria-pressed={at !== null}
              aria-label={`${spec.name}, 전투력 ${pw.toLocaleString('ko-KR')}${bare ? ', 맨손' : ''}${at !== null ? `, ${FORMATION_ROW_LABEL[at.row]}` : ''}`}
            >
              <HeroPic heroKey={key} className="fe-pic" />
              <TypeIcons element={spec.element} weapon={spec.weapon} healer={spec.role === 'healer'} />
              <span className="fe-tags">
                {at !== null && <b className="fe-in">{FORMATION_ROW_LABEL[at.row]}</b>}
                {bare && <b className="fe-bare">{HERO_LINES.bare}</b>}
              </span>
              <StarRow mark={card.mark} pips={card.pips} />
              <span className="fe-name">{spec.name.split(' ').pop()}</span>
              <span className="fe-power">{pw.toLocaleString('ko-KR')}</span>
            </button>
          );
        })}
      </div>
      {ghost !== null && (
        <span className="fe-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          {heroArtUrl(ghost.key) !== null && <img src={heroArtUrl(ghost.key) ?? ''} alt="" draggable={false} />}
        </span>
      )}
    </div>
  );
}
