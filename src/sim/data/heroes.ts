// 용사 (기획서 5장, B.16). Every number here is a [튜닝] starting value; the doc leaves most of
// them [미정] (16장의 5·6·8번) and says the numbers live here. Change them here, not at call sites.
// The roster (36 heroes) is tools/art/roster/roster.json moved over as data: key, name, rarity,
// element, weapon, role, line. The roster file's 불·물·땅·바람 are the doc's 화·수·지·풍.

import type { Element, WeaponType } from '../core/types.ts';
import { powInt } from './common.ts';

// ---------- Rarity, role, row ----------

export const HERO_RARITIES = ['special', 'normal'] as const;
export type HeroRarity = (typeof HERO_RARITIES)[number];
export const HERO_RARITY_LABEL: Record<HeroRarity, string> = { special: '특급', normal: '일반' };

/** 역할 (5.2): the weapon type decides it; a staff is ranged or a healer. */
export const HERO_ROLES = ['melee', 'ranged', 'healer'] as const;
export type HeroRole = (typeof HERO_ROLES)[number];
export const HERO_ROLE_LABEL: Record<HeroRole, string> = { melee: '근접', ranged: '원거리', healer: '힐러' };

/** 앞열·뒷열 (6.3). */
export const FORMATION_ROWS = ['front', 'back'] as const;
export type FormationRow = (typeof FORMATION_ROWS)[number];
export const FORMATION_ROW_LABEL: Record<FormationRow, string> = { front: '앞열', back: '뒷열' };

/** Melee weapons stand in front, ranged ones at the back (6.3). Healers carry staffs. */
export const WEAPON_ROLE: Record<WeaponType, 'melee' | 'ranged'> = {
  oneHandSword: 'melee',
  greatsword: 'melee',
  dagger: 'melee',
  bow: 'ranged',
  crossbow: 'ranged',
  staff: 'ranged',
};

/** The row where a role gets the row bonus (6.3: 근접은 앞열, 원거리·힐러는 뒷열). */
export const ROLE_ROW: Record<HeroRole, FormationRow> = { melee: 'front', ranged: 'back', healer: 'back' };

// ---------- Base stats (5.4) [튜닝] ----------

/**
 * Stats at level 1, 동별 1, before the weapon. 체력·방어 come from the hero (role), 공격 from the
 * weapon × the role's share (5.4: 근접은 체력·방어가 높고, 원거리는 공격이 높다).
 */
export interface RoleBase {
  hp: number;
  def: number;
  /** Multiplies the weapon's attack. */
  attack: number;
}

export const ROLE_BASE: Record<HeroRole, RoleBase> = {
  melee: { hp: 1200, def: 60, attack: 1.0 },
  ranged: { hp: 700, def: 30, attack: 1.1 },
  healer: { hp: 800, def: 35, attack: 0.6 },
};

/**
 * Base stats by rarity: the same for both (5.1 추천 '같은 레벨·별·진화 색에서 기본 능력치는 같게',
 * [미정] 16장의 8번). The special's edge is the passive, the signature and the longer ladder.
 */
export const RARITY_BASE_MULT: Record<HeroRarity, number> = { special: 1, normal: 1 };

// ---------- Skills (5.4) [튜닝] ----------

/** What a skill does when it goes off. */
export type SkillEffect =
  /** Hits the front-most living enemies: `targets` of them (or all), `hits` times each, power × attack. */
  | { kind: 'hit'; targets: number | 'all'; hits: number; power: number }
  /** Heals every living ally by `share` of that ally's max HP. */
  | { kind: 'heal'; share: number };

export interface SkillSpec {
  id: string;
  name: string;
  /** One line for the hero screen (built from the numbers below in skillText). */
  effect: SkillEffect;
  /** Active skills only: ticks between casts (10 ticks = 1 s). */
  cooldownTicks: number;
}

/** Which skill set a hero uses: the weapon, or 'healer' for a healer's staff. */
export type SkillKey = WeaponType | 'healer';

