// Player-facing lines for the craft screens (기획서 1.1 tone: short, warm, a little lonely).

import type { QualityTier, WeaponType } from '../../sim/core/types.ts';
import type { CraftOutcome } from '../../sim/craft/index.ts';
import { materialName, QUALITY, WEAPON_LABEL } from '../../sim/data/common.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';

const TIER_LINE: Record<QualityTier, string> = {
  1: '쓸 만은 하다. 쓸 만은.',
  2: '나쁘지 않군. 누군가의 첫 무기쯤은 되겠어.',
  3: '손에 잘 붙는다. 오래 버텨 줄 거다.',
  4: '좋은 쇠였다. 주인을 잘 만나야 할 텐데.',
  5: '…오랜만이군, 이런 게 나온 건.',
};

/** Picks the particle by the last syllable's final consonant: josa('갑피', '이', '가') → '가'. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

export function stars(tier: QualityTier): string {
  return '★'.repeat(tier) + '☆'.repeat(5 - tier);
}

export function tierName(tier: QualityTier): string {
  return QUALITY[tier].name;
}

export function weaponTitle(type: WeaponType, materialTier: number): string {
  return `${materialName(materialTier)} ${WEAPON_LABEL[type]}`;
}

/** One or two lines for the result screen. */
export function outcomeLines(outcome: CraftOutcome): string[] {
  const lines: string[] = [];
  if (outcome.success && outcome.tier !== null) {
    lines.push(TIER_LINE[outcome.tier]);
  } else if (outcome.abandoned) {
    lines.push('망치를 내려놓았다. 식은 쇠는 돌아오지 않는다.');
  } else {
    lines.push('쇠가 갈라졌다. 재료는 화로 속으로 돌아갔다.');
  }
  if (outcome.boss) {
    const u = UNIQUES[outcome.boss.unique];
    if (outcome.boss.fate === 'used') lines.push(`${josa(u.material, '이', '가')} 쇠에 스며들었다. ${josa(u.name, '이', '가')} 깃든다.`);
    else if (outcome.boss.fate === 'returned') lines.push(`${josa(u.material, '은', '는')} 다음을 위해 남겨 둔다.`);
    else lines.push(`${u.material}도 함께 재가 되었다.`);
  }
  return lines;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function percent(ratio: number): string {
  return `${Math.floor(ratio * 1000) / 10}%`;
}
