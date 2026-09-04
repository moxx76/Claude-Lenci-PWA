import { Icon } from './Icon'
import { useAuth } from '../store/auth'

export function ReadOnlyBanner() {
  const { profile } = useAuth()
  if (!profile?.is_readonly) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #005f98, #003c5e)',
      color: '#fff',
      padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: 'inherit',
    }}>
      <Icon name="visibility" size={16} color="#ffd100" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>
          Modalità sola lettura
        </div>
        <div style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.3 }}>
          Puoi consultare tutti i dati ma non modificarli
        </div>
      </div>
    </div>
  )
}
