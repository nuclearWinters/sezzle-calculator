package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func doCalculate(t *testing.T, operation string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		t.Fatalf("failed to encode request body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/"+operation, &buf)
	req.SetPathValue("operation", operation)
	rec := httptest.NewRecorder()

	(&API{}).CalculateHandler(rec, req)

	var payload map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("failed to decode response body: %v", err)
		}
	}

	return rec, payload
}

func TestCalculateHandlerAdd(t *testing.T) {
	rec, payload := doCalculate(t, "add", map[string]string{"a": "2", "b": "3"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "5" {
		t.Errorf("result = %v, want 5", payload["result"])
	}
}

func TestCalculateHandlerDivideByZero(t *testing.T) {
	rec, payload := doCalculate(t, "divide", map[string]string{"a": "10", "b": "0"})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if payload["error"] == nil {
		t.Errorf("expected error message in response, got %v", payload)
	}
}

func TestCalculateHandlerMissingB(t *testing.T) {
	rec, payload := doCalculate(t, "add", map[string]string{"a": "2"})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if payload["error"] == nil {
		t.Errorf("expected error message about missing field b, got %v", payload)
	}
}

func TestCalculateHandlerSqrtDoesNotRequireB(t *testing.T) {
	rec, payload := doCalculate(t, "sqrt", map[string]string{"a": "16"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "4" {
		t.Errorf("result = %v, want 4", payload["result"])
	}
}

func TestCalculateHandlerSqrtNegative(t *testing.T) {
	rec, payload := doCalculate(t, "sqrt", map[string]string{"a": "-4"})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if payload["error"] == nil {
		t.Errorf("expected error message, got %v", payload)
	}
}

func TestCalculateHandlerPowerOverflow(t *testing.T) {
	rec, payload := doCalculate(t, "power", map[string]string{"a": "10", "b": "1000000"})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if payload["error"] == nil {
		t.Errorf("expected error message about a too-large result, got %v", payload)
	}
}

func TestCalculateHandlerLargeExponent(t *testing.T) {
	rec, payload := doCalculate(t, "multiply", map[string]string{"a": "1e21", "b": "1"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "1000000000000000000000" {
		t.Errorf("result = %v, want 1000000000000000000000", payload["result"])
	}
}

func TestCalculateHandlerAcceptsScientificNotationInRequestBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", bytes.NewBufferString(`{"a": "1e21", "b": "2e21"}`))
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	(&API{}).CalculateHandler(rec, req)

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "3000000000000000000000" {
		t.Errorf("result = %v, want 3000000000000000000000", payload["result"])
	}
}

func TestCalculateHandlerExactSubtractionAtLargeMagnitude(t *testing.T) {
	rec, payload := doCalculate(t, "subtract", map[string]string{"a": "1e30", "b": "1e20"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "999999999900000000000000000000" {
		t.Errorf("result = %v, want 999999999900000000000000000000", payload["result"])
	}
}

func TestCalculateHandlerIdentity(t *testing.T) {
	rec, payload := doCalculate(t, "identity", map[string]string{"a": "1e2"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "100" {
		t.Errorf("result = %v, want 100", payload["result"])
	}
}

func TestCalculateHandlerIdentityDoesNotRequireB(t *testing.T) {
	rec, payload := doCalculate(t, "identity", map[string]string{"a": "80"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "80" {
		t.Errorf("result = %v, want 80", payload["result"])
	}
}

func TestCalculateHandlerUnsupportedOperation(t *testing.T) {
	rec, _ := doCalculate(t, "modulo", map[string]string{"a": "2", "b": "3"})

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestCalculateHandlerInvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", bytes.NewBufferString("not-json"))
	req.SetPathValue("operation", "add")
	rec := httptest.NewRecorder()

	(&API{}).CalculateHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCalculateHandlerPercentage(t *testing.T) {
	rec, payload := doCalculate(t, "percentage", map[string]string{"a": "50", "b": "200"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if payload["result"] != "100" {
		t.Errorf("result = %v, want 100 (50%% of 200)", payload["result"])
	}
}

func TestCalculateHandlerResultTooLargeWithoutAnIntrinsicOverflowError(t *testing.T) {
	huge := strings.Repeat("9", 10001)

	rec, payload := doCalculate(t, "identity", map[string]string{"a": huge})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if payload["error"] == nil {
		t.Errorf("expected an error about a too-large result, got %v", payload)
	}
}

func TestDispatchUnsupportedOperationReturnsError(t *testing.T) {
	_, err := dispatch("bogus", CalculateRequest{})
	if err == nil {
		t.Fatal("dispatch() error = nil, want an error for an unsupported operation")
	}
}

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()

	HealthHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestRouterEndToEnd(t *testing.T) {
	router := NewRouter(&API{}, false)

	body := bytes.NewBufferString(`{"a": "6", "b": "3"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate/multiply", body)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if payload["result"] != "18" {
		t.Errorf("result = %v, want 18", payload["result"])
	}
}
