package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type fakeExtractor struct {
	text string
	err  error
}

func (f *fakeExtractor) Extract(io.Reader) (string, error) { return f.text, f.err }

type fakeTailor struct {
	result *models.Result
	err    error
}

func (f *fakeTailor) Tailor(context.Context, string, string) (*models.Result, error) {
	return f.result, f.err
}

func TestServiceTailor(t *testing.T) {
	extractFail := errors.New("boom")

	tests := []struct {
		name      string
		pdf       io.Reader
		vacancy   string
		extractor *fakeExtractor
		tailor    *fakeTailor
		wantErr   error
	}{
		{
			name:    "nil pdf",
			pdf:     nil,
			vacancy: "vacancy",
			wantErr: models.ErrEmptyInput,
		},
		{
			name:    "blank vacancy",
			pdf:     strings.NewReader("%PDF"),
			vacancy: "   \n\t",
			wantErr: models.ErrEmptyInput,
		},
		{
			name:      "extractor failure is wrapped",
			pdf:       strings.NewReader("%PDF"),
			vacancy:   "vacancy",
			extractor: &fakeExtractor{err: extractFail},
			wantErr:   extractFail,
		},
		{
			name:      "empty text means unreadable pdf",
			pdf:       strings.NewReader("%PDF"),
			vacancy:   "vacancy",
			extractor: &fakeExtractor{text: "  \n "},
			wantErr:   models.ErrUnreadablePDF,
		},
		{
			name:      "llm failure is wrapped",
			pdf:       strings.NewReader("%PDF"),
			vacancy:   "vacancy",
			extractor: &fakeExtractor{text: "resume text"},
			tailor:    &fakeTailor{err: models.ErrLLMUnavailable},
			wantErr:   models.ErrLLMUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewTailorService(tt.extractor, tt.tailor)
			_, err := svc.Tailor(context.Background(), tt.pdf, tt.vacancy)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want errors.Is(%v)", err, tt.wantErr)
			}
		})
	}
}

func TestServiceTailorNormalizesResult(t *testing.T) {
	// The LLM may omit array fields (nil slices marshal to JSON null and
	// crash the frontend) and may return an out-of-range score.
	svc := NewTailorService(
		&fakeExtractor{text: "resume text"},
		&fakeTailor{result: &models.Result{MatchScore: 150}},
	)

	got, err := svc.Tailor(context.Background(), strings.NewReader("%PDF"), "vacancy")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Matches == nil || got.Gaps == nil || got.KeywordsToAdd == nil {
		t.Fatalf("slices must be non-nil after Normalize, got %+v", got)
	}
	if got.MatchScore != 100 {
		t.Fatalf("MatchScore = %v, want clamped to 100", got.MatchScore)
	}
}
