export type LeaderboardSortableEntry = {
  totalValue: number;
  txnCount: number;
  linksCreated: number;
};

export function compareLeaderboardEntries(
  left: LeaderboardSortableEntry,
  right: LeaderboardSortableEntry,
) {
  if (right.totalValue !== left.totalValue) {
    return right.totalValue - left.totalValue;
  }
  if (right.txnCount !== left.txnCount) {
    return right.txnCount - left.txnCount;
  }
  return right.linksCreated - left.linksCreated;
}

export function sortLeaderboardEntries<T extends LeaderboardSortableEntry>(
  entries: T[],
) {
  return [...entries].sort(compareLeaderboardEntries);
}

export function capLeaderboardLimit(limit: number) {
  return Math.min(100, Math.max(1, limit));
}
