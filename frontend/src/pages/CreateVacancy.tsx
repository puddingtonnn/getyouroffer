import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../lib/api'
import { usePageTitle } from '../lib/usePageTitle'
import { Desktop, DeskFile, Draggable, MenuBar, Window } from '../components/desktop'

// Realistic sample vacancy for first-run onboarding (linked from the tracker
// empty state via ?example=1).
export const EXAMPLE_NAME = 'Продуктовый аналитик · «Нейра»'
export const EXAMPLE_VACANCY = `Продуктовый аналитик — «Нейра»
Москва · гибрид · команда роста

Ищем аналитика, который превращает данные в решения, а не в отчёты ради отчётов.

Ожидаем:
— уверенный SQL и Python;
— опыт A/B-тестирования: дизайн экспериментов, критерии остановки;
— понимание юнит-экономики и продуктовых метрик (retention, LTV, конверсия воронки).

Будет плюсом: ClickHouse, английский от B2, опыт в маркетплейсах.

Задачи: эксперименты и когортный анализ, метрики роста, дашборды для команды, участие в discovery.`

// «Новая вакансия»: create the vacancy record first (name + text + source).
// The отклик — resume upload and tailoring — happens afterwards on the
// vacancy page. Backend: POST /api/vacancies (draft, no resume needed).
export default function CreateVacancy() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const withExample = searchParams.get('example') === '1'

  usePageTitle('Новая вакансия')

  const [name, setName] = useState(withExample ? EXAMPLE_NAME : '')
  const [text, setText] = useState(withExample ? EXAMPLE_VACANCY : '')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const looksLikeVacancy = text.trim().length >= 200
  const canSubmit = name.trim() !== '' && text.trim() !== '' && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const created = await api.createVacancy(name.trim(), text, source.trim())
      // Land on the vacancy page, which now offers to collect the отклик.
      navigate(`/app/vacancies/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar nav />
      <Desktop className="flex-1">
        {text.trim() !== '' && (
          <Draggable className="top-[180px] left-[3%] z-[5] hidden xl:block">
            <DeskFile
              kind="TXT"
              tilt={-4}
              name={<>{name.trim() !== '' ? `${name.trim().slice(0, 20)}…` : 'вакансия'}.txt</>}
            />
          </Draggable>
        )}

        <div className="relative z-10 mx-auto max-w-[900px] px-6 pt-10 pb-14 sm:px-9">
          <Window title="GetYourOffer — новая вакансия" className="animate-popin shadow-window!">
            <form onSubmit={handleSubmit} className="p-6 sm:p-7">
              <h1 className="display mb-1 text-4xl">Новая вакансия</h1>
              <p className="mb-6 font-sans text-sm text-steel">
                Сохраните вакансию — на следующем шаге приложите резюме и соберёте отклик.
              </p>

              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-[1.4fr_.6fr]">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-[13px] font-bold">Роль · компания</span>
                    <input
                      className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 font-sans text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-steel focus:border-accent focus:outline-none"
                      placeholder="Например: Продуктовый аналитик · «Нейра»"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-[13px] font-bold">
                      Источник <span className="font-normal text-steel">· необязательно</span>
                    </span>
                    <input
                      className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 font-sans text-[14px] text-ink placeholder:text-steel focus:border-accent focus:outline-none"
                      placeholder="hh.ru / ссылка"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-sans text-[13.5px] font-bold">Текст вакансии</span>
                    <span className="font-mono text-[10.5px] text-steel max-sm:hidden">
                      вставьте как есть — почистим сами
                    </span>
                  </div>
                  <textarea
                    className="min-h-[240px] w-full resize-y rounded-xl border border-ink/20 bg-white px-4.5 py-3.5 font-sans text-[13px]/[1.7] text-ink-soft placeholder:text-steel focus:border-accent focus:outline-none"
                    placeholder="Вставьте сюда описание вакансии…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="mt-2.5 flex justify-between font-mono text-[11px] text-steel">
                    <span>{text.length.toLocaleString('ru-RU')} символов</span>
                    {looksLikeVacancy ? (
                      <span className="text-accent">✓ похоже на вакансию</span>
                    ) : (
                      text.trim() === '' && (
                        <button
                          type="button"
                          onClick={() => {
                            setName(EXAMPLE_NAME)
                            setText(EXAMPLE_VACANCY)
                          }}
                          className="text-accent transition hover:text-ink"
                        >
                          вставить пример вакансии
                        </button>
                      )
                    )}
                  </div>
                </div>

                {error !== '' && (
                  <p className="rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3.5">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-xl bg-ink px-6 py-4 text-center font-sans text-[15px] font-bold text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-steel"
                  >
                    {loading ? 'Сохраняем…' : 'Сохранить и приложить резюме →'}
                  </button>
                  <span className="font-mono text-[12px] text-steel">резюме — на следующем шаге</span>
                </div>
              </div>
            </form>
          </Window>
        </div>
      </Desktop>
    </div>
  )
}
