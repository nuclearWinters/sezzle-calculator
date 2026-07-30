# Sezzle Calculator

A full-stack calculator: a Go REST API performs every calculation, and a
React + TypeScript frontend provides the UI. No arithmetic happens in the
browser — the frontend only collects input and renders whatever the backend
returns. Every successful calculation is recorded to MySQL and browsable as
an infinite-scrolling history feed.

```
sezzle-calculator/
├── backend/            Go REST API
│   ├── cmd/server/      entrypoint (main.go)
│   └── internal/
│       ├── calculator/  pure arithmetic functions + unit tests
│       ├── history/     MySQL-backed calculation history + cursor pagination
│       └── httpapi/     HTTP handlers, router, middleware + tests
├── frontend/            React + TypeScript UI (Vite)
│   └── src/
│       ├── api/          typed fetch clients for the backend
│       ├── components/   Calculator + History (infinite scroll) UI
│       └── types/        shared request/response types
├── db/                  schema.sql, auto-applied to the MySQL container
└── docker-compose.yml   run backend + frontend + MySQL together
```

## Design rationale

- **Calculations live on the backend.** The frontend never evaluates
  arithmetic itself; every operator button triggers a `POST` to the API and
  renders the returned `result`. This keeps business rules (e.g. what counts
  as "divide by zero") in one place and makes the calculator trivially
  reusable by other clients.
- **Exact decimal arithmetic, not `float64`.** Both sides use arbitrary-precision
  decimals (`decimal.js` frontend, `shopspring/decimal` backend), and numbers
  travel over the wire as JSON strings rather than numbers — so results like
  `1e30 - 1e20` stay exact instead of being silently rounded the way a
  `float64` would round them. `calculator.Power` still guards against
  pathologically large exponents (`MaxResultDigits`) since arbitrary
  precision removes `float64`'s natural ceiling on how large a result can get.
