type WeightedChurchItem = {
  churchId: number;
  priorityWeight: number;
  publishedAt: string;
};

export const PIN_UP_WEIGHT = 4;

export function pinPriorityChurch<T extends WeightedChurchItem>(items: T[]) {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (Number(item.priorityWeight) >= PIN_UP_WEIGHT) pinned.push(item);
    else rest.push(item);
  }
  return [...pinned, ...rest];
}

export function selectWeightedRecent<T extends WeightedChurchItem>(items: T[], limit: number) {
  const primary: T[] = [];
  const overflow: T[] = [];
  const primaryCount = new Map<number, number>();

  for (const item of pinPriorityChurch(items)) {
    const weight = Math.max(1, Math.min(3, Number(item.priorityWeight) || 1));
    const count = primaryCount.get(item.churchId) || 0;
    if (count < weight) {
      primary.push(item);
      primaryCount.set(item.churchId, count + 1);
    } else {
      overflow.push(item);
    }
  }

  if (primary.length >= limit) return primary.slice(0, limit);

  const selected = [...primary];
  const totalCount = new Map<number, number>();
  for (const item of selected) totalCount.set(item.churchId, (totalCount.get(item.churchId) || 0) + 1);
  for (const item of overflow) {
    if (selected.length >= limit) break;
    const count = totalCount.get(item.churchId) || 0;
    if (count >= 3) continue;
    selected.push(item);
    totalCount.set(item.churchId, count + 1);
  }
  return selected;
}
