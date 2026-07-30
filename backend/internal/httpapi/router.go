package httpapi

import "net/http"

// NewRouter builds the HTTP handler for the calculator API. enableFlakiness
// gates the mocked delay/random-failure middleware on /calculate and
// /history — real usage (cmd/server) always passes true; tests pass false
// to stay fast and deterministic. /health is never subject to it, since a
// liveness probe shouldn't be artificially degraded. /history/sync (the
// WebSocket backlog sync) isn't either — it upgrades the connection itself,
// which the mocked-delay/failure middleware isn't meant to intercept.
func NewRouter(api *API, enableFlakiness bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", HealthHandler)
	mux.Handle("POST /api/v1/calculate/{operation}", withOptionalFlakiness(api.CalculateHandler, enableFlakiness))
	mux.Handle("GET /api/v1/history", withOptionalFlakiness(api.ListHistoryHandler, enableFlakiness))
	mux.HandleFunc("GET /api/v1/history/sync", api.HistorySyncHandler)

	return withLogging(withCORS(mux))
}
