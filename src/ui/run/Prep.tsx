// 판 준비 (13.3, 13.17): 탑 입구 → 주인공 → 동료 3칸 → 선대 (명예의 전당) → 기술 덱 → [오른다].
// One page, filled top to bottom. The draft is saved as it changes, so it is also '지난 판 구성'.
// 성급과 판 규칙은 실험 패널에서 고른다 ([검증], 뽑기는 이 프로토타입 밖).

import { type CSSProperties, useState } from 'react';
import { cardName } from '../../sim/cards/index.ts';
import { BODY_LABEL, ELEMENT_LABEL, WEAPON_LABEL, WEAPON_SPEC } from '../../sim/data/common.ts';
import type { CardId } from '../../sim/data/cards.ts';
import { FAMILIES, FAMILY_IDS, FAMILY_ORIGIN_LABEL, type FamilyId, familyCardId } from '../../sim/data/families.ts';
import { FACTOR_LABEL, RUN_DEFAULT_DECK, SEASONS, STAR_SPEC, STORY_BONDS } from '../../sim/data/run.ts';
import { ENCHANTS } from '../../sim/data/enchants.ts';
import { STAT_TIER_LABEL } from '../../sim/data/world.ts';
import {
  defaultRunSetup,
  factorText,
  type HallOfFame,
  type LegendCard,
  nextGeneration,
  normalizeSetup,
  obj,
  pickedFactors,
  resolveRunRules,
  runDeckProblems,
  type RunSetupInput,
  seasonLayout,
  setupProblems,
  wallDeadlines,
  type WeaponKeep,
} from '../../sim/run/index.ts';
import { CardFace, Sheet } from '../cards/parts.tsx';
import { grouped } from '../cards/Prep.tsx';
import { DeckEditor } from './Deck.tsx';
import { ElementTag, FamilyFace, LegendCardView, StarBadge } from './parts.tsx';
import type { RunRecord } from './record.ts';
import { type PrepDraft, type RunLab, rulesOfLab } from './store.ts';
import { entryLines, FIRST_RUN_LINE, HALL_EMPTY_LINE, NO_ANCESTOR_LINE, rulesLine, SAME_FACE_LINE, starText } from './text.ts';

const SEASON = SEASONS.ash;
const SEASON_FAMILY = SEASON.family;
/** The 시즌 칸 is the third companion slot (13.3). */
const SEASON_SLOT = 2;

export function defaultDraft(hero: FamilyId = 'aren'): PrepDraft {
  const input = defaultRunSetup(1, hero, 1);
  const companions: (FamilyId | null)[] = (input.companions ?? []).map((c) => c.family);
  while (companions.length < 3) companions.push(null);
  return { hero, companions, deck: [...RUN_DEFAULT_DECK], ancestors: [], mainAncestor: null, factorPicks: [], weaponKeep: null };
}

/** Ancestors of the draft that are still in the hall, in draft order. */
export function draftAncestors(draft: PrepDraft, hall: HallOfFame): LegendCard[] {
  return draft.ancestors.flatMap((id) => {
    const card = hall.cards.find((c) => c.id === id);
    return card === undefined ? [] : [card];
  });
}

/** What the draft starts: 판 시드, 성급과 규칙 come from the 실험 패널. */
export function setupInputOf(draft: PrepDraft, lab: RunLab, hall: HallOfFame): RunSetupInput {
  const ancestors = draftAncestors(draft, hall);
  const intact = ancestors.length === draft.ancestors.length;
  const companions = draft.companions.flatMap((family, slot) =>
    family === null ? [] : [{ family, star: slot === SEASON_SLOT && family === SEASON_FAMILY ? (1 as const) : lab.companionStar }],
  );
  return {
    seed: lab.seed,
    season: SEASON.id,
    hero: { family: draft.hero, star: lab.star },
    companions,
    ancestors,
    mainAncestor: intact ? draft.mainAncestor : null,
    factorPicks: intact ? draft.factorPicks : [],
    weaponKeep: intact ? draft.weaponKeep : null,
    deck: [...draft.deck],
    rules: rulesOfLab(lab),
    generation: nextGeneration(hall, draft.hero),
  };
}

