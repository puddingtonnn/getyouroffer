package service

import (
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
	extractor ResumeExtractor
	tailor    ResumeTailor
}

// NewTailorService wires the ports into a TailorService.
func NewTailorService(extractor ResumeExtractor, tailor ResumeTailor) *TailorService {
	return &TailorService{extractor: extractor, tailor: tailor}
}

// Tailor extracts text from the resume PDF and asks the LLM to tailor it to
// the vacancy. Content is never logged.
func (s *TailorService) Tailor(ctx context.Context, pdf io.Reader, vacancy string) (*models.Result, error) {
	if pdf == nil || strings.TrimSpace(vacancy) == "" {
		return nil, models.ErrEmptyInput
	}

	resume, err := s.extractor.Extract(pdf)
	if err != nil {
		return nil, fmt.Errorf("extracting resume text: %w", err)
	}
	if strings.TrimSpace(resume) == "" {
		return nil, models.ErrUnreadablePDF
	}

	result, err := s.tailor.Tailor(ctx, resume, vacancy)
	if err != nil {
		return nil, fmt.Errorf("tailoring resume: %w", err)
	}
	result.Normalize()
	return result, nil
}
