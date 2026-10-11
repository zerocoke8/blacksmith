// 육성 한 판 (시즌 악마의 탑, 기획서 13장) 수치와 1시즌 탑 「재의 악마의 탑」.
// Everything here is a [튜닝] starting value unless the doc says otherwise; change numbers here,
// not in src/sim/run. The season cards themselves live in data/seasonCards.ts (the card list reads
// that file, not this one), and this file only imports types from cards.ts.

import type { EnchantMaterialKey } from '../cards/enchant.ts';
import type { BodyType, Element, QualityTier, UniqueId } from '../core/types.ts';
import type { CardId, CardRecipeGrade } from './cards.ts';
import type { FamilyId } from './families.ts';
import type { SeasonCardId } from './seasonCards.ts';
import { RETURN_AT_HP, RETURN_BELOW_CLEAR_CHANCE } from './world.ts';

// ---------- 성급 (13.5) ----------

export type Star = 1 | 2 | 3 | 4 | 5;
export const STARS: readonly Star[] = [1, 2, 3, 4, 5];

export interface StarSpec {
  /** 시작 힘 (레벨 1). */
  startPower: number;
  /** 힘 상한 (레벨 30, 성장률 100%). */
  powerCap: number;
  /** 가문 고유 카드 레벨. */
  cardLevel: number;
  /** 계승 칸: 선대 인자를 고를 수 있는 수. */
  inheritSlots: number;
}

/** 13.5 '성급이 주는 것' (원본 표, 15.3이 따른다). */
export const STAR_SPEC: Record<Star, StarSpec> = {
  1: { startPower: 1.0, powerCap: 2.4, cardLevel: 1, inheritSlots: 2 },
  2: { startPower: 1.0, powerCap: 2.55, cardLevel: 2, inheritSlots: 2 },
  3: { startPower: 1.05, powerCap: 2.7, cardLevel: 3, inheritSlots: 3 },
  4: { startPower: 1.05, powerCap: 2.85, cardLevel: 4, inheritSlots: 3 },
  5: { startPower: 1.1, powerCap: 3.0, cardLevel: 5, inheritSlots: 4 },
};

// ---------- 판 (13.3, 13.4) ----------

/** Save format version of a run in progress (판 세이브, 13.16). */
export const RUN_SAVE_VERSION = 1;

/** 한 판 30턴. The [검증] switch can change it within this range. */
export const RUN_TURNS = 30;
export const RUN_TURNS_RANGE = { min: 12, max: 60 } as const;

/** 판 시작 골드 (13.4.3). */
export const RUN_START_GOLD = 150;

/** HP gained by each action (13.4.1). 원정 loses HP by floor instead. */
export const ACTION_HP = { forge: 0.2, maintain: 0.2, rest: 0.6, bond: 0.3 } as const;

/** 부상: HP 상한 60% until 휴식 (13.4.2). */
export const INJURY_HP_CAP = 0.6;

/** 정비: 다음 원정 전투력 ×1.2 (8장 특별 수리와 같은 효과, 13.4.1). */
export const MAINTAIN_POWER_MULT = 1.2;

// ---------- 원정 방침 (7.10, 13.4.4) ----------

export const EXPEDITION_POLICIES = ['cautious', 'normal', 'bold'] as const;
export type ExpeditionPolicy = (typeof EXPEDITION_POLICIES)[number];

export const POLICY_LABEL: Record<ExpeditionPolicy, string> = { cautious: '신중', normal: '보통', bold: '과감' };

/**
 * 7.10 원정 방침 표: HP 귀환 기준 (이하면 돌아선다) and 다음 층 돌파 확률 기준 (미만이면 돌아선다).
 * 무기 내구도 20%와 12층 기준은 방침과 관계없다 (world.ts). No '판 전용' row yet (13.4.4).
 */
export const POLICY_RETURN: Record<ExpeditionPolicy, { hp: number; clearChance: number }> = {
  cautious: { hp: 0.55, clearChance: 0.65 },
  normal: { hp: RETURN_AT_HP, clearChance: RETURN_BELOW_CLEAR_CHANCE },
  bold: { hp: 0.3, clearChance: 0.4 },
};

// ---------- 보스 벽 (13.7) ----------

/** 넘어야 할 보스 층: 10·20·30·40층 구간 보스, 50층 악마. */
export const WALL_FLOORS: readonly number[] = [10, 20, 30, 40, 50];
export const DEMON_FLOOR = 50;
/** 마지막 등반은 51층에서 출발한다. */
export const FINAL_CLIMB_START = 51;

