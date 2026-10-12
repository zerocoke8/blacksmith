// 카드 제작 수치 (기획서 4.2, v0.7). Everything here is a [튜닝] starting value unless the
// doc says otherwise; change numbers here, not in src/sim/cards. Card text is built from
// these effects (cards/text.ts), so a number lives only here.

import type { UniqueId } from '../core/types.ts';

/** Craft state version for saves (4.2.8: 카드식 제작 상태는 버전 2). */
export const CARD_CRAFT_STATE_VERSION = 2;

/**
 * Random keys (4.2.8, 3.6): (seed, stream, craftNo, 'fire', turn[, reroll]) and
 * (seed, stream, craftNo, 'deck', shuffleNo). The idle world's crafts use 'craft'.
 */
export const CARD_STREAM = { craft: 'craft' } as const;
export const FIRE_KEY = 'fire';
export const DECK_KEY = 'deck';

// ---------- Smith (4.2.7) ----------

/** 작업·가공 숙련도 at 도구 0. A card's +100% is 100% of this. */
export const CARD_SMITH_BASE = { craftsmanship: 100, control: 100 } as const;

/** 모루 (작업 숙련도) and 숫돌 (가공 숙련도): ×1.04 per level, multiplied (4.2.7, 9.4). */
export const CARD_TOOL_STEP = { anvil: 1.04, whetstone: 1.04 } as const;

/** 화로 레벨 0~4 (4.2.7): hand size, cards kept at 다시 달구기, upgrade cost to reach it. */
export const FURNACE_LEVELS: readonly { hand: number; keep: number; cost: number }[] = [
  { hand: 5, keep: 0, cost: 0 },
  { hand: 5, keep: 1, cost: 1_000 },
  { hand: 6, keep: 1, cost: 6_000 },
  { hand: 6, keep: 2, cost: 36_000 },
  { hand: 7, keep: 2, cost: 216_000 },
];

// ---------- Turn rules (4.2) ----------

/** 다시 달구기: durability lost when a turn ends (화로와 관계없이 고정). */
export const REHEAT_COST = 2;

/** 열기 (4.2 계산): max stacks and quality per stack. 마무리's per-stack ratio is on the card. */
export const HEAT = { max: 10, qualityPerHeat: 0.1 } as const;

/** 불 다시 보기: rerolls per craft. */
export const REROLLS_PER_CRAFT = 3;

/**
 * '식는 쇠' [검증] (4.9): the n-th card of a turn costs this × (n − 1) more. Read as written,
 * it counts every card played that turn and adds to every card, 0-cost ones too (a second
 * 담금질 costs 1). Applied first, before 아껴 치기, '다음 카드 −1' and 단단함.
 */
export const COOLING_IRON_STEP = 1;

/**
 * Prototype switches for the [검증] questions (16.3). The defaults are the doc's rules.
 * - handSize: overrides the 화로 hand size (5/6/7) when set.
 * - reheatCost: durability lost per 다시 달구기 (0~3).
 * - coolingIron: '식는 쇠' on/off.
 * - firePreset: how often non-normal fire states come up.
 * - durabilityDelta: added to the recipe's 내구도 (16.2의 11번, and 식는 쇠 with a longer iron).
 */
export const DEFAULT_CARD_RULES = {
  handSize: null as number | null,
  reheatCost: REHEAT_COST,
  coolingIron: false,
  firePreset: 'default' as FirePreset,
  durabilityDelta: 0,
};
export const REHEAT_COST_RANGE = { min: 0, max: 3 } as const;
export const HAND_SIZE_RANGE = { min: 1, max: 10 } as const;
/** 레시피 내구도 ±n [검증]. The iron keeps at least 1 durability whatever the delta. */
export const DURABILITY_DELTA_RANGE = { min: -40, max: 40 } as const;

// ---------- Recipes (4.2.3) ----------

export type CardRecipeGrade = 'basic' | 'advanced' | 'legendary';

export const CARD_RECIPE_GRADE_LABEL: Record<CardRecipeGrade, string> = {
  basic: '기본',
  advanced: '고급',
  legendary: '전설',
};

/**
 * Recipe size is v0.6's (progress 390, quality cap 1,600, ×1.18 per band, grade sizes);
 * only durability moved to card-cost units. These copy src/sim/data/craft.ts RECIPE, which
 * goes away with the FF14 prototype (16.2의 10번).
 */
export const CARD_RECIPE = {
  progressBase: 390,
  qualityCapBase: 1600,
  progressGrowth: 1.18,
  qualityGrowth: 1.18,
  /** Bands from this one up are 고급. */
  advancedFromBand: 5,
  /** 레시피 내구도. 고급·전설 are unmeasured estimates (16.2의 11번). */
  durability: { basic: 28, advanced: 38, legendary: 70 } as Record<CardRecipeGrade, number>,
  gradeMult: {
    basic: { progress: 1, quality: 1 },
    advanced: { progress: 2, quality: 1.75 },
    legendary: { progress: 3, quality: 2.4 },
  } as Record<CardRecipeGrade, { progress: number; quality: number }>,
  /** 4구간 (the last 기본 band) is a bridge to 고급. */
  bridgeMult: { progress: 1.1, quality: 1.45 },
} as const;

