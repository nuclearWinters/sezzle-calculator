import { createContext, useContext } from "react";
import type { HistoryEntry } from "../../types/history";
import { CalculateResult } from "../../api/calculatorApi";

export interface HistoryContextValue {
  entries: HistoryEntry[] | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  historyPromise: Promise<unknown>;
  loadMore: () => void;
  optimisticUpdate: (entry: HistoryEntry, calculatePromise: Promise<CalculateResult>) => void
  syncCursor: string | null | undefined
  historySync: (entry: HistoryEntry) => void
}

export const HistoryContext = createContext<HistoryContextValue | null>(null);

export function useHistoryContext(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistoryContext must be used within a HistoryProvider");
  }
  return ctx;
}