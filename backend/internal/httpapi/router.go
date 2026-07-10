// Package httpapi wires the HTTP routes and middleware of the API server.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger/v2"
	_ "github.com/puddingtonnn/getyouroffer/backend/docs"
)

// NewRouter assembles the API routes. pool may be nil when the server runs
// without a database.
func NewRouter(pool *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	// Logger records method/path/status only. Request bodies must never be
	// logged: they will contain resumes, i.e. personal data.
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders: []string{"Content-Type"},
	}))

	r.Get("/api/health", handleHealth(pool))
	r.Mount("/swagger", httpSwagger.WrapHandler)

	return r
}

func handleHealth(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := "not_configured"
		if pool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), time.Second)
			defer cancel()
			if err := pool.Ping(ctx); err != nil {
				db = "unavailable"
			} else {
				db = "ok"
			}
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": db})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encoding response", "err", err)
	}
}
