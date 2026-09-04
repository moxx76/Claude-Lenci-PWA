import { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { useAuth } from '../store/auth'
import { usePushNotifications } from '../hooks/usePushNotifications'

const DISMISS_KEY = 'push_prompt_dismissed_at'
const RE_PROMPT_DAYS = 7

export function PushAutoPromptBanner() {
  const { profile } = useAuth()
  const { status, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile?.is_push_auto_prompt) return
    if (status === 'subscribed' || status === 'unsupported' || status === 'blocked') return
    // Se dismesso di recente, non ripresentare
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw) {
      const days = (Date.now() - parseInt(raw)) / (1000 * 60 * 60 * 24)
      if (days < RE_PROMPT_DAYS) return
    }
    setDismissed(false)
  }, [profile, status])

  if (dismissed) return null

  const handleActivate = async () => {
    setLoading(true)
    const ok = await subscribe()
    setLoading(false)
    if (ok) setDismissed(true)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setDismissed(true)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
      color: '#fff', padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 14px rgba(0,60,94,0.25)',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(255,255,255,0.20)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name="notifications_active" size={18} color="#ffd100" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>
          Attiva le notifiche push
        </div>
        <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2, lineHeight: 1.3 }}>
          {status === 'ios_needs_pwa'
            ? 'Su iPhone: aggiungi prima l\'app alla schermata Home'
            : 'Ricevi avvisi importanti anche a app chiusa'}
        </div>
      </div>
      {status !== 'ios_needs_pwa' && (
        <button
          onClick={handleActivate}
          disabled={loading || status === 'subscribing'}
          style={{
            background: '#ffd100', color: '#181c20',
            padding: '7px 12px', borderRadius: 8, border: 'none',
            fontWeight: 800, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
        >
          {loading ? 'Attivazione…' : 'Attiva'}
        </button>
      )}
      <button
        onClick={handleDismiss}
        aria-label="Ricorda più tardi"
        style={{
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4,
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
      </button>
    </div>
  )
}
