// 행동 5종과 그 효과 (기획서 13.4.1), 상점 (13.4.3), 단조 (13.8), 사건 (13.11).

import { describe, expect, it } from 'vitest';
import { cardCraftOutcome } from '../cards/index.ts';
import type { Weapon } from '../core/types.ts';
import { CARDS } from '../data/cards.ts';
import { ACTION_HP, MAINTAIN_POWER_MULT } from '../data/run.ts';
import { forecastExpedition, policyReturn } from './expedition.ts';
import { forgePlan, runSmithLevel } from './forge.ts';
import { floorOdds } from './hero.ts';
import { actionBlock, runAct, startRun } from './run.ts';
import { forgeStep, arenSetup } from './testkit.ts';
import type { RunState } from './types.ts';
import { actionViews, forgeOptions, shopEntries, turnView } from './view.ts';

const start = (rules = {}, seed = 1): RunState => startRun(arenSetup({ seed }, rules));

/** Plays a card craft to its end with the test driver. */
function finishCraft(s: RunState): RunState {
  let t = s;
  while (t.phase === 'forge') t = runAct(t, forgeStep(t));
  return t;
}

describe('원정', () => {
  it('climbs from the floor after the last boss: HP down, 판 골드 and 누적 층 up', () => {
    const s = start();
    const after = runAct(s, { type: 'expedition', policy: 'normal' });
    const log = after.turnLog[0]?.expedition;
    expect(log?.startFloor).toBe(1);
    const cleared = log?.floors.filter((f) => f.cleared) ?? [];
    expect(cleared.length).toBeGreaterThan(0);
    expect(after.hp).toBeLessThan(1);
    expect(after.cumulativeFloors).toBe(cleared.length);
    expect(after.gold - s.gold).toBe(log?.gold);
    expect(after.record).toBe(Math.max(...cleared.map((f) => f.floor)));
    expect(after.weapon.durability).toBeLessThan(1);
  });

  it('방침 changes only the HP and 돌파 확률 the climb turns back at (7.10)', () => {
    const base = { durability: 1, floorsEntered: 3, maxFloors: 12, nextClearChance: 0.6 };
    expect(policyReturn({ ...base, hp: 0.5, policy: 'cautious' })).toBe('hp');
    expect(policyReturn({ ...base, hp: 0.5, policy: 'normal' })).toBeNull();
    expect(policyReturn({ ...base, hp: 0.35, policy: 'normal' })).toBe('hp');
    expect(policyReturn({ ...base, hp: 0.35, policy: 'bold' })).toBeNull();
    expect(policyReturn({ ...base, hp: 0.9, nextClearChance: 0.45, policy: 'normal' })).toBe('risk');
    expect(policyReturn({ ...base, hp: 0.9, nextClearChance: 0.45, policy: 'bold' })).toBeNull();
    expect(policyReturn({ ...base, hp: 0.9, durability: 0.2, policy: 'bold' })).toBe('durability');
    expect(policyReturn({ ...base, hp: 0.9, floorsEntered: 12, policy: 'bold' })).toBe('maxFloors');
    const s = start();
    const f = { cautious: forecastExpedition(s, 'cautious'), bold: forecastExpedition(s, 'bold') };
    expect(f.bold.floors).toBeGreaterThanOrEqual(f.cautious.floors);
  });
});

