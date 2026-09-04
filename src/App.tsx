import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Login } from './pages/Login'
import { Layout } from './components/Layout'
import { Logo } from './components/Logo'
import { Dashboard } from './pages/Dashboard'
import { Teams } from './pages/Teams'
import { CalendarPage } from './pages/CalendarPage'
import { Profile } from './pages/Profile'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { MarketingPage } from './pages/Marketing'
import { ComunicatiPage } from './pages/Comunicati'
import { EserciziPage } from './pages/EserciziPage'
import { SilentAutoUpdater } from './components/SilentAutoUpdater'
import { ToastProvider } from './components/Toast'
import { useMyTeam } from './hooks/useMyTeam'
import { isAdmin, isCoach } from './lib/types'

/**
 * Impedisce ai coach senza squadra assegnata di accedere alle pagine
 * di gestione (Squadre, Calendario, Esercizi, ecc.). Li ridireziona alla Dashboard.
 * Admin e coach con almeno una squadra passano.
 */
function TeamAssignedGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const { myTeams, loading } = useMyTeam()
  // Bypass per admin (che possono non avere squadre e comunque accedere)
  if (isAdmin(profile?.role)) return <>{children}</>
  if (loading) return null
  if (isCoach(profile?.role) && myTeams.length === 0) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuth()
  if (!initialized) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg,#f7f9ff 0%,#e8f2fb 100%)' }}
      >
        <div
          style={{
            padding: 6,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 10px 24px rgba(0,95,152,0.15)',
            animation: 'lenciFadeIn 0.4s ease',
          }}
        >
          <Logo size={72} variant="plain" />
        </div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const init = useAuth(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <ToastProvider>
      <SilentAutoUpdater />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="teams" element={<TeamAssignedGuard><Teams /></TeamAssignedGuard>} />
          {/* Alias per compatibilità con vecchi bookmark */}
          <Route path="atleti" element={<Navigate to="/teams" replace />} />
          <Route path="calendario" element={<TeamAssignedGuard><CalendarPage /></TeamAssignedGuard>} />
          <Route path="esercizi" element={<TeamAssignedGuard><EserciziPage /></TeamAssignedGuard>} />
          <Route path="annunci" element={<TeamAssignedGuard><AnnouncementsPage /></TeamAssignedGuard>} />
          <Route path="comunicati" element={<TeamAssignedGuard><ComunicatiPage /></TeamAssignedGuard>} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="stats" element={<Navigate to="/" replace />} />
          <Route path="profilo" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
