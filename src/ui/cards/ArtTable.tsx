// 제작 화면, 그림판 (기획서 4.2.9 + 아트): the workshop scene on top (dwarf, anvil, furnace),
// the gauge band (공정·품질·열기·화로) right over a fan of real cards, the durability orb and the
// piles at the bottom left, 다시 달구기 at the bottom right; the rows are sized by tableLayout.ts.
// Every number shown is the engine's (CLAUDE.md 규칙 2): while effects play the bars follow the
// engine's own log step by step (render/forge/fx.ts), and they rest on the engine state when the
// effects are done. Loaded on demand with the scene.

import { type CSSProperties, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  activeEffects,
  cardCraftOutcome,
  cardRuleNotes,
  currentTier,
  fireStatesOf,
  type HandCardView,
  handView,
  nextFirePreview,
  pileCounts,
  type PlayOptions,
} from '../../sim/cards/index.ts';
import { CARD_RECIPE_GRADE_LABEL, DWARF_LINES, FIRE_HINT, FIRE_LABEL } from '../../sim/data/cards.ts';
import { uiArtUrl } from '../../render/forge/assets.ts';
import { effectsForPlay, effectsForStart, FIRE_BUFFS, type FxStep, type GaugeSnap, snapOf } from '../../render/forge/fx.ts';
import { END_HOLD_MS, TABLE_ROWS, TABLE_TIMING } from '../../render/forge/layout.ts';
import type { SceneView } from '../../render/forge/scene.ts';
import { ArtHand, type HandApi, type PileKind } from './ArtHand.tsx';
import { type Floater, ForgeStage, type StageApi } from './ForgeStage.tsx';
import { absorbDelay, type BandTargets, GaugeBand } from './GaugeBand.tsx';
import { UiIcon } from './GameCard.tsx';
import { useBandRise } from './artPref.ts';
import { reducedMotion, Sheet } from './parts.tsx';
import type { TableProps } from './Table.tsx';
import { safePreview, TableSheets, useTableFlow } from './tableFlow.tsx';
import { bandRise, tableRows } from './tableLayout.ts';
import { outcomeLines, signed, stars, tierName, weaponTitle } from './text.ts';
import './art.css';

