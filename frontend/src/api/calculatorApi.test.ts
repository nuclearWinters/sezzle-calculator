import Decimal from "decimal.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculate, CalculatorApiError } from "./calculatorApi";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("calculate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends both operands for a binary operation", async () => {
    const fetchMock = mockFetchOnce(200, { result: "5" });
    vi.stubGlobal("fetch", fetchMock);

    await calculate("add", new Decimal(2), new Decimal(3));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/add"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: "2", b: "3" }),
      }),
    );
  });

  it("sends a single operand for a unary operation", async () => {
    const fetchMock = mockFetchOnce(200, { result: "4" });
    vi.stubGlobal("fetch", fetchMock);

    await calculate("sqrt", new Decimal(16));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/sqrt"),
      expect.objectContaining({ body: JSON.stringify({ a: "16" }) }),
    );
  });

  it("returns the parsed decimal result and history item", async () => {
    const historyItem = { id: "1", operations: "2 + 3", result: "5", createdAt: "2026-01-01T00:00:00Z" };
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "5", history: historyItem }));

    const { result, historyItem: returnedHistory } = await calculate("add", new Decimal(2), new Decimal(3));

    expect(result.equals(new Decimal(5))).toBe(true);
    expect(returnedHistory).toEqual(historyItem);
  });

  it("returns null historyItem when the response omits history", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "5" }));

    const { historyItem } = await calculate("add", new Decimal(2), new Decimal(3));

    expect(historyItem).toBeNull();
  });

  it("throws CalculatorApiError when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(calculate("add", new Decimal(1), new Decimal(1))).rejects.toThrow(
      new CalculatorApiError("Unable to reach the calculator service. Please try again."),
    );
  });

  it("throws with the server's error message on a non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(400, { error: "division by zero is not allowed" }));

    await expect(calculate("divide", new Decimal(5), new Decimal(0))).rejects.toThrow(
      new CalculatorApiError("division by zero is not allowed"),
    );
  });

  it("throws a generic message on a non-ok response without a parseable error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("bad json"); } }),
    );

    await expect(calculate("add", new Decimal(1), new Decimal(1))).rejects.toThrow(
      new CalculatorApiError("Something went wrong. Please try again."),
    );
  });

  it("throws when the response body doesn't match the expected shape", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { unexpected: true }));

    await expect(calculate("add", new Decimal(1), new Decimal(1))).rejects.toThrow(
      new CalculatorApiError("Received an unexpected response from the calculator service."),
    );
  });

  it("throws when the response body isn't even an object", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, "unexpected-response"));

    await expect(calculate("add", new Decimal(1), new Decimal(1))).rejects.toThrow(
      new CalculatorApiError("Received an unexpected response from the calculator service."),
    );
  });
});
