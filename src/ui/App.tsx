import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { webStore } from '../platform/storage.ts';
import { CardCraft } from './cards/CardCraft.tsx';
import { CraftScreen } from './craft/CraftScreen.tsx';
import { type HomeExit, homeStep, openState, type Screen, screenFromHash } from './nav.ts';
import { TownHome } from './town/TownHome.tsx';

// 'home' = the town map (기획서 3.2, 9장). 'cards' = 카드 제작 (4.2). 'refine' = 광석 정제 (7장).
// 'heroes' = 용사 목록과 편성 (5.9, 6.3). 'stage' = 스테이지 전투 (6장). 'challenge' = 일일 보스 (8장).
// 'craft' = the v0.6 FF14 prototype, kept for comparison (the settings sheet's '옛 방식').
// The screen lives in the address (nav.ts).

/** The refine screen, its pictures and the workshop scene load only when it opens (the first load stays as it was). */
const RefineScreen = lazy(() => import('./refine/RefineScreen.tsx'));
/** 용사 (5.9), 스테이지 (6장), 도전 (8장): each loads with its own chunk (the battle with PixiJS). */
const HeroesScreen = lazy(() => import('./heroes/HeroesScreen.tsx'));
const StageScreen = lazy(() => import('./battle/StageScreen.tsx'));
const DailyScreen = lazy(() => import('./battle/DailyScreen.tsx'));

/**
 * Keys nothing reads any more, cleared quietly at start-up so a later key of the same name never
 * reads an old value: the removed 시즌 악마의 탑 (육성 한 판) saves, and 'app.mode' (which mode the
 * home screen last opened, gone with the tower).
 */
const RETIRED_KEYS = ['run.current', 'run.hall', 'run.meta', 'run.prefs', 'run.records', 'app.mode'] as const;

export function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash));

  useEffect(() => {
    for (const key of RETIRED_KEYS) void webStore.remove(key);
    const onPop = () => setScreen(screenFromHash(window.location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((next: HomeExit) => {
    window.history.pushState(openState(), '', `#${next}`);
    setScreen(next);
    window.scrollTo(0, 0);
  }, []);

  const home = useCallback(() => {
    if (homeStep(window.history.state) === 'back') {
      // Opened from the map: back is the map (popstate sets the screen).
      window.history.back();
    } else {
      // Came in on this screen (a reload, a link): the map replaces it.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setScreen('home');
    }
  }, []);

  if (screen === 'refine') {
    return (
      <div className="app">
        <Suspense fallback={<div className="app-loading">공방을 살피는 중…</div>}>
          <RefineScreen onExit={home} />
        </Suspense>
      </div>
    );
  }

  if (screen === 'heroes' || screen === 'stage' || screen === 'challenge') {
    return (
      <div className="app">
        <Suspense fallback={<div className="app-loading">문을 여는 중…</div>}>
          {screen === 'heroes' && <HeroesScreen onExit={home} />}
          {screen === 'stage' && <StageScreen onExit={home} />}
          {screen === 'challenge' && <DailyScreen onExit={home} />}
        </Suspense>
      </div>
    );
  }

  if (screen === 'cards') {
    return (
      <div className="app">
        <CardCraft onExit={home} />
      </div>
    );
  }

  if (screen === 'home') {
    return <TownHome onOpen={open} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>용사의 대장간</h1>
      </header>
      <main className="app-main">
        <CraftScreen onExit={home} />
      </main>
    </div>
  );
}
