import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import * as api from './api'
import { enterDemo, exitDemo, isDemoMode } from './demo'

type AuthState = {
  authed: boolean
  demo: boolean
  profile: api.Profile | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  startDemo: () => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Demo mode counts as authed: the whole app works offline on seeded data.
  const [demo, setDemo] = useState(isDemoMode)
  const [authed, setAuthed] = useState(() => api.getToken() !== null || isDemoMode())
  const [profile, setProfile] = useState<api.Profile | null>(null)

  // Restore the profile for an existing token; a 401 means the token expired.
  useEffect(() => {
    if (!authed) return
    let cancelled = false
    api
      .getProfile()
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((err) => {
        if (!cancelled && err instanceof api.ApiError && err.status === 401) {
          api.clearToken()
          setAuthed(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [authed])

  const login = useCallback(async (email: string, password: string) => {
    api.setToken(await api.login(email, password))
    setAuthed(true)
  }, [])

  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      api.setToken(await api.register(email, password, firstName, lastName))
      setAuthed(true)
    },
    [],
  )

  const startDemo = useCallback(() => {
    enterDemo()
    setDemo(true)
    setAuthed(true)
  }, [])

  const logout = useCallback(() => {
    exitDemo()
    api.clearToken()
    setDemo(false)
    setAuthed(false)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ authed, demo, profile, login, register, startDemo, logout }),
    [authed, demo, profile, login, register, startDemo, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// RequireAuth redirects guests to /login, remembering where they were going.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth()
  const location = useLocation()
  if (!authed) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}
