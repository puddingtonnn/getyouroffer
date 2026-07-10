// Package service holds the business logic of each feature. It depends only on
// models (entities + sentinel errors) and declares, consumer-side, the ports it
// needs from the outer layers (repositories, external clients).
package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// Repository persists users and profiles. Declared here (consumer side) so the
// service depends on the abstraction; the Postgres adapter in package
// repository implements it.
type Repository interface {
	CreateUser(ctx context.Context, user *models.User, profile *models.Profile) error
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*models.Profile, error)
}

// UserService coordinates account operations through the Repository port.
type UserService struct {
	repo Repository
}

// NewUserService wires the repository into a UserService.
func NewUserService(repo Repository) *UserService {
	return &UserService{repo: repo}
}

// Register creates a user with a bcrypt-hashed password plus their profile.
// Returns models.ErrEmailTaken (via the repository) when the email exists.
func (s *UserService) Register(ctx context.Context, email, password, firstName, lastName string) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &models.User{Email: email, PasswordHash: string(hash)}
	profile := &models.Profile{FirstName: firstName, LastName: lastName}

	if err := s.repo.CreateUser(ctx, user, profile); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return user, nil
}

// Login verifies the email/password pair. Both an unknown email and a wrong
// password return models.ErrInvalidCredentials so responses do not reveal
// which emails are registered.
func (s *UserService) Login(ctx context.Context, email, password string) (*models.User, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		// The repository maps "no rows" to models.ErrNotFound, so the service
		// never imports the database driver.
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("loading user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, models.ErrInvalidCredentials
	}
	return user, nil
}

// GetProfile loads the profile of the given user.
func (s *UserService) GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	profile, err := s.repo.GetProfileByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			return nil, models.ErrNotFound
		}
		return nil, fmt.Errorf("loading profile: %w", err)
	}
	return profile, nil
}
