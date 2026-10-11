// 육성 한 판 측정 봇 (기획서 13.7.1 첫 감, 16.3의 11~19번). They only call the run's public
// functions, like a player at the turn screen would.
//
// - 단순 봇 (13.7.1 '단순 규칙' 그대로): 새 주재료가 풀리고 돈이 되면 단조 (무속성 + 무기에 어울리는
//   인챈트), 내구도 40% 아래면 정비, HP 55% 아래면 휴식, 나머지는 보통 방침 원정. 그 순서로 본다.
//   벽 1 앞에서는 새 주재료가 없어 기본 무기로 오른다. 지은 무기는 늘 든다.
// - 늦게 짓는 단순 봇: 단순 봇에 하나를 더한다. 새 주재료가 풀려도 다음 벽 마감이 SIMPLE_FORGE_LEAD턴
//   안일 때만 짓는다 (그 전에는 원정으로 번다). 순서는 HP → 내구도 → 단조 → 원정. 단순 봇의 결과가 짓는
//   때 하나에 얼마나 흔들리는지 보려고 둔다 (규칙 검토: 13.7.1 문구와 다르다).
// - 계획 봇: 다음 벽 보스의 체형·속성을 보고 무기를 그린다 (그 구간을 이기는 원소 결정, △면 관통,
//   어울리는 인챈트). 지금 무기와 그릴 무기의 보스 돌파 확률을 견주어 짓는 때를 고르고, 돈이 모자라면
//   벌러 간다. 벽 직전에는 정비 버프를 받고 과감하게, 휴식 대신 사연이 가까운 동료와 교류한다. 완성된
//   무기가 들던 것보다 약하면 걸이에 건다.
//
// 단조 안의 카드 판은 카드 측정 봇 (tools/cards/bots.ts)이 친다. With the quick forge rule the
// run bot names the quality instead (단조 간이 모드).

import type { Bot as CardBot } from '../cards/bots.ts';
import { type EnchantMaterialKey, type SlotPick, slotMaterial } from '../../src/sim/cards/index.ts';
import { ELEMENTS, type Element, type EnchantId, type QualityTier, type Weapon, type WeaponType } from '../../src/sim/core/types.ts';
import type { CardId } from '../../src/sim/data/cards.ts';
import { BEATS, QUALITY, WEAPON_SPEC } from '../../src/sim/data/common.ts';
import { ENCHANTS } from '../../src/sim/data/enchants.ts';
import { FAMILIES } from '../../src/sim/data/families.ts';
import { BOND_MAX, type ExpeditionPolicy, FINAL_CLIMB_START, STORY_BONDS } from '../../src/sim/data/run.ts';
import {
  actionBlock,
  applyPicks,
  climbOdds,
  enchantPrice,
  floorOdds,
  forcedTurn,
  forecastExpedition,
  forgePlan,
  masteryFloor,
  nextWall,
  type RunAction,
  type RunChoice,
  type RunState,
  runAct,
  seasonFloor,
  shopBand,
} from '../../src/sim/run/index.ts';
import { masteryOf } from '../../src/sim/world/combat.ts';

export type RunBotId = 'simple' | 'simpleLate' | 'planner';

export const RUN_BOT_NAME: Record<RunBotId, string> = {
  simple: '단순 봇',
  simpleLate: '늦게 짓는 단순 봇',
  planner: '계획 봇',
};

export interface RunBot {
  id: RunBotId;
  name: string;
  /** The next action in the 'turn' and 'choice' phases, and the slot picks for a weapon. */
  decide(s: RunState): RunAction;
  /** Quality this bot names in the quick forge (단조 간이 모드). */
  quickQuality: QualityTier;
}

// ---------- Weapon designs ----------

