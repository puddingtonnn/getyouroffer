import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { useAuth } from '../lib/auth'
import { consumeFree, freeLeft } from '../lib/quota'
import { takeStashedResume } from '../lib/fileStash'
import { Desktop, DeskFile, Draggable, MenuBar, Window } from '../components/desktop'
import { LogoMark } from '../components/Logo'

const PROGRESS_STAGES = [
  'извлекаем текст из PDF…',
  'читаем вакансию…',
  'подбираем акценты в резюме…',
  'пишем сопроводительное…',
  'собираем пакет…',
]

// Full-screen «собираем отклик» window: staged status lines and a slow bar
// so the ~60s LLM call doesn't feel like a hang. Stages are cosmetic.
function ProgressOverlay() {
  const [stage, setStage] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true))
    const id = setInterval(() => setStage((s) => Math.min(s + 1, PROGRESS_STAGES.length - 1)), 9000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-[420px] animate-popin">
        <Window title="собираем_отклик.app" right="≈60 сек">
          <div className="p-7 text-center">
            <div className="mx-auto mb-4 w-fit">
              <LogoMark size={56} />
            </div>
            <div className="display mb-4 text-[26px]">Собираем отклик</div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/10">
              <div
                className="cta-gradient h-2 rounded-full"
                style={{ width: started ? '92%' : '4%', transition: 'width 75s cubic-bezier(.25,.6,.3,1)' }}
              />
            </div>
            <div className="mt-3 font-mono text-xs text-steel">{PROGRESS_STAGES[stage]}</div>
            <p className="mt-4 font-sans text-[12.5px]/[1.5] text-ink-mute">
              Не закрывайте вкладку — обычно это меньше минуты.
            </p>
          </div>
        </Window>
      </div>
    </div>
  )
}

// «Новый отклик»: one product window floating on the desktop (toolbar on
// top, junk files around). Vacancy text + resume PDF → create the vacancy in
// the tracker, run tailoring, open the result.
export default function NewResponse() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const { demo } = useAuth()

  const [name, setName] = useState('')
  const [vacancy, setVacancy] = useState('')
  // A resume dropped on the landing hero window lands here already attached.
  const [file, setFile] = useState<File | null>(() => takeStashedResume())
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paywallNote, setPaywallNote] = useState(false)

  // Freemium v1: a localStorage counter, no billing. Demo mode is exempt.
  const quotaExhausted = !demo && freeLeft() === 0

  const looksLikeVacancy = vacancy.trim().length >= 200
  const canSubmit =
    file !== null && vacancy.trim() !== '' && name.trim() !== '' && !loading && !quotaExhausted

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
      const created = await api.createVacancy(name.trim(), vacancy, '')
      const result = await api.tailorResume(file, vacancy, created.id)
      if (!demo) consumeFree()
      navigate(`/app/vacancies/${created.id}`, { state: { result } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar nav />
      {loading && <ProgressOverlay />}
      <Desktop className="flex-1">
        {/* Desk props */}
        <Draggable className="top-[120px] left-[3%] z-0 max-xl:hidden">
          <DeskFile kind="PDF" tilt={-6} name={<>резюме_ФИНАЛ.pdf</>} />
        </Draggable>
        <Draggable className="top-[420px] left-[6%] z-0 max-xl:hidden">
          <DeskFile kind="XLSX" tilt={4} name={<>отклики_учёт_<br />АКТУАЛЬНАЯ.xlsx</>} />
        </Draggable>
        <Draggable className="top-[240px] right-[4%] z-0 max-xl:hidden">
          <DeskFile kind="PNG" tilt={5} name={<>скрин_вакансии_<br />не_потерять.png</>} />
        </Draggable>

        <div className="relative z-10 mx-auto max-w-[1100px] px-6 pt-10 pb-14 sm:px-9">
          <Window title="GetYourOffer — новый отклик" right="⌘N" className="animate-popin shadow-window!">
            <form onSubmit={handleSubmit} className="p-6 sm:p-7">
              <h1 className="display mb-1 text-4xl">Новый отклик</h1>
              <p className="mb-6 font-sans text-sm text-steel">
                Вакансия + резюме. Через минуту здесь будет полный пакет.
              </p>

              <div className="grid items-stretch gap-5 lg:grid-cols-[1.15fr_.85fr]">
                {/* Vacancy */}
                <div className="flex flex-col">
                  <input
                    className="mb-3.5 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 font-sans text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-steel focus:border-accent focus:outline-none"
                    placeholder="Роль · компания — например: Продуктовый аналитик · «Нейра»"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-sans text-[13.5px] font-bold">Текст вакансии</span>
                    <span className="font-mono text-[10.5px] text-steel max-sm:hidden">
                      вставьте как есть — почистим сами
                    </span>
                  </div>
                  <textarea
                    className="min-h-[260px] flex-1 resize-y rounded-xl border border-ink/20 bg-white px-4.5 py-3.5 font-sans text-[13px]/[1.7] text-ink-soft placeholder:text-steel focus:border-accent focus:outline-none"
                    placeholder="Вставьте сюда описание вакансии…"
                    value={vacancy}
                    onChange={(e) => setVacancy(e.target.value)}
                  />
                  <div className="mt-2.5 flex justify-between font-mono text-[11px] text-steel">
                    <span>{vacancy.length.toLocaleString('ru-RU')} символов</span>
                    {looksLikeVacancy && <span className="text-accent">✓ похоже на вакансию</span>}
                  </div>
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
                    PDF до 10 МБ. Содержимое резюме не попадает в логи и не передаётся никому,
                    кроме модели.
                  </div>

                  {error !== '' && (
                    <p className="rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
                      {error}
                    </p>
                  )}

                  {quotaExhausted ? (
                    <div className="mt-auto rounded-xl border-[1.5px] border-gold bg-gold/10 p-4">
                      <div className="kicker mb-1.5 text-[11px] text-gold-deep">
                        Лимит бесплатных откликов
                      </div>
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
              </div>
            </form>
          </Window>
        </div>
      </Desktop>
    </div>
  )
}