export function skillKeyOf(hero: { weapon: WeaponType; role: HeroRole }): SkillKey {
  return hero.role === 'healer' ? 'healer' : hero.weapon;
}

/**
 * 액티브 스킬 (5.4): one, cast by itself every cooldown. One default per weapon (and the healer).
 * Single-target ones are tuned to about 0.4 × attack a second, the spread ones trade that for
 * more targets (4.8 '기대 데미지는 같게'; the group-vs-boss shape is the weapon's character).
 */
export const ACTIVE_SKILLS: Record<SkillKey, SkillSpec> = {
  oneHandSword: { id: 'slash', name: '힘껏 베기', effect: { kind: 'hit', targets: 1, hits: 1, power: 2.4 }, cooldownTicks: 60 },
  greatsword: { id: 'sweep', name: '휘둘러 베기', effect: { kind: 'hit', targets: 3, hits: 1, power: 1.2 }, cooldownTicks: 70 },
  dagger: { id: 'flurry', name: '연속 찌르기', effect: { kind: 'hit', targets: 1, hits: 3, power: 0.67 }, cooldownTicks: 50 },
  bow: { id: 'pierceShot', name: '꿰뚫는 화살', effect: { kind: 'hit', targets: 3, hits: 1, power: 1.1 }, cooldownTicks: 60 },
  crossbow: { id: 'aimedShot', name: '조준 사격', effect: { kind: 'hit', targets: 1, hits: 1, power: 3.2 }, cooldownTicks: 80 },
  staff: { id: 'burst', name: '마법 터뜨리기', effect: { kind: 'hit', targets: 'all', hits: 1, power: 0.9 }, cooldownTicks: 80 },
  healer: { id: 'mend', name: '호호 불어 주기', effect: { kind: 'heal', share: 0.15 }, cooldownTicks: 70 },
};

/**
 * 필살기 (5.4, 5.6): specials only, opened by the gold evolution and made stronger (×SIGNATURE_RED_MULT)
 * by the red one. Goes off by itself when its gauge fills (15장의 6번 추천). cooldownTicks is unused.
 */
export const SIGNATURES: Record<SkillKey, SkillSpec> = {
  oneHandSword: { id: 'breakthrough', name: '정면 돌파', effect: { kind: 'hit', targets: 1, hits: 1, power: 6 }, cooldownTicks: 0 },
  greatsword: { id: 'groundSplit', name: '땅 가르기', effect: { kind: 'hit', targets: 'all', hits: 1, power: 2.5 }, cooldownTicks: 0 },
  dagger: { id: 'shadowDance', name: '그림자 난도질', effect: { kind: 'hit', targets: 1, hits: 6, power: 1 }, cooldownTicks: 0 },
  bow: { id: 'arrowRain', name: '화살비', effect: { kind: 'hit', targets: 'all', hits: 1, power: 2.2 }, cooldownTicks: 0 },
  crossbow: { id: 'oneShot', name: '한 발 승부', effect: { kind: 'hit', targets: 1, hits: 1, power: 6.5 }, cooldownTicks: 0 },
  staff: { id: 'bigSpell', name: '큰 주문', effect: { kind: 'hit', targets: 'all', hits: 1, power: 2.5 }, cooldownTicks: 0 },
  healer: { id: 'allUp', name: '다들 일어나', effect: { kind: 'heal', share: 0.45 }, cooldownTicks: 0 },
};

/** 빨강 진화의 필살기 강화 (5.6): the signature's power or heal × this. */
export const SIGNATURE_RED_MULT = 1.5;

// ---------- Passives (5.4) [튜닝] ----------

/**
 * A passive is one simple number (5.4 지킬 것: it does not do the weapon's job — no element, no
 * body matchup, no enchant).
 * - atk / hp / def: the hero's own stat +value (share).
 * - crit: crit rate +value (absolute).
 * - haste: active skill cooldown −value (share).
 * - boss / mob: damage to bosses / to non-boss enemies +value.
 * - teamAtk / teamDef / teamHp: every hero in the formation +value (the hero included).
 * - heal: healing done +value.
 * - lastStand: attack +value while the hero is at half HP or under.
 * - opener: the hero's first attack of a battle × (1 + value).
 */
