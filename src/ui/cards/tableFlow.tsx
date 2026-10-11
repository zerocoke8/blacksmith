// What both craft tables share (the plain one and the art one): how a tap becomes a play
// (다시 피는 불's picks, 간직 at a card that ends the turn, the "쇠가 갈라진다" question), the
// 다시 달구기 button, and every sheet. The engine decides; these only ask and forward
// (CLAUDE.md 규칙 2).

import { useState } from 'react';
import {
  type CardCraftState,
  cardCostSteps,
  cardKeywordHelp,
  cardName,
  checkPlay,
  drawPileSummary,
  type HandCardView,
  handView,
  type PlayOptions,
  type PlayPreview,
  playNeeds,
  previewPlay,
  reheatInfo,
  temperNeed,
} from '../../sim/cards/index.ts';
import type { CardId } from '../../sim/data/cards.ts';
import { UNIQUES } from '../../sim/data/uniques.ts';
import { GameCard } from './GameCard.tsx';
import { Sheet } from './parts.tsx';
import { grouped } from './Prep.tsx';
import type { CardProfile } from './store.ts';
import { logLine, RULE_LINES, signed } from './text.ts';

export type SheetState =
  | { kind: 'info'; uid: string }
  | { kind: 'break'; uid: string; opts: PlayOptions }
  | { kind: 'recall'; uid: string }
  /** uid null: the 턴 끝 button; else a card that ends the turn (깊은 담금질). */
  | { kind: 'keep'; uid: string | null }
  | { kind: 'reheatBreak' }
  | { kind: 'piles' }
  | { kind: 'log' }
  | { kind: 'rules' }
  | { kind: 'quit' }
  /** Art table only: its menu and the fire badge. */
  | { kind: 'menu' }
  | { kind: 'fire' };

export function safePreview(state: CardCraftState, uid: string, opts: PlayOptions = {}): PlayPreview | null {
  try {
    return previewPlay(state, uid, opts);
  } catch {
    return null;
  }
}

export function previewParts(p: PlayPreview): string[] {
  const parts: string[] = [];
  if (p.progress !== 0) parts.push(`공정 ${signed(p.progress)}`);
  if (p.quality !== 0) parts.push(`품질 ${signed(p.quality)}`);
  if (p.heat !== 0) parts.push(`열기 ${signed(p.heat)}`);
  parts.push(`내구도 ${signed(p.durability)}`);
  return parts;
}

/**
 * The play flow. `commit` plays for real (each table animates its own way); the rest decides
 * whether a sheet must ask first.
 */
export function useTableFlow(args: {
  craft: CardCraftState;
  commit(uid: string, opts: PlayOptions): void;
  onEndTurn(keep: string[]): void;
  onInfoOpen(): void;
}) {
  const { craft, commit, onEndTurn, onInfoOpen } = args;
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const info = reheatInfo(craft);
  const active = craft.status === 'active';

  const tryPlay = (v: HandCardView) => {
    const needs = playNeeds(craft, v.uid);
    if (needs.targets > 0) {
      setSheet({ kind: 'recall', uid: v.uid });
      return;
    }
    if (needs.endsTurn && info.keep > 0 && craft.hand.some((u) => u !== v.uid && !info.retained.includes(u))) {
      setSheet({ kind: 'keep', uid: v.uid });
      return;
    }
    if (v.breaks) {
      setSheet({ kind: 'break', uid: v.uid, opts: {} });
      return;
    }
    commit(v.uid, {});
  };

  const openInfo = (uid: string) => {
    setSheet({ kind: 'info', uid });
    onInfoOpen();
  };

  const endTurnTap = () => {
    if (!active) return;
    if (info.keep > 0 && craft.hand.some((u) => !info.retained.includes(u))) {
      setSheet({ kind: 'keep', uid: null });
      return;
    }
    if (info.breaks) {
      setSheet({ kind: 'reheatBreak' });
      return;
    }
    onEndTurn([]);
  };

  return { sheet, setSheet, tryPlay, openInfo, endTurnTap, info };
}

