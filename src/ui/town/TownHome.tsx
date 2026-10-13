// 홈 = 마을 지도 (기획서 3.2, 9장). The town map fills the screen (TownMap, loaded on demand); over it
// the top band (the lumps and the gold as they are saved, the settings) and at the bottom the five
// quick entries in the user's order: 대장간 · 도전 · 스테이지 · 용사 · 정제. A building tapped on the
// map opens a small sheet, a screen or says one line (the guild: 용사, the gate: 스테이지, a tower:
// 스테이지 or 도전). The top band also carries the shared level (5.3); experience gained elsewhere
// (refining) is told there as the map comes back, and so are the lumps that came in while away, at
// the best floor's band (6.8, 7.1). Everything shown
// is a saved state or the screen's own show (CLAUDE.md 규칙 2): the guests walking to the shop give
// no gold here (the shop's takings come with the economy, 9.3).

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { sound } from '../../platform/audio.ts';
import { systemClock } from '../../platform/clock.ts';
import { haptics } from '../../platform/haptics.ts';
import { HERO_KEYS, townMapUrl } from '../../render/town/assets.ts';
import type { Insets } from '../../render/town/layout.ts';
import { refineArtUrl } from '../../render/refine/assets.ts';
import { DAILY_BOSSES } from '../../sim/data/monsters.ts';
import { dailyBossOf } from '../../sim/daily/daily.ts';
import { refineFirstPileLine } from '../../sim/data/refine.ts';
import { TOWN_BUILDING, townLocks } from '../../sim/data/town.ts';
import { type CardSessionState, cardSessionState } from '../cards/store.ts';
import { copyText } from '../cards/Lab.tsx';
import { reducedMotion, Sheet, Toggle } from '../cards/parts.tsx';
import { ARRIVAL_MIN_MAP, arrivalKey, markArrivalTold, shouldTellArrival } from '../refine/arrival.ts';
import { peekRefine, refineStore } from '../refine/store.ts';
import { num } from '../refine/text.ts';
import type { MapApi, MapBubble, MapTap } from './TownMap.tsx';
import {
  DWARF_LINES,
  GUEST_LINE_FALLBACK,
  GUEST_LINES,
  lockedLine,
  PLACE_SHEET,
  placeName,
  SCENERY_LINES,
  SOON,
} from './text.ts';
import { defaultTownPrefs, newTownVisit, summarizeTown, type TownLog, type TownPrefs, townStore, type TownVisit } from './store.ts';
import type { HomeExit } from '../nav.ts';
import { idleReturnLine } from '../battle/text.ts';
import { LevelChip } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import './town.css';

const TownMap = lazy(() => import('./TownMap.tsx'));

interface Props {
  onOpen(screen: HomeExit): void;
}

type SoonId = keyof typeof SOON;

type HomeSheet =
  | { kind: 'forge' }
  | { kind: 'mine' }
  | { kind: 'soon'; what: string; place: string; line: string }
  | { kind: 'tower'; place: string }
  | { kind: 'settings' };

/**
 * The quick entries (3.2, 9.4), in the user's order. Their icons are stand-ins until 16장의 4번's five
 * are drawn: the stage is the tower's floors (6.1), so it has the tower; the challenge has the day's
 * boss (8.1; the first boss until the day is known).
 */
/** The daily bosses' pictures (the 도전 entry's icon), only these five: the map does not load the battle's art list. */
const DAILY_BOSS_ART = import.meta.glob('/src/assets/art/monsters/daily_*.webp', { query: '?no-inline', import: 'default', eager: true }) as Record<string, string>;
function monsterArtUrl(key: string): string | null {
  return DAILY_BOSS_ART[`/src/assets/art/monsters/${key}.webp`] ?? null;
}

const QUICK: readonly { id: 'forge' | SoonId | 'refine'; label: string; icon: string | null; fit?: string }[] = [
  { id: 'forge', label: '대장간', icon: townMapUrl('bld_forge') },
  { id: 'challenge', label: '도전', icon: monsterArtUrl(DAILY_BOSSES[0]?.key ?? ''), fit: 'boss' },
  { id: 'stage', label: '스테이지', icon: townMapUrl('tower_fire'), fit: 'tower' },
  { id: 'heroes', label: '용사', icon: HERO_KEYS.includes('hero_vail') ? townMapUrl('hero_vail') : null, fit: 'face' },
  { id: 'refine', label: '정제', icon: refineArtUrl('ore_chunk') },
];

