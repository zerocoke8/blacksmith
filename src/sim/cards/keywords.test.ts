// Card rules one by one (기획서 4.2 키워드·규칙, 4.2.2~4.2.5). Every craft here is
// 1구간 기본 (공정 390, 품질 상한 1,600, 내구도 28) with 숙련도 100 unless it says otherwise.

import { describe, expect, it } from 'vitest';
import type { UniqueId } from '../core/types.ts';
import type { CardId, FireState } from '../data/cards.ts';
import { dayOneDeck } from './deck.ts';
import {
  abandonCardCraft,
  blockReason,
  cardCost,
  cardCraftOutcome,
  type CardCraftSetup,
  type CardCraftState,
  cardIdOf,
  checkPlay,
  endTurn,
  nextFirePreview,
  playCard,
  reheatInfo,
  startCardCraft,
} from './engine.ts';
import { rollRerollFire, rollTurnFire } from './fire.ts';
import { cardName } from './text.ts';
import { cloneCraft, handIds, inHand, layOut, makeCardSetup, playAll } from './testkit.ts';

const DAY1 = dayOneDeck();

function craft(extra: CardId[], hand: CardId[], over: Partial<CardCraftSetup> = {}): CardCraftState {
  const s = startCardCraft(makeCardSetup({ deck: [...DAY1, ...extra], rules: { firePreset: 'allNormal' }, ...over }));
  return layOut(s, hand);
}

function legendary(boss: UniqueId, hand: CardId[]): CardCraftState {
  return craft([], hand, { recipe: { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: boss } });
}

function patch(s: CardCraftState, p: Partial<CardCraftState>): CardCraftState {
  return { ...cloneCraft(s), ...p };
}

function withFire(s: CardCraftState, fire: FireState): CardCraftState {
  return patch(s, { fire });
}

const ids = (s: CardCraftState, uids: readonly string[]): CardId[] => uids.map((u) => cardIdOf(s, u));
const play = (s: CardCraftState, id: CardId): CardCraftState => playCard(s, inHand(s, id));

describe('소멸', () => {
  it('담금질 leaves the craft and never comes back', () => {
    let s = patch(craft([], ['quench', 'hammer', 'polish', 'polish', 'polish']), { durability: 10 });
    s = play(s, 'quench');
    expect(s.durability).toBe(18);
    expect(ids(s, s.exhausted)).toEqual(['quench']);
    for (let i = 0; i < 6; i++) {
      s = endTurn(s);
      expect(handIds(s)).not.toContain('quench');
    }
  });

  it('담금질 never lowers durability and stops at the max', () => {
    const s = play(patch(craft([], ['quench', 'hammer', 'polish', 'polish', 'polish']), { durability: 25 }), 'quench');
    expect(s.durability).toBe(28);
  });

  it('material cards are 소멸', () => {
    const s = play(craft([], ['ironMelt', 'hammer', 'polish', 'polish', 'polish']), 'ironMelt');
    expect(ids(s, s.exhausted)).toEqual(['ironMelt']);
  });
});

describe('첫 손', () => {
  const deck = [...DAY1, 'firstTouch' as const];

  it('is always in the first hand', () => {
    for (let craftNo = 1; craftNo <= 30; craftNo++) {
      expect(handIds(startCardCraft(makeCardSetup({ deck, craftNo })))).toContain('firstTouch');
    }
  });

  it('is gone after turn 1, played or not, wherever it is', () => {
    const start = startCardCraft(makeCardSetup({ deck, rules: { firePreset: 'allNormal' } }));
    const kept = endTurn(start);
    expect(ids(kept, kept.exhausted)).toEqual(['firstTouch']);
    const played = play(start, 'firstTouch');
    expect(ids(played, played.exhausted)).toEqual(['firstTouch']);
    expect(played.quality).toBe(150);
    expect(played.heat).toBe(2);
    // On top of the 뽑을 더미 when turn 1 ends: still gone, not drawn.
    const buried = layOut(start, ['hammer', 'hammer', 'polish', 'polish', 'polish'], ['firstTouch']);
    const next = endTurn(buried);
    expect(handIds(next)).not.toContain('firstTouch');
    expect(ids(next, next.exhausted)).toContain('firstTouch');
  });

  it('cannot be played after turn 1', () => {
    const s = patch(startCardCraft(makeCardSetup({ deck })), { turn: 2 });
    expect(blockReason(s, inHand(s, 'firstTouch'))).toBe('첫 턴에만');
  });
});