export const WALL_PRESETS = ['tight', 'default', 'loose'] as const;
export type WallPreset = (typeof WALL_PRESETS)[number];

export const WALL_PRESET_LABEL: Record<WallPreset, string> = { tight: '빡빡', default: '기본', loose: '느슨' };

/**
 * 마감 턴 for a 30-turn run (13.7 표 = 'default'). Other run lengths scale these by turns ÷ 30.
 * 'tight' and 'loose' are the [검증] presets; the last wall stays at least one turn before the end
 * so 마지막 등반 always has its turn.
 */
export const WALL_DEADLINES: Record<WallPreset, readonly number[]> = {
  tight: [3, 8, 14, 20, 26],
  default: [4, 10, 16, 22, 28],
  loose: [5, 12, 18, 24, 29],
};

/** '탑의 기척' comes at the end of the turn this many turns before a deadline (13.11). */
export const SIGN_TURNS_BEFORE = 2;
/** The red warning band shows this many turns before a deadline (13.7). */
export const WALL_WARN_TURNS = 1;

// ---------- 판 골드, 상점, 보스 보상 (13.4.3) ----------

/** 하급 인챈트 재료와 원소 결정 = 상점에 있는 최고 구간 재료가 × 2. */
export const ENCHANT_PRICE_UNITS = 2;

/**
 * [검증] 후반 층 수입 스위치 (16.2의 15번, 16.3의 18번: 판 골드가 후반에 남는다): 이 층부터 층마다 버는
 * 판 골드에 곱한다. The doc's rule is ×1 (13.4.3); the switch only lets a playtest try less.
 */
export const LATE_GOLD_FROM_FLOOR = 31;
export const LATE_GOLD_RATE_RANGE = { min: 0.25, max: 1 } as const;

/** 보스를 처음 넘으면: 다음 구간 주재료 2개 + 기술 카드 3장 중 1장 (40층은 시즌 보스 재료 +1). */
export const BOSS_REWARD = { mainMaterials: 2, cardChoices: 3, seasonMaterialFloor: 40 } as const;

// ---------- 단조 (13.8) ----------

/**
 * 판 숙련도 표: 기준 도구 레벨 by 주재료 구간 (1구간 철 = index 0). 작업·가공 숙련도 = 100 × 1.04^레벨
 * (100 · 117 · 148 · 180 · 219 · 256). Past the table, +RUN_SMITH_LEVEL_STEP per band.
 */
export const RUN_SMITH_LEVEL_BY_TIER: readonly number[] = [0, 4, 10, 15, 20, 24];
export const RUN_SMITH_LEVEL_STEP = 4;
/** 전설 (시즌 보스 재료 + 아다만). A higher band's own level wins if it is higher. */
export const RUN_SMITH_LEGENDARY_LEVEL = 20;
/** 손패 5장, 간직 0장. 행상의 '화로 손질'로 이번 판만 +1 (판당 1번). */
export const RUN_HAND_SIZE = 5;
export const FURNACE_TUNE_HAND = 1;
/** [검증] 판 손패 스위치의 범위 (16.3의 10·13번: 걸작이 너무 쉬운가). */
export const RUN_HAND_SIZE_RANGE = { min: 4, max: 6 } as const;

/** 시작 덱의 해금 카드 수 = 시즌 상한 (13.3, 1시즌 6장). */
export const SEASON_UNLOCK_CAP = 6;

/** Quality drawn by the quick forge (단조 간이 모드, [검증]) when no quality is given: weights. */
export const QUICK_FORGE_WEIGHTS: Record<QualityTier, number> = { 1: 0, 2: 15, 3: 55, 4: 25, 5: 5 };

/**
 * A run deck to start from in the prototype (13.3: 작업대의 저장 덱). 1일차 덱 + 해금 카드 6장
 * (시즌 상한) = 16장, the same as the card measurement's '1주' deck.
 */
export const RUN_DEFAULT_DECK: readonly CardId[] = [
  'hammer',
  'hammer',
  'hammer',
  'polish',
  'polish',
  'polish',
  'precisePolish',
  'bellows',
  'quench',
  'finisher',
  'carefulHammer',
  'carefulHammer',
  'firstTouch',
  'firstHammer',
  'allIn',
  'allIn',
];

// ---------- 동료 (13.9) ----------

export const COMPANION_SLOTS = 3;
export const BOND_MAX = 5;
/** 사연이 열리는 유대 (13.9). */
export const STORY_BONDS: readonly number[] = [1, 3, 5];

