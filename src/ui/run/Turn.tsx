// 턴 화면 (판의 홈, 13.17): 위에 다음 벽과 다섯 구간, 가운데에 용사·무기·주머니·동료·지난 턴, 아래 엄지
// 자리에 행동 5개. Every action opens a sheet with its preview first (13.17: 효과 미리보기); 상점, 덱,
// 탑 배치는 턴을 쓰지 않는다 (13.4). Numbers come from the engine's views (sim/run/view.ts).

import { type CSSProperties, useState } from 'react';
import type { SlotPick } from '../../sim/cards/index.ts';
import { BODY_LABEL, ELEMENT_LABEL, materialName, WEAPON_LABEL, WEAPON_SPEC } from '../../sim/data/common.ts';
import { CARD_RECIPE_GRADE_LABEL } from '../../sim/data/cards.ts';
import { FAMILIES } from '../../sim/data/families.ts';
import { ACTION_HP, EXPEDITION_POLICIES, type ExpeditionPolicy, POLICY_LABEL, POLICY_RETURN, SEASONS, STORY_BONDS } from '../../sim/data/run.ts';
import {
  ancestorLine,
  applyPicks,
  bonusEffects,
  deckEntries,
  type ExpeditionForecast,
  forecastExpedition,
  forgeOptions,
  type ForgePlan,
  inventoryEntries,
  obj,
  subj,
  picksBlock,
  type RunAction,
  type RunState,
  type RunTurnView,
  seasonLayout,
  type ShopItem,
  shopEntries,
  wallViews,
} from '../../sim/run/index.ts';
import { Sheet } from '../cards/parts.tsx';
import { DeckSheet } from './Deck.tsx';
import { SlotPicker } from './Forge.tsx';
import { floorFit, forgeLook, type ForgeLook, hardestFloor, PREVIEW_QUALITY, PREVIEW_TIERS } from './look.ts';
import { BandStrip, BondPips, ElementTag, FamilyFace, Meter, StarBadge, WeaponCard } from './parts.tsx';
import type { RunMeta } from './store.ts';
import {
  CHOICE_KIND_LABEL,
  FORECAST_END_LABEL,
  goldText,
  heroName,
  pct,
  SAME_FACE_LINE,
  turnActionLabel,
} from './text.ts';

type TurnSheet =
  | 'expedition'
  | 'wall'
  | 'climb'
  | 'forge'
  | 'maintain'
  | 'rest'
  | 'bond'
  | 'retire'
  | 'shop'
  | 'deck'
  | 'tower';

interface Props {
  run: RunState;
  meta: RunMeta;
  view: RunTurnView;
  onAct(action: RunAction): boolean;
}

