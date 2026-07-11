import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as demo from './demo'

describe('demo store', () => {
  beforeEach(() => {
    localStorage.clear()
    demo.enterDemo()
  })

  afterEach(() => {
    demo.exitDemo()
    vi.useRealTimers()
  })

  it('enters and exits demo mode', () => {
    expect(demo.isDemoMode()).toBe(true)
    demo.exitDemo()
    expect(demo.isDemoMode()).toBe(false)
  })

  it('seeds the tracker with vacancies', async () => {
    const list = await demo.listVacancies()
    expect(list.length).toBeGreaterThanOrEqual(6)
    expect(list.some((v) => v.status === 'offer')).toBe(true)
  })

  it('creates, updates and deletes a vacancy', async () => {
    const created = await demo.createVacancy('Тест · «Тест»', 'описание', '')
    expect(created.status).toBe('draft')

    const updated = await demo.updateVacancyStatus(created.id, 'sent')
    expect(updated.status).toBe('sent')

    await demo.deleteVacancy(created.id)
    const list = await demo.listVacancies()
    expect(list.find((v) => v.id === created.id)).toBeUndefined()
  })

  it('persists across reloads via localStorage', async () => {
    const created = await demo.createVacancy('Живучий', 'x', '')
    // A "reload" is just a fresh read of the same storage.
    const list = await demo.listVacancies()
    expect(list.find((v) => v.id === created.id)?.name).toBe('Живучий')
  })

  it('tailorResume attaches a retrievable result', async () => {
    vi.useFakeTimers()
    const created = await vi.waitFor(() => demo.createVacancy('С резюме', 'x', ''))

    const pending = demo.tailorResume(new File(['pdf'], 'r.pdf'), 'вакансия', created.id)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await pending
    expect(result.match_score).toBeGreaterThan(0)

    const vacancyPending = demo.getVacancy(created.id)
    await vi.advanceTimersByTimeAsync(500)
    const vacancy = await vacancyPending
    const resume = (vacancy.resumes ?? [])[0]
    expect(resume).toBeDefined()

    const resumePending = demo.getResume(resume.id)
    await vi.advanceTimersByTimeAsync(500)
    const withResult = await resumePending
    expect(withResult.tailored_result?.result.match_score).toBe(result.match_score)
  })
})
