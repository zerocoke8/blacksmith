import { useState } from 'react';
import { CraftScreen } from './craft/CraftScreen.tsx';

type Screen = 'home' | 'craft';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <div className="app">
      <header className="app-header">
        <h1>용사의 대장간</h1>
      </header>
      <main className="app-main">
        {screen === 'home' && (
          <section className="placeholder">
            <p>화로에 불이 들어왔다.</p>
            <p className="muted">프로토타입 준비 중</p>
            <button type="button" className="home-entry" onClick={() => setScreen('craft')}>
              무기를 만든다
            </button>
          </section>
        )}
        {screen === 'craft' && <CraftScreen onExit={() => setScreen('home')} />}
      </main>
    </div>
  );
}
