// Words and numbers on the refine screen (Korean, 기획서 1.1 tone).

import { refineRow } from '../../sim/data/refine.ts';
import type { RefineDrop } from '../../sim/refine/index.ts';

/** 1,240 */
export function num(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('ko-KR');
}

/** What floats over a find: gold as G, anything more than one as ×n. */
export function amountLabel(d: Pick<RefineDrop, 'item' | 'amount'>): string {
  if (refineRow(d.item).kind === 'gold') return `${num(d.amount)}G`;
  return d.amount > 1 ? `×${num(d.amount)}` : '';
}

/** m:ss, or h:mm:ss from an hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 37.5% → '37.5%', 1% → '1%'. */
export function percent(p: number): string {
  const v = Math.round(p * 1000) / 10;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}%`;
}
