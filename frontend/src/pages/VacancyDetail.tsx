import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import * as api from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePageTitle } from '../lib/usePageTitle'
import { consumeFree, freeLeft } from '../lib/quota'
import { takeStashedResume } from '../lib/fileStash'
import { Desktop, DeskFile, Draggable, MenuBar, Window } from '../components/desktop'
import { ProgressOverlay } from '../components/ProgressOverlay'
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

// copyText tries the async clipboard API and falls back to the legacy
// execCommand path (blocked-permission iframes, older browsers). Returns
// whether the text actually landed in the clipboard.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Permissions policy or insecure context: try the legacy path.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

// Copy/download bar under a document window's titlebar.
function DocActions({ text, filename, dark = false }: { text: string; filename: string; dark?: boolean }) {
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle')

  async function copy() {
    setCopyState((await copyText(text)) ? 'ok' : 'fail')
    setTimeout(() => setCopyState('idle'), 2500)
  }

  const copyLabel =
    copyState === 'ok' ? 'СКОПИРОВАНО ✓' : copyState === 'fail' ? 'НЕ ВЫШЛО — СКАЧАЙТЕ ФАЙЛ' : 'СКОПИРОВАТЬ ↗'

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
        {copyLabel}
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

// OtklikPanel: shown when the vacancy has no tailored result yet. Attach a
// resume PDF and run the LLM against the vacancy's stored text.
function OtklikPanel({
  vacancy,
  onDone,
}: {
  vacancy: api.VacancyWithResumes
  onDone: (result: api.TailorResult) => void
}) {
  const { demo } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  // A resume dropped on the landing hero window lands here already attached.
  const [file, setFile] = useState<File | null>(() => takeStashedResume())
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paywallNote, setPaywallNote] = useState(false)

  const quotaExhausted = !demo && freeLeft() === 0
  const canSubmit = file !== null && !loading && !quotaExhausted

  function acceptFile(f: File | undefined) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Резюме принимаем в формате PDF.')
      return
    }
    setError('')
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    try {
      // The vacancy text was stored on creation; reuse it for the LLM.
      const result = await api.tailorResume(file, vacancy.description, vacancy.id)
      if (!demo) consumeFree()
      onDone(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      setLoading(false)
    }
  }

  return (
    <>
      {loading && <ProgressOverlay />}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="kicker mb-1.5 text-[11.5px] text-steel">Вакансия · черновик</div>
          <h1 className="display text-4xl">{vacancy.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {vacancy.source !== '' && (
            <span className="rounded-full border border-ink/20 px-3.5 py-1.5 font-mono text-[11px] text-steel">
              {vacancy.source}
            </span>
          )}
          <Link
            to="/app/tracker"
            className="rounded-full border-[1.5px] border-ink px-5 py-2.5 font-sans text-sm font-semibold transition hover:bg-ink hover:text-paper"
          >
            В трекер →
          </Link>
        </div>
      </div>

      <Window title="GetYourOffer — собрать отклик" className="animate-popin shadow-window!">
        <form onSubmit={handleSubmit} className="grid items-stretch gap-5 p-6 sm:p-7 lg:grid-cols-[1.05fr_.95fr]">
          {/* Stored vacancy text (read-only) */}
          <div className="flex flex-col">
            <div className="mb-2.5 font-sans text-[13.5px] font-bold">Текст вакансии</div>
            <div className="min-h-[240px] flex-1 overflow-auto rounded-xl border border-ink/15 bg-canvas px-4.5 py-3.5 font-sans text-[13px]/[1.7] whitespace-pre-wrap text-ink-soft">
              {vacancy.description}
            </div>
            <Link
              to={`/app/vacancies/new`}
              className="mt-2.5 font-mono text-[11px] text-steel transition hover:text-accent"
            >
              не та вакансия? создать новую →
            </Link>
          </div>

          {/* Resume + CTA */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[13.5px] font-bold">Резюме</span>
              {file && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="border-b-[1.5px] border-accent font-sans text-[12.5px] font-semibold text-accent"
                >
                  заменить
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                acceptFile(e.dataTransfer.files?.[0])
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4.5 py-4 text-left transition ${
                dragOver ? 'border-accent bg-accent/12' : 'border-accent/60 bg-accent/5 hover:border-accent'
              }`}
            >
              <span className="flex h-[46px] w-[38px] flex-none items-center justify-center rounded-md bg-accent font-mono text-[10px] font-bold text-white">
                PDF
              </span>
              {file ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[14.5px] font-bold">{file.name}</span>
                  <span className="mt-0.5 block font-mono text-[11.5px] text-steel">
                    {Math.max(1, Math.round(file.size / 1024))} КБ · готово к подгонке
                  </span>
                </span>
              ) : (
                <span className="flex-1">
                  <span className="block font-sans text-[14.5px] font-bold">Перетащите резюме сюда</span>
                  <span className="mt-0.5 block font-mono text-[11.5px] text-steel">
                    любая версия — хоть v12_ТОЧНО_ФИНАЛ
                  </span>
                </span>
              )}
            </button>
            <div className="font-sans text-[12.5px]/[1.55] text-steel">
              PDF до 10 МБ. Содержимое резюме не попадает в логи и не передаётся никому, кроме модели.
            </div>

            {error !== '' && (
              <p className="rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
                {error}
              </p>
            )}

            {quotaExhausted ? (
              <div className="mt-auto rounded-xl border-[1.5px] border-gold bg-gold/10 p-4">
                <div className="kicker mb-1.5 text-[11px] text-gold-deep">Лимит бесплатных откликов</div>
                <p className="mb-3 font-sans text-[13px]/[1.5] text-ink-soft">
                  3 бесплатных отклика использованы. Полный доступ уже в работе.
                </p>
                <button
                  type="button"
                  onClick={() => setPaywallNote(true)}
                  className="rounded-xl bg-gold px-4 py-2.5 font-sans text-sm font-bold text-ink transition hover:brightness-105"
                >
                  Оформить доступ →
                </button>
                {paywallNote && (
                  <p className="mt-3 font-mono text-xs text-steel">
                    оплата в разработке · напишите нам — откроем доступ вручную
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-auto flex items-center gap-3.5">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 rounded-xl bg-ink p-4 text-center font-sans text-[15px] font-bold text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-steel"
                >
                  {loading ? 'Собираем отклик…' : 'Собрать отклик →'}
                </button>
                <span className="font-mono text-[13px] font-semibold text-steel tabular-nums">
                  {loading ? '≤01:30' : '~00:58'}
                </span>
              </div>
            )}
          </div>
        </form>
      </Window>
    </>
  )
}

// ResultDashboard: the tailored отклик as documents on the desktop.
function ResultDashboard({ vacancy, result }: { vacancy: api.VacancyWithResumes; result: api.TailorResult }) {
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-5.5">
          <ScoreRing score={result.match_score} />
          <div>
            <div className="kicker mb-1.5 text-[11.5px] text-accent">Отклик · сохранён в трекере</div>
            <h1 className="display text-4xl">{vacancy.name}</h1>
            <div className="mt-1 font-sans text-[13.5px] text-steel">{verdict(result.match_score)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={vacancy.status} />
          <Link
            to="/app/tracker"
            className="rounded-full border-[1.5px] border-ink px-5 py-3 font-sans text-sm font-semibold transition hover:bg-ink hover:text-paper"
          >
            В трекер →
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-6.5 lg:grid-cols-[.92fr_1.08fr]">
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
  )
}

// Vacancy page: collect the отклик if there's none yet, otherwise show the
// tailored result. One route, two states.
export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateResult = (location.state as { result?: api.TailorResult } | null)?.result ?? null

  const [vacancy, setVacancy] = useState<api.VacancyWithResumes | null>(null)
  const [result, setResult] = useState<api.TailorResult | null>(stateResult)
  const [loading, setLoading] = useState(true)
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
        if (stateResult) {
          setLoading(false)
          return
        }
        const resumes = v.resumes ?? []
        if (resumes.length === 0) {
          // No отклик yet — the panel will offer to collect one.
          setLoading(false)
          return
        }
        // Newest resume carries the latest tailored result.
        const latest = [...resumes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        const withResult = await api.getResume(latest.id)
        if (cancelled) return
        if (withResult.tailored_result) {
          setResult(api.normalizeResult(withResult.tailored_result.result))
        }
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
          setLoading(false)
        }
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
        {/* Result documents live on the desk too: drag them, double-click to download. */}
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

          {loading && error === '' && (
            <p className="py-24 text-center font-mono text-sm text-steel">загружаем…</p>
          )}

          {!loading && result !== null && vacancy && <ResultDashboard vacancy={vacancy} result={result} />}

          {!loading && result === null && vacancy && (
            <OtklikPanel vacancy={vacancy} onDone={(r) => setResult(r)} />
          )}
        </div>
      </Desktop>
    </div>
  )
}
