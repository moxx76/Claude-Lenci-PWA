import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useImpersonation } from '../store/impersonation'

interface Manager {
  id: string
  full_name: string | null
  email: string
  teams: Array<{ id: string; name: string; color: string | null }>
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ManagerSwitcherSheet({ open, onClose }: Props) {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(false)
  const { setManager } = useImpersonation()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    // Solo dirigenti: role='coach' + is_manager=true
    supabase.from('profiles')
      .select('id, full_name, email')
      .eq('role', 'coach')
      .eq('is_manager', true)
      .order('full_name')
      .then(async ({ data: profs }) => {
        if (!profs) { setManagers([]); setLoading(false); return }
        const ids = profs.map((p: any) => p.id)
        // Squadre di cui sono team_manager
        const { data: mgrTeams } = await supabase
          .from('teams').select('id, name, color, team_manager_id').in('team_manager_id', ids)
        const merged: Manager[] = profs.map((p: any) => {
          const teams: Manager['teams'] = []
          for (const t of (mgrTeams ?? []) as any[]) {
            if (t.team_manager_id === p.id) teams.push({ id: t.id, name: t.name, color: t.color })
          }
          return { ...p, teams }
        }).filter(m => m.teams.length > 0)
        setManagers(merged)
        setLoading(false)
      })
  }, [open])

  const pick = (managerId: string) => {
    setManager(managerId)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Impersona un dirigente">
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 12.5, color: '#404751', margin: '0 0 14px', lineHeight: 1.4 }}>
          Vedrai l'app come se fossi il dirigente scelto. Puoi tornare alla vista Supervisor in qualsiasi momento dal banner in alto.
        </p>

        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Carico i dirigenti…
          </div>
        )}

        {!loading && managers.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13, lineHeight: 1.5 }}>
            Nessun dirigente associato a una squadra.
            <br /><br />
            <span style={{ fontSize: 11.5 }}>
              I dirigenti si definiscono creando un profilo coach con il flag "dirigente" e assegnandoli come <em>team_manager</em> di una squadra.
            </span>
          </div>
        )}

        {!loading && managers.map(m => (
          <button
            key={m.id}
            onClick={() => pick(m.id)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: '#fff', border: '1px solid #d5dae2',
              borderRadius: 12, padding: 12, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'inherit',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: m.teams[0]?.color || '#005f98', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, flexShrink: 0,
            }}>
              {(m.full_name || m.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#181c20' }}>
                {m.full_name || m.email}
              </div>
              <div style={{ fontSize: 11, color: '#707882', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {m.teams.map(t => (
                  <span key={t.id} style={{
                    background: '#f1f3fa', padding: '2px 6px', borderRadius: 999,
                    fontWeight: 700, color: '#404751',
                  }}>
                    Dirigente {t.name}
                  </span>
                ))}
              </div>
            </div>
            <Icon name="chevron_right" size={16} color="#707882" />
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
