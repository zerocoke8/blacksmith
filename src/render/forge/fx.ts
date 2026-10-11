// What the forge scene shows for a step of the craft (CLAUDE.md 규칙 2: the screen only shows
// what the engine already did). Everything is read from the engine's log between two states:
// which gauges moved and by how much, fire changes, the reheat, the end. Only a card whose
// result moved no gauge (풀무질, 혼신, 아껴 치기 …) picks its motion from its printed effects.
// Pure: no PixiJS, no DOM, so it is tested in Node.

import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import type { CardCraftState } from '../../sim/cards/engine.ts';
import { qualityTierFor } from '../../sim/data/common.ts';
import { type BuffId, type CardEffect, type CardId, CARDS, type CardSpec, type FireState } from '../../sim/data/cards.ts';
import { FX_MAX_MOTIONS } from './layout.ts';

/** How the dwarf works the iron for a card. */
export type Motion =
  /** 공정: raise → strike, sparks, shake, white flash. */
  | 'strike'
  /** 품질: careful work, silver sparkles. */
  | 'polish'
  /** 마무리 (열기를 쓰는 품질): golden flash, long sparkle line. */
  | 'finish'
  /** 열기 (풀무질·달구기, 열기만 오르는 카드): bellows pump, the fire flares. */
  | 'bellows'
  /** 담금질·물: steam over the iron. */
  | 'quench'
  /** 재료 카드: the metal's colour seeps into the iron. */
  | 'infuse'
  /** 화로 상태를 바꾼 카드: the fire flares and the badge turns. */
  | 'fire'
  /** 그 밖의 보조: a short glow on the dwarf. */
  | 'focus';

/** Gauge values after a step; the screen's bars follow these while effects play. */
export interface GaugeSnap {
  progress: number;
  quality: number;
  heat: number;
  durability: number;
  fire: FireState;
  tier: QualityTier;
}

export interface PlayFx {
  kind: 'play';
  uid: string;
  card: CardId;
  cost: number;
  /** One or two motions; the first is the main one. */
  motions: Motion[];
  /** The material card whose metal tints the iron, or null. */
  material: CardId | null;
  /** A 대보스 material: the bigger version. */
  legendary: boolean;
  /** The card changed the fire to this, or null. */
  fireTo: FireState | null;
  /** Cards the card drew. */
  drew: number;
  /** Net changes as the engine logged them; restored = 내구도 given back (net + cost). */
  gain: { progress: number; quality: number; heat: number; durability: number; restored: number };
  /** The ★ mark this card reached, or null. */
  tierUp: QualityTier | null;
  /** Where the card went: 소멸 or the 버린 더미. */
  to: 'discard' | 'exhaust';
  snap: GaugeSnap;
}

export type FxStep =
  | PlayFx
  /** Start of a craft with 각인 in the deck: runes on the anvil. */
  | { kind: 'imprint'; cards: CardId[]; snap: GaugeSnap }
  /** 다시 달구기: the iron goes into the fire; the hand is thrown away. */
  | { kind: 'reheat'; durability: number; discarded: string[]; kept: string[]; exhausted: string[]; snap: GaugeSnap }
  /** A new turn: the fire shows its state, cards are drawn. */
  | { kind: 'turn'; turn: number; fire: FireState; fireChanged: boolean; drawn: string[]; snap: GaugeSnap }
  | { kind: 'shuffle'; snap: GaugeSnap }
  /** 완성: the iron becomes the weapon. */
  | { kind: 'complete'; tier: QualityTier; legendary: boolean; weaponType: WeaponType; snap: GaugeSnap }
  /** 쇠가 갈라졌다, or the hammer was put down. */
  | { kind: 'break'; abandoned: boolean; snap: GaugeSnap };

export type FxKind = FxStep['kind'];

function tierOf(quality: number, cap: number): QualityTier {
  return qualityTierFor(cap > 0 ? Math.min(1, quality / cap) : 0);
}

/** The gauges as the state has them. */
export function snapOf(state: CardCraftState): GaugeSnap {
  return {
    progress: state.progress,
    quality: state.quality,
    heat: state.heat,
    durability: state.durability,
    fire: state.fire,
    tier: tierOf(state.quality, state.recipe.qualityCap),
  };
}

/** Same craft (seed, stream, craft number) and `after` continues `before`'s log. */
export function sameCraft(before: CardCraftState, after: CardCraftState): boolean {
  return (
    before.setup.seed === after.setup.seed &&
    before.setup.stream === after.setup.stream &&
    before.setup.craftNo === after.setup.craftNo &&
    after.log.length >= before.log.length
  );
}

/**
 * Buffs that come from working the fire (풀무질 and its kin, 달구기): a card that only starts one
 * pumps the bellows, and while one is on the furnace burns harder. Picked by what the card does
 * in the smithy, not by the buff's effect (sim/data/cards.ts BUFFS counts 풀무 as a quality
 * bonus). A new 풀무 card's buff goes here too.
 */
export const FIRE_BUFFS: readonly BuffId[] = ['bellows', 'strongBellows', 'longBellows', 'stormBellows', 'heatUp'];
const HEAT_BUFFS: ReadonlySet<BuffId> = new Set(FIRE_BUFFS);

