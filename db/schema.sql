-- Auto-applied by the MySQL container on first startup (mounted at
-- /docker-entrypoint-initdb.d — see docker-compose.yml).
--
-- `seq` is a purely-internal auto-increment key used only for stable
-- cursor-based pagination ordering (WHERE seq < ? ORDER BY seq DESC).
-- `id` is the public UUID clients see and reference.
CREATE TABLE IF NOT EXISTS history (
  seq BIGINT AUTO_INCREMENT PRIMARY KEY,
  id CHAR(36) NOT NULL,
  operations VARCHAR(255) NOT NULL,
  result VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_history_id (id)
);
