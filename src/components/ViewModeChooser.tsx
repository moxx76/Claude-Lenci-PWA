import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../store/auth'
import { useViewMode, type ViewMode } from '../store/viewMode'
import { supabase } from '../lib/supabase'

interface Child {
  id: string
  first_name: string
  last_name: string
  team: { id: string; name: string; color: string | null } | null
}

export function ViewModeChooser() {
  const { profile } = useAuth()
  const { mode, setMode } = useViewMode()
  const [children, setChildren] = useState<Child[]>([])
  const [dbFlag, setDbFlag] = useState<boolean | null>(null)

  // Fallback difensivo se profile cached non ha il flag
  useEffect(() => {
    if (!profile?.id) return
    if (profile.can_switch_to_parent !== undefined && profile.can_switch_to_parent !== null) return
    supabase.from('profiles').select('can_switch_to_parent').eq('id', profile.id).single()
      .then(({ data }) => setDbFlag(data?.can_switch_to_parent === true))
  }, [profile?.id, profile?.can_switch_to_parent])

  const canSwitch = profile?.can_switch_to_parent === true || dbFlag === true

  useEffect(() => {
    if (!canSwitch) return
    supabase.from('players')
      .select('id, first_name, last_name, team:teams(id, name, color)')
      .eq('parent_profile_id', profile!.id)
      .then(({ data }) => {
        const list = (data ?? []).map((c: any) => ({
          ...c, team: Array.isArray(c.team) ? c.team[0] : c.team,
        }))
        setChildren(list)
      })
  }, [canSwitch, profile])

  // Se non è dual-role o ha già scelto, non mostrare
  if (!canSwitch || mode !== null) return null

  const pick = (m: ViewMode) => setMode(m)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(24,28,32,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 22,
        padding: 24, maxWidth: 420, width: '100%',
        boxShadow: '0 30px 80px rgba(0,0,0,0.30)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 6,
        }}>
          <Icon name="switch_account" size={22} color="#005f98" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#005f98', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Doppio profilo
          </span>
        </div>
        <h2 style={{
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20',
          textAlign: 'center', margin: '0 0 6px',
        }}>
          Ciao {profile?.full_name?.split(' ')[0]}!
        </h2>
        <p style={{ fontSize: 13, color: '#404751', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.4 }}>
          Con che vista vuoi accedere oggi? Puoi cambiare in qualsiasi momento dal tuo profilo.
        </p>

        {/* CARD ADMIN */}
        <button
          onClick={() => pick('admin')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: '#fff', border: '2px solid #cfe5ff',
            borderRadius: 14, padding: 14, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 12,
            transition: 'transform 0.1s',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, #005f98, #0078bf)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="admin_panel_settings" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20' }}>
              Vista Amministrativa
            </div>
            <div style={{ fontSize: 11.5, color: '#707882', marginTop: 2, lineHeight: 1.3 }}>
              Dashboard club, squadre, calendario, marketing e gestione completa
            </div>
          </div>
          <Icon name="chevron_right" size={18} color="#005f98" />
        </button>

        {/* CARD PARENT */}
        <button
          onClick={() => pick('parent')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: '#fff', border: '2px solid #ffdae7',
            borderRadius: 14, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, #c1006c, #7a0071)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="family_restroom" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20' }}>
              Vista Genitore
            </div>
            <div style={{ fontSize: 11.5, color: '#707882', marginTop: 2, lineHeight: 1.3 }}>
              {children.length > 0
                ? `${children.length} figli associati: ${children.map(c => `${c.first_name} (${c.team?.name || '—'})`).join(', ')}`
                : 'Nessun figlio associato'}
            </div>
          </div>
          <Icon name="chevron_right" size={18} color="#c1006c" />
        </button>

        <p style={{
          fontSize: 10.5, color: '#707882', textAlign: 'center',
          margin: '14px 0 0', lineHeight: 1.4,
        }}>
          Suggerimento: dal Profilo trovi il selettore per cambiare vista al volo.
        </p>
      </div>
    </div>
  )
}