// ---------- Fire states (4.2.3) ----------

/** Roll order matters: weights walk this list. Changing it changes how saved crafts replay. */
export const FIRE_STATES = [
  'normal', // 보통
  'good', // 좋음
  'excellent', // 최상
  'poor', // 식음
  'sturdy', // 단단함
  'surge', // 세찬 불
  'malleable', // 잘 펴짐
  'goodOmen', // 불티
] as const;
export type FireState = (typeof FIRE_STATES)[number];

export const FIRE_LABEL: Record<FireState, string> = {
  normal: '보통',
  good: '좋음',
  excellent: '최상',
  poor: '식음',
  sturdy: '단단함',
  surge: '세찬 불',
  malleable: '잘 펴짐',
  goodOmen: '불티',
};

export interface FireEffect {
  quality: number;
  progress: number;
  /** 단단함: card costs halved, rounded up. */
  halfCost: boolean;
  /** 세찬 불: cards drawn past the hand size at the start of the turn. */
  extraDraw: number;
}

const PLAIN_FIRE: FireEffect = { quality: 1, progress: 1, halfCost: false, extraDraw: 0 };

export const FIRE_EFFECT: Record<FireState, FireEffect> = {
  normal: PLAIN_FIRE,
  good: { ...PLAIN_FIRE, quality: 1.5 },
  excellent: { ...PLAIN_FIRE, quality: 3 },
  poor: { ...PLAIN_FIRE, quality: 0.5 },
  sturdy: { ...PLAIN_FIRE, halfCost: true },
  surge: { ...PLAIN_FIRE, extraDraw: 2 },
  malleable: { ...PLAIN_FIRE, progress: 1.5 },
  goodOmen: PLAIN_FIRE,
};

/** One-line hint under the fire badge. */
export const FIRE_HINT: Record<FireState, string> = {
  normal: '',
  good: '품질 ×1.5',
  excellent: '품질 ×3',
  poor: '품질 ×0.5',
  sturdy: '코스트 절반',
  surge: '2장 더 뽑는다',
  malleable: '공정 ×1.5',
  goodOmen: '다음 턴 좋음',
};

/** States where 좋음 전용 cards can be played. */
export const GOOD_FIRE: readonly FireState[] = ['good', 'excellent'];

/** The first turn is always 보통. */
export const FIRST_FIRE: FireState = 'normal';

/**
 * Forced next turn (4.2.3): 식음 after 최상 in 고급·전설, 좋음 after 불티. Decided from the
 * turn's last state (after rerolls and cards that change it).
 */
export const FORCED_NEXT_FIRE: Record<CardRecipeGrade, Partial<Record<FireState, FireState>>> = {
  basic: {},
  advanced: { excellent: 'poor' },
  legendary: { excellent: 'poor', goodOmen: 'good' },
};

/** Roll weights per grade, percent (4.2.3). 식음 has none: it only follows 최상. */
export const FIRE_WEIGHTS: Record<CardRecipeGrade, Partial<Record<FireState, number>>> = {
  basic: { normal: 87.25, good: 12, excellent: 0.75 },
  advanced: { normal: 62, good: 15, excellent: 1, sturdy: 11, surge: 11 },
  legendary: { normal: 47, good: 14, excellent: 1, sturdy: 9, surge: 9, malleable: 10, goodOmen: 10 },
};

/**
 * Fire presets for the [검증] switch. Each scales every non-normal weight; 보통 takes the rest.
 * 'allNormal' is for measuring the doc's '모두 보통' lines (4.2.1): every roll is 보통. It only
 * stops the rolls: cards that set the fire (용의 숨결, 순풍, 대장장이의 감) still change it.
 */
export const FIRE_PRESETS = ['default', 'calm', 'volatile', 'allNormal'] as const;
export type FirePreset = (typeof FIRE_PRESETS)[number];

export const FIRE_PRESET_LABEL: Record<FirePreset, string> = {
  default: '기본',
  calm: '잔잔함',
  volatile: '요동',
  allNormal: '모두 보통',
};

export const FIRE_PRESET_SCALE: Record<FirePreset, number> = {
  default: 1,
  calm: 0.5,
  volatile: 1.5,
  allNormal: 0,
};

// ---------- Cards (4.2.1, 4.2.2, 4.2.4, 4.2.5) ----------

export const BASIC_CARD_IDS = [
  'hammer', // 두드리기
  'polish', // 다듬기
  'precisePolish', // 정밀 다듬기
  'bellows', // 풀무질
  'quench', // 담금질
  'finisher', // 마무리
] as const;

export const UNLOCK_CARD_IDS = [
  'thrift', // 아껴 치기
  'carefulHammer', // 신중한 두드리기
  'firstHammer', // 첫 망치
  'keepForging', // 단조 유지
  'thickAnvil', // 두꺼운 모루판 (각인)
  'heatUp', // 달구기
  'bigStrike', // 크게 내려치기
  'trainedArm', // 단련된 팔 (각인)
  'lastStroke', // 최후의 한 수
  'firstTouch', // 첫 손질
  'allIn', // 혼신
  'kindle', // 불씨 살리기
  'reread', // 불 다시 보기
  'smithSense', // 대장장이의 감
  'deftHand', // 섬세한 손 (각인)
  'flameReading', // 불꽃 읽기 (각인)
] as const;

