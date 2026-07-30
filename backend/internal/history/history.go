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
	"github.com/google/uuid"
)

// Entry is a single recorded calculation.
type Entry struct {
	ID         string
	Operations string
	Result     string
	CreatedAt  time.Time
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

// Insert records a completed calculation and returns the stored entry.
func (s *Store) Insert(ctx context.Context, operations, result string) (Entry, error) {
	entry := Entry{
		ID:         uuid.NewString(),
		Operations: operations,
		Result:     result,
		CreatedAt:  time.Now().UTC(),
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO history (id, operations, result, created_at) VALUES (?, ?, ?, ?)`,
		entry.ID, entry.Operations, entry.Result, entry.CreatedAt,
	)
	if err != nil {
		return Entry{}, fmt.Errorf("insert history entry: %w", err)
	}

	return entry, nil
}

// List returns up to limit entries older than cursor (a nil cursor starts
// from the most recent entry), newest first, plus the cursor to pass in
// order to fetch the next page (nil if there isn't one).
func (s *Store) List(ctx context.Context, cursor *int64, limit int) ([]Entry, *int64, error) {
	query := `SELECT seq, id, operations, result, created_at FROM history`
	args := []any{}
	if cursor != nil {
		query += ` WHERE seq < ?`
		args = append(args, *cursor)
	}
	query += ` ORDER BY seq DESC LIMIT ?`
	// Fetch one extra row so we know whether a next page exists without a
	// separate COUNT query.
	args = append(args, limit+1)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, nil, fmt.Errorf("list history: %w", err)
	}
	defer rows.Close()

	type fetchedRow struct {
		seq int64
		Entry
	}
	var fetched []fetchedRow
	for rows.Next() {
		var r fetchedRow
		if err := rows.Scan(&r.seq, &r.ID, &r.Operations, &r.Result, &r.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan history row: %w", err)
		}
		fetched = append(fetched, r)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate history rows: %w", err)
	}

	var nextCursor *int64
	if len(fetched) > limit {
		fetched = fetched[:limit]
		last := fetched[len(fetched)-1].seq
		nextCursor = &last
	}

	entries := make([]Entry, len(fetched))
	for i, r := range fetched {
		entries[i] = r.Entry
	}
	return entries, nextCursor, nil
}
