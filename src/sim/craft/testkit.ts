// Helpers shared by craft tests and future balance tools. Pure.

import type { UniqueId, WeaponType } from '../core/types.ts';
import {
  type Condition,
  CRAFT_ACTIONS,
  type CraftActionId,
  type CraftBranch,
  CRAFT_NODE_IDS,
  CRAFT_NODES,
  type CraftNodeId,
  type RecipeGrade,
} from '../data/craft.ts';
import { rollCondition } from './conditions.ts';
import { abandonCraft, applyAction, checkAction, type CraftSetup, type CraftState, startCraft } from './engine.ts';
import { NO_TOOLS, skillBoardCap, type ToolLevels } from './smith.ts';
import { allNormalOutlook } from './solver.ts';

export function makeSetup(
  opts: {
    worldSeed?: number;
    craftNo?: number;
    weaponType?: WeaponType;
    materialTier?: number;
    /** A 대보스 material makes the recipe 전설. */
    bossMaterial?: UniqueId | null;
    nodes?: CraftNodeId[];
    tools?: ToolLevels;
  } = {},
): CraftSetup {
  return {
    worldSeed: opts.worldSeed ?? 1,
    craftNo: opts.craftNo ?? 1,
    recipe: {
      weaponType: opts.weaponType ?? 'oneHandSword',
      materialTier: opts.materialTier ?? 1,
      bossMaterial: opts.bossMaterial ?? null,
    },
    smith: { nodes: opts.nodes ?? [], tools: opts.tools ?? NO_TOOLS },
  };
}

/** First craft number whose first `turns` turns are all 보통 when no re-roll is used. */
export function findAllNormalCraft(worldSeed: number, turns: number, grade: RecipeGrade = 'basic'): number {
  for (let craftNo = 1; craftNo < 1_000_000; craftNo++) {
    let prev: Condition = 'normal';
    let ok = true;
    // Turn 1 is always 보통; draw i decides turn i + 2.
    for (let i = 0; i < turns - 1 && ok; i++) {
      prev = rollCondition(worldSeed, craftNo, i, grade, prev);
      ok = prev === 'normal';
    }
    if (ok) return craftNo;
  }
  throw new Error('no all-normal craft found');
}

/**
 * Every fullest craft layout 9.3 allows at a fame stage, for checks that assume every turn
 * is 보통: each branch walked in order from node 1, one side of each ↔, as many nodes as the
 * stage cap allows (more nodes only add options or stats). 불 다시 보기 and 불꽃 읽기 do
 * nothing when every turn is 보통, so 대장장이의 감 stands for that ↔ and 불꽃 읽기 is left off.
 */
export function fullCraftLayouts(fameStage: number): CraftNodeId[][] {
  const idle: CraftNodeId[] = ['carefulObservation', 'flameReading'];
  const prefixes = (branch: CraftBranch): CraftNodeId[][][] => {
    const steps: CraftNodeId[][] = [];
    for (const id of CRAFT_NODE_IDS) {
      const n = CRAFT_NODES[id];
      if (n.branch !== branch || n.stage > fameStage || idle.includes(id)) continue;
      (steps[n.index - 1] ??= []).push(id);
    }
    const byDepth: CraftNodeId[][][] = [[[]]];
    for (const options of steps) {
      if (options === undefined) break;
      const last = byDepth[byDepth.length - 1] ?? [];
      byDepth.push(last.flatMap((p) => options.map((o) => [...p, o])));
    }
    return byDepth;
  };
  const hammer = prefixes('hammer');
  const fingertip = prefixes('fingertip');
  const cap = skillBoardCap(fameStage);
  const out: CraftNodeId[][] = [];
  for (let h = 0; h < hammer.length; h++) {
    for (let f = 0; f < fingertip.length; f++) {
      const full = h + f === cap || (h + f < cap && h === hammer.length - 1 && f === fingertip.length - 1);
      if (!full) continue;
      for (const a of hammer[h] ?? []) for (const b of fingertip[f] ?? []) out.push([...a, ...b]);
    }
  }
  return out;
}

/**
 * A player who re-plans every turn: tries each action on the real condition (with
 * 대장장이의 감 or 최후의 한 수 folded in front where they apply) and keeps the one whose
 * result plus the best all-보통 continuation is worth most, then the shorter. Quality past
 * the cap is worth nothing (the outlook caps it too), so once the cap is in reach it takes
 * the fewest turns that still fill it. It never re-rolls and never holds a buff back for a
 * 좋음 that may come, so it is strong, not perfect.
 * Pass one outlook for many crafts of the same setup; it keeps its searches.
 */
