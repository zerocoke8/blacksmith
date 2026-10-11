// 사건과 보상 고르기 (기획서 13.4, 13.9, 13.11, 13.4.3 보스 보상). Every choice is built when it
// comes up, with its results fixed and shown (숨긴 확률이 없다); randomness is (판 시드, 'event', 턴)
// and (판 시드, 'reward', 보상 번호) (13.16).

import {
  BODY_MATERIAL_FAMILIES,
  cardName,
  cardText,
  type EnchantMaterialKey,
  enchantMaterialLabel,
  EVOLVE_BRANCH_LABEL,
} from '../cards/index.ts';
import { type Rng, rngFor } from '../core/rng.ts';
import { ELEMENTS, type Element } from '../core/types.ts';
import { type CardId, UNLOCK_CARD_IDS } from '../data/cards.ts';
import { BEATS, BODY_LABEL, ELEMENT_LABEL, materialName, materialPrice } from '../data/common.ts';
import { type CompanionBonusKind, FAMILIES, familyCardId } from '../data/families.ts';
import { BAND_FLOORS } from '../data/world.ts';
import {
  ARTISAN_OFFERS,
  BOND_MAX,
  BONUS_TIER_BY_STAR,
  BOSS_REWARD,
  COMPANION_BONUS,
  EVENT_CHANCE,
  FURNACE_TUNE_HAND,
  MERCHANT_CARD_CHOICES,
  MERCHANT_CRYSTAL_BUNDLE,
  MERCHANT_PRICE_UNITS,
  MERCHANT_REMOVE_MIN_DECK,
  MERCHANT_UPPER_CHANCE,
  SEASONS,
  type SeasonId,
  type SeasonReward,
  SIGN_TURNS_BEFORE,
  STAR_SPEC,
  STORY_BONDS,
  UPPER_MATERIAL_FROM_FLOOR,
} from '../data/run.ts';
import { floorOdds } from './hero.ts';
import { seasonFloor } from './season.ts';
import {
  addMain,
  addMaterial,
  evolveInDeck,
  evolveOptions,
  nextWall,
  removeOneCard,
  shopBand,
} from './state.ts';
import { ARTISAN_LINE, bossDownLine, fillLine, MERCHANT_LINE } from './text.ts';
import type {
  RunActionKind,
  RunChoice,
  RunChoiceKind,
  RunCompanion,
  RunEffect,
  RunOption,
  RunState,
  RunWall,
} from './types.ts';

export const EVENT_STREAM = 'event';
export const REWARD_STREAM = 'reward';

const LEAVE: RunOption = { label: '그냥 보낸다', preview: '아무것도 사지 않는다', cost: 0, effects: [] };

function choice(
  s: RunState,
  kind: RunChoiceKind,
  title: string,
  lines: string[],
  options: RunOption[],
  family: RunChoice['family'] = null,
): RunChoice {
  s.choiceNo += 1;
  s.stats.choices += 1;
  return { id: s.choiceNo, kind, title, lines, family, options };
}

/** 보상 후보와 행상의 카드: 해금 카드 16종 + 시즌 카드, 누구나 같은 풀 (13.8.1). */
export function rewardPool(season: SeasonId): CardId[] {
  return [...UNLOCK_CARD_IDS, ...SEASONS[season].cards];
}

function pickDistinct<T>(rng: Rng, pool: readonly T[], n: number): T[] {
  const left = [...pool];
  const out: T[] = [];
  while (out.length < n && left.length > 0) out.push(left.splice(rng.int(0, left.length - 1), 1)[0] as T);
  return out;
}

function cardOption(card: CardId, label = cardName(card), cost = 0): RunOption {
  return { label, preview: cardText(card, 1, { short: true }), cost, effects: [{ kind: 'addCard', card }] };
}

/** 지금 구간 재료가: 상점의 최고 구간 주재료 값. */
function bandPrice(s: RunState): number {
  return materialPrice(shopBand(s));
}

