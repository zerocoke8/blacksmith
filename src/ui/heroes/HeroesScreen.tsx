// 용사 화면 (기획서 5.9, 6.3): the hero list — a grid of four cards a row, the shared level once at
// the top, the tabs, sorting and filters at the bottom — with a hero's own page on a tap, and the
// formation page beside it. No draws yet (12.2): the prototype starts with a few heroes and the
// 실험 panel changes what is owned ('모두 보유', '별 +1', '진화', '경험치 +n', '무기 상자').
// Every number is the sim's (src/sim/hero, src/sim/stage); this screen only shows and saves.

import { useMemo, useState } from 'react';
import { ELEMENTS, WEAPON_TYPES } from '../../sim/core/types.ts';
import { bandOf, ELEMENT_LABEL, WEAPON_LABEL } from '../../sim/data/common.ts';
import { HERO_ROLE_LABEL, HERO_ROLES, type HeroKey } from '../../sim/data/heroes.ts';
import { reducedMotion, Seg, Sheet } from '../cards/parts.tsx';
import { HERO_LINES } from '../battle/text.ts';
import { LevelChip, useGame } from '../game/LevelChip.tsx';
import { labEvolve, labOwnAll, labStarUp, labWeaponBox, prototypeHeroes, prototypeStage } from '../game/start.ts';
import { gameStore } from '../game/store.ts';
import { FormationEditor, type FormationKind } from './FormationEditor.tsx';
import { HeroCard } from './HeroCard.tsx';
import { HeroDetail } from './HeroDetail.tsx';
import { filterCount, HERO_SORT_LABEL, HERO_SORTS, HERO_TAB_LABEL, HERO_TABS, type HeroFilter, heroList, type HeroSort, type HeroTab, NO_FILTER } from './view.ts';
import './heroes.css';

type Page = 'list' | 'formation';

/** Which page and tab were open (memory only: a return lands where the player was). */
let lastView: { page: Page; tab: HeroTab; sort: HeroSort; filter: HeroFilter; kind: FormationKind } = {
  page: 'list',
  tab: 'all',
  sort: 'star',
  filter: NO_FILTER,
  kind: 'stage',
};

