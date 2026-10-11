// The 육성 한 판 play log: one record per finished run (설정, 행동 순서, 단조 횟수와 품질, 넘은 벽,
// 평가, 걸린 시간, 턴마다 고민 시간), a summary for the [검증] panel, and the JSON the player copies
// out with their impressions (16.3의 11~19번). Pure: the caller passes the time in. Every number
// is read from the engine's state; nothing here judges the run.

import { cardName } from '../../sim/cards/index.ts';
import { materialName, QUALITY } from '../../sim/data/common.ts';
import { CARD_RECIPE_GRADE_LABEL } from '../../sim/data/cards.ts';
import { FAMILIES } from '../../sim/data/families.ts';
import {
  DEATH_MODE_LABEL,
  DEMON_FLOOR,
  POLICY_LABEL,
  RUN_HAND_SIZE,
  RUN_GRADE_SPEC,
  SEASONS,
  WALL_PRESET_LABEL,
} from '../../sim/data/run.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import {
  factorText,
  legendTitle,
  type RunAction,
  type RunEndKind,
  type RunSetup,
  type RunState,
  weaponTitle,
} from '../../sim/run/index.ts';
import { activeMsOf, type RunMeta } from './store.ts';
import { ACTION_LABEL, CHOICE_KIND_LABEL, END_KIND_LABEL, floorsLabel, sec, turnActionLabel } from './text.ts';

export interface RunRecordTurn {
  turn: number;
  action: string;
  policy: string | null;
  forced: boolean;
  /** HP % before and after. */
  hp: [number, number];
  gold: [number, number];
  floors: string | null;
  /** 실패한 층의 결과 (부상, 중상 …), or null. */
  result: string | null;
  events: string[];
  /** Seconds deciding on the 턴 화면 (16.3의 12번). */
  thinkSec: number;
  choiceSec: number;
  resultSec: number;
}

export interface RunRecordForge {
  no: number;
  turn: number;
  material: string;
  grade: string;
  quick: boolean;
  success: boolean;
  quality: number | null;
  unique: string | null;
  hands: number;
  cardsPlayed: number;
  cost: number;
  /** Seconds on the anvil and the 완성 화면. */
  sec: number;
  turnSec: number[];
  slotsFilled: number;
  /** The new weapon was taken up (false: hung on the 무기 걸이 unused). */
  taken: boolean;
}

