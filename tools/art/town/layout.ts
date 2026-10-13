// 마을 지도 시안의 배치와 합성 수치 (tools/art/town/compose.ts가 page.js에 넘긴다). 시안이라 [튜닝] 표시 없이 여기에만 둔다.
// 지도 2458 x 4446 px = 바닥(ground_b 1024x1536)을 2.4배로 키워 하늘 760px 아래에 깐 것. 폰 화면 하나가 지도 780 x 1688 px.
// x, y = 그 그림이 땅에 닿는 점(몸통 가운데, 가장 낮은 점)의 지도 좌표.
//   건물·탑  rel: 대장간 첫 판의 권장 배율에 대한 비. 지도 배율 = F × rel (원본 px당 지도 px).
//   소품     h: 몸통 높이(지도 px).
//   사람     영웅 예제 그림은 한 배율(people.scale), 드워프는 people.dwarfScale.
// 수치 가운데 원본 px인 것: 탑의 층(stack: 원본 행), 구름 띠(band.srcH), 덧그린 외곽선(lines, people.line).

/** 지도에 놓는 그림 하나. */
export interface TownItem {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** 건물·탑: 지도 배율 = F × rel */
  readonly rel?: number;
  /** 소품: 몸통 높이 (지도 px) */
  readonly h?: number;
  /** 좌우로 뒤집는다 (그림자는 접지 타원만) */
  readonly flip?: boolean;
  /** 접지 타원의 크기 비 (울타리처럼 낮은 소품) */
  readonly ell?: number;
  /** 접지 타원 대신 직접 적은 그림자 (기준점에 대한 지도 px), 예: 마을 문 기둥마다 하나 */
  readonly spots?: readonly { readonly dx: number; readonly dy: number; readonly rx: number; readonly ry: number }[];
  readonly note?: string;
}

/** 그림 목록(assets 시트)의 칸. */
export interface SheetItem {
  readonly key: string;
  readonly name: string;
  readonly tag?: string;
  /** 투명 여백을 자르지 않고 그림 전체 */
  readonly whole?: boolean;
  /** 탑: 층을 쌓은 모습으로 */
  readonly stacked?: boolean;
}

export interface SheetGroup {
  readonly title: string;
  readonly cols?: number;
  /** 칸 높이 (px) */
  readonly ch?: number;
  readonly items: readonly SheetItem[];
}

const F = 0.5;
const SKY = 760;
const GS = 2.4;

const B = (key: string, x: number, y: number, rel: number, more: Partial<TownItem> = {}): TownItem => ({ key, x, y, rel, ...more });
const P = (key: string, x: number, y: number, h: number, more: Partial<TownItem> = {}): TownItem => ({ key: `prop_${key}`, x, y, h, ...more });
const H = (key: string, x: number, y: number, more: Partial<TownItem> = {}): TownItem => ({ key: key === 'dwarf' ? 'dwarf' : `hero_${key}`, x, y, ...more });

