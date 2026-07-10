// Command server runs the GetYourOffer HTTP API.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/puddingtonnn/getyouroffer/backend/internal/config"
	"github.com/puddingtonnn/getyouroffer/backend/internal/httpapi"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server exited", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	// The database is optional at startup so the dev loop survives a stopped
	// Docker: we warn and keep serving, /api/health reports the actual state.
	var pool *pgxpool.Pool
	if cfg.DatabaseURL == "" {
		slog.Warn("DATABASE_URL is empty, running without a database")
	} else {
		var err error
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err != nil {
			return fmt.Errorf("creating db pool: %w", err)
		}
		defer pool.Close()

		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		if err := pool.Ping(pingCtx); err != nil {
			slog.Warn("database unavailable at startup, continuing", "err", err)
		}
		cancel()
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewRouter(pool),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("http server listening", "addr", srv.Addr)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutting down http server: %w", err)
	}
	slog.Info("server stopped")
	return nil
}