// ---------- 보스 보상 (13.4.3) ----------

/** Materials of the first clear, given at once; the card choice comes back as a choice. */
export function bossReward(s: RunState, floor: number): RunChoice {
  // 다음 구간 주재료: n구간 보스 (n × 10층) → n+1구간.
  const tier = Math.floor(floor / BAND_FLOORS) + 1;
  addMain(s, tier, BOSS_REWARD.mainMaterials);
  const season = SEASONS[s.setup.season];
  const boss = seasonFloor(s.setup.season, floor).name;
  const lines = [bossDownLine(boss), `${materialName(tier)} ${BOSS_REWARD.mainMaterials}개를 챙겼다.`];
  if (floor === BOSS_REWARD.seasonMaterialFloor) {
    s.bossMaterials += 1;
    lines.push(`${season.bossMaterial.name}도 하나. 걸작이면 무기에 불이 깃든다.`);
  }
  s.rewardNo += 1;
  const rng = rngFor(s.setup.seed, REWARD_STREAM, s.rewardNo);
  const cards = pickDistinct(rng, rewardPool(s.setup.season), BOSS_REWARD.cardChoices);
  return choice(s, 'bossReward', '보스 보상', lines, [
    ...cards.map((c) => cardOption(c)),
    { label: '건너뛴다', preview: '덱을 그대로 둔다', cost: 0, effects: [] },
  ]);
}

// ---------- 동료 (13.9) ----------

/** 원소 결정 선물: the element that beats the next wall's band (or the upper floors'). */
function giftCrystal(s: RunState): Element {
  const wall = nextWall(s);
  const target = wall === null ? SEASONS[s.setup.season].upper.element : seasonFloor(s.setup.season, wall.floor).element;
  return ELEMENTS.find((e) => BEATS[e] === target) ?? 'water';
}

export function bonusEffects(s: RunState, c: RunCompanion, kind: CompanionBonusKind): { preview: string; effects: RunEffect[] } {
  const tier = BONUS_TIER_BY_STAR[c.star] - 1;
  const fam = FAMILIES[c.family];
  switch (kind) {
    case 'materialGift': {
      const n = COMPANION_BONUS.materialGift[tier] as number;
      const key: EnchantMaterialKey =
        fam.giftMaterial === 'crystal'
          ? `crystal:${giftCrystal(s)}`
          : `${fam.giftMaterial}:${s.record >= UPPER_MATERIAL_FROM_FLOOR ? 'high' : 'low'}`;
      return { preview: `${enchantMaterialLabel(key)} ${n}개`, effects: [{ kind: 'material', key, count: n }] };
    }
    case 'goldGift': {
      const amount = (COMPANION_BONUS.goldGiftUnits[tier] as number) * bandPrice(s);
      return { preview: `${amount}G`, effects: [{ kind: 'gold', amount }] };
    }
    case 'cardUpgrade': {
      const n = COMPANION_BONUS.cardUpgrade[tier] as number;
      return { preview: `덱의 카드 ${n}장 진화 (갈래는 고른다)`, effects: [{ kind: 'pickEvolve', count: n }] };
    }
    case 'training': {
      const n = COMPANION_BONUS.trainingFloors[tier] as number;
      return { preview: `특별 수련: 판 누적 층 +${n}`, effects: [{ kind: 'training', floors: n }] };
    }
    case 'escort': {
      const n = COMPANION_BONUS.escortParty[tier] as number;
      return { preview: `다음 원정 한 번 함께 오른다 (파티 보정 +${n})`, effects: [{ kind: 'escort', party: n }] };
    }
    case 'uniqueCard': {
      const level = STAR_SPEC[c.star].cardLevel;
      const card = familyCardId(c.family, level);
      return {
        preview: `고유 카드 '${fam.uniqueCardName}' 레벨 ${level}: ${cardText(card, 1, { short: true })}`,
        effects: [{ kind: 'addCard', card }],
      };
    }
  }
}