export type PassiveKind =
  | 'atk'
  | 'hp'
  | 'def'
  | 'crit'
  | 'haste'
  | 'boss'
  | 'mob'
  | 'teamAtk'
  | 'teamDef'
  | 'teamHp'
  | 'heal'
  | 'lastStand'
  | 'opener';

export interface PassiveSpec {
  name: string;
  kind: PassiveKind;
  value: number;
}

function pct(v: number): number {
  return Math.round(v * 100);
}

/** The passive's line for the hero screen, from its number (one place for the number). */
export function passiveText(p: Pick<PassiveSpec, 'kind' | 'value'>): string {
  switch (p.kind) {
    case 'atk':
      return `공격 +${pct(p.value)}%`;
    case 'hp':
      return `체력 +${pct(p.value)}%`;
    case 'def':
      return `방어 +${pct(p.value)}%`;
    case 'crit':
      return `치명률 +${pct(p.value)}%p`;
    case 'haste':
      return `스킬 쿨타임 −${pct(p.value)}%`;
    case 'boss':
      return `보스에게 주는 피해 +${pct(p.value)}%`;
    case 'mob':
      return `잡몹에게 주는 피해 +${pct(p.value)}%`;
    case 'teamAtk':
      return `편성 모두의 공격 +${pct(p.value)}%`;
    case 'teamDef':
      return `편성 모두의 방어 +${pct(p.value)}%`;
    case 'teamHp':
      return `편성 모두의 체력 +${pct(p.value)}%`;
    case 'heal':
      return `치료량 +${pct(p.value)}%`;
    case 'lastStand':
      return `체력이 절반 아래면 공격 +${pct(p.value)}%`;
    case 'opener':
      return `전투의 첫 공격 피해 ×${Math.round((1 + p.value) * 10) / 10}`;
  }
}

/** A skill's line for the hero screen. */
export function skillText(s: SkillSpec, mult = 1): string {
  const e = s.effect;
  if (e.kind === 'heal') return `편성 모두의 체력을 ${pct(e.share * mult)}% 채운다`;
  const who = e.targets === 'all' ? '적 모두' : e.targets === 1 ? '맨 앞의 적' : `앞의 적 ${e.targets}마리`;
  const power = Math.round(e.power * mult * 100);
  return e.hits > 1 ? `${who}에게 공격의 ${power}%로 ${e.hits}번` : `${who}에게 공격의 ${power}%`;
}

// ---------- The roster (5.8, roster.json) ----------

export interface HeroSpec {
  /** roster.json key = art key (src/assets/art/heroes/<key>.webp). */
  key: string;
  name: string;
  rarity: HeroRarity;
  element: Element;
  weapon: WeaponType;
  role: HeroRole;
  /** 한 줄 (5.8): personality, no numbers. */
  line: string;
  /** Specials: always on. Normals: opens at the gold evolution (5.4). */
  passive: PassiveSpec;
}

