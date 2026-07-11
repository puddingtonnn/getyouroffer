package models

import "errors"

// Sentinel errors let outer layers map failures to HTTP codes with errors.Is
// without inspecting infrastructure error types. When mapping an underlying
// failure onto a sentinel, keep the cause with a double %w
// (fmt.Errorf("...: %w: %w", sentinel, err)) so logs retain the real reason
// while resume, vacancy and letter content never leak into error text.
var (
	// --- user feature ---

	// ErrEmailTaken means an account with this email already exists.
	ErrEmailTaken = errors.New("email already taken")
	// ErrInvalidCredentials means the email/password pair does not match.
	// One error for both cases so responses do not reveal which emails exist.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrNotFound means the requested user or profile does not exist.
	ErrNotFound = errors.New("not found")
	// ErrInvalidEmail means the registration email is empty or malformed.
	ErrInvalidEmail = errors.New("invalid email")
	// ErrWeakPassword means the password fails the length policy (see the
	// service layer for the exact bounds).
	ErrWeakPassword = errors.New("weak password")

	// --- tailor feature ---

	// ErrEmptyInput means the resume or the vacancy text was missing.
	ErrEmptyInput = errors.New("empty input")
	// ErrUnreadablePDF means the PDF carried no extractable text (e.g. a scan).
	ErrUnreadablePDF = errors.New("unreadable pdf")
	// ErrLLMUnavailable means the LLM provider could not be reached.
	ErrLLMUnavailable = errors.New("llm unavailable")
	// ErrBadLLMResponse means the LLM returned something that is not valid
	// contract JSON.
	ErrBadLLMResponse = errors.New("bad llm response")
)
