package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type TrackerRepo interface {
	CreateVacancy(ctx context.Context, v *models.Vacancy) error
	GetVacancy(ctx context.Context, id uuid.UUID) (*models.Vacancy, error)
	ListVacancies(ctx context.Context, userID uuid.UUID) ([]models.Vacancy, error)
	UpdateVacancy(ctx context.Context, v *models.Vacancy) error
	DeleteVacancy(ctx context.Context, id, userID uuid.UUID) error

	CreateResume(ctx context.Context, res *models.Resume) error
	GetResume(ctx context.Context, id uuid.UUID) (*models.Resume, error)
	DeleteResume(ctx context.Context, id, userID uuid.UUID) error

	CreateTailoredResume(ctx context.Context, tr *models.TailoredResume) error
	GetTailoredResume(ctx context.Context, id uuid.UUID) (*models.TailoredResume, error)
	DeleteTailoredResume(ctx context.Context, id uuid.UUID) error
}

type TrackerService struct {
	repo TrackerRepo
}

func NewTrackerService(repo TrackerRepo) *TrackerService {
	return &TrackerService{repo: repo}
}

// Vacancies
func (s *TrackerService) CreateVacancy(ctx context.Context, v *models.Vacancy) (*models.Vacancy, error) {
	if err := s.repo.CreateVacancy(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *TrackerService) GetVacancy(ctx context.Context, id uuid.UUID) (*models.Vacancy, error) {
	return s.repo.GetVacancy(ctx, id)
}

func (s *TrackerService) ListVacancies(ctx context.Context, userID uuid.UUID) ([]models.Vacancy, error) {
	return s.repo.ListVacancies(ctx, userID)
}

func (s *TrackerService) UpdateVacancy(ctx context.Context, v *models.Vacancy) (*models.Vacancy, error) {
	if err := s.repo.UpdateVacancy(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *TrackerService) DeleteVacancy(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.DeleteVacancy(ctx, id, userID)
}

// Resumes
func (s *TrackerService) CreateResume(ctx context.Context, res *models.Resume) (*models.Resume, error) {
	if err := s.repo.CreateResume(ctx, res); err != nil {
		return nil, err
	}
	return res, nil
}

func (s *TrackerService) GetResume(ctx context.Context, id uuid.UUID) (*models.Resume, error) {
	return s.repo.GetResume(ctx, id)
}

func (s *TrackerService) DeleteResume(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.DeleteResume(ctx, id, userID)
}

// Tailored Resumes
func (s *TrackerService) CreateTailoredResume(ctx context.Context, tr *models.TailoredResume) (*models.TailoredResume, error) {
	if err := s.repo.CreateTailoredResume(ctx, tr); err != nil {
		return nil, err
	}
	return tr, nil
}

func (s *TrackerService) GetTailoredResume(ctx context.Context, id uuid.UUID) (*models.TailoredResume, error) {
	return s.repo.GetTailoredResume(ctx, id)
}

func (s *TrackerService) DeleteTailoredResume(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteTailoredResume(ctx, id)
}
