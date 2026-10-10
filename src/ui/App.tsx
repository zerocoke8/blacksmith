import { useEffect, useState } from 'react';
import { CardCraft } from './cards/CardCraft.tsx';
import { hasCardSession } from './cards/store.ts';
import { CraftScreen } from './craft/CraftScreen.tsx';

/** 'cards' = 카드 제작 (v0.7). 'craft' = the v0.6 FF14 prototype, kept for comparison. */
type Screen = 'home' | 'cards' | 'craft';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');

  // A craft left on the anvil, or on its result screen, comes straight back after a reload.
  useEffect(() => {
    let alive = true;
    void hasCardSession().then((yes) => {
      if (alive && yes) setScreen((s) => (s === 'home' ? 'cards' : s));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (screen === 'cards') {
    return (
      <div className="app">
        <CardCraft onExit={() => setScreen('home')} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>용사의 대장간</h1>
      </header>
      <main className="app-main">
        {screen === 'home' && (
          <section className="placeholder">
            <p>화로에 불이 들어왔다.</p>
            <p className="muted">카드 제작 프로토타입</p>
            <button type="button" className="home-entry" onClick={() => setScreen('cards')}>
              무기를 만든다
            </button>
            <button type="button" className="home-old" onClick={() => setScreen('craft')}>
              옛 방식 (비교용)
            </button>
          </section>
        )}
        {screen === 'craft' && <CraftScreen onExit={() => setScreen('home')} />}
      </main>
    </div>
  );
}