export const HEROES = [
  // 특급 24 (속성 4 × 무기 6)
  { key: 'hero_vail', name: '바일', rarity: 'special', element: 'fire', weapon: 'oneHandSword', role: 'melee', line: '빌린 건 반드시 갚는다.', passive: { name: '받은 만큼 갚기', kind: 'lastStand', value: 0.25 } },
  { key: 'hero_sien', name: '시엔', rarity: 'special', element: 'water', weapon: 'oneHandSword', role: 'melee', line: '검을 쓴 날보다 닦은 날이 많다.', passive: { name: '반짝 닦은 날', kind: 'crit', value: 0.08 } },
  { key: 'hero_dowin', name: '도윈', rarity: 'special', element: 'earth', weapon: 'oneHandSword', role: 'melee', line: '힘은 장사인데, 말을 걸면 귀가 빨개진다.', passive: { name: '장사 체력', kind: 'hp', value: 0.2 } },
  { key: 'hero_kio', name: '키오', rarity: 'special', element: 'wind', weapon: 'oneHandSword', role: 'melee', line: '바람개비가 안 돌면 하루 쉰다.', passive: { name: '바람개비 돌리기', kind: 'haste', value: 0.2 } },
  { key: 'hero_odel', name: '오델', rarity: 'special', element: 'earth', weapon: 'greatsword', role: 'melee', line: '무거운 것을 먼저 든다.', passive: { name: '남의 짐까지', kind: 'teamDef', value: 0.1 } },
  { key: 'hero_veteran', name: '베르다', rarity: 'special', element: 'fire', weapon: 'greatsword', role: 'melee', line: '은퇴는 내일 한다. 매일 그렇게 말한다.', passive: { name: '은퇴는 내일', kind: 'def', value: 0.25 } },
  { key: 'hero_rona', name: '로나', rarity: 'special', element: 'water', weapon: 'greatsword', role: 'melee', line: '뱃멀미가 심해서 탑에 왔다.', passive: { name: '노 젓는 박자', kind: 'teamHp', value: 0.08 } },
  { key: 'hero_daro', name: '다로', rarity: 'special', element: 'wind', weapon: 'greatsword', role: 'melee', line: '칼보다 키가 작다. 아직은.', passive: { name: '아직 크는 중', kind: 'atk', value: 0.15 } },
  { key: 'hero_aren', name: '아렌', rarity: 'special', element: 'fire', weapon: 'dagger', role: 'melee', line: '보스 앞에서 휘파람을 분다.', passive: { name: '휘파람', kind: 'boss', value: 0.2 } },
  { key: 'hero_seon', name: '세온', rarity: 'special', element: 'water', weapon: 'dagger', role: 'melee', line: '머리 위 개구리와 말이 잘 통한다.', passive: { name: '개구리의 귀띔', kind: 'crit', value: 0.1 } },
  { key: 'hero_hern', name: '헤른', rarity: 'special', element: 'earth', weapon: 'dagger', role: 'melee', line: '잡초에게도 이름을 지어 준다.', passive: { name: '잡초 이름 짓기', kind: 'mob', value: 0.15 } },
  { key: 'hero_pia', name: '피아', rarity: 'special', element: 'wind', weapon: 'dagger', role: 'melee', line: '편지는 꼭 전한다. 가끔 옆집에.', passive: { name: '빠른 편지', kind: 'haste', value: 0.15 } },
  { key: 'hero_nea', name: '네아', rarity: 'special', element: 'wind', weapon: 'bow', role: 'ranged', line: '먼저 보고 먼저 말한다.', passive: { name: '먼저 보기', kind: 'opener', value: 2 } },
  { key: 'hero_nua', name: '누아', rarity: 'special', element: 'water', weapon: 'bow', role: 'ranged', line: '눈물이 많다. 화살은 똑바로 간다.', passive: { name: '똑바로 가는 화살', kind: 'atk', value: 0.12 } },
  { key: 'hero_boro', name: '보로', rarity: 'special', element: 'fire', weapon: 'bow', role: 'ranged', line: '불화살로 고구마를 굽는다.', passive: { name: '군고구마 나눔', kind: 'teamAtk', value: 0.06 } },
  { key: 'hero_elda', name: '엘다', rarity: 'special', element: 'earth', weapon: 'bow', role: 'ranged', line: '머리에 새가 둥지를 틀었다. 그냥 둔다.', passive: { name: '둥지 지킴이', kind: 'teamDef', value: 0.08 } },
  { key: 'hero_toma', name: '토마', rarity: 'special', element: 'earth', weapon: 'crossbow', role: 'ranged', line: '한 발을 오래 겨눈다.', passive: { name: '오래 겨눈 한 발', kind: 'opener', value: 2.5 } },
  { key: 'hero_isol', name: '이솔', rarity: 'special', element: 'fire', weapon: 'crossbow', role: 'ranged', line: '지붕 위로 다닌다. 계단은 잘 모른다.', passive: { name: '지붕 위 시야', kind: 'crit', value: 0.1 } },
  { key: 'hero_liv', name: '리브', rarity: 'special', element: 'water', weapon: 'crossbow', role: 'ranged', line: '석궁을 고칠수록 복잡해진다.', passive: { name: '또 고친 석궁', kind: 'haste', value: 0.2 } },
  { key: 'hero_milo', name: '밀로', rarity: 'special', element: 'wind', weapon: 'crossbow', role: 'ranged', line: '바람 부는 날만 일한다.', passive: { name: '바람 부는 날', kind: 'atk', value: 0.15 } },
  { key: 'hero_yuna', name: '유나', rarity: 'special', element: 'water', weapon: 'staff', role: 'healer', line: '원소 결정을 모은다.', passive: { name: '결정 주머니', kind: 'heal', value: 0.25 } },
  { key: 'hero_ace', name: '하엘', rarity: 'special', element: 'wind', weapon: 'staff', role: 'ranged', line: '짐은 지팡이 하나면 된다.', passive: { name: '가벼운 짐', kind: 'haste', value: 0.15 } },
  { key: 'hero_karel', name: '카렐', rarity: 'special', element: 'fire', weapon: 'staff', role: 'ranged', line: '주문을 외면 앞머리가 조금 탄다.', passive: { name: '앞머리 각오', kind: 'boss', value: 0.2 } },
  { key: 'hero_mora', name: '모라', rarity: 'special', element: 'earth', weapon: 'staff', role: 'healer', line: '안 다쳐도 약초를 발라 준다.', passive: { name: '약초 바르기', kind: 'teamHp', value: 0.1 } },
  // 일반 12 (무기마다 둘, 속성마다 셋). The passive opens at the gold evolution.
  { key: 'hero_rookie', name: '신참 검사 비코', rarity: 'normal', element: 'earth', weapon: 'oneHandSword', role: 'melee', line: '투구가 커서 앞이 반만 보인다.', passive: { name: '큰 투구', kind: 'def', value: 0.15 } },
  { key: 'hero_rita', name: '양치기 리타', rarity: 'normal', element: 'wind', weapon: 'oneHandSword', role: 'melee', line: '양을 세다가 먼저 잠든다.', passive: { name: '푹 잔 낮잠', kind: 'hp', value: 0.12 } },
  { key: 'hero_bri', name: '빨래꾼 브리', rarity: 'normal', element: 'water', weapon: 'greatsword', role: 'melee', line: '대검은 빨랫방망이보다 조금 무겁다.', passive: { name: '빨랫방망이 솜씨', kind: 'atk', value: 0.1 } },
  { key: 'hero_peno', name: '빵집 아들 페노', rarity: 'normal', element: 'fire', weapon: 'greatsword', role: 'melee', line: '칼보다 반죽을 더 잘 친다.', passive: { name: '갓 구운 빵', kind: 'teamHp', value: 0.05 } },
  { key: 'hero_shu', name: '정찰병 슈', rarity: 'normal', element: 'wind', weapon: 'dagger', role: 'melee', line: '숨바꼭질에서 진 적이 없다. 다들 먼저 집에 가서.', passive: { name: '숨바꼭질', kind: 'crit', value: 0.06 } },
  { key: 'hero_pori', name: '버섯꾼 포리', rarity: 'normal', element: 'earth', weapon: 'dagger', role: 'melee', line: '먹는 버섯을 반쯤 안다.', passive: { name: '반쯤 아는 버섯', kind: 'lastStand', value: 0.15 } },
  { key: 'hero_tori', name: '견습 궁수 토리', rarity: 'normal', element: 'fire', weapon: 'bow', role: 'ranged', line: '과녁보다 사과를 더 많이 맞혔다.', passive: { name: '사과 맞히기', kind: 'opener', value: 1 } },
  { key: 'hero_otto', name: '어부 오토', rarity: 'normal', element: 'water', weapon: 'bow', role: 'ranged', line: '놓친 물고기 이야기가 제일 길다.', passive: { name: '놓친 큰 물고기', kind: 'boss', value: 0.12 } },
  { key: 'hero_tessa', name: '문지기 테사', rarity: 'normal', element: 'water', weapon: 'crossbow', role: 'ranged', line: '문은 잘 지킨다. 열쇠는 자주 잃는다.', passive: { name: '문지기', kind: 'def', value: 0.15 } },
  { key: 'hero_hob', name: '광부 호브', rarity: 'normal', element: 'earth', weapon: 'crossbow', role: 'ranged', line: '탑도 결국 큰 굴이라고 생각한다.', passive: { name: '굴 파기', kind: 'mob', value: 0.1 } },
  { key: 'hero_nono', name: '견습 마법사 노노', rarity: 'normal', element: 'fire', weapon: 'staff', role: 'ranged', line: '불은 켤 줄 안다. 끄는 건 배우는 중.', passive: { name: '켤 줄은 안다', kind: 'atk', value: 0.1 } },
  { key: 'hero_som', name: '견습 치유사 솜', rarity: 'normal', element: 'wind', weapon: 'staff', role: 'healer', line: '붕대는 잘 감는다. 너무 잘 감는다.', passive: { name: '꽁꽁 붕대', kind: 'heal', value: 0.15 } },
] as const satisfies readonly HeroSpec[];

