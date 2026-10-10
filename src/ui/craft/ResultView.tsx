// Result screen: stars and tier, a line or two, slot filling, weapon summary.

import { useState } from 'react';
import { ELEMENTS, type Element, ENCHANT_IDS, type EnchantId, type Weapon } from '../../sim/core/types.ts';
import {
  checkPick,
  craftOutcome,
  type CraftState,
  freeSlots,
  type MaterialInventory,
  materialFor,
  materialLabel,
  slotCount,
  type SlotPick,
} from '../../sim/craft/index.ts';
import {
  ELEMENT_LABEL,
  listPrice,
  materialAttack,
  QUALITY,
  WEAPON_SPEC,
} from '../../sim/data/common.ts';
import { ENCHANTS } from '../../sim/data/enchants.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { outcomeLines, percent, stars, tierName, weaponTitle } from './text.ts';

interface Props {
  craft: CraftState;
  weapon: Weapon | null;
  inventory: MaterialInventory;
  onPick(pick: SlotPick): void;
  onAgain(): void;
}

export function ResultView({ craft, weapon, inventory, onPick, onAgain }: Props) {
  const outcome = craftOutcome(craft);
  const r = craft.recipe;
  return (
    <div className="rv">
      <div className={outcome.success ? 'rv-head ok' : 'rv-head fail'}>
        {outcome.success && outcome.tier !== null ? (
          <>
            <div className={`rv-stars tier-${outcome.tier}`}>{stars(outcome.tier)}</div>
            <div className="rv-tier">{tierName(outcome.tier)}</div>
          </>
        ) : (
          <div className="rv-tier">{outcome.abandoned ? '그만둠' : '실패'}</div>
        )}
        <div className="rv-title">{weaponTitle(r.weaponType, r.materialTier)}</div>
      </div>

      <div className="rv-lines">
        {outcomeLines(outcome).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <div className="rv-stats">
        품질 {craft.quality} / {r.qualityCap} ({percent(outcome.qualityRatio)}) · {craft.turn}턴 · 남은 제작력 {craft.cp}
      </div>

      {weapon && <SlotFiller weapon={weapon} inventory={inventory} onPick={onPick} />}
      {weapon && <WeaponSummary weapon={weapon} />}

      <button type="button" className="btn primary big" onClick={onAgain}>
        다시 만들기
      </button>
    </div>
  );
}

/** What the player is about to put in: an enchant (maybe needing a crystal) or a staff element. */
type Draft = { kind: 'enchant'; enchant: EnchantId } | { kind: 'staffElement' };

function SlotFiller({ weapon, inventory, onPick }: { weapon: Weapon; inventory: MaterialInventory; onPick(p: SlotPick): void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [element, setElement] = useState<Element | null>(null);
  const isStaff = weapon.type === 'staff';
  const total = slotCount(weapon);
  const open = freeSlots(weapon);
  const staffOpen = isStaff && weapon.element === null;

  const needsElement = draft !== null && (draft.kind === 'staffElement' || ENCHANTS[draft.enchant].family === 'crystal');
  const pick: SlotPick | null =
    draft === null
      ? null
      : draft.kind === 'staffElement'
        ? element === null
          ? null
          : { kind: 'staffElement', element }
        : { kind: 'enchant', enchant: draft.enchant, element: needsElement ? element : null };
  const reason = pick === null ? (needsElement ? '원소 결정을 고른다' : null) : checkPick(weapon, pick, inventory);

  const choose = (d: Draft) => {
    setDraft(d);
    setElement(null);
  };
  const commit = () => {
    if (pick && reason === null) {
      onPick(pick);
      setDraft(null);
      setElement(null);
    }
  };

  // Slot contents in fill order: element (non-staff) counts as a slot.
  const filled: string[] = [];
  if (!isStaff && weapon.element) filled.push(`${ENCHANTS.element.name} (${ELEMENT_LABEL[weapon.element]})`);
  for (const e of weapon.enchants) filled.push(ENCHANTS[e].name);

  const candidates = ENCHANT_IDS.filter((id) => !(isStaff && id === 'element'));

  return (
    <section className="slots">
      <h3>인챈트 슬롯</h3>
      <div className="slot-row">
        {isStaff && (
          <div className={weapon.element ? 'slot elem filled' : 'slot elem'}>
            <small>속성 칸</small>
            {weapon.element ? ELEMENT_LABEL[weapon.element] : '비어 있음'}
          </div>
        )}
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={filled[i] ? 'slot filled' : 'slot'}>
            {filled[i] ?? '빈 슬롯'}
          </div>
        ))}
        {total === 0 && <p className="hint">범작에는 인챈트 슬롯이 없다.</p>}
      </div>

      {(open > 0 || staffOpen) && (
        <>
          <p className="hint">재료 하나에 인챈트 하나. 한 번 넣으면 바꿀 수 없다. 비워 두면 특별 수리 때 채울 수 있다.</p>
          <div className="pick-grid">
            {staffOpen && (
              <button
                type="button"
                className={draft?.kind === 'staffElement' ? 'pick on' : 'pick'}
                onClick={() => choose({ kind: 'staffElement' })}
              >
                <b>속성 칸</b>
                <small>원소 결정</small>
              </button>
            )}
            {open > 0 &&
              candidates.map((id) => {
                const spec = ENCHANTS[id];
                const taken = id === 'element' ? weapon.element !== null : weapon.enchants.includes(id);
                const key = spec.family === 'crystal' ? null : materialFor({ kind: 'enchant', enchant: id, element: null });
                const stock = key === null ? null : (inventory[key] ?? 0);
                const on = draft?.kind === 'enchant' && draft.enchant === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`pick${on ? ' on' : ''}${spec.upper ? ' upper' : ''}`}
                    disabled={taken || stock === 0}
                    onClick={() => choose({ kind: 'enchant', enchant: id })}
                  >
                    <b>{spec.name}</b>
                    <small>
                      {key === null ? '원소 결정' : `${materialLabel(key)} ${stock}`}
                      {taken ? ' · 있음' : ''}
                    </small>
                  </button>
                );
              })}
          </div>

          {draft && (
            <div className="pick-detail">
              {draft.kind === 'enchant' && <p>{ENCHANTS[draft.enchant].flavor}</p>}
              {needsElement && (
                <div className="seg seg-4">
                  {ELEMENTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={element === e ? `seg-btn on el-${e}` : `seg-btn el-${e}`}
                      onClick={() => setElement(e)}
                    >
                      {ELEMENT_LABEL[e]}
                      <small>{inventory[`crystal:${e}`] ?? 0}</small>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn primary" disabled={pick === null || reason !== null} onClick={commit}>
                {reason ?? '넣는다'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function WeaponSummary({ weapon }: { weapon: Weapon }) {
  const spec = WEAPON_SPEC[weapon.type];
  const mat = materialAttack(weapon.materialTier);
  const q = QUALITY[weapon.quality].attack;
  const attack = spec.attack * mat * q;
  return (
    <section className="ws">
      <h3>만든 무기</h3>
      <div className="ws-row">
        <span>공격력 배율</span>
        <b>×{attack.toFixed(2)}</b>
      </div>
      <div className="ws-sub">
        종류 ×{spec.attack} · 주재료 ×{mat.toFixed(2)} · 품질 ×{q}
      </div>
      <div className="ws-row">
        <span>정가</span>
        <b>{listPrice(weapon.materialTier, weapon.quality).toLocaleString('ko-KR')}G</b>
      </div>
      <div className="ws-row">
        <span>속성</span>
        <b>{weapon.element ? ELEMENT_LABEL[weapon.element] : '없음'}</b>
      </div>
      <div className="ws-row">
        <span>인챈트</span>
        <b>{weapon.enchants.length ? weapon.enchants.map((e) => ENCHANTS[e].name).join(', ') : '없음'}</b>
      </div>
      {weapon.unique && (
        <div className="ws-row unique">
          <span>고유능력</span>
          <b>
            {UNIQUES[weapon.unique].name}
            <small>{UNIQUES[weapon.unique].description}</small>
          </b>
        </div>
      )}
    </section>
  );
}