/** The 사연 of the companion's stage at this bond (13.9). Marks the stage open. */
export function storyChoice(s: RunState, index: number): RunChoice | null {
  const c = s.companions[index];
  if (c === undefined || !STORY_BONDS.includes(c.bond) || c.stories.includes(c.bond)) return null;
  const fam = FAMILIES[c.family];
  const story = fam.stories[STORY_BONDS.indexOf(c.bond)];
  if (story === undefined) return null;
  c.stories.push(c.bond);
  const options = story.choices.map((ch): RunOption => {
    const b = bonusEffects(s, c, ch.bonus);
    return { label: ch.label, preview: b.preview, cost: 0, effects: b.effects };
  });
  return choice(s, 'story', `${fam.name} · ${story.title}`, [...story.lines], options, c.family);
}

/** 유대 +1; the 사연 opens if the bond reaches 1, 3 or 5. */
export function raiseBond(s: RunState, index: number): RunChoice | null {
  const c = s.companions[index];
  if (c === undefined || c.bond >= BOND_MAX) return null;
  c.bond += 1;
  return storyChoice(s, index);
}

// ---------- 사건 (13.11) ----------

function signChoice(s: RunState, wall: RunWall): RunChoice {
  const info = seasonFloor(s.setup.season, wall.floor);
  const odds = floorOdds(s, wall.floor);
  const season = SEASONS[s.setup.season];
  return choice(s, 'sign', '탑의 기척', [
    fillLine(season.signLine, { boss: info.name }),
    `${wall.floor}층 ${info.name} · ${BODY_LABEL[info.body]} · ${ELEMENT_LABEL[info.element]}. 지금 돌파 확률 ${Math.round(odds.chance * 100)}%`,
  ], [{ label: '알았다', preview: `마감까지 ${wall.deadline - s.turn}턴`, cost: 0, effects: [] }]);
}

function seasonReward(s: RunState, r: SeasonReward): { preview: string; effects: RunEffect[] } {
  if (r.kind === 'card') return { preview: `${cardName(r.card)}: ${cardText(r.card, 1, { short: true })}`, effects: [{ kind: 'addCard', card: r.card }] };
  if (r.kind === 'material') {
    return { preview: `${enchantMaterialLabel(r.key)} ${r.count}개`, effects: [{ kind: 'material', key: r.key, count: r.count }] };
  }
  const amount = r.units * bandPrice(s);
  return { preview: `${amount}G`, effects: [{ kind: 'gold', amount }] };
}

/** 시즌 사건 i at the end of this turn of a run of this length (scaled from 30 turns). */
export function seasonEventTurn(turn: number, runTurns: number, baseTurns: number): number {
  return Math.max(1, Math.round((turn * runTurns) / baseTurns));
}

function seasonChoice(s: RunState, index: number): RunChoice {
  const ev = SEASONS[s.setup.season].events[index];
  if (ev === undefined) throw new Error(`season event ${index} missing`);
  return choice(
    s,
    'season',
    ev.title,
    [...ev.lines],
    ev.choices.map((c): RunOption => {
      const r = seasonReward(s, c.reward);
      return { label: c.label, preview: r.preview, cost: 0, effects: r.effects };
    }),
  );
}

/**
 * 행상 (13.11): 기술 카드 3장 (시즌 카드 풀), 카드 1장 빼기 (덱이 MERCHANT_REMOVE_MIN_DECK장보다 많을 때),
 * 희귀 재료 하나 (상급 인챈트 재료나 원소 결정 묶음), 화로 손질 (판당 1번). One of them is bought, or none.
 */
