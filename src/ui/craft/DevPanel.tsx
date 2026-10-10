// Development panel: skill-board nodes, fame stage, tool levels, world seed. Folded by default.
// It does not block layouts 9.3 would refuse; it says so, so results are not mistaken for reachable ones.

import { useState } from 'react';
import { checkLayout, skillBoardCap, type ToolLevels } from '../../sim/craft/index.ts';
import {
  CRAFT_BRANCH_LABEL,
  CRAFT_NODE_IDS,
  CRAFT_NODES,
  type CraftBranch,
  type CraftNodeId,
  TOOL_LABEL,
} from '../../sim/data/craft.ts';
import { DEV_MAX_FAME_STAGE, DEV_MAX_TOOL, type DevSettings } from './session.ts';

interface Props {
  dev: DevSettings;
  craftActive: boolean;
  /** Receives an updater so quick taps compose instead of overwriting each other. */
  onChange(update: (dev: DevSettings) => DevSettings): void;
}

function stageName(stage: number): string {
  return stage > 7 ? `전설 ★${stage - 7}` : `${stage}`;
}

export function DevPanel({ dev, craftActive, onChange }: Props) {
  const [seedText, setSeedText] = useState(String(dev.worldSeed));
  const on = new Set(dev.nodes);
  const cap = skillBoardCap(dev.fameStage);
  const illegal = checkLayout(dev.nodes, dev.fameStage);

  const toggle = (id: CraftNodeId) =>
    onChange((d) => {
      const next = new Set(d.nodes);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const pair = CRAFT_NODES[id].pair;
        if (pair) next.delete(pair); // ↔: only one side (9.3)
      }
      return { ...d, nodes: CRAFT_NODE_IDS.filter((n) => next.has(n)) };
    });

  const addTool = (k: keyof ToolLevels, delta: number) =>
    onChange((d) => ({ ...d, tools: { ...d.tools, [k]: Math.max(0, Math.min(DEV_MAX_TOOL, d.tools[k] + delta)) } }));

  const addStage = (delta: number) =>
    onChange((d) => ({ ...d, fameStage: Math.max(1, Math.min(DEV_MAX_FAME_STAGE, d.fameStage + delta)) }));

  const applySeed = (text: string) => {
    setSeedText(text);
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) onChange((d) => ({ ...d, worldSeed: n >>> 0 }));
  };

  const randomSeed = () => {
    // UI-only randomness for a dev seed; the sim never sees Math.random.
    const n = Math.floor(Math.random() * 0xffffffff);
    setSeedText(String(n));
    onChange((d) => ({ ...d, worldSeed: n }));
  };

  return (
    <details className="dev">
      <summary>개발용 패널</summary>
      {craftActive && <p className="hint">진행 중인 제작에는 다음 제작부터 적용된다.</p>}

      <div className="dev-block">
        <h4>세계 시드 · 제작 번호</h4>
        <div className="row">
          <input
            className="input"
            inputMode="numeric"
            value={seedText}
            onChange={(e) => applySeed(e.target.value)}
            aria-label="세계 시드"
          />
          <button type="button" className="btn" onClick={randomSeed}>
            무작위
          </button>
        </div>
        <div className="row">
          <span className="muted">다음 제작 번호 {dev.nextCraftNo}</span>
          <button type="button" className="btn small" onClick={() => onChange((d) => ({ ...d, nextCraftNo: 1 }))}>
            1로
          </button>
        </div>
      </div>

      <div className="dev-block">
        <h4>도구 레벨</h4>
        {(Object.keys(TOOL_LABEL) as (keyof ToolLevels)[]).map((k) => (
          <div key={k} className="row tool">
            <span>{TOOL_LABEL[k]}</span>
            <button type="button" className="btn step" onClick={() => addTool(k, -1)} aria-label={`${TOOL_LABEL[k]} 내리기`}>
              −
            </button>
            <b className="tool-lv">{dev.tools[k]}</b>
            <button type="button" className="btn step" onClick={() => addTool(k, 1)} aria-label={`${TOOL_LABEL[k]} 올리기`}>
              +
            </button>
            <button type="button" className="btn small" onClick={() => addTool(k, 5)}>
              +5
            </button>
          </div>
        ))}
      </div>

      <div className="dev-block">
        <h4>명성 단계 (스킬판 규칙 확인용)</h4>
        <div className="row tool">
          <button type="button" className="btn step" onClick={() => addStage(-1)} aria-label="명성 단계 내리기">
            −
          </button>
          <b className="tool-lv">{stageName(dev.fameStage)}</b>
          <button type="button" className="btn step" onClick={() => addStage(1)} aria-label="명성 단계 올리기">
            +
          </button>
          <span className="muted">
            켠 노드 {dev.nodes.length} / 상한 {cap}
          </span>
        </div>
        {illegal && (
          <p className="dev-warn" role="status">
            규칙 밖 배치: {illegal}. 개발용이라 그대로 만들지만, 이 단계에서는 켤 수 없는 판이다.
          </p>
        )}
      </div>

      {(['hammer', 'fingertip'] as CraftBranch[]).map((branch) => (
        <div key={branch} className="dev-block">
          <h4>
            {CRAFT_BRANCH_LABEL[branch]} <small className="muted">켠 노드 {dev.nodes.filter((n) => CRAFT_NODES[n].branch === branch).length}</small>
          </h4>
          <div className="nodes">
            {CRAFT_NODE_IDS.filter((id) => CRAFT_NODES[id].branch === branch).map((id) => {
              const n = CRAFT_NODES[id];
              const later = n.stage > dev.fameStage;
              return (
                <button
                  key={id}
                  type="button"
                  className={`node${on.has(id) ? ' on' : ''}${later ? ' later' : ''}`}
                  onClick={() => toggle(id)}
                >
                  <span className="node-idx">
                    {n.index}
                    {n.pair ? '↔' : ''}
                  </span>
                  <span className="node-name">{n.name}</span>
                  <small>
                    {n.action ? '액션' : n.description} · 단계 {n.stage}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn small" onClick={() => onChange((d) => ({ ...d, nodes: [] }))}>
          노드 모두 끄기
        </button>
      </div>
    </details>
  );
}
