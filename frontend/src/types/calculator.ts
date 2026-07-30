import type { HistoryEntry } from "./history";

export type BinaryOperation =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "percentage";

export type UnaryOperation = "sqrt" | "identity";

export type Operation = BinaryOperation | UnaryOperation;

// result is a string (not a number) so arbitrarily large/precise decimal
// values survive the response without being rounded through a float64.
// history is the record this calculation was just recorded as, or null if
// it wasn't (history recording is best-effort on the backend).
export interface CalculateResponse {
  result: string;
  history: HistoryEntry | null;
}

export interface ApiErrorResponse {
  error: string;
}
