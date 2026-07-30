package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAllowedOriginDefaultsToWildcard(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "")

	if got := allowedOrigin(); got != "*" {
		t.Errorf("allowedOrigin() = %q, want %q", got, "*")
	}
}

func TestAllowedOriginUsesEnvVarWhenSet(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "https://example.com")

	if got := allowedOrigin(); got != "https://example.com" {
		t.Errorf("allowedOrigin() = %q, want %q", got, "https://example.com")
	}
}

func TestWithCORSPreflightRequestShortCircuits(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "https://example.com")

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true })

	rec := httptest.NewRecorder()
	withCORS(next).ServeHTTP(rec, httptest.NewRequest(http.MethodOptions, "/api/v1/history", nil))

	if called {
		t.Error("next handler was called, want a preflight OPTIONS request handled without reaching it")
	}
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://example.com" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "https://example.com")
	}
}

func TestWithCORSNonPreflightRequestPassesThrough(t *testing.T) {
	t.Setenv("ALLOWED_ORIGIN", "")

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	rec := httptest.NewRecorder()
	withCORS(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/history", nil))

	if !called {
		t.Error("next handler was not called for a non-preflight request")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "*")
	}
}
