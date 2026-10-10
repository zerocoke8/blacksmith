// 완성 화면 (4.3): stars and tier, a line or two, enchant slots, the weapon, and what this
// craft was like (hands, cards played and thrown away, durability left) for the [검증] notes.

import { useState } from 'react';
import { ELEMENTS, type Element, ENCHANT_IDS, type EnchantId, type Weapon } from '../../sim/core/types.ts';
import {
  cardCraftOutcome,
  cardName,
  cardTurnSummary,
  enchantMaterialLabel,
  type MaterialInventory,
  type SlotPick,
  slotBlock,
  slotMaterial,
  weaponFreeSlots,
  weaponSlotCount,
} from '../../sim/cards/index.ts';
import { ELEMENT_LABEL, listPrice, materialAttack, QUALITY, WEAPON_SPEC } from '../../sim/data/common.ts';
import { type CardId, CARDS, DWARF_LINES, FIRE_LABEL } from '../../sim/data/cards.ts';
import { ENCHANTS } from '../../sim/data/enchants.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { grouped } from './Prep.tsx';
import type { CardSession } from './store.ts';
import { duration, outcomeLines, percent, stars, tierName, weaponTitle } from './text.ts';

interface Props {
  session: CardSession;
  onPick(pick: SlotPick): void;
  /** Back to the 준비 screen. */
  onAgain(): void;
  /** Straight onto the anvil with the same recipe, or null when the deck needs fixing first. */
  onAgainSame: (() => void) | null;
  onBench(): void;
}

