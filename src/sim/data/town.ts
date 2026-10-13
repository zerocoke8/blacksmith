// 마을 지도의 건물과 해금 (기획서 9.2, 10.2). Buildings open when the best stage reaches a floor
// (사용자가 고른 추천). The floors are [튜닝] starting values for 16장의 14번 (건물 해금 표 [미정]):
// 9.2's recommendation is the forge, the guild, the gate and the mine from the start, and the four
// towers (도전, 일일 보스) once the stage has climbed a little, so the first day teaches
// '정제 → 레벨 → 다음 층' first. The scenery (shop, inn, market, fountain, houses) is open from the start.
// Where a building stands is the art's (docs/mockups/town/layout.json); where a tap leads is the
// screen's. Only when it opens is a rule, and it lives here.

/** The buildings a player can tap (9.2). The four towers are one building: they open together. */
export const TOWN_BUILDINGS = ['forge', 'guild', 'gate', 'tower', 'mine', 'shop', 'inn', 'market', 'fountain', 'house'] as const;
export type TownBuildingId = (typeof TOWN_BUILDINGS)[number];

export interface TownBuildingSpec {
  /** Its name on the map (9.2). */
  readonly name: string;
  /** Opens when the best stage reaches this floor (0: from the start) [튜닝]. */
  readonly opensAt: number;
}

export const TOWN_BUILDING: Record<TownBuildingId, TownBuildingSpec> = {
  forge: { name: '대장간', opensAt: 0 },
  guild: { name: '모험가 길드', opensAt: 0 },
  gate: { name: '마을 문', opensAt: 0 },
  // 1구간(1~10층, 6.2)을 깬 뒤. 일일 보스는 첫 구간을 넘은 다음에 (9.2 추천).
  tower: { name: '탑', opensAt: 10 },
  mine: { name: '광산', opensAt: 0 },
  shop: { name: '상점', opensAt: 0 },
  inn: { name: '여관', opensAt: 0 },
  market: { name: '시장', opensAt: 0 },
  fountain: { name: '분수', opensAt: 0 },
  house: { name: '집', opensAt: 0 },
};

export interface TownLock {
  readonly locked: boolean;
  /** The floor it opens at (0: open from the start). */
  readonly opensAt: number;
}

/**
 * Is this building open at this best stage? `bestStage` null: there is no stage yet (the
 * prototype, before the stage sim), so every building is open; the locked look is still drawn
 * when a best stage is given (the 실험 panel's preview).
 */
export function townLock(id: TownBuildingId, bestStage: number | null): TownLock {
  const opensAt = TOWN_BUILDING[id].opensAt;
  if (bestStage === null) return { locked: false, opensAt };
  return { locked: bestStage < opensAt, opensAt };
}

/** Every building's lock at once (the map draws them all). */
export function townLocks(bestStage: number | null): Record<TownBuildingId, TownLock> {
  const out = {} as Record<TownBuildingId, TownLock>;
  for (const id of TOWN_BUILDINGS) out[id] = townLock(id, bestStage);
  return out;
}

/** The buildings that open at exactly this floor (the 10.2 banner: '새 건물'). */
export function townOpenedAt(floor: number): TownBuildingId[] {
  return TOWN_BUILDINGS.filter((id) => TOWN_BUILDING[id].opensAt === floor && floor > 0);
}