describe('간직', () => {
  it('a 간직 card stays in hand when the turn ends', () => {
    let s = craft(['lightHammer'], ['lightHammer', 'polish', 'polish', 'polish', 'hammer']);
    s = endTurn(s);
    expect(handIds(s)).toContain('lightHammer');
    expect(s.hand).toHaveLength(5);
  });

  it('최후의 한 수: only with 30% or less left, then fills the 공정', () => {
    let s = craft(['lastStroke'], ['lastStroke', 'hammer', 'polish', 'polish', 'polish']);
    expect(checkPlay(s, inHand(s, 'lastStroke'))).toMatchObject({ ok: false, reason: '남은 공정이 30% 이하일 때만' });
    s = endTurn(s);
    expect(handIds(s)).toContain('lastStroke');
    s = patch(s, { progress: 280, durability: 1 });
    // Costs 2 with 1 left, but it fills the 공정: 막타.
    expect(checkPlay(s, inHand(s, 'lastStroke'))).toMatchObject({ ok: true, finishes: true });
    s = play(s, 'lastStroke');
    expect(s.progress).toBe(390);
    expect(s.status).toBe('success');
  });
});

describe('각인', () => {
  it('두꺼운 모루판 never comes to hand and adds 5 durability', () => {
    const s = startCardCraft(makeCardSetup({ deck: [...DAY1, 'thickAnvil'] }));
    expect(s.imprints).toEqual(['thickAnvil']);
    expect(Object.values(s.cards)).not.toContain('thickAnvil');
    expect([s.maxDurability, s.durability]).toEqual([33, 33]);
  });

  it('단련된 팔 and 섬세한 손 raise 숙련도 by 10%', () => {
    const arm = craft(['trainedArm'], ['hammer', 'polish', 'polish', 'polish', 'hammer']);
    expect(arm.smith.craftsmanship).toBe(110);
    expect(play(arm, 'hammer').progress).toBe(110);
    const hand = craft(['deftHand'], ['hammer', 'polish', 'polish', 'polish', 'hammer']);
    expect(hand.smith.control).toBe(110);
    expect(play(hand, 'polish').quality).toBe(110);
  });

  it('불꽃 읽기 shows the next fire state, and it comes true', () => {
    for (let craftNo = 1; craftNo <= 20; craftNo++) {
      let s = startCardCraft(makeCardSetup({ craftNo, deck: [...DAY1, 'flameReading'] }));
      for (let t = 0; t < 4 && s.status === 'active'; t++) {
        const seen = nextFirePreview(s);
        expect(seen).not.toBeNull();
        s = endTurn(s);
        if (s.status === 'active') expect(s.fire).toBe(seen);
      }
    }
    expect(nextFirePreview(startCardCraft(makeCardSetup()))).toBeNull();
  });
});

describe('좋음 전용', () => {
  it('정밀 다듬기 needs 좋음 or 최상', () => {
    const s = craft([], ['precisePolish', 'hammer', 'polish', 'polish', 'polish']);
    expect(checkPlay(s, inHand(s, 'precisePolish'))).toMatchObject({ ok: false, reason: '좋음·최상일 때만' });
    const good = play(withFire(s, 'good'), 'precisePolish');
    expect([good.quality, good.heat]).toEqual([225, 2]);
    expect(checkPlay(withFire(s, 'excellent'), inHand(s, 'precisePolish')).ok).toBe(true);
  });

  it('불씨 살리기 draws 2 past the hand size', () => {
    const s = craft(['kindle'], ['kindle', 'hammer', 'polish', 'polish', 'polish']);
    expect(blockReason(s, inHand(s, 'kindle'))).toBe('좋음·최상일 때만');
    const after = play(withFire(s, 'good'), 'kindle');
    expect(after.hand).toHaveLength(6);
    expect(after.durability).toBe(28);
  });
});

