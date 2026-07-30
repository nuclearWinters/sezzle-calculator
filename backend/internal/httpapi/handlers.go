package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/shopspring/decimal"

	"sezzle-calculator/backend/internal/calculator"
)

var operationSymbols = map[string]string{
	"add":        "+",
	"subtract":   "-",
	"multiply":   "*",
	"divide":     "/",
	"power":      "^",
	"percentage": "%",
}

func describeOperation(operation string, req CalculateRequest) string {
	switch operation {
	case "sqrt":
		return fmt.Sprintf("sqrt(%s)", req.A.String())
	case "identity":
		return req.A.String()
	default:
		return fmt.Sprintf("%s %s %s", req.A.String(), operationSymbols[operation], req.B.String())
	}
}

var unaryOperations = map[string]bool{
	"sqrt":     true,
	"identity": true,
}

var binaryOperations = map[string]bool{
	"add":        true,
	"subtract":   true,
	"multiply":   true,
	"divide":     true,
	"power":      true,
	"percentage": true,
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) CalculateHandler(w http.ResponseWriter, r *http.Request) {
	operation := r.PathValue("operation")

	if !unaryOperations[operation] && !binaryOperations[operation] {
		writeError(w, http.StatusNotFound, "unsupported operation: "+operation)
		return
	}

	var req CalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: expected JSON with numeric field \"a\" (and \"b\" for binary operations)")
		return
	}

	if binaryOperations[operation] && req.B == nil {
		writeError(w, http.StatusBadRequest, "field \"b\" is required for operation \""+operation+"\"")
		return
	}

	result, err := dispatch(operation, req)
	if err == nil && result.NumDigits() > calculator.MaxResultDigits {
		err = calculator.ErrResultTooLarge
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var historyItem *HistoryItem
	if a.History != nil {
		entry, insertErr := a.History.Insert(r.Context(), describeOperation(operation, req), result.String())
		if insertErr != nil {
			log.Printf("failed to record history entry: %v", insertErr)
		} else {
			historyItem = toHistoryItem(entry)
		}
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Result: result, History: historyItem})
}

func dispatch(operation string, req CalculateRequest) (decimal.Decimal, error) {
	switch operation {
	case "add":
		return calculator.Add(req.A, *req.B), nil
	case "subtract":
		return calculator.Subtract(req.A, *req.B), nil
	case "multiply":
		return calculator.Multiply(req.A, *req.B), nil
	case "divide":
		return calculator.Divide(req.A, *req.B)
	case "power":
		return calculator.Power(req.A, *req.B)
	case "percentage":
		return calculator.Percentage(req.A, *req.B), nil
	case "sqrt":
		return calculator.Sqrt(req.A)
	case "identity":
		return calculator.Identity(req.A), nil
	default:
		return decimal.Decimal{}, errors.New("unsupported operation: " + operation)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, ErrorResponse{Error: message})
}
