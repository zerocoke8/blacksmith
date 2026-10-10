// Player-facing lines for the card craft screens (기획서 1.1: short, warm, a little lonely).
// Numbers on cards come from the engine (sim/cards/text.ts); this file only words results.

import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import {
  type CardCraftOutcome,
  type CardCraftState,
  type CardLogEntry,
  cardName,
  cardRuleNotes,
} from '../../sim/cards/index.ts';
import { materialName, QUALITY, WEAPON_LABEL } from '../../sim/data/common.ts';
import { type CardId, DWARF_LINES, FIRE_HINT, FIRE_LABEL } from '../../sim/data/cards.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { rulesOf } from './flow.ts';
import type { LabSettings } from './store.ts';

const TIER_LINE: Record<QualityTier, string> = {
  1: '쓸 만은 하다. 쓸 만은.',
  2: '나쁘지 않군. 누군가의 첫 무기쯤은 되겠어.',
  3: '손에 잘 붙는다. 오래 버텨 줄 거다.',
  4: '좋은 쇠였다. 주인을 잘 만나야 할 텐데.',
  5: DWARF_LINES.masterpiece,
};

/** Picks the particle by the last syllable's final consonant: josa('갑피', '이', '가') → '갑피가'. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

export function stars(tier: QualityTier): string {
  return '★'.repeat(tier) + '☆'.repeat(5 - tier);
}

export function tierName(tier: QualityTier): string {
  return QUALITY[tier].name;
}

export function weaponTitle(type: WeaponType, materialTier: number): string {
  return `${materialName(materialTier)} ${WEAPON_LABEL[type]}`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0';
}

/** 71.56… → '71.5%' (floored, so a gauge one short of a mark never reads as on it). */
export function percent(ratio: number): string {
  return `${Math.floor(ratio * 1000) / 10}%`;
}

/** 87.25 → '87.25%', 12 → '12%'. */
export function chance(pct: number): string {
  return `${Math.round(pct * 100) / 100}%`;
}

/** 65_200 ms → '1분 05초', 9_800 → '9.8초'. */
export function duration(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  if (sec < 60) return `${Math.round(sec * 10) / 10}초`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}

/** One or two lines for the result screen. */
export function outcomeLines(outcome: CardCraftOutcome): string[] {
  const lines: string[] = [];
  if (outcome.success && outcome.tier !== null) lines.push(TIER_LINE[outcome.tier]);
  else if (outcome.abandoned) lines.push('망치를 내려놓았다. 식은 쇠는 돌아오지 않는다.');
  else lines.push(DWARF_LINES.failure);
  if (outcome.boss) {
    const u = UNIQUES[outcome.boss.unique];
    if (outcome.boss.fate === 'used') lines.push(`${josa(u.material, '이', '가')} 쇠에 스며들었다. ${josa(u.name, '이', '가')} 깃든다.`);
    else if (outcome.boss.fate === 'returned') lines.push(`${josa(u.material, '은', '는')} 다음을 위해 남겨 둔다.`);
    else lines.push(`${u.material}도 함께 재가 되었다.`);
  }
  return lines;
}

/** [검증] switches that differ from the doc's rules, for the start button's footnote. */
export function labNote(lab: LabSettings): string[] {
  return cardRuleNotes(rulesOf(lab));
}

/** The short rule list behind the '?' button (4.2 규칙, 4.2.9). */
export const RULE_LINES: readonly string[] = [
  '공정이 다 차면 그 자리에서 완성이다. 품질이 별을 정한다.',
  '카드를 내면 코스트만큼 내구도가 깎인다. 내구도는 쇳덩이의 수명이다.',
  '공정을 다 채우는 카드는 내구도가 모자라도 낼 수 있다 (막타).',
  '턴을 끝내면 남은 손패를 버리고 다시 달군다. 내구도가 깎인다.',
  '품질 카드는 열기를 쌓고, 마무리가 열기를 터뜨린다. 열기는 턴이 바뀌어도 식지 않는다.',
  `화로 상태는 매 턴 바뀐다. 좋음이면 ${FIRE_HINT.good}, 최상이면 ${FIRE_HINT.excellent}.`,
  '뽑을 더미를 누르면 남은 카드를 볼 수 있다. 순서는 모른다.',
  '카드를 길게 누르면 설명과 미리 보기가 나온다.',
];

function cardLabel(state: CardCraftState, id: CardId): string {
  return cardName(id, state.recipe.materialTier);
}

function names(state: CardCraftState, uids: readonly string[]): string {
  return uids.map((u) => cardLabel(state, state.cards[u] as CardId)).join(', ');
}

/** One turn-log line, or null for entries the screen skips. */
export function logLine(state: CardCraftState, e: CardLogEntry): string | null {
  switch (e.kind) {
    case 'turn':
      return `${e.turn}턴 · ${FIRE_LABEL[e.fire]} · ${e.drawn.length}장 뽑음`;
    case 'play': {
      const parts: string[] = [];
      if (e.progress !== 0) parts.push(`공정 ${signed(e.progress)}`);
      if (e.quality !== 0) parts.push(`품질 ${signed(e.quality)}`);
      if (e.heat !== 0) parts.push(`열기 ${signed(e.heat)}`);
      if (e.durability !== 0) parts.push(`내구 ${signed(e.durability)}`);
      return `${cardLabel(state, e.card)}${parts.length > 0 ? ` — ${parts.join(' · ')}` : ''}`;
    }
    case 'draw':
      return e.drawn.length > 0 ? `${e.drawn.length}장 더 뽑음 (${names(state, e.drawn)})` : '더 뽑을 카드가 없다';
    case 'fire':
      return `${cardLabel(state, e.cause)} — 화로 ${FIRE_LABEL[e.from]} → ${FIRE_LABEL[e.to]}`;
    case 'shuffle':
      return '버린 더미를 섞어 뽑을 더미로';
    case 'reheat': {
      const parts = [`다시 달구기 — 내구 ${signed(e.durability)}`];
      if (e.discarded.length > 0) parts.push(`버림 ${e.discarded.length}장`);
      if (e.kept.length > 0) parts.push(`남김 ${e.kept.length}장`);
      return parts.join(' · ');
    }
    case 'end':
      if (e.status === 'success') return '완성';
      return e.abandoned ? '망치를 내려놓았다' : '쇠가 갈라졌다';
  }
}
