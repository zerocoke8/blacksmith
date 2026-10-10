// Crafting puzzle numbers (기획서 4.2, 4.3, 9.3, 9.4). Everything here is a
// [튜닝] starting value; change numbers here, not in src/sim/craft.

import type { EnchantFamily } from './enchants.ts';

/** Random stream name for craft conditions: rngFor(worldSeed, CRAFT_STREAM, craftNo) (3.6). */
export const CRAFT_STREAM = 'craft';

// ---------- Smith (4.2, 9.3, 9.4) ----------

/**
 * Starting smith stats. Progress per 100% efficiency = craftsmanship,
 * quality per 100% efficiency = control (both in recipe points).
 */
export const BASE_SMITH = { craftsmanship: 100, control: 100, cp: 100 } as const;

/**
 * Tool facilities (9.4): 모루·숫돌 multiply, ×1.04 per level. Recipes grow ×1.18 per band
 * (RECIPE below); with materials ×2.5 and tool costs ×1.25 per band a shop buys about
 * log 2.5 / log 1.25 ≈ 4.1 levels per band, and 1.04^4.1 ≈ 1.175 keeps pace. Adding
 * instead would fall behind forever.
 */
export const TOOL_BONUS = {
  anvil: { perLevel: 0.04 }, // 모루: 작업 숙련도
  whetstone: { perLevel: 0.04 }, // 숫돌: 가공 숙련도
} as const;

/**
 * 화로 (9.4): whole CP added to the base, +1 per level up to level 20, then +1 every 2 levels.
 * Action CP costs do not grow with bands, so CP does not chase the recipes. It sets how long
 * a craft runs and how much quality it buys (once 열기 is up, about one more 다듬기 per
 * 10 CP plus its durability), so it grows slowly:
 * - The old +3 per level made CP 160 at 1주 and 265 at 3달: basic actions alone reached
 *   100% at 5구간·도구 20, and every 고급 craft was a sure 걸작.
 * - +2 per level gave 108 at 도구 4. There the stage-1 board (첫 손질) at band 1 can end on
 *   신중한 두드리기 and fit one more touch, and its best all-보통 line is a 걸작; at +1 per
 *   level it stays under 걸작 through 도구 6 (at 7 three hammers already finish band 1).
 * Pace points (10장): 110 at 3일차 (도구 10), 120 at 1주 (20), 127 at 1달 (35), 137 at 3달 (55).
 */
export const FURNACE = {
  /** CP per level for the first `fastLevels` levels. */
  fastCp: 1,
  fastLevels: 20,
  /** After that, +1 CP every this many levels. */
  slowLevelsPerCp: 2,
} as const;

export const TOOL_LABEL = { anvil: '모루', whetstone: '숫돌', furnace: '화로' } as const;

/** Skill-board passives (9.3). */
export const PASSIVE_BONUS = {
  trainedArm: 0.1, // 단련된 팔: 작업 숙련도 +10%
  deftHand: 0.1, // 섬세한 손: 가공 숙련도 +10%
  thickAnvil: 15, // 두꺼운 모루판: 레시피 내구도 +15
} as const;

// ---------- Recipes (4.2.3) ----------

export type RecipeGrade = 'basic' | 'advanced' | 'legendary';

export const RECIPE_GRADE_LABEL: Record<RecipeGrade, string> = {
  basic: '기본',
  advanced: '고급',
  legendary: '전설',
};

