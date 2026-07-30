import { useEffect, useState, useOptimistic, useTransition } from "react";
import * as stylex from "@stylexjs/stylex";
import Decimal from "decimal.js";
import { calculate, CalculatorApiError } from "../../api/calculatorApi";
import type { BinaryOperation } from "../../types/calculator";
import CalculatorButtons from "./CalculatorButtons";
import CalculatorDisplay from "./CalculatorDisplay";
import CalculatorError from "./CalculatorError";
import { useHistoryContext } from "../History/HistoryContext";

// Kept in sync by hand with the backend's calculator.Precision (Go doesn't
// share this constant across languages).
Decimal.set({ precision: 50 });

const colors = {
  cardBg: "#ffffff",
  cardBorder: "rgb(222, 225, 227)",
};

const styles = stylex.create({
  calculator: {
    // min() with a vw-based fallback keeps the card from overflowing on
    // narrow phones (the body already applies 16px of padding on each
    // side) while capping it at a sensible size on larger screens.
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 4px 16px rgba(32, 33, 36, 0.12)",
  },
});

// Allows typing numbers up to 999999999999999999999 (21 digits) directly.
const MAX_DIGITS = 21;
const MAX_EXPONENT_DIGITS = 3;

const operatorLabel: Record<BinaryOperation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
  percentage: "%",
};

// Shows the full, exact value — no rounding — so the display can never
// misrepresent a result as "rounder" than it actually is (e.g. a value like
// 99999999999999999998.9 staying visibly distinct from 1e20).
function formatNumber(value: Decimal): string {
  return value.isFinite() ? value.toString() : "Error";
}

// Same value, spelled out without exponential notation — used as a tooltip
// (title attribute) so hovering over a number like 1.00000...004e+32 reveals
// its plain-decimal form instead of having to count zeros by eye.
function formatExact(value: Decimal): string {
  return value.isFinite() ? value.toFixed() : "Error";
}

const opSwitch = (operation: BinaryOperation, first: Decimal, second: Decimal): Decimal => {
  switch (operation) {
    case "add":
      return first.plus(second)
    case "divide":
      return first.dividedBy(second)
    case "multiply":
      return first.times(second)
    case "percentage":
      return first.dividedBy(100).times(second)
    case "power":
      return first.pow(second)
    case "subtract":
      return first.minus(second)
    default:
      throw new Error("Unknown operation")
  }
}

