// Package repository holds the outbound persistence adapters. UserRepository
// adapts pgx to the service.Repository port; database error types are
// translated to models sentinels here so no other layer imports the driver.
package repository

import (
	"errors"
	"fmt"

	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// uniqueViolation is the Postgres error code for duplicate keys.
const uniqueViolation = "23505"

// UserRepository persists users and profiles in Postgres.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository wires the pool into a UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// CreateUser inserts the user and their profile in one transaction. A
// duplicate email returns models.ErrEmailTaken.
func (r *UserRepository) CreateUser(ctx context.Context, user *models.User, profile *models.Profile) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const userQuery = `
		INSERT INTO users (id, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING created_at, updated_at`

	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}

	err = tx.QueryRow(ctx, userQuery, user.ID, user.Email, user.PasswordHash).Scan(&user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == uniqueViolation {
			return fmt.Errorf("insert user: %w", models.ErrEmailTaken)
		}
		return fmt.Errorf("insert user: %w", err)
	}

	const profileQuery = `
		INSERT INTO profiles (id, user_id, first_name, last_name)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at, updated_at`

	if profile.ID == uuid.Nil {
		profile.ID = uuid.New()
	}
	profile.UserID = user.ID

	err = tx.QueryRow(ctx, profileQuery, profile.ID, profile.UserID, profile.FirstName, profile.LastName).Scan(&profile.CreatedAt, &profile.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert profile: %w", err)
	}

	return tx.Commit(ctx)
}

// GetUserByEmail loads a user by unique email; models.ErrNotFound when absent.
func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	const query = `
		SELECT id, email, password_hash, created_at, updated_at
		FROM users
		WHERE email = $1`

	var user models.User
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get user by email: %w", models.ErrNotFound)
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}

	return &user, nil
}

// GetProfileByUserID loads a profile by unique user id; models.ErrNotFound
// when absent.
func (r *UserRepository) GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	const query = `
		SELECT id, user_id, first_name, last_name, created_at, updated_at
		FROM profiles
		WHERE user_id = $1`

	var profile models.Profile
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&profile.ID, &profile.UserID, &profile.FirstName, &profile.LastName, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get profile by user id: %w", models.ErrNotFound)
		}
		return nil, fmt.Errorf("get profile by user id: %w", err)
	}

	return &profile, nil
}