export type HeroKey = (typeof HEROES)[number]['key'];

export const HERO_KEYS: readonly HeroKey[] = HEROES.map((h) => h.key);

const HERO_BY_KEY = new Map<string, HeroSpec>(HEROES.map((h) => [h.key, h]));

export function isHeroKey(v: unknown): v is HeroKey {
  return typeof v === 'string' && HERO_BY_KEY.has(v);
}

export function heroSpec(key: HeroKey): HeroSpec {
  const h = HERO_BY_KEY.get(key);
  if (h === undefined) throw new Error(`unknown hero ${key}`);
  return h;
}

// ---------- Stars (5.5) ----------

/** 문양 사다리 (5.5 추천): 동별 → 은별 → 금별 → 달 → 해, five pips each. */
export const STAR_MARKS = ['bronze', 'silver', 'gold', 'moon', 'sun'] as const;
export type StarMark = (typeof STAR_MARKS)[number];
export const STAR_MARK_LABEL: Record<StarMark, string> = { bronze: '동별', silver: '은별', gold: '금별', moon: '달', sun: '해' };
export const STAR_PIPS_PER_MARK = 5;

/** 별 한 단계에 드는 겹침 (사용자 결정, B.16): 특급 5, 일반 13 (13은 예시라 [튜닝]). */
export const STAR_STEP_COPIES: Record<HeroRarity, number> = { special: 5, normal: 13 };

