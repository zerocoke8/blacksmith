// 가문 견본 (기획서 6.7.1, 공통부): 시작 가문 3 (바일, 네아, 오델) + 6.7.1 예시의 아렌 (뽑기).
// Only the fixed profile of each family lives here: 이름, 생김새, 성격, 주무기, 즐겨 오르는 탑,
// 인망·운, 가문 특성 한 줄, and a color and emoji until there is art. Nothing reads it yet; the
// idle world's 현역 슬롯 (6.7.8) will. 인망·운 are [튜닝] starting values; change them here.

import type { TowerId, WeaponType } from '../core/types.ts';
import type { StatTier } from './world.ts';

export const FAMILY_IDS = ['vail', 'nea', 'odel', 'aren'] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

/** 얻는 길: 시작 가문 (무료) or 가문 뽑기 (6.7, 15.2). */
export type FamilyOrigin = 'starter' | 'gacha';

export const FAMILY_ORIGIN_LABEL: Record<FamilyOrigin, string> = {
  starter: '시작 가문',
  gacha: '뽑기 가문',
};

/** 정해진 것 (6.7.1). The same in every 세대; 나이와 장신구 by 대수 come later (6.7.2). */
export interface FamilySpec {
  id: FamilyId;
  /** 가문 이름이 곧 용사 이름이다. */
  name: string;
  origin: FamilyOrigin;
  /** 한 줄 생김새. */
  look: string;
  /** 성격: 대사의 결 (6.7.1). */
  personality: string;
  weapon: WeaponType;
  /** 즐겨 오르는 탑: fixed, never the 6.3 tower roll. */
  tower: TowerId;
  charisma: StatTier;
  luck: StatTier;
  /** 가문 특성: 수치 없는 한 줄 개성 (6.7.3). */
  trait: string;
  /** Until there is art: a color and one emoji per family. Emoji 5.0 or older only: newer ones show as empty boxes on Windows 10 and older phones. */
  color: string;
  emoji: string;
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
  },
};

export function isFamilyId(v: unknown): v is FamilyId {
  return typeof v === 'string' && (FAMILY_IDS as readonly string[]).includes(v);
}
