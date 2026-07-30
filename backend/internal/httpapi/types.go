package httpapi

import (
	"time"

	"github.com/shopspring/decimal"
)

type CalculateRequest struct {
	A decimal.Decimal  `json:"a"`
	B *decimal.Decimal `json:"b,omitempty"`
}

type CalculateResponse struct {
	Result  decimal.Decimal `json:"result"`
	History *HistoryItem    `json:"history"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type HistoryItem struct {
	ID         string    `json:"id"`
	Operations string    `json:"operations"`
	Result     string    `json:"result"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ListHistoryResponse struct {
	Items      []HistoryItem `json:"items"`
	NextCursor *string       `json:"nextCursor"`
}