/** 갈래 예시 (4.2.5). A = 힘, B = 손놀림. The other 13 cards' branches are not designed yet. */
export const EVOLVED_CARD_IDS = [
  'heavyHammer', // 묵직한 두드리기
  'lightHammer', // 가벼운 두드리기
  'thoroughPolish', // 꼼꼼한 다듬기
  'quickPolish', // 날랜 다듬기
  'flameMatch', // 불꽃 맞추기
  'keenEye', // 눈썰미
  'strongBellows', // 센 풀무질
  'longBellows', // 긴 풀무질
  'deepQuench', // 깊은 담금질
  'sprinkle', // 물 뿌리기
  'grandFinish', // 큰 마무리
  'halfFinish', // 반 마무리
  'solidHammer', // 단단한 두드리기
  'carefulTouch', // 신중한 손길
  'firstFlame', // 첫 불꽃
  'firstBreath', // 첫 숨
  'fullForce', // 온 힘
  'evenForce', // 고른 힘
] as const;

/** 주재료 카드 (4.2.4). 6구간부터는 아다만 심 +(n−5). */
export const MATERIAL_CARD_IDS = [
  'ironMelt', // 쇳물 고르기 (철)
  'steelFold', // 강철 접기 (강철)
  'mithrilGrain', // 미스릴 결 (미스릴)
  'orichalcumGlow', // 오리할콘 빛 (오리할콘)
  'adamantCore', // 아다만 심 (아다만 이상)
] as const;

/** 대보스 재료 카드 (4.2.4). */
export const BOSS_CARD_IDS = [
  'dragonBreath', // 용의 숨결
  'rekindle', // 다시 피는 불
  'giantHammer', // 거인의 망치
  'layeredShell', // 겹친 갑피
  'stormBellows', // 폭풍 풀무
  'tailwind', // 순풍
  'deepWater', // 깊은 물 담금
  'frostFinish', // 서리 마무리
] as const;

export const CARD_IDS = [
  ...BASIC_CARD_IDS,
  ...UNLOCK_CARD_IDS,
  ...EVOLVED_CARD_IDS,
  ...MATERIAL_CARD_IDS,
  ...BOSS_CARD_IDS,
] as const;
export type CardId = (typeof CARD_IDS)[number];

/** 종류 (4.2.1 표). Material cards are their own kind. */
export type CardKind = 'progress' | 'quality' | 'support' | 'imprint' | 'material';

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  progress: '공정',
  quality: '품질',
  support: '보조',
  imprint: '각인',
  material: '재료',
};

export type CardGroup = 'basic' | 'unlock' | 'evolved' | 'material' | 'boss';

/** Timed buffs. 'turns' on the card: 1 = 이번 턴, 2 = 이번 턴과 다음 턴, 3 = 이번 턴부터 3턴. */
export const BUFF_IDS = [
  'bellows', // 풀무질
  'strongBellows', // 센 풀무질
  'longBellows', // 긴 풀무질
  'stormBellows', // 폭풍 풀무
  'heatUp', // 달구기
  'thrift', // 아껴 치기
  'tailwind', // 순풍
] as const;
export type BuffId = (typeof BUFF_IDS)[number];

export type BuffEffect =
  | { kind: 'quality'; bonus: number }
  | { kind: 'progress'; bonus: number }
  /** 코스트가 1 이상인 다른 카드는 −amount (최소 1). */
  | { kind: 'thrift'; amount: number }
  /** 보통은 좋음이 된다. */
  | { kind: 'tailwind' };

export const BUFFS: Record<BuffId, { name: string; effect: BuffEffect }> = {
  bellows: { name: '풀무질', effect: { kind: 'quality', bonus: 0.5 } },
  strongBellows: { name: '센 풀무질', effect: { kind: 'quality', bonus: 1.0 } },
  longBellows: { name: '긴 풀무질', effect: { kind: 'quality', bonus: 0.4 } },
  stormBellows: { name: '폭풍 풀무', effect: { kind: 'quality', bonus: 0.5 } },
  heatUp: { name: '달구기', effect: { kind: 'progress', bonus: 0.5 } },
  thrift: { name: '아껴 치기', effect: { kind: 'thrift', amount: 1 } },
  tailwind: { name: '순풍', effect: { kind: 'tailwind' } },
};

/** '다음 n장' bonuses: spent by the next card(s) that raise that gauge. */
export const CHARGE_IDS = [
  'firstHammer', // 첫 망치: 다음 공정 카드 1장
  'allIn', // 혼신: 다음 품질 카드 1장
  'fullForce', // 온 힘
  'evenForce', // 고른 힘: 품질 카드 2장
] as const;
export type ChargeId = (typeof CHARGE_IDS)[number];

