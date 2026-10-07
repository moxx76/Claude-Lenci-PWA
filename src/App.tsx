import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Login } from './pages/Login'
import { ResetPassword } from './pages/ResetPassword'
import { Layout } from './components/Layout'
import { Logo } from './components/Logo'
import { Dashboard } from './pages/Dashboard'
import { Teams } from './pages/Teams'
import { CalendarPage } from './pages/CalendarPage'
import { Profile } from './pages/Profile'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { MarketingPage } from './pages/Marketing'
import { JournalistPage } from './pages/Journalist'
import { ComunicatiPage } from './pages/Comunicati'
import { Referti } from './pages/Referti'
import { EserciziPage } from './pages/EserciziPage'
import { Moduli } from './pages/Moduli'
// Lazy: MatchSheetPrint pesa ~100KB e serve solo nel flusso di stampa referto
const MatchSheetPrint = lazy(() => import('./pages/MatchSheetPrint').then(m => ({ default: m.MatchSheetPrint })))
import { SilentAutoUpdater } from './components/SilentAutoUpdater'
import { VersionGuard } from './components/VersionGuard'
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

/**
 * Se l'utente è un giornalista (profile.is_journalist=true), qualsiasi pagina
 * della normale app viene reindirizzata a /giornalisti (unica pagina permessa
 * insieme al profilo). I tab di navigazione sono già ridotti dal Layout.
 */
function NotForJournalist({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  if (profile?.is_journalist === true) return <Navigate to="/giornalisti" replace />
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
      <VersionGuard />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Foglio partita stampabile: fuori dal Layout per stampa pulita (no sidebar/topbar) */}
        <Route path="/foglio-partita/:matchId" element={
          <ProtectedRoute><Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Caricamento foglio…</div>}><MatchSheetPrint /></Suspense></ProtectedRoute>
        } />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Review (assessment): NotForJournalist era applicato solo a /
              lasciando accessibili per URL diretto le altre pagine. Ora copre
              tutte le route sensibili. I giornalisti vedono solo /giornalisti
              e /profilo. */}
          <Route index element={<NotForJournalist><Dashboard /></NotForJournalist>} />
          <Route path="teams" element={<NotForJournalist><TeamAssignedGuard><Teams /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="atleti" element={<Navigate to="/teams" replace />} />
          <Route path="calendario" element={<NotForJournalist><TeamAssignedGuard><CalendarPage /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="esercizi" element={<NotForJournalist><TeamAssignedGuard><EserciziPage /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="annunci" element={<NotForJournalist><TeamAssignedGuard><AnnouncementsPage /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="comunicati" element={<NotForJournalist><TeamAssignedGuard><ComunicatiPage /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="referti" element={<NotForJournalist><TeamAssignedGuard><Referti /></TeamAssignedGuard></NotForJournalist>} />
          <Route path="marketing" element={<NotForJournalist><MarketingPage /></NotForJournalist>} />
          <Route path="giornalisti" element={<JournalistPage />} />
          <Route path="moduli" element={<NotForJournalist><Moduli /></NotForJournalist>} />
          <Route path="stats" element={<Navigate to="/" replace />} />
          <Route path="profilo" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
