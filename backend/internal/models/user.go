// Package domain holds the entities, ports and sentinel errors of the user
// feature (accounts and profiles). It depends on nothing but the standard
// library and uuid: the dependency rule points inward.
package models

import (
	"time"

	"github.com/google/uuid"
)

// User is an account. PasswordHash never leaves the backend.
type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Profile is the personal data attached to a User.
type Profile struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
