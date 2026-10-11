// [검증] 실험 패널 (16.3의 11~19번): 성급, 턴 수, 벽 일정, 판 안의 사망, 사건 빈도, 단조 간이 모드,
// 판 손패, 후반 층 수입, 시드. Every switch applies from the next run. The play log lives here too: a
// summary per setting (runs under different switches are not one sample), recent runs, and a JSON
// copy to send with impressions.

import { useState } from 'react';
import { systemClock } from '../../platform/clock.ts';
import {
  DEATH_MODE_LABEL,
  type DeathMode,
  LATE_GOLD_FROM_FLOOR,
  RUN_HAND_SIZE,
  RUN_HAND_SIZE_RANGE,
  RUN_TURNS,
  RUN_TURNS_RANGE,
  STAR_SPEC,
  STARS,
  WALL_PRESET_LABEL,
  WALL_PRESETS,
} from '../../sim/data/run.ts';
import { resolveRunRules, type RunState, wallDeadlines } from '../../sim/run/index.ts';
import { setArtScreen, useArtScreen } from '../cards/artPref.ts';
import { copyText, download } from '../cards/Lab.tsx';
import { Seg, Sheet, Stepper, Toggle } from '../cards/parts.tsx';
import { duration } from '../cards/text.ts';
import { forgeResultLabel, runRecordsJson, type RunRecord, settingsLabel, summarizeRuns, type RunSummary } from './record.ts';
import { RUN_RECORD_LIMIT, type RunLab, rulesOfLab } from './store.ts';
import { rulesLine, starText } from './text.ts';

const EVENT_RATES = [0, 0.5, 1, 1.5, 2, 3] as const;
const TURN_PRESETS = [20, 30, 40] as const;
const LATE_GOLD_RATES = [1, 0.75, 0.5, 0.25] as const;
const HAND_SIZES = Array.from({ length: RUN_HAND_SIZE_RANGE.max - RUN_HAND_SIZE_RANGE.min + 1 }, (_, i) => RUN_HAND_SIZE_RANGE.min + i);

interface Props {
  lab: RunLab;
  records: readonly RunRecord[];
  run: RunState | null;
  hallCount: number;
  onLab(update: (lab: RunLab) => RunLab): void;
  /** 지금 판을 기록 없이 접는다. */
  onDropRun(): void;
  onClearRecords(): void;
  onClearHall(): void;
}

type Ask = 'drop' | 'records' | 'hall';

