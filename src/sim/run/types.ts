// 육성 한 판의 상태와 행동 (기획서 13장). Everything here is plain JSON so a save can hold it
// as-is: a run is (setup, actions), and the state is what replaying the actions makes (13.16).

import type { CardCraftState, EnchantMaterialKey, EvolveBranch, PlayOptions, SlotPick } from '../cards/index.ts';
import type { BodyType, Element, EnchantId, QualityTier, UniqueId, Weapon } from '../core/types.ts';
import type { CardId, CardRecipeGrade } from '../data/cards.ts';
import type { FamilyId } from '../data/families.ts';
import type { DeathMode, ExpeditionPolicy, FactorKind, RunGrade, SeasonId, Star, WallPreset } from '../data/run.ts';
import type { FloorKind } from '../world/types.ts';

// ---------- Setup (13.3) ----------

/** [검증] 실험 스위치. Defaults are the doc's rules (data/run.ts DEFAULT_RUN_RULES). */
export interface RunRules {
  /** 한 판 턴 수 (30). 벽 마감 턴과 시즌 사건은 이 길이에 맞춰 늘거나 준다. */
  turns: number;
  wallPreset: WallPreset;
  /** 판 안의 사망 결과: 중상 (13.4.2 추천) or 사망 (판이 끝난다). */
  deathMode: DeathMode;
  /** 무작위 사건(행상, 동료 사연, 떠돌이 장인, 재료 발견) 확률 배율. */
  eventRate: number;
  /** 단조 간이 모드: 카드 퍼즐 없이 품질을 바로 정한다. */
  quickForge: boolean;
  /** 판의 손패 (13.8: 5장). 행상의 화로 손질은 그 위에 +1. */
  handSize: number;
  /** 31층부터 층마다 버는 판 골드의 배율 (13.4.3: ×1). */
  lateGoldRate: number;
}

/** 인자 (13.10). body is set for 사냥꾼, card/evolved for 카드; null otherwise. */
export interface Factor {
  kind: FactorKind;
  /** 1~3. */
  level: number;
  body: BodyType | null;
  /** 카드 인자의 기본형 (계열의 원래 카드). */
  card: CardId | null;
  /** 카드 인자 2·3단계의 진화형, or null if the card has no branches. */
  evolved: CardId | null;
}

/** What the main ancestor's weapon keeps when it is reforged (13.10: 인챈트는 1개만 골라 잇는다). */
export type WeaponKeep = { kind: 'element' } | { kind: 'enchant'; enchant: EnchantId };

export type RunEndKind = 'wall' | 'climb' | 'retired' | 'dead' | 'turns';

/** 전설 용사 카드 (13.12). Kept in the 명예의 전당 and copied into a setup when chosen as 선대. */
export interface LegendCard {
  id: string;
  family: FamilyId;
  star: Star;
  grade: RunGrade;
  season: SeasonId;
  record: number;
  score: number;
  wallsPassed: number;
  end: RunEndKind;
  /** 은퇴한 층 or 마지막 등반의 기록. */
  endFloor: number;
  factors: Factor[];
  weapon: Weapon;
  weaponName: string;
  deck: CardId[];
  runSeed: number;
  /** 대수 ('3대 아렌', 6.7.1). Cards from before it was kept have none. */
  generation?: number;
  /** The weapon's name came down from a 선대 (13.10: 이름과 전적은 이어진다), not from this run. */
  weaponInherited?: boolean;
}

export interface RunMember {
  family: FamilyId;
  star: Star;
}