export const CHARGES: Record<ChargeId, { name: string; gauge: 'progress' | 'quality'; bonus: number; cards: number }> = {
  firstHammer: { name: '첫 망치', gauge: 'progress', bonus: 1.0, cards: 1 },
  allIn: { name: '혼신', gauge: 'quality', bonus: 1.0, cards: 1 },
  fullForce: { name: '온 힘', gauge: 'quality', bonus: 1.5, cards: 1 },
  evenForce: { name: '고른 힘', gauge: 'quality', bonus: 0.6, cards: 2 },
};

/**
 * What a card does, in order. Quality gains always use the 열기 from before the card
 * (4.2: 열기 보정은 카드를 내기 직전의 열기로 잰다).
 */
export type CardEffect =
  | { type: 'progress'; ratio: number }
  | { type: 'quality'; ratio: number }
  | { type: 'heat'; amount: number }
  /**
   * 마무리 family: quality +ratio × (1 + 쓴 열기 × perHeat).
   * spend 'all' uses every 열기, 'half' uses ⌊열기/2⌋, 'none' uses the 열기 but keeps it.
   */
  | { type: 'finish'; ratio: number; perHeat: number; spend: 'all' | 'half' | 'none' }
  /** 내구도 +amount, up to the max unless overMax. Never lowers it. */
  | { type: 'restore'; amount: number; overMax: boolean }
  | { type: 'buff'; buff: BuffId; turns: number }
  | { type: 'charge'; charge: ChargeId; turns: number }
  | { type: 'draw'; count: number }
  | { type: 'drawNextTurn'; count: number }
  /** 이번 턴 다음 카드 코스트 −amount. */
  | { type: 'nextCardDiscount'; amount: number }
  | { type: 'setFire'; to: 'good' | 'excellent' }
  | { type: 'reroll' }
  | { type: 'fillProgress' }
  /** 단조 유지: the next `reheats` 다시 달구기 cost nothing and restore `restore`. */
  | { type: 'maintain'; reheats: number; restore: number }
  /** 겹친 갑피: 다시 달구기 costs at most `cost` for the rest of the craft. */
  | { type: 'shellReheat'; cost: number }
  /** 다시 피는 불: the player picks up to `count` cards from the 버린 더미 into the hand. */
  | { type: 'recall'; count: number }
  /** 깊은 담금질: the turn ends right after. */
  | { type: 'endTurn' }
  /** Branches on the fire state: 좋음·최상 → then, else → otherwise. */
  | { type: 'ifGoodFire'; then: CardEffect[]; otherwise: CardEffect[] };

/** Play conditions besides durability. */
export type CardRequirement =
  | { type: 'heat'; min: number }
  /** 남은 공정이 recipe 공정의 share 이하일 때만. */
  | { type: 'progressLeft'; share: number }
  | { type: 'rerollsLeft' }
  | { type: 'discardNotEmpty' };

/** 각인 effects: always on while the card is in the deck. */
export type ImprintEffect =
  | { type: 'durability'; amount: number }
  | { type: 'craftsmanship'; bonus: number }
  | { type: 'control'; bonus: number }
  | { type: 'foresight' };

export interface CardKeywords {
  /** 소멸: leaves the craft once played. */
  exhaust?: boolean;
  /** 첫 손: always in the first hand, only playable on turn 1, gone after it. */
  firstHand?: boolean;
  /** 간직: stays in hand when the turn ends. */
  retain?: boolean;
  /** 좋음 전용: only when the fire is 좋음 or 최상. */
  goodOnly?: boolean;
}

export interface UnlockNode {
  branch: 'hammer' | 'fingertip';
  /** Position in the branch (4.2.2 #). */
  index: number;
  /** 명성 단계 when it opens. */
  stage: number;
  /** The other card of a ↔ slot. */
  pair: CardId | null;
}

export interface CardSpec {
  id: CardId;
  name: string;
  kind: CardKind;
  group: CardGroup;
  /** null for 각인 (never in hand). */
  cost: number | null;
  keywords: CardKeywords;
  requires: CardRequirement[];
  effects: CardEffect[];
  imprint: ImprintEffect | null;
  /** 계열: the original card for an evolution, else the card itself (4.2.6). */
  family: CardId;
  /** 단련 횟수 (4.2.5); null if it cannot evolve. */
  temper: number | null;
  /** [A 힘, B 손놀림] (4.2.5); null if no branches yet. */
  evolutions: readonly [CardId, CardId] | null;
  unlock: UnlockNode | null;
}

type SpecInput = Omit<CardSpec, 'id' | 'keywords' | 'requires' | 'imprint' | 'family' | 'temper' | 'evolutions' | 'unlock'> &
  Partial<Pick<CardSpec, 'keywords' | 'requires' | 'imprint' | 'family' | 'temper' | 'evolutions' | 'unlock'>>;

/** 해금 카드 단련 횟수 (4.2.5); 각인은 넣고 마친 제작 수. */
export const UNLOCK_TEMPER = 15;

const q = (ratio: number): CardEffect => ({ type: 'quality', ratio });
const p = (ratio: number): CardEffect => ({ type: 'progress', ratio });
const heat = (amount: number): CardEffect => ({ type: 'heat', amount });

