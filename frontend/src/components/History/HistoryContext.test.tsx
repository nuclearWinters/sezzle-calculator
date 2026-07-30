import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HistoryProvider, { useHistoryContext } from "./HistoryContext";
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

// A minimal consumer exposing enqueue/confirm/remove as buttons, so the
// queue's own semantics can be tested independently of Calculator/History.
function QueueHarness() {
  const { entries, enqueue, confirm, remove } = useHistoryContext();
  // A ref (not a plain variable) since this component re-renders every time
  // the queue changes, which would otherwise reset a plain `let` back to
  // null before the confirm/remove buttons below ever got clicked.
  const pendingId = useRef<string | null>(null);

  return (
    <div>
      <ul data-testid="entries">
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.operations} = {entry.result}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => (pendingId.current = enqueue(entryA))}>
        enqueue
      </button>
      <button type="button" onClick={() => pendingId.current && confirm(pendingId.current, entryB)}>
        confirm
      </button>
      <button type="button" onClick={() => pendingId.current && remove(pendingId.current)}>
        remove
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <HistoryProvider>
      <QueueHarness />
    </HistoryProvider>,
  );
}

describe("HistoryContext queue", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { items: [], nextCursor: null }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enqueue shows the entry immediately, without needing an active transition", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "enqueue" }));

    expect(screen.getByTestId("entries")).toHaveTextContent("1 + 1 = 2");
  });

  it("confirm replaces the pending entry with the real committed one", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "enqueue" }));
    await user.click(screen.getByRole("button", { name: "confirm" }));

    const entries = screen.getByTestId("entries");
    expect(entries).toHaveTextContent("2 + 2 = 4");
    expect(entries).not.toHaveTextContent("1 + 1 = 2");
  });

  it("remove drops the pending entry with nothing committed", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "enqueue" }));
    await user.click(screen.getByRole("button", { name: "remove" }));

    expect(screen.getByTestId("entries")).toBeEmptyDOMElement();
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
