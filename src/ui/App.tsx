import { type CSSProperties, lazy, Suspense, useEffect, useState } from 'react';
import { sceneArtUrl } from '../render/forge/assets.ts';
import { sound } from '../platform/audio.ts';
import { systemClock } from '../platform/clock.ts';
import { webStore } from '../platform/storage.ts';
import { CardCraft } from './cards/CardCraft.tsx';
import { hasCardSession } from './cards/store.ts';
import { CraftScreen } from './craft/CraftScreen.tsx';
import { peekRefine } from './refine/store.ts';
import { num } from './refine/text.ts';

/** 'cards' = 카드 제작 (v0.7). 'refine' = 광석 정제 (v0.8, 10.1). 'craft' = the v0.6 FF14 prototype, kept for comparison. */
type Screen = 'home' | 'cards' | 'refine' | 'craft';

/** The refine screen, its pictures and the workshop scene load only when it opens (the first load stays as it was). */
const RefineScreen = lazy(() => import('./refine/RefineScreen.tsx'));

type RefinePeek = Awaited<ReturnType<typeof peekRefine>>;

/** The home screen: the workshop wall, the dwarf at his anvil. */
const HOME_BG = sceneArtUrl('bg_workshop');
const HOME_DWARF = sceneArtUrl('dwarf_idle');
const HOME_ANVIL = sceneArtUrl('anvil');

/**
 * Keys nothing reads any more, cleared quietly at start-up so a later key of the same name never
 * reads an old value: the removed 시즌 악마의 탑 (육성 한 판) saves, and 'app.mode' (which mode the
 * home screen last opened, gone with the tower).
 */
const RETIRED_KEYS = ['run.current', 'run.hall', 'run.meta', 'run.prefs', 'run.records', 'app.mode'] as const;

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [cardSaved, setCardSaved] = useState(false);
  /** The pile on the hammer button: lumps now, and how many came in since the last visit. */
  const [refine, setRefine] = useState<RefinePeek | null>(null);

  // A craft left on the anvil comes straight back after a reload.
  useEffect(() => {
    let alive = true;
    for (const key of RETIRED_KEYS) void webStore.remove(key);
    void peekRefine(systemClock.nowMs()).then((p) => {
      if (alive) setRefine(p);
    });
    void hasCardSession().then((card) => {
      if (!alive) return;
      setCardSaved(card);
      if (card) setScreen((s) => (s === 'home' ? 'cards' : s));
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    if (next === 'home') {
      void hasCardSession().then(setCardSaved);
      void peekRefine(systemClock.nowMs()).then(setRefine);
    }
  };

  if (screen === 'refine') {
    return (
      <div className="app">
        <Suspense fallback={<div className="app-loading">공방을 살피는 중…</div>}>
          <RefineScreen onExit={() => go('home')} />
        </Suspense>
      </div>
    );
  }

  if (screen === 'cards') {
    return (
      <div className="app">
        <CardCraft onExit={() => go('home')} />
      </div>
    );
  }

  if (screen === 'home') {
    return (
      <div className="app app-home" style={HOME_BG !== null ? ({ '--home-bg': `url("${HOME_BG}")` } as CSSProperties) : undefined}>
        <main className="home">
          <header className="home-title">
            <h1>용사의 대장간</h1>
            <p>화로에 불이 들어왔다.</p>
          </header>
          <div className="home-scene" aria-hidden="true">
            <span className="home-glow" />
            {HOME_DWARF !== null && <img className="home-dwarf" src={HOME_DWARF} alt="" draggable={false} />}
            {HOME_ANVIL !== null && <img className="home-anvil" src={HOME_ANVIL} alt="" draggable={false} />}
          </div>
          <nav className="home-menu">
            <button type="button" className="home-entry" onClick={() => go('cards')}>
              무기를 만든다
              {cardSaved && <small>모루 위에 쇠가 기다린다</small>}
            </button>
            <button
              type="button"
              className="home-entry home-refine"
              onClick={() => {
                // The tap that opens the workshop wakes the hammer's sound (iOS starts audio only inside a tap).
                sound.unlock();
                go('refine');
              }}
              aria-label={refine !== null ? `광석 정제: 덩어리 ${refine.lumps}개` : '광석 정제'}
            >
              광석 정제
              {refine !== null && refine.lumps > 0 && (
                <span className="home-badge" aria-hidden="true">
                  {num(refine.lumps)}
                </span>
              )}
              {refine !== null && refine.gained > 0 ? (
                <small>자리를 비운 사이 덩어리 {num(refine.gained)}개가 쌓였다</small>
              ) : refine?.full === true ? (
                <small>더미가 가득 찼다</small>
              ) : null}
            </button>
            <button type="button" className="home-old" onClick={() => go('craft')}>
              옛 방식 (비교용)
            </button>
            <p className="home-note">카드 제작 · 광석 정제 프로토타입</p>
          </nav>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>용사의 대장간</h1>
      </header>
      <main className="app-main">
        {screen === 'craft' && <CraftScreen onExit={() => go('home')} />}
      </main>
    </div>
  );
}