const items: readonly TownItem[] = [
  // ---- 탑 언덕: 구름 속으로 끝없이 오르는 탑 넷
  B('tower_water', 470, 1170, 1.2),
  B('tower_fire', 1010, 1235, 1.2),
  B('tower_earth', 1440, 1235, 1.2),
  B('tower_wind', 1990, 1170, 1.2),
  P('tree_pine', 215, 1010, 250),
  P('tree_pine', 745, 1075, 230),
  P('tree_pine', 1725, 1075, 230),
  P('tree_pine', 2255, 1010, 250),
  P('tree_round', 2420, 1180, 240),

  // ---- 왼쪽 절벽 아래: 광산 입구, 오솔길로 올라가는 길에 잇는다
  B('bld_mine', 330, 1745, 0.85),
  P('rocks', 600, 1650, 90),
  P('tree_round', 70, 1990, 260),
  P('tree_round', 960, 1720, 240),

  // ---- 왼쪽 길 위의 모험가 길드
  B('bld_guild', 640, 2440, 1.1),
  P('flowers', 380, 2490, 80),
  P('lamp', 1040, 2425, 160),
  P('tree_pine', 90, 2420, 240),

  // ---- 올라가는 길 오른쪽: 절벽 아래 집, 연못 위 오두막, 연못가의 여관
  B('bld_house_b', 1565, 1805, 0.7),
  B('bld_house_a', 2080, 1725, 0.65, { flip: true }),
  P('tree_pine', 2385, 1660, 240),
  P('tree_round', 1625, 2260, 250),
  P('lamp', 1410, 2425, 160),
  P('bush', 1800, 2400, 110),
  B('bld_inn', 2130, 2612, 0.85),
  P('flowers', 2400, 2600, 80),
  P('tree_pine', 1705, 2480, 220),
  P('signpost', 1740, 2625, 150),

  // ---- 광장: 분수, 벤치, 화분, 아래 테두리의 시장 노점과 노점 수레
  B('bld_fountain', 1230, 2835, 0.8),
  P('bench', 935, 2655, 74),
  P('bench', 1525, 2655, 74, { flip: true }),
  P('planter', 1035, 2560, 86),
  P('planter', 1425, 2560, 86, { flip: true }),
  B('bld_market', 885, 3085, 0.75),
  P('stall', 1505, 3018, 150),
  P('lamp', 720, 2615, 160),
  P('lamp', 1705, 2895, 160),
  P('lamp', 1030, 3175, 160),
  P('lamp', 1418, 3175, 160),

  // ---- 큰길 오른쪽: 대장간(주인공 건물)과 앞마당, 재료 상점, 집
  B('bld_forge', 1880, 3440, 1.2),
  P('cart', 1565, 3472, 125),
  P('crates', 2205, 3505, 105),
  P('tree_round', 2380, 3420, 250),
  P('tree_pine', 2395, 3010, 240),
  B('bld_shop', 1830, 3985, 0.8),
  P('crates', 2050, 3990, 95),
  B('bld_house_a', 2330, 3785, 0.65, { flip: true }),
  B('bld_house_b', 2290, 4310, 0.7),
  P('lamp', 1418, 3800, 160),
  P('flowers', 2060, 4170, 80),
  P('bush', 1640, 4330, 110),

  // ---- 큰길 왼쪽: 집, 울타리, 나무
  B('bld_house_a', 300, 3150, 0.65),
  P('flowers', 445, 3175, 80),
  B('bld_house_b', 620, 3560, 0.7, { flip: true }),
  P('fence', 500, 3684, 60, { ell: 0.5 }),
  P('fence', 730, 3684, 60, { ell: 0.5 }),
  P('crates', 880, 3760, 105),
  B('bld_house_a', 300, 3990, 0.65, { flip: true }),
  P('tree_round', 70, 3420, 260),
  P('tree_pine', 60, 3800, 250),
  P('tree_round', 640, 3335, 240),
  P('tree_round', 720, 4300, 250),
  P('bush', 90, 4320, 110),
  P('lamp', 1032, 3800, 160),

  // ---- 큰길을 가로지르는 마을 문. 큰길은 지도 아래 끝 밖으로 이어진다
  B('bld_gate', 1228, 4150, 1.04, {
    spots: [
      { dx: -222, dy: -3, rx: 58, ry: 16 },
      { dx: 246, dy: -3, rx: 58, ry: 16 },
      { dx: -318, dy: -3, rx: 62, ry: 11 },
      { dx: 337, dy: -3, rx: 62, ry: 11 },
    ],
    note: 'seen straight-on; one contact shadow per pillar and fence',
  }),

  // ---- 사람: 길 위, 광장에서 둘씩 마주 보는 두 쌍, 대장간 문 앞의 드워프
  H('rookie', 1215, 1920),
  H('nea', 1260, 1580, { flip: true }),
  H('veteran', 330, 2770, { flip: true }),
  H('toma', 2290, 2800),
  H('yuna', 905, 2812),
  H('aren', 990, 2818, { flip: true }),
  H('isol', 1470, 2812, { flip: true }),
  H('ace', 1555, 2818),
  H('vail', 1235, 3380),
  H('odel', 1210, 4215),
  H('dwarf', 2000, 3452),
];

/** 걷는 사람으로 쓴 영웅 예제 그림 (hero_<이름>.png, 이 저장소 밖). */
export const HERO_NAMES = ['ace', 'aren', 'isol', 'nea', 'odel', 'rookie', 'toma', 'vail', 'veteran', 'yuna'] as const;

/** 그림 목록의 '이전 → 새' 칸에 쓰는 이전 판 (원본 폴더의 버린 판). */
export const OLD_VERSIONS: Readonly<Record<string, string>> = {
  ground_b_old: 'ground_b.rejected1.png',
  bld_forge_old: 'bld_forge.rejected1.png',
  bld_gate_old: 'bld_gate.rejected3.png',
};

