import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { fetchHistory, HistoryApiError } from "../../api/historyApi";
import type { HistoryEntry, HistoryPage } from "../../types/history";
import { CalculateResult } from "../../api/calculatorApi";
import { HistoryContext } from "./HistoryContext";

const PAGE_SIZE = 20;

interface HistoryContextValue {
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

interface ProviderProps {
  children: ReactNode;
  historyPromise: Promise<HistoryPage>
}

export default function HistoryProvider({ children, historyPromise }: ProviderProps) {
  const [history] = useState(() => historyPromise)
  const [suspenseSignal] = useState(() => history.catch(() => undefined))
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [entriesOpt, setEntriesOpt] = useOptimistic(
    entries,
    (entries: HistoryEntry[] | null, entry: HistoryEntry) => (entries ? [entry, ...entries] : entries),
  )
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [syncCursor, setSyncCursor] = useState<string | null | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountRef = useRef(true);
  const [, startTransition] = useTransition()

  const optimisticUpdate = (entry: HistoryEntry, calculatePromise: Promise<CalculateResult>) => {
    startTransition(async () => {
      setEntriesOpt(entry)
      try {
        const { historyItem } = await calculatePromise
        if (!historyItem) throw new Error("History item not recived.")
        setEntries(entries => entries ? [historyItem, ...entries] : entries)
      } catch {
        alert("Rolling back: " + entry.operations + " " + entry.result)
      }
    })
  }

  function loadPage(cursor: string | null) {
    setIsLoading(true);
    setError(null);
    fetchHistory(cursor, PAGE_SIZE)
      .then((page) => {
        if (!mountRef.current) return;
        setEntries((prev) => [...(prev || []), ...page.items]);
        setNextCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch((err) => {
        if (!mountRef.current) return;
        setError(err instanceof HistoryApiError ? err.message : "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!mountRef.current) return;
        setIsLoading(false);
      });
  }

  useEffect(() => {
    mountRef.current = true;
    history
      .then((page) => {
        if (!mountRef.current) return;
        setEntries(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
        setSyncCursor((prev) => (prev === undefined ? page.nextCursor : prev));

      })
      .catch((err) => {
        if (!mountRef.current) return;
        setError(err instanceof HistoryApiError ? err.message : "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!mountRef.current) return;
        setIsLoading(false);
      });
    return () => {
      mountRef.current = false;
    };
  }, [history]);

  function loadMore() {
    loadPage(nextCursor)
  }

  const historySync = (entry: HistoryEntry) => {
    setEntries((prev) => {
      if (!prev) return prev;
      if (prev.some((e) => e.id === entry.id)) return prev;
      return [entry, ...prev];
    });
  }

  const value: HistoryContextValue = {
    entries: entriesOpt,
    hasMore,
    isLoading,
    error,
    historyPromise: suspenseSignal,
    loadMore,
    optimisticUpdate,
    syncCursor,
    historySync,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