- **Backend layering.** `internal/calculator` holds pure, dependency-free
  functions (easy to unit test in isolation). `internal/history` is the only
  package that talks to MySQL (plain `database/sql`, no ORM). `internal/httpapi`
  only handles transport concerns — JSON decoding, validation, status codes —
  and delegates math to `calculator` and persistence to `history` (through a
  small `HistoryStore` interface, so handler tests don't need a live database).
- **Stdlib-only router.** Go 1.22+'s `net/http.ServeMux` supports method +
  path-parameter routing (`POST /api/v1/calculate/{operation}`), so no router
  dependency (chi, gin, etc.) was needed for an API this small.
- **One generic endpoint vs. one-per-operation.** `POST /api/v1/calculate/{operation}`
  keeps the handler and validation logic in one place while still reading as
  a clear, RESTful path per operation.
- **Cursor-based history pagination.** `history` rows have an internal
  auto-increment `seq` used purely for stable pagination ordering
  (`WHERE seq < ? ORDER BY seq DESC`), separate from the public UUID `id`
  clients see. The frontend never needs to understand this — it just passes
  back whatever opaque `nextCursor` string the previous page returned.
- **Mocked flakiness.** Every `/calculate` and `/history` request is delayed
  1-3s and fails outright ~10% of the time (`internal/httpapi/flakiness.go`),
  to exercise real loading/error states in the frontend instead of talking to
  an instant, always-successful backend. `/health` is exempt (liveness probes
  shouldn't be artificially degraded), and it's disabled entirely in tests
  (`NewRouter`'s `enableFlakiness` parameter) so `go test` stays fast and
  deterministic.
- **History is best-effort.** A calculation succeeding is never blocked on
  MySQL: `CalculateHandler` logs (and swallows) history-insert failures
  rather than failing the response, and the server itself starts even if it
  can't reach MySQL at boot (it just runs without history).
- **Styling with StyleX.** Component styles live in `stylex.create()` calls
  colocated with the component (see `Calculator.tsx`) and compile to atomic,
  deduplicated CSS at build time via `@stylexjs/unplugin` — no runtime
  style-injection cost and no class-name collisions to manage by hand. Truly
  global concerns (the `<body>` reset) stay in a small `index.css` since
  StyleX only ever styles React-rendered elements, not the document itself.
- **Frontend state machine.** The `Calculator` component tracks
  `previousOperand` / `pendingOperation` / `overwrite` the way a physical
  calculator does, so operators can be chained (`2 + 3 + 4 =`) and the
  unary `√` button applies immediately to whatever is on screen.
- **Responsive keypad.** The card width (`min(360px, calc(100vw - 32px))`)
  and the keypad's grid columns (`1fr` instead of a fixed px) let the
  calculator shrink to fit narrow phone viewports instead of overflowing;
  keys keep a 44px-minimum touch target per mobile accessibility guidance.

## Requirements

- Go 1.23+
- Node.js 20+ and npm
- MySQL 8+ (or Docker — see below) if you want calculation history

## Backend

```bash
cd backend
go test ./...                                          # unit + handler tests (fast, no DB needed)
go test -coverprofile=coverage.out ./... && \
  go tool cover -func=coverage.out                      # coverage report (terminal)
go tool cover -html=coverage.out -o coverage.html        # coverage report (HTML)
go run ./cmd/server
```

The server starts on `:8080` (override with the `PORT` env var). CORS origin
defaults to `*`; set `ALLOWED_ORIGIN` to lock it down in production.

`internal/history`'s own tests talk to a real MySQL and are skipped unless
`TEST_DB_DSN` is set:

```bash
docker compose up -d mysql
TEST_DB_DSN="calculator:calculator@tcp(127.0.0.1:3306)/calculator" go test ./internal/history/...
```

### Database

`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` configure the
MySQL connection (defaults match `docker-compose.yml`'s `calculator`/`calculator`/
`calculator`). `db/schema.sql` is auto-applied by the official MySQL image on
first container start (mounted at `/docker-entrypoint-initdb.d`) — no
migration tooling needed for the one `history` table.

### API usage

`POST /api/v1/calculate/{operation}`

`operation` is one of: `add`, `subtract`, `multiply`, `divide`, `power`,
`percentage`, `sqrt`, `identity`. `a`/`b` are decimal strings, not JSON
numbers, so arbitrary precision survives the request; `b` is required for
every operation except the two unary ones (`sqrt`, `identity`). `identity`
just returns `a` unchanged — it's what the frontend calls when you type a
bare number (e.g. `1e2`) and press `=` with no operator chosen, so
normalizing it (`1e2` → `100`) and recording it to history goes through the
same backend round trip as every other operation instead of the frontend
quietly computing it itself:

```json
{ "a": "10", "b": "4" }
```

Success response (`200`):

```json
{ "result": "14" }
```

Error response (`400`, e.g. division by zero, negative square root, a
`power` result too large to represent, missing field, or malformed JSON;
`500` for the ~10% simulated failure):

```json
{ "error": "division by zero is not allowed" }
```

`GET /api/v1/history?cursor=&limit=` — calculation history, newest first.
`cursor` is the previous page's `nextCursor` (omit for the first page);
`limit` defaults to 20, capped at 100.

```json
{
  "items": [
    { "id": "…", "operations": "10 + 4", "result": "14", "createdAt": "2026-01-01T00:00:00Z" }
  ],
  "nextCursor": "41"
}
```

`nextCursor` is `null` once there are no more pages. `503` if MySQL isn't
reachable.

Example:

```bash
curl -X POST http://localhost:8080/api/v1/calculate/add \
  -H "Content-Type: application/json" \
  -d '{"a": "10", "b": "4"}'
```

`GET /api/v1/health` returns `{"status": "ok"}` for liveness checks (not
subject to the mocked delay/failures).

## Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
npm test                # Vitest + React Testing Library
npm run test:coverage   # coverage report (terminal + coverage/index.html)
npm run build           # type-check + production build
```

Copy `.env.example` to `.env` and set `VITE_API_URL` if the backend isn't
running on `http://localhost:8080`.

## Run everything with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- MySQL: localhost:3306 (`calculator`/`calculator`, database `calculator`)

`docker-compose.dev.yml` runs the same three services with hot-reload
(`air` for the backend, Vite's dev server for the frontend) instead of
production builds:

```bash
docker compose -f docker-compose.dev.yml up
```

## Testing summary

- **Backend:** `internal/calculator` has table-style unit tests for every
  operation, including division-by-zero, negative-square-root, and
  pathologically-large-`power` edge cases, plus regressions for exact
  large-magnitude arithmetic (e.g. `1e30 - 1e20`) that a `float64` would
  round. `internal/history` has MySQL-backed integration tests (see above).
  `internal/httpapi` has `httptest`-based handler tests — including history
  recording/pagination against an in-memory fake `HistoryStore` — and a full
  router end-to-end test.
- **Frontend:** `Calculator.test.tsx` mocks `fetch` to verify the component
  sends the right request body, renders the backend's result, surfaces
  backend error messages instead of crashing, and rejects invalid input
  before it ever reaches the API. `History.test.tsx` mocks `fetch` and
  `IntersectionObserver` to verify the first page loads on mount, scrolling
  the sentinel into view fetches the next page with the right cursor, and a
  failed page load shows a retry option. Run `npm run test:coverage` for a
  per-file breakdown.