// 문 앞에서 큰길까지의 흙 오솔길 (지도 px; 채움은 길 모래색, 잉크 테두리는 풀 위에만)
const paths = [
  { key: 'mine', w: 74, pts: [[430, 1765], [640, 1835], [880, 1872], [1140, 1880]] },
  { key: 'guild', w: 78, pts: [[600, 2425], [592, 2540], [605, 2700]] },
  { key: 'forge', w: 84, pts: [[2040, 3400], [1900, 3482], [1640, 3500], [1330, 3490]], dots: 3 },
  { key: 'shop', w: 72, pts: [[1760, 3975], [1580, 4020], [1330, 4015]] },
  { key: 'inn', w: 70, pts: [[2105, 2600], [2110, 2720]] },
  { key: 'house_b_left', w: 56, pts: [[700, 3550], [880, 3600], [1100, 3590]], dots: 1 },
];

const sheet: readonly SheetGroup[] = [
  {
    title: '이번에 다시 뽑은 그림 (이전 → 새)',
    cols: 4,
    ch: 330,
    items: [
      { key: 'bld_forge_old', name: '대장간 (이전)' },
      { key: 'bld_forge', name: '대장간 (새)', tag: '채택' },
      { key: 'bld_gate_old', name: '마을 문 (이전)' },
      { key: 'bld_gate', name: '마을 문 (새, 정면)', tag: '채택' },
      { key: 'ground_b_old', name: '바닥 (이전)', whole: true },
      { key: 'ground_b_raw', name: '바닥 (새, 원본)', tag: '채택: 선 한 겹 얇게, 2.4배', whole: true },
      { key: 'cloud_band', name: '구름 띠 (새)', tag: '좌우 뒤집어 이어 붙임', whole: true },
      { key: 'prop_bench', name: '벤치 (새)' },
      { key: 'prop_planter', name: '꽃 화분 (새)' },
      { key: 'prop_stall', name: '노점 수레 (새)' },
    ],
  },
  {
    title: '건물 (탑은 가운데 층을 쌓아 늘림)',
    items: (
      [
        ['bld_forge', '대장간'],
        ['bld_guild', '모험가 길드'],
        ['bld_shop', '상점'],
        ['bld_inn', '여관'],
        ['bld_market', '시장'],
        ['bld_house_a', '집 A'],
        ['bld_house_b', '집 B'],
        ['bld_mine', '광산 입구'],
        ['bld_gate', '마을 문'],
        ['bld_fountain', '분수'],
        ['tower_water', '물의 탑 (8층 쌓음)'],
        ['tower_fire', '불의 탑 (9층 쌓음)'],
        ['tower_earth', '땅의 탑 (8층 쌓음)'],
        ['tower_wind', '바람의 탑 (9층 쌓음)'],
      ] as const
    ).map(([key, name]) => ({ key, name, stacked: key.startsWith('tower_') })),
  },
  {
    title: '소품',
    items: (
      [
        ['prop_tree_round', '둥근 나무'],
        ['prop_tree_pine', '뾰족 나무'],
        ['prop_bush', '덤불'],
        ['prop_rocks', '바위'],
        ['prop_flowers', '꽃'],
        ['prop_fence', '울타리'],
        ['prop_lamp', '가로등'],
        ['prop_crates', '상자'],
        ['prop_signpost', '이정표'],
        ['prop_cart', '광석 수레'],
        ['prop_bench', '벤치'],
        ['prop_planter', '꽃 화분'],
        ['prop_stall', '노점 수레'],
      ] as const
    ).map(([key, name]) => ({ key, name })),
  },
  {
    title: '걷는 사람 (영웅 예제, 기준 드워프)',
    ch: 250,
    items: (
      [
        ['dwarf', '드워프'],
        ['hero_vail', '바일'],
        ['hero_nea', '네아'],
        ['hero_odel', '오델'],
        ['hero_aren', '아렌'],
        ['hero_isol', '이솔'],
        ['hero_toma', '토마'],
        ['hero_yuna', '유나'],
        ['hero_rookie', '신참'],
        ['hero_ace', 'S급 마법사'],
        ['hero_veteran', '노장'],
      ] as const
    ).map(([key, name]) => ({ key, name })),
  },
];

