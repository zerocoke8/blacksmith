// 시즌 악마의 탑 (육성 한 판, 기획서 13장) 프로토타입: 준비 → 턴 화면 ↔ 원정 결과 · 단조 · 사건 →
// 판 끝 → 명예의 전당, plus the [검증] panel. Every rule question is answered by the engine
// (src/sim/run); this component only threads the player's taps through runAct, saves after each
// one (platform/storage.ts, so a reload replays to the same turn), and notes how long each decision
// took for the play log (platform/clock.ts).

import { useEffect, useMemo, useRef, useState } from 'react';
import { systemClock } from '../../platform/clock.ts';
import type { CardCraftState, PlayOptions } from '../../sim/cards/index.ts';
import { CARD_RECIPE_GRADE_LABEL, type CardId } from '../../sim/data/cards.ts';
import { materialName, WEAPON_LABEL } from '../../sim/data/common.ts';
import { FAMILIES } from '../../sim/data/families.ts';
import { SEASONS } from '../../sim/data/run.ts';
import {
  actionBlock,
  deckEntries,
  emptyHall,
  hallAdd,
  type HallOfFame,
  type RunAction,
  runAct,
  type RunSetupInput,
  type RunState,
  runDeckProblems,
  startRun,
  turnView,
} from '../../sim/run/index.ts';
import { cardStore } from '../cards/store.ts';
import '../cards/cards.css';
import { ChoiceView } from './Choice.tsx';
import { End } from './End.tsx';
import { ExpeditionResult } from './Expedition.tsx';
import { finalCraft, screenOf, TURN_ACTIONS, unseenExpedition } from './flow.ts';
import { ForgeDone, ForgeTable } from './Forge.tsx';
import { Hall } from './Hall.tsx';
import { RunLabPanel } from './Lab.tsx';
import { defaultDraft, draftWithAncestors, Prep } from './Prep.tsx';
import { buildRunRecord, type RunRecord } from './record.ts';
import './run.css';
import {
  addForgeTurnTime,
  addMetaTime,
  defaultPrefs,
  newMeta,
  type PrepDraft,
  RUN_IDLE_CAP_MS,
  RUN_RECORD_LIMIT,
  type RunLab,
  type RunMeta,
  type RunPrefs,
  runStore,
} from './store.ts';
import { RUN_CHANGED_LINE, RUN_PARTIAL_LINE } from './text.ts';
import { Turn } from './Turn.tsx';

interface Props {
  onExit(): void;
}

type Overlay = 'hall' | 'lab' | null;

