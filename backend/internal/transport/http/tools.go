package http

import (
	"io"
	"net/http"
)

// ResumeExtractor defines the interface for text extraction.
type ResumeExtractor interface {
	Extract(pdf io.Reader) (string, error)
}

// ToolsHandler provides debug endpoints for text extraction.
type ToolsHandler struct {
	pdfExtractor ResumeExtractor
	ocrExtractor ResumeExtractor
}

func NewToolsHandler(pdf, ocr ResumeExtractor) *ToolsHandler {
	return &ToolsHandler{
		pdfExtractor: pdf,
		ocrExtractor: ocr,
	}
}

// ExtractText handles plain text extraction from PDF.
//
//	@Summary		Extract text from PDF (Plain)
//	@Description	Attempts to extract text layer from PDF without OCR.
//	@Tags			tools
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			resume	formData	file	true	"Resume PDF file"
//	@Success		200		{object}	TextResponse
//	@Failure		400		{object}	ErrorResponse
//	@Router			/api/tools/extract-text [post]
func (h *ToolsHandler) ExtractText(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("resume")
	if err != nil {
		WriteError(w, http.StatusBadRequest, "Добавьте файл резюме.")
		return
	}
	defer file.Close()

	text, err := h.pdfExtractor.Extract(file)
	if err != nil {
		WriteError(w, http.StatusUnprocessableEntity, "Не удалось извлечь текст.")
		return
	}

	WriteJSON(w, http.StatusOK, TextResponse{Text: text})
}

// ExtractOCR handles OCR text extraction from PDF.
//
//	@Summary		Extract text from PDF (OCR)
//	@Description	Converts PDF to images and runs Tesseract OCR.
//	@Tags			tools
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			resume	formData	file	true	"Resume PDF file"
//	@Success		200		{object}	TextResponse
//	@Failure		400		{object}	ErrorResponse
//	@Router			/api/tools/extract-ocr [post]
func (h *ToolsHandler) ExtractOCR(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("resume")
	if err != nil {
		WriteError(w, http.StatusBadRequest, "Добавьте файл резюме.")
		return
	}
	defer file.Close()

	text, err := h.ocrExtractor.Extract(file)
	if err != nil {
		WriteError(w, http.StatusUnprocessableEntity, "Не удалось выполнить OCR.")
		return
	}

	WriteJSON(w, http.StatusOK, TextResponse{Text: text})
}

// TextResponse is the response for text extraction tools.
type TextResponse struct {
	Text string `json:"text"`
}
