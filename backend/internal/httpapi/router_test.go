package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	tests := []struct {
		name   string
		path   string
		status int
		wantDB string
	}{
		{name: "health without db", path: "/api/health", status: http.StatusOK, wantDB: "not_configured"},
		{name: "unknown route", path: "/api/nope", status: http.StatusNotFound},
	}

	router := NewRouter(nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))

			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}
			if tt.wantDB == "" {
				return
			}
			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("unmarshaling body: %v", err)
			}
			if body["status"] != "ok" || body["db"] != tt.wantDB {
				t.Fatalf("body = %v, want status=ok db=%s", body, tt.wantDB)
			}
		})
	}
}
