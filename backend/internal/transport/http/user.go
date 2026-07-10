// User feature: HTTP handlers, plus
// JWT issuance and the auth middleware. It depends on the use case only
// through a locally declared interface (consumer side).
package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

var jwtKey = []byte("temporary_secret_key") // In production, use config

// userService is the port the handlers consume. Declared here (consumer side)
// so delivery depends on an abstraction, not the concrete use case.
type userService interface {
	Register(ctx context.Context, email, password, firstName, lastName string) (*models.User, error)
	Login(ctx context.Context, email, password string) (*models.User, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error)
}

// UserHandler serves the /api/users routes.
type UserHandler struct {
	service userService
}

// NewUserHandler wires the service into the UserHandler.
func NewUserHandler(service userService) *UserHandler {
	return &UserHandler{service: service}
}

type registerRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
}

// Register handles user registration.
// @Summary Register a new user
// @Description Create a new user and profile
// @Tags users
// @Accept json
// @Produce json
// @Param request body registerRequest true "Registration info"
// @Success 201 {object} authResponse
// @Router /api/users/register [post]
func (h *UserHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := h.service.Register(r.Context(), req.Email, req.Password, req.FirstName, req.LastName)
	if err != nil {
		if errors.Is(err, models.ErrEmailTaken) {
			WriteError(w, http.StatusConflict, "could not create user")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	token, err := generateToken(user.ID.String())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusCreated, authResponse{Token: token})
}

// Login handles user authentication.
// @Summary Login user
// @Description Authenticate user and return JWT
// @Tags users
// @Accept json
// @Produce json
// @Param request body loginRequest true "Login info"
// @Success 200 {object} authResponse
// @Router /api/users/login [post]
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := h.service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, models.ErrInvalidCredentials) {
			WriteError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	token, err := generateToken(user.ID.String())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, authResponse{Token: token})
}

// GetProfile returns the current user's profile.
// @Summary Get current profile
// @Description Get profile of the authenticated user
// @Tags users
// @Produce json
// @Success 200 {object} models.Profile
// @Security ApiKeyAuth
// @Router /api/users/me [get]
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(userIDKey).(string)
	if !ok {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	profile, err := h.service.GetProfile(r.Context(), userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "profile not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	WriteJSON(w, http.StatusOK, profile)
}

// contextKey is unexported so no other package can collide with our context
// values (staticcheck SA1029).
type contextKey string

const userIDKey contextKey = "user_id"

func generateToken(userID string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})
	return token.SignedString(jwtKey)
}

// AuthMiddleware validates the Bearer JWT and puts the user id into the
// request context for GetProfile.
func AuthMiddleware(next http.Handler) http.Handler {
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

		token, err := jwt.Parse(parts[1], func(token *jwt.Token) (any, error) {
			return jwtKey, nil
		})
		if err != nil || !token.Valid {
			WriteError(w, http.StatusUnauthorized, "invalid token")
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			WriteError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		userID, _ := claims["user_id"].(string)
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
