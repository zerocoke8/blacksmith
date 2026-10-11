// 육성 한 판 (기획서 13장): 준비 → 30턴 (행동 → 결과 → 사건 → 보상 고르기) → 평가.
// Pure and deterministic: runAct never changes the state it is given, and a run is its setup plus
// the action list (replayRun gives the same state; 13.16 서버 검증).

import {
  abandonCardCraft,
  type CardCollection,
  checkDeck,
  checkPlay,
  countsAsUnlock,
  type DeckProblem,
  endTurn,
  playCard,
  startCardCraft,
} from '../cards/index.ts';
import { type CardId, CARDS, DECK_RULES, EVOLVED_CARD_IDS, UNLOCK_CARD_IDS } from '../data/cards.ts';
import { materialPrice, WEAPON_LABEL } from '../data/common.ts';
import { FAMILIES, FAMILY_IDS, type FamilyId, familyCardId, isFamilyId } from '../data/families.ts';
import {
  ACTION_HP,
  ANCESTORS_MAX,
  BOND_MAX,
  COMPANION_SLOTS,
  DEATH_MODE_LABEL,
  DEFAULT_RUN_RULES,
  DEMON_FLOOR,
  EVENT_RATE_RANGE,
  EXPEDITION_POLICIES,
  FACTOR_LEVEL_MAX,
  GENERATION_MAX,
  isSeasonId,
  LATE_GOLD_RATE_RANGE,
  RUN_DEFAULT_DECK,
  RUN_HAND_SIZE_RANGE,
  RUN_SAVE_VERSION,
  RUN_START_GOLD,
  RUN_TURNS,
  RUN_TURNS_RANGE,
  SEASON_UNLOCK_CAP,
  SEASONS,
  STAR_SPEC,
  type Star,
  STARS,
  WALL_DEADLINES,
  WALL_FLOORS,
  WALL_PRESETS,
} from '../data/run.ts';
import type { WeaponType } from '../core/types.ts';
import { basicWeapon } from '../world/hero.ts';
import { applyEffects, raiseBond, rollTurnEvent } from './events.ts';
import { climb } from './expedition.ts';
import { applyPicks, craftedWeapon, forgeCraftSetup, forgePlan, picksBlock, quickQuality, quickWeapon, techUses } from './forge.ts';
import { isLegendCard } from './hall.ts';
import { runResultOf } from './rating.ts';
import {
  addMain,
  addMaterial,
  demonPassed,
  draftRun,
  enchantPrice,
  heal,
  isShopMaterial,
  mainCount,
  nextWall,
  repairCostOf,
  shopBand,
} from './state.ts';
import {
  ancestorWeaponLine,
  bondLine,
  bossDownLine,
  climbEndLine,
  deathLine,
  FIND_LINE,
  FORGE_FAIL_LINE,
  fillLine,
  injuryLine,
  MAINTAIN_LINE,
  REST_LINE,
  retireLine,
  severeLine,
  wallRetireLine,
  weaponTitle,
} from './text.ts';
import type {
  Factor,
  RunAction,
  RunActionKind,
  RunEnd,
  RunExpeditionLog,
  RunForgeLog,
  RunRules,
  RunSetup,
  RunSetupInput,
  RunState,
  RunTurnLog,
  RunWeapon,
  ShopItem,
} from './types.ts';

// ---------- Rules and setup ----------

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function clampNum(n: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(range.max, Math.max(range.min, n)) : fallback;
}

/** Fills in defaults and clamps each [검증] switch to its range. */
export function resolveRunRules(rules: Partial<RunRules> | undefined): RunRules {
  const r = { ...DEFAULT_RUN_RULES, ...(rules ?? {}) };
  return {
    turns: clampInt(r.turns, RUN_TURNS_RANGE.min, RUN_TURNS_RANGE.max, RUN_TURNS),
    wallPreset: (WALL_PRESETS as readonly string[]).includes(r.wallPreset) ? r.wallPreset : DEFAULT_RUN_RULES.wallPreset,
    deathMode: (Object.keys(DEATH_MODE_LABEL) as string[]).includes(r.deathMode) ? r.deathMode : DEFAULT_RUN_RULES.deathMode,
    eventRate: clampNum(r.eventRate, EVENT_RATE_RANGE, DEFAULT_RUN_RULES.eventRate),
    quickForge: r.quickForge === true,
    handSize: clampInt(r.handSize, RUN_HAND_SIZE_RANGE.min, RUN_HAND_SIZE_RANGE.max, DEFAULT_RUN_RULES.handSize),
    lateGoldRate: clampNum(r.lateGoldRate, LATE_GOLD_RATE_RANGE, DEFAULT_RUN_RULES.lateGoldRate),
  };
}