/** 보너스 단계 = 동료 성급: 1·2성 1단계, 3·4성 2단계, 5성 3단계. */
export const BONUS_TIER_BY_STAR: Record<Star, 1 | 2 | 3> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 };

/** 13.9 보너스 종류, 1 / 2 / 3단계. */
export const COMPANION_BONUS = {
  /** 그 동료 계열의 인챈트 재료나 원소 결정. */
  materialGift: [1, 2, 3],
  /** 지금 구간 재료가 × n. */
  goldGiftUnits: [5, 8, 12],
  /** 덱의 카드 n장 진화 (갈래는 플레이어가 고른다). */
  cardUpgrade: [1, 1, 2],
  /** 판 누적 층 +n (레벨 약 +1 / +2 / +3). */
  trainingFloors: [5, 10, 15],
  /** 다음 원정 한 번 파티 보정 +n. */
  escortParty: [0.1, 0.2, 0.3],
} as const;

// ---------- 선대와 인자 (13.10) ----------

export const ANCESTORS_MAX = 2;
export const FACTOR_LEVEL_MAX = 3;

export const FACTOR_KINDS = ['strength', 'mastery', 'charisma', 'toughness', 'towerAdapt', 'hunter', 'card'] as const;
export type FactorKind = (typeof FACTOR_KINDS)[number];

export const FACTOR_LABEL: Record<FactorKind, string> = {
  strength: '강함',
  mastery: '숙련',
  charisma: '인망',
  toughness: '강인함',
  towerAdapt: '탑 적응',
  hunter: '사냥꾼',
  card: '카드',
};

/** 인자 효과, 단계 1 / 2 / 3 (13.10 표). */
export const FACTOR_VALUES = {
  /** 시작 힘 +n (상한은 그대로). */
  strength: [0.05, 0.1, 0.15],
  /** 숙련 판정 +n층. */
  mastery: [3, 6, 10],
  /** 파티 보정 +n. */
  charisma: [0.05, 0.1, 0.2],
  /** 부상 확률 ×n. */
  toughness: [0.9, 0.8, 0.7],
  /** 전투력 ×n. */
  towerAdapt: [1.02, 1.03, 1.05],
  /** 그 체형 상대 전투력 ×n. */
  hunter: [1.03, 1.05, 1.08],
} as const;

// ---------- 사건 (13.11) ----------

/** Chance at the end of a turn, before the [검증] 이벤트 빈도 multiplier. */
export const EVENT_CHANCE = {
  /** 행상: 원정이 아닌 턴 뒤. */
  merchant: 0.15,
  /** 동료 사연: 원정 뒤. */
  chat: 0.2,
  /** 떠돌이 장인: 단조 턴 뒤. */
  artisan: 0.25,
} as const;

/** 재료 발견: 원정 중 돌파한 층마다 (시즌 규칙이 곱한다). 31층부터 상급. */
export const FIND_CHANCE_PER_FLOOR = 0.05;
export const UPPER_MATERIAL_FROM_FLOOR = 31;

/** 행상 값 = 지금 구간 재료가 × n. Unset in the doc ([튜닝], 16.2의 15번: 골드가 남는다). */
export const MERCHANT_PRICE_UNITS = { card: 4, remove: 3, furnace: 6, upper: 4, crystals: 3 } as const;
/** 행상의 기술 카드: 시즌 카드 풀에서 3장 중 하나 (13.11). */
export const MERCHANT_CARD_CHOICES = 3;
export const MERCHANT_CRYSTAL_BUNDLE = 2;
/** 행상의 희귀 재료가 상급 체형 재료일 확률 (아니면 원소 결정 묶음). */
export const MERCHANT_UPPER_CHANCE = 0.5;
/** 행상의 카드 빼기는 덱이 이만큼은 남게 한다. */
export const MERCHANT_REMOVE_MIN_DECK = 8;
/** 떠돌이 장인이 내미는 진화 후보 수. */
export const ARTISAN_OFFERS = 2;

/** [검증] 이벤트 빈도 배율 범위. */
export const EVENT_RATE_RANGE = { min: 0, max: 3 } as const;

// ---------- 평가 (13.12) ----------

export const SCORE = {
  /** 최고 도달층 × 100. */
  perFloor: 100,
  /** 벽마다 (마감 턴 − 넘은 턴) × 30. */
  perSpareTurn: 30,
  /** 판에서 지은 무기 중 가장 높은 품질 ★ × 100. */
  perStar: 100,
  /** 동료 유대 합 × 20. */
  perBond: 20,
} as const;

