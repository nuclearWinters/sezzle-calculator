package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"sezzle-calculator/backend/internal/history"
)

type fakeHistoryStore struct {
	inserted  []insertedEntry
	insertErr error

	gotCursor  *history.Cursor
	gotLimit   int
	entries    []history.Entry
	nextCursor *history.Cursor
	listErr    error

	gotSinceCursor *history.Cursor
	sinceEntries   []history.Entry
	sinceErr       error
}

type insertedEntry struct {
	operations string
	result     string
}

func (f *fakeHistoryStore) Insert(_ context.Context, operations, result string) (history.Entry, error) {
	if f.insertErr != nil {
		return history.Entry{}, f.insertErr
	}
	f.inserted = append(f.inserted, insertedEntry{operations: operations, result: result})
	return history.Entry{ID: 1, Operations: operations, Result: result, CreatedAt: time.Now()}, nil
}

func (f *fakeHistoryStore) List(_ context.Context, cursor *history.Cursor, limit int) ([]history.Entry, *history.Cursor, error) {
	f.gotCursor = cursor
	f.gotLimit = limit
	if f.listErr != nil {
		return nil, nil, f.listErr
	}
	return f.entries, f.nextCursor, nil
}

func (f *fakeHistoryStore) ListSince(_ context.Context, cursor *history.Cursor) ([]history.Entry, error) {
	f.gotSinceCursor = cursor
	if f.sinceErr != nil {
		return nil, f.sinceErr
	}
	return f.sinceEntries, nil
}

func TestCalculateHandlerRecordsHistoryOnSuccess(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "10", "b": "4"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", &buf)
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if len(fake.inserted) != 1 {
		t.Fatalf("history inserts = %d, want 1", len(fake.inserted))
	}
	if fake.inserted[0].operations != "10 + 4" || fake.inserted[0].result != "14" {
		t.Errorf("recorded = %+v, want operations=\"10 + 4\" result=\"14\"", fake.inserted[0])
	}
}

