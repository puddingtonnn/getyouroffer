package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// VacancyStatus represents the current state of a job application.
type VacancyStatus string

const (
	StatusDraft    VacancyStatus = "draft"
	StatusSent     VacancyStatus = "sent"
	StatusReplied  VacancyStatus = "replied"
	StatusRejected VacancyStatus = "rejected"
	StatusOffer    VacancyStatus = "offer"
)

// Vacancy represents a job opening the user is interested in.
type Vacancy struct {
	ID          uuid.UUID     `json:"id"`
	UserID      uuid.UUID     `json:"user_id"`
	Name        string        `json:"name"`
	Status      VacancyStatus `json:"status"`
	Source      string        `json:"source"`
	Description string        `json:"description"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// Resume represents a base resume uploaded by the user for a specific vacancy.
type Resume struct {
	ID         uuid.UUID `json:"id"`
	VacancyID  uuid.UUID `json:"vacancy_id"`
	UserID     uuid.UUID `json:"user_id"`
	Text       string    `json:"text"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// TailoredResume holds the LLM-generated result for a specific resume.
type TailoredResume struct {
	ID        uuid.UUID       `json:"id"`
	ResumeID  uuid.UUID       `json:"resume_id"`
	Result    json.RawMessage `json:"result"` // Stores models.Result as JSONB
	CreatedAt time.Time       `json:"created_at"`
}
