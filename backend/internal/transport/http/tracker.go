package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type trackerService interface {
	CreateVacancy(ctx context.Context, v *models.Vacancy) (*models.Vacancy, error)
	GetVacancy(ctx context.Context, id, userID uuid.UUID) (*models.Vacancy, []models.Resume, error)
	ListVacancies(ctx context.Context, userID uuid.UUID) ([]models.Vacancy, error)
	UpdateVacancy(ctx context.Context, v *models.Vacancy) (*models.Vacancy, error)
	DeleteVacancy(ctx context.Context, id, userID uuid.UUID) error

	ListUserResumes(ctx context.Context, userID uuid.UUID) ([]models.Resume, error)
	GetResume(ctx context.Context, id, userID uuid.UUID) (*models.Resume, *models.TailoredResume, error)
	DeleteResume(ctx context.Context, id, userID uuid.UUID) error
}

type TrackerHandler struct {
	service trackerService
}

func NewTrackerHandler(service trackerService) *TrackerHandler {
	return &TrackerHandler{service: service}
}

func getUserID(r *http.Request) (uuid.UUID, error) {
	idStr, ok := r.Context().Value(UserIDKey).(string)
	if !ok {
		return uuid.Nil, errors.New("unauthorized")
	}
	return uuid.Parse(idStr)
}

type CreateVacancyRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Source      string `json:"source"`
}

type UpdateVacancyStatusRequest struct {
	Status string `json:"status"`
}

// Vacancies

// CreateVacancy handles POST /api/vacancies
// @Summary Create a vacancy
// @Tags vacancies
// @Accept json
// @Produce json
// @Param vacancy body CreateVacancyRequest true "Vacancy data"
// @Success 201 {object} models.Vacancy
// @Security ApiKeyAuth
// @Router /api/vacancies [post]
func (h *TrackerHandler) CreateVacancy(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateVacancyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Name == "" {
		WriteError(w, http.StatusBadRequest, "name is required")
		return
	}

	v := models.Vacancy{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Source:      req.Source,
		Status:      "draft",
	}

	res, err := h.service.CreateVacancy(r.Context(), &v)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusCreated, res)
}

type VacancyResponse struct {
	models.Vacancy
	Resumes []models.Resume `json:"resumes"`
}

// GetVacancy handles GET /api/vacancies/{id}
// @Summary Get a vacancy
// @Tags vacancies
// @Produce json
// @Param id path string true "Vacancy ID"
// @Success 200 {object} VacancyResponse
// @Security ApiKeyAuth
// @Router /api/vacancies/{id} [get]
func (h *TrackerHandler) GetVacancy(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}

	v, resumes, err := h.service.GetVacancy(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "vacancy not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, VacancyResponse{
		Vacancy: *v,
		Resumes: resumes,
	})
}

// ListVacancies handles GET /api/vacancies
// @Summary List vacancies
// @Tags vacancies
// @Produce json
// @Success 200 {array} models.Vacancy
// @Security ApiKeyAuth
// @Router /api/vacancies [get]
func (h *TrackerHandler) ListVacancies(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.service.ListVacancies(r.Context(), userID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, list)
}

// UpdateVacancy handles PATCH /api/vacancies/{id}
// @Summary Update a vacancy status
// @Tags vacancies
// @Accept json
// @Produce json
// @Param id path string true "Vacancy ID"
// @Param status body UpdateVacancyStatusRequest true "New status"
// @Success 200 {object} models.Vacancy
// @Security ApiKeyAuth
// @Router /api/vacancies/{id} [patch]
func (h *TrackerHandler) UpdateVacancy(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req UpdateVacancyStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request")
		return
	}

	validStatuses := map[string]bool{
		"draft":    true,
		"sent":     true,
		"replied":  true,
		"rejected": true,
		"offer":    true,
	}
	if !validStatuses[req.Status] {
		WriteError(w, http.StatusBadRequest, "invalid status: must be draft|sent|replied|rejected|offer")
		return
	}

	v, _, err := h.service.GetVacancy(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "vacancy not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if v.UserID != userID {
		WriteError(w, http.StatusForbidden, "forbidden")
		return
	}

	v.Status = models.VacancyStatus(req.Status)

	res, err := h.service.UpdateVacancy(r.Context(), v)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, res)
}

// DeleteVacancy handles DELETE /api/vacancies/{id}
// @Summary Delete a vacancy
// @Tags vacancies
// @Param id path string true "Vacancy ID"
// @Success 204 "No Content"
// @Security ApiKeyAuth
// @Router /api/vacancies/{id} [delete]
func (h *TrackerHandler) DeleteVacancy(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.service.DeleteVacancy(r.Context(), id, userID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "vacancy not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Resumes

type ResumeResponse struct {
	models.Resume
	TailoredResult *models.TailoredResume `json:"tailored_result"`
}

// ListResumes handles GET /api/resumes
// @Summary List all user resumes
// @Tags resumes
// @Produce json
// @Success 200 {array} models.Resume
// @Security ApiKeyAuth
// @Router /api/resumes [get]
func (h *TrackerHandler) ListResumes(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.service.ListUserResumes(r.Context(), userID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, list)
}

// GetResume handles GET /api/resumes/{id}
// @Summary Get a resume
// @Tags resumes
// @Produce json
// @Param id path string true "Resume ID"
// @Success 200 {object} ResumeResponse
// @Security ApiKeyAuth
// @Router /api/resumes/{id} [get]
func (h *TrackerHandler) GetResume(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}

	res, tailored, err := h.service.GetResume(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "resume not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	WriteJSON(w, http.StatusOK, ResumeResponse{
		Resume:         *res,
		TailoredResult: tailored,
	})
}

// DeleteResume handles DELETE /api/resumes/{id}
// @Summary Delete a resume
// @Tags resumes
// @Param id path string true "Resume ID"
// @Success 204 "No Content"
// @Security ApiKeyAuth
// @Router /api/resumes/{id} [delete]
func (h *TrackerHandler) DeleteResume(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.service.DeleteResume(r.Context(), id, userID); err != nil {
		if errors.Is(err, models.ErrNotFound) {
			WriteError(w, http.StatusNotFound, "resume not found")
			return
		}
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
