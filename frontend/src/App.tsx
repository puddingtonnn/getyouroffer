import { useState } from 'react'
import { tailorResume, type TailorResult } from './lib/api'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [vacancy, setVacancy] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TailorResult | null>(null)

  const canSubmit = file !== null && vacancy.trim() !== '' && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await tailorResume(file, vacancy))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">GetYourOffer</h1>
          <p className="mt-2 text-slate-600">
            Загрузите резюме и вставьте вакансию — получите подогнанное резюме,
            анализ соответствия и черновик сопроводительного письма.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Резюме (PDF)
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-lg border border-slate-300 p-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Текст вакансии
            <textarea
              value={vacancy}
              onChange={(e) => setVacancy(e.target.value)}
              rows={8}
              placeholder="Вставьте сюда описание вакансии…"
              className="resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Подгоняем…' : 'Подогнать резюме'}
          </button>

          {error !== '' && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </form>

        {result && <ResultPanel result={result} />}
      </div>
    </main>
  )
}

function ResultPanel({ result }: { result: TailorResult }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-slate-900 px-4 py-1.5 text-lg font-bold text-white">
          {Math.round(result.match_score)}%
        </span>
        <span className="text-slate-600">соответствие вакансии</span>
      </div>

      {result.matches.length > 0 && (
        <Card title="Сильные совпадения">
          <ul className="flex flex-col gap-3">
            {result.matches.map((m, i) => (
              <li key={i} className="border-l-2 border-green-400 pl-3">
                <p className="font-medium text-slate-800">{m.requirement}</p>
                <p className="text-sm text-slate-600">{m.evidence}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.gaps.length > 0 && (
        <Card title="Чего не хватает">
          <ul className="flex flex-col gap-3">
            {result.gaps.map((g, i) => (
              <li key={i} className="border-l-2 border-amber-400 pl-3">
                <p className="font-medium text-slate-800">{g.requirement}</p>
                <p className="text-sm text-slate-600">{g.suggestion}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.keywords_to_add.length > 0 && (
        <Card title="Ключевые слова для добавления">
          <div className="flex flex-wrap gap-2">
            {result.keywords_to_add.map((k, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {k}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Подогнанное резюме">
        <p className="whitespace-pre-wrap text-sm text-slate-800">{result.tailored_resume}</p>
      </Card>

      <Card title="Сопроводительное письмо">
        <p className="whitespace-pre-wrap text-sm text-slate-800">{result.cover_letter}</p>
      </Card>
    </section>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  )
}

export default App