describe('원정 미리 보기와 [검증] 수입 스위치', () => {
  it('says how likely the climb gets past the wall, comes back hurt, and with what HP and edge', () => {
    const s = start();
    for (const p of ['cautious', 'normal', 'bold'] as const) {
      const f = forecastExpedition(s, p);
      expect(f.clearAll).toBeGreaterThanOrEqual(0);
      expect(f.clearAll).toBeLessThanOrEqual(1);
      expect(f.hurt).toBeGreaterThanOrEqual(0);
      expect(f.hurt).toBeLessThanOrEqual(1 - f.clearAll + 1e-9);
      expect(f.hpEnd).toBeLessThan(s.hp);
      expect(f.durabilityEnd).toBeLessThan(1);
      if (f.boss !== null) expect(f.bossPass).toBeLessThanOrEqual(f.boss.chance + 1e-9);
    }
    // 10층 보스 at the end of a full 보통 climb with a strong weapon: it gets there and very likely past it.
    const strong: Weapon = { id: 'x', type: 'dagger', materialTier: 6, quality: 5, element: 'water', enchants: [], unique: null };
    const f = forecastExpedition({ ...s, weapon: { ...s.weapon, weapon: strong } }, 'normal');
    expect(f.boss?.floor).toBe(10);
    expect(f.bossPass).toBeGreaterThan(0.9);
    // Starting low on HP, it turns back before the boss: nothing to pass.
    expect(forecastExpedition({ ...s, hp: 0.45 }, 'normal').bossPass).toBe(0);
  });

  it('floor odds count 순풍의 운 the way the climb rolls it, everywhere the same', () => {
    const s = start();
    const plain: Weapon = { id: 'x', type: 'dagger', materialTier: 1, quality: 3, element: null, enchants: [], unique: null };
    const lucky = { ...plain, unique: 'fairWind' as const };
    const mastered = { ...s, record: 40 };
    const a = floorOdds(mastered, 12, { weapon: plain }).chance;
    const b = floorOdds(mastered, 12, { weapon: lucky }).chance;
    expect(b).toBeCloseTo(1 - (1 - a) * (1 - a));
  });

  it('31층부터 층 수입 배율: ×1 by the doc, the switch scales only those floors', () => {
    const strong: Weapon = { id: 'x', type: 'dagger', materialTier: 6, quality: 5, element: 'water', enchants: ['combo'], unique: null };
    const base = { ...start(), lastBossFloor: 30, record: 30, cumulativeFloors: 60, turn: 17 };
    const at = (rate: number) => {
      const s0 = startRun(arenSetup({ seed: 1 }, { lateGoldRate: rate }));
      const walls = s0.walls.map((w, i) => (i < 3 ? { ...w, passedTurn: w.deadline } : w));
      const s = { ...s0, ...base, walls, rules: s0.rules, setup: s0.setup, weapon: { ...s0.weapon, weapon: strong } };
      return runAct(s, { type: 'expedition', policy: 'normal' }).turnLog[0]?.expedition?.floors ?? [];
    };
    const full = at(1);
    const half = at(0.5);
    expect(full.length).toBeGreaterThan(0);
    full.forEach((f, i) => {
      if (f.cleared) expect(half[i]?.gold).toBe(Math.round(f.gold * 0.5));
    });
    // Below 31층 nothing changes.
    const low = runAct(startRun(arenSetup({ seed: 1 }, { lateGoldRate: 0.25 })), { type: 'expedition', policy: 'normal' });
    expect(low.turnLog[0]?.expedition?.gold).toBe(runAct(start(), { type: 'expedition', policy: 'normal' }).turnLog[0]?.expedition?.gold);
  });
});

describe('휴식 · 교류 · 정비', () => {
  it('휴식: HP +60%, 부상이 낫는다', () => {
    const s = { ...start(), hp: 0.3, injured: true };
    const after = runAct(s, { type: 'rest' });
    expect(after.hp).toBeCloseTo(0.3 + ACTION_HP.rest);
    expect(after.injured).toBe(false);
    expect(after.turn === 2 || after.phase === 'choice').toBe(true);
  });

  it('부상 중에는 HP가 60%를 넘지 않는다 (교류, 정비, 단조)', () => {
    const s = { ...start(), hp: 0.5, injured: true };
    expect(runAct(s, { type: 'bond', companion: 0 }).hp).toBeCloseTo(0.6);
    expect(runAct(s, { type: 'maintain' }).hp).toBeCloseTo(0.6);
  });

  it('교류: HP +30%, 유대 +1, 유대 1에서 사연이 열린다', () => {
    const s = { ...start(), hp: 0.4 };
    const after = runAct(s, { type: 'bond', companion: 0 });
    expect(after.hp).toBeCloseTo(0.4 + ACTION_HP.bond);
    expect(after.companions[0]).toMatchObject({ family: 'nea', bond: 1, stories: [1] });
    expect(after.phase).toBe('choice');
    expect(after.pending[0]).toMatchObject({ kind: 'story', family: 'nea', title: '네아 · 먼저 보는 눈' });
    expect(after.pending[0]?.lines).toEqual(['"저 위, 날개 달린 게 셋. 넌 오른쪽만 봐."']);
    expect(after.turnLog[0]?.lines[0]).toBe('네아와 시간을 보냈다. 유대 1');
    // 과 after a final consonant (바일과, 이솔과).
    expect(runAct(s, { type: 'bond', companion: 1 }).turnLog[0]?.lines[0]).toBe('바일과 시간을 보냈다. 유대 1');
    expect(runAct(s, { type: 'bond', companion: 2 }).turnLog[0]?.lines[0]).toBe('이솔과 시간을 보냈다. 유대 1');
  });

  it('정비: 수리비 (정가의 5%), 내구도 100%, 빈 슬롯 채우기, 다음 원정 ×1.2', () => {
    const weapon: Weapon = { id: 'x', type: 'dagger', materialTier: 1, quality: 3, element: null, enchants: [], unique: null };
    const base = start();
    const s: RunState = {
      ...base,
      weapon: { ...base.weapon, weapon, durability: 0.3 },
      inventory: { 'emblem:low': 1, 'crystal:water': 1 },
    };
    const after = runAct(s, {
      type: 'maintain',
      picks: [
        { kind: 'enchant', enchant: 'combo', element: null },
        { kind: 'enchant', enchant: 'element', element: 'water' },
      ],
    });
    expect(after.gold).toBe(s.gold - 14); // ★3 철 정가 270G × 5% = 13.5 → 14
    expect(after.weapon.durability).toBe(1);
    expect(after.weapon.weapon).toMatchObject({ element: 'water', enchants: ['combo'] });
    expect(after.inventory).toEqual({ 'emblem:low': 0, 'crystal:water': 0 });
    expect(after.maintainBuff).toBe(true);
    const plain = floorOdds(after, 10, { maintain: false });
    const buffed = floorOdds(after, 10);
    expect(buffed.power / plain.power).toBeCloseTo(MAINTAIN_POWER_MULT);
    expect(actionBlock({ ...s, gold: 0 }, { type: 'maintain' })).toBe('수리비가 모자라다 (14G)');
  });
});

