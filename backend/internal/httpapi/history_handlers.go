package httpapi

import (
	"log"
	"net/http"
	"strconv"

	"sezzle-calculator/backend/internal/history"
)

const (
	defaultHistoryLimit = 20
	maxHistoryLimit     = 100
)

// ListHistoryHandler dispatches GET /api/v1/history?cursor=&limit= requests,
// returning a page of past calculations newest-first.
func (a *API) ListHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if a.History == nil {
		writeError(w, http.StatusServiceUnavailable, "history is not available")
		return
	}

	limit := defaultHistoryLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			writeError(w, http.StatusBadRequest, "invalid \"limit\" query parameter: must be a positive integer")
			return
		}
		limit = parsed
	}
	if limit > maxHistoryLimit {
		limit = maxHistoryLimit
	}

	var cursor *int64
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid \"cursor\" query parameter")
			return
		}
		cursor = &parsed
	}

	entries, nextCursor, err := a.History.List(r.Context(), cursor, limit)
	if err != nil {
		log.Printf("failed to list history: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to load history")
		return
	}

	writeJSON(w, http.StatusOK, ListHistoryResponse{
		Items:      toHistoryItems(entries),
		NextCursor: formatCursor(nextCursor),
	})
}

func toHistoryItems(entries []history.Entry) []HistoryItem {
	items := make([]HistoryItem, len(entries))
	for i, e := range entries {
		items[i] = *toHistoryItem(e)
	}
	return items
}

func toHistoryItem(e history.Entry) *HistoryItem {
	return &HistoryItem{ID: e.ID, Operations: e.Operations, Result: e.Result, CreatedAt: e.CreatedAt}
}

func formatCursor(cursor *int64) *string {
	if cursor == nil {
		return nil
	}
	s := strconv.FormatInt(*cursor, 10)
	return &s
}