export default function Calculator() {
  const [firstNumber, setFirstNumber] = useState("");
  const [secondNumber, setSecondNumber] = useState("");
  const [operation, setOperation] = useState<BinaryOperation | null>(null);
  const [lastOperation, setLastOperation] = useState<BinaryOperation | null>(null);
  const [lastOperand, setLastOperand] = useState<Decimal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEquation, setLastEquation] = useState<string>("");
  const [lastResult, setLastResult] = useState(new Decimal(0));
  const [hasUserTypedAfterResult, setHasUserTypedAfterResult] = useState(false);

  const [lastResultOpt, setLastResultOpt] = useOptimistic(lastResult)
  const [lastEquationOpt, setLastEquationOpt] = useOptimistic(lastEquation)
  const [isPending, startTransition] = useTransition()

  const { enqueue, confirm, remove } = useHistoryContext();

  function inputDigit(digit: string) {
    const active = operation === null ? firstNumber : secondNumber;
    const setActive = operation === null ? setFirstNumber : setSecondNumber;

    const [mantissa, exponent] = active.split("e");
    if (exponent !== undefined) {
      if (exponent.replace("-", "").length >= MAX_EXPONENT_DIGITS) return;
    } else {
      if (active === "0" && digit === "0") return;
      if (mantissa.replace("-", "").replace(".", "").length >= MAX_DIGITS) return;
    }

    setError(null);
    setHasUserTypedAfterResult(true);
    setActive(active === "" || active === "0" ? digit : active + digit);
  }

  function inputDecimal() {
    const active = operation === null ? firstNumber : secondNumber;
    const setActive = operation === null ? setFirstNumber : setSecondNumber;

    if (active.includes(".") || active.includes("e")) return;

    setError(null);
    setHasUserTypedAfterResult(true);
    setActive((active === "" ? "0" : active) + ".");
  }

  function inputExponent() {
    const active = operation === null ? firstNumber : secondNumber;
    const setActive = operation === null ? setFirstNumber : setSecondNumber;

    setError(null);
    setHasUserTypedAfterResult(true);

    if (active.includes("e")) {
      setActive(active.includes("e-") ? active.replace("e-", "e") : active.replace("e", "e-"));
      return;
    }

    setActive((active === "" || active === "0" ? "1" : active) + "e");
  }

  function backspace() {
    if (operation !== null) {
      if (secondNumber === "") {
        setError(null);
        setHasUserTypedAfterResult(true);
        setOperation(null);
        return;
      }

      const remaining = secondNumber.slice(0, -1);
      setError(null);
      setHasUserTypedAfterResult(true);
      setSecondNumber(remaining === "-" ? "" : remaining);
      return;
    }

    if (firstNumber === "") return;

    setError(null);
    setHasUserTypedAfterResult(true);
    setFirstNumber((current) => {
      const next = current.slice(0, -1);
      return next === "-" ? "" : next;
    });
  }

  function clear() {
    setFirstNumber("");
    setSecondNumber("");
    setOperation(null);
    setLastOperation(null);
    setLastOperand(null);
    setError(null);
    setLastEquation("");
    setLastResult(new Decimal(0));
    setHasUserTypedAfterResult(false);
  }

  async function evaluate(nextOperation: BinaryOperation | null) {
    let opToApply: BinaryOperation;
    let first: Decimal;
    let second: Decimal;
    try {
      if (operation !== null) {
        opToApply = operation;
        first = new Decimal(firstNumber);
        second = new Decimal(secondNumber === "" ? firstNumber : secondNumber);
      } else if (lastOperation !== null && lastOperand !== null) {
        opToApply = lastOperation;
        first = firstNumber === "" ? lastResultOpt : new Decimal(firstNumber);
        second = lastOperand;
      } else {
        return;
      }
    } catch {
      return;
    }

    const equation = `${formatNumber(first)} ${operatorLabel[opToApply]} ${formatNumber(second)}`;
    const optimisticResult = opSwitch(opToApply, first, second);
    // Enqueued outside startTransition, deliberately: a plain setState
    // called *inside* startTransition is deferred along with everything
    // else in the transition (only useOptimistic setters are special-cased
    // to show immediately there) — so this needs to be an immediate update,
    // same as the other resets below, or the "optimistic" entry would only
    // ever appear once the transition (i.e. the whole calculation) settles.
    const pendingId = enqueue({
      id: crypto.randomUUID(),
      operations: equation,
      result: formatNumber(optimisticResult),
      createdAt: new Date().toISOString(),
    });

    setError(null);
    setFirstNumber("");
    setSecondNumber("");
    setOperation(nextOperation);
    setLastOperation(opToApply);
    setLastOperand(second);
    setHasUserTypedAfterResult(false);
    startTransition(async () => {
      try {
        setLastEquationOpt(`${equation} =`)
        setLastResultOpt(optimisticResult);
        const { result, historyItem } = await calculate(opToApply, first, second);
        setLastEquation(`${equation} =`);
        setLastResult(result);
        if (historyItem) confirm(pendingId, historyItem);
        else remove(pendingId);
      } catch (err) {
        remove(pendingId);
        setError(err instanceof CalculatorApiError ? err.message : "Something went wrong. Please try again.");
      }
    })
  }

  function chooseOperation(nextOperation: BinaryOperation) {
    if (operation !== null && secondNumber !== "") {
      evaluate(nextOperation);
      return;
    }

    if (firstNumber === "") setFirstNumber(formatNumber(lastResultOpt));

    setError(null);
    setHasUserTypedAfterResult(true);
    setOperation(nextOperation);
    setSecondNumber("");
  }

  // "=" pressed on a bare typed number — no operator chosen (and nothing to
  // repeat) — normalizes it through the backend as a unary operation, e.g.
  // typing "1e2" then "=" shows "100". Goes through the same
  // calculate/history pipeline as every other operation rather than the
  // frontend just reformatting the string itself.
  async function identity() {
    let value: Decimal;
    try {
      value = new Decimal(firstNumber);
    } catch {
      return;
    }

    const pendingId = enqueue({
      id: crypto.randomUUID(),
      operations: formatNumber(value),
      result: formatNumber(value),
      createdAt: new Date().toISOString(),
    });

    setError(null);
    setHasUserTypedAfterResult(true);
    setFirstNumber("");
    startTransition(async () => {
      try {
        setLastEquationOpt(`${formatNumber(value)} =`)
        setLastResultOpt(value);
        const { result, historyItem } = await calculate("identity", value);
        setLastEquation(`${formatNumber(value)} =`);
        setLastResult(result);
        setHasUserTypedAfterResult(false);
        if (historyItem) confirm(pendingId, historyItem);
        else remove(pendingId);
      } catch (err) {
        remove(pendingId);
        setError(err instanceof CalculatorApiError ? err.message : "Something went wrong. Please try again.");
      }
    })
  }

  function handleEquals() {
    if (operation === null && lastOperation === null && firstNumber !== "") {
      identity();
      return;
    }
    evaluate(null);
  }

  async function handleSqrt() {
    const canCalculate = secondNumber === ""
    if (!canCalculate) return;

    let value: Decimal;
    try {
      value = firstNumber === "" ? lastResultOpt : new Decimal(firstNumber);
    } catch {
      return;
    }

    const pendingId = enqueue({
      id: crypto.randomUUID(),
      operations: `sqrt(${formatNumber(value)})`,
      result: formatNumber(value.sqrt()),
      createdAt: new Date().toISOString(),
    });

    setError(null);
    setHasUserTypedAfterResult(true);
    setFirstNumber("");
    setOperation(null)
    startTransition(async () => {
      try {
        setLastEquationOpt(`√${formatNumber(value)} =`)
        setLastResultOpt(value.sqrt());
        const { result, historyItem } = await calculate("sqrt", value);
        setLastEquation(`√${formatNumber(value)} =`);
        setLastResult(result);
        setHasUserTypedAfterResult(false);
        if (historyItem) confirm(pendingId, historyItem);
        else remove(pendingId);
      } catch (err) {
        remove(pendingId);
        setError(err instanceof CalculatorApiError ? err.message : "Something went wrong. Please try again.");
      }
    })
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") {
        inputDigit(event.key);
      } else if (event.key === ".") {
        inputDecimal();
      } else if (event.key === "e" || event.key === "E") {
        inputExponent();
      } else if (event.key === "+") {
        chooseOperation("add");
      } else if (event.key === "-") {
        chooseOperation("subtract");
      } else if (event.key === "*") {
        chooseOperation("multiply");
      } else if (event.key === "/") {
        event.preventDefault();
        chooseOperation("divide");
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        handleEquals();
      } else if (event.key === "Escape") {
        clear();
      } else if (event.key === "Backspace") {
        backspace();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputDigit, inputDecimal, inputExponent, chooseOperation, handleEquals, clear, backspace]);

  const topLine = hasUserTypedAfterResult ? `Ans = ${formatNumber(lastResultOpt)}` : lastEquationOpt;
  const topLineTitle = hasUserTypedAfterResult ? `Ans = ${formatExact(lastResultOpt)}` : undefined;

  const valueDisplay =
    operation !== null
      ? `${firstNumber || formatNumber(lastResultOpt)} ${operatorLabel[operation]}${secondNumber === "" ? "" : ` ${secondNumber}`}`
      : firstNumber || formatNumber(lastResultOpt);
  const valueDisplayTitle = operation === null && firstNumber === "" ? formatExact(lastResultOpt) : undefined;

  return (
    <div {...stylex.props(styles.calculator)} role="region" aria-label="Calculator">
      <CalculatorDisplay
        topLine={topLine}
        topLineTitle={topLineTitle}
        valueDisplay={valueDisplay}
        valueDisplayTitle={valueDisplayTitle}
        isPending={isPending}
      />

      <CalculatorError message={error} />

      <CalculatorButtons
        canEvaluate={operation !== null || lastOperation !== null || firstNumber !== ""}
        onDigit={inputDigit}
        onDecimal={inputDecimal}
        onExponent={inputExponent}
        onBackspace={backspace}
        onClear={clear}
        onSqrt={handleSqrt}
        onOperator={chooseOperation}
        onEquals={handleEquals}
      />
    </div>
  );
}