/** Every sheet both tables use. The art table's own (menu, fire) are drawn by it. */
export function TableSheets(props: {
  sheet: SheetState | null;
  setSheet(s: SheetState | null): void;
  craft: CardCraftState;
  profile: CardProfile;
  inRun?: boolean;
  bossMaterialName?: string;
  commit(uid: string, opts: PlayOptions): void;
  tryPlay(v: HandCardView): void;
  onEndTurn(keep: string[]): void;
  onAbandon(): void;
}) {
  const { sheet, setSheet, craft, profile, inRun, commit, tryPlay, onEndTurn, onAbandon } = props;
  const r = craft.recipe;
  const close = () => setSheet(null);
  if (sheet === null) return null;
  switch (sheet.kind) {
    case 'info':
      return (
        <InfoSheet
          craft={craft}
          profile={profile}
          uid={sheet.uid}
          showTemper={inRun !== true}
          onClose={close}
          onPlay={(v) => {
            setSheet(null);
            tryPlay(v);
          }}
        />
      );
    case 'break':
      return (
        <Sheet title={cardName(craft.cards[sheet.uid] as CardId, r.materialTier)} tone="danger" onClose={close}>
          <p>이 카드로 내구도가 바닥난다. 공정을 채우기 전에 쇠가 갈라진다.</p>
          <p className="kc-hint">
            {r.bossMaterial !== null
              ? `재료도, ${props.bossMaterialName ?? UNIQUES[r.bossMaterial].material}도 돌아오지 않는다.`
              : '재료는 돌아오지 않는다.'}
          </p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                setSheet(null);
                commit(sheet.uid, sheet.opts);
              }}
            >
              그래도 친다
            </button>
            <button type="button" className="kc-btn" onClick={close}>
              손을 멈춘다
            </button>
          </div>
        </Sheet>
      );
    case 'recall':
      return (
        <RecallSheet
          craft={craft}
          uid={sheet.uid}
          onClose={close}
          onPlay={(targets) => {
            setSheet(null);
            commit(sheet.uid, { targets });
          }}
        />
      );
    case 'keep':
      return (
        <KeepSheet
          craft={craft}
          uid={sheet.uid}
          onClose={close}
          onDone={(keep) => {
            setSheet(null);
            if (sheet.uid === null) onEndTurn(keep);
            else commit(sheet.uid, { keep });
          }}
        />
      );
    case 'reheatBreak':
      return (
        <Sheet title="다시 달구기" tone="danger" onClose={close}>
          <p>이 쇠는 더 못 버틴다. 다시 달구면 갈라진다.</p>
          <StillPlayable craft={craft} />
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                setSheet(null);
                onEndTurn([]);
              }}
            >
              그래도 달군다
            </button>
            <button type="button" className="kc-btn" onClick={close}>
              손패를 다시 본다
            </button>
          </div>
        </Sheet>
      );
    case 'piles':
      return <PileSheet craft={craft} onClose={close} />;
    case 'log':
      return <LogSheet craft={craft} onClose={close} />;
    case 'rules':
      return (
        <Sheet title="카드 제작" onClose={close}>
          <ul className="kc-rules">
            {RULE_LINES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button type="button" className="kc-btn" onClick={close}>
            알겠다
          </button>
        </Sheet>
      );
    case 'quit':
      return (
        <Sheet title="망치를 내려놓는다" tone="danger" onClose={close}>
          <p>여기서 그만두면 실패다. 재료는 돌아오지 않는다.</p>
          <div className="kc-row">
            <button
              type="button"
              className="kc-btn danger"
              onClick={() => {
                setSheet(null);
                onAbandon();
              }}
            >
              그만둔다
            </button>
            <button type="button" className="kc-btn" onClick={close}>
              계속한다
            </button>
          </div>
        </Sheet>
      );
    default:
      return null;
  }
}

// ---------- Sheets ----------

/** Card width in the sheets' grids: three across a phone. */
const SHEET_CARD_W = 98;

