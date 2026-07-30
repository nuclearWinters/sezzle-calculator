// Package calculator implements the pure arithmetic operations used by the
// calculator API. Functions here are deliberately free of HTTP/JSON concerns
// so they can be unit tested and reused independently of the transport layer.
//
// All arithmetic uses decimal.Decimal (arbitrary-precision) rather than
// float64 so results stay exact regardless of magnitude (e.g. 1e30 - 1e20 is
// exact here, whereas float64 would round it).
package calculator

import (
	"errors"
	"math"

	"github.com/shopspring/decimal"
)

var (
	ErrDivideByZero   = errors.New("division by zero is not allowed")
	ErrNegativeSqrt   = errors.New("cannot take the square root of a negative number")
	ErrInvalidPower   = errors.New("cannot raise a negative number to a non-integer power")
	ErrResultTooLarge = errors.New("result is too large to represent")
)

// Precision is the number of significant digits kept for operations that
// can't produce an exact decimal result (Divide, Sqrt, non-integer Power).
// Kept in sync by hand with the frontend's `Decimal.set({ precision: 50 })`.
const Precision int32 = 50

// MaxResultDigits caps the size of any result. Without it, a single request
// like Power(10, 1_000_000) would make decimal.Decimal allocate a
// million-digit number, which is a real memory/CPU DoS vector once results
// aren't bounded by float64's fixed size.
const MaxResultDigits = 10_000

var half = decimal.NewFromFloat(0.5)

func Add(a, b decimal.Decimal) decimal.Decimal {
	return a.Add(b)
}

func Subtract(a, b decimal.Decimal) decimal.Decimal {
	return a.Sub(b)
}

func Multiply(a, b decimal.Decimal) decimal.Decimal {
	return a.Mul(b)
}

func Divide(a, b decimal.Decimal) (decimal.Decimal, error) {
	if b.IsZero() {
		return decimal.Decimal{}, ErrDivideByZero
	}
	return a.DivRound(b, Precision), nil
}

// Power computes base^exponent. A cheap float64-based estimate of the
// result's magnitude is checked before doing the (potentially expensive)
// exact computation, so pathological exponents are rejected up front rather
// than after allocating an enormous decimal.
func Power(base, exponent decimal.Decimal) (decimal.Decimal, error) {
	if !base.IsZero() {
		estimatedDigits := math.Abs(exponent.InexactFloat64()) * math.Log10(math.Abs(base.InexactFloat64())+1e-300)
		if math.Abs(estimatedDigits) > MaxResultDigits {
			return decimal.Decimal{}, ErrResultTooLarge
		}
	}

	result, err := base.PowWithPrecision(exponent, Precision)
	if err != nil {
		return decimal.Decimal{}, ErrInvalidPower
	}
	return result, nil
}

func Sqrt(a decimal.Decimal) (decimal.Decimal, error) {
	if a.IsNegative() {
		return decimal.Decimal{}, ErrNegativeSqrt
	}
	return a.PowWithPrecision(half, Precision)
}

// Percentage returns a percent of b, e.g. Percentage(50, 200) == 100.
// Dividing by 100 is an exact decimal-point shift, so this never needs
// rounding.
func Percentage(a, b decimal.Decimal) decimal.Decimal {
	return a.Shift(-2).Mul(b)
}

// Identity is a. It exists so "just press equals on a typed number" (e.g.
// normalizing "1e2" to "100") goes through the same backend round trip and
// history recording as every other operation, rather than the frontend
// quietly computing it itself.
func Identity(a decimal.Decimal) decimal.Decimal {
	return a
}