/** 벽 마감 턴 (13.7), scaled from the 30-turn preset; increasing, the last at least one turn before the end. */
export function wallDeadlines(rules: Pick<RunRules, 'turns' | 'wallPreset'>): number[] {
  const base = WALL_DEADLINES[rules.wallPreset];
  const out: number[] = [];
  let prev = 0;
  for (const d of base) {
    const v = Math.max(prev + 1, Math.round((d * rules.turns) / RUN_TURNS));
    out.push(v);
    prev = v;
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const max = i === out.length - 1 ? rules.turns - 1 : (out[i + 1] as number) - 1;
    out[i] = Math.max(1, Math.min(out[i] as number, max));
  }
  return out;
}

export function normalizeSetup(input: RunSetupInput): RunSetup {
  return {
    seed: input.seed,
    season: input.season ?? 'ash',
    hero: { ...input.hero },
    generation: clampInt(input.generation, 1, GENERATION_MAX, 1),
    companions: (input.companions ?? []).map((c) => ({ ...c })),
    ancestors: (input.ancestors ?? []).map((a) => JSON.parse(JSON.stringify(a)) as RunSetup['ancestors'][number]),
    mainAncestor: input.mainAncestor ?? null,
    factorPicks: (input.factorPicks ?? []).map((p) => ({ ...p })),
    weaponKeep: input.weaponKeep === undefined || input.weaponKeep === null ? null : { ...input.weaponKeep },
    deck: [...(input.deck ?? RUN_DEFAULT_DECK)],
    rules: resolveRunRules(input.rules),
  };
}

/** Every 해금·진화 카드 may go in the prototype's run deck (13.3 [질문]: 방치 세계에서 배운 것). */
const RUN_COLLECTION: CardCollection = {
  learned: [...UNLOCK_CARD_IDS],
  evolved: Object.fromEntries(EVOLVED_CARD_IDS.map((id) => [id, DECK_RULES.familyLimit.basic])),
};

/** 판용 기술 덱 (13.3): 4.2.6 규칙 (10~20장, 같은 계열 장수, ↔), 해금 카드는 시즌 상한까지. */
export function runDeckProblems(deck: readonly CardId[]): DeckProblem[] {
  const problems = checkDeck(deck, RUN_COLLECTION, Number.MAX_SAFE_INTEGER).filter((p) => p.code !== 'unlockCap');
  const unlocks = deck.filter(countsAsUnlock).length;
  if (unlocks > SEASON_UNLOCK_CAP) {
    problems.push({ code: 'unlockCap', message: `해금 카드는 시즌 상한 ${SEASON_UNLOCK_CAP}장까지 (지금 ${unlocks}장)` });
  }
  for (const id of new Set(deck)) {
    const g = CARDS[id].group;
    if (g === 'family' || g === 'season') problems.push({ code: 'notDeckCard', card: id, message: `${CARDS[id].name}: 판 안에서만 들어온다` });
  }
  return problems;
}