export function RunLabPanel({ lab, records, run, hallCount, onLab, onDropRun, onClearRecords, onClearHall }: Props) {
  const [seedText, setSeedText] = useState(String(lab.seed));
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const deadlines = wallDeadlines(resolveRunRules(rulesOfLab(lab)));
  // Summary per setting, the newest run's setting first (the JSON copy keeps every run).
  const groups = [...new Set([...records].reverse().map(settingsLabel))];
  const picked = group !== null && groups.includes(group) ? group : (groups[0] ?? null);
  const inGroup = picked === null ? records : records.filter((r) => settingsLabel(r) === picked);

  const applySeed = (text: string) => {
    setSeedText(text);
    const n = Number.parseInt(text, 10);
    if (Number.isSafeInteger(n) && n >= 0) onLab((l) => ({ ...l, seed: n }));
  };
  const randomSeed = () => {
    // UI-only randomness for a test seed; the sim never sees Math.random.
    const n = Math.floor(Math.random() * 1_000_000_000);
    setSeedText(String(n));
    onLab((l) => ({ ...l, seed: n }));
  };
  const json = () => runRecordsJson(records, systemClock.nowMs());
  const copy = async () => {
    const text = json();
    const ok = await copyText(text);
    setCopied(ok ? 'ok' : 'fail');
    setManual(ok ? null : text);
  };

  const artScreen = useArtScreen();

  return (
    <div className="kc-lab">
      <p className="kc-note">
        {run !== null && run.phase !== 'over'
          ? `지금 판은 처음 설정 그대로 간다 (${starText(run.setup.hero.star)} · ${rulesLine(run.rules)}). 바꾼 것은 다음 판부터.`
          : '바꾼 것은 다음 판부터 적용된다.'}
      </p>

      <section className="kc-panel">
        <h3>화면</h3>
        <Toggle
          on={artScreen}
          onChange={setArtScreen}
          label="아트 화면"
          sub="단조를 대장간 장면과 카드 연출로 친다. 끄면 예전 화면"
        />
      </section>

      <section className="kc-panel">
        <h3>성급 [검증]</h3>
        <p className="kc-hint">뽑기와 조각은 이 프로토타입 밖이다. 성급을 여기서 고른다 (13.5).</p>
        <h4>
          주인공 <small>시작 힘 {STAR_SPEC[lab.star].startPower.toFixed(2)} · 상한 {STAR_SPEC[lab.star].powerCap.toFixed(2)} · 고유 카드 레벨 {STAR_SPEC[lab.star].cardLevel} · 계승 칸 {STAR_SPEC[lab.star].inheritSlots}</small>
        </h4>
        <Seg label="주인공 성급" value={lab.star} options={STARS.map((s) => ({ value: s, label: starText(s) }))} onChange={(star) => onLab((l) => ({ ...l, star }))} />
        <h4>
          동료 <small>보유 가문 칸. 시즌 칸은 빌린 1성</small>
        </h4>
        <Seg
          label="동료 성급"
          value={lab.companionStar}
          options={STARS.map((s) => ({ value: s, label: starText(s) }))}
          onChange={(companionStar) => onLab((l) => ({ ...l, companionStar }))}
        />
      </section>

      <section className="kc-panel">
        <h3>판 규칙 [검증]</h3>
        <h4>
          턴 수 <small>기획서 {RUN_TURNS}턴. 벽 마감과 시즌 사건이 길이에 맞춰 늘고 준다</small>
        </h4>
        <div className="kc-row">
          <Stepper
            label="턴 수"
            value={`${lab.turns}턴`}
            downDisabled={lab.turns <= RUN_TURNS_RANGE.min}
            upDisabled={lab.turns >= RUN_TURNS_RANGE.max}
            onDown={() => onLab((l) => ({ ...l, turns: Math.max(RUN_TURNS_RANGE.min, l.turns - 1) }))}
            onUp={() => onLab((l) => ({ ...l, turns: Math.min(RUN_TURNS_RANGE.max, l.turns + 1) }))}
          />
          {TURN_PRESETS.map((t) => (
            <button key={t} type="button" className={lab.turns === t ? 'kc-btn small primary' : 'kc-btn small'} onClick={() => onLab((l) => ({ ...l, turns: t }))}>
              {t}
            </button>
          ))}
        </div>
        <h4>
          벽 일정 <small>마감 {deadlines.join(' · ')}턴</small>
        </h4>
        <Seg
          label="벽 일정"
          value={lab.wallPreset}
          options={WALL_PRESETS.map((p) => ({ value: p, label: WALL_PRESET_LABEL[p] }))}
          onChange={(wallPreset) => onLab((l) => ({ ...l, wallPreset }))}
        />
        <h4>
          판 안의 사망 <small>추천은 중상: 다음 턴 휴식 + 부상 (13.4.2)</small>
        </h4>
        <Seg
          label="판 안의 사망"
          value={lab.deathMode}
          options={(Object.keys(DEATH_MODE_LABEL) as DeathMode[]).map((m) => ({
            value: m,
            label: DEATH_MODE_LABEL[m],
            sub: m === 'severe' ? '판이 이어진다' : '판이 끝난다',
          }))}
          onChange={(deathMode) => onLab((l) => ({ ...l, deathMode }))}
        />
        <h4>
          사건 빈도 <small>행상·동료 사연·떠돌이 장인·재료 발견의 확률 배율</small>
        </h4>
        <Seg
          label="사건 빈도"
          cols={EVENT_RATES.length}
          value={lab.eventRate}
          options={EVENT_RATES.map((r) => ({ value: r, label: `×${r}` }))}
          onChange={(eventRate) => onLab((l) => ({ ...l, eventRate }))}
        />
        <Toggle
          on={lab.quickForge}
          onChange={(quickForge) => onLab((l) => ({ ...l, quickForge }))}
          label="단조 간이 모드"
          sub="카드 제작 없이 품질을 바로 정한다. 판 흐름만 빨리 볼 때"
        />
        <h4>
          판 손패 <small>기획서 {RUN_HAND_SIZE}장 (화로 손질은 그 위에 +1). 걸작이 너무 쉬운지 볼 때</small>
        </h4>
        <Seg
          label="판 손패"
          cols={HAND_SIZES.length}
          value={lab.handSize}
          options={HAND_SIZES.map((n) => ({ value: n, label: `${n}장` }))}
          onChange={(handSize) => onLab((l) => ({ ...l, handSize }))}
        />
        <h4>
          {LATE_GOLD_FROM_FLOOR}층부터 층 수입 <small>기획서 ×1. 판 골드가 후반에 남는지 볼 때 (16.2의 15번)</small>
        </h4>
        <Seg
          label="후반 층 수입"
          cols={LATE_GOLD_RATES.length}
          value={lab.lateGoldRate}
          options={LATE_GOLD_RATES.map((r) => ({ value: r, label: `×${r}` }))}
          onChange={(lateGoldRate) => onLab((l) => ({ ...l, lateGoldRate }))}
        />
        <Toggle
          on={lab.tapToPreview}
          onChange={(tapToPreview) => onLab((l) => ({ ...l, tapToPreview }))}
          label="두 번 눌러 내기"
          sub="단조에서 카드를 첫 번째 누르면 미리 보기 (4.2.9). 바로 적용"
        />
      </section>

      <section className="kc-panel">
        <h3>판 시드</h3>
        <p className="kc-hint">같은 시드와 같은 행동이면 같은 판이 나온다 (13.16).</p>
        <div className="kc-row">
          <input className="kc-input" inputMode="numeric" value={seedText} onChange={(e) => applySeed(e.target.value)} aria-label="판 시드" />
          <button type="button" className="kc-btn" onClick={randomSeed}>
            무작위
          </button>
        </div>
        <Toggle
          on={lab.seedStep}
          onChange={(seedStep) => onLab((l) => ({ ...l, seedStep }))}
          label="판마다 다음 시드로"
          sub="끄면 같은 시드를 다시 오른다"
        />
      </section>

      <section className="kc-panel">
        <h3>플레이 기록 {records.length > 0 && <small>{records.length}판</small>}</h3>
        {records.length === 0 ? (
          <p className="kc-hint">아직 기록이 없다. 한 판이 끝나면 여기에 쌓인다 (최근 {RUN_RECORD_LIMIT}판까지).</p>
        ) : (
          <>
            {groups.length > 1 && (
              <div className="rn-groups" role="group" aria-label="설정별 요약">
                {groups.map((g) => (
                  <button key={g} type="button" className={g === picked ? 'kc-btn small primary' : 'kc-btn small'} onClick={() => setGroup(g)}>
                    {g} <small>{records.filter((r) => settingsLabel(r) === g).length}판</small>
                  </button>
                ))}
              </div>
            )}
            {picked !== null && <p className="kc-hint">{groups.length > 1 ? '이 설정의 판만 모았다.' : `설정: ${picked}`}</p>}
            <SummaryView s={summarizeRuns(inGroup)} />
            <details className="kc-later">
              <summary>최근 판</summary>
              <ol className="kc-recent">
                {[...records]
                  .reverse()
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.id}>
                      <b>{r.result.title}</b> · 최고 {r.result.record}층 · {r.result.score.toLocaleString('ko-KR')}점 · {duration(r.activeSec * 1000)}
                      <small>
                        {r.hero.name} {r.hero.star}성 · {r.end.label} · 단조 {r.forges.map(forgeResultLabel).join(', ') || '없음'}
                      </small>
                    </li>
                  ))}
              </ol>
            </details>
          </>
        )}
        <div className="kc-row">
          <button type="button" className="kc-btn primary" disabled={records.length === 0} onClick={() => void copy()}>
            JSON 복사
          </button>
          <button type="button" className="kc-btn" disabled={records.length === 0} onClick={() => download(json(), `blacksmith-runs-${records.length}.json`)}>
            파일로 받기
          </button>
          <button type="button" className="kc-btn ghost" disabled={records.length === 0} onClick={() => setAsk('records')}>
            기록 지우기
          </button>
        </div>
        {copied === 'ok' && <p className="kc-ok">복사했다. 감상과 함께 붙여 넣으면 된다.</p>}
        {copied === 'fail' && <p className="kc-why">복사가 막혔다. 아래 글을 길게 눌러 모두 선택해 복사한다.</p>}
        {manual !== null && <textarea className="kc-json" readOnly value={manual} onFocus={(e) => e.currentTarget.select()} />}
      </section>

      <section className="kc-panel">
        <h3>정리</h3>
        <div className="kc-row">
          <button type="button" className="kc-btn danger small" disabled={run === null} onClick={() => setAsk('drop')}>
            지금 판을 접는다
          </button>
          <button type="button" className="kc-btn ghost small" disabled={hallCount === 0} onClick={() => setAsk('hall')}>
            명예의 전당 비우기
          </button>
        </div>
        <p className="kc-hint">끝나지 않은 판을 접으면 기록도, 전설 용사 카드도 남지 않는다.</p>
      </section>

      {ask !== null && (
        <Sheet title={ask === 'drop' ? '판을 접는다' : ask === 'records' ? '기록 지우기' : '명예의 전당 비우기'} tone="danger" onClose={() => setAsk(null)}>
          <p>
            {ask === 'drop'
              ? '지금 판을 기록 없이 버린다. 되돌릴 수 없다.'
              : ask === 'records'
                ? `플레이 기록 ${records.length}판을 지운다. 되돌릴 수 없다.`
                : `벽에 걸린 이름 ${hallCount}개를 모두 내린다. 잠근 카드도 내린다.`}
          </p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                if (ask === 'drop') onDropRun();
                else if (ask === 'records') {
                  onClearRecords();
                  setCopied(null);
                  setManual(null);
                } else onClearHall();
                setAsk(null);
              }}
            >
              {ask === 'drop' ? '접는다' : '지운다'}
            </button>
            <button type="button" className="kc-btn" onClick={() => setAsk(null)}>
              그만둔다
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SummaryView({ s }: { s: RunSummary }) {
  const rows: [string, string][] = [
    ['판 수', `${s.count}판 · 악마를 넘은 판 ${s.demonShare}%`],
    ['최고층', `평균 ${s.avgRecord} · 중앙 ${s.medianRecord}`],
    ['평가', `평균 ${s.avgScore.toLocaleString('ko-KR')}점 · ${Object.entries(s.grades).map(([k, v]) => `${k} ${v}`).join(', ')}`],
    ['멈춘 곳', Object.entries(s.stops).map(([k, v]) => `${k} ${v}`).join(', ')],
    ['단조', `판당 ${s.avgForges}번${s.avgForgeQuality !== null ? ` · 평균 ★${s.avgForgeQuality}` : ''}${s.forgeFails > 0 ? ` · 실패 ${s.forgeFails}` : ''}`],
    ['판 시간', `평균 ${s.avgActiveMin}분 · 준비 ${s.avgPrepSec}초`],
    ['턴마다 고민', `중앙 ${s.medianThinkSec}초`],
    ['행동', Object.entries(s.actionShare).map(([k, v]) => `${k} ${v}%`).join(' · ')],
    ['사건', `판당 ${s.avgEvents}개`],
  ];
  if (s.skipShare !== null) rows.push(['원정 결과 건너뜀', `${s.skipShare}%`]);
  if (s.avgGoldAtClimb !== null) rows.push(['마지막 등반 앞 판 골드', `평균 ${s.avgGoldAtClimb.toLocaleString('ko-KR')}G`]);
  return (
    <div className="kc-summary">
      {rows.map(([k, v]) => (
        <div key={k} className="kc-kv">
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}
