import * as stylex from "@stylexjs/stylex";
import { useHistoryContext } from "./HistoryContext";
import HistoryLoading from "./HistoryLoading";
import HistoryHeading from "./HistoryHeading";
import HistoryEmpty from "./HistoryEmpty";
import HistoryListItem from "./HistoryListItem";
import HistoryError from "./HistoryError";
import HistorySentinel from "./HistorySentinel";
import { use, useEffect, useRef } from "react";
import { useHistorySync } from "../../hooks/useHistorySync";

const colors = {
  cardBg: "#ffffff",
  cardBorder: "rgb(222, 225, 227)",
};

const styles = stylex.create({
  card: {
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 4px 16px rgba(32, 33, 36, 0.12)",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    maxHeight: "280px",
    overflowY: "auto",
  },
});

export default function History() {
  const { entries, hasMore, isLoading, error, historyPromise, loadMore, historySync, syncCursor } = useHistoryContext();
  use(historyPromise)
  const sentinelRef = useRef(null)
  useHistorySync(syncCursor, historySync)

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || error) return;

    const observer = new IntersectionObserver((observerEntries) => {
      if (observerEntries[0]?.isIntersecting) {
        loadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, error]);

  if (!entries) return null

  return (
    <div {...stylex.props(styles.card)} aria-label="Calculation history">
      <HistoryHeading />

      {entries.length === 0 && !isLoading && !error && <HistoryEmpty />}

      <ul {...stylex.props(styles.list)} data-testid="history-list">
        {entries.map((entry) => (
          <HistoryListItem key={entry.id} entry={entry} />
        ))}
      </ul>

      {isLoading && <HistoryLoading />}

      {error && <HistoryError message={error} onRetry={loadMore} />}

      {hasMore && !error && <HistorySentinel ref={sentinelRef} />}
    </div>
  );
}
