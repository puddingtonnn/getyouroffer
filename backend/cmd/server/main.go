// Command server runs the GetYourOffer HTTP API.
package main

// @title GetYourOffer API
// @version 1.0
// @description API server for GetYourOffer service.
// @host localhost:8090
// @BasePath /

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization
// @description Type "Bearer <your-jwt-token>" to authenticate.

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/puddingtonnn/getyouroffer/backend/internal/client"
	"github.com/puddingtonnn/getyouroffer/backend/internal/config"
	"github.com/puddingtonnn/getyouroffer/backend/internal/repository"
	"github.com/puddingtonnn/getyouroffer/backend/internal/service"
	apihttp "github.com/puddingtonnn/getyouroffer/backend/internal/transport/http"
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
		slog.Info("connecting to database", "url", redactedURL(cfg.DatabaseURL))
		var err error
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err != nil {
			return fmt.Errorf("creating db pool: %w", err)
		}
		defer pool.Close()

		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		if err := pool.Ping(pingCtx); err != nil {
			slog.Warn("database unavailable at startup, continuing in degraded mode", "err", err)
		} else {
			slog.Info("database connection established successfully")
		}
		cancel()
	}

	// Composition root: concrete infra adapters are built here, wired into
	// use cases and delivery handlers, and injected into the router. The
	// tailor endpoint stays mounted with an empty key so the dev loop works
	// without one, but the operator is warned that every call will fail.
	if cfg.DeepSeekAPIKey == "" {
		slog.Warn("DEEPSEEK_API_KEY is empty, /api/tailor requests will fail")
	}
	tailorHandler := apihttp.NewTailorHandler(service.NewTailorService(
		client.NewPDFExtractor(),
		client.NewDeepSeek(cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL),
	))

	var userHandler *apihttp.UserHandler
	if pool != nil {
		userHandler = apihttp.NewUserHandler(service.NewUserService(repository.NewUserRepository(pool)))
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: apihttp.NewRouter(pool, tailorHandler, userHandler),
		// No WriteTimeout: /api/tailor legitimately waits ~90s on the LLM.
		// ReadTimeout still bounds slow request bodies (multipart uploads).
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       2 * time.Minute,
		IdleTimeout:       2 * time.Minute,
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

// redactedURL masks the password in a connection URL so credentials never
// reach the logs. If the value is not URL-shaped, nothing of it is logged.
func redactedURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "(unparseable url)"
	}
	return u.Redacted()
}
