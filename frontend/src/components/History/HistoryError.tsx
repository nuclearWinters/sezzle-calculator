import * as stylex from "@stylexjs/stylex";

const colors = {
  errorBg: "rgb(252, 232, 230)",
  errorText: "rgb(197, 34, 31)",
  retryBg: "rgb(66, 133, 244)",
};

const styles = stylex.create({
  box: {
    backgroundColor: colors.errorBg,
    color: colors.errorText,
    borderRadius: "10px",
    padding: "10px 14px",
    marginTop: "8px",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  retryButton: {
    appearance: "none",
    border: "none",
    borderRadius: "100px",
    padding: "6px 14px",
    backgroundColor: colors.retryBg,
    color: "#ffffff",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
});

interface Props {
  message: string;
  onRetry: () => void;
}

export default function HistoryError({ message, onRetry }: Props) {
  return (
    <div {...stylex.props(styles.box)} role="alert" data-testid="history-error">
      <span>{message}</span>
      <button type="button" onClick={onRetry} {...stylex.props(styles.retryButton)}>
        Retry
      </button>
    </div>
  );
}