export function Result({ session, onPick, onAgain, onAgainSame, onBench }: Props) {
  const craft = session.craft;
  const r = craft.recipe;
  const outcome = cardCraftOutcome(craft);
  const tier = r.materialTier;
  const name = (id: CardId) => cardName(id, tier);
  const plays = craft.log.flatMap((e) => (e.kind === 'play' ? [e] : []));
  const thrown = craft.log.flatMap((e) => (e.kind === 'reheat' ? e.discarded.map((u) => craft.cards[u] as CardId) : []));
  const reheats = craft.log.filter((e) => e.kind === 'reheat').length;
  const msOf = new Map(session.turns.map((t) => [t.turn, t.ms]));

  return (
    <div className="kc-result">
      <div className={outcome.success ? 'kc-result-head ok' : 'kc-result-head fail'}>
        {outcome.success && outcome.tier !== null ? (
          <>
            <div className={`kc-result-stars kc-tier-${outcome.tier}`}>{stars(outcome.tier)}</div>
            <div className="kc-result-tier">{tierName(outcome.tier)}</div>
          </>
        ) : (
          <div className="kc-result-tier">{outcome.abandoned ? '그만둠' : '실패'}</div>
        )}
        <div className="kc-result-title">{weaponTitle(r.weaponType, r.materialTier)}</div>
      </div>

      <div className="kc-lines">
        {outcomeLines(outcome).map((line) => (
          <p key={line}>{line}</p>
        ))}
        {session.opened.length > 0 && (
          <p>
            {DWARF_LINES.temperOpen}
            <small> 단련: {session.opened.map((id) => CARDS[id].name).join(', ')}</small>
          </p>
        )}
        {session.learned.length > 0 && (
          <p className="kc-hint">새로 배운 카드: {session.learned.map((id) => CARDS[id].name).join(', ')}. 작업대에서 덱에 넣을 수 있다.</p>
        )}
      </div>

      <section className="kc-panel">
        <h3>이번 제작</h3>
        <div className="kc-kv">
          <span>품질</span>
          <b>
            {craft.quality.toLocaleString('ko-KR')} / {r.qualityCap.toLocaleString('ko-KR')} ({percent(outcome.qualityRatio)})
          </b>
        </div>
        <div className="kc-kv">
          <span>공정</span>
          <b>
            {Math.min(craft.progress, r.progressRequired)} / {r.progressRequired}
          </b>
        </div>
        <div className="kc-kv">
          <span>손패</span>
          <b>
            {craft.turn}번 <small>(다시 달구기 {reheats}번)</small>
          </b>
        </div>
        <div className="kc-kv">
          <span>남은 내구도</span>
          <b>
            {craft.durability} / {craft.maxDurability}
            {craft.durability < 0 && <small> (막타)</small>}
          </b>
        </div>
        <div className="kc-kv">
          <span>걸린 시간</span>
          <b>
            {duration(session.activeMs)}
            {plays.length > 0 && <small> (카드 한 장 {Math.round(session.activeMs / plays.length / 100) / 10}초)</small>}
          </b>
        </div>
        <h4>
          낸 카드 <b>{plays.length}장</b>
        </h4>
        <div className="kc-chips">
          {grouped(plays.map((p) => p.card)).map(({ id, count }) => (
            <span key={id} className={`kc-chip kc-kind-${CARDS[id].kind}`}>
              {name(id)}
              {count > 1 && ` ×${count}`}
            </span>
          ))}
        </div>
        <h4>
          버린 카드 <b>{thrown.length}장</b>
        </h4>
        <div className="kc-chips">
          {thrown.length === 0 && <span className="kc-muted">없다</span>}
          {grouped(thrown).map(({ id, count }) => (
            <span key={id} className={`kc-chip kc-kind-${CARDS[id].kind}`}>
              {name(id)}
              {count > 1 && ` ×${count}`}
            </span>
          ))}
        </div>
        <h4>턴마다</h4>
        <ol className="kc-turns">
          {cardTurnSummary(craft).map((t) => (
            <li key={t.turn}>
              <span className="kc-turns-no">{t.turn}</span>
              <span className={`kc-dot kc-fire-${t.fire}`}>{FIRE_LABEL[t.fire]}</span>
              <span className="kc-turns-cards">{t.played.map(name).join(' → ') || '내지 않음'}</span>
              <small>{duration(msOf.get(t.turn) ?? 0)}</small>
            </li>
          ))}
        </ol>
      </section>

      {session.weapon !== null && <SlotFiller weapon={session.weapon} inventory={session.inventory} onPick={onPick} />}
      {session.weapon !== null && <WeaponSummary weapon={session.weapon} />}

      {onAgainSame !== null && (
        <button type="button" className="kc-btn primary big" onClick={onAgainSame}>
          같은 레시피로 다시 친다
        </button>
      )}
      <div className="kc-row">
        <button type="button" className={onAgainSame === null ? 'kc-btn primary big' : 'kc-btn'} onClick={onAgain}>
          레시피를 다시 고른다
        </button>
        <button type="button" className="kc-btn ghost" onClick={onBench}>
          작업대로
        </button>
      </div>
    </div>
  );
}

/** What the player is about to put in: an enchant (maybe needing a crystal) or a staff element. */
type Draft = { kind: 'enchant'; enchant: EnchantId } | { kind: 'staffElement' };

