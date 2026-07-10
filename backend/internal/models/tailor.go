// Package domain holds the entities, ports and sentinel errors of the resume
// tailoring feature. It has no dependencies on other project packages or on
// external libraries: the dependency rule points inward.
package models

// Result is the structured output of a single tailoring run. Its shape mirrors
// the strict JSON contract the LLM must return (see AGENTS.md).
type Result struct {
	MatchScore     float64  `json:"match_score"`
	Matches        []Match  `json:"matches"`
	Gaps           []Gap    `json:"gaps"`
	KeywordsToAdd  []string `json:"keywords_to_add"`
	TailoredResume string   `json:"tailored_resume"`
	CoverLetter    string   `json:"cover_letter"`
}

// Match is a strong point where the resume already satisfies a requirement.
type Match struct {
	Requirement string `json:"requirement"`
	Evidence    string `json:"evidence"`
}

// Gap is a requirement the resume does not yet cover, plus an honest
// suggestion for how to address it.
type Gap struct {
	Requirement string `json:"requirement"`
	Suggestion  string `json:"suggestion"`
}

// Normalize enforces the contract invariants the LLM cannot be trusted to
// keep: slices are never nil (a nil slice marshals to JSON null, which the
// frontend types as a non-nullable array) and the score stays in [0, 100].
func (r *Result) Normalize() {
	if r.Matches == nil {
		r.Matches = []Match{}
	}
	if r.Gaps == nil {
		r.Gaps = []Gap{}
	}
	if r.KeywordsToAdd == nil {
		r.KeywordsToAdd = []string{}
	}
	if r.MatchScore < 0 {
		r.MatchScore = 0
	}
	if r.MatchScore > 100 {
		r.MatchScore = 100
	}
}
