// 명예의 전당 (13.13): 전설 용사 카드 50장, 정렬, 잠금, 내보내기, and picking 선대 for the next run
// (13.10). The hall itself is the engine's pure functions; this screen only calls them.

import { useState } from 'react';
import { HALL_SIZE } from '../../sim/data/run.ts';
import { type HallOfFame, type HallSort, hallRemove, hallSetLock, hallSorted, type LegendCard } from '../../sim/run/index.ts';
import { Seg, Sheet } from '../cards/parts.tsx';
import { LegendCardView } from './parts.tsx';
import { HALL_EMPTY_LINE } from './text.ts';

const SORTS: { value: HallSort; label: string }[] = [
  { value: 'record', label: '최고층' },
  { value: 'grade', label: '평가' },
  { value: 'family', label: '가문' },
  { value: 'factors', label: '인자' },
  { value: 'season', label: '시즌' },
];

/** n대: the card's place among the same family's cards in the hall (oldest first). */
export function hallGeneration(hall: HallOfFame, card: LegendCard): number {
  const same = hall.cards.filter((c) => c.family === card.family);
  return same.findIndex((c) => c.id === card.id) + 1;
}

export function Hall(props: {
  hall: HallOfFame;
  onChange(hall: HallOfFame): void;
  /** From the 준비 화면: the ancestors picked so far (2 at most). */
  picking: { selected: readonly string[]; onToggle(id: string): void } | null;
}) {
  const { hall, onChange, picking } = props;
  const [sort, setSort] = useState<HallSort>('record');
  const [letGo, setLetGo] = useState<LegendCard | null>(null);
  const cards = hallSorted(hall, sort);

  return (
    <div className="rn-hall">
      <p className="kc-note">
        {picking !== null
          ? `다음 판의 선대를 둘까지 고른다 (${picking.selected.length} / 2). 같은 가문이면 인자가 한 단계 오른다.`
          : `벽에 걸린 이름 ${hall.cards.length} / ${HALL_SIZE}. 잠근 카드는 내보낼 수 없다.`}
      </p>
      {hall.cards.length === 0 ? (
        <p className="kc-hint center">{HALL_EMPTY_LINE}</p>
      ) : (
        <Seg<HallSort> label="정렬" value={sort} options={SORTS} onChange={setSort} />
      )}
      {cards.map((card) => {
        const locked = hall.locked.includes(card.id);
        const picked = picking?.selected.includes(card.id) ?? false;
        return (
          <LegendCardView key={card.id} card={card} generation={hallGeneration(hall, card)} compact>
            <div className="kc-row">
              {picking !== null && (
                <button
                  type="button"
                  className={picked ? 'kc-btn small primary' : 'kc-btn small'}
                  disabled={!picked && picking.selected.length >= 2}
                  aria-pressed={picked}
                  onClick={() => picking.onToggle(card.id)}
                >
                  {picked ? '선대로 골랐다' : '선대로'}
                </button>
              )}
              <button type="button" className="kc-btn ghost small" aria-pressed={locked} onClick={() => onChange(hallSetLock(hall, card.id, !locked))}>
                {locked ? '잠금 풀기' : '잠그기'}
              </button>
              {!locked && picking === null && (
                <button type="button" className="kc-btn ghost small" onClick={() => setLetGo(card)}>
                  내보내기
                </button>
              )}
            </div>
          </LegendCardView>
        );
      })}
      {letGo !== null && (
        <Sheet title="내보내기" tone="danger" onClose={() => setLetGo(null)}>
          <p>
            「{letGo.weaponName}」의 주인을 벽에서 내린다. 이름과 기록은 마음에만 남는다.
          </p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                onChange(hallRemove(hall, letGo.id));
                setLetGo(null);
              }}
            >
              내린다
            </button>
            <button type="button" className="kc-btn" onClick={() => setLetGo(null)}>
              그대로 둔다
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