function keepFor(card: LegendCard | undefined): WeaponKeep | null {
  if (card === undefined) return null;
  if (card.weapon.element !== null) return { kind: 'element' };
  const first = card.weapon.enchants[0];
  return first === undefined ? null : { kind: 'enchant', enchant: first };
}

/** The draft with these ancestors (hall ids that still exist): the first is the 주 선대, 인자 picked anew. */
export function draftWithAncestors(draft: PrepDraft, ids: readonly string[], hall: HallOfFame): PrepDraft {
  const kept = ids.filter((id) => hall.cards.some((c) => c.id === id)).slice(0, 2);
  const first = hall.cards.find((c) => c.id === kept[0]);
  return { ...draft, ancestors: kept, mainAncestor: first === undefined ? null : 0, factorPicks: [], weaponKeep: keepFor(first) };
}

/** Families a companion slot can take (13.3: 보유 가문 둘 + 시즌 칸). */
function slotChoices(draft: PrepDraft, slot: number): FamilyId[] {
  const others = draft.companions.filter((_, i) => i !== slot);
  const free = (f: FamilyId) => f !== draft.hero && !others.includes(f);
  if (slot === SEASON_SLOT && draft.hero !== SEASON_FAMILY) return [SEASON_FAMILY];
  return FAMILY_IDS.filter((f) => f !== SEASON_FAMILY && free(f));
}

const FIT_MARK = { good: '◎', normal: '○', bad: '△' } as const;

interface Props {
  draft: PrepDraft;
  lab: RunLab;
  hall: HallOfFame;
  records: readonly RunRecord[];
  runLost: boolean;
  onDraft(draft: PrepDraft): void;
  onStart(input: RunSetupInput): void;
  /** Opens the 명예의 전당 to pick ancestors. */
  onPickAncestors(): void;
  onLab(): void;
  /** The card craft's saved 기본 덱 (작업대), or null. */
  loadBenchDeck(): Promise<CardId[] | null>;
}

type PrepSheet = { kind: 'companion'; slot: number } | { kind: 'deck' };

