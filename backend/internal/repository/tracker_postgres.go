package repository

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type TrackerRepository struct {
	pool *pgxpool.Pool
}

func NewTrackerRepository(pool *pgxpool.Pool) *TrackerRepository {
	return &TrackerRepository{pool: pool}
}

// Vacancies
func (r *TrackerRepository) CreateVacancy(ctx context.Context, v *models.Vacancy) error {
	const query = `
		INSERT INTO vacancies (id, user_id, name, status, source, description)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at`

	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}

	return r.pool.QueryRow(ctx, query, v.ID, v.UserID, v.Name, v.Status, v.Source, v.Description).
		Scan(&v.CreatedAt, &v.UpdatedAt)
}

func (r *TrackerRepository) GetVacancy(ctx context.Context, id uuid.UUID) (*models.Vacancy, error) {
	const query = `
		SELECT id, user_id, name, status, source, description, created_at, updated_at
		FROM vacancies WHERE id = $1`

	var v models.Vacancy
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.UserID, &v.Name, &v.Status, &v.Source, &v.Description, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

func (r *TrackerRepository) ListVacancies(ctx context.Context, userID uuid.UUID) ([]models.Vacancy, error) {
	const query = `
		SELECT id, user_id, name, status, source, description, created_at, updated_at
		FROM vacancies WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vacancies []models.Vacancy
	for rows.Next() {
		var v models.Vacancy
		if err := rows.Scan(&v.ID, &v.UserID, &v.Name, &v.Status, &v.Source, &v.Description, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		vacancies = append(vacancies, v)
	}
	return vacancies, nil
}

func (r *TrackerRepository) UpdateVacancy(ctx context.Context, v *models.Vacancy) error {
	const query = `
		UPDATE vacancies 
		SET name = $1, status = $2, source = $3, description = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5 AND user_id = $6
		RETURNING updated_at`

	return r.pool.QueryRow(ctx, query, v.Name, v.Status, v.Source, v.Description, v.ID, v.UserID).
		Scan(&v.UpdatedAt)
}

func (r *TrackerRepository) DeleteVacancy(ctx context.Context, id, userID uuid.UUID) error {
	const query = `DELETE FROM vacancies WHERE id = $1 AND user_id = $2`
	res, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// Resumes
func (r *TrackerRepository) CreateResume(ctx context.Context, res *models.Resume) error {
	const query = `
		INSERT INTO resumes (id, vacancy_id, user_id, text)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at, updated_at`

	if res.ID == uuid.Nil {
		res.ID = uuid.New()
	}

	return r.pool.QueryRow(ctx, query, res.ID, res.VacancyID, res.UserID, res.Text).
		Scan(&res.CreatedAt, &res.UpdatedAt)
}

func (r *TrackerRepository) GetResume(ctx context.Context, id uuid.UUID) (*models.Resume, error) {
	const query = `
		SELECT id, vacancy_id, user_id, text, created_at, updated_at
		FROM resumes WHERE id = $1`

	var res models.Resume
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&res.ID, &res.VacancyID, &res.UserID, &res.Text, &res.CreatedAt, &res.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, err
	}
	return &res, nil
}

func (r *TrackerRepository) DeleteResume(ctx context.Context, id, userID uuid.UUID) error {
	const query = `DELETE FROM resumes WHERE id = $1 AND user_id = $2`
	res, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}

// Tailored Resumes
func (r *TrackerRepository) CreateTailoredResume(ctx context.Context, tr *models.TailoredResume) error {
	const query = `
		INSERT INTO tailored_resumes (id, resume_id, result)
		VALUES ($1, $2, $3)
		RETURNING created_at`

	if tr.ID == uuid.Nil {
		tr.ID = uuid.New()
	}

	return r.pool.QueryRow(ctx, query, tr.ID, tr.ResumeID, tr.Result).
		Scan(&tr.CreatedAt)
}

func (r *TrackerRepository) GetTailoredResume(ctx context.Context, id uuid.UUID) (*models.TailoredResume, error) {
	const query = `SELECT id, resume_id, result, created_at FROM tailored_resumes WHERE id = $1`

	var tr models.TailoredResume
	err := r.pool.QueryRow(ctx, query, id).Scan(&tr.ID, &tr.ResumeID, &tr.Result, &tr.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrNotFound
		}
		return nil, err
	}
	return &tr, nil
}

func (r *TrackerRepository) DeleteTailoredResume(ctx context.Context, id uuid.UUID) error {
	const query = `DELETE FROM tailored_resumes WHERE id = $1`
	res, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return models.ErrNotFound
	}
	return nil
}
