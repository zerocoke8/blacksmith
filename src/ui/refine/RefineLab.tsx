// [검증] 실험 패널 for 광석 정제 (16.3의 22~24번): test shortcuts (lumps, time), the sound and vibration switches,
// the result table's odds, the seed and 정제 번호, and the play log with a JSON copy to send with
// impressions. The shortcuts change the save the way time and play would; they never touch how
// a blow is decided.

import { useState, useSyncExternalStore } from 'react';
import { sound } from '../../platform/audio.ts';
import { haptics, WEB_PATTERNS } from '../../platform/haptics.ts';
import { itemArtUrl } from '../../render/refine/assets.ts';
import { RARITY_LABEL, REFINE_BATCH_MAX, REFINE_LUMPS, REFINE_LUMPS_PER_HOUR, REFINE_MULTS } from '../../sim/data/refine.ts';
import { rarityOdds, refineOdds } from '../../sim/refine/index.ts';
import { copyText } from '../cards/Lab.tsx';
import { Sheet, Toggle } from '../cards/parts.tsx';
import { type RefineSave, summarizeVisits, visitsJson } from './store.ts';
import { num, percent } from './text.ts';

interface Props {
  save: RefineSave;
  onClose(): void;
  onAddLumps(n: number): void;
  /** Move time on by this many minutes (as if the player had been away). */
  onFastForward(minutes: number): void;
  onClearLog(): void;
  onResetAll(): void;
}

/** The test pile (16.3: try the multipliers on a big pile without waiting). */
const TEST_LUMPS = 500;

