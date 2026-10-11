// 제작 준비 (4.2.9): 레시피 → 등급별 기본 덱 → 섞일 재료 카드 → 시작.

import { useState } from 'react';
import { UNIQUE_IDS, type UniqueId, WEAPON_TYPES } from '../../sim/core/types.ts';
import {
  type CardRecipeInput,
  cardMaxDurability,
  cardName,
  cardRecipeFor,
  cardSmithStats,
  countsAsUnlock,
  deckHandCount,
  fireStatesOf,
  fireWeights,
  unlockCap,
} from '../../sim/cards/index.ts';
import { materialName, WEAPON_LABEL } from '../../sim/data/common.ts';
import {
  BOSS_MATERIAL_CARD,
  CARD_IDS,
  CARD_RECIPE,
  CARD_RECIPE_GRADE_LABEL,
  type CardId,
  type CardRecipeGrade,
  CARDS,
  FIRE_LABEL,
  FIRE_STATES,
  FORCED_NEXT_FIRE,
  type FireState,
} from '../../sim/data/cards.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { sceneArtUrl } from '../../render/forge/assets.ts';
import { type SceneArtKey, WEAPON_ART } from '../../render/forge/layout.ts';
import { deckProblems, gradeOf, rulesOf } from './flow.ts';
import { CardStrip } from './GameCard.tsx';
import { CardFace, Seg, Stepper } from './parts.tsx';
import { type CardProfile, MAX_MATERIAL_TIER } from './store.ts';
import { chance, labNote, signed } from './text.ts';

interface Props {
  profile: CardProfile;
  onStart(recipe: CardRecipeInput): void;
  onBench(grade: CardRecipeGrade): void;
}

/** The last 기본 band (4구간): 5구간부터 고급 (4.2.3). */
const LAST_BASIC_TIER = CARD_RECIPE.advancedFromBand - 1;

function tierRange(grade: CardRecipeGrade): { min: number; max: number } {
  if (grade === 'basic') return { min: 1, max: LAST_BASIC_TIER };
  if (grade === 'advanced') return { min: CARD_RECIPE.advancedFromBand, max: MAX_MATERIAL_TIER };
  return { min: 1, max: MAX_MATERIAL_TIER };
}

/** Card ids with counts, in the card table's order. */
export function grouped(ids: readonly CardId[]): { id: CardId; count: number }[] {
  const counts = new Map<CardId, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return CARD_IDS.filter((id) => counts.has(id)).map((id) => ({ id, count: counts.get(id) as number }));
}

function fireChanceLabel(grade: CardRecipeGrade, f: FireState, weight: number): string {
  if (weight > 0) return chance(weight);
  const after = (Object.keys(FORCED_NEXT_FIRE[grade]) as FireState[]).find((from) => FORCED_NEXT_FIRE[grade][from] === f);
  return after !== undefined ? `${FIRE_LABEL[after]} 다음` : '첫 턴';
}

