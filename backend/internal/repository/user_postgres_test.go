package repository

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// newTestPool connects to the Postgres given by TEST_DATABASE_URL, which must
// point at a migrated database. The test is opt-in: without that variable it
// skips, so `make test` stays green without Docker. Set it explicitly to run
// against the dev database, e.g.
//
//	TEST_DATABASE_URL=postgres://app:app@localhost:5432/getyouroffer?sslmode=disable \
//		go test ./internal/repository/...
func newTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration test")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connecting to test db: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("pinging test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestUserRepository(t *testing.T) {
	pool := newTestPool(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	// A unique email keeps the test re-runnable against a shared database.
	email := "test-" + uuid.NewString() + "@example.com"
	user := &models.User{Email: email, PasswordHash: "hash"}
	profile := &models.Profile{FirstName: "Test", LastName: "User"}

	if err := repo.CreateUser(ctx, user, profile); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	// Best-effort cleanup; ON DELETE CASCADE removes the profile too.
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", user.ID)
	})

	if user.ID == uuid.Nil {
		t.Fatal("CreateUser did not assign a user id")
	}

	gotUser, err := repo.GetUserByEmail(ctx, email)
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if gotUser.ID != user.ID || gotUser.Email != email {
		t.Fatalf("GetUserByEmail = %+v, want id=%s email=%s", gotUser, user.ID, email)
	}

	gotProfile, err := repo.GetProfileByUserID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetProfileByUserID: %v", err)
	}
	if gotProfile.UserID != user.ID || gotProfile.FirstName != "Test" {
		t.Fatalf("GetProfileByUserID = %+v, want FirstName=Test for user %s", gotProfile, user.ID)
	}

	t.Run("duplicate email maps to ErrEmailTaken", func(t *testing.T) {
		dup := &models.User{Email: email, PasswordHash: "hash2"}
		err := repo.CreateUser(ctx, dup, &models.Profile{})
		if !errors.Is(err, models.ErrEmailTaken) {
			t.Fatalf("err = %v, want ErrEmailTaken", err)
		}
	})

	t.Run("absent rows map to ErrNotFound", func(t *testing.T) {
		if _, err := repo.GetUserByEmail(ctx, "absent-"+uuid.NewString()+"@example.com"); !errors.Is(err, models.ErrNotFound) {
			t.Fatalf("GetUserByEmail(absent) err = %v, want ErrNotFound", err)
		}
		if _, err := repo.GetProfileByUserID(ctx, uuid.New()); !errors.Is(err, models.ErrNotFound) {
			t.Fatalf("GetProfileByUserID(absent) err = %v, want ErrNotFound", err)
		}
	})
}