export const RUN_GRADES = ['novice', 'known', 'seasoned', 'demonSlayer', 'sung'] as const;
export type RunGrade = (typeof RUN_GRADES)[number];

export interface RunGradeSpec {
  label: string;
  minScore: number;
  needsDemon: boolean;
  /** 인자 개수와 단계 (13.12). */
  factors: number;
  factorLevel: number;
}

/** 13.12 평가 등급, low to high. The highest one whose conditions hold is the grade. */
export const RUN_GRADE_SPEC: Record<RunGrade, RunGradeSpec> = {
  novice: { label: '풋내기', minScore: 0, needsDemon: false, factors: 1, factorLevel: 1 },
  known: { label: '이름난', minScore: 2500, needsDemon: false, factors: 2, factorLevel: 1 },
  seasoned: { label: '노련한', minScore: 4000, needsDemon: false, factors: 2, factorLevel: 2 },
  demonSlayer: { label: '악마를 벤', minScore: 0, needsDemon: true, factors: 3, factorLevel: 2 },
  sung: { label: '노래로 남은', minScore: 7000, needsDemon: true, factors: 3, factorLevel: 3 },
};

/** Run weapons get a '{탑} n층을 연' name from this record up (13.12, 12.1). */
export const WEAPON_NAME_FLOOR_FROM = 60;

// ---------- 명예의 전당 (13.13) ----------

export const HALL_SIZE = 50;
export const HALL_VERSION = 1;

// ---------- 실험 스위치 ([검증], 16.3) ----------

export type DeathMode = 'severe' | 'death';

export const DEATH_MODE_LABEL: Record<DeathMode, string> = { severe: '중상', death: '사망' };

/**
 * Defaults are the doc's rules. turns: 한 판 턴 수. wallPreset: 보스 벽 일정. deathMode: 판 안의
 * 사망 결과 (13.4.2 추천은 중상). eventRate: 무작위 사건 확률 배율. quickForge: 카드 퍼즐 대신
 * 품질을 바로 정하는 단조 (판 흐름만 빨리 시험할 때). handSize: 판의 손패 (13.8: 5장, 화로 손질은
 * 그 위에 +1). lateGoldRate: 31층부터 층 수입 배율 (13.4.3: ×1).
 */
export const DEFAULT_RUN_RULES = {
  turns: RUN_TURNS,
  wallPreset: 'default' as WallPreset,
  deathMode: 'severe' as DeathMode,
  eventRate: 1,
  quickForge: false,
  handSize: RUN_HAND_SIZE,
  lateGoldRate: 1,
};

/** 대수 ('3대 아렌', 6.7.1) a setup may carry. */
export const GENERATION_MAX = 999;

// ---------- 시간 감 (13.4.1 시간 표, 16.3의 11번) ----------

/** Seconds a player is assumed to spend, for the measured 판 시간. */
export const PLAY_SECONDS = {
  prep: 90,
  expedition: 25,
  /** 단조 1회: 기본 약 1분, 고급 약 1분 30초, 전설 약 2분 (13.8). */
  forge: { basic: 60, advanced: 90, legendary: 120 } as Record<CardRecipeGrade, number>,
  /** 정비·휴식·교류, and a forced turn's one tap. */
  other: 12,
  /** 사건 하나 (선택지 읽고 고르기). */
  event: 15,
  end: 90,
} as const;

// ---------- 시즌 악마의 탑 (13.2) ----------

