package calculator

import (
	"errors"
	"testing"

	"github.com/shopspring/decimal"
)

func d(s string) decimal.Decimal {
	return decimal.RequireFromString(s)
}

func TestAdd(t *testing.T) {
	if got := Add(d("2"), d("3")); !got.Equal(d("5")) {
		t.Errorf("Add(2, 3) = %v, want 5", got)
	}
	if got := Add(d("-2"), d("3")); !got.Equal(d("1")) {
		t.Errorf("Add(-2, 3) = %v, want 1", got)
	}
}

func TestSubtract(t *testing.T) {
	if got := Subtract(d("5"), d("3")); !got.Equal(d("2")) {
		t.Errorf("Subtract(5, 3) = %v, want 2", got)
	}
}

func TestMultiply(t *testing.T) {
	if got := Multiply(d("4"), d("3")); !got.Equal(d("12")) {
		t.Errorf("Multiply(4, 3) = %v, want 12", got)
	}
	if got := Multiply(d("-4"), d("3")); !got.Equal(d("-12")) {
		t.Errorf("Multiply(-4, 3) = %v, want -12", got)
	}
}

func TestDivide(t *testing.T) {
	got, err := Divide(d("10"), d("2"))
	if err != nil {
		t.Fatalf("Divide(10, 2) returned unexpected error: %v", err)
	}
	if !got.Equal(d("5")) {
		t.Errorf("Divide(10, 2) = %v, want 5", got)
	}
}

func TestDivideByZero(t *testing.T) {
	_, err := Divide(d("10"), d("0"))
	if !errors.Is(err, ErrDivideByZero) {
		t.Errorf("Divide(10, 0) error = %v, want %v", err, ErrDivideByZero)
	}
}

func TestDivideFloatingPointPrecision(t *testing.T) {
	got, err := Divide(d("1"), d("3"))
	if err != nil {
		t.Fatalf("Divide(1, 3) returned unexpected error: %v", err)
	}
	if got.NumDigits() < int(Precision) {
		t.Errorf("Divide(1, 3) = %v, want at least %d significant digits", got, Precision)
	}
	if !got.Truncate(10).Equal(d("0.3333333333")) {
		t.Errorf("Divide(1, 3) = %v, want to start with 0.3333333333", got)
	}
}

func TestPower(t *testing.T) {
	got, err := Power(d("2"), d("10"))
	if err != nil {
		t.Fatalf("Power(2, 10) returned unexpected error: %v", err)
	}
	if !got.Equal(d("1024")) {
		t.Errorf("Power(2, 10) = %v, want 1024", got)
	}

	got, err = Power(d("9"), d("0.5"))
	if err != nil {
		t.Fatalf("Power(9, 0.5) returned unexpected error: %v", err)
	}
	if !got.Round(20).Equal(d("3")) {
		t.Errorf("Power(9, 0.5) = %v, want 3", got)
	}
}

func TestPowerNegativeBaseFractionalExponent(t *testing.T) {
	_, err := Power(d("-4"), d("0.5"))
	if !errors.Is(err, ErrInvalidPower) {
		t.Errorf("Power(-4, 0.5) error = %v, want %v", err, ErrInvalidPower)
	}
}

func TestPowerRejectsPathologicallyLargeExponent(t *testing.T) {
	_, err := Power(d("10"), d("1000000"))
	if !errors.Is(err, ErrResultTooLarge) {
		t.Errorf("Power(10, 1000000) error = %v, want %v", err, ErrResultTooLarge)
	}
}

func TestSqrt(t *testing.T) {
	got, err := Sqrt(d("16"))
	if err != nil {
		t.Fatalf("Sqrt(16) returned unexpected error: %v", err)
	}
	if !got.Equal(d("4")) {
		t.Errorf("Sqrt(16) = %v, want 4", got)
	}
}

func TestSqrtNegative(t *testing.T) {
	_, err := Sqrt(d("-4"))
	if !errors.Is(err, ErrNegativeSqrt) {
		t.Errorf("Sqrt(-4) error = %v, want %v", err, ErrNegativeSqrt)
	}
}

func TestPercentage(t *testing.T) {
	if got := Percentage(d("50"), d("200")); !got.Equal(d("100")) {
		t.Errorf("Percentage(50, 200) = %v, want 100", got)
	}
	if got := Percentage(d("0"), d("200")); !got.Equal(d("0")) {
		t.Errorf("Percentage(0, 200) = %v, want 0", got)
	}
}

func TestSubtractExactAtLargeMagnitude(t *testing.T) {
	got := Subtract(d("1e30"), d("1e20"))
	want := d("999999999900000000000000000000")
	if !got.Equal(want) {
		t.Errorf("Subtract(1e30, 1e20) = %v, want %v", got, want)
	}
}

func TestSubtractExactNearUnit(t *testing.T) {
	got := Subtract(d("1e21"), d("1"))
	want := d("999999999999999999999")
	if !got.Equal(want) {
		t.Errorf("Subtract(1e21, 1) = %v, want %v", got, want)
	}
}

func TestIdentity(t *testing.T) {
	if got := Identity(d("80")); !got.Equal(d("80")) {
		t.Errorf("Identity(80) = %v, want 80", got)
	}
	if got := Identity(d("1e2")); !got.Equal(d("100")) {
		t.Errorf("Identity(1e2) = %v, want 100", got)
	}
}
