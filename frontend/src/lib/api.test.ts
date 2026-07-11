import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('login returns the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { token: 'jwt-123' }))
    const token = await api.login('a@b.c', 'password-1')
    expect(token).toBe('jwt-123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users/login')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('attaches the Bearer token to authorized requests', async () => {
    api.setToken('jwt-456')
    fetchMock.mockResolvedValue(jsonResponse(200, []))
    await api.listVacancies()
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer jwt-456')
  })

  it('surfaces the backend error envelope as a Russian message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Добавьте резюме и текст вакансии.' }))
    await expect(api.getVacancy('x')).rejects.toThrow('Добавьте резюме и текст вакансии.')
  })

  it('turns network failures into a Russian message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.listVacancies()).rejects.toThrow(/Не удалось связаться с сервером/)
  })

  it('drops the token on a 401 from a protected route', async () => {
    api.setToken('expired-jwt')
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }))
    await expect(api.getProfile()).rejects.toThrow()
    expect(api.getToken()).toBeNull()
  })

  it('keeps the token on a 401 from login (wrong credentials)', async () => {
    api.setToken('still-valid')
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'invalid credentials' }))
    await expect(api.login('a@b.c', 'wrong')).rejects.toThrow('invalid credentials')
    expect(api.getToken()).toBe('still-valid')
  })

  it('normalizeResult backfills nullish fields', () => {
    expect(api.normalizeResult(null)).toEqual({
      match_score: 0,
      matches: [],
      gaps: [],
      keywords_to_add: [],
      tailored_resume: '',
      cover_letter: '',
    })
    expect(api.normalizeResult({ match_score: 84 }).match_score).toBe(84)
  })
})
