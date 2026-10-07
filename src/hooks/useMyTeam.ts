import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useImpersonation } from '../store/impersonation'

export interface MyTeam {
  id: string
  name: string
  category: string | null
  age_range: string | null
  color: string | null
}

export function useMyTeam() {
  const { profile } = useAuth()
  const { managerId } = useImpersonation()
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null)
  const [myTeams, setMyTeams] = useState<MyTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.is_manager, managerId])

  const load = async () => {
    setLoading(true)
    try {
      // Se il supervisor sta impersonando un dirigente/allenatore, uso il suo id
      const effectiveId = (profile?.is_supervisor && managerId) ? managerId : profile!.id
      const impersonating = !!(profile?.is_supervisor && managerId)

      if (impersonating || profile?.is_manager || profile?.role === 'coach') {
        // A09: cerco squadre dove effectiveId è in uno QUALSIASI dei 6 ruoli operativi.
        // Prima la lista era di 5 (saltava third_manager_id, aggiunto in migration
        // 20260905): un terzo dirigente assegnato solo a quello slot non trovava
        // le sue squadre. Ora una singola query .or() copre tutti e 6 i ruoli,
        // allineata a public.my_team_ids() delle RLS.
        const slots = [
          `head_coach_id.eq.${effectiveId}`,
          `assistant_coach_id.eq.${effectiveId}`,
          `helper_coach_id.eq.${effectiveId}`,
          `team_manager_id.eq.${effectiveId}`,
          `second_manager_id.eq.${effectiveId}`,
          `third_manager_id.eq.${effectiveId}`,
        ].join(',')
        const { data } = await supabase
          .from('teams')
          .select('id, name, category, age_range, color')
          .or(slots)
        const teams = (data ?? []) as MyTeam[]
        setMyTeams(teams)
        setMyTeam(teams[0] ?? null)
      } else if (profile?.role === 'parent' || profile?.role === 'athlete') {
        setMyTeams([])
        setMyTeam(null)
      } else {
        setMyTeams([])
        setMyTeam(null)
      }
    } finally {
      setLoading(false)
    }
  }

  return { myTeam, myTeams, loading }
}
