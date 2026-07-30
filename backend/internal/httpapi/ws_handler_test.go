package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"sezzle-calculator/backend/internal/history"
)

func dialSync(t *testing.T, server *httptest.Server) *websocket.Conn {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := "ws" + server.URL[len("http"):] + "/api/v1/history/sync"
	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return conn
}

func strPtr(s string) *string { return &s }

func TestHistorySyncHandlerStreamsEntriesSinceCursorThenCloses(t *testing.T) {
	fake := &fakeHistoryStore{
		sinceEntries: []history.Entry{
			{ID: 1, Operations: "1 + 1", Result: "2", CreatedAt: time.Now().UTC()},
			{ID: 2, Operations: "2 + 2", Result: "4", CreatedAt: time.Now().UTC()},
		},
	}
	api := &API{History: fake}
	server := httptest.NewServer(http.HandlerFunc(api.HistorySyncHandler))
	defer server.Close()

	conn := dialSync(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursorCreatedAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cursorParam := fmt.Sprintf("%d_10", cursorCreatedAt.UnixMicro())
	if err := wsjson.Write(ctx, conn, syncRequest{Cursor: strPtr(cursorParam)}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	var got []HistoryItem
	var readErr error
	for {
		var item HistoryItem
		if readErr = wsjson.Read(ctx, conn, &item); readErr != nil {
			break
		}
		got = append(got, item)
	}

	if len(got) != 2 || got[0].ID != "1" || got[1].ID != "2" {
		t.Fatalf("received = %+v, want the two fake entries in order", got)
	}
	if fake.gotSinceCursor == nil || fake.gotSinceCursor.ID != 10 || !fake.gotSinceCursor.CreatedAt.Equal(cursorCreatedAt) {
		t.Errorf("ListSince() called with cursor = %+v, want {CreatedAt: %v, ID: 10}", fake.gotSinceCursor, cursorCreatedAt)
	}
	if status := websocket.CloseStatus(readErr); status != websocket.StatusNormalClosure {
		t.Errorf("close status = %v, want StatusNormalClosure", status)
	}
}

func TestHistorySyncHandlerNilCursorSyncsFromBeginning(t *testing.T) {
	fake := &fakeHistoryStore{sinceEntries: []history.Entry{{ID: 1, Operations: "1 + 1", Result: "2"}}}
	api := &API{History: fake}
	server := httptest.NewServer(http.HandlerFunc(api.HistorySyncHandler))
	defer server.Close()

	conn := dialSync(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := wsjson.Write(ctx, conn, syncRequest{}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	var item HistoryItem
	if err := wsjson.Read(ctx, conn, &item); err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if item.ID != "1" {
		t.Errorf("received = %+v, want the fake entry", item)
	}
	if fake.gotSinceCursor != nil {
		t.Errorf("ListSince() called with cursor = %v, want nil", fake.gotSinceCursor)
	}
}

func TestHistorySyncHandlerInvalidCursorClosesWithPolicyViolation(t *testing.T) {
	api := &API{History: &fakeHistoryStore{}}
	server := httptest.NewServer(http.HandlerFunc(api.HistorySyncHandler))
	defer server.Close()

	conn := dialSync(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := wsjson.Write(ctx, conn, syncRequest{Cursor: strPtr("not-a-number")}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	var item HistoryItem
	err := wsjson.Read(ctx, conn, &item)
	if status := websocket.CloseStatus(err); status != websocket.StatusPolicyViolation {
		t.Errorf("close status = %v, want StatusPolicyViolation", status)
	}
}

func TestHistorySyncHandlerNoStoreConfiguredClosesWithInternalError(t *testing.T) {
	api := &API{}
	server := httptest.NewServer(http.HandlerFunc(api.HistorySyncHandler))
	defer server.Close()

	conn := dialSync(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var item HistoryItem
	err := wsjson.Read(ctx, conn, &item)
	if status := websocket.CloseStatus(err); status != websocket.StatusInternalError {
		t.Errorf("close status = %v, want StatusInternalError", status)
	}
}

func TestHistorySyncHandlerStoreErrorClosesWithInternalError(t *testing.T) {
	api := &API{History: &fakeHistoryStore{sinceErr: errors.New("boom")}}
	server := httptest.NewServer(http.HandlerFunc(api.HistorySyncHandler))
	defer server.Close()

	conn := dialSync(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := wsjson.Write(ctx, conn, syncRequest{}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	var item HistoryItem
	err := wsjson.Read(ctx, conn, &item)
	if status := websocket.CloseStatus(err); status != websocket.StatusInternalError {
		t.Errorf("close status = %v, want StatusInternalError", status)
	}
}