export default function ArtTable(props: TableProps & { onUnavailable(): void }) {
  const { session, profile, onPlay, onEndTurn, onAbandon, onPileOpen, onInfoOpen, onSeen, onFinished, inRun } = props;
  const craft = session.craft;
  const r = craft.recipe;
  const views = handView(craft);
  const active = craft.status === 'active';
  const reduced = useMemo(() => reducedMotion(), []);

  const stageApi = useRef<StageApi | null>(null);
  const handApi = useRef<HandApi | null>(null);
  const drawRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const exhaustRef = useRef<HTMLButtonElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const bandProgress = useRef<HTMLDivElement>(null);
  const bandQuality = useRef<HTMLDivElement>(null);
  const bandHeat = useRef<HTMLDivElement>(null);
  const bandEl = useRef<HTMLDivElement>(null);
  const bandTargets = useMemo<BandTargets>(() => ({ band: bandEl, progress: bandProgress, quality: bandQuality, heat: bandHeat }), []);
  const bandRises = useBandRise();
  const rootRef = useRef<HTMLDivElement>(null);

  // The rows (top band, scene, gauge band, hand, bottom row) from the table's safe area.
  const [box, setBox] = useState(() => ({ w: Math.min(480, window.innerWidth), h: window.innerHeight }));
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el === null) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth;
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setBox((b) => (Math.abs(b.w - w) < 0.5 && Math.abs(b.h - h) < 0.5 ? b : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = useMemo(() => tableRows(box.w, box.h), [box.w, box.h]);

  const [selected, setSelected] = useState<string | null>(null);
  const [dragUid, setDragUid] = useState<string | null>(null);

  const commit = (uid: string, opts: PlayOptions) => {
    setSelected(null);
    handApi.current?.launch(uid);
    onPlay(uid, opts);
  };
  const flow = useTableFlow({ craft, commit, onEndTurn, onInfoOpen });
  const { sheet, setSheet, info } = flow;

  // ---- Effects: the bars follow the scene's beats ----
  const [shown, setShown] = useState<GaugeSnap | null>(null);
  const [fxIdle, setFxIdle] = useState(true);
  const [endBeat, setEndBeat] = useState(false);
  /** The end banner is up (a moment after the last blow: the hand has gone, the weapon lies on the anvil). */
  const [bannerUp, setBannerUp] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [orbFloat, setOrbFloat] = useState<{ key: number; text: string; up: boolean } | null>(null);
  const [say, setSay] = useState<{ key: number; text: string } | null>(null);
  const [tierFx, setTierFx] = useState<{ key: number; tier: ReturnType<typeof currentTier> } | null>(null);
  const prev = useRef(craft);
  const craftRef = useRef(craft);
  craftRef.current = craft;
  const seenLines = useRef(new Set(profile.seen));
  const keyRef = useRef(0);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  /** The dwarf says a line; numbers still rising from earlier blows (ids under `keepFrom`) bow out so it reads on its own. */
  const speak = useCallback((text: string, keepFrom = Number.POSITIVE_INFINITY) => {
    keyRef.current += 1;
    setSay({ key: keyRef.current, text });
    setFloaters((f) => (f.some((x) => x.hush !== true && x.id < keepFrom) ? f.map((x) => (x.id < keepFrom ? { ...x, hush: true } : x)) : f));
  }, []);
  /** The closing line's and the end banner's timers (cleared if the table goes away first). */
  const lineTimer = useRef<number | null>(null);
  const bannerTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (lineTimer.current !== null) window.clearTimeout(lineTimer.current);
      if (bannerTimer.current !== null) window.clearTimeout(bannerTimer.current);
    },
    [],
  );

  /**
   * A step's blow landed: the bars move to its numbers. A step the player skipped (a tap on the
   * scene) still says its lines and marks its ★, without the floating numbers.
   */
  const handleBeat = useCallback(
    (step: FxStep, skipped = false) => {
      setShown(step.snap);
      keyRef.current += 1;
      const key = keyRef.current;
      const cur = craftRef.current;
      switch (step.kind) {
        case 'play': {
          if (skipped) {
            if (step.tierUp !== null) setTierFx({ key, tier: step.tierUp });
            if (step.fireTo === 'excellent') speak(DWARF_LINES.excellent);
            break;
          }
          const list: Omit<Floater, 'id' | 'order'>[] = [];
          if (step.gain.progress > 0) list.push({ kind: 'progress', text: `공정 +${step.gain.progress.toLocaleString('ko-KR')}` });
          if (step.gain.quality > 0) list.push({ kind: 'quality', text: `품질 +${step.gain.quality.toLocaleString('ko-KR')}` });
          if (step.gain.heat !== 0) list.push({ kind: 'heat', text: `열기 ${signed(step.gain.heat)}` });
          if (step.gain.restored > 0) list.push({ kind: 'restore', text: `내구도 +${step.gain.restored}` });
          if (list.length > 0) {
            setFloaters((f) => [...f, ...list.map((x, i) => ({ ...x, id: key * 10 + i, order: i }))].slice(-TABLE_TIMING.floatersKept));
          }
          if (step.gain.durability !== 0) setOrbFloat({ key, text: signed(step.gain.durability), up: step.gain.durability > 0 });
          if (step.tierUp !== null) setTierFx({ key, tier: step.tierUp });
          // This blow's own numbers stay.
          if (step.fireTo === 'excellent') speak(DWARF_LINES.excellent, key * 10);
          break;
        }
        case 'reheat':
          if (!skipped) setOrbFloat({ key, text: signed(step.durability), up: step.durability > 0 });
          if (!seenLines.current.has('firstReheat')) {
            seenLines.current.add('firstReheat');
            speak(DWARF_LINES.firstReheat);
            onSeenRef.current('firstReheat');
          }
          break;
        case 'turn':
          if (step.fire === 'excellent') speak(DWARF_LINES.excellent);
          break;
        case 'complete':
        case 'break': {
          setEndBeat(true);
          // The hand sinks away first; the banner follows once the anvil shows how it ended.
          if (bannerTimer.current !== null) window.clearTimeout(bannerTimer.current);
          bannerTimer.current = window.setTimeout(() => {
            bannerTimer.current = null;
            setBannerUp(true);
          }, skipped ? 0 : TABLE_TIMING.bannerAfterEnd);
          const line = outcomeLines(cardCraftOutcome(cur))[0];
          // The closing line waits for the last blow's numbers to rise and fade.
          if (line !== undefined) {
            if (lineTimer.current !== null) window.clearTimeout(lineTimer.current);
            lineTimer.current = window.setTimeout(() => {
              lineTimer.current = null;
              speak(line);
            }, skipped ? 0 : TABLE_TIMING.lineAfterEnd);
          }
          break;
        }
        default:
          break;
      }
    },
    [speak],
  );

  const handleIdle = useCallback(() => {
    setShown(null);
    setFxIdle(true);
  }, []);

  // A new engine state: play its steps (the bars wait for each blow to land).
  useLayoutEffect(() => {
    const before = prev.current;
    if (before === craft) return;
    prev.current = craft;
    setSelected((s) => (s !== null && craft.hand.includes(s) ? s : null));
    const steps = effectsForPlay(before, craft);
    if (steps.length === 0) return;
    const api = stageApi.current;
    if (api === null) {
      for (const s of steps) handleBeat(s);
      setShown(null);
      return;
    }
    if (!api.busy()) setShown(snapOf(before));
    setFxIdle(false);
    api.enqueue(steps);
  }, [craft, handleBeat]);

  const onStageReady = useCallback(() => {
    const start = effectsForStart(craftRef.current);
    if (start.length > 0 && stageApi.current !== null) {
      setFxIdle(false);
      stageApi.current.enqueue(start);
    }
  }, []);

  // The first craft: the dwarf's opening line (4.2.9). Only on arrival at the anvil.
  useEffect(() => {
    if (!profile.firstCraftDone && craft.turn === 1 && craft.playedThisTurn === 0) speak(DWARF_LINES.firstCraft);
  }, []);

  useEffect(() => {
    if (say === null) return;
    const t = window.setTimeout(() => setSay((s) => (s?.key === say.key ? null : s)), TABLE_TIMING.say);
    return () => window.clearTimeout(t);
  }, [say]);

  // The finished iron stays a moment (after its effects) before the result screen.
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  useEffect(() => {
    if (active || !fxIdle) return;
    const t = window.setTimeout(() => finishedRef.current(), reduced ? TABLE_TIMING.endHoldReduced : END_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [active, fxIdle, reduced]);
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => finishedRef.current(), TABLE_TIMING.endSafety);
    return () => window.clearTimeout(t);
  }, [active]);

  // The art table covers the page: keep the page under it from scrolling.
  useEffect(() => {
    document.body.classList.add('ft-lock');
    return () => document.body.classList.remove('ft-lock');
  }, []);

  // ---- What is on screen ----
  const engine = snapOf(craft);
  const g = shown ?? engine;
  const previewUid = dragUid ?? selected;
  const preview = previewUid !== null && craft.hand.includes(previewUid) ? safePreview(craft, previewUid) : null;
  const piles = pileCounts(craft);
  const effects = activeEffects(craft);
  const ruleNotes = inRun === true ? [] : cardRuleNotes(craft.rules).filter((n) => n !== '식는 쇠');
  const nextFire = nextFirePreview(craft);
  const tier = currentTier(craft);
  const stoked = FIRE_BUFFS.some((b) => (craft.buffs[b] ?? 0) > 0);
  const view = useMemo<SceneView>(
    () => ({
      heat: craft.heat,
      fire: craft.fire,
      status: craft.status,
      abandoned: craft.abandoned,
      weaponType: r.weaponType,
      tier,
      legendary: r.grade === 'legendary',
      stoked,
    }),
    [craft.heat, craft.fire, craft.status, craft.abandoned, r.weaponType, tier, r.grade, stoked],
  );
  const nothingToPlay = active && views.every((v) => v.block !== null);
  // The craft is over: the hand sinks away at the last blow, the banner comes a moment later.
  const showEnd = !active && (endBeat || fxIdle);
  const showBanner = !active && (bannerUp || fxIdle);
  const turnWord = props.turnWord ?? '턴';
  const shownTier = g.tier;

  const pileEl = (k: PileKind): HTMLElement | null =>
    k === 'draw' ? drawRef.current : k === 'discard' ? discardRef.current : exhaustRef.current;

  const openPiles = () => {
    setSelected(null);
    setSheet({ kind: 'piles' });
    onPileOpen();
  };

  const tapStage = () => {
    const api = stageApi.current;
    if (api !== null && api.busy()) {
      api.skip();
      return;
    }
    setSelected(null);
  };

  const playView = (v: HandCardView) => {
    if (!active) return;
    flow.tryPlay(v);
  };

  const chips = (
    <>
      {effects.map((e) => (
        <span key={e} className={e.startsWith('식는 쇠') ? 'fs-chip lab' : 'fs-chip'}>
          {e}
        </span>
      ))}
      {ruleNotes.length > 0 && <span className="fs-chip lab">실험 · {ruleNotes.join(' · ')}</span>}
    </>
  );

  // A card is lifted: the gauge band rises just over it (tableLayout.ts), so the card and its
  // share on the bars read together; held still (실험 패널), the lifted card stays under it instead.
  const rise = bandRises && active && selected !== null ? bandRise(rows, views.length) : 0;

  /**
   * Where a floating number is drawn to as it sets off: the tip of its bar's fill, the 열기 badge,
   * the durability orb. The band may still be sliding up or down: aim where it is going.
   */
  const floatTarget = (kind: Floater['kind']): { x: number; y: number } | null => {
    const band = bandEl.current;
    let slide = 0;
    if (band !== null && kind !== 'restore') {
      const t = getComputedStyle(band).transform;
      const now = t === 'none' || t === '' ? 0 : new DOMMatrixReadOnly(t).m42;
      slide = -rise - now;
    }
    const center = (el: Element | null) => {
      if (el === null) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 + slide };
    };
    if (kind === 'progress' || kind === 'quality') {
      const track = kind === 'progress' ? bandProgress.current : bandQuality.current;
      if (track === null) return null;
      // Where the fill is going (it may still be sliding there).
      const b = track.getBoundingClientRect();
      const share = kind === 'progress' ? g.progress / Math.max(1, r.progressRequired) : g.quality / Math.max(1, r.qualityCap);
      const tip = b.left + Math.max(0, Math.min(1, share)) * b.width;
      return { x: Math.max(b.left + 14, Math.min(b.right - 14, tip)), y: b.top + b.height / 2 + slide };
    }
    if (kind === 'heat') return center(bandHeat.current);
    if (kind === 'restore') return center(orbRef.current);
    return null;
  };
  const rowVars = {
    '--ft-top-h': `${rows.top.h}px`,
    '--ft-band-h': `${rows.band.h}px`,
    '--ft-hand-h': `${rows.hand.h}px`,
    '--ft-foot-h': `${rows.foot.h}px`,
  } as CSSProperties;

  const ending = showBanner ? (
    <button
      type="button"
      className={`fs-end ${craft.status === 'success' ? 'ok' : 'fail'} fs-end-tier-${tier}`}
      onClick={(e) => {
        e.stopPropagation();
        onFinished();
      }}
    >
      <b>{craft.status === 'success' ? '완성' : craft.abandoned ? '망치를 내려놓았다' : '쇠가 갈라졌다'}</b>
      {craft.status === 'success' && (
        <span className="fs-end-stars">
          {stars(tier)} <i>{tierName(tier)}</i>
        </span>
      )}
      <small>눌러서 넘어간다</small>
    </button>
  ) : null;
  const notice = props.notice !== undefined && props.notice !== null ? props.notice : null;

  const orbUrl = uiArtUrl('orb_durability');
  const reheatUrl = uiArtUrl('btn_reheat');
  const durAfter = preview !== null ? engine.durability + preview.durability : null;
  // A breaking card's preview may go below 0 (shown in red); at rest the orb never does.
  const durShown = Math.max(0, g.durability);

  return (
    <div ref={rootRef} className={`ft-root${reduced ? ' reduced' : ''}${rows.top.h < TABLE_ROWS.top ? ' short' : ''}`} style={rowVars}>
      <header className="ft-top">
        {props.onExit !== undefined && (
          <button type="button" className="ft-iconbtn" onClick={props.onExit} aria-label={props.exitLabel ?? '나가기'}>
            ←
          </button>
        )}
        <div className="ft-title">
          <b>{props.title ?? weaponTitle(r.weaponType, r.materialTier)}</b>
          <span className={`kc-tag kc-grade-${r.grade}`}>{CARD_RECIPE_GRADE_LABEL[r.grade]}</span>
        </div>
        <div className="ft-turn" aria-label={`${craft.turn}${turnWord}`}>
          <b>{craft.turn}</b>
          <small>{turnWord}</small>
        </div>
        <div className={`ft-stars ft-tier-${shownTier}`} aria-label={`지금 ${tierName(shownTier)}`}>
          <span className="ft-stars-full">{stars(shownTier)}</span>
          <span className="ft-stars-short" aria-hidden="true">
            ★<b>{shownTier}</b>
          </span>
        </div>
        <button type="button" className="ft-iconbtn" onClick={() => setSheet({ kind: 'menu' })} aria-label="메뉴">
          ☰
        </button>
      </header>
      {notice !== null && <div className="ft-notice">{notice}</div>}

      <ForgeStage
        view={view}
        floaters={floaters}
        say={say}
        reduced={reduced}
        floatTarget={floatTarget}
        apiRef={stageApi}
        onReady={onStageReady}
        onBeat={handleBeat}
        onIdle={handleIdle}
        onUnavailable={props.onUnavailable}
        onTap={tapStage}
      />

      <GaugeBand
        shown={g}
        engine={engine}
        preview={preview}
        progressRequired={r.progressRequired}
        qualityCap={r.qualityCap}
        tierFx={tierFx}
        done={showEnd}
        rise={rise}
        chips={chips}
        nextFire={nextFire}
        floaters={floaters}
        reduced={reduced}
        targets={bandTargets}
        onFireTap={() => setSheet({ kind: 'fire' })}
        onTap={tapStage}
      />

      <div className={`ft-hand${showEnd ? ' ended' : ''}`}>
        {/* The craft is over: the banner sits where the hand was, so the scene (the weapon, his face) stays clear. */}
        {ending !== null && <div className="ft-end-wrap">{ending}</div>}
        <p className={`ft-hint${nothingToPlay ? ' warn' : ''}`} aria-live="polite" hidden={!active}>
          {!active
            ? ''
            : nothingToPlay
              ? '낼 카드가 없다. 다시 달굴 때다.'
              : selected !== null || dragUid !== null
                ? ''
                : '카드를 눌러 들어 본다 · 길게 누르면 설명'}
        </p>
        <ArtHand
          views={views}
          craft={craft}
          active={active}
          selected={selected}
          onSelect={setSelected}
          onPlay={playView}
          onInfo={(uid) => {
            setSelected(null);
            flow.openInfo(uid);
          }}
          onDrag={setDragUid}
          apiRef={handApi}
          pileEl={pileEl}
          target={() => stageApi.current?.cardClient() ?? null}
          liftMaxH={bandRises ? rows.liftMaxH : rows.liftMaxHStill}
          reduced={reduced}
        />
      </div>

      <footer className="ft-foot">
        <div
          ref={orbRef}
          className={`ft-orb${g.durability <= 6 ? ' danger' : ''}${preview?.breaks === true ? ' breaks' : ''}`}
          role="meter"
          aria-label={`내구도 ${durShown} / ${craft.maxDurability}`}
          aria-valuenow={durShown}
          aria-valuemax={craft.maxDurability}
        >
          {orbUrl !== null && <img className="ft-orb-img" src={orbUrl} alt="" draggable={false} />}
          <b>{durAfter !== null ? durAfter : durShown}</b>
          <small>/{craft.maxDurability}</small>
          {preview !== null && preview.durability !== 0 && <span className="ft-orb-cost">{signed(preview.durability)}</span>}
          {orbFloat !== null && (
            <span key={orbFloat.key} className={`ft-orb-float${orbFloat.up ? ' up' : ''}`}>
              {orbFloat.text}
            </span>
          )}
          {floaters
            .filter((f) => f.kind === 'restore' && f.hush !== true)
            .map((f) => (
              <span
                key={f.id}
                className="ft-orb-absorb"
                style={{ animationDelay: `${absorbDelay(f, reduced)}ms` }}
              />
            ))}
        </div>
        <PileButton refEl={drawRef} kind="draw" count={piles.draw} label="뽑을 더미" onClick={openPiles} />
        <span className="ft-foot-gap" />
        <PileButton refEl={discardRef} kind="discard" count={piles.discard} label="버린 더미" onClick={openPiles} />
        <PileButton refEl={exhaustRef} kind="exhaust" count={piles.exhausted} label="소멸" onClick={openPiles} />
        <button
          type="button"
          className={`ft-reheat${info.breaks ? ' danger' : ''}${nothingToPlay ? ' glow' : ''}${reheatUrl !== null ? ' pic' : ''}`}
          onClick={() => {
            setSelected(null);
            flow.endTurnTap();
          }}
          disabled={!active}
          style={reheatUrl !== null ? { backgroundImage: `url("${reheatUrl}")` } : undefined}
        >
          <b>다시 달구기</b>
          <small>
            내구도 {signed(info.durability)}
            {info.keep > 0 && ` · 간직 ${info.keep}`}
          </small>
        </button>
      </footer>

      <TableSheets
        sheet={sheet}
        setSheet={setSheet}
        craft={craft}
        profile={profile}
        inRun={inRun}
        bossMaterialName={props.bossMaterialName}
        commit={commit}
        tryPlay={flow.tryPlay}
        onEndTurn={onEndTurn}
        onAbandon={onAbandon}
      />
      {sheet?.kind === 'menu' && (
        <Sheet title="대장간" onClose={() => setSheet(null)}>
          <div className="ft-menu">
            <button type="button" className="kc-btn" onClick={() => setSheet({ kind: 'log' })}>
              턴 기록
            </button>
            <button type="button" className="kc-btn" onClick={openPiles}>
              남은 카드
            </button>
            <button type="button" className="kc-btn" onClick={() => setSheet({ kind: 'rules' })}>
              규칙
            </button>
            {(props.menu ?? []).map((m) => (
              <button
                key={m.label}
                type="button"
                className="kc-btn"
                onClick={() => {
                  setSheet(null);
                  m.onClick();
                }}
              >
                {m.label}
              </button>
            ))}
            {active && (
              <button type="button" className="kc-btn danger" onClick={() => setSheet({ kind: 'quit' })}>
                망치를 내려놓는다
              </button>
            )}
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'fire' && (
        <Sheet title={`화로 · ${FIRE_LABEL[g.fire]}`} onClose={() => setSheet(null)}>
          <p>{FIRE_HINT[g.fire] !== '' ? FIRE_HINT[g.fire] : '특별한 것 없이 고르게 탄다.'}</p>
          <p className="kc-hint">화로 상태는 턴마다 바뀐다. 좋음·최상에 품질 카드를 몰아 치면 별이 오른다.</p>
          {nextFire !== null && <p className="kc-hint">불꽃 읽기: 다음 턴은 {FIRE_LABEL[nextFire]}.</p>}
          <ul className="ft-fires">
            {fireStatesOf(r.grade).map((f) => (
              <li key={f} className={f === g.fire ? 'on' : undefined}>
                <span className={`kc-dot kc-fire-${f}`}>{FIRE_LABEL[f]}</span>
                <small>{FIRE_HINT[f] !== '' ? FIRE_HINT[f] : '기본'}</small>
              </li>
            ))}
          </ul>
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
    </div>
  );
}

function PileButton(props: {
  refEl: RefObject<HTMLButtonElement | null>;
  kind: PileKind;
  count: number;
  label: string;
  onClick(): void;
}) {
  const url = uiArtUrl(`pile_${props.kind}`);
  return (
    <button
      ref={props.refEl}
      type="button"
      className={`ft-pile ft-pile-${props.kind}`}
      onClick={props.onClick}
      aria-label={`${props.label} ${props.count}장`}
    >
      {url !== null ? (
        <img className="ft-pile-img" src={url} alt="" draggable={false} />
      ) : (
        <span className="ft-pile-css" aria-hidden="true">
          {props.kind === 'exhaust' ? <UiIcon glyph="flame" url={null} className="ft-pile-glyph" /> : null}
        </span>
      )}
      <b>{props.count}</b>
      <small>{props.kind === 'draw' ? '뽑을' : props.kind === 'discard' ? '버린' : '소멸'}</small>
    </button>
  );
}
