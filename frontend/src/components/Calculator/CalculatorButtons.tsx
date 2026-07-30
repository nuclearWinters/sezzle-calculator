import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import type { BinaryOperation } from "../../types/calculator";

type KeyVariant = "number" | "operator" | "equals";

interface CalculatorButtonsProps {
  canEvaluate: boolean;
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onExponent: () => void;
  onBackspace: () => void;
  onClear: () => void;
  onSqrt: () => void;
  onOperator: (operation: BinaryOperation) => void;
  onEquals: () => void;
}

const colors = {
  numberBg: "rgb(222, 225, 227)",
  numberBgHover: "rgb(206, 209, 211)",
  numberText: "rgb(32, 33, 36)",
  operatorBg: "rgb(229, 237, 255)",
  operatorBgHover: "rgb(209, 221, 255)",
  operatorText: "rgb(66, 133, 244)",
  equalsBg: "rgb(66, 133, 244)",
  equalsBgHover: "rgb(51, 103, 214)",
  equalsText: "#ffffff",
};

const styles = stylex.create({
  keypad: {
    display: "grid",
    // Fractional columns (rather than a fixed px width) let the keypad
    // shrink to fit narrow phone screens instead of overflowing.
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    width: "100%",
  },
  key: {
    appearance: "none",
    border: "none",
    borderWidth: "0px",
    borderRadius: "100px",
    width: "100%",
    // 44px is the standard minimum touch-target size for mobile.
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(0.85rem, 4vw, 1.05rem)",
    lineHeight: 1,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.5 },
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    transitionProperty: "background-color, transform",
    transitionDuration: "0.15s, 0.05s",
    transitionTimingFunction: "ease, ease",
  },
  number: {
    backgroundColor: { default: colors.numberBg, ":hover": colors.numberBgHover },
    color: colors.numberText,
  },
  operator: {
    backgroundColor: { default: colors.operatorBg, ":hover": colors.operatorBgHover },
    color: colors.operatorText,
    fontWeight: 600,
  },
  equals: {
    backgroundColor: { default: colors.equalsBg, ":hover": colors.equalsBgHover },
    color: colors.equalsText,
    fontWeight: 700,
  },
  // The "=" key spans 3 grid columns; grid items stretch to fill their
  // area by default, so it just needs the column span.
  wide: {
    gridColumn: "span 3",
  },
});

function Key({
  variant,
  wide,
  disabled,
  onClick,
  children,
}: {
  variant: KeyVariant;
  wide?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const variantStyle = variant === "number" ? styles.number : variant === "operator" ? styles.operator : styles.equals;

  return (
    <button
      type="button"
      {...stylex.props(styles.key, variantStyle, wide && styles.wide)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function CalculatorButtons({
  canEvaluate,
  onDigit,
  onDecimal,
  onExponent,
  onBackspace,
  onClear,
  onSqrt,
  onOperator,
  onEquals,
}: CalculatorButtonsProps) {
  return (
    <div {...stylex.props(styles.keypad)}>
      <Key variant="equals" onClick={onClear}>
        C
      </Key>
      <Key variant="equals" onClick={onBackspace}>
        ⌫
      </Key>
      <Key variant="operator" onClick={onSqrt}>
        √
      </Key>
      <Key variant="operator" onClick={() => onOperator("percentage")}>
        %
      </Key>

      <Key variant="number" onClick={() => onDigit("7")}>
        7
      </Key>
      <Key variant="number" onClick={() => onDigit("8")}>
        8
      </Key>
      <Key variant="number" onClick={() => onDigit("9")}>
        9
      </Key>
      <Key variant="operator" onClick={() => onOperator("divide")}>
        ÷
      </Key>

      <Key variant="number" onClick={() => onDigit("4")}>
        4
      </Key>
      <Key variant="number" onClick={() => onDigit("5")}>
        5
      </Key>
      <Key variant="number" onClick={() => onDigit("6")}>
        6
      </Key>
      <Key variant="operator" onClick={() => onOperator("multiply")}>
        ×
      </Key>

      <Key variant="number" onClick={() => onDigit("1")}>
        1
      </Key>
      <Key variant="number" onClick={() => onDigit("2")}>
        2
      </Key>
      <Key variant="number" onClick={() => onDigit("3")}>
        3
      </Key>
      <Key variant="operator" onClick={() => onOperator("subtract")}>
        −
      </Key>

      <Key variant="number" onClick={onExponent}>
        EXP
      </Key>
      <Key variant="number" onClick={() => onDigit("0")}>
        0
      </Key>
      <Key variant="number" onClick={onDecimal}>
        .
      </Key>
      <Key variant="operator" onClick={() => onOperator("add")}>
        +
      </Key>

      <Key variant="operator" onClick={() => onOperator("power")}>
        ^
      </Key>
      <Key variant="equals" wide onClick={onEquals} disabled={!canEvaluate}>
        =
      </Key>
    </div>
  );
}
