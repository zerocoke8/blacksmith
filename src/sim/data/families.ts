// 가문 견본 (기획서 6.7, 13.5, 13.9). 시작 가문 3 (바일, 네아, 오델) + 13.18 예시의 아렌 (뽑기)
// + 1시즌 가문 이솔. Numbers are [튜닝] starting values; change them here.
//
// 가문 고유 카드 (16.2의 13번) live here with their numbers per 성급 레벨. src/sim/data/cards.ts
// adds them to the card list so the card engine plays them like any other card. This file only
// imports types from cards.ts, so the two modules never wait on each other at load time.

import type { BodyMaterialFamily } from '../cards/enchant.ts';
import type { TowerId, WeaponType } from '../core/types.ts';
import type { CardEffect, CardSpecInput } from './cards.ts';
import type { StatTier } from './world.ts';

export const FAMILY_IDS = ['vail', 'nea', 'odel', 'aren', 'isol'] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

/** 시작 가문 (무료), 뽑기 가문, 시즌 가문 (6.7.1, 13.2.2). */
export type FamilyOrigin = 'starter' | 'gacha' | 'season';

export const FAMILY_ORIGIN_LABEL: Record<FamilyOrigin, string> = {
  starter: '시작 가문',
  gacha: '뽑기 가문',
  season: '시즌 가문',
};

// ---------- 가문 고유 카드 (13.5, 16.2의 13번) ----------

/** One card id per 성급 레벨 1~5 (the 성급 sets the level, 13.5). */
export const FAMILY_CARD_IDS = [
  'repayStrike1', // 갚는 일격 (바일)
  'repayStrike2',
  'repayStrike3',
  'repayStrike4',
  'repayStrike5',
  'windRead1', // 바람 읽기 (네아)
  'windRead2',
  'windRead3',
  'windRead4',
  'windRead5',
  'downStrike1', // 내려찍기 (오델)
  'downStrike2',
  'downStrike3',
  'downStrike4',
  'downStrike5',
  'edgeHone1', // 잔날 세우기 (아렌)
  'edgeHone2',
  'edgeHone3',
  'edgeHone4',
  'edgeHone5',
  'emberWatch1', // 잿불 살피기 (이솔)
  'emberWatch2',
  'emberWatch3',
  'emberWatch4',
  'emberWatch5',
] as const;
export type FamilyCardId = (typeof FAMILY_CARD_IDS)[number];

export const FAMILY_CARD_MAX_LEVEL = 5;

const q = (ratio: number): CardEffect => ({ type: 'quality', ratio });
const p = (ratio: number): CardEffect => ({ type: 'progress', ratio });
const heat = (amount: number): CardEffect => ({ type: 'heat', amount });

/** Level n (1-based) of each family card. Index 0 = 레벨 1. */
const FAMILY_CARD_LEVELS: Record<FamilyId, readonly CardSpecInput[]> = {
  // "외상은 반드시 갚는다." 치고 나서 쇳덩이에 내구도를 돌려준다.
  vail: [1.1, 1.2, 1.3, 1.4, 1.5].map((ratio, i): CardSpecInput => ({
    name: '갚는 일격',
    kind: 'progress',
    group: 'family',
    cost: 4,
    effects: [p(ratio), { type: 'restore', amount: [2, 2, 3, 3, 4][i] as number, overMax: false }],
  })),
  // "먼저 보고 먼저 말한다." 싸게 손을 넓힌다.
  nea: [0.4, 0.5, 0.6, 0.6, 0.8].map((ratio, i): CardSpecInput => ({
    name: '바람 읽기',
    kind: 'quality',
    group: 'family',
    cost: 1,
    effects: [q(ratio), heat(1), { type: 'draw', count: [1, 1, 1, 2, 2][i] as number }],
  })),
  // "무거운 것을 먼저 든다." 첫 손의 큰 한 방.
  odel: [2.4, 2.6, 2.8, 3.0, 3.2].map((ratio): CardSpecInput => ({
    name: '내려찍기',
    kind: 'progress',
    group: 'family',
    cost: 5,
    keywords: { firstHand: true },
    effects: [p(ratio), heat(1)],
  })),
  // "보스 앞에서 휘파람을 분다." 손에 남겨 두는 잔날.
  aren: [0.6, 0.7, 0.8, 0.9, 1.0].map((ratio, i): CardSpecInput => ({
    name: '잔날 세우기',
    kind: 'quality',
    group: 'family',
    cost: 2,
    keywords: { retain: true },
    effects: [q(ratio), heat([1, 1, 1, 1, 2][i] as number)],
  })),
  // "재가 내리면 지붕부터 쓴다." 재 속의 불씨를 골라 화로를 살린다.
  isol: [3, 2, 2, 1, 1].map((cost, i): CardSpecInput => {
    const h = [0, 0, 1, 1, 2][i] as number;
    const effects: CardEffect[] = [{ type: 'setFire', to: 'good' }];
    if (h > 0) effects.push(heat(h));
    return { name: '잿불 살피기', kind: 'support', group: 'family', cost, keywords: { exhaust: true }, effects };
  }),
};

