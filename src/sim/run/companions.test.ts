// 동료 슬롯 (기획서 13.9): 유대, 사연 3단계, 성급이 정하는 보너스 단계, 유대 5의 고유 카드.
// 선대 계승 (13.10): 인자, 같은 가문의 단계 +1, 선대 무기로 시작.

import { describe, expect, it } from 'vitest';
import { CARDS } from '../data/cards.ts';
import { FAMILIES, FAMILY_IDS, familyCardId, familyCardInfo } from '../data/families.ts';
import { STORY_BONDS } from '../data/run.ts';
import { bonusEffects } from './events.ts';
import { masteryFloor, runPower, runStartPower } from './hero.ts';
import { actionBlock, normalizeSetup, pickedFactors, runAct, setupProblems, startRun } from './run.ts';
import { arenSetup, factor, sampleAncestor } from './testkit.ts';
import type { RunState } from './types.ts';

/** A long run so 교류 turns do not run into the first wall. */
const LONG = { turns: 60, wallPreset: 'loose' as const };

/** Bonds companion `i` up to `bond` through 교류 turns, taking the first option of each 사연. */
function bondTo(s: RunState, i: number, bond: number): RunState {
  let t = s;
  while ((t.companions[i]?.bond ?? 0) < bond) {
    t = runAct({ ...t, hp: 0.2 }, { type: 'bond', companion: i });
    while (t.phase === 'choice') {
      const head = t.pending[0];
      const pick = head?.kind === 'story' ? 0 : (head?.options.length ?? 1) - 1;
      t = runAct(t, { type: 'choose', option: pick });
    }
  }
  return t;
}

describe('가문 견본 (6.7.1)', () => {
  it('has the doc families with their fixed weapon, tower, 인망·운 and trait', () => {
    expect(FAMILY_IDS).toEqual(['vail', 'nea', 'odel', 'aren', 'isol']);
    expect(FAMILIES.vail).toMatchObject({ name: '바일', origin: 'starter', weapon: 'oneHandSword', tower: 'fire', trait: '외상은 반드시 갚는다.' });
    expect(FAMILIES.nea).toMatchObject({ weapon: 'bow', tower: 'wind', charisma: 'high', luck: 'low' });
    expect(FAMILIES.odel).toMatchObject({ weapon: 'greatsword', tower: 'earth', charisma: 'low', luck: 'high' });
    expect(FAMILIES.isol.origin).toBe('season');
    for (const id of FAMILY_IDS) {
      const f = FAMILIES[id];
      expect(f.stories.map((st) => st.bond)).toEqual([...STORY_BONDS]);
      for (const st of f.stories) for (const line of st.lines) expect(line.length).toBeLessThanOrEqual(60);
      expect(f.emoji.length).toBeGreaterThan(0);
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/);
      // 고유 카드: 레벨 1~5, 판 전용 카드
      for (let lv = 1; lv <= 5; lv++) {
        const card = familyCardId(id, lv);
        expect(CARDS[card]).toMatchObject({ name: f.uniqueCardName, group: 'family' });
        expect(familyCardInfo(card)).toEqual({ family: id, level: lv });
      }
    }
  });
});

describe('동료와 유대 (13.9)', () => {
  it('opens a 사연 at 유대 1, 3 and 5, each once', () => {
    let s = startRun(arenSetup({}, LONG));
    s = bondTo(s, 1, 5);
    expect(s.companions[1]).toMatchObject({ family: 'vail', bond: 5, stories: [1, 3, 5] });
    expect(actionBlock(s.phase === 'turn' ? s : { ...s, phase: 'turn' }, { type: 'bond', companion: 1 })).toBe('유대가 이미 가득하다');
  });

  it('유대 5 puts the family card in this run deck at the companion 성급 level', () => {
    const s = bondTo(startRun(arenSetup({}, LONG)), 0, 5);
    expect(s.deck).toContain(familyCardId('nea', 3));
    expect(s.deck).toContain('edgeHone2'); // the hero's own card at 2성
  });

  it('보너스 단계 = 동료 성급 (1·2성 1단계, 3·4성 2단계, 5성 3단계)', () => {
    const s = startRun(arenSetup({ companions: [{ family: 'vail', star: 1 }, { family: 'odel', star: 4 }, { family: 'nea', star: 5 }] }, LONG));
    const [vail, odel, nea] = s.companions;
    if (vail === undefined || odel === undefined || nea === undefined) throw new Error('companions');
    expect(bonusEffects(s, vail, 'goldGift').effects).toEqual([{ kind: 'gold', amount: 50 }]);
    expect(bonusEffects(s, odel, 'materialGift').effects).toEqual([{ kind: 'material', key: 'shell:low', count: 2 }]);
    expect(bonusEffects(s, nea, 'escort').effects).toEqual([{ kind: 'escort', party: 0.3 }]);
    expect(bonusEffects(s, odel, 'training').effects).toEqual([{ kind: 'training', floors: 10 }]);
    expect(bonusEffects(s, nea, 'cardUpgrade').effects).toEqual([{ kind: 'pickEvolve', count: 2 }]);
    expect(bonusEffects({ ...s, record: 31 }, odel, 'materialGift').effects).toEqual([{ kind: 'material', key: 'shell:high', count: 2 }]);
  });

  it('카드 강화 asks which card and branch, then evolves one copy', () => {
    let s = startRun(arenSetup({ companions: [{ family: 'aren', star: 5 }], hero: { family: 'vail', star: 1 } }, LONG));
    s = bondTo(s, 0, 2);
    s = runAct({ ...s, hp: 0.2 }, { type: 'bond', companion: 0 });
    expect(s.pending[0]).toMatchObject({ kind: 'story', title: '아렌 · 쓰지 않는 칼' });
    s = runAct(s, { type: 'choose', option: 0 });
    // 5성 → 3단계: 2장. The first evolution choice, then the second.
    expect(s.pending[0]?.kind).toBe('evolve');
    const first = s.pending[0]?.options.findIndex((o) => o.label === '두드리기 → 묵직한 두드리기') ?? -1;
    expect(first).toBeGreaterThanOrEqual(0);
    const hammers = s.deck.filter((c) => c === 'hammer').length;
    s = runAct(s, { type: 'choose', option: first });
    expect(s.deck.filter((c) => c === 'hammer').length).toBe(hammers - 1);
    expect(s.deck).toContain('heavyHammer');
    expect(s.pending[0]?.kind).toBe('evolve');
    s = runAct(s, { type: 'choose', option: 0 });
    expect(s.phase).toBe('turn');
  });

  it('특별 수련 raises 판 누적 층, 동행 원정 lifts the next 원정 only', () => {
    const s = startRun(arenSetup({}, LONG));
    const odel = startRun(arenSetup({ companions: [{ family: 'odel', star: 1 }] }, LONG));
    let t = bondTo(odel, 0, 3);
    expect(t.cumulativeFloors).toBe(5); // 유대 3: 특별 수련 1단계
    t = bondTo(s, 0, 3); // 네아 유대 3: 동행 원정 2단계
    expect(t.escort).toBeCloseTo(0.2);
    const after = runAct(t, { type: 'expedition', policy: 'normal' });
    expect(after.turnLog[after.turnLog.length - 1]?.expedition?.escort).toBeCloseTo(0.2);
    expect(after.escort).toBe(0);
  });

  it('the season family can be borrowed at 1성; a family cannot fill two slots', () => {
    expect(setupProblems(normalizeSetup(arenSetup()))).toEqual([]);
    expect(setupProblems(normalizeSetup(arenSetup({ companions: [{ family: 'isol', star: 1 }, { family: 'isol', star: 1 }] })))).toContain(
      '이솔: 같은 가문은 한 칸에만',
    );
    expect(
      setupProblems(normalizeSetup(arenSetup({ companions: ['vail', 'nea', 'odel', 'isol'].map((f) => ({ family: f as 'vail', star: 1 as const })) }))),
    ).toContain('동료는 3명까지');
  });
});

