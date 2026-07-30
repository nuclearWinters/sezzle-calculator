package httpapi

import (
	"math/rand/v2"
	"net/http"
	"time"
)

// withMockedFlakiness simulates real-world network conditions — every
// request is delayed 1-3s, and roughly 1 in 10 fail outright — so the
// frontend's loading/error handling can be exercised against something
// other than an instant, always-successful backend.
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

// withOptionalFlakiness applies withMockedFlakiness only when enabled — the
// router's testability seam, so tests can construct a fast/deterministic
// router while real usage always simulates network conditions.
func withOptionalFlakiness(next http.HandlerFunc, enabled bool) http.Handler {
	if !enabled {
		return next
	}
	return withMockedFlakiness(next)
}
