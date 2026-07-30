import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HistoryError from "./HistoryError";

describe("HistoryError", () => {
  it("renders the message in an alert", () => {
    render(<HistoryError message="simulated backend failure" onRetry={vi.fn()} />);

    const error = screen.getByTestId("history-error");
    expect(error).toHaveTextContent("simulated backend failure");
    expect(error).toHaveAttribute("role", "alert");
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<HistoryError message="oops" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