/** Tower-calculation enchants each weapon type reaches for first (어울리는 인챈트 위주, 4.8). */
const ATTACK_ENCHANTS: Record<WeaponType, readonly EnchantId[]> = {
  oneHandSword: ['firstStrike', 'combo', 'keen'],
  greatsword: ['firstStrike', 'combo', 'keen'],
  dagger: ['combo', 'pursuit', 'keen'],
  bow: ['combo', 'keen', 'pursuit'],
  crossbow: ['firstStrike', 'keen', 'pursuit'],
  staff: ['elementBoost', 'combo', 'firstStrike'],
};

/** Upper enchants worth a slot once 능숙 (4.5), by weapon type. */
const UPPER_ENCHANTS: Record<WeaponType, readonly EnchantId[]> = {
  oneHandSword: ['gale', 'vital'],
  greatsword: ['gale', 'vital'],
  dagger: ['gale', 'vital'],
  bow: ['gale', 'vital'],
  crossbow: ['vital', 'gale'],
  staff: ['gale'],
};

export interface Design {
  element: Element | null;
  enchants: EnchantId[];
}

/** The element that beats this one (수 > 화 > 지 > 풍 > 수). */
function beaterOf(target: Element): Element {
  return ELEMENTS.find((e) => BEATS[e] === target) ?? 'water';
}

function targetFloor(s: RunState): number {
  return nextWall(s)?.floor ?? Math.max(FINAL_CLIMB_START, s.record + 1);
}

/** 단순 봇: 무속성 + 어울리는 인챈트. 계획 봇: 다음 벽을 이기는 속성 + (△면) 관통 + 어울리는 인챈트. */
export function designFor(s: RunState, planned: boolean): Design {
  const type = FAMILIES[s.setup.hero.family].weapon;
  if (!planned) return { element: null, enchants: [...ATTACK_ENCHANTS[type]] };
  const info = seasonFloor(s.setup.season, targetFloor(s));
  const element = beaterOf(info.element);
  const fit = WEAPON_SPEC[type].bodyFit[info.body];
  const enchants: EnchantId[] = [];
  // 영체는 속성이 붙으면 ○가 된다; 다른 △ 체형에는 관통.
  if (fit === 'bad' && info.body !== 'spirit') enchants.push('pierce');
  if (masteryOf(masteryFloor(s) + 10) !== 'novice') enchants.push(...UPPER_ENCHANTS[type]);
  enchants.push(...ATTACK_ENCHANTS[type]);
  return { element, enchants: [...new Set(enchants)] };
}

/** The picks a weapon can take: the design in order, as far as slots, stock and gold go. */
export function picksFor(s: RunState, weapon: Weapon, design: Design, budget: number): { picks: SlotPick[]; buy: EnchantMaterialKey[] } {
  const picks: SlotPick[] = [];
  const buy: EnchantMaterialKey[] = [];
  const stock: Partial<Record<EnchantMaterialKey, number>> = { ...s.inventory };
  const price = enchantPrice(s);
  let money = budget;
  let free = QUALITY[weapon.quality].slots - weapon.enchants.length - (weapon.element !== null && weapon.type !== 'staff' ? 1 : 0);
  const take = (pick: SlotPick): boolean => {
    const key = slotMaterial(pick);
    if (key === null) return false;
    if ((stock[key] ?? 0) > 0) {
      stock[key] = (stock[key] ?? 0) - 1;
    } else if (!key.endsWith(':high') && money >= price) {
      money -= price;
      buy.push(key);
    } else {
      return false;
    }
    picks.push(pick);
    return true;
  };
  if (design.element !== null && weapon.element === null) {
    if (weapon.type === 'staff') take({ kind: 'staffElement', element: design.element });
    else if (free > 0 && take({ kind: 'enchant', enchant: 'element', element: design.element })) free -= 1;
  }
  for (const id of design.enchants) {
    if (free <= 0) break;
    if (weapon.enchants.includes(id) || picks.some((p) => p.kind === 'enchant' && p.enchant === id)) continue;
    const spec = ENCHANTS[id];
    if (id === 'elementBoost' && design.element === null && weapon.element === null) continue;
    const pick: SlotPick = { kind: 'enchant', enchant: id, element: spec.family === 'crystal' ? (design.element ?? weapon.element) : null };
    if (take(pick)) free -= 1;
  }
  return { picks, buy };
}