export function Prep(props: Props) {
  const { draft, lab, hall, records, runLost, onDraft, onStart, onPickAncestors, onLab, loadBenchDeck } = props;
  const [sheet, setSheet] = useState<PrepSheet | null>(null);
  const [benchNote, setBenchNote] = useState<string | null>(null);
  const hero = FAMILIES[draft.hero];
  const spec = STAR_SPEC[lab.star];
  const input = setupInputOf(draft, lab, hall);
  const problems = setupProblems(normalizeSetup(input));
  const ancestors = draftAncestors(draft, hall);
  const deadlines = wallDeadlines(resolveRunRules(rulesOfLab(lab)));
  const bands = seasonLayout(SEASON.id);
  const fit = WEAPON_SPEC[hero.weapon].bodyFit;
  const generation = input.generation ?? 1;
  const best = Math.max(0, ...hall.cards.filter((c) => c.season === SEASON.id).map((c) => c.record), ...records.map((r) => r.result.record));
  const familyCard = familyCardId(draft.hero, spec.cardLevel);
  const main = draft.mainAncestor === null ? undefined : ancestors[draft.mainAncestor];

  const set = (patch: Partial<PrepDraft>) => onDraft({ ...draft, ...patch });
  const pickHero = (family: FamilyId) => {
    if (family === draft.hero) return;
    const base = defaultDraft(family);
    onDraft({ ...draft, hero: family, companions: base.companions, factorPicks: [] });
  };
  const toggleFactor = (ancestor: number, index: number) => {
    const has = draft.factorPicks.some((p) => p.ancestor === ancestor && p.index === index);
    if (has) set({ factorPicks: draft.factorPicks.filter((p) => !(p.ancestor === ancestor && p.index === index)) });
    else if (draft.factorPicks.length < spec.inheritSlots) set({ factorPicks: [...draft.factorPicks, { ancestor, index }] });
  };
  const removeAncestor = (i: number) => onDraft(draftWithAncestors(draft, ancestors.filter((_, j) => j !== i).map((a) => a.id), hall));
  const setMain = (i: number | null) => set({ mainAncestor: i, weaponKeep: i === null ? null : keepFor(ancestors[i]) });

  // 인자 picked twice (from both 선대) add up (sim/run factorAdd); say so where it happens.
  const pickedKinds = new Map<string, number>();
  for (const f of problems.length === 0 ? pickedFactors(normalizeSetup(input)) : []) {
    if (f.kind === 'card') continue;
    const label = f.kind === 'hunter' && f.body !== null ? `${BODY_LABEL[f.body]} ${FACTOR_LABEL.hunter}` : FACTOR_LABEL[f.kind];
    pickedKinds.set(label, (pickedKinds.get(label) ?? 0) + 1);
  }
  const stacked = [...pickedKinds].filter(([, n]) => n > 1).map(([label, n]) => `${label} ×${n}`);
  const deckCount = grouped(draft.deck);
  const deckProblems = runDeckProblems(draft.deck);
  const addedCards: string[] = [`${cardName(familyCard)} (가문 고유 카드 레벨 ${spec.cardLevel})`];

  return (
    <div className="rn-prep">
      {runLost && <p className="kc-why">지난 판을 다시 이어 붙이지 못했다. 저장된 행동이 지금 규칙과 맞지 않는다.</p>}

      <section className="rn-entry" style={{ '--season': SEASON.color } as CSSProperties}>
        <p className="rn-entry-name">
          <span aria-hidden="true">{SEASON.emoji}</span> {SEASON.name}
        </p>
        <p className="rn-entry-line">{SEASON.line}</p>
        {entryLines(lab.turns).map((l) => (
          <p key={l} className="rn-entry-sub">
            {l}
          </p>
        ))}
        <p className="rn-rule">
          시즌 규칙 <b>{SEASON.rule.label}</b> · {SEASON.rule.text}
        </p>
        <table className="rn-layout">
          <thead>
            <tr>
              <th>층</th>
              <th>속성</th>
              <th>체형 (주 / 부)</th>
              <th>벽</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={b.band} className={b.demon ? 'demon' : undefined}>
                <td>
                  {b.firstFloor}~{b.lastFloor}
                </td>
                <td>
                  <ElementTag element={b.element} />
                </td>
                <td>
                  {BODY_LABEL[b.main]}
                  <i className="rn-fit">{FIT_MARK[fit[b.main]]}</i> / {BODY_LABEL[b.sub]}
                  <i className="rn-fit">{FIT_MARK[fit[b.sub]]}</i>
                </td>
                <td>
                  <b>{b.boss}</b>
                  <small>{deadlines[i]}턴까지</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="kc-hint">
          ◎○△는 {WEAPON_LABEL[hero.weapon]}의 체형 상성. 51층부터는 {ELEMENT_LABEL[SEASON.upper.element]}의 위층이 끝없이 이어진다.
          {best > 0 && ` 이 탑의 내 기록 ${best}층.`}
        </p>
      </section>

      <section className="kc-panel">
        <h3>
          주인공 <small>{generation > 1 ? `${generation}대 · ${SAME_FACE_LINE}` : '1대'}</small>
        </h3>
        <div className="rn-family-grid">
          {FAMILY_IDS.map((f) => {
            const fam = FAMILIES[f];
            return (
              <button
                key={f}
                type="button"
                className={f === draft.hero ? 'rn-family on' : 'rn-family'}
                style={{ '--fam': fam.color } as CSSProperties}
                aria-pressed={f === draft.hero}
                onClick={() => pickHero(f)}
              >
                <FamilyFace family={f} />
                <b>{fam.name}</b>
                <small>{WEAPON_LABEL[fam.weapon]}</small>
              </button>
            );
          })}
        </div>
        <div className="rn-hero-detail">
          <p>
            <b>{hero.name}</b> · {WEAPON_LABEL[hero.weapon]} · 인망 {STAT_TIER_LABEL[hero.charisma]} · 운 {STAT_TIER_LABEL[hero.luck]}{' '}
            <span className="kc-tag">{FAMILY_ORIGIN_LABEL[hero.origin]}</span>
          </p>
          <p className="rn-quote">"{hero.trait}"</p>
          <p className="kc-hint">{hero.look}</p>
          <p className="rn-star-line">
            <StarBadge star={lab.star} /> 시작 힘 {spec.startPower.toFixed(2)} · 상한 {spec.powerCap.toFixed(2)} · 계승 칸 {spec.inheritSlots}
            <button type="button" className="kc-btn ghost small" onClick={onLab}>
              성급은 실험에서
            </button>
          </p>
          <CardFace id={familyCard} />
        </div>
      </section>

      <section className="kc-panel">
        <h3>
          동료 <small>보유 가문 둘 + 시즌 가문 하나 · 비워 둬도 된다</small>
        </h3>
        <div className="rn-slots">
          {draft.companions.map((f, slot) => {
            const star = f === null ? null : slot === SEASON_SLOT && f === SEASON_FAMILY ? 1 : lab.companionStar;
            return (
              <button key={slot} type="button" className="rn-slot" onClick={() => setSheet({ kind: 'companion', slot })}>
                {f === null ? (
                  <span className="rn-slot-empty">{slot === SEASON_SLOT ? '시즌 칸' : '빈 칸'}</span>
                ) : (
                  <>
                    <FamilyFace family={f} />
                    <b>{FAMILIES[f].name}</b>
                    <small>
                      {star !== null && starText(star)}
                      {slot === SEASON_SLOT && f === SEASON_FAMILY ? ' · 빌림' : ''}
                    </small>
                    <small className="rn-slot-bonus">{storyBonusLine(f)}</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="kc-panel">
        <h3>
          선대 <small>명예의 전당에서 둘까지 · 인자 {draft.factorPicks.length} / {spec.inheritSlots}</small>
        </h3>
        {hall.cards.length === 0 ? (
          <p className="kc-hint">
            {HALL_EMPTY_LINE} {FIRST_RUN_LINE}
          </p>
        ) : ancestors.length === 0 ? (
          <p className="kc-hint">{NO_ANCESTOR_LINE}</p>
        ) : null}
        {ancestors.map((a, i) => (
          <div key={a.id} className="rn-ancestor">
            <LegendCardView card={a} compact hideFactors>
              <div className="rn-ancestor-factors">
                {a.factors.map((f, j) => {
                  const on = draft.factorPicks.some((p) => p.ancestor === i && p.index === j);
                  const same = a.family === draft.hero;
                  return (
                    <button
                      key={j}
                      type="button"
                      className={on ? 'rn-factor-btn on' : 'rn-factor-btn'}
                      aria-pressed={on}
                      disabled={!on && draft.factorPicks.length >= spec.inheritSlots}
                      onClick={() => toggleFactor(i, j)}
                    >
                      {factorText(same ? { ...f, level: Math.min(3, f.level + 1) } : f)}
                      {same && <small> 같은 가문 +1단계</small>}
                    </button>
                  );
                })}
              </div>
              <div className="kc-row">
                <button
                  type="button"
                  className={draft.mainAncestor === i ? 'kc-btn small primary' : 'kc-btn small'}
                  onClick={() => setMain(draft.mainAncestor === i ? null : i)}
                >
                  {draft.mainAncestor === i ? '주 선대 · 무기를 물려받는다' : '주 선대로'}
                </button>
                <button type="button" className="kc-btn ghost small" onClick={() => removeAncestor(i)}>
                  빼기
                </button>
              </div>
            </LegendCardView>
          </div>
        ))}
        {stacked.length > 0 && (
          <p className="kc-hint">같은 인자를 겹쳐 고르면 효과가 더해진다: {stacked.join(', ')}.</p>
        )}
        {main !== undefined && (
          <div className="rn-keep">
            <p className="kc-hint">
              {obj(main.weaponName)} 1구간 철로 고쳐 벼린다. 품질은 ★{main.weapon.quality} 그대로, 인챈트는 하나만 잇는다.
            </p>
            <div className="kc-chips">
              {main.weapon.element !== null && (
                <button
                  type="button"
                  className={draft.weaponKeep?.kind === 'element' ? 'rn-factor-btn on' : 'rn-factor-btn'}
                  onClick={() => set({ weaponKeep: { kind: 'element' } })}
                >
                  속성 ({ELEMENT_LABEL[main.weapon.element]})
                </button>
              )}
              {main.weapon.enchants.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={draft.weaponKeep?.kind === 'enchant' && draft.weaponKeep.enchant === e ? 'rn-factor-btn on' : 'rn-factor-btn'}
                  onClick={() => set({ weaponKeep: { kind: 'enchant', enchant: e } })}
                >
                  {ENCHANTS[e].name}
                </button>
              ))}
              <button type="button" className={draft.weaponKeep === null ? 'rn-factor-btn on' : 'rn-factor-btn'} onClick={() => set({ weaponKeep: null })}>
                잇지 않는다
              </button>
            </div>
          </div>
        )}
        {hall.cards.length > 0 && (
          <button type="button" className="kc-btn small" onClick={onPickAncestors}>
            명예의 전당에서 고른다
          </button>
        )}
      </section>

      <section className="kc-panel">
        <h3>
          기술 덱 <small>{draft.deck.length}장 · 판이 더하는 카드는 따로</small>
        </h3>
        {deckProblems.length > 0 && (
          <ul className="kc-problems">
            {deckProblems.map((p) => (
              <li key={p.code + (p.card ?? '') + p.message}>{p.message}</li>
            ))}
          </ul>
        )}
        <div className="kc-chips">
          {deckCount.map(({ id, count }) => (
            <span key={id} className="kc-chip">
              {cardName(id)}
              {count > 1 && ` ×${count}`}
            </span>
          ))}
        </div>
        <p className="kc-hint">판이 더한다: {addedCards.join(', ')}. 선대의 카드 인자도 여기에 붙는다.</p>
        <button type="button" className="kc-btn small" onClick={() => setSheet({ kind: 'deck' })}>
          판용으로 고친다
        </button>
        {benchNote !== null && <p className="kc-hint">{benchNote}</p>}
      </section>

      <section className="rn-go">
        <p className="kc-hint center">
          {starText(lab.star)} · {rulesLine(resolveRunRules(rulesOfLab(lab)))} · 판 시드 {lab.seed}
          <button type="button" className="kc-btn ghost small" onClick={onLab}>
            실험
          </button>
        </p>
        {problems.length > 0 && (
          <ul className="kc-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button type="button" className="kc-btn primary big" disabled={problems.length > 0} onClick={() => onStart(input)}>
          오른다
        </button>
      </section>

      {sheet?.kind === 'companion' && (
        <Sheet title={sheet.slot === SEASON_SLOT ? '시즌 칸' : '동료 칸'} onClose={() => setSheet(null)}>
          {sheet.slot === SEASON_SLOT && draft.hero !== SEASON_FAMILY && (
            <p className="kc-hint">시즌 가문은 누구나 1성으로 빌려 쓴다 (13.2.2).</p>
          )}
          <div className="rn-pick-list">
            {slotChoices(draft, sheet.slot).map((f) => (
              <button
                key={f}
                type="button"
                className={draft.companions[sheet.slot] === f ? 'rn-pick-row on' : 'rn-pick-row'}
                onClick={() => {
                  set({ companions: draft.companions.map((c, i) => (i === sheet.slot ? f : c)) });
                  setSheet(null);
                }}
              >
                <FamilyFace family={f} />
                <span>
                  <b>{FAMILIES[f].name}</b> · {WEAPON_LABEL[FAMILIES[f].weapon]}
                  <small>"{FAMILIES[f].trait}"</small>
                  <small>{storyBonusLine(f)}</small>
                </span>
              </button>
            ))}
            <button
              type="button"
              className="rn-pick-row"
              onClick={() => {
                set({ companions: draft.companions.map((c, i) => (i === sheet.slot ? null : c)) });
                setSheet(null);
              }}
            >
              <span className="rn-slot-empty">비워 둔다</span>
            </button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'deck' && (
        <DeckEditor
          deck={draft.deck}
          onChange={(deck) => set({ deck })}
          onReset={() => set({ deck: [...RUN_DEFAULT_DECK] })}
          onBench={() => {
            void loadBenchDeck().then((deck) => {
              if (deck === null) setBenchNote('작업대에 저장한 덱이 없다.');
              else {
                set({ deck });
                setBenchNote('작업대의 기본 레시피 덱을 불러왔다.');
              }
            });
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/** 유대 1·3·5의 보너스 (13.9), the first choice of each 사연. */
function storyBonusLine(family: FamilyId): string {
  const BONUS: Record<string, string> = {
    materialGift: '재료',
    goldGift: '골드',
    cardUpgrade: '카드 강화',
    training: '수련',
    escort: '동행',
    uniqueCard: FAMILIES[family].uniqueCardName,
  };
  return FAMILIES[family].stories.map((s, i) => `${STORY_BONDS[i]} ${BONUS[s.choices[0].bonus] ?? ''}`).join(' · ');
}

