package main

import "testing"

func TestEnvOrReturnsEnvValueWhenSet(t *testing.T) {
	t.Setenv("SOME_TEST_KEY", "custom")

	if got := envOr("SOME_TEST_KEY", "fallback"); got != "custom" {
		t.Errorf("envOr() = %q, want %q", got, "custom")
	}
}

func TestEnvOrReturnsFallbackWhenUnset(t *testing.T) {
	t.Setenv("SOME_TEST_KEY", "")

	if got := envOr("SOME_TEST_KEY", "fallback"); got != "fallback" {
		t.Errorf("envOr() = %q, want %q", got, "fallback")
	}
}
