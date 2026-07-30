import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import History from "./History";
import HistoryProvider from "./HistoryContext";
import HistoryLoading from "./HistoryLoading";
import { fetchHistory } from "../../api/historyApi";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

async function renderHistory() {
  await act(async () => {
    render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <Suspense fallback={<HistoryLoading />}>
          <History />
        </Suspense>
      </HistoryProvider>,
    );
  });
}


let intersectionCallbacks: IntersectionObserverCallback[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallbacks.push(callback);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function triggerIntersection() {
  const callback = intersectionCallbacks[intersectionCallbacks.length - 1];
  callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
}

describe("History", () => {
  beforeEach(() => {
    intersectionCallbacks = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state, then the first page once it resolves", async () => {
    let resolveFetch!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve))),
    );

    await renderHistory();

    expect(screen.getByTestId("history-loading")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: "1", operations: "1 + 2", result: "3", createdAt: "2026-01-01T00:00:00Z" }],
        nextCursor: null,
      }),
    });

    await waitFor(() => expect(screen.getByText("1 + 2 =")).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByTestId("history-loading")).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no history", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { items: [], nextCursor: null }));

    await renderHistory();

    await waitFor(() => expect(screen.getByText("No calculations yet.")).toBeInTheDocument());
  });

  it("shows a retry button when the initial load fails, and recovers on retry", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(500, { error: "simulated backend failure" }));

    const user = userEvent.setup();
    await renderHistory();

    await waitFor(() =>
      expect(screen.getByTestId("history-error")).toHaveTextContent("simulated backend failure"),
    );
    expect(screen.queryByTestId("history-sentinel")).not.toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      mockFetchOnce(200, {
        items: [{ id: "1", operations: "5 + 5", result: "10", createdAt: "2026-01-01T00:00:00Z" }],
        nextCursor: null,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("5 + 5 =")).toBeInTheDocument());
    expect(screen.queryByTestId("history-error")).not.toBeInTheDocument();
  });

  it("loads the next page when the sentinel scrolls into view, using the previous page's cursor", async () => {
    const firstPage = mockFetchOnce(200, {
      items: [{ id: "1", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" }],
      nextCursor: "5",
    });
    vi.stubGlobal("fetch", firstPage);

    await renderHistory();
    await waitFor(() => expect(screen.getByText("1 + 1 =")).toBeInTheDocument());
    expect(screen.getByTestId("history-sentinel")).toBeInTheDocument();

    const secondPage = mockFetchOnce(200, {
      items: [{ id: "2", operations: "2 + 2", result: "4", createdAt: "2026-01-01T00:01:00Z" }],
      nextCursor: null,
    });
    vi.stubGlobal("fetch", secondPage);

    triggerIntersection();

    await waitFor(() => expect(screen.getByText("2 + 2 =")).toBeInTheDocument());
    expect(secondPage).toHaveBeenCalledWith(expect.stringContaining("cursor=5"));
    expect(screen.getByText("1 + 1 =")).toBeInTheDocument();
    expect(screen.queryByTestId("history-sentinel")).not.toBeInTheDocument();
  });

  it("shows a retry button when loading a later page fails, and recovers on retry", async () => {
    const firstPage = mockFetchOnce(200, {
      items: [{ id: "1", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" }],
      nextCursor: "5",
    });
    vi.stubGlobal("fetch", firstPage);

    const user = userEvent.setup();
    await renderHistory();
    await waitFor(() => expect(screen.getByText("1 + 1 =")).toBeInTheDocument());

    vi.stubGlobal("fetch", mockFetchOnce(500, { error: "simulated backend failure" }));
    triggerIntersection();

    await waitFor(() =>
      expect(screen.getByTestId("history-error")).toHaveTextContent("simulated backend failure"),
    );
    expect(screen.queryByTestId("history-sentinel")).not.toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      mockFetchOnce(200, {
        items: [{ id: "2", operations: "9 - 3", result: "6", createdAt: "2026-01-01T00:01:00Z" }],
        nextCursor: null,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("9 - 3 =")).toBeInTheDocument());
    expect(screen.queryByTestId("history-error")).not.toBeInTheDocument();
  });
});
