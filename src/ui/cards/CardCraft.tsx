// 카드 제작 프로토타입 (기획서 4.2): 준비 → 제작 → 완성, plus the 작업대 and the [검증] panel.
// Every change is saved through platform/storage.ts, so a reload resumes the same turn with
// the same hand. Time on the anvil is measured with platform/clock.ts for the play log.

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { systemClock } from '../../platform/clock.ts';
import { type CardRecipeInput, checkPlay, type PlayOptions, type SlotPick } from '../../sim/cards/index.ts';
import { CARD_RECIPE_GRADE_LABEL, type CardRecipeGrade } from '../../sim/data/cards.ts';
import { artScreenActive } from './artPref.ts';
import { Bench } from './Bench.tsx';
import {
  addTime,
  beginSession,
  deckProblems,
  gradeOf,
  sessionAbandon,
  sessionEndTurn,
  sessionFill,
  sessionPlay,
  settle,
} from './flow.ts';
import { Lab } from './Lab.tsx';
import { Prep } from './Prep.tsx';
import { Result } from './Result.tsx';
import {
  type CardProfile,
  type CardSession,
  cardStore,
  defaultProfile,
  IDLE_CAP_MS,
  type LabSettings,
  type PlayRecord,
} from './store.ts';
import { Table } from './Table.tsx';
import { weaponTitle } from './text.ts';
import { sceneArtUrl } from '../../render/forge/assets.ts';
import './cards.css';
import './skin.css';

/** The workshop wall behind the 준비, 작업대 and 완성 screens. */
const BACKDROP = sceneArtUrl('bg_workshop');

interface Props {
  onExit(): void;
}

type Overlay = 'bench' | 'lab' | null;

