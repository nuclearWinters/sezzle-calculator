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

export default function HistorySentinel({ ref }: Props) {
  return <div ref={ref} {...stylex.props(styles.sentinel)} data-testid="history-sentinel" />;
}
