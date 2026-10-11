// Read-only looks the run screens put next to a decision: how the held (or a planned) weapon meets
// a floor, and what a 단조 of a recipe would do to the next wall. Every number comes from the
// engine's own functions (7장 tower calculation via sim/run floorOdds); nothing here changes a run.

import { ELEMENTS, type Element, type QualityTier, type Weapon } from '../../sim/core/types.ts';
import { BEATS } from '../../sim/data/common.ts';
import { FINAL_CLIMB_START } from '../../sim/data/run.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import {
  CLIMB_PREVIEW_FLOORS,
  climbOdds,
  type ExpeditionForecast,
  type ForgePlan,
  floorOdds,
  masteryFloor,
  nextWall,
  plannedWeapon,
  profileOf,
  type RunState,
  seasonFloor,
} from '../../sim/run/index.ts';
import { bodyFactor, elementFactor, masteryOf, weaponAttack } from '../../sim/world/combat.ts';
import { fitMark } from './text.ts';

export interface FloorFit {
  /** 체형 배율 (◎ ×1.3, ○ ×1, △ ×0.75 or what 관통 makes of it). */
  body: number;
  bodyMark: string;
  /** 속성 배율 (유리 ×1.3, 같음·불리 ×0.75, 무속성 ×1). */
  element: number;
  elementMark: string;
}

/** How a weapon meets a floor's body and element (7.5, 7.6), as the tower calculation sees it. */
export function floorFit(s: RunState, floor: number, weapon: Weapon = s.weapon.weapon): FloorFit {
  const info = seasonFloor(s.setup.season, floor);
  const profile = profileOf(s, weapon);
  const body = bodyFactor(profile, info.body);
  const element = elementFactor(profile, info.element);
  return { body, bodyMark: fitMark(body), element, elementMark: fitMark(element) };
}

/** The element that beats a floor's element (원소 결정을 넣을 때 고를 것). */
export function beatingElement(s: RunState, floor: number): Element {
  const target = seasonFloor(s.setup.season, floor).element;
  return ELEMENTS.find((e) => BEATS[e] === target) ?? 'water';
}

/** The quality the plain preview assumes: 역작, '무난히 치면' (13.8 판 숙련도 표의 기준). */
export const PREVIEW_QUALITY = 3;
/** The ★ the matched preview shows side by side: what the card table can make of the recipe. */
export const PREVIEW_TIERS = [3, 4, 5] as const satisfies readonly QualityTier[];
export type PreviewTier = (typeof PREVIEW_TIERS)[number];

export interface ForgeLook {
  /** What the numbers are against: the next wall's boss, or (after the 악마) the 마지막 등반's first floors. */
  target: { kind: 'wall'; floor: number } | { kind: 'climb'; first: number; last: number };
  /** The held weapon there. */
  now: number;
  /** ★3 무속성 (slots empty). */
  plain: number;
  /** The element that beats the target band, and the weapon with it at ★3 / ★4 / ★5. */
  element: Element;
  matched: Record<PreviewTier, number>;
  /** 전설: the ★5 (걸작) weapon carries the season's 고유능력; asleep before 달인 (4.7). */
  unique: { name: string; asleep: boolean } | null;
  /** 공격력 at ★3 / ★5 and of the held weapon (after the 악마 the attack is what is left to weigh). */
  attack: { now: number; low: number; high: number };
}

/**
 * A planned weapon of this recipe at today's level (no 정비 버프 unless held): against the next
 * wall's boss, or after the 악마 the mean of the 마지막 등반's first floors (sim/run climbOdds). The
 * slots are left empty; the 완성 화면 shows them.
 */
export function forgeLook(s: RunState, plan: ForgePlan): ForgeLook {
  const wall = nextWall(s);
  const odds = (w: Weapon): number => (wall === null ? climbOdds(s, w) : floorOdds(s, wall.floor, { weapon: w }).chance);
  const targetFloor = wall?.floor ?? FINAL_CLIMB_START;
  const element = beatingElement(s, targetFloor);
  const matched = {} as Record<PreviewTier, number>;
  for (const q of PREVIEW_TIERS) matched[q] = odds(plannedWeapon(s, plan, q, element));
  const top = plannedWeapon(s, plan, 5, element);
  return {
    target: wall === null ? { kind: 'climb', first: FINAL_CLIMB_START, last: FINAL_CLIMB_START + CLIMB_PREVIEW_FLOORS - 1 } : { kind: 'wall', floor: wall.floor },
    now: odds(s.weapon.weapon),
    plain: odds(plannedWeapon(s, plan, PREVIEW_QUALITY, null)),
    element,
    matched,
    unique: top.unique === null ? null : { name: UNIQUES[top.unique].name, asleep: masteryOf(masteryFloor(s)) !== 'master' },
    attack: {
      now: weaponAttack(s.weapon.weapon),
      low: weaponAttack(plannedWeapon(s, plan, PREVIEW_QUALITY, null)),
      high: weaponAttack(top),
    },
  };
}

/**
 * The hardest floor an expedition would enter (lowest 돌파 확률), or null. Like the forecast, each
 * floor is judged as if the ones before it were climbed (레벨이 오르는 만큼).
 */
export function hardestFloor(s: RunState, f: ExpeditionForecast): { floor: number; chance: number } | null {
  let worst: { floor: number; chance: number } | null = null;
  for (let floor = f.startFloor; floor < f.startFloor + Math.max(1, f.floors); floor++) {
    const chance = floorOdds(s, floor, { cumulativeFloors: s.cumulativeFloors + (floor - f.startFloor) }).chance;
    if (worst === null || chance < worst.chance) worst = { floor, chance };
  }
  return worst;
}
