// 덱 편집 검사 (기획서 4.2.1, 4.2.2, 4.2.6), 단련과 진화 (4.2.5), card text and the finished
// weapon (4.3).

import { describe, expect, it } from 'vitest';
import type { CardId } from '../data/cards.ts';
import { CARD_IDS, CARDS, DAY_ONE_DECK } from '../data/cards.ts';
import {
  type CardCollection,
  checkDeck,
  dayOneDeck,
  deckHandCount,
  EMPTY_COLLECTION,
  learnedUnlockCards,
  unlockCap,
} from './deck.ts';
import { fillSlot, slotBlock, weaponFromCardCraft } from './enchant.ts';
import { abandonCardCraft, cardCraftOutcome, playCard, startCardCraft } from './engine.ts';
import { evolveBlock, evolveCard, evolveCost, isTemperOpen, newlyOpened, recordTemper, temperNeed } from './evolve.ts';
import { cardText } from './text.ts';
import { cloneCraft, inHand, layOut, makeCardSetup } from './testkit.ts';

const DAY1 = dayOneDeck();
const all: CardCollection = { learned: learnedUnlockCards(7, true), evolved: {} };
const codes = (deck: CardId[], c: CardCollection = all, stage = 7): string[] => checkDeck(deck, c, stage).map((p) => p.code);

describe('1일차 덱', () => {
  it('is the doc’s 10 cards and is valid with nothing learned', () => {
    expect(DAY1).toHaveLength(10);
    expect(DAY_ONE_DECK.map(([id, n]) => `${CARDS[id].name} ${n}`)).toEqual([
      '두드리기 3',
      '다듬기 3',
      '정밀 다듬기 1',
      '풀무질 1',
      '담금질 1',
      '마무리 1',
    ]);
    expect(checkDeck(DAY1, EMPTY_COLLECTION, 1)).toEqual([]);
  });
});

describe('덱 편집 검사 (4.2.6)', () => {
  it('10~20 cards that come to hand; 각인 do not count', () => {
    expect(codes(DAY1.slice(1))).toEqual(['size']);
    const twenty = [...DAY1, 'hammer', 'polish', 'bellows', 'bellows', 'quench', 'finisher', 'finisher', 'precisePolish', 'quench', 'precisePolish'] as CardId[];
    expect(deckHandCount(twenty)).toBe(20);
    expect(codes(twenty)).toEqual([]);
    expect(codes([...twenty, 'deftHand'])).toEqual([]);
    expect(codes([...twenty, 'thrift'])).toEqual(['size']);
  });

  it('해금 카드 수 is capped by the 명성 단계, counted per card, 각인 included', () => {
    const three: CardId[] = [...DAY1, 'carefulHammer', 'carefulHammer', 'thrift'];
    expect(codes(three, all, 1)).toEqual([]);
    expect(codes([...three, 'deftHand'], all, 1)).toEqual(['unlockCap']);
    expect(codes([...three, 'deftHand'], all, 2)).toEqual([]);
    expect([1, 2, 7, 8, 10, 11, 30].map(unlockCap)).toEqual([3, 4, 9, 10, 12, 12, 12]);
  });

  it('진화한 기본 카드 does not count toward the cap; 진화한 해금 카드 does', () => {
    const owned: CardCollection = { learned: all.learned, evolved: { heavyHammer: 1, solidHammer: 1 } };
    const base: CardId[] = [...DAY1, 'carefulHammer', 'thrift', 'firstTouch'];
    expect(codes([...base, 'heavyHammer'], owned, 1)).toEqual([]);
    expect(codes([...base, 'solidHammer'], owned, 1)).toEqual(['unlockCap']);
  });

  it('같은 계열: 기본 4, 해금 2, 첫 손과 각인 1 (원래 카드 + 진화 카드)', () => {
    const owned: CardCollection = { learned: all.learned, evolved: { heavyHammer: 2, firstFlame: 1 } };
    expect(codes([...DAY1, 'hammer'], owned)).toEqual([]);
    expect(codes([...DAY1, 'hammer', 'hammer'], owned)).toEqual(['family']);
    expect(codes([...DAY1, 'heavyHammer', 'heavyHammer'], owned)).toEqual(['family']);
    expect(codes([...DAY1, 'carefulHammer', 'carefulHammer', 'carefulHammer'], owned)).toEqual(['family']);
    expect(codes([...DAY1, 'firstTouch', 'firstFlame'], owned)).toEqual(['family']);
    expect(codes([...DAY1, 'deftHand', 'deftHand'], owned)).toEqual(['family']);
  });

  it('↔: one of the two', () => {
    expect(codes([...DAY1, 'keepForging', 'thickAnvil'])).toEqual(['pair']);
    expect(codes([...DAY1, 'reread', 'smithSense'])).toEqual(['pair']);
    expect(codes([...DAY1, 'heatUp', 'reread'])).toEqual([]);
  });

  it('only owned cards, and no material cards', () => {
    expect(codes([...DAY1, 'carefulHammer'], EMPTY_COLLECTION, 1)).toEqual(['notOwned']);
    expect(codes([...DAY1, 'heavyHammer'], all)).toEqual(['notOwned']);
    expect(codes([...DAY1, 'ironMelt'])).toEqual(['notDeckCard']);
    expect(checkDeck([...DAY1, 'carefulHammer'], EMPTY_COLLECTION, 1)[0]?.message).toBe('신중한 두드리기: 아직 배우지 않았다');
  });

  it('해금 카드 open by 명성 단계; 단계 1 after the first craft', () => {
    expect(learnedUnlockCards(1, false)).toEqual([]);
    expect(learnedUnlockCards(1, true)).toEqual(['thrift', 'carefulHammer', 'firstTouch']);
    expect(learnedUnlockCards(2, true)).toContain('firstHammer');
    expect(learnedUnlockCards(6, true)).toHaveLength(16);
  });
});