export const config = {
  ground: 'ground_b',
  groundScale: GS,
  sky: SKY,
  skyColor: '#CFE3EA',
  /** 바닥의 잉크 선(과 갈색 번짐)을 2.4배 그림에서 양쪽 3px씩 깎는다 */
  thin: { r: 3 },
  sharpen: null,
  F,
  items,
  paths,
  pathStyle: { fill: '#e8c291', ink: '#432b1b', dot: '#d3a877', line: 8, seed: 5 },
  /**
   * 탑의 층 (원본 px 행): top~bot = 창 위의 맨 벽에서 다음 창 위의 맨 벽까지 (고리에서 고리까지 한 주기).
   * n번 쌓고, 한 층 올라갈 때마다 shrink배로 줄인다.
   */
  stack: {
    tower_water: { top: 580, bot: 908, n: 8, shrink: 0.95 },
    tower_fire: { top: 585, bot: 904, n: 9, shrink: 0.95 },
    tower_earth: { top: 580, bot: 900, n: 8, shrink: 0.95 },
    tower_wind: { top: 590, bot: 908, n: 9, shrink: 0.95 },
  },
  cloudStyle: { top: '#F7F9FA', under: '#DCE4EA', line: 8, seed: 3 },
  /** 고원 너머 지평선의 낮은 구름 줄 (바닥 그림의 위 끝을 가린다) */
  horizon: { y: SKY + 6, r: 78, step: 112, jit: 26, seed: 4 },
  /** 탑이 구름 띠로 들어가는 자리를 감싸는 구름 고리 */
  rings: [
    { x: 470, y: 372, w: 250, r: 64, n: 5 },
    { x: 1010, y: 318, w: 250, r: 60, n: 5 },
    { x: 1440, y: 352, w: 250, r: 62, n: 5 },
    { x: 1990, y: 306, w: 250, r: 60, n: 5 },
  ],
  /** 구름 띠 그림의 원본 0~srcH행을 h px 높이로, x0부터 좌우로 뒤집어 가며 이어 붙인다 */
  band: { key: 'cloud_band', srcH: 530, h: 360, y: 0, x0: -140 },
  /** 대장간 굴뚝 연기: 위로, 오른쪽으로 흘러가는 작은 구름 무리 */
  smoke: [
    { x: 1786, y: 2912, r: 22 },
    { x: 1800, y: 2900, r: 20 },
    { x: 1796, y: 2866, r: 26 },
    { x: 1818, y: 2856, r: 28 },
    { x: 1808, y: 2840, r: 22 },
    { x: 1822, y: 2808, r: 32 },
    { x: 1852, y: 2800, r: 33 },
    { x: 1838, y: 2780, r: 28 },
    { x: 1860, y: 2740, r: 38 },
    { x: 1898, y: 2734, r: 36 },
    { x: 1880, y: 2708, r: 32 },
  ],
  smokeStyle: { top: '#FBF9F5', under: '#E2DFD9', line: 7 },
  people: { scale: 0.094, line: 24, dwarfScale: 0.1025, dwarfLine: 20 },
  shadow: { color: '#c3cba6', mode: 'multiply' },
  /** 아주 작게 그리는 소품에 덧그리는 바깥 잉크 (원본 px), 건물과 선 굵기를 맞춘다 */
  lines: { prop_crates: 18, prop_flowers: 16, prop_lamp: 8, prop_fence: 12, prop_bush: 6, prop_bench: 14, prop_planter: 14, prop_stall: 8 },
  overviewH: 1400,
  /** 폰 화면 셋 (지도 1:1, 780 x 1688). file에 확장자는 compose가 붙인다 */
  views: [
    { file: 'view_forge', x: 1478, y: 2640, label: '대장간' },
    { file: 'view_plaza', x: 840, y: 1990, label: '광장' },
    { file: 'view_towers', x: 834, y: 0, label: '탑 언덕' },
  ],
  /** 폰 화면의 UI 목업 (위 칩, 아래 메뉴 버튼) */
  ui: {
    gold: '12,480',
    chunk: '180',
    buttons: [
      { label: '대장간', icon: 'bld_forge', on: true },
      { label: '정제', icon: 'ui_chunk' },
      { label: '길드', icon: 'bld_guild' },
      { label: '가방', icon: 'ui_bag' },
    ],
  },
  sheet,
};