function InfoSheet(props: {
  craft: CardCraftState;
  profile: CardProfile;
  uid: string;
  showTemper: boolean;
  onClose(): void;
  onPlay(v: HandCardView): void;
}) {
  const { craft, profile, uid, showTemper, onClose, onPlay } = props;
  const v = handView(craft).find((x) => x.uid === uid);
  if (v === undefined) return null;
  const p = v.block === null ? safePreview(craft, uid) : null;
  const costSteps = cardCostSteps(craft, uid).steps;
  const need = temperNeed(v.card);
  const temper = (profile.temper[v.card] ?? 0) + (craft.uses[v.card] ?? 0);
  return (
    <Sheet title={v.name} onClose={onClose}>
      <div className="kc-info-card">
        <GameCard
          id={v.card}
          tier={craft.recipe.materialTier}
          width={132}
          cost={v.cost}
          name={v.name}
          text={v.shortText}
          state={v.block !== null ? 'blocked' : v.finishes ? 'finish' : v.breaks ? 'breaks' : null}
        />
        <div className="kc-info-side">
          <div className="kc-info-head">
            <span className="kc-cost big">{v.cost}</span>
            <span>
              {v.kindLabel} 카드
              {costSteps.length > 0 && (
                <small>
                  {' '}
                  · 원래 코스트 {v.baseCost}, {costSteps.map((c) => `${c.label} ${signed(c.delta)}`).join(', ')}
                </small>
              )}
            </span>
          </div>
          <p className="kc-info-text">{v.text}</p>
        </div>
      </div>
      {cardKeywordHelp(v.card).map((k) => (
        <p key={k.label} className="kc-hint">
          <b>{k.label}</b> — {k.text}
        </p>
      ))}
      {v.block !== null && <p className="kc-why">지금은 못 낸다: {v.block}</p>}
      {p !== null && (
        <div className="kc-preview">
          <span>지금 내면</span>
          <b>{previewParts(p).join(' · ')}</b>
          {p.finishes && <em className="fin">{p.cost > craft.durability ? '막타 — 내구도가 모자라도 이 한 방으로 완성' : '이 한 방으로 완성'}</em>}
          {p.breaks && <em className="brk">내구도가 바닥나 쇠가 갈라진다</em>}
        </div>
      )}
      {showTemper && need !== null && (
        <p className="kc-hint">
          단련 {Math.min(temper, need)} / {need}
          {temper >= need && ' — 작업대에서 진화할 수 있다'}
        </p>
      )}
      <div className="kc-row">
        {v.block === null && craft.status === 'active' && (
          <button type="button" className="kc-btn primary" onClick={() => onPlay(v)}>
            낸다
          </button>
        )}
        <button type="button" className="kc-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}

function RecallSheet(props: { craft: CardCraftState; uid: string; onClose(): void; onPlay(targets: string[]): void }) {
  const { craft, uid, onClose, onPlay } = props;
  const [picked, setPicked] = useState<string[]>([]);
  const id = craft.cards[uid] as CardId;
  const max = playNeeds(craft, uid).targets;
  const check = (() => {
    try {
      return checkPlay(craft, uid, { targets: picked });
    } catch {
      return null;
    }
  })();
  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length < max ? [...p, u] : p));
  return (
    <Sheet title={cardName(id, craft.recipe.materialTier)} onClose={onClose}>
      <p className="kc-hint">버린 더미에서 {max}장까지 골라 손으로 가져온다.</p>
      <div className="kc-cardgrid">
        {craft.discard.map((u) => {
          const cid = craft.cards[u] as CardId;
          const on = picked.includes(u);
          return (
            <button key={u} type="button" className={on ? 'kc-cardpick on' : 'kc-cardpick'} aria-pressed={on} onClick={() => toggle(u)}>
              <GameCard id={cid} tier={craft.recipe.materialTier} width={SHEET_CARD_W} selected={on} />
            </button>
          );
        })}
      </div>
      {check !== null && check.ok && check.breaks && <p className="kc-why">이 카드로 내구도가 바닥나 쇠가 갈라진다.</p>}
      <div className="kc-row">
        <button
          type="button"
          className={check !== null && check.ok && check.breaks ? 'kc-btn danger' : 'kc-btn primary'}
          disabled={check === null || !check.ok}
          onClick={() => onPlay(picked)}
        >
          {picked.length}장 가져온다
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          그만둔다
        </button>
      </div>
    </Sheet>
  );
}

