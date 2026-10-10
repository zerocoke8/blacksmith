// 제작 화면 (4.2.9). Gauges on top, the anvil in the middle, the hand at the bottom where
// the thumb is. It shows what the engine computed and forwards taps (CLAUDE.md 규칙 2):
// costs, reasons, 막타 and previews all come from sim/cards.

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { QualityTier } from '../../sim/core/types.ts';
import {
  activeEffects,
  type CardCraftState,
  cardCostSteps,
  cardKeywordHelp,
  cardName,
  cardQualityRatio,
  cardRuleNotes,
  checkPlay,
  currentTier,
  drawPileSummary,
  type HandCardView,
  handView,
  nextFirePreview,
  pileCounts,
  type PlayOptions,
  type PlayPreview,
  playNeeds,
  previewPlay,
  reheatInfo,
  temperNeed,
} from '../../sim/cards/index.ts';
import { QUALITY } from '../../sim/data/common.ts';
import { type CardId, DWARF_LINES, FIRE_HINT, FIRE_LABEL, HEAT } from '../../sim/data/cards.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { grouped } from './Prep.tsx';
import { CardFace, reducedMotion, Sheet, usePress } from './parts.tsx';
import type { CardProfile, CardSession } from './store.ts';
import { logLine, RULE_LINES, signed, stars, tierName } from './text.ts';

interface Props {
  session: CardSession;
  profile: CardProfile;
  onPlay(uid: string, opts: PlayOptions): void;
  onEndTurn(keep: string[]): void;
  onAbandon(): void;
  onPileOpen(): void;
  onInfoOpen(): void;
  /** A one-time dwarf line was shown. */
  onSeen(line: string): void;
  /** The craft is over and its last moment has been shown: go to the result screen. */
  onFinished(): void;
}

type SheetState =
  | { kind: 'info'; uid: string }
  | { kind: 'break'; uid: string; opts: PlayOptions }
  | { kind: 'recall'; uid: string }
  /** uid null: the 턴 끝 button; else a card that ends the turn (깊은 담금질). */
  | { kind: 'keep'; uid: string | null }
  | { kind: 'reheatBreak' }
  | { kind: 'piles' }
  | { kind: 'log' }
  | { kind: 'rules' }
  | { kind: 'quit' };

/** How long the played card takes to fly off before the engine plays it. */
const LEAVE_MS = 170;
/** How long the finished (or broken) iron stays on the table before the result screen. */
const END_HOLD_MS = 1800;
/** More cards than this in hand (3 rows): the cards get shorter so the gauges and 턴 끝 still fit. */
const ROOMY_HAND = 6;

function safePreview(state: CardCraftState, uid: string, opts: PlayOptions = {}): PlayPreview | null {
  try {
    return previewPlay(state, uid, opts);
  } catch {
    return null;
  }
}

function previewParts(p: PlayPreview): string[] {
  const parts: string[] = [];
  if (p.progress !== 0) parts.push(`공정 ${signed(p.progress)}`);
  if (p.quality !== 0) parts.push(`품질 ${signed(p.quality)}`);
  if (p.heat !== 0) parts.push(`열기 ${signed(p.heat)}`);
  parts.push(`내구도 ${signed(p.durability)}`);
  return parts;
}