export function playReplanning(setup: CraftSetup, outlook = allNormalOutlook(setup)): CraftState {
  let s = startCraft(setup);
  while (s.status === 'active') {
    let pick: CraftState | null = null;
    let pickScore = { quality: Number.NEGATIVE_INFINITY, turns: 0 };
    for (const id of s.stats.actions) {
      const spec = CRAFT_ACTIONS[id];
      if (spec.free) continue;
      const tries: CraftActionId[][] = [[id]];
      if (spec.requires === 'goodCondition' && s.stats.actions.includes('heartAndSoul')) tries.push(['heartAndSoul', id]);
      if (spec.progress > 0 && s.stats.actions.includes('finalAppraisal')) tries.push(['finalAppraisal', id]);
      for (const steps of tries) {
        let t: CraftState | null = s;
        for (const a of steps) t = t !== null && checkAction(t, a) === null ? applyAction(t, a) : null;
        if (t === null || t.status === 'failed') continue;
        const gain = t.quality - s.quality;
        const rest = t.status === 'success' ? { quality: 0, turns: 0 } : outlook(t);
        if (rest === null) continue;
        const score = { quality: gain + rest.quality, turns: 1 + rest.turns };
        if (score.quality > pickScore.quality || (score.quality === pickScore.quality && score.turns < pickScore.turns)) {
          pick = t;
          pickScore = score;
        }
      }
    }
    if (pick === null) return abandonCraft(s);
    s = pick;
  }
  return s;
}

export function runActions(state: CraftState, actions: readonly CraftActionId[]): CraftState {
  return actions.reduce((s, a) => applyAction(s, a), state);
}

export function runFromSetup(setup: CraftSetup, actions: readonly CraftActionId[]): CraftState {
  return runActions(startCraft(setup), actions);
}

// ---------- Pace points (기획서 3.7, 10장): main-material band, level of every tool, fame stage ----------

/** Where 기본 recipes are the shop's top band. */
export const BASIC_PACE = [
  { when: '시작', band: 1, tools: 0, stage: 1 },
  { when: '1~2일차', band: 2, tools: 4, stage: 2 },
  { when: '3일차', band: 3, tools: 10, stage: 3 },
] as const;

export interface LatePacePoint {
  when: string;
  band: number;
  tools: number;
  stage: number;
  /** The full legal board that makes the best all-보통 line there, per grade (balance.test.ts checks it). */
  strongest: { advanced: CraftNodeId[]; legendary: CraftNodeId[] };
}

const STAGE7_FULL: CraftNodeId[] = [
  'wasteNot',
  'carefulSynthesis',
  'muscleMemory',
  'thickAnvil',
  'reflect',
  'greatStrides',
  'tricksOfTheTrade',
  'heartAndSoul',
  'deftHand',
];

/** 고급 and 전설 at the later pace points (3달 has no tool level in 10장; 55 is 1달 plus five bands of 9.4's trend). */
export const LATE_PACE: readonly LatePacePoint[] = [
  {
    when: '1주',
    band: 5,
    tools: 20,
    stage: 4,
    strongest: {
      advanced: ['wasteNot', 'carefulSynthesis', 'reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul'],
      legendary: ['wasteNot', 'carefulSynthesis', 'reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul'],
    },
  },
  {
    when: '1달',
    band: 8,
    tools: 35,
    stage: 6,
    strongest: {
      advanced: ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'thickAnvil', 'reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul'],
      legendary: ['wasteNot', 'carefulSynthesis', 'muscleMemory', 'reflect', 'greatStrides', 'tricksOfTheTrade', 'heartAndSoul', 'deftHand'],
    },
  },
  {
    when: '3달',
    band: 13,
    tools: 55,
    stage: 7,
    strongest: { advanced: STAGE7_FULL, legendary: STAGE7_FULL },
  },
];

/** The 대보스 material the pace checks put in to make a recipe 전설. */
export const PACE_BOSS_MATERIAL: UniqueId = 'rebirth';

/** A line played through the engine with every turn held at 보통 (to check the solver). */
export function replayAllNormal(setup: CraftSetup, actions: readonly CraftActionId[]): CraftState {
  return actions.reduce((s, a) => ({ ...applyAction(s, a), condition: 'normal' as const }), startCraft(setup));
}

/** The 11-turn example from 기획서 4.2.1. */
export const EXAMPLE_FLOW: readonly CraftActionId[] = [
  'basicSynthesis',
  'basicTouch',
  'basicTouch',
  'basicTouch',
  'mastersMend',
  'innovation',
  'basicTouch',
  'byregotsBlessing',
  'basicSynthesis',
  'basicSynthesis',
  'basicSynthesis',
];
