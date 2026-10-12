// 제작 화면 (4.2.9). Two faces of one table: the art screen (ArtTable: the workshop scene, a fan
// of real cards, effects) and the plain one below (gauges on top, the anvil in the middle, the
// hand at the bottom), which is also the fallback where WebGL is missing. Both show what the
// engine computed and forward taps (CLAUDE.md 규칙 2): costs, reasons, 막타 and previews all
// come from sim/cards.

import { Component, type CSSProperties, type ErrorInfo, lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import type { QualityTier } from '../../sim/core/types.ts';
import {
  activeEffects,
  cardName,
  cardQualityRatio,
  cardRuleNotes,
  currentTier,
  type HandCardView,
  handView,
  nextFirePreview,
  pileCounts,
  type PlayOptions,
} from '../../sim/cards/index.ts';
import { QUALITY } from '../../sim/data/common.ts';
import { DWARF_LINES, FIRE_HINT, FIRE_LABEL, HEAT } from '../../sim/data/cards.ts';
import { artScreenUsable, markArtBroken, useArtScreen } from './artPref.ts';
import { reducedMotion, usePress } from './parts.tsx';
import type { CardProfile, CardSession } from './store.ts';
import { safePreview, TableSheets, useTableFlow } from './tableFlow.tsx';
import { logLine, signed, stars, tierName } from './text.ts';

/**
 * The art table's chunk. If it cannot be fetched (offline, or a tab left open across a
 * redeploy, whose old hashed chunk is gone) the plain table stands in, instead of a blank page.
 */
const ArtTable = lazy(() =>
  import('./ArtTable.tsx').catch(() => {
    markArtBroken();
    return { default: ArtStandIn };
  }),
);

/** In place of an art table that could not load: tells the host (it switches to the plain table) and shows it meanwhile. */
function ArtStandIn(props: TableProps & { onUnavailable(): void }) {
  const unavailable = useRef(props.onUnavailable);
  unavailable.current = props.onUnavailable;
  useEffect(() => unavailable.current(), []);
  return <ClassicTable {...props} />;
}

/** Anything the art table throws while drawing: note it, and show the plain table instead. */
class ArtBoundary extends Component<{ fallback: ReactNode; onError(): void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface TableMenuItem {
  label: string;
  onClick(): void;
}

export interface TableProps {
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
  /**
   * The art screen covers the whole screen, the host's top bar too: its own back button,
   * title and menu stand in for them.
   */
  onExit?(): void;
  exitLabel?: string;
  /** Extra menu entries (작업대, 실험 …). */
  menu?: TableMenuItem[];
  /**
   * A warning from the host (saving failed, an action was refused). The art screen covers the
   * whole page, so both tables show it themselves, under their top band.
   */
  notice?: ReactNode;
  /** Which table is on screen now (true = the art screen), for the play records. */
  onScreen?(art: boolean): void;
}

/** The art screen when it is on and the device can draw it; the plain table otherwise. */
export function Table(props: TableProps) {
  const art = useArtScreen();
  const [broken, setBroken] = useState(false);
  const showArt = art && !broken && artScreenUsable();
  const onScreen = useRef(props.onScreen);
  onScreen.current = props.onScreen;
  useEffect(() => {
    onScreen.current?.(showArt);
  }, [showArt]);
  if (showArt) {
    const fallback = (
      <div className="ft-loading" role="status">
        화로에 불을 넣는 중…
      </div>
    );
    const unavailable = () => {
      markArtBroken();
      setBroken(true);
    };
    return (
      <ArtBoundary fallback={<ClassicTable {...props} />} onError={unavailable}>
        <Suspense fallback={fallback}>
          <ArtTable {...props} onUnavailable={unavailable} />
        </Suspense>
      </ArtBoundary>
    );
  }
  return <ClassicTable {...props} />;
}

/** How long the played card takes to fly off before the engine plays it. */
const LEAVE_MS = 170;
/** How long the finished (or broken) iron stays on the plain table before the result screen. */
const CLASSIC_END_HOLD_MS = 1800;
/** More cards than this in hand (3 rows): the cards get shorter so the gauges and 턴 끝 still fit. */
const ROOMY_HAND = 6;

export function ClassicTable(props: TableProps) {
  const { session, profile, onPlay, onEndTurn, onAbandon, onPileOpen, onInfoOpen, onSeen, onFinished } = props;
  const craft = session.craft;
  const r = craft.recipe;
  const views = handView(craft);
  const piles = pileCounts(craft);
  const effects = activeEffects(craft);
  const next = nextFirePreview(craft);
  // 식는 쇠 has its own line in `effects`; the other [검증] switches get one reminder chip.
  const ruleNotes = cardRuleNotes(craft.rules).filter((n) => n !== '식는 쇠');
  const active = craft.status === 'active';

  const [selected, setSelected] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const busy = useRef(false);

  const commitPlay = (uid: string, opts: PlayOptions) => {
    if (busy.current) return;
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
  const flow = useTableFlow({ craft, commit: commitPlay, onEndTurn, onInfoOpen });
  const { setSheet, tryPlay, info } = flow;

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
    const t = window.setTimeout(() => finishedRef.current(), reducedMotion() ? 600 : CLASSIC_END_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  // ---- Playing ----
  const previewUid = leaving ?? pressed ?? selected;
  const preview = previewUid !== null && craft.hand.includes(previewUid) ? safePreview(craft, previewUid) : null;

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
    flow.openInfo(uid);
  };

  const endTurnTap = () => {
    if (busy.current || !active) return;
    setSelected(null);
    flow.endTurnTap();
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
      {props.notice !== undefined && props.notice !== null && <div className="kc-table-notice">{props.notice}</div>}
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
          // A spent 막타 stops at 0 on screen, as on the art table (기획서 4.2.9).
          value={Math.max(0, craft.durability)}
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

      <TableSheets
        sheet={flow.sheet}
        setSheet={setSheet}
        craft={craft}
        profile={profile}
        commit={commitPlay}
        tryPlay={tryPlay}
        onEndTurn={onEndTurn}
        onAbandon={onAbandon}
      />
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

