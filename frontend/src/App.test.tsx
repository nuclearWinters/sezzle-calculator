import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { mockFetchRoutes } from "./test/mockFetch";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the calculator and, once history resolves, the history panel", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchRoutes({
        history: { status: 200, body: { items: [], nextCursor: null } },
        fallback: { status: 200, body: {} },
      }),
    );

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByRole("region", { name: "Calculator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("No calculations yet.")).toBeInTheDocument());
  });

  it("shares a completed calculation between the calculator and the history list", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchRoutes({
        calculate: {
          status: 200,
          body: {
            result: "5",
            history: { id: "1", operations: "2 + 3", result: "5", createdAt: "2026-01-01T00:00:00Z" },
          },
        },
        history: { status: 200, body: { items: [], nextCursor: null } },
        fallback: { status: 200, body: {} },
      }),
    );

    const user = userEvent.setup();
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(screen.getByText("No calculations yet.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("history-list")).toHaveTextContent("2 + 3"));
    expect(screen.getByTestId("display")).toHaveTextContent("5");
  });

  it("keeps the calculator usable when the history panel fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchRoutes({
        calculate: { status: 200, body: { result: "5" } },
        history: { status: 500, body: { error: "simulated backend failure" } },
        fallback: { status: 200, body: {} },
      }),
    );

    const user = userEvent.setup();
    await act(async () => {
      render(<App />);
    });

    await waitFor(() =>
      expect(screen.getByTestId("history-error")).toHaveTextContent("simulated backend failure"),
    );

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("5"));
  });
});