/** Why the setup cannot start a run (short Korean lines), empty if it can. */
export function setupProblems(setup: RunSetup): string[] {
  const out: string[] = [];
  if (!Number.isSafeInteger(setup.seed)) out.push('판 시드는 정수');
  if (!isSeasonId(setup.season)) out.push('없는 시즌 탑');
  if (!isFamilyId(setup.hero.family)) out.push('없는 가문');
  if (!STARS.includes(setup.hero.star)) out.push('성급은 1~5');
  if (setup.companions.length > COMPANION_SLOTS) out.push(`동료는 ${COMPANION_SLOTS}명까지`);
  const seen = new Set<string>([setup.hero.family]);
  for (const c of setup.companions) {
    if (!isFamilyId(c.family) || !STARS.includes(c.star)) out.push('동료 가문이나 성급이 이상하다');
    else if (seen.has(c.family)) out.push(`${FAMILIES[c.family].name}: 같은 가문은 한 칸에만`);
    seen.add(c.family);
  }
  if (setup.ancestors.length > ANCESTORS_MAX) out.push(`선대는 ${ANCESTORS_MAX}명까지`);
  if (!setup.ancestors.every(isLegendCard)) out.push('선대 카드가 온전하지 않다');
  // The same card in both 선대 칸 would let its 인자 be picked twice.
  const ids = setup.ancestors.map((a: unknown) => (typeof a === 'object' && a !== null ? (a as { id?: unknown }).id : a));
  if (new Set(ids).size < ids.length) out.push('같은 선대를 두 칸에 둘 수 없다');
  const main = setup.mainAncestor;
  if (main !== null && (main < 0 || main >= setup.ancestors.length || !Number.isInteger(main))) out.push('주 선대가 없다');
  const slots = STARS.includes(setup.hero.star) ? STAR_SPEC[setup.hero.star].inheritSlots : 0;
  if (setup.factorPicks.length > slots) out.push(`인자는 계승 칸 ${slots}개까지`);
  const picked = new Set<string>();
  for (const p of setup.factorPicks) {
    const f = setup.ancestors[p.ancestor]?.factors[p.index];
    if (f === undefined) out.push('없는 인자');
    const key = `${p.ancestor}:${p.index}`;
    if (picked.has(key)) out.push('같은 인자를 두 번 고를 수 없다');
    picked.add(key);
  }
  const keep = setup.weaponKeep;
  if (keep !== null) {
    const w = main === null ? undefined : setup.ancestors[main]?.weapon;
    if (w === undefined) out.push('잇는 인챈트는 주 선대의 무기에서 고른다');
    else if (keep.kind === 'element' && w.element === null) out.push('선대 무기에 속성이 없다');
    else if (keep.kind === 'enchant' && !w.enchants.includes(keep.enchant)) out.push('선대 무기에 없는 인챈트');
  }
  for (const p of runDeckProblems(setup.deck)) out.push(p.message);
  return out;
}

/** 계승 칸만큼 고른 인자; 선대가 주인공과 같은 가문이면 그 선대의 인자 단계 +1 (최대 3, 13.10). */
export function pickedFactors(setup: RunSetup): Factor[] {
  const out: Factor[] = [];
  for (const p of setup.factorPicks) {
    const anc = setup.ancestors[p.ancestor];
    const f = anc?.factors[p.index];
    if (anc === undefined || f === undefined) continue;
    const level = anc.family === setup.hero.family ? Math.min(FACTOR_LEVEL_MAX, f.level + 1) : f.level;
    out.push({ ...f, level });
  }
  return out;
}

/** 카드 인자의 카드: 1단계 기본형, 2·3단계 진화형 (13.10). */
function factorCards(factors: readonly Factor[]): CardId[] {
  const out: CardId[] = [];
  for (const f of factors) {
    if (f.kind !== 'card' || f.card === null) continue;
    out.push(f.level >= 2 && f.evolved !== null ? f.evolved : f.card);
  }
  return out;
}

/**
 * 선대 무기의 이름 (13.10: 이름과 전적은 이어진다). When the weapon is reforged to the hero's type,
 * the name's last word, the old weapon type, becomes the new one ('…60층을 연 단검' → '…연 대검');
 * the achievement part stays.
 */
export function inheritedWeaponName(name: string, from: WeaponType, to: WeaponType): string {
  const old = WEAPON_LABEL[from];
  if (from === to || !name.endsWith(old)) return name;
  return `${name.slice(0, name.length - old.length)}${WEAPON_LABEL[to]}`;
}

/** 시작 무기: 주 선대의 무기를 1구간 철로 고쳐 벼린 것, 없으면 기본 무기 (★1 무속성 철, 13.3, 13.10). */
function startWeapon(setup: RunSetup): RunWeapon {
  const type = FAMILIES[setup.hero.family].weapon;
  const anc = setup.mainAncestor === null ? undefined : setup.ancestors[setup.mainAncestor];
  if (anc === undefined) return { weapon: basicWeapon('w0', type), durability: 1, name: null, origin: 'basic', forgeNo: null, since: 0 };
  const keep = setup.weaponKeep;
  return {
    weapon: {
      id: 'a0',
      type,
      materialTier: 1,
      quality: anc.weapon.quality,
      element: keep?.kind === 'element' ? anc.weapon.element : null,
      enchants: keep?.kind === 'enchant' ? [keep.enchant] : [],
      unique: null,
    },
    durability: 1,
    name: inheritedWeaponName(anc.weaponName, anc.weapon.type, type),
    origin: 'ancestor',
    forgeNo: null,
    since: 0,
  };
}