export function RefineLab(props: Props) {
  const { save } = props;
  const hapticsOn = useSyncExternalStore(haptics.subscribe, haptics.enabled, haptics.enabled);
  const firm = useSyncExternalStore(haptics.subscribe, () => haptics.strength() === 'firm', () => false);
  const soundOn = useSyncExternalStore(sound.subscribe, sound.enabled, sound.enabled);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const odds = refineOdds();
  const rarity = rarityOdds();
  const sum = summarizeVisits(save.visits);
  const pressCount = sum.taps + sum.holds;
  const avgGold = odds.reduce((s, o) => s + (o.kind === 'gold' ? o.chance * ((o.min + o.max) / 2) : 0), 0);

  return (
    <Sheet title="실험" onClose={props.onClose}>
      <div className="rf-lab">
        <section>
          <h4>시험용</h4>
          <div className="rf-lab-row">
            <button type="button" className="kc-btn small" onClick={() => props.onAddLumps(TEST_LUMPS)}>
              덩어리 +{TEST_LUMPS}
            </button>
            <button type="button" className="kc-btn small" onClick={() => props.onFastForward(60)}>
              시간 +1시간
            </button>
            <button type="button" className="kc-btn small" onClick={() => props.onFastForward(12 * 60)}>
              시간 +12시간
            </button>
          </div>
          <p className="kc-hint">
            덩어리는 {REFINE_LUMPS_PER_HOUR}개/시간, {num(REFINE_LUMPS.cap)}개까지 쌓인다. 시간을 감으면 자리를 비운 셈이 된다.
            덩어리 +{TEST_LUMPS}은 상한을 넘겨도 넣는다.
          </p>
        </section>

        <section>
          <h4>소리와 진동</h4>
          <Toggle
            on={soundOn}
            onChange={(on) => sound.setEnabled(on)}
            label="망치 소리"
            sub={sound.supported() ? '칠 때마다 쨍, 귀한 것은 맑은 소리가 겹친다' : '이 브라우저는 소리를 낼 수 없다'}
          />
          <Toggle
            on={hapticsOn}
            onChange={(on) => haptics.setEnabled(on)}
            label="망치 진동"
            sub={
              haptics.supported()
                ? '칠 때마다 짧게, 귀한 것은 두 번, 아주 귀한 것은 세 번'
                : '이 기기 브라우저는 진동을 낼 수 없다 (아이폰 사파리 등). 앱으로 포장하면 된다'
            }
          />
          <Toggle
            on={firm}
            onChange={(on) => haptics.setStrength(on ? 'firm' : 'light')}
            label="진동 또렷하게"
            sub={`한 번 칠 때 ${String(WEB_PATTERNS.light.tap)}ms 대신 ${String(WEB_PATTERNS.firm.tap)}ms. 짧은 진동이 잘 느껴지지 않는 폰에서 비교해 본다`}
          />
        </section>

        <section>
          <h4>
            결과 표 <small>한 번 칠 때 · 배율과 상관없다</small>
          </h4>
          <ul className="rf-odds">
            {odds.map((o) => {
              const url = itemArtUrl(o.id);
              return (
                <li key={o.id} className={`rf-r-${o.rarity}`}>
                  <span className="rf-odds-pic">{url !== null && <img src={url} alt="" draggable={false} />}</span>
                  <span className="rf-odds-name">
                    <b>{o.name}</b>
                    <small>
                      {RARITY_LABEL[o.rarity]} · {o.kind === 'gold' ? `${o.min}~${o.max}G` : `${o.min}개`}
                    </small>
                  </span>
                  <span className="rf-odds-pct">{percent(o.chance)}</span>
                </li>
              );
            })}
          </ul>
          <p className="kc-hint">
            흔함 {percent(rarity.common)} · 드묾 {percent(rarity.uncommon)} · 귀함 {percent(rarity.rare)} · 아주 귀함 {percent(rarity.veryRare)}.
            덩어리 하나에 골드 기대값 약 {avgGold.toFixed(1)}G. 배율 {REFINE_MULTS.map((m) => `×${m}`).join(' ')}, 한 번 누르면 최대{' '}
            {REFINE_BATCH_MAX}번.
          </p>
        </section>

        <section>
          <h4>시드와 정제 번호</h4>
          <p className="kc-hint">
            시드 {save.seed} · 정제 번호 {num(save.state.refineNo)}. 같은 시드에서 같은 번호를 치면 같은 것이 나온다.
          </p>
        </section>

        <section>
          <h4>
            플레이 기록 <small>방문 {sum.visits}번</small>
          </h4>
          <p className="kc-hint">
            망치질 {num(sum.blows)}번 · 누름 {num(pressCount)}번 (탭 {num(sum.taps)}, 꾹 {num(sum.holds)}) · 배율 바꿈 {num(sum.multChanges)}번 ·
            빈 망치 {num(sum.emptyPresses)}번 · 가득 찬 채 옴 {num(sum.fullArrivals)}번 · 진동 끈 방문 {num(sum.hapticsOff)}번 · 진동
            또렷하게 {num(sum.hapticsFirm)}번 · 소리 끈 방문 {num(sum.soundOff)}번
          </p>
          <p className="kc-hint">
            배율별:{' '}
            {REFINE_MULTS.map((m) => `×${m} ${num(sum.byMult[String(m)] ?? 0)}`).join(' · ')}
          </p>
          <div className="rf-lab-row">
            <button
              type="button"
              className="kc-btn small"
              onClick={() => {
                void copyText(visitsJson(save)).then((ok) => setCopied(ok ? 'ok' : 'fail'));
              }}
            >
              기록 JSON 복사
            </button>
            <button type="button" className="kc-btn small" onClick={props.onClearLog}>
              정제 기록 지우기
            </button>
          </div>
          {copied !== null && <p className="kc-hint">{copied === 'ok' ? '복사했다.' : '복사하지 못했다.'}</p>}
        </section>

        <section>
          <h4>처음부터</h4>
          {confirmReset ? (
            <div className="rf-lab-row">
              <button
                type="button"
                className="kc-btn small danger"
                onClick={() => {
                  setConfirmReset(false);
                  props.onResetAll();
                }}
              >
                정말 지운다
              </button>
              <button type="button" className="kc-btn small" onClick={() => setConfirmReset(false)}>
                그만둔다
              </button>
            </div>
          ) : (
            <button type="button" className="kc-btn small" onClick={() => setConfirmReset(true)}>
              가방·덩어리·정제 번호 지우기
            </button>
          )}
        </section>

        <button type="button" className="kc-btn" onClick={props.onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}
