export interface HistoryEntry {
  id: string;
  operations: string;
  result: string;
  createdAt: string;
}

export interface HistoryPage {
  items: HistoryEntry[];
  nextCursor: string | null;
}
