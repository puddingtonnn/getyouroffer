import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { consumeFree } from '../lib/quota'
import { takeStashedResume } from '../lib/fileStash'
import { Desktop, DeskFile, Draggable, MenuBar, Window } from '../components/desktop'

// «Новый отклик»: one product window floating on the desktop (toolbar on
// top, junk files around). Vacancy text + resume PDF → create the vacancy in
// the tracker, run tailoring, open the result.
export default function NewResponse() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [vacancy, setVacancy] = useState('')
  // A resume dropped on the landing hero window lands here already attached.
  const [file, setFile] = useState<File | null>(() => takeStashedResume())
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const looksLikeVacancy = vacancy.trim().length >= 200
  const canSubmit = file !== null && vacancy.trim() !== '' && name.trim() !== '' && !loading

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
      consumeFree()
      navigate(`/app/vacancies/${created.id}`, { state: { result } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar nav />
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
                    <span className="font-mono text-[10.5px] text-steel">вставьте как есть — почистим сами</span>
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
                    PDF до 10 МБ. Мы храним версии — сможете вернуться к любой.
                  </div>

                  {error !== '' && (
                    <p className="rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
                      {error}
                    </p>
                  )}

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
                </div>
              </div>
            </form>
          </Window>
        </div>
      </Desktop>
    </div>
  )
}