export function CardCraft({ onExit }: Props) {
  const [profile, setProfile] = useState<CardProfile | null>(null);
  const [session, setSession] = useState<CardSession | null>(null);
  const [records, setRecords] = useState<PlayRecord[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [benchGrade, setBenchGrade] = useState<CardRecipeGrade>('basic');
  /** The craft ended on this visit: hold the table until its last moment is shown. */
  const [holding, setHolding] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Latest values for handlers, so two quick taps never act on a stale state.
  const profileRef = useRef<CardProfile | null>(null);
  const sessionRef = useRef<CardSession | null>(null);
  const recordsRef = useRef<PlayRecord[]>([]);
  const overlayRef = useRef<Overlay>(null);
  // Time on the anvil: lastTick is when the clock last started; paused time is not counted.
  const lastTick = useRef<number | null>(null);
  const pendingMs = useRef(0);

  const saved = (p: Promise<boolean>) => {
    p.then((ok) => {
      if (!ok) setSaveFailed(true);
    }).catch(() => setSaveFailed(true));
  };
  const putProfile = (p: CardProfile) => {
    profileRef.current = p;
    setProfile(p);
    saved(cardStore.saveProfile(p));
  };
  const putSession = (s: CardSession | null) => {
    sessionRef.current = s;
    setSession(s);
    saved(cardStore.saveSession(s));
  };
  const putRecords = (r: PlayRecord[]) => {
    recordsRef.current = r;
    setRecords(r);
    saved(cardStore.saveRecords(r));
  };

  const crafting = () => sessionRef.current !== null && sessionRef.current.craft.status === 'active';

  const pauseClock = () => {
    if (lastTick.current !== null) {
      pendingMs.current += Math.min(IDLE_CAP_MS, Math.max(0, systemClock.nowMs() - lastTick.current));
      lastTick.current = null;
    }
  };
  const resumeClock = () => {
    if (lastTick.current === null && overlayRef.current === null && !document.hidden && crafting()) {
      lastTick.current = systemClock.nowMs();
    }
  };
  /** Time since the last action (pauses excluded); restarts the clock. */
  const takeTime = (): number => {
    pauseClock();
    const ms = pendingMs.current;
    pendingMs.current = 0;
    resumeClock();
    return ms;
  };

  /** A craft that is over goes into the profile and the play log, once. */
  const finish = (next: CardSession) => {
    const p = profileRef.current;
    if (p !== null && next.craft.status !== 'active') {
      const done = settle(p, next, recordsRef.current, systemClock.nowMs());
      if (done !== null) {
        putProfile(done.profile);
        putRecords(done.records);
        putSession(done.session);
        return;
      }
    }
    putSession(next);
  };

  useEffect(() => {
    let alive = true;
    void cardStore.loadAll().then((data) => {
      if (!alive) return;
      profileRef.current = data.profile;
      sessionRef.current = data.session;
      recordsRef.current = data.records;
      setProfile(data.profile);
      setSession(data.session);
      setRecords(data.records);
      if (data.session !== null && data.session.craft.status !== 'active' && !data.session.recorded) finish(data.session);
      resumeClock();
    });
    const onVisible = () => {
      if (document.hidden) pauseClock();
      else resumeClock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Mount only: handlers read refs.
  }, []);

  const openOverlay = (o: Overlay) => {
    pauseClock();
    overlayRef.current = o;
    setOverlay(o);
    window.scrollTo(0, 0);
  };
  const closeOverlay = () => {
    overlayRef.current = null;
    setOverlay(null);
    resumeClock();
  };

  // ---- Actions ----

  const start = (recipe: CardRecipeInput) => {
    const p = profileRef.current;
    if (p === null || crafting()) return;
    if (deckProblems(p, gradeOf(recipe)).length > 0) return;
    const now = systemClock.nowMs();
    const begun = beginSession(p, recipe, now, artScreenActive());
    // The bumped craft number is written before the session: a crash skips a number, never reuses one.
    putProfile(begun.profile);
    putSession(begun.session);
    setHolding(false);
    pendingMs.current = 0;
    lastTick.current = null;
    resumeClock();
    window.scrollTo(0, 0);
  };

  const act = (step: (s: CardSession, now: number) => CardSession) => {
    const s = sessionRef.current;
    if (s === null || s.craft.status !== 'active') return;
    let next: CardSession;
    try {
      next = step(addTime(s, takeTime()), systemClock.nowMs());
    } catch {
      return; // The engine refused (a stale tap); the screen already shows the truth.
    }
    if (next.craft.status !== 'active') {
      setHolding(true);
      pauseClock();
    }
    finish(next);
  };

  const play = (uid: string, opts: PlayOptions) => {
    const s = sessionRef.current;
    if (s === null) return;
    try {
      if (!checkPlay(s.craft, uid, opts).ok) return;
    } catch {
      return;
    }
    act((cur, now) => sessionPlay(cur, uid, opts, now));
  };

  const endTurn = (keep: string[]) => act((cur, now) => sessionEndTurn(cur, keep, now));

  const abandon = () => {
    act((cur, now) => sessionAbandon(cur, now));
    setHolding(false);
  };

  const pick = (p: SlotPick) => {
    const s = sessionRef.current;
    const next = s === null ? null : sessionFill(s, p);
    if (next !== null) putSession(next);
  };

  const again = () => {
    setHolding(false);
    putSession(null);
    window.scrollTo(0, 0);
  };

  /** The table on screen changed (the art screen switched off, or it could not start): the record says which one was used. */
  const noteScreen = (art: boolean) => {
    const s = sessionRef.current;
    if (s !== null && s.craft.status === 'active' && s.artScreen !== art) putSession({ ...s, artScreen: art });
  };

  const countOpen = (k: 'pileOpens' | 'infoOpens') => {
    const s = sessionRef.current;
    if (s !== null && s.craft.status === 'active') putSession({ ...s, [k]: s[k] + 1 });
  };

  const markSeen = useCallback((line: string) => {
    const p = profileRef.current;
    if (p !== null && !p.seen.includes(line)) putProfile({ ...p, seen: [...p.seen, line] });
    // putProfile only touches refs and setters.
  }, []);

  const updateProfile = (update: (p: CardProfile) => CardProfile) => {
    const p = profileRef.current;
    if (p !== null) putProfile(update(p));
  };
  const updateLab = (update: (lab: LabSettings) => LabSettings) => updateProfile((p) => ({ ...p, lab: update(p.lab) }));

  if (profile === null) {
    return <div className="kc-root kc-loading">화로를 살피는 중…</div>;
  }

  const phase = session === null ? 'prep' : session.craft.status === 'active' || holding ? 'craft' : 'result';
  const title =
    overlay === 'bench'
      ? '작업대'
      : overlay === 'lab'
        ? '실험'
        : phase === 'prep'
          ? '제작 준비'
          : phase === 'craft'
            ? '제작'
            : session?.craft.status === 'success'
              ? '완성'
              : '결과';

  const saveWarning = (
    <p className="kc-why" role="alert">
      저장이 되지 않는다. 새로고침하면 지금 것이 사라질 수 있다.
    </p>
  );

  return (
    <div className="kc-root kc-skin" style={BACKDROP !== null ? ({ '--kc-bg': `url("${BACKDROP}")` } as CSSProperties) : undefined}>
      <div className="kc-bar">
        {overlay !== null ? (
          <button type="button" className="kc-btn ghost small" onClick={closeOverlay}>
            ← {phase === 'craft' ? '제작으로' : '돌아가기'}
          </button>
        ) : (
          <button type="button" className="kc-btn ghost small" onClick={onExit} aria-label="가게로">
            {phase === 'craft' ? '←' : '← 가게로'}
          </button>
        )}
        {overlay === null && phase === 'craft' && session !== null ? (
          <span className="kc-bar-title kc-bar-craft">
            <b>{weaponTitle(session.craft.recipe.weaponType, session.craft.recipe.materialTier)}</b>
            <span className={`kc-tag kc-grade-${session.craft.recipe.grade}`}>
              {CARD_RECIPE_GRADE_LABEL[session.craft.recipe.grade]}
            </span>
            <span className="kc-turn">{session.craft.turn}턴</span>
          </span>
        ) : (
          <span className="kc-bar-title">{title}</span>
        )}
        {overlay === null && (
          <>
            <button
              type="button"
              className="kc-btn ghost small"
              onClick={() => {
                if (session !== null) setBenchGrade(session.craft.recipe.grade);
                else setBenchGrade(gradeOf(profile.lastRecipe));
                openOverlay('bench');
              }}
            >
              작업대
            </button>
            <button type="button" className="kc-btn ghost small" onClick={() => openOverlay('lab')}>
              실험
            </button>
          </>
        )}
      </div>
      {saveFailed && !(overlay === null && phase === 'craft') && saveWarning}

      {overlay === 'bench' && (
        <Bench
          profile={profile}
          grade={benchGrade}
          craftActive={phase === 'craft'}
          onGrade={setBenchGrade}
          onChange={updateProfile}
        />
      )}
      {overlay === 'lab' && (
        <Lab
          profile={profile}
          records={records}
          craftActive={phase === 'craft'}
          onLab={updateLab}
          onProfile={updateProfile}
          onClearRecords={() => putRecords([])}
          onResetAll={() => {
            putProfile(defaultProfile());
            putSession(null);
            putRecords([]);
            setHolding(false);
          }}
        />
      )}

      {overlay === null && phase === 'prep' && (
        <Prep
          key={profile.nextCraftNo}
          profile={profile}
          onStart={start}
          onBench={(g) => {
            setBenchGrade(g);
            openOverlay('bench');
          }}
        />
      )}
      {overlay === null && phase === 'craft' && session !== null && (
        <Table
          session={session}
          profile={profile}
          onPlay={play}
          onEndTurn={endTurn}
          onAbandon={abandon}
          onPileOpen={() => countOpen('pileOpens')}
          onInfoOpen={() => countOpen('infoOpens')}
          onSeen={markSeen}
          onFinished={() => setHolding(false)}
          onExit={onExit}
          exitLabel="가게로"
          notice={saveFailed ? saveWarning : undefined}
          onScreen={noteScreen}
          menu={[
            {
              label: '작업대',
              onClick: () => {
                setBenchGrade(session.craft.recipe.grade);
                openOverlay('bench');
              },
            },
            { label: '실험', onClick: () => openOverlay('lab') },
          ]}
        />
      )}
      {overlay === null && phase === 'result' && session !== null && (
        <Result
          session={session}
          onPick={pick}
          onAgain={again}
          onAgainSame={
            deckProblems(profile, session.craft.recipe.grade).length === 0 ? () => start({ ...session.craft.setup.recipe }) : null
          }
          onBench={() => {
            setBenchGrade(session.craft.recipe.grade);
            openOverlay('bench');
          }}
        />
      )}
    </div>
  );
}
