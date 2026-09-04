import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Logo } from './Logo'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'lenci-install-dismissed'

export function PWAInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // Check se già installato o già dismisso di recente
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
      return // dismisso da meno di 7 giorni
    }

    // Detect iOS
    const ua = window.navigator.userAgent
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    if (iosDevice) {
      setIsIos(true)
      // Mostra dopo 3 secondi
      setTimeout(() => setVisible(true), 3000)
      return
    }

    // Android / Chrome desktop
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler as any)
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferred(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 96, left: 12, right: 12,
        maxWidth: 400, marginLeft: 'auto', marginRight: 'auto',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 12px 32px rgba(0,95,152,0.25)',
        padding: 14, zIndex: 30,
        animation: 'lenciSlideUp 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <Logo size={44} variant="framed" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{
          margin: 0, fontFamily: 'Anybody', fontWeight: 800,
          fontSize: 14, color: '#181c20',
        }}>
          Installa l'app Lenci LAB
        </h4>
        {isIos ? (
          <p style={{ margin: '4px 0 8px', fontSize: 11.5, color: '#404751', lineHeight: 1.4 }}>
            Tocca <Icon name="ios_share" size={13} color="#005f98" /> in basso, poi <strong>"Aggiungi a Home"</strong> per averla sul telefono.
          </p>
        ) : (
          <p style={{ margin: '4px 0 8px', fontSize: 11.5, color: '#404751', lineHeight: 1.4 }}>
            Aggiungila al telefono per accedere velocemente e ricevere notifiche.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isIos && deferred && (
            <button
              onClick={install}
              style={{
                background: '#005f98', color: '#fff', border: 'none',
                borderRadius: 999, padding: '7px 14px',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Icon name="download" size={13} color="#fff" />
              Installa
            </button>
          )}
          <button
            onClick={dismiss}
            style={{
              background: 'transparent', color: '#707882', border: 'none',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              padding: '7px 14px',
            }}
          >
            {isIos ? 'Ho capito' : 'Più tardi'}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 4, borderRadius: '50%', flexShrink: 0,
        }}
        aria-label="Chiudi"
      >
        <Icon name="close" size={16} color="#707882" />
      </button>
    </div>
  )
}
