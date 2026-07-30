package httpapi

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sezzle-calculator/backend/internal/history"
)

const (
	defaultHistoryLimit = 20
	maxHistoryLimit     = 100
)

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

	cursor, err := parseCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid \"cursor\" query parameter")
		return
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
	return &HistoryItem{ID: strconv.FormatInt(e.ID, 10), Operations: e.Operations, Result: e.Result, CreatedAt: e.CreatedAt}
}

func formatCursor(cursor *history.Cursor) *string {
	if cursor == nil {
		return nil
	}
	s := fmt.Sprintf("%d_%d", cursor.CreatedAt.UnixMicro(), cursor.ID)
	return &s
}

func parseCursor(raw string) (*history.Cursor, error) {
	if raw == "" {
		return nil, nil
	}

	micros, id, found := strings.Cut(raw, "_")
	if !found {
		return nil, fmt.Errorf("malformed cursor %q", raw)
	}

	parsedMicros, err := strconv.ParseInt(micros, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("malformed cursor %q: %w", raw, err)
	}
	parsedID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("malformed cursor %q: %w", raw, err)
	}

	return &history.Cursor{CreatedAt: time.UnixMicro(parsedMicros).UTC(), ID: parsedID}, nil
}