const SPECS: Record<CardId, SpecInput> = {
  // ----- 기본 카드 (4.2.1) -----
  hammer: {
    name: '두드리기',
    kind: 'progress',
    group: 'basic',
    cost: 3,
    effects: [p(1.0)],
    temper: 30,
    evolutions: ['heavyHammer', 'lightHammer'],
  },
  polish: {
    name: '다듬기',
    kind: 'quality',
    group: 'basic',
    cost: 3,
    effects: [q(1.0), heat(1)],
    temper: 30,
    evolutions: ['thoroughPolish', 'quickPolish'],
  },
  precisePolish: {
    name: '정밀 다듬기',
    kind: 'quality',
    group: 'basic',
    cost: 3,
    keywords: { goodOnly: true },
    effects: [q(1.5), heat(2)],
    temper: 10,
    evolutions: ['flameMatch', 'keenEye'],
  },
  bellows: {
    name: '풀무질',
    kind: 'support',
    group: 'basic',
    cost: 2,
    effects: [{ type: 'buff', buff: 'bellows', turns: 2 }],
    temper: 15,
    evolutions: ['strongBellows', 'longBellows'],
  },
  quench: {
    name: '담금질',
    kind: 'support',
    group: 'basic',
    cost: 0,
    keywords: { exhaust: true },
    effects: [{ type: 'restore', amount: 8, overMax: false }],
    temper: 10,
    evolutions: ['deepQuench', 'sprinkle'],
  },
  finisher: {
    name: '마무리',
    kind: 'quality',
    group: 'basic',
    cost: 3,
    requires: [{ type: 'heat', min: 1 }],
    effects: [{ type: 'finish', ratio: 1.0, perHeat: 0.2, spend: 'all' }],
    temper: 15,
    evolutions: ['grandFinish', 'halfFinish'],
  },

  // ----- 해금 카드: 망치 (4.2.2) -----
  thrift: {
    name: '아껴 치기',
    kind: 'support',
    group: 'unlock',
    cost: 1,
    effects: [{ type: 'buff', buff: 'thrift', turns: 2 }],
    unlock: { branch: 'hammer', index: 1, stage: 1, pair: null },
  },
  carefulHammer: {
    name: '신중한 두드리기',
    kind: 'progress',
    group: 'unlock',
    cost: 4,
    effects: [p(1.5)],
    evolutions: ['solidHammer', 'carefulTouch'],
    unlock: { branch: 'hammer', index: 2, stage: 1, pair: null },
  },
  firstHammer: {
    name: '첫 망치',
    kind: 'progress',
    group: 'unlock',
    cost: 4,
    keywords: { firstHand: true },
    effects: [p(3.0), { type: 'charge', charge: 'firstHammer', turns: 2 }],
    unlock: { branch: 'hammer', index: 3, stage: 2, pair: null },
  },
  keepForging: {
    name: '단조 유지',
    kind: 'support',
    group: 'unlock',
    cost: 5,
    keywords: { exhaust: true },
    // '+2 채운다' fills up to the 최대 내구도 and no further (like 담금질's '최대 내구도까지').
    effects: [{ type: 'maintain', reheats: 4, restore: 2 }],
    unlock: { branch: 'hammer', index: 4, stage: 3, pair: 'thickAnvil' },
  },
  thickAnvil: {
    name: '두꺼운 모루판',
    kind: 'imprint',
    group: 'unlock',
    cost: null,
    effects: [],
    imprint: { type: 'durability', amount: 5 },
    unlock: { branch: 'hammer', index: 4, stage: 3, pair: 'keepForging' },
  },
  heatUp: {
    name: '달구기',
    kind: 'support',
    group: 'unlock',
    cost: 2,
    effects: [{ type: 'buff', buff: 'heatUp', turns: 2 }],
    unlock: { branch: 'hammer', index: 5, stage: 3, pair: 'bigStrike' },
  },
  bigStrike: {
    name: '크게 내려치기',
    kind: 'progress',
    group: 'unlock',
    cost: 7,
    effects: [p(3.0)],
    unlock: { branch: 'hammer', index: 5, stage: 3, pair: 'heatUp' },
  },
  trainedArm: {
    name: '단련된 팔',
    kind: 'imprint',
    group: 'unlock',
    cost: null,
    effects: [],
    imprint: { type: 'craftsmanship', bonus: 0.1 },
    unlock: { branch: 'hammer', index: 6, stage: 4, pair: null },
  },
  lastStroke: {
    name: '최후의 한 수',
    kind: 'progress',
    group: 'unlock',
    cost: 2,
    keywords: { retain: true },
    requires: [{ type: 'progressLeft', share: 0.3 }],
    effects: [{ type: 'fillProgress' }],
    unlock: { branch: 'hammer', index: 7, stage: 5, pair: null },
  },

  // ----- 해금 카드: 손끝 (4.2.2) -----
  firstTouch: {
    name: '첫 손질',
    kind: 'quality',
    group: 'unlock',
    cost: 3,
    keywords: { firstHand: true },
    effects: [q(1.5), heat(2)],
    evolutions: ['firstFlame', 'firstBreath'],
    unlock: { branch: 'fingertip', index: 1, stage: 1, pair: null },
  },
  allIn: {
    name: '혼신',
    kind: 'support',
    group: 'unlock',
    cost: 2,
    effects: [{ type: 'charge', charge: 'allIn', turns: 2 }],
    evolutions: ['fullForce', 'evenForce'],
    unlock: { branch: 'fingertip', index: 2, stage: 3, pair: null },
  },
  kindle: {
    name: '불씨 살리기',
    kind: 'support',
    group: 'unlock',
    cost: 0,
    keywords: { goodOnly: true },
    effects: [{ type: 'draw', count: 2 }],
    unlock: { branch: 'fingertip', index: 3, stage: 4, pair: null },
  },
  reread: {
    name: '불 다시 보기',
    kind: 'support',
    group: 'unlock',
    cost: 1,
    requires: [{ type: 'rerollsLeft' }],
    effects: [{ type: 'reroll' }],
    unlock: { branch: 'fingertip', index: 4, stage: 4, pair: 'smithSense' },
  },
  smithSense: {
    name: '대장장이의 감',
    kind: 'support',
    group: 'unlock',
    cost: 2,
    keywords: { exhaust: true },
    effects: [{ type: 'setFire', to: 'good' }],
    unlock: { branch: 'fingertip', index: 4, stage: 4, pair: 'reread' },
  },
  deftHand: {
    name: '섬세한 손',
    kind: 'imprint',
    group: 'unlock',
    cost: null,
    effects: [],
    imprint: { type: 'control', bonus: 0.1 },
    unlock: { branch: 'fingertip', index: 5, stage: 5, pair: null },
  },
  flameReading: {
    name: '불꽃 읽기',
    kind: 'imprint',
    group: 'unlock',
    cost: null,
    effects: [],
    imprint: { type: 'foresight' },
    unlock: { branch: 'fingertip', index: 6, stage: 6, pair: null },
  },

  // ----- 진화 카드 (4.2.5 갈래 예시) -----
  heavyHammer: { name: '묵직한 두드리기', kind: 'progress', group: 'evolved', cost: 5, effects: [p(2.0)], family: 'hammer' },
  lightHammer: {
    name: '가벼운 두드리기',
    kind: 'progress',
    group: 'evolved',
    cost: 2,
    keywords: { retain: true },
    effects: [p(0.7)],
    family: 'hammer',
  },
  thoroughPolish: {
    name: '꼼꼼한 다듬기',
    kind: 'quality',
    group: 'evolved',
    cost: 3,
    effects: [q(0.8), heat(2)],
    family: 'polish',
  },
  quickPolish: {
    name: '날랜 다듬기',
    kind: 'quality',
    group: 'evolved',
    cost: 2,
    effects: [q(0.7), heat(1), { type: 'draw', count: 1 }],
    family: 'polish',
  },
  flameMatch: {
    name: '불꽃 맞추기',
    kind: 'quality',
    group: 'evolved',
    cost: 3,
    keywords: { goodOnly: true },
    effects: [q(2.2), heat(2)],
    family: 'precisePolish',
  },
  keenEye: {
    name: '눈썰미',
    kind: 'quality',
    group: 'evolved',
    cost: 3,
    effects: [{ type: 'ifGoodFire', then: [q(1.5), heat(2)], otherwise: [q(0.6), heat(1)] }],
    family: 'precisePolish',
  },
  strongBellows: {
    name: '센 풀무질',
    kind: 'support',
    group: 'evolved',
    cost: 2,
    effects: [{ type: 'buff', buff: 'strongBellows', turns: 1 }],
    family: 'bellows',
  },
  longBellows: {
    name: '긴 풀무질',
    kind: 'support',
    group: 'evolved',
    cost: 2,
    effects: [{ type: 'buff', buff: 'longBellows', turns: 3 }],
    family: 'bellows',
  },
  deepQuench: {
    name: '깊은 담금질',
    kind: 'support',
    group: 'evolved',
    cost: 0,
    keywords: { exhaust: true },
    effects: [{ type: 'restore', amount: 14, overMax: false }, { type: 'endTurn' }],
    family: 'quench',
  },
  sprinkle: {
    name: '물 뿌리기',
    kind: 'support',
    group: 'evolved',
    cost: 0,
    effects: [{ type: 'restore', amount: 4, overMax: false }, heat(-1)],
    family: 'quench',
  },
  grandFinish: {
    name: '큰 마무리',
    kind: 'quality',
    group: 'evolved',
    cost: 4,
    requires: [{ type: 'heat', min: 5 }],
    effects: [{ type: 'finish', ratio: 1.0, perHeat: 0.3, spend: 'all' }],
    family: 'finisher',
  },
  halfFinish: {
    name: '반 마무리',
    kind: 'quality',
    group: 'evolved',
    cost: 2,
    // Like 마무리, it needs 열기 1. Its 열기 보정 (1 + 열기 × 0.1) uses the whole 열기 before the
    // card (4.2 계산: 마무리는 열기 보정도 받는다, 내기 직전의 열기로 잰다); only the ×(1 + 쓴 열기 × 0.2)
    // part uses the half it spends.
    requires: [{ type: 'heat', min: 1 }],
    effects: [{ type: 'finish', ratio: 1.0, perHeat: 0.2, spend: 'half' }],
    family: 'finisher',
  },
  solidHammer: {
    name: '단단한 두드리기',
    kind: 'progress',
    group: 'evolved',
    cost: 5,
    effects: [p(2.0), { type: 'nextCardDiscount', amount: 1 }],
    family: 'carefulHammer',
  },
  carefulTouch: {
    name: '신중한 손길',
    kind: 'progress',
    group: 'evolved',
    cost: 4,
    effects: [p(1.0), q(0.6), heat(1)],
    family: 'carefulHammer',
  },
  firstFlame: {
    name: '첫 불꽃',
    kind: 'quality',
    group: 'evolved',
    cost: 3,
    keywords: { firstHand: true },
    effects: [q(1.2), heat(3)],
    family: 'firstTouch',
  },
  firstBreath: {
    name: '첫 숨',
    kind: 'quality',
    group: 'evolved',
    cost: 3,
    keywords: { firstHand: true },
    effects: [q(1.5), heat(2), { type: 'drawNextTurn', count: 1 }],
    family: 'firstTouch',
  },
  fullForce: {
    name: '온 힘',
    kind: 'support',
    group: 'evolved',
    cost: 2,
    effects: [{ type: 'charge', charge: 'fullForce', turns: 1 }],
    family: 'allIn',
  },
  evenForce: {
    name: '고른 힘',
    kind: 'support',
    group: 'evolved',
    cost: 2,
    effects: [{ type: 'charge', charge: 'evenForce', turns: 2 }],
    family: 'allIn',
  },

  // ----- 주재료 카드 (4.2.4). 모두 소멸 -----
  ironMelt: {
    name: '쇳물 고르기',
    kind: 'material',
    group: 'material',
    cost: 2,
    keywords: { exhaust: true },
    effects: [p(0.5), q(0.5), heat(1)],
  },
  steelFold: {
    name: '강철 접기',
    kind: 'material',
    group: 'material',
    cost: 2,
    keywords: { exhaust: true },
    effects: [p(0.8), { type: 'nextCardDiscount', amount: 1 }],
  },
  mithrilGrain: {
    name: '미스릴 결',
    kind: 'material',
    group: 'material',
    cost: 2,
    keywords: { exhaust: true },
    effects: [q(0.8), heat(2)],
  },
  orichalcumGlow: {
    name: '오리할콘 빛',
    kind: 'material',
    group: 'material',
    cost: 2,
    keywords: { exhaust: true },
    effects: [{ type: 'ifGoodFire', then: [q(2.0), heat(2)], otherwise: [q(0.6), heat(1)] }],
  },
  adamantCore: {
    name: '아다만 심',
    kind: 'material',
    group: 'material',
    cost: 4,
    keywords: { exhaust: true },
    // 6구간부터 공정·품질 비율에 ADAMANT_PLUS가 더해진다.
    effects: [p(1.5), q(1.0), heat(1)],
  },

  // ----- 대보스 재료 카드 (4.2.4). 모두 소멸 -----
  dragonBreath: {
    name: '용의 숨결',
    kind: 'material',
    group: 'boss',
    cost: 6,
    keywords: { exhaust: true },
    effects: [{ type: 'setFire', to: 'excellent' }],
  },
  rekindle: {
    name: '다시 피는 불',
    kind: 'material',
    group: 'boss',
    cost: 5,
    keywords: { exhaust: true },
    // Not in the doc: with an empty 버린 더미 it would only spend 5 durability and a 대보스 card,
    // so it cannot be played then ("버린 더미가 비었다").
    requires: [{ type: 'discardNotEmpty' }],
    effects: [{ type: 'recall', count: 3 }],
  },
  giantHammer: {
    name: '거인의 망치',
    kind: 'material',
    group: 'boss',
    cost: 7,
    keywords: { exhaust: true },
    effects: [p(4.0), heat(2)],
  },
  layeredShell: {
    name: '겹친 갑피',
    kind: 'material',
    group: 'boss',
    cost: 5,
    keywords: { exhaust: true },
    effects: [{ type: 'shellReheat', cost: 1 }],
  },
  stormBellows: {
    name: '폭풍 풀무',
    kind: 'material',
    group: 'boss',
    cost: 5,
    keywords: { exhaust: true },
    effects: [{ type: 'draw', count: 3 }, { type: 'buff', buff: 'stormBellows', turns: 1 }],
  },
  tailwind: {
    name: '순풍',
    kind: 'material',
    group: 'boss',
    cost: 5,
    keywords: { exhaust: true },
    effects: [{ type: 'buff', buff: 'tailwind', turns: 2 }],
  },
  deepWater: {
    name: '깊은 물 담금',
    kind: 'material',
    group: 'boss',
    cost: 4,
    keywords: { exhaust: true },
    effects: [{ type: 'restore', amount: 20, overMax: true }, heat(2)],
  },
  frostFinish: {
    name: '서리 마무리',
    kind: 'material',
    group: 'boss',
    cost: 6,
    keywords: { exhaust: true },
    effects: [{ type: 'finish', ratio: 1.0, perHeat: 0.2, spend: 'none' }],
  },
};

