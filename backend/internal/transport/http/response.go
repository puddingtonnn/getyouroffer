// Package httpx holds the response helpers shared by all HTTP handlers, so
// the API has exactly one JSON writer and one error envelope: {"error": msg}.
package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// WriteJSON encodes v as JSON with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encoding response", "err", err)
	}
}

// WriteError sends the shared error envelope. msg is user-facing (Russian);
// never put internal error details in it.
func WriteError(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, ErrorResponse{Error: msg})
}

// ErrorResponse is the shared error envelope for all API errors.
// @Description The shared error envelope for all API errors.
type ErrorResponse struct {
	// Error message in Russian
	Error string `json:"error"`
}

