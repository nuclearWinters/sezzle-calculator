package httpapi

import (
	"context"

	"sezzle-calculator/backend/internal/history"
)

type HistoryStore interface {
	Insert(ctx context.Context, operations, result string) (history.Entry, error)
	List(ctx context.Context, cursor *history.Cursor, limit int) ([]history.Entry, *history.Cursor, error)
	ListSince(ctx context.Context, cursor *history.Cursor) ([]history.Entry, error)
}

type API struct {
	History HistoryStore
}