/** The weapon a forge of this tier would make with the design (for comparing boss odds). */
function sketch(s: RunState, tier: number, quality: QualityTier, design: Design): Weapon {
  const type = FAMILIES[s.setup.hero.family].weapon;
  const bare: Weapon = { id: 'sketch', type, materialTier: tier, quality, element: null, enchants: [], unique: null };
  const { picks } = picksFor({ ...s, inventory: { ...s.inventory } }, bare, design, Number.MAX_SAFE_INTEGER);
  const out: Weapon = { ...bare, enchants: [] };
  for (const p of picks) {
    if (p.kind === 'staffElement' || p.enchant === 'element') out.element = p.element;
    else out.enchants.push(p.enchant);
  }
  return out;
}

// ---------- Choices ----------

/** Cards the planner takes from rewards and the merchant, best first (it finds quality hard). */
const CARD_WISH: readonly CardId[] = [
  'allIn',
  'firstTouch',
  'deftHand',
  'carefulHammer',
  'trainedArm',
  'lastStroke',
  'ashHammer',
  'firstHammer',
  'thickAnvil',
];

function chooseFor(s: RunState, c: RunChoice, planned: boolean): number {
  const affordable = (i: number): boolean => (c.options[i]?.cost ?? 0) <= s.gold;
  const last = c.options.length - 1;
  if (c.kind === 'merchant') {
    if (!planned) return last;
    // 화로 손질 first, then the card it wants most, while the gold is not needed for the next weapon.
    const spare = s.gold - forgeBudget(s);
    const ok = (i: number): boolean => affordable(i) && (c.options[i]?.cost ?? 0) <= spare;
    const furnace = c.options.findIndex((o, i) => i < last && o.effects[0]?.kind === 'furnace');
    if (furnace >= 0 && ok(furnace)) return furnace;
    let best = last;
    let rank = CARD_WISH.length;
    c.options.forEach((o, i) => {
      const e = o.effects[0];
      if (i >= last || e?.kind !== 'addCard' || !ok(i)) return;
      const r = CARD_WISH.indexOf(e.card);
      if (r >= 0 && r < rank) {
        best = i;
        rank = r;
      }
    });
    return best;
  }
  if (c.kind === 'bossReward') {
    if (!planned) return 0;
    let best = last;
    let rank = CARD_WISH.length;
    c.options.forEach((o, i) => {
      const e = o.effects[0];
      if (e?.kind !== 'addCard') return;
      const r = CARD_WISH.indexOf(e.card);
      if (r >= 0 && r < rank) {
        best = i;
        rank = r;
      }
    });
    return best;
  }
  if (c.kind === 'remove') {
    const i = c.options.findIndex((o) => o.effects[0]?.kind === 'removeCard' && (o.effects[0] as { card: CardId }).card === 'precisePolish');
    return i >= 0 ? i : 0;
  }
  if (c.kind === 'evolve' || c.kind === 'artisan') {
    // Quality cards and the hammer's 힘 갈래 first.
    const want = ['polish', 'finisher', 'hammer', 'bellows'];
    for (const w of want) {
      const i = c.options.findIndex((o) => o.effects[0]?.kind === 'evolve' && (o.effects[0] as { card: CardId }).card === w);
      if (i >= 0) return i;
    }
    return 0;
  }
  for (let i = 0; i < c.options.length; i++) if (affordable(i)) return i;
  return last;
}

// ---------- Turn decisions ----------

/** Gold the planner keeps for its next weapon (main material + slots). */
function forgeBudget(s: RunState): number {
  const tier = shopBand(s);
  if (tier <= s.weapon.weapon.materialTier) return 0;
  return forgePlan({ ...s, gold: Number.MAX_SAFE_INTEGER }, tier).cost + 2 * enchantPrice(s);
}

