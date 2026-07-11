import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/auth'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import CreateVacancy from './pages/CreateVacancy'
import VacancyDetail from './pages/VacancyDetail'
import Tracker from './pages/Tracker'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        {/* Vacancy-first flow: the tracker is the app home. */}
        <Route path="/app" element={<Navigate to="/app/tracker" replace />} />
        {/* Legacy combined route → new create-vacancy step. */}
        <Route path="/app/new" element={<Navigate to="/app/vacancies/new" replace />} />
        <Route
          path="/app/tracker"
          element={
            <RequireAuth>
              <Tracker />
            </RequireAuth>
          }
        />
        <Route
          path="/app/vacancies/new"
          element={
            <RequireAuth>
              <CreateVacancy />
            </RequireAuth>
          }
        />
        <Route
          path="/app/vacancies/:id"
          element={
            <RequireAuth>
              <VacancyDetail />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
