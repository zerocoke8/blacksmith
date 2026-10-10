// Choose weapon type, main-material band and an optional 대보스 material.

import { useState } from 'react';
import { UNIQUE_IDS, type UniqueId, WEAPON_TYPES } from '../../sim/core/types.ts';
import { type RecipeInput, recipeFor, type SmithSetup, smithStats } from '../../sim/craft/index.ts';
import { materialName, WEAPON_LABEL, WEAPON_SPEC } from '../../sim/data/common.ts';
import { CONDITION_LABEL, RECIPE_GRADE_LABEL } from '../../sim/data/craft.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';

const MAX_TIER = 15;

interface Props {
  initial: RecipeInput;
  smith: SmithSetup;
  craftNo: number;
  onStart(recipe: RecipeInput): void;
}

export function RecipePicker({ initial, smith, craftNo, onStart }: Props) {
  const [pick, setPick] = useState<RecipeInput>(initial);
  const recipe = recipeFor(pick);
  const stats = smithStats(smith);
  const set = (patch: Partial<RecipeInput>) => setPick((p) => ({ ...p, ...patch }));

  return (
    <div className="rp">
      <p className="rp-lead">무엇을 두드릴까.</p>

      <section className="rp-block">
        <h3>무기</h3>
        <div className="seg seg-3">
          {WEAPON_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={pick.weaponType === t ? 'seg-btn on' : 'seg-btn'}
              onClick={() => set({ weaponType: t })}
            >
              {WEAPON_LABEL[t]}
              <small>공격 ×{WEAPON_SPEC[t].attack}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="rp-block">
        <h3>주재료</h3>
        <div className="stepper">
          <button
            type="button"
            className="btn step"
            disabled={pick.materialTier <= 1}
            onClick={() => set({ materialTier: pick.materialTier - 1 })}
            aria-label="낮은 구간"
          >
            −
          </button>
          <div className="stepper-val">
            <b>{materialName(pick.materialTier)}</b>
            <small>{pick.materialTier}구간</small>
          </div>
          <button
            type="button"
            className="btn step"
            disabled={pick.materialTier >= MAX_TIER}
            onClick={() => set({ materialTier: pick.materialTier + 1 })}
            aria-label="높은 구간"
          >
            +
          </button>
        </div>
      </section>

      <section className="rp-block">
        <h3>대보스 재료</h3>
        <select
          className="select"
          value={pick.bossMaterial ?? ''}
          onChange={(e) => set({ bossMaterial: e.target.value === '' ? null : (e.target.value as UniqueId) })}
        >
          <option value="">넣지 않음</option>
          {UNIQUE_IDS.map((u) => (
            <option key={u} value={u}>
              {UNIQUES[u].material} — {UNIQUES[u].name}
            </option>
          ))}
        </select>
        {pick.bossMaterial && <p className="hint">걸작이 나와야 깃든다. 실패하면 함께 사라진다.</p>}
      </section>

      <section className="rp-preview">
        <div className="rp-row">
          <span>레시피</span>
          <b className={`tag grade-${recipe.grade}`}>{RECIPE_GRADE_LABEL[recipe.grade]}</b>
        </div>
        <div className="rp-row">
          <span>공정 필요량</span>
          <b>
            {recipe.progressRequired}
            <small> (두드리기 {Math.ceil((recipe.progressRequired / stats.craftsmanship) * 10) / 10}번)</small>
          </b>
        </div>
        <div className="rp-row">
          <span>품질 상한</span>
          <b>{recipe.qualityCap}</b>
        </div>
        <div className="rp-row">
          <span>내구도 · 제작력</span>
          <b>
            {recipe.durability + stats.durabilityBonus} · {stats.maxCp}
          </b>
        </div>
        <div className="rp-conds">
          {recipe.conditions.map((c) => (
            <span key={c} className={`cond-dot cond-${c}`}>
              {CONDITION_LABEL[c]}
            </span>
          ))}
        </div>
      </section>

      <button type="button" className="btn primary big" onClick={() => onStart(pick)}>
        망치를 든다
      </button>
      <p className="hint center">제작 번호 {craftNo}</p>
    </div>
  );
}