/** 원정, or the forced turn. */
function forcedAction(s: RunState): RunAction | null {
  const forced = forcedTurn(s);
  if (forced === 'wall') return { type: 'wall' };
  if (forced === 'climb') return { type: 'climb' };
  if (forced === 'rest') return { type: 'rest' };
  return null;
}

function canDo(s: RunState, a: RunAction): boolean {
  return actionBlock(s, a) === null;
}

/** A companion whose next 사연 is one 교류 away (or any that can still bond). */
function bondTarget(s: RunState): number | null {
  let best: number | null = null;
  s.companions.forEach((c, i) => {
    if (c.bond >= BOND_MAX) return;
    if (STORY_BONDS.includes(c.bond + 1) && best === null) best = i;
  });
  return best;
}

/** 늦게 짓는 단순 봇: 다음 벽 마감이 이 턴 수 안일 때만 짓는다. */
export const SIMPLE_FORGE_LEAD = 3;
/** 13.7.1 단순 규칙의 기준. */
const SIMPLE_REST_BELOW = 0.55;
const SIMPLE_MAINTAIN_BELOW = 0.4;

/** 13.7.1 단순 규칙 그대로: 새 주재료와 돈 → 단조, 내구도 40% 아래 → 정비, HP 55% 아래 → 휴식, 나머지 원정. */
function simpleTurn(s: RunState): RunAction {
  const forced = forcedAction(s);
  if (forced !== null) return forced;
  const band = shopBand(s);
  if (band > s.weapon.weapon.materialTier && canDo(s, { type: 'forge', materialTier: band })) return { type: 'forge', materialTier: band };
  if (s.weapon.durability < SIMPLE_MAINTAIN_BELOW && canDo(s, { type: 'maintain' })) return { type: 'maintain' };
  if (s.hp < SIMPLE_REST_BELOW) return { type: 'rest' };
  return { type: 'expedition', policy: 'normal' };
}

/** 늦게 짓는 단순 봇 (the first measurement's 단순 봇): 새 주재료가 풀려도 벽 SIMPLE_FORGE_LEAD턴 앞에서만 짓는다. */
function simpleLateTurn(s: RunState): RunAction {
  const forced = forcedAction(s);
  if (forced !== null) return forced;
  if (s.hp < SIMPLE_REST_BELOW) return { type: 'rest' };
  if (s.weapon.durability < SIMPLE_MAINTAIN_BELOW && canDo(s, { type: 'maintain' })) return { type: 'maintain' };
  const band = shopBand(s);
  const wall = nextWall(s);
  if (
    band > s.weapon.weapon.materialTier &&
    wall !== null &&
    wall.deadline - s.turn <= SIMPLE_FORGE_LEAD &&
    canDo(s, { type: 'forge', materialTier: band })
  ) {
    return { type: 'forge', materialTier: band };
  }
  return { type: 'expedition', policy: 'normal' };
}

/** Boss odds at the next wall: now, with the 정비 버프. */
function wallChance(s: RunState, weapon?: Weapon): number {
  const wall = nextWall(s);
  if (wall === null) return 1;
  return floorOdds(s, wall.floor, { weapon, maintain: true }).chance;
}

/** The planner forges when the drawn weapon lifts the next wall's odds by this much (or is a new band). */
const PLANNER_GAIN = 0.05;

