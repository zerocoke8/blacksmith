// Player-facing lines for world events (기획서 1.1: short, warm, a little lonely).
// Heroes have no names yet (14.2), so lines call them by grade and weapon.

import type { Grade, WeaponType } from '../core/types.ts';
import { WEAPON_LABEL } from '../data/common.ts';

/** Picks 을/를 (or similar pairs) by whether the last syllable has a final consonant. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return withoutFinal;
  return code % 28 === 0 ? withoutFinal : withFinal;
}

function heroLabel(grade: Grade, type: WeaponType): string {
  return `${grade}급 ${WEAPON_LABEL[type]} 용사`;
}

export function deathLine(grade: Grade, type: WeaponType): string {
  const weapon = WEAPON_LABEL[type];
  return `${heroLabel(grade, type)}가 돌아오지 않았다. 그의 ${weapon}도.`;
}

export function retireLine(grade: Grade, type: WeaponType): string {
  const weapon = WEAPON_LABEL[type];
  return `${heroLabel(grade, type)}가 ${weapon}${josa(weapon, '을', '를')} 내려놓았다. 곧 그의 제자가 온다고 한다.`;
}

export const RETIRE_HINT_LINE = '"슬슬 은퇴를 생각 중이야."';

export const DEMON_LORD_LINE = '"또 쓰러졌다는군. 사흘 뒤면 다시 일어나겠지."';