describe('내구도와 막타', () => {
  const base = (): CardCraftState => craft([], ['hammer', 'polish', 'polish', 'polish', 'bellows']);

  it('a card that fills the 공정 can be played past the durability (막타)', () => {
    const s = patch(base(), { progress: 300, durability: 2 });
    expect(checkPlay(s, inHand(s, 'hammer'))).toEqual({ ok: true, cost: 3, finishes: true, breaks: false });
    const done = play(s, 'hammer');
    expect([done.status, done.durability]).toEqual(['success', -1]);
  });

  it('any other card needs the durability', () => {
    const s = patch(base(), { progress: 300, durability: 2 });
    expect(checkPlay(s, inHand(s, 'polish'))).toMatchObject({ ok: false, reason: '내구도가 모자라다' });
    expect(() => play(s, 'polish')).toThrow();
  });

  it('emptying the iron without filling the 공정 breaks it', () => {
    const s = patch(base(), { progress: 300, durability: 3 });
    expect(checkPlay(s, inHand(s, 'polish'))).toMatchObject({ ok: true, breaks: true, finishes: false });
    const broken = play(s, 'polish');
    expect(broken.status).toBe('failed');
    expect(cardCraftOutcome(broken)).toMatchObject({ success: false, tier: null, slots: 0 });
  });

  it('다시 달구기 to 0 or below is a failure', () => {
    const s = patch(base(), { durability: 2 });
    expect(reheatInfo(s)).toMatchObject({ durability: -2, breaks: true });
    const failed = endTurn(s);
    expect(failed.status).toBe('failed');
    expect(failed.log.at(-1)).toMatchObject({ kind: 'end', status: 'failed', abandoned: false });
  });

  it('stopping is a failure', () => {
    const s = abandonCardCraft(base());
    expect([s.status, s.abandoned]).toEqual(['failed', true]);
    expect(() => endTurn(s)).toThrow();
  });
});

describe('열기', () => {
  it('stops at 10', () => {
    const s = play(patch(craft([], ['precisePolish', 'hammer', 'polish', 'polish', 'polish']), { fire: 'good', heat: 9 }), 'precisePolish');
    expect(s.heat).toBe(10);
  });

  it('마무리 needs 열기 and spends all of it', () => {
    const s = craft([], ['finisher', 'polish', 'polish', 'polish', 'hammer']);
    expect(blockReason(s, inHand(s, 'finisher'))).toBe('열기가 없다');
    const hot = play(patch(s, { heat: 5 }), 'finisher');
    // 100 × (1 + 5 × 0.2) × (1 + 5 × 0.1) = 300
    expect([hot.quality, hot.heat]).toEqual([300, 0]);
  });

  it('does not cool between turns', () => {
    let s = play(craft([], ['polish', 'polish', 'polish', 'hammer', 'hammer']), 'polish');
    s = endTurn(s);
    expect(s.heat).toBe(1);
  });
});