export const SEASON_IDS = ['ash'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

export interface SeasonBand {
  element: Element;
  main: BodyType;
  sub: BodyType;
  boss: string;
  /** 대표 적 이름 by body (main and sub at least). */
  enemies: Partial<Record<BodyType, string>>;
}

/** 시즌 사건의 결과 (13.11: 선택에 따라 시즌 카드나 재료). */
export type SeasonReward =
  | { kind: 'card'; card: CardId }
  | { kind: 'material'; key: EnchantMaterialKey; count: number }
  | { kind: 'goldUnits'; units: number };

export interface SeasonEventSpec {
  /** The end of this turn of a 30-turn run (scaled for other lengths). */
  turn: number;
  title: string;
  lines: readonly string[];
  choices: readonly { label: string; reward: SeasonReward }[];
}

export interface SeasonSpec {
  id: SeasonId;
  name: string;
  /** 시즌 시드: (시즌 시드, 'season', 구간) fixes every floor's body (13.16). Same for everyone. */
  seed: number;
  /** 탑이 솟을 때의 한 줄 (1.1). */
  line: string;
  color: string;
  emoji: string;
  /** 시즌 규칙 (13.2.1). Only '재료 발견 확률 ×n' exists so far. */
  rule: { label: string; text: string; findMult: number };
  /** 1~50층의 다섯 구간. 50층 보스가 악마. */
  bands: readonly [SeasonBand, SeasonBand, SeasonBand, SeasonBand, SeasonBand];
  demon: string;
  /** 위층 (51층~): 보스 없음, 체형은 층마다 섞인다. */
  upper: { element: Element; enemies: Record<BodyType, string> };
  /** 40층 보스 재료 (시즌 보스 재료): 전설 레시피. 걸작이면 이 고유능력이 붙는다. */
  bossMaterial: { name: string; unique: UniqueId };
  /** 시즌 가문 (13.2.2): 누구나 동료 칸 하나에 1성으로 빌린다. */
  family: FamilyId;
  cards: readonly SeasonCardId[];
  events: readonly SeasonEventSpec[];
  /** 드워프의 한마디 at '탑의 기척'; {boss} is replaced. */
  signLine: string;
  /** 악마를 넘었을 때. */
  demonLine: string;
}

export const SEASONS: Record<SeasonId, SeasonSpec> = {
  ash: {
    id: 'ash',
    name: '재의 악마의 탑',
    // Picked so the layout matches the 13.18 example (3층 비행, 21·22층 비행, 23층 갑각).
    seed: 20,
    line: '변두리에 탑이 하나 솟았다. 이번 계절은 재 냄새가 난다.',
    color: '#6b6b70',
    emoji: '🔥',
    rule: { label: '재 냄새', text: '원정의 재료 발견 확률 2배', findMult: 2 },
    bands: [
      {
        element: 'fire',
        main: 'humanoid',
        sub: 'flying',
        boss: '재의 문지기',
        enemies: { humanoid: '재투성이 병사', flying: '불티 박쥐' },
      },
      {
        element: 'earth',
        main: 'armored',
        sub: 'humanoid',
        boss: '바위 수문장',
        enemies: { armored: '잿빛 갑충', humanoid: '돌가루 일꾼' },
      },
      {
        element: 'wind',
        main: 'flying',
        sub: 'armored',
        boss: '잿빛 와이번',
        enemies: { flying: '재 까마귀', armored: '바람 바위게' },
      },
      {
        element: 'water',
        main: 'spirit',
        sub: 'flying',
        boss: '안개 원령',
        enemies: { spirit: '물안개 유령', flying: '젖은 하피' },
      },
      {
        element: 'fire',
        main: 'humanoid',
        sub: 'spirit',
        boss: '재의 군주',
        enemies: { humanoid: '재의 기사', spirit: '불씨 원혼' },
      },
    ],
    demon: '재의 군주',
    upper: {
      element: 'fire',
      enemies: { humanoid: '잿더미 기사', armored: '타다 남은 골렘', flying: '불새 그림자', spirit: '꺼지지 않는 불씨' },
    },
    bossMaterial: { name: '원령의 등불', unique: 'dragonFury' },
    family: 'isol',
    cards: ['ashHammer', 'ashQuench'],
    events: [
      {
        turn: 6,
        title: '처음 솟던 날',
        lines: ['마을 노인이 탑을 가리켰다. "저게 솟던 날, 지붕이 다 하얬지."'],
        choices: [
          { label: '이야기를 더 듣는다', reward: { kind: 'card', card: 'ashHammer' } },
          { label: '지붕의 재를 같이 쓴다', reward: { kind: 'material', key: 'crystal:water', count: 2 } },
        ],
      },
      {
        turn: 17,
        title: '재 아래 불씨',
        lines: ['탑 밑동의 재를 헤치자 아직 붉은 불씨가 보였다.'],
        choices: [
          { label: '불씨를 화로에 옮긴다', reward: { kind: 'card', card: 'ashQuench' } },
          { label: '재를 자루에 담는다', reward: { kind: 'material', key: 'soulDust:low', count: 2 } },
        ],
      },
    ],
    signLine: '"{boss}{이} 기다린다. 서두르진 말고, 늦지도 말고."',
    demonLine: '{demon}{이} 쓰러졌다. 탑은 다음 계절까지 조용할 거다.',
  },
};

export function isSeasonId(v: unknown): v is SeasonId {
  return typeof v === 'string' && (SEASON_IDS as readonly string[]).includes(v);
}
