import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../platform/storage.ts';
import { cardIdOf, cardTurnSummary, dayOneDeck, handView } from '../../sim/cards/index.ts';
import { layOut } from '../../sim/cards/testkit.ts';
import type { CardId } from '../../sim/data/cards.ts';
import {
  addTime,
  beginSession,
  deckProblems,
  sessionAbandon,
  sessionEndTurn,
  sessionFill,
  sessionPlay,
  settle,
} from './flow.ts';
import { recordsJson, settingsLabel, summarize } from './record.ts';
import {
  type CardProfile,
  type CardSession,
  cardSaves,
  cardSessionState,
  defaultProfile,
  hasCardSession,
  PROFILE_KEY,
  readProfile,
  readRecords,
  readSession,
  SESSION_KEY,
} from './store.ts';

const iron = { weaponType: 'oneHandSword', materialTier: 1, bossMaterial: null } as const;

function allNormal(p: CardProfile): CardProfile {
  return { ...p, lab: { ...p.lab, firePreset: 'allNormal' } };
}

/** Plays the first card that can go without breaking the iron, else ends the turn. */
function autoplay(session: CardSession, now = 1000): CardSession {
  let s = session;
  let t = now;
  while (s.craft.status === 'active') {
    t += 1000;
    s = addTime(s, 1000);
    const v = handView(s.craft).find((x) => x.block === null && !x.breaks);
    s = v ? sessionPlay(s, v.uid, {}, t) : sessionEndTurn(s, [], t);
  }
  return s;
}

/** The uid of the first card of this kind in hand. */
function uidOf(s: CardSession, id: CardId): string {
  const uid = s.craft.hand.find((u) => cardIdOf(s.craft, u) === id);
  if (uid === undefined) throw new Error(`no ${id} in hand`);
  return uid;
}

describe('profile', () => {
  it('starts with the 1일차 덱 in every slot', () => {
    const p = defaultProfile();
    expect(p.decks.basic).toEqual(dayOneDeck());
    expect(p.decks.legendary).toEqual(dayOneDeck());
    expect(deckProblems(p, 'basic')).toEqual([]);
  });

  it('repairs broken saved fields one by one', () => {
    const p = readProfile({
      version: 1,
      nextCraftNo: -3,
      decks: { basic: ['hammer', 'nope', 'ironMelt', 'polish'], advanced: 'x' },
      evolved: { heavyHammer: 2, hammer: 5, lightHammer: -1 },
      temper: { hammer: 12.7, bogus: 3 },
      lab: { handSize: 99, reheatCost: 7, firePreset: 'storm', seed: -1, fameStage: 40, tools: { anvil: 'a', furnace: 9 } },
      lastRecipe: { weaponType: 'spear', materialTier: 2, bossMaterial: null },
      seen: ['firstReheat', 4],
    });
    expect(p.nextCraftNo).toBe(1);
    // Unknown ids and material cards are dropped; a missing slot falls back to the 1일차 덱.
    expect(p.decks.basic).toEqual(['hammer', 'polish']);
    expect(p.decks.advanced).toEqual(dayOneDeck());
    expect(p.evolved).toEqual({ heavyHammer: 2 });
    expect(p.temper).toEqual({ hammer: 12 });
    expect(p.lab).toMatchObject({ handSize: 10, reheatCost: 3, firePreset: 'default', fameStage: 10 });
    expect(p.lab.tools).toEqual({ anvil: 0, whetstone: 0, furnace: 4 });
    expect(p.lastRecipe).toEqual(defaultProfile().lastRecipe);
    expect(p.seen).toEqual(['firstReheat']);
    expect(readProfile(null)).toEqual(defaultProfile());
  });

  it('says why a deck cannot go on the anvil', () => {
    const p = defaultProfile();
    const bad = { ...p, decks: { ...p.decks, basic: [...dayOneDeck(), 'thrift' as CardId] } };
    // 아껴 치기 is a stage-1 card: learned only after the first craft.
    expect(deckProblems(bad, 'basic').map((x) => x.code)).toEqual(['notOwned']);
    expect(deckProblems({ ...bad, firstCraftDone: true }, 'basic')).toEqual([]);
  });
});

