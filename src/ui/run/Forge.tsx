// 단조 (13.8, 13.17): the card craft runs on the same table as the card prototype (src/ui/cards/
// Table.tsx), fed by the run's 단조 state. Then the 완성 화면: slots and the element filled from the
// run's materials, the new weapon set against the one in hand at the next wall, and 무기 들기.

import { useMemo, useState } from 'react';
import {
  type CardCraftOutcome,
  type CardCraftState,
  cardCraftOutcome,
  enchantMaterialLabel,
  type EnchantMaterialKey,
  type MaterialInventory,
  type PlayOptions,
  type SlotPick,
  slotBlock,
  slotMaterial,
  weaponFreeSlots,
  weaponSlotCount,
} from '../../sim/cards/index.ts';
import { ELEMENTS, ENCHANT_IDS, type EnchantId, type Weapon } from '../../sim/core/types.ts';
import { ELEMENT_LABEL, MASTERY_SKILLED_FLOOR, QUALITY } from '../../sim/data/common.ts';
import { CARD_RECIPE_GRADE_LABEL } from '../../sim/data/cards.ts';
import { ENCHANTS } from '../../sim/data/enchants.ts';

import { FINAL_CLIMB_START, SEASONS } from '../../sim/data/run.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import {
  applyPicks,
  CLIMB_PREVIEW_FLOORS,
  climbOdds,
  enchantPrice,
  floorOdds,
  isShopMaterial,
  masteryFloor,
  nextWall,
  picksBlock,
  type RunState,
  type ShopItem,
  subj,
  topic,
  weaponView,
} from '../../sim/run/index.ts';
import type { CardProfile, CardSession } from '../cards/store.ts';
import { defaultProfile } from '../cards/store.ts';
import { Table } from '../cards/Table.tsx';
import { outcomeLines, stars, tierName } from '../cards/text.ts';
import { beatingElement, floorFit } from './look.ts';
import { weaponBody, WeaponCard } from './parts.tsx';
import { goldText, pct } from './text.ts';

// ---------- The anvil ----------

