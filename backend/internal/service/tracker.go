package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type TrackerRepo interface {
	CreateVacancy(ctx context.Context, v *models.Vacancy) error
	GetVacancy(ctx context.Context, id uuid.UUID) (*models.Vacancy, error)
	ListVacancies(ctx context.Context, userID uuid.UUID) ([]models.Vacancy, error)
	UpdateVacancy(ctx context.Context, v *models.Vacancy) error
	DeleteVacancy(ctx context.Context, id, userID uuid.UUID) error

	ListResumesByVacancy(ctx context.Context, vacancyID uuid.UUID) ([]models.Resume, error)
	ListAllUserResumes(ctx context.Context, userID uuid.UUID) ([]models.Resume, error)
	GetResume(ctx context.Context, id uuid.UUID) (*models.Resume, error)
	DeleteResume(ctx context.Context, id, userID uuid.UUID) error

	// Tailored Resumes (internal use via Resume)
	GetTailoredResumeByResumeID(ctx context.Context, resumeID uuid.UUID) (*models.TailoredResume, error)
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

func (s *TrackerService) GetVacancy(ctx context.Context, id, userID uuid.UUID) (*models.Vacancy, []models.Resume, error) {
	v, err := s.repo.GetVacancy(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if v.UserID != userID {
		return nil, nil, models.ErrNotFound
	}

	resumes, err := s.repo.ListResumesByVacancy(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	return v, resumes, nil
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
func (s *TrackerService) ListUserResumes(ctx context.Context, userID uuid.UUID) ([]models.Resume, error) {
	return s.repo.ListAllUserResumes(ctx, userID)
}

func (s *TrackerService) GetResume(ctx context.Context, id, userID uuid.UUID) (*models.Resume, *models.TailoredResume, error) {
	res, err := s.repo.GetResume(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if res.UserID != userID {
		return nil, nil, models.ErrNotFound
	}

	tailored, err := s.repo.GetTailoredResumeByResumeID(ctx, id)
	if err != nil && !errors.Is(err, models.ErrNotFound) {
		return nil, nil, err
	}

	return res, tailored, nil
}

func (s *TrackerService) DeleteResume(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.DeleteResume(ctx, id, userID)
}
