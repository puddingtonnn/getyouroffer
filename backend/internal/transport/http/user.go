// User feature: HTTP handlers for the /api/users routes. It depends on the use
// case and on token issuance only through locally declared interfaces
// (consumer side); JWT signing and verification live in auth.go.
package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// userService is the port the handlers consume. Declared here (consumer side)
// so delivery depends on an abstraction, not the concrete use case.
type userService interface {
	Register(ctx context.Context, email, password, firstName, lastName string) (*models.User, error)
	Login(ctx context.Context, email, password string) (*models.User, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error)
}

// tokenIssuer mints an auth token for a user id. Declared consumer-side so the
// handler depends on an abstraction; *TokenManager (auth.go) implements it.
type tokenIssuer interface {
	Generate(userID string) (string, error)
}

// UserHandler serves the /api/users routes.
type UserHandler struct {
	service userService
	tokens  tokenIssuer
}

// NewUserHandler wires the service and token issuer into the UserHandler.
func NewUserHandler(service userService, tokens tokenIssuer) *UserHandler {
	return &UserHandler{service: service, tokens: tokens}
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
		switch {
		case errors.Is(err, models.ErrInvalidEmail):
			WriteError(w, http.StatusBadRequest, "invalid email")
		case errors.Is(err, models.ErrWeakPassword):
			WriteError(w, http.StatusBadRequest, "password must be 8 to 72 characters")
		case errors.Is(err, models.ErrEmailTaken):
			WriteError(w, http.StatusConflict, "could not create user")
		default:
			WriteError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	token, err := h.tokens.Generate(user.ID.String())
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

	token, err := h.tokens.Generate(user.ID.String())
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