/** 판 준비 (13.3) → 1턴. Throws with the setup's problems if it cannot start. */
export function startRun(input: RunSetupInput): RunState {
  const setup = normalizeSetup(input);
  const problems = setupProblems(setup);
  if (problems.length > 0) throw new Error(`run setup: ${problems.join(' / ')}`);
  const factors = pickedFactors(setup);
  const deck: CardId[] = [
    ...setup.deck,
    familyCardId(setup.hero.family, STAR_SPEC[setup.hero.star].cardLevel),
    ...factorCards(factors),
  ];
  const deadlines = wallDeadlines(setup.rules);
  return {
    version: RUN_SAVE_VERSION,
    setup,
    rules: setup.rules,
    turn: 1,
    phase: 'turn',
    hp: 1,
    injured: false,
    forcedRest: false,
    gold: RUN_START_GOLD,
    cumulativeFloors: 0,
    record: 0,
    lastBossFloor: 0,
    walls: WALL_FLOORS.map((floor, i) => ({ floor, deadline: deadlines[i] as number, passedTurn: null })),
    weapon: startWeapon(setup),
    rack: [],
    deck,
    inventory: {},
    mainMaterials: {},
    bossMaterials: 0,
    companions: setup.companions.map((c) => ({ family: c.family, star: c.star, bond: 0, stories: [] })),
    factors,
    handBonus: 0,
    maintainBuff: false,
    escort: 0,
    expeditionNo: 0,
    forgeNo: 0,
    rewardNo: 0,
    choiceNo: 0,
    forge: null,
    pending: [],
    seasonEventsDone: [],
    stats: {
      goldEarned: 0,
      goldGifted: 0,
      spentMaterials: 0,
      spentShop: 0,
      spentRepair: 0,
      spentMerchant: 0,
      cardUses: {},
      bossesCleared: [],
      injuries: 0,
      severe: 0,
      finds: 0,
      bestQuality: 0,
      forges: 0,
      forgeFails: 0,
      choices: 0,
    },
    current: null,
    turnLog: [],
    end: null,
    result: null,
    actions: [],
  };
}

/**
 * The 준비 화면's starting point (13.3): 보유 가문 둘 (1성) + 시즌 가문 (1성으로 빌림), 선대 없음
 * (첫 판은 기본 무기), 기본 판 덱.
 */
export function defaultRunSetup(seed: number, hero: FamilyId, star: Star, rules: Partial<RunRules> = {}): RunSetupInput {
  const seasonFamily = SEASONS.ash.family;
  const owned = FAMILY_IDS.filter((f) => f !== hero && f !== seasonFamily).slice(0, 2);
  const companions = owned.map((family) => ({ family, star: 1 as Star }));
  companions.push({ family: hero === seasonFamily ? (FAMILY_IDS.find((f) => f !== hero && !owned.includes(f)) as FamilyId) : seasonFamily, star: 1 });
  return { seed, season: 'ash', hero: { family: hero, star }, companions, deck: [...RUN_DEFAULT_DECK], rules: { ...rules } };
}

/** The line the 준비 화면 shows for a main ancestor's weapon (13.18). */
export function ancestorLine(state: RunState): string | null {
  return state.weapon.origin === 'ancestor' ? ancestorWeaponLine(WEAPON_LABEL[state.weapon.weapon.type]) : null;
}

// ---------- Forced turns (13.4.2, 13.7) ----------

export type ForcedTurn = 'wall' | 'climb' | 'rest' | null;

/**
 * The action this turn is fixed to: 벽 도전 on a wall's 마감 턴 (its boss still standing), 마지막
 * 등반 on the last turn after the 악마, 휴식 after a 중상. The wall and the 마지막 등반 win over the
 * rest: a 중상 on the turn before either does not take that turn away (the hero goes up hurt, HP
 * 상한 60%), and the rest is dropped.
 */
export function forcedTurn(s: RunState): ForcedTurn {
  if (s.phase !== 'turn') return null;
  const wall = nextWall(s);
  if (wall !== null && wall.deadline <= s.turn) return 'wall';
  if (s.turn >= s.rules.turns && demonPassed(s)) return 'climb';
  if (s.forcedRest) return 'rest';
  return null;
}

// ---------- Checking an action ----------

function shopPrice(s: RunState, item: ShopItem): number | null {
  if (item.kind === 'main') {
    if (!Number.isInteger(item.tier) || item.tier < 1 || item.tier > shopBand(s)) return null;
    return materialPrice(item.tier);
  }
  return isShopMaterial(item.key) ? enchantPrice(s) : null;
}

