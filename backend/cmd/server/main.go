package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-sql-driver/mysql"

	"sezzle-calculator/backend/internal/history"
	"sezzle-calculator/backend/internal/httpapi"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	api := &httpapi.API{History: openHistoryStore()}

	addr := ":" + port
	router := httpapi.NewRouter(api, true)

	log.Printf("calculator API listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func openHistoryStore() httpapi.HistoryStore {
	cfg := mysql.NewConfig()
	cfg.Net = "tcp"
	cfg.Addr = envOr("DB_HOST", "localhost") + ":" + envOr("DB_PORT", "3306")
	cfg.User = envOr("DB_USER", "calculator")
	cfg.Passwd = envOr("DB_PASSWORD", "calculator")
	cfg.DBName = envOr("DB_NAME", "calculator")

	const (
		attempts = 10
		backoff  = time.Second
	)

	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		store, err := history.Open(*cfg)
		if err == nil {
			return store
		}
		lastErr = err
		if attempt < attempts {
			time.Sleep(backoff)
		}
	}

	log.Printf("warning: history unavailable after %d attempts, calculations will not be recorded: %v", attempts, lastErr)
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
