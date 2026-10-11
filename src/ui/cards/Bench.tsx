// 작업대 (4.2.6): one saved deck per recipe grade, 해금 카드 in and out under the cap, and
// 진화 (4.2.5) from cards whose 단련 is open. Editing is free; a craft on the anvil keeps the
// deck it started with. Gold is not spent in the prototype.

import { useState } from 'react';
import {
  type CardCollection,
  cardText,
  checkDeck,
  countsAsUnlock,
  dayOneDeck,
  deckHandCount,
  EVOLVE_BRANCH_LABEL,
  type EvolveBranch,
  evolutionOf,
  evolveBlock,
  evolveCard,
  evolveCost,
  isBasicCard,
  type TemperRecord,
  temperNeed,
  unlockCap,
} from '../../sim/cards/index.ts';
import {
  BASIC_CARD_IDS,
  CARD_IDS,
  CARD_RECIPE_GRADE_LABEL,
  type CardId,
  type CardRecipeGrade,
  CARDS,
  DECK_RULES,
  UNLOCK_CARD_IDS,
} from '../../sim/data/cards.ts';
import { collectionOf } from './flow.ts';
import { grouped } from './Prep.tsx';
import { GameCard } from './GameCard.tsx';
import { Seg, Sheet } from './parts.tsx';
import { type CardProfile, GRADES } from './store.ts';

interface Props {
  profile: CardProfile;
  grade: CardRecipeGrade;
  craftActive: boolean;
  onGrade(grade: CardRecipeGrade): void;
  onChange(update: (p: CardProfile) => CardProfile): void;
}

/** A card in the 작업대 grid (px): three across a 360 phone. */
const BENCH_CARD_W = 104;
/** The card opened from the grid. */
const BENCH_INFO_W = 168;

/** Why adding this card would break a deck rule that is not broken yet, or null. */
function addBlock(deck: readonly CardId[], id: CardId, collection: CardCollection, stage: number): string | null {
  const after = [...deck, id];
  if (CARDS[id].imprint === null && deckHandCount(after) > DECK_RULES.maxCards) return `덱은 ${DECK_RULES.maxCards}장까지`;
  const before = new Set(checkDeck(deck, collection, stage).map((p) => p.message));
  const fresh = checkDeck(after, collection, stage).filter((p) => p.code !== 'size' && !before.has(p.message));
  const first = fresh[0];
  if (first === undefined) return null;
  // checkDeck counts the deck as it would be; on the + button, say what is in it now.
  if (first.code === 'unlockCap') return `해금 카드는 ${unlockCap(stage)}장까지 · 이미 ${deck.filter(countsAsUnlock).length}장`;
  return first.message;
}

/** The record the evolve check sees: the real one, or every 단련 met when the test switch is on. */
function temperFor(profile: CardProfile, id: CardId): TemperRecord {
  const need = temperNeed(id);
  if (!profile.lab.temperFree || need === null) return profile.temper;
  return { ...profile.temper, [id]: Math.max(profile.temper[id] ?? 0, need) };
}

