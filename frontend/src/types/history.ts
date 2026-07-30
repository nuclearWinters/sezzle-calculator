export interface HistoryEntry {
  id: string;
  operations: string;
  result: string;
  createdAt: string;
}

// nextCursor is null once there are no more pages.
export interface HistoryPage {
  items: HistoryEntry[];
  nextCursor: string | null;
}