function plannerForge(s: RunState, expected: QualityTier): RunAction | null {
  const wall = nextWall(s);
  const design = designFor(s, true);
  const now = wallChance(s);
  // After the 악마: one weapon of the newest band for the 마지막 등반.
  const tiers = [shopBand(s)];
  if (s.bossMaterials > 0) tiers.unshift(-shopBand(s));
  for (const t of tiers) {
    const legendary = t < 0;
    const tier = Math.abs(t);
    const same = tier <= s.weapon.weapon.materialTier && s.weapon.weapon.element === design.element;
    if (!legendary && same) continue;
    const plan = forgePlan(s, tier, legendary);
    if (plan.block !== null) continue;
    const weapon = sketch(s, tier, expected, design);
    const gain = (wall === null ? 1 : wallChance(s, weapon)) - now;
    const slotsCost = picksFor(s, { ...weapon, element: null, enchants: [] }, design, Number.MAX_SAFE_INTEGER).buy.length * enchantPrice(s);
    const affordable = plan.cost + slotsCost <= s.gold;
    const newBand = tier > s.weapon.weapon.materialTier;
    const urgent = wall !== null && wall.deadline - s.turn <= 1 && now < 0.5;
    if ((gain >= PLANNER_GAIN || (newBand && gain > 0) || (wall === null && newBand)) && (affordable || urgent)) {
      return { type: 'forge', materialTier: tier, legendary };
    }
  }
  return null;
}

/** A climb that would get to the next wall's boss with the HP and edge it has now. */
function reachesBoss(s: RunState, policy: ExpeditionPolicy): { reach: boolean; chance: number } {
  const f = forecastExpedition(s, policy);
  const reach = f.boss !== null && f.startFloor + f.floors > f.boss.floor;
  return { reach, chance: f.boss?.chance ?? 0 };
}

function plannerTurn(s: RunState, expected: QualityTier): RunAction {
  const forced = forcedAction(s);
  if (forced !== null) return forced;
  const wall = nextWall(s);
  const maintain = canDo(s, { type: 'maintain' });
  if (wall === null) {
    // After the 악마: the newest band's weapon, upper floors for levels, and a full start for the 마지막 등반.
    if (s.turn === s.rules.turns - 1) return s.hp < 0.8 || !maintain ? { type: 'rest' } : { type: 'maintain' };
    const forge = plannerForge(s, expected);
    if (forge !== null && s.hp >= 0.3) return forge;
    if (s.hp < 0.55) return { type: 'rest' };
    if (s.weapon.durability < 0.4 && maintain) return { type: 'maintain' };
    return { type: 'expedition', policy: 'normal' };
  }
  const turnsLeft = wall.deadline - s.turn;
  const forge = plannerForge(s, expected);
  if (forge !== null && s.hp >= 0.3) return forge;
  const policy: ExpeditionPolicy = s.injured ? 'cautious' : turnsLeft <= 1 ? 'bold' : 'normal';
  const boss = reachesBoss(s, policy);
  if (boss.reach) {
    // Going for the wall boss: the 정비 버프 first if the odds want it.
    if (!s.maintainBuff && boss.chance < 0.95 && maintain) return { type: 'maintain' };
    return { type: 'expedition', policy };
  }
  if (turnsLeft <= 1) {
    // Next turn is the 벽 도전 (귀환 기준 없이 오른다): edge, HP and the buff.
    if (s.weapon.durability < 0.75 && maintain) return { type: 'maintain' };
    if (s.hp < 0.9) return { type: 'rest' };
    return maintain && !s.maintainBuff ? { type: 'maintain' } : { type: 'rest' };
  }
  if (s.weapon.durability < 0.4 && maintain) return { type: 'maintain' };
  if (s.hp < 0.55 || (s.injured && s.hp < 0.6)) {
    const b = bondTarget(s);
    // 교류 heals half of a rest; take it only with time to spare before the wall.
    if (b !== null && !s.injured && s.hp >= 0.35 && turnsLeft > 3) return { type: 'bond', companion: b };
    return { type: 'rest' };
  }
  if (forecastExpedition(s, policy).floors === 0) {
    // The first floor is too much for now: rest up or sharpen.
    if (maintain && !s.maintainBuff) return { type: 'maintain' };
    return { type: 'rest' };
  }
  return { type: 'expedition', policy };
}