describe('단련과 진화 (4.2.5)', () => {
  function finished(): ReturnType<typeof startCardCraft> {
    let s = startCardCraft(makeCardSetup({ deck: [...DAY1, 'deftHand'], rules: { firePreset: 'allNormal' } }));
    s = layOut(s, ['polish', 'polish', 'ironMelt', 'hammer', 'hammer']);
    s = { ...cloneCraft(s), progress: 300 };
    for (const id of ['polish', 'polish', 'ironMelt', 'hammer'] as const) s = playCard(s, inHand(s, id));
    return s;
  }

  it('단련 횟수 as in the doc', () => {
    const need = Object.fromEntries((['hammer', 'polish', 'precisePolish', 'bellows', 'quench', 'finisher', 'carefulHammer', 'firstTouch', 'allIn'] as const).map((id) => [id, temperNeed(id)]));
    expect(need).toEqual({ hammer: 30, polish: 30, precisePolish: 10, bellows: 15, quench: 10, finisher: 15, carefulHammer: 15, firstTouch: 15, allIn: 15 });
    expect(temperNeed('thrift')).toBeNull(); // no branches yet
  });

  it('counts plays of 기술 덱 cards (not material cards), and 각인 per finished craft', () => {
    const s = finished();
    expect(s.status).toBe('success');
    const record = recordTemper({ hammer: 5 }, s);
    expect(record).toEqual({ hammer: 6, polish: 2, deftHand: 1 });
    const failed = abandonCardCraft(startCardCraft(makeCardSetup({ deck: [...DAY1, 'deftHand'] })));
    expect(recordTemper({}, failed)).toEqual({});
    const active = startCardCraft(makeCardSetup());
    expect(recordTemper({ polish: 1 }, active)).toEqual({ polish: 1 });
  });

  it('opens at the count and says so once', () => {
    expect(isTemperOpen({ precisePolish: 9 }, 'precisePolish')).toBe(false);
    expect(isTemperOpen({ precisePolish: 10 }, 'precisePolish')).toBe(true);
    expect(newlyOpened({ quench: 9, hammer: 3 }, { quench: 10, hammer: 4 })).toEqual(['quench']);
    expect(evolveBlock({ hammer: 12 }, 'hammer')).toBe('단련 12 / 30');
  });

  it('costs 기준가 × 2^(명성 단계 − 1)', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((st) => evolveCost('hammer', st))).toEqual([300, 600, 1200, 2400, 4800, 9600, 19200]);
    expect([1, 2, 3, 4, 5, 6, 7].map((st) => evolveCost('carefulHammer', st))).toEqual([600, 1200, 2400, 4800, 9600, 19200, 38400]);
  });

  it('makes one evolved card per call; the original stays', () => {
    const record = { hammer: 30 };
    let c: CardCollection = { learned: [], evolved: {} };
    const a = evolveCard(c, record, 'hammer', 'power', 1);
    expect(a).toMatchObject({ card: 'heavyHammer', cost: 300 });
    c = a.collection;
    c = evolveCard(c, record, 'hammer', 'finesse', 1).collection;
    c = evolveCard(c, record, 'hammer', 'finesse', 1).collection;
    expect(c.evolved).toEqual({ heavyHammer: 1, lightHammer: 2 });
    // '묵직한 1장 + 가벼운 2장' with the three originals still owned.
    expect(codes(['heavyHammer', 'lightHammer', 'lightHammer', 'hammer', ...DAY1.slice(3)], c, 1)).toEqual([]);
    expect(() => evolveCard(c, { hammer: 29 }, 'hammer', 'power', 1)).toThrow();
  });
});

