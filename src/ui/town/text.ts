// 마을 지도의 문장 (기획서 1.1 '따뜻하고 하찮게', 대사는 한두 줄). Names of places are the doc's
// (9.2, src/sim/data/town.ts); these are the screen's own lines [튜닝].

import type { TownBuildingId } from '../../sim/data/town.ts';
import { TOWN_BUILDING } from '../../sim/data/town.ts';

/** The four towers by picture (9.2 '화·지·풍·수의 탑'). */
export const TOWER_NAME: Readonly<Record<string, string>> = {
  tower_water: '물의 탑',
  tower_fire: '불의 탑',
  tower_earth: '땅의 탑',
  tower_wind: '바람의 탑',
};

/** A building's name on its tag and its sheet: a tower by its element. */
export function placeName(building: TownBuildingId, key: string): string {
  return TOWER_NAME[key] ?? TOWN_BUILDING[building].name;
}

/** The one-line bubbles of the scenery (9.2 추천 '탭하면 대사 한 줄'). Taken in turn. */
export const SCENERY_LINES: Partial<Record<TownBuildingId, readonly string[]>> = {
  shop: ['손님 용사들이 물약과 붕대를 사 가는 가게. 내 무기는 여기서 안 판다.', '오늘도 붕대가 제일 잘 나간다.'],
  inn: ['창에 불이 켜져 있다. 누가 벌써 코를 곤다.', '탑에서 내려온 용사들이 국 한 그릇씩 비운다.'],
  market: ['사과 하나에 동전 하나. 흥정은 늘 진다.', '빵 냄새가 광장까지 온다.'],
  fountain: ['동전을 던지면 소원이 이루어진다고 한다. 줍는 아이도 있다.', '물소리가 좋다. 망치 소리만은 못하지만.'],
  house: ['마을 사람이 산다. 오늘은 빨래가 잘 마른다.', '창가에 화분이 하나. 누가 물을 주는지는 모른다.', '조용한 집이다. 고양이가 산다는 소문이 있다.'],
};

/** The dwarf at his door. */
export const DWARF_LINES: readonly string[] = ['손님은 아직이군. 불이나 더 지펴 둘까.', '망치가 오늘도 무겁다. 좋은 일이다.'];

/** A guest tapped on the road (9.3 '탭하면 대사 한 줄'), by hero picture. */
export const GUEST_LINES: Readonly<Record<string, readonly string[]>> = {
  hero_vail: ['처음 산 검을 아직 쓴다. 장부에도 적어 뒀다.'],
  hero_nea: ['저기! 상점에 붕대 새로 들어왔대!'],
  hero_odel: ['…이건 내 짐 아니야. 들어 주는 거야.'],
  hero_aren: ['휘파람? 아냐, 그냥 숨 쉬는 거야.'],
  hero_isol: ['탑 꼭대기는… 구름 위에 있겠지?'],
  hero_toma: ['서두를 거 없지. 물약은 도망 안 가.'],
  hero_yuna: ['결정 하나만 더 사면 다 모은다!'],
  hero_rookie: ['오, 오늘은 세 층이나 올라갔어요…!'],
  hero_ace: ['필요한 것만 사. 나머지는 짐이야.'],
  hero_veteran: ['이 무릎으로 한 층 더. 아니, 반 층.'],
};
export const GUEST_LINE_FALLBACK = '장 보러 왔어요.';

/** What is not open yet (3.2: 도전 · 스테이지 · 용사), one line each. */
export const SOON = {
  challenge: { title: '도전', what: '일일 보스 · 랭킹', line: '매일 바뀌는 보스와 순위 다툼. 곧 열린다.' },
  stage: { title: '스테이지', what: '스테이지 · 다음 층 도전', line: '용사 다섯이 끝없는 층을 오른다. 곧 열린다.' },
  heroes: { title: '용사', what: '용사 · 뽑기', line: '내 용사 목록과 뽑기. 곧 열린다.' },
} as const;

/** A tower's sheet: what will open there. */
export const TOWER_SOON = '스테이지 · 도전';

/** The buildings that lead somewhere: what the sheet says. */
export const PLACE_SHEET = {
  forge: '모루와 화로가 있는 곳. 무엇부터 할까.',
  guild: '게시판에 용사들 이름이 빼곡하다. 내 용사는 아직 없다.',
  gate: '문 너머 길이 탑으로 이어진다.',
  tower: '구름 위로 끝없이 이어진 탑. 오를 날이 온다.',
  mine: '탑에서 캐 온 광석 덩어리가 여기로 모인다.',
} as const;

/** A locked building (9.2: '몇 층에서 열리는지 이름표에 적는다'). */
export function lockedTag(floor: number): string {
  return `${floor}층에 열림`;
}
export function lockedLine(name: string, floor: number): string {
  return `${name}${topic(name)} 최고 스테이지 ${floor}층에 닿으면 열린다.`;
}

/** 은/는 after a word (by its last syllable's final consonant). */
export function topic(word: string): '은' | '는' {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '는';
  return (c - 0xac00) % 28 === 0 ? '는' : '은';
}
