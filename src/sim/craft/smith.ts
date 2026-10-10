// Smith stats from tool facilities (9.4) and craft skill-board nodes (9.3).

import {
  BASE_SMITH,
  BASIC_ACTIONS,
  CRAFT_ACTION_IDS,
  CRAFT_NODE_IDS,
  CRAFT_NODES,
  type CraftActionId,
  type CraftNodeId,
  PASSIVE_BONUS,
  SKILL_BOARD_CAP,
  TOOL_BONUS,
} from '../data/craft.ts';

export interface ToolLevels {
  anvil: number; // 모루
  whetstone: number; // 숫돌
  furnace: number; // 화로
}

export const NO_TOOLS: ToolLevels = { anvil: 0, whetstone: 0, furnace: 0 };

export interface SmithSetup {
  /** Craft-layout nodes that are switched on. */
  nodes: CraftNodeId[];
  tools: ToolLevels;
}

export interface SmithStats {
  craftsmanship: number;
  control: number;
  maxCp: number;
  /** Added to the recipe durability (두꺼운 모루판). */
  durabilityBonus: number;
  /** 불꽃 읽기: the next turn's condition is shown. */
  foresight: boolean;
  /** Actions on the craft screen, in display order. */
  actions: CraftActionId[];
}

/** Whole, non-negative level; anything that is not a finite number counts as 0. */
function level(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** Stat multiplier a tool gives at a level (9.4; compound or linear per data). */
export function toolMultiplier(tool: keyof ToolLevels, lv: number): number {
  const { perLevel, compound } = TOOL_BONUS[tool];
  const n = level(lv);
  return compound ? (1 + perLevel) ** n : 1 + perLevel * n;
}

/** Basic six plus every action whose node is on, in canonical order. */
export function enabledActions(nodes: readonly CraftNodeId[]): CraftActionId[] {
  const unlocked = new Set<CraftActionId>(BASIC_ACTIONS);
  for (const id of nodes) {
    const a = CRAFT_NODES[id]?.action;
    if (a) unlocked.add(a);
  }
  return CRAFT_ACTION_IDS.filter((id) => unlocked.has(id));
}

export function smithStats(setup: SmithSetup): SmithStats {
  const on = new Set(setup.nodes);
  const craftsmanship =
    BASE_SMITH.craftsmanship *
    toolMultiplier('anvil', setup.tools.anvil) *
    (1 + (on.has('trainedArm') ? PASSIVE_BONUS.trainedArm : 0));
  const control =
    BASE_SMITH.control *
    toolMultiplier('whetstone', setup.tools.whetstone) *
    (1 + (on.has('deftHand') ? PASSIVE_BONUS.deftHand : 0));
  const maxCp = BASE_SMITH.cp * toolMultiplier('furnace', setup.tools.furnace);
  return {
    craftsmanship: Math.round(craftsmanship),
    control: Math.round(control),
    maxCp: Math.round(maxCp),
    durabilityBonus: on.has('thickAnvil') ? PASSIVE_BONUS.thickAnvil : 0,
    foresight: on.has('flameReading'),
    actions: enabledActions(setup.nodes),
  };
}

// ---------- Skill-board layout rules (9.2, 9.3) ----------

/** How many nodes one layout may switch on at a fame stage (stage 8 = ★1, …). */
export function skillBoardCap(fameStage: number): number {
  const table = SKILL_BOARD_CAP.byStage;
  const stage = Math.max(1, level(fameStage));
  if (stage <= table.length) return table[stage - 1] ?? table[0];
  const last = table[table.length - 1] ?? table[0];
  return Math.min(SKILL_BOARD_CAP.max, last + SKILL_BOARD_CAP.perStarStage * (stage - table.length));
}

/**
 * Why this craft layout cannot be switched on at the fame stage (short Korean), or null
 * if it can (9.3): the node has appeared, one side of each ↔, the node before it in the
 * branch is on, and no more nodes than the stage cap.
 */
export function checkLayout(nodes: readonly CraftNodeId[], fameStage: number): string | null {
  const on = new Set(nodes);
  if (on.size !== nodes.length) return '같은 노드가 두 번 켜져 있다';
  for (const id of nodes) {
    const n = CRAFT_NODES[id];
    if (n === undefined) return '모르는 노드';
    if (n.stage > fameStage) return `${n.name}: 명성 단계 ${n.stage}부터`;
    if (n.pair !== null && on.has(n.pair)) return `${n.name}: ↔ 둘 중 하나만`;
    const hasBefore = CRAFT_NODE_IDS.some((o) => {
      const p = CRAFT_NODES[o];
      return on.has(o) && p.branch === n.branch && p.index === n.index - 1;
    });
    if (n.index > 1 && !hasBefore) return `${n.name}: 앞 노드가 꺼져 있다`;
  }
  const cap = skillBoardCap(fameStage);
  if (nodes.length > cap) return `상한 ${cap}개를 넘는다`;
  return null;
}
