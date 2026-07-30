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
    height: "456px",
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
    maxHeight: "360px",
    overflowY: "auto",
  },
});

export default function History() {
  const { entries, hasMore, isLoading, error, historyPromise, loadMore, historySync, syncCursor } = useHistoryContext();
  use(historyPromise)
  const sentinelRef = useRef(null)
  const listRef = useRef<HTMLUListElement>(null)
  useHistorySync(syncCursor, historySync)

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || error) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: listRef.current },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, error, loadMore]);

  const items = entries ?? [];

  return (
    <div {...stylex.props(styles.card)} aria-label="Calculation history">
      <HistoryHeading />

      {items.length === 0 && !isLoading && !error && <HistoryEmpty />}

      <ul {...stylex.props(styles.list)} data-testid="history-list" ref={listRef}>
        {items.map((entry) => (
          <HistoryListItem key={entry.id} entry={entry} />
        ))}
        {hasMore && !error && (
          <li>
            <HistorySentinel ref={sentinelRef} />
          </li>
        )}
      </ul>

      {isLoading && <HistoryLoading />}

      {error && <HistoryError message={error} onRetry={loadMore} />}
    </div>
  );
}
