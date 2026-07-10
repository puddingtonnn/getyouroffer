package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

type fakeService struct {
	result *models.Result
	err    error
}

func (f *fakeService) Tailor(context.Context, io.Reader, string) (*models.Result, error) {
	if f.err != nil {
		return nil, f.err
	}
	// Mirror the use case: results on the wire always carry normalized slices.
	f.result.Normalize()
	return f.result, nil
}

// multipartBody builds a resume+vacancy form. An empty filename skips the
// file part entirely.
func multipartBody(t *testing.T, filename, fileContent, vacancy string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if filename != "" {
		part, err := w.CreateFormFile("resume", filename)
		if err != nil {
			t.Fatalf("creating file part: %v", err)
		}
		if _, err := io.WriteString(part, fileContent); err != nil {
			t.Fatalf("writing file part: %v", err)
		}
	}
	if err := w.WriteField("vacancy", vacancy); err != nil {
		t.Fatalf("writing vacancy field: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("closing writer: %v", err)
	}
	return &buf, w.FormDataContentType()
}

func doTailor(t *testing.T, h *TailorHandler, body *bytes.Buffer, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/tailor", body)
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	h.Tailor(rec, req)
	return rec
}

func errorBody(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("error responses must be JSON envelopes, got %q: %v", rec.Body.String(), err)
	}
	return body["error"]
}

func TestHandlerTailor(t *testing.T) {
	okService := &fakeService{result: &models.Result{MatchScore: 42}}

	t.Run("success returns result with non-null arrays", func(t *testing.T) {
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", "Go developer")
		rec := doTailor(t, NewTailorHandler(okService), body, ct)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
		}
		var got models.Result
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("unmarshaling result: %v", err)
		}
		if got.Matches == nil || got.Gaps == nil || got.KeywordsToAdd == nil {
			t.Fatalf("arrays must never be null on the wire, got %s", rec.Body.String())
		}
	})

	t.Run("missing file is 400", func(t *testing.T) {
		body, ct := multipartBody(t, "", "", "Go developer")
		rec := doTailor(t, NewTailorHandler(okService), body, ct)
		if rec.Code != http.StatusBadRequest || errorBody(t, rec) == "" {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("empty vacancy is 400", func(t *testing.T) {
		svc := &fakeService{err: models.ErrEmptyInput}
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", "   ")
		rec := doTailor(t, NewTailorHandler(svc), body, ct)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("oversized vacancy is 400", func(t *testing.T) {
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", string(bytes.Repeat([]byte("a"), maxVacancyBytes+1)))
		rec := doTailor(t, NewTailorHandler(okService), body, ct)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("oversized body is 413", func(t *testing.T) {
		big := string(bytes.Repeat([]byte("a"), maxUploadBytes+1024))
		body, ct := multipartBody(t, "cv.pdf", big, "Go developer")
		rec := doTailor(t, NewTailorHandler(okService), body, ct)
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d, want 413", rec.Code)
		}
	})

	t.Run("unreadable pdf is 422", func(t *testing.T) {
		svc := &fakeService{err: models.ErrUnreadablePDF}
		body, ct := multipartBody(t, "cv.pdf", "not a pdf", "Go developer")
		rec := doTailor(t, NewTailorHandler(svc), body, ct)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422", rec.Code)
		}
	})

	t.Run("llm unavailable is 502", func(t *testing.T) {
		svc := &fakeService{err: models.ErrLLMUnavailable}
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", "Go developer")
		rec := doTailor(t, NewTailorHandler(svc), body, ct)
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("status = %d, want 502", rec.Code)
		}
	})

	t.Run("bad llm response is 502", func(t *testing.T) {
		svc := &fakeService{err: models.ErrBadLLMResponse}
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", "Go developer")
		rec := doTailor(t, NewTailorHandler(svc), body, ct)
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("status = %d, want 502", rec.Code)
		}
	})

	t.Run("unknown error is 500", func(t *testing.T) {
		svc := &fakeService{err: io.ErrUnexpectedEOF}
		body, ct := multipartBody(t, "cv.pdf", "%PDF-fake", "Go developer")
		rec := doTailor(t, NewTailorHandler(svc), body, ct)
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", rec.Code)
		}
	})
}
