import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistorySync } from "./useHistorySync";
import type { HistoryEntry } from "../types/history";

class MockSocket {
  static instances: MockSocket[] = [];

  url: string;
  sentMessages: string[] = [];
  closed = false;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }

  addEventListener(type: string, callback: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(callback);
  }

  removeEventListener() {}

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, event: unknown) {
    this.listeners[type]?.forEach((callback) => callback(event));
  }
}

describe("useHistorySync", () => {
  beforeEach(() => {
    MockSocket.instances = [];
    vi.stubGlobal("WebSocket", MockSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not open a socket while the cursor is undefined", () => {
    renderHook(() => useHistorySync(undefined, vi.fn()));

    expect(MockSocket.instances).toHaveLength(0);
  });

  it("opens a socket against the history sync endpoint once the cursor is known", () => {
    renderHook(() => useHistorySync("5", vi.fn()));

    expect(MockSocket.instances).toHaveLength(1);
    expect(MockSocket.instances[0].url).toContain("/api/v1/history/sync");
  });

  it("opens a socket when the cursor is explicitly null (no more pages)", () => {
    renderHook(() => useHistorySync(null, vi.fn()));

    expect(MockSocket.instances).toHaveLength(1);
  });

  it("sends the current cursor once the socket opens", () => {
    renderHook(() => useHistorySync("5", vi.fn()));
    const socket = MockSocket.instances[0];

    act(() => socket.emit("open", {}));

    expect(socket.sentMessages).toEqual([JSON.stringify({ cursor: "5" })]);
  });

  it("forwards a valid history entry received over the socket", () => {
    const onEntry = vi.fn();
    renderHook(() => useHistorySync("5", onEntry));
    const socket = MockSocket.instances[0];

    const entry: HistoryEntry = { id: "1", operations: "1 + 1", result: "2", createdAt: "2026-01-01T00:00:00Z" };
    act(() => socket.emit("message", { data: JSON.stringify(entry) }));

    expect(onEntry).toHaveBeenCalledWith(entry);
  });

  it("ignores malformed JSON in a message event", () => {
    const onEntry = vi.fn();
    renderHook(() => useHistorySync("5", onEntry));
    const socket = MockSocket.instances[0];

    act(() => socket.emit("message", { data: "not json" }));

    expect(onEntry).not.toHaveBeenCalled();
  });

  it("ignores a message whose payload isn't a history entry", () => {
    const onEntry = vi.fn();
    renderHook(() => useHistorySync("5", onEntry));
    const socket = MockSocket.instances[0];

    act(() => socket.emit("message", { data: JSON.stringify({ foo: "bar" }) }));

    expect(onEntry).not.toHaveBeenCalled();
  });

  it("closes the socket on unmount", () => {
    const { unmount } = renderHook(() => useHistorySync("5", vi.fn()));
    const socket = MockSocket.instances[0];

    unmount();

    expect(socket.closed).toBe(true);
  });

  it("closes the old socket and opens a new one when the cursor changes", () => {
    const { rerender } = renderHook(({ cursor }) => useHistorySync(cursor, vi.fn()), {
      initialProps: { cursor: "5" as string | null | undefined },
    });
    expect(MockSocket.instances).toHaveLength(1);

    rerender({ cursor: "10" });

    expect(MockSocket.instances).toHaveLength(2);
    expect(MockSocket.instances[0].closed).toBe(true);
  });
});
