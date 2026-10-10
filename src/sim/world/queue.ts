// Binary min-heap for scheduled events. Keys (at, rank, order) are unique per
// entry, so the pop order is fully determined by the keys (3.6 fixed order).

export interface EventKey {
  at: number;
  rank: number;
  order: number;
}

export function keyBefore(a: EventKey, b: EventKey): boolean {
  if (a.at !== b.at) return a.at < b.at;
  if (a.rank !== b.rank) return a.rank < b.rank;
  return a.order < b.order;
}

export class EventHeap<T extends EventKey> {
  private items: T[] = [];

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!keyBefore(a[i] as T, a[parent] as T)) break;
      [a[i], a[parent]] = [a[parent] as T, a[i] as T];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0] as T;
    const last = a.pop() as T;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && keyBefore(a[l] as T, a[m] as T)) m = l;
        if (r < a.length && keyBefore(a[r] as T, a[m] as T)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m] as T, a[i] as T];
        i = m;
      }
    }
    return top;
  }
}
