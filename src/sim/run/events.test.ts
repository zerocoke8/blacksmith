// 판 안의 사건 (기획서 13.11)과 보스 보상 (13.4.3): 언제 오고, 무엇을 내미는지, 한 턴에 하나. These are
// [튜닝] values that will move often, so their timing and wares are pinned here.

import { describe, expect, it } from 'vitest';
import { rngFor } from '../core/rng.ts';
import type { Weapon } from '../core/types.ts';
import { CARDS } from '../data/cards.ts';
import { materialPrice } from '../data/common.ts';
import {
  BOSS_REWARD,
  FIND_CHANCE_PER_FLOOR,
  MERCHANT_CARD_CHOICES,
  MERCHANT_PRICE_UNITS,
  MERCHANT_REMOVE_MIN_DECK,
  SEASONS,
  SIGN_TURNS_BEFORE,
  UPPER_MATERIAL_FROM_FLOOR,
} from '../data/run.ts';
import { bossReward, EVENT_STREAM, rewardPool, seasonEventTurn } from './events.ts';
import { findChance } from './expedition.ts';
import { runAct, startRun } from './run.ts';
import { draftRun } from './state.ts';
import { arenSetup, playThrough } from './testkit.ts';
import type { RunChoiceKind, RunRules, RunState } from './types.ts';

const start = (rules: Partial<RunRules> = {}, seed = 1): RunState => startRun(arenSetup({ seed }, rules));

/** A run on `turn` with the walls before it passed on time (bosses down to their floors). */
function onTurn(turn: number, rules: Partial<RunRules> = {}, seed = 1): RunState {
  const s = start(rules, seed);
  const passed = s.walls.filter((w) => w.deadline < turn);
  const floor = passed.length * 10;
  return {
    ...s,
    turn,
    lastBossFloor: floor,
    record: floor,
    walls: s.walls.map((w) => (w.deadline < turn ? { ...w, passedTurn: w.deadline - 1 } : w)),
  };
}

const strong: Weapon = { id: 'x', type: 'dagger', materialTier: 6, quality: 5, element: 'water', enchants: ['combo', 'pursuit', 'keen'], unique: null };

/** The first seed whose 휴식 at the start of the run brings the 행상. */
function merchantAfterRest(over: Partial<RunState> = {}): RunState {
  for (let seed = 1; seed <= 300; seed++) {
    const s = runAct({ ...start({ eventRate: 3 }, seed), ...over }, { type: 'rest' });
    if (s.pending[0]?.kind === 'merchant') return s;
  }
  throw new Error('no 행상 in 300 seeds');
}

const SINGLE_EVENTS: readonly RunChoiceKind[] = ['merchant', 'chat', 'artisan', 'sign', 'season'];

describe('탑의 기척 (13.11)', () => {
  it('comes at the end of the turn 2 before a 마감, while that boss stands', () => {
    const wall = start().walls[1];
    if (wall === undefined) throw new Error('no wall 2');
    const turn = wall.deadline - SIGN_TURNS_BEFORE;
    const s = runAct(onTurn(turn), { type: 'rest' });
    expect(s.pending[0]?.kind).toBe('sign');
    expect(s.pending[0]?.lines[0]).toBe('"바위 수문장이 기다린다. 서두르진 말고, 늦지도 말고."');
    expect(s.pending[0]?.lines[1]).toMatch(/^20층 바위 수문장 · 갑각 · 지\. 지금 돌파 확률 \d+%$/);
    expect(s.pending[0]?.options[0]?.preview).toBe(`마감까지 ${SIGN_TURNS_BEFORE}턴`);
    // Its boss already down: no 기척. One turn off: none either.
    const down = onTurn(turn);
    const passed = { ...down, lastBossFloor: 20, walls: down.walls.map((w, i) => (i === 1 ? { ...w, passedTurn: turn - 1 } : w)) };
    expect(runAct(passed, { type: 'rest' }).pending.map((c) => c.kind)).not.toContain('sign');
    expect(runAct({ ...onTurn(turn - 1, { eventRate: 0 }), seasonEventsDone: [0, 1] }, { type: 'rest' }).pending).toEqual([]);
  });
});

