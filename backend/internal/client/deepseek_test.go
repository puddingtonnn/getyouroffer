package client

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

func TestStripJSONFences(t *testing.T) {
	const want = `{"match_score":80}`

	tests := []struct {
		name string
		in   string
	}{
		{name: "bare json", in: `{"match_score":80}`},
		{name: "lowercase fence", in: "```json\n{\"match_score\":80}\n```"},
		{name: "uppercase fence", in: "```JSON\n{\"match_score\":80}\n```"},
		{name: "preamble before fence", in: "Вот результат:\n```json\n{\"match_score\":80}\n```"},
		{name: "trailing prose after fence", in: "```json\n{\"match_score\":80}\n```\nНадеюсь, помог!"},
		{name: "surrounding whitespace", in: "\n\n  {\"match_score\":80}  \n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := stripJSONFences(tt.in); got != want {
				t.Fatalf("stripJSONFences(%q) = %q, want %q", tt.in, got, want)
			}
		})
	}

	t.Run("no json at all passes through", func(t *testing.T) {
		if got := stripJSONFences("sorry, no data"); got != "sorry, no data" {
			t.Fatalf("got %q, want input unchanged", got)
		}
	})
}

// newChatServer fakes the DeepSeek chat/completions endpoint returning the
// given message content.
func newChatServer(t *testing.T, content string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The request must ask for guaranteed-JSON output.
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decoding request: %v", err)
		}
		if rf, _ := req["response_format"].(map[string]any); rf["type"] != "json_object" {
			t.Errorf("response_format = %v, want json_object", req["response_format"])
		}
		if req["max_tokens"] == nil || req["max_tokens"].(float64) <= 0 {
			t.Errorf("max_tokens missing in request")
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization = %q", got)
		}

		resp := map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"role": "assistant", "content": content}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			t.Errorf("encoding response: %v", err)
		}
	}))
}

func TestClientTailor(t *testing.T) {
	t.Run("valid contract json", func(t *testing.T) {
		srv := newChatServer(t, `{"match_score":85.5,"matches":[],"gaps":[],"keywords_to_add":["go"],"tailored_resume":"r","cover_letter":"c"}`)
		defer srv.Close()

		c := NewDeepSeek("test-key", srv.URL)
		got, err := c.Tailor(context.Background(), "resume", "vacancy")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.MatchScore != 85.5 || got.CoverLetter != "c" {
			t.Fatalf("result = %+v", got)
		}
	})

	t.Run("fenced json still parses", func(t *testing.T) {
		srv := newChatServer(t, "```json\n{\"match_score\":50}\n```")
		defer srv.Close()

		c := NewDeepSeek("test-key", srv.URL)
		got, err := c.Tailor(context.Background(), "resume", "vacancy")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.MatchScore != 50 {
			t.Fatalf("MatchScore = %v, want 50", got.MatchScore)
		}
	})

	t.Run("non-200 maps to ErrLLMUnavailable", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "nope", http.StatusUnauthorized)
		}))
		defer srv.Close()

		c := NewDeepSeek("bad-key", srv.URL)
		_, err := c.Tailor(context.Background(), "resume", "vacancy")
		if !errors.Is(err, models.ErrLLMUnavailable) {
			t.Fatalf("err = %v, want ErrLLMUnavailable", err)
		}
	})

	t.Run("garbage content maps to ErrBadLLMResponse", func(t *testing.T) {
		srv := newChatServer(t, "sorry, I cannot help with that")
		defer srv.Close()

		c := NewDeepSeek("test-key", srv.URL)
		_, err := c.Tailor(context.Background(), "resume", "vacancy")
		if !errors.Is(err, models.ErrBadLLMResponse) {
			t.Fatalf("err = %v, want ErrBadLLMResponse", err)
		}
	})

	t.Run("empty choices maps to ErrBadLLMResponse", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[]}`))
		}))
		defer srv.Close()

		c := NewDeepSeek("test-key", srv.URL)
		_, err := c.Tailor(context.Background(), "resume", "vacancy")
		if !errors.Is(err, models.ErrBadLLMResponse) {
			t.Fatalf("err = %v, want ErrBadLLMResponse", err)
		}
	})

	t.Run("unreachable host maps to ErrLLMUnavailable", func(t *testing.T) {
		c := NewDeepSeek("test-key", "http://127.0.0.1:1")
		_, err := c.Tailor(context.Background(), "resume", "vacancy")
		if !errors.Is(err, models.ErrLLMUnavailable) {
			t.Fatalf("err = %v, want ErrLLMUnavailable", err)
		}
	})
}
