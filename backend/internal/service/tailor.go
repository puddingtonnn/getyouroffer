package service

import (
	"bytes"
	"context"

	"fmt"
	"io"
	"strings"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// ResumeExtractor turns an uploaded resume file into plain text. Declared here
// (consumer side); the PDF adapter in package client implements it.
type ResumeExtractor interface {
	Extract(r io.Reader) (string, error)
}

// ResumeTailor asks the LLM to tailor a resume to a vacancy and returns the
// structured Result. The DeepSeek adapter in package client implements it.
type ResumeTailor interface {
	Tailor(ctx context.Context, resume, vacancy string) (*models.Result, error)
}

// TailorService orchestrates the resume tailoring flow through the ports above.
type TailorService struct {
	extractor    ResumeExtractor
	ocrExtractor ResumeExtractor
	tailor       ResumeTailor
}

// NewTailorService wires the ports into a TailorService.
func NewTailorService(extractor ResumeExtractor, ocrExtractor ResumeExtractor, tailor ResumeTailor) *TailorService {
	return &TailorService{
		extractor:    extractor,
		ocrExtractor: ocrExtractor,
		tailor:       tailor,
	}
}

// Tailor extracts text from the resume PDF and asks the LLM to tailor it to
// the vacancy. Content is never logged.
func (s *TailorService) Tailor(ctx context.Context, pdf io.Reader, vacancy string) (*models.Result, error) {
	if pdf == nil || strings.TrimSpace(vacancy) == "" {
		return nil, models.ErrEmptyInput
	}

	// We need to read the PDF into memory because we might need to read it twice
	// (once for normal extraction, once for OCR).
	data, err := io.ReadAll(pdf)
	if err != nil {
		return nil, fmt.Errorf("reading upload: %w", err)
	}

	// 1. Try normal extraction
	resume, err := s.extractor.Extract(bytes.NewReader(data))

	// BDD: "если текста мало, допустим 10-20 символов, то пытаемся прогнать через OCR"
	if err != nil || len(strings.TrimSpace(resume)) < 20 {
		// 2. Try OCR extraction
		ocrResume, ocrErr := s.ocrExtractor.Extract(bytes.NewReader(data))
		if ocrErr != nil {
			// If normal failed and OCR failed, return original error or unreadable
			if err != nil {
				return nil, fmt.Errorf("extracting resume text (normal failed: %v, ocr failed: %v)", err, ocrErr)
			}
			return nil, models.ErrUnreadablePDF
		}
		resume = ocrResume
	}

	if len(strings.TrimSpace(resume)) < 20 {
		return nil, models.ErrUnreadablePDF
	}

	result, err := s.tailor.Tailor(ctx, resume, vacancy)
	if err != nil {
		return nil, fmt.Errorf("tailoring resume: %w", err)
	}
	result.Normalize()
	return result, nil
}

