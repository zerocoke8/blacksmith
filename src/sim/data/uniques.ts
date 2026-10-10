// 고유능력 and the 대보스 that drop their materials (기획서 4.6). [튜닝]

import type { BodyType, TowerId, UniqueId } from '../core/types.ts';

export interface UniqueSpec {
  id: UniqueId;
  name: string;
  description: string;
  tower: TowerId;
  boss: string;
  bossBody: BodyType;
  material: string;
}

export const UNIQUES: Record<UniqueId, UniqueSpec> = {
  dragonFury: {
    id: 'dragonFury',
    name: '용의 분노',
    description: '보스층에서 전투력 ×1.5',
    tower: 'fire',
    boss: '화룡',
    bossBody: 'flying',
    material: '화룡의 심장',
  },
  rebirth: {
    id: 'rebirth',
    name: '환생',
    description: '원정마다 한 번, 층 돌파에 실패해도 같은 층을 다시 판정한다',
    tower: 'fire',
    boss: '불사조',
    bossBody: 'flying',
    material: '불사조의 꼬리깃',
  },
  earthBlessing: {
    id: 'earthBlessing',
    name: '대지의 가호',
    description: '파티 보정 +0.2',
    tower: 'earth',
    boss: '대지의 거인',
    bossBody: 'armored',
    material: '거인의 핵',
  },
  allPierce: {
    id: 'allPierce',
    name: '만물 관통',
    description: '체형 상성 △를 모두 ○로 바꾼다',
    tower: 'earth',
    boss: '갑각 여왕',
    bossBody: 'armored',
    material: '여왕의 갑피',
  },
  dash: {
    id: 'dash',
    name: '질주',
    description: '원정 최대 층수 +4',
    tower: 'wind',
    boss: '폭풍 그리폰',
    bossBody: 'flying',
    material: '폭풍 깃',
  },
  fairWind: {
    id: 'fairWind',
    name: '순풍의 운',
    description: '돌파 판정을 두 번 굴려 좋은 쪽을 쓴다',
    tower: 'wind',
    boss: '바람의 정령왕',
    bossBody: 'spirit',
    material: '정령왕의 숨결',
  },
  tidalWave: {
    id: 'tidalWave',
    name: '해일',
    description: '보스가 아닌 층에서 전투력 ×1.5',
    tower: 'water',
    boss: '심해룡',
    bossBody: 'armored',
    material: '심해룡의 비늘',
  },
  iceArmor: {
    id: 'iceArmor',
    name: '빙갑',
    description: '부상·사망 확률 ×0.5',
    tower: 'water',
    boss: '서리 여왕',
    bossBody: 'spirit',
    material: '서리 왕관 조각',
  },
};

/** The two 대보스 of each tower alternate from floor 50, every 10 floors, skipping multiples of 100. */
export function greatBossAt(tower: TowerId, floor: number): UniqueSpec | null {
  if (floor < 50 || floor % 10 !== 0 || floor % 100 === 0) return null;
  const pair = Object.values(UNIQUES).filter((u) => u.tower === tower);
  const index = Math.floor((floor - 50) / 10) % 2;
  return pair[index] ?? null;
}