/** The last star index each ladder reaches (0 = 동별 1): 일반 달 5, 특급 해 5 (흰색은 추후). */
export const STAR_MAX_INDEX: Record<HeroRarity, number> = { special: 24, normal: 19 };

// ---------- Evolution colours (5.6) ----------

export const EVOLUTION_COLORS = ['purple', 'gold', 'red', 'white'] as const;
export type EvolutionColor = (typeof EVOLUTION_COLORS)[number];
export const EVOLUTION_LABEL: Record<EvolutionColor, string> = { purple: '보라', gold: '금색', red: '빨강', white: '흰색' };

/** The colours each rarity climbs (사용자 결정): 일반 보라 → 금색, 특급 보라 → 금색 → 빨강 (흰색은 추후 구현). */
export const EVOLUTION_LADDER: Record<HeroRarity, readonly EvolutionColor[]> = {
  special: ['purple', 'gold', 'red'],
  normal: ['purple', 'gold'],
};

/** The star index where each colour begins: evolution comes on filling the step after 금별 5 (달 1) and 달 5 (해 1). */
export const EVOLUTION_AT_STAR: Record<EvolutionColor, number> = { purple: 0, gold: 15, red: 20, white: 25 };

// ---------- Star and evolution power (5.7) [튜닝] ----------