describe('시즌 사건 (13.11)', () => {
  it('comes at the end of turns 6 and 17 of a 30-turn run, scaled with the run length', () => {
    expect(SEASONS.ash.events.map((e) => e.turn)).toEqual([6, 17]);
    expect([6, 17].map((t) => seasonEventTurn(t, 30, 30))).toEqual([6, 17]);
    expect([6, 17].map((t) => seasonEventTurn(t, 20, 30))).toEqual([4, 11]);
    expect([6, 17].map((t) => seasonEventTurn(t, 60, 30))).toEqual([12, 34]);
    const s = runAct(onTurn(6, { eventRate: 0 }), { type: 'rest' });
    expect(s.pending.map((c) => c.kind)).toEqual(['season']);
    expect(s.pending[0]?.title).toBe('처음 솟던 날');
    expect(s.pending[0]?.options.map((o) => o.effects[0])).toEqual([
      { kind: 'addCard', card: 'ashHammer' },
      { kind: 'material', key: 'crystal:water', count: 2 },
    ]);
    expect(s.seasonEventsDone).toEqual([0]);
    expect(runAct(onTurn(5, { eventRate: 0 }), { type: 'rest' }).pending).toEqual([]);
    const late = runAct(onTurn(17, { eventRate: 0 }), { type: 'rest' });
    // A run that missed the first one gets it first (one a turn), the second on the next turn.
    expect(late.pending.map((c) => c.title)).toEqual(['처음 솟던 날']);
  });

  it('one 사건 a turn: 탑의 기척 first, the 시즌 사건 waits for the next turn', () => {
    const s = runAct(onTurn(8, { eventRate: 3 }), { type: 'rest' });
    expect(s.pending.map((c) => c.kind)).toEqual(['sign']);
    const next = runAct(runAct(s, { type: 'choose', option: 0 }), { type: 'rest' });
    expect(next.pending[0]?.kind).toBe('season');
    expect(next.pending).toHaveLength(1);
  });

  it('never brings more than one 사건 at the end of a turn (보상 고르기와 교류의 사연은 따로)', () => {
    let turns = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const states = playThrough(start({ eventRate: 3, turns: 40, wallPreset: 'loose' }, seed));
      const end = states[states.length - 1] as RunState;
      for (const log of end.turnLog) {
        const events = log.events.filter((k) => SINGLE_EVENTS.includes(k) || (k === 'story' && log.action !== 'bond'));
        expect(events.length, `turn ${log.turn}: ${log.events.join(',')}`).toBeLessThanOrEqual(1);
        turns += 1;
      }
    }
    expect(turns).toBeGreaterThan(30);
  });
});

describe('재료 발견 (13.11, 시즌 규칙 재 냄새)', () => {
  it('is 5% per cleared floor, ×2 this season, × the [검증] 사건 빈도', () => {
    expect(FIND_CHANCE_PER_FLOOR).toBe(0.05);
    expect(SEASONS.ash.rule.findMult).toBe(2);
    expect(findChance(start())).toBeCloseTo(0.1);
    expect(findChance(start({ eventRate: 3 }))).toBeCloseTo(0.3);
    expect(findChance(start({ eventRate: 0 }))).toBe(0);
  });

  it("rolls on (판 시드, 'event', 턴, 'find', 층); the floor's body family, 하급 below 31층 and 상급 from it", () => {
    let low = 0;
    let high = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const from of [0, UPPER_MATERIAL_FROM_FLOOR - 1]) {
        const s0 = onTurn(from === 0 ? 1 : 17, { eventRate: 3 }, seed);
        const s = { ...s0, lastBossFloor: from, record: from, weapon: { ...s0.weapon, weapon: strong, durability: 1 } };
        const after = runAct(s, { type: 'expedition', policy: 'bold' });
        const log = after.turnLog[after.turnLog.length - 1]?.expedition;
        for (const f of log?.floors ?? []) {
          if (!f.cleared) continue;
          const rolled = rngFor(seed, EVENT_STREAM, s.turn, 'find', f.floor).next() < findChance(s);
          expect(f.find !== null).toBe(rolled);
          if (f.find === null) continue;
          if (f.floor >= UPPER_MATERIAL_FROM_FLOOR) {
            expect(f.find.endsWith(':high')).toBe(true);
            high += 1;
          } else {
            expect(f.find.endsWith(':low')).toBe(true);
            low += 1;
          }
        }
      }
    }
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });
});