function buildSpecs(): Record<CardId, CardSpec> {
  const out = {} as Record<CardId, CardSpec>;
  for (const id of CARD_IDS) {
    const s = SPECS[id];
    const temper = s.temper ?? (s.group === 'unlock' ? UNLOCK_TEMPER : null);
    out[id] = {
      id,
      name: s.name,
      kind: s.kind,
      group: s.group,
      cost: s.cost,
      keywords: s.keywords ?? {},
      requires: s.requires ?? [],
      effects: s.effects,
      imprint: s.imprint ?? null,
      family: s.family ?? id,
      // Only cards with branches can be tempered toward an evolution.
      temper: s.evolutions ? temper : null,
      evolutions: s.evolutions ?? null,
      unlock: s.unlock ?? null,
    };
  }
  return out;
}

export const CARDS: Record<CardId, CardSpec> = buildSpecs();

/** Keyword names as the player sees them (4.2 키워드). */
export const KEYWORD_LABEL = {
  exhaust: '소멸',
  firstHand: '첫 손',
  retain: '간직',
  imprint: '각인',
  goodOnly: '좋음 전용',
} as const;

/** What each keyword means, as the 4.2 keyword table says it (card detail sheet). */
export const KEYWORD_HELP: Record<keyof typeof KEYWORD_LABEL, string> = {
  exhaust: '내면 이번 제작에서 빠진다',
  firstHand: '첫 손패에 반드시 들어온다. 첫 턴에만 낼 수 있고, 첫 턴이 지나면 소멸한다',
  retain: '턴이 끝나도 버리지 않고 손에 남는다',
  imprint: '손패에 오지 않는다. 덱에 넣어 두면 제작 내내 효과가 있다',
  goodOnly: '화로가 좋음·최상일 때만 낼 수 있다',
};

