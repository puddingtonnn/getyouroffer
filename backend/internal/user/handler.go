package user

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey = []byte("temporary_secret_key") // In production, use config

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
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
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user := &User{
		Email:        req.Email,
		PasswordHash: string(hash),
	}
	profile := &Profile{
		FirstName: req.FirstName,
		LastName:  req.LastName,
	}

	if err := h.repo.CreateUser(r.Context(), user, profile); err != nil {
		http.Error(w, "could not create user", http.StatusConflict)
		return
	}

	token, _ := generateToken(user.ID.String())
	writeJSON(w, http.StatusCreated, authResponse{Token: token})
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
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	user, err := h.repo.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, _ := generateToken(user.ID.String())
	writeJSON(w, http.StatusOK, authResponse{Token: token})
}

// GetProfile returns the current user's profile.
// @Summary Get current profile
// @Description Get profile of the authenticated user
// @Tags users
// @Produce json
// @Success 200 {object} Profile
// @Security ApiKeyAuth
// @Router /api/users/me [get]
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value("user_id").(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	userID, _ := uuid.Parse(userIDStr)
	profile, err := h.repo.GetProfileByUserID(r.Context(), userID)
	if err != nil {
		http.Error(w, "profile not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, profile)
}

func generateToken(userID string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})
	return token.SignedString(jwtKey)
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "invalid authorization header", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(parts[1], func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, _ := token.Claims.(jwt.MapClaims)
		ctx := context.WithValue(r.Context(), "user_id", claims["user_id"])
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