export function Table(props: Props) {
  const { session, profile, onPlay, onEndTurn, onAbandon, onPileOpen, onInfoOpen, onSeen, onFinished } = props;
  const craft = session.craft;
  const r = craft.recipe;
  const views = handView(craft);
  const info = reheatInfo(craft);
  const piles = pileCounts(craft);
  const effects = activeEffects(craft);
  const next = nextFirePreview(craft);
  // 식는 쇠 has its own line in `effects`; the other [검증] switches get one reminder chip.
  const ruleNotes = cardRuleNotes(craft.rules).filter((n) => n !== '식는 쇠');
  const active = craft.status === 'active';

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const busy = useRef(false);

  // ---- Event effects: play flash, tier crossing, dwarf lines ----
  const [flash, setFlash] = useState<{ key: number; name: string; parts: string[]; done: boolean } | null>(null);
  const [tierFx, setTierFx] = useState<{ key: number; tier: QualityTier } | null>(null);
  const [say, setSay] = useState<{ key: number; text: string } | null>(null);
  const seenLog = useRef(craft.log.length);
  const seenTier = useRef<QualityTier>(currentTier(craft));
  const seenLines = useRef(new Set(profile.seen));

  useEffect(() => {
    // The first craft: the dwarf's opening line (4.2.9).
    if (!profile.firstCraftDone && craft.turn === 1 && craft.playedThisTurn === 0) {
      setSay({ key: 0, text: DWARF_LINES.firstCraft });
    }
    // Only on arrival at the anvil.
  }, []);

  useEffect(() => {
    const fresh = craft.log.slice(seenLog.current);
    seenLog.current = craft.log.length;
    if (fresh.length === 0) return;
    setSelected(null);
    const key = craft.log.length;
    for (const e of fresh) {
      if (e.kind === 'play') {
        const parts: string[] = [];
        if (e.progress !== 0) parts.push(`공정 ${signed(e.progress)}`);
        if (e.quality !== 0) parts.push(`품질 ${signed(e.quality)}`);
        if (e.heat !== 0) parts.push(`열기 ${signed(e.heat)}`);
        setFlash({ key, name: cardName(e.card, r.materialTier), parts, done: false });
      }
      if (e.kind === 'end' && e.status === 'success') setFlash((f) => (f === null ? f : { ...f, done: true }));
      if (e.kind === 'reheat' && !seenLines.current.has('firstReheat')) {
        seenLines.current.add('firstReheat');
        setSay({ key, text: DWARF_LINES.firstReheat });
        onSeen('firstReheat');
      }
      if ((e.kind === 'turn' && e.fire === 'excellent') || (e.kind === 'fire' && e.to === 'excellent')) {
        setSay({ key, text: DWARF_LINES.excellent });
      }
    }
    const tier = currentTier(craft);
    // A broken iron gets no star; the banner says what happened.
    if (tier > seenTier.current && craft.status !== 'failed') setTierFx({ key, tier });
    seenTier.current = tier;
  }, [craft, onSeen, r.materialTier]);

  // The last blow stays on screen for a moment before the result screen.
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => finishedRef.current(), reducedMotion() ? 600 : END_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // ---- Playing ----
  const previewUid = leaving ?? pressed ?? selected;
  const preview = previewUid !== null && craft.hand.includes(previewUid) ? safePreview(craft, previewUid) : null;

  const commitPlay = (uid: string, opts: PlayOptions) => {
    if (busy.current) return;
    setSheet(null);
    setSelected(null);
    if (reducedMotion()) {
      onPlay(uid, opts);
      return;
    }
    busy.current = true;
    setLeaving(uid);
    window.setTimeout(() => {
      busy.current = false;
      setLeaving(null);
      onPlay(uid, opts);
    }, LEAVE_MS);
  };

  const tryPlay = (v: HandCardView) => {
    const needs = playNeeds(craft, v.uid);
    if (needs.targets > 0) {
      setSheet({ kind: 'recall', uid: v.uid });
      return;
    }
    if (needs.endsTurn && info.keep > 0 && craft.hand.some((u) => u !== v.uid && !info.retained.includes(u))) {
      setSheet({ kind: 'keep', uid: v.uid });
      return;
    }
    if (v.breaks) {
      setSheet({ kind: 'break', uid: v.uid, opts: {} });
      return;
    }
    commitPlay(v.uid, {});
  };

  const tap = (v: HandCardView) => {
    if (busy.current || !active) return;
    if (v.block !== null) {
      openInfo(v.uid);
      return;
    }
    if (session.tapToPreview && selected !== v.uid) {
      setSelected(v.uid);
      return;
    }
    tryPlay(v);
  };

  const openInfo = (uid: string) => {
    setSelected(null);
    setSheet({ kind: 'info', uid });
    onInfoOpen();
  };

  const endTurnTap = () => {
    if (busy.current || !active) return;
    setSelected(null);
    if (info.keep > 0 && craft.hand.some((u) => !info.retained.includes(u))) {
      setSheet({ kind: 'keep', uid: null });
      return;
    }
    if (info.breaks) {
      setSheet({ kind: 'reheatBreak' });
      return;
    }
    onEndTurn([]);
  };

  // ---- Recent log lines: this turn's plays, newest first ----
  let turnStart = 0;
  craft.log.forEach((e, i) => {
    if (e.kind === 'turn') turnStart = i;
  });
  const recent = craft.log
    .slice(turnStart)
    .map((e) => logLine(craft, e))
    .filter((l): l is string => l !== null)
    .slice(-3)
    .reverse();

  const ratio = cardQualityRatio(craft);
  const tier = currentTier(craft);

  return (
    <div className="kc-table">
      <Bar
        label="공정"
        kind="progress"
        value={craft.progress}
        max={r.progressRequired}
        ghost={preview && preview.progress !== 0 ? craft.progress + preview.progress : null}
        delta={preview ? preview.progress : null}
      />
      <QualityBar
        value={craft.quality}
        max={r.qualityCap}
        ratio={ratio}
        tier={tier}
        ghost={preview && preview.quality !== 0 ? craft.quality + preview.quality : null}
        fx={tierFx}
      />
      <div className="kc-row2">
        <Bar
          label="내구도"
          kind="durability"
          value={craft.durability}
          max={craft.maxDurability}
          delta={preview ? preview.durability : null}
          danger={craft.durability <= 6}
        />
        <Heat value={craft.heat} delta={preview ? preview.heat : 0} />
      </div>

      <div className="kc-fire-row">
        <div key={`${craft.turn}-${craft.fire}`} className={`kc-fire kc-fire-${craft.fire}`} aria-live="polite">
          <b>{FIRE_LABEL[craft.fire]}</b>
          {FIRE_HINT[craft.fire] !== '' && <small>{FIRE_HINT[craft.fire]}</small>}
        </div>
        <div className="kc-effects">
          {next !== null && (
            <span className="kc-next">
              다음 <i className={`kc-dot kc-fire-${next}`}>{FIRE_LABEL[next]}</i>
            </span>
          )}
          {effects.map((e) => (
            <span key={e} className={e.startsWith('식는 쇠') ? 'kc-chip lab' : 'kc-chip'}>
              {e}
            </span>
          ))}
          {ruleNotes.length > 0 && <span className="kc-chip lab">실험 · {ruleNotes.join(' · ')}</span>}
          {effects.length === 0 && next === null && ruleNotes.length === 0 && <span className="kc-muted">걸린 효과 없음</span>}
        </div>
      </div>

      <button type="button" className="kc-stage" onClick={() => setSheet({ kind: 'log' })} aria-label="턴 기록 보기">
        <span className="kc-anvil" aria-hidden="true">
          <span className="kc-iron" style={{ '--heat': craft.heat / HEAT.max } as CSSProperties} />
          <span className="kc-anvil-top" />
          <span className="kc-anvil-foot" />
        </span>
        <span className="kc-log">
          {recent.map((line, i) => (
            <span key={`${craft.log.length}-${i}`} className={i === 0 ? 'kc-log-line now' : 'kc-log-line'}>
              {line}
            </span>
          ))}
        </span>
        {flash !== null && (
          <span key={flash.key} className={flash.done ? 'kc-flash done' : 'kc-flash'} aria-hidden="true">
            <b>{flash.name}</b>
            {flash.parts.map((p) => (
              <i key={p}>{p}</i>
            ))}
            {flash.done && <b className="kc-flash-done">완성</b>}
          </span>
        )}
        {say !== null && (
          <span key={say.key} className="kc-say">
            {say.text}
          </span>
        )}
      </button>
      {!active && (
        <button type="button" className={craft.status === 'success' ? 'kc-end ok' : 'kc-end fail'} onClick={onFinished}>
          <b>{craft.status === 'success' ? '완성' : craft.abandoned ? '망치를 내려놓았다' : '쇠가 갈라졌다'}</b>
          {craft.status === 'success' && (
            <span>
              {stars(tier)} {tierName(tier)}
            </span>
          )}
          <small>눌러서 넘어간다</small>
        </button>
      )}

      <div className="kc-piles-row">
        <button
          type="button"
          className="kc-piles"
          onClick={() => {
            setSheet({ kind: 'piles' });
            onPileOpen();
          }}
        >
          뽑을 <b>{piles.draw}</b> · 버린 <b>{piles.discard}</b> · 소멸 <b>{piles.exhausted}</b>
          <small>눌러서 남은 카드 보기</small>
        </button>
        <button type="button" className="kc-btn kc-icon" onClick={() => setSheet({ kind: 'rules' })} aria-label="규칙">
          ?
        </button>
      </div>

      <div
        className={`kc-hand${views.length > ROOMY_HAND ? ' many' : ''}${active ? '' : ' over'}`}
        role="group"
        aria-label="손패"
      >
        {views.map((v, i) => (
          <HandCard
            key={v.uid}
            v={v}
            index={i}
            durability={craft.durability}
            leaving={leaving === v.uid}
            selected={selected === v.uid}
            onTap={() => tap(v)}
            onLong={() => openInfo(v.uid)}
            onPress={(down) => setPressed(down ? v.uid : null)}
          />
        ))}
        {views.length === 0 && <p className="kc-hand-empty">손이 비었다.</p>}
      </div>
      {session.tapToPreview && selected !== null && <p className="kc-hint center">한 번 더 누르면 낸다.</p>}

      <div className="kc-bottom">
        <button type="button" className="kc-btn ghost small" onClick={() => setSheet({ kind: 'quit' })}>
          그만두기
        </button>
        <button
          type="button"
          className={info.breaks ? 'kc-btn kc-endturn danger' : 'kc-btn kc-endturn'}
          onClick={endTurnTap}
          disabled={!active}
        >
          턴 끝
          <small>
            다시 달구기 {signed(info.durability)}
            {info.keep > 0 && ` · 간직 ${info.keep}`}
          </small>
        </button>
      </div>

      {sheet?.kind === 'info' && (
        <InfoSheet
          craft={craft}
          profile={profile}
          uid={sheet.uid}
          onClose={() => setSheet(null)}
          onPlay={(v) => {
            setSheet(null);
            tryPlay(v);
          }}
        />
      )}
      {sheet?.kind === 'break' && (
        <Sheet title={cardName(craft.cards[sheet.uid] as CardId, r.materialTier)} tone="danger" onClose={() => setSheet(null)}>
          <p>이 카드로 내구도가 바닥난다. 공정을 채우기 전에 쇠가 갈라진다.</p>
          <p className="kc-hint">
            {r.bossMaterial !== null ? `재료도, ${UNIQUES[r.bossMaterial].material}도 돌아오지 않는다.` : '재료는 돌아오지 않는다.'}
          </p>
          <div className="kc-row">
            <button type="button" className="kc-btn danger" onClick={() => commitPlay(sheet.uid, sheet.opts)}>
              그래도 친다
            </button>
            <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
              손을 멈춘다
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'recall' && (
        <RecallSheet craft={craft} uid={sheet.uid} onClose={() => setSheet(null)} onPlay={(targets) => commitPlay(sheet.uid, { targets })} />
      )}
      {sheet?.kind === 'keep' && (
        <KeepSheet
          craft={craft}
          uid={sheet.uid}
          onClose={() => setSheet(null)}
          onDone={(keep) => {
            setSheet(null);
            if (sheet.uid === null) onEndTurn(keep);
            else commitPlay(sheet.uid, { keep });
          }}
        />
      )}
      {sheet?.kind === 'reheatBreak' && (
        <Sheet title="다시 달구기" tone="danger" onClose={() => setSheet(null)}>
          <p>이 쇠는 더 못 버틴다. 다시 달구면 갈라진다.</p>
          <StillPlayable craft={craft} />
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                setSheet(null);
                onEndTurn([]);
              }}
            >
              그래도 달군다
            </button>
            <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
              손패를 다시 본다
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'piles' && <PileSheet craft={craft} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'log' && <LogSheet craft={craft} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'rules' && (
        <Sheet title="카드 제작" onClose={() => setSheet(null)}>
          <ul className="kc-rules">
            {RULE_LINES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            알겠다
          </button>
        </Sheet>
      )}
      {sheet?.kind === 'quit' && (
        <Sheet title="망치를 내려놓는다" tone="danger" onClose={() => setSheet(null)}>
          <p>여기서 그만두면 실패다. 재료는 돌아오지 않는다.</p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                setSheet(null);
                onAbandon();
              }}
            >
              그만둔다
            </button>
            <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
              계속한다
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ---------- Gauges ----------

function pctOf(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function Bar(props: {
  label: string;
  kind: 'progress' | 'durability';
  value: number;
  max: number;
  ghost?: number | null;
  delta?: number | null;
  danger?: boolean;
}) {
  const { label, kind, value, max, ghost, delta, danger } = props;
  const pct = pctOf(value, max);
  const ghostPct = ghost !== undefined && ghost !== null ? pctOf(ghost, max) : null;
  const after = delta !== undefined && delta !== null ? value + delta : null;
  return (
    <div className={`kc-gauge kc-gauge-${kind}${danger === true ? ' danger' : ''}`}>
      <div className="kc-gauge-top">
        <span className="kc-gauge-label">{label}</span>
        <span className="kc-gauge-num">
          {after !== null && after !== value ? (
            <>
              <s>{value}</s> → <b className={after < value ? 'down' : 'up'}>{after}</b>
            </>
          ) : (
            value
          )}{' '}
          / {max}
        </span>
      </div>
      <div className="kc-gauge-bar">
        {ghostPct !== null && ghostPct > pct && (
          <div className="kc-gauge-ghost" style={{ left: `${pct}%`, width: `${ghostPct - pct}%` }} />
        )}
        <div className="kc-gauge-fill" style={{ width: `${pct}%` }} />
        {after !== null && after < value && (
          <div className="kc-gauge-loss" style={{ left: `${pctOf(after, max)}%`, width: `${pct - pctOf(after, max)}%` }} />
        )}
      </div>
    </div>
  );
}

const TIER_MARKS: readonly QualityTier[] = [2, 3, 4, 5];

function QualityBar(props: {
  value: number;
  max: number;
  ratio: number;
  tier: QualityTier;
  ghost: number | null;
  fx: { key: number; tier: QualityTier } | null;
}) {
  const { value, max, ratio, tier, ghost, fx } = props;
  const pct = pctOf(value, max);
  const ghostPct = ghost !== null ? pctOf(ghost, max) : null;
  const ghostTier = ghost !== null ? TIER_MARKS.filter((t) => ghost / max >= QUALITY[t].threshold - 1e-9).pop() : undefined;
  return (
    <div className="kc-gauge kc-gauge-quality">
      <div className="kc-gauge-top">
        <span className="kc-gauge-label">품질</span>
        <span className={`kc-tier kc-tier-${tier}`}>
          ★{tier} {tierName(tier)}
          {ghostTier !== undefined && ghostTier > tier && <em> → ★{ghostTier}</em>}
        </span>
        <span className="kc-gauge-num">
          {ghost !== null && ghost !== value ? (
            <>
              <s>{value.toLocaleString('ko-KR')}</s> → <b className="up">{ghost.toLocaleString('ko-KR')}</b>
            </>
          ) : (
            value.toLocaleString('ko-KR')
          )}{' '}
          / {max.toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="kc-gauge-bar">
        {ghostPct !== null && ghostPct > pct && (
          <div className="kc-gauge-ghost" style={{ left: `${pct}%`, width: `${ghostPct - pct}%` }} />
        )}
        <div className="kc-gauge-fill" style={{ width: `${pct}%` }} />
        {TIER_MARKS.filter((t) => t < 5).map((t) => (
          <div key={t} className="kc-gauge-mark" style={{ left: `${QUALITY[t].threshold * 100}%` }} />
        ))}
        {fx !== null && <div key={fx.key} className="kc-gauge-flash" />}
      </div>
      <div className="kc-marks" aria-hidden="true">
        {TIER_MARKS.map((t) => (
          <span
            key={t}
            className={ratio >= QUALITY[t].threshold - 1e-9 ? 'kc-mark on' : 'kc-mark'}
            style={{ left: `${QUALITY[t].threshold * 100}%` }}
          >
            ★{t}
          </span>
        ))}
      </div>
      {fx !== null && (
        <span key={fx.key} className={`kc-tierup kc-tier-${fx.tier}`} role="status">
          {stars(fx.tier)} {tierName(fx.tier)}
        </span>
      )}
    </div>
  );
}

function Heat({ value, delta }: { value: number; delta: number }) {
  const after = Math.max(0, Math.min(HEAT.max, value + delta));
  return (
    <div className="kc-heat" aria-label={`열기 ${value}`}>
      <div className="kc-gauge-top">
        <span className="kc-gauge-label">열기</span>
        <span className="kc-gauge-num">
          {after !== value ? (
            <>
              {value} → <b className={after < value ? 'down' : 'up'}>{after}</b>
            </>
          ) : (
            value
          )}{' '}
          / {HEAT.max}
        </span>
      </div>
      <div className="kc-pips">
        {Array.from({ length: HEAT.max }, (_, i) => {
          const on = i < value;
          const gain = !on && i < after;
          const loss = on && i >= after;
          return <span key={i} className={`kc-pip${on ? ' on' : ''}${gain ? ' gain' : ''}${loss ? ' loss' : ''}`} />;
        })}
      </div>
    </div>
  );
}

// ---------- Hand ----------

function HandCard(props: {
  v: HandCardView;
  index: number;
  durability: number;
  leaving: boolean;
  selected: boolean;
  onTap(): void;
  onLong(): void;
  onPress(down: boolean): void;
}) {
  const { v, index, durability, leaving, selected, onTap, onLong, onPress } = props;
  const press = usePress({ onTap, onLong, onPress });
  const blowLabel = v.finishes ? (v.cost > durability ? '막타 · 이 한 방으로 완성' : '이 한 방으로 완성') : null;
  const cls = [
    'kc-card',
    `kc-kind-${v.kind}`,
    v.block !== null ? 'blocked' : '',
    v.finishes ? 'finishes' : '',
    v.breaks ? 'breaks' : '',
    leaving ? 'leaving' : '',
    selected ? 'selected' : '',
  ]
    .filter((c) => c !== '')
    .join(' ');
  const costCls = v.cost < v.baseCost ? 'kc-cost down' : v.cost > v.baseCost ? 'kc-cost up' : 'kc-cost';
  return (
    <button
      type="button"
      className={cls}
      style={{ '--i': index } as CSSProperties}
      aria-disabled={v.block !== null}
      aria-label={`${v.name}, 코스트 ${v.cost}${v.block !== null ? `, ${v.block}` : ''}`}
      {...press}
    >
      <span className="kc-card-top">
        <span className={costCls}>{v.cost}</span>
        <span className="kc-card-kind">{v.kindLabel}</span>
      </span>
      <span className="kc-card-name">{v.name}</span>
      <span className="kc-card-text">{v.shortText}</span>
      <span className="kc-card-foot">
        {v.block !== null ? (
          <em className="why">{v.block}</em>
        ) : blowLabel !== null ? (
          <em className="fin">{blowLabel}</em>
        ) : v.breaks ? (
          <em className="brk">내면 쇠가 갈라진다</em>
        ) : v.retained ? (
          <em className="keep">간직</em>
        ) : null}
      </span>
    </button>
  );
}

// ---------- Sheets ----------

function InfoSheet(props: {
  craft: CardCraftState;
  profile: CardProfile;
  uid: string;
  onClose(): void;
  onPlay(v: HandCardView): void;
}) {
  const { craft, profile, uid, onClose, onPlay } = props;
  const v = handView(craft).find((x) => x.uid === uid);
  if (v === undefined) return null;
  const p = v.block === null ? safePreview(craft, uid) : null;
  const costSteps = cardCostSteps(craft, uid).steps;
  const need = temperNeed(v.card);
  const temper = (profile.temper[v.card] ?? 0) + (craft.uses[v.card] ?? 0);
  return (
    <Sheet title={v.name} onClose={onClose}>
      <div className="kc-info-head">
        <span className="kc-cost big">{v.cost}</span>
        <span>
          {v.kindLabel} 카드
          {costSteps.length > 0 && (
            <small>
              {' '}
              · 원래 코스트 {v.baseCost}, {costSteps.map((c) => `${c.label} ${signed(c.delta)}`).join(', ')}
            </small>
          )}
        </span>
      </div>
      <p className="kc-info-text">{v.text}</p>
      {cardKeywordHelp(v.card).map((k) => (
        <p key={k.label} className="kc-hint">
          <b>{k.label}</b> — {k.text}
        </p>
      ))}
      {v.block !== null && <p className="kc-why">지금은 못 낸다: {v.block}</p>}
      {p !== null && (
        <div className="kc-preview">
          <span>지금 내면</span>
          <b>{previewParts(p).join(' · ')}</b>
          {p.finishes && <em className="fin">{p.cost > craft.durability ? '막타 — 내구도가 모자라도 이 한 방으로 완성' : '이 한 방으로 완성'}</em>}
          {p.breaks && <em className="brk">내구도가 바닥나 쇠가 갈라진다</em>}
        </div>
      )}
      {need !== null && (
        <p className="kc-hint">
          단련 {Math.min(temper, need)} / {need}
          {temper >= need && ' — 작업대에서 진화할 수 있다'}
        </p>
      )}
      <div className="kc-row">
        {v.block === null && craft.status === 'active' && (
          <button type="button" className="kc-btn primary" onClick={() => onPlay(v)}>
            낸다
          </button>
        )}
        <button type="button" className="kc-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}

function RecallSheet(props: { craft: CardCraftState; uid: string; onClose(): void; onPlay(targets: string[]): void }) {
  const { craft, uid, onClose, onPlay } = props;
  const [picked, setPicked] = useState<string[]>([]);
  const id = craft.cards[uid] as CardId;
  const max = playNeeds(craft, uid).targets;
  const check = (() => {
    try {
      return checkPlay(craft, uid, { targets: picked });
    } catch {
      return null;
    }
  })();
  const toggle = (u: string) =>
    setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length < max ? [...p, u] : p));
  return (
    <Sheet title={cardName(id, craft.recipe.materialTier)} onClose={onClose}>
      <p className="kc-hint">버린 더미에서 {max}장까지 골라 손으로 가져온다.</p>
      <div className="kc-faces">
        {craft.discard.map((u) => {
          const cid = craft.cards[u] as CardId;
          const on = picked.includes(u);
          return (
            <button key={u} type="button" className={on ? 'kc-face-btn on' : 'kc-face-btn'} aria-pressed={on} onClick={() => toggle(u)}>
              <CardFace id={cid} tier={craft.recipe.materialTier} />
            </button>
          );
        })}
      </div>
      {check !== null && check.ok && check.breaks && <p className="kc-why">이 카드로 내구도가 바닥나 쇠가 갈라진다.</p>}
      <div className="kc-row">
        <button
          type="button"
          className={check !== null && check.ok && check.breaks ? 'kc-btn danger' : 'kc-btn primary'}
          disabled={check === null || !check.ok}
          onClick={() => onPlay(picked)}
        >
          {picked.length}장 가져온다
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          그만둔다
        </button>
      </div>
    </Sheet>
  );
}

function KeepSheet(props: { craft: CardCraftState; uid: string | null; onClose(): void; onDone(keep: string[]): void }) {
  const { craft, uid, onClose, onDone } = props;
  const info = reheatInfo(craft);
  const [keep, setKeep] = useState<string[]>([]);
  const choices = craft.hand.filter((u) => u !== uid && !info.retained.includes(u));
  const breaks =
    uid === null
      ? info.breaks
      : (() => {
          try {
            const c = checkPlay(craft, uid, { keep });
            return c.ok && c.breaks;
          } catch {
            return false;
          }
        })();
  const toggle = (u: string) =>
    setKeep((k) => (k.includes(u) ? k.filter((x) => x !== u) : k.length < info.keep ? [...k, u] : k));
  return (
    <Sheet title="다시 달구기" tone={breaks ? 'danger' : undefined} onClose={onClose}>
      <p className="kc-hint">
        화로가 {info.keep}장까지 손에 남겨 준다. 나머지는 버린 더미로 간다. 내구도 {signed(info.durability)}.
      </p>
      {info.retained.length > 0 && (
        <p className="kc-hint">
          간직: {info.retained.map((u) => cardName(craft.cards[u] as CardId, craft.recipe.materialTier)).join(', ')} — 저절로 남는다.
        </p>
      )}
      <div className="kc-faces">
        {choices.map((u) => {
          const on = keep.includes(u);
          return (
            <button key={u} type="button" className={on ? 'kc-face-btn on' : 'kc-face-btn'} aria-pressed={on} onClick={() => toggle(u)}>
              <CardFace id={craft.cards[u] as CardId} tier={craft.recipe.materialTier} />
            </button>
          );
        })}
      </div>
      {breaks && <p className="kc-why">이 쇠는 더 못 버틴다. 다시 달구면 갈라진다.</p>}
      {breaks && uid === null && <StillPlayable craft={craft} />}
      <div className="kc-row">
        <button type="button" className={breaks ? 'kc-btn danger' : 'kc-btn primary'} onClick={() => onDone(keep)}>
          {breaks ? '그래도 달군다' : keep.length > 0 ? `${keep.length}장 남기고 달군다` : '모두 버리고 달군다'}
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          손패를 다시 본다
        </button>
      </div>
    </Sheet>
  );
}

/** Before a 다시 달구기 that breaks the iron: the cards that can still go (a 담금질, a finishing blow). */
function StillPlayable({ craft }: { craft: CardCraftState }) {
  const names = handView(craft)
    .filter((v) => v.block === null && !v.breaks)
    .map((v) => v.name);
  if (names.length === 0) return null;
  return <p className="kc-hint">아직 낼 수 있는 카드: {names.join(', ')}</p>;
}

function PileSheet({ craft, onClose }: { craft: CardCraftState; onClose(): void }) {
  const tier = craft.recipe.materialTier;
  const ids = (uids: readonly string[]) => uids.map((u) => craft.cards[u] as CardId);
  const sections: { title: string; note?: string; list: { id: CardId; count: number }[]; size: number }[] = [
    {
      title: '뽑을 더미',
      note: '순서는 모른다',
      list: drawPileSummary(craft).map((x) => ({ id: x.card, count: x.count })),
      size: craft.drawPile.length,
    },
    { title: '버린 더미', note: '뽑을 더미가 비면 섞여 돌아온다', list: grouped(ids(craft.discard)), size: craft.discard.length },
    { title: '소멸', note: '이번 제작에서 빠졌다', list: grouped(ids(craft.exhausted)), size: craft.exhausted.length },
  ];
  return (
    <Sheet title="남은 카드" onClose={onClose}>
      {sections.map((s) => (
        <section key={s.title} className="kc-pile-sec">
          <h4>
            {s.title} <b>{s.size}장</b> {s.note !== undefined && <small>{s.note}</small>}
          </h4>
          {s.list.length === 0 ? (
            <p className="kc-hint">비었다.</p>
          ) : (
            <div className="kc-faces">
              {s.list.map(({ id, count }) => (
                <CardFace key={id} id={id} tier={tier} count={count} />
              ))}
            </div>
          )}
        </section>
      ))}
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}

function LogSheet({ craft, onClose }: { craft: CardCraftState; onClose(): void }) {
  const lines = craft.log
    .map((e, i) => ({ i, turn: e.kind === 'turn', text: logLine(craft, e) }))
    .filter((l): l is { i: number; turn: boolean; text: string } => l.text !== null)
    .reverse();
  return (
    <Sheet title="턴 기록" onClose={onClose}>
      <ol className="kc-fulllog">
        {lines.map((l) => (
          <li key={l.i} className={l.turn ? 'turn' : undefined}>
            {l.text}
          </li>
        ))}
      </ol>
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
