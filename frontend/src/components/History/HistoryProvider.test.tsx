import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryProvider from "./HistoryProvider";
import { useHistoryContext } from "./HistoryContext";
import { fetchHistory } from "../../api/historyApi";
import type { HistoryEntry } from "../../types/history";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const entryA: HistoryEntry = { id: "a", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" };
const entryB: HistoryEntry = { id: "b", operations: "2 + 2", result: "4", createdAt: "2026-01-01T00:01:00Z" };

function SyncHarness() {
  const { entries, isLoading, historySync } = useHistoryContext();

  return (
    <div>
      {isLoading && <span data-testid="loading" />}
      <ul data-testid="entries">
        {(entries ?? []).map((entry) => (
          <li key={entry.id}>{entry.operations}</li>
        ))}
      </ul>
      <button type="button" onClick={() => historySync(entryB)}>
        sync
      </button>
    </div>
  );
}

describe("HistoryProvider historySync", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepends a synced entry to the existing list", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { items: [entryA], nextCursor: null }));

    const user = userEvent.setup();
    await act(async () => {
      render(
        <HistoryProvider historyPromise={fetchHistory(null, 20)}>
          <SyncHarness />
        </HistoryProvider>,
      );
    });
    await waitFor(() => expect(screen.queryByTestId("loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "sync" }));

    expect(screen.getByTestId("entries")).toHaveTextContent("2 + 2");
    expect(screen.getByTestId("entries")).toHaveTextContent("1 + 1");
  });

  it("does nothing when a synced entry arrives before the initial history loads", async () => {
    let resolveFetch!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve))),
    );

    const user = userEvent.setup();
    render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <SyncHarness />
      </HistoryProvider>,
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "sync" }));
    });

    expect(screen.getByTestId("entries")).toBeEmptyDOMElement();

    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) });
      await Promise.resolve();
    });
  });

  it("ignores a synced entry whose id is already present", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { items: [entryA, entryB], nextCursor: null }));

    const user = userEvent.setup();
    await act(async () => {
      render(
        <HistoryProvider historyPromise={fetchHistory(null, 20)}>
          <SyncHarness />
        </HistoryProvider>,
      );
    });
    await waitFor(() => expect(screen.queryByTestId("loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "sync" }));

    expect(screen.getByTestId("entries").textContent).toBe("1 + 12 + 2");
  });
});

describe("HistoryProvider unmount races", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores the initial history response if the component unmounts before it resolves", async () => {
    let resolveResponse!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((resolve) => (resolveResponse = resolve))),
    );

    const { unmount } = render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <div />
      </HistoryProvider>,
    );

    unmount();

    await act(async () => {
      resolveResponse({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("ignores the initial history failure if the component unmounts before it rejects", async () => {
    let rejectResponse!: (err: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((_resolve, reject) => (rejectResponse = reject))),
    );

    const { unmount } = render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <div />
      </HistoryProvider>,
    );

    unmount();

    await act(async () => {
      rejectResponse(new Error("network down"));
      await Promise.resolve().catch(() => {});
      await Promise.resolve();
    });
  });

  it("ignores a loadMore response if the component unmounts before it resolves", async () => {
    const firstPage = mockFetchOnce(200, { items: [entryA], nextCursor: "5" });
    vi.stubGlobal("fetch", firstPage);

    function LoadMoreHarness() {
      const { loadMore } = useHistoryContext();
      return (
        <button type="button" onClick={loadMore}>
          load more
        </button>
      );
    }

    const user = userEvent.setup();
    let unmount!: () => void;
    await act(async () => {
      const result = render(
        <HistoryProvider historyPromise={fetchHistory(null, 20)}>
          <LoadMoreHarness />
        </HistoryProvider>,
      );
      unmount = result.unmount;
    });

    let resolveResponse!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((resolve) => (resolveResponse = resolve))),
    );

    await user.click(screen.getByRole("button", { name: "load more" }));
    unmount();

    await act(async () => {
      resolveResponse({ ok: true, status: 200, json: async () => ({ items: [entryB], nextCursor: null }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("ignores a loadMore failure if the component unmounts before it rejects", async () => {
    const firstPage = mockFetchOnce(200, { items: [entryA], nextCursor: "5" });
    vi.stubGlobal("fetch", firstPage);

    function LoadMoreHarness() {
      const { loadMore } = useHistoryContext();
      return (
        <button type="button" onClick={loadMore}>
          load more
        </button>
      );
    }

    const user = userEvent.setup();
    let unmount!: () => void;
    await act(async () => {
      const result = render(
        <HistoryProvider historyPromise={fetchHistory(null, 20)}>
          <LoadMoreHarness />
        </HistoryProvider>,
      );
      unmount = result.unmount;
    });

    let rejectResponse!: (err: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((_resolve, reject) => (rejectResponse = reject))),
    );

    await user.click(screen.getByRole("button", { name: "load more" }));
    unmount();

    await act(async () => {
      rejectResponse(new Error("network down"));
      await Promise.resolve().catch(() => {});
      await Promise.resolve();
    });
  });
});
