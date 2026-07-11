import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import * as api from '../lib/api'
import { usePageTitle } from '../lib/usePageTitle'
import { Desktop, DeskFile, Draggable, MenuBar, Window } from '../components/desktop'
import { ScoreRing } from '../components/ScoreRing'
import { StatusBadge } from '../components/StatusBadge'

// The LLM contract allows markdown in tailored_resume / cover_letter;
// remark-breaks keeps single newlines as line breaks (plain-text answers).
function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{children}</ReactMarkdown>
    </div>
  )
}

function verdict(score: number): string {
  if (score >= 75) return 'Сильное соответствие. Закройте пробелы в письме — и отправляйте.'
  if (score >= 50) return 'Хорошая база. Пройдитесь по пробелам, прежде чем отправлять.'
  return 'Соответствие слабое. Посмотрите советы по пробелам — или поищите вакансию ближе к опыту.'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="kicker mb-3.5 text-[11px] text-steel">{children}</div>
}

// Client-side text download (no backend PDF export yet).
function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Copy/download bar under a document window's titlebar.
function DocActions({
  text,
  filename,
  dark = false,
}: {
  text: string
  filename: string
  dark?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`flex items-center justify-end gap-4 border-b px-6 py-3 ${
        dark ? 'border-paper/14' : 'border-ink/12'
      }`}
    >
      <button
        type="button"
        onClick={copy}
        className={`font-mono text-xs font-bold transition ${
          dark ? 'text-accent-ink/70 hover:text-paper' : 'text-accent hover:text-ink'
        }`}
      >
        {copied ? 'СКОПИРОВАНО ✓' : 'СКОПИРОВАТЬ ↗'}
      </button>
      <button
        type="button"
        onClick={() => downloadText(filename, text)}
        className={`font-mono text-xs font-bold transition ${
          dark ? 'text-accent-ink/70 hover:text-paper' : 'text-accent hover:text-ink'
        }`}
      >
        СКАЧАТЬ .TXT ↓
      </button>
    </div>
  )
}

