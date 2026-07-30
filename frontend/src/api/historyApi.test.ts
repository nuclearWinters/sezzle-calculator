import Decimal from "decimal.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHistory, HistoryApiError, isHistoryEntry } from "./historyApi";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("fetchHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests without a cursor or limit query param when omitted", async () => {
    const fetchMock = mockFetchOnce(200, { items: [], nextCursor: null });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHistory(null);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.has("limit")).toBe(false);
  });

  it("includes the cursor and limit in the query string when provided", async () => {
    const fetchMock = mockFetchOnce(200, { items: [], nextCursor: null });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHistory("abc", 20);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("cursor")).toBe("abc");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("returns the parsed history page on success", async () => {
    const page = {
      items: [{ id: "1", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" }],
      nextCursor: "5",
    };
    vi.stubGlobal("fetch", mockFetchOnce(200, page));

    await expect(fetchHistory(null, 20)).resolves.toEqual(page);
  });

  it("throws HistoryApiError when the network request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(fetchHistory(null)).rejects.toThrow(
      new HistoryApiError("Unable to reach the calculator service. Please try again."),
    );
  });

  it("throws with the server's error message on a non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(500, { error: "simulated backend failure" }));

    await expect(fetchHistory(null)).rejects.toThrow(
      new HistoryApiError("simulated backend failure"),
    );
  });

  it("throws a generic message on a non-ok response without a parseable error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("bad json"); } }),
    );

    await expect(fetchHistory(null)).rejects.toThrow(
      new HistoryApiError("Something went wrong. Please try again."),
    );
  });

  it("throws when the response body doesn't match the expected shape", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { unexpected: true }));

    await expect(fetchHistory(null)).rejects.toThrow(
      new HistoryApiError("Received an unexpected response from the calculator service."),
    );
  });

  it("throws when the response body isn't even an object", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, "unexpected-response"));

    await expect(fetchHistory(null)).rejects.toThrow(
      new HistoryApiError("Received an unexpected response from the calculator service."),
    );
  });
});

describe("isHistoryEntry", () => {
  it("returns true for a well-formed entry", () => {
    expect(
      isHistoryEntry({ id: "1", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" }),
    ).toBe(true);
  });

  it("returns false when a required field is missing", () => {
    expect(isHistoryEntry({ id: "1", operations: "1 + 1", result: "2" })).toBe(false);
  });

  it("returns false when a field has the wrong type", () => {
    expect(
      isHistoryEntry({ id: "1", operations: "1 + 1", result: 2, createdAt: "2026-01-01T00:00:00Z" }),
    ).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isHistoryEntry(null)).toBe(false);
    expect(isHistoryEntry("string")).toBe(false);
    expect(isHistoryEntry(new Decimal(1))).toBe(false);
  });
});
