// 스테이지 화면 (기획서 6장, 사용자 결정 3): the field with the five heroes and the floor's monsters.
// While it can win, the auto-challenge fights the next floor (30 s, the timer at the top); a clear
// moves on to the next floor with a short march, a boss every 10 floors. A loss keeps the player on
// their best floor, hunting there (the idle hunt: no win or loss, it just goes on, hunt.ts), and the
// auto-challenge waits until the team changes (level, stars, formation, weapons, 6.7). It can be
// switched off; then the [도전] button climbs one floor at a time.
// Every result is the engine's (sim/stage, the battle seed from the server stand-in), decided and
// saved before it is shown (CLAUDE.md 규칙 2); the field only plays it back, at ×1, ×2 or ×4.
// Quick wins in a row (a team far above its floors) march faster and share one banner ('11~17층
// 돌파'). Before a win raises the best floor, the lumps that came in so far are counted at the old
// floor (refine/store.ts settleIdleBefore): time gone by keeps its floor's rate and band.
// The top band shows what 6.9 lists: the floor, the timer, the level; under it the best floor, the
// next floor's element and body, and the auto switch; the bottom band the team's power and the
// lumps an hour.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../platform/audio.ts';
import { systemClock } from '../../platform/clock.ts';
import { iconUrl } from '../../render/battle/assets.ts';
import type { BattleScene } from '../../render/battle/scene.ts';
import { buildTimeline, type Cue, TIMELINE } from '../../render/battle/timeline.ts';
import { BATTLE_TICK_MS, STAGE_TIME_LIMIT_TICKS } from '../../sim/data/battle.ts';
import { BODY_LABEL, ELEMENT_LABEL } from '../../sim/data/common.ts';
import { BOSS_EVERY } from '../../sim/data/monsters.ts';
import { idleLumpsPerHour } from '../../sim/data/refine.ts';
import {
  buildTeam,
  canAutoChallenge,
  challengeNextFloor,
  floorEnemies,
  floorLayout,
  formationProblems,
  formationProblemText,
  nextFloor,
  setAutoChallenge,
  teamPower,
} from '../../sim/stage/index.ts';
import { reducedMotion, Sheet } from '../cards/parts.tsx';
import { LevelChip, useGame } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import { FormationEditor } from '../heroes/FormationEditor.tsx';
import { ARRIVAL_MIN_MAP, arrivalKey, markArrivalTold, shouldTellArrival } from '../refine/arrival.ts';
import { settleIdleBefore } from '../refine/store.ts';
import { BattleField } from './BattleField.tsx';
import { type BattleSpeed, loadSpeed, makeCueSound, nextSpeed, saveSpeed } from './feel.ts';
import { huntFight } from './hunt.ts';
import { SizeLab, useFighterSize } from './SizeLab.tsx';
import { battleShow, timelineUnits } from './show.ts';
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
} as const;

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
  const [clock, setClock] = useState<Clock | null>(null);
  /** The running fight's playback time (ms), read from the scene (it runs on the scene's own clock). */
  const [playMs, setPlayMs] = useState(0);
  const [speed, setSpeed] = useState<BattleSpeed>(1);
  const speedRef = useRef<BattleSpeed>(1);
  const [sheet, setSheet] = useState<'formation' | null>(null);
  /** The best floor as the field shows it: a challenge is saved before it plays, so it rises only once the win is shown. */
  const [shownBest, setShownBest] = useState<number | null>(null);
  const manual = useRef(false);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const keyRef = useRef(0);
  const cueSound = useMemo(() => makeCueSound(), []);
  /** Wakes the loop when the saves change (a new formation, a level) while it waits. */
  const wake = useRef<(() => void) | null>(null);

  useEffect(() => {
    void loadSpeed().then((s) => {
      speedRef.current = s;
      setSpeed(s);
    });
  }, []);

  const say = useCallback((text: string, sub: string | null, tone: Banner['tone'], ms: number) => {
    keyRef.current += 1;
    const key = keyRef.current;
    setBanner({ key, text, sub, tone });
    window.setTimeout(() => setBanner((b) => (b?.key === key ? null : b)), ms);
  }, []);

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
        if (canAutoChallenge(g.stage.progress, ctx)) sceneRef.current?.stop();
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
          await waitForChange();
          continue;
        }
        const ctx = { heroes: g.heroes, formation };
        const progress = g.stage.progress;
        const go = manual.current || canAutoChallenge(progress, ctx);
        manual.current = false;
        const team = buildTeam(g.heroes, formation);
        const sp = speedRef.current;
        if (go) {
          // 다음 층 도전: decided and saved first, then shown. The seed is this challenge's (server.ts BattleUse).
          const floor = nextFloor(progress);
          const seed = await gameStore.server.battleSeed({ kind: 'stage', floor, attempt: progress.attempts + 1 });
          if (!alive) return;
          const c = challengeNextFloor(progress, { ...ctx, battleSeed: seed });
          if (c.won) {
            // The lumps so far come in at the floor that held until now (6.8, 7.1).
            const settled = await settleIdleBefore(progress.best, systemClock.nowMs()).catch(() => null);
            if (settled !== null && settled.gained >= ARRIVAL_MIN_MAP) {
              const at = arrivalKey(settled.since);
              if (shouldTellArrival(at, settled.gained, ARRIVAL_MIN_MAP)) {
                markArrivalTold(at, settled.gained);
                say(idleReturnLine(progress.best, settled.gained), null, 'note', STAGE_RHYTHM.noteBannerMs);
              }
            }
            if (!alive) return;
          }
          const latest = gameStore.get();
          if (latest !== null) gameStore.setStage({ ...latest.stage, progress: c.progress });
          const enemies = floorEnemies(c.floor);
          const show = battleShow(team, enemies, floorLayout(c.floor).element);
          setMode({ kind: 'challenge', floor: c.floor });
          setShownBest(progress.best);
          // The new floor's timer starts full, not where the last fight stopped.
          setClock({ speed: sp, limitTicks: STAGE_TIME_LIMIT_TICKS, endTick: 0 });
          setPlayMs(0);
          await scene.setup(show, march);
          if (!alive) return;
          const tl = buildTimeline(c.result.events, timelineUnits(show), { tickMs: BATTLE_TICK_MS, speed: sp });
          setClock({ speed: sp, limitTicks: STAGE_TIME_LIMIT_TICKS, endTick: null });
          await scene.run(tl);
          if (!alive) return;
          setClock((k) => (k === null ? k : { ...k, endTick: c.result.ticks }));
          scene.finish(c.result.outcome);
          setShownBest(null);
          if (c.won) {
            const boss = c.floor % BOSS_EVERY === 0;
            const quick = !boss && c.result.ticks * BATTLE_TICK_MS < STAGE_RHYTHM.quickWinMs;
            if (quick) {
              quickFrom ??= c.floor;
              const text = quickFrom < c.floor ? STAGE_LINES.clearedRun(quickFrom, c.floor) : STAGE_LINES.cleared(c.floor);
              say(text, STAGE_LINES.next(c.floor + 1), 'win', STAGE_RHYTHM.quickBannerMs);
              await pause(STAGE_RHYTHM.quickPauseMs);
            } else {
              quickFrom = null;
              say(boss ? STAGE_LINES.bossCleared(c.floor) : STAGE_LINES.cleared(c.floor), STAGE_LINES.next(c.floor + 1), boss ? 'boss' : 'win', STAGE_RHYTHM.winBannerMs);
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
        const hunt = huntFight(team, enemies, huntNo);
        const show = battleShow(hunt.team, enemies, floorLayout(floor).element);
        const stuckOn = progress.stuck !== null && progress.stuck.floor === nextFloor(progress) ? progress.stuck.floor : null;
        setMode({ kind: 'hunt', floor: progress.best, stuckOn });
        setClock(null);
        await scene.setup(show, march);
        if (!alive) return;
        const tl = buildTimeline(hunt.result.events, timelineUnits(show), { tickMs: BATTLE_TICK_MS, speed: sp });
        const end = await scene.run(tl);
        if (!alive) return;
        if (end === 'done') {
          if (hunt.scatter) scene.scatter();
          scene.finish('win');
          await pause(700);
        }
        march = end === 'done';
      }
    })();
    return () => {
      alive = false;
      wake.current = null;
      sceneRef.current?.stop();
    };
    // The loop starts once the field and the saves are there; it reads the latest saves itself.
  }, [sceneUp, game === null]);

  const onCue = useCallback(
    (c: Cue) => {
      cueSound(c);
    },
    [cueSound],
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
        ? stuck && progress.auto
          ? STAGE_LINES.hunting(mode.floor)
          : !progress.auto
            ? `${STAGE_LINES.hunting(mode.floor)} · ${STAGE_LINES.autoOff}`
            : STAGE_LINES.hunting(mode.floor)
        : mode.kind === 'noTeam'
          ? `${STAGE_LINES.noTeam} ${mode.why}`
          : '';

  const toggleAuto = () => {
    sound.unlock();
    const g = gameStore.get();
    if (g === null) return;
    gameStore.setStage({ ...g.stage, progress: setAutoChallenge(g.stage.progress, !g.stage.progress.auto) });
  };
  const challenge = () => {
    sound.unlock();
    manual.current = true;
    if (modeRef.current.kind === 'hunt') sceneRef.current?.stop();
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
      </BattleField>

      <footer className="bt-foot">
        <p className="bt-status" aria-live="polite">
          {status}
        </p>
        {stuck && progress.auto && mode.kind === 'hunt' && <p className="bt-hint">{STAGE_LINES.stuckHint(mode.stuckOn ?? 0)}</p>}
        <p className="bt-facts">
          <span>
            전투력 <b>{power !== null ? fmt(power) : '—'}</b>
          </span>
          <span>
            {STAGE_LINES.lumpsPerHour} <b>{fmt(idleLumpsPerHour(best))}</b>개
          </span>
        </p>
        <div className="bt-controls">
          <button type="button" className="kc-btn small" onClick={() => setSheet('formation')}>
            편성
          </button>
          <button
            type="button"
            className="kc-btn small"
            onClick={() => {
              const s = nextSpeed(speed);
              speedRef.current = s;
              setSpeed(s);
              saveSpeed(s);
            }}
            aria-label={`재생 속도 ×${speed}. 다음 전투부터`}
          >
            ×{speed}
          </button>
          <button type="button" className="kc-btn small" onClick={() => sceneRef.current?.skip()} disabled={mode.kind !== 'challenge'}>
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
