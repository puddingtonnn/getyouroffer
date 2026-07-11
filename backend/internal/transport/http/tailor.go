// Tailoring feature: the HTTP handler. It depends
// on the service only through a locally declared interface (consumer side),
// so it stays decoupled from the concrete service.
package http

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)


const (
	// maxUploadBytes bounds the whole request body via http.MaxBytesReader;
	// it doubles as ParseMultipartForm's in-memory threshold.
	maxUploadBytes = 10 << 20 // 10 MiB
	// maxVacancyBytes bounds the vacancy text so a paste mistake (or abuse)
	// does not turn into a huge paid LLM request.
	maxVacancyBytes = 50 << 10 // 50 KiB
)

// tailorService is the port the handler consumes. Declared here (consumer
// side) so delivery depends on an abstraction, not the concrete use case.
type tailorService interface {
	Tailor(ctx context.Context, userID uuid.UUID, vacancyID uuid.UUID, pdf io.Reader, vacancy string) (*models.Result, error)
}


// TailorHandler serves POST /api/tailor.
type TailorHandler struct {
	service tailorService
}

// NewTailorHandler wires the service into the TailorHandler.
func NewTailorHandler(service tailorService) *TailorHandler {
	return &TailorHandler{service: service}
}

// Tailor accepts a multipart form (resume PDF + vacancy text) and returns the
// structured Result as JSON. Resume, vacancy and letter content are not logged.
//
// @Summary		Tailor resume to vacancy
// @Description	Extracts text from a PDF resume, analyzes it against a vacancy text using LLM, and returns a tailored resume, cover letter, and match analysis.
// @Tags			tailor
// @Accept			multipart/form-data
// @Produce		json
// @Param			resume		formData	file	true	"Resume PDF file (max 10MB)"
// @Param			vacancy		formData	string	true	"Vacancy text (max 50KB)"
// @Param			vacancy_id	formData	string	true	"Vacancy ID (UUID)"
// @Success		200			{object}	models.Result
// @Security ApiKeyAuth
// @Router			/api/tailor [post]
func (h *TailorHandler) Tailor(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(UserIDKey).(string)
	if !ok {
		WriteError(w, http.StatusUnauthorized, "Пользователь не авторизован.")
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "Некорректный ID пользователя.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)

	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			WriteError(w, http.StatusRequestEntityTooLarge, "Файл слишком большой: допустимо до 10 МБ.")
			return
		}
		WriteError(w, http.StatusBadRequest, "Не удалось прочитать форму. Проверьте файл и попробуйте снова.")
		return
	}

	vacancyIDStr := r.FormValue("vacancy_id")
	vacancyID, err := uuid.Parse(vacancyIDStr)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "Некорректный ID вакансии.")
		return
	}

	file, _, err := r.FormFile("resume")

	if err != nil {
		WriteError(w, http.StatusBadRequest, "Прикрепите файл резюме в формате PDF.")
		return
	}
	defer file.Close()

	vacancy := r.FormValue("vacancy")
	if len(vacancy) > maxVacancyBytes {
		WriteError(w, http.StatusBadRequest, "Текст вакансии слишком длинный: допустимо до 50 КБ.")
		return
	}

	result, err := h.service.Tailor(r.Context(), userID, vacancyID, file, vacancy)

	if err != nil {
		handleServiceError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, result)
}

func handleServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, models.ErrEmptyInput):
		WriteError(w, http.StatusBadRequest, "Добавьте резюме и текст вакансии.")
	case errors.Is(err, models.ErrUnreadablePDF):
		WriteError(w, http.StatusUnprocessableEntity, "Не удалось извлечь текст из PDF. Возможно, это скан или защищённый файл.")
	case errors.Is(err, models.ErrLLMUnavailable):
		slog.Error("tailor: llm unavailable", "err", err)
		WriteError(w, http.StatusBadGateway, "Сервис подгонки временно недоступен. Попробуйте позже.")
	case errors.Is(err, models.ErrBadLLMResponse):
		slog.Error("tailor: bad llm response", "err", err)
		WriteError(w, http.StatusBadGateway, "Не удалось разобрать ответ модели. Попробуйте ещё раз.")
	default:
		slog.Error("tailor: request failed", "err", err)
		WriteError(w, http.StatusInternalServerError, "Внутренняя ошибка. Попробуйте позже.")
	}
}
