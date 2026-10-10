// Enchant catalogue (기획서 4.5). Numbers are [튜닝] starting values.

import type { BodyType, EnchantId } from '../core/types.ts';

export type EnchantFamily = 'emblem' | 'feather' | 'shell' | 'soulDust' | 'crystal';

export const FAMILY_LABEL: Record<EnchantFamily, string> = {
  emblem: '마족 문장',
  feather: '칼깃',
  shell: '갑각 파편',
  soulDust: '영혼 가루',
  crystal: '원소 결정',
};

/** Which enemy body type drops each body-type family (crystal comes from the merchant). */
export const FAMILY_BODY: Record<Exclude<EnchantFamily, 'crystal'>, BodyType> = {
  emblem: 'humanoid',
  feather: 'flying',
  shell: 'armored',
  soulDust: 'spirit',
};

/**
 * How an enchant enters the tower calculation (기획서 4.5 '탑 계산' 열).
 * - attackMult: multiplies attack; affinity raises (m − 1) by 1.5x.
 * - critRateAdd: adds to crit rate; affinity 1.5x.
 * - critDamageAdd: adds to crit damage multiplier; affinity 1.5x.
 * - riskMult: multiplies injury/death chance; affinity raises (1 − m) by 1.5x.
 * - wearMult: multiplies weapon durability wear; affinity raises (1 − m) by 1.5x.
 * - badBodyMult: replaces the △ body multiplier (0.75); affinity raises the recovered gap by 1.5x.
 * - incomeAdd / giftChanceAdd: 풍요.
 * - elementAdvantageAdd: 속성 증폭.
 * - rule: no numeric affinity bonus.
 */
export type EnchantEffect =
  | { kind: 'attackMult'; value: number }
  | { kind: 'pursuit'; perCritRate: number }
  | { kind: 'critRateAdd'; value: number }
  | { kind: 'critDamageAdd'; value: number }
  | { kind: 'riskMult'; value: number }
  | { kind: 'wearMult'; value: number }
  | { kind: 'badBodyMult'; value: number }
  | { kind: 'bounty'; incomeAdd: number; giftChanceAdd: number }
  | { kind: 'elementAdvantageAdd'; value: number }
  | { kind: 'rule' };

export interface EnchantSpec {
  id: EnchantId;
  name: string;
  /** What the player sees in the 관전 띠. */
  flavor: string;
  family: EnchantFamily;
  upper: boolean;
  effect: EnchantEffect;
}

export const ENCHANTS: Record<EnchantId, EnchantSpec> = {
  element: {
    id: 'element',
    name: '속성 부여',
    flavor: '무기에 수·화·지·풍 중 하나를 입힌다',
    family: 'crystal',
    upper: false,
    effect: { kind: 'rule' },
  },
  elementBoost: {
    id: 'elementBoost',
    name: '속성 증폭',
    flavor: '속성이 유리한 적에게 더 세진다',
    family: 'crystal',
    upper: false,
    effect: { kind: 'elementAdvantageAdd', value: 0.3 },
  },
  combo: {
    id: 'combo',
    name: '연격',
    flavor: '4번째 공격마다 추가공격',
    family: 'emblem',
    upper: false,
    effect: { kind: 'attackMult', value: 1.12 },
  },
  firstStrike: {
    id: 'firstStrike',
    name: '선제',
    flavor: '층의 첫 공격이 3배',
    family: 'emblem',
    upper: false,
    effect: { kind: 'attackMult', value: 1.1 },
  },
  bounty: {
    id: 'bounty',
    name: '풍요',
    flavor: '쓰러뜨린 적에게서 전리품을 더 챙긴다',
    family: 'emblem',
    upper: false,
    effect: { kind: 'bounty', incomeAdd: 0.3, giftChanceAdd: 0.3 },
  },
  pursuit: {
    id: 'pursuit',
    name: '추격',
    flavor: '치명타 시 추가공격',
    family: 'feather',
    upper: false,
    effect: { kind: 'pursuit', perCritRate: 0.5 },
  },
  keen: {
    id: 'keen',
    name: '예리',
    flavor: '치명타가 잦아진다',
    family: 'feather',
    upper: false,
    effect: { kind: 'critRateAdd', value: 0.1 },
  },
  pierce: {
    id: 'pierce',
    name: '관통',
    flavor: '상대하기 나쁜 체형도 꿰뚫는다',
    family: 'shell',
    upper: false,
    effect: { kind: 'badBodyMult', value: 0.875 },
  },
  sturdy: {
    id: 'sturdy',
    name: '견고',
    flavor: '무기가 덜 닳는다',
    family: 'shell',
    upper: false,
    effect: { kind: 'wearMult', value: 0.7 },
  },
  firstAid: {
    id: 'firstAid',
    name: '응급 회복',
    flavor: 'HP 50% 이하일 때 한 번 크게 회복',
    family: 'soulDust',
    upper: false,
    effect: { kind: 'riskMult', value: 0.8 },
  },
  gale: {
    id: 'gale',
    name: '질풍',
    flavor: '3번째 공격마다 추가공격 2회',
    family: 'emblem',
    upper: true,
    effect: { kind: 'attackMult', value: 1.3 },
  },
  vital: {
    id: 'vital',
    name: '급소',
    flavor: '치명타 피해가 크게 오른다',
    family: 'feather',
    upper: true,
    effect: { kind: 'critDamageAdd', value: 1.0 },
  },
  indomitable: {
    id: 'indomitable',
    name: '불굴',
    flavor: '쓰러져도 한 번 일어나 귀환한다',
    family: 'soulDust',
    upper: true,
    effect: { kind: 'rule' },
  },
};

/** Enchants a family can attach (lower or upper grade material). */
export function enchantsOfFamily(family: EnchantFamily, upper: boolean): EnchantId[] {
  return Object.values(ENCHANTS)
    .filter((e) => e.family === family && e.upper === upper)
    .map((e) => e.id);
}
