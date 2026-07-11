package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// fakeUserService returns a canned user/profile or a canned error per method.
type fakeUserService struct {
	user        *models.User
	profile     *models.Profile
	registerErr error
	loginErr    error
	profileErr  error
}

func (f *fakeUserService) Register(context.Context, string, string, string, string) (*models.User, error) {
	if f.registerErr != nil {
		return nil, f.registerErr
	}
	return f.user, nil
}

func (f *fakeUserService) Login(context.Context, string, string) (*models.User, error) {
	if f.loginErr != nil {
		return nil, f.loginErr
	}
	return f.user, nil
}

func (f *fakeUserService) GetProfile(context.Context, uuid.UUID) (*models.Profile, error) {
	if f.profileErr != nil {
		return nil, f.profileErr
	}
	return f.profile, nil
}

// fakeIssuer stands in for the TokenManager so handler tests stay independent
// of JWT signing (that is covered in auth_test.go).
type fakeIssuer struct {
	token string
	err   error
}

func (f *fakeIssuer) Generate(string) (string, error) { return f.token, f.err }

func postJSON(t *testing.T, handler http.HandlerFunc, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func TestHandlerRegister(t *testing.T) {
	okUser := &models.User{ID: uuid.New(), Email: "user@example.com"}
	validBody := `{"email":"user@example.com","password":"password123","first_name":"Ada","last_name":"Lovelace"}`

	tests := []struct {
		name       string
		service    *fakeUserService
		issuer     *fakeIssuer
		body       string
		wantStatus int
	}{
		{name: "success", service: &fakeUserService{user: okUser}, issuer: &fakeIssuer{token: "tok"}, body: validBody, wantStatus: http.StatusCreated},
		{name: "malformed json", service: &fakeUserService{user: okUser}, issuer: &fakeIssuer{token: "tok"}, body: `{`, wantStatus: http.StatusBadRequest},
		{name: "invalid email", service: &fakeUserService{registerErr: models.ErrInvalidEmail}, issuer: &fakeIssuer{token: "tok"}, body: validBody, wantStatus: http.StatusBadRequest},
		{name: "weak password", service: &fakeUserService{registerErr: models.ErrWeakPassword}, issuer: &fakeIssuer{token: "tok"}, body: validBody, wantStatus: http.StatusBadRequest},
		{name: "email taken", service: &fakeUserService{registerErr: models.ErrEmailTaken}, issuer: &fakeIssuer{token: "tok"}, body: validBody, wantStatus: http.StatusConflict},
		{name: "service error", service: &fakeUserService{registerErr: errors.New("boom")}, issuer: &fakeIssuer{token: "tok"}, body: validBody, wantStatus: http.StatusInternalServerError},
		{name: "token issuer error", service: &fakeUserService{user: okUser}, issuer: &fakeIssuer{err: errors.New("boom")}, body: validBody, wantStatus: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewUserHandler(tt.service, tt.issuer)
			rec := postJSON(t, h.Register, "/api/users/register", tt.body)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
			if tt.wantStatus == http.StatusCreated && errorBody(t, rec) != "" {
				t.Fatalf("success response must not carry an error: %s", rec.Body.String())
			}
		})
	}
}

func TestHandlerLogin(t *testing.T) {
	okUser := &models.User{ID: uuid.New(), Email: "user@example.com"}
	validBody := `{"email":"user@example.com","password":"password123"}`

	tests := []struct {
		name       string
		service    *fakeUserService
		body       string
		wantStatus int
	}{
		{name: "success", service: &fakeUserService{user: okUser}, body: validBody, wantStatus: http.StatusOK},
		{name: "malformed json", service: &fakeUserService{user: okUser}, body: `{`, wantStatus: http.StatusBadRequest},
		{name: "invalid credentials", service: &fakeUserService{loginErr: models.ErrInvalidCredentials}, body: validBody, wantStatus: http.StatusUnauthorized},
		{name: "service error", service: &fakeUserService{loginErr: errors.New("boom")}, body: validBody, wantStatus: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewUserHandler(tt.service, &fakeIssuer{token: "tok"})
			rec := postJSON(t, h.Login, "/api/users/login", tt.body)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}

func TestHandlerGetProfile(t *testing.T) {
	userID := uuid.New()
	profile := &models.Profile{UserID: userID, FirstName: "Ada"}

	// withUserID builds a GET /me request whose context carries ctxUserID, the
	// way the auth middleware would have set it (empty means "not set").
	newRequest := func(ctxUserID string) *http.Request {
		req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
		if ctxUserID != "" {
			req = req.WithContext(context.WithValue(req.Context(), userIDKey, ctxUserID))
		}
		return req
	}

	tests := []struct {
		name       string
		ctxUserID  string
		service    *fakeUserService
		wantStatus int
	}{
		{name: "success", ctxUserID: userID.String(), service: &fakeUserService{profile: profile}, wantStatus: http.StatusOK},
		{name: "no context user id", ctxUserID: "", service: &fakeUserService{profile: profile}, wantStatus: http.StatusUnauthorized},
		{name: "non-uuid context user id", ctxUserID: "not-a-uuid", service: &fakeUserService{profile: profile}, wantStatus: http.StatusUnauthorized},
		{name: "profile not found", ctxUserID: userID.String(), service: &fakeUserService{profileErr: models.ErrNotFound}, wantStatus: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewUserHandler(tt.service, &fakeIssuer{token: "tok"})
			rec := httptest.NewRecorder()
			h.GetProfile(rec, newRequest(tt.ctxUserID))
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}
