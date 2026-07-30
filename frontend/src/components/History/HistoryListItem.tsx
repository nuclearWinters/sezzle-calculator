import * as stylex from "@stylexjs/stylex";
import type { HistoryEntry } from "../../types/history";

const colors = {
  cardBorder: "rgb(222, 225, 227)",
  historyText: "rgb(95, 99, 104)",
  valueText: "rgb(32, 33, 36)",
};

const styles = stylex.create({
  item: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "8px 0",
    borderBottom: `1px solid ${colors.cardBorder}`,
    fontSize: "0.9rem",
  },
  operations: {
    color: colors.historyText,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  result: {
    color: colors.valueText,
    fontWeight: 600,
    flexShrink: 0,
  },
});

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

interface Props {
  entry: HistoryEntry;
}

export default function HistoryListItem({ entry }: Props) {
  return (
    <li {...stylex.props(styles.item)}>
      <span {...stylex.props(styles.operations)} title={formatTimestamp(entry.createdAt)}>
        {entry.operations} =
      </span>
      <span {...stylex.props(styles.result)}>{entry.result}</span>
    </li>
  );
}