/** A setup as the 준비 화면 hands it over; missing parts take defaults. */
export interface RunSetupInput {
  /** 판 시드 (랭킹 판은 서버가 준다, 13.16). */
  seed: number;
  season?: SeasonId;
  hero: RunMember;
  /** 동료 0~3명 (13.9): 보유 가문 2 + 시즌 가문 1. */
  companions?: RunMember[];
  /** 선대 0~2명: 명예의 전당의 전설 용사 카드 (13.10). */
  ancestors?: LegendCard[];
  /** 무기를 물려주는 주 선대 (ancestors의 번호), or null. */
  mainAncestor?: number | null;
  /** 계승 칸만큼 고른 인자: (선대 번호, 그 선대의 인자 번호). */
  factorPicks?: { ancestor: number; index: number }[];
  weaponKeep?: WeaponKeep | null;
  /** 기술 덱 (작업대의 저장 덱을 판용으로 고친 것). 가문 고유 카드와 카드 인자는 판이 더한다. */
  deck?: CardId[];
  rules?: Partial<RunRules>;
  /** 대수 of the hero ('3대 아렌', 6.7.1), kept on the 전설 용사 카드. Default 1. */
  generation?: number;
}

export interface RunSetup {
  seed: number;
  season: SeasonId;
  hero: RunMember;
  generation: number;
  companions: RunMember[];
  ancestors: LegendCard[];
  mainAncestor: number | null;
  factorPicks: { ancestor: number; index: number }[];
  weaponKeep: WeaponKeep | null;
  deck: CardId[];
  rules: RunRules;
}

// ---------- State ----------

export interface RunWall {
  floor: number;
  deadline: number;
  /** The turn its boss fell, or null. */
  passedTurn: number | null;
}

export type WeaponOrigin = 'basic' | 'ancestor' | 'forged';

export interface RunWeapon {
  weapon: Weapon;
  /** 0..1 */
  durability: number;
  /** 이름. 선대 무기는 이름을 잇는다; 판 끝에 든 무기는 반드시 이름이 붙는다 (13.12). */
  name: string | null;
  origin: WeaponOrigin;
  forgeNo: number | null;
  /** Turn it was taken up (0 = 판 시작), or the turn it was made for one hung unused. */
  since: number;
  /** Hung on the 무기 걸이 straight from the 완성 화면, never held. */
  neverHeld?: boolean;
}

export interface RunCompanion {
  family: FamilyId;
  star: Star;
  /** 유대 0~5. */
  bond: number;
  /** 열린 사연의 유대 단계 (1, 3, 5). */
  stories: number[];
}

/** What a choice does. Built when the choice appears, so its preview is exact (13.11: 숨긴 확률이 없다). */
export type RunEffect =
  | { kind: 'gold'; amount: number }
  | { kind: 'material'; key: EnchantMaterialKey; count: number }
  | { kind: 'mainMaterial'; tier: number; count: number }
  | { kind: 'addCard'; card: CardId }
  | { kind: 'removeCard'; card: CardId }
  /** Asks which card to take out next. */
  | { kind: 'pickRemove' }
  | { kind: 'evolve'; card: CardId; branch: EvolveBranch }
  /** Asks for n evolutions next (one choice each). */
  | { kind: 'pickEvolve'; count: number }
  | { kind: 'training'; floors: number }
  | { kind: 'escort'; party: number }
  | { kind: 'furnace' }
  | { kind: 'none' };

export interface RunOption {
  label: string;
  /** What happens, in a few words ("칼깃 2개"). */
  preview: string;
  /** 판 골드 it costs (행상). */
  cost: number;
  effects: RunEffect[];
}

export type RunChoiceKind =
  | 'bossReward'
  | 'merchant'
  | 'chat'
  | 'story'
  | 'artisan'
  | 'sign'
  | 'season'
  | 'evolve'
  | 'remove';

/** A decision waiting at the end of a turn: 사건 or 보상 고르기 (13.4, 13.11). */
export interface RunChoice {
  id: number;
  kind: RunChoiceKind;
  title: string;
  lines: string[];
  /** The companion speaking, if any. */
  family: FamilyId | null;
  options: RunOption[];
}

export type FloorResult = 'safe' | 'injury' | 'severe' | 'death';

