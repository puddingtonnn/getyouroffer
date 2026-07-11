import { useEffect, useState } from 'react'
import { Window } from './desktop'
import { LogoMark } from './Logo'

const PROGRESS_STAGES = [
  'извлекаем текст из PDF…',
  'читаем вакансию…',
  'подбираем акценты в резюме…',
  'пишем сопроводительное…',
  'собираем пакет…',
]

// Full-screen «собираем отклик» window: staged status lines and a slow bar
// so the ~60s LLM call doesn't feel like a hang. Stages are cosmetic.
export function ProgressOverlay() {
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
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
    >
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