export function Bench({ profile, grade, craftActive, onGrade, onChange }: Props) {
  const [evolved, setEvolved] = useState<string | null>(null);
  const [info, setInfo] = useState<CardId | null>(null);
  const stage = profile.lab.fameStage;
  const collection = collectionOf(profile);
  const deck = profile.decks[grade];
  const problems = checkDeck(deck, collection, stage);
  const counts = new Map(grouped(deck).map((x) => [x.id, x.count]));
  const unlocks = deck.filter(countsAsUnlock).length;
  const imprints = deck.filter((id) => CARDS[id].imprint !== null).length;
  const cap = unlockCap(stage);

  const setDeck = (next: CardId[]) => onChange((p) => ({ ...p, decks: { ...p.decks, [grade]: next } }));
  const add = (id: CardId) => setDeck([...deck, id]);
  const remove = (id: CardId) => {
    const i = deck.lastIndexOf(id);
    if (i >= 0) setDeck([...deck.slice(0, i), ...deck.slice(i + 1)]);
  };

  const evolve = (id: CardId, branch: EvolveBranch) => {
    try {
      const made = evolveCard(collection, temperFor(profile, id), id, branch, stage);
      onChange((p) => ({ ...p, evolved: made.collection.evolved }));
      setEvolved(`${CARDS[made.card].name} 한 장을 만들었다. (${made.cost.toLocaleString('ko-KR')}G — 프로토타입이라 받지 않는다)`);
    } catch {
      // The buttons only show when the 단련 is open; nothing to do.
    }
  };

  const learned = new Set(collection.learned);
  const notLearned = UNLOCK_CARD_IDS.filter((id) => !learned.has(id));
  const ownedEvolved = CARD_IDS.filter((id) => CARDS[id].group === 'evolved' && (profile.evolved[id] ?? 0) > 0);
  const evolvable = CARD_IDS.filter((id) => temperNeed(id) !== null && (isBasicCard(id) || learned.has(id)));

  const row = (id: CardId, owned?: number) => {
    const n = counts.get(id) ?? 0;
    const block = addBlock(deck, id, collection, stage);
    return (
      <div key={id} className={n > 0 ? 'kc-benchcard in' : 'kc-benchcard'}>
        <button type="button" className="kc-benchcard-face" onClick={() => setInfo(id)} aria-label={`${CARDS[id].name} 자세히`}>
          <GameCard id={id} width={BENCH_CARD_W} floor />
          {n > 0 && <span className="kc-benchcard-n">덱에 {n}</span>}
        </button>
        <div className="kc-deckrow-ctl">
          <button type="button" className="kc-btn kc-step" disabled={n === 0} onClick={() => remove(id)} aria-label={`${CARDS[id].name} 빼기`}>
            −
          </button>
          <b className="kc-deckrow-n">
            {n}
            {owned !== undefined && <small>/{owned}</small>}
          </b>
          <button type="button" className="kc-btn kc-step" disabled={block !== null} onClick={() => add(id)} aria-label={`${CARDS[id].name} 넣기`}>
            +
          </button>
        </div>
        {block !== null && <p className="kc-deckrow-why">{block}</p>}
      </div>
    );
  };

  return (
    <div className="kc-bench">
      {craftActive && <p className="kc-note">만들던 무기는 처음 덱 그대로 친다. 고친 덱은 다음 제작부터.</p>}
      <Seg
        label="덱 칸"
        value={grade}
        options={GRADES.map((g) => ({ value: g, label: `${CARD_RECIPE_GRADE_LABEL[g]} 덱` }))}
        onChange={onGrade}
      />
      <section className="kc-panel">
        <div className="kc-kv">
          <span>손패로 오는 카드</span>
          <b>
            {deckHandCount(deck)}장 <small>({DECK_RULES.minCards}~{DECK_RULES.maxCards})</small>
          </b>
        </div>
        <div className="kc-kv">
          <span>해금 카드</span>
          <b className={unlocks > cap ? 'bad' : undefined}>
            {unlocks} / {cap} <small>(명성 {stage}단계)</small>
          </b>
        </div>
        {imprints > 0 && (
          <div className="kc-kv">
            <span>각인</span>
            <b>{imprints}</b>
          </div>
        )}
        {problems.length > 0 ? (
          <ul className="kc-problems" role="status">
            {problems.map((p) => (
              <li key={p.message}>{p.message}</li>
            ))}
          </ul>
        ) : (
          <p className="kc-ok">이 덱으로 칠 수 있다.</p>
        )}
        <div className="kc-row">
          <button type="button" className="kc-btn small" onClick={() => setDeck(dayOneDeck())}>
            1일차 덱으로
          </button>
          {grade !== 'basic' && (
            <button type="button" className="kc-btn small" onClick={() => setDeck([...profile.decks.basic])}>
              기본 덱 가져오기
            </button>
          )}
        </div>
      </section>

      <section className="kc-block">
        <h3>
          기본 카드 <small>장수 제한 없이 갖는다 · 같은 계열 {DECK_RULES.familyLimit.basic}장까지</small>
        </h3>
        <div className="kc-benchgrid">{BASIC_CARD_IDS.map((id) => row(id))}</div>
      </section>

      <section className="kc-block">
        <h3>
          해금 카드 <small>배운 것 · 같은 카드 {DECK_RULES.familyLimit.unlock}장, 첫 손·각인 1장</small>
        </h3>
        {collection.learned.length === 0 && (
          <p className="kc-hint">
            {profile.firstCraftDone ? '아직 배운 카드가 없다.' : '첫 제작을 마치면 1단계 카드를 배운다.'}
          </p>
        )}
        <div className="kc-benchgrid">{UNLOCK_CARD_IDS.filter((id) => learned.has(id)).map((id) => row(id))}</div>
        {notLearned.length > 0 && (
          <details className="kc-later">
            <summary>아직 배우지 않은 카드 {notLearned.length}종</summary>
            <div className="kc-benchgrid">
              {notLearned.map((id) => {
                const node = CARDS[id].unlock;
                const when = node === null ? '' : node.stage === 1 ? '첫 제작 뒤' : `명성 ${node.stage}단계`;
                return (
                  <div key={id} className="kc-benchcard dim">
                    <button type="button" className="kc-benchcard-face" onClick={() => setInfo(id)} aria-label={`${CARDS[id].name} 자세히`}>
                      <GameCard id={id} width={BENCH_CARD_W} floor />
                    </button>
                    <p className="kc-deckrow-why">{when}</p>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </section>

      {ownedEvolved.length > 0 && (
        <section className="kc-block">
          <h3>
            진화 카드 <small>만든 장수만큼 · 원래 카드와 같은 계열로 센다</small>
          </h3>
          <div className="kc-benchgrid">{ownedEvolved.map((id) => row(id, profile.evolved[id] ?? 0))}</div>
        </section>
      )}

      <section className="kc-block">
        <h3>
          단련과 진화 <small>그 카드를 충분히 내면 열린다</small>
        </h3>
        {profile.lab.temperFree && <p className="kc-note">실험: 단련 없이 진화할 수 있다.</p>}
        {evolved !== null && (
          <p className="kc-ok" role="status">
            {evolved}
          </p>
        )}
        {evolvable.map((id) => {
          const need = temperNeed(id) as number;
          const have = profile.temper[id] ?? 0;
          const block = evolveBlock(temperFor(profile, id), id);
          return (
            <div key={id} className={block === null ? 'kc-evo open' : 'kc-evo'}>
              <div className="kc-evo-head">
                <b>{CARDS[id].name}</b>
                <span>
                  단련 {Math.min(have, need)} / {need}
                </span>
              </div>
              <div className="kc-evo-bar">
                <div style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
              </div>
              {block === null ? (
                <div className="kc-evo-branches">
                  {(['power', 'finesse'] as const).map((b) => {
                    const evo = evolutionOf(id, b) as CardId;
                    return (
                      <button key={b} type="button" className="kc-evo-btn" onClick={() => evolve(id, b)}>
                        <small>
                          {EVOLVE_BRANCH_LABEL[b]} · 코스트 {CARDS[evo].cost}
                        </small>
                        <b>{CARDS[evo].name}</b>
                        <span>{cardText(evo)}</span>
                        <i>
                          {evolveCost(id, stage).toLocaleString('ko-KR')}G · 가진 장수 {profile.evolved[evo] ?? 0}
                        </i>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="kc-hint">갈래: {(['power', 'finesse'] as const).map((b) => CARDS[evolutionOf(id, b) as CardId].name).join(' / ')}</p>
              )}
            </div>
          );
        })}
      </section>

      {info !== null && (
        <Sheet title={CARDS[info].name} onClose={() => setInfo(null)}>
          <div className="kc-info-card">
            <GameCard id={info} width={BENCH_INFO_W} />
            <div className="kc-info-side">
              <p>{cardText(info)}</p>
              {(counts.get(info) ?? 0) > 0 && <p className="kc-hint">이 덱에 {counts.get(info)}장.</p>}
            </div>
          </div>
          <button type="button" className="kc-btn" onClick={() => setInfo(null)}>
            닫기
          </button>
        </Sheet>
      )}
    </div>
  );
}
