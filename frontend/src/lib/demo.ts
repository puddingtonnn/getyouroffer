// Demo mode: lets you walk through the whole app with seeded data while the
// backend is off. Entered from the login screen; state lives in localStorage
// so result pages survive reloads. Type-only imports from api.ts — no
// runtime cycle.
import type {
  Profile,
  Resume,
  ResumeWithResult,
  TailorResult,
  Vacancy,
  VacancyStatus,
  VacancyWithResumes,
} from './api'

const DEMO_FLAG = 'gyo_demo'
const DEMO_DATA = 'gyo_demo_data'

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_FLAG) === '1'
}

export function enterDemo() {
  localStorage.setItem(DEMO_FLAG, '1')
}

export function exitDemo() {
  localStorage.removeItem(DEMO_FLAG)
  localStorage.removeItem(DEMO_DATA)
}

export const demoProfile: Profile = {
  id: 'demo-profile',
  user_id: 'demo-user',
  first_name: 'Анна',
  last_name: 'Соколова',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// The canned tailor result (from the dashboard mockup).
const neyraResult: TailorResult = {
  match_score: 84,
  matches: [
    { requirement: 'SQL и Python', evidence: '4 года в аналитике роста, ежедневная работа с SQL и пайплайнами метрик' },
    { requirement: 'A/B-тесты', evidence: '30+ экспериментов, прирост конверсии воронки +18%' },
    { requirement: 'Юнит-экономика', evidence: 'считала LTV/CAC для трёх продуктов' },
    { requirement: 'Продуктовые метрики', evidence: 'retention, воронка, когортный анализ — основная отчётность' },
  ],
  gaps: [
    {
      requirement: 'ClickHouse — нет в резюме',
      suggestion: 'укажите Postgres и глубокую аналитику — стек переносится, письмо это подчеркнёт.',
    },
    {
      requirement: 'Английский не указан',
      suggestion: 'добавьте B2 в резюме — вакансия называет его плюсом, не требованием.',
    },
  ],
  keywords_to_add: ['ClickHouse', 'когортный анализ', 'product discovery', 'North Star Metric', 'маркетплейс'],
  tailored_resume:
    'Анна Соколова — продуктовый аналитик\nРасту продукт через A/B-эксперименты и юнит-экономику · 4 года\n\n«Клевер», аналитик роста · 2023—2026\n— Провела 30+ A/B-тестов; конверсия воронки +18%\n— Построила когортную отчётность: retention, LTV/CAC\n— SQL/Python ежедневно: пайплайны метрик с нуля\n\n«Штиль», аналитик · 2021—2023\n— Внедрила сквозную аналитику маркетинга\n— Автоматизировала отчётность: −6 часов ручной работы в неделю',
  cover_letter:
    'Здравствуйте! Увидела вакансию продуктового аналитика в «Нейре» — последние четыре года я растила ровно те метрики, о которых вы пишете. В «Клевере» провела 30+ A/B-тестов (+18% к конверсии воронки) и выстроила юнит-экономику трёх продуктов. ClickHouse в моём стеке пока нет — но ежедневный Postgres и пайплайны метрик с нуля переносятся быстро. Буду рада поговорить о вашей команде роста.',
}

type DemoData = {
  vacancies: VacancyWithResumes[]
  results: Record<string, TailorResult>
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

function seed(): DemoData {
  const mk = (
    id: string,
    name: string,
    status: VacancyStatus,
    updatedDaysAgo: number,
    score: number,
  ): { vacancy: VacancyWithResumes; result: TailorResult } => {
    const resume: Resume = {
      id: `demo-r-${id}`,
      vacancy_id: `demo-v-${id}`,
      user_id: 'demo-user',
      text: neyraResult.tailored_resume,
      created_at: daysAgo(updatedDaysAgo),
      updated_at: daysAgo(updatedDaysAgo),
    }
    return {
      vacancy: {
        id: `demo-v-${id}`,
        user_id: 'demo-user',
        name,
        status,
        source: '',
        description: 'Демо-вакансия: полный текст появится у настоящих откликов.',
        created_at: daysAgo(updatedDaysAgo + 1),
        updated_at: daysAgo(updatedDaysAgo),
        resumes: [resume],
      },
      result: { ...neyraResult, match_score: score },
    }
  }

  const rows = [
    mk('neyra', 'Продуктовый аналитик · «Нейра»', 'offer', 0, 84),
    mk('klever', 'Аналитик данных · «Клевер»', 'replied', 2, 78),
    mk('shtil', 'Маркетинговый аналитик · «Штиль»', 'sent', 5, 71),
    mk('vireo', 'Senior Product Analyst · Vireo', 'sent', 6, 76),
    mk('dolina', 'BI-аналитик · «Долина»', 'rejected', 9, 65),
    mk('planka', 'Аналитик воронки · «Планка»', 'draft', 0, 80),
  ]

  return {
    vacancies: rows.map((r) => r.vacancy),
    results: Object.fromEntries(rows.map((r) => [r.vacancy.resumes![0].id, r.result])),
  }
}

function load(): DemoData {
  const raw = localStorage.getItem(DEMO_DATA)
  if (raw) {
    try {
      return JSON.parse(raw) as DemoData
    } catch {
      // Corrupted store: reseed.
    }
  }
  const data = seed()
  save(data)
  return data
}

function save(data: DemoData) {
  localStorage.setItem(DEMO_DATA, JSON.stringify(data))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- api.ts counterparts (same signatures, no network) ---

export async function listVacancies(): Promise<VacancyWithResumes[]> {
  await sleep(250)
  return load().vacancies
}

export async function getVacancy(id: string): Promise<VacancyWithResumes> {
  await sleep(200)
  const v = load().vacancies.find((v) => v.id === id)
  if (!v) throw new Error('Отклик не найден (демо).')
  return v
}

export async function createVacancy(name: string, description: string, source: string): Promise<Vacancy> {
  const data = load()
  const now = new Date().toISOString()
  const vacancy: VacancyWithResumes = {
    id: `demo-v-${crypto.randomUUID().slice(0, 8)}`,
    user_id: 'demo-user',
    name,
    status: 'draft',
    source,
    description,
    created_at: now,
    updated_at: now,
    resumes: [],
  }
  data.vacancies.unshift(vacancy)
  save(data)
  return vacancy
}

export async function updateVacancyStatus(id: string, status: VacancyStatus): Promise<Vacancy> {
  await sleep(150)
  const data = load()
  const v = data.vacancies.find((v) => v.id === id)
  if (!v) throw new Error('Отклик не найден (демо).')
  v.status = status
  v.updated_at = new Date().toISOString()
  save(data)
  return v
}

export async function deleteVacancy(id: string): Promise<void> {
  await sleep(150)
  const data = load()
  data.vacancies = data.vacancies.filter((v) => v.id !== id)
  save(data)
}

export async function getResume(id: string): Promise<ResumeWithResult> {
  await sleep(200)
  const data = load()
  for (const v of data.vacancies) {
    const r = (v.resumes ?? []).find((r) => r.id === id)
    if (r) {
      const result = data.results[id]
      return {
        ...r,
        tailored_result: result
          ? { id: `demo-t-${id}`, resume_id: id, result, created_at: r.created_at }
          : null,
      }
    }
  }
  throw new Error('Резюме не найдено (демо).')
}

// Pretends to run the LLM: waits a bit, attaches the canned result.
export async function tailorResume(_file: File, _vacancy: string, vacancyID: string): Promise<TailorResult> {
  await sleep(1600)
  const data = load()
  const v = data.vacancies.find((v) => v.id === vacancyID)
  if (!v) throw new Error('Отклик не найден (демо).')
  const now = new Date().toISOString()
  const resume: Resume = {
    id: `demo-r-${crypto.randomUUID().slice(0, 8)}`,
    vacancy_id: v.id,
    user_id: 'demo-user',
    text: neyraResult.tailored_resume,
    created_at: now,
    updated_at: now,
  }
  v.resumes = [...(v.resumes ?? []), resume]
  v.updated_at = now
  const result = { ...neyraResult, match_score: 70 + Math.floor(Math.random() * 20) }
  data.results[resume.id] = result
  save(data)
  return result
}