export function Turn({ run, view, onAct }: Props) {
  const [sheet, setSheet] = useState<TurnSheet | null>(null);
  const hero = view.hero;
  const next = view.walls.find((w) => w.state === 'next') ?? null;
  const last = run.turnLog[run.turnLog.length - 1];
  const act = (a: RunAction) => {
    if (onAct(a)) setSheet(null);
  };
  const buy = (item: ShopItem, count = 1) => {
    onAct({ type: 'buy', item, count });
  };
  const mainMaterials = Object.entries(run.mainMaterials)
    .map(([t, n]) => ({ tier: Number(t), n }))
    .filter((m) => m.n > 0)
    .sort((a, b) => a.tier - b.tier);
  const season = SEASONS[run.setup.season];

  return (
    <div className="rn-turn">
      {view.warning !== null && (
        <p className="rn-warn" role="alert">
          {view.warning}
          {next !== null && <small> 지금 장비로 {pct(next.chance)} · 정비하면 {pct(next.chanceMaintained)}</small>}
        </p>
      )}

      <div className="rn-turnbar">
        <span className="rn-turn-no">
          <b>{view.turn}</b> / {view.turns}턴
        </span>
        <span className="rn-gold">{goldText(view.gold)}</span>
        <div className="rn-tools">
          <button type="button" className="kc-btn ghost small" onClick={() => setSheet('tower')}>
            탑
          </button>
          <button type="button" className="kc-btn ghost small" onClick={() => setSheet('deck')}>
            덱
          </button>
          <button type="button" className="kc-btn ghost small" onClick={() => setSheet('shop')}>
            상점
          </button>
        </div>
      </div>

      {next !== null ? (
        <button type="button" className="rn-wallcard" onClick={() => setSheet('tower')}>
          <span className="rn-wallcard-top">
            <b>다음 벽 {next.floor}층</b>
            <span className={next.turnsLeft <= 1 ? 'rn-left danger' : 'rn-left'}>
              {next.turnsLeft <= 0 ? '이번 턴' : `${next.turnsLeft}턴 남음`} · {next.deadline}턴 마감
            </span>
          </span>
          <span className="rn-wallcard-boss">
            {next.boss} · {BODY_LABEL[next.body]} <ElementTag element={next.element} />
            <small>
              {' '}
              체형 {floorFit(run, next.floor).bodyMark} · 속성 {floorFit(run, next.floor).elementMark}
            </small>
          </span>
          <span className="rn-wallcard-odds">
            지금 돌파 <b>{pct(next.chance)}</b> (R {next.r.toFixed(2)}) · 정비하면 {pct(next.chanceMaintained)}
          </span>
        </button>
      ) : (
        <div className="rn-wallcard done">
          <b>{obj(season.demon)} 넘었다.</b>
          <span>남은 턴은 위층에. 마지막 턴은 마지막 등반이다.</span>
        </div>
      )}
      <BandStrip bands={view.bands} walls={view.walls} record={run.record} />

      <section className="rn-hero" style={{ '--fam': FAMILIES[hero.family].color } as CSSProperties}>
        <FamilyFace family={hero.family} size="lg" />
        <div className="rn-hero-main">
          <p className="rn-hero-name">
            <b>{heroName(hero.family, run.setup.generation)}</b> <StarBadge star={hero.star} />
            {hero.injured && <span className="rn-badge bad">부상</span>}
            {hero.forcedRest && <span className="rn-badge bad">중상</span>}
          </p>
          <Meter
            value={hero.hp}
            cap={hero.injured ? hero.hpCap : undefined}
            tone="hp"
            label={
              <>
                HP {pct(hero.hp)}
                {hero.injured && <small> · 상한 {pct(hero.hpCap)}</small>}
              </>
            }
          />
          <p className="rn-hero-stats">
            <span>
              Lv <b>{hero.level}</b>
              {hero.floorsToNextLevel !== null && <small> (+{hero.floorsToNextLevel}층)</small>}
            </span>
            <span>
              힘 <b>{hero.power.toFixed(2)}</b>
              <small>/{hero.powerCap}</small>
            </span>
            <span>
              숙련 <b>{hero.masteryLabel}</b>
              <small> ({hero.masteryFloor}층)</small>
            </span>
            <span>최고 {run.record}층</span>
          </p>
        </div>
      </section>

      <WeaponCard view={view.weapon}>
        {run.rack.length > 0 && <p className="kc-hint">무기 걸이 {run.rack.length}자루</p>}
      </WeaponCard>

      <section className="rn-purse">
        {mainMaterials.map((m) => (
          <span key={m.tier} className="rn-chip">
            {materialName(m.tier)} {m.n}
          </span>
        ))}
        {run.bossMaterials > 0 && (
          <span className="rn-chip unique">
            {season.bossMaterial.name} {run.bossMaterials}
          </span>
        )}
        {inventoryEntries(run).map((e) => (
          <span key={e.key} className="rn-chip">
            {e.label} {e.count}
          </span>
        ))}
        {mainMaterials.length === 0 && run.bossMaterials === 0 && inventoryEntries(run).length === 0 && (
          <span className="kc-muted">주머니가 비었다.</span>
        )}
      </section>

      {view.companions.length > 0 && (
        <section className="rn-companions">
          {view.companions.map((c) => (
            <button key={c.index} type="button" className="rn-comp" onClick={() => setSheet('bond')} style={{ '--fam': c.color } as CSSProperties}>
              <FamilyFace family={c.family} size="sm" />
              <span>
                <b>{c.name}</b> <small>{c.star}성</small>
              </span>
              <BondPips bond={c.bond} stories={c.stories} />
            </button>
          ))}
        </section>
      )}

      <section className="rn-lastturn">
        {last === undefined ? (
          <>
            <p className="rn-lastturn-head">1턴 · 탑 앞</p>
            {run.setup.generation > 1 && <p className="rn-quote">{SAME_FACE_LINE}</p>}
            {ancestorLine(run) !== null && <p className="rn-quote">{ancestorLine(run)}</p>}
            <p className="rn-quote">{FAMILIES[run.setup.hero.family].greeting}</p>
          </>
        ) : (
          <>
            <p className="rn-lastturn-head">
              지난 턴 · {last.turn}턴 {turnActionLabel(last)}
              {last.forced && ' (고정)'}
            </p>
            {last.lines.map((l, i) => (
              <p key={i} className={l.startsWith('"') ? 'rn-quote' : undefined}>
                {l}
              </p>
            ))}
            {last.events.length > 0 && <p className="kc-hint">{last.events.map((e) => CHOICE_KIND_LABEL[e]).join(' · ')}</p>}
          </>
        )}
      </section>

      <ActionGrid run={run} view={view} onOpen={setSheet} />

      <div className="rn-retire-row">
        <button type="button" className="kc-btn ghost small" onClick={() => setSheet('retire')}>
          은퇴
        </button>
      </div>

      {sheet === 'expedition' && <ExpeditionSheet run={run} view={view} onClose={() => setSheet(null)} onGo={(policy) => act({ type: 'expedition', policy })} />}
      {sheet === 'wall' && <ForcedClimbSheet run={run} mode="wall" onClose={() => setSheet(null)} onGo={() => act({ type: 'wall' })} />}
      {sheet === 'climb' && <ForcedClimbSheet run={run} mode="climb" onClose={() => setSheet(null)} onGo={() => act({ type: 'climb' })} />}
      {sheet === 'forge' && (
        <ForgeSheet run={run} onClose={() => setSheet(null)} onGo={(plan) => act({ type: 'forge', materialTier: plan.materialTier, legendary: plan.legendary })} />
      )}
      {sheet === 'maintain' && (
        <MaintainSheet run={run} view={view} onClose={() => setSheet(null)} onBuy={(item) => buy(item)} onGo={(picks) => act({ type: 'maintain', picks })} />
      )}
      {sheet === 'rest' && <RestSheet run={run} view={view} onClose={() => setSheet(null)} onGo={() => act({ type: 'rest' })} />}
      {sheet === 'bond' && <BondSheet run={run} view={view} onClose={() => setSheet(null)} onGo={(companion) => act({ type: 'bond', companion })} />}
      {sheet === 'retire' && (
        <Sheet title="은퇴" tone="danger" onClose={() => setSheet(null)}>
          <p>
            여기서 판을 끝낸다. 지금까지의 기록({run.record}층)과 평가가 남고, 전설 용사 카드가 된다.
          </p>
          <div className="kc-row">
            <button type="button" className="kc-btn danger" onClick={() => act({ type: 'retire' })}>
              무기를 내려놓는다
            </button>
            <button type="button" className="kc-btn" onClick={() => setSheet(null)}>
              더 오른다
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'shop' && <ShopSheet run={run} onClose={() => setSheet(null)} onBuy={buy} />}
      {sheet === 'deck' && <DeckSheet entries={deckEntries(run)} onClose={() => setSheet(null)} />}
      {sheet === 'tower' && <TowerSheet run={run} onClose={() => setSheet(null)} />}
    </div>
  );
}

// ---------- 행동 버튼 ----------

function ActionGrid({ run, view, onOpen }: { run: RunState; view: RunTurnView; onOpen(s: TurnSheet): void }) {
  const forced = view.forced;
  const n = view.forecasts.normal;
  const plans = forgeOptions(run);
  const plan = plans.find((p) => p.block === null);
  const hpAfterRest = Math.min(1, run.hp + ACTION_HP.rest);
  const bondNext = view.companions.find((c) => c.nextStory !== null && c.nextStory === c.bond + 1);
  const preview: Record<string, string> = {
    // The wall figure is the chance this climb gets there and beats it (the wall card shows the boss alone).
    expedition: `약 ${n.expectedCleared.toFixed(1)}층${n.boss !== null && n.bossPass > 0 ? ` · 벽 넘을 확률 ${pct(n.bossPass)}` : ` · ${n.startFloor}층부터`}`,
    forge: plan !== undefined ? `${materialName(plan.materialTier)}${plan.legendary ? '+등불' : ''} ${goldText(plan.cost)}` : '',
    maintain: `${goldText(view.weapon.repairCost)} · 내구 ${pct(view.weapon.durability)}`,
    rest: `HP ${pct(run.hp)} → ${pct(hpAfterRest)}${run.injured ? ' · 부상 나음' : ''}`,
    bond: bondNext !== undefined ? `${bondNext.name}의 사연` : `HP +${pct(ACTION_HP.bond)} · 유대 +1`,
  };
  const forcedButton =
    forced === 'wall' ? { kind: 'wall' as const, label: '벽 도전', text: '귀환 기준 없이 벽 보스까지. 못 넘으면 은퇴' } : forced === 'climb' ? { kind: 'climb' as const, label: '마지막 등반', text: '51층부터 쓰러질 때까지' } : null;

  return (
    <div className="rn-actions">
      {forcedButton !== null && (
        <button type="button" className="rn-action forced" onClick={() => onOpen(forcedButton.kind)}>
          <b>{forcedButton.label}</b>
          <small>{forcedButton.text}</small>
        </button>
      )}
      {view.actions
        .filter((a) => a.action !== 'wall' && a.action !== 'climb')
        .map((a) => {
          const kind = a.action as TurnSheet;
          const isForcedRest = forced === 'rest' && a.action === 'rest';
          return (
            <button
              key={a.action}
              type="button"
              className={`rn-action${isForcedRest ? ' forced' : ''}`}
              disabled={a.block !== null}
              onClick={() => onOpen(kind)}
            >
              <b>{a.label}</b>
              <small>{a.block ?? preview[a.action] ?? a.hint}</small>
            </button>
          );
        })}
    </div>
  );
}

// ---------- Sheets ----------

function ForecastLine({ run, f }: { run: RunState; f: ExpeditionForecast }) {
  const hard = hardestFloor(run, f);
  const last = f.startFloor + Math.max(0, f.floors - 1);
  const boss = f.boss;
  return (
    <>
      <span>
        {f.floors > 0 ? `${f.startFloor}~${last}층까지` : '첫 층 앞에서 돌아선다'} · 넘을 층 기대 <b>{f.expectedCleared.toFixed(1)}</b>
      </span>
      {boss !== null && (
        <small className={f.bossPass > 0 ? 'rn-forecast-wall' : 'rn-why'}>
          {f.bossPass > 0
            ? `벽 ${boss.floor}층까지 가서 넘을 확률 ${pct(f.bossPass)} (보스만 ${pct(boss.chance)})`
            : `벽 ${boss.floor}층 앞에서 돌아선다 (보스 ${pct(boss.chance)})`}
        </small>
      )}
      <small>
        {FORECAST_END_LABEL[f.end]}
        {f.floors > 0 && ` · 돌아올 때 HP ${pct(f.hpEnd)} · 내구 ${pct(f.durabilityEnd)}`}
      </small>
      {f.floors > 0 && (
        <small>
          다쳐서 올 확률 {pct(f.hurt)}
          {hard !== null && ` · 가장 험한 층 ${hard.floor}층 ${pct(hard.chance)}`}
        </small>
      )}
    </>
  );
}

function policyNote(p: ExpeditionPolicy): string {
  const r = POLICY_RETURN[p];
  return `HP ${pct(r.hp)} 이하나 다음 층 돌파 ${pct(r.clearChance)} 미만이면 돌아선다`;
}

function ExpeditionSheet({ run, view, onClose, onGo }: { run: RunState; view: RunTurnView; onClose(): void; onGo(p: ExpeditionPolicy): void }) {
  return (
    <Sheet title="원정 방침" onClose={onClose}>
      <p className="kc-hint">
        HP {pct(run.hp)} · 내구도 {pct(run.weapon.durability)}
        {run.maintainBuff && ' · 정비 버프 ×1.2'}
        {run.escort > 0 && ` · 동행 +${run.escort}`}. 실패하면 부상이나 중상이다. 확률은 모든 층을 넘는다 치고, 오르며 붙는 레벨까지 셈한 것이다.
      </p>
      {EXPEDITION_POLICIES.map((p) => (
        <button key={p} type="button" className={p === 'normal' ? 'rn-plan main' : 'rn-plan'} onClick={() => onGo(p)}>
          <b>{POLICY_LABEL[p]}</b>
          <ForecastLine run={run} f={view.forecasts[p]} />
          <small className="kc-muted">{policyNote(p)}</small>
        </button>
      ))}
      <button type="button" className="kc-btn" onClick={onClose}>
        다시 생각한다
      </button>
    </Sheet>
  );
}

function ForcedClimbSheet({ run, mode, onClose, onGo }: { run: RunState; mode: 'wall' | 'climb'; onClose(): void; onGo(): void }) {
  const f = forecastExpedition(run, 'normal', mode);
  return (
    <Sheet title={mode === 'wall' ? '벽 도전' : '마지막 등반'} tone={mode === 'wall' ? 'danger' : undefined} onClose={onClose}>
      {mode === 'wall' ? (
        <p>귀환 기준을 모두 끄고 벽 보스까지 오른다. 한 층이라도 넘지 못하면, 거기까지다.</p>
      ) : (
        <p>51층에서 출발한다. 귀환 기준도, 층수 상한도 없다. 쓰러지거나 무기가 무뎌질 때까지.</p>
      )}
      <div className="rn-plan static">
        <ForecastLine run={run} f={f} />
      </div>
      <p className="kc-hint">
        HP {pct(run.hp)} · 내구도 {pct(run.weapon.durability)}
        {run.maintainBuff ? ' · 정비 버프 ×1.2' : ' · 정비 버프 없음'}
      </p>
      <div className="kc-row">
        <button type="button" className={mode === 'wall' ? 'kc-btn danger' : 'kc-btn primary'} onClick={onGo}>
          {mode === 'wall' ? '도전한다' : '오른다'}
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          잠깐
        </button>
      </div>
    </Sheet>
  );
}

function ForgeSheet({ run, onClose, onGo }: { run: RunState; onClose(): void; onGo(plan: ForgePlan): void }) {
  const [more, setMore] = useState(false);
  const plans = forgeOptions(run);
  const season = SEASONS[run.setup.season];
  const held = run.weapon.weapon.materialTier;
  // Recipes below the held weapon (and 전설 below the newest band) rarely help; they wait behind '더 보기'.
  const newest = Math.max(...plans.map((p) => p.materialTier));
  const main = plans.filter((p) => p.materialTier >= held && (!p.legendary || p.materialTier === newest));
  const rest = plans.filter((p) => !main.includes(p));
  const shown = more ? plans : main.length > 0 ? main : plans;
  return (
    <Sheet title="단조" onClose={onClose}>
      <p className="kc-hint">
        주재료 6개로 한 자루. 모자란 주재료는 시작할 때 상점에서 산다. 슬롯 재료와 원소 결정은 완성 화면에서 넣는다. 이 턴은 원정하지 못한다. HP +{pct(ACTION_HP.forge)}.
        {run.rules.quickForge && ' 단조 간이 모드: 카드 없이 품질이 바로 정해진다.'}
      </p>
      {shown.map((p) => (
        <button key={`${p.materialTier}-${p.legendary}`} type="button" className="rn-plan" disabled={p.block !== null} onClick={() => onGo(p)}>
          <b>
            {materialName(p.materialTier)} {WEAPON_LABEL[FAMILIES[run.setup.hero.family].weapon]}
            <span className={`kc-tag kc-grade-${p.grade}`}>{CARD_RECIPE_GRADE_LABEL[p.grade]}</span>
            {p.legendary && <span className="kc-tag kc-grade-legendary">{season.bossMaterial.name}</span>}
          </b>
          <span>
            {p.owned > 0 ? `가진 것 ${p.owned}개 + ` : ''}
            {p.toBuy > 0 ? `${p.toBuy}개 사기 ${goldText(p.cost)}` : '살 것 없음'} · 손패 {p.handSize}장
          </span>
          <ForgeLookLines look={forgeLook(run, p)} />
          {p.block !== null && <small className="rn-why">{p.block}</small>}
        </button>
      ))}
      {rest.length > 0 && main.length > 0 && (
        <button type="button" className="kc-btn ghost small" onClick={() => setMore(!more)}>
          {more ? '접기' : `낮은 주재료도 보기 (${rest.length})`}
        </button>
      )}
      <button type="button" className="kc-btn" onClick={onClose}>
        다시 생각한다
      </button>
    </Sheet>
  );
}

/** What a recipe would do: ★3 무속성, then the beating element at ★3 / ★4 / ★5, against the next wall or the 마지막 등반. */
function ForgeLookLines({ look }: { look: ForgeLook }) {
  const where = look.target.kind === 'wall' ? `${look.target.floor}층 벽` : `${look.target.first}~${look.target.last}층 평균`;
  const tiers = PREVIEW_TIERS.map((q) => pct(look.matched[q])).join(' / ');
  return (
    <>
      <small>
        {where}: 지금 {pct(look.now)} · ★{PREVIEW_QUALITY} 무속성 {pct(look.plain)} · {ELEMENT_LABEL[look.element]}속성 ★{PREVIEW_TIERS.join('/★')} {tiers}
      </small>
      {look.unique !== null && (
        <small className="rn-forecast-wall">
          ★5 걸작이면 {look.unique.name}{look.unique.asleep ? ' (달인 전이라 아직 잠든다)' : ''}: {pct(look.matched[5])}
        </small>
      )}
      {look.target.kind === 'climb' && (
        <small>
          공격 {Math.round(look.attack.now)} → ★{PREVIEW_QUALITY} {Math.round(look.attack.low)} ~ ★5 {Math.round(look.attack.high)}
        </small>
      )}
    </>
  );
}

function MaintainSheet(props: { run: RunState; view: RunTurnView; onClose(): void; onBuy(item: ShopItem): void; onGo(picks: SlotPick[]): void }) {
  const { run, view, onClose, onBuy, onGo } = props;
  const [picks, setPicks] = useState<SlotPick[]>([]);
  const valid = picksBlock(run.weapon.weapon, picks, run.inventory) === null ? picks : [];
  const preview = applyPicks(run.weapon.weapon, valid, run.inventory);
  const next = view.walls.find((w) => w.state === 'next') ?? null;
  const cost = view.weapon.repairCost;
  const short = cost > run.gold;
  const canFill = view.weapon.freeSlots > 0 || (run.weapon.weapon.type === 'staff' && run.weapon.weapon.element === null);
  return (
    <Sheet title="정비" onClose={onClose}>
      <p>
        내구도 {pct(run.weapon.durability)} → 100% · 다음 원정 전투력 ×1.2 · HP {pct(run.hp)} → {pct(Math.min(view.hero.hpCap, run.hp + ACTION_HP.maintain))}
      </p>
      {next !== null && <p className="kc-hint">다음 벽 {next.floor}층: 지금 {pct(next.chance)} → 정비하면 {pct(next.chanceMaintained)}</p>}
      {canFill && (
        <SlotPicker
          run={run}
          weapon={preview.weapon}
          inventory={preview.inventory}
          picks={valid}
          onPick={(p) => setPicks([...valid, p])}
          onUndo={() => setPicks([])}
          onBuy={onBuy}
          maintain
        />
      )}
      <div className="kc-row">
        <button type="button" className="kc-btn primary" disabled={short} onClick={() => onGo(valid)}>
          {short ? `수리비가 모자라다 (${goldText(cost)})` : `정비한다 (${goldText(cost)})`}
        </button>
        <button type="button" className="kc-btn" onClick={onClose}>
          다시 생각한다
        </button>
      </div>
    </Sheet>
  );
}

function RestSheet({ run, view, onClose, onGo }: { run: RunState; view: RunTurnView; onClose(): void; onGo(): void }) {
  const forced = view.forced === 'rest';
  return (
    <Sheet title="휴식" onClose={onClose}>
      {forced && <p className="rn-quote">중상이다. 이번 턴은 쉰다.</p>}
      <p>
        HP {pct(run.hp)} → {pct(Math.min(1, run.hp + ACTION_HP.rest))}
        {run.injured && ' · 부상이 낫고 HP 상한이 돌아온다'}
      </p>
      <div className="kc-row">
        <button type="button" className="kc-btn primary" onClick={onGo}>
          쉰다
        </button>
        {!forced && (
          <button type="button" className="kc-btn" onClick={onClose}>
            다시 생각한다
          </button>
        )}
      </div>
    </Sheet>
  );
}

function BondSheet({ run, view, onClose, onGo }: { run: RunState; view: RunTurnView; onClose(): void; onGo(i: number): void }) {
  return (
    <Sheet title="교류" onClose={onClose}>
      <p className="kc-hint">
        동료 한 명과 시간을 보낸다. 유대 +1, HP +{pct(ACTION_HP.bond)}. 유대 {STORY_BONDS.join('·')}에서 사연이 열린다.
      </p>
      {view.companions.map((c) => {
        const comp = run.companions[c.index];
        const opens = c.nextStory !== null && c.nextStory === c.bond + 1;
        const story = opens ? FAMILIES[c.family].stories[STORY_BONDS.indexOf(c.nextStory as number)] : undefined;
        return (
          <button key={c.index} type="button" className="rn-plan" disabled={c.bond >= 5} onClick={() => onGo(c.index)} style={{ '--fam': c.color } as CSSProperties}>
            <b>
              <FamilyFace family={c.family} size="sm" /> {c.name} <small>{c.star}성</small> <BondPips bond={c.bond} stories={c.stories} />
            </b>
            {story !== undefined && comp !== undefined ? (
              <>
                <span>사연 「{story.title}」{subj(story.title).slice(story.title.length)} 열린다</span>
                {story.choices.map((ch) => (
                  <small key={ch.label}>
                    {ch.label}: {bonusEffects(run, comp, ch.bonus).preview}
                  </small>
                ))}
              </>
            ) : (
              <small>{c.bond >= 5 ? '유대가 가득하다' : c.nextStory !== null ? `유대 ${c.nextStory}에서 다음 사연` : '사연을 모두 들었다'}</small>
            )}
          </button>
        );
      })}
      <button type="button" className="kc-btn" onClick={onClose}>
        다시 생각한다
      </button>
    </Sheet>
  );
}

function ShopSheet({ run, onClose, onBuy }: { run: RunState; onClose(): void; onBuy(item: ShopItem, count?: number): void }) {
  const entries = shopEntries(run);
  return (
    <Sheet title={`상점 · ${goldText(run.gold)}`} onClose={onClose}>
      <p className="kc-hint">사는 것은 턴을 쓰지 않는다. 상급 재료는 상점에 없다 (31층부터 줍거나 보스 보상으로).</p>
      {entries.map((e) => {
        const isMain = e.item.kind === 'main';
        const fill = isMain ? Math.max(0, 6 - e.owned) : 0;
        return (
          <div key={isMain ? `m${e.label}` : e.label} className="rn-shop-row">
            <span>
              <b>{e.label}</b>
              <small>
                {goldText(e.price)} · 가진 것 {e.owned}
                {isMain && ' · 무기 한 자루에 6개'}
              </small>
            </span>
            <span className="rn-shop-btns">
              <button type="button" className="kc-btn small" disabled={e.price > run.gold} onClick={() => onBuy(e.item, 1)}>
                1개
              </button>
              {fill > 1 && (
                <button type="button" className="kc-btn small" disabled={e.price * fill > run.gold} onClick={() => onBuy(e.item, fill)}>
                  {fill}개 {goldText(e.price * fill)}
                </button>
              )}
            </span>
          </div>
        );
      })}
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}

function TowerSheet({ run, onClose }: { run: RunState; onClose(): void }) {
  const bands = seasonLayout(run.setup.season);
  const walls = wallViews(run);
  const fit = WEAPON_SPEC[run.weapon.weapon.type].bodyFit;
  const MARK = { good: '◎', normal: '○', bad: '△' } as const;
  const season = SEASONS[run.setup.season];
  return (
    <Sheet title={season.name} onClose={onClose}>
      <p className="kc-hint">
        시즌 규칙 {season.rule.label}: {season.rule.text}. 돌파 확률은 지금 무기와 레벨로.
      </p>
      {bands.map((b, i) => {
        const w = walls[i];
        const f = floorFit(run, b.bossFloor);
        return (
          <section key={b.band} className={`rn-towerband ${w?.state ?? ''}`}>
            <h4>
              {b.firstFloor}~{b.lastFloor}층 <ElementTag element={b.element} /> {BODY_LABEL[b.main]}
              {MARK[fit[b.main]]} / {BODY_LABEL[b.sub]}
              {MARK[fit[b.sub]]}
            </h4>
            <div className="rn-floormap" aria-hidden="true">
              {b.floors.map((body, j) => {
                const floor = b.firstFloor + j;
                return (
                  <i key={floor} className={`rn-fl b-${body}${floor <= run.record ? ' done' : ''}${floor === b.bossFloor ? ' boss' : ''}`}>
                    {BODY_LABEL[body].slice(0, 1)}
                  </i>
                );
              })}
            </div>
            {w !== undefined && (
              <p className="rn-towerband-boss">
                <b>
                  {b.bossFloor}층 {b.boss}
                </b>{' '}
                {w.passedTurn !== null ? `${w.passedTurn}턴에 넘었다` : `${w.deadline}턴까지 · 지금 ${pct(w.chance)} · 정비하면 ${pct(w.chanceMaintained)}`}
                <small>
                  {' '}
                  체형 {f.bodyMark} · 속성 {f.elementMark}
                </small>
              </p>
            )}
          </section>
        );
      })}
      <p className="kc-hint">51층부터: 보스 없이 끝없이. 체형은 층마다 섞인다.</p>
      <button type="button" className="kc-btn" onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
