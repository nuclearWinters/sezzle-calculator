import Decimal from "decimal.js";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HistoryProvider from "./HistoryProvider";
import { useHistoryContext } from "./HistoryContext";
import { fetchHistory } from "../../api/historyApi";
import type { CalculateResult } from "../../api/calculatorApi";
import type { HistoryEntry } from "../../types/history";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const optimisticEntry: HistoryEntry = {
  id: "mock-1",
  operations: "1 + 1",
  result: "2 (pending)",
  createdAt: "2026-01-01T00:00:00Z",
};
const realEntry: HistoryEntry = {
  id: "real-1",
  operations: "1 + 1",
  result: "2",
  createdAt: "2026-01-01T00:00:00Z",
};

function QueueHarness({ makeCalculatePromise }: { makeCalculatePromise: () => Promise<CalculateResult> }) {
  const { entries, isLoading, optimisticUpdate } = useHistoryContext();

  return (
    <div>
      {isLoading && <span data-testid="loading" />}
      <ul data-testid="entries">
        {(entries ?? []).map((entry) => (
          <li key={entry.id}>
            {entry.operations} = {entry.result}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => optimisticUpdate(optimisticEntry, makeCalculatePromise())}>
        calculate
      </button>
    </div>
  );
}

async function renderHarness(makeCalculatePromise: () => Promise<CalculateResult>) {
  await act(async () => {
    render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <QueueHarness makeCalculatePromise={makeCalculatePromise} />
      </HistoryProvider>,
    );
  });
  await waitFor(() => expect(screen.queryByTestId("loading")).not.toBeInTheDocument());
}

describe("HistoryContext optimisticUpdate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { items: [], nextCursor: null }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the entry immediately, before the calculation resolves", async () => {
    const user = userEvent.setup();
    let resolveCalculate!: (result: CalculateResult) => void;
    const calculatePromise = new Promise<CalculateResult>((resolve) => {
      resolveCalculate = resolve;
    });
    await renderHarness(() => calculatePromise);

    await user.click(screen.getByRole("button", { name: "calculate" }));

    expect(screen.getByTestId("entries")).toHaveTextContent("1 + 1 = 2 (pending)");

    resolveCalculate({ result: new Decimal(2), historyItem: realEntry });
    await waitFor(() => expect(screen.getByTestId("entries")).not.toHaveTextContent("(pending)"));
  });

  it("replaces the optimistic entry with the real committed one once the calculation resolves", async () => {
    const user = userEvent.setup();
    let resolveCalculate!: (result: CalculateResult) => void;
    const calculatePromise = new Promise<CalculateResult>((resolve) => {
      resolveCalculate = resolve;
    });
    await renderHarness(() => calculatePromise);

    await user.click(screen.getByRole("button", { name: "calculate" }));
    expect(screen.getByTestId("entries")).toHaveTextContent("2 (pending)");

    resolveCalculate({ result: new Decimal(2), historyItem: realEntry });

    await waitFor(() => expect(screen.getByTestId("entries")).not.toHaveTextContent("(pending)"));
    expect(screen.getByTestId("entries")).toHaveTextContent("1 + 1 = 2");
  });

  it("reverts the optimistic entry if the calculation fails", async () => {
    const user = userEvent.setup();
    let rejectCalculate!: (err: Error) => void;
    const calculatePromise = new Promise<CalculateResult>((_resolve, reject) => {
      rejectCalculate = reject;
    });
    await renderHarness(() => calculatePromise);

    await user.click(screen.getByRole("button", { name: "calculate" }));
    expect(screen.getByTestId("entries")).toHaveTextContent("2 (pending)");

    rejectCalculate(new Error("boom"));

    await waitFor(() => expect(screen.getByTestId("entries")).toBeEmptyDOMElement());
  });

  it("does nothing visible when optimisticUpdate is called before the initial history loads", async () => {
    let resolveFetch!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve))),
    );

    const user = userEvent.setup();
    render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <QueueHarness makeCalculatePromise={() => Promise.resolve({ result: new Decimal(2), historyItem: realEntry })} />
      </HistoryProvider>,
    );

    expect(screen.getByTestId("entries")).toBeEmptyDOMElement();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "calculate" }));
    });

    expect(screen.getByTestId("entries")).toBeEmptyDOMElement();

    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) });
      await Promise.resolve();
    });
  });

  it("useHistoryContext throws when used outside a HistoryProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Orphan() {
      useHistoryContext();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow("useHistoryContext must be used within a HistoryProvider");

    consoleError.mockRestore();
  });
});