// ---------- Material cards (4.2.4) ----------

/** Cards each main or 대보스 material shuffles in. */
export const MATERIAL_CARD_COPIES = 2;

/** Main-material card per band; bands past the list use the last card. */
export const MAIN_MATERIAL_CARD: readonly CardId[] = ['ironMelt', 'steelFold', 'mithrilGrain', 'orichalcumGlow', 'adamantCore'];

/** 아다만 심 +(n−5): +10%p to its 공정·품질 비율 per band past 아다만, at most +100%p. */
export const ADAMANT_PLUS = { fromBand: 6, perBand: 0.1, max: 1.0 } as const;

export const BOSS_MATERIAL_CARD: Record<UniqueId, CardId> = {
  dragonFury: 'dragonBreath', // 화룡의 심장
  rebirth: 'rekindle', // 불사조의 꼬리깃
  earthBlessing: 'giantHammer', // 거인의 핵
  allPierce: 'layeredShell', // 여왕의 갑피
  dash: 'stormBellows', // 폭풍 깃
  fairWind: 'tailwind', // 정령왕의 숨결
  tidalWave: 'deepWater', // 심해룡의 비늘
  iceArmor: 'frostFinish', // 서리 왕관 조각
};

// ---------- Decks (4.2.1, 4.2.6) ----------

