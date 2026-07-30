import Decimal from "decimal.js";
import type { ApiErrorResponse, CalculateResponse, Operation } from "../types/calculator";
import type { HistoryEntry } from "../types/history";
import { isHistoryEntry } from "./historyApi";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class CalculatorApiError extends Error {}

export interface CalculateResult {
  result: Decimal;
  // The history record this calculation was just recorded as, or null if
  // it wasn't (history recording is best-effort on the backend).
  historyItem: HistoryEntry | null;
}

/**
 * Calls the backend calculator API. `b` is omitted for unary operations
 * (currently "sqrt" and "identity"). Operands and the result travel as
 * decimal strings (Decimal's `toJSON`/our own `new Decimal(...)` parse),
 * never as JSON numbers, so precision survives the round trip.
 */
export async function calculate(operation: Operation, a: Decimal, b?: Decimal): Promise<CalculateResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/calculate/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b === undefined ? { a } : { a, b }),
    });
  } catch {
    throw new CalculatorApiError("Unable to reach the calculator service. Please try again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = isApiErrorResponse(data) ? data.error : "Something went wrong. Please try again.";
    throw new CalculatorApiError(message);
  }

  if (!isCalculateResponse(data)) {
    throw new CalculatorApiError("Received an unexpected response from the calculator service.");
  }

  return { result: new Decimal(data.result), historyItem: data.history ?? null };
}

// `history` being entirely absent is treated the same as an explicit null —
// the real backend always includes it, but staying lenient here keeps this
// check from being pointlessly strict about a field callers already treat
// as optional (see the `?? null` above).
function isCalculateResponse(data: unknown): data is CalculateResponse {
  if (typeof data !== "object" || data === null) return false;
  const response = data as CalculateResponse;
  return (
    typeof response.result === "string" &&
    (response.history === null || response.history === undefined || isHistoryEntry(response.history))
  );
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && typeof (data as ApiErrorResponse).error === "string";
}
