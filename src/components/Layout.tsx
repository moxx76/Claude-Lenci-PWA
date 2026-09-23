import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppHeader } from './AppHeader'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { NotificationPanel } from './NotificationPanel'
import { PWAInstallBanner } from './PWAInstallBanner'
import { PushAutoPromptBanner } from './PushAutoPromptBanner'
import { ViewModeChooser } from './ViewModeChooser'
import { ImpersonationBanner } from './ImpersonationBanner'
import { ReadOnlyBanner } from './ReadOnlyBanner'
import { ChangelogAutoNotifier } from './ChangelogAutoNotifier'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach } from '../lib/types'
import { useViewMode } from '../store/viewMode'
import { useMyTeam } from '../hooks/useMyTeam'

type NavTab = { to: string; label: string; icon: string; end?: boolean; accent?: string; labelShort?: string }

const MOBILE_TABS_BASE: NavTab[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/teams', label: 'Squadra', icon: 'groups' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar_today' },
  { to: '/annunci', label: 'Bacheca', icon: 'campaign' },
  { to: '/profilo', label: 'Profilo', icon: 'person' },
]

const DESKTOP_TABS_BASE: NavTab[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/teams', label: 'Squadre', icon: 'groups' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar_today' },
  { to: '/annunci', label: 'Comunicazioni', icon: 'campaign' },
]

const MARKETING_TAB: NavTab = { to: '/marketing', label: 'Marketing', icon: 'campaign', accent: '#7a0071' }
const COMUNICATI_TAB: NavTab = { to: '/comunicati', label: 'Comunicati LND', labelShort: 'Comunicati', icon: 'article', accent: '#005f98' }
const ESERCIZI_TAB: NavTab = { to: '/esercizi', label: 'Catalogo esercizi', labelShort: 'Esercizi', icon: 'fitness_center', accent: '#c73434' }
// Referti: pagina centralizzata di tutti i post-match report delle squadre a carico.
// Accento rosa Lenci per il legame diretto con la squadra
const REFERTI_TAB: NavTab = { to: '/referti', label: 'Referti partite', labelShort: 'Referti', icon: 'edit_note', accent: '#b3005c' }
const GIORNALISTI_TAB: NavTab = { to: '/giornalisti', label: 'Risultati e distinte', labelShort: 'Distinte', icon: 'article_person', accent: '#005f98' }