/** Why the action cannot be taken now (short Korean), or null if it can. */
export function actionBlock(s: RunState, action: RunAction): string | null {
  if (s.phase === 'over') return '판이 끝났다';
  switch (action.type) {
    case 'buy': {
      const price = shopPrice(s, action.item);
      if (price === null) return '상점에 없는 물건';
      const count = action.count ?? 1;
      if (!Number.isInteger(count) || count < 1) return '1개 이상';
      return price * count > s.gold ? '골드가 모자라다' : null;
    }
    case 'choose': {
      if (s.phase !== 'choice') return '고를 것이 없다';
      const head = s.pending[0];
      const opt = head?.options[action.option];
      if (opt === undefined || !Number.isInteger(action.option)) return '없는 선택지';
      return opt.cost > s.gold ? '골드가 모자라다' : null;
    }
    case 'forgePlay': {
      const craft = s.forge?.craft;
      if (s.phase !== 'forge' || craft === null || craft === undefined) return '단조 중이 아니다';
      const check = checkPlay(craft, action.uid, action.opts ?? {});
      return check.ok ? null : check.reason;
    }
    case 'forgeEndTurn': {
      const craft = s.forge?.craft;
      if (s.phase !== 'forge' || craft === null || craft === undefined) return '단조 중이 아니다';
      try {
        endTurn(craft, action.keep ?? []);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : '남길 수 없는 카드';
      }
    }
    case 'forgeAbandon':
      return s.phase === 'forge' ? null : '단조 중이 아니다';
    case 'forgeFinish': {
      const weapon = s.forge?.weapon;
      if (s.phase !== 'forgeDone' || weapon === null || weapon === undefined) return '완성된 무기가 없다';
      if (action.hang === true) return (action.picks ?? []).length > 0 ? '걸이에 걸 무기에는 슬롯을 채우지 않는다' : null;
      return picksBlock(weapon, action.picks ?? [], s.inventory);
    }
    default:
      break;
  }
  if (s.phase !== 'turn') return s.phase === 'choice' ? '먼저 고른다' : '단조를 마저 끝낸다';
  const forced = forcedTurn(s);
  if (action.type === 'retire') return null;
  if (forced === 'wall' && action.type !== 'wall') return '벽 도전 턴이다';
  if (forced === 'climb' && action.type !== 'climb') return '마지막 등반 턴이다';
  if (forced === 'rest' && action.type !== 'rest') return '중상이다. 이번 턴은 쉰다';
  switch (action.type) {
    case 'wall':
      return forced === 'wall' ? null : '아직 마감 턴이 아니다';
    case 'climb':
      return forced === 'climb' ? null : '마지막 등반은 악마를 넘은 판의 마지막 턴에';
    case 'expedition':
      return (EXPEDITION_POLICIES as readonly string[]).includes(action.policy) ? null : '없는 방침';
    case 'rest':
      return null;
    case 'forge': {
      if (action.quality !== undefined && !s.rules.quickForge) return '품질은 단조 간이 모드에서만 정한다';
      if (action.quality !== undefined && ![1, 2, 3, 4, 5].includes(action.quality)) return '품질은 ★1~★5';
      return forgePlan(s, action.materialTier, action.legendary === true).block;
    }
    case 'maintain': {
      const cost = repairCostOf(s.weapon.weapon);
      if (cost > s.gold) return `수리비가 모자라다 (${cost}G)`;
      return picksBlock(s.weapon.weapon, action.picks ?? [], s.inventory);
    }
    case 'bond': {
      const c = s.companions[action.companion];
      if (c === undefined) return '없는 동료';
      return c.bond >= BOND_MAX ? '유대가 이미 가득하다' : null;
    }
  }
}

// ---------- Turn bookkeeping ----------

function beginTurn(s: RunState, action: RunActionKind, forced: boolean): RunTurnLog {
  s.forcedRest = false;
  const cur: RunTurnLog = {
    turn: s.turn,
    action,
    forced,
    hpBefore: s.hp,
    hpAfter: s.hp,
    goldBefore: s.gold,
    goldAfter: s.gold,
    expedition: null,
    forge: null,
    maintain: null,
    bond: null,
    events: [],
    lines: [],
  };
  s.current = cur;
  return cur;
}

function pushCurrent(s: RunState): void {
  const cur = s.current;
  if (cur === null) return;
  cur.hpAfter = s.hp;
  cur.goldAfter = s.gold;
  s.turnLog.push(cur);
  s.current = null;
}

function finishRun(s: RunState, end: RunEnd): void {
  s.end = end;
  s.phase = 'over';
  s.pending = [];
  s.forge = null;
  if (s.current !== null) s.current.lines.push(end.line);
  pushCurrent(s);
  const result = runResultOf(s, end);
  s.result = result;
  s.weapon = { ...s.weapon, name: result.weaponName };
}

