package http

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-key-that-is-long-enough-32b"

// echoUserID is the protected handler used to assert the middleware forwarded
// the request and populated the context with the user id.
func echoUserID(w http.ResponseWriter, r *http.Request) {
	id, _ := r.Context().Value(userIDKey).(string)
	_, _ = io.WriteString(w, id)
}

// runMiddleware sends one request carrying authHeader through m.Middleware.
func runMiddleware(m *TokenManager, authHeader string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	m.Middleware(http.HandlerFunc(echoUserID)).ServeHTTP(rec, req)
	return rec
}

func TestTokenManagerRoundTrip(t *testing.T) {
	m := NewTokenManager([]byte(testSecret), time.Hour)

	token, err := m.Generate("user-123")
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	rec := runMiddleware(m, "Bearer "+token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Body.String(); got != "user-123" {
		t.Fatalf("context user id = %q, want user-123", got)
	}
}

func TestTokenManagerMiddlewareRejects(t *testing.T) {
	m := NewTokenManager([]byte(testSecret), time.Hour)

	// A token from a different secret must not verify.
	otherToken, err := NewTokenManager([]byte("a-completely-different-secret-value!!"), time.Hour).Generate("user-123")
	if err != nil {
		t.Fatalf("other Generate: %v", err)
	}

	// An expired token, signed with the correct secret, must not verify.
	expiredToken, err := NewTokenManager([]byte(testSecret), -time.Hour).Generate("user-123")
	if err != nil {
		t.Fatalf("expired Generate: %v", err)
	}

	// A token with no user_id claim, signed with the correct secret.
	noClaimToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("no-claim sign: %v", err)
	}

	// An "alg: none" token — the algorithm-confusion attack the method check
	// exists to stop.
	noneToken, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": "user-123",
		"exp":     time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("none sign: %v", err)
	}

	tests := []struct {
		name       string
		authHeader string
	}{
		{name: "missing header", authHeader: ""},
		{name: "wrong scheme", authHeader: "Basic " + noClaimToken},
		{name: "malformed header", authHeader: "Bearer"},
		{name: "garbage token", authHeader: "Bearer not.a.jwt"},
		{name: "wrong secret", authHeader: "Bearer " + otherToken},
		{name: "expired token", authHeader: "Bearer " + expiredToken},
		{name: "missing user_id claim", authHeader: "Bearer " + noClaimToken},
		{name: "alg none", authHeader: "Bearer " + noneToken},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := runMiddleware(m, tt.authHeader)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401 (body %s)", rec.Code, rec.Body.String())
			}
		})
	}
}
