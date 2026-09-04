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
        // Cerco squadre dove effectiveId è in uno dei 5 ruoli operativi:
        // head_coach, assistant_coach, helper_coach, team_manager, second_manager
        // (allineato a public.my_team_ids() delle RLS)
        const [{ data: asHead }, { data: asAssist }, { data: asHelper }, { data: asMgr }, { data: asMgr2 }] = await Promise.all([
          supabase.from('teams').select('id, name, category, age_range, color').eq('head_coach_id', effectiveId),
          supabase.from('teams').select('id, name, category, age_range, color').eq('assistant_coach_id', effectiveId),
          supabase.from('teams').select('id, name, category, age_range, color').eq('helper_coach_id', effectiveId),
          supabase.from('teams').select('id, name, category, age_range, color').eq('team_manager_id', effectiveId),
          supabase.from('teams').select('id, name, category, age_range, color').eq('second_manager_id', effectiveId),
        ])
        const map = new Map<string, MyTeam>()
        for (const t of (asHead   ?? []) as MyTeam[]) map.set(t.id, t)
        for (const t of (asAssist ?? []) as MyTeam[]) map.set(t.id, t)
        for (const t of (asHelper ?? []) as MyTeam[]) map.set(t.id, t)
        for (const t of (asMgr    ?? []) as MyTeam[]) map.set(t.id, t)
        for (const t of (asMgr2   ?? []) as MyTeam[]) map.set(t.id, t)
        const teams = Array.from(map.values())
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
