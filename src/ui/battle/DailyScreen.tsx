// 도전 · 일일 보스 화면 (기획서 8장, 사용자 결정 4): the day's boss alone on the field, in stages.
// Five tries a day; a try is a 60 s fight with the daily formation. Killing the boss opens the next
// stage and gives the five tries back; otherwise the try's damage is kept (the best one counts).
// After a try: the day's record (stage, damage) and where it stands in a group of about 100 (a
// made-up group until the server ranks them, rankMock.ts). The result is the engine's, decided and
// saved before it plays (CLAUDE.md 규칙 2). The record says the stages passed and the stage fought
// now apart ('2단계 돌파 · 3단계에 0'); a try just made shows its own damage beside it. Under the top
// band: the day's boss's element and body and the element that beats it (8.5 그날에 맞춘 무기).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../platform/audio.ts';
import { iconUrl } from '../../render/battle/assets.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import { buildTimeline, type Cue, TIMELINE } from '../../render/battle/timeline.ts';
import type { Element } from '../../sim/core/types.ts';
import { BATTLE_TICK_MS, DAILY_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { BEATS, BODY_LABEL, ELEMENT_LABEL } from '../../sim/data/common.ts';
import { DAILY_TRIES } from '../../sim/data/monsters.ts';
import { challengeDaily, type DailyState, dailyBossOf, dailyBossUnit, dailyRecord } from '../../sim/daily/index.ts';
import { buildTeam, formationProblems, formationProblemText } from '../../sim/stage/index.ts';
import { reducedMotion, Sheet } from '../cards/parts.tsx';
import { LevelChip, useGame } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import { FormationEditor } from '../heroes/FormationEditor.tsx';
import { BattleField } from './BattleField.tsx';
import { type BattleSpeed, loadSpeed, makeCueSound, nextSpeed, saveSpeed } from './feel.ts';
import { mockGroup, rankWindow } from './rankMock.ts';
import { battleShow, timelineUnits } from './show.ts';
import { SizeLab, useFighterSize } from './SizeLab.tsx';
import { DAILY_LINES } from './text.ts';
import './battle.css';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

/** How long a try's result banner stays on the field (ms) [튜닝: 연출]. */
const RESULT_BANNER_MS = 3200;

/** The element that beats `e` (수 > 화 > 지 > 풍 > 수). */
function weakTo(e: Element): Element {
  for (const [a, b] of Object.entries(BEATS) as [Element, Element][]) if (b === e) return a;
  return e;
}

/**
 * The made-up neighbours reach about the player's own stage (a group is players of a similar floor
 * and level, 8.3, so they meet about the same wall). Display only.
 */
function typicalDailyStage(recordStage: number): number {
  return Math.max(1, recordStage);
}

interface Clock {
  speed: number;
  endTick: number | null;
}

export default function DailyScreen(props: { onExit(): void }) {
  const reduced = useMemo(() => reducedMotion(), []);
  const game = useGame();
  const sceneRef = useRef<BattleScene | null>(null);
  const [sceneUp, setSceneUp] = useState(false);
  const [sizes, setSizes] = useFighterSize(sceneRef, sceneUp);
  const [playing, setPlaying] = useState(false);
  const [damage, setDamage] = useState(0);
  const [clock, setClock] = useState<Clock | null>(null);
  /** The running try's playback time (ms), read from the scene (it runs on the scene's own clock). */
  const [playMs, setPlayMs] = useState(0);
  const [speed, setSpeed] = useState<BattleSpeed>(1);
  const [result, setResult] = useState<{ key: number; won: boolean; stage: number; damage: number } | null>(null);
  /** The result's banner leaves the field after a while (the record below keeps the try's damage). */
  const [bannerOff, setBannerOff] = useState<number | null>(null);
  useEffect(() => {
    if (result === null) return;
    const id = window.setTimeout(() => setBannerOff(result.key), RESULT_BANNER_MS);
    return () => window.clearTimeout(id);
  }, [result]);
  const [sheet, setSheet] = useState<'formation' | 'rank' | null>(null);
  /** The day as it stood before the try that is playing (the try is saved first; the top shows it only once it has played). */
  const [before, setBefore] = useState<DailyState | null>(null);
  const cueSound = useMemo(() => makeCueSound(), []);
  const heroIds = useRef(new Set<string>());
  const bossHp = useRef(new Map<string, number>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    void loadSpeed().then(setSpeed);
  }, []);

  useEffect(() => {
    if (clock === null || clock.endTick !== null) return;
    const id = window.setInterval(() => setPlayMs(sceneRef.current?.clockMs() ?? 0), 100);
    return () => window.clearInterval(id);
  }, [clock]);

  // A new day (the server's) starts the daily state afresh (8.2).
  const loaded = game !== null;
  useEffect(() => {
    if (loaded) gameStore.today();
  }, [loaded]);
  const daily = before ?? game?.daily ?? null;
  const stage = daily !== null ? daily.cleared + 1 : 1;

  // The boss of the next stage stands there, waiting (a new day, a cleared stage: a new one).
  const standing = useRef('');
  useEffect(() => {
    if (!sceneUp || game === null || daily === null || playing) return;
    const id = `${daily.day}:${stage}`;
    if (standing.current === id) return;
    standing.current = id;
    const f = game.stage.formations.daily;
    const heroes = formationProblems(f, game.heroes.roster).length === 0 ? buildTeam(game.heroes, f) : [];
    const boss = dailyBossUnit(daily.day, stage);
    void sceneRef.current?.setup(battleShow(heroes, [boss], boss.element), false);
  }, [sceneUp, game, daily, stage, playing]);

  const onCue = useCallback(
    (c: Cue) => {
      cueSound(c);
      if (c.kind === 'impact' && heroIds.current.has(c.src)) {
        const before = bossHp.current.get(c.dst) ?? 0;
        bossHp.current.set(c.dst, c.hpAfter);
        if (before > c.hpAfter) setDamage((d) => d + before - c.hpAfter);
      }
    },
    [cueSound],
  );

  if (game === null || daily === null) return <div className="app-loading">보스가 기다리는 곳으로…</div>;
  const { monster } = dailyBossOf(daily.day);
  const formation = game.stage.formations.daily;
  const problems = formationProblems(formation, game.heroes.roster);
  const record = dailyRecord(daily);

  const tryNow = async () => {
    sound.unlock();
    const scene = sceneRef.current;
    const g = gameStore.get();
    if (scene === null || g === null || playing) return;
    gameStore.today();
    const d = gameStore.get()?.daily ?? g.daily;
    if (d.tries <= 0 || problems.length > 0) return;
    setPlaying(true);
    setResult(null);
    setBefore(d);
    const seed = await gameStore.server.battleSeed({ kind: 'daily', day: d.day, stage: d.cleared + 1, attempt: d.attempts + 1 });
    const t = challengeDaily(d, { battleSeed: seed, heroes: g.heroes, formation: g.stage.formations.daily });
    if (t === null) {
      setPlaying(false);
      setBefore(null);
      return;
    }
    gameStore.setDaily(t.state);
    const team = buildTeam(g.heroes, g.stage.formations.daily);
    const boss = dailyBossUnit(d.day, t.stage);
    const show = battleShow(team, [boss], boss.element);
    heroIds.current = new Set(team.map((h) => h.id));
    bossHp.current = new Map([[boss.id, boss.maxHp]]);
    setDamage(0);
    standing.current = `${d.day}:${t.stage}`;
    await scene.setup(show, false);
    if (!alive.current) return;
    const tl = buildTimeline(t.result.events, timelineUnits(show), { tickMs: BATTLE_TICK_MS, speed });
    setPlayMs(0);
    setClock({ speed, endTick: null });
    await scene.run(tl);
    if (!alive.current) return;
    setDamage(t.result.damageDealt);
    setBefore(null);
    setClock((k) => (k === null ? k : { ...k, endTick: t.result.ticks }));
    scene.finish(t.result.outcome);
    setResult({ key: t.attempt, won: t.won, stage: t.stage, damage: t.result.damageDealt });
    // A beat to see it, then the next stage's boss walks in (or the same one waits) with a full clock.
    window.setTimeout(() => {
      standing.current = '';
      if (!alive.current) return;
      setPlaying(false);
      setClock(null);
    }, t.won ? 1600 : 900);
  };

  let timer: number | null = null;
  if (clock !== null) {
    const ticks = clock.endTick ?? Math.max(0, (playMs * clock.speed - TIMELINE.introMs) / BATTLE_TICK_MS);
    timer = Math.max(0, Math.ceil(((DAILY_TIME_LIMIT_TICKS - ticks) * BATTLE_TICK_MS) / 1000));
  }
  const rows = rankWindow(
    mockGroup(daily.day, { stage: record.stage, damage: record.damage, best: game.stage.progress.best, level: game.heroes.level.level }, typicalDailyStage(record.stage)),
  );
  const myRank = rows.find((r) => r !== 'gap' && r.me);
  const bossIcon = monster.element !== null ? iconUrl(`element_${monster.element}`) : null;
  const weak = monster.element !== null ? weakTo(monster.element) : null;

  return (
    <div className={`bt-root bt-daily kc-skin${reduced ? ' reduced' : ''}`}>
      <header className="bt-top">
        <button type="button" className="hs-iconbtn" onClick={props.onExit} aria-label="마을로">
          ←
        </button>
        <div className="bt-floor boss">
          <b>{DAILY_LINES.stage(stage)}</b>
          <small>{monster.name}</small>
        </div>
        <div className={`bt-timer${timer !== null && timer <= 10 ? ' low' : ''}${timer === null ? ' off' : ''}`}>
          {timer !== null ? `${timer}초` : `${(DAILY_TIME_LIMIT_TICKS * BATTLE_TICK_MS) / 1000}초`}
        </div>
        <LevelChip banner className="bt-level" />
      </header>
      <div className="bt-sub">
        <span className="bt-best bt-boss-line">
          {bossIcon !== null && <img src={bossIcon} alt="" draggable={false} />}
          {monster.element !== null && weak !== null
            ? DAILY_LINES.boss(ELEMENT_LABEL[monster.element], BODY_LABEL[monster.body], ELEMENT_LABEL[weak])
            : BODY_LABEL[monster.body]}
        </span>
        <span className={`bt-tries${daily.tries === 0 ? ' none' : ''}`}>{DAILY_LINES.tries(daily.tries, DAILY_TRIES)}</span>
      </div>

      <BattleField reduced={reduced} sceneRef={sceneRef} onReady={() => setSceneUp(true)} onCue={onCue} sizes={sizes}>
        <SizeLab sizes={sizes} onChange={setSizes} />
        <div className="bt-damage" aria-live="off">
          <small>데미지</small>
          <b>{fmt(damage)}</b>
        </div>
        {result !== null && bannerOff !== result.key && (
          <div key={result.key} className={`bt-banner ${result.won ? 'boss' : 'lose'}`} role="status">
            <b>{result.won ? DAILY_LINES.won(result.stage) : DAILY_LINES.lost(fmt(result.damage))}</b>
          </div>
        )}
      </BattleField>

      <footer className="bt-foot">
        <button type="button" className="bt-record" onClick={() => setSheet('rank')}>
          <span>{DAILY_LINES.record(record.stage, fmt(record.damage))}</span>
          <small>
            {result !== null && !playing ? `${DAILY_LINES.thisTry(fmt(result.damage))} · ` : ''}무리 순위 {myRank !== undefined && myRank !== 'gap' ? `${myRank.rank}위` : '—'} · 보기
          </small>
        </button>
        {problems.length > 0 && <p className="bt-status">{problems.map(formationProblemText).join(' ')}</p>}
        <div className="bt-controls">
          <button type="button" className="kc-btn small" onClick={() => setSheet('formation')} disabled={playing}>
            편성
          </button>
          <button
            type="button"
            className="kc-btn small"
            onClick={() => {
              const s = nextSpeed(speed);
              setSpeed(s);
              saveSpeed(s);
            }}
          >
            ×{speed}
          </button>
          <button type="button" className="kc-btn small" onClick={() => sceneRef.current?.skip()} disabled={!playing || clock?.endTick !== null}>
            건너뛰기
          </button>
          <button type="button" className="kc-btn primary bt-go" onClick={() => void tryNow()} disabled={playing || daily.tries <= 0 || problems.length > 0 || !sceneUp}>
            {daily.tries <= 0 ? '내일 다시' : '도전'}
          </button>
        </div>
        {daily.tries <= 0 && <p className="bt-status">{DAILY_LINES.noTries}</p>}
      </footer>

      {sheet === 'formation' && (
        <Sheet title="일일 보스 편성" onClose={() => setSheet(null)}>
          <FormationEditor
            heroes={game.heroes}
            formations={game.stage.formations}
            kind="daily"
            fixedKind
            onChange={(formations) => {
              const g = gameStore.get();
              if (g !== null) gameStore.setStage({ ...g.stage, formations });
              standing.current = '';
            }}
          />
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
      {sheet === 'rank' && (
        <Sheet title={DAILY_LINES.rankTitle} onClose={() => setSheet(null)}>
          <p className="kc-hint">{DAILY_LINES.rankNote}</p>
          <ol className="bt-rank">
            {rows.map((r, i) =>
              r === 'gap' ? (
                <li key={`g${i}`} className="gap" aria-hidden="true">
                  ⋯
                </li>
              ) : (
                <li key={r.id} className={r.me ? 'me' : undefined}>
                  <b>{r.rank}</b>
                  <span>{r.me ? DAILY_LINES.me : r.name}</span>
                  <small>{DAILY_LINES.rankRow(r.stage, fmt(r.damage))}</small>
                </li>
              ),
            )}
          </ol>
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
    </div>
  );
}
