// 보스 벽 (기획서 13.7): 마감 턴이면 벽 도전이 강제되고, 못 넘으면 은퇴로 판이 끝난다. 마지막 등반,
// 판 안의 중상과 [검증] 스위치 '사망'.

import { describe, expect, it } from 'vitest';
import type { Weapon } from '../core/types.ts';
import { climb } from './expedition.ts';
import { actionBlock, forcedTurn, runAct, startRun } from './run.ts';
import { draftRun } from './state.ts';
import { arenSetup } from './testkit.ts';
import type { RunState } from './types.ts';

const strong: Weapon = {
  id: 'x',
  type: 'dagger',
  materialTier: 6,
  quality: 5,
  element: 'water',
  enchants: ['combo', 'pursuit', 'keen'],
  unique: null,
};

function withWeapon(s: RunState, weapon: Weapon): RunState {
  return { ...s, weapon: { ...s.weapon, weapon, durability: 1 } };
}

/** A run standing before wall `index` (0-based) on its 마감 턴, every earlier wall passed on time. */
function atWall(index: number, over: Partial<RunState> = {}, seed = 1, rules = {}): RunState {
  const s = startRun(arenSetup({ seed }, rules));
  const floor = index * 10;
  return {
    ...s,
    turn: s.walls[index]?.deadline as number,
    lastBossFloor: floor,
    record: floor,
    cumulativeFloors: floor * 2,
    walls: s.walls.map((w, i) => (i < index ? { ...w, passedTurn: w.deadline } : w)),
    ...over,
  };
}

