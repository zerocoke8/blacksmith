// 원정 결과 (13.17): the floors come out one by one like a fast 관전 띠 (no band art yet: text and
// bars), a tap skips to the end, then the 결과 카드 (오른 층, 레벨, 골드, 재료, 부상). A boss floor is
// staged (13.17 벽: 보스전 연출): its name and odds stand alone first, then the result, then a full-width
// line when it falls; the 마지막 등반 counts its floors in big type. Everything shown is the engine's
// own log of the climb (RunExpeditionLog).

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { enchantMaterialLabel } from '../../sim/cards/index.ts';
import { BODY_LABEL } from '../../sim/data/common.ts';
import { POLICY_LABEL, SEASONS, type SeasonId } from '../../sim/data/run.ts';
import { bossDownLine, fillLine, type RunFloorLog, type RunTurnLog, subj } from '../../sim/run/index.ts';
import { reducedMotion } from '../cards/parts.tsx';
import { ElementTag } from './parts.tsx';
import { FLOOR_RESULT_LABEL, goldText, pct, RETURN_LABEL } from './text.ts';

/** 13.6: 층당 0.3초, 보스 3초 for the band. Text: the boss stands alone, then its result, then a beat. */
const FLOOR_MS = 300;
const BOSS_MS = 1600;
const DEMON_MS = 2400;
const AFTER_BOSS_MS = 1000;

/** The line a boss floor ends on: the 악마's own (13.7 문장 예), '…을 넘었다', or the one that stopped the climb. */
function bossBeat(season: SeasonId, f: RunFloorLog): string {
  if (!f.cleared) return `${subj(f.name)} 막아섰다.`;
  return f.kind === 'demonLord' ? fillLine(SEASONS[season].demonLine, { demon: f.name }) : bossDownLine(f.name);
}

function modeLabel(log: RunTurnLog): string {
  const e = log.expedition;
  if (e === null) return '';
  if (e.mode === 'wall') return '벽 도전';
  if (e.mode === 'climb') return '마지막 등반';
  return `원정 · ${POLICY_LABEL[e.policy]}`;
}

