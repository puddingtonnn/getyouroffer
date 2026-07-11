// Package http is the transport layer: it wires the HTTP routes and middleware,
// holds the feature handlers, and owns the shared response helpers. It only
// routes and translates HTTP; all dependencies are constructed in cmd/server
// (the composition root) and injected as ready handlers.
package http

import (
	"context"
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
// without a database; tailorH and userH may be nil (e.g. in tests, or userH
// without a database) — their routes are then not mounted. authMiddleware
// guards the protected user routes and is non-nil whenever userH is.
func NewRouter(pool *pgxpool.Pool, tailorH *TailorHandler, userH *UserHandler, toolsH *ToolsHandler, trackerH *TrackerHandler, authMiddleware func(http.Handler) http.Handler) http.Handler {
	r := chi.NewRouter()


	r.Use(middleware.RequestID)
	// middleware.RealIP is deliberately absent: it trusts spoofable
	// X-Forwarded-For headers and is deprecated (GHSA-3fxj-6jh8-hvhx).
	// Logger records method/path/status only. Request bodies must never be
	// logged: they will contain resumes, i.e. personal data.
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders: []string{"Content-Type"},
	}))

	if toolsH != nil {
		r.Route("/api/tools", func(r chi.Router) {
			r.Post("/extract-text", toolsH.ExtractText)
			r.Post("/extract-ocr", toolsH.ExtractOCR)
		})
	}

	if trackerH != nil {
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)
			r.Route("/api/vacancies", func(r chi.Router) {
				r.Post("/", trackerH.CreateVacancy)
				r.Get("/", trackerH.ListVacancies)
				r.Get("/{id}", trackerH.GetVacancy)
				r.Patch("/{id}", trackerH.UpdateVacancy)
				r.Delete("/{id}", trackerH.DeleteVacancy)
			})
			r.Route("/api/resumes", func(r chi.Router) {
				r.Get("/", trackerH.ListResumes)
				r.Get("/{id}", trackerH.GetResume)
				r.Delete("/{id}", trackerH.DeleteResume)
			})
		})
	}

	r.Get("/api/health", handleHealth(pool))
	r.Mount("/swagger", httpSwagger.WrapHandler)

	if tailorH != nil {
		// Throttle: each tailor request pins the upload in memory and holds a
		// paid LLM call for up to ~90s, so cap concurrent work until real
		// auth/quotas land.
		r.With(authMiddleware, middleware.Throttle(4)).Post("/api/tailor", tailorH.Tailor)
	}

	if userH != nil {
		r.Route("/api/users", func(r chi.Router) {
			r.Post("/register", userH.Register)
			r.Post("/login", userH.Login)
			r.With(authMiddleware).Get("/me", userH.GetProfile)
		})
	}

	return r
}



func handleHealth(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		db := "not_configured"
		if pool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(ctx); err != nil {
				slog.Error("health check: database ping failed", "err", err)
				db = "unavailable"
			} else {
				db = "ok"
			}
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": db})
	}
}