describe('선대 계승 (13.10)', () => {
  it('starts with the main ancestor weapon reforged to 1구간 철: quality kept, one enchant, the name in the new type', () => {
    const anc = sampleAncestor({ family: 'vail', weapon: { ...sampleAncestor().weapon, type: 'oneHandSword' }, weaponName: '재의 악마의 탑 60층을 연 한손검' });
    const s = startRun(arenSetup({ ancestors: [anc], mainAncestor: 0, weaponKeep: { kind: 'element' } }));
    // 13.10: 이름과 전적은 이어진다; the type word follows the reforged weapon (한손검 → 단검).
    expect(s.weapon).toMatchObject({ origin: 'ancestor', name: '재의 악마의 탑 60층을 연 단검', durability: 1 });
    expect(s.weapon.weapon).toMatchObject({ type: 'dagger', materialTier: 1, quality: 3, element: 'wind', enchants: [], unique: null });
    const kept = startRun(arenSetup({ ancestors: [anc], mainAncestor: 0, weaponKeep: { kind: 'enchant', enchant: 'pursuit' } }));
    expect(kept.weapon.weapon).toMatchObject({ element: null, enchants: ['pursuit'] });
    expect(setupProblems(normalizeSetup(arenSetup({ ancestors: [anc], mainAncestor: 0, weaponKeep: { kind: 'enchant', enchant: 'gale' } })))).toContain(
      '선대 무기에 없는 인챈트',
    );
    expect(startRun(arenSetup({}, LONG)).weapon.origin).toBe('basic');
  });

  it('takes factors up to the 계승 칸; the same family raises them one step (최대 3)', () => {
    const same = sampleAncestor(); // 아렌, like the hero
    const other = sampleAncestor({ id: 'L-2', family: 'odel', factors: [factor('hunter', 3, { body: 'armored' }), factor('charisma', 1)] });
    const setup = normalizeSetup(
      arenSetup({
        ancestors: [same, other],
        factorPicks: [
          { ancestor: 0, index: 0 },
          { ancestor: 1, index: 0 },
        ],
      }),
    );
    expect(setupProblems(setup)).toEqual([]);
    expect(pickedFactors(setup)).toEqual([factor('strength', 3), factor('hunter', 3, { body: 'armored' })]);
    const s = startRun(setup);
    expect(runStartPower(2, s.factors)).toBeCloseTo(1.15);
    expect(runPower(2, 30, s.factors)).toBeCloseTo(2.55); // 상한은 그대로
  });

  it('숙련 인자 adds to the mastery floor; 카드 인자 adds its card (2단계부터 진화형)', () => {
    const anc = sampleAncestor();
    const s = startRun(
      arenSetup({
        hero: { family: 'aren', star: 3 },
        ancestors: [anc],
        factorPicks: [
          { ancestor: 0, index: 1 },
          { ancestor: 0, index: 2 },
        ],
      }),
    );
    // 같은 가문: 숙련 2 → 3단계 (+10층), 카드 2 → 3단계 (진화형)
    expect(masteryFloor(s)).toBe(10);
    expect(s.deck.filter((c) => c === 'quickPolish')).toHaveLength(1);
    const lv1 = startRun(
      arenSetup({
        ancestors: [sampleAncestor({ family: 'nea', factors: [factor('card', 1, { card: 'polish', evolved: 'quickPolish' })] })],
        factorPicks: [{ ancestor: 0, index: 0 }],
      }),
    );
    expect(lv1.deck.filter((c) => c === 'polish')).toHaveLength(4);
  });
});
