// Shared vocabulary of the simulation. Korean labels live in sim/data.

export const WEAPON_TYPES = ['oneHandSword', 'greatsword', 'dagger', 'bow', 'crossbow', 'staff'] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

/** 수 > 화 > 지 > 풍 > 수 (기획서 7.5). */
export const ELEMENTS = ['water', 'fire', 'earth', 'wind'] as const;
export type Element = (typeof ELEMENTS)[number];

/** Each tower is named by its element (기획서 7.1). */
export type TowerId = Element;

export const BODY_TYPES = ['humanoid', 'armored', 'flying', 'spirit'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const GRADES = ['N', 'C', 'B', 'A', 'S'] as const;
export type Grade = (typeof GRADES)[number];

/** ★1 범작 ~ ★5 걸작 (기획서 4.3). */
export type QualityTier = 1 | 2 | 3 | 4 | 5;

export const ENCHANT_IDS = [
  'element', // 속성 부여
  'elementBoost', // 속성 증폭
  'combo', // 연격
  'firstStrike', // 선제
  'bounty', // 풍요
  'pursuit', // 추격
  'keen', // 예리
  'pierce', // 관통
  'sturdy', // 견고
  'firstAid', // 응급 회복
  'gale', // 질풍 (상위)
  'vital', // 급소 (상위)
  'indomitable', // 불굴 (상위)
] as const;
export type EnchantId = (typeof ENCHANT_IDS)[number];

export const UNIQUE_IDS = [
  'dragonFury', // 용의 분노
  'rebirth', // 환생
  'earthBlessing', // 대지의 가호
  'allPierce', // 만물 관통
  'dash', // 질주
  'fairWind', // 순풍의 운
  'tidalWave', // 해일
  'iceArmor', // 빙갑
] as const;
export type UniqueId = (typeof UNIQUE_IDS)[number];

/** A finished weapon as the world sees it. */
export interface Weapon {
  id: string;
  type: WeaponType;
  /** Main material tier = tower band it came from (1 = 철). 기획서 4.4. */
  materialTier: number;
  quality: QualityTier;
  /**
   * Element from 속성 부여, or a staff's built-in element slot. On non-staff
   * weapons it occupies one enchant slot (see usedEnchantSlots in data/common).
   */
  element: Element | null;
  /** Filled enchant slots other than 속성 부여. Never contains 'element'. */
  enchants: EnchantId[];
  unique: UniqueId | null;
}