export function RunMode({ onExit }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [hall, setHall] = useState<HallOfFame>(emptyHall());
  const [prefs, setPrefs] = useState<RunPrefs>(defaultPrefs());
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [hallPicking, setHallPicking] = useState(false);
  /** A 단조 just ended: keep the table up until its last moment is shown. */
  const [holding, setHolding] = useState(false);
  const [failedCraft, setFailedCraft] = useState<CardCraftState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [runLost, setRunLost] = useState(false);

  // Latest values for handlers, so two quick taps never act on a stale state.
  const runRef = useRef<RunState | null>(null);
  const metaRef = useRef<RunMeta | null>(null);
  const hallRef = useRef<HallOfFame>(emptyHall());
  const prefsRef = useRef<RunPrefs>(defaultPrefs());
  const recordsRef = useRef<RunRecord[]>([]);
  const overlayRef = useRef<Overlay>(null);
  const lastTick = useRef<number | null>(null);
  const pendingMs = useRef(0);

  const saved = (p: Promise<boolean>) => {
    p.then((ok) => {
      if (!ok) setSaveFailed(true);
    }).catch(() => setSaveFailed(true));
  };
  const putRun = (r: RunState | null) => {
    runRef.current = r;
    setRun(r);
    saved(runStore.saveRun(r));
  };
  const putMeta = (m: RunMeta | null) => {
    metaRef.current = m;
    setMeta(m);
    saved(runStore.saveMeta(m));
  };
  const putPrefs = (p: RunPrefs) => {
    prefsRef.current = p;
    setPrefs(p);
    saved(runStore.savePrefs(p));
  };
  const putRecords = (r: RunRecord[]) => {
    recordsRef.current = r;
    setRecords(r);
    saved(runStore.saveRecords(r));
  };
  const putHall = (h: HallOfFame) => {
    hallRef.current = h;
    setHall(h);
    saved(runStore.saveHall(h));
    // The 준비 화면's ancestors must still hang on the wall.
    const d = prefsRef.current.draft;
    if (d !== null && d.ancestors.some((id) => !h.cards.some((c) => c.id === id))) {
      putPrefs({ ...prefsRef.current, draft: draftWithAncestors(d, d.ancestors, h) });
    }
  };

  // ---- Time on screen (16.3의 11·12번) ----
  const pauseClock = () => {
    if (lastTick.current !== null) {
      pendingMs.current += Math.min(RUN_IDLE_CAP_MS, Math.max(0, systemClock.nowMs() - lastTick.current));
      lastTick.current = null;
    }
  };
  const resumeClock = () => {
    if (lastTick.current === null && overlayRef.current === null && !document.hidden) lastTick.current = systemClock.nowMs();
  };
  /** Time since the last charge (pauses excluded); restarts the clock. */
  const takeTime = (): number => {
    pauseClock();
    const ms = pendingMs.current;
    pendingMs.current = 0;
    resumeClock();
    return ms;
  };

  useEffect(() => {
    let alive = true;
    void runStore.loadAll().then((data) => {
      if (!alive) return;
      let m = data.meta;
      if (data.run !== null && m === null) {
        m = { ...newMeta(data.run.setup.seed, systemClock.nowMs(), data.run.setup.generation, 0), seenLogs: data.run.turnLog.length };
      }
      runRef.current = data.run;
      metaRef.current = data.run === null ? null : m;
      hallRef.current = data.hall;
      prefsRef.current = data.prefs;
      recordsRef.current = data.records;
      setRun(data.run);
      setMeta(metaRef.current);
      setHall(data.hall);
      setPrefs(data.prefs);
      setRecords(data.records);
      setRunLost(data.runLost);
      if (data.run !== null && data.runStatus !== null && data.runStatus !== 'same') {
        // The game was updated under this run: say so once, and keep the run as it replays now.
        setNotice(data.runStatus === 'changed' ? RUN_CHANGED_LINE : RUN_PARTIAL_LINE);
        saved(runStore.saveRun(data.run));
      }
      setLoaded(true);
      resumeClock();
    });
    const onVisible = () => {
      if (document.hidden) pauseClock();
      else resumeClock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      pauseClock();
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Mount only: handlers read refs.
  }, []);

  const screen = screenOf(run, meta, holding);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // A run that is over goes into the play log once, when its 판 끝 화면 is reached.
  useEffect(() => {
    if (screen !== 'over') return;
    const s = runRef.current;
    const m = metaRef.current;
    if (s === null || m === null || m.recorded || s.phase !== 'over') return;
    const record = buildRunRecord(s, m, systemClock.nowMs(), prefsRef.current.lab.tapToPreview);
    const list = recordsRef.current.filter((r) => r.id !== record.id);
    putRecords([...list, record].slice(-RUN_RECORD_LIMIT));
    putMeta({ ...m, recorded: true });
  }, [screen]);

  const openOverlay = (o: Overlay, picking = false) => {
    pauseClock();
    overlayRef.current = o;
    setOverlay(o);
    setHallPicking(picking);
    window.scrollTo(0, 0);
  };
  const closeOverlay = () => {
    overlayRef.current = null;
    setOverlay(null);
    setHallPicking(false);
    resumeClock();
  };

  // ---- Acting ----

  /** Charges the time since the last charge to what the player was looking at before this action. */
  const charge = (m: RunMeta, s: RunState, ms: number): RunMeta => {
    const f = s.forge;
    if (s.phase === 'forge' && f !== null) return addForgeTurnTime(m, f.no, f.craft?.turn ?? 1, ms);
    if (s.phase === 'forgeDone' && f !== null) return addMetaTime(m, 'forgeMs', f.no, ms);
    if (s.phase === 'choice') return addMetaTime(m, 'choiceMs', s.turnLog[s.turnLog.length - 1]?.turn ?? s.turn, ms);
    return addMetaTime(m, 'turnMs', s.turn, ms);
  };

  /** One action through the engine. False (and a notice) when it cannot be taken. */
  const act = (action: RunAction): boolean => {
    const s = runRef.current;
    const m = metaRef.current;
    if (s === null || m === null) return false;
    const reason = actionBlock(s, action);
    if (reason !== null) {
      setNotice(reason);
      return false;
    }
    let next: RunState;
    try {
      next = runAct(s, action);
    } catch {
      setNotice('지금은 그렇게 할 수 없다.');
      return false;
    }
    let m2 = charge(m, s, takeTime());
    if (TURN_ACTIONS.includes(action.type)) m2 = { ...m2, seenLogs: Math.max(m2.seenLogs, s.turnLog.length) };
    if (s.phase === 'forge' && next.phase !== 'forge') {
      const prev = s.forge?.craft ?? null;
      const kept = next.forge?.craft ?? null;
      const last = kept ?? (prev === null ? null : finalCraft(prev, action));
      if (last !== null) {
        setHolding(true);
        setFailedCraft(kept === null ? last : null);
      }
    }
    // The dwarf's first-craft line belongs to the first 단조 ever; it is spent once that one ends.
    if (s.phase === 'forge' && next.phase !== 'forge') markSeen('firstCraft');
    setNotice(null);
    putRun(next);
    putMeta(m2);
    return true;
  };

  const ackResult = (skipped: boolean) => {
    const s = runRef.current;
    const m = metaRef.current;
    if (s === null || m === null) return;
    const log = unseenExpedition(s, m);
    const m2 = addMetaTime(m, 'resultMs', log?.turn ?? s.turn, takeTime());
    putMeta({ ...m2, seenLogs: s.turnLog.length, reveals: m2.reveals + 1, skips: m2.skips + (skipped ? 1 : 0) });
  };

  const start = (input: RunSetupInput) => {
    let s: RunState;
    try {
      s = startRun(input);
    } catch {
      setNotice('준비가 덜 됐다.');
      return;
    }
    const p = prefsRef.current;
    const m = newMeta(input.seed, systemClock.nowMs(), s.setup.generation, takeTime());
    const lab: RunLab = p.lab.seedStep ? { ...p.lab, seed: p.lab.seed + 1 } : p.lab;
    putPrefs({ ...p, lab });
    setHolding(false);
    setFailedCraft(null);
    setNotice(null);
    setRunLost(false);
    putRun(s);
    putMeta(m);
  };

  const clearRun = () => {
    takeTime();
    setHolding(false);
    setFailedCraft(null);
    setNotice(null);
    putRun(null);
    putMeta(null);
  };

  const hang = (evictId: string | null) => {
    const s = runRef.current;
    const m = metaRef.current;
    if (s === null || m === null || s.result === null || m.hallId !== null) return;
    let h: HallOfFame;
    try {
      h = hallAdd(hallRef.current, s.result.legend, evictId);
    } catch {
      setNotice('벽에 걸 자리가 없다.');
      return;
    }
    const placed = h.cards[h.cards.length - 1];
    putHall(h);
    putMeta({ ...m, hallId: placed?.id ?? s.result.legend.id });
  };

  const markSeen = (line: string) => {
    const p = prefsRef.current;
    if (!p.seen.includes(line)) putPrefs({ ...p, seen: [...p.seen, line] });
  };
  const countOpen = (k: 'pileOpens' | 'infoOpens') => {
    const m = metaRef.current;
    if (m !== null) putMeta({ ...m, [k]: m[k] + 1 });
  };
  const updateLab = (update: (lab: RunLab) => RunLab) => {
    const p = prefsRef.current;
    putPrefs({ ...p, lab: update(p.lab) });
  };
  const draft: PrepDraft = prefs.draft ?? defaultDraft();
  const setDraft = (d: PrepDraft) => putPrefs({ ...prefsRef.current, draft: d });
  const loadBenchDeck = async (): Promise<CardId[] | null> => {
    try {
      const data = await cardStore.loadAll();
      const deck = data.profile.decks.basic;
      return deck.length > 0 && runDeckProblems(deck).every((p) => p.code !== 'notDeckCard') ? [...deck] : null;
    } catch {
      return null;
    }
  };

  const view = useMemo(() => (run !== null && run.phase === 'turn' && screen === 'turn' ? turnView(run) : null), [run, screen]);

  if (!loaded) return <div className="kc-root kc-loading">탑을 올려다보는 중…</div>;

  const f = run?.forge ?? null;
  const craft = f?.craft ?? (holding ? failedCraft : null);
  const title =
    overlay === 'hall'
      ? '명예의 전당'
      : overlay === 'lab'
        ? '실험'
        : screen === 'prep'
          ? '판 준비'
          : screen === 'forge'
            ? null
            : screen === 'forgeDone'
              ? '완성'
              : screen === 'result'
                ? '원정 결과'
                : screen === 'choice'
                  ? `${run?.turnLog[run.turnLog.length - 1]?.turn ?? run?.turn ?? ''}턴 끝`
                  : screen === 'over'
                    ? '판 끝'
                    : '시즌 악마의 탑';

  return (
    <div className="kc-root rn-root">
      <div className="kc-bar">
        {overlay !== null ? (
          <button type="button" className="kc-btn ghost small" onClick={closeOverlay}>
            ← 돌아가기
          </button>
        ) : (
          <button type="button" className="kc-btn ghost small" onClick={onExit} aria-label="마을로">
            ← 마을로
          </button>
        )}
        {title === null && run !== null && f !== null && craft !== null ? (
          <span className="kc-bar-title kc-bar-craft">
            <b>
              단조 {f.no} · {materialName(f.materialTier)} {WEAPON_LABEL[FAMILIES[run.setup.hero.family].weapon]}
            </b>
            <span className={`kc-tag kc-grade-${f.grade}`}>{CARD_RECIPE_GRADE_LABEL[f.grade]}</span>
            <span className="kc-turn">{craft.turn}손</span>
          </span>
        ) : (
          <span className="kc-bar-title">{title ?? '단조'}</span>
        )}
        {overlay === null && (
          <>
            {screen !== 'forge' && (
              <button type="button" className="kc-btn ghost small" onClick={() => openOverlay('hall')}>
                전당
              </button>
            )}
            <button type="button" className="kc-btn ghost small" onClick={() => openOverlay('lab')}>
              실험
            </button>
          </>
        )}
      </div>
      {saveFailed && (
        <p className="kc-why" role="alert">
          저장이 되지 않는다. 새로고침하면 지금 판이 사라질 수 있다.
        </p>
      )}
      {notice !== null && overlay === null && (
        <p className="kc-why" role="status" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}

      {overlay === 'hall' && (
        <Hall
          hall={hall}
          onChange={putHall}
          picking={
            hallPicking
              ? {
                  selected: draft.ancestors,
                  onToggle: (id) => {
                    const ids = draft.ancestors.includes(id) ? draft.ancestors.filter((x) => x !== id) : [...draft.ancestors, id];
                    setDraft(draftWithAncestors(draft, ids, hallRef.current));
                  },
                }
              : null
          }
        />
      )}
      {overlay === 'lab' && (
        <RunLabPanel
          lab={prefs.lab}
          records={records}
          run={run}
          hallCount={hall.cards.length}
          onLab={updateLab}
          onDropRun={clearRun}
          onClearRecords={() => putRecords([])}
          onClearHall={() => putHall(emptyHall())}
        />
      )}

      {overlay === null && screen === 'prep' && (
        <Prep
          draft={draft}
          lab={prefs.lab}
          hall={hall}
          records={records}
          runLost={runLost}
          onDraft={setDraft}
          onStart={start}
          onPickAncestors={() => openOverlay('hall', true)}
          onLab={() => openOverlay('lab')}
          loadBenchDeck={loadBenchDeck}
        />
      )}
      {overlay === null && screen === 'turn' && run !== null && meta !== null && view !== null && (
        <Turn run={run} meta={meta} view={view} onAct={act} />
      )}
      {overlay === null && screen === 'forge' && craft !== null && (
        <ForgeTable
          key={`forge-${craft.setup.craftNo}`}
          craft={craft}
          tapToPreview={prefs.lab.tapToPreview}
          firstSeen={prefs.seen.includes('firstCraft')}
          seen={prefs.seen}
          onPlay={(uid: string, opts: PlayOptions) => act({ type: 'forgePlay', uid, opts })}
          onEndTurn={(keep: string[]) => act({ type: 'forgeEndTurn', keep })}
          onAbandon={() => act({ type: 'forgeAbandon' })}
          onPileOpen={() => countOpen('pileOpens')}
          onInfoOpen={() => countOpen('infoOpens')}
          onSeen={markSeen}
          onFinished={() => {
            setHolding(false);
            setFailedCraft(null);
          }}
          bossMaterialName={SEASONS[run?.setup.season ?? 'ash'].bossMaterial.name}
        />
      )}
      {overlay === null && screen === 'forge' && craft === null && (
        <div className="rn-empty">
          <p>쇠가 식었다.</p>
          <button
            type="button"
            className="kc-btn primary"
            onClick={() => {
              setHolding(false);
              setFailedCraft(null);
            }}
          >
            턴으로
          </button>
        </div>
      )}
      {overlay === null && screen === 'forgeDone' && run !== null && (
        <ForgeDone
          key={`done-${f?.no ?? 0}`}
          run={run}
          onBuy={(item) => act({ type: 'buy', item, count: 1 })}
          onFinish={(picks, hang) => act(hang ? { type: 'forgeFinish', hang: true } : { type: 'forgeFinish', picks })}
        />
      )}
      {overlay === null && screen === 'result' && run !== null && (() => {
        const log = unseenExpedition(run, meta);
        if (log === null) return null;
        return (
          <ExpeditionResult
            key={`exp-${log.turn}-${log.expedition?.no ?? 0}`}
            log={log}
            season={run.setup.season}
            bossReward={run.pending.some((c) => c.kind === 'bossReward')}
            onDone={ackResult}
          />
        );
      })()}
      {overlay === null && screen === 'choice' && run !== null && run.pending[0] !== undefined && (
        <ChoiceView
          key={`choice-${run.pending[0].id}`}
          choice={run.pending[0]}
          gold={run.gold}
          more={run.pending.length - 1}
          deck={deckEntries(run)}
          onChoose={(option) => act({ type: 'choose', option })}
        />
      )}
      {overlay === null && screen === 'over' && run !== null && meta !== null && (
        <End
          run={run}
          meta={meta}
          hall={hall}
          onHang={hang}
          onDecline={() => {
            const m = metaRef.current;
            if (m !== null) putMeta({ ...m, hallDeclined: true });
          }}
          onNext={clearRun}
        />
      )}
    </div>
  );
}
