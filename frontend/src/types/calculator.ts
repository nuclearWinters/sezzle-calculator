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

export interface CalculateResponse {
  result: string;
  history: HistoryEntry | null;
}

export interface ApiErrorResponse {
  error: string;
}
