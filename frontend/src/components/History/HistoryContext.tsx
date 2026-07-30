import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchHistory, HistoryApiError } from "../../api/historyApi";
import type { HistoryEntry } from "../../types/history";

const PAGE_SIZE = 20;

interface HistoryContextValue {
  // Pending (optimistic, unconfirmed) entries first, then the committed
  // list — see enqueue/confirm/remove below.
  entries: HistoryEntry[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  retry: () => void;
  // Optimistically show entry at the top of the list immediately; returns
  // its id so the caller can later confirm or remove it. Deliberately a
  // plain state update (not useOptimistic) — callable from anywhere,
  // no active transition required, so a consumer (Calculator) can never end
  // up coupled to a Suspense boundary through this context.
  enqueue: (entry: HistoryEntry) => string;
  // The operation succeeded and was recorded: drop the pending placeholder
  // and prepend the real, confirmed record to the committed list.
  confirm: (pendingId: string, realEntry: HistoryEntry) => void;
  // The operation failed, or wasn't recorded server-side: drop the pending
  // placeholder with nothing committed.
  remove: (pendingId: string) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function useHistoryContext(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistoryContext must be used within a HistoryProvider");
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
}

export default function HistoryProvider({ children }: ProviderProps) {
  const [committed, setCommitted] = useState<HistoryEntry[]>([]);
  const [pending, setPending] = useState<HistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Starts false so the sentinel/observer effect below doesn't attach until
  // the first page has actually resolved — otherwise, if the sentinel
  // happens to be visible immediately (a near-empty list), it could race
  // the initial load effect into firing a duplicate first-page fetch.
  const [hasMore, setHasMore] = useState(false);
  // Starts true since a fetch always kicks off on mount — avoids a one-frame
  // flash of the empty state before the mount effect has had a chance to run.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef(true);

  function loadPage(cursor: string | null) {
    setIsLoading(true);
    setError(null);
    fetchHistory(cursor, PAGE_SIZE)
      .then((page) => {
        if (!mountRef.current) return;
        setCommitted((prev) => (cursor === null ? page.items : [...prev, ...page.items]));
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

  // Initial load — runs once on mount.
  useEffect(() => {
    mountRef.current = true;
    loadPage(null);
    return () => {
      mountRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Load more" — fires when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || error) return;

    const observer = new IntersectionObserver((observerEntries) => {
      if (observerEntries[0]?.isIntersecting) {
        loadPage(nextCursor);
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, error, committed.length]);

  function retry() {
    loadPage(nextCursor);
  }

  function enqueue(entry: HistoryEntry): string {
    setPending((prev) => [entry, ...prev]);
    return entry.id;
  }

  function confirm(pendingId: string, realEntry: HistoryEntry) {
    setPending((prev) => prev.filter((e) => e.id !== pendingId));
    setCommitted((prev) => [realEntry, ...prev]);
  }

  function remove(pendingId: string) {
    setPending((prev) => prev.filter((e) => e.id !== pendingId));
  }

  const value: HistoryContextValue = {
    entries: [...pending, ...committed],
    hasMore,
    isLoading,
    error,
    sentinelRef,
    retry,
    enqueue,
    confirm,
    remove,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
