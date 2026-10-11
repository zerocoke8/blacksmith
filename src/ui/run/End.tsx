// 판 끝 (13.12, 13.17): 은퇴 장면이나 마지막 등반 → 평가 → 전설 용사 카드 (인자가 하나씩 뒤집힌다) →
// 그 세대의 하이라이트 → 명예의 전당에 건다. 구매 버튼과 광고는 없다 (15.1).

import { type CSSProperties, useState } from 'react';
import { HALL_SIZE, RUN_GRADE_SPEC, SCORE } from '../../sim/data/run.ts';
import { FAMILIES } from '../../sim/data/families.ts';
import {
  HALL_LINE,
  hallAddBlock,
  type HallOfFame,
  hallSorted,
  type RunState,
  type RunWeapon,
  seasonFloor,
  topic,
  weaponTitle,
} from '../../sim/run/index.ts';
import { LegendCardView } from './parts.tsx';
import type { RunMeta } from './store.ts';
import { NEXT_RUN_LINE, pct } from './text.ts';

const ORIGIN: Record<RunWeapon['origin'], string> = { basic: '기본 무기', ancestor: '선대의 무기', forged: '단조' };

export function End(props: {
  run: RunState;
  meta: RunMeta;
  hall: HallOfFame;
  onHang(evictId: string | null): void;
  onDecline(): void;
  onNext(): void;
}) {
  const { run, meta, hall, onHang, onDecline, onNext } = props;
  const [evict, setEvict] = useState<string | null>(null);
  const end = run.end;
  const result = run.result;
  if (end === null || result === null) return null;
  const fam = FAMILIES[run.setup.hero.family];
  const score = result.score;
  const spare = score.spare / SCORE.perSpareTurn;
  const bonds = score.bond / SCORE.perBond;
  const hung = meta.hallId !== null;
  const settled = hung || meta.hallDeclined;
  const full = hallAddBlock(hall) !== null;
  const evictable = hallSorted(hall, 'record')
    .filter((c) => !hall.locked.includes(c.id))
    .reverse();
  const weapons: RunWeapon[] = [...run.rack, run.weapon];

  return (
    <div className="rn-end">
      <section className={`rn-scene k-${end.kind}`} style={{ '--fam': fam.color } as CSSProperties}>
        <p className="rn-scene-line">{end.line}</p>
        <small>
          {end.turn}턴 · 최고 {run.record}층
        </small>
      </section>

      <section className="kc-panel rn-score">
        <h3>평가</h3>
        <div className="kc-kv">
          <span>최고 도달층 {run.record} × {SCORE.perFloor}</span>
          <b>{score.floors.toLocaleString('ko-KR')}</b>
        </div>
        <div className="kc-kv">
          <span>벽 여유 {spare}턴 × {SCORE.perSpareTurn}</span>
          <b>{score.spare.toLocaleString('ko-KR')}</b>
        </div>
        <div className="kc-kv">
          <span>{run.stats.bestQuality > 0 ? `가장 좋은 무기 ★${run.stats.bestQuality} × ${SCORE.perStar}` : '지은 무기 없음'}</span>
          <b>{score.weapon.toLocaleString('ko-KR')}</b>
        </div>
        <div className="kc-kv">
          <span>유대 합 {bonds} × {SCORE.perBond}</span>
          <b>{score.bond.toLocaleString('ko-KR')}</b>
        </div>
        <div className="kc-kv rn-total">
          <span>합</span>
          <b>{score.total.toLocaleString('ko-KR')}점</b>
        </div>
        <p className="rn-grade">{RUN_GRADE_SPEC[result.grade].label}</p>
      </section>

      <LegendCardView card={result.legend} flip />
      {run.weapon.origin === 'ancestor' && (
        <p className="kc-hint center">
          「{result.weaponName}」{topic(result.weaponName).slice(result.weaponName.length)} 선대에게서 이은 이름이다. 이름과 전적은 무기를 따라간다.
        </p>
      )}

      <section className="kc-panel">
        <h3>이 세대</h3>
        <h4>넘은 벽</h4>
        <ul className="rn-highlights">
          {run.walls.map((w) => (
            <li key={w.floor} className={w.passedTurn !== null ? 'ok' : 'no'}>
              {w.floor}층 {seasonFloor(run.setup.season, w.floor).name} —{' '}
              {w.passedTurn !== null ? `${w.passedTurn}턴 (마감 ${w.deadline}턴)` : '넘지 못했다'}
            </li>
          ))}
        </ul>
        <h4>들었던 무기</h4>
        <ul className="rn-highlights">
          {weapons.map((w, i) => (
            <li key={`${w.weapon.id}-${i}`}>
              {weaponTitle(w.weapon)}
              <small>
                {' '}
                {ORIGIN[w.origin]}
                {w.forgeNo !== null && ` ${w.forgeNo}`} ·{' '}
                {w.neverHeld === true ? `${w.since}턴에 지어 바로 걸이에` : `${w.since === 0 ? '판 시작' : `${w.since}턴`}부터`}
                {w === run.weapon && ` · 「${result.weaponName}」`}
                {w !== run.weapon && w.name !== null && ` · 「${w.name}」`}
              </small>
            </li>
          ))}
        </ul>
        <p className="kc-hint">
          단조 {run.stats.forges}번{run.stats.forgeFails > 0 ? ` (실패 ${run.stats.forgeFails})` : ''} · 부상 {run.stats.injuries}번 · 남은 판 골드{' '}
          {run.gold.toLocaleString('ko-KR')}G · HP {pct(run.hp)}
        </p>
      </section>

      <section className="kc-panel rn-hang">
        <p className="rn-quote">{HALL_LINE}</p>
        {hung ? (
          <p className="kc-ok">명예의 전당에 걸렸다. 다음 판의 선대로 고를 수 있다.</p>
        ) : meta.hallDeclined ? (
          <p className="kc-hint">이번 이름은 걸지 않았다.</p>
        ) : !full ? (
          <button type="button" className="kc-btn primary big" onClick={() => onHang(null)}>
            이름을 벽에 건다
          </button>
        ) : (
          <>
            <p className="kc-hint">벽이 가득하다 ({HALL_SIZE}장). 하나를 내려야 건다. 잠근 카드는 내릴 수 없다.</p>
            <div className="rn-pick-list">
              {evictable.map((c) => (
                <button key={c.id} type="button" className={evict === c.id ? 'rn-pick-row on' : 'rn-pick-row'} onClick={() => setEvict(c.id)}>
                  <span>
                    <b>{`${RUN_GRADE_SPEC[c.grade].label} ${FAMILIES[c.family].name}`}</b>
                    <small>
                      최고 {c.record}층 · {c.score.toLocaleString('ko-KR')}점 · 「{c.weaponName}」
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className="kc-row">
              <button type="button" className="kc-btn primary" disabled={evict === null} onClick={() => onHang(evict)}>
                내리고 건다
              </button>
              <button type="button" className="kc-btn ghost" onClick={onDecline}>
                걸지 않는다
              </button>
            </div>
          </>
        )}
      </section>

      <p className="kc-hint center">{NEXT_RUN_LINE}</p>
      <button type="button" className="kc-btn big" disabled={!settled} onClick={onNext}>
        다음 판을 준비한다
      </button>
    </div>
  );
}
