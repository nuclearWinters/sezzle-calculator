import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  status: {
    color: "rgb(95, 99, 104)",
    fontSize: "0.85rem",
    textAlign: "center",
    padding: "8px 0",
    margin: 0,
  },
});

export default function HistoryLoading() {
  return (
    <p {...stylex.props(styles.status)} data-testid="history-loading">
      Loading…
    </p>
  );
}