export function Layout() {
  const [notifOpen, setNotifOpen] = useState(false)
  const { count: unreadNotifCount, refresh: refreshNotifCount } = useUnreadNotifications()
  const { profile, refreshProfile } = useAuth()
  const { mode } = useViewMode()
  const { myTeams, loading: teamsLoading } = useMyTeam()

  useEffect(() => { refreshProfile() }, [])

  // Vista parent forzata: menu semplificato senza Marketing/Squadre admin
  const isParentView = profile?.can_switch_to_parent === true && mode === 'parent'
  const isJournalist = profile?.is_journalist === true && !isParentView
  const isMarketing = profile?.is_marketing === true && !isParentView
  const isStaff = (isAdmin(profile?.role) || isCoach(profile?.role)) && !isParentView

  // Coach senza squadra assegnata (né head, né manager): menu limitato
  // Solo per coach puri, non per admin che si sono già assegnati o hanno più responsabilità
  const isCoachOnly = isCoach(profile?.role) && !isAdmin(profile?.role) && !isParentView
  const isCoachWithoutTeam = isCoachOnly && !teamsLoading && myTeams.length === 0

  const MOBILE_TABS: NavTab[] = isJournalist
    ? [GIORNALISTI_TAB, { to: '/profilo', label: 'Profilo', icon: 'person' }]
    : isCoachWithoutTeam
    ? [MOBILE_TABS_BASE[0], MOBILE_TABS_BASE[4]] // Solo Dashboard + Profilo
    : [
        MOBILE_TABS_BASE[0], // Dashboard
        MOBILE_TABS_BASE[1], // Squadra
        MOBILE_TABS_BASE[2], // Calendario
        // Slot 4: default Bacheca, se marketing → Marketing
        isMarketing ? MARKETING_TAB : MOBILE_TABS_BASE[3],
        // Slot 5 opzionale: Comunicati per staff
        ...(isStaff ? [COMUNICATI_TAB] : []),
        MOBILE_TABS_BASE[4], // Profilo
      ]

  const DESKTOP_TABS: NavTab[] = isJournalist
    ? [GIORNALISTI_TAB, { to: '/profilo', label: 'Profilo', icon: 'person' }]
    : isCoachWithoutTeam
    ? [DESKTOP_TABS_BASE[0], { to: '/profilo', label: 'Profilo', icon: 'person' }] // Solo Dashboard + Profilo
    : [
        ...DESKTOP_TABS_BASE,
        ...(isStaff ? [REFERTI_TAB] : []),
        ...(isStaff ? [ESERCIZI_TAB] : []),
        ...(isStaff ? [COMUNICATI_TAB] : []),
        ...(isMarketing ? [MARKETING_TAB] : []),
        { to: '/profilo', label: 'Profilo', icon: 'person' },
      ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-ink-300 flex-col">
        <div className="p-4 border-b border-ink-300" style={{ height: 64, display: 'flex', alignItems: 'center' }}>
          <Logo size={40} showWordmark variant="plain" />
        </div>
        <nav className="flex-1 px-2 py-3">
          {DESKTOP_TABS.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-colors ${
                  isActive
                    ? 'bg-primary-fixed text-primary'
                    : 'text-ink-700 hover:bg-ink-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={t.icon} size={22} color={isActive ? '#005f98' : '#404751'} />
                  <span style={{ fontWeight: 700 }}>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {/* Desktop notification button in sidebar footer */}
        <div style={{ padding: 12, borderTop: '1px solid #e6e8ee' }}>
          <button
            onClick={() => setNotifOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-transparent border-0 cursor-pointer transition-colors hover:bg-ink-50"
            style={{ color: '#404751', position: 'relative' }}
          >
            <div style={{ position: 'relative' }}>
              <Icon name="notifications" size={22} color="#404751" />
              {unreadNotifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -6,
                  minWidth: 16, height: 16, borderRadius: 999,
                  background: '#c62828', color: '#fff',
                  fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', boxShadow: '0 0 0 2px #fff',
                }}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
              )}
            </div>
            <span style={{ fontWeight: 700 }}>Notifiche</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header (visibile solo mobile) */}
        <div className="md:hidden">
          <AppHeader
            onNotificationsClick={() => setNotifOpen(true)}
            hasNotifications={unreadNotifCount > 0}
          />
        </div>

        {/* Contenuto scrollabile */}
        <div
          className="flex-1 overflow-y-auto lenci-scroll"
          style={{
            paddingBottom: '96px',
            animation: 'lenciFadeUp 0.3s ease',
          }}
        >
          <ImpersonationBanner />
          <ReadOnlyBanner />
          <PushAutoPromptBanner />
          <Outlet />
        </div>

        {/* Bottom navigation mobile */}
        <BottomNav tabs={MOBILE_TABS} />
      </main>

      {/* Modals & floating UIs */}
      <ViewModeChooser />
      <NotificationPanel open={notifOpen} onClose={() => { setNotifOpen(false); refreshNotifCount() }} />
      <PWAInstallBanner />
      <ChangelogAutoNotifier />
    </div>
  )
}

function BottomNav({ tabs }: { tabs: NavTab[] }) {
  const location = useLocation()
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 flex items-center justify-around safe-bottom z-40"
      style={{
        height: 76,
        background: '#ebeef4',
        borderRadius: '20px 20px 0 0',
        padding: '6px 6px 14px',
        boxShadow: '0 -4px 14px rgba(0,0,0,0.05)',
      }}
    >
      {tabs.map(t => {
        const isActive = t.end
          ? location.pathname === t.to
          : location.pathname.startsWith(t.to)
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className="flex flex-col items-center justify-center flex-1 min-w-0 bg-transparent border-0 cursor-pointer"
            style={{
              padding: '4px 2px',
              color: isActive ? '#005f98' : '#707882',
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                borderRadius: 999,
                padding: isActive ? '4px 14px' : '4px 6px',
                background: isActive ? '#cfe5ff' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon name={t.icon} size={22} color={isActive ? '#005f98' : '#707882'} />
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 600, marginTop: 2,
                color: isActive ? '#005f98' : '#707882',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {t.labelShort ?? t.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
