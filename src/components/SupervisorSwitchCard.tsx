import { useState } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../store/auth'
import { useImpersonation } from '../store/impersonation'
import { ManagerSwitcherSheet } from './ManagerSwitcherSheet'

export function SupervisorSwitchCard() {
  const { profile } = useAuth()
  const { managerId, clear } = useImpersonation()
  const [open, setOpen] = useState(false)

  if (!profile?.is_supervisor) return null

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fdf3f8 100%)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        border: '1.5px solid #ffdae7',
        boxShadow: '0 10px 24px rgba(193,0,108,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #c1006c, #7a0071)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="supervisor_account" size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#7a0071', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Supervisor
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', fontFamily: 'Anybody' }}>
              Gestione dirigenti
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#404751', lineHeight: 1.4, margin: '0 0 12px' }}>
          {managerId
            ? 'Stai impersonando un dirigente. Puoi uscire dalla vista dal banner in alto.'
            : 'Impersona un dirigente per vedere l\'app come lui e agire al posto suo.'}
        </p>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            background: managerId ? '#fff' : 'linear-gradient(135deg, #c1006c, #7a0071)',
            color: managerId ? '#7a0071' : '#fff',
            border: managerId ? '1.5px solid #c1006c' : 'none',
            padding: '11px 14px', borderRadius: 12,
            fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Icon name="theater_comedy" size={15} color={managerId ? '#7a0071' : '#fff'} />
          {managerId ? 'Cambia dirigente da impersonare' : 'Impersona dirigente'}
        </button>
        {managerId && (
          <button
            onClick={() => { clear(); setTimeout(() => window.location.reload(), 100) }}
            style={{
              width: '100%', marginTop: 8,
              background: 'transparent', color: '#93000a',
              border: 'none', padding: '8px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Esci dalla vista impersonata
          </button>
        )}
      </div>
      <ManagerSwitcherSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
