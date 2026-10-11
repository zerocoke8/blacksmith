import { type CSSProperties, useEffect, useState } from 'react';
import { sceneArtUrl } from '../render/forge/assets.ts';
import { webStore } from '../platform/storage.ts';
import { CardCraft } from './cards/CardCraft.tsx';
import { hasCardSession } from './cards/store.ts';
import { CraftScreen } from './craft/CraftScreen.tsx';
import { RunMode } from './run/RunMode.tsx';
import { hasRunSave } from './run/store.ts';

/**
 * 'cards' = 카드 제작 (v0.7). 'run' = 시즌 악마의 탑 (육성 한 판, 13장).
 * 'craft' = the v0.6 FF14 prototype, kept for comparison.
 */
type Screen = 'home' | 'cards' | 'run' | 'craft';

/** The home screen: the workshop wall, the dwarf at his anvil. */
const HOME_BG = sceneArtUrl('bg_workshop');
const HOME_DWARF = sceneArtUrl('dwarf_idle');
const HOME_ANVIL = sceneArtUrl('anvil');

/** Which mode the app was last in, so a reload goes back to it. */
const MODE_KEY = 'app.mode';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [runSaved, setRunSaved] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);

  // A craft left on the anvil, or a run in progress, comes straight back after a reload.
  useEffect(() => {
    let alive = true;
    void Promise.all([webStore.load(MODE_KEY), hasCardSession(), hasRunSave()]).then(([mode, card, run]) => {
      if (!alive) return;
      setRunSaved(run);
      setCardSaved(card);
      // The mode the player was last in wins: last in the tower → back to it (its 준비 화면 or the
      // run), even with a craft waiting on the card table (the home button then says so). Otherwise
      // the card craft's old rule (a craft waiting comes back), and before the mode was remembered,
      // a saved run too.
      const back: Screen | null = mode === 'run' ? 'run' : card ? 'cards' : mode === null && run ? 'run' : null;
      if (back !== null) setScreen((s) => (s === 'home' ? back : s));
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    void webStore.save(MODE_KEY, next === 'craft' ? 'home' : next);
    if (next === 'home') {
      void hasRunSave().then(setRunSaved);
      void hasCardSession().then(setCardSaved);
    }
  };

  if (screen === 'cards') {
    return (
      <div className="app">
        <CardCraft onExit={() => go('home')} />
      </div>
    );
  }

  if (screen === 'run') {
    return (
      <div className="app">
        <RunMode onExit={() => go('home')} />
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
            <button type="button" className="home-entry home-run" onClick={() => go('run')}>
              시즌 악마의 탑
              <small>{runSaved ? '오르던 판이 기다린다' : '가문 용사 한 명, 서른 턴'}</small>
            </button>
            <button type="button" className="home-old" onClick={() => go('craft')}>
              옛 방식 (비교용)
            </button>
            <p className="home-note">카드 제작 · 육성 한 판 프로토타입</p>
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
