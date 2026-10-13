// 용사 목록의 카드 값 (기획서 5.9): what each card shows, and the list's tabs, sorting and filters.
// Pure: the screen draws what these return.

import type { Element, WeaponType } from '../../sim/core/types.ts';
import { ELEMENTS, WEAPON_TYPES } from '../../sim/core/types.ts';
import {
  EVOLUTION_COLORS,
  type EvolutionColor,
  type HeroKey,
  type HeroRarity,
  type HeroRole,
  HERO_ROLES,
  HEROES,
  heroSpec,
  STAR_MARKS,
  type StarMark,
} from '../../sim/data/heroes.ts';
import { type HeroRoster, passiveOpen, signatureLevel, type StarStep, starStepOf } from '../../sim/hero/index.ts';

export interface HeroCardView {
  key: HeroKey;
  name: string;
  rarity: HeroRarity;
  special: boolean;
  element: Element;
  weapon: WeaponType;
  role: HeroRole;
  owned: boolean;
  copies: number;
  /** The star row (5.5): the mark and 1~5 of it. An unowned hero shows the first step, dimmed. */
  mark: StarMark;
  pips: number;
  /** The bar under the card: copies toward the next step ('4/5', '4/13'). */
  have: number;
  need: number;
  ratio: number;
  barText: string;
  atMax: boolean;
  /** 카드 바탕색 = 진화 색 (5.6, 5.9). */
  color: EvolutionColor;
  passiveOpen: boolean;
  signature: 'open' | 'strong' | null;
  /** Star index (sorting). */
  starIndex: number;
}

const ORDER = new Map<string, number>(HEROES.map((h, i) => [h.key, i]));

export function heroCardView(roster: HeroRoster, key: HeroKey): HeroCardView {
  const spec = heroSpec(key);
  const copies = roster[key] ?? 0;
  const owned = copies >= 1;
  const step: StarStep = starStepOf(spec.rarity, Math.max(1, copies));
  const have = owned ? step.have : 0;
  return {
    key,
    name: spec.name,
    rarity: spec.rarity,
    special: spec.rarity === 'special',
    element: spec.element,
    weapon: spec.weapon,
    role: spec.role,
    owned,
    copies,
    mark: step.mark,
    pips: step.pips,
    have,
    need: step.need,
    ratio: step.atMax && owned ? 1 : have / step.need,
    barText: step.atMax && owned ? '끝' : `${have}/${step.need}`,
    atMax: owned && step.atMax,
    color: step.color,
    passiveOpen: passiveOpen(spec.rarity, step.color),
    signature: signatureLevel(spec.rarity, step.color),
    starIndex: owned ? step.index : -1,
  };
}

/** 분류 탭 (5.9 추천: 전체·특급·일반). */
export const HERO_TABS = ['all', 'special', 'normal'] as const;
export type HeroTab = (typeof HERO_TABS)[number];
export const HERO_TAB_LABEL: Record<HeroTab, string> = { all: '전체', special: '특급', normal: '일반' };

/** 정렬 (5.9): 별, 진화 색, 속성, 무기 종류, 역할. */
export const HERO_SORTS = ['star', 'color', 'element', 'weapon', 'role'] as const;
export type HeroSort = (typeof HERO_SORTS)[number];
export const HERO_SORT_LABEL: Record<HeroSort, string> = { star: '별', color: '진화 색', element: '속성', weapon: '무기', role: '역할' };

/** 거르기 (5.9): 속성, 무기 종류, 역할 — null = any. */
export interface HeroFilter {
  element: Element | null;
  weapon: WeaponType | null;
  role: HeroRole | null;
}

export const NO_FILTER: HeroFilter = { element: null, weapon: null, role: null };

export function filterCount(f: HeroFilter): number {
  return (f.element !== null ? 1 : 0) + (f.weapon !== null ? 1 : 0) + (f.role !== null ? 1 : 0);
}

const rank = <T>(list: readonly T[], v: T) => list.indexOf(v);

/**
 * The list: owned heroes first, then (dimmed) the rest; within each, by the sort (stronger first for
 * 별 and 진화 색), then specials first, then the roster's order.
 */
export function heroList(roster: HeroRoster, opts: { tab: HeroTab; sort: HeroSort; filter: HeroFilter }): HeroCardView[] {
  const cards = HEROES.map((h) => heroCardView(roster, h.key)).filter((c) => {
    if (opts.tab === 'special' && !c.special) return false;
    if (opts.tab === 'normal' && c.special) return false;
    const f = opts.filter;
    if (f.element !== null && c.element !== f.element) return false;
    if (f.weapon !== null && c.weapon !== f.weapon) return false;
    if (f.role !== null && c.role !== f.role) return false;
    return true;
  });
  const by = (c: HeroCardView): number => {
    switch (opts.sort) {
      case 'star':
        return -c.starIndex;
      case 'color':
        return -rank(EVOLUTION_COLORS, c.color) * 100 - c.starIndex;
      case 'element':
        return rank(ELEMENTS, c.element);
      case 'weapon':
        return rank(WEAPON_TYPES, c.weapon);
      case 'role':
        return rank(HERO_ROLES, c.role);
    }
  };
  return cards.sort(
    (a, b) =>
      Number(b.owned) - Number(a.owned) ||
      by(a) - by(b) ||
      Number(b.special) - Number(a.special) ||
      (ORDER.get(a.key) ?? 0) - (ORDER.get(b.key) ?? 0),
  );
}

/** The star row's icon key per mark (src/assets/art/icons/star_<mark>.webp). */
export function starIconKey(mark: StarMark): string {
  return `star_${mark}`;
}

export { STAR_MARKS };
