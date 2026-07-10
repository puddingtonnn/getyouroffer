// Package client holds the outbound adapters (DeepSeek LLM, PDF extractor).
// DeepSeek adapts the DeepSeek chat API (OpenAI-compatible) to the
// service.ResumeTailor port. The HTTP client and prompt live here only; the
// rest of the app depends on the port. The API key is never logged.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

const (
	model          = "deepseek-chat"
	requestTimeout = 90 * time.Second
	// maxOutputTokens is DeepSeek's maximum; the default (4096) can truncate
	// a long tailored resume + cover letter mid-JSON.
	maxOutputTokens = 8192
)

// DeepSeek calls the DeepSeek chat/completions endpoint.
type DeepSeek struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewDeepSeek builds a DeepSeek client. baseURL comes from config, which owns
// the default (https://api.deepseek.com).
func NewDeepSeek(apiKey, baseURL string) *DeepSeek {
	return &DeepSeek{
		apiKey:     apiKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: requestTimeout},
	}
}

const systemPrompt = `Ты — ассистент по подготовке откликов на вакансии. ` +
	`Ты сравниваешь резюме с вакансией и готовишь пакет отклика. ` +
	`Отвечай СТРОГО валидным JSON без преамбулы, пояснений и markdown-обёрток. ` +
	`Схема ответа: {"match_score":число 0-100,"matches":[{"requirement":"","evidence":""}],` +
	`"gaps":[{"requirement":"","suggestion":""}],"keywords_to_add":[""],` +
	`"tailored_resume":"","cover_letter":""}. ` +
	`match_score — процент соответствия; matches — сильные совпадения с доказательствами из резюме; ` +
	`gaps — чего не хватает и честный совет; keywords_to_add — ключевые слова вакансии, которых нет в резюме; ` +
	`tailored_resume — переточенное под вакансию резюме; cover_letter — черновик сопроводительного письма. ` +
	`Весь текст в ответе пиши на языке вакансии.`

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	Stream         bool           `json:"stream"`
	MaxTokens      int            `json:"max_tokens"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

// Tailor sends the resume and vacancy to DeepSeek and parses the contract JSON.
func (c *DeepSeek) Tailor(ctx context.Context, resume, vacancy string) (*models.Result, error) {
	userPrompt := fmt.Sprintf("ВАКАНСИЯ:\n%s\n\nРЕЗЮМЕ:\n%s", vacancy, resume)

	body, err := json.Marshal(chatRequest{
		Model:     model,
		Stream:    false,
		MaxTokens: maxOutputTokens,
		// json_object mode makes the API return bare JSON, so fence-stripping
		// is only a fallback. The prompt must mention "JSON" for this mode —
		// systemPrompt does.
		ResponseFormat: responseFormat{Type: "json_object"},
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling deepseek: %w: %w", models.ErrLLMUnavailable, err)
	}
	defer func() {
		// Drain so the keep-alive connection can be reused.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deepseek status %d: %w", resp.StatusCode, models.ErrLLMUnavailable)
	}

	var chat chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chat); err != nil {
		return nil, fmt.Errorf("decoding deepseek response: %w: %w", models.ErrBadLLMResponse, err)
	}
	if len(chat.Choices) == 0 {
		return nil, fmt.Errorf("empty choices: %w", models.ErrBadLLMResponse)
	}

	content := stripJSONFences(chat.Choices[0].Message.Content)

	var result models.Result
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("parsing contract json: %w: %w", models.ErrBadLLMResponse, err)
	}
	return &result, nil
}

// stripJSONFences removes an optional ```json ... ``` markdown wrapper the
// model may add despite instructions and json_object mode. Fallback only:
// it extracts the region between the first '{' and the last '}' when the
// content is not already bare JSON.
func stripJSONFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "{") {
		return s
	}
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start == -1 || end == -1 || end < start {
		return s
	}
	return s[start : end+1]
}
