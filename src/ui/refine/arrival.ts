// The arrival line ('자리를 비운 사이 광석 덩어리 n개가 쌓였다', 10.1 돌아옴) is said once for each batch
// of lumps, by whichever screen shows it first this session: the map as it opens, or the refine
// screen as it takes them in. The map only looks at the pile (it writes nothing), so without this
// both would announce the same batch. A batch is known by where its counting began (the save's
// accruedAt; 'new' before there is a save). Memory only: a reload may say it once more.

/** Where a batch's counting began: the save's accruedAt minute, or null for a save not made yet. */
export function arrivalKey(accruedAt: number | null): string {
  return accruedAt === null ? 'new' : String(accruedAt);
}

/** The same batch is told again only when at least this many more lumps came in since (half an hour at a lump a minute). */
export const ARRIVAL_AGAIN = 30;

/**
 * The map tells a batch only from this many lumps: back from the refine screen a minute later,
 * '자리를 비운 사이 1개' is no news. (The refine screen tells any, as it always did: it shows the pile grow.)
 */
export const ARRIVAL_MIN_MAP = 5;

let told: { key: string; gained: number } | null = null;

/** Should this batch's line be said now? */
export function shouldTellArrival(key: string, gained: number, min = 1): boolean {
  if (gained < Math.max(1, min)) return false;
  return told === null || told.key !== key || gained - told.gained >= ARRIVAL_AGAIN;
}

/** The line was said for this batch. */
export function markArrivalTold(key: string, gained: number): void {
  told = { key, gained };
}

/** Tests only. */
export function forgetArrival(): void {
  told = null;
}