describe('a craft through the session', () => {
  it('bumps the craft number and copies the lab switches into the craft', () => {
    const p = { ...defaultProfile(), lab: { ...defaultProfile().lab, reheatCost: 1, handSize: 6, coolingIron: true } };
    const { profile, session } = beginSession(p, iron, 500);
    expect(profile.nextCraftNo).toBe(2);
    expect(session.craft.setup.craftNo).toBe(1);
    expect(session.craft.rules).toMatchObject({ reheatCost: 1, handSize: 6, coolingIron: true });
    expect(session.craft.hand).toHaveLength(6);
    expect(session.id).toBe('1-1-500');
  });

  it('records each turn: its time here, the rest from the craft log (as the bots count it)', () => {
    const { session } = beginSession(allNormal(defaultProfile()), iron, 0);
    // 4.2.10 turn 1: 다듬기, 두드리기 ×2, 담금질, then 다시 달구기 with 정밀 다듬기 unplayable.
    let s: CardSession = {
      ...session,
      craft: layOut(session.craft, ['polish', 'hammer', 'precisePolish', 'quench', 'hammer'], ['bellows', 'finisher', 'ironMelt', 'polish', 'ironMelt']),
    };
    for (const id of ['polish', 'hammer', 'hammer', 'quench'] as CardId[]) s = sessionPlay(addTime(s, 2000), uidOf(s, id), {}, 0);
    s = sessionEndTurn(addTime(s, 1500), [], 0);
    expect(s.craft.turn).toBe(2);
    expect(s.craft.durability).toBe(25);
    expect(s.turns).toEqual([{ turn: 1, ms: 9500 }]);
    expect(s.turnMs).toBe(0);
    expect(s.activeMs).toBe(9500);
    // 정밀 다듬기 needed 좋음: nothing else could have gone, so this was a '다 내기' turn.
    expect(cardTurnSummary(s.craft)[0]).toMatchObject({ played: ['polish', 'hammer', 'hammer', 'quench'], allowedLeft: 0, discarded: 1 });
  });

  it('settles a finished craft once: 단련, first-craft cards, the play log', () => {
    const start = beginSession(allNormal(defaultProfile()), iron, 0);
    const done = autoplay(start.session);
    expect(done.craft.status).not.toBe('active');
    expect(done.turns).toHaveLength(done.craft.turn);

    const settled = settle(start.profile, done, [], 99_000);
    if (settled === null) throw new Error('expected a settle');
    expect(settled.profile.firstCraftDone).toBe(true);
    expect(settled.profile.settled).toBe(done.id);
    expect(settled.session.learned).toEqual(['thrift', 'carefulHammer', 'firstTouch']);
    expect(settled.profile.temper.hammer ?? 0).toBeGreaterThan(0);
    expect(settled.records).toHaveLength(1);
    const r = settled.records[0];
    expect(r?.hands).toBe(done.craft.turn);
    expect(r?.turns.map((t) => t.played.length).reduce((a, b) => a + b, 0)).toBe(r?.cardsPlayed);
    expect(r?.settings).toMatchObject({ hand: 5, keep: 0, reheatCost: 2, fire: '모두 보통', fameStage: 1 });
    expect(r?.deck).toEqual({ 두드리기: 3, 다듬기: 3, '정밀 다듬기': 1, 풀무질: 1, 담금질: 1, 마무리: 1 });

    // Run again (a reload between writes): nothing doubles.
    expect(settle(settled.profile, settled.session, settled.records, 99_500)).toBeNull();
    const again = settle(settled.profile, { ...settled.session, recorded: false }, settled.records, 99_500);
    expect(again?.profile.temper).toEqual(settled.profile.temper);
    expect(again?.records).toHaveLength(1);
  });

  it('a successful craft makes a weapon whose slots can be filled', () => {
    const start = beginSession(allNormal(defaultProfile()), iron, 0);
    const done = autoplay(start.session);
    expect(done.craft.status).toBe('success');
    const w = done.weapon;
    if (w === null) throw new Error('expected a weapon');
    expect(w.id).toBe('cw-1-1');
    if (w.quality >= 2) {
      const filled = sessionFill(done, { kind: 'enchant', enchant: 'combo', element: null });
      expect(filled?.weapon?.enchants).toEqual(['combo']);
      expect(sessionFill(filled as CardSession, { kind: 'enchant', enchant: 'combo', element: null })).toBeNull();
    }
  });

  it('abandoning is a failure that ends the turn record', () => {
    const { session } = beginSession(defaultProfile(), iron, 0);
    const s = sessionAbandon(addTime(session, 700), 800);
    expect(s.craft.status).toBe('failed');
    expect(s.craft.abandoned).toBe(true);
    expect(s.turns).toEqual([{ turn: 1, ms: 700 }]);
    expect(cardTurnSummary(s.craft)[0]).toMatchObject({ played: [], end: 'failed', allowedLeft: null });
    expect(s.endedAtMs).toBe(800);
  });
});

