import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useImpersonation } from '../store/impersonation'

export function ImpersonationBanner() {
  const { managerId, clear } = useImpersonation()
  const [name, setName] = useState<string>('')

  useEffect(() => {
    if (!managerId) { setName(''); return }
    supabase.from('profiles').select('full_name, email').eq('id', managerId).single()
      .then(({ data }) => setName(data?.full_name || data?.email || 'Utente'))
  }, [managerId])

  if (!managerId) return null

  const exit = () => {
    clear()
    // Reload leggero per assicurarsi che i hook si rileggano lo stato pulito
    setTimeout(() => window.location.reload(), 100)
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0, zIndex: 60,
      background: 'linear-gradient(135deg, #c1006c, #7a0071)',
      color: '#fff',
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="theater_comedy" size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Vista impersonata
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
      </div>
      <button
        onClick={exit}
        style={{
          background: '#fff', color: '#7a0071',
          border: 'none', padding: '7px 12px', borderRadius: 8,
          fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        <Icon name="logout" size={13} color="#7a0071" />
        Esci
      </button>
    </div>
  )
}
