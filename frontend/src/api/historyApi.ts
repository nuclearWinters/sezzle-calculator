import type { ApiErrorResponse } from "../types/calculator";
import type { HistoryEntry, HistoryPage } from "../types/history";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class HistoryApiError extends Error {}

export async function fetchHistory(cursor: string | null, limit?: number): Promise<HistoryPage> {
  const params = new URLSearchParams();
  if (cursor !== null) params.set("cursor", cursor);
  if (limit !== undefined) params.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/history?${params.toString()}`);
  } catch {
    throw new HistoryApiError("Unable to reach the calculator service. Please try again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = isApiErrorResponse(data) ? data.error : "Something went wrong. Please try again.";
    throw new HistoryApiError(message);
  }

  if (!isHistoryPage(data)) {
    throw new HistoryApiError("Received an unexpected response from the calculator service.");
  }

  return data;
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as HistoryEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.operations === "string" &&
    typeof entry.result === "string" &&
    typeof entry.createdAt === "string"
  );
}

function isHistoryPage(data: unknown): data is HistoryPage {
  if (typeof data !== "object" || data === null) return false;
  const page = data as HistoryPage;
  return (
    Array.isArray(page.items) &&
    page.items.every(isHistoryEntry) &&
    (page.nextCursor === null || typeof page.nextCursor === "string")
  );
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && typeof (data as ApiErrorResponse).error === "string";
}
