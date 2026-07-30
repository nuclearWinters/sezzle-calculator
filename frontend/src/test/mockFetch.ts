import { vi } from "vitest";

export interface MockResponse {
  status: number;
  body: unknown;
}

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
