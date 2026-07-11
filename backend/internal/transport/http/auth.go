package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// contextKey is unexported so no other package can collide with our context
// values (staticcheck SA1029).
type contextKey string

const userIDKey contextKey = "user_id"

// TokenManager issues and verifies the Bearer JWTs used for authentication. It
// replaces the former package-global signing key: the secret and TTL are
// injected at the composition root, so nothing hardcodes a secret and the same
// instance can both mint tokens (UserHandler) and guard routes (Middleware).
type TokenManager struct {
	secret []byte
	ttl    time.Duration
}

// NewTokenManager builds a TokenManager from a signing secret and token TTL.
func NewTokenManager(secret []byte, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: secret, ttl: ttl}
}

// Generate signs an HS256 token carrying the user id and an expiry of now+ttl.
func (m *TokenManager) Generate(userID string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(m.ttl).Unix(),
	})
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return "", fmt.Errorf("signing token: %w", err)
	}
	return signed, nil
}

// Middleware validates the Bearer JWT and puts the user id into the request
// context for downstream handlers (e.g. GetProfile).
func (m *TokenManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteError(w, http.StatusUnauthorized, "missing authorization header")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			WriteError(w, http.StatusUnauthorized, "invalid authorization header")
			return
		}

		userID, err := m.parseUserID(parts[1])
		if err != nil {
			WriteError(w, http.StatusUnauthorized, "invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// parseUserID verifies the token signature and returns its user_id claim. The
// signing method is asserted twice — via the keyfunc type check and
// WithValidMethods — to rule out algorithm-confusion attacks (e.g. a token
// forged with alg "none" or an RS* public key).
func (m *TokenManager) parseUserID(raw string) (string, error) {
	token, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return "", fmt.Errorf("parsing token: %w", err)
	}
	if !token.Valid {
		return "", errors.New("token is not valid")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("unexpected claims type")
	}
	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		return "", errors.New("missing user_id claim")
	}
	return userID, nil
}
