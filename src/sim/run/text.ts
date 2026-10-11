// Player-facing lines of a run (기획서 1.1: 따뜻하지만 쓸쓸하게, 대사는 한두 줄, 죽음은 담담하게;
// 13.7, 13.11, 13.12 문장 예). Numbers and names come from the data files.

import type { BodyMaterialFamily } from '../cards/enchant.ts';
import { cardName } from '../cards/text.ts';
import { BODY_LABEL, ELEMENT_LABEL, materialName, QUALITY, WEAPON_LABEL } from '../data/common.ts';
import { ENCHANTS } from '../data/enchants.ts';
import { FACTOR_LABEL, FACTOR_VALUES } from '../data/run.ts';
import { UNIQUES } from '../data/uniques.ts';
import type { Weapon } from '../core/types.ts';
import { josa } from '../world/messages.ts';
import type { Factor } from './types.ts';

const UNITS = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'] as const;
const UNIT_COUNTER = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'] as const;
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'] as const;

/**
 * 고유어 수 before a counter: 30 → '서른', 21 → '스물한', 20 → '스무', 3 → '세'. From 100 up,
 * digits ('120').
 */
export function nativeCount(n: number): string {
  const k = Math.floor(n);
  if (k < 1 || k > 99) return `${k}`;
  const tens = Math.floor(k / 10);
  const units = k % 10;
  if (units === 0) return tens === 2 ? '스무' : (TENS[tens] as string);
  return `${TENS[tens] as string}${UNIT_COUNTER[units] as string}`;
}

/** 고유어 수 on its own: 21 → '스물하나'. */
export function nativeNumber(n: number): string {
  const k = Math.floor(n);
  if (k < 1 || k > 99) return `${k}`;
  return `${TENS[Math.floor(k / 10)] as string}${UNITS[k % 10] as string}`;
}

/** '서른 층' (13.7 문장 예). */
export function floorWords(floor: number): string {
  return floor >= 1 && floor <= 99 ? `${nativeCount(floor)} 층` : `${floor}층`;
}

export const subj = (w: string): string => `${w}${josa(w, '이', '가')}`;
export const topic = (w: string): string => `${w}${josa(w, '은', '는')}`;
export const obj = (w: string): string => `${w}${josa(w, '을', '를')}`;

/** Fills '{name}' slots; '{name}{이}' / '{을}' / '{은}' pick the particle for the word before. */
export function fillLine(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}(?:\{(이|을|은)\})?/g, (_all, key: string, particle: string | undefined) => {
    const v = values[key] ?? '';
    if (particle === '이') return subj(v);
    if (particle === '을') return obj(v);
    if (particle === '은') return topic(v);
    return v;
  });
}

// ---------- Weapons ----------

/** '★3 역작 화속성 강철 단검 (관통·연격)'. */
export function weaponTitle(w: Pick<Weapon, 'type' | 'materialTier' | 'quality' | 'element' | 'enchants' | 'unique'>): string {
  const element = w.element === null ? '' : `${ELEMENT_LABEL[w.element]}속성 `;
  const extras = [...w.enchants.map((id) => ENCHANTS[id].name), ...(w.unique === null ? [] : [UNIQUES[w.unique].name])];
  const tail = extras.length > 0 ? ` (${extras.join('·')})` : '';
  return `★${w.quality} ${QUALITY[w.quality].name} ${element}${materialName(w.materialTier)} ${WEAPON_LABEL[w.type]}${tail}`;
}

// ---------- Lines ----------

/** 벽에서 은퇴 (13.7 문장 예). */
export function wallRetireLine(name: string, weaponLabel: string, record: number): string {
  const tail = record >= 20 ? '짧지 않았다.' : '그래도 거기까지 올랐다.';
  return `${subj(name)} 탑 앞에서 ${obj(weaponLabel)} 내려놓았다. ${floorWords(Math.max(record, 1))}. ${tail}`;
}

/** 마지막 등반 끝 (13.7 문장 예). */
export function climbEndLine(name: string, floor: number): string {
  return `${topic(name)} ${floorWords(floor)}에서 돌아섰다. 위는 아직 끝이 없다.`;
}

/** 판 안의 사망 ([검증] 스위치 '사망'일 때, 1.1의 사망 문장). */
export function deathLine(name: string, weaponLabel: string): string {
  return `${subj(name)} 돌아오지 않았다. 그의 ${weaponLabel}도.`;
}