describe('단조 (13.8)', () => {
  it('uses the card engine with the run smith, hand 5 and the run deck', () => {
    const s = { ...start(), lastBossFloor: 10, gold: 500 };
    const after = runAct(s, { type: 'forge', materialTier: 2 });
    expect(after.phase).toBe('forge');
    expect(after.gold).toBe(500 - 6 * 25);
    expect(after.hp).toBe(1);
    const craft = after.forge?.craft;
    expect(craft?.setup).toMatchObject({ seed: 1, stream: 'forge', craftNo: 1, tools: { anvil: 4, whetstone: 4, furnace: 0 } });
    expect(craft?.smith).toMatchObject({ craftsmanship: 117, control: 117, handSize: 5, keep: 0 });
    expect(craft?.setup.deck).toContain('edgeHone2');
    expect(Object.values(craft?.cards ?? {}).filter((id) => id === 'steelFold')).toHaveLength(2);
  });

  it('a finished craft goes to the 완성 화면, then the new weapon is taken up and the old one hung', () => {
    const s = { ...start(), lastBossFloor: 10, gold: 500, inventory: { 'shell:low': 1 } };
    const done = finishCraft(runAct(s, { type: 'forge', materialTier: 2 }));
    expect(done.phase).toBe('forgeDone');
    const made = done.forge?.weapon as Weapon;
    expect(made).toMatchObject({ type: 'dagger', materialTier: 2, element: null, enchants: [] });
    expect(made.quality).toBe(cardCraftOutcome(done.forge?.craft as NonNullable<RunState['forge']>['craft'] & object).tier);
    const picks = made.quality >= 2 ? [{ kind: 'enchant' as const, enchant: 'pierce' as const, element: null }] : [];
    const after = runAct(done, { type: 'forgeFinish', picks });
    expect(after.weapon).toMatchObject({ origin: 'forged', durability: 1, forgeNo: 1 });
    expect(after.rack.map((w) => w.weapon.id)).toEqual(['w0']);
    expect(after.stats.bestQuality).toBe(made.quality);
    expect(Object.keys(after.stats.cardUses).length).toBeGreaterThan(0);
    expect(after.turnLog[0]?.forge).toMatchObject({ success: true, quick: false, materialTier: 2 });
  });

  it('a weaker 완성 can go on the 무기 걸이 instead: the held weapon stays, the new one counts as forged', () => {
    const fine: Weapon = { id: 'x', type: 'dagger', materialTier: 1, quality: 5, element: 'water', enchants: ['combo'], unique: null };
    const base = start({ quickForge: true });
    const s = { ...base, lastBossFloor: 10, gold: 500, weapon: { ...base.weapon, weapon: fine, name: '아렌의 단검' }, inventory: { 'shell:low': 1 } };
    const done = runAct(s, { type: 'forge', materialTier: 2, quality: 2 });
    expect(done.phase).toBe('forgeDone');
    expect(actionBlock(done, { type: 'forgeFinish', hang: true, picks: [{ kind: 'enchant', enchant: 'pierce', element: null }] })).toBe(
      '걸이에 걸 무기에는 슬롯을 채우지 않는다',
    );
    const after = runAct(done, { type: 'forgeFinish', hang: true });
    expect(after.weapon.weapon).toEqual(fine);
    expect(after.weapon.name).toBe('아렌의 단검');
    expect(after.rack).toHaveLength(1);
    expect(after.rack[0]).toMatchObject({ origin: 'forged', forgeNo: 1, neverHeld: true, since: 1 });
    expect(after.rack[0]?.weapon).toMatchObject({ materialTier: 2, quality: 2 });
    expect(after.inventory).toEqual({ 'shell:low': 1 });
    expect(after.stats.bestQuality).toBe(2);
    expect(after.turnLog[0]?.forge).toMatchObject({ success: true, taken: false, picks: [] });
    expect(after.turnLog[0]?.lines).toContain('새 무기는 걸이에 걸었다: ★2 수작 강철 단검');
    // Taking it up is still the default.
    expect(runAct(done, { type: 'forgeFinish' }).turnLog[0]?.forge?.taken).toBe(true);
  });

  it('the [검증] 판 손패 switch sets the craft hand (화로 손질 still adds one)', () => {
    const s = { ...start({ handSize: 4 }), lastBossFloor: 10, gold: 500 };
    expect(runAct(s, { type: 'forge', materialTier: 2 }).forge?.craft?.smith.handSize).toBe(4);
    expect(runAct({ ...s, handBonus: 1 }, { type: 'forge', materialTier: 2 }).forge?.craft?.smith.handSize).toBe(5);
    expect(forgePlan(start(), 1).handSize).toBe(5);
  });

  it('a broken iron loses the materials and the turn', () => {
    const s = { ...start(), lastBossFloor: 10, gold: 500 };
    const after = runAct(runAct(s, { type: 'forge', materialTier: 2 }), { type: 'forgeAbandon' });
    expect(after.phase === 'turn' || after.phase === 'choice').toBe(true);
    expect(after.weapon.weapon.id).toBe('w0');
    expect(after.mainMaterials).toEqual({});
    expect(after.stats.forgeFails).toBe(1);
    expect(after.turnLog[0]?.forge).toMatchObject({ success: false });
  });

  it('간이 모드 makes the weapon at once with the given (or drawn) quality', () => {
    const s = { ...start({ quickForge: true }), lastBossFloor: 10, gold: 500 };
    const a = runAct(s, { type: 'forge', materialTier: 2, quality: 4 });
    expect(a.phase).toBe('forgeDone');
    expect(a.forge?.weapon?.quality).toBe(4);
    const b = runAct(s, { type: 'forge', materialTier: 2 });
    expect(b.forge?.weapon?.quality).toBe(runAct(s, { type: 'forge', materialTier: 2 }).forge?.weapon?.quality);
    expect(actionBlock(start(), { type: 'forge', materialTier: 1, quality: 3 })).toBe('품질은 단조 간이 모드에서만 정한다');
  });

  it('전설: 시즌 보스 재료 + 아다만, 걸작이면 고유능력, 못 미치면 재료가 돌아온다', () => {
    const s = { ...start({ quickForge: true }), lastBossFloor: 40, gold: 5000, bossMaterials: 1 };
    expect(forgePlan(s, 5, true)).toMatchObject({ grade: 'legendary', smithLevel: 20 });
    const top = runAct(s, { type: 'forge', materialTier: 5, legendary: true, quality: 5 });
    expect(top.forge?.weapon?.unique).toBe('dragonFury');
    expect(top.bossMaterials).toBe(0);
    const short = runAct(s, { type: 'forge', materialTier: 5, legendary: true, quality: 4 });
    expect(short.forge?.weapon?.unique).toBeNull();
    expect(short.bossMaterials).toBe(1);
    expect(forgePlan({ ...s, bossMaterials: 0 }, 5, true).block).toBe('원령의 등불이 없다');
  });

  it('판 숙련도 표 and what the shop sells decide the recipes', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((t) => runSmithLevel(t, false))).toEqual([0, 4, 10, 15, 20, 24, 28]);
    const s = start();
    expect(forgePlan(s, 2).block).toBe('상점에 아직 없는 주재료');
    expect(forgePlan({ ...s, mainMaterials: { 2: 6 } }, 2).block).toBeNull();
    expect(forgeOptions({ ...s, lastBossFloor: 20, gold: 2000 }).map((p) => p.materialTier)).toEqual([3, 2, 1]);
  });
});