export function ExpeditionResult(props: { log: RunTurnLog; season: SeasonId; bossReward: boolean; onDone(skipped: boolean): void }) {
  const { log, season, bossReward, onDone } = props;
  const e = log.expedition;
  const total = e?.floors.length ?? 0;
  const [shown, setShown] = useState(() => (reducedMotion() ? total : 0));
  const [skipped, setSkipped] = useState(false);
  const listEnd = useRef<HTMLLIElement | null>(null);
  const done = shown >= total;

  useEffect(() => {
    if (e === null || shown >= total) return;
    const next = e.floors[shown];
    const prev = e.floors[shown - 1];
    const ms =
      next !== undefined && next.kind !== 'normal'
        ? next.kind === 'demonLord'
          ? DEMON_MS
          : BOSS_MS
        : prev !== undefined && prev.kind !== 'normal'
          ? AFTER_BOSS_MS
          : FLOOR_MS;
    const t = window.setTimeout(() => setShown((n) => n + 1), ms);
    return () => window.clearTimeout(t);
  }, [e, shown, total]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [shown]);

  if (e === null) return null;
  const skip = () => {
    if (done) return;
    setShown(total);
    setSkipped(true);
  };
  const cleared = e.floors.filter((f) => f.cleared);
  const hpAfter = e.floors.length === 0 ? log.hpBefore : log.hpAfter;
  const coming = done ? undefined : e.floors[shown];
  const at = e.floors[Math.max(0, shown - 1)];
  const climb = e.mode === 'climb';

  return (
    <div className="rn-exp">
      <header className="rn-exp-head">
        <b>{modeLabel(log)}</b>
        <span>
          {log.turn}턴 · {e.startFloor}층부터
        </span>
        {shown > 0 && at !== undefined && (
          <span className={climb ? 'rn-exp-count big' : 'rn-exp-count'} aria-live="off">
            {at.floor}층
          </span>
        )}
      </header>
      <ol className="rn-floors" onClick={skip} aria-live="polite">
        {e.floors.slice(0, shown).map((f) => (
          <FloorBeat key={f.floor} f={f} season={season} />
        ))}
        {coming !== undefined && coming.kind !== 'normal' ? (
          <li className={`rn-floor pending boss${coming.kind === 'demonLord' ? ' demon' : ''}`} ref={listEnd}>
            <span className="rn-floor-no">{coming.floor}</span>
            <span className="rn-floor-main">
              <span className="rn-floor-name">
                <i className="rn-boss-tag">{coming.kind === 'demonLord' ? '악마' : '보스'}</i>
                <b>{coming.name}</b> 앞에 섰다
              </span>
              <span className="rn-floor-odds">
                R {coming.r.toFixed(2)} · 돌파 {pct(coming.chance)} · HP {pct(coming.hp)}
              </span>
            </span>
          </li>
        ) : (
          !done && (
            <li className="rn-floor pending" ref={listEnd}>
              …
            </li>
          )
        )}
        {done && <li ref={listEnd} className="rn-floor-end" aria-hidden="true" />}
      </ol>

      {done ? (
        <section className="rn-exp-sum">
          <div className="rn-exp-nums">
            <span>
              오른 층 <b>{cleared.length}</b>
            </span>
            <span>
              골드 <b>+{goldText(e.gold)}</b>
            </span>
            <span>
              레벨 <b>{e.levelBefore === e.levelAfter ? e.levelAfter : `${e.levelBefore} → ${e.levelAfter}`}</b>
            </span>
            <span>
              HP <b>{`${pct(log.hpBefore)} → ${pct(hpAfter)}`}</b>
            </span>
          </div>
          <p className="kc-hint">{RETURN_LABEL[e.end]}</p>
          {e.finds.length > 0 && (
            <p className="rn-finds">주운 것: {e.finds.map((k) => enchantMaterialLabel(k)).join(', ')}</p>
          )}
          <div className="rn-lines">
            {log.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          {bossReward && <p className="kc-hint">보스 보상이 기다린다.</p>}
          <button type="button" className="kc-btn primary big" onClick={() => onDone(skipped)}>
            계속
          </button>
        </section>
      ) : (
        <button type="button" className="kc-btn big" onClick={skip}>
          건너뛰기
        </button>
      )}
    </div>
  );
}

/** A floor, and after a boss floor its line across the band. */
function FloorBeat({ f, season }: { f: RunFloorLog; season: SeasonId }) {
  return (
    <>
      <FloorRow f={f} />
      {f.kind !== 'normal' && <li className={`rn-beat${f.cleared ? '' : ' bad'}${f.kind === 'demonLord' ? ' demon' : ''}`}>{bossBeat(season, f)}</li>}
    </>
  );
}

function FloorRow({ f }: { f: RunFloorLog }) {
  const boss = f.kind !== 'normal';
  const hpEnd = Math.max(0, f.hp - f.hpLoss);
  const cls = ['rn-floor', boss ? 'boss' : '', f.cleared ? 'ok' : 'fail'].filter(Boolean).join(' ');
  return (
    <li className={cls} style={{ '--hp': hpEnd } as CSSProperties}>
      <span className="rn-floor-no">{f.floor}</span>
      <span className="rn-floor-main">
        <span className="rn-floor-name">
          {boss && <i className="rn-boss-tag">{f.kind === 'demonLord' ? '악마' : '보스'}</i>}
          <b>{f.name}</b> <small>{BODY_LABEL[f.body]}</small> <ElementTag element={f.element} />
        </span>
        <span className="rn-floor-odds">
          R {f.r.toFixed(2)} · 돌파 {pct(f.chance)}
          {f.dull && ' · 무뎌짐'}
          {f.find !== null && ` · ${enchantMaterialLabel(f.find)}`}
        </span>
        <span className="rn-floor-bars">
          <span className="rn-mini hp" style={{ width: `${hpEnd * 100}%` }} />
          <span className="rn-mini dur" style={{ width: `${Math.max(0, f.durability) * 100}%` }} />
        </span>
      </span>
      <span className="rn-floor-res">
        {f.cleared ? '돌파' : FLOOR_RESULT_LABEL[f.result ?? 'safe']}
        <small>
          HP {pct(hpEnd)} · 내구 {pct(f.durability)}
        </small>
      </span>
    </li>
  );
}