describe('buffs', () => {
  it('풀무질 lasts this turn and the next; playing it again restarts, not adds', () => {
    let s = craft(['bellows'], ['bellows', 'polish', 'hammer', 'hammer', 'polish'], {});
    s = play(s, 'bellows');
    expect(s.buffs.bellows).toBe(2);
    s = endTurn(layOut(s, handIds(s), ['bellows', 'polish']));
    expect(s.buffs.bellows).toBe(1);
    s = play(s, 'bellows');
    expect(s.buffs.bellows).toBe(2);
    s = endTurn(s);
    s = endTurn(s);
    expect(s.buffs.bellows).toBeUndefined();
  });

  it('풀무질 and 혼신 add: +150%', () => {
    let s = craft(['allIn'], ['bellows', 'allIn', 'polish', 'polish', 'hammer']);
    s = playAll(s, ['bellows', 'allIn', 'polish']);
    expect(s.quality).toBe(250);
    s = play(s, 'polish');
    // 혼신 was spent: 100 × 1.1 × 1.5
    expect(s.quality).toBe(250 + 165);
    expect(s.charges.allIn).toBeUndefined();
  });

  it('아껴 치기: other cards cost 1 less (at least 1) this turn and next', () => {
    let s = craft(['thrift'], ['thrift', 'hammer', 'bellows', 'quench', 'polish']);
    s = play(s, 'thrift');
    expect(s.durability).toBe(27);
    expect([cardCost(s, inHand(s, 'hammer')), cardCost(s, inHand(s, 'bellows')), cardCost(s, inHand(s, 'quench'))]).toEqual([2, 1, 0]);
    s = endTurn(layOut(s, handIds(s), ['hammer']));
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(2);
    s = endTurn(layOut(s, handIds(s), ['hammer']));
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(3);
  });

  it('첫 망치: +300%, and the next 공정 card in this turn or the next gets +100% once', () => {
    const recipe = { weaponType: 'oneHandSword' as const, materialTier: 3, bossMaterial: null };
    let s = craft(['firstHammer'], ['firstHammer', 'hammer', 'hammer', 'polish', 'polish'], { recipe });
    expect(s.recipe.progressRequired).toBe(543);
    s = playAll(s, ['firstHammer', 'hammer']);
    expect(s.progress).toBe(500);
    expect(s.charges.firstHammer).toBeUndefined();
    let unused = play(craft(['firstHammer'], ['firstHammer', 'hammer', 'hammer', 'polish', 'polish'], { recipe }), 'firstHammer');
    unused = endTurn(unused);
    expect(unused.charges.firstHammer).toEqual({ left: 1, turns: 1 });
    unused = endTurn(unused);
    expect(unused.charges.firstHammer).toBeUndefined();
  });

  it('단조 유지: the next 4 다시 달구기 restore 2 instead of costing 2', () => {
    let s = patch(craft(['keepForging'], ['keepForging', 'hammer', 'polish', 'polish', 'polish']), { durability: 20 });
    s = play(s, 'keepForging');
    expect(s.durability).toBe(15);
    expect(ids(s, s.exhausted)).toEqual(['keepForging']);
    expect(reheatInfo(s).durability).toBe(2);
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = endTurn(s);
      seen.push(s.durability);
    }
    expect(seen).toEqual([17, 19, 21, 23, 21]);
  });

  it('단조 유지 never fills past the max', () => {
    let s = play(craft(['keepForging'], ['keepForging', 'hammer', 'polish', 'polish', 'polish']), 'keepForging');
    s = patch(s, { durability: 27 });
    s = endTurn(s);
    expect(s.durability).toBe(28);
    s = endTurn(s);
    expect(s.durability).toBe(28);
  });
});

