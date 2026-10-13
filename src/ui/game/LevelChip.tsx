// 공유 레벨 표시 (기획서 5.3, 사용자 결정 2): one level for every hero, shown once at the top of a
// screen (not on each card, 5.9) with its experience bar. When experience comes in the bar fills,
// and a line drops in at the top of the screen: '경험치 +n', or '레벨 업! Lv n' with the dwarf's line.
// It tells what changed since the level was last shown anywhere (the map coming back after a refine).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LEVEL_UP_LINE } from '../../sim/data/heroes.ts';
import { levelProgress, type LevelState } from '../../sim/hero/index.ts';
import { LEVEL_LINES } from '../battle/text.ts';
import { gameStore } from './store.ts';
import './level.css';

const BANNER_MS = 2600;

export function useGame() {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.get, gameStore.get);
  useEffect(() => {
    void gameStore.load();
  }, []);
  return state;
}

interface Banner {
  key: number;
  text: string;
  sub: string | null;
  up: boolean;
}

/**
 * The level chip and its bar; with `banner`, the news line at the top of the screen too. chip=false
 * shows only the news (a top band with no room, the refine screen's).
 */
export function LevelChip(props: { banner?: boolean; chip?: boolean; className?: string }) {
  const game = useGame();
  const level = game?.heroes.level ?? null;
  const [banner, setBanner] = useState<Banner | null>(null);
  const [bump, setBump] = useState(0);
  const prev = useRef<LevelState | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (level === null) return;
    const before = prev.current ?? gameStore.levelSeen() ?? level;
    prev.current = level;
    gameStore.setLevelSeen(level);
    const rose = level.level > before.level || (level.level === before.level && level.exp > before.exp);
    if (!rose) return;
    setBump((b) => b + 1);
    if (props.banner !== true) return;
    const news = gameStore.news();
    if (news !== null) gameStore.markNewsSeen(news.key);
    keyRef.current += 1;
    const key = keyRef.current;
    const up = level.level > before.level;
    const gained = news?.gained ?? (up ? 0 : level.exp - before.exp);
    setBanner({
      key,
      up,
      text: up ? LEVEL_LINES.levelUp(level.level) : LEVEL_LINES.expIn(gained),
      sub: up ? (gained > 0 ? `${LEVEL_LINES.expIn(gained)} · ${LEVEL_UP_LINE}` : LEVEL_UP_LINE) : null,
    });
    const id = window.setTimeout(() => setBanner((b) => (b?.key === key ? null : b)), up ? BANNER_MS + 800 : BANNER_MS);
    return () => window.clearTimeout(id);
  }, [level, props.banner]);

  if (level === null) return props.chip === false ? null : <div className={`lv-chip ${props.className ?? ''}`} aria-hidden="true" />;
  const p = levelProgress(level);
  return (
    <>
      {props.chip !== false && <div className={`lv-chip ${props.className ?? ''}`} role="status" aria-label={`레벨 ${p.level}, 경험치 ${p.exp}/${p.need}`}>
        <b key={bump} className={bump > 0 ? 'lv-bump' : undefined}>
          Lv {p.level}
        </b>
        <span className="lv-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(p.ratio * 100)}%` }} />
        </span>
      </div>}
      {banner !== null && (
        <button type="button" key={banner.key} className={`lv-banner${banner.up ? ' up' : ''}`} onClick={() => setBanner(null)}>
          <b>{banner.text}</b>
          {banner.sub !== null && <small>{banner.sub}</small>}
        </button>
      )}
    </>
  );
}