const FAMILY_CARD_PREFIX: Record<FamilyId, string> = {
  vail: 'repayStrike',
  nea: 'windRead',
  odel: 'downStrike',
  aren: 'edgeHone',
  isol: 'emberWatch',
};

/** The family card id at a level (clamped to 1~5). */
export function familyCardId(family: FamilyId, level: number): FamilyCardId {
  const lv = Math.min(FAMILY_CARD_MAX_LEVEL, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
  return `${FAMILY_CARD_PREFIX[family]}${lv}` as FamilyCardId;
}

/** Family and level of a family card id, or null. */
export function familyCardInfo(id: string): { family: FamilyId; level: number } | null {
  for (const family of FAMILY_IDS) {
    const prefix = FAMILY_CARD_PREFIX[family];
    if (id.startsWith(prefix)) {
      const level = Number(id.slice(prefix.length));
      if (Number.isInteger(level) && level >= 1 && level <= FAMILY_CARD_MAX_LEVEL) return { family, level };
    }
  }
  return null;
}

function buildFamilyCardSpecs(): Record<FamilyCardId, CardSpecInput> {
  const out = {} as Record<FamilyCardId, CardSpecInput>;
  for (const family of FAMILY_IDS) {
    FAMILY_CARD_LEVELS[family].forEach((spec, i) => {
      out[familyCardId(family, i + 1)] = spec;
    });
  }
  return out;
}

/** Card specs merged into src/sim/data/cards.ts. */
export const FAMILY_CARD_SPECS: Record<FamilyCardId, CardSpecInput> = buildFamilyCardSpecs();

// ---------- 동료 보너스 (13.9) ----------

/**
 * 재료 선물 · 골드 선물 · 카드 강화 · 특별 수련 · 동행 원정 (13.9 보너스 종류), and the 유대 5
 * 고유 카드. Amounts by 보너스 단계 are in data/run.ts (COMPANION_BONUS).
 */
export type CompanionBonusKind = 'materialGift' | 'goldGift' | 'cardUpgrade' | 'training' | 'escort' | 'uniqueCard';

/** The 재료 선물 of a family: its body-type 계열, or 원소 결정. */
export type GiftMaterial = BodyMaterialFamily | 'crystal';

export interface StoryChoice {
  label: string;
  bonus: CompanionBonusKind;
}

/** 사연 한 단계 (유대 1·3·5): 대사 한두 줄과 선택지 2개 (13.9). The first choice is the 13.9 table's bonus. */
export interface FamilyStory {
  bond: number;
  title: string;
  lines: readonly string[];
  choices: readonly [StoryChoice, StoryChoice];
}

export interface FamilySpec {
  id: FamilyId;
  name: string;
  origin: FamilyOrigin;
  /** 한 줄 생김새. */
  look: string;
  /** 성격: 대사의 결 (6.7.1). */
  personality: string;
  weapon: WeaponType;
  tower: TowerId;
  charisma: StatTier;
  luck: StatTier;
  /** 가문 특성: 수치 없는 한 줄 개성 (6.7.3). */
  trait: string;
  /** Until there is art: a color and one emoji per family. Emoji 5.0 or older only: newer ones show as empty boxes on Windows 10 and older phones. */
  color: string;
  emoji: string;
  uniqueCardName: string;
  giftMaterial: GiftMaterial;
  /** 사연 이벤트 3단계 (유대 1·3·5). */
  stories: readonly [FamilyStory, FamilyStory, FamilyStory];
  /** 동료 사연 사건 (13.11) when no 사연 단계 opens: one line. */
  chat: string;
  /** 판 시작 인사 (주인공일 때). */
  greeting: string;
}

export const FAMILIES: Record<FamilyId, FamilySpec> = {
  vail: {
    id: 'vail',
    name: '바일',
    origin: 'starter',
    look: '어깨가 넓고 손등에 오래된 화상 자국이 있다. 품에는 늘 장부가 들어 있다.',
    personality: '무뚝뚝하지만 정직하다.',
    weapon: 'oneHandSword',
    tower: 'fire',
    charisma: 'mid',
    luck: 'mid',
    trait: '외상은 반드시 갚는다.',
    color: '#b5523b',
    emoji: '📒',
    uniqueCardName: '갚는 일격',
    giftMaterial: 'emblem',
    stories: [
      {
        bond: 1,
        title: '이자',
        lines: ['"외상은 갚는 거라고 배웠어. 이건 이자야."'],
        choices: [
          { label: '받아 둔다', bonus: 'goldGift' },
          { label: '이자는 탑에서 갚아라', bonus: 'training' },
        ],
      },
      {
        bond: 3,
        title: '장부',
        lines: ['"아버지 장부에 이 대장간 이름이 있더라. 다 지워져 있었어."'],
        choices: [
          { label: '같이 오르자', bonus: 'escort' },
          { label: '장부는 네가 들고 있어라', bonus: 'goldGift' },
        ],
      },
      {
        bond: 5,
        title: '갚는 일격',
        lines: ['"빚진 건 다 갚았어. 이제 내가 빌려줄 차례야."'],
        choices: [
          { label: '그 손버릇, 받아 두지', bonus: 'uniqueCard' },
          { label: '망치나 좀 봐 다오', bonus: 'cardUpgrade' },
        ],
      },
    ],
    chat: '바일이 장부를 넘기다 말고 탑을 올려다봤다.',
    greeting: '"갚을 게 있으면 갚고 오지."',
  },
  nea: {
    id: 'nea',
    name: '네아',
    origin: 'starter',
    look: '가는 눈매에 바람에 헝클어진 머리. 활 끝에 깃털 하나를 묶어 둔다.',
    personality: '눈치가 빠르고 말이 앞선다.',
    weapon: 'bow',
    tower: 'wind',
    charisma: 'high',
    luck: 'low',
    trait: '먼저 보고 먼저 말한다.',
    color: '#4f8a9e',
    emoji: '🏹',
    uniqueCardName: '바람 읽기',
    giftMaterial: 'feather',
    stories: [
      {
        bond: 1,
        title: '먼저 보는 눈',
        lines: ['"저 위, 날개 달린 게 셋. 넌 오른쪽만 봐."'],
        choices: [
          { label: '깃털을 받는다', bonus: 'materialGift' },
          { label: '주운 걸 팔아 오라고 한다', bonus: 'goldGift' },
        ],
      },
      {
        bond: 3,
        title: '바람 방향',
        lines: ['"바람이 바뀌면 냄새가 먼저 와. 오늘은 재 냄새."'],
        choices: [
          { label: '같이 오르자', bonus: 'escort' },
          { label: '몸부터 풀어라', bonus: 'training' },
        ],
      },
      {
        bond: 5,
        title: '바람 읽기',
        lines: ['"보이는 건 다 말해 줄게. 그다음은 네 몫이야."'],
        choices: [
          { label: '그 눈, 빌려 두지', bonus: 'uniqueCard' },
          { label: '망치나 좀 봐 다오', bonus: 'cardUpgrade' },
        ],
      },
    ],
    chat: '네아가 인사보다 먼저 탑 이야기를 꺼냈다.',
    greeting: '"위에 뭐가 있는지는 내가 먼저 볼게."',
  },
  odel: {
    id: 'odel',
    name: '오델',
    origin: 'starter',
    look: '덩치가 크고, 등에는 늘 짐이 하나 더 있다. 말보다 고개를 먼저 끄덕인다.',
    personality: '느리고 묵직하다. 남의 짐을 먼저 든다.',
    weapon: 'greatsword',
    tower: 'earth',
    charisma: 'low',
    luck: 'high',
    trait: '무거운 것을 먼저 든다.',
    color: '#7a6a4f',
    emoji: '🎒',
    uniqueCardName: '내려찍기',
    giftMaterial: 'shell',
    stories: [
      {
        bond: 1,
        title: '짐 하나 더',
        lines: ['"그 짐, 이리 줘. 무거운 건 내가 든다."'],
        choices: [
          { label: '갑각 조각을 받는다', bonus: 'materialGift' },
          { label: '짐값은 받아 둬라', bonus: 'goldGift' },
        ],
      },
      {
        bond: 3,
        title: '느린 걸음',
        lines: ['"빨리 오르는 것보다 다시 내려오는 게 어렵다."'],
        choices: [
          { label: '같이 몸을 푼다', bonus: 'training' },
          { label: '같이 오르자', bonus: 'escort' },
        ],
      },
      {
        bond: 5,
        title: '내려찍기',
        lines: ['"무거우면 내려놔. 같이 들면 된다."'],
        choices: [
          { label: '그 한 방, 받아 두지', bonus: 'uniqueCard' },
          { label: '같이 몸을 푼다', bonus: 'training' },
        ],
      },
    ],
    chat: '오델이 말없이 짐 하나를 들어 주었다.',
    greeting: '"…무거운 건 내가 먼저 든다."',
  },
  aren: {
    id: 'aren',
    name: '아렌',
    origin: 'gacha',
    look: '마른 몸에 웃는 입매. 허리춤의 단검 두 자루 가운데 하나는 쓰지 않는다.',
    personality: '가볍게 굴지만 물러서지 않는다.',
    weapon: 'dagger',
    tower: 'fire',
    charisma: 'mid',
    luck: 'mid',
    trait: '보스 앞에서 휘파람을 분다.',
    color: '#a8743a',
    emoji: '🗡️',
    uniqueCardName: '잔날 세우기',
    giftMaterial: 'emblem',
    stories: [
      {
        bond: 1,
        title: '휘파람',
        lines: ['"보스 앞에선 휘파람을 불어. 무서운 건 저쪽도 마찬가지거든."'],
        choices: [
          { label: '문장을 받는다', bonus: 'materialGift' },
          { label: '같이 오르자', bonus: 'escort' },
        ],
      },
      {
        bond: 3,
        title: '쓰지 않는 칼',
        lines: ['"이 단검은 안 써. 형 거였어."'],
        choices: [
          { label: '망치를 봐 달라고 한다', bonus: 'cardUpgrade' },
          { label: '같이 몸을 푼다', bonus: 'training' },
        ],
      },
      {
        bond: 5,
        title: '잔날 세우기',
        lines: ['"날은 잘게 세워야 오래 가. 형이 그랬어."'],
        choices: [
          { label: '그 손놀림, 받아 두지', bonus: 'uniqueCard' },
          { label: '판 돈이나 챙겨 둬라', bonus: 'goldGift' },
        ],
      },
    ],
    chat: '아렌이 휘파람을 불며 단검을 닦았다.',
    greeting: '"보스 앞에서 휘파람 불 준비는 됐어."',
  },
  isol: {
    id: 'isol',
    name: '이솔',
    origin: 'season',
    look: '재가 묻은 회색 목도리. 석궁을 등에 메고 지붕 위를 가볍게 걷는다.',
    personality: '조용하고 꼼꼼하다. 탑을 오래 올려다본다.',
    weapon: 'crossbow',
    tower: 'earth',
    charisma: 'high',
    luck: 'low',
    trait: '재가 내리면 지붕부터 쓴다.',
    color: '#8a8a8f',
    emoji: '🧣',
    uniqueCardName: '잿불 살피기',
    giftMaterial: 'crystal',
    stories: [
      {
        bond: 1,
        title: '재 쓸기',
        lines: ['"할머니는 저 탑이 처음 솟던 날 지붕의 재를 쓸었대요."'],
        choices: [
          { label: '결정을 받는다', bonus: 'materialGift' },
          { label: '망치를 봐 달라고 한다', bonus: 'cardUpgrade' },
        ],
      },
      {
        bond: 3,
        title: '재 아래',
        lines: ['"재 아래는 아직 따뜻해요. 그래서 다들 모르고 밟아요."'],
        choices: [
          { label: '주운 걸 팔아 오라고 한다', bonus: 'goldGift' },
          { label: '같이 오르자', bonus: 'escort' },
        ],
      },
      {
        bond: 5,
        title: '잿불 살피기',
        lines: ['"불씨는 재 속에서 고르는 거래요. 이번엔 제가 골라 볼게요."'],
        choices: [
          { label: '그 눈썰미, 받아 두지', bonus: 'uniqueCard' },
          { label: '같이 몸을 푼다', bonus: 'training' },
        ],
      },
    ],
    chat: '이솔이 목도리에 묻은 재를 털었다.',
    greeting: '"재가 그치면 올라가요. 아니, 지금 가요."',
  },
};

export function isFamilyId(v: unknown): v is FamilyId {
  return typeof v === 'string' && (FAMILY_IDS as readonly string[]).includes(v);
}
