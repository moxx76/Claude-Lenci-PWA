import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../store/auth'
import { useViewMode } from '../store/viewMode'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ViewModeSwitchCard() {
  const { profile } = useAuth()
  const { mode, setMode } = useViewMode()
  const navigate = useNavigate()
  const [dbFlag, setDbFlag] = useState<boolean | null>(null)

  // Fallback difensivo: se il flag non è nel profile cached (vecchio deploy),
  // lo prendiamo direttamente dal DB una volta.
  useEffect(() => {
    if (!profile?.id) return
    if (profile.can_switch_to_parent !== undefined && profile.can_switch_to_parent !== null) return
    supabase.from('profiles').select('can_switch_to_parent').eq('id', profile.id).single()
      .then(({ data }) => setDbFlag(data?.can_switch_to_parent === true))
  }, [profile?.id, profile?.can_switch_to_parent])

  const canSwitch = profile?.can_switch_to_parent === true || dbFlag === true
  if (!canSwitch) return null

  const switchTo = (m: 'admin' | 'parent') => {
    setMode(m)
    navigate('/')
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f7f9ff, #eaf3ff)',
      borderRadius: 14, padding: 14,
      border: '1px solid #cfe5ff',
      boxShadow: '0 4px 12px rgba(0,120,191,0.05)',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#005f98',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
      }}>
        <Icon name="switch_account" size={13} color="#005f98" />
        Cambio vista
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => switchTo('admin')}
          style={{
            padding: '10px', borderRadius: 10, cursor: 'pointer',
            border: mode === 'admin' ? '2px solid #005f98' : '1px solid #dce3f0',
            background: mode === 'admin' ? '#005f98' : '#fff',
            color: mode === 'admin' ? '#fff' : '#404751',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
          <Icon name="admin_panel_settings" size={18} color={mode === 'admin' ? '#fff' : '#005f98'} />
          <span style={{ fontSize: 11.5, fontWeight: 800 }}>Amministrativa</span>
        </button>
        <button onClick={() => switchTo('parent')}
          style={{
            padding: '10px', borderRadius: 10, cursor: 'pointer',
            border: mode === 'parent' ? '2px solid #c1006c' : '1px solid #dce3f0',
            background: mode === 'parent' ? '#c1006c' : '#fff',
            color: mode === 'parent' ? '#fff' : '#404751',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
          <Icon name="family_restroom" size={18} color={mode === 'parent' ? '#fff' : '#c1006c'} />
          <span style={{ fontSize: 11.5, fontWeight: 800 }}>Genitore</span>
        </button>
      </div>
    </div>
  )
}
