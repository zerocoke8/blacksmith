// What happens to the saved session when the player acts. Every rule question is answered
// by the engine (sim/cards); this file only threads its results through the session with
// the time and turn notes the play log needs. Pure: the caller passes the time in.

import {
  abandonCardCraft,
  type CardCollection,
  type CardCraftState,
  type CardRecipeInput,
  type CardRules,
  cardRecipeGrade,
  checkDeck,
  type DeckProblem,
  endTurn,
  fillSlot,
  learnedUnlockCards,
  newlyOpened,
  type PlayOptions,
  playCard,
  recordTemper,
  type SlotPick,
  slotBlock,
  startCardCraft,
  weaponFromCardCraft,
} from '../../sim/cards/index.ts';
import type { CardId, CardRecipeGrade } from '../../sim/data/cards.ts';
import { buildRecord } from './record.ts';
import {
  type CardProfile,
  type CardSession,
  defaultInventory,
  type LabSettings,
  type PlayRecord,
  RECORD_LIMIT,
  type TurnStat,
  weaponIdFor,
} from './store.ts';

/** 배운 해금 카드 come from the 명성 단계 (and the first craft); 진화 카드 from the profile. */
export function collectionOf(profile: CardProfile): CardCollection {
  return { learned: learnedUnlockCards(profile.lab.fameStage, profile.firstCraftDone), evolved: profile.evolved };
}

export function gradeOf(recipe: CardRecipeInput): CardRecipeGrade {
  return cardRecipeGrade(recipe.materialTier, recipe.bossMaterial);
}

/** Why this grade's deck cannot go on the anvil (empty = it can). */
export function deckProblems(profile: CardProfile, grade: CardRecipeGrade): DeckProblem[] {
  return checkDeck(profile.decks[grade], collectionOf(profile), profile.lab.fameStage);
}

export function rulesOf(lab: LabSettings): CardRules {
  return {
    handSize: lab.handSize,
    reheatCost: lab.reheatCost,
    coolingIron: lab.coolingIron,
    firePreset: lab.firePreset,
    durabilityDelta: lab.durabilityDelta,
  };
}

/**
 * Starts a craft with the grade's deck and the next craft number (4.2.8: +1 every start).
 * The engine copies deck, tools and rules, so later changes apply from the next craft.
 */
export function beginSession(
  profile: CardProfile,
  recipe: CardRecipeInput,
  nowMs: number,
): { profile: CardProfile; session: CardSession } {
  const lab = profile.lab;
  const craftNo = profile.nextCraftNo;
  const craft = startCardCraft({
    seed: lab.seed,
    craftNo,
    recipe: { ...recipe },
    deck: [...profile.decks[gradeOf(recipe)]],
    tools: { ...lab.tools },
    rules: rulesOf(lab),
  });
  const session: CardSession = {
    version: 1,
    id: `${lab.seed}-${craftNo}-${nowMs}`,
    craft,
    weapon: null,
    inventory: defaultInventory(),
    fameStage: lab.fameStage,
    tapToPreview: lab.tapToPreview,
    startedAtMs: nowMs,
    endedAtMs: null,
    activeMs: 0,
    turnMs: 0,
    turns: [],
    pileOpens: 0,
    infoOpens: 0,
    recorded: false,
    opened: [],
    learned: [],
  };
  return { profile: { ...profile, nextCraftNo: craftNo + 1, lastRecipe: { ...recipe } }, session };
}

/** Adds time spent looking at the craft. */
export function addTime(session: CardSession, ms: number): CardSession {
  if (!(ms > 0)) return session;
  return { ...session, activeMs: session.activeMs + ms, turnMs: session.turnMs + ms };
}

/** The turn's time goes into the log; what happened in it is in the craft's own log (cardTurnSummary). */
function closeTurn(session: CardSession, turn: number): Pick<CardSession, 'turns' | 'turnMs'> {
  const stat: TurnStat = { turn, ms: session.turnMs };
  return { turns: [...session.turns, stat], turnMs: 0 };
}

function ended(session: CardSession, craft: CardCraftState, nowMs: number): Partial<CardSession> {
  if (craft.status === 'active') return {};
  return {
    endedAtMs: nowMs,
    weapon: craft.status === 'success' ? weaponFromCardCraft(craft, weaponIdFor(craft)) : session.weapon,
  };
}

/** Plays a card (the engine throws if it cannot be played). */
export function sessionPlay(session: CardSession, uid: string, opts: PlayOptions, nowMs: number): CardSession {
  const prev = session.craft;
  const craft = playCard(prev, uid, opts);
  if (craft.status !== 'active') return { ...session, craft, ...closeTurn(session, prev.turn), ...ended(session, craft, nowMs) };
  // A card that ends the turn (깊은 담금질).
  if (craft.turn !== prev.turn) return { ...session, craft, ...closeTurn(session, prev.turn) };
  return { ...session, craft };
}

/** 다시 달구기: ends the turn, keeping the cards the 화로 lets the player keep. */
export function sessionEndTurn(session: CardSession, keep: readonly string[], nowMs: number): CardSession {
  const prev = session.craft;
  const craft = endTurn(prev, keep);
  return { ...session, craft, ...closeTurn(session, prev.turn), ...ended(session, craft, nowMs) };
}

/** Stopping halfway is a failure (4.2). */
export function sessionAbandon(session: CardSession, nowMs: number): CardSession {
  const prev = session.craft;
  if (prev.status !== 'active') return session;
  const craft = abandonCardCraft(prev);
  return { ...session, craft, ...closeTurn(session, prev.turn), endedAtMs: nowMs };
}

/** Puts an enchant material into the finished weapon; null if it cannot go in. */
export function sessionFill(session: CardSession, pick: SlotPick): CardSession | null {
  if (session.weapon === null || slotBlock(session.weapon, pick, session.inventory) !== null) return null;
  const { weapon, inventory } = fillSlot(session.weapon, pick, session.inventory);
  return { ...session, weapon, inventory };
}

/**
 * Once a craft is over: its 단련 goes into the profile, the first craft opens the 단계 1 cards,
 * and the craft joins the play log. Returns null when there is nothing to do. Safe to run
 * again after a reload: the profile remembers which craft it took 단련 from, and the log
 * skips a record it already has.
 */
export function settle(
  profile: CardProfile,
  session: CardSession,
  records: readonly PlayRecord[],
  nowMs: number,
): { profile: CardProfile; session: CardSession; records: PlayRecord[] } | null {
  const craft = session.craft;
  if (craft.status === 'active' || session.recorded) return null;
  let nextProfile = profile;
  let opened: CardId[] = [];
  let learned: CardId[] = [];
  if (profile.settled !== session.id) {
    const temper = recordTemper(profile.temper, craft);
    opened = newlyOpened(profile.temper, temper);
    if (!profile.firstCraftDone) {
      const before = learnedUnlockCards(profile.lab.fameStage, false);
      learned = learnedUnlockCards(profile.lab.fameStage, true).filter((id) => !before.includes(id));
    }
    nextProfile = { ...profile, temper, firstCraftDone: true, settled: session.id };
  }
  const weapon =
    craft.status === 'success' ? (session.weapon ?? weaponFromCardCraft(craft, weaponIdFor(craft))) : null;
  const nextSession: CardSession = {
    ...session,
    weapon,
    endedAtMs: session.endedAtMs ?? nowMs,
    recorded: true,
    opened,
    learned,
  };
  const record = buildRecord(nextSession);
  const nextRecords = records.some((r) => r.id === record.id) ? [...records] : [...records, record].slice(-RECORD_LIMIT);
  return { profile: nextProfile, session: nextSession, records: nextRecords };
}
