import { useEffect, useEffectEvent } from "react";
import { isHistoryEntry } from "../api/historyApi";
import type { HistoryEntry } from "../types/history";

const WS_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/^http/, "ws");

export function useHistorySync(cursor: string | null | undefined, onEntry: (entry: HistoryEntry) => void) {
  const updateEntries = useEffectEvent((data: HistoryEntry) => {
    onEntry(data)
  });

  const sendCursor = useEffectEvent((socket: WebSocket) => () => {
    socket.send(JSON.stringify({ cursor }));
  })

  useEffect(() => {
    if (cursor === undefined) return;

    const socket = new WebSocket(`${WS_BASE_URL}/api/v1/history/sync`);

    socket.addEventListener("open", sendCursor(socket));

    socket.addEventListener("message", (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (isHistoryEntry(data)) updateEntries(data)
    });

    return () => socket.close();
  }, []);
}
