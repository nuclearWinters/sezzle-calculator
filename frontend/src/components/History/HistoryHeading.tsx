import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  heading: {
    margin: "0 0 12px",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "rgb(32, 33, 36)",
  },
});

export default function HistoryHeading() {
  return <h2 {...stylex.props(styles.heading)}>History</h2>;
}