/** Where the planner weighs a finished weapon against the held one: the next wall's boss, or the 마지막 등반. */
function weighWeapon(s: RunState, weapon: Weapon): number {
  return nextWall(s) === null ? climbOdds(s, weapon) : wallChance(s, weapon);
}

function finishPicks(s: RunState, planned: boolean): RunAction[] {
  const weapon = s.forge?.weapon;
  if (weapon === null || weapon === undefined) return [{ type: 'forgeFinish' }];
  const { picks, buy } = picksFor(s, weapon, designFor(s, planned), s.gold);
  const counts = new Map<EnchantMaterialKey, number>();
  for (const k of buy) counts.set(k, (counts.get(k) ?? 0) + 1);
  if (planned) {
    // A worse 완성 (a bad hand, or a 전설 below 걸작) goes on the rack; the held weapon stays.
    const stock = { ...s.inventory };
    for (const [k, n] of counts) stock[k] = (stock[k] ?? 0) + n;
    const made = applyPicks(weapon, picks, stock).weapon;
    if (weighWeapon(s, made) + 0.005 < weighWeapon(s, s.weapon.weapon)) return [{ type: 'forgeFinish', hang: true }];
  }
  const out: RunAction[] = [...counts].map(([key, count]) => ({ type: 'buy', item: { kind: 'material', key }, count }));
  out.push({ type: 'forgeFinish', picks });
  return out;
}

function makeBot(id: RunBotId): RunBot {
  const planned = id === 'planner';
  const quickQuality: QualityTier = 3;
  let queue: RunAction[] = [];
  let queuedFor = -1;
  return {
    id,
    name: RUN_BOT_NAME[id],
    quickQuality,
    decide(s) {
      if (queue.length > 0 && queuedFor === s.actions.length) {
        const a = queue.shift() as RunAction;
        queuedFor = s.actions.length + 1;
        return a;
      }
      queue = [];
      if (s.phase === 'choice') {
        const head = s.pending[0] as RunChoice;
        return { type: 'choose', option: chooseFor(s, head, planned) };
      }
      if (s.phase === 'forgeDone') {
        const [first, ...rest] = finishPicks(s, planned);
        queue = rest;
        queuedFor = s.actions.length + 1;
        return first as RunAction;
      }
      return planned ? plannerTurn(s, quickQuality) : id === 'simpleLate' ? simpleLateTurn(s) : simpleTurn(s);
    },
  };
}

export const simpleRunBot: RunBot = makeBot('simple');
export function makeRunBot(id: RunBotId): RunBot {
  return makeBot(id);
}

// ---------- Playing a run ----------

export interface PlayRunOptions {
  /** Plays the card craft of each 단조. Ignored in the quick forge. */
  cardBot: CardBot;
  /** A craft past this turn is given up (and fails), like the card measurement. */
  maxCraftTurns: number;
  maxSteps: number;
}

/** Plays a run to the end and returns its last state. */
export function playRun(start: RunState, bot: RunBot, opts: PlayRunOptions): RunState {
  let s = start;
  for (let i = 0; i < opts.maxSteps && s.phase !== 'over'; i++) {
    if (s.phase === 'forge') {
      const craft = s.forge?.craft;
      if (craft === null || craft === undefined) throw new Error('forge without craft');
      if (craft.turn > opts.maxCraftTurns) {
        s = runAct(s, { type: 'forgeAbandon' });
        continue;
      }
      const a = opts.cardBot.decide(craft);
      s = runAct(s, a.kind === 'play' ? { type: 'forgePlay', uid: a.uid, opts: a.opts } : { type: 'forgeEndTurn', keep: a.keep });
      continue;
    }
    let action = bot.decide(s);
    if (action.type === 'forge' && s.rules.quickForge) action = { ...action, quality: bot.quickQuality };
    s = runAct(s, action);
  }
  if (s.phase !== 'over') throw new Error(`run did not end in ${opts.maxSteps} steps`);
  return s;
}

