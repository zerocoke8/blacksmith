// The puzzle screen: gauges, condition, 열기, buffs, actions, turn log.
// It only shows engine state and forwards taps; rules live in sim/craft.

import { useState } from 'react';
import {
  actionCost,
  checkAction,
  type CraftState,
  previewNextCondition,
  previewReroll,
  qualityRatio,
  type TurnLogEntry,
  usesLeft,
  wouldBreak,
} from '../../sim/craft/index.ts';
import { QUALITY, qualityTierFor } from '../../sim/data/common.ts';
import {
  BUFF_HINT,
  BUFF_IDS,
  BUFF_LABEL,
  CONDITION_HINT,
  CONDITION_LABEL,
  type Condition,
  CRAFT_ACTIONS,
  type CraftActionId,
  GOOD_CONDITIONS,
  INNER_QUIET,
  RECIPE_GRADE_LABEL,
} from '../../sim/data/craft.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { signed, stars, tierName, weaponTitle } from './text.ts';

interface Props {
  state: CraftState;
  onAction(id: CraftActionId): void;
  onAbandon(): void;
}

export function CraftBoard({ state, onAction, onAbandon }: Props) {
  const r = state.recipe;
  const tier = qualityTierFor(qualityRatio(state));
  const next = state.stats.foresight ? previewNextCondition(state) : null;

  return (
    <div className="cb">
      <div className="cb-head">
        <div className="cb-title">
          {weaponTitle(r.weaponType, r.materialTier)}
          <span className={`tag grade-${r.grade}`}>{RECIPE_GRADE_LABEL[r.grade]}</span>
        </div>
        <div className="cb-turn">턴 {state.turn + 1}</div>
      </div>

      <ConditionBadge condition={state.condition} next={next} />

      <Gauge label="공정" kind="progress" value={state.progress} max={r.progressRequired} />
      <Gauge
        label="품질"
        kind="quality"
        value={state.quality}
        max={r.qualityCap}
        marks={[QUALITY[2].threshold, QUALITY[3].threshold, QUALITY[4].threshold]}
        note={`${stars(tier)} ${tierName(tier)}`}
      />
      <div className="cb-pair">
        <Gauge label="내구도" kind="durability" value={state.durability} max={state.maxDurability} />
        <Gauge label="제작력" kind="cp" value={state.cp} max={state.stats.maxCp} />
      </div>

      <div className="cb-status">
        <InnerQuiet stacks={state.innerQuiet} />
        <Buffs state={state} />
      </div>

      <ActionGrid state={state} onAction={onAction} />
      <TurnLog log={state.log} />
      <QuitButton onAbandon={onAbandon} />
    </div>
  );
}

function ConditionBadge({ condition, next }: { condition: Condition; next: Condition | null }) {
  return (
    <div className="cond-row">
      <div className={`cond cond-${condition}`} aria-live="polite">
        <span className="cond-label">{CONDITION_LABEL[condition]}</span>
        {CONDITION_HINT[condition] && <span className="cond-hint">{CONDITION_HINT[condition]}</span>}
      </div>
      {next && (
        <div className="cond-next">
          다음 <span className={`cond-dot cond-${next}`}>{CONDITION_LABEL[next]}</span>
        </div>
      )}
    </div>
  );
}

type GaugeKind = 'progress' | 'quality' | 'durability' | 'cp';

