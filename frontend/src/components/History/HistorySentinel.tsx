import type { Ref } from "react";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  sentinel: {
    height: "1px",
  },
});

interface Props {
  ref: Ref<HTMLDivElement>;
}

// An invisible marker observed via IntersectionObserver — when it scrolls
// into view, the parent knows to load the next page.
export default function HistorySentinel({ ref }: Props) {
  return <div ref={ref} {...stylex.props(styles.sentinel)} data-testid="history-sentinel" />;
}
