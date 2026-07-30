import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  empty: {
    color: "rgb(95, 99, 104)",
    fontSize: "0.9rem",
    margin: 0,
  },
});

export default function HistoryEmpty() {
  return <p {...stylex.props(styles.empty)}>No calculations yet.</p>;
}
