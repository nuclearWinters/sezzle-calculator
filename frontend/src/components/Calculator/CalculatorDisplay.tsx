import * as stylex from "@stylexjs/stylex";

const colors = {
  displayBg: "rgb(241, 243, 244)",
  historyText: "rgb(95, 99, 104)",
  valueText: "rgb(32, 33, 36)",
};

const styles = stylex.create({
  display: {
    backgroundColor: colors.displayBg,
    borderRadius: "14px",
    padding: "20px 16px",
    marginBottom: "16px",
    textAlign: "right",
    height: "84px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  history: {
    color: colors.historyText,
    fontSize: "0.95rem",
    minHeight: "1.2em",
  },
  value: {
    color: colors.valueText,
    // fontSize is set inline (see valueFontSize) since it depends on the
    // rendered text length, not just viewport width — results can range
    // from a single digit to 50+ characters now that we show full
    // precision instead of rounding.
    fontWeight: 600,
    wordBreak: "break-all",
  },
});

// Shrinks the main display's font as its text gets longer, so results
// ranging from a single digit up to 50+ characters (full-precision decimals)
// all stay on one line-ish instead of overflowing or wrapping illegibly.
// Ordered shortest-first; the first breakpoint that fits wins.
const VALUE_FONT_SIZES: ReadonlyArray<{ maxLength: number; fontSize: string }> = [
  { maxLength: 10, fontSize: "clamp(1.75rem, 8vw, 2.5rem)" },
  { maxLength: 16, fontSize: "clamp(1.4rem, 6.5vw, 2rem)" },
  { maxLength: 24, fontSize: "clamp(1.1rem, 5vw, 1.5rem)" },
  { maxLength: 34, fontSize: "clamp(0.9rem, 4vw, 1.15rem)" },
];
const VALUE_FONT_SIZE_FALLBACK = "clamp(0.7rem, 3vw, 0.9rem)";

function valueFontSize(length: number): string {
  return VALUE_FONT_SIZES.find((tier) => length <= tier.maxLength)?.fontSize ?? VALUE_FONT_SIZE_FALLBACK;
}

interface Props {
  topLine: string;
  topLineTitle?: string;
  valueDisplay: string;
  valueDisplayTitle?: string;
  isPending: boolean;
}

export default function CalculatorDisplay({ topLine, topLineTitle, valueDisplay, valueDisplayTitle, isPending }: Props) {
  return (
    <div {...stylex.props(styles.display)} data-testid="display">
      {topLine !== "" && (
        <div {...stylex.props(styles.history)} data-testid="history" title={topLineTitle}>
          {topLine}
        </div>
      )}
      <div
        style={{ opacity: isPending ? "0.5" : "1", fontSize: valueFontSize(valueDisplay.length) }}
        {...stylex.props(styles.value)}
        aria-live="polite"
        title={valueDisplayTitle}
        data-testid="value"
      >
        {valueDisplay}
      </div>
    </div>
  );
}