describe('행상 (13.11)', () => {
  it('lays out 기술 카드 3장, 카드 빼기, 화로 손질, a rare material, and leaving, at 지금 구간 재료가 × n', () => {
    const s = merchantAfterRest();
    const m = s.pending[0];
    if (m === undefined) throw new Error('no 행상');
    const price = materialPrice(1);
    const cards = m.options.filter((o) => o.effects[0]?.kind === 'addCard');
    expect(cards).toHaveLength(MERCHANT_CARD_CHOICES);
    const ids = cards.map((o) => (o.effects[0] as { card: keyof typeof CARDS }).card);
    expect(new Set(ids).size).toBe(MERCHANT_CARD_CHOICES);
    for (const id of ids) expect(rewardPool('ash')).toContain(id);
    expect(cards.every((o) => o.cost === price * MERCHANT_PRICE_UNITS.card)).toBe(true);
    expect(m.options.find((o) => o.label === '카드 빼기')?.cost).toBe(price * MERCHANT_PRICE_UNITS.remove);
    expect(m.options.find((o) => o.label === '화로 손질')?.cost).toBe(price * MERCHANT_PRICE_UNITS.furnace);
    const rare = m.options[m.options.length - 2];
    expect(rare?.effects[0]?.kind).toBe('material');
    expect([price * MERCHANT_PRICE_UNITS.upper, price * MERCHANT_PRICE_UNITS.crystals]).toContain(rare?.cost);
    expect(m.options[m.options.length - 1]).toMatchObject({ label: '그냥 보낸다', cost: 0 });
    expect(m.options).toHaveLength(MERCHANT_CARD_CHOICES + 4);
  });

  it('화로 손질 is once a run; 카드 빼기 only while the deck is above its floor', () => {
    const s = merchantAfterRest();
    const furnace = s.pending[0]?.options.findIndex((o) => o.label === '화로 손질') ?? -1;
    const tuned = runAct(s, { type: 'choose', option: furnace });
    expect(tuned.handBonus).toBe(1);
    expect(tuned.gold).toBe(s.gold - materialPrice(1) * MERCHANT_PRICE_UNITS.furnace);
    const again = merchantAfterRest({ handBonus: 1 });
    expect(again.pending[0]?.options.map((o) => o.label)).not.toContain('화로 손질');
    const small = merchantAfterRest({ deck: start().deck.slice(0, MERCHANT_REMOVE_MIN_DECK) });
    expect(small.pending[0]?.options.map((o) => o.label)).not.toContain('카드 빼기');
    // 카드 빼기 asks which card next, before the turn moves on.
    const remove = s.pending[0]?.options.findIndex((o) => o.label === '카드 빼기') ?? -1;
    const asked = runAct(s, { type: 'choose', option: remove });
    expect(asked.pending[0]?.kind).toBe('remove');
    const out = runAct(asked, { type: 'choose', option: 0 });
    expect(out.deck).toHaveLength(s.deck.length - 1);
  });
});

describe('보스 보상 (13.4.3)', () => {
  it('gives the next band’s main material ×2 (40층: + 시즌 보스 재료) and three cards to pick from', () => {
    const at = (floor: number) => {
      const d = draftRun({ ...start(), lastBossFloor: floor, record: floor });
      const c = bossReward(d, floor);
      return { d, c };
    };
    expect(at(10).d.mainMaterials).toEqual({ 2: BOSS_REWARD.mainMaterials });
    expect(at(20).d.mainMaterials).toEqual({ 3: 2 });
    const forty = at(40);
    expect(forty.d.mainMaterials).toEqual({ 5: 2 });
    expect(forty.d.bossMaterials).toBe(1);
    expect(forty.c.lines).toContain('원령의 등불도 하나. 걸작이면 무기에 불이 깃든다.');
    expect(at(50).d.mainMaterials).toEqual({ 6: 2 });
    expect(at(50).d.bossMaterials).toBe(0);
    expect(forty.c.options).toHaveLength(BOSS_REWARD.cardChoices + 1);
  });
});