/** How long a bubble on the map and the arrival notice stay (ms). */
const BUBBLE_MS = 2800;
const NOTICE_MS = 4800;
/** The play log is written this long after its last change (ms), and at once when leaving. */
const LOG_SAVE_MS = 1200;

const nowMs = () => systemClock.nowMs();

export function TownHome({ onOpen }: Props) {
  const reduced = useMemo(() => reducedMotion(), []);
  const [peek, setPeek] = useState<{ lumps: number; gold: number; full: boolean } | null>(null);
  const [craft, setCraft] = useState<CardSessionState>('none');
  const [prefs, setPrefs] = useState<TownPrefs>(defaultTownPrefs);
  const [sheet, setSheet] = useState<HomeSheet | null>(null);
  const [bubble, setBubble] = useState<MapBubble | null>(null);
  const [notice, setNotice] = useState<{ key: number; text: string } | null>(null);
  const [readyMs, setReadyMs] = useState<Readonly<Record<string, number>> | null>(null);
  /** What the top band and the quick entries cover, measured: the map keeps its first look and its tags and bubbles clear of them. */
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const quickRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState<Insets>({ top: 56, bottom: 90 });
  useLayoutEffect(() => {
    const root = rootRef.current;
    const top = topRef.current;
    const quick = quickRef.current;
    if (root === null || top === null || quick === null) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      const next = { top: Math.round(top.getBoundingClientRect().bottom - r.top), bottom: Math.round(r.bottom - quick.getBoundingClientRect().top) };
      setInsets((s) => (s.top === next.top && s.bottom === next.bottom ? s : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(top);
    ro.observe(quick);
    return () => ro.disconnect();
  }, []);
  const craftWaiting = craft === 'active';
  const [log, setLog] = useState<TownLog | null>(null);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const mapApi = useRef<MapApi | null>(null);
  const keyRef = useRef(0);
  const nextKey = () => (keyRef.current += 1);
  const timers = useRef(new Set<number>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  // ---- What the top band and the badges show: the saves as they are ----
  // `tell`: as the map opens or the app comes back, say what came in while away (once per batch:
  // the refine screen will not say it again, arrival.ts). A first visit's pile was simply sent ahead.
  const refresh = useCallback((tell: boolean) => {
    void gameStore
      .load()
      .then((g) => g.stage.progress.best)
      .catch(() => 0)
      .then((best) => peekRefine(nowMs(), refineStore, best).then((p) => ({ p, best })))
      .then(({ p, best }) => {
      setPeek({ lumps: p.lumps, gold: p.gold, full: p.full });
      if (!tell) return;
      const at = arrivalKey(p.since);
      if (!shouldTellArrival(at, p.gained, ARRIVAL_MIN_MAP)) return;
      markArrivalTold(at, p.gained);
      const key = nextKey();
      setNotice({ key, text: p.since === null ? refineFirstPileLine(p.gained) : idleReturnLine(best, p.gained) });
      later(() => setNotice((n) => (n?.key === key ? null : n)), NOTICE_MS);
      });
    void cardSessionState().then(setCraft);
  }, [later]);
  useEffect(() => {
    refresh(true);
    void townStore.loadPrefs().then(setPrefs);
    // Lumps come in by the minute while the map is open.
    const id = window.setInterval(() => refresh(false), 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // ---- The play log (17장의 15·16번) ----
  const visit = useRef<TownVisit>(newTownVisit(nowMs()));
  const logRef = useRef<TownLog | null>(null);
  const saveTimer = useRef<number | null>(null);
  const flushLog = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const base = logRef.current;
    if (base === null) return;
    const v = { ...visit.current, lastMs: nowMs() };
    const visits = base.visits.length > 0 && base.visits[base.visits.length - 1]?.startMs === v.startMs ? [...base.visits.slice(0, -1), v] : [...base.visits, v];
    const next = { version: 1 as const, visits };
    logRef.current = next;
    setLog(next);
    void townStore.saveLog(next);
  }, []);
  const note = useCallback(
    (f: (v: TownVisit) => TownVisit) => {
      visit.current = f(visit.current);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flushLog, LOG_SAVE_MS);
    },
    [flushLog],
  );
  useEffect(() => {
    void townStore.loadLog().then((l) => {
      logRef.current = l;
      setLog(l);
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushLog();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flushLog();
    };
  }, [flushLog]);

  const open = (screen: HomeExit, via: 'map' | 'quick' | null) => {
    if (screen === 'refine' || screen === 'stage' || screen === 'challenge') sound.unlock();
    visit.current = { ...visit.current, went: screen, via };
    flushLog();
    onOpen(screen);
  };

  // ---- Locks (9.2): every building open while there is no stage; the 실험 preview shows the locked look ----
  const locks = useMemo(() => townLocks(prefs.lockPreview ? 0 : null), [prefs.lockPreview]);

  // ---- The map's taps ----
  const say = (x: number, y: number, text: string) => {
    const key = nextKey();
    setBubble({ key, x, y, text });
    later(() => setBubble((b) => (b?.key === key ? null : b)), BUBBLE_MS);
  };
  const turn = useRef(new Map<string, number>());
  const inTurn = (id: string, lines: readonly string[]): string => {
    const i = turn.current.get(id) ?? 0;
    turn.current.set(id, i + 1);
    return lines[i % lines.length] ?? '';
  };

  const onTap = (t: MapTap) => {
    setBubble(null);
    if (t.kind === 'ground') return;
    // A light tick under the thumb that covers what it pressed (platform/haptics.ts, the player's switch).
    haptics.play('tap');
    if (t.kind === 'guest') {
      note((v) => ({ ...v, guestTaps: v.guestTaps + 1 }));
      say(t.at.x, t.at.y, inTurn(t.hero, GUEST_LINES[t.hero] ?? [GUEST_LINE_FALLBACK]));
      return;
    }
    if (t.kind === 'dwarf') {
      say(t.at.x, t.at.y, inTurn('dwarf', DWARF_LINES));
      return;
    }
    note((v) => ({ ...v, buildingTaps: { ...v.buildingTaps, [t.building]: (v.buildingTaps[t.building] ?? 0) + 1 } }));
    const name = placeName(t.building, t.key);
    const lock = locks[t.building];
    if (lock.locked) {
      say(t.at.x, t.at.y, lockedLine(name, lock.opensAt));
      return;
    }
    switch (t.building) {
      case 'forge':
        setSheet({ kind: 'forge' });
        return;
      case 'mine':
        setSheet({ kind: 'mine' });
        return;
      case 'guild':
        open('heroes', 'map');
        return;
      case 'gate':
        open('stage', 'map');
        return;
      case 'tower':
        // The towers stand for both the stage and the daily boss for now (9.2: 탑 = 도전, 마을 문 = 스테이지).
        setSheet({ kind: 'tower', place: name });
        return;
      default: {
        const lines = SCENERY_LINES[t.building];
        if (lines !== undefined) say(t.at.x, t.at.y, inTurn(t.building, lines));
      }
    }
  };

  const onQuick = (id: (typeof QUICK)[number]['id']) => {
    note((v) => ({ ...v, quickTaps: { ...v.quickTaps, [id]: (v.quickTaps[id] ?? 0) + 1 } }));
    if (id === 'forge') {
      open('cards', 'quick');
      return;
    }
    open(id, 'quick');
  };

  const onDrag = useCallback(
    (phase: 'start' | 'end', ms: number) => {
      if (phase === 'start') {
        setBubble(null);
        note((v) => ({ ...v, drags: v.drags + 1 }));
      } else {
        note((v) => ({ ...v, dragMs: v.dragMs + Math.max(0, Math.round(ms)) }));
      }
    },
    [note],
  );

  const setLockPreview = (on: boolean) => {
    const next = { ...prefs, lockPreview: on };
    setPrefs(next);
    void townStore.savePrefs(next);
  };

  const lumps = peek?.lumps ?? 0;
  const chunkUrl = refineArtUrl('ore_chunk');
  const goldUrl = refineArtUrl('gold_coins');
  const soundOn = useSyncExternalStore(sound.subscribe, sound.enabled, sound.enabled);
  const hapticsOn = useSyncExternalStore(haptics.subscribe, haptics.enabled, haptics.enabled);
  const sum = log !== null ? summarizeTown([...log.visits.filter((v) => v.startMs !== visit.current.startMs), visit.current]) : null;

  return (
    <div ref={rootRef} className={`th-root kc-skin${reduced ? ' reduced' : ''}`}>
      <Suspense fallback={<div className="tm-host"><p className="tm-loading">마을을 둘러보는 중…</p></div>}>
        <TownMap
          reduced={reduced}
          locks={locks}
          badges={{ mine: lumps, forge: craftWaiting }}
          bubble={bubble}
          insets={insets}
          paused={sheet !== null}
          apiRef={mapApi}
          onTap={onTap}
          onDrag={onDrag}
          onReady={setReadyMs}
        />
      </Suspense>

      <header ref={topRef} className="th-top">
        <div className={`th-chip${peek?.full === true ? ' full' : ''}`} role="status" aria-label={`광석 덩어리 ${lumps}개`}>
          {chunkUrl !== null && <img src={chunkUrl} alt="" draggable={false} />}
          <b>{num(lumps)}</b>
          {peek?.full === true && <small>가득</small>}
        </div>
        <div className="th-chip" aria-label={`골드 ${peek?.gold ?? 0}`}>
          {goldUrl !== null && <img src={goldUrl} alt="" draggable={false} />}
          <b>{num(peek?.gold ?? 0)}</b>
        </div>
        <LevelChip banner className="th-level" />
        <button type="button" className="th-gear" onClick={() => setSheet({ kind: 'settings' })} aria-label="설정">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.8l1.6 2.3 2.7-.7.5 2.8 2.6 1.1-1 2.6 1.9 2.1-2.3 1.6.7 2.7-2.8.5-1.1 2.6-2.6-1-2.1 1.9-1.6-2.3-2.7.7-.5-2.8-2.6-1.1 1-2.6-1.9-2.1 2.3-1.6-.7-2.7 2.8-.5 1.1-2.6 2.6 1z" />
            <circle cx="12" cy="12" r="3.4" />
          </svg>
        </button>
      </header>
      {notice !== null && (
        <button type="button" key={notice.key} className="th-notice" onClick={() => setNotice(null)}>
          {notice.text}
        </button>
      )}

      <nav ref={quickRef} className="th-quick" aria-label="빠른 진입">
        {QUICK.map((q) => {
          const icon = q.id === 'challenge' ? (monsterArtUrl(dailyBossOf(gameStore.server.today()).monster.key) ?? q.icon) : q.icon;
          return (
            <button key={q.id} type="button" className={`th-q th-q-${q.id}`} onClick={() => onQuick(q.id)}>
              <span className={`th-q-pic${q.fit !== undefined ? ` fit-${q.fit}` : ''}`}>{icon !== null && <img src={icon} alt="" draggable={false} />}</span>
              <span className="th-q-label">{q.label}</span>
              {q.id === 'refine' && lumps > 0 && (
                <b className="th-q-badge" aria-label={`덩어리 ${lumps}개`}>
                  {num(lumps)}
                </b>
              )}
              {q.id === 'forge' && craftWaiting && (
                <b className="th-q-badge th-q-wait" aria-label="모루 위에 쇠가 기다린다">
                  !
                </b>
              )}
            </button>
          );
        })}
      </nav>

      {sheet?.kind === 'forge' && (
        <Sheet title={TOWN_BUILDING.forge.name} onClose={() => setSheet(null)}>
          <p className="th-sheet-line">{PLACE_SHEET.forge}</p>
          <div className="th-sheet-actions">
            <button type="button" className="kc-btn primary big th-act" onClick={() => open('cards', 'map')}>
              무기를 만든다
              {craft === 'active' && <small>모루 위에 쇠가 기다린다</small>}
              {craft === 'done' && <small>다 만든 무기가 모루 옆에 있다</small>}
            </button>
            <button type="button" className="kc-btn big th-act th-act-refine" onClick={() => open('refine', 'map')}>
              광석 정제
              <small>{lumps > 0 ? `덩어리 ${num(lumps)}개` : '덩어리가 아직 없다'}</small>
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'mine' && (
        <Sheet title={TOWN_BUILDING.mine.name} onClose={() => setSheet(null)}>
          <p className="th-sheet-line">{PLACE_SHEET.mine}</p>
          <div className="th-sheet-actions">
            <button type="button" className="kc-btn primary big th-act th-act-refine" onClick={() => open('refine', 'map')}>
              광석 정제로
              <small>{lumps > 0 ? `덩어리 ${num(lumps)}개가 기다린다` : '덩어리가 아직 없다'}</small>
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'tower' && (
        <Sheet title={sheet.place} onClose={() => setSheet(null)}>
          <p className="th-sheet-line">{PLACE_SHEET.tower}</p>
          <div className="th-sheet-actions">
            <button type="button" className="kc-btn primary big th-act" onClick={() => open('stage', 'map')}>
              스테이지
              <small>다음 층에 도전하고, 넘은 층에서 사냥한다</small>
            </button>
            <button type="button" className="kc-btn big th-act th-act-refine" onClick={() => open('challenge', 'map')}>
              도전 · 일일 보스
              <small>하루 다섯 번, 무리 순위</small>
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'soon' && (
        <Sheet title={sheet.place} onClose={() => setSheet(null)}>
          <p className="th-soon-tag">
            {sheet.what} — 곧 열린다
          </p>
          <p className="th-sheet-line">{sheet.line}</p>
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
      {sheet?.kind === 'settings' && (
        <Sheet title="설정" onClose={() => setSheet(null)}>
          <div className="th-settings">
            <section>
              <h4>소리와 진동</h4>
              <Toggle on={soundOn} onChange={(on) => sound.setEnabled(on)} label="소리" sub={sound.supported() ? '망치 소리' : '이 브라우저는 소리를 낼 수 없다'} />
              <Toggle
                on={hapticsOn}
                onChange={(on) => haptics.setEnabled(on)}
                label="진동"
                sub={haptics.supported() ? '망치질할 때' : '이 기기 브라우저는 진동을 낼 수 없다. 앱으로 포장하면 된다'}
              />
            </section>
            <section>
              <h4>비교</h4>
              <button type="button" className="kc-btn" onClick={() => open('craft', null)}>
                옛 방식 (비교용)
              </button>
              <p className="kc-hint">v0.6의 FF14식 제작. 카드 제작과 견주어 보려고 남겨 두었다.</p>
            </section>
            <section>
              <h4>실험</h4>
              <Toggle
                on={prefs.lockPreview}
                onChange={setLockPreview}
                label="잠금 미리 보기"
                sub={`최고 스테이지 0층으로 본 마을. 탑은 ${TOWN_BUILDING.tower.opensAt}층에 열린다 (지금은 스테이지가 없어 모두 열려 있다)`}
              />
              <button
                type="button"
                className="kc-btn small"
                onClick={() => {
                  setSheet(null);
                  mapApi.current?.home();
                }}
              >
                지도를 대장간으로
              </button>
              {sum !== null && (
                <ul className="th-log">
                  <li>
                    지도에 온 횟수 <b>{sum.visits}</b> · 끌어 본 방문 <b>{sum.dragged}</b> · 끈 횟수 <b>{sum.drags}</b>
                  </li>
                  <li>
                    한 번 끈 시간 평균 <b>{(sum.meanDragMs / 1000).toFixed(1)}초</b> · 방문당 끈 시간 <b>{(sum.dragMsPerVisit / 1000).toFixed(1)}초</b>
                  </li>
                  <li>
                    건물 탭 <b>{sum.buildingTaps}</b> · 빠른 진입 <b>{sum.quickTaps}</b> · 손님 탭 <b>{sum.guestTaps}</b>
                  </li>
                  <li>
                    건물로 들어감 <b>{sum.viaMap}</b> · 빠른 진입으로 <b>{sum.viaQuick}</b> · 둘러보기만 <b>{sum.onlyLooked}</b>
                  </li>
                  {readyMs !== null && (
                    <li className="kc-hint">
                      지도 준비 {Math.round(Object.entries(readyMs).reduce((s, [k, v]) => (k === 'decode' ? s : s + v), 0))}ms (
                      {Object.entries(readyMs)
                        .map(([k, v]) => `${k} ${Math.round(v)}`)
                        .join(', ')}
                      )
                    </li>
                  )}
                </ul>
              )}
              <div className="th-row">
                <button
                  type="button"
                  className="kc-btn small"
                  onClick={() => {
                    flushLog();
                    void copyText(JSON.stringify(logRef.current ?? { version: 1, visits: [] })).then((ok) => setCopied(ok ? 'ok' : 'fail'));
                  }}
                >
                  지도 기록 복사 (JSON)
                </button>
                <button
                  type="button"
                  className="kc-btn small ghost"
                  onClick={() => {
                    visit.current = newTownVisit(nowMs());
                    const empty = { version: 1 as const, visits: [] };
                    logRef.current = empty;
                    setLog(empty);
                    void townStore.saveLog(empty);
                  }}
                >
                  기록 지우기
                </button>
              </div>
              {copied !== null && <p className="kc-hint">{copied === 'ok' ? '복사했다.' : '복사하지 못했다.'}</p>}
            </section>
          </div>
        </Sheet>
      )}
    </div>
  );
}
