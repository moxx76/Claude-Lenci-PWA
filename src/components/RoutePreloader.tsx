import { useEffect } from 'react'
import { useAuth } from '../store/auth'

/**
 * M8 — Preload opportunistico dei chunk delle route più comuni.
 *
 * Da quando le route sono lazy, il primo accesso a una pagina scarica il
 * chunk corrispondente (penalty ~50-200ms su rete decente, più su 3G).
 * Dopo che l'app è caricata e l'utente è loggato, abbiamo tipicamente 1-5
 * secondi "morti" in cui il browser può pre-scaricare le pagine che
 * l'utente probabilmente aprirà a breve (Dashboard, Teams, Calendario).
 *
 * Strategia:
 * - Fase 1 (300ms dopo login): Dashboard, Profile (sempre usate)
 * - Fase 2 (1500ms): Teams, CalendarPage, Referti (molto comuni per staff)
 * - Fase 3 (3000ms): Comunicati, Esercizi, Moduli (meno frequenti)
 * - Fase 4 (6000ms): Marketing, Journalist (solo per ruoli specifici)
 *
 * requestIdleCallback è l'ideale (richiede meno priority del main thread)
 * ma non è disponibile su Safari — fallback setTimeout. Entrambi non
 * bloccano il main thread di rendering critico.
 *
 * Nessun effetto se l'utente non è loggato (saremmo su /login o
 * /reset-password e non vale la pena preloadare la UI logged-in).
 */

type IdleCallback = () => void

function schedule(cb: IdleCallback, delay: number) {
  const win = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
  if (typeof win.requestIdleCallback === 'function') {
    setTimeout(() => win.requestIdleCallback!(cb, { timeout: 2000 }), delay)
  } else {
    setTimeout(cb, delay)
  }
}

export function RoutePreloader() {
  const { session, profile } = useAuth()

  useEffect(() => {
    if (!session?.user) return

    // Fase 1 — pagine critiche
    schedule(() => {
      import('../pages/Dashboard').catch(() => {})
      import('../pages/Profile').catch(() => {})
    }, 300)

    // Fase 2 — pagine comuni per staff e dirigenza
    schedule(() => {
      import('../pages/Teams').catch(() => {})
      import('../pages/CalendarPage').catch(() => {})
      if (profile?.role === 'admin' || profile?.role === 'coach') {
        import('../pages/Referti').catch(() => {})
      }
    }, 1500)

    // Fase 3 — pagine meno frequenti ma popolari per staff
    schedule(() => {
      if (profile?.role === 'admin' || profile?.role === 'coach') {
        import('../pages/Comunicati').catch(() => {})
        import('../pages/EserciziPage').catch(() => {})
      }
      import('../pages/Profile').catch(() => {}) // già caricata, no-op
    }, 3000)

    // Fase 4 — ruolo-specifiche
    schedule(() => {
      if (profile?.is_journalist) {
        import('../pages/Journalist').catch(() => {})
      }
      if (profile?.is_marketing) {
        import('../pages/Marketing').catch(() => {})
      }
      if (profile?.role === 'admin' || profile?.is_director) {
        import('../pages/Moduli').catch(() => {})
      }
    }, 6000)
  }, [session?.user?.id, profile?.role, profile?.is_journalist, profile?.is_marketing, profile?.is_director])

  return null
}
