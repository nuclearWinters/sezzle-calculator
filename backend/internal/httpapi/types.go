package httpapi

import (
	"time"

	"github.com/shopspring/decimal"
)

// CalculateRequest is the JSON body accepted by the calculate endpoint.
// B is a pointer so we can distinguish "omitted" from "zero" — required for
// binary operations (add, subtract, ...) but ignored for unary ones (sqrt).
//
// A and B use decimal.Decimal (not float64) so arbitrarily large/precise
// values survive the request unchanged; decimal.Decimal marshals to/from a
// JSON string by default, which is what keeps this exact end-to-end.
type CalculateRequest struct {
	A decimal.Decimal  `json:"a"`
	B *decimal.Decimal `json:"b,omitempty"`
}

// CalculateResponse is returned on success. History is the record that was
// just written to history, or nil if it wasn't (no store configured, or the
// insert failed) — history recording is best-effort and never fails the
// calculation itself, so callers must handle a nil History.
type CalculateResponse struct {
	Result  decimal.Decimal `json:"result"`
	History *HistoryItem    `json:"history"`
}

// ErrorResponse is returned whenever a request cannot be fulfilled.
type ErrorResponse struct {
	Error string `json:"error"`
}

// HistoryItem is a single calculation, as returned by the history endpoint
// and streamed over the history sync WebSocket.
type HistoryItem struct {
	ID         string    `json:"id"`
	Operations string    `json:"operations"`
	Result     string    `json:"result"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ListHistoryResponse is returned by GET /api/v1/history. NextCursor is
// null once there are no more pages.
type ListHistoryResponse struct {
	Items      []HistoryItem `json:"items"`
	NextCursor *string       `json:"nextCursor"`
}