function Gauge(props: { label: string; kind: GaugeKind; value: number; max: number; marks?: number[]; note?: string }) {
  const { label, kind, value, max, marks, note } = props;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`gauge gauge-${kind}`}>
      <div className="gauge-top">
        <span className="gauge-label">{label}</span>
        {note && <span className="gauge-note">{note}</span>}
        <span className="gauge-num">
          {Math.max(0, value)} / {max}
        </span>
      </div>
      <div className="gauge-bar">
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
        {marks?.map((m) => (
          <div key={m} className="gauge-mark" style={{ left: `${m * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function InnerQuiet({ stacks }: { stacks: number }) {
  return (
    <div className="iq" aria-label={`열기 ${stacks}`}>
      <span className="iq-label">열기</span>
      <span className="iq-pips">
        {Array.from({ length: INNER_QUIET.max }, (_, i) => (
          <span key={i} className={i < stacks ? 'iq-pip on' : 'iq-pip'} />
        ))}
      </span>
      <span className="iq-num">{stacks}</span>
    </div>
  );
}

function Buffs({ state }: { state: CraftState }) {
  const active = BUFF_IDS.filter((b) => state.buffs[b] > 0);
  if (active.length === 0 && !state.heartAndSoul) return <div className="buffs muted">걸린 효과 없음</div>;
  return (
    <div className="buffs">
      {active.map((b) => (
        <span key={b} className="buff">
          {BUFF_LABEL[b]} <b>{state.buffs[b]}</b>
          <small>{BUFF_HINT[b]}</small>
        </span>
      ))}
      {state.heartAndSoul && (
        <span className="buff">
          대장장이의 감<small>좋음 전용 1회</small>
        </span>
      )}
    </div>
  );
}

function ActionGrid({ state, onAction }: { state: CraftState; onAction(id: CraftActionId): void }) {
  const good = GOOD_CONDITIONS.includes(state.condition);
  // An action that would break the work waits for a second, explicit yes.
  // Tied to the log length so a stale question never fires on a newer turn.
  const [asking, setAsking] = useState<{ id: CraftActionId; at: number } | null>(null);
  const pending = asking !== null && asking.at === state.log.length && wouldBreak(state, asking.id) ? asking.id : null;

  const tap = (id: CraftActionId) => {
    if (wouldBreak(state, id)) setAsking({ id, at: state.log.length });
    else onAction(id);
  };

  return (
    <section className="acts">
      <div className="acts-legend">
        <span className="pill cp">제작력</span>
        <span className="pill dur">내구도</span>
      </div>
      <div className="acts-grid">
        {state.stats.actions.map((id) => {
          const spec = CRAFT_ACTIONS[id];
          const reason = checkAction(state, id);
          const cost = actionCost(state, id);
          const left = usesLeft(state, id);
          const hot = reason === null && spec.requires === 'goodCondition' && good;
          const breaks = wouldBreak(state, id);
          // With 불꽃 읽기 the re-roll draws what the preview shows, so say it plainly.
          const desc =
            reason ??
            (id === 'carefulObservation' && state.stats.foresight
              ? `다시 보면 ${CONDITION_LABEL[previewReroll(state)]}`
              : spec.short);
          return (
            <button
              key={id}
              type="button"
              className={`act${hot ? ' hot' : ''}${breaks ? ' risky' : ''}${spec.basic ? '' : ' unlocked'}`}
              disabled={reason !== null}
              onClick={() => tap(id)}
            >
              <span className="act-name">{spec.name}</span>
              <span className={reason ? 'act-desc why' : 'act-desc'}>{desc}</span>
              <span className="act-cost">
                {cost.cp > 0 && <span className="pill cp">{cost.cp}</span>}
                {spec.restoreCp > 0 && <span className="pill cp">+{spec.restoreCp}</span>}
                {cost.durability > 0 && <span className="pill dur">−{cost.durability}</span>}
                {spec.restoreDurability > 0 && <span className="pill dur">+{spec.restoreDurability}</span>}
                {spec.free && <span className="pill free">턴 그대로</span>}
                {left !== null && <span className="pill left">{left}회</span>}
                {breaks && <span className="pill breaks">갈라짐</span>}
              </span>
            </button>
          );
        })}
      </div>
      {pending && (
        <BreakConfirm
          state={state}
          id={pending}
          onYes={() => {
            setAsking(null);
            onAction(pending);
          }}
          onNo={() => setAsking(null)}
        />
      )}
    </section>
  );
}

/** Bottom sheet, so it is in reach wherever the grid was scrolled to. */
function BreakConfirm(props: { state: CraftState; id: CraftActionId; onYes(): void; onNo(): void }) {
  const { state, id, onYes, onNo } = props;
  const boss = state.recipe.bossMaterial;
  return (
    <div className="sheet-backdrop" onClick={onNo}>
      <div
        className="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="break-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="break-title" className="sheet-title">
          {CRAFT_ACTIONS[id].name}
        </p>
        <p>내구도가 바닥난다. 공정을 채우기 전에 쇠가 갈라진다.</p>
        <p className="hint">{boss ? `재료도, ${UNIQUES[boss].material}도 돌아오지 않는다.` : '재료는 돌아오지 않는다.'}</p>
        <div className="row">
          <button type="button" className="btn danger" onClick={onYes}>
            그래도 친다
          </button>
          <button type="button" className="btn" onClick={onNo}>
            손을 멈춘다
          </button>
        </div>
      </div>
    </div>
  );
}

function logText(e: TurnLogEntry): string {
  const parts: string[] = [];
  if (e.rerolledTo) parts.push(`→ ${CONDITION_LABEL[e.rerolledTo]}`);
  if (e.progress) parts.push(`공정 ${signed(e.progress)}`);
  if (e.quality) parts.push(`품질 ${signed(e.quality)}`);
  if (e.durability) parts.push(`내구 ${signed(e.durability)}`);
  if (e.cp) parts.push(`제작력 ${signed(e.cp)}`);
  return parts.join(' · ');
}

function TurnLog({ log }: { log: TurnLogEntry[] }) {
  const recent = log.slice(-5).reverse();
  if (recent.length === 0) return <div className="log muted">화로가 달아올랐다. 쇠가 망치를 기다린다.</div>;
  return (
    <ol className="log">
      {recent.map((e, i) => (
        <li key={log.length - i}>
          <span className="log-turn">{e.turn}</span>
          <span className={`cond-dot cond-${e.condition}`}>{CONDITION_LABEL[e.condition]}</span>
          <span className="log-act">{CRAFT_ACTIONS[e.action].name}</span>
          <span className="log-fx">{logText(e)}</span>
        </li>
      ))}
    </ol>
  );
}

function QuitButton({ onAbandon }: { onAbandon(): void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn ghost quit" onClick={() => setAsking(true)}>
        망치를 내려놓는다
      </button>
    );
  }
  return (
    <div className="quit-confirm">
      <p>여기서 그만두면 재료는 돌아오지 않는다.</p>
      <div className="row">
        <button type="button" className="btn danger" onClick={onAbandon}>
          그만둔다
        </button>
        <button type="button" className="btn" onClick={() => setAsking(false)}>
          계속한다
        </button>
      </div>
    </div>
  );
}
