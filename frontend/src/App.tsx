import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './lib/auth'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import NewResponse from './pages/NewResponse'
import VacancyResult from './pages/VacancyResult'
import Tracker from './pages/Tracker'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route
          path="/app/new"
          element={
            <RequireAuth>
              <NewResponse />
            </RequireAuth>
          }
        />
        <Route
          path="/app/vacancies/:id"
          element={
            <RequireAuth>
              <VacancyResult />
            </RequireAuth>
          }
        />
        <Route
          path="/app/tracker"
          element={
            <RequireAuth>
              <Tracker />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