function advanceTurn(s: RunState): void {
  s.turn += 1;
  s.phase = 'turn';
  if (s.turn > s.rules.turns) {
    const name = FAMILIES[s.setup.hero.family].name;
    finishRun(s, { kind: 'turns', turn: s.rules.turns, floor: s.record, line: retireLine(name, WEAPON_LABEL[s.weapon.weapon.type]) });
  }
}

/** 결과 → 사건 → 보상 고르기 (13.4): the turn's 사건 goes before the 보스 보상. */
function closeTurn(s: RunState, action: RunActionKind): void {
  const event = rollTurnEvent(s, action, RUN_TURNS);
  if (event !== null) {
    const at = s.pending.findIndex((c) => c.kind === 'bossReward');
    s.pending = at < 0 ? [...s.pending, event] : [...s.pending.slice(0, at), event, ...s.pending.slice(at)];
  }
  if (s.current !== null) s.current.events = s.pending.map((c) => c.kind);
  pushCurrent(s);
  if (s.pending.length > 0) s.phase = 'choice';
  else advanceTurn(s);
}

// ---------- Actions ----------

function expeditionLines(s: RunState, log: RunExpeditionLog): string[] {
  const out: string[] = [];
  const name = FAMILIES[s.setup.hero.family].name;
  const cleared = log.floors.filter((f) => f.cleared);
  if (cleared.length > 0) {
    out.push(`${log.startFloor}~${(cleared[cleared.length - 1] as { floor: number }).floor}층을 올랐다. +${log.gold}G`);
  } else {
    out.push(`${log.startFloor}층에서 더 오르지 못했다.`);
  }
  if (log.levelAfter > log.levelBefore) out.push(`레벨 ${log.levelBefore} → ${log.levelAfter}`);
  const season = SEASONS[s.setup.season];
  for (const floor of log.bosses) {
    const boss = log.floors.find((f) => f.floor === floor)?.name ?? '';
    out.push(floor === DEMON_FLOOR ? fillLine(season.demonLine, { demon: season.demon }) : bossDownLine(boss));
  }
  const first = log.finds[0];
  if (first !== undefined) {
    const family = first.split(':')[0];
    if (family !== undefined && family in FIND_LINE) out.push(FIND_LINE[family as keyof typeof FIND_LINE]);
  }
  if (log.result === 'injury') out.push(injuryLine(name));
  if (log.result === 'severe') out.push(severeLine(name));
  return out;
}

function doExpedition(s: RunState, kind: 'expedition' | 'wall' | 'climb', policy: Extract<RunAction, { type: 'expedition' }> | null): void {
  const forced = kind !== 'expedition';
  const cur = beginTurn(s, kind, forced);
  const mode = kind === 'expedition' ? 'normal' : kind;
  const out = climb(s, mode, policy?.policy ?? 'normal');
  cur.expedition = out.log;
  cur.lines.push(...expeditionLines(s, out.log));
  const name = FAMILIES[s.setup.hero.family].name;
  const weaponLabel = WEAPON_LABEL[s.weapon.weapon.type];
  if (out.died) {
    finishRun(s, { kind: 'dead', turn: s.turn, floor: s.record, line: deathLine(name, weaponLabel) });
  } else if (out.wallFailed) {
    finishRun(s, { kind: 'wall', turn: s.turn, floor: s.record, line: wallRetireLine(name, weaponLabel, s.record) });
  } else if (mode === 'climb') {
    finishRun(s, { kind: 'climb', turn: s.turn, floor: s.record, line: climbEndLine(name, s.record) });
  } else {
    closeTurn(s, kind);
  }
}

function forgeLog(s: RunState, success: boolean, picks: RunForgeLog['picks'], taken = success): RunForgeLog {
  const f = s.forge;
  if (f === null) throw new Error('no forge');
  const quality = success ? (f.weapon?.quality ?? null) : null;
  let turns = 0;
  let cardsPlayed = 0;
  if (f.craft !== null) {
    turns = f.craft.turn;
    cardsPlayed = f.craft.log.filter((e) => e.kind === 'play').length;
  }
  return {
    no: f.no,
    materialTier: f.materialTier,
    legendary: f.legendary,
    grade: f.grade,
    quick: f.craft === null,
    success,
    quality,
    unique: success ? (f.weapon?.unique ?? null) : null,
    bossMaterial: f.legendary ? (success ? f.bossMaterial : 'lost') : null,
    cost: f.cost,
    turns,
    cardsPlayed,
    picks: [...picks],
    taken,
  };
}

