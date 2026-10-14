// 도전 · 일일 보스 화면 (기획서 8장, 사용자 결정 4): the day's boss alone on the field, in stages.
// Five tries a day; a try is a 60 s fight with the daily formation. Killing the boss opens the next
// stage and gives the five tries back; otherwise the try's damage is kept (the best one counts).
// After a try: the day's record (stage, damage) and where it stands in a group of about 100 (a
// made-up group until the server ranks them, rankMock.ts). A try plays live (live.ts, 사용자 결정
// 2026-10-14): a tap on a full hero card fires its signature, or the round AUTO button lets them go
// by themselves. The try is spent and saved before it plays (closing the app mid-try cannot save a
// bad try), and its end is saved when it ends; 건너뛰기 and leaving run the rest at once on auto and
// save it the same way (CLAUDE.md 규칙 2: the field shows the engine's fight). The record says the
// stages passed and the stage fought now apart ('2단계 돌파 · 3단계에 0'); a try just made shows its
// own damage beside it. Under the top band: the day's boss's element and body and the element that
// beats it (8.5 그날에 맞춘 무기).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../platform/audio.ts';
import { haptics } from '../../platform/haptics.ts';
import { iconUrl } from '../../render/battle/assets.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import { type Cue, TIMELINE } from '../../render/battle/timeline.ts';
import type { Element } from '../../sim/core/types.ts';
import { BATTLE_TICK_MS, DAILY_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { BEATS, BODY_LABEL, ELEMENT_LABEL } from '../../sim/data/common.ts';
import { DAILY_TRIES } from '../../sim/data/monsters.ts';
import { type BegunDailyTry, beginDailyTry, dailyBossOf, dailyBossUnit, dailyRecord, type DailyTry, finishDailyTry } from '../../sim/daily/index.ts';
import { type BattleResult, type BattleRun, buildTeam, formationProblems, formationProblemText, type HeroUnit, startBattle } from '../../sim/stage/index.ts';
import { reducedMotion, Sheet } from '../cards/parts.tsx';
import { LevelChip, useGame } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import { FormationEditor } from '../heroes/FormationEditor.tsx';
import { BattleField } from './BattleField.tsx';
import { makeCardFeed } from './cardFeed.ts';
import { type BattleSpeed, loadSignatureAuto, loadSpeed, makeCueSound, nextSpeed, saveSignatureAuto, saveSpeed } from './feel.ts';
import { HeroCardRow } from './HeroCardRow.tsx';
import { type LivePlay, playLive, runToEnd } from './live.ts';
import { mockGroup, rankWindow } from './rankMock.ts';
import { battleShow, type CardHero, cardHeroes, timelineUnits } from './show.ts';
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

/** A try from the moment it is spent until its end is saved. */
interface Try {
  begun: BegunDailyTry;
  run: BattleRun;
  done: DailyTry | null;
}

/** Saves a try's end, once (the try itself and leaving the screen may both get here). */
function closeTry(t: Try, result: BattleResult): DailyTry {
  if (t.done === null) {
    t.done = finishDailyTry(t.begun, result);
    gameStore.setDaily(t.done.state);
  }
  return t.done;
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
  /** The AUTO button: the signatures go off by themselves (a per-device setting). */
  const [sigAuto, setSigAuto] = useState(true);
  const sigAutoRef = useRef(true);
  const [result, setResult] = useState<{ key: number; won: boolean; stage: number; damage: number } | null>(null);
  /** The result's banner leaves the field after a while (the record below keeps the try's damage). */
  const [bannerOff, setBannerOff] = useState<number | null>(null);
  useEffect(() => {
    if (result === null) return;
    const id = window.setTimeout(() => setBannerOff(result.key), RESULT_BANNER_MS);
    return () => window.clearTimeout(id);
  }, [result]);
  const [sheet, setSheet] = useState<'formation' | 'rank' | null>(null);
  const cueSound = useMemo(() => makeCueSound(), []);
  const heroIds = useRef(new Set<string>());
  const bossHp = useRef(new Map<string, number>());
  /** The hero cards under the field and what they read. */
  const feed = useMemo(() => makeCardFeed(), []);
  const [cards, setCards] = useState<CardHero[]>([]);
  /** The try playing, and the try not yet saved. */
  const liveRef = useRef<LivePlay | null>(null);
  const tryRef = useRef<Try | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving mid-try: the rest runs at once on auto and is saved.
      const t = tryRef.current;
      if (t !== null && t.done === null) {
        if (liveRef.current !== null) liveRef.current.finishNow();
        else closeTry(t, runToEnd(t.run));
      }
    };
  }, []);

  useEffect(() => {
    void loadSpeed().then(setSpeed);
    void loadSignatureAuto().then((on) => {
      sigAutoRef.current = on;
      setSigAuto(on);
    });
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
  const daily = game?.daily ?? null;
  const stage = daily !== null ? daily.cleared + 1 : 1;

  /** A fight's heroes on the cards: full HP, gauges empty. */
  const showCards = useCallback(
    (team: readonly HeroUnit[]) => {
      feed.reset(team);
      const g = gameStore.get();
      setCards(g !== null ? cardHeroes(team, g.heroes.roster) : []);
    },
    [feed],
  );

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
    showCards(heroes);
    void sceneRef.current?.setup(battleShow(heroes, [boss], boss.element), false);
  }, [sceneUp, game, daily, stage, playing, showCards]);

  const onCue = useCallback(
    (c: Cue) => {
      cueSound(c);
      feed.cue(c);
      if (c.kind === 'impact' && heroIds.current.has(c.src)) {
        const before = bossHp.current.get(c.dst) ?? 0;
        bossHp.current.set(c.dst, c.hpAfter);
        if (before > c.hpAfter) setDamage((d) => d + before - c.hpAfter);
      }
    },
    [cueSound, feed],
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
    const seed = await gameStore.server.battleSeed({ kind: 'daily', day: d.day, stage: d.cleared + 1, attempt: d.attempts + 1 });
    if (!alive.current) return;
    const begun = beginDailyTry(d, { battleSeed: seed, heroes: g.heroes, formation: g.stage.formations.daily, signatures: sigAutoRef.current ? 'auto' : 'manual' });
    if (begun === null) {
      setPlaying(false);
      return;
    }
    // The try is spent now: closing the app mid-try cannot take a bad one back.
    gameStore.setDaily(begun.state);
    const t: Try = { begun, run: startBattle(begun.setup), done: null };
    tryRef.current = t;
    const team = begun.setup.heroes;
    const boss = begun.setup.enemies[0] ?? dailyBossUnit(d.day, begun.stage);
    const show = battleShow(team, begun.setup.enemies, boss.element);
    heroIds.current = new Set(team.map((h) => h.id));
    bossHp.current = new Map([[boss.id, boss.maxHp]]);
    setDamage(0);
    standing.current = `${d.day}:${begun.stage}`;
    showCards(team);
    await scene.setup(show, false);
    let fought: BattleResult;
    if (alive.current) {
      setPlayMs(0);
      setClock({ speed, endTick: null });
      const play = playLive({ run: t.run, units: timelineUnits(show), tickMs: BATTLE_TICK_MS, speed, scene });
      // AUTO flipped while the field was being set up.
      play.setAuto(sigAutoRef.current);
      feed.play = play;
      liveRef.current = play;
      const out = await play.done;
      fought = out.result;
      if (liveRef.current === play) liveRef.current = null;
      // A skipped try's cues never played: the cards jump to the end as well.
      if (feed.play === play && out.end === 'skipped') feed.settle(fought.heroHp);
    } else {
      fought = runToEnd(t.run);
    }
    const done = closeTry(t, fought);
    if (tryRef.current === t) tryRef.current = null;
    if (!alive.current) return;
    setDamage(done.result.damageDealt);
    setClock((k) => (k === null ? k : { ...k, endTick: done.result.ticks }));
    scene.finish(done.result.outcome);
    setResult({ key: done.attempt, won: done.won, stage: done.stage, damage: done.result.damageDealt });
    // A beat to see it, then the next stage's boss walks in (or the same one waits) with a full clock.
    window.setTimeout(() => {
      standing.current = '';
      if (!alive.current) return;
      setPlaying(false);
      setClock(null);
    }, done.won ? 1600 : 900);
  };

  const toggleSigAuto = () => {
    sound.unlock();
    const on = !sigAutoRef.current;
    sigAutoRef.current = on;
    setSigAuto(on);
    saveSignatureAuto(on);
    liveRef.current?.setAuto(on);
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
  const fighting = playing && clock !== null && clock.endTick === null;

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

      <HeroCardRow
        heroes={cards}
        feed={feed}
        auto={sigAuto}
        onAuto={toggleSigAuto}
        speed={speed}
        onSpeed={() => {
          sound.unlock();
          const s = nextSpeed(speed);
          setSpeed(s);
          saveSpeed(s);
        }}
        onFire={() => {
          sound.unlock();
          haptics.play('tap');
        }}
      />

      <footer className="bt-foot">
        <button type="button" className="bt-record" onClick={() => setSheet('rank')}>
          <span>{DAILY_LINES.record(record.stage, fmt(record.damage))}</span>
          <small>
            {result !== null && !playing ? `${DAILY_LINES.thisTry(fmt(result.damage))} · ` : ''}무리 순위 {myRank !== undefined && myRank !== 'gap' ? `${myRank.rank}위` : '—'} · 보기
          </small>
        </button>
        {problems.length > 0 && <p className="bt-status">{problems.map(formationProblemText).join(' ')}</p>}
        {daily.tries <= 0 && !playing && <p className="bt-status">{DAILY_LINES.noTries}</p>}
        <div className="bt-controls">
          <button type="button" className="kc-btn small" onClick={() => setSheet('formation')} disabled={playing}>
            편성
          </button>
          <button type="button" className="kc-btn small" onClick={() => liveRef.current?.finishNow()} disabled={!fighting}>
            건너뛰기
          </button>
          <button type="button" className="kc-btn primary bt-go" onClick={() => void tryNow()} disabled={playing || daily.tries <= 0 || problems.length > 0 || !sceneUp}>
            {daily.tries <= 0 && !playing ? '내일 다시' : '도전'}
          </button>
        </div>
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
