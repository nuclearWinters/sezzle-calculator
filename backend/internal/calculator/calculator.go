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

const Precision int32 = 50

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

func Percentage(a, b decimal.Decimal) decimal.Decimal {
	return a.Shift(-2).Mul(b)
}

func Identity(a decimal.Decimal) decimal.Decimal {
	return a
}