/** Motion read from the printed effects, for a card whose result moved no gauge. */
function printedMotion(effects: readonly CardEffect[]): Motion | null {
  for (const e of effects) {
    switch (e.type) {
      case 'finish':
        return 'finish';
      case 'progress':
      case 'fillProgress':
        return 'strike';
      case 'quality':
        return 'polish';
      case 'restore':
        return 'quench';
      case 'heat':
        if (e.amount > 0) return 'bellows';
        break;
      case 'buff':
        if (HEAT_BUFFS.has(e.buff)) return 'bellows';
        break;
      case 'setFire':
      case 'reroll':
        return 'fire';
      case 'ifGoodFire': {
        const m = printedMotion(e.then);
        if (m !== null) return m;
        break;
      }
      default:
        break;
    }
  }
  return null;
}

function motionsOf(
  spec: CardSpec,
  gain: { progress: number; quality: number; heat: number; restored: number },
  fireTo: FireState | null,
): Motion[] {
  const out: Motion[] = [];
  const add = (m: Motion) => {
    if (!out.includes(m)) out.push(m);
  };
  if (spec.kind === 'material') add('infuse');
  if (gain.progress > 0) add('strike');
  // 마무리 spends 열기 for its quality; other quality cards keep or raise it.
  if (gain.quality > 0) add(gain.heat < 0 ? 'finish' : 'polish');
  if (gain.restored > 0) add('quench');
  if (gain.heat > 0 && gain.quality <= 0) add('bellows');
  if (fireTo !== null) add('fire');
  if (out.length === 0) add(printedMotion(spec.effects) ?? 'focus');
  return out.slice(0, FX_MAX_MOTIONS);
}

/**
 * The scene steps between two states of one craft: every log entry `after` added, in order,
 * each with the gauges as they stand after it. The last step's gauges equal `after`'s. Empty
 * when `after` is not a continuation of `before` (another craft, a reload).
 */
export function effectsForPlay(before: CardCraftState, after: CardCraftState): FxStep[] {
  if (!sameCraft(before, after)) return [];
  const cap = after.recipe.qualityCap;
  let snap = snapOf(before);
  const steps: FxStep[] = [];
  let fireTo: FireState | null = null;
  let drew = 0;
  for (const e of after.log.slice(before.log.length)) {
    switch (e.kind) {
      case 'fire':
        // Logged by the card while it resolves, before its 'play' entry.
        fireTo = e.to;
        snap = { ...snap, fire: e.to };
        break;
      case 'draw':
        drew += e.drawn.length;
        break;
      case 'shuffle':
        steps.push({ kind: 'shuffle', snap });
        break;
      case 'play': {
        const spec = CARDS[e.card];
        const restored = Math.max(0, e.durability + e.cost);
        const gain = { progress: e.progress, quality: e.quality, heat: e.heat, durability: e.durability, restored };
        const prevTier = snap.tier;
        const quality = snap.quality + e.quality;
        const tier = tierOf(quality, cap);
        snap = {
          ...snap,
          progress: snap.progress + e.progress,
          quality,
          heat: snap.heat + e.heat,
          durability: snap.durability + e.durability,
          tier,
        };
        steps.push({
          kind: 'play',
          uid: e.uid,
          card: e.card,
          cost: e.cost,
          motions: motionsOf(spec, gain, fireTo),
          material: spec.kind === 'material' ? e.card : null,
          legendary: spec.group === 'boss',
          fireTo,
          drew,
          gain,
          tierUp: tier > prevTier ? tier : null,
          to: after.exhausted.includes(e.uid) ? 'exhaust' : 'discard',
          snap,
        });
        fireTo = null;
        drew = 0;
        break;
      }
      case 'reheat':
        snap = { ...snap, durability: snap.durability + e.durability };
        steps.push({ kind: 'reheat', durability: e.durability, discarded: e.discarded, kept: e.kept, exhausted: e.exhausted, snap });
        break;
      case 'turn': {
        const fireChanged = e.fire !== snap.fire;
        snap = { ...snap, fire: e.fire };
        steps.push({ kind: 'turn', turn: e.turn, fire: e.fire, fireChanged, drawn: e.drawn, snap });
        break;
      }
      case 'end':
        if (e.status === 'success') {
          steps.push({
            kind: 'complete',
            tier: snap.tier,
            legendary: after.recipe.grade === 'legendary',
            weaponType: after.recipe.weaponType,
            snap,
          });
        } else {
          steps.push({ kind: 'break', abandoned: e.abandoned, snap });
        }
        break;
    }
  }
  return steps;
}

/** The opening of a fresh craft: runes rise if 각인 are in the deck. Empty otherwise. */
export function effectsForStart(state: CardCraftState): FxStep[] {
  const fresh = state.status === 'active' && state.turn === 1 && state.playedThisTurn === 0 && state.log.length === 1;
  if (!fresh || state.imprints.length === 0) return [];
  return [{ kind: 'imprint', cards: [...state.imprints], snap: snapOf(state) }];
}
