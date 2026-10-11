// 사건과 보상 고르기 (13.11, 13.4.3, 13.9): 대사 한두 줄과 선택지. Each option shows what it does
// before it is picked (숨긴 확률이 없다); the engine built those previews when the choice came up.

import { type CSSProperties, useState } from 'react';
import { cardName } from '../../sim/cards/index.ts';
import { FAMILIES } from '../../sim/data/families.ts';
import type { DeckEntry, RunChoice, RunOption } from '../../sim/run/index.ts';
import { CardFace } from '../cards/parts.tsx';
import { DeckSheet } from './Deck.tsx';
import { FamilyFace } from './parts.tsx';
import { CHOICE_KIND_LABEL, goldText } from './text.ts';

function optionCard(o: RunOption) {
  const add = o.effects.find((e) => e.kind === 'addCard');
  return add !== undefined && add.kind === 'addCard' ? add.card : null;
}

export function ChoiceView(props: {
  choice: RunChoice;
  gold: number;
  /** More choices waiting after this one. */
  more: number;
  deck: readonly DeckEntry[];
  onChoose(option: number): void;
}) {
  const { choice, gold, more, deck, onChoose } = props;
  const [deckOpen, setDeckOpen] = useState(false);
  const fam = choice.family === null ? null : FAMILIES[choice.family];
  const cardChoice = choice.options.some((o) => optionCard(o) !== null) || choice.kind === 'remove' || choice.kind === 'evolve' || choice.kind === 'artisan';
  return (
    <div className={`rn-choice k-${choice.kind}`} style={fam !== null ? ({ '--fam': fam.color } as CSSProperties) : undefined}>
      <header className="rn-choice-head">
        <span className="rn-choice-kind">{CHOICE_KIND_LABEL[choice.kind]}</span>
        <span className="rn-gold">{goldText(gold)}</span>
      </header>
      <div className="rn-choice-body">
        {fam !== null && choice.family !== null && (
          <p className="rn-speaker">
            <FamilyFace family={choice.family} size="lg" />
            <b>{fam.name}</b>
          </p>
        )}
        <h2 className="rn-choice-title">{choice.title}</h2>
        {choice.lines.map((l, i) => (
          <p key={i} className={l.startsWith('"') ? 'rn-quote' : 'rn-line'}>
            {l}
          </p>
        ))}
      </div>
      <div className="rn-options">
        {choice.options.map((o, i) => {
          const card = optionCard(o);
          const short = o.cost > gold;
          return (
            <button key={i} type="button" className="rn-option" disabled={short} onClick={() => onChoose(i)}>
              {(card === null || o.label !== cardName(card) || o.cost > 0) && (
                <span className="rn-option-head">
                  <b>{card !== null && o.label === cardName(card) ? '' : o.label}</b>
                  {o.cost > 0 && <span className={short ? 'rn-cost short' : 'rn-cost'}>{goldText(o.cost)}</span>}
                </span>
              )}
              {card !== null ? <CardFace id={card} /> : <small>{o.preview}</small>}
              {short && <small className="rn-why">골드가 모자라다</small>}
            </button>
          );
        })}
      </div>
      <div className="kc-row rn-choice-foot">
        {cardChoice && (
          <button type="button" className="kc-btn ghost small" onClick={() => setDeckOpen(true)}>
            지금 덱 보기
          </button>
        )}
        {more > 0 && <span className="kc-muted">이 다음에 {more}개가 더 기다린다</span>}
      </div>
      {deckOpen && <DeckSheet entries={deck} onClose={() => setDeckOpen(false)} />}
    </div>
  );
}
