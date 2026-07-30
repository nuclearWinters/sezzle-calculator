import "@testing-library/jest-dom/vitest";

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

class NoopWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly readyState = NoopWebSocket.CONNECTING;

  constructor(public readonly url: string) {}

  addEventListener(): void {}
  removeEventListener(): void {}
  send(): void {}
  close(): void {}
}

globalThis.WebSocket = NoopWebSocket as unknown as typeof WebSocket;
