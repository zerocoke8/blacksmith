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
import { duration, outcomeLines, percent, weaponTitle } from './text.ts';
import { CardStrip, GameCard } from './GameCard.tsx';
import { WeaponHero } from './WeaponHero.tsx';

/** Width of a newly learned card on the result screen (px): three fit across a 360 phone. */
const LEARNED_CARD_W = 100;

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
  const lines = outcomeLines(outcome);
  // A 막타 may spend more than was left; the iron's last blow is shown as 0 left and the overshoot.
  const over = craft.durability < 0 ? -craft.durability : 0;

  return (
    <div className="kc-result">
      <WeaponHero
        weaponType={r.weaponType}
        tier={outcome.success ? outcome.tier : null}
        success={outcome.success}
        abandoned={outcome.abandoned}
        legendary={r.grade === 'legendary'}
        title={weaponTitle(r.weaponType, r.materialTier)}
      />

      <div className="kc-lines">
        {lines.slice(0, 1).map((line) => (
          <p key={line} className="kc-line-main">
            {line}
          </p>
        ))}
        {session.opened.length > 0 && (
          <p>
            {DWARF_LINES.temperOpen}
            <small> 단련: {session.opened.map((id) => CARDS[id].name).join(', ')}</small>
          </p>
        )}
      </div>

      {session.learned.length > 0 && (
        <section className="kc-learned" aria-label="새로 배운 카드">
          <h3>새로 배운 카드</h3>
          <div className="kc-learned-cards">
            {session.learned.map((id, i) => (
              <div key={id} className="kc-reveal" style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
                <GameCard id={id} tier={tier} width={LEARNED_CARD_W} floor />
              </div>
            ))}
          </div>
          <p className="kc-hint">작업대에서 덱에 넣을 수 있다.</p>
        </section>
      )}

      <div className="kc-result-actions">
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

      {session.weapon !== null && <SlotFiller weapon={session.weapon} inventory={session.inventory} onPick={onPick} />}

      <details className="kc-panel kc-more">
        <summary>
          자세히 <small>이번 제작 · 낸 카드 · 턴마다{session.weapon !== null ? ' · 만든 무기' : ''}</small>
        </summary>
        {lines.slice(1).map((line) => (
          <p key={line} className="kc-hint">
            {line}
          </p>
        ))}
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
            {Math.max(0, craft.durability)} / {craft.maxDurability}
            {over > 0 && <small> (막타로 {over} 넘김)</small>}
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
        <CardStrip cards={grouped(plays.map((p) => p.card))} tier={tier} label="낸 카드" />
        <h4>
          버린 카드 <b>{thrown.length}장</b>
        </h4>
        {thrown.length === 0 ? <p className="kc-muted">없다</p> : <CardStrip cards={grouped(thrown)} tier={tier} label="버린 카드" />}
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
        {session.weapon !== null && <WeaponSummary weapon={session.weapon} />}
      </details>
    </div>
  );
}

/** What the player is about to put in: an enchant (maybe needing a crystal) or the weapon's 속성 칸 (4.3). */
type Draft = { kind: 'enchant'; enchant: EnchantId } | { kind: 'elementSlot' };

/**
 * The 속성 칸 and the 인챈트 슬롯 (4.3): every weapon has one 속성 칸 outside the slots (one 원소 결정
 * sets its attack element; a hero of that element gets 공명), then its quality's enchant slots.
 */
function SlotFiller({ weapon, inventory, onPick }: { weapon: Weapon; inventory: MaterialInventory; onPick(p: SlotPick): void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [element, setElement] = useState<Element | null>(null);
  const total = weaponSlotCount(weapon);
  const open = weaponFreeSlots(weapon);
  const elementOpen = weapon.element === null;

  const needsElement = draft !== null && (draft.kind === 'elementSlot' || ENCHANTS[draft.enchant].family === 'crystal');
  const pick: SlotPick | null =
    draft === null
      ? null
      : draft.kind === 'elementSlot'
        ? element === null
          ? null
          : { kind: 'elementSlot', element }
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
  for (const e of weapon.enchants) if (e !== 'element') filled.push(ENCHANTS[e].name);
  // 속성 부여 is the 속성 칸 now, not an enchant (4.5).
  const candidates = ENCHANT_IDS.filter((id) => id !== 'element');

  return (
    <section className="kc-panel">
      <h3>속성 칸과 인챈트 슬롯</h3>
      <div className="kc-slots">
        <div className={weapon.element !== null ? 'kc-slot filled' : 'kc-slot'}>
          <small>속성 칸</small>
          {weapon.element !== null ? ELEMENT_LABEL[weapon.element] : '무속성'}
        </div>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={filled[i] !== undefined ? 'kc-slot filled' : 'kc-slot'}>
            {filled[i] ?? '빈 슬롯'}
          </div>
        ))}
      </div>
      {total === 0 && <p className="kc-hint">범작에는 인챈트 슬롯이 없다. 속성 칸은 있다.</p>}
      {(open > 0 || elementOpen) && (
        <details className="kc-slotpick" open={elementOpen}>
          <summary>
            속성·인챈트를 넣는다 <small>빈 칸 {open + (elementOpen ? 1 : 0)}</small>
          </summary>
          <p className="kc-hint">원소 결정 하나로 속성 칸을 채우면 그 속성으로 친다. 같은 속성의 용사가 쥐면 공명. 넣으면 바꿀 수 없다.</p>
          <div className="kc-pick-grid three">
            {elementOpen && (
              <button
                type="button"
                className={draft?.kind === 'elementSlot' ? 'kc-pick on' : 'kc-pick'}
                onClick={() => choose({ kind: 'elementSlot' })}
              >
                <b>속성 칸</b>
                <small>원소 결정</small>
              </button>
            )}
            {open > 0 &&
              candidates.map((id) => {
                const spec = ENCHANTS[id];
                const taken = weapon.enchants.includes(id);
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
        </details>
      )}
    </section>
  );
}

function WeaponSummary({ weapon }: { weapon: Weapon }) {
  const spec = WEAPON_SPEC[weapon.type];
  const mat = materialAttack(weapon.materialTier);
  const q = QUALITY[weapon.quality].attack;
  return (
    <section className="kc-weapon-sum">
      <h4>만든 무기</h4>
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

