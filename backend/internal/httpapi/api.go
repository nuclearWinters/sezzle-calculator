package httpapi

import (
	"context"

	"sezzle-calculator/backend/internal/history"
)

// HistoryStore is the subset of *history.Store the HTTP layer depends on.
// Defined here on the consumer side (rather than importing the concrete
// *history.Store directly into API) purely as a test seam: handler tests
// inject an in-memory fake instead of requiring a live MySQL connection for
// `go test ./...` to run.
type HistoryStore interface {
	Insert(ctx context.Context, operations, result string) (history.Entry, error)
	List(ctx context.Context, cursor *int64, limit int) ([]history.Entry, *int64, error)
}

// API holds the dependencies HTTP handlers need. History may be nil — see
// CalculateHandler (degrades to "don't record history") and
// ListHistoryHandler (returns 503) for how each copes with that.
type API struct {
	History HistoryStore
}