/** 1일차 덱 (10장). The first craft adds 2 쇳물 고르기 for 12. */
export const DAY_ONE_DECK: readonly (readonly [CardId, number])[] = [
  ['hammer', 3],
  ['polish', 3],
  ['precisePolish', 1],
  ['bellows', 1],
  ['quench', 1],
  ['finisher', 1],
];

export const DECK_RULES = {
  /** Cards that come to hand. 각인과 재료 카드는 세지 않는다. */
  minCards: 10,
  maxCards: 20,
  /** 같은 계열 장수 (원래 카드 + 진화 카드). */
  familyLimit: { basic: 4, unlock: 2, firstHandOrImprint: 1 },
} as const;

/**
 * 덱의 해금 카드 수 상한 = 스킬판 상한 (9.2): 3 at 명성 단계 1 … 9 at 7, then +1 per ★ stage
 * (stage 8 = ★1), at most 12.
 */
export const UNLOCK_CAP = { byStage: [3, 4, 5, 6, 7, 8, 9], perStarStage: 1, max: 12 } as const;

/** 진화 1장 = 기준가 × 2^(명성 단계 − 1) (4.2.5). */
export const EVOLVE_BASE_COST = { basic: 300, unlock: 600 } as const;
export const EVOLVE_COST_STEP = 2;

// ---------- Dwarf lines (4.2.9). 1.1 톤, 한두 줄 ----------

export const DWARF_LINES = {
  firstCraft: '"쇠는 식기 전에 두드린다. 식으면 다시 달구고."',
  firstReheat: '"달굴 때마다 쇠가 조금씩 닳는다. 서두를 것도, 미룰 것도 없다."',
  excellent: '"…불이 노래를 하는군."',
  masterpiece: '"이 녀석은 오래 가겠어."',
  failure: '"쇠가 갈라졌다. 오늘은 여기까지다."',
  temperOpen: '"손에 익었군. 이제 다르게 쳐 볼 때다."',
} as const;

// ---------- Enchant materials (4.3, 4.5) ----------

/** 하급·상급 체형 계열 재료 (4.5). */
export const ENCHANT_MATERIAL_GRADE_LABEL = { low: '하급', high: '상급' } as const;