/** The card table reads a card-prototype session; a run's forge is shown through one. */
function sessionFor(craft: CardCraftState, tapToPreview: boolean): CardSession {
  return {
    version: 1,
    id: `run-forge-${craft.setup.craftNo}`,
    craft,
    weapon: null,
    inventory: {},
    fameStage: 1,
    tapToPreview,
    startedAtMs: 0,
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
}

export function ForgeTable(props: {
  craft: CardCraftState;
  tapToPreview: boolean;
  /** The dwarf's first-craft line has been shown in a run before. */
  firstSeen: boolean;
  seen: readonly string[];
  onPlay(uid: string, opts: PlayOptions): void;
  onEndTurn(keep: string[]): void;
  onAbandon(): void;
  onPileOpen(): void;
  onInfoOpen(): void;
  onSeen(line: string): void;
  onFinished(): void;
  /** The season's boss material (13.2.1), named in the table's warnings instead of the card prototype's. */
  bossMaterialName: string;
}) {
  const { craft, tapToPreview, firstSeen, seen } = props;
  const session = useMemo(() => sessionFor(craft, tapToPreview), [craft, tapToPreview]);
  // Only read when the table mounts (the first-craft line, lines already shown).
  const profile = useMemo<CardProfile>(() => ({ ...defaultProfile(), firstCraftDone: firstSeen, seen: [...seen] }), []);
  return (
    <Table
      session={session}
      profile={profile}
      onPlay={props.onPlay}
      onEndTurn={props.onEndTurn}
      onAbandon={props.onAbandon}
      onPileOpen={props.onPileOpen}
      onInfoOpen={props.onInfoOpen}
      onSeen={props.onSeen}
      onFinished={props.onFinished}
      inRun
      bossMaterialName={props.bossMaterialName}
    />
  );
}

// ---------- Slots ----------

/** One thing that can go into a slot, with what it would do at the next wall. */
interface SlotOption {
  key: string;
  pick: SlotPick;
  label: string;
  material: EnchantMaterialKey;
  stock: number;
  /** It would go in, but there is no material for it (the shop may sell it). */
  missing: boolean;
  /** 돌파 확률 at the wall with this put in. */
  chance: number | null;
  locked: boolean;
}

function slotOptions(s: RunState, weapon: Weapon, inventory: MaterialInventory, wallFloor: number | null, maintain: boolean): SlotOption[] {
  const out: SlotOption[] = [];
  const novice = masteryFloor(s) < MASTERY_SKILLED_FLOOR;
  const add = (pick: SlotPick, label: string, locked: boolean) => {
    const material = slotMaterial(pick);
    if (material === null) return;
    const stock = inventory[material] ?? 0;
    // Only what fits this weapon is offered; a missing material is shown with a way to buy it.
    if (slotBlock(weapon, pick, { ...inventory, [material]: Math.max(1, stock) }) !== null) return;
    const missing = stock <= 0;
    let chance: number | null = null;
    if (wallFloor !== null) {
      const filled = applyPicks(weapon, [pick], { ...inventory, [material]: Math.max(1, stock) }).weapon;
      chance = floorOdds(s, wallFloor, { weapon: filled, maintain }).chance;
    }
    out.push({ key: label, pick, label, material, stock, missing, chance, locked });
  };
  if (weapon.type === 'staff' && weapon.element === null) {
    for (const e of ELEMENTS) add({ kind: 'staffElement', element: e }, `속성 칸 · ${ELEMENT_LABEL[e]}`, false);
  }
  for (const id of ENCHANT_IDS) {
    const spec = ENCHANTS[id];
    if (weapon.type === 'staff' && id === 'element') continue;
    if (spec.family === 'crystal') {
      for (const e of ELEMENTS) add({ kind: 'enchant', enchant: id, element: e }, `${spec.name} · ${ELEMENT_LABEL[e]}`, false);
    } else {
      add({ kind: 'enchant', enchant: id, element: null }, spec.name, spec.upper && novice);
    }
  }
  return out;
}

/**
 * 인챈트 슬롯 채우기 (4.3, 13.8 완성 화면; 정비의 빈 슬롯 채우기). Picks are collected here and
 * handed to the engine together; each shows the next wall's 돌파 확률 with it in.
 */
export function SlotPicker(props: {
  run: RunState;
  /** The weapon with the picks so far. */
  weapon: Weapon;
  inventory: MaterialInventory;
  picks: readonly SlotPick[];
  onPick(pick: SlotPick): void;
  onUndo(): void;
  onBuy(item: ShopItem): void;
  /** Judge the wall with the 정비 버프 (the 정비 sheet). */
  maintain?: boolean;
}) {
  const { run, weapon, inventory, picks, onPick, onUndo, onBuy } = props;
  const maintain = props.maintain ?? run.maintainBuff;
  const [open, setOpen] = useState<EnchantId | 'staff' | null>(null);
  const wall = nextWall(run);
  const wallFloor = wall?.floor ?? null;
  const options = slotOptions(run, weapon, inventory, wallFloor, maintain);
  const now = wallFloor === null ? null : floorOdds(run, wallFloor, { weapon, maintain }).chance;
  const total = weaponSlotCount(weapon);
  const free = weaponFreeSlots(weapon);
  const staffOpen = weapon.type === 'staff' && weapon.element === null;
  const price = enchantPrice(run);
  const hint = wallFloor === null ? null : beatingElement(run, wallFloor);
  const groups = new Map<EnchantId | 'staff', SlotOption[]>();
  for (const o of options) {
    const k = o.pick.kind === 'staffElement' ? 'staff' : o.pick.enchant;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const filled: string[] = [];
  if (weapon.type !== 'staff' && weapon.element !== null) filled.push(`속성 부여 (${ELEMENT_LABEL[weapon.element]})`);
  for (const e of weapon.enchants) filled.push(ENCHANTS[e].name);

  return (
    <section className="kc-panel rn-slotpick">
      <h3>
        인챈트 슬롯 <small>{total === 0 && !staffOpen ? '없음' : free > 0 || staffOpen ? `빈 칸 ${free}${staffOpen ? ' + 속성 칸' : ''}` : '다 찼다'}</small>
      </h3>
      <div className="kc-slots">
        {weapon.type === 'staff' && (
          <div className={weapon.element !== null ? 'kc-slot filled' : 'kc-slot'}>
            <small>속성 칸</small>
            {weapon.element !== null ? ELEMENT_LABEL[weapon.element] : '비어 있음'}
          </div>
        )}
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={filled[i] !== undefined ? 'kc-slot filled' : 'kc-slot'}>
            {filled[i] ?? '빈 슬롯'}
          </div>
        ))}
      </div>
      {total === 0 && !staffOpen && <p className="kc-hint">범작에는 인챈트 슬롯이 없다.</p>}
      {wall !== null && now !== null && (
        <p className="kc-hint">
          다음 벽 {wall.floor}층: 이 무기로 {pct(now)}{maintain ? ' (정비 버프 포함)' : ''}. 그 구간을 이기는 속성은 {hint !== null ? ELEMENT_LABEL[hint] : '-'}.
        </p>
      )}
      {picks.length > 0 && (
        <button type="button" className="kc-btn ghost small" onClick={onUndo}>
          넣은 것 되돌리기 ({picks.length})
        </button>
      )}
      {(free > 0 || staffOpen) && groups.size > 0 && (
        <>
          <p className="kc-hint">재료 하나에 인챈트 하나. 든 뒤에는 바꿀 수 없다. 비운 칸은 정비 때 채운다.</p>
          <div className="kc-pick-grid three">
            {[...groups.entries()].map(([k, list]) => {
              const first = list[0] as SlotOption;
              const best = Math.max(...list.map((o) => o.chance ?? 0));
              const name = k === 'staff' ? '속성 칸' : ENCHANTS[k].name;
              const any = list.some((o) => !o.missing);
              return (
                <button
                  key={k}
                  type="button"
                  className={`kc-pick${open === k ? ' on' : ''}${k !== 'staff' && ENCHANTS[k].upper ? ' upper' : ''}`}
                  onClick={() => setOpen(open === k ? null : k)}
                >
                  <b>{name}</b>
                  <small>
                    {list.length > 1 ? '원소 결정' : `${enchantMaterialLabel(first.material)} ${first.stock}`}
                    {!any && ' · 없음'}
                  </small>
                  {now !== null && <small className={best > now + 0.005 ? 'rn-up' : 'rn-flat'}>→ {pct(best)}</small>}
                </button>
              );
            })}
          </div>
          {open !== null && (
            <div className="kc-pick-detail">
              {open !== 'staff' && <p>{ENCHANTS[open].flavor}</p>}
              {(groups.get(open) ?? []).map((o) => {
                const buyable = o.missing && isShopMaterial(o.material);
                return (
                  <div key={o.key} className="rn-slot-row">
                    <span>
                      <b>{o.label}</b>
                      <small>
                        {enchantMaterialLabel(o.material)} {o.stock}개
                        {o.chance !== null && now !== null && ` · 다음 벽 ${pct(now)} → ${pct(o.chance)}`}
                        {o.locked && ' · 능숙(15층) 전에는 힘을 못 쓴다'}
                      </small>
                    </span>
                    {!o.missing ? (
                      <button
                        type="button"
                        className="kc-btn small primary"
                        onClick={() => {
                          onPick(o.pick);
                          setOpen(null);
                        }}
                      >
                        넣는다
                      </button>
                    ) : buyable ? (
                      <button type="button" className="kc-btn small" disabled={price > run.gold} onClick={() => onBuy({ kind: 'material', key: o.material })}>
                        사기 {goldText(price)}
                      </button>
                    ) : (
                      <small className="kc-muted">상점에 없다</small>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- 완성 화면 ----------

/**
 * The 완성 lines: the card table's own words for the ★ (cards/text.ts), and the 시즌 보스 재료 under its
 * season name ('원령의 등불'), not the card prototype's 4.6 material.
 */
function doneLines(s: RunState, outcome: CardCraftOutcome): string[] {
  const lines = outcomeLines({ ...outcome, boss: null });
  const boss = outcome.boss;
  if (boss === null) return lines;
  const name = SEASONS[s.setup.season].bossMaterial.name;
  if (boss.fate === 'used') lines.push(`${subj(name)} 쇠에 스며들었다. ${subj(UNIQUES[boss.unique].name)} 깃든다.`);
  else if (boss.fate === 'returned') lines.push(`${topic(name)} 다음을 위해 남겨 둔다.`);
  else lines.push(`${name}도 함께 재가 되었다.`);
  return lines;
}

function quickOutcome(s: RunState): CardCraftOutcome | null {
  const f = s.forge;
  const w = f?.weapon;
  if (f === null || f === undefined || w === null || w === undefined) return null;
  const unique = SEASONS[s.setup.season].bossMaterial.unique;
  return {
    status: 'success',
    success: true,
    abandoned: false,
    qualityRatio: QUALITY[w.quality].threshold,
    tier: w.quality,
    slots: QUALITY[w.quality].slots,
    boss: f.legendary && f.bossMaterial !== null ? { unique, fate: f.bossMaterial } : null,
    turns: 0,
    cardsPlayed: 0,
    discarded: 0,
  };
}

export function ForgeDone(props: { run: RunState; onBuy(item: ShopItem): void; onFinish(picks: SlotPick[], hang: boolean): void }) {
  const { run, onBuy, onFinish } = props;
  const [picks, setPicks] = useState<SlotPick[]>([]);
  const f = run.forge;
  const weapon = f?.weapon;
  if (f === null || weapon === null || weapon === undefined) return null;
  const outcome = f.craft !== null ? cardCraftOutcome(f.craft) : quickOutcome(run);
  // A pick that no longer fits (it cannot happen by buying) is dropped rather than sent.
  const valid = picksBlock(weapon, picks, run.inventory) === null ? picks : [];
  const preview = applyPicks(weapon, valid, run.inventory);
  const held = weaponView(run);
  const fresh = weaponView(run, preview.weapon);
  const walls = run.walls.filter((w) => w.passedTurn === null).slice(0, 2);
  const tier = weapon.quality;
  // Is the new one weaker where it counts next (the next wall, or the 마지막 등반's first floors)?
  const next = walls[0];
  const heldNext = next !== undefined ? floorOdds(run, next.floor, { weapon: run.weapon.weapon }).chance : climbOdds(run);
  const freshNext = next !== undefined ? floorOdds(run, next.floor, { weapon: preview.weapon }).chance : climbOdds(run, preview.weapon);
  const weaker = freshNext + 0.005 < heldNext || (next === undefined && fresh.attack < held.attack && freshNext <= heldNext + 0.005);
  // Empty slots may still turn it around: only a weapon with nothing left to put in is called weaker.
  const canGrow = weaponFreeSlots(preview.weapon) > 0 || (preview.weapon.type === 'staff' && preview.weapon.element === null);
  const settledWeaker = weaker && !canGrow;

  return (
    <div className="rn-done">
      <div className="kc-result-head ok">
        <div className={`kc-result-stars kc-tier-${tier}`}>{stars(tier)}</div>
        <div className={tier === 5 ? 'kc-result-tier rn-master' : 'kc-result-tier'}>{tierName(tier)}</div>
        <div className="kc-result-title">
          {weaponBody({ ...weapon, element: null })} · {CARD_RECIPE_GRADE_LABEL[f.grade]}
          {f.craft === null && ' · 간이'}
        </div>
      </div>
      <div className="kc-lines">
        {outcome !== null && doneLines(run, outcome).map((l) => <p key={l}>{l}</p>)}
      </div>

      <section className="kc-panel">
        <h3>든 무기와 새 무기</h3>
        {walls.length === 0 && (
          <div className="rn-compare">
            <span>
              {FINAL_CLIMB_START}~{FINAL_CLIMB_START + CLIMB_PREVIEW_FLOORS - 1}층 평균 <small>마지막 등반의 첫 층들</small>
            </span>
            <span className={freshNext + 0.005 < heldNext ? 'rn-down' : freshNext > heldNext + 0.005 ? 'rn-up' : ''}>
              {pct(heldNext)} → <b>{pct(freshNext)}</b>
            </span>
          </div>
        )}
        {walls.map((w) => {
          const a = floorOdds(run, w.floor, { weapon: run.weapon.weapon });
          const b = floorOdds(run, w.floor, { weapon: preview.weapon });
          const fitA = floorFit(run, w.floor, run.weapon.weapon);
          const fitB = floorFit(run, w.floor, preview.weapon);
          return (
            <div key={w.floor} className="rn-compare">
              <span>
                {w.floor}층 {a.info.name} <small>{w.deadline}턴까지</small>
              </span>
              <span className={b.chance + 0.005 < a.chance ? 'rn-down' : b.chance > a.chance + 0.005 ? 'rn-up' : ''}>
                {pct(a.chance)} → <b>{pct(b.chance)}</b>
                <small>
                  {' '}
                  체형 {fitA.bodyMark}→{fitB.bodyMark} · 속성 {fitA.elementMark}→{fitB.elementMark}
                </small>
              </span>
            </div>
          );
        })}
        <p className="kc-hint">
          공격 {Math.round(held.attack)} (★{held.weapon.quality} {weaponBody(held.weapon)}) → <b>{Math.round(fresh.attack)}</b>
        </p>
      </section>

      <SlotPicker
        run={run}
        weapon={preview.weapon}
        inventory={preview.inventory}
        picks={valid}
        onPick={(p) => setPicks([...valid, p])}
        onUndo={() => setPicks([])}
        onBuy={onBuy}
      />

      <WeaponCard view={{ ...fresh, durability: 1, name: null, maintainBuff: false }} />
      {weaker && (
        <p className={settledWeaker ? 'kc-why' : 'kc-hint'}>
          {canGrow ? '아직은 ' : ''}새 무기가 {next !== undefined ? `${next.floor}층 벽에서` : '위층에서'} 들던 무기보다 약하다 ({pct(heldNext)} → {pct(freshNext)}).{' '}
          {canGrow ? '빈 슬롯을 채우면 달라질 수 있다.' : '걸이에 걸고 들던 무기를 계속 쓸 수 있다.'}
        </p>
      )}
      <p className="kc-hint center">판 골드 {goldText(run.gold)} · 무기 걸이에 건 무기는 다시 들지 않는다.</p>
      <button type="button" className={settledWeaker ? 'kc-btn big' : 'kc-btn primary big'} onClick={() => onFinish(valid, false)}>
        새 무기를 든다 <small>쓰던 무기는 걸이에</small>
      </button>
      <button type="button" className={settledWeaker ? 'kc-btn primary big' : 'kc-btn ghost'} onClick={() => onFinish([], true)}>
        걸이에 건다 <small>들던 무기를 계속 쓴다{valid.length > 0 ? ' · 넣은 재료는 돌아온다' : ''}</small>
      </button>
    </div>
  );
}