describe('벽 도전 (13.7)', () => {
  it('on the 마감 턴 the only turn is the 벽 도전', () => {
    const s = atWall(1);
    expect(forcedTurn(s)).toBe('wall');
    expect(actionBlock(s, { type: 'expedition', policy: 'normal' })).toBe('벽 도전 턴이다');
    expect(actionBlock(s, { type: 'rest' })).toBe('벽 도전 턴이다');
    expect(actionBlock(s, { type: 'wall' })).toBeNull();
    expect(actionBlock(s, { type: 'retire' })).toBeNull();
    expect(forcedTurn({ ...s, turn: s.turn - 1 })).toBeNull();
    expect(actionBlock({ ...s, turn: s.turn - 1 }, { type: 'wall' })).toBe('아직 마감 턴이 아니다');
  });

  it('failing the wall ends the run in 은퇴 at that floor', () => {
    const s = atWall(3);
    const after = runAct(s, { type: 'wall' });
    expect(after.phase).toBe('over');
    expect(after.end).toMatchObject({ kind: 'wall', floor: 30 });
    expect(after.end?.line).toBe('아렌이 탑 앞에서 단검을 내려놓았다. 서른 층. 짧지 않았다.');
    expect(after.result?.legend).toMatchObject({ family: 'aren', end: 'wall', endFloor: 30, record: 30 });
    expect(actionBlock(after, { type: 'rest' })).toBe('판이 끝났다');
  });

  it('turns off the 귀환 기준 until the wall boss falls, then climbs on as 보통', () => {
    const low = withWeapon(atWall(0, { hp: 0.3 }), strong);
    // An ordinary 원정 at HP 30% turns back before the first floor.
    const plain = draftRun({ ...low, turn: 1 });
    expect(climb(plain, 'normal', 'normal').log.floors).toHaveLength(0);
    const after = runAct(low, { type: 'wall' });
    const log = after.turnLog[after.turnLog.length - 1]?.expedition;
    expect(log?.mode).toBe('wall');
    expect(log?.floors.map((f) => f.floor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(log?.end).toBe('hp');
    expect(after.walls[0]?.passedTurn).toBe(4);
    expect(after.phase).toBe('choice');
    expect(after.pending.map((c) => c.kind)).toContain('bossReward');
  });

  it('an early wall counts its 여유 turns for the 평가', () => {
    let s = withWeapon(startRun(arenSetup()), strong);
    s = runAct(s, { type: 'expedition', policy: 'normal' });
    expect(s.walls[0]?.passedTurn).toBe(1);
    expect(s.walls[0]?.deadline).toBe(4);
  });

  it('after the 악마 the last turn is the 마지막 등반 from 51층, and the run ends there', () => {
    const s = withWeapon(atWall(5, { turn: 30, lastBossFloor: 50, record: 50, cumulativeFloors: 140 }), strong);
    expect(forcedTurn({ ...s, turn: 29 })).toBeNull();
    expect(forcedTurn(s)).toBe('climb');
    expect(actionBlock(s, { type: 'expedition', policy: 'bold' })).toBe('마지막 등반 턴이다');
    const after = runAct(s, { type: 'climb' });
    const log = after.turnLog[after.turnLog.length - 1]?.expedition;
    expect(log?.startFloor).toBe(51);
    expect(after.phase).toBe('over');
    expect(after.end?.kind).toBe('climb');
    expect(after.record).toBeGreaterThan(51);
    expect(after.end?.line).toMatch(/^아렌은 .+ 층에서 돌아섰다\. 위는 아직 끝이 없다\.$/);
    expect(after.result?.weaponName).toMatch(/재의 악마의 탑 \d+층을 연 단검|재의 군주를 벤 단검/);
  });
});

describe('판 안의 사망 (13.4.2)', () => {
  /** A seed whose wall attempt at 31층 rolls 7.9's 사망 on its first floor. */
  function deathSeed(): number {
    for (let seed = 1; seed < 5000; seed++) {
      const d = draftRun(atWall(3, { hp: 0.5 }, seed));
      const out = climb(d, 'wall', 'normal');
      if (out.log.result === 'severe') return seed;
    }
    throw new Error('no seed with a 중상 found');
  }

  it('중상: 다음 턴은 휴식으로 고정되고 부상 상태가 된다', () => {
    const seed = deathSeed();
    const d = draftRun(atWall(3, { hp: 0.5 }, seed));
    const out = climb(d, 'wall', 'normal');
    expect(out.log.result).toBe('severe');
    expect(out.died).toBe(false);
    expect(d.forcedRest).toBe(true);
    expect(d.injured).toBe(true);
    expect(d.hp).toBeLessThanOrEqual(0.6);
    const next = { ...d, turn: 20, phase: 'turn' as const };
    expect(forcedTurn(next)).toBe('rest');
    expect(actionBlock(next, { type: 'expedition', policy: 'normal' })).toBe('중상이다. 이번 턴은 쉰다');
    const rested = runAct(next, { type: 'rest' });
    expect(rested.injured).toBe(false);
    expect(rested.forcedRest).toBe(false);
    expect(rested.turnLog[rested.turnLog.length - 1]).toMatchObject({ action: 'rest', forced: true });
  });

  it('a 중상 on the turn before a wall or the 마지막 등반 does not take that turn: the hero goes up hurt', () => {
    // Pinned on purpose (rules review): the forced climb wins over the forced rest, the rest is dropped.
    const hurt = { forcedRest: true, injured: true, hp: 0.4 };
    const climbTurn = { ...atWall(5, { turn: 30, lastBossFloor: 50, record: 50, cumulativeFloors: 140 }), ...hurt };
    expect(forcedTurn(climbTurn)).toBe('climb');
    const after = runAct(withWeapon(climbTurn, strong), { type: 'climb' });
    expect(after.turnLog[after.turnLog.length - 1]).toMatchObject({ action: 'climb', forced: true, hpBefore: 0.4 });
    expect(after.forcedRest).toBe(false);
    const wallTurn = { ...atWall(2), ...hurt };
    expect(forcedTurn(wallTurn)).toBe('wall');
    expect(forcedTurn({ ...wallTurn, turn: wallTurn.turn - 1 })).toBe('rest');
  });

  it("with the [검증] switch '사망' the same roll ends the run", () => {
    const seed = deathSeed();
    const s = atWall(3, { hp: 0.5 }, seed, { deathMode: 'death' });
    const after = runAct(s, { type: 'wall' });
    expect(after.end?.kind).toBe('dead');
    expect(after.end?.line).toBe('아렌이 돌아오지 않았다. 그의 단검도.');
    expect(after.result?.legend.end).toBe('dead');
  });
});
