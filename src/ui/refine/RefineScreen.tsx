// 광석 정제 화면 (기획서 10.1): the top band (back, the pile, the gold, the bag), the workshop with
// the pile of lumps by the anvil (RefineStage), and at the bottom the big hammer and the
// multiplier beside it. Coming in counts the lumps that piled up while away and says so in one
// line (no button to take them). A tap strikes once; held, the hammer strikes faster and faster,
// up to fifteen blows a press, and the finds land round the anvil, then fly into the bag (the bag
// and the gold say how much the batch brought, '+n'). Every blow's result is the engine's
// (sim/refine, CLAUDE.md 규칙 2); the screen keeps the tempo, plays the effects, rings the hammer
// through platform/audio.ts and buzzes the phone through platform/haptics.ts. Loaded on demand.

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../platform/audio.ts';
import { systemClock } from '../../platform/clock.ts';
import { haptics } from '../../platform/haptics.ts';
import { itemArtUrl, refineArtUrl } from '../../render/refine/assets.ts';
import { REFINE_ITEM_FX, REFINE_SHOWCASE } from '../../render/refine/layout.ts';
import {
  RARITY_LABEL,
  REFINE_HAPTIC,
  REFINE_LINE_GAP_MS,
  REFINE_LINES,
  idleLumpCap,
  REFINE_SOUND,
  REFINE_TEMPO,
  refineFirstPileLine,
  type RefineItemId,
  refineRow,
} from '../../sim/data/refine.ts';
import {
  accrue,
  batchFull,
  bagTotals,
  hitInBatch,
  holdIntervalMs,
  isExpDrop,
  newBatch,
  nextMult,
  type RefineBatch,
  type RefineDrop,
  refineView,
} from '../../sim/refine/index.ts';
import { reducedMotion, Sheet } from '../cards/parts.tsx';
import { arrivalKey, markArrivalTold, shouldTellArrival } from './arrival.ts';
import { makeCollector } from './collector.ts';
import { type BlowResult, makeHammer } from './hammer.ts';
import { RefineLab } from './RefineLab.tsx';
import { type Find, RefineStage, type StageApi } from './RefineStage.tsx';
import {
  minuteStartMs,
  newRefineSave,
  newVisit,
  type RefineSave,
  type RefineVisit,
  refineStore,
  VISIT_LIMIT,
  worldMinute,
} from './store.ts';
import { clock, num } from './text.ts';
import { idleReturnLine } from '../battle/text.ts';
import { LevelChip } from '../game/LevelChip.tsx';
import { gameStore } from '../game/store.ts';
import './refine.css';

/** How long the '자리를 비운 사이' line stays (ms), how long a dwarf line stays, and a batch's '+n'. */
const NOTICE_MS = 4800;
const SAY_MS = 2800;
const PLUS_MS = 1300;
/** While on the screen, lumps that come in one by one are quiet; this many at once (a return) get the line. */
const NOTICE_FROM = 2;

const nowMs = () => systemClock.nowMs();