export default function HeroesScreen(props: { onExit(): void }) {
  const reduced = useMemo(() => reducedMotion(), []);
  const game = useGame();
  const [page, setPage] = useState<Page>(lastView.page);
  const [tab, setTab] = useState<HeroTab>(lastView.tab);
  const [sort, setSort] = useState<HeroSort>(lastView.sort);
  const [filter, setFilter] = useState<HeroFilter>(lastView.filter);
  const [kind, setKind] = useState<FormationKind>(lastView.kind);
  const [open, setOpen] = useState<HeroKey | null>(null);
  const [sheet, setSheet] = useState<'filter' | 'lab' | null>(null);
  const [boxes, setBoxes] = useState(0);
  lastView = { page, tab, sort, filter, kind };

  const cards = useMemo(() => (game === null ? [] : heroList(game.heroes.roster, { tab, sort, filter })), [game, tab, sort, filter]);
  const ownedCount = cards.filter((c) => c.owned).length;

  if (game === null) return <div className="app-loading">용사들을 부르는 중…</div>;
  const heroes = game.heroes;

  const lab = (kind2: 'star' | 'evolve', key: HeroKey) => gameStore.setHeroes(kind2 === 'star' ? labStarUp(heroes, key) : labEvolve(heroes, key));
  const exp = (n: number) => void gameStore.addExp(n);

  return (
    <div className={`hs-root kc-skin${reduced ? ' reduced' : ''}`}>
      <header className="hs-top">
        <button type="button" className="hs-iconbtn" onClick={props.onExit} aria-label="마을로">
          ←
        </button>
        <b className="hs-title">{HERO_LINES.title}</b>
        <LevelChip banner />
        <div className="hs-pages" role="tablist">
          {(['list', 'formation'] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={page === p} className={`hs-page${page === p ? ' on' : ''}`} onClick={() => setPage(p)}>
              {p === 'list' ? HERO_LINES.list : HERO_LINES.formation}
            </button>
          ))}
        </div>
      </header>

      {page === 'list' ? (
        <>
          <main className="hs-grid" aria-label="용사 목록">
            {cards.map((c) => (
              <HeroCard key={c.key} card={c} onTap={() => setOpen(c.key)} />
            ))}
            {cards.length === 0 && <p className="hs-empty">거른 조건에 맞는 용사가 없다.</p>}
          </main>
          <footer className="hs-foot">
            <div className="hs-tabs" role="tablist">
              {HERO_TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`hs-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                  {HERO_TAB_LABEL[t]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="hs-tool"
              onClick={() => setSort(HERO_SORTS[(HERO_SORTS.indexOf(sort) + 1) % HERO_SORTS.length] as HeroSort)}
              aria-label={`정렬: ${HERO_SORT_LABEL[sort]}. 눌러서 바꾼다`}
            >
              <small>정렬</small>
              {HERO_SORT_LABEL[sort]}
            </button>
            <button type="button" className={`hs-tool${filterCount(filter) > 0 ? ' on' : ''}`} onClick={() => setSheet('filter')}>
              <small>거르기</small>
              {filterCount(filter) > 0 ? `${filterCount(filter)}개` : '없음'}
            </button>
            <button type="button" className="hs-tool lab" onClick={() => setSheet('lab')}>
              실험
            </button>
          </footer>
          <p className="hs-count" aria-live="polite">
            {ownedCount}/{cards.length}명
          </p>
        </>
      ) : (
        <main className="hs-formation">
          <FormationEditor
            heroes={heroes}
            formations={game.stage.formations}
            kind={kind}
            onKind={setKind}
            onChange={(formations) => gameStore.setStage({ ...game.stage, formations })}
          />
        </main>
      )}

      {open !== null && (
        <HeroDetail heroKey={open} heroes={heroes} onChange={(h) => gameStore.setHeroes(h)} onClose={() => setOpen(null)} onLab={(k) => lab(k, open)} />
      )}

      {sheet === 'filter' && (
        <Sheet title="거르기" onClose={() => setSheet(null)}>
          <p className="hs-fl">속성</p>
          <Seg
            value={filter.element ?? 'any'}
            options={[{ value: 'any', label: '모두' }, ...ELEMENTS.map((e) => ({ value: e, label: ELEMENT_LABEL[e] }))]}
            onChange={(v) => setFilter({ ...filter, element: v === 'any' ? null : (v as HeroFilter['element']) })}
            label="속성"
          />
          <p className="hs-fl">무기</p>
          <Seg
            value={filter.weapon ?? 'any'}
            cols={4}
            options={[{ value: 'any', label: '모두' }, ...WEAPON_TYPES.map((w) => ({ value: w, label: WEAPON_LABEL[w] }))]}
            onChange={(v) => setFilter({ ...filter, weapon: v === 'any' ? null : (v as HeroFilter['weapon']) })}
            label="무기"
          />
          <p className="hs-fl">역할</p>
          <Seg
            value={filter.role ?? 'any'}
            options={[{ value: 'any', label: '모두' }, ...HERO_ROLES.map((r) => ({ value: r, label: HERO_ROLE_LABEL[r] }))]}
            onChange={(v) => setFilter({ ...filter, role: v === 'any' ? null : (v as HeroFilter['role']) })}
            label="역할"
          />
          <div className="hd-row">
            <button type="button" className="kc-btn ghost" onClick={() => setFilter(NO_FILTER)}>
              모두 풀기
            </button>
            <button type="button" className="kc-btn primary" onClick={() => setSheet(null)}>
              닫기
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'lab' && (
        <Sheet title="실험" onClose={() => setSheet(null)}>
          <p className="kc-hint">뽑기가 아직 없어서, 보유 상태를 여기서 바꾼다. 별과 진화는 용사를 눌러 그 안에서.</p>
          <div className="hd-row">
            <button type="button" className="kc-btn small" onClick={() => gameStore.setHeroes(labOwnAll(heroes))}>
              모두 보유
            </button>
            <button type="button" className="kc-btn small" onClick={() => exp(100)}>
              경험치 +100
            </button>
            <button type="button" className="kc-btn small" onClick={() => exp(2000)}>
              경험치 +2000
            </button>
            <button
              type="button"
              className="kc-btn small"
              onClick={() => {
                const n = boxes + 1 + heroes.armory.weapons.filter((w) => w.id.startsWith('box')).length;
                setBoxes(n);
                gameStore.setHeroes(labWeaponBox(heroes, bandOf(Math.max(1, game.stage.progress.best + 1)), n));
              }}
            >
              무기 상자
            </button>
          </div>
          <div className="hd-row">
            <button
              type="button"
              className="kc-btn small danger"
              onClick={() => {
                gameStore.setHeroes(prototypeHeroes());
                gameStore.setStage(prototypeStage());
                setSheet(null);
              }}
            >
              용사·스테이지 처음부터
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
