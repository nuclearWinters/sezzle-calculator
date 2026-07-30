import { vi } from "vitest";

export interface MockResponse {
  status: number;
  body: unknown;
}

/**
 * Builds a mock `fetch` that dispatches to a different canned response
 * depending on which endpoint the request URL matches. `fallback` handles
 * any request that doesn't match an explicit route — e.g. a Calculator test
 * that doesn't care about the incidental /history GET a HistoryProvider
 * fires on mount, or a History test that never calls /calculate.
 */
export function mockFetchRoutes(routes: { calculate?: MockResponse; history?: MockResponse; fallback: MockResponse }) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const route = url.includes("/api/v1/calculate")
      ? (routes.calculate ?? routes.fallback)
      : url.includes("/api/v1/history")
        ? (routes.history ?? routes.fallback)
        : routes.fallback;

    return Promise.resolve({
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => route.body,
    });
  });
}
