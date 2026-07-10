import { useEffect, useState } from 'react'
import { getHealth } from './lib/api'

type ApiState = 'checking' | 'up' | 'down'

function App() {
  const [apiState, setApiState] = useState<ApiState>('checking')

  useEffect(() => {
    getHealth()
      .then(() => setApiState('up'))
      .catch(() => setApiState('down'))
  }, [])

  const badge = {
    checking: { text: 'API: проверяем…', className: 'bg-gray-100 text-gray-600' },
    up: { text: 'API: доступен', className: 'bg-green-100 text-green-700' },
    down: { text: 'API: недоступен', className: 'bg-red-100 text-red-700' },
  }[apiState]

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">GetYourOffer</h1>
      <p className="max-w-md text-center text-slate-600">
        Скоро здесь будет подгонка вашего резюме под вакансию: анализ
        соответствия, переточенное резюме и сопроводительное письмо.
      </p>
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}>
        {badge.text}
      </span>
    </main>
  )
}

export default App