function KeepSheet(props: { craft: CardCraftState; uid: string | null; onClose(): void; onDone(keep: string[]): void }) {
  const { craft, uid, onClose, onDone } = props;
  const info = reheatInfo(craft);
  const [keep, setKeep] = useState<string[]>([]);
  const choices = craft.hand.filter((u) => u !== uid && !info.retained.includes(u));
  const breaks =
    uid === null
      ? info.breaks
      : (() => {
          try {
            const c = checkPlay(craft, uid, { keep });
            return c.ok && c.breaks;
          } catch {
            return false;
          }
        })();
  const toggle = (u: string) => setKeep((k) => (k.includes(u) ? k.filter((x) => x !== u) : k.length < info.keep ? [...k, u] : k));
  return (
    <Sheet title="다시 달구기" tone={breaks ? 'danger' : undefined} onClose={onClose}>
      <p className="kc-hint">
        화로가 {info.keep}장까지 손에 남겨 준다. 나머지는 버린 더미로 간다. 내구도 {signed(info.durability)}.
      </p>
      {info.retained.length > 0 && (
        <p className="kc-hint">
          간직: {info.retained.map((u) => cardName(craft.cards[u] as CardId, craft.recipe.materialTier)).join(', ')} — 저절로 남는다.
        </p>
      )}
      <div className="kc-cardgrid">
        {choices.map((u) => {
          const on = keep.includes(u);
          return (
            <button key={u} type="button" className={on ? 'kc-cardpick on' : 'kc-cardpick'} aria-pressed={on} onClick={() => toggle(u)}>
              <GameCard id={craft.cards[u] as CardId} tier={craft.recipe.materialTier} width={SHEET_CARD_W} selected={on} />
            </button>
          );
        })}
      </div>
      {breaks && <p className="kc-why">이 쇠는 더 못 버틴다. 다시 달구면 갈라진다.</p>}
      {breaks && uid === null && <StillPlayable craft={craft} />}
      <div className="kc-row">
        <button type="button" className={breaks ? 'kc-btn danger' : 'kc-btn primary'} onClick={() => onDone(keep)}>
          {breaks ? '그래도 달군다' : keep.length > 0 ? `${keep.length}장 남기고 달군다` : '모두 버리고 달군다'}
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          손패를 다시 본다
        </button>
      </div>
    </Sheet>
  );
}

/** Before a 다시 달구기 that breaks the iron: the cards that can still go (a 담금질, a finishing blow). */
function StillPlayable({ craft }: { craft: CardCraftState }) {
  const names = handView(craft)
    .filter((v) => v.block === null && !v.breaks)
    .map((v) => v.name);
  if (names.length === 0) return null;
  return <p className="kc-hint">아직 낼 수 있는 카드: {names.join(', ')}</p>;
}

function PileSheet({ craft, onClose }: { craft: CardCraftState; onClose(): void }) {
  const tier = craft.recipe.materialTier;
  const ids = (uids: readonly string[]) => uids.map((u) => craft.cards[u] as CardId);
  const sections: { title: string; note?: string; list: { id: CardId; count: number }[]; size: number }[] = [
    {
      title: '뽑을 더미',
      note: '순서는 모른다',
      list: drawPileSummary(craft).map((x) => ({ id: x.card, count: x.count })),
      size: craft.drawPile.length,
    },
    { title: '버린 더미', note: '뽑을 더미가 비면 섞여 돌아온다', list: grouped(ids(craft.discard)), size: craft.discard.length },
    { title: '소멸', note: '이번 제작에서 빠졌다', list: grouped(ids(craft.exhausted)), size: craft.exhausted.length },
  ];
  return (
    <Sheet title="남은 카드" onClose={onClose}>
      {sections.map((s) => (
        <section key={s.title} className="kc-pile-sec">
          <h4>
            {s.title} <b>{s.size}장</b> {s.note !== undefined && <small>{s.note}</small>}
          </h4>
          {s.list.length === 0 ? (
            <p className="kc-hint">비었다.</p>
          ) : (
            <div className="kc-cardgrid">
              {s.list.map(({ id, count }) => (
                <GameCard key={id} id={id} tier={tier} count={count} width={SHEET_CARD_W} />
              ))}
            </div>
          )}
        </section>
      ))}
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}

function LogSheet({ craft, onClose }: { craft: CardCraftState; onClose(): void }) {
  const lines = craft.log
    .map((e, i) => ({ i, turn: e.kind === 'turn', text: logLine(craft, e) }))
    .filter((l): l is { i: number; turn: boolean; text: string } => l.text !== null)
    .reverse();
  return (
    <Sheet title="턴 기록" onClose={onClose}>
      <ol className="kc-fulllog">
        {lines.map((l) => (
          <li key={l.i} className={l.turn ? 'turn' : undefined}>
            {l.text}
          </li>
        ))}
      </ol>
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
