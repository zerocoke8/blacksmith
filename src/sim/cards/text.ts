// Card text built from the card data, so the numbers on a card are the numbers the
// engine uses (CLAUDE.md 규칙 3). One or two short lines per card (4.2.9). The short form
// is for the card face in hand on a phone; the detail sheet shows the full one.

import {
  BUFFS,
  type BuffId,
  CARD_KIND_LABEL,
  type CardEffect,
  type CardId,
  type CardRequirement,
  CARDS,
  CHARGES,
  type ChargeId,
  type ImprintEffect,
  KEYWORD_HELP,
  KEYWORD_LABEL,
  REROLLS_PER_CRAFT,
} from '../data/cards.ts';
import { adamantPlus } from './recipe.ts';

export interface CardTextOptions {
  /** Fewer letters for the card face in hand: formulas without spaces, conditions cut down. */
  short?: boolean;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function turnsText(turns: number): string {
  if (turns <= 1) return '이번 턴';
  if (turns === 2) return '이번 턴과 다음 턴';
  return `이번 턴부터 ${turns}턴`;
}

function buffText(buff: BuffId, turns: number, short: boolean): string {
  const e = BUFFS[buff].effect;
  const when = turnsText(turns);
  if (e.kind === 'quality') return `${when}${turns <= 1 ? '만' : ''}, 품질 +${pct(e.bonus)}`;
  if (e.kind === 'progress') return `${when}, 공정 +${pct(e.bonus)}`;
  if (e.kind === 'thrift') {
    return short
      ? `${when}, 다른 카드 코스트 −${e.amount} (최소 1)`
      : `${when}, 코스트가 1 이상인 다른 카드는 −${e.amount} (최소 1)`;
  }
  return `${when}, 보통은 좋음이 된다`;
}

function chargeText(charge: ChargeId, turns: number): string {
  const c = CHARGES[charge];
  const gauge = c.gauge === 'progress' ? '공정' : '품질';
  const within = turns <= 1 ? '이번 턴' : `${turnsText(turns)} 안에서`;
  if (c.cards === 1) return `${within} 다음 ${gauge} 카드 1장 +${pct(c.bonus)}`;
  return `${turnsText(turns)}, ${gauge} 카드 ${c.cards}장 +${pct(c.bonus)}`;
}

function heatText(amount: number): string {
  return amount >= 0 ? `열기 +${amount}` : `열기 −${-amount}`;
}

/**
 * '+100% × (1 + 열기 × 0.2)', or the same as '+100% (열기당 +20%)' in the short form
 * (100% × (1 + 열기 × 0.2) = 100% + 20% per 열기).
 */
function heatFormula(ratio: number, heat: string, perHeat: number, short: boolean): string {
  return short ? `+${pct(ratio)} (${heat}당 +${pct(ratio * perHeat)})` : `+${pct(ratio)} × (1 + ${heat} × ${perHeat})`;
}

function effectText(e: CardEffect, plus: number, short: boolean): string {
  switch (e.type) {
    case 'progress':
      return `공정 +${pct(e.ratio + plus)}`;
    case 'quality':
      return `품질 +${pct(e.ratio + plus)}`;
    case 'heat':
      return heatText(e.amount);
    case 'finish':
      if (e.spend === 'all') return `열기를 모두 써서 품질 ${heatFormula(e.ratio, '열기', e.perHeat, short)}`;
      if (e.spend === 'half') {
        return short
          ? `열기 절반만 써서 품질 ${heatFormula(e.ratio, '쓴 열기', e.perHeat, true)}`
          : `열기 절반(내림)만 써서 품질 ${heatFormula(e.ratio, '쓴 열기', e.perHeat, false)}`;
      }
      return short
        ? `열기는 그대로 두고 품질 ${heatFormula(e.ratio, '열기', e.perHeat, true)}`
        : `열기를 쓰지 않고 마무리만큼 품질을 올린다 (열기는 그대로)`;
    case 'restore':
      if (short) return e.overMax ? `내구도 +${e.amount} (최대를 넘어도)` : `내구도 +${e.amount} (최대까지)`;
      return e.overMax ? `내구도 +${e.amount} (최대 내구도를 넘을 수 있다)` : `내구도 +${e.amount} (최대 내구도까지)`;
    case 'buff':
      return buffText(e.buff, e.turns, short);
    case 'charge':
      return chargeText(e.charge, e.turns);
    case 'draw':
      return `${e.count}장 뽑는다`;
    case 'drawNextTurn':
      return `다음 턴 ${e.count}장 더 뽑는다`;
    case 'nextCardDiscount':
      return `이번 턴 다음 카드 코스트 −${e.amount}`;
    case 'setFire':
      if (e.to === 'excellent') return '이번 턴 화로를 최상으로 바꾼다';
      return short ? '이번 턴 화로를 좋음으로 (최상은 그대로)' : '이번 턴 화로 상태를 좋음으로 바꾼다 (최상이면 그대로)';
    case 'reroll':
      return short
        ? `화로 상태를 다시 굴린다 (제작당 ${REROLLS_PER_CRAFT}번)`
        : `이번 턴 화로 상태를 다시 굴린다 (제작당 ${REROLLS_PER_CRAFT}번)`;
    case 'fillProgress':
      return '공정을 모두 채운다';
    case 'maintain':
      return short
        ? `다시 달구기 ${e.reheats}번은 깎지 않고 +${e.restore}`
        : `앞으로 ${e.reheats}번의 다시 달구기는 내구도를 깎지 않고 +${e.restore} 채운다`;
    case 'shellReheat':
      return short ? `다시 달구기가 ${e.cost}만 깎는다` : `이번 제작 동안 다시 달구기가 내구도를 ${e.cost}만 깎는다`;
    case 'recall':
      return short ? `버린 더미에서 ${e.count}장을 골라 손으로` : `버린 더미에서 카드 ${e.count}장을 골라 손으로 가져온다`;
    case 'endTurn':
      return '내면 이번 턴이 끝난다';
    case 'ifGoodFire':
      return `좋음·최상이면 ${effectsText(e.then, plus, short, '·')}, 아니면 ${effectsText(e.otherwise, plus, short, '·')}`;
  }
}

function effectsText(effects: readonly CardEffect[], plus: number, short: boolean, sep = ', '): string {
  return effects.map((e) => effectText(e, plus, short)).join(sep);
}

function requirementText(r: CardRequirement, short: boolean): string | null {
  if (r.type === 'heat') {
    // On the card face, '열기를 써서' already says 1 is needed; the foot line says '열기가 없다'.
    if (short) return r.min <= 1 ? null : `열기 ${r.min} 이상`;
    return r.min <= 1 ? `열기 ${r.min} 이상일 때` : `열기 ${r.min} 이상일 때만`;
  }
  if (r.type === 'progressLeft') return short ? `남은 공정 ${pct(r.share)} 이하` : `남은 공정이 ${pct(r.share)} 이하일 때만`;
  return null;
}

function imprintText(e: ImprintEffect): string {
  if (e.type === 'durability') return `레시피 내구도 +${e.amount}`;
  if (e.type === 'craftsmanship') return `작업 숙련도 +${pct(e.bonus)}`;
  if (e.type === 'control') return `가공 숙련도 +${pct(e.bonus)}`;
  return '다음 턴 화로 상태를 미리 본다';
}

/** '아다만 심 +2' for 아다만 심 at 7구간; other cards keep their name. */
export function cardName(id: CardId, materialTier = 1): string {
  const plus = id === 'adamantCore' ? adamantPlus(materialTier) : 0;
  return plus > 0 ? `${CARDS[id].name} +${Math.round(plus * 10)}` : CARDS[id].name;
}

/**
 * The card's text in the doc's order: keywords and conditions first, then effects, then 소멸.
 * `materialTier` only matters for 아다만 심 +n.
 */
export function cardText(id: CardId, materialTier = 1, opts: CardTextOptions = {}): string {
  const short = opts.short === true;
  const spec = CARDS[id];
  if (spec.imprint !== null) return `${KEYWORD_LABEL.imprint}. ${imprintText(spec.imprint)}`;
  const parts: string[] = [];
  if (spec.keywords.goodOnly === true) parts.push(KEYWORD_LABEL.goodOnly);
  if (spec.keywords.firstHand === true) parts.push(KEYWORD_LABEL.firstHand);
  if (spec.keywords.retain === true) parts.push(KEYWORD_LABEL.retain);
  for (const r of spec.requires) {
    const t = requirementText(r, short);
    if (t !== null) parts.push(t);
  }
  const plus = id === 'adamantCore' ? adamantPlus(materialTier) : 0;
  const body = effectsText(spec.effects, plus, short);
  const lines = [...parts, body];
  if (spec.keywords.exhaust === true) lines.push(KEYWORD_LABEL.exhaust);
  return lines.filter((l) => l.length > 0).join('. ');
}

/** '품질 · 3' style label for the card corner. 각인 has no cost. */
export function cardKindLabel(id: CardId): string {
  return CARD_KIND_LABEL[CARDS[id].kind];
}

/** The keywords on a card with what each means (4.2 키워드 표), for the detail sheet. */
export function cardKeywordHelp(id: CardId): { label: string; text: string }[] {
  const spec = CARDS[id];
  const k = spec.keywords;
  const out: { label: string; text: string }[] = [];
  if (spec.imprint !== null) out.push({ label: KEYWORD_LABEL.imprint, text: KEYWORD_HELP.imprint });
  if (k.goodOnly === true) out.push({ label: KEYWORD_LABEL.goodOnly, text: KEYWORD_HELP.goodOnly });
  if (k.firstHand === true) out.push({ label: KEYWORD_LABEL.firstHand, text: KEYWORD_HELP.firstHand });
  if (k.retain === true) out.push({ label: KEYWORD_LABEL.retain, text: KEYWORD_HELP.retain });
  if (k.exhaust === true) out.push({ label: KEYWORD_LABEL.exhaust, text: KEYWORD_HELP.exhaust });
  return out;
}