function merchantChoice(s: RunState, rng: Rng): RunChoice {
  const price = bandPrice(s);
  const cards = pickDistinct(rng, rewardPool(s.setup.season), MERCHANT_CARD_CHOICES);
  const options: RunOption[] = cards.map((card) => cardOption(card, `${cardName(card)} 사기`, price * MERCHANT_PRICE_UNITS.card));
  if (s.deck.length > MERCHANT_REMOVE_MIN_DECK) {
    options.push({
      label: '카드 빼기',
      preview: '덱에서 카드 1장을 뺀다',
      cost: price * MERCHANT_PRICE_UNITS.remove,
      effects: [{ kind: 'pickRemove' }],
    });
  }
  if (s.handBonus === 0) {
    options.push({
      label: '화로 손질',
      preview: `이번 판 손패 +${FURNACE_TUNE_HAND} (판당 한 번)`,
      cost: price * MERCHANT_PRICE_UNITS.furnace,
      effects: [{ kind: 'furnace' }],
    });
  }
  if (rng.chance(MERCHANT_UPPER_CHANCE)) {
    const key: EnchantMaterialKey = `${rng.pick(BODY_MATERIAL_FAMILIES)}:high`;
    options.push({
      label: enchantMaterialLabel(key),
      preview: '1개 (상점에 없는 상급 재료)',
      cost: price * MERCHANT_PRICE_UNITS.upper,
      effects: [{ kind: 'material', key, count: 1 }],
    });
  } else {
    const key: EnchantMaterialKey = `crystal:${rng.pick(ELEMENTS)}`;
    options.push({
      label: `${enchantMaterialLabel(key)} 묶음`,
      preview: `${MERCHANT_CRYSTAL_BUNDLE}개`,
      cost: price * MERCHANT_PRICE_UNITS.crystals,
      effects: [{ kind: 'material', key, count: MERCHANT_CRYSTAL_BUNDLE }],
    });
  }
  options.push(LEAVE);
  return choice(s, 'merchant', '행상', [MERCHANT_LINE], options);
}

/** Evolution choice: n more after this one if remaining > 0. Null when no card can evolve. */
export function evolveChoice(s: RunState, title: string, lines: string[], remaining = 0): RunChoice | null {
  const opts = evolveOptions(s.deck);
  if (opts.length === 0) return null;
  return choice(
    s,
    'evolve',
    title,
    lines,
    opts.map((o): RunOption => ({
      label: `${cardName(o.card)} → ${cardName(o.to)}`,
      preview: `${EVOLVE_BRANCH_LABEL[o.branch]}: ${cardText(o.to, 1, { short: true })}`,
      cost: 0,
      effects: [
        { kind: 'evolve', card: o.card, branch: o.branch },
        ...(remaining > 0 ? [{ kind: 'pickEvolve' as const, count: remaining }] : []),
      ],
    })),
  );
}

function artisanChoice(s: RunState, rng: Rng): RunChoice | null {
  const offers = pickDistinct(rng, evolveOptions(s.deck), ARTISAN_OFFERS);
  if (offers.length === 0) return null;
  return choice(s, 'artisan', '떠돌이 장인', [ARTISAN_LINE], [
    ...offers.map((o): RunOption => ({
      label: `${cardName(o.card)} → ${cardName(o.to)}`,
      preview: `${EVOLVE_BRANCH_LABEL[o.branch]}: ${cardText(o.to, 1, { short: true })}`,
      cost: 0,
      effects: [{ kind: 'evolve' as const, card: o.card, branch: o.branch }],
    })),
    { label: '사양한다', preview: '덱을 그대로 둔다', cost: 0, effects: [] },
  ]);
}

function removeChoice(s: RunState): RunChoice | null {
  const cards = [...new Set(s.deck)];
  if (cards.length === 0) return null;
  return choice(
    s,
    'remove',
    '카드 빼기',
    ['덱에서 뺄 카드를 고른다.'],
    cards.map((card): RunOption => ({
      label: cardName(card),
      preview: cardText(card, 1, { short: true }),
      cost: 0,
      effects: [{ kind: 'removeCard' as const, card }],
    })),
  );
}

