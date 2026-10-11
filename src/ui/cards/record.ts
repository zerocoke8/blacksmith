// The play log: one record per finished craft, a summary for the [검증] panel, and the JSON
// the player copies out to send with their impressions (16.3).

import { cardCraftOutcome, cardName, cardTurnSummary } from '../../sim/cards/index.ts';
import { materialName, QUALITY, WEAPON_LABEL } from '../../sim/data/common.ts';
import { CARD_RECIPE_GRADE_LABEL, type CardId, FIRE_LABEL, FIRE_PRESET_LABEL, GOOD_FIRE } from '../../sim/data/cards.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import type { CardSession, PlayRecord } from './store.ts';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function countNames(names: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) out[n] = (out[n] ?? 0) + 1;
  return out;
}

/** The record of a finished craft. */
export function buildRecord(session: CardSession): PlayRecord {
  const craft = session.craft;
  const outcome = cardCraftOutcome(craft);
  const tier = craft.recipe.materialTier;
  const name = (id: CardId) => cardName(id, tier);
  const plays = craft.log.flatMap((e) => (e.kind === 'play' ? [e] : []));
  const discarded = craft.log.flatMap((e) =>
    e.kind === 'reheat' ? e.discarded.map((u) => name(craft.cards[u] as CardId)) : [],
  );
  const msOf = new Map(session.turns.map((t) => [t.turn, t.ms]));
  const end = session.endedAtMs ?? session.startedAtMs;
  return {
    id: session.id,
    at: new Date(end).toISOString(),
    seed: craft.setup.seed,
    craftNo: craft.setup.craftNo,
    recipe: {
      weapon: WEAPON_LABEL[craft.recipe.weaponType],
      tier,
      material: materialName(tier),
      grade: CARD_RECIPE_GRADE_LABEL[craft.recipe.grade],
      boss: craft.recipe.bossMaterial === null ? null : UNIQUES[craft.recipe.bossMaterial].material,
    },
    settings: {
      hand: craft.smith.handSize,
      keep: craft.smith.keep,
      reheatCost: craft.rules.reheatCost,
      coolingIron: craft.rules.coolingIron,
      fire: FIRE_PRESET_LABEL[craft.rules.firePreset],
      durabilityDelta: craft.rules.durabilityDelta,
      fameStage: session.fameStage,
      anvil: craft.setup.tools.anvil,
      whetstone: craft.setup.tools.whetstone,
      furnace: craft.setup.tools.furnace,
      twoTap: session.tapToPreview || session.artScreen === true,
      ...(session.artScreen !== undefined ? { artScreen: session.artScreen } : {}),
    },
    deck: countNames(craft.setup.deck.map(name)),
    result: {
      status: craft.status === 'success' ? 'success' : 'failed',
      abandoned: craft.abandoned,
      tier: outcome.tier,
      tierName: outcome.tier === null ? null : QUALITY[outcome.tier].name,
      quality: craft.quality,
      qualityCap: craft.recipe.qualityCap,
      qualityPct: Math.floor(outcome.qualityRatio * 1000) / 10,
      progress: craft.progress,
      progressRequired: craft.recipe.progressRequired,
    },
    hands: craft.turn,
    cardsPlayed: outcome.cardsPlayed,
    cardsDiscarded: outcome.discarded,
    durabilityLeft: craft.durability,
    maxDurability: craft.maxDurability,
    played: countNames(plays.map((p) => name(p.card))),
    discarded: countNames(discarded),
    turns: cardTurnSummary(craft).map((t) => ({
      turn: t.turn,
      fire: FIRE_LABEL[t.fire],
      played: t.played.map(name),
      allowedLeft: t.allowedLeft,
      discarded: t.discarded,
      sec: round1((msOf.get(t.turn) ?? 0) / 1000),
    })),
    activeSec: round1(session.activeMs / 1000),
    wallSec: round1((end - session.startedAtMs) / 1000),
    pileOpens: session.pileOpens,
    cardInfoOpens: session.infoOpens,
  };
}

export interface RecordSummary {
  count: number;
  failures: number;
  /** Failures count as 0%, as in the engine's measurements. */
  avgQualityPct: number;
  medianQualityPct: number;
  /** Successes per star, ★1 first. */
  tiers: [number, number, number, number, number];
  avgHands: number;
  avgPlayed: number;
  avgDiscarded: number;
  avgActiveSec: number;
  /** Seconds per card played (기획서 가정: 4~5초). */
  secPerCard: number | null;
  /** Turns ended by 다시 달구기 with every card fire and 열기 allowed played ('다 내기', as the bots count). */
  fullPlayShare: number | null;
  /** Turns ended without playing a card. */
  emptyTurnShare: number | null;
  /** Turns whose fire was 좋음 or 최상 (16.3의 5번). */
  goodTurnShare: number | null;
  avgPileOpens: number;
  /**
   * Per card: times played and times thrown away at 다시 달구기, most often thrown away first
   * (16.3의 1·7번: 아쉬운 카드, 덱에서 빠지는 카드).
   */
  cardUse: { card: string; played: number; discarded: number }[];
}