func TestCalculateHandlerResponseIncludesHistoryRecord(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "10", "b": "4"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", &buf)
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	var payload struct {
		Result  string `json:"result"`
		History *struct {
			ID         string `json:"id"`
			Operations string `json:"operations"`
			Result     string `json:"result"`
		} `json:"history"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if payload.History == nil {
		t.Fatalf("history = nil, want the recorded entry")
	}
	if payload.History.ID == "" {
		t.Errorf("history.id is empty, want a UUID")
	}
	if payload.History.Operations != "10 + 4" || payload.History.Result != "14" {
		t.Errorf("history = %+v, want operations=\"10 + 4\" result=\"14\"", payload.History)
	}
}

func TestCalculateHandlerResponseHistoryIsNullWhenNoStoreConfigured(t *testing.T) {
	rec, payload := doCalculate(t, "add", map[string]string{"a": "10", "b": "4"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["history"] != nil {
		t.Errorf("history = %v, want nil (no History store configured)", payload["history"])
	}
}

func TestCalculateHandlerResponseHistoryIsNullWhenInsertFails(t *testing.T) {
	fake := &fakeHistoryStore{insertErr: errors.New("db is down")}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "10", "b": "4"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", &buf)
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (history failures must not break a working calculation)", rec.Code, http.StatusOK)
	}
	if payload["history"] != nil {
		t.Errorf("history = %v, want nil (insert failed)", payload["history"])
	}
}

func TestCalculateHandlerRecordsUnaryHistoryOnSuccess(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "16"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/sqrt", &buf)
	req.SetPathValue("operation", "sqrt")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	if len(fake.inserted) != 1 {
		t.Fatalf("history inserts = %d, want 1", len(fake.inserted))
	}
	if fake.inserted[0].operations != "sqrt(16)" || fake.inserted[0].result != "4" {
		t.Errorf("recorded = %+v, want operations=\"sqrt(16)\" result=\"4\"", fake.inserted[0])
	}
}

func TestCalculateHandlerRecordsIdentityHistoryAsBareNumber(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "1e2"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/identity", &buf)
	req.SetPathValue("operation", "identity")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	if len(fake.inserted) != 1 {
		t.Fatalf("history inserts = %d, want 1", len(fake.inserted))
	}
	if fake.inserted[0].operations != "100" || fake.inserted[0].result != "100" {
		t.Errorf("recorded = %+v, want operations=\"100\" result=\"100\"", fake.inserted[0])
	}
}

func TestCalculateHandlerDoesNotRecordHistoryOnError(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "10", "b": "0"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/divide", &buf)
	req.SetPathValue("operation", "divide")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if len(fake.inserted) != 0 {
		t.Errorf("history inserts = %d, want 0 (a failed calculation should not be recorded)", len(fake.inserted))
	}
}

func TestCalculateHandlerSucceedsEvenIfHistoryInsertFails(t *testing.T) {
	fake := &fakeHistoryStore{insertErr: errors.New("db is down")}
	api := &API{History: fake}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(map[string]string{"a": "2", "b": "2"}); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", &buf)
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	api.CalculateHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (history failures must not break a working calculation)", rec.Code, http.StatusOK)
	}
}

func TestListHistoryHandlerReturnsItemsAndForwardsCursorAndLimit(t *testing.T) {
	nextCreatedAt := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	fake := &fakeHistoryStore{
		entries: []history.Entry{
			{ID: 42, Operations: "1 + 2", Result: "3", CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
		},
		nextCursor: &history.Cursor{CreatedAt: nextCreatedAt, ID: 5},
	}
	api := &API{History: fake}

	reqCreatedAt := time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC)
	cursorParam := fmt.Sprintf("%d_10", reqCreatedAt.UnixMicro())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/history?limit=1&cursor="+cursorParam, nil)
	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var payload struct {
		Items []struct {
			ID         string `json:"id"`
			Operations string `json:"operations"`
			Result     string `json:"result"`
		} `json:"items"`
		NextCursor *string `json:"nextCursor"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(payload.Items) != 1 || payload.Items[0].ID != "42" || payload.Items[0].Operations != "1 + 2" {
		t.Fatalf("items = %+v, want the one fake entry", payload.Items)
	}
	wantNextCursor := fmt.Sprintf("%d_5", nextCreatedAt.UnixMicro())
	if payload.NextCursor == nil || *payload.NextCursor != wantNextCursor {
		t.Errorf("nextCursor = %v, want %q", payload.NextCursor, wantNextCursor)
	}

	if fake.gotLimit != 1 {
		t.Errorf("List() called with limit = %d, want 1", fake.gotLimit)
	}
	if fake.gotCursor == nil || fake.gotCursor.ID != 10 || !fake.gotCursor.CreatedAt.Equal(reqCreatedAt) {
		t.Errorf("List() called with cursor = %+v, want {CreatedAt: %v, ID: 10}", fake.gotCursor, reqCreatedAt)
	}
}

func TestListHistoryHandlerDefaultsAndCapsLimit(t *testing.T) {
	fake := &fakeHistoryStore{}
	api := &API{History: fake}

	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history", nil))
	if fake.gotLimit != defaultHistoryLimit {
		t.Errorf("default limit = %d, want %d", fake.gotLimit, defaultHistoryLimit)
	}

	rec2 := httptest.NewRecorder()
	api.ListHistoryHandler(rec2, httptest.NewRequest(http.MethodGet, "/api/v1/history?limit=99999", nil))
	if fake.gotLimit != maxHistoryLimit {
		t.Errorf("capped limit = %d, want %d", fake.gotLimit, maxHistoryLimit)
	}
}

func TestListHistoryHandlerInvalidLimit(t *testing.T) {
	api := &API{History: &fakeHistoryStore{}}
	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history?limit=abc", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestListHistoryHandlerInvalidCursor(t *testing.T) {
	api := &API{History: &fakeHistoryStore{}}
	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history?cursor=abc", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestListHistoryHandlerNoStoreConfigured(t *testing.T) {
	api := &API{}
	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestListHistoryHandlerStoreError(t *testing.T) {
	api := &API{History: &fakeHistoryStore{listErr: errors.New("boom")}}
	rec := httptest.NewRecorder()
	api.ListHistoryHandler(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}