function SlotFiller({ weapon, inventory, onPick }: { weapon: Weapon; inventory: MaterialInventory; onPick(p: SlotPick): void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [element, setElement] = useState<Element | null>(null);
  const isStaff = weapon.type === 'staff';
  const total = weaponSlotCount(weapon);
  const open = weaponFreeSlots(weapon);
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
  const reason = pick === null ? (needsElement ? '원소 결정을 고른다' : null) : slotBlock(weapon, pick, inventory);

  const choose = (d: Draft) => {
    setDraft(d);
    setElement(null);
  };
  const commit = () => {
    if (pick !== null && reason === null) {
      onPick(pick);
      setDraft(null);
      setElement(null);
    }
  };

  const filled: string[] = [];
  if (!isStaff && weapon.element !== null) filled.push(`${ENCHANTS.element.name} (${ELEMENT_LABEL[weapon.element]})`);
  for (const e of weapon.enchants) filled.push(ENCHANTS[e].name);
  const candidates = ENCHANT_IDS.filter((id) => !(isStaff && id === 'element'));

  return (
    <section className="kc-panel">
      <h3>인챈트 슬롯</h3>
      <div className="kc-slots">
        {isStaff && (
          <div className={weapon.element !== null ? 'kc-slot filled' : 'kc-slot'}>
            <small>속성 칸</small>
            {weapon.element !== null ? ELEMENT_LABEL[weapon.element] : '비어 있음'}
          </div>
        )}
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={filled[i] !== undefined ? 'kc-slot filled' : 'kc-slot'}>
            {filled[i] ?? '빈 슬롯'}
          </div>
        ))}
      </div>
      {total === 0 && <p className="kc-hint">범작에는 인챈트 슬롯이 없다.</p>}
      {(open > 0 || staffOpen) && (
        <>
          <p className="kc-hint">재료 하나에 인챈트 하나. 넣으면 바꿀 수 없다. 비워 두면 특별 수리 때 채운다.</p>
          <div className="kc-pick-grid three">
            {staffOpen && (
              <button
                type="button"
                className={draft?.kind === 'staffElement' ? 'kc-pick on' : 'kc-pick'}
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
                const key = spec.family === 'crystal' ? null : slotMaterial({ kind: 'enchant', enchant: id, element: null });
                const stock = key === null ? null : (inventory[key] ?? 0);
                const on = draft?.kind === 'enchant' && draft.enchant === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`kc-pick${on ? ' on' : ''}${spec.upper ? ' upper' : ''}`}
                    disabled={taken || stock === 0}
                    onClick={() => choose({ kind: 'enchant', enchant: id })}
                  >
                    <b>{spec.name}</b>
                    <small>
                      {key === null ? '원소 결정' : `${enchantMaterialLabel(key)} ${stock}`}
                      {taken ? ' · 있음' : ''}
                    </small>
                  </button>
                );
              })}
          </div>
          {draft !== null && (
            <div className="kc-pick-detail">
              {draft.kind === 'enchant' && <p>{ENCHANTS[draft.enchant].flavor}</p>}
              {needsElement && (
                <div className="kc-seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {ELEMENTS.map((e) => (
                    <button key={e} type="button" className={element === e ? 'kc-seg-btn on' : 'kc-seg-btn'} onClick={() => setElement(e)}>
                      <span>{ELEMENT_LABEL[e]}</span>
                      <small>{inventory[`crystal:${e}`] ?? 0}</small>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="kc-btn primary" disabled={pick === null || reason !== null} onClick={commit}>
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
  return (
    <section className="kc-panel">
      <h3>만든 무기</h3>
      <div className="kc-kv">
        <span>공격력 배율</span>
        <b>×{(spec.attack * mat * q).toFixed(2)}</b>
      </div>
      <p className="kc-hint">
        종류 ×{spec.attack} · 주재료 ×{mat.toFixed(2)} · 품질 ×{q}
      </p>
      <div className="kc-kv">
        <span>정가</span>
        <b>{listPrice(weapon.materialTier, weapon.quality).toLocaleString('ko-KR')}G</b>
      </div>
      <div className="kc-kv">
        <span>속성</span>
        <b>{weapon.element !== null ? ELEMENT_LABEL[weapon.element] : '없음'}</b>
      </div>
      <div className="kc-kv">
        <span>인챈트</span>
        <b>{weapon.enchants.length > 0 ? weapon.enchants.map((e) => ENCHANTS[e].name).join(', ') : '없음'}</b>
      </div>
      {weapon.unique !== null && (
        <div className="kc-kv unique">
          <span>고유능력</span>
          <b>
            {UNIQUES[weapon.unique].name}
            <small> {UNIQUES[weapon.unique].description}</small>
          </b>
        </div>
      )}
    </section>
  );
}

