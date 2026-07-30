import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function Safe() {
  return <p data-testid="safe">All good</p>;
}

// A component whose throw/no-throw behavior is controlled externally by the
// test (not by counting renders) — React 19 internally re-invokes a
// throwing component more than once before calling componentDidCatch, so
// asserting on an invocation count is unreliable. This flag-based approach
// keeps throwing until the test explicitly flips it, regardless of how many
// times React calls the function in between.
function makeFlakyComponent() {
  const state = { shouldThrow: true };
  function Flaky() {
    if (state.shouldThrow) {
      throw new Error("boom");
    }
    return <p data-testid="recovered">Recovered</p>;
  }
  return { Flaky, stopThrowing: () => (state.shouldThrow = false) };
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary label="Test">
        <Safe />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("safe")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
  });

  it("catches a thrown error and shows the fallback with the label and message", () => {
    // React (and our boundary) logs the caught error via console.error by
    // design — suppress the expected noise for this test.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Flaky } = makeFlakyComponent();

    render(
      <ErrorBoundary label="Test">
        <Flaky />
      </ErrorBoundary>,
    );

    const fallback = screen.getByTestId("error-boundary-fallback");
    expect(fallback).toHaveTextContent("Test crashed:");
    expect(fallback).toHaveTextContent("boom");

    consoleError.mockRestore();
  });

  it("remounts the child on retry, recovering once it stops throwing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Flaky, stopThrowing } = makeFlakyComponent();

    const user = userEvent.setup();
    render(
      <ErrorBoundary label="Test">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-fallback")).toHaveTextContent("boom");

    stopThrowing();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByTestId("recovered")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("logs the caught error via console.error, tagged with the label", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Flaky } = makeFlakyComponent();

    render(
      <ErrorBoundary label="Widget">
        <Flaky />
      </ErrorBoundary>,
    );

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("ErrorBoundary (Widget) caught an error:"),
      expect.any(Error),
      expect.anything(),
    );

    consoleError.mockRestore();
  });
});
