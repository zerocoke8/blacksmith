// [검증] 실험 패널 (16.3): the rule switches, the smith's stand-ins (명성 단계, 도구), seed and
// craft number, and the play log with its summary and a JSON copy to send with impressions.
// Every switch applies from the next craft.

import { useState } from 'react';
import {
  cardSmithStats,
  cardToolMultiplier,
  furnaceLevel,
  learnedUnlockCards,
  unlockCap,
} from '../../sim/cards/index.ts';
import {
  CARD_RECIPE,
  CARD_RECIPE_GRADE_LABEL,
  COOLING_IRON_STEP,
  FIRE_PRESET_LABEL,
  FIRE_PRESET_SCALE,
  FIRE_PRESETS,
  type FirePreset,
  FURNACE_LEVELS,
  REHEAT_COST,
  REHEAT_COST_RANGE,
} from '../../sim/data/cards.ts';
import { systemClock } from '../../platform/clock.ts';
import { rulesOf } from './flow.ts';
import { Seg, Sheet, Stepper, Toggle } from './parts.tsx';
import { recordsJson, type RecordSummary, summarize, summarizeBySettings } from './record.ts';
import { type CardProfile, LAB_MAX_FAME_STAGE, LAB_MAX_TOOL, type LabSettings, type PlayRecord } from './store.ts';
import { duration } from './text.ts';

interface Props {
  profile: CardProfile;
  records: readonly PlayRecord[];
  craftActive: boolean;
  onLab(update: (lab: LabSettings) => LabSettings): void;
  onProfile(update: (p: CardProfile) => CardProfile): void;
  onClearRecords(): void;
  onResetAll(): void;
}

/** Hand sizes offered: the 화로's, then fixed sizes for the 16.3 #10 comparison. */
const HAND_CHOICES = [4, 5, 6, 7] as const;

/**
 * 레시피 내구도 ±n choices: −20 brings 전설 70 to 50 (16.2의 11번); + makes room for 식는 쇠 to
 * lengthen a craft; −4 squeezes the first turns of 기본 28 (16.3의 1번).
 */
const DURABILITY_DELTAS = [-20, -10, -4, 0, 4, 10, 20] as const;

const signedNum = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

const FIRE_PRESET_NOTE: Record<FirePreset, string> = {
  default: '기획서 확률',
  calm: `보통 아닌 상태 ×${FIRE_PRESET_SCALE.calm}`,
  volatile: `보통 아닌 상태 ×${FIRE_PRESET_SCALE.volatile}`,
  allNormal: '굴림은 늘 보통',
};

