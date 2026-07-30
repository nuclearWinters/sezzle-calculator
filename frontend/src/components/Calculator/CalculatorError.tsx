import * as stylex from "@stylexjs/stylex";

const colors = {
  errorBg: "rgb(252, 232, 230)",
  errorText: "rgb(197, 34, 31)",
};

const styles = stylex.create({
  error: {
    backgroundColor: colors.errorBg,
    color: colors.errorText,
    borderRadius: "10px",
    padding: "10px 14px",
    marginBottom: "16px",
    fontSize: "0.9rem",
  },
});

interface Props {
  message: string | null;
}

export default function CalculatorError({ message }: Props) {
  if (!message) return null;

  return (
    <div {...stylex.props(styles.error)} role="alert" data-testid="error">
      {message}
    </div>
  );
}
