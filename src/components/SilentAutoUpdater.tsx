import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Check ogni 3 minuti
const CHECK_INTERVAL_MS = 3 * 60 * 1000
// Delay minimo prima di ricaricare (per non spezzare azione in corso)
const RELOAD_DELAY_MS = 2000
// Ricarica solo se utente idle da almeno questi ms
const IDLE_THRESHOLD_MS = 3000

/**
 * Auto-updater PWA aggressivo.
 * Quando trova nuovo SW: skipWaiting + reload della pagina appena l'utente è idle.
 */
export function SilentAutoUpdater() {
  const lastInteractionRef = useRef<number>(Date.now())
  const pendingUpdateRef = useRef<boolean>(false)

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Check periodico
      setInterval(() => { registration.update().catch(() => {}) }, CHECK_INTERVAL_MS)
      // Al ritorno in foreground → check
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {})
        }
      })
      // Anche al focus della finestra
      window.addEventListener('focus', () => {
        registration.update().catch(() => {})
      })
    },
    onNeedRefresh() {
      console.log('[PWA] Nuovo service worker disponibile — apply + reload')
      pendingUpdateRef.current = true
      scheduleUpdate()
    },
  })

  // Traccia interazione utente
  useEffect(() => {
    const markActive = () => { lastInteractionRef.current = Date.now() }
    const events: Array<keyof DocumentEventMap> = ['click', 'keydown', 'touchstart', 'input', 'change']
    events.forEach(e => document.addEventListener(e, markActive, { passive: true } as any))
    return () => events.forEach(e => document.removeEventListener(e, markActive as any))
  }, [])

  const scheduleUpdate = () => {
    setTimeout(async () => {
      if (!pendingUpdateRef.current) return
      const idleFor = Date.now() - lastInteractionRef.current
      if (idleFor < IDLE_THRESHOLD_MS) {
        setTimeout(() => scheduleUpdate(), 5_000)
        return
      }
      pendingUpdateRef.current = false
      try {
        await updateServiceWorker(true)
        // Attendo che il nuovo SW prenda il controllo, poi reload duro
        setTimeout(() => window.location.reload(), 500)
      } catch (e) {
        console.warn('[PWA] Update failed, forcing reload', e)
        window.location.reload()
      }
    }, RELOAD_DELAY_MS)
  }

  return null
}
