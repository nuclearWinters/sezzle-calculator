package httpapi

import (
	"math/rand/v2"
	"net/http"
	"time"
)

func withMockedFlakiness(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		delay := time.Second + time.Duration(rand.IntN(2001))*time.Millisecond
		time.Sleep(delay)

		if rand.Float64() < 0.10 {
			writeError(w, http.StatusInternalServerError, "simulated backend failure")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withOptionalFlakiness(next http.HandlerFunc, enabled bool) http.Handler {
	if !enabled {
		return next
	}
	return withMockedFlakiness(next)
}