/** Copies text: Clipboard API where allowed, the old way on plain http (a phone on the dev server). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Lab({ profile, records, craftActive, onLab, onProfile, onClearRecords, onResetAll }: Props) {
  const lab = profile.lab;
  const [seedText, setSeedText] = useState(String(lab.seed));
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [asking, setAsking] = useState<'records' | 'all' | null>(null);
  const smith = cardSmithStats(lab.tools, [], rulesOf(lab));
  const furnace = furnaceLevel(lab.tools.furnace);
  const learned = learnedUnlockCards(lab.fameStage, profile.firstCraftDone);

  const setTool = (k: 'anvil' | 'whetstone', v: number) =>
    onLab((l) => ({ ...l, tools: { ...l.tools, [k]: Math.max(0, Math.min(LAB_MAX_TOOL, v)) } }));

  const applySeed = (text: string) => {
    setSeedText(text);
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) onLab((l) => ({ ...l, seed: n >>> 0 }));
  };
  const randomSeed = () => {
    // UI-only randomness for a test seed; the sim never sees Math.random.
    const n = Math.floor(Math.random() * 0xffffffff);
    setSeedText(String(n));
    onLab((l) => ({ ...l, seed: n }));
  };

  const json = () => recordsJson(records, systemClock.nowMs());
  const copy = async () => {
    const text = json();
    const ok = await copyText(text);
    setCopied(ok ? 'ok' : 'fail');
    setManual(ok ? null : text);
  };

  const all = summarize(records);
  const groups = summarizeBySettings(records);

  return (
    <div className="kc-lab">
      <p className="kc-note">
        {craftActive ? '만들던 무기는 처음 설정 그대로 친다. 바꾼 것은 다음 제작부터.' : '바꾼 것은 다음 제작부터 적용된다.'}
      </p>

      <section className="kc-panel">
        <h3>규칙 [검증]</h3>
        <h4>손패 장수</h4>
        <Seg
          label="손패 장수"
          cols={5}
          value={lab.handSize ?? 0}
          options={[
            { value: 0, label: '화로', sub: `${furnace.hand}장` },
            ...HAND_CHOICES.map((n) => ({ value: n, label: `${n}장` })),
          ]}
          onChange={(v) => onLab((l) => ({ ...l, handSize: v === 0 ? null : v }))}
        />
        <h4>
          다시 달구기 <small>턴을 끝낼 때 깎이는 내구도 · 기획서 −{REHEAT_COST}</small>
        </h4>
        <Seg
          label="다시 달구기 비용"
          value={lab.reheatCost}
          options={Array.from({ length: REHEAT_COST_RANGE.max - REHEAT_COST_RANGE.min + 1 }, (_, i) => {
            const v = REHEAT_COST_RANGE.min + i;
            return { value: v, label: v === 0 ? '0' : `−${v}` };
          })}
          onChange={(v) => onLab((l) => ({ ...l, reheatCost: v }))}
        />
        <Toggle
          on={lab.coolingIron}
          onChange={(on) => onLab((l) => ({ ...l, coolingIron: on }))}
          label="식는 쇠"
          sub={`한 턴의 n번째 카드는 코스트 +${COOLING_IRON_STEP === 1 ? '' : `${COOLING_IRON_STEP}×`}(n−1)`}
        />
        <h4>
          레시피 내구도{' '}
          <small>
            {(['basic', 'advanced', 'legendary'] as const)
              .map((g) => `${CARD_RECIPE_GRADE_LABEL[g]} ${Math.max(1, CARD_RECIPE.durability[g] + lab.durabilityDelta)}`)
              .join(' · ')}
          </small>
        </h4>
        <Seg
          label="레시피 내구도"
          cols={DURABILITY_DELTAS.length}
          value={lab.durabilityDelta}
          options={DURABILITY_DELTAS.map((d) => ({ value: d, label: signedNum(d) }))}
          onChange={(d) => onLab((l) => ({ ...l, durabilityDelta: d }))}
        />
        <h4>화로 확률</h4>
        <Seg
          label="화로 확률"
          cols={4}
          value={lab.firePreset}
          options={FIRE_PRESETS.map((p) => ({ value: p, label: FIRE_PRESET_LABEL[p], sub: FIRE_PRESET_NOTE[p] }))}
          onChange={(p) => onLab((l) => ({ ...l, firePreset: p }))}
        />
      </section>

      <section className="kc-panel">
        <h3>대장장이</h3>
        <h4>
          명성 단계 <small>덱에 넣는 해금 카드 {unlockCap(lab.fameStage)}장까지 · 배운 카드 {learned.length}종</small>
        </h4>
        <Stepper
          label="명성 단계"
          value={lab.fameStage > 7 ? `★${lab.fameStage - 7}` : `${lab.fameStage}단계`}
          sub={`해금 상한 ${unlockCap(lab.fameStage)}`}
          downDisabled={lab.fameStage <= 1}
          upDisabled={lab.fameStage >= LAB_MAX_FAME_STAGE}
          onDown={() => onLab((l) => ({ ...l, fameStage: Math.max(1, l.fameStage - 1) }))}
          onUp={() => onLab((l) => ({ ...l, fameStage: Math.min(LAB_MAX_FAME_STAGE, l.fameStage + 1) }))}
        />
        <Toggle
          on={profile.firstCraftDone}
          onChange={(on) => onProfile((p) => ({ ...p, firstCraftDone: on }))}
          label="첫 제작을 마쳤다"
          sub="1단계 해금 카드는 첫 제작 뒤에 배운다"
        />
        <h4>
          모루 <small>작업 숙련도 {smith.craftsmanship} (×{cardToolMultiplier('anvil', lab.tools.anvil).toFixed(2)})</small>
        </h4>
        <div className="kc-row">
          <Stepper
            label="모루"
            value={lab.tools.anvil}
            onDown={() => setTool('anvil', lab.tools.anvil - 1)}
            onUp={() => setTool('anvil', lab.tools.anvil + 1)}
            downDisabled={lab.tools.anvil <= 0}
            upDisabled={lab.tools.anvil >= LAB_MAX_TOOL}
          />
          <button type="button" className="kc-btn small" onClick={() => setTool('anvil', lab.tools.anvil + 5)}>
            +5
          </button>
        </div>
        <h4>
          숫돌 <small>가공 숙련도 {smith.control} (×{cardToolMultiplier('whetstone', lab.tools.whetstone).toFixed(2)})</small>
        </h4>
        <div className="kc-row">
          <Stepper
            label="숫돌"
            value={lab.tools.whetstone}
            onDown={() => setTool('whetstone', lab.tools.whetstone - 1)}
            onUp={() => setTool('whetstone', lab.tools.whetstone + 1)}
            downDisabled={lab.tools.whetstone <= 0}
            upDisabled={lab.tools.whetstone >= LAB_MAX_TOOL}
          />
          <button type="button" className="kc-btn small" onClick={() => setTool('whetstone', lab.tools.whetstone + 5)}>
            +5
          </button>
        </div>
        <h4>
          화로 <small>손패 {furnace.hand}장 · 다시 달굴 때 {furnace.keep}장 간직</small>
        </h4>
        <Seg
          label="화로 레벨"
          value={lab.tools.furnace}
          options={FURNACE_LEVELS.map((f, i) => ({ value: i, label: `${i}`, sub: `${f.hand}·${f.keep}` }))}
          onChange={(v) => onLab((l) => ({ ...l, tools: { ...l.tools, furnace: v } }))}
        />
      </section>

      <section className="kc-panel">
        <h3>시드와 제작 번호</h3>
        <p className="kc-hint">같은 시드와 제작 번호면 같은 섞기, 같은 화로 순서가 나온다.</p>
        <div className="kc-row">
          <input
            className="kc-input"
            inputMode="numeric"
            value={seedText}
            onChange={(e) => applySeed(e.target.value)}
            aria-label="시드"
          />
          <button type="button" className="kc-btn" onClick={randomSeed}>
            무작위
          </button>
        </div>
        <div className="kc-row">
          <Stepper
            label="다음 제작 번호"
            value={profile.nextCraftNo}
            sub="다음 제작 번호"
            downDisabled={profile.nextCraftNo <= 1}
            onDown={() => onProfile((p) => ({ ...p, nextCraftNo: Math.max(1, p.nextCraftNo - 1) }))}
            onUp={() => onProfile((p) => ({ ...p, nextCraftNo: p.nextCraftNo + 1 }))}
          />
          <button type="button" className="kc-btn small" onClick={() => onProfile((p) => ({ ...p, nextCraftNo: 1 }))}>
            1로
          </button>
        </div>
      </section>

      <section className="kc-panel">
        <h3>시험용</h3>
        <Toggle
          on={lab.tapToPreview}
          onChange={(on) => onLab((l) => ({ ...l, tapToPreview: on }))}
          label="두 번 눌러 내기"
          sub="첫 번째는 미리 보기 (기획서 4.2.9). 끄면 한 번에 낸다"
        />
        <Toggle
          on={lab.temperFree}
          onChange={(on) => onLab((l) => ({ ...l, temperFree: on }))}
          label="단련 없이 진화"
          sub="진화 갈래를 바로 시험해 본다"
        />
      </section>

      <section className="kc-panel">
        <h3>플레이 기록 {records.length > 0 && <small>{records.length}판</small>}</h3>
        {records.length === 0 ? (
          <p className="kc-hint">아직 기록이 없다. 한 판 치면 여기에 쌓인다.</p>
        ) : (
          <>
            <SummaryView s={all} />
            {groups.length > 1 && (
              <details className="kc-later">
                <summary>설정별 ({groups.length})</summary>
                {groups.map((g) => (
                  <div key={g.label} className="kc-group">
                    <p className="kc-group-label">{g.label}</p>
                    <SummaryView s={g.summary} compact />
                  </div>
                ))}
              </details>
            )}
            <details className="kc-later">
              <summary>최근 판</summary>
              <ol className="kc-recent">
                {[...records]
                  .reverse()
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.id}>
                      <b>
                        {r.result.status === 'success' ? `★${r.result.tier} ${r.result.tierName}` : r.result.abandoned ? '그만둠' : '실패'}
                      </b>{' '}
                      {r.result.qualityPct}% · 손패 {r.hands} · 낸 {r.cardsPlayed} · 버린 {r.cardsDiscarded} · {duration(r.activeSec * 1000)}
                      <small>
                        {r.recipe.material} {r.recipe.weapon} · 제작 {r.craftNo}
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
          <button
            type="button"
            className="kc-btn"
            disabled={records.length === 0}
            onClick={() => download(json(), `blacksmith-cards-${records.length}.json`)}
          >
            파일로 받기
          </button>
          <button type="button" className="kc-btn ghost" disabled={records.length === 0} onClick={() => setAsking('records')}>
            기록 지우기
          </button>
        </div>
        {copied === 'ok' && <p className="kc-ok">복사했다. 감상과 함께 붙여 넣으면 된다.</p>}
        {copied === 'fail' && <p className="kc-why">복사가 막혔다. 아래 글을 길게 눌러 모두 선택해 복사한다.</p>}
        {manual !== null && <textarea className="kc-json" readOnly value={manual} onFocus={(e) => e.currentTarget.select()} />}
      </section>

      <section className="kc-panel">
        <h3>처음부터</h3>
        <p className="kc-hint">덱, 진화, 단련, 설정, 만들던 무기, 기록을 모두 지운다.</p>
        <button type="button" className="kc-btn danger small" onClick={() => setAsking('all')}>
          모두 지우기
        </button>
      </section>

      {asking !== null && (
        <Sheet title={asking === 'all' ? '모두 지우기' : '기록 지우기'} tone="danger" onClose={() => setAsking(null)}>
          <p>{asking === 'all' ? '대장간을 처음 연 날로 돌아간다. 되돌릴 수 없다.' : `플레이 기록 ${records.length}판을 지운다. 되돌릴 수 없다.`}</p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                if (asking === 'all') {
                  onResetAll();
                  setSeedText('1');
                } else onClearRecords();
                setAsking(null);
                setCopied(null);
                setManual(null);
              }}
            >
              지운다
            </button>
            <button type="button" className="kc-btn" onClick={() => setAsking(null)}>
              그만둔다
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SummaryView({ s, compact }: { s: RecordSummary; compact?: boolean }) {
  const rows: [string, string][] = [
    ['판 수', `${s.count}판${s.failures > 0 ? ` (실패 ${s.failures})` : ''}`],
    ['평균 품질', `${s.avgQualityPct}% · 중앙값 ${s.medianQualityPct}%`],
    ['★1~★5', s.tiers.join(' / ')],
    ['평균 시간', `${duration(s.avgActiveSec * 1000)}${s.secPerCard !== null ? ` · 카드 한 장 ${s.secPerCard}초` : ''}`],
  ];
  if (compact !== true) {
    rows.push(['평균 손패 · 낸 · 버린', `${s.avgHands}번 · ${s.avgPlayed}장 · ${s.avgDiscarded}장`]);
    if (s.fullPlayShare !== null) rows.push(['다 내고 끝낸 턴', `${s.fullPlayShare}%`]);
    if (s.emptyTurnShare !== null) rows.push(['카드 없이 넘긴 턴', `${s.emptyTurnShare}%`]);
    if (s.goodTurnShare !== null) rows.push(['좋음·최상 턴', `${s.goodTurnShare}%`]);
    rows.push(['더미 열어 본 횟수', `판당 ${s.avgPileOpens}번`]);
  }
  return (
    <div className="kc-summary">
      {rows.map(([k, v]) => (
        <div key={k} className="kc-kv">
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
      {compact !== true && s.cardUse.length > 0 && (
        <details className="kc-later">
          <summary>카드별 · 낸 / 버린</summary>
          <p className="kc-hint">자주 버린 카드가 위에 온다.</p>
          {s.cardUse.map((u) => (
            <div key={u.card} className="kc-kv">
              <span>{u.card}</span>
              <b>
                {u.played} / {u.discarded}
                {u.played + u.discarded > 0 && <small> (낸 {Math.round((u.played / (u.played + u.discarded)) * 100)}%)</small>}
              </b>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