export interface RunRecord {
  id: string;
  at: string;
  seed: number;
  season: string;
  hero: { family: string; name: string; star: number; generation: number };
  companions: { name: string; star: number; bond: number }[];
  ancestors: { title: string; factors: string[] }[];
  /** 물려받은 인자. */
  factors: string[];
  settings: {
    turns: number;
    wallPreset: string;
    deathMode: string;
    eventRate: number;
    quickForge: boolean;
    /** The 단조 played with two taps: the art screen, or the plain table with 두 번 눌러 내기 on. */
    twoTap: boolean;
    /** The 단조 was on the art screen (false = the plain table); missing in records from before it was noted. */
    artScreen?: boolean;
    deckSize: number;
    /** 판 손패 and 31층부터 층 수입 배율 ([검증]); missing in records from before they existed. */
    handSize?: number;
    lateGoldRate?: number;
  };
  end: { kind: RunEndKind; label: string; turn: number; floor: number; line: string };
  result: {
    score: number;
    grade: string;
    title: string;
    record: number;
    wallsPassed: number;
    demon: boolean;
    floors: number;
    spare: number;
    weapon: number;
    bond: number;
    weaponName: string;
    weaponTitle: string;
    legendFactors: string[];
  };
  walls: { floor: number; deadline: number; passedTurn: number | null }[];
  /** One short line per turn, in order ('3 원정 (보통) 11~15층'). */
  actions: string[];
  turns: RunRecordTurn[];
  forges: RunRecordForge[];
  counts: Record<string, number>;
  policies: Record<string, number>;
  events: Record<string, number>;
  gold: {
    earned: number;
    gifted: number;
    materials: number;
    shop: number;
    repair: number;
    merchant: number;
    left: number;
    /** 판 골드 when the 마지막 등반 started (16.2의 15번), or null without one. */
    atClimb: number | null;
  };
  injuries: number;
  severe: number;
  finds: number;
  bestQuality: number;
  deckEnd: Record<string, number>;
  prepSec: number;
  activeSec: number;
  wallSec: number;
  think: { meanSec: number; medianSec: number; maxSec: number };
  resultReveals: number;
  resultSkips: number;
  /** 판 시드와 행동 기록: replaying these gives the same run (13.16). */
  replay: { setup: RunSetup; actions: RunAction[] };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function countNames(names: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) out[n] = (out[n] ?? 0) + 1;
  return out;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function avg(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const pctInt = (r: number): number => Math.round(r * 100);

/**
 * The record of a finished run (state.phase 'over'). twoTap: the 단조 played with two taps;
 * artScreen: on the art screen (left out when unknown).
 */
export function buildRunRecord(state: RunState, meta: RunMeta, nowMs: number, twoTap = false, artScreen?: boolean): RunRecord {
  const end = state.end;
  const result = state.result;
  if (end === null || result === null) throw new Error('run is not over');
  const setup = state.setup;
  const fam = FAMILIES[setup.hero.family];

  const turns: RunRecordTurn[] = state.turnLog.map((log) => {
    const k = String(log.turn);
    return {
      turn: log.turn,
      action: ACTION_LABEL[log.action],
      policy: log.expedition !== null && log.action === 'expedition' ? POLICY_LABEL[log.expedition.policy] : null,
      forced: log.forced,
      hp: [pctInt(log.hpBefore), pctInt(log.hpAfter)],
      gold: [log.goldBefore, log.goldAfter],
      floors: floorsLabel(log),
      result: log.expedition?.result ?? null,
      events: log.events.map((e) => CHOICE_KIND_LABEL[e]),
      thinkSec: sec(meta.turnMs[k] ?? 0),
      choiceSec: sec(meta.choiceMs[k] ?? 0),
      resultSec: sec(meta.resultMs[k] ?? 0),
    };
  });

  const forges: RunRecordForge[] = state.turnLog.flatMap((log) => {
    const f = log.forge;
    if (f === null) return [];
    const k = String(f.no);
    return [
      {
        no: f.no,
        turn: log.turn,
        material: materialName(f.materialTier),
        grade: CARD_RECIPE_GRADE_LABEL[f.grade],
        quick: f.quick,
        success: f.success,
        quality: f.quality,
        unique: f.unique === null ? null : UNIQUES[f.unique].name,
        hands: f.turns,
        cardsPlayed: f.cardsPlayed,
        cost: f.cost,
        sec: sec(meta.forgeMs[k] ?? 0),
        turnSec: (meta.forgeTurnMs[k] ?? []).map(sec),
        slotsFilled: f.picks.length,
        taken: f.taken,
      },
    ];
  });

  const think = turns.map((t) => t.thinkSec);
  const climb = state.turnLog.find((l) => l.action === 'climb');
  const s = state.stats;
  return {
    id: meta.id,
    at: new Date(nowMs).toISOString(),
    seed: setup.seed,
    season: SEASONS[setup.season].name,
    hero: { family: fam.id, name: fam.name, star: setup.hero.star, generation: setup.generation },
    companions: state.companions.map((c) => ({ name: FAMILIES[c.family].name, star: c.star, bond: c.bond })),
    ancestors: setup.ancestors.map((a) => ({ title: legendTitle(a), factors: a.factors.map(factorText) })),
    factors: state.factors.map(factorText),
    settings: {
      turns: state.rules.turns,
      wallPreset: WALL_PRESET_LABEL[state.rules.wallPreset],
      deathMode: DEATH_MODE_LABEL[state.rules.deathMode],
      eventRate: state.rules.eventRate,
      quickForge: state.rules.quickForge,
      twoTap,
      ...(artScreen !== undefined ? { artScreen } : {}),
      deckSize: setup.deck.length,
      handSize: state.rules.handSize,
      lateGoldRate: state.rules.lateGoldRate,
    },
    end: { kind: end.kind, label: END_KIND_LABEL[end.kind], turn: end.turn, floor: end.floor, line: end.line },
    result: {
      score: result.score.total,
      grade: RUN_GRADE_SPEC[result.grade].label,
      title: legendTitle(result.legend),
      record: state.record,
      wallsPassed: state.walls.filter((w) => w.passedTurn !== null).length,
      demon: state.lastBossFloor >= DEMON_FLOOR,
      floors: result.score.floors,
      spare: result.score.spare,
      weapon: result.score.weapon,
      bond: result.score.bond,
      weaponName: result.weaponName,
      weaponTitle: weaponTitle(state.weapon.weapon),
      legendFactors: result.factors.map(factorText),
    },
    walls: state.walls.map((w) => ({ floor: w.floor, deadline: w.deadline, passedTurn: w.passedTurn })),
    actions: state.turnLog.map((log) => {
      const floors = floorsLabel(log);
      const forge = log.forge;
      const tail =
        floors !== null
          ? ` ${floors}`
          : forge !== null
            ? ` ${materialName(forge.materialTier)} ${forge.success && forge.quality !== null ? `★${forge.quality}` : '실패'}`
            : '';
      return `${log.turn} ${turnActionLabel(log)}${log.forced ? ' (고정)' : ''}${tail}`;
    }),
    turns,
    forges,
    counts: countNames(state.turnLog.map((l) => ACTION_LABEL[l.action])),
    policies: countNames(state.turnLog.flatMap((l) => (l.action === 'expedition' && l.expedition !== null ? [POLICY_LABEL[l.expedition.policy]] : []))),
    events: countNames(state.turnLog.flatMap((l) => l.events.map((e) => CHOICE_KIND_LABEL[e]))),
    gold: {
      earned: s.goldEarned,
      gifted: s.goldGifted,
      materials: s.spentMaterials,
      shop: s.spentShop,
      repair: s.spentRepair,
      merchant: s.spentMerchant,
      left: state.gold,
      atClimb: climb === undefined ? null : climb.goldBefore,
    },
    injuries: s.injuries,
    severe: s.severe,
    finds: s.finds,
    bestQuality: s.bestQuality,
    deckEnd: countNames(state.deck.map((id) => cardName(id))),
    prepSec: sec(meta.prepMs),
    activeSec: sec(activeMsOf(meta)),
    wallSec: sec(Math.max(0, nowMs - meta.startedAtMs)),
    think: { meanSec: round1(avg(think)), medianSec: round1(median(think)), maxSec: round1(Math.max(0, ...think)) },
    resultReveals: meta.reveals,
    resultSkips: meta.skips,
    replay: { setup: JSON.parse(JSON.stringify(state.setup)) as RunSetup, actions: JSON.parse(JSON.stringify(state.actions)) as RunAction[] },
  };
}

/** Where a run stopped, for the summary ('20층 벽', '마지막 등반', '은퇴'). */
export function stopLabel(r: Pick<RunRecord, 'end' | 'walls'>): string {
  if (r.end.kind === 'wall') {
    const wall = r.walls.find((w) => w.passedTurn === null);
    return wall === undefined ? '벽' : `${wall.floor}층 벽`;
  }
  return r.end.label;
}

/**
 * The settings a run was played under, as one label ('2성 · 30턴 · 벽 기본 · 카드'): runs under
 * different 성급, walls or forging are not one sample (16.3의 11·13번), so the summary groups by it.
 */
export function settingsLabel(r: Pick<RunRecord, 'hero' | 'settings'>): string {
  const st = r.settings;
  const parts = [`${r.hero.star}성`, `${st.turns}턴`, `벽 ${st.wallPreset}`, st.quickForge ? '단조 간이' : '카드 단조'];
  if (st.deathMode !== DEATH_MODE_LABEL.severe) parts.push(`판 안 ${st.deathMode}`);
  if (st.eventRate !== 1) parts.push(`사건 ×${st.eventRate}`);
  if (st.handSize !== undefined && st.handSize !== RUN_HAND_SIZE) parts.push(`손패 ${st.handSize}`);
  if (st.lateGoldRate !== undefined && st.lateGoldRate !== 1) parts.push(`후반 수입 ×${st.lateGoldRate}`);
  // The art screen is the default 단조 table; the plain one is not one sample with it.
  if (!st.quickForge && st.artScreen === false) parts.push('예전 화면');
  return parts.join(' · ');
}

export interface RunSummary {
  count: number;
  /** 악마를 넘은 판 %. */
  demonShare: number;
  avgRecord: number;
  medianRecord: number;
  avgScore: number;
  grades: Record<string, number>;
  stops: Record<string, number>;
  avgForges: number;
  /** Quality of the successful forges, ★. */
  avgForgeQuality: number | null;
  forgeFails: number;
  avgActiveMin: number;
  avgPrepSec: number;
  medianThinkSec: number;
  /** Share of turns by action, %. */
  actionShare: Record<string, number>;
  avgEvents: number;
  /** 원정 결과 skipped before every floor was out, % of those shown. */
  skipShare: number | null;
  avgGoldAtClimb: number | null;
}

export function summarizeRuns(records: readonly RunRecord[]): RunSummary {
  const grades: Record<string, number> = {};
  const stops: Record<string, number> = {};
  for (const r of records) {
    grades[r.result.grade] = (grades[r.result.grade] ?? 0) + 1;
    const stop = stopLabel(r);
    stops[stop] = (stops[stop] ?? 0) + 1;
  }
  const allTurns = records.flatMap((r) => r.turns);
  const actionCounts = countNames(allTurns.map((t) => t.action));
  const actionShare: Record<string, number> = {};
  for (const [k, n] of Object.entries(actionCounts)) actionShare[k] = round1((n / Math.max(1, allTurns.length)) * 100);
  const forges = records.flatMap((r) => r.forges);
  const good = forges.filter((f) => f.success && f.quality !== null);
  const reveals = records.reduce((a, r) => a + r.resultReveals, 0);
  const skips = records.reduce((a, r) => a + r.resultSkips, 0);
  const climbs = records.flatMap((r) => (r.gold.atClimb === null ? [] : [r.gold.atClimb]));
  return {
    count: records.length,
    demonShare: round1((records.filter((r) => r.result.demon).length / Math.max(1, records.length)) * 100),
    avgRecord: round1(avg(records.map((r) => r.result.record))),
    medianRecord: median(records.map((r) => r.result.record)),
    avgScore: Math.round(avg(records.map((r) => r.result.score))),
    grades,
    stops,
    avgForges: round1(avg(records.map((r) => r.forges.length))),
    avgForgeQuality: good.length === 0 ? null : round1(avg(good.map((f) => f.quality as number))),
    forgeFails: forges.filter((f) => !f.success).length,
    avgActiveMin: round1(avg(records.map((r) => r.activeSec)) / 60),
    avgPrepSec: round1(avg(records.map((r) => r.prepSec))),
    medianThinkSec: round1(median(allTurns.map((t) => t.thinkSec))),
    actionShare,
    avgEvents: round1(avg(records.map((r) => Object.values(r.events).reduce((a, b) => a + b, 0)))),
    skipShare: reveals === 0 ? null : round1((skips / reveals) * 100),
    avgGoldAtClimb: climbs.length === 0 ? null : Math.round(avg(climbs)),
  };
}

/** The play log as JSON to paste: one record per line so it stays readable. */
export function runRecordsJson(records: readonly RunRecord[], exportedAtMs: number): string {
  const head = {
    exportedAt: new Date(exportedAtMs).toISOString(),
    note: '용사의 대장간 육성 한 판(시즌 악마의 탑) 프로토타입 플레이 기록. 시간은 화면이 켜져 있던 시간이고, 한 번에 2분을 넘는 쉼은 2분으로 센다. replay는 판 시드와 행동 기록이다 (기획서 13.16).',
    summary: summarizeRuns(records),
  };
  const lines = records.map((r) => `  ${JSON.stringify(r)}`);
  const top = JSON.stringify(head, null, 1);
  return `${top.slice(0, -1).trimEnd()},\n "records": [\n${lines.join(',\n')}\n ]\n}`;
}

/** '★3 역작' of a record's forge, or '실패'. */
export function forgeResultLabel(f: Pick<RunRecordForge, 'success' | 'quality'>): string {
  if (!f.success || f.quality === null) return '실패';
  const q = f.quality as 1 | 2 | 3 | 4 | 5;
  return `★${q} ${QUALITY[q].name}`;
}