/** 동료 사연 (13.11): 동료 하나가 말을 건다. 유대 +1; a 사연 단계 opens its story instead of the chat. */
function chatEvent(s: RunState, rng: Rng): RunChoice | null {
  const open = s.companions.map((c, i) => ({ c, i })).filter(({ c }) => c.bond < BOND_MAX);
  if (open.length === 0) return null;
  const { c, i } = rng.pick(open);
  const story = raiseBond(s, i);
  if (story !== null) return story;
  const fam = FAMILIES[c.family];
  return choice(s, 'chat', `${fam.name}의 이야기`, [fam.chat], [{ label: '고개를 끄덕인다', preview: `유대 ${c.bond}`, cost: 0, effects: [] }], c.family);
}

/**
 * The one 사건 at the end of a turn (13.11), or null. Order: 탑의 기척 (벽 마감 2턴 전, 보스를
 * 아직 못 넘었으면) → 시즌 사건 (its turn) → by action: 원정 뒤 동료 사연, 단조 뒤 떠돌이 장인,
 * 원정이 아닌 턴 뒤 행상. Two numbers are always drawn first, so the stream means the same every turn.
 */
export function rollTurnEvent(s: RunState, action: RunActionKind, baseTurns: number): RunChoice | null {
  const rng = rngFor(s.setup.seed, EVENT_STREAM, s.turn);
  const first = rng.next();
  const second = rng.next();
  const sign = s.walls.find((w) => w.passedTurn === null && w.deadline - SIGN_TURNS_BEFORE === s.turn);
  if (sign !== undefined) return signChoice(s, sign);
  const events = SEASONS[s.setup.season].events;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev === undefined || s.seasonEventsDone.includes(i)) continue;
    if (seasonEventTurn(ev.turn, s.rules.turns, baseTurns) <= s.turn) {
      s.seasonEventsDone.push(i);
      return seasonChoice(s, i);
    }
  }
  const rate = s.rules.eventRate;
  if (action === 'expedition' || action === 'wall') {
    return first < EVENT_CHANCE.chat * rate ? chatEvent(s, rng) : null;
  }
  if (action === 'forge' && first < EVENT_CHANCE.artisan * rate) {
    const c = artisanChoice(s, rng);
    if (c !== null) return c;
  }
  if (action === 'climb' || action === 'retire') return null;
  return second < EVENT_CHANCE.merchant * rate ? merchantChoice(s, rng) : null;
}

// ---------- Effects ----------

/** Applies a chosen option's effects. Follow-up choices (카드 빼기, 진화) go to the front of the queue. */
export function applyEffects(s: RunState, effects: readonly RunEffect[]): void {
  const follow: RunChoice[] = [];
  for (const e of effects) {
    switch (e.kind) {
      case 'gold':
        s.gold += e.amount;
        s.stats.goldGifted += e.amount;
        break;
      case 'material':
        addMaterial(s, e.key, e.count);
        break;
      case 'mainMaterial':
        addMain(s, e.tier, e.count);
        break;
      case 'addCard':
        s.deck.push(e.card);
        break;
      case 'removeCard':
        removeOneCard(s.deck, e.card);
        break;
      case 'pickRemove': {
        const c = removeChoice(s);
        if (c !== null) follow.push(c);
        break;
      }
      case 'evolve':
        evolveInDeck(s.deck, e.card, e.branch);
        break;
      case 'pickEvolve': {
        const c = evolveChoice(s, '카드 강화', ['진화할 카드와 갈래를 고른다.'], e.count - 1);
        if (c !== null) follow.push(c);
        break;
      }
      case 'training':
        s.cumulativeFloors += e.floors;
        break;
      case 'escort':
        s.escort += e.party;
        break;
      case 'furnace':
        s.handBonus = FURNACE_TUNE_HAND;
        break;
      case 'none':
        break;
    }
  }
  s.pending = [...follow, ...s.pending];
}
