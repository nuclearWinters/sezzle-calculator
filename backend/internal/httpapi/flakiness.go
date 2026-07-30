package httpapi

import (
	"math/rand/v2"
	"net/http"
	"time"
)

var (
	flakySleep       = time.Sleep
	flakyRandIntN    = rand.IntN
	flakyRandFloat64 = rand.Float64
)

func withMockedFlakiness(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		delay := time.Second + time.Duration(flakyRandIntN(2001))*time.Millisecond
		flakySleep(delay)

		if flakyRandFloat64() < 0.10 {
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
