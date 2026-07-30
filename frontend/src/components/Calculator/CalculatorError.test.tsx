import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CalculatorError from "./CalculatorError";

describe("CalculatorError", () => {
  it("renders nothing when there is no message", () => {
    const { container } = render(<CalculatorError message={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message in an alert when present", () => {
    render(<CalculatorError message="division by zero is not allowed" />);

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("division by zero is not allowed");
    expect(error).toHaveAttribute("data-testid", "error");
  });
});
