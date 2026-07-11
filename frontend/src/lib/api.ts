// Thin client for the Go backend. In dev, /api requests are proxied by Vite
// to http://localhost:8090 (see vite.config.ts). All thrown errors carry
// Russian, user-facing messages so the UI can render them directly.
import * as demo from './demo'

const API_BASE = '/api'

const TOKEN_KEY = 'gyo_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ApiError keeps the HTTP status so callers can react to 401 (expired token).
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Mirror of the LLM output contract (see AGENTS.md and backend/internal/models).
export type TailorResult = {
  match_score: number
  matches: { requirement: string; evidence: string }[]
  gaps: { requirement: string; suggestion: string }[]
  keywords_to_add: string[]
  tailored_resume: string
  cover_letter: string
}

export type VacancyStatus = 'draft' | 'sent' | 'replied' | 'rejected' | 'offer'

export type Vacancy = {
  id: string
  user_id: string
  name: string
  status: VacancyStatus
  source: string
  description: string
  created_at: string
  updated_at: string
}

export type Resume = {
  id: string
  vacancy_id: string
  user_id: string
  text: string
  created_at: string
  updated_at: string
}

export type VacancyWithResumes = Vacancy & { resumes: Resume[] | null }

export type ResumeWithResult = Resume & {
  tailored_result: { id: string; resume_id: string; result: TailorResult; created_at: string } | null
}

export type Profile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

// request wraps fetch: attaches the Bearer token, unwraps the {"error": msg}
// envelope and turns network failures into Russian messages.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    // Network failure: fetch rejects with a raw browser TypeError
    // ("Failed to fetch") that must not reach the Russian UI.
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что бэкенд запущен.', 0)
  }

  if (!res.ok) {
    let message = 'Что-то пошло не так. Попробуйте позже.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Non-JSON body: keep the default message.
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('Сервер вернул некорректный ответ. Попробуйте ещё раз.', res.status)
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// --- Auth ---

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const { token } = await request<{ token: string }>(
    '/users/register',
    jsonInit('POST', { email, password, first_name: firstName, last_name: lastName }),
  )
  return token
}

export async function login(email: string, password: string): Promise<string> {
  const { token } = await request<{ token: string }>(
    '/users/login',
    jsonInit('POST', { email, password }),
  )
  return token
}

export function getProfile(): Promise<Profile> {
  if (demo.isDemoMode()) return Promise.resolve(demo.demoProfile)
  return request<Profile>('/users/me')
}

// --- Tracker (demo mode swaps in the offline seeded store) ---

export function createVacancy(name: string, description: string, source: string): Promise<Vacancy> {
  if (demo.isDemoMode()) return demo.createVacancy(name, description, source)
  return request<Vacancy>('/vacancies/', jsonInit('POST', { name, description, source }))
}

export function listVacancies(): Promise<VacancyWithResumes[]> {
  if (demo.isDemoMode()) return demo.listVacancies()
  return request<VacancyWithResumes[]>('/vacancies/')
}

export function getVacancy(id: string): Promise<VacancyWithResumes> {
  if (demo.isDemoMode()) return demo.getVacancy(id)
  return request<VacancyWithResumes>(`/vacancies/${id}`)
}

export function updateVacancyStatus(id: string, status: VacancyStatus): Promise<Vacancy> {
  if (demo.isDemoMode()) return demo.updateVacancyStatus(id, status)
  return request<Vacancy>(`/vacancies/${id}`, jsonInit('PATCH', { status }))
}

export function deleteVacancy(id: string): Promise<void> {
  if (demo.isDemoMode()) return demo.deleteVacancy(id)
  return request<void>(`/vacancies/${id}`, { method: 'DELETE' })
}

export function getResume(id: string): Promise<ResumeWithResult> {
  if (demo.isDemoMode()) return demo.getResume(id)
  return request<ResumeWithResult>(`/resumes/${id}`)
}

// --- Tailor ---

// tailorResume sends the resume PDF and the vacancy text to the backend and
// returns the parsed result. The vacancy must already exist in the tracker.
export async function tailorResume(
  file: File,
  vacancy: string,
  vacancyID: string,
): Promise<TailorResult> {
  if (demo.isDemoMode()) return demo.tailorResume(file, vacancy, vacancyID)

  const form = new FormData()
  form.append('resume', file)
  form.append('vacancy', vacancy)
  form.append('vacancy_id', vacancyID)

  const data = await request<TailorResult>('/tailor', { method: 'POST', body: form })

  // The backend normalizes null arrays away, but guard anyway: a nullish
  // field must never crash the results panel.
  return normalizeResult(data)
}

export function normalizeResult(data: Partial<TailorResult> | null | undefined): TailorResult {
  return {
    match_score: data?.match_score ?? 0,
    matches: data?.matches ?? [],
    gaps: data?.gaps ?? [],
    keywords_to_add: data?.keywords_to_add ?? [],
    tailored_resume: data?.tailored_resume ?? '',
    cover_letter: data?.cover_letter ?? '',
  }
}
