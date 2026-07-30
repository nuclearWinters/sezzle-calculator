-- Auto-applied by the MySQL container on first startup (mounted at
-- /docker-entrypoint-initdb.d — see docker-compose.yml).
--
-- Cursor-based pagination (both the GET /history REST endpoint and the
-- history sync WebSocket) seeks by the composite (created_at, id) key
-- rather than id alone: WHERE (created_at, id) < (?, ?) / > (?, ?) ORDER BY
-- created_at, id. created_at on its own isn't a safe seek key — TIMESTAMP(6)
-- is only microsecond resolution, so two rows can legitimately collide
-- under fast concurrent inserts — id (auto-increment, always unique) breaks
-- the tie. The composite index below makes that seek an index range scan
-- instead of a table scan.
CREATE TABLE IF NOT EXISTS history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operations VARCHAR(255) NOT NULL,
  result VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_history_created_at_id (created_at, id)
);
