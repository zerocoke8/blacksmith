// 기술 덱 in a run: the 준비 화면's editor (13.3: 저장 덱을 판용으로 고친다, 4.2.6 규칙과 시즌 상한)
// and the read-only list the turn screen opens (덱 보기는 턴을 쓰지 않는다, 13.4).

import { countsAsUnlock, deckHandCount } from '../../sim/cards/index.ts';
import { CARD_IDS, type CardId, CARDS, DECK_RULES } from '../../sim/data/cards.ts';
import { SEASON_UNLOCK_CAP } from '../../sim/data/run.ts';
import { type DeckEntry, runDeckProblems } from '../../sim/run/index.ts';
import { grouped } from '../cards/Prep.tsx';
import { CardFace, Sheet } from '../cards/parts.tsx';

/** Cards a run deck may start with: 기본, 해금, 진화 (가문 고유·시즌 카드는 판 안에서만). */
const DECK_CARDS: readonly CardId[] = CARD_IDS.filter((id) => {
  const g = CARDS[id].group;
  return g === 'basic' || g === 'unlock' || g === 'evolved';
});

/** Why adding the card would break a rule not broken yet (장수 하한 aside), or null. */
function addBlock(deck: readonly CardId[], id: CardId): string | null {
  const after = [...deck, id];
  if (CARDS[id].imprint === null && deckHandCount(after) > DECK_RULES.maxCards) return `덱은 ${DECK_RULES.maxCards}장까지`;
  const before = new Set(runDeckProblems(deck).map((p) => p.code + (p.card ?? '')));
  const fresh = runDeckProblems(after).filter((p) => p.code !== 'size' && !before.has(p.code + (p.card ?? '')));
  const first = fresh[0];
  if (first === undefined) return null;
  if (first.code === 'unlockCap') return `해금 카드는 시즌 상한 ${SEASON_UNLOCK_CAP}장까지`;
  return first.message;
}

export function DeckEditor(props: {
  deck: readonly CardId[];
  onChange(deck: CardId[]): void;
  onReset(): void;
  /** The card craft's saved 기본 덱, or null when there is none to bring. */
  onBench: (() => void) | null;
  onClose(): void;
}) {
  const { deck, onChange, onReset, onBench, onClose } = props;
  const counts = new Map(grouped(deck).map((x) => [x.id, x.count]));
  const problems = runDeckProblems(deck);
  const unlocks = deck.filter(countsAsUnlock).length;
  const remove = (id: CardId) => {
    const i = deck.lastIndexOf(id);
    if (i >= 0) onChange([...deck.slice(0, i), ...deck.slice(i + 1)]);
  };
  const groups: { title: string; ids: CardId[] }[] = [
    { title: '기본 카드', ids: DECK_CARDS.filter((id) => CARDS[id].group === 'basic') },
    { title: '해금 카드', ids: DECK_CARDS.filter((id) => CARDS[id].group === 'unlock') },
    { title: '진화 카드', ids: DECK_CARDS.filter((id) => CARDS[id].group === 'evolved') },
  ];
  return (
    <Sheet title="판용 기술 덱" onClose={onClose}>
      <p className="kc-hint">
        {deckHandCount(deck)}장 ({DECK_RULES.minCards}~{DECK_RULES.maxCards}) · 해금 카드 {unlocks} / {SEASON_UNLOCK_CAP} (시즌 상한). 저장 덱은 그대로 두고 이번
        판만 고친다.
      </p>
      {problems.length > 0 && (
        <ul className="kc-problems">
          {problems.map((p) => (
            <li key={p.code + (p.card ?? '') + p.message}>{p.message}</li>
          ))}
        </ul>
      )}
      <div className="kc-row">
        <button type="button" className="kc-btn small" onClick={onReset}>
          기본 판 덱으로
        </button>
        {onBench !== null && (
          <button type="button" className="kc-btn small" onClick={onBench}>
            작업대 덱 불러오기
          </button>
        )}
      </div>
      {groups.map((g) => (
        <section key={g.title} className="rn-deck-group">
          <h4>{g.title}</h4>
          {g.ids.map((id) => {
            const n = counts.get(id) ?? 0;
            const block = addBlock(deck, id);
            return (
              <div key={id} className={n > 0 ? 'kc-deckrow in' : 'kc-deckrow'}>
                <CardFace id={id} />
                <div className="kc-deckrow-ctl">
                  <button type="button" className="kc-btn kc-step" disabled={n === 0} onClick={() => remove(id)} aria-label={`${CARDS[id].name} 빼기`}>
                    −
                  </button>
                  <span className="kc-deckrow-n">{n}</span>
                  <button
                    type="button"
                    className="kc-btn kc-step"
                    disabled={block !== null}
                    onClick={() => onChange([...deck, id])}
                    aria-label={`${CARDS[id].name} 넣기`}
                  >
                    +
                  </button>
                </div>
                {n === 0 && block !== null && <small className="kc-deckrow-why">{block}</small>}
              </div>
            );
          })}
        </section>
      ))}
      <button type="button" className="kc-btn primary" onClick={onClose}>
        다 고쳤다
      </button>
    </Sheet>
  );
}

/** The run's deck as it is now (판 안에서 더하고 진화한 카드 포함). */
export function DeckSheet({ entries, onClose }: { entries: readonly DeckEntry[]; onClose(): void }) {
  const total = entries.reduce((n, e) => n + e.count, 0);
  return (
    <Sheet title={`지금 덱 ${total}장`} onClose={onClose}>
      <p className="kc-hint">판 안에서 넣거나 진화한 카드는 판이 끝나면 사라진다.</p>
      <div className="kc-faces">
        {entries.map((e) => (
          <CardFace key={e.card} id={e.card} count={e.count}>
            {e.runOnly && <span className="kc-face-note">판 안에서만</span>}
          </CardFace>
        ))}
      </div>
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
