// Craft prototype: recipe → puzzle → result. Every change is saved, so closing
// the app mid-craft resumes on the same turn with the same condition order.

import { useEffect, useRef, useState } from 'react';
import {
  abandonCraft,
  applyPick,
  checkAction,
  checkPick,
  type RecipeInput,
  type SlotPick,
  applyAction,
  weaponFromCraft,
} from '../../sim/craft/index.ts';
import type { CraftActionId } from '../../sim/data/craft.ts';
import { CraftBoard } from './CraftBoard.tsx';
import { DevPanel } from './DevPanel.tsx';
import { RecipePicker } from './RecipePicker.tsx';
import { ResultView } from './ResultView.tsx';
import { beginCraft, type CraftSession, craftStore, type DevSettings, weaponIdFor } from './session.ts';
import './craft.css';

interface Props {
  onExit(): void;
}

export function CraftScreen({ onExit }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [dev, setDev] = useState<DevSettings | null>(null);
  const [session, setSession] = useState<CraftSession | null>(null);
  // Latest values for handlers, so two quick taps never act on a stale state.
  const devRef = useRef<DevSettings | null>(null);
  const sessionRef = useRef<CraftSession | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([craftStore.loadDev(), craftStore.loadSession()]).then(([d, s]) => {
      if (!alive) return;
      devRef.current = d;
      sessionRef.current = s;
      setDev(d);
      setSession(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const showSession = (next: CraftSession | null) => {
    sessionRef.current = next;
    setSession(next);
  };
  const showDev = (next: DevSettings) => {
    devRef.current = next;
    setDev(next);
  };
  const commitSession = (next: CraftSession | null) => {
    showSession(next);
    void craftStore.saveSession(next);
  };
  const commitDev = (next: DevSettings) => {
    showDev(next);
    void craftStore.saveDev(next);
  };

  if (!loaded || dev === null) {
    return <div className="craft loading muted">화로를 살피는 중…</div>;
  }

  const start = (recipe: RecipeInput) => {
    const d = devRef.current;
    if (!d || sessionRef.current) return;
    const begun = beginCraft(craftStore, d, recipe);
    // A store that cannot write (full, blocked) must not stop the craft; it just is not kept.
    begun.saved.catch(() => undefined);
    showDev(begun.dev);
    showSession(begun.session);
  };

  const act = (id: CraftActionId) => {
    const session = sessionRef.current;
    if (!session || checkAction(session.craft, id) !== null) return;
    const craft = applyAction(session.craft, id);
    const weapon = craft.status === 'success' ? weaponFromCraft(craft, weaponIdFor(craft)) : null;
    commitSession({ ...session, craft, weapon });
  };

  const abandon = () => {
    const session = sessionRef.current;
    if (session && session.craft.status === 'active') commitSession({ ...session, craft: abandonCraft(session.craft) });
  };

  const pick = (p: SlotPick) => {
    const session = sessionRef.current;
    if (!session?.weapon || checkPick(session.weapon, p, session.inventory) !== null) return;
    const { weapon, inventory } = applyPick(session.weapon, p, session.inventory);
    commitSession({ ...session, weapon, inventory });
  };

  const phase = session === null ? 'recipe' : session.craft.status === 'active' ? 'craft' : 'result';

  return (
    <div className="craft">
      <div className="craft-bar">
        <button type="button" className="btn ghost small" onClick={onExit}>
          ← 가게로
        </button>
        <span className="craft-bar-title">
          {phase === 'recipe' ? '레시피' : phase === 'craft' ? '제작' : '완성'}
        </span>
      </div>

      {phase === 'recipe' && (
        <RecipePicker
          initial={dev.lastRecipe}
          smith={{ nodes: dev.nodes, tools: dev.tools }}
          craftNo={dev.nextCraftNo}
          onStart={start}
        />
      )}
      {phase === 'craft' && session && <CraftBoard state={session.craft} onAction={act} onAbandon={abandon} />}
      {phase === 'result' && session && (
        <ResultView
          craft={session.craft}
          weapon={session.weapon}
          inventory={session.inventory}
          onPick={pick}
          onAgain={() => commitSession(null)}
        />
      )}

      <DevPanel
        dev={dev}
        craftActive={phase === 'craft'}
        onChange={(update) => {
          if (devRef.current) commitDev(update(devRef.current));
        }}
      />
    </div>
  );
}