export const RECIPE = {
  /**
   * Band 1 progress: 4 basic hammers at starting craftsmanship (4.2.1), 3 fall short.
   * A little under 400 so a shop just behind the tool pace (2구간 at 모루 4 = 117) still
   * finishes in 4; at exactly 400 one point short meant a 5th hammer and a ★2.
   */
  progressBase: 390,
  /**
   * Band 1 quality cap. The 4.2.1 example flow at all-normal makes 903 (56%, ★3).
   * With basic actions, a player who re-plans every turn (craft/play.test.ts) makes
   * ★4 ~16%, ★5 ~2~3% (1,000 crafts, two seeds); the 4.2.1 player ★4 7%, ★5 1%.
   */
  qualityCapBase: 1600,
  /** Growth per main-material band (약 15~20%); 모루·숫돌 keep pace (TOOL_BONUS). */
  progressGrowth: 1.18,
  qualityGrowth: 1.18,
  /** Bands from this one up are 고급. */
  advancedFromBand: 5,
  /**
   * Durability is the one resource a recipe brings (CP is the smith's), so it sets the
   * length: a bigger progress gauge alone is eaten in a few turns by 첫 망치 and
   * 크게 내려치기. 전설 at 80 left the best all-보통 line at 17 turns; 150 makes it 21~24.
   * Real play adds the turns 단단함·부드러움·좋음 pay for: at 160 a player who re-plans
   * every turn averaged 25.3 turns on the first 전설 (1주), past 4.2's 최대 25턴; 150 gives 24.
   */
  durability: { basic: 60, advanced: 70, legendary: 150 } as Record<RecipeGrade, number>,
  /**
   * Size per grade, on top of the band scaling (4.2.3). Without it a 고급 recipe was a
   * 기본 one with 10 more durability, and the skill board made it shorter and easier than
   * band 1 (100% with basic actions at 5구간·도구 20). With these, the best all-보통 line on
   * the strongest legal board is ★3~★4 at every pace point: 고급 15~20 turns, 전설 20~25.
   * craft/balance.test.ts checks every pace point; craft/play.test.ts the real 전설 length.
   */
  gradeMult: {
    basic: { progress: 1, quality: 1 },
    advanced: { progress: 2, quality: 1.75 },
    legendary: { progress: 3, quality: 2.4 },
  } as Record<RecipeGrade, { progress: number; quality: number }>,
  /**
   * The last 기본 band (4구간) is a bridge to 고급: this size instead of 기본's ×1 (still 기본
   * conditions and durability). It is the shop's top band from 3일차 to 1주 (도구 ~11~19,
   * 명성 단계 3~4). At ×1 the strongest board there was a sure 걸작 from 도구 13 (once four
   * plain hammers finish, the 신중한 두드리기 CP buys one more touch) and 고급 then fell to 58%
   * at 1주. Now the strongest board makes 57~94% at 도구 11~19 (97% at 20); basic actions
   * alone only ★2 (33~59%), but by then every shop has a stage-3 board.
   */
  bridgeMult: { progress: 1.1, quality: 1.45 },
} as const;

// ---------- Conditions (4.2.3) ----------

