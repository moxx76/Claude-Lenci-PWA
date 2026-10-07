import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach, isParent, isAthlete } from '../lib/types'
import { useViewMode } from '../store/viewMode'
import { useImpersonation } from '../store/impersonation'

/**
 * M12 — Dashboard split per ruolo. Ogni utente vede UNA sola sub-dashboard
 * in funzione del proprio ruolo, quindi le altre non vanno trasportate nel
 * chunk principale. React.lazy fa sì che un dirigente non scarichi il
 * codice del ParentDashboard, un atleta non scarichi quello admin, ecc.
 *
 * Anche DirectorDashboard e ManagerDashboard sono lazy: vengono mostrati
 * solo a dirigenti e manager rispettivamente, un sottoinsieme ristretto.
 */
const AdminDashboard = lazy(() => import('./dashboards/AdminDashboard'))
const CoachDashboard = lazy(() => import('./dashboards/CoachDashboard'))
const AthleteDashboard = lazy(() => import('./dashboards/AthleteDashboard'))
const ParentDashboard = lazy(() => import('./dashboards/ParentDashboard'))
const PublicDashboard = lazy(() => import('./dashboards/PublicDashboard'))
const DirectorDashboard = lazy(() => import('../components/DirectorDashboard').then(m => ({ default: m.DirectorDashboard })))
const ManagerDashboard = lazy(() => import('../components/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })))

// Fallback minimale durante il caricamento del chunk sub-dashboard: 1-2
// frame tipici su rete decente, quindi niente spinner invasivo
function DashboardFallback() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
      Caricamento…
    </div>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const { mode } = useViewMode()
  const { managerId } = useImpersonation()
  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || ''

  // Se l'utente è admin ma ha scelto la vista parent, mostra ParentDashboard con i propri figli
  const forcedParent = profile?.can_switch_to_parent === true && mode === 'parent'

  // Se supervisor sta impersonando, carico il profile target per il routing dashboard
  const [targetProfile, setTargetProfile] = useState<{ role: string; is_manager: boolean | null; full_name: string | null } | null>(null)
  useEffect(() => {
    if (!(profile?.is_supervisor && managerId)) { setTargetProfile(null); return }
    supabase.from('profiles').select('role, is_manager, full_name').eq('id', managerId).single()
      .then(({ data }) => setTargetProfile(data as any))
  }, [profile?.is_supervisor, managerId])

  const impersonatingTarget = !!(profile?.is_supervisor && managerId && targetProfile)
  const effectiveFirstName = impersonatingTarget
    ? (targetProfile?.full_name?.split(' ')[0] || firstName)
    : firstName

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      <Suspense fallback={<DashboardFallback />}>
        {forcedParent ? (
          <ParentDashboard firstName={firstName} />
        ) : impersonatingTarget ? (
          <>
            {targetProfile!.role === 'coach' && targetProfile!.is_manager && <ManagerDashboard firstName={effectiveFirstName} />}
            {targetProfile!.role === 'coach' && !targetProfile!.is_manager && <CoachDashboard firstName={effectiveFirstName} />}
            {targetProfile!.role === 'admin' && <AdminDashboard firstName={effectiveFirstName} />}
          </>
        ) : (
          <>
            {isAdmin(profile?.role) && profile?.is_director && <DirectorDashboard firstName={firstName} />}
            {isAdmin(profile?.role) && !profile?.is_director && <AdminDashboard firstName={firstName} />}
            {isCoach(profile?.role) && profile?.is_manager && <ManagerDashboard firstName={firstName} />}
            {isCoach(profile?.role) && !profile?.is_manager && <CoachDashboard firstName={firstName} />}
            {isAthlete(profile?.role) && <AthleteDashboard firstName={firstName} />}
            {isParent(profile?.role) && <ParentDashboard firstName={firstName} />}
            {!['admin', 'coach', 'athlete', 'parent'].includes(profile?.role ?? '') && (
              <PublicDashboard firstName={firstName} />
            )}
          </>
        )}
      </Suspense>
    </div>
  )
}
