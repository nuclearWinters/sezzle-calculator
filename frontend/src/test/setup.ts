import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement IntersectionObserver. This default no-op stub
// just keeps any component that constructs one (e.g. History's infinite
// scroll) from crashing in tests that don't care about scroll behavior.
// Tests that do (History.test.tsx) replace it with a controllable mock via
// vi.stubGlobal.
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly scrollMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = NoopIntersectionObserver;
}