describe('화로 상태', () => {
  const hand: CardId[] = ['hammer', 'polish', 'bellows', 'quench', 'polish'];

  it('좋음 ×1.5, 최상 ×3, 식음 ×0.5 on quality', () => {
    expect(play(withFire(craft([], hand), 'good'), 'polish').quality).toBe(150);
    expect(play(withFire(craft([], hand), 'excellent'), 'polish').quality).toBe(300);
    expect(play(withFire(craft([], hand), 'poor'), 'polish').quality).toBe(50);
  });

  it('잘 펴짐 ×1.5 on progress', () => {
    expect(play(withFire(craft([], hand), 'malleable'), 'hammer').progress).toBe(150);
  });

  it('단단함 halves costs, rounding up', () => {
    const s = withFire(craft([], hand), 'sturdy');
    expect([cardCost(s, inHand(s, 'hammer')), cardCost(s, inHand(s, 'bellows')), cardCost(s, inHand(s, 'quench'))]).toEqual([2, 1, 0]);
  });

  it('세찬 불 draws 2 more at the start of the turn', () => {
    const grade = 'advanced';
    let craftNo = 1;
    while (rollTurnFire({ seed: 1, stream: 'craft', craftNo }, grade, 'default', 2, 'normal') !== 'surge') craftNo += 1;
    const s = endTurn(startCardCraft(makeCardSetup({ craftNo, recipe: { weaponType: 'bow', materialTier: 5, bossMaterial: null } })));
    expect(s.fire).toBe('surge');
    expect(s.hand).toHaveLength(7);
  });

  it('불 다시 보기 rerolls with the (…, fire, turn, r) key, 3 times per craft', () => {
    let s = startCardCraft(makeCardSetup({ deck: [...DAY1, 'reread', 'reread'] }));
    s = layOut(s, ['reread', 'reread', 'polish', 'polish', 'hammer']);
    s = play(s, 'reread');
    expect(s.fire).toBe(rollRerollFire({ seed: 1, stream: 'craft', craftNo: 1 }, 'basic', 'default', 1, 1));
    s = play(s, 'reread');
    expect(s.fire).toBe(rollRerollFire({ seed: 1, stream: 'craft', craftNo: 1 }, 'basic', 'default', 1, 2));
    expect([s.rerollsThisTurn, s.rerollsUsed]).toEqual([2, 2]);
    const spent = layOut(patch(s, { rerollsUsed: 3 }), ['reread', 'polish', 'hammer', 'polish', 'hammer']);
    expect(blockReason(spent, inHand(spent, 'reread'))).toBe('다시 보기는 제작당 3번');
  });

  it('대장장이의 감 makes 좋음, but 최상 stays', () => {
    const s = craft(['smithSense'], ['smithSense', 'polish', 'polish', 'polish', 'hammer']);
    const good = play(s, 'smithSense');
    expect(good.fire).toBe('good');
    expect(ids(good, good.exhausted)).toEqual(['smithSense']);
    expect(play(withFire(s, 'excellent'), 'smithSense').fire).toBe('excellent');
  });
});

describe('화로 간직 (다시 달구기 때 손패 넘기기)', () => {
  it('keeps the picked cards up to the furnace count', () => {
    const tools = { anvil: 0, whetstone: 0, furnace: 1 };
    let s = craft([], ['polish', 'hammer', 'hammer', 'bellows', 'quench'], { tools });
    expect(reheatInfo(s).keep).toBe(1);
    const keep = inHand(s, 'bellows');
    expect(() => endTurn(s, [keep, inHand(s, 'quench')])).toThrow();
    s = endTurn(s, [keep]);
    expect(s.hand[0]).toBe(keep);
    expect(s.hand).toHaveLength(5);
  });
});

