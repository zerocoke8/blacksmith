// 스테이지 화면 (기획서 6장, 사용자 결정 3): the field with the five heroes and the floor's monsters.
// While it can win, the auto-challenge fights the next floor (30 s, the timer at the top); a clear
// moves on to the next floor with a short march, a boss every 10 floors. A loss keeps the player on
// their best floor, hunting there (the idle hunt: no win or loss, it just goes on, hunt.ts), and the
// auto-challenge waits until the team changes (level, stars, formation, weapons, 6.7). It can be
// switched off; then the [도전] button climbs one floor at a time.
// Every fight is the engine's, played live (live.ts, 사용자 결정 2026-10-14 '실시간 전투'): the engine
// runs a little ahead of the field, and a tap on a full hero card fires that hero's signature (the
// round AUTO button lets them go off by themselves). A challenge's attempt is taken and saved before
// it plays (closing the app mid-fight does not give it back), and its result is saved when it ends;
// 건너뛰기 and leaving the screen run the rest at once on auto and save it the same way (CLAUDE.md
// 규칙 2: the field only shows the engine's fight, at ×1, ×2 or ×4, the speed chosen per fight).
// Quick wins in a row (a team far above its floors) march faster and share one banner ('11~17층
// 돌파'). Before a win raises the best floor, the lumps that came in so far are counted at the old
// floor (refine/store.ts settleIdleBefore): time gone by keeps its floor's rate and band.
// The top band shows what 6.9 lists: the floor, the timer, the level; under it the best floor, the
// next floor's element and body, and the auto-challenge switch; under the field the hero cards; the
// bottom band what is going on, the team's power and the lumps an hour.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../platform/audio.ts';
import { systemClock } from '../../platform/clock.ts';
import { haptics } from '../../platform/haptics.ts';
import { iconUrl } from '../../render/battle/assets.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import { type Cue, TIMELINE, type TimelineUnit } from '../../render/battle/timeline.ts';
import { BATTLE_TICK_MS, STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { BODY_LABEL, ELEMENT_LABEL } from '../../sim/data/common.ts';
import { BOSS_EVERY } from '../../sim/data/monsters.ts';
import { idleLumpsPerHour } from '../../sim/data/refine.ts';
import {
  type BattleResult,
  type BattleRun,
  type BegunFloor,
  beginNextFloor,
  buildTeam,
  canAutoChallenge,
  finishNextFloor,
  floorEnemies,
  floorLayout,
  formationProblems,
  formationProblemText,
  type HeroUnit,
  nextFloor,
  setAutoChallenge,
  type StageChallenge,
  startBattle,
  teamPower,
} from '../../sim/stage/index.ts';
import { reducedMotion, Sheet } from '../cards/parts.tsx';
import { LevelChip, useGame } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import { FormationEditor } from '../heroes/FormationEditor.tsx';
import { ARRIVAL_MIN_MAP, arrivalKey, markArrivalTold, shouldTellArrival } from '../refine/arrival.ts';
import { type IdleSettle, settleIdleBefore } from '../refine/store.ts';
import { BattleField } from './BattleField.tsx';
import { makeCardFeed } from './cardFeed.ts';
import { type BattleSpeed, loadSignatureAuto, loadSpeed, makeCueSound, nextSpeed, saveSignatureAuto, saveSpeed } from './feel.ts';
import { HeroCardRow } from './HeroCardRow.tsx';
import { huntFight } from './hunt.ts';
import { type LivePlay, playLive, runToEnd } from './live.ts';
import { SizeLab, useFighterSize } from './SizeLab.tsx';
import { battleShow, type CardHero, cardHeroes, timelineUnits } from './show.ts';
import { idleReturnLine, STAGE_LINES } from './text.ts';
import './battle.css';

type Mode =
  | { kind: 'wait' }
  | { kind: 'noTeam'; why: string }
  | { kind: 'challenge'; floor: number }
  | { kind: 'hunt'; floor: number; stuckOn: number | null };

interface Clock {
  speed: number;
  limitTicks: number;
  /** Set when the fight ended: the tick it ended on (the timer stops there). */
  endTick: number | null;
}

interface Banner {
  key: number;
  text: string;
  sub: string | null;
  tone: 'win' | 'lose' | 'boss' | 'note';
}

/** The stage's rhythm [튜닝: 연출]. */
export const STAGE_RHYTHM = {
  /** A win under this much battle time (ms) is a quick one: wins like it in a row share a banner. */
  quickWinMs: 8000,
  /** Pauses after a win, a quick win in a row, and a loss (ms at ×1). */
  winPauseMs: 1100,
  quickPauseMs: 450,
  losePauseMs: 1700,
  /** How long the banners stay (ms, real time). */
  winBannerMs: 1500,
  quickBannerMs: 1100,
  loseBannerMs: 2600,
  noteBannerMs: 3600,
  /** '다음 전투부터 ×n' (the speed button during a fight). */
  speedNoteMs: 1600,
  /** A win's banner at ×2 or ×4 is shortened by the speed, down to this. */
  minBannerMs: 700,
} as const;

/** A challenge from the moment its attempt is taken until its result is saved. */
interface Fight {
  begun: BegunFloor;
  run: BattleRun;
  /** The best floor before it (the idle lumps so far are counted there on a win). */
  bestBefore: number;
  closing: Promise<{ challenge: StageChallenge; settled: IdleSettle | null }> | null;
}

/**
 * Saves a challenge's end, once (the loop and leaving the screen may both get here): the result
 * into the progress — the auto-challenge switch as it is now, it may have been flipped meanwhile —
 * after a win's idle lumps are counted at the old floor.
 */
function closeFight(f: Fight, result: BattleResult): NonNullable<Fight['closing']> {
  f.closing ??= (async () => {
    const challenge = finishNextFloor(f.begun, result, gameStore.get()?.heroes.level.level ?? 1);
    const settled = challenge.won ? await settleIdleBefore(f.bestBefore, systemClock.nowMs()).catch(() => null) : null;
    const now = gameStore.get();
    if (now !== null) gameStore.setStage({ ...now.stage, progress: { ...challenge.progress, auto: now.stage.progress.auto } });
    return { challenge, settled };
  })();
  return f.closing;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

export default function StageScreen(props: { onExit(): void }) {
  const reduced = useMemo(() => reducedMotion(), []);
  const game = useGame();
  const sceneRef = useRef<BattleScene | null>(null);
  const [sceneUp, setSceneUp] = useState(false);
  const [sizes, setSizes] = useFighterSize(sceneRef, sceneUp);
  const [mode, setMode] = useState<Mode>({ kind: 'wait' });
  const [banner, setBanner] = useState<Banner | null>(null);
  const [note, setNote] = useState<Banner | null>(null);
  const [clock, setClock] = useState<Clock | null>(null);
  /** The running fight's playback time (ms), read from the scene (it runs on the scene's own clock). */
  const [playMs, setPlayMs] = useState(0);
  const [speed, setSpeed] = useState<BattleSpeed>(1);
  const speedRef = useRef<BattleSpeed>(1);
  /** The AUTO button: the signatures go off by themselves (a per-device setting). */
  const [sigAuto, setSigAuto] = useState(true);
  const sigAutoRef = useRef(true);
  const [sheet, setSheet] = useState<'formation' | null>(null);
  /** The best floor as the field shows it: it rises once the win is shown. */
  const [shownBest, setShownBest] = useState<number | null>(null);
  const manual = useRef(false);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const keyRef = useRef(0);
  const cueSound = useMemo(() => makeCueSound(), []);
  /** The hero cards under the field and what they read. */
  const feed = useMemo(() => makeCardFeed(), []);
  const [cards, setCards] = useState<CardHero[]>([]);
  /** The fight playing (a challenge or a hunt), and the challenge not yet saved. */
  const liveRef = useRef<LivePlay | null>(null);
  const fightRef = useRef<Fight | null>(null);
  /** Wakes the loop when the saves change (a new formation, a level) while it waits. */
  const wake = useRef<(() => void) | null>(null);

  useEffect(() => {
    void loadSpeed().then((s) => {
      speedRef.current = s;
      setSpeed(s);
    });
    void loadSignatureAuto().then((on) => {
      sigAutoRef.current = on;
      setSigAuto(on);
    });
  }, []);

  /** A win's banner at a faster speed stays shorter (it would cover the next floor's fight), not under this. */
  const winBannerMs = (ms: number) => Math.max(STAGE_RHYTHM.minBannerMs, ms / speedRef.current);
  const say = useCallback((text: string, sub: string | null, tone: Banner['tone'], ms: number) => {
    keyRef.current += 1;
    const key = keyRef.current;
    const set = tone === 'note' ? setNote : setBanner;
    set({ key, text, sub, tone });
    window.setTimeout(() => set((b) => (b?.key === key ? null : b)), ms);
  }, []);

  /** A new fight's heroes on the cards: full HP, gauges empty. */
  const showCards = useCallback(
    (team: readonly HeroUnit[]) => {
      feed.reset(team);
      const g = gameStore.get();
      setCards(g !== null ? cardHeroes(team, g.heroes.roster) : []);
    },
    [feed],
  );

  // The timer follows the fight as the field plays it (a slow phone or a hidden tab slows both alike).
  useEffect(() => {
    if (clock === null || clock.endTick !== null) return;
    const id = window.setInterval(() => setPlayMs(sceneRef.current?.clockMs() ?? 0), 100);
    return () => window.clearInterval(id);
  }, [clock]);

  // A change in the saves: wake a waiting loop; a hunt gives way when the auto-challenge can go again.
  useEffect(
    () =>
      gameStore.subscribe(() => {
        wake.current?.();
        const g = gameStore.get();
        const m = modeRef.current;
        if (g === null || m.kind !== 'hunt') return;
        const ctx = { heroes: g.heroes, formation: g.stage.formations.stage };
        if (canAutoChallenge(g.stage.progress, ctx)) liveRef.current?.stop();
      }),
    [],
  );

  // ---- The loop: challenge while it can, else hunt ----
  useEffect(() => {
    if (!sceneUp || game === null) return;
    let alive = true;
    let huntNo = 0;
    /** Quick wins in a row: the floor the run began on (one banner for them all). */
    let quickFrom: number | null = null;
    const waitForChange = () =>
      new Promise<void>((resolve) => {
        wake.current = () => {
          wake.current = null;
          resolve();
        };
      });
    const pause = async (ms: number) => {
      await sleep(ms / speedRef.current);
    };
    /** Plays a fight live on the field (the cards read it) until its end, a skip or a stop. */
    const play = (scene: BattleScene, run: BattleRun, units: readonly TimelineUnit[], sp: number) => {
      const p = playLive({ run, units, tickMs: BATTLE_TICK_MS, speed: sp, scene });
      // AUTO flipped while the field was being set up.
      p.setAuto(sigAutoRef.current);
      feed.play = p;
      liveRef.current = p;
      return p.done.then((out) => {
        if (liveRef.current === p) liveRef.current = null;
        // A skipped fight's cues never played: the cards jump to the end as well.
        if (feed.play === p && out.end === 'skipped') feed.settle(out.result.heroHp);
        return out;
      });
    };
    void (async () => {
      let march = false;
      while (alive) {
        const scene = sceneRef.current;
        const g = gameStore.get();
        if (scene === null || g === null) return;
        const formation = g.stage.formations.stage;
        const problems = formationProblems(formation, g.heroes.roster);
        if (problems.length > 0) {
          setMode({ kind: 'noTeam', why: problems.map(formationProblemText).join(' ') });
          setClock(null);
          showCards([]);
          await waitForChange();
          continue;
        }
        const ctx = { heroes: g.heroes, formation };
        const progress = g.stage.progress;
        const go = manual.current || canAutoChallenge(progress, ctx);
        manual.current = false;
        const sp = speedRef.current;
        const signatures = sigAutoRef.current ? 'auto' : 'manual';
        if (go) {
          // 다음 층 도전. The seed is this challenge's (server.ts BattleUse).
          const floor = nextFloor(progress);
          const seed = await gameStore.server.battleSeed({ kind: 'stage', floor, attempt: progress.attempts + 1 });
          if (!alive) return;
          const begun = beginNextFloor(progress, { ...ctx, battleSeed: seed, signatures });
          // The attempt is spent now: closing the app mid-fight does not give it back.
          const now = gameStore.get() ?? g;
          gameStore.setStage({ ...now.stage, progress: { ...begun.progress, auto: now.stage.progress.auto } });
          const fight: Fight = { begun, run: startBattle(begun.setup), bestBefore: progress.best, closing: null };
          fightRef.current = fight;
          const show = battleShow(begun.team, begun.setup.enemies, floorLayout(floor).element);
          setMode({ kind: 'challenge', floor });
          setShownBest(progress.best);
          // The new floor's timer starts full, not where the last fight stopped.
          setClock({ speed: sp, limitTicks: STAGE_TIME_LIMIT_TICKS, endTick: 0 });
          setPlayMs(0);
          showCards(begun.team);
          await scene.setup(show, march);
          let result: BattleResult;
          if (alive) {
            setClock({ speed: sp, limitTicks: STAGE_TIME_LIMIT_TICKS, endTick: null });
            result = (await play(scene, fight.run, timelineUnits(show), sp)).result;
          } else {
            result = runToEnd(fight.run);
          }
          const { challenge: c, settled } = await closeFight(fight, result);
          if (fightRef.current === fight) fightRef.current = null;
          if (!alive) return;
          setClock((k) => (k === null ? k : { ...k, endTick: c.result.ticks }));
          scene.finish(c.result.outcome);
          setShownBest(null);
          // The lumps that came in so far, counted at the floor that held until now (6.8, 7.1).
          if (settled !== null && settled.gained >= ARRIVAL_MIN_MAP) {
            const at = arrivalKey(settled.since);
            if (shouldTellArrival(at, settled.gained, ARRIVAL_MIN_MAP)) {
              markArrivalTold(at, settled.gained);
              say(idleReturnLine(progress.best, settled.gained), null, 'note', STAGE_RHYTHM.noteBannerMs);
            }
          }
          if (c.won) {
            const boss = c.floor % BOSS_EVERY === 0;
            const quick = !boss && c.result.ticks * BATTLE_TICK_MS < STAGE_RHYTHM.quickWinMs;
            if (quick) {
              quickFrom ??= c.floor;
              const text = quickFrom < c.floor ? STAGE_LINES.clearedRun(quickFrom, c.floor) : STAGE_LINES.cleared(c.floor);
              say(text, STAGE_LINES.next(c.floor + 1), 'win', winBannerMs(STAGE_RHYTHM.quickBannerMs));
              await pause(STAGE_RHYTHM.quickPauseMs);
            } else {
              quickFrom = null;
              say(boss ? STAGE_LINES.bossCleared(c.floor) : STAGE_LINES.cleared(c.floor), STAGE_LINES.next(c.floor + 1), boss ? 'boss' : 'win', winBannerMs(STAGE_RHYTHM.winBannerMs));
              await pause(STAGE_RHYTHM.winPauseMs);
            }
            march = true;
          } else {
            quickFrom = null;
            say(STAGE_LINES.stuck(c.floor), c.result.outcome === 'timeout' ? STAGE_LINES.timeout : STAGE_LINES.wiped, 'lose', STAGE_RHYTHM.loseBannerMs);
            await pause(STAGE_RHYTHM.losePauseMs);
            march = false;
          }
          continue;
        }
        // 방치 사냥: the best floor, again and again. No result: nothing is saved, nothing is lost (hunt.ts).
        quickFrom = null;
        const floor = Math.max(1, progress.best);
        huntNo += 1;
        const enemies = floorEnemies(floor);
        const hunt = huntFight(buildTeam(g.heroes, formation), enemies, huntNo, signatures);
        const show = battleShow(hunt.team, enemies, floorLayout(floor).element);
        const stuckOn = progress.stuck !== null && progress.stuck.floor === nextFloor(progress) ? progress.stuck.floor : null;
        setMode({ kind: 'hunt', floor: progress.best, stuckOn });
        setClock(null);
        showCards(hunt.team);
        await scene.setup(show, march);
        if (!alive) return;
        const { end, result } = await play(scene, startBattle(hunt.setup), timelineUnits(show), sp);
        if (!alive) return;
        if (end === 'done') {
          // Whatever still stands goes off in a puff: the hunt never shows a group left over.
          if (result.outcome !== 'win') scene.scatter();
          scene.finish('win');
          await pause(700);
        }
        march = end === 'done';
      }
    })();
    return () => {
      alive = false;
      wake.current = null;
      // Leaving mid-challenge: the rest runs at once on auto and is saved (closeFight); a hunt just stops.
      const f = fightRef.current;
      const p = liveRef.current;
      if (f !== null && f.closing === null) {
        if (p !== null) p.finishNow();
        else void closeFight(f, runToEnd(f.run));
      } else {
        p?.stop();
      }
      sceneRef.current?.stop();
    };
    // The loop starts once the field and the saves are there; it reads the latest saves itself.
  }, [sceneUp, game === null]);

  const onCue = useCallback(
    (c: Cue) => {
      cueSound(c);
      feed.cue(c);
    },
    [cueSound, feed],
  );

  const formation = game?.stage.formations.stage ?? null;
  const power = useMemo(() => {
    if (game === null || formation === null || formationProblems(formation, game.heroes.roster).length > 0) return null;
    return teamPower(buildTeam(game.heroes, formation));
  }, [game, formation]);

  if (game === null) return <div className="app-loading">들판으로 나가는 중…</div>;
  const progress = game.stage.progress;
  const best = shownBest ?? progress.best;
  const shownFloor = mode.kind === 'challenge' ? mode.floor : mode.kind === 'hunt' ? Math.max(1, mode.floor) : nextFloor(progress);
  const isBoss = shownFloor % BOSS_EVERY === 0;
  let timer: number | null = null;
  if (clock !== null) {
    const ticks = clock.endTick ?? Math.max(0, (playMs * clock.speed - TIMELINE.introMs) / BATTLE_TICK_MS);
    timer = Math.max(0, Math.ceil(((clock.limitTicks - ticks) * BATTLE_TICK_MS) / 1000));
  }
  // The next floor to fight: what it is made of, shown ahead (6.1 '다음 층의 속성과 체형은 미리 보인다').
  const ahead = floorLayout(best + 1);
  const aheadIcon = iconUrl(`element_${ahead.element}`);
  const stuck = mode.kind === 'hunt' && mode.stuckOn !== null;
  const status =
    mode.kind === 'challenge'
      ? STAGE_LINES.challenging(mode.floor)
      : mode.kind === 'hunt'
        ? STAGE_LINES.hunting(mode.floor)
        : mode.kind === 'noTeam'
          ? `${STAGE_LINES.noTeam} ${mode.why}`
          : '';
  // One hint at most: the way on when stuck (6.7), or how to climb with the auto-challenge off.
  const hint =
    mode.kind !== 'hunt' ? null : !progress.auto ? STAGE_LINES.autoOff : stuck ? STAGE_LINES.stuckHint(mode.stuckOn ?? 0) : null;

  const toggleAuto = () => {
    sound.unlock();
    const g = gameStore.get();
    if (g === null) return;
    gameStore.setStage({ ...g.stage, progress: setAutoChallenge(g.stage.progress, !g.stage.progress.auto) });
  };
  const toggleSigAuto = () => {
    sound.unlock();
    const on = !sigAutoRef.current;
    sigAutoRef.current = on;
    setSigAuto(on);
    saveSignatureAuto(on);
    liveRef.current?.setAuto(on);
  };
  const challenge = () => {
    sound.unlock();
    manual.current = true;
    if (modeRef.current.kind === 'hunt') liveRef.current?.stop();
    wake.current?.();
  };

  return (
    <div className={`bt-root kc-skin${reduced ? ' reduced' : ''}`}>
      <header className="bt-top">
        <button type="button" className="hs-iconbtn" onClick={props.onExit} aria-label="마을로">
          ←
        </button>
        <div className={`bt-floor${isBoss ? ' boss' : ''}`}>
          <b>{shownFloor}층</b>
          {isBoss && <small>{STAGE_LINES.boss}</small>}
        </div>
        <div className={`bt-timer${timer !== null && timer <= 5 ? ' low' : ''}${timer === null ? ' off' : ''}`} aria-label={timer !== null ? `남은 시간 ${timer}초` : '사냥 중'}>
          {timer !== null ? `${timer}초` : '사냥'}
        </div>
        <LevelChip banner className="bt-level" />
      </header>
      <div className="bt-sub">
        <span className="bt-best">최고 {best}층</span>
        <span className="bt-ahead" aria-label={`다음 ${best + 1}층: ${ELEMENT_LABEL[ahead.element]} 속성, ${BODY_LABEL[ahead.body]}${ahead.boss !== null ? ', 보스' : ''}`}>
          <small>다음</small>
          {aheadIcon !== null ? <img src={aheadIcon} alt="" draggable={false} /> : <b>{ELEMENT_LABEL[ahead.element]}</b>}
          <span>{BODY_LABEL[ahead.body]}</span>
          {ahead.boss !== null && <em>{STAGE_LINES.boss}</em>}
        </span>
        <button type="button" role="switch" aria-checked={progress.auto} className={`bt-auto${progress.auto ? ' on' : ''}`} onClick={toggleAuto}>
          {STAGE_LINES.autoOn} {progress.auto ? '켬' : '끔'}
        </button>
      </div>

      <BattleField reduced={reduced} sceneRef={sceneRef} onReady={() => setSceneUp(true)} onCue={onCue} sizes={sizes}>
        <SizeLab sizes={sizes} onChange={setSizes} />
        {banner !== null && (
          <div key={banner.key} className={`bt-banner ${banner.tone}`} role="status">
            <b>{banner.text}</b>
            {banner.sub !== null && <small>{banner.sub}</small>}
          </div>
        )}
        {note !== null && (
          <div key={note.key} className="bt-banner note" role="status">
            <b>{note.text}</b>
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
          speedRef.current = s;
          setSpeed(s);
          saveSpeed(s);
          // A fight on the field keeps the speed it was laid out at; say when the new one takes hold.
          if (modeRef.current.kind === 'challenge' || modeRef.current.kind === 'hunt') say(STAGE_LINES.speedNext(s), null, 'note', STAGE_RHYTHM.speedNoteMs);
        }}
        onFire={() => {
          sound.unlock();
          haptics.play('tap');
        }}
      />

      <footer className="bt-foot">
        <div className="bt-line">
          <p className="bt-status" aria-live="polite">
            {status}
          </p>
          <p className="bt-facts">
            <span>
              전투력 <b>{power !== null ? fmt(power) : '—'}</b>
            </span>
            <span>
              {STAGE_LINES.lumpsPerHour} <b>{fmt(idleLumpsPerHour(best))}</b>개
            </span>
          </p>
        </div>
        {hint !== null && <p className="bt-hint">{hint}</p>}
        <div className="bt-controls">
          <button type="button" className="kc-btn small" onClick={() => setSheet('formation')}>
            편성
          </button>
          <button type="button" className="kc-btn small" onClick={() => liveRef.current?.finishNow()} disabled={mode.kind !== 'challenge' || clock?.endTick !== null}>
            건너뛰기
          </button>
          <button
            type="button"
            className="kc-btn primary bt-go"
            onClick={challenge}
            disabled={mode.kind === 'challenge' || mode.kind === 'noTeam' || mode.kind === 'wait'}
          >
            {best + 1}층 도전
          </button>
        </div>
      </footer>

      {sheet === 'formation' && (
        <Sheet title="스테이지 편성" onClose={() => setSheet(null)}>
          <FormationEditor
            heroes={game.heroes}
            formations={game.stage.formations}
            kind="stage"
            fixedKind
            onChange={(formations) => {
              const g = gameStore.get();
              if (g !== null) gameStore.setStage({ ...g.stage, formations });
            }}
          />
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
    </div>
  );
}
