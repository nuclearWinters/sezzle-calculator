import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CalculatorDisplay from "./CalculatorDisplay";

describe("CalculatorDisplay", () => {
  it("does not render the history line when topLine is empty", () => {
    render(<CalculatorDisplay topLine="" valueDisplay="0" isPending={false} />);

    expect(screen.queryByTestId("history")).not.toBeInTheDocument();
    expect(screen.getByTestId("value")).toHaveTextContent("0");
  });

  it("renders the history line and its title when topLine is present", () => {
    render(
      <CalculatorDisplay
        topLine="Ans = 5"
        topLineTitle="Ans = 5.0000000000000000000000000000000000000000000000001"
        valueDisplay="10"
        isPending={false}
      />,
    );

    const history = screen.getByTestId("history");
    expect(history).toHaveTextContent("Ans = 5");
    expect(history).toHaveAttribute(
      "title",
      "Ans = 5.0000000000000000000000000000000000000000000000001",
    );
  });

  it("shows the value's exact title when provided", () => {
    render(
      <CalculatorDisplay
        topLine=""
        valueDisplay="1e+32"
        valueDisplayTitle="100000000000000000000000000000000"
        isPending={false}
      />,
    );

    expect(screen.getByTestId("value")).toHaveAttribute(
      "title",
      "100000000000000000000000000000000",
    );
  });

  it("dims the value while a calculation is pending", () => {
    render(<CalculatorDisplay topLine="" valueDisplay="5" isPending={true} />);

    expect(screen.getByTestId("value").style.opacity).toBe("0.5");
  });

  it("shows the value at full opacity when not pending", () => {
    render(<CalculatorDisplay topLine="" valueDisplay="5" isPending={false} />);

    expect(screen.getByTestId("value").style.opacity).toBe("1");
  });

  it("shrinks the font size as the displayed value gets longer", () => {
    render(<CalculatorDisplay topLine="" valueDisplay="1234567890" isPending={false} />);
    const shortSize = screen.getByTestId("value").style.fontSize;

    render(<CalculatorDisplay topLine="" valueDisplay={"1".repeat(40)} isPending={false} />);
    const longSize = screen.getAllByTestId("value")[1].style.fontSize;

    expect(longSize).not.toBe(shortSize);
  });
});