describe('saves', () => {
  it('round-trips the profile, a craft in progress and the log', async () => {
    const store = memoryStore();
    const saves = cardSaves(store);
    const start = beginSession(defaultProfile(), iron, 10);
    const first = handView(start.session.craft).find((v) => v.block === null);
    const s = sessionPlay(start.session, first?.uid as string, {}, 20);
    await saves.saveProfile(start.profile);
    await saves.saveSession(s);
    const loaded = await saves.loadAll();
    expect(loaded.profile).toEqual(start.profile);
    expect(loaded.session).toEqual(s);
    expect(loaded.records).toEqual([]);
    await saves.saveSession(null);
    expect(await store.load(SESSION_KEY)).toBeNull();
  });

  it('starts fresh from broken saves', async () => {
    const store = memoryStore();
    await store.save(PROFILE_KEY, '{not json');
    await store.save(SESSION_KEY, JSON.stringify({ version: 1, craft: { version: 2 } }));
    const loaded = await cardSaves(store).loadAll();
    expect(loaded.profile).toEqual(defaultProfile());
    expect(loaded.session).toBeNull();
    expect(readSession({ version: 9 })).toBeNull();
  });

  it('a finished craft waiting on its result screen comes back after a reload', async () => {
    const saves = cardSaves(memoryStore());
    expect(await hasCardSession(saves)).toBe(false);
    const start = beginSession(allNormal(defaultProfile()), iron, 0);
    await saves.saveSession(autoplay(start.session));
    expect(await hasCardSession(saves)).toBe(true);
    // '다시 만들기' clears it.
    await saves.saveSession(null);
    expect(await hasCardSession(saves)).toBe(false);
  });

  it('tells a craft still on the anvil from a finished one (the map’s forge mark, 9.2)', async () => {
    const saves = cardSaves(memoryStore());
    expect(await cardSessionState(saves)).toBe('none');
    const start = beginSession(allNormal(defaultProfile()), iron, 0);
    await saves.saveSession(start.session);
    expect(await cardSessionState(saves)).toBe('active');
    await saves.saveSession(autoplay(start.session));
    expect(await cardSessionState(saves)).toBe('done');
  });

  it('the 레시피 내구도 switch is read back in range', () => {
    expect(readProfile({ version: 1, lab: { durabilityDelta: -99 } }).lab.durabilityDelta).toBe(-40);
    expect(readProfile({ version: 1, lab: {} }).lab.durabilityDelta).toBe(0);
    const p = { ...defaultProfile(), lab: { ...defaultProfile().lab, durabilityDelta: -4 } };
    expect(beginSession(p, iron, 0).session.craft.maxDurability).toBe(24);
  });
});

describe('play log summary', () => {
  it('counts failures as 0% and groups by settings', () => {
    const p = allNormal(defaultProfile());
    const a = beginSession(p, iron, 0);
    const done = settle(a.profile, autoplay(a.session), [], 5000);
    if (done === null) throw new Error('expected a settle');
    const b = beginSession(done.profile, iron, 6000);
    const quit = settle(done.profile, sessionAbandon(b.session, 7000), done.records, 7000);
    if (quit === null) throw new Error('expected a settle');
    const sum = summarize(quit.records);
    expect(sum.count).toBe(2);
    expect(sum.failures).toBe(1);
    const ok = quit.records[0]?.result.qualityPct ?? 0;
    expect(sum.avgQualityPct).toBeCloseTo(Math.round((ok / 2) * 10) / 10, 5);
    expect(settingsLabel(quit.records[0] as never)).toBe('기본 1구간 · 손패 5 · 달구기 −2 · 화로 모두 보통');
    const json = JSON.parse(recordsJson(quit.records, 0)) as { records: unknown[]; summary: { count: number } };
    expect(json.records).toHaveLength(2);
    expect(json.summary.count).toBe(2);
  });

  it("counts each card played and thrown away, and '다 내기' turns as the bots do", () => {
    const a = beginSession(allNormal(defaultProfile()), iron, 0);
    const done = settle(a.profile, autoplay(a.session), [], 5000);
    if (done === null) throw new Error('expected a settle');
    const r = done.records[0];
    if (r === undefined) throw new Error('expected a record');
    const summary = cardTurnSummary(done.session.craft);
    expect(r.turns.map((t) => t.allowedLeft)).toEqual(summary.map((t) => t.allowedLeft));
    expect(r.turns.reduce((n, t) => n + t.discarded, 0)).toBe(r.cardsDiscarded);
    const sum = summarize(done.records);
    const played = sum.cardUse.reduce((n, u) => n + u.played, 0);
    const thrown = sum.cardUse.reduce((n, u) => n + u.discarded, 0);
    expect([played, thrown]).toEqual([r.cardsPlayed, r.cardsDiscarded]);
    expect(sum.goodTurnShare).toBe(0); // 모두 보통
  });

  it('reads records made before the turn notes came from the engine', () => {
    const old = {
      id: 'x',
      result: { status: 'success' },
      settings: { hand: 5 },
      turns: [{ turn: 1, fire: '보통', played: ['다듬기'], playableLeft: 0, sec: 3 }],
    };
    const [r] = readRecords([old]);
    expect(r?.turns[0]).toMatchObject({ allowedLeft: 0, discarded: 0 });
  });
});