const GOOD_FIRE_LABELS: readonly string[] = GOOD_FIRE.map((f) => FIRE_LABEL[f]);

function qualityOf(r: PlayRecord): number {
  return r.result.status === 'success' ? r.result.qualityPct : 0;
}

function avg(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function summarize(records: readonly PlayRecord[]): RecordSummary {
  const tiers: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of records) {
    const t = r.result.tier;
    if (r.result.status === 'success' && t !== null && t >= 1 && t <= 5) tiers[t - 1] = (tiers[t - 1] ?? 0) + 1;
  }
  const turns = records.flatMap((r) => r.turns ?? []);
  const reheated = turns.filter((t) => t.allowedLeft !== null);
  const use = new Map<string, { played: number; discarded: number }>();
  const add = (counts: Record<string, number> | undefined, key: 'played' | 'discarded'): void => {
    for (const [card, n] of Object.entries(counts ?? {})) {
      const u = use.get(card) ?? { played: 0, discarded: 0 };
      u[key] += n;
      use.set(card, u);
    }
  };
  for (const r of records) {
    add(r.played, 'played');
    add(r.discarded, 'discarded');
  }
  const played = records.reduce((a, r) => a + r.cardsPlayed, 0);
  const activeSec = records.reduce((a, r) => a + r.activeSec, 0);
  return {
    count: records.length,
    failures: records.filter((r) => r.result.status !== 'success').length,
    avgQualityPct: round1(avg(records.map(qualityOf))),
    medianQualityPct: round1(median(records.map(qualityOf))),
    tiers,
    avgHands: round1(avg(records.map((r) => r.hands))),
    avgPlayed: round1(avg(records.map((r) => r.cardsPlayed))),
    avgDiscarded: round1(avg(records.map((r) => r.cardsDiscarded))),
    avgActiveSec: round1(avg(records.map((r) => r.activeSec))),
    secPerCard: played > 0 ? round1(activeSec / played) : null,
    fullPlayShare: reheated.length > 0 ? round1((reheated.filter((t) => t.allowedLeft === 0).length / reheated.length) * 100) : null,
    emptyTurnShare: turns.length > 0 ? round1((turns.filter((t) => t.played.length === 0).length / turns.length) * 100) : null,
    goodTurnShare: turns.length > 0 ? round1((turns.filter((t) => GOOD_FIRE_LABELS.includes(t.fire)).length / turns.length) * 100) : null,
    avgPileOpens: round1(avg(records.map((r) => r.pileOpens))),
    cardUse: [...use.entries()]
      .map(([card, u]) => ({ card, ...u }))
      .sort((a, b) => b.discarded / (b.played + b.discarded) - a.discarded / (a.played + a.discarded) || b.discarded - a.discarded),
  };
}

/** What the craft was measured under, in one line ("기본 1구간 · 손패 5 · 달구기 −2"). */
export function settingsLabel(r: PlayRecord): string {
  const s = r.settings;
  const parts = [`${r.recipe.grade} ${r.recipe.tier}구간`, `손패 ${s.hand}${s.keep > 0 ? `·간직 ${s.keep}` : ''}`, `달구기 −${s.reheatCost}`];
  if (s.coolingIron) parts.push('식는 쇠');
  if (s.fire !== FIRE_PRESET_LABEL.default) parts.push(`화로 ${s.fire}`);
  const delta = s.durabilityDelta ?? 0;
  if (delta !== 0) parts.push(`내구도 ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`);
  if (s.anvil > 0 || s.whetstone > 0) parts.push(`모루 ${s.anvil}·숫돌 ${s.whetstone}`);
  if (s.fameStage > 1) parts.push(`명성 ${s.fameStage}`);
  // The art screen is the default; the plain table (one tap, unless its switch says two) is not one sample with it.
  if (s.artScreen === false) parts.push(s.twoTap ? '예전 화면·두 번 눌러' : '예전 화면');
  return parts.join(' · ');
}

/** Summaries per setting line, most played first. */
export function summarizeBySettings(records: readonly PlayRecord[]): { label: string; summary: RecordSummary }[] {
  const groups = new Map<string, PlayRecord[]>();
  for (const r of records) {
    const label = settingsLabel(r);
    const list = groups.get(label);
    if (list) list.push(r);
    else groups.set(label, [r]);
  }
  return [...groups.entries()]
    .map(([label, list]) => ({ label, summary: summarize(list) }))
    .sort((a, b) => b.summary.count - a.summary.count);
}

/** The play log as JSON to paste: one record per line so it stays readable. */
export function recordsJson(records: readonly PlayRecord[], exportedAtMs: number): string {
  const head = {
    exportedAt: new Date(exportedAtMs).toISOString(),
    note: '용사의 대장간 카드 제작 프로토타입 플레이 기록. 품질 평균은 실패를 0으로 센다.',
    summary: summarize(records),
    bySettings: summarizeBySettings(records),
  };
  const lines = records.map((r) => `  ${JSON.stringify(r)}`);
  const top = JSON.stringify(head, null, 1);
  return `${top.slice(0, -1).trimEnd()},\n "records": [\n${lines.join(',\n')}\n ]\n}`;
}
