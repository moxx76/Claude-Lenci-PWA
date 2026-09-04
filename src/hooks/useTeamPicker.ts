import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { sortTeamsByAge } from '../lib/teamOrder'

export interface PickerTeam {
  id: string
  name: string
  category: string | null
  age_range: string | null
  color: string | null
  head_coach_id?: string | null
  team_manager_id?: string | null
}

/**
 * Ritorna le squadre visibili nel selettore:
 * - Admin / Director → tutte le squadre del club
 * - Coach / Dirigente → solo le proprie (head_coach o team_manager)
 * - Parent / Athlete → nessuna (non usato lì)
 */
export function useTeamPicker() {
  const { profile } = useAuth()
  const [teams, setTeams] = useState<PickerTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role])

  const load = async () => {
    setLoading(true)
    try {
      let query = supabase.from('teams')
        .select('id, name, category, age_range, color, head_coach_id, team_manager_id, players(count)')

      if (profile?.role === 'admin') {
        // admin (incluso director) → tutte
      } else if (profile?.role === 'coach') {
        query = query.or(`head_coach_id.eq.${profile.id},team_manager_id.eq.${profile.id}`)
      } else {
        setTeams([])
        setLoading(false)
        return
      }
      const { data } = await query
      setTeams(sortTeamsByAge((data ?? []) as PickerTeam[]))
    } finally {
      setLoading(false)
    }
  }

  return { teams, loading, hasMultiple: teams.length > 1, refresh: load }
}