export function Prep({ profile, onStart, onBench }: Props) {
  const [pick, setPick] = useState<CardRecipeInput>(profile.lastRecipe);
  const [lastBoss, setLastBoss] = useState<UniqueId>(profile.lastRecipe.bossMaterial ?? 'earthBlessing');
  const lab = profile.lab;
  const grade = gradeOf(pick);
  const range = tierRange(grade);
  const recipe = cardRecipeFor(pick);
  const deck = profile.decks[grade];
  const imprints = deck.filter((id) => CARDS[id].imprint !== null);
  const rules = rulesOf(lab);
  const smith = cardSmithStats(lab.tools, imprints, rules);
  const problems = deckProblems(profile, grade);
  const unlocks = deck.filter(countsAsUnlock).length;
  const weights = fireWeights(grade, lab.firePreset);
  const notes = labNote(lab);

  const set = (patch: Partial<CardRecipeInput>) => setPick((p) => ({ ...p, ...patch }));
  const setGrade = (g: CardRecipeGrade) => {
    const r = tierRange(g);
    const tier = Math.min(r.max, Math.max(r.min, pick.materialTier));
    set({ materialTier: tier, bossMaterial: g === 'legendary' ? (pick.bossMaterial ?? lastBoss) : null });
  };
  const setBoss = (u: UniqueId) => {
    setLastBoss(u);
    set({ bossMaterial: u });
  };

  return (
    <div className="kc-prep">
      <p className="kc-lead">무엇을 두드릴까.</p>

      <section className="kc-block">
        <h3>무기</h3>
        <div className="kc-weapons" role="radiogroup" aria-label="무기 종류">
          {WEAPON_TYPES.map((t) => {
            const url = sceneArtUrl(`weapon_${t}` as SceneArtKey);
            const on = pick.weaponType === t;
            return (
              <button key={t} type="button" role="radio" aria-checked={on} className={on ? 'kc-weapon on' : 'kc-weapon'} onClick={() => set({ weaponType: t })}>
                {url !== null && (
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    decoding="async"
                    // Painted tip-down-left (the crossbow): mirrored like on the anvil.
                    style={WEAPON_ART[t].flip === true ? { scale: '-1 1' } : undefined}
                  />
                )}
                <span>{WEAPON_LABEL[t]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kc-block">
        <h3>레시피 등급</h3>
        <Seg
          label="레시피 등급"
          value={grade}
          options={[
            { value: 'basic', label: CARD_RECIPE_GRADE_LABEL.basic, sub: `1~${LAST_BASIC_TIER}구간` },
            { value: 'advanced', label: CARD_RECIPE_GRADE_LABEL.advanced, sub: `${CARD_RECIPE.advancedFromBand}구간~` },
            { value: 'legendary', label: CARD_RECIPE_GRADE_LABEL.legendary, sub: '대보스 재료' },
          ]}
          onChange={setGrade}
        />
      </section>

      <section className="kc-block">
        <h3>주재료</h3>
        <Stepper
          label="주재료 구간"
          value={materialName(pick.materialTier)}
          sub={`${pick.materialTier}구간`}
          downDisabled={pick.materialTier <= range.min}
          upDisabled={pick.materialTier >= range.max}
          onDown={() => set({ materialTier: Math.max(range.min, pick.materialTier - 1) })}
          onUp={() => set({ materialTier: Math.min(range.max, pick.materialTier + 1) })}
        />
      </section>

      {grade === 'legendary' && (
        <section className="kc-block">
          <h3>대보스 재료</h3>
          <div className="kc-pick-grid">
            {UNIQUE_IDS.map((u) => (
              <button
                key={u}
                type="button"
                className={pick.bossMaterial === u ? 'kc-pick on' : 'kc-pick'}
                aria-pressed={pick.bossMaterial === u}
                onClick={() => setBoss(u)}
              >
                <b>{UNIQUES[u].material}</b>
                <small>
                  {cardName(BOSS_MATERIAL_CARD[u])} · {UNIQUES[u].name}
                </small>
              </button>
            ))}
          </div>
          <p className="kc-hint">걸작이면 고유능력이 깃든다. 못 미치면 돌려받고, 실패하면 함께 사라진다.</p>
        </section>
      )}

      <section className="kc-block">
        <h3>
          섞일 재료 카드 <small>이번 제작에만 · 모두 소멸</small>
        </h3>
        <div className="kc-faces">
          {grouped(recipe.materialCards).map(({ id, count }) => (
            <CardFace key={id} id={id} tier={recipe.materialTier} count={count} />
          ))}
        </div>
      </section>

      <section className="kc-panel">
        <div className="kc-kv">
          <span>레시피</span>
          <b>
            <span className={`kc-tag kc-grade-${recipe.grade}`}>{CARD_RECIPE_GRADE_LABEL[recipe.grade]}</span>
          </b>
        </div>
        <div className="kc-kv">
          <span>공정 필요량</span>
          <b>
            {recipe.progressRequired.toLocaleString('ko-KR')}
            <small> (두드리기 {Math.ceil((recipe.progressRequired / smith.craftsmanship) * 10) / 10}번)</small>
          </b>
        </div>
        <div className="kc-kv">
          <span>품질 상한</span>
          <b>{recipe.qualityCap.toLocaleString('ko-KR')}</b>
        </div>
        <div className="kc-kv">
          <span>내구도</span>
          <b>
            {cardMaxDurability(recipe, smith, rules)}
            {smith.durabilityBonus > 0 && <small> (각인 +{smith.durabilityBonus})</small>}
            {rules.durabilityDelta !== 0 && <small> (실험 {signed(rules.durabilityDelta)})</small>}
          </b>
        </div>
        <div className="kc-kv">
          <span>손패 · 간직</span>
          <b>
            {smith.handSize}장 · {smith.keep}장{lab.handSize !== null && <small> (실험)</small>}
          </b>
        </div>
        <div className="kc-kv">
          <span>작업 · 가공 숙련도</span>
          <b>
            {smith.craftsmanship} · {smith.control}
          </b>
        </div>
        <div className="kc-fires">
          {fireStatesOf(grade).map((f) => (
            <span key={f} className={`kc-dot kc-fire-${f}`}>
              {FIRE_LABEL[f]} <small>{fireChanceLabel(grade, f, weights[FIRE_STATES.indexOf(f)] ?? 0)}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="kc-panel">
        <div className="kc-kv">
          <span>{CARD_RECIPE_GRADE_LABEL[grade]} 덱</span>
          <b>
            {deckHandCount(deck)}장 · 해금 {unlocks} / {unlockCap(lab.fameStage)}
            {imprints.length > 0 && ` · 각인 ${imprints.length}`}
          </b>
        </div>
        <CardStrip cards={grouped(deck)} label={`${CARD_RECIPE_GRADE_LABEL[grade]} 덱`} />
        {problems.length > 0 && (
          <ul className="kc-problems" role="status">
            {problems.map((p) => (
              <li key={p.message}>{p.message}</li>
            ))}
          </ul>
        )}
        <button type="button" className="kc-btn small" onClick={() => onBench(grade)}>
          작업대에서 고치기
        </button>
      </section>

      {/* Stays at the bottom of the screen: the same recipe again is one tap, not a scroll. */}
      <div className="kc-start">
        <button
          type="button"
          className="kc-btn primary big"
          disabled={problems.length > 0}
          onClick={() => onStart(pick)}
        >
          {problems.length > 0 ? '덱을 먼저 고쳐야 한다' : '망치를 든다'}
        </button>
        <p className="kc-hint center">
          제작 번호 {profile.nextCraftNo} · 시드 {lab.seed}
          {notes.length > 0 && ` · 실험: ${notes.join(' · ')}`}
        </p>
      </div>
    </div>
  );
}