export const CONDITIONS = [
  'normal', // 보통
  'good', // 좋음
  'excellent', // 최상
  'poor', // 식음
  'sturdy', // 단단함
  'pliant', // 부드러움
  'malleable', // 잘 펴짐
  'goodOmen', // 불티
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABEL: Record<Condition, string> = {
  normal: '보통',
  good: '좋음',
  excellent: '최상',
  poor: '식음',
  sturdy: '단단함',
  pliant: '부드러움',
  malleable: '잘 펴짐',
  goodOmen: '불티',
};

/** One-line effect text shown under the condition badge. */
export const CONDITION_HINT: Record<Condition, string> = {
  normal: '',
  good: '품질 ×1.5',
  excellent: '품질 ×3',
  poor: '품질 ×0.5',
  sturdy: '내구도 소모 절반',
  pliant: '제작력 소모 절반',
  malleable: '공정 ×1.5',
  goodOmen: '다음 턴 좋음',
};

export interface ConditionEffect {
  quality: number;
  progress: number;
  durabilityCost: number;
  cpCost: number;
}

const PLAIN: ConditionEffect = { quality: 1, progress: 1, durabilityCost: 1, cpCost: 1 };

export const CONDITION_EFFECT: Record<Condition, ConditionEffect> = {
  normal: PLAIN,
  good: { ...PLAIN, quality: 1.5 },
  excellent: { ...PLAIN, quality: 3 },
  poor: { ...PLAIN, quality: 0.5 },
  sturdy: { ...PLAIN, durabilityCost: 0.5 },
  pliant: { ...PLAIN, cpCost: 0.5 },
  malleable: { ...PLAIN, progress: 1.5 },
  goodOmen: PLAIN,
};

/** Conditions that unlock 정밀 다듬기 and 불씨 살리기. */
export const GOOD_CONDITIONS: readonly Condition[] = ['good', 'excellent'];

/** The first turn is always this (FF14: the first step is Normal). */
export const FIRST_CONDITION: Condition = 'normal';

/**
 * Forced follow-ups per grade (4.2.3). 식음 joins at 고급, so 기본 keeps three conditions
 * and nothing follows 최상 there; 불티 → 좋음 only exists in 전설.
 */
export const FORCED_NEXT: Record<RecipeGrade, Partial<Record<Condition, Condition>>> = {
  basic: {},
  advanced: { excellent: 'poor' },
  legendary: { excellent: 'poor', goodOmen: 'good' },
};

/**
 * Random roll weights per recipe grade (percent). 식음 only follows 최상, so it has
 * no weight. Rolls walk CONDITIONS in order; changing weights changes how saved
 * crafts replay.
 */
export const CONDITION_WEIGHTS: Record<RecipeGrade, Partial<Record<Condition, number>>> = {
  // 4.3: basic actions should make ★3, ★4 only now and then. Two 좋음 on touch turns make
  // a ★4, so 좋음 sets that rate (15% gave the 4.2.1 player 12% ★4+, 12% gives ~8%).
  // 최상 drives basic-action ★5 (~2% per 1%); no 식음 after it here, so it is 0.75.
  basic: { normal: 87.25, good: 12, excellent: 0.75 },
  advanced: { normal: 62, good: 15, excellent: 1, sturdy: 11, pliant: 11 },
  legendary: { normal: 47, good: 14, excellent: 1, sturdy: 9, pliant: 9, malleable: 10, goodOmen: 10 },
};

// ---------- Inner Quiet: 열기 (4.2.1) ----------

export const INNER_QUIET = {
  max: 10,
  /** Each stack: quality +10%. */
  qualityPerStack: 0.1,
  /** 마무리: efficiency 100% × (1 + stacks × 0.2). */
  finisherPerStack: 0.2,
} as const;

// ---------- Actions (4.2.1, 4.2.2) ----------

export const CRAFT_ACTION_IDS = [
  // 기본 6개
  'basicSynthesis', // 두드리기
  'basicTouch', // 다듬기
  'preciseTouch', // 정밀 다듬기
  'innovation', // 풀무질
  'mastersMend', // 담금질
  'byregotsBlessing', // 마무리
  // 스킬판 12개
  'wasteNot', // 아껴 치기
  'carefulSynthesis', // 신중한 두드리기
  'muscleMemory', // 첫 망치
  'reflect', // 첫 손질
  'veneration', // 달구기
  'manipulation', // 단조 유지
  'greatStrides', // 혼신
  'groundwork', // 크게 내려치기
  'tricksOfTheTrade', // 불씨 살리기
  'carefulObservation', // 불 다시 보기
  'heartAndSoul', // 대장장이의 감
  'finalAppraisal', // 최후의 한 수
] as const;
export type CraftActionId = (typeof CRAFT_ACTION_IDS)[number];

export const BUFF_IDS = [
  'innovation',
  'veneration',
  'wasteNot',
  'manipulation',
  'greatStrides',
  'muscleMemory',
  'finalAppraisal',
] as const;
export type BuffId = (typeof BUFF_IDS)[number];

export const BUFF_LABEL: Record<BuffId, string> = {
  innovation: '풀무질',
  veneration: '달구기',
  wasteNot: '아껴 치기',
  manipulation: '단조 유지',
  greatStrides: '혼신',
  muscleMemory: '첫 망치',
  finalAppraisal: '최후의 한 수',
};

export const BUFF_HINT: Record<BuffId, string> = {
  innovation: '품질 +50%',
  veneration: '공정 +50%',
  wasteNot: '내구도 소모 절반',
  manipulation: '매 턴 내구도 +5',
  greatStrides: '다음 품질 +100%',
  muscleMemory: '다음 공정 +100%',
  finalAppraisal: '완성 직전에서 멈춤',
};

/** Additive buff bonuses (FF14 adds Innovation and Great Strides together). */
export const BUFF_BONUS = {
  innovation: 0.5,
  greatStrides: 1.0,
  veneration: 0.5,
  muscleMemory: 1.0,
  wasteNot: 0.5, // durability cost multiplier
  manipulation: 5, // durability per turn
} as const;

export type ActionRequirement = 'firstTurn' | 'goodCondition' | 'innerQuiet';

export interface CraftActionSpec {
  id: CraftActionId;
  name: string;
  /** FF14 original (부록 A). */
  origin: string;
  /** One of the six starting actions; the rest come from the skill board. */
  basic: boolean;
  cp: number;
  durability: number;
  /** Efficiency (1 = 100%). 0 when the action does not touch the gauge. */
  progress: number;
  quality: number;
  innerQuiet: number;
  restoreDurability: number;
  restoreCp: number;
  buff: { id: BuffId; turns: number } | null;
  requires: ActionRequirement | null;
  /** Does not use a turn: no condition roll, no buff tick. */
  free: boolean;
  /** Uses per craft, or null for unlimited. */
  perCraft: number | null;
  /** Short effect text for the action button. */
  short: string;
}

function action(spec: Partial<CraftActionSpec> & Pick<CraftActionSpec, 'id' | 'name' | 'origin' | 'short'>): CraftActionSpec {
  return {
    basic: false,
    cp: 0,
    durability: 0,
    progress: 0,
    quality: 0,
    innerQuiet: 0,
    restoreDurability: 0,
    restoreCp: 0,
    buff: null,
    requires: null,
    free: false,
    perCraft: null,
    ...spec,
  };
}

export const CRAFT_ACTIONS: Record<CraftActionId, CraftActionSpec> = {
  basicSynthesis: action({
    id: 'basicSynthesis',
    name: '두드리기',
    origin: 'Basic Synthesis',
    basic: true,
    durability: 10,
    progress: 1.0,
    short: '공정 +100%',
  }),
  basicTouch: action({
    id: 'basicTouch',
    name: '다듬기',
    origin: 'Basic Touch',
    basic: true,
    cp: 10,
    durability: 10,
    quality: 1.0,
    innerQuiet: 1,
    short: '품질 +100%',
  }),
  preciseTouch: action({
    id: 'preciseTouch',
    name: '정밀 다듬기',
    origin: 'Precise Touch',
    basic: true,
    cp: 15,
    durability: 10,
    quality: 1.5,
    innerQuiet: 2,
    requires: 'goodCondition',
    short: '품질 +150%, 열기 +2',
  }),
  innovation: action({
    id: 'innovation',
    name: '풀무질',
    origin: 'Innovation',
    basic: true,
    cp: 15,
    buff: { id: 'innovation', turns: 3 },
    short: '3턴 품질 +50%',
  }),
  mastersMend: action({
    id: 'mastersMend',
    name: '담금질',
    origin: "Master's Mend",
    basic: true,
    cp: 25,
    restoreDurability: 30,
    short: '내구도 +30',
  }),
  byregotsBlessing: action({
    id: 'byregotsBlessing',
    name: '마무리',
    origin: "Byregot's Blessing",
    basic: true,
    cp: 15,
    durability: 10,
    quality: 1.0,
    requires: 'innerQuiet',
    short: '열기를 모두 써서 품질',
  }),
  wasteNot: action({
    id: 'wasteNot',
    name: '아껴 치기',
    origin: 'Waste Not',
    cp: 30,
    buff: { id: 'wasteNot', turns: 4 },
    short: '4턴 내구도 소모 절반',
  }),
  carefulSynthesis: action({
    id: 'carefulSynthesis',
    name: '신중한 두드리기',
    origin: 'Careful Synthesis',
    cp: 7,
    durability: 10,
    progress: 1.5,
    short: '공정 +150%',
  }),
  muscleMemory: action({
    id: 'muscleMemory',
    name: '첫 망치',
    origin: 'Muscle Memory',
    cp: 6,
    durability: 10,
    progress: 3.0,
    buff: { id: 'muscleMemory', turns: 5 },
    requires: 'firstTurn',
    short: '공정 +300%, 다음 공정 +100%',
  }),
  // 첫 손질: 300% made the stage-1 board a sure 걸작 at band 1 from 도구 6; 200% tops out in ★4.
  reflect: action({
    id: 'reflect',
    name: '첫 손질',
    origin: 'Reflect',
    cp: 6,
    durability: 10,
    quality: 2.0,
    innerQuiet: 2,
    requires: 'firstTurn',
    short: '품질 +200%, 열기 +2',
  }),
  veneration: action({
    id: 'veneration',
    name: '달구기',
    origin: 'Veneration',
    cp: 15,
    buff: { id: 'veneration', turns: 3 },
    short: '3턴 공정 +50%',
  }),
  manipulation: action({
    id: 'manipulation',
    name: '단조 유지',
    origin: 'Manipulation',
    cp: 50,
    buff: { id: 'manipulation', turns: 8 },
    short: '8턴 매 턴 내구도 +5',
  }),
  greatStrides: action({
    id: 'greatStrides',
    name: '혼신',
    origin: 'Great Strides',
    cp: 25,
    buff: { id: 'greatStrides', turns: 3 },
    short: '다음 품질 +100%',
  }),
  groundwork: action({
    id: 'groundwork',
    name: '크게 내려치기',
    origin: 'Groundwork',
    cp: 18,
    durability: 20,
    progress: 3.0,
    short: '공정 +300%',
  }),
  tricksOfTheTrade: action({
    id: 'tricksOfTheTrade',
    name: '불씨 살리기',
    origin: 'Tricks of the Trade',
    restoreCp: 20,
    requires: 'goodCondition',
    short: '제작력 +20',
  }),
  carefulObservation: action({
    id: 'carefulObservation',
    name: '불 다시 보기',
    origin: 'Careful Observation',
    free: true,
    perCraft: 3,
    short: '상태를 다시 굴린다',
  }),
  heartAndSoul: action({
    id: 'heartAndSoul',
    name: '대장장이의 감',
    origin: 'Heart and Soul',
    free: true,
    perCraft: 1,
    short: '좋음 전용 액션 1회',
  }),
  finalAppraisal: action({
    id: 'finalAppraisal',
    name: '최후의 한 수',
    origin: 'Final Appraisal',
    cp: 1,
    buff: { id: 'finalAppraisal', turns: 5 },
    free: true,
    short: '5턴 완성 직전에서 멈춤',
  }),
};

export const BASIC_ACTIONS: readonly CraftActionId[] = CRAFT_ACTION_IDS.filter((id) => CRAFT_ACTIONS[id].basic);

// ---------- Craft skill-board nodes (9.3 망치·손끝) ----------

/**
 * Nodes one layout may switch on, by fame stage (9.2 '스킬판 상한'): stages 1~7, then each
 * ★n stage (8, 9, …) adds one, up to 12.
 */
export const SKILL_BOARD_CAP = { byStage: [3, 4, 5, 6, 7, 8, 9], perStarStage: 1, max: 12 } as const;

export const CRAFT_NODE_IDS = [
  // 망치
  'wasteNot',
  'carefulSynthesis',
  'muscleMemory',
  'manipulation',
  'thickAnvil',
  'veneration',
  'groundwork',
  'trainedArm',
  'finalAppraisal',
  // 손끝
  'reflect',
  'greatStrides',
  'tricksOfTheTrade',
  'carefulObservation',
  'heartAndSoul',
  'deftHand',
  'flameReading',
] as const;
export type CraftNodeId = (typeof CRAFT_NODE_IDS)[number];

export type CraftBranch = 'hammer' | 'fingertip';

export const CRAFT_BRANCH_LABEL: Record<CraftBranch, string> = { hammer: '망치', fingertip: '손끝' };

export interface CraftNodeSpec {
  id: CraftNodeId;
  name: string;
  branch: CraftBranch;
  /** Position in the branch (1 = next to the center). */
  index: number;
  /** The other side of a ↔ node, if any. */
  pair: CraftNodeId | null;
  /** Fame stage at which it appears (9.3). */
  stage: number;
  /** The action it unlocks, or null for a passive. */
  action: CraftActionId | null;
  description: string;
}

function node(
  id: CraftNodeId,
  name: string,
  branch: CraftBranch,
  index: number,
  stage: number,
  actionId: CraftActionId | null,
  description: string,
  pair: CraftNodeId | null = null,
): CraftNodeSpec {
  return { id, name, branch, index, pair, stage, action: actionId, description };
}

export const CRAFT_NODES: Record<CraftNodeId, CraftNodeSpec> = {
  wasteNot: node('wasteNot', '아껴 치기', 'hammer', 1, 1, 'wasteNot', '액션'),
  carefulSynthesis: node('carefulSynthesis', '신중한 두드리기', 'hammer', 2, 1, 'carefulSynthesis', '액션'),
  muscleMemory: node('muscleMemory', '첫 망치', 'hammer', 3, 2, 'muscleMemory', '액션'),
  manipulation: node('manipulation', '단조 유지', 'hammer', 4, 3, 'manipulation', '액션', 'thickAnvil'),
  thickAnvil: node('thickAnvil', '두꺼운 모루판', 'hammer', 4, 3, null, '레시피 내구도 +15', 'manipulation'),
  veneration: node('veneration', '달구기', 'hammer', 5, 3, 'veneration', '액션', 'groundwork'),
  groundwork: node('groundwork', '크게 내려치기', 'hammer', 5, 3, 'groundwork', '액션', 'veneration'),
  trainedArm: node('trainedArm', '단련된 팔', 'hammer', 6, 4, null, '작업 숙련도 +10%'),
  finalAppraisal: node('finalAppraisal', '최후의 한 수', 'hammer', 7, 5, 'finalAppraisal', '액션'),
  reflect: node('reflect', '첫 손질', 'fingertip', 1, 1, 'reflect', '액션'),
  greatStrides: node('greatStrides', '혼신', 'fingertip', 2, 3, 'greatStrides', '액션'),
  tricksOfTheTrade: node('tricksOfTheTrade', '불씨 살리기', 'fingertip', 3, 4, 'tricksOfTheTrade', '액션'),
  carefulObservation: node(
    'carefulObservation',
    '불 다시 보기',
    'fingertip',
    4,
    4,
    'carefulObservation',
    '액션',
    'heartAndSoul',
  ),
  heartAndSoul: node('heartAndSoul', '대장장이의 감', 'fingertip', 4, 4, 'heartAndSoul', '액션', 'carefulObservation'),
  deftHand: node('deftHand', '섬세한 손', 'fingertip', 5, 5, null, '가공 숙련도 +10%'),
  flameReading: node('flameReading', '불꽃 읽기', 'fingertip', 6, 6, null, '다음 턴 상태를 미리 본다'),
};

// ---------- Enchant materials (4.5) ----------

/** Body-type families have 하급 (low) and 상급 (high) grades; crystals have none. */
export type BodyFamily = Exclude<EnchantFamily, 'crystal'>;

export const MATERIAL_GRADE_LABEL = { low: '하급', high: '상급' } as const;