describe('상점과 고르기', () => {
  it('sells main material up to the next band and 하급 재료·원소 결정 at 최고 구간 재료가 × 2', () => {
    const s = { ...start(), lastBossFloor: 20, gold: 1000 };
    const entries = shopEntries(s);
    expect(entries.filter((e) => e.item.kind === 'main').map((e) => e.price)).toEqual([10, 25, 63]);
    expect(entries.find((e) => e.label === '원소 결정 (화)')?.price).toBe(126);
    const after = runAct(s, { type: 'buy', item: { kind: 'material', key: 'crystal:fire' }, count: 2 });
    expect(after.gold).toBe(1000 - 252);
    expect(after.inventory['crystal:fire']).toBe(2);
    expect(after.turn).toBe(s.turn); // 상점은 턴을 쓰지 않는다
    expect(actionBlock(s, { type: 'buy', item: { kind: 'material', key: 'feather:high' } })).toBe('상점에 없는 물건');
    expect(actionBlock(s, { type: 'buy', item: { kind: 'main', tier: 4 } })).toBe('상점에 없는 물건');
  });

  it('a boss gives its materials at once and three cards to pick from', () => {
    const strong: Weapon = { id: 'x', type: 'dagger', materialTier: 6, quality: 5, element: 'water', enchants: [], unique: null };
    const s0 = start();
    const s = { ...s0, weapon: { ...s0.weapon, weapon: strong } };
    const after = runAct(s, { type: 'expedition', policy: 'normal' });
    expect(after.mainMaterials).toEqual({ 2: 2 });
    const reward = after.pending.find((c) => c.kind === 'bossReward');
    expect(reward?.options).toHaveLength(4);
    expect(after.pending[after.pending.length - 1]?.kind).toBe('bossReward'); // 사건 먼저, 보상 고르기는 끝에
    let t = after;
    while (t.pending[0]?.kind !== 'bossReward') t = runAct(t, { type: 'choose', option: (t.pending[0]?.options.length ?? 1) - 1 });
    const card = reward?.options[0]?.effects[0];
    const picked = runAct(t, { type: 'choose', option: 0 });
    expect(card?.kind).toBe('addCard');
    if (card?.kind === 'addCard') expect(picked.deck.filter((c) => c === card.card).length).toBe(t.deck.filter((c) => c === card.card).length + 1);
    expect(CARDS[(card as { card: keyof typeof CARDS }).card].group === 'unlock' || CARDS[(card as { card: keyof typeof CARDS }).card].group === 'season').toBe(true);
  });

  it('행상, 동료 사연, 떠돌이 장인 come up by the turn and the [검증] 빈도', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      let s = start({ eventRate: 3 }, seed);
      s = runAct(s, { type: 'rest' });
      for (const c of s.pending) kinds.add(c.kind);
      let t = start({ eventRate: 3 }, seed);
      t = runAct(t, { type: 'expedition', policy: 'cautious' });
      for (const c of t.pending) kinds.add(c.kind);
    }
    expect(kinds.has('merchant')).toBe(true);
    expect(kinds.has('chat') || kinds.has('story')).toBe(true);
    let none = 0;
    for (let seed = 1; seed <= 30; seed++) none += runAct(start({ eventRate: 0 }, seed), { type: 'rest' }).pending.length;
    expect(none).toBe(0);
  });

  it('a choice that costs more than the 판 골드 cannot be picked', () => {
    let found: RunState | null = null;
    for (let seed = 1; seed <= 200 && found === null; seed++) {
      const s = runAct({ ...start({ eventRate: 3 }, seed), gold: 0 }, { type: 'rest' });
      if (s.pending[0]?.kind === 'merchant') found = s;
    }
    expect(found).not.toBeNull();
    const s = found as RunState;
    expect(actionBlock(s, { type: 'choose', option: 0 })).toBe('골드가 모자라다');
    const leave = (s.pending[0]?.options.length ?? 1) - 1;
    expect(runAct(s, { type: 'choose', option: leave }).phase).toBe('turn');
  });
});

describe('턴 화면', () => {
  it('shows the next wall, the forecasts and why buttons are off', () => {
    const v = turnView(start());
    expect(v).toMatchObject({ turn: 1, turns: 30, phase: 'turn', forced: null, gold: 150, shopBand: 1 });
    expect(v.walls[0]).toMatchObject({ floor: 10, boss: '재의 문지기', bodyLabel: '인간형', elementLabel: '화', state: 'next' });
    expect(v.forecasts.normal.startFloor).toBe(1);
    expect(v.bands).toHaveLength(5);
    const views = actionViews(start());
    expect(views.map((a) => a.action)).toEqual(['expedition', 'forge', 'maintain', 'rest', 'bond']);
    expect(turnView({ ...start(), turn: 3 }).warning).toBe('다음 턴까지 10층을 넘지 못하면, 거기까지다.');
  });
});
