// What the craft screen shows (기획서 4.2.9), read from the state. The screen only draws
// these; it never works a rule out itself (CLAUDE.md 규칙 2).

import {
  BUFF_IDS,
  BUFFS,
  type CardId,
  type CardKind,
  CARD_KIND_LABEL,
  CARDS,
  CHARGE_IDS,
  CHARGES,
  COOLING_IRON_STEP,
  DEFAULT_CARD_RULES,
  FIRE_PRESET_LABEL,
} from '../data/cards.ts';
import { type CardCraftState, cardIdOf, checkPlay } from './engine.ts';
import type { CardRules } from './smith.ts';
import { cardName, cardText } from './text.ts';

export interface HandCardView {
  uid: string;
  card: CardId;
  name: string;
  kind: CardKind;
  kindLabel: string;
  /** Cost right now (after 아껴 치기, 단단함, 식는 쇠 …), and the printed cost. */
  cost: number;
  baseCost: number;
  text: string;
  /** The same in fewer letters, for the card face in hand (the detail sheet shows `text`). */
  shortText: string;
  /** Why it is greyed out ("좋음·최상일 때만", "열기가 없다", "내구도가 모자라다"), or null. */
  block: string | null;
  /** "이 한 방으로 완성" (also when it is 막타). */
  finishes: boolean;
  /** Playing it breaks the iron: ask first. */
  breaks: boolean;
  /** 간직: stays in hand when the turn ends. */
  retained: boolean;
}

export function handView(state: CardCraftState): HandCardView[] {
  return state.hand.map((uid) => {
    const card = cardIdOf(state, uid);
    const spec = CARDS[card];
    const check = state.status === 'active' ? checkPlay(state, uid) : ({ ok: false, cost: 0, reason: '제작이 끝났다' } as const);
    return {
      uid,
      card,
      name: cardName(card, state.recipe.materialTier),
      kind: spec.kind,
      kindLabel: CARD_KIND_LABEL[spec.kind],
      cost: check.cost,
      baseCost: spec.cost ?? 0,
      text: cardText(card, state.recipe.materialTier),
      shortText: cardText(card, state.recipe.materialTier, { short: true }),
      block: check.ok ? null : check.reason,
      finishes: check.ok && check.finishes,
      breaks: check.ok && check.breaks,
      retained: spec.keywords.retain === true,
    };
  });
}

/** Short lines for what is on right now: "풀무질 1턴", "혼신 1장", "단조 유지 3번", "식는 쇠 · 다음 카드 +1" … */
export function activeEffects(state: CardCraftState): string[] {
  const out: string[] = [];
  if (state.rules.coolingIron) {
    // 식는 쇠 is a [검증] switch: say it is on, or rising costs look like a bug.
    const more = COOLING_IRON_STEP * state.playedThisTurn;
    out.push(more > 0 ? `식는 쇠 · 다음 카드 +${more}` : '식는 쇠');
  }
  for (const id of BUFF_IDS) {
    const turns = state.buffs[id];
    if (turns !== undefined && turns > 0) out.push(`${BUFFS[id].name} ${turns}턴`);
  }
  for (const id of CHARGE_IDS) {
    const c = state.charges[id];
    if (c !== undefined) out.push(`${CHARGES[id].name} ${c.left}장`);
  }
  if (state.nextCardDiscount > 0) out.push(`다음 카드 −${state.nextCardDiscount}`);
  if (state.maintainReheats > 0) out.push(`단조 유지 ${state.maintainReheats}번`);
  if (state.shellReheatCost !== null) out.push(`다시 달구기 −${state.shellReheatCost}`);
  if (state.extraDrawNextTurn > 0) out.push(`다음 턴 ${state.extraDrawNextTurn}장 더`);
  return out;
}

/**
 * The [검증] switches that differ from the doc's rules, in a few words each ("손패 6",
 * "다시 달구기 −1", "식는 쇠", "화로 요동", "내구도 +10"). Empty for the doc's rules.
 */
export function cardRuleNotes(rules: CardRules): string[] {
  const out: string[] = [];
  const d = DEFAULT_CARD_RULES;
  if (rules.handSize !== d.handSize && rules.handSize !== null) out.push(`손패 ${rules.handSize}`);
  if (rules.reheatCost !== d.reheatCost) out.push(rules.reheatCost === 0 ? '다시 달구기 0' : `다시 달구기 −${rules.reheatCost}`);
  if (rules.coolingIron !== d.coolingIron) out.push('식는 쇠');
  if (rules.firePreset !== d.firePreset) out.push(`화로 ${FIRE_PRESET_LABEL[rules.firePreset]}`);
  if (rules.durabilityDelta !== d.durabilityDelta) {
    out.push(`내구도 ${rules.durabilityDelta > 0 ? '+' : '−'}${Math.abs(rules.durabilityDelta)}`);
  }
  return out;
}

/** Card counts for the piles line ("뽑을 4 · 버린 7 · 소멸 3"). */
export function pileCounts(state: CardCraftState): { draw: number; discard: number; exhausted: number } {
  return { draw: state.drawPile.length, discard: state.discard.length, exhausted: state.exhausted.length };
}