describe('카드 글', () => {
  it('reads like the doc', () => {
    expect(cardText('hammer')).toBe('공정 +100%');
    expect(cardText('polish')).toBe('품질 +100%, 열기 +1');
    expect(cardText('precisePolish')).toBe('좋음 전용. 품질 +150%, 열기 +2');
    expect(cardText('bellows')).toBe('이번 턴과 다음 턴, 품질 +50%');
    expect(cardText('quench')).toBe('내구도 +8 (최대 내구도까지). 소멸');
    expect(cardText('finisher')).toBe('열기 1 이상일 때. 열기를 모두 써서 품질 +100% × (1 + 열기 × 0.2)');
    expect(cardText('thickAnvil')).toBe('각인. 레시피 내구도 +5');
    expect(cardText('lastStroke')).toBe('간직. 남은 공정이 30% 이하일 때만. 공정을 모두 채운다');
    expect(cardText('firstHammer')).toBe('첫 손. 공정 +300%, 이번 턴과 다음 턴 안에서 다음 공정 카드 1장 +100%');
  });

  it('every card has one or two short lines', () => {
    for (const id of CARD_IDS) {
      const text = cardText(id, 7);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(60);
    }
  });
});

describe('완성 화면 (4.3)', () => {
  it('makes the weapon and fills slots with enchant materials', () => {
    let s = startCardCraft(makeCardSetup({ recipe: { weaponType: 'greatsword', materialTier: 1, bossMaterial: null } }));
    s = layOut(s, ['hammer', 'polish', 'polish', 'polish', 'bellows']);
    s = { ...cloneCraft(s), progress: 300, quality: 1000 };
    s = playCard(s, inHand(s, 'hammer'));
    expect(cardCraftOutcome(s)).toMatchObject({ tier: 3, slots: 2 });
    let weapon = weaponFromCardCraft(s, 'w1');
    expect(weapon).toEqual({ id: 'w1', type: 'greatsword', materialTier: 1, quality: 3, element: null, enchants: [], unique: null });
    let inventory = { 'emblem:low': 1, 'feather:low': 1, 'crystal:fire': 1 } as const as Record<string, number>;
    expect(slotBlock(weapon, { kind: 'enchant', enchant: 'gale', element: null }, {})).toBe('재료가 없다');
    ({ weapon, inventory } = fillSlot(weapon, { kind: 'enchant', enchant: 'combo', element: null }, inventory));
    // 속성 칸 (4.3): every weapon has one outside the enchant slots; 속성 부여 is no longer an enchant.
    expect(slotBlock(weapon, { kind: 'enchant', enchant: 'element', element: 'fire' }, inventory)).toBe('속성은 속성 칸에 넣는다');
    ({ weapon, inventory } = fillSlot(weapon, { kind: 'elementSlot', element: 'fire' }, inventory));
    expect(weapon).toMatchObject({ element: 'fire', enchants: ['combo'] });
    expect(slotBlock(weapon, { kind: 'elementSlot', element: 'water' }, { 'crystal:water': 1 })).toBe('속성은 이미 정해졌다');
    // The element took no slot: 역작 (2 slots) still has room for one more enchant.
    ({ weapon, inventory } = fillSlot(weapon, { kind: 'enchant', enchant: 'keen', element: null }, inventory));
    expect(weapon.enchants).toEqual(['combo', 'keen']);
    expect(slotBlock(weapon, { kind: 'enchant', enchant: 'gale', element: null }, { 'emblem:low': 1 })).toBe('빈 슬롯이 없다');
    expect(inventory).toMatchObject({ 'emblem:low': 0, 'feather:low': 0, 'crystal:fire': 0 });
    // A 범작 (no enchant slots) still has its 속성 칸.
    const plain = { ...weapon, id: 'w0', quality: 1 as const, element: null, enchants: [] };
    expect(slotBlock(plain, { kind: 'elementSlot', element: 'wind' }, { 'crystal:wind': 1 })).toBeNull();
    expect(() => weaponFromCardCraft(abandonCardCraft(startCardCraft(makeCardSetup())), 'w2')).toThrow();
  });
});
