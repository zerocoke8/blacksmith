// 용사·편성·스테이지·도전 화면의 문장 (기획서 1.1 '따뜻하고 하찮게', 대사는 한두 줄) [튜닝]. The
// numbers in them come from the sim; the words are the screen's.

export const STAGE_LINES = {
  title: '스테이지',
  challenging: (floor: number) => `${floor}층에 도전하는 중`,
  cleared: (floor: number) => `${floor}층 돌파!`,
  /** Quick wins in a row share a banner. */
  clearedRun: (from: number, to: number) => `${from}~${to}층 돌파!`,
  bossCleared: (floor: number) => `${floor}층 보스를 넘었다!`,
  stuck: (floor: number) => `${floor}층은 아직 버겁다.`,
  timeout: '시간이 다 됐다. 다음엔 조금 더 세게.',
  wiped: '다들 쓰러졌다. 털고 일어나면 된다.',
  hunting: (floor: number) => (floor > 0 ? `${floor}층에서 사냥하는 중` : '탑 앞 들판에서 몸 푸는 중'),
  autoOff: '자동 도전이 꺼져 있다. 도전을 누르면 한 번 오른다.',
  /** Where the way on is when stuck (6.7 막혔을 때 뚫는 길). */
  stuckHint: (floor: number) => `${floor}층은 강해지면 다시 도전한다. 정제로 레벨을 올리거나, 그 층에 맞는 무기를 쥐여 주자.`,
  lumpsPerHour: '덩어리 시간당',
  noTeam: '편성이 비었다. 편성에서 다섯을 세우자.',
  boss: '보스',
  autoOn: '자동 도전',
  next: (floor: number) => `다음 ${floor}층`,
} as const;

export const DAILY_LINES = {
  title: '도전 · 일일 보스',
  stage: (n: number) => `${n}단계`,
  tries: (n: number, max: number) => `남은 도전 ${n}/${max}`,
  won: (n: number) => `${n}단계를 쓰러뜨렸다! 도전 횟수가 다시 다섯 번이 됐다.`,
  lost: (dmg: string) => `이번엔 ${dmg}만큼 때렸다.`,
  noTries: '오늘 도전은 다 썼다. 내일 다시 오자.',
  /**
   * 그날의 기록 (8.3): the stages passed and the damage at the stage now fought, said apart
   * ('2단계 돌파 · 3단계에 0'), so a fresh stage's 0 does not read as nothing done.
   */
  record: (cleared: number, dmg: string) => (cleared > 0 ? `오늘의 기록: ${cleared}단계 돌파 · ${cleared + 1}단계에 ${dmg}` : `오늘의 기록: 1단계에 ${dmg}`),
  /** The try that just ended, apart from the record (a won try's damage is not in it). */
  thisTry: (dmg: string) => `이번 도전 ${dmg}`,
  /** A ranking row: the stage reached (the one fought now) and the damage there. */
  rankRow: (cleared: number, dmg: string) => `${cleared + 1}단계 · ${dmg}`,
  /** The day's boss: its element and body, and the element that beats it (8.5 그날에 맞춘 무기). */
  boss: (element: string, body: string, weak: string) => `${element} 속성 ${body} · 약점 ${weak}`,
  rankTitle: '무리 순위 (흉내)',
  rankNote: '비슷한 층의 용사들 약 100명과 겨룬다. 진짜 순위는 서버가 매일 매긴다.',
  me: '나',
} as const;

export const HERO_LINES = {
  title: '용사',
  list: '목록',
  formation: '편성',
  noWeapon: '맨손이다. 대장간에서 하나 쥐여 주자.',
  swap: '바꾸기',
  unequip: '내려놓기',
  noSpare: '쥘 수 있는 다른 무기가 없다.',
  passiveLocked: '금색 진화에서 열린다',
  signatureLocked: '금색 진화에서 열린다',
  signatureStrong: '빨강 진화로 강해졌다',
  signatureNone: '특급 용사만 가진다',
  notOwned: '아직 오지 않은 용사다.',
  resonance: '공명',
  heldBy: (name: string) => `${name}이(가) 쥐고 있다`,
  formationStage: '스테이지',
  formationDaily: '일일 보스',
  copyTo: (to: string) => `${to}도 이렇게`,
  copied: (to: string) => `${to} 편성도 똑같이 세웠다.`,
  full: '다섯 자리가 다 찼다.',
  offRow: '자리가 맞지 않아 열 보너스가 없다',
  pickHint: '아래에서 누르면 서고, 다시 누르면 빠진다. 끌거나 눌러서 자리를 바꾼다. 칸 아래 숫자는 전투력이다.',
  recommend: '추천 편성',
  recommended: '가장 센 다섯을 맞는 줄에 세웠다.',
  /** 6.3: five stand; fewer can still fight (a new player may not have five). */
  notFull: (n: number) => `${n}명만 서 있다. 이대로도 싸우지만, 다섯이 서면 든든하다.`,
  bare: '맨손',
} as const;

export const LEVEL_LINES = {
  expIn: (n: number) => `경험치 +${n.toLocaleString('ko-KR')}`,
  levelUp: (lv: number) => `레벨 업! Lv ${lv}`,
} as const;

/** '자리를 비운 사이 n층 기준 광석 덩어리 m개' (6.8 방치 보상, 7.1 덩어리의 단계). */
export function idleReturnLine(bestFloor: number, gained: number): string {
  return bestFloor > 0
    ? `자리를 비운 사이 ${bestFloor}층 기준 광석 덩어리 ${gained}개가 쌓였다.`
    : `자리를 비운 사이 광석 덩어리 ${gained}개가 쌓였다.`;
}