/** After a card play or 다시 달구기: a finished craft moves on to 완성 화면, a broken one ends the turn. */
function afterCraft(s: RunState): void {
  const f = s.forge;
  const craft = f?.craft;
  if (f === null || craft === null || craft === undefined || craft.status === 'active') return;
  for (const [id, n] of Object.entries(techUses(craft)) as [CardId, number][]) {
    s.stats.cardUses[id] = (s.stats.cardUses[id] ?? 0) + n;
  }
  if (craft.status === 'success') {
    const { weapon, fate } = craftedWeapon(craft, f.no);
    if (fate === 'returned') s.bossMaterials += 1;
    s.forge = { ...f, weapon, bossMaterial: fate };
    s.phase = 'forgeDone';
    return;
  }
  s.stats.forgeFails += 1;
  if (s.current !== null) {
    s.current.forge = forgeLog(s, false, []);
    s.current.lines.push(FORGE_FAIL_LINE);
  }
  s.forge = null;
  closeTurn(s, 'forge');
}

function doForge(s: RunState, action: Extract<RunAction, { type: 'forge' }>): void {
  const plan = forgePlan(s, action.materialTier, action.legendary === true);
  beginTurn(s, 'forge', false);
  s.forgeNo += 1;
  const no = s.forgeNo;
  addMain(s, plan.materialTier, -Math.min(plan.owned, mainCount(s, plan.materialTier)));
  s.gold -= plan.cost;
  s.stats.spentMaterials += plan.cost;
  if (plan.legendary) s.bossMaterials -= 1;
  heal(s, ACTION_HP.forge);
  s.stats.forges += 1;
  const base = {
    no,
    materialTier: plan.materialTier,
    legendary: plan.legendary,
    grade: plan.grade,
    smithLevel: plan.smithLevel,
    handSize: plan.handSize,
    cost: plan.cost,
  };
  if (s.rules.quickForge) {
    const quality = action.quality ?? quickQuality(s.setup.seed, no);
    const { weapon, fate } = quickWeapon(s, no, plan, quality);
    if (fate === 'returned') s.bossMaterials += 1;
    s.forge = { ...base, craft: null, weapon, bossMaterial: fate };
    s.phase = 'forgeDone';
    return;
  }
  s.forge = { ...base, craft: startCardCraft(forgeCraftSetup(s, no, plan)), weapon: null, bossMaterial: null };
  s.phase = 'forge';
  afterCraft(s);
}

/**
 * 무기 들기 (13.8): the new weapon is taken up and the old one hung on the 무기 걸이. With hang, the
 * new weapon goes to the 무기 걸이 unused and the held one stays (a weaker 완성 need not replace a
 * better weapon). Either way it counts as a weapon forged in this run (평가의 무기, 13.12).
 */
function doForgeFinish(s: RunState, picks: RunForgeLog['picks'], hang: boolean): void {
  const f = s.forge;
  if (f === null || f.weapon === null) throw new Error('no finished weapon');
  const filled = hang ? { weapon: f.weapon, inventory: s.inventory } : applyPicks(f.weapon, picks, s.inventory);
  s.inventory = filled.inventory;
  const made: RunWeapon = { weapon: filled.weapon, durability: 1, name: null, origin: 'forged', forgeNo: f.no, since: s.turn };
  if (hang) {
    s.rack.push({ ...made, neverHeld: true });
  } else {
    s.rack.push(s.weapon);
    s.weapon = made;
  }
  s.stats.bestQuality = Math.max(s.stats.bestQuality, filled.weapon.quality);
  s.forge = { ...f, weapon: filled.weapon };
  if (s.current !== null) {
    s.current.forge = forgeLog(s, true, hang ? [] : picks, !hang);
    s.current.lines.push(hang ? `새 무기는 걸이에 걸었다: ${weaponTitle(filled.weapon)}` : `새 무기: ${weaponTitle(filled.weapon)}`);
  }
  s.forge = null;
  closeTurn(s, 'forge');
}

function doMaintain(s: RunState, picks: RunForgeLog['picks']): void {
  const cur = beginTurn(s, 'maintain', false);
  const cost = repairCostOf(s.weapon.weapon);
  s.gold -= cost;
  s.stats.spentRepair += cost;
  const filled = applyPicks(s.weapon.weapon, picks, s.inventory);
  s.inventory = filled.inventory;
  s.weapon = { ...s.weapon, weapon: filled.weapon, durability: 1 };
  s.maintainBuff = true;
  heal(s, ACTION_HP.maintain);
  cur.maintain = { cost, picks: [...picks] };
  cur.lines.push(MAINTAIN_LINE);
  closeTurn(s, 'maintain');
}

