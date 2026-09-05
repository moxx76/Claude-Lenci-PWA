import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface StaffMember {
  profile_id: string
  full_name: string
  role_label: string   // etichetta italiana del ruolo
  role_key: 'head_coach' | 'assistant_coach' | 'helper_coach' | 'team_manager' | 'second_manager' | 'third_manager' | 'linesman' | 'masseur'
  order_num: number    // per ordinamento nella UI
}

/**
 * Restituisce l'elenco dei membri staff assegnati alla squadra,
 * nell'ordine gerarchico (tecnici prima, dirigenziali poi, sanitario in fondo).
 * Ogni membro compare una sola volta anche se ricopre più ruoli (prima assegnazione vince).
 */
export function useTeamStaff(teamId: string | null | undefined) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!teamId) { setStaff([]); return }
    setLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase.from('teams')
          .select(`
            head_coach:profiles!teams_head_coach_id_fkey(id, full_name),
            assistant_coach:profiles!teams_assistant_coach_id_fkey(id, full_name),
            helper_coach:profiles!teams_helper_coach_id_fkey(id, full_name),
            team_manager:profiles!teams_team_manager_id_fkey(id, full_name),
            second_manager:profiles!teams_second_manager_id_fkey(id, full_name),
            third_manager:profiles!teams_third_manager_id_fkey(id, full_name),
            linesman:profiles!teams_linesman_id_fkey(id, full_name),
            masseur:profiles!teams_masseur_id_fkey(id, full_name)
          `)
          .eq('id', teamId)
          .maybeSingle()

        if (!data) { setStaff([]); return }
        const out: StaffMember[] = []
        const seen = new Set<string>()

        const add = (rel: any, role_key: StaffMember['role_key'], role_label: string, order_num: number) => {
          const p = Array.isArray(rel) ? rel[0] : rel
          if (!p?.id || !p?.full_name) return
          if (seen.has(p.id)) return  // stessa persona su più ruoli → prima vince
          seen.add(p.id)
          out.push({ profile_id: p.id, full_name: p.full_name, role_key, role_label, order_num })
        }

        add(data.head_coach,      'head_coach',      'Allenatore',                        1)
        add(data.assistant_coach, 'assistant_coach', 'Allenatore in seconda',             2)
        add(data.helper_coach,    'helper_coach',    'Aiuto allenatore',                  3)
        add(data.team_manager,    'team_manager',    'Dirigente Accompagnatore',          4)
        add(data.second_manager,  'second_manager',  'Secondo Dirigente Accompagnatore',  5)
        add(data.third_manager,   'third_manager',   'Terzo Dirigente Accompagnatore',    6)
        add(data.linesman,        'linesman',        'Guardalinee di casa',               7)
        add(data.masseur,         'masseur',         'Massaggiatore',                     8)

        setStaff(out)
      } catch {
        setStaff([])
      } finally {
        setLoading(false)
      }
    })()
  }, [teamId])

  return { staff, loading }
}
