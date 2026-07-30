package history

import (
	"context"
	"os"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()

	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set; skipping MySQL-backed integration test")
	}

	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		t.Fatalf("parse TEST_DB_DSN: %v", err)
	}

	store, err := Open(*cfg)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { store.Close() })

	if _, err := store.db.Exec("DELETE FROM history"); err != nil {
		t.Fatalf("failed to reset history table: %v", err)
	}

	return store
}

func TestInsertRoundTrip(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()

	entry, err := store.Insert(ctx, "10 + 4", "14")
	if err != nil {
		t.Fatalf("Insert() error = %v", err)
	}
	if entry.ID == 0 {
		t.Errorf("entry.ID is 0, want the auto-assigned id")
	}
	if entry.Operations != "10 + 4" || entry.Result != "14" {
		t.Errorf("entry = %+v, want Operations=\"10 + 4\" Result=\"14\"", entry)
	}

	entries, _, err := store.List(ctx, nil, 1)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(entries) != 1 || entries[0].ID != entry.ID {
		t.Fatalf("List() = %+v, want the just-inserted entry", entries)
	}
}

func TestListPagination(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if _, err := store.Insert(ctx, "1 + 1", "2"); err != nil {
			t.Fatalf("Insert() error = %v", err)
		}
	}

	firstPage, nextCursor, err := store.List(ctx, nil, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(firstPage) != 2 {
		t.Fatalf("len(firstPage) = %d, want 2", len(firstPage))
	}
	if nextCursor == nil {
		t.Fatalf("nextCursor = nil, want non-nil (3 rows inserted, page size 2)")
	}

	secondPage, nextCursor2, err := store.List(ctx, nextCursor, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(secondPage) != 1 {
		t.Fatalf("len(secondPage) = %d, want 1", len(secondPage))
	}
	if nextCursor2 != nil {
		t.Fatalf("nextCursor2 = %v, want nil (no more pages)", *nextCursor2)
	}

	if firstPage[0].CreatedAt.Before(secondPage[0].CreatedAt) {
		t.Errorf("firstPage[0].CreatedAt (%v) should not be before secondPage[0].CreatedAt (%v)",
			firstPage[0].CreatedAt, secondPage[0].CreatedAt)
	}
}

func TestListSinceFromBeginning(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()

	var inserted []Entry
	for i := 0; i < 3; i++ {
		entry, err := store.Insert(ctx, "1 + 1", "2")
		if err != nil {
			t.Fatalf("Insert() error = %v", err)
		}
		inserted = append(inserted, entry)
	}

	all, err := store.ListSince(ctx, nil)
	if err != nil {
		t.Fatalf("ListSince(nil) error = %v", err)
	}
	if len(all) != 3 || all[0].ID != inserted[0].ID || all[2].ID != inserted[2].ID {
		t.Fatalf("ListSince(nil) = %+v, want all 3 entries oldest-first", all)
	}
}

func TestListSinceSharesCursorWithList(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()

	var inserted []Entry
	for i := 0; i < 3; i++ {
		entry, err := store.Insert(ctx, "1 + 1", "2")
		if err != nil {
			t.Fatalf("Insert() error = %v", err)
		}
		inserted = append(inserted, entry)
	}

	page, cursor, err := store.List(ctx, nil, 1)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(page) != 1 || page[0].ID != inserted[2].ID || cursor == nil {
		t.Fatalf("List(nil, 1) = %+v, cursor = %v, want the newest entry with a cursor", page, cursor)
	}

	fourth, err := store.Insert(ctx, "2 + 2", "4")
	if err != nil {
		t.Fatalf("Insert() error = %v", err)
	}

	sinceEntries, err := store.ListSince(ctx, cursor)
	if err != nil {
		t.Fatalf("ListSince() error = %v", err)
	}
	if len(sinceEntries) != 1 || sinceEntries[0].ID != fourth.ID {
		t.Fatalf("ListSince(cursor) = %+v, want just the entry added after the page's boundary", sinceEntries)
	}
}