// Result dashboard as documents on the desktop: the разбор window, the
// resume 2.0 window and the dark cover-letter window, slightly tilted.
export default function VacancyResult() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateResult = (location.state as { result?: api.TailorResult } | null)?.result ?? null

  const [vacancy, setVacancy] = useState<api.VacancyWithResumes | null>(null)
  const [result, setResult] = useState<api.TailorResult | null>(stateResult)
  const [error, setError] = useState('')

  usePageTitle(vacancy?.name ?? 'Отклик')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const v = await api.getVacancy(id!)
        if (cancelled) return
        setVacancy(v)
        if (stateResult) return
        const resumes = v.resumes ?? []
        if (resumes.length === 0) {
          setError('У этого отклика пока нет подогнанного резюме.')
          return
        }
        // Newest resume carries the latest tailored result.
        const latest = [...resumes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        const withResult = await api.getResume(latest.id)
        if (cancelled) return
        if (withResult.tailored_result) {
          setResult(api.normalizeResult(withResult.tailored_result.result))
        } else {
          setError('Результат подгонки для этого отклика не найден.')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar nav />
      <Desktop className="flex-1">
        {/* The result documents also live on the desk: drag them around,
            double-click to download. */}
        {result !== null && (
          <>
            <Draggable className="bottom-6 left-5 z-[5] hidden lg:block">
              <div
                onDoubleClick={() => downloadText('резюме_2.0.txt', result.tailored_resume)}
                title="двойной клик — скачать"
              >
                <DeskFile kind="PDF" tilt={-4} highlight name={<>резюме_2.0.txt</>} />
              </div>
            </Draggable>
            <Draggable className="bottom-9 left-36 z-[5] hidden lg:block">
              <div
                onDoubleClick={() => downloadText('сопроводительное_письмо.txt', result.cover_letter)}
                title="двойной клик — скачать"
              >
                <DeskFile kind="TXT" tilt={5} name={<>сопроводительное_<br />письмо.txt</>} />
              </div>
            </Draggable>
          </>
        )}
        <div className="relative z-10 mx-auto max-w-[1360px] px-6 pt-8 pb-14 sm:px-9">
          {error !== '' && (
            <p className="mb-6 rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
              {error}
            </p>
          )}

          {result === null && error === '' && (
            <p className="py-24 text-center font-mono text-sm text-steel">загружаем разбор…</p>
          )}

          {result !== null && (
            <>
              {/* Desktop header strip */}
              <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-5.5">
                  <ScoreRing score={result.match_score} />
                  <div>
                    <div className="kicker mb-1.5 text-[11.5px] text-accent">Отклик · сохранён в трекере</div>
                    <h1 className="display text-4xl">{vacancy?.name ?? 'Отклик'}</h1>
                    <div className="mt-1 font-sans text-[13.5px] text-steel">{verdict(result.match_score)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {vacancy && <StatusBadge status={vacancy.status} />}
                  <Link
                    to="/app/tracker"
                    className="rounded-full border-[1.5px] border-ink px-5 py-3 font-sans text-sm font-semibold transition hover:bg-ink hover:text-paper"
                  >
                    В трекер →
                  </Link>
                </div>
              </div>

              <div className="grid items-start gap-6.5 lg:grid-cols-[.92fr_1.08fr]">
                {/* Разбор window */}
                <Window title="разбор_соответствия.pdf — Просмотр" tilt={-0.4} className="animate-popin">
                  <div className="flex flex-col gap-5.5 px-6 py-5.5">
                    {result.matches.length > 0 && (
                      <div>
                        <SectionLabel>Совпадения · {result.matches.length}</SectionLabel>
                        <div className="flex flex-col gap-3 font-sans text-sm/[1.5]">
                          {result.matches.map((m, i) => (
                            <div key={i} className="flex gap-2.5">
                              <span className="flex-none font-extrabold text-accent">✓</span>
                              <span>
                                <b>{m.requirement}</b> — {m.evidence}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.gaps.length > 0 && (
                      <div>
                        <SectionLabel>Пробелы · {result.gaps.length} — и что с ними делать</SectionLabel>
                        <div className="flex flex-col gap-3.5 font-sans text-sm/[1.5]">
                          {result.gaps.map((g, i) => (
                            <div key={i} className="border-l-[2.5px] border-ink pl-3.5">
                              <b>{g.requirement}</b>
                              <span className="mt-1 block text-steel">Совет: {g.suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.keywords_to_add.length > 0 && (
                      <div>
                        <SectionLabel>Ключевые слова для ATS · {result.keywords_to_add.length}</SectionLabel>
                        <div className="flex flex-wrap gap-2 font-sans text-[12.5px] font-semibold">
                          {result.keywords_to_add.map((k, i) => (
                            <span key={i} className="rounded-full border-[1.5px] border-ink px-3.5 py-1.75">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Window>

                {/* Documents */}
                <div className="flex flex-col gap-6.5">
                  <Window title="резюме_2.0.md — под вакансию" tilt={0.4} className="animate-popin">
                    <DocActions text={result.tailored_resume} filename="резюме_2.0.txt" />
                    <div className="px-6 py-5 font-sans text-sm/[1.7] text-ink-soft">
                      <Markdown>{result.tailored_resume}</Markdown>
                    </div>
                  </Window>

                  <Window
                    title="сопроводительное_письмо.txt"
                    right={`${result.cover_letter.length.toLocaleString('ru-RU')} знаков`}
                    dark
                    tilt={-0.3}
                    className="animate-popin"
                  >
                    <DocActions text={result.cover_letter} filename="сопроводительное_письмо.txt" dark />
                    <div className="px-6 py-5 font-sans text-[14.5px]/[1.75] text-paper/85">
                      <Markdown>{result.cover_letter}</Markdown>
                    </div>
                  </Window>
                </div>
              </div>
            </>
          )}
        </div>
      </Desktop>
    </div>
  )
}