function randomSeed(): number {
  // UI-only randomness for a new save's seed; the sim never sees Math.random.
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** How the feel is set now (the play log keeps it with each visit). */
const feel = () => ({ haptics: haptics.enabled(), firmHaptics: haptics.strength() === 'firm', sound: sound.enabled() });

/** The visit going on (the last one, if it began at `start`). */
function withVisit(s: RefineSave, start: number, f: (v: RefineVisit) => RefineVisit): RefineSave {
  const last = s.visits[s.visits.length - 1];
  if (last === undefined || last.startMs !== start) return s;
  return { ...s, visits: [...s.visits.slice(0, -1), f({ ...last, lastMs: Math.max(last.lastMs, nowMs()) })] };
}

export default function RefineScreen(props: { onExit(): void }) {
  const reduced = useMemo(() => reducedMotion(), []);
  const [save, setSave] = useState<RefineSave | null>(null);
  /** 최고 스테이지 (the stage save): the rate, cap and band of the lumps (6.8, 7.1). */
  const best = useRef(0);
  const saveRef = useRef<RefineSave | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const visitStart = useRef(0);
  const put = useCallback((next: RefineSave) => {
    saveRef.current = next;
    setSave(next);
    void refineStore.save(next).then((ok) => setSaveFailed(!ok));
  }, []);

  const [now, setNow] = useState(nowMs);
  const [notice, setNotice] = useState<{ key: number; text: string } | null>(null);
  const [say, setSay] = useState<{ key: number; text: string } | null>(null);
  const [sheet, setSheet] = useState<'bag' | 'lab' | null>(null);
  const [finds, setFinds] = useState<Find[]>([]);
  const [pressed, setPressed] = useState(false);
  const [emptyKick, setEmptyKick] = useState(0);
  /** What a batch brought, popping out of the gold and the bag as its last find gets there. */
  const [plus, setPlus] = useState<{ key: number; where: 'gold' | 'bag'; text: string }[]>([]);
  /** The lump count shown until the pile grows on arrival, once the workshop is up (null: the save's). */
  const [lumpsShown, setLumpsShown] = useState<number | null>(null);
  const growPending = useRef(false);
  const [blewThisVisit, setBlewThisVisit] = useState(false);

  const keyRef = useRef(0);
  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };
  const stageApi = useRef<StageApi | null>(null);
  const bagRef = useRef<HTMLButtonElement>(null);
  const goldRef = useRef<HTMLDivElement>(null);
  const hammerImg = useRef<HTMLSpanElement>(null);
  const batchRef = useRef<RefineBatch>(newBatch());
  const timers = useRef(new Set<number>());
  /** When the rare line was last said, whether the gift line was said this visit, when any line was. */
  const spoke = useRef({ rareAt: Number.NEGATIVE_INFINITY, gift: false, at: 0 });
  /** Each flight into the bag: what it carries and how many of its finds are still on the way. */
  const flights = useRef(new Map<number, { gold: number; items: number; goldLeft: number; itemsLeft: number }>());

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const showNotice = useCallback(
    (text: string) => {
      const key = nextKey();
      setNotice({ key, text });
      later(() => setNotice((n) => (n?.key === key ? null : n)), NOTICE_MS);
    },
    [later],
  );
  const speak = useCallback(
    (text: string) => {
      const key = nextKey();
      spoke.current.at = nowMs();
      setSay({ key, text });
      later(() => setSay((s) => (s?.key === key ? null : s)), SAY_MS);
    },
    [later],
  );

  /** The lumps that came in while away join the pile (the scene is up, or it is taking too long). */
  const stageReady = useRef(false);
  const grow = useCallback(() => {
    if (!growPending.current) return;
    growPending.current = false;
    later(() => setLumpsShown(null), 420);
  }, [later]);
  const stageUp = useCallback(() => {
    stageReady.current = true;
    grow();
  }, [grow]);

  // ---- Coming in: count what piled up while away, and say so ----
  useEffect(() => {
    let alive = true;
    void Promise.all([refineStore.load(), gameStore.load().catch(() => null)]).then(([loaded, game]) => {
      if (!alive) return;
      // The lumps come in at the best floor's rate, cap and band (6.8, 7.1).
      best.current = game?.stage.progress.best ?? 0;
      const ms = nowMs();
      const base = loaded ?? newRefineSave(worldMinute(ms), randomSeed());
      const r = accrue(base.state, worldMinute(ms), best.current);
      const full = r.state.lumps >= idleLumpCap(best.current);
      visitStart.current = ms;
      const visit = { ...newVisit(ms, r.state, r.gained, full), ...feel() };
      // 경험치 struck in a batch the app closed on goes in now.
      if ((base.expHeld ?? 0) > 0) void gameStore.addExp(base.expHeld ?? 0);
      put({ ...base, state: r.state, firstSeen: true, expHeld: 0, visits: [...base.visits, visit].slice(-VISIT_LIMIT) });
      if (r.gained > 0) {
        // Said once per batch: the map may have said it already as it opened (arrival.ts).
        const key = arrivalKey(loaded === null ? null : base.state.accruedAt);
        if (shouldTellArrival(key, r.gained)) {
          markArrivalTold(key, r.gained);
          showNotice(loaded === null ? refineFirstPileLine(r.gained) : idleReturnLine(best.current, r.gained));
        }
        // The pile grows in front of him once the workshop is up: it shows what was there first.
        if (!reduced) {
          setLumpsShown(base.state.lumps);
          growPending.current = true;
          if (stageReady.current) grow();
          else later(() => grow(), 2500);
        }
      }
      if (!base.firstSeen) later(() => speak(REFINE_LINES.first), 900);
      else if (full) later(() => speak(REFINE_LINES.full), 900);
    });
    return () => {
      alive = false;
    };
  }, [put, showNotice, speak, later, reduced, grow]);

  // ---- While here: lumps keep coming in; a return from another app gets the line ----
  const tickNow = useCallback(() => {
    const ms = nowMs();
    setNow(ms);
    const s = saveRef.current;
    if (s === null) return;
    const r = accrue(s.state, worldMinute(ms), best.current);
    if (r.state === s.state) return;
    put({ ...s, state: r.state });
    if (r.gained >= NOTICE_FROM) showNotice(idleReturnLine(best.current, r.gained));
  }, [put, showNotice]);

  useEffect(() => {
    const id = window.setInterval(tickNow, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tickNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tickNow]);

  // ---- The batch: finds round the anvil fly into the bag ----
  const findsRef = useRef(finds);
  findsRef.current = finds;
  /**
   * The batch's 경험치 goes into the shared level as the batch ends (5.3, 7.2: '묶음이 끝날 때 그
   * 묶음의 경험치를 한 번에'), and the top line says the batch's sum. Until then it waits in the
   * refine save (expHeld), so a closed app does not lose it.
   */
  const releaseExp = useCallback(() => {
    const s = saveRef.current;
    const held = s?.expHeld ?? 0;
    if (s === null || held <= 0) return;
    void gameStore.addExp(held);
    put({ ...s, expHeld: 0 });
  }, [put]);
  const collect = useCallback(() => {
    batchRef.current = newBatch();
    releaseExp();
    // What this flight carries, for the '+n' when its last find gets there.
    const group = nextKey();
    const tally = { gold: 0, items: 0, goldLeft: 0, itemsLeft: 0 };
    for (const f of findsRef.current) {
      if (f.fly !== null) continue;
      // 경험치 went into the level bar as it was struck: it is not part of the bag's '+n'.
      if (isExpDrop(f.drop)) continue;
      if (refineRow(f.drop.item).kind === 'gold') {
        tally.gold += f.drop.amount;
        tally.goldLeft += 1;
      } else {
        tally.items += f.drop.amount;
        tally.itemsLeft += 1;
      }
    }
    if (tally.goldLeft + tally.itemsLeft > 0) flights.current.set(group, tally);
    setFinds((list) => {
      let order = 0;
      return list.map((f) => (f.fly !== null ? f : { ...f, fly: order++, group }));
    });
  }, [releaseExp]);
  // The finds wait on the floor until the press is over and they have landed (collector.ts).
  const collector = useMemo(
    () =>
      makeCollector({
        now: nowMs,
        schedule: (fn, ms) => window.setTimeout(fn, ms),
        cancel: (id) => window.clearTimeout(id),
        delay: REFINE_ITEM_FX.collectDelay,
        collect,
      }),
    [collect],
  );

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      collector.dispose();
      // Leaving mid-batch: its 경험치 goes in now (the next screen's top line says it).
      releaseExp();
    },
    [collector, releaseExp],
  );

  const popPlus = useCallback(
    (where: 'gold' | 'bag', text: string) => {
      const key = nextKey();
      setPlus((list) => [...list.filter((x) => x.where !== where), { key, where, text }]);
      later(() => setPlus((list) => list.filter((x) => x.key !== key)), PLUS_MS);
    },
    [later],
  );

  /**
   * A find reached the bag (or the gold): it leaves the floor's count and the bag gives a little
   * hop; the last of its flight gives a bigger one and the flight's '+n'.
   */
  const arrive = useCallback(
    (key: number) => {
      const f = findsRef.current.find((x) => x.key === key);
      if (f !== undefined) {
        const gold = refineRow(f.drop.item).kind === 'gold';
        let last = false;
        const t = f.group !== undefined && !isExpDrop(f.drop) ? flights.current.get(f.group) : undefined;
        if (t !== undefined && f.group !== undefined) {
          if (gold) {
            t.goldLeft -= 1;
            last = t.goldLeft === 0;
            if (last && t.gold > 0) popPlus('gold', `+${num(t.gold)}G`);
          } else {
            t.itemsLeft -= 1;
            last = t.itemsLeft === 0;
            if (last && t.items > 0) popPlus('bag', `+${num(t.items)}`);
          }
          if (t.goldLeft <= 0 && t.itemsLeft <= 0) flights.current.delete(f.group);
        }
        if (!reduced) {
          const el = gold ? goldRef.current : bagRef.current;
          const k = last ? 1.3 : 1.08;
          el?.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.4 }, { transform: 'scale(1)' }], {
            duration: last ? 320 : 160,
            easing: 'ease-out',
          });
        }
      }
      setFinds((list) => list.filter((x) => x.key !== key));
    },
    [reduced, popPlus],
  );

  // ---- One blow ----
  const lineFor = (d: RefineDrop) => {
    const sp = spoke.current;
    const ms = nowMs();
    if (d.rarity === 'veryRare') {
      speak(REFINE_LINES.veryRare);
      sp.rareAt = ms;
    } else if (d.rarity === 'rare' && ms - sp.rareAt >= REFINE_LINE_GAP_MS.rare) {
      // Not after every batch (one in ten has none): it would turn into a tic (REFINE_LINE_GAP_MS).
      speak(REFINE_LINES.rare);
      sp.rareAt = ms;
    } else if (refineRow(d.item).kind === 'gift' && !sp.gift && ms - sp.at > SAY_MS) {
      speak(REFINE_LINES.gift);
      sp.gift = true;
    }
  };

  const kickHammer = () => {
    const el = hammerImg.current;
    if (el === null || reduced) return;
    el.animate(
      [
        { transform: 'rotate(0deg) translateY(0)' },
        { transform: 'rotate(-14deg) translateY(4px)', offset: 0.35 },
        { transform: 'rotate(0deg) translateY(0)' },
      ],
      { duration: 120, easing: 'ease-out' },
    );
  };

  const blow = (n: number): BlowResult => {
    const s = saveRef.current;
    if (s === null) return { struck: false, full: false };
    const ms = nowMs();
    const state = accrue(s.state, worldMinute(ms), best.current).state;
    const r = hitInBatch(state, batchRef.current, s.seed, s.mult);
    if (r === null) {
      if (n === 1 && state.lumps < 1) {
        // Pressed with nothing on the pile (16.3의 22번 counts it).
        put(withVisit({ ...s, state }, visitStart.current, (v) => ({ ...v, emptyPresses: v.emptyPresses + 1 })));
        setEmptyKick((k) => k + 1);
      }
      return { struck: false, full: batchFull(batchRef.current) };
    }
    batchRef.current = r.batch;
    const d = r.drop;
    const m = String(d.mult);
    // 경험치 waits for the batch's end (releaseExp), kept in the save meanwhile.
    const expHeld = (s.expHeld ?? 0) + (isExpDrop(d) ? d.amount : 0);
    put(
      withVisit({ ...s, state: r.state, ...(expHeld > 0 ? { expHeld } : {}) }, visitStart.current, (v) => ({
        ...v,
        blows: v.blows + 1,
        byMult: { ...v.byMult, [m]: (v.byMult[m] ?? 0) + 1 },
        ...feel(),
      })),
    );
    setBlewThisVisit(true);
    const find: Find = { key: nextKey(), drop: d, slot: r.batch.drops.length - 1, fly: null };
    setFinds((list) => [...list, find]);
    const veryRare = d.rarity === 'veryRare';
    // A very rare find hangs over the anvil first (render/refine/layout.ts REFINE_SHOWCASE).
    const show = REFINE_SHOWCASE.veryRare;
    collector.landing(ms + REFINE_ITEM_FX.flyMs + (veryRare && !reduced ? show.riseMs + show.holdMs : 0));
    const beat = veryRare ? REFINE_TEMPO.veryRarePauseMs : holdIntervalMs(n);
    stageApi.current?.strike({ rarity: d.rarity, beatMs: beat, lumpsAfter: r.state.lumps });
    stageApi.current?.shake(d.rarity);
    sound.play(REFINE_SOUND[d.rarity]);
    haptics.play(REFINE_HAPTIC[d.rarity]);
    kickHammer();
    lineFor(d);
    return { struck: true, full: batchFull(r.batch), ...(veryRare ? { pauseMs: beat } : {}) };
  };

  const release = (blows: number) => {
    setPressed(false);
    stageApi.current?.setHeld(false);
    // Whatever is on the floor flies once it has landed, even after a press that struck nothing
    // (an empty pile right after the last lump): that press held the batch, so it lets it go.
    collector.release(batchRef.current.drops.length > 0);
    if (blows <= 0) return;
    const s = saveRef.current;
    if (s !== null) {
      put(withVisit(s, visitStart.current, (v) => (blows === 1 ? { ...v, taps: v.taps + 1 } : { ...v, holds: v.holds + 1 })));
    }
  };

  const deps = useRef({ blow, release });
  deps.current = { blow, release };
  const hammer = useMemo(
    () =>
      makeHammer({
        blow: (n) => deps.current.blow(n),
        release: (b) => deps.current.release(b),
        schedule: (fn, ms) => window.setTimeout(fn, ms),
        cancel: (id) => window.clearTimeout(id),
      }),
    [],
  );
  useEffect(() => () => hammer.dispose(), [hammer]);

  const pressStart = () => {
    if (saveRef.current === null || hammer.pressing()) return;
    sound.unlock();
    // A press before the last batch flew keeps its finds on the floor and adds to them; a full one flies now.
    collector.press(batchFull(batchRef.current));
    // Struck before the pile had grown on arrival: it grows now.
    growPending.current = false;
    setLumpsShown(null);
    setPressed(true);
    stageApi.current?.setHeld(true);
    hammer.down();
  };

  const cycleMult = () => {
    const s = saveRef.current;
    if (s === null) return;
    const v = refineView(s.state, s.mult, best.current);
    const next = nextMult(v.mult ?? s.mult, s.state.lumps);
    if (next === s.mult) return;
    put(withVisit({ ...s, mult: next }, visitStart.current, (x) => ({ ...x, multChanges: x.multChanges + 1 })));
  };

  // ---- 실험 ----
  const labAddLumps = (n: number) => {
    const s = saveRef.current;
    if (s !== null) put({ ...s, state: { ...s.state, lumps: s.state.lumps + n } });
  };
  const labFastForward = (minutes: number) => {
    const s = saveRef.current;
    if (s === null) return;
    // As if he had been away that much longer: the counted-up-to minute moves back, then it counts.
    const r = accrue({ ...s.state, accruedAt: s.state.accruedAt - minutes }, worldMinute(nowMs()), best.current);
    put({ ...s, state: r.state });
    showNotice(r.gained > 0 ? idleReturnLine(best.current, r.gained) : '더미가 가득 차 더는 쌓이지 않았다.');
  };
  const labClearLog = () => {
    const s = saveRef.current;
    if (s === null) return;
    const ms = nowMs();
    visitStart.current = ms;
    put({ ...s, visits: [{ ...newVisit(ms, s.state, 0, s.state.lumps >= idleLumpCap(best.current)), ...feel() }] });
  };
  const labReset = () => {
    const s = saveRef.current;
    if (s === null) return;
    collector.flush();
    setFinds([]);
    flights.current.clear();
    const fresh = newRefineSave(worldMinute(nowMs()), s.seed);
    put({ ...fresh, firstSeen: true, visits: s.visits });
    setSheet(null);
  };

  // ---- What shows ----
  const view = save !== null ? refineView(save.state, save.mult, best.current) : null;
  // Finds still on the floor or on their way are not in the bag's count yet.
  const pending = useMemo(() => {
    const bag: Partial<Record<RefineItemId, number>> = {};
    for (const f of finds) if (!isExpDrop(f.drop)) bag[f.drop.item] = (bag[f.drop.item] ?? 0) + f.drop.amount;
    return bagTotals(bag);
  }, [finds]);
  // The bag sheet: what has reached the bag (a first find still on its way is not a line of 0 yet).
  const bagLines =
    view === null
      ? []
      : view.bag
          .map((line) => ({ line, count: line.count - finds.reduce((n, f) => n + (f.drop.item === line.id ? f.drop.amount : 0), 0) }))
          .filter((x) => x.count > 0);
  const shownGold = view !== null ? view.gold - pending.gold : 0;
  const shownItems = view !== null ? view.items - pending.items : 0;
  const lumps = view?.lumps ?? 0;
  const lumpsText = lumpsShown ?? lumps;
  const canHit = view?.canHit === true;
  const nextIn = view !== null && !view.canHit && view.nextLumpAt !== null ? minuteStartMs(view.nextLumpAt) - now : null;

  const hammerUrl = refineArtUrl('btn_hammer');
  const bagUrl = refineArtUrl('bag');
  const chunkUrl = refineArtUrl('ore_chunk');
  const goldUrl = refineArtUrl('gold_coins');

  const hint =
    view === null
      ? ''
      : !canHit
        ? nextIn !== null
          ? `덩어리가 아직 없다 · 다음 덩어리까지 ${clock(nextIn)}`
          : '덩어리가 아직 없다'
        : view.full
          ? '더미가 가득 찼다. 두드리기 전엔 더 쌓이지 않는다'
          : !blewThisVisit
            ? '누르면 한 번, 꾹 누르면 계속 친다'
            : '';

  return (
    <div
      className={`rf-root kc-skin${reduced ? ' reduced' : ''}`}
      style={chunkUrl !== null ? ({ '--rf-chunk': `url("${chunkUrl}")` } as CSSProperties) : undefined}
    >
      <header className="rf-top">
        <button type="button" className="rf-iconbtn" onClick={props.onExit} aria-label="마을로">
          ←
        </button>
        <b className="rf-title">광석 정제</b>
        <LevelChip banner chip={false} />
        <div className={`rf-chip rf-lumps${view?.full === true ? ' full' : ''}`} role="status" aria-label={`광석 덩어리 ${lumps}개`}>
          {chunkUrl !== null && <img src={chunkUrl} alt="" draggable={false} />}
          <b key={lumpsShown === null ? 'n' : 'up'} className={lumpsShown !== null ? 'rising' : undefined}>
            {num(lumpsText)}
          </b>
          {view?.full === true && <small>가득</small>}
        </div>
        <div ref={goldRef} className="rf-chip rf-gold" aria-label={`골드 ${shownGold}`}>
          {goldUrl !== null && <img src={goldUrl} alt="" draggable={false} />}
          <b>{num(shownGold)}</b>
          {plus.map((x) =>
            x.where === 'gold' ? (
              <span key={x.key} className="rf-plus" aria-hidden="true">
                {x.text}
              </span>
            ) : null,
          )}
        </div>
        <button ref={bagRef} type="button" className="rf-bag" onClick={() => setSheet('bag')} aria-label={`가방: 얻은 것 ${shownItems}개`}>
          {bagUrl !== null ? <img src={bagUrl} alt="" draggable={false} /> : <span className="rf-bag-standin" />}
          <b>{num(shownItems)}</b>
          {plus.map((x) =>
            x.where === 'bag' ? (
              <span key={x.key} className="rf-plus" aria-hidden="true">
                {x.text}
              </span>
            ) : null,
          )}
        </button>
      </header>
      {notice !== null && (
        <button type="button" key={notice.key} className="rf-notice" onClick={() => setNotice(null)}>
          {notice.text}
        </button>
      )}
      {saveFailed && (
        <p className="rf-savewarn" role="alert">
          저장이 되지 않는다. 새로고침하면 얻은 것이 사라질 수 있다.
        </p>
      )}

      <RefineStage
        lumps={lumpsText}
        finds={finds}
        say={say}
        reduced={reduced}
        apiRef={stageApi}
        target={(gold) => (gold ? goldRef.current : bagRef.current)?.getBoundingClientRect() ?? null}
        onArrive={arrive}
        onReady={stageUp}
        onUnavailable={stageUp}
      />

      <footer className="rf-foot">
        <p key={`h${emptyKick}`} className={`rf-hint${emptyKick > 0 && !canHit ? ' kick' : ''}`} aria-live="polite">
          {hint}
        </p>
        <div className="rf-controls">
          <button type="button" className="rf-labbtn" onClick={() => setSheet('lab')}>
            실험
          </button>
          <button
            type="button"
            className={`rf-hammer${pressed ? ' down' : ''}${canHit ? '' : ' empty'}`}
            aria-label={canHit && view !== null && view.mult !== null ? `망치로 친다 (배율 ×${view.mult}, ${view.hits}번)` : '망치로 친다 (덩어리가 없다)'}
            aria-disabled={!canHit}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // a synthetic pointer: no capture
              }
              pressStart();
            }}
            onPointerUp={() => {
              // A touch's lift is what browsers count as a gesture for sound (the press may not be).
              sound.unlock();
              hammer.up();
            }}
            onPointerCancel={() => hammer.up()}
            onLostPointerCapture={() => hammer.up()}
            onClick={(e) => {
              // A keyboard press (Enter, Space) strikes once; pointer presses are handled above.
              if (e.detail !== 0) return;
              pressStart();
              hammer.up();
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span ref={hammerImg} className="rf-hammer-pic">
              {hammerUrl !== null ? <img src={hammerUrl} alt="" draggable={false} /> : <i className="rf-hammer-standin">망치</i>}
            </span>
          </button>
          <button
            type="button"
            className={`rf-mult${view?.lowered === true ? ' lowered' : ''}`}
            onClick={cycleMult}
            aria-label={`배율 ×${view?.mult ?? save?.mult ?? 1}. 눌러서 바꾼다`}
          >
            <span className="rf-mult-plate">
              {chunkUrl !== null && (
                <span className="rf-mult-lumps" aria-hidden="true">
                  <img src={chunkUrl} alt="" draggable={false} />
                  <img src={chunkUrl} alt="" draggable={false} />
                </span>
              )}
              <b>×{view?.mult ?? save?.mult ?? 1}</b>
            </span>
            <small>{view !== null && view.canHit ? `${num(view.hits)}번` : '—'}</small>
          </button>
        </div>
      </footer>

      {sheet === 'bag' && view !== null && (
        <Sheet title="가방" onClose={() => setSheet(null)}>
          {bagLines.length === 0 ? (
            <p className="kc-hint">아직 빈 가방이다. 덩어리를 두드려 보자.</p>
          ) : (
            <ul className="rf-baglist">
              {bagLines.map(({ line, count }) => {
                const url = itemArtUrl(line.id);
                return (
                  <li key={line.id} className={`rf-r-${line.rarity}`}>
                    <span className="rf-baglist-pic">{url !== null && <img src={url} alt="" draggable={false} />}</span>
                    <span className="rf-baglist-name">
                      <b>{line.name}</b>
                      <small>
                        {RARITY_LABEL[line.rarity]} · {line.kind === 'ore' ? '광석' : line.kind === 'gift' ? '용사에게 줄 선물' : '골드'}
                      </small>
                    </span>
                    <span className="rf-baglist-count">{line.kind === 'gold' ? `${num(count)}G` : num(count)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="kc-hint">아직은 모아 두기만 한다. 광석과 골드를 쓰는 곳, 선물을 건넬 자리는 곧 생긴다.</p>
          <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
            닫기
          </button>
        </Sheet>
      )}
      {sheet === 'lab' && save !== null && (
        <RefineLab
          save={save}
          onClose={() => setSheet(null)}
          onAddLumps={labAddLumps}
          onFastForward={labFastForward}
          onClearLog={labClearLog}
          onResetAll={labReset}
        />
      )}
    </div>
  );
}