export interface RunFloorLog {
  floor: number;
  band: number;
  kind: FloorKind;
  body: BodyType;
  element: Element;
  /** 적이나 보스 이름. */
  name: string;
  r: number;
  chance: number;
  cleared: boolean;
  /** HP when entering the floor. */
  hp: number;
  hpLoss: number;
  /** Weapon durability after this floor's wear. */
  durability: number;
  dull: boolean;
  gold: number;
  /** Level after the floor. */
  level: number;
  /** 재료 발견 on this floor. */
  find: EnchantMaterialKey | null;
  /** A failed floor's result. */
  result: FloorResult | null;
}

export type ExpeditionMode = 'normal' | 'wall' | 'climb';
export type ExpeditionEnd = 'hp' | 'durability' | 'risk' | 'maxFloors' | 'dull' | 'failed' | 'hpZero';

export interface RunExpeditionLog {
  no: number;
  mode: ExpeditionMode;
  policy: ExpeditionPolicy;
  startFloor: number;
  floors: RunFloorLog[];
  end: ExpeditionEnd;
  result: FloorResult | null;
  gold: number;
  levelBefore: number;
  levelAfter: number;
  /** Bosses beaten for the first time. */
  bosses: number[];
  finds: EnchantMaterialKey[];
  maintain: boolean;
  escort: number;
}

export type BossMaterialFate = 'used' | 'returned' | 'lost';

export interface RunForgeLog {
  no: number;
  materialTier: number;
  legendary: boolean;
  grade: CardRecipeGrade;
  quick: boolean;
  success: boolean;
  quality: QualityTier | null;
  unique: UniqueId | null;
  bossMaterial: BossMaterialFate | null;
  /** 판 골드 paid for the main material bought at the start. */
  cost: number;
  turns: number;
  cardsPlayed: number;
  picks: SlotPick[];
  /** The new weapon was taken up (false: hung on the 무기 걸이, the old one kept). */
  taken: boolean;
}

/** A 단조 in progress (13.8). craft is null in the quick forge. */
export interface RunForge {
  no: number;
  materialTier: number;
  legendary: boolean;
  grade: CardRecipeGrade;
  /** 판 숙련도 표의 기준 도구 레벨. */
  smithLevel: number;
  handSize: number;
  cost: number;
  craft: CardCraftState | null;
  /** The finished weapon waiting for its slots (phase 'forgeDone'). */
  weapon: Weapon | null;
  bossMaterial: BossMaterialFate | null;
}

export type RunActionKind = 'expedition' | 'wall' | 'climb' | 'forge' | 'maintain' | 'rest' | 'bond' | 'retire';

export interface RunTurnLog {
  turn: number;
  action: RunActionKind;
  /** 벽 도전, 마지막 등반, 중상 뒤의 휴식. */
  forced: boolean;
  hpBefore: number;
  hpAfter: number;
  goldBefore: number;
  goldAfter: number;
  expedition: RunExpeditionLog | null;
  forge: RunForgeLog | null;
  maintain: { cost: number; picks: SlotPick[] } | null;
  bond: { family: FamilyId; bond: number } | null;
  /** Choices that came up at the end of this turn. */
  events: RunChoiceKind[];
  /** Result lines for the 결과 카드 (Korean, 1.1 톤). */
  lines: string[];
}

export interface RunStats {
  /** 판 골드 from floors. */
  goldEarned: number;
  /** 판 골드 from companions and events. */
  goldGifted: number;
  spentMaterials: number;
  spentShop: number;
  spentRepair: number;
  spentMerchant: number;
  /** Cards played in this run's forges (카드 인자, 13.10). */
  cardUses: Partial<Record<CardId, number>>;
  bossesCleared: number[];
  injuries: number;
  severe: number;
  finds: number;
  /** Highest ★ among weapons forged in this run, 0 if none. */
  bestQuality: number;
  forges: number;
  forgeFails: number;
  /** Choices shown (사건과 보상). */
  choices: number;
}