describe('주재료 카드 (4.2.4)', () => {
  const recipe = (materialTier: number) => ({ recipe: { weaponType: 'dagger' as const, materialTier, bossMaterial: null } });

  it('강철 접기: 공정 +80%, the next card this turn costs 1 less', () => {
    let s = craft([], ['steelFold', 'hammer', 'hammer', 'polish', 'polish'], recipe(2));
    s = play(s, 'steelFold');
    expect(s.progress).toBe(80);
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(2);
    s = play(s, 'hammer');
    expect(cardCost(s, inHand(s, 'hammer'))).toBe(3);
  });

  it('미스릴 결: 품질 +80%, 열기 +2', () => {
    const s = play(craft([], ['mithrilGrain', 'hammer', 'hammer', 'polish', 'polish'], recipe(3)), 'mithrilGrain');
    expect([s.quality, s.heat]).toEqual([80, 2]);
  });

  it('오리할콘 빛: stronger on 좋음·최상', () => {
    const s = craft([], ['orichalcumGlow', 'hammer', 'hammer', 'polish', 'polish'], recipe(4));
    expect([play(s, 'orichalcumGlow').quality, play(s, 'orichalcumGlow').heat]).toEqual([60, 1]);
    const good = play(withFire(s, 'good'), 'orichalcumGlow');
    expect([good.quality, good.heat]).toEqual([300, 2]);
  });

  it('아다만 심 +n: +10%p per band past 아다만, at most +100%p', () => {
    const at5 = play(craft([], ['adamantCore', 'hammer', 'hammer', 'polish', 'polish'], recipe(5)), 'adamantCore');
    expect([at5.progress, at5.quality, at5.heat]).toEqual([150, 100, 1]);
    const at7 = play(craft([], ['adamantCore', 'hammer', 'hammer', 'polish', 'polish'], recipe(7)), 'adamantCore');
    expect([at7.progress, at7.quality]).toEqual([170, 120]);
    expect(cardName('adamantCore', 7)).toBe('아다만 심 +2');
    const at30 = play(craft([], ['adamantCore', 'hammer', 'hammer', 'polish', 'polish'], recipe(30)), 'adamantCore');
    expect([at30.progress, at30.quality]).toEqual([250, 200]);
  });
});

describe('대보스 재료 카드 (4.2.4)', () => {
  it('putting one in makes the recipe 전설 and shuffles in its 2 cards', () => {
    const s = legendary('earthBlessing', ['giantHammer', 'hammer', 'polish', 'polish', 'polish']);
    expect(s.recipe.grade).toBe('legendary');
    expect(s.recipe.materialCards).toEqual(['ironMelt', 'ironMelt', 'giantHammer', 'giantHammer']);
    expect(s.maxDurability).toBe(70);
  });

  it('용의 숨결: 최상 now, so 식음 next turn', () => {
    let s = legendary('dragonFury', ['dragonBreath', 'polish', 'polish', 'polish', 'hammer']);
    s = play(s, 'dragonBreath');
    expect(s.fire).toBe('excellent');
    expect(play(s, 'polish').quality).toBe(300);
    s = endTurn(s);
    expect(s.fire).toBe('poor');
  });

  it('다시 피는 불: picks up to 3 cards from the 버린 더미', () => {
    let s = legendary('rebirth', ['rekindle', 'hammer', 'polish', 'polish', 'bellows']);
    expect(blockReason(s, inHand(s, 'rekindle'))).toBe('버린 더미가 비었다');
    s = playAll(s, ['hammer', 'polish']);
    const picks = [...s.discard];
    expect(() => playCard(s, inHand(s, 'rekindle'), { targets: ['nope'] })).toThrow();
    s = playCard(s, inHand(s, 'rekindle'), { targets: picks });
    expect(s.hand).toEqual(expect.arrayContaining(picks));
    expect(s.discard).toEqual([]);
  });

  it('거인의 망치: 공정 +400%, 열기 +2', () => {
    const s = play(legendary('earthBlessing', ['giantHammer', 'hammer', 'polish', 'polish', 'polish']), 'giantHammer');
    expect([s.progress, s.heat, s.durability]).toEqual([400, 2, 63]);
  });

  it('겹친 갑피: 다시 달구기 costs 1 for the rest of the craft', () => {
    let s = play(legendary('allPierce', ['layeredShell', 'hammer', 'polish', 'polish', 'polish']), 'layeredShell');
    expect(reheatInfo(s).durability).toBe(-1);
    s = endTurn(s);
    expect(s.durability).toBe(64);
  });

  it('폭풍 풀무: draws 3, 품질 +50% this turn only', () => {
    let s = legendary('dash', ['stormBellows', 'hammer', 'polish', 'polish', 'polish']);
    s = play(s, 'stormBellows');
    expect(s.hand).toHaveLength(7);
    expect(play(s, 'polish').quality).toBe(150);
    s = endTurn(s);
    expect(s.buffs.stormBellows).toBeUndefined();
  });

  it('순풍: 보통 becomes 좋음 this turn and the next', () => {
    let s = play(legendary('fairWind', ['tailwind', 'hammer', 'polish', 'polish', 'polish']), 'tailwind');
    expect(s.fire).toBe('good');
    s = endTurn(s);
    expect(s.fire).toBe('good');
    s = endTurn(s);
    expect(s.fire).toBe('normal');
  });

  it('깊은 물 담금: 내구도 +20 past the max, 열기 +2', () => {
    const s = play(legendary('tidalWave', ['deepWater', 'hammer', 'polish', 'polish', 'polish']), 'deepWater');
    expect([s.durability, s.maxDurability, s.heat]).toEqual([86, 70, 2]);
  });

  it('서리 마무리: 마무리만큼 올리고 열기는 그대로', () => {
    const s = play(patch(legendary('iceArmor', ['frostFinish', 'hammer', 'polish', 'polish', 'polish']), { heat: 4 }), 'frostFinish');
    // 100 × (1 + 4 × 0.2) × (1 + 4 × 0.1)
    expect([s.quality, s.heat]).toEqual([252, 4]);
  });

  it('the material comes back short of 걸작 and is lost on failure', () => {
    const s = legendary('iceArmor', ['hammer', 'polish', 'polish', 'polish', 'bellows']);
    expect(cardCraftOutcome(abandonCardCraft(s)).boss).toEqual({ unique: 'iceArmor', fate: 'lost' });
    const done = play(patch(s, { progress: s.recipe.progressRequired - 50, quality: 100 }), 'hammer');
    expect(cardCraftOutcome(done).boss).toEqual({ unique: 'iceArmor', fate: 'returned' });
    const best = play(patch(s, { progress: s.recipe.progressRequired - 50, quality: s.recipe.qualityCap }), 'hammer');
    expect(cardCraftOutcome(best)).toMatchObject({ tier: 5, boss: { unique: 'iceArmor', fate: 'used' } });
  });
});

