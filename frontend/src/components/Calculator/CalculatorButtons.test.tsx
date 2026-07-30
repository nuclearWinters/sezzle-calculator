import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CalculatorButtons from "./CalculatorButtons";
import type { BinaryOperation } from "../../types/calculator";

function renderButtons(overrides: Partial<{ canEvaluate: boolean }> = {}) {
  const handlers = {
    onDigit: vi.fn(),
    onDecimal: vi.fn(),
    onExponent: vi.fn(),
    onBackspace: vi.fn(),
    onClear: vi.fn(),
    onSqrt: vi.fn(),
    onOperator: vi.fn(),
    onEquals: vi.fn(),
  };

  render(
    <CalculatorButtons
      canEvaluate={overrides.canEvaluate ?? true}
      onDigit={handlers.onDigit}
      onDecimal={handlers.onDecimal}
      onExponent={handlers.onExponent}
      onBackspace={handlers.onBackspace}
      onClear={handlers.onClear}
      onSqrt={handlers.onSqrt}
      onOperator={handlers.onOperator}
      onEquals={handlers.onEquals}
    />,
  );

  return handlers;
}

describe("CalculatorButtons", () => {
  it("calls onDigit with the corresponding digit for each number key", async () => {
    const user = userEvent.setup();
    const { onDigit } = renderButtons();

    for (const digit of "0123456789") {
      await user.click(screen.getByRole("button", { name: digit }));
    }

    for (const digit of "0123456789") {
      expect(onDigit).toHaveBeenCalledWith(digit);
    }
  });

  it("calls onDecimal when . is clicked", async () => {
    const user = userEvent.setup();
    const { onDecimal } = renderButtons();

    await user.click(screen.getByRole("button", { name: "." }));

    expect(onDecimal).toHaveBeenCalledTimes(1);
  });

  it("calls onExponent when the EXP key is clicked", async () => {
    const user = userEvent.setup();
    const { onExponent } = renderButtons();

    await user.click(screen.getByRole("button", { name: "EXP" }));

    expect(onExponent).toHaveBeenCalledTimes(1);
  });

  it("calls onBackspace and onClear for their respective keys", async () => {
    const user = userEvent.setup();
    const { onBackspace, onClear } = renderButtons();

    await user.click(screen.getByRole("button", { name: "⌫" }));
    await user.click(screen.getByRole("button", { name: "C" }));

    expect(onBackspace).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("calls onSqrt when √ is clicked", async () => {
    const user = userEvent.setup();
    const { onSqrt } = renderButtons();

    await user.click(screen.getByRole("button", { name: "√" }));

    expect(onSqrt).toHaveBeenCalledTimes(1);
  });

  it.each<[string, BinaryOperation]>([
    ["%", "percentage"],
    ["÷", "divide"],
    ["×", "multiply"],
    ["−", "subtract"],
    ["+", "add"],
    ["^", "power"],
  ])("calls onOperator with %s -> %s", async (label, operation) => {
    const user = userEvent.setup();
    const { onOperator } = renderButtons();

    await user.click(screen.getByRole("button", { name: label }));

    expect(onOperator).toHaveBeenCalledWith(operation);
  });

  it("calls onEquals when = is clicked and canEvaluate is true", async () => {
    const user = userEvent.setup();
    const { onEquals } = renderButtons({ canEvaluate: true });

    await user.click(screen.getByRole("button", { name: "=" }));

    expect(onEquals).toHaveBeenCalledTimes(1);
  });

  it("disables the equals key when canEvaluate is false", () => {
    renderButtons({ canEvaluate: false });

    expect(screen.getByRole("button", { name: "=" })).toBeDisabled();
  });

  it("enables the equals key when canEvaluate is true", () => {
    renderButtons({ canEvaluate: true });

    expect(screen.getByRole("button", { name: "=" })).not.toBeDisabled();
  });
});