/** 중상 (13.11 문장 예). */
export function severeLine(name: string): string {
  return `${subj(name)} 업혀서 돌아왔다. 숨은 붙어 있다.`;
}

export function injuryLine(name: string): string {
  return `${subj(name)} 다리를 절며 돌아왔다. 쉬어야 낫는다.`;
}

/** 플레이어가 [은퇴]를 눌렀을 때. */
export function retireLine(name: string, weaponLabel: string): string {
  return `${subj(name)} ${obj(weaponLabel)} 내려놓았다. 여기까지로 한다.`;
}

/** 벽 1턴 전 경고 (13.7). */
export function wallWarnLine(floor: number): string {
  return `다음 턴까지 ${floor}층을 넘지 못하면, 거기까지다.`;
}

/** 마감 턴 (벽 도전). */
export function wallTodayLine(floor: number): string {
  return `이번 턴에 ${floor}층을 넘지 못하면, 거기까지다.`;
}

export function bossDownLine(boss: string): string {
  return `${obj(boss)} 넘었다.`;
}

/** 교류 (13.4.1): '바일과 시간을 보냈다. 유대 2'. */
export function bondLine(name: string, bond: number): string {
  return `${name}${josa(name, '과', '와')} 시간을 보냈다. 유대 ${bond}`;
}

export const MERCHANT_LINE = '탑 앞엔 늘 장사꾼이 먼저 온다.';
export const ARTISAN_LINE = '"망치 잡는 법이 옛날 그대로군. 하나만 가르쳐 주지."';
export const HALL_LINE = '"이름을 벽에 걸어 두지. 다음 녀석이 보도록."';
export const REST_LINE = '하루를 쉬었다. 탑은 그대로 거기 있다.';
export const MAINTAIN_LINE = '날을 세우고 손잡이를 감았다. 다음 원정은 한결 가볍다.';
export const FORGE_FAIL_LINE = '"쇠가 갈라졌다. 오늘은 여기까지다."';

/** 재료 발견 (13.11 문장 예: 칼깃). */
export const FIND_LINE: Record<BodyMaterialFamily, string> = {
  feather: '깃털 하나가 바람에 걸려 있었다. 아직 날이 서 있다.',
  emblem: '부서진 문장 하나가 재 속에 묻혀 있었다.',
  shell: '갑각 조각 하나가 계단에 박혀 있었다.',
  soulDust: '식은 영혼 가루가 한 줌 모여 있었다.',
};

/** '강함 2단계: 시작 힘 +0.1', '비행 사냥꾼 3단계: …' (전설 용사 카드와 선대 고르기, 13.10). */
export function factorText(f: Factor): string {
  const lv = `${f.level}단계`;
  const v = (kind: Exclude<Factor['kind'], 'card'>): number => {
    const table = FACTOR_VALUES[kind];
    return table[Math.min(table.length, Math.max(1, f.level)) - 1] as number;
  };
  switch (f.kind) {
    case 'strength':
      return `${FACTOR_LABEL.strength} ${lv}: 시작 힘 +${v('strength')}`;
    case 'mastery':
      return `${FACTOR_LABEL.mastery} ${lv}: 숙련 판정 +${v('mastery')}층`;
    case 'charisma':
      return `${FACTOR_LABEL.charisma} ${lv}: 파티 보정 +${v('charisma')}`;
    case 'toughness':
      return `${FACTOR_LABEL.toughness} ${lv}: 부상 확률 ×${v('toughness')}`;
    case 'towerAdapt':
      return `${FACTOR_LABEL.towerAdapt} ${lv}: 전투력 ×${v('towerAdapt')}`;
    case 'hunter':
      return `${f.body === null ? '' : `${BODY_LABEL[f.body]} `}${FACTOR_LABEL.hunter} ${lv}: 그 체형 상대 전투력 ×${v('hunter')}`;
    case 'card': {
      const card = f.level >= 2 && f.evolved !== null ? f.evolved : f.card;
      return `${FACTOR_LABEL.card} ${lv}: ${card === null ? '' : cardName(card)}`;
    }
  }
}

/** 주 선대의 무기를 물려받을 때 (13.18). */
export function ancestorWeaponLine(weaponLabel: string): string {
  return `"…이 ${weaponLabel}, 내가 만든 거다. 이번엔 네 손에 맞춰 주지."`;
}
