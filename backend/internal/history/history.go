// Package history persists completed calculations to MySQL and lists them
// back with cursor-based pagination. Plain database/sql — no ORM, matching
// this project's stdlib-first approach elsewhere (see internal/calculator,
// internal/httpapi).
package history

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

// Entry is a single recorded calculation. ID is the table's auto-increment
// primary key — it doubles as both the row's public identifier and (paired
// with CreatedAt) its keyset pagination position; see Cursor.
type Entry struct {
	ID         int64
	Operations string
	Result     string
	CreatedAt  time.Time
}

// Cursor identifies a position in the history table's (created_at, id)
// keyset ordering. created_at alone isn't a safe seek key — two rows can
// share the same microsecond under fast concurrent inserts — so id
// (monotonic, always unique) breaks the tie.
type Cursor struct {
	CreatedAt time.Time
	ID        int64
}

// Store persists calculation history to MySQL.
type Store struct {
	db *sql.DB
}

// Open connects to MySQL using cfg and verifies the connection with a ping.
// ParseTime and Loc are forced to UTC regardless of what cfg specifies,
// since List/Insert depend on scanning created_at directly into time.Time.
func Open(cfg mysql.Config) (*Store, error) {
	cfg.ParseTime = true
	cfg.Loc = time.UTC

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("open mysql connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}

	return &Store{db: db}, nil
}

// Close releases the underlying connection pool.
func (s *Store) Close() error {
	return s.db.Close()
}

// Insert records a completed calculation and returns the stored entry,
// including the id MySQL assigned it.
func (s *Store) Insert(ctx context.Context, operations, result string) (Entry, error) {
	entry := Entry{
		Operations: operations,
		Result:     result,
		CreatedAt:  time.Now().UTC(),
	}

	res, err := s.db.ExecContext(
		ctx,
		`INSERT INTO history (operations, result, created_at) VALUES (?, ?, ?)`,
		entry.Operations, entry.Result, entry.CreatedAt,
	)
	if err != nil {
		return Entry{}, fmt.Errorf("insert history entry: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return Entry{}, fmt.Errorf("read inserted history id: %w", err)
	}
	entry.ID = id

	return entry, nil
}

// List returns up to limit entries strictly before cursor in (created_at,
// id) order (a nil cursor starts from the most recent entry), newest
// first, plus the cursor to pass in order to fetch the next page (nil if
// there isn't one).
func (s *Store) List(ctx context.Context, cursor *Cursor, limit int) ([]Entry, *Cursor, error) {
	query := `SELECT id, operations, result, created_at FROM history`
	args := []any{}
	if cursor != nil {
		query += ` WHERE (created_at, id) < (?, ?)`
		args = append(args, cursor.CreatedAt, cursor.ID)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ?`
	// Fetch one extra row so we know whether a next page exists without a
	// separate COUNT query.
	args = append(args, limit+1)

	fetched, err := s.query(ctx, query, args...)
	if err != nil {
		return nil, nil, fmt.Errorf("list history: %w", err)
	}

	var nextCursor *Cursor
	if len(fetched) > limit {
		fetched = fetched[:limit]
		last := fetched[len(fetched)-1]
		nextCursor = &Cursor{CreatedAt: last.CreatedAt, ID: last.ID}
	}

	return fetched, nextCursor, nil
}

// ListSince returns every entry strictly after cursor in (created_at, id)
// order (a nil cursor starts from the very beginning of history), oldest
// first. It's the same keyset-seek query as List — same cursor, same
// table, same (created_at, id) key — just walking the opposite direction:
// List seeks backward (newest first) to paginate through history already
// seen, while ListSince seeks forward (oldest first) to replay whatever's
// been added since.
func (s *Store) ListSince(ctx context.Context, cursor *Cursor) ([]Entry, error) {
	query := `SELECT id, operations, result, created_at FROM history`
	args := []any{}
	if cursor != nil {
		query += ` WHERE (created_at, id) > (?, ?)`
		args = append(args, cursor.CreatedAt, cursor.ID)
	}
	query += ` ORDER BY created_at ASC, id ASC`

	entries, err := s.query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list history since cursor: %w", err)
	}

	return entries, nil
}

func (s *Store) query(ctx context.Context, query string, args ...any) ([]Entry, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.Operations, &e.Result, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan history row: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate history rows: %w", err)
	}

	return entries, nil
}
