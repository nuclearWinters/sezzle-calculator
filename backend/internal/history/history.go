package history

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

type Entry struct {
	ID         int64
	Operations string
	Result     string
	CreatedAt  time.Time
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}

type Store struct {
	db *sql.DB
}

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

func (s *Store) Close() error {
	return s.db.Close()
}

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

func (s *Store) List(ctx context.Context, cursor *Cursor, limit int) ([]Entry, *Cursor, error) {
	query := `SELECT id, operations, result, created_at FROM history`
	args := []any{}
	if cursor != nil {
		query += ` WHERE (created_at, id) < (?, ?)`
		args = append(args, cursor.CreatedAt, cursor.ID)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ?`
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
