// Reading a saved refine state back (기획서 10.1 결정론과 세이브). The state is plain JSON and is
// saved as it is; what comes back from storage is checked field by field, so a hand-edited or
// half-written save never reaches the rules. Items no longer in the result table are dropped.

import { isRefineItemId, type RefineItemId } from '../data/refine.ts';
import type { LumpLot, RefineState } from './refine.ts';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function whole(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

/** The state as JSON text. */
export function serializeRefine(state: RefineState): string {
  return JSON.stringify(state);
}

/** A saved state (parsed JSON), or null when it is not a whole one. */
export function restoreRefine(data: unknown): RefineState | null {
  if (!isObj(data)) return null;
  const lumps = whole(data.lumps);
  const refineNo = whole(data.refineNo);
  const accruedAt = typeof data.accruedAt === 'number' && Number.isSafeInteger(data.accruedAt) ? data.accruedAt : null;
  if (lumps === null || refineNo === null || accruedAt === null || !isObj(data.bag)) return null;
  const bag: Partial<Record<RefineItemId, number>> = {};
  for (const [k, v] of Object.entries(data.bag)) {
    const n = whole(v);
    if (isRefineItemId(k) && n !== null && n > 0) bag[k] = n;
  }
  const out: RefineState = { lumps, refineNo, bag, accruedAt };
  // 덩어리의 구간 (7.1): kept when whole; a save from before lots has none (its lumps are band 1).
  if (Array.isArray(data.lots)) {
    const lots: LumpLot[] = [];
    for (const l of data.lots) {
      if (!isObj(l)) continue;
      const band = whole(l.band);
      const count = whole(l.count);
      if (band !== null && band >= 1 && count !== null && count > 0) lots.push({ band, count });
    }
    out.lots = lots;
  }
  const carry = whole(data.carry);
  if (carry !== null && carry > 0 && carry < 60) out.carry = carry;
  return out;
}
