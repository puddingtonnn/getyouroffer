package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// fakeUserRepo is an in-memory Repository. It mirrors the Postgres adapter's
// observable behaviour: it assigns ids on create, rejects duplicate emails with
// models.ErrEmailTaken and reports absent rows as models.ErrNotFound.
type fakeUserRepo struct {
	usersByEmail  map[string]*models.User
	profilesByUID map[uuid.UUID]*models.Profile
}

func newFakeUserRepo() *fakeUserRepo {
	return &fakeUserRepo{
		usersByEmail:  map[string]*models.User{},
		profilesByUID: map[uuid.UUID]*models.Profile{},
	}
}

func (r *fakeUserRepo) CreateUser(_ context.Context, user *models.User, profile *models.Profile) error {
	if _, ok := r.usersByEmail[user.Email]; ok {
		return fmt.Errorf("insert user: %w", models.ErrEmailTaken)
	}
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	profile.UserID = user.ID
	r.usersByEmail[user.Email] = user
	r.profilesByUID[user.ID] = profile
	return nil
}

func (r *fakeUserRepo) GetUserByEmail(_ context.Context, email string) (*models.User, error) {
	u, ok := r.usersByEmail[email]
	if !ok {
		return nil, fmt.Errorf("get user by email: %w", models.ErrNotFound)
	}
	return u, nil
}

func (r *fakeUserRepo) GetProfileByUserID(_ context.Context, userID uuid.UUID) (*models.Profile, error) {
	p, ok := r.profilesByUID[userID]
	if !ok {
		return nil, fmt.Errorf("get profile by user id: %w", models.ErrNotFound)
	}
	return p, nil
}

const validPassword = "password123"

func TestRegisterValidation(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		password string
		wantErr  error
	}{
		{name: "valid", email: "user@example.com", password: validPassword, wantErr: nil},
		{name: "empty email", email: "", password: validPassword, wantErr: models.ErrInvalidEmail},
		{name: "malformed email", email: "not-an-email", password: validPassword, wantErr: models.ErrInvalidEmail},
		{name: "empty password", email: "user@example.com", password: "", wantErr: models.ErrWeakPassword},
		{name: "short password", email: "user@example.com", password: "1234567", wantErr: models.ErrWeakPassword},
		{name: "too long password", email: "user@example.com", password: strings.Repeat("a", maxPasswordLen+1), wantErr: models.ErrWeakPassword},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewUserService(newFakeUserRepo())
			_, err := svc.Register(context.Background(), tt.email, tt.password, "First", "Last")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want errors.Is(%v)", err, tt.wantErr)
			}
		})
	}
}

func TestRegisterRejectsDuplicateEmailCaseInsensitively(t *testing.T) {
	svc := NewUserService(newFakeUserRepo())
	if _, err := svc.Register(context.Background(), "user@example.com", validPassword, "", ""); err != nil {
		t.Fatalf("first register: %v", err)
	}
	// Same address, different case, must still collide after normalization.
	_, err := svc.Register(context.Background(), "USER@Example.com", validPassword, "", "")
	if !errors.Is(err, models.ErrEmailTaken) {
		t.Fatalf("duplicate register err = %v, want ErrEmailTaken", err)
	}
}

func TestRegisterNormalizesEmail(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo)
	user, err := svc.Register(context.Background(), "  User@Example.COM ", validPassword, "", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if user.Email != "user@example.com" {
		t.Fatalf("stored email = %q, want normalized user@example.com", user.Email)
	}
	if _, ok := repo.usersByEmail["user@example.com"]; !ok {
		t.Fatal("user not stored under the normalized email")
	}
}

func TestLogin(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo)
	created, err := svc.Register(context.Background(), "user@example.com", validPassword, "", "")
	if err != nil {
		t.Fatalf("seed register: %v", err)
	}

	tests := []struct {
		name     string
		email    string
		password string
		wantErr  error
	}{
		{name: "correct credentials", email: "user@example.com", password: validPassword, wantErr: nil},
		{name: "case-insensitive email", email: "USER@example.com", password: validPassword, wantErr: nil},
		{name: "unknown email", email: "ghost@example.com", password: validPassword, wantErr: models.ErrInvalidCredentials},
		{name: "wrong password", email: "user@example.com", password: "wrongpassword", wantErr: models.ErrInvalidCredentials},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := svc.Login(context.Background(), tt.email, tt.password)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want errors.Is(%v)", err, tt.wantErr)
			}
			if tt.wantErr == nil && user.ID != created.ID {
				t.Fatalf("logged in user id = %s, want %s", user.ID, created.ID)
			}
		})
	}
}

func TestGetProfile(t *testing.T) {
	repo := newFakeUserRepo()
	svc := NewUserService(repo)
	user, err := svc.Register(context.Background(), "user@example.com", validPassword, "Ada", "Lovelace")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	t.Run("existing profile", func(t *testing.T) {
		profile, err := svc.GetProfile(context.Background(), user.ID)
		if err != nil {
			t.Fatalf("GetProfile: %v", err)
		}
		if profile.FirstName != "Ada" || profile.UserID != user.ID {
			t.Fatalf("profile = %+v, want FirstName=Ada for user %s", profile, user.ID)
		}
	})

	t.Run("missing profile", func(t *testing.T) {
		_, err := svc.GetProfile(context.Background(), uuid.New())
		if !errors.Is(err, models.ErrNotFound) {
			t.Fatalf("err = %v, want ErrNotFound", err)
		}
	})
}