function doRest(s: RunState): void {
  const forced = s.forcedRest;
  const cur = beginTurn(s, 'rest', forced);
  s.injured = false;
  heal(s, ACTION_HP.rest);
  cur.lines.push(REST_LINE);
  closeTurn(s, 'rest');
}

function doBond(s: RunState, index: number): void {
  const cur = beginTurn(s, 'bond', false);
  heal(s, ACTION_HP.bond);
  const story = raiseBond(s, index);
  const c = s.companions[index];
  if (c !== undefined) {
    cur.bond = { family: c.family, bond: c.bond };
    cur.lines.push(bondLine(FAMILIES[c.family].name, c.bond));
  }
  if (story !== null) s.pending = [story, ...s.pending];
  closeTurn(s, 'bond');
}

function doChoose(s: RunState, index: number): void {
  const head = s.pending[0];
  const opt = head?.options[index];
  if (head === undefined || opt === undefined) throw new Error('no such option');
  s.gold -= opt.cost;
  s.stats.spentMerchant += opt.cost;
  s.pending = s.pending.slice(1);
  const last = s.turnLog[s.turnLog.length - 1];
  if (last !== undefined) s.turnLog[s.turnLog.length - 1] = { ...last, lines: [...last.lines, `${head.title}: ${opt.label}`] };
  applyEffects(s, opt.effects);
  if (s.pending.length === 0) advanceTurn(s);
}

function doBuy(s: RunState, item: ShopItem, count: number): void {
  const price = shopPrice(s, item);
  if (price === null) throw new Error('not in the shop');
  s.gold -= price * count;
  s.stats.spentShop += price * count;
  if (item.kind === 'main') addMain(s, item.tier, count);
  else addMaterial(s, item.key, count);
}

/**
 * Takes one action and returns the new state (the given state is not changed). Throws if the
 * action is not allowed now (actionBlock says why).
 */
export function runAct(state: RunState, action: RunAction): RunState {
  const reason = actionBlock(state, action);
  if (reason !== null) throw new Error(`${action.type}: ${reason}`);
  const s = draftRun(state);
  s.actions.push(JSON.parse(JSON.stringify(action)) as RunAction);
  switch (action.type) {
    case 'expedition':
      doExpedition(s, 'expedition', action);
      break;
    case 'wall':
      doExpedition(s, 'wall', null);
      break;
    case 'climb':
      doExpedition(s, 'climb', null);
      break;
    case 'forge':
      doForge(s, action);
      break;
    case 'forgePlay': {
      const f = s.forge as NonNullable<RunState['forge']>;
      s.forge = { ...f, craft: playCard(f.craft as NonNullable<typeof f.craft>, action.uid, action.opts ?? {}) };
      afterCraft(s);
      break;
    }
    case 'forgeEndTurn': {
      const f = s.forge as NonNullable<RunState['forge']>;
      s.forge = { ...f, craft: endTurn(f.craft as NonNullable<typeof f.craft>, action.keep ?? []) };
      afterCraft(s);
      break;
    }
    case 'forgeAbandon': {
      const f = s.forge as NonNullable<RunState['forge']>;
      s.forge = { ...f, craft: abandonCardCraft(f.craft as NonNullable<typeof f.craft>) };
      afterCraft(s);
      break;
    }
    case 'forgeFinish':
      doForgeFinish(s, action.picks ?? [], action.hang === true);
      break;
    case 'maintain':
      doMaintain(s, action.picks ?? []);
      break;
    case 'rest':
      doRest(s);
      break;
    case 'bond':
      doBond(s, action.companion);
      break;
    case 'buy':
      doBuy(s, action.item, action.count ?? 1);
      break;
    case 'choose':
      doChoose(s, action.option);
      break;
    case 'retire': {
      beginTurn(s, 'retire', false);
      const name = FAMILIES[s.setup.hero.family].name;
      finishRun(s, { kind: 'retired', turn: s.turn, floor: s.record, line: retireLine(name, WEAPON_LABEL[s.weapon.weapon.type]) });
      break;
    }
  }
  return s;
}

/** The run its setup and action list make (13.16: 서버가 행동 기록을 다시 계산한다). */
export function replayRun(setup: RunSetupInput, actions: readonly RunAction[]): RunState {
  let s = startRun(setup);
  for (const a of actions) s = runAct(s, a);
  return s;
}
