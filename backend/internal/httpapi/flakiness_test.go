package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func stubFlakiness(t *testing.T, randFloat64 func() float64) *time.Duration {
	t.Helper()

	origSleep := flakySleep
	origIntN := flakyRandIntN
	origFloat64 := flakyRandFloat64
	t.Cleanup(func() {
		flakySleep = origSleep
		flakyRandIntN = origIntN
		flakyRandFloat64 = origFloat64
	})

	var slept time.Duration
	flakySleep = func(d time.Duration) { slept = d }
	flakyRandIntN = func(int) int { return 0 }
	flakyRandFloat64 = randFloat64

	return &slept
}

func TestWithMockedFlakinessPassesThroughOnLuckyRoll(t *testing.T) {
	slept := stubFlakiness(t, func() float64 { return 0.99 })

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	rec := httptest.NewRecorder()
	withMockedFlakiness(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if !called {
		t.Error("next handler was not called, want it to be called on a lucky roll")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if *slept != time.Second {
		t.Errorf("slept = %v, want %v", *slept, time.Second)
	}
}

func TestWithMockedFlakinessFailsOnUnluckyRoll(t *testing.T) {
	stubFlakiness(t, func() float64 { return 0.0 })

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	rec := httptest.NewRecorder()
	withMockedFlakiness(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if called {
		t.Error("next handler was called, want it skipped on an unlucky roll")
	}
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}

	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if payload["error"] != "simulated backend failure" {
		t.Errorf("error = %q, want %q", payload["error"], "simulated backend failure")
	}
}

func TestWithOptionalFlakinessDisabledReturnsHandlerUnchanged(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	rec := httptest.NewRecorder()
	withOptionalFlakiness(next, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusTeapot {
		t.Errorf("status = %d, want %d (flakiness disabled should not alter the handler)", rec.Code, http.StatusTeapot)
	}
}

func TestWithOptionalFlakinessEnabledWrapsHandler(t *testing.T) {
	stubFlakiness(t, func() float64 { return 0.99 })

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	rec := httptest.NewRecorder()
	withOptionalFlakiness(next, true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if !called {
		t.Error("next handler was not called through the enabled flakiness wrapper")
	}
}
