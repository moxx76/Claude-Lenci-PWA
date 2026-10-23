import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Login } from './pages/Login'
import { ResetPassword } from './pages/ResetPassword'

// M6: route lazy-loaded. Login + ResetPassword restano eager perché sono i
// due entry point critici (il reset password arriva da un link email, deve
// risolversi subito). Dashboard è la landing page post-login: la mettiamo lazy
// per abbassare il tempo di parse del bundle iniziale sui device low-end, al
// costo di uno spinner di ~200ms al primo accesso. Tutte le altre pagine sono
// montate solo quando l'utente naviga la rispettiva route.
import { Layout } from './components/Layout'
import { Logo } from './components/Logo'
const Dashboard         = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Teams             = lazy(() => import('./pages/Teams').then(m => ({ default: m.Teams })))
const CalendarPage      = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })))
const Profile           = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })))
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })))
const MarketingPage     = lazy(() => import('./pages/Marketing').then(m => ({ default: m.MarketingPage })))
const JournalistPage    = lazy(() => import('./pages/Journalist').then(m => ({ default: m.JournalistPage })))
const ComunicatiPage    = lazy(() => import('./pages/Comunicati').then(m => ({ default: m.ComunicatiPage })))
const Referti           = lazy(() => import('./pages/Referti').then(m => ({ default: m.Referti })))
const LenciPass         = lazy(() => import('./pages/LenciPass').then(m => ({ default: m.LenciPass })))
const LenciPassVerify   = lazy(() => import('./pages/LenciPassVerify').then(m => ({ default: m.LenciPassVerify })))
const AdminPass         = lazy(() => import('./pages/AdminPass').then(m => ({ default: m.AdminPass })))
const EserciziPage      = lazy(() => import('./pages/EserciziPage').then(m => ({ default: m.EserciziPage })))
const Moduli            = lazy(() => import('./pages/Moduli').then(m => ({ default: m.Moduli })))
const Inventario        = lazy(() => import('./pages/Inventario').then(m => ({ default: m.Inventario })))
const Incombenze        = lazy(() => import('./pages/Incombenze').then(m => ({ default: m.Incombenze })))
const ImportFigc        = lazy(() => import('./pages/ImportFigc').then(m => ({ default: m.ImportFigc })))
const MatchSheetPrint   = lazy(() => import('./pages/MatchSheetPrint').then(m => ({ default: m.MatchSheetPrint })))

// Fallback compatto per Suspense: lo spinner centrale della landing page
// serve a dare feedback immediato mentre il bundle della route arriva.
const RouteFallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
    Caricamento…
  </div>
)
import { SilentAutoUpdater } from './components/SilentAutoUpdater'
import { VersionGuard } from './components/VersionGuard'
import { RoutePreloader } from './components/RoutePreloader'
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

/**
 * M32: guard per l'utente cassa.
 * Il cassiere (profiles.is_cashier=true) ha accesso SOLO alla pagina pubblica /pass
 * (lista) e /pass/v/:token (verifica NFC). Qualunque altra route protetta viene
 * reindirizzata a /pass. Serve per il tablet/smartphone sempre loggato al varco:
 * se un operatore ci clicca distrattamente su un'altra sezione, torna a /pass.
 */
function CashierGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  if (profile?.is_cashier) return <Navigate to="/pass" replace />
  return <>{children}</>
}

export default function App() {
  const init = useAuth(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <ToastProvider>
      <SilentAutoUpdater />
      <VersionGuard />
      <RoutePreloader />
      {/* M6: Suspense al livello Routes copre tutti i componenti lazy delle
          route. I componenti NON lazy (Login, ResetPassword) non attivano il
          fallback, quindi non c'è penalità UX per il flusso di autenticazione. */}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Lenci Pass: pagina pubblica (fuori da ProtectedRoute e Layout) con l'elenco
            dei titolari del pass di ingresso gratuito alle partite casalinghe. */}
        <Route path="/pass" element={<LenciPass />} />
        {/* Verifica NFC: URL scritto nel tag che il cassiere scansiona.
            Mostra schermata a semaforo valido/sospeso/non trovato. */}
        <Route path="/pass/v/:token" element={<LenciPassVerify />} />
        {/* Foglio partita stampabile: fuori dal Layout per stampa pulita (no sidebar/topbar) */}
        <Route path="/foglio-partita/:matchId" element={
          <ProtectedRoute><MatchSheetPrint /></ProtectedRoute>
        } />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <CashierGuard>
                <Layout />
              </CashierGuard>
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
          <Route path="inventario" element={<NotForJournalist><Inventario /></NotForJournalist>} />
          <Route path="incombenze" element={<NotForJournalist><Incombenze /></NotForJournalist>} />
          <Route path="import-figc" element={<NotForJournalist><ImportFigc /></NotForJournalist>} />
          {/* Admin Lenci Pass: gestione titolari + QR per programmare i tag NFC */}
          <Route path="admin/pass" element={<NotForJournalist><AdminPass /></NotForJournalist>} />
          <Route path="stats" element={<Navigate to="/" replace />} />
          <Route path="profilo" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ToastProvider>
  )
}