/**
 * 별·진화 배율 (5.7 모양): 동별 1 is ×1; a pip within a mark ×STAR_PIP_GROWTH; a new mark
 * (은별 1, 금별 1) ×STAR_MARK_GROWTH; an evolution (달 1 = 금색, 해 1 = 빨강) ×STAR_EVOLUTION_GROWTH.
 * The product is the HP and defence multiplier; attack takes STAR_ATTACK_SHARE of the gain
 * (5.7 지킬 선: 체력·방어는 용사가 크게, 공격은 무기가 크게). The same table for both rarities.
 * Measured (tools/stage/measure.ts): 금색 진화 (달 1) ≈ +10 floors over 동별 1, 해 5 ≈ +15~20, about
 * what a weapon brings (품질 ★1 → ★5 ≈ +10, the floor's weak element ≈ +7~10). The first values
 * (1.03 / 1.08 / 1.12) gave 달 1 ≈ +20~30 and were cut (B.18).
 */
export const STAR_PIP_GROWTH = 1.02;
export const STAR_MARK_GROWTH = 1.05;
export const STAR_EVOLUTION_GROWTH = 1.06;
export const STAR_ATTACK_SHARE = 0.5;

/** STAR_POWER[i]: HP/defence multiplier at star index i (0 = 동별 1 … 24 = 해 5). */
export const STAR_POWER: readonly number[] = (() => {
  const out = [1];
  for (let i = 1; i <= STAR_MAX_INDEX.special; i++) {
    const prev = out[i - 1] as number;
    const atEvolution = i === EVOLUTION_AT_STAR.gold || i === EVOLUTION_AT_STAR.red;
    const atMark = i % STAR_PIPS_PER_MARK === 0;
    out.push(prev * (atEvolution ? STAR_EVOLUTION_GROWTH : atMark ? STAR_MARK_GROWTH : STAR_PIP_GROWTH));
  }
  return out;
})();

export function starHpMult(starIndex: number): number {
  const i = Math.max(0, Math.min(STAR_POWER.length - 1, Math.floor(starIndex)));
  return STAR_POWER[i] as number;
}

export function starAttackMult(starIndex: number): number {
  return 1 + (starHpMult(starIndex) - 1) * STAR_ATTACK_SHARE;
}

// ---------- The shared level (5.3) [튜닝] ----------

/** One level for every hero (사용자 결정). The cap is [미정] (16장의 5번); this is only a guard. */
export const LEVEL_MAX = 9999;

/** Experience from level L to L+1: EXP_BASE × EXP_GROWTH^(L−1), rounded. */
export const EXP_BASE = 40;
export const EXP_GROWTH = 1.06;

export function expToNext(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.max(1, Math.round(EXP_BASE * powInt(EXP_GROWTH, l - 1)));
}

/**
 * What a level does (5.3: 레벨이 오르면 모든 용사의 능력치가 오른다): HP and defence ×LEVEL_HP_GROWTH,
 * attack ×LEVEL_ATTACK_GROWTH per level. Attack grows less: the weapon's material (×1.15 a band,
 * 4.4) carries the rest, so level + new ore keeps pace with the floors (×1.04 a floor, 6.4).
 */
export const LEVEL_HP_GROWTH = 1.04;
export const LEVEL_ATTACK_GROWTH = 1.025;

export function levelHpMult(level: number): number {
  return powInt(LEVEL_HP_GROWTH, Math.max(1, Math.floor(level)) - 1);
}

export function levelAttackMult(level: number): number {
  return powInt(LEVEL_ATTACK_GROWTH, Math.max(1, Math.floor(level)) - 1);
}

/** The dwarf's line on a level up (5.3, [튜닝]). */
export const LEVEL_UP_LINE = '다들 조금씩 컸군. 나만 그대로다.';