export type RunPhase = 'turn' | 'forge' | 'forgeDone' | 'choice' | 'over';

export interface RunEnd {
  kind: RunEndKind;
  turn: number;
  /** 은퇴한 층: the floor the run ended at (기록 for 'climb'). */
  floor: number;
  line: string;
}

export interface RunScore {
  floors: number;
  spare: number;
  weapon: number;
  bond: number;
  total: number;
}

export interface RunResult {
  score: RunScore;
  grade: RunGrade;
  factors: Factor[];
  weaponName: string;
  legend: LegendCard;
}

export interface RunState {
  version: number;
  setup: RunSetup;
  rules: RunRules;
  /** 1-based. */
  turn: number;
  phase: RunPhase;
  /** 0..1, carried across turns (13.4.2). */
  hp: number;
  injured: boolean;
  /** 중상: the next turn is 휴식. */
  forcedRest: boolean;
  gold: number;
  cumulativeFloors: number;
  /** 최고 도달층 (기록). */
  record: number;
  lastBossFloor: number;
  walls: RunWall[];
  weapon: RunWeapon;
  /** 무기 걸이: weapons put down for a new one (13.8). */
  rack: RunWeapon[];
  deck: CardId[];
  /** 인챈트 재료 (EnchantMaterialKey → count). */
  inventory: Partial<Record<EnchantMaterialKey, number>>;
  /** 주재료 by band ('1' = 철). */
  mainMaterials: Record<string, number>;
  /** 시즌 보스 재료. */
  bossMaterials: number;
  companions: RunCompanion[];
  factors: Factor[];
  /** 화로 손질 (행상): +1 손패 for the rest of the run. */
  handBonus: number;
  maintainBuff: boolean;
  escort: number;
  expeditionNo: number;
  forgeNo: number;
  rewardNo: number;
  choiceNo: number;
  forge: RunForge | null;
  pending: RunChoice[];
  seasonEventsDone: number[];
  stats: RunStats;
  /** The turn being played (a 단조 spans several actions); pushed to turnLog when the turn closes. */
  current: RunTurnLog | null;
  turnLog: RunTurnLog[];
  end: RunEnd | null;
  result: RunResult | null;
  /** 행동 기록: replaying these from the setup gives this state (13.16). */
  actions: RunAction[];
}

// ---------- Actions ----------

/**
 * Everything the player does in a run. The five 행동 (원정, 단조, 정비, 휴식, 교류) take a turn;
 * forced turns are 'wall' (벽 도전), 'climb' (마지막 등반) and 'rest' after 중상. Buying, the card
 * plays of a 단조 and choices do not take a turn.
 */
export type RunAction =
  | { type: 'expedition'; policy: ExpeditionPolicy }
  | { type: 'wall' }
  | { type: 'climb' }
  /** 주재료 6개 (없으면 상점에서 산다) [+ 시즌 보스 재료]. quality only in the quick forge. */
  | { type: 'forge'; materialTier: number; legendary?: boolean; quality?: QualityTier }
  | { type: 'forgePlay'; uid: string; opts?: PlayOptions }
  | { type: 'forgeEndTurn'; keep?: string[] }
  | { type: 'forgeAbandon' }
  /**
   * 완성 화면: 슬롯에 인챈트 재료, 속성 칸에 원소 결정 (4.3), then the new weapon is taken up and
   * the old one hung (13.8). hang: the new one goes straight to the 무기 걸이 instead (no picks) and
   * the held weapon stays in hand.
   */
  | { type: 'forgeFinish'; picks?: SlotPick[]; hang?: boolean }
  | { type: 'maintain'; picks?: SlotPick[] }
  | { type: 'rest' }
  | { type: 'bond'; companion: number }
  | { type: 'buy'; item: ShopItem; count?: number }
  | { type: 'choose'; option: number }
  | { type: 'retire' };

export type ShopItem = { kind: 'main'; tier: number } | { kind: 'material'; key: EnchantMaterialKey };
