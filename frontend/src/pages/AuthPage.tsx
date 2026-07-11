import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Desktop, MenuBar, Window } from '../components/desktop'

const inputClass =
  'w-full rounded-xl border border-ink/20 bg-white px-4 py-3 font-sans text-sm text-ink placeholder:text-steel focus:border-accent focus:outline-none'

// Login and registration share one window-styled screen (mode via prop).
export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const { login, register, startDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/new'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        await register(email, password, firstName, lastName)
      } else {
        await login(email, password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar />
      <Desktop className="flex-1">
        <div className="relative z-10 mx-auto w-full max-w-[440px] px-4 pt-14 pb-16 animate-popin">
          <Window
            title={isRegister ? 'GetYourOffer — регистрация' : 'GetYourOffer — вход'}
            className="shadow-window!"
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-7">
              <h1 className="display text-4xl">
                {isRegister ? (
                  <>
                    Первый отклик — <span className="display-stroke">за минуту.</span>
                  </>
                ) : (
                  <>С возвращением.</>
                )}
              </h1>
              <p className="mb-1 font-sans text-sm text-ink-mute">
                {isRegister
                  ? 'Аккаунт нужен, чтобы хранить отклики и версии резюме в трекере.'
                  : 'Войдите, чтобы продолжить работу с откликами.'}
              </p>

              {isRegister && (
                <div className="flex gap-3">
                  <input
                    className={inputClass}
                    placeholder="Имя"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                  <input
                    className={inputClass}
                    placeholder="Фамилия"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              )}
              <input
                className={inputClass}
                type="email"
                required
                placeholder="Почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className={inputClass}
                type="password"
                required
                minLength={8}
                placeholder={isRegister ? 'Пароль — от 8 символов' : 'Пароль'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />

              {error !== '' && (
                <p className="rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-3.5 py-2.5 font-sans text-sm text-file-pdf">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cta-gradient mt-1 rounded-xl p-4 font-sans text-[15px] font-bold text-accent-ink shadow-cta transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Секунду…' : isRegister ? 'Создать аккаунт →' : 'Войти →'}
              </button>

              <p className="text-center font-sans text-[13px] text-steel">
                {isRegister ? (
                  <>
                    Уже есть аккаунт?{' '}
                    <Link to="/login" className="font-semibold text-accent hover:underline">
                      Войти
                    </Link>
                  </>
                ) : (
                  <>
                    Нет аккаунта?{' '}
                    <Link to="/register" className="font-semibold text-accent hover:underline">
                      Зарегистрироваться
                    </Link>
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  startDemo()
                  navigate('/app/tracker')
                }}
                className="mt-1 border-t border-dashed border-ink/20 pt-3.5 text-center font-mono text-xs text-steel transition hover:text-accent"
              >
                бэкенд выключен? посмотреть демо →
              </button>
            </form>
          </Window>
        </div>
      </Desktop>
    </div>
  )
}
