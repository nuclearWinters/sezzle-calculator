package history

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/go-sql-driver/mysql"
)

func newMockStore(t *testing.T) (*Store, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() { db.Close() })

	return &Store{db: db}, mock
}

func TestStoreClose(t *testing.T) {
	store, mock := newMockStore(t)
	mock.ExpectClose()

	if err := store.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestOpenReturnsErrorWhenPingFails(t *testing.T) {
	cfg := mysql.NewConfig()
	cfg.Net = "tcp"
	cfg.Addr = "127.0.0.1:1"
	cfg.User = "calculator"
	cfg.Passwd = "calculator"
	cfg.DBName = "calculator"
	cfg.Timeout = 200 * time.Millisecond

	_, err := Open(*cfg)
	if err == nil {
		t.Fatal("Open() error = nil, want a ping error against an unreachable address")
	}
}

func TestStoreInsert(t *testing.T) {
	store, mock := newMockStore(t)
	ctx := context.Background()

	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO history (operations, result, created_at) VALUES (?, ?, ?)")).
		WithArgs("2 + 3", "5", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(7, 1))

	entry, err := store.Insert(ctx, "2 + 3", "5")
	if err != nil {
		t.Fatalf("Insert() error = %v", err)
	}
	if entry.ID != 7 || entry.Operations != "2 + 3" || entry.Result != "5" {
		t.Errorf("entry = %+v, want ID=7 Operations=\"2 + 3\" Result=\"5\"", entry)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestStoreInsertExecError(t *testing.T) {
	store, mock := newMockStore(t)

	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO history")).
		WillReturnError(errors.New("connection reset"))

	if _, err := store.Insert(context.Background(), "2 + 3", "5"); err == nil {
		t.Fatal("Insert() error = nil, want an error when the exec fails")
	}
}

func TestStoreInsertLastInsertIdError(t *testing.T) {
	store, mock := newMockStore(t)

	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO history")).
		WillReturnResult(sqlmock.NewErrorResult(errors.New("no LAST_INSERT_ID")))

	if _, err := store.Insert(context.Background(), "2 + 3", "5"); err == nil {
		t.Fatal("Insert() error = nil, want an error when reading the inserted id fails")
	}
}

func TestStoreListWithoutCursorNoNextPage(t *testing.T) {
	store, mock := newMockStore(t)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"}).
		AddRow(int64(2), "3 + 3", "6", now.Add(time.Minute)).
		AddRow(int64(1), "1 + 1", "2", now)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history ORDER BY created_at DESC, id DESC LIMIT ?")).
		WithArgs(3).
		WillReturnRows(rows)

	entries, nextCursor, err := store.List(context.Background(), nil, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("len(entries) = %d, want 2", len(entries))
	}
	if nextCursor != nil {
		t.Errorf("nextCursor = %+v, want nil (only 2 rows for a page size of 2)", nextCursor)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestStoreListWithCursorReturnsNextCursorWhenMoreRowsExist(t *testing.T) {
	store, mock := newMockStore(t)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cursor := &Cursor{CreatedAt: now.Add(time.Hour), ID: 99}

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"}).
		AddRow(int64(3), "3 + 3", "6", now.Add(2*time.Minute)).
		AddRow(int64(2), "2 + 2", "4", now.Add(time.Minute)).
		AddRow(int64(1), "1 + 1", "2", now)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?")).
		WithArgs(cursor.CreatedAt, cursor.ID, 3).
		WillReturnRows(rows)

	entries, nextCursor, err := store.List(context.Background(), cursor, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(entries) != 2 || entries[0].ID != 3 || entries[1].ID != 2 {
		t.Fatalf("entries = %+v, want the first 2 rows (trimmed from 3)", entries)
	}
	if nextCursor == nil || nextCursor.ID != 2 || !nextCursor.CreatedAt.Equal(now.Add(time.Minute)) {
		t.Errorf("nextCursor = %+v, want {ID: 2, CreatedAt: %v}", nextCursor, now.Add(time.Minute))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestStoreListQueryError(t *testing.T) {
	store, mock := newMockStore(t)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history")).
		WillReturnError(errors.New("connection reset"))

	if _, _, err := store.List(context.Background(), nil, 20); err == nil {
		t.Fatal("List() error = nil, want an error when the query fails")
	}
}

func TestStoreListScanError(t *testing.T) {
	store, mock := newMockStore(t)

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"}).
		AddRow("not-an-int", "1 + 1", "2", time.Now())

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history")).
		WillReturnRows(rows)

	if _, _, err := store.List(context.Background(), nil, 20); err == nil {
		t.Fatal("List() error = nil, want a scan error for a malformed row")
	}
}

func TestStoreListRowsIterationError(t *testing.T) {
	store, mock := newMockStore(t)

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"}).
		AddRow(int64(1), "1 + 1", "2", time.Now()).
		RowError(0, errors.New("row read failure"))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history")).
		WillReturnRows(rows)

	if _, _, err := store.List(context.Background(), nil, 20); err == nil {
		t.Fatal("List() error = nil, want an error when row iteration fails")
	}
}

func TestStoreListSinceWithoutCursor(t *testing.T) {
	store, mock := newMockStore(t)
	now := time.Now().UTC()

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"}).
		AddRow(int64(1), "1 + 1", "2", now)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history ORDER BY created_at ASC, id ASC")).
		WillReturnRows(rows)

	entries, err := store.ListSince(context.Background(), nil)
	if err != nil {
		t.Fatalf("ListSince() error = %v", err)
	}
	if len(entries) != 1 || entries[0].ID != 1 {
		t.Fatalf("entries = %+v, want the one fake row", entries)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestStoreListSinceWithCursor(t *testing.T) {
	store, mock := newMockStore(t)
	cursor := &Cursor{CreatedAt: time.Now().UTC(), ID: 5}

	rows := sqlmock.NewRows([]string{"id", "operations", "result", "created_at"})

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history WHERE (created_at, id) > (?, ?) ORDER BY created_at ASC, id ASC")).
		WithArgs(cursor.CreatedAt, cursor.ID).
		WillReturnRows(rows)

	entries, err := store.ListSince(context.Background(), cursor)
	if err != nil {
		t.Fatalf("ListSince() error = %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("entries = %+v, want none", entries)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestStoreListSinceQueryError(t *testing.T) {
	store, mock := newMockStore(t)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, operations, result, created_at FROM history")).
		WillReturnError(errors.New("connection reset"))

	if _, err := store.ListSince(context.Background(), nil); err == nil {
		t.Fatal("ListSince() error = nil, want an error when the query fails")
	}
}