describe('진화 카드 (4.2.5 갈래 예시)', () => {
  const hand = (first: CardId): CardId[] => [first, 'hammer', 'polish', 'polish', 'polish'];

  it('두드리기 → 묵직한 (5: +200%)', () => {
    const s = play(craft(['heavyHammer'], hand('heavyHammer')), 'heavyHammer');
    expect([s.progress, s.durability]).toEqual([200, 23]);
  });

  it('다듬기 → 꼼꼼한 (+80%, 열기 +2) · 날랜 (2: +70%, 열기 +1, 1장 뽑기)', () => {
    const t = play(craft(['thoroughPolish'], hand('thoroughPolish')), 'thoroughPolish');
    expect([t.quality, t.heat]).toEqual([80, 2]);
    const q = play(craft(['quickPolish'], hand('quickPolish')), 'quickPolish');
    expect([q.quality, q.heat, q.durability, q.hand.length]).toEqual([70, 1, 26, 5]);
  });

  it('정밀 다듬기 → 불꽃 맞추기 (좋음 전용 +220%) · 눈썰미', () => {
    const f = craft(['flameMatch'], hand('flameMatch'));
    expect(blockReason(f, inHand(f, 'flameMatch'))).toBe('좋음·최상일 때만');
    expect(play(withFire(f, 'good'), 'flameMatch').quality).toBe(330);
    const k = craft(['keenEye'], hand('keenEye'));
    const plain = play(k, 'keenEye');
    expect([plain.quality, plain.heat]).toEqual([60, 1]);
    const good = play(withFire(k, 'good'), 'keenEye');
    expect([good.quality, good.heat]).toEqual([225, 2]);
  });

  it('풀무질 → 센 (이번 턴 +100%) · 긴 (3턴 +40%)', () => {
    let strong = play(craft(['strongBellows'], hand('strongBellows')), 'strongBellows');
    expect(play(strong, 'polish').quality).toBe(200);
    strong = endTurn(strong);
    expect(strong.buffs.strongBellows).toBeUndefined();
    let long = play(craft(['longBellows'], hand('longBellows')), 'longBellows');
    expect(play(long, 'polish').quality).toBe(140);
    long = endTurn(endTurn(long));
    expect(long.buffs.longBellows).toBe(1);
    long = endTurn(long);
    expect(long.buffs.longBellows).toBeUndefined();
  });

  it('담금질 → 깊은 (+14, 턴이 끝난다) · 물 뿌리기 (+4, 열기 −1, 소멸하지 않는다)', () => {
    const deep = play(patch(craft(['deepQuench'], hand('deepQuench')), { durability: 10 }), 'deepQuench');
    expect([deep.turn, deep.durability]).toEqual([2, 22]);
    const wet = play(patch(craft(['sprinkle'], hand('sprinkle')), { durability: 10, heat: 3 }), 'sprinkle');
    expect([wet.durability, wet.heat]).toEqual([14, 2]);
    expect(ids(wet, wet.discard)).toEqual(['sprinkle']);
  });

  it('마무리 → 큰 (열기 5 이상, ×0.3) · 반 (열기 절반만)', () => {
    const big = craft(['grandFinish'], hand('grandFinish'));
    expect(blockReason(patch(big, { heat: 4 }), inHand(big, 'grandFinish'))).toBe('열기 5 이상일 때만');
    const b = play(patch(big, { heat: 5 }), 'grandFinish');
    // 100 × (1 + 5 × 0.3) × 1.5
    expect([b.quality, b.heat]).toEqual([375, 0]);
    const h = play(patch(craft(['halfFinish'], hand('halfFinish')), { heat: 5 }), 'halfFinish');
    // uses 2: 100 × 1.4 × (1 + 5 × 0.1)
    expect([h.quality, h.heat, h.durability]).toEqual([210, 3, 26]);
  });

  it('신중한 두드리기 → 단단한 (+200%, 다음 카드 −1) · 신중한 손길', () => {
    const solid = play(craft(['solidHammer'], hand('solidHammer')), 'solidHammer');
    expect(solid.progress).toBe(200);
    expect(cardCost(solid, inHand(solid, 'hammer'))).toBe(2);
    const touch = play(craft(['carefulTouch'], hand('carefulTouch')), 'carefulTouch');
    expect([touch.progress, touch.quality, touch.heat, touch.durability]).toEqual([100, 60, 1, 24]);
  });

  it('첫 손질 → 첫 불꽃 (열기 +3) · 첫 숨 (다음 턴 1장 더)', () => {
    const flame = startCardCraft(makeCardSetup({ deck: [...DAY1, 'firstFlame'], rules: { firePreset: 'allNormal' } }));
    const f = play(flame, 'firstFlame');
    expect([f.quality, f.heat]).toEqual([120, 3]);
    const breath = startCardCraft(makeCardSetup({ deck: [...DAY1, 'firstBreath'], rules: { firePreset: 'allNormal' } }));
    const b = endTurn(play(breath, 'firstBreath'));
    expect(b.hand).toHaveLength(6);
  });

  it('혼신 → 온 힘 (이번 턴 1장 +150%) · 고른 힘 (2장 +60%)', () => {
    let full = playAll(craft(['fullForce'], hand('fullForce')), ['fullForce', 'polish']);
    expect(full.quality).toBe(250);
    full = play(full, 'polish');
    expect(full.quality).toBe(250 + 110);
    let even = playAll(craft(['evenForce'], hand('evenForce')), ['evenForce', 'polish', 'polish']);
    expect(even.quality).toBe(160 + 176);
    even = play(even, 'polish');
    expect(even.quality).toBe(160 + 176 + 120);
  });
});
