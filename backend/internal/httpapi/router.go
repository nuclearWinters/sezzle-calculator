package httpapi

import "net/http"

func NewRouter(api *API, enableFlakiness bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", HealthHandler)
	mux.Handle("POST /api/v1/calculate/{operation}", withOptionalFlakiness(api.CalculateHandler, enableFlakiness))
	mux.Handle("GET /api/v1/history", withOptionalFlakiness(api.ListHistoryHandler, enableFlakiness))
	mux.HandleFunc("GET /api/v1/history/sync", api.HistorySyncHandler)

	return withLogging(withCORS(mux))
}
