// Thin client for the Go backend. In dev, /api requests are proxied by Vite
// to http://localhost:8090 (see vite.config.ts).
const API_BASE = '/api'

// Mirror of the LLM output contract (see AGENTS.md and backend/internal/tailor).
export type TailorResult = {
  match_score: number
  matches: { requirement: string; evidence: string }[]
  gaps: { requirement: string; suggestion: string }[]
  keywords_to_add: string[]
  tailored_resume: string
  cover_letter: string
}

// tailorResume sends the resume PDF and the vacancy text to the backend and
// returns the parsed result. All thrown errors carry Russian, user-facing
// messages so the UI can render them directly.
export async function tailorResume(
  file: File,
  vacancy: string,
): Promise<TailorResult> {
  const form = new FormData()
  form.append('resume', file)
  form.append('vacancy', vacancy)

  let res: Response
  try {
    res = await fetch(`${API_BASE}/tailor`, { method: 'POST', body: form })
  } catch {
    // Network failure: fetch rejects with a raw browser TypeError
    // ("Failed to fetch") that must not reach the Russian UI.
    throw new Error('Не удалось связаться с сервером. Проверьте, что бэкенд запущен.')
  }

  if (!res.ok) {
    let message = 'Не удалось подогнать резюме. Попробуйте позже.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Non-JSON body: keep the default message.
    }
    throw new Error(message)
  }

  let data: TailorResult
  try {
    data = (await res.json()) as TailorResult
  } catch {
    throw new Error('Сервер вернул некорректный ответ. Попробуйте ещё раз.')
  }

  // The backend normalizes null arrays away, but guard anyway: a nullish
  // field must never crash the results panel.
  return {
    match_score: data.match_score ?? 0,
    matches: data.matches ?? [],
    gaps: data.gaps ?? [],
    keywords_to_add: data.keywords_to_add ?? [],
    tailored_resume: data.tailored_resume ?? '',
    cover_letter: data.cover_letter ?? '',
  }
}
