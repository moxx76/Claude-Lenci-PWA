import { useEffect, useRef } from 'react'
import { APP_VERSION } from '../lib/version'

/**
 * VersionGuard: all'avvio dell'app (e al rientro in foreground) fa un fetch
 * no-store a /version.json — scritto a build time (vite.config.ts) e servito
 * NetworkOnly dal service worker (sw.ts). Se la versione server è diversa da
 * APP_VERSION locale → hard refresh (unregister SW + delete caches + navigate
 * con cache-buster di versione).
 *
 * PERCHÉ ESISTE: il SilentAutoUpdater di workbox-window si basa su un ciclo
 * registration.update() che su PWA iOS standalone a volte non vede mai il nuovo
 * SW (WKWebView tiene cache HTTP del precache). Qui invece bypassiamo tutto:
 * un endpoint rete-only ci dice la verità sul deploy, e noi forziamo il refresh
 * come se l'utente avesse premuto "Svuota cache" dal Profilo.
 *
 * Il check è silenzioso: nessuna UI, nessun confirm. L'utente non deve fare
 * nulla, l'app torna semplicemente aggiornata al prossimo cold start.
 */
export function VersionGuard() {
  const checkingRef = useRef(false)
  const lastCheckRef = useRef(0)

  const check = async () => {
    // Rate-limit: no checks più frequenti di 30s
    const now = Date.now()
    if (now - lastCheckRef.current < 30_000) return
    if (checkingRef.current) return
    checkingRef.current = true
    lastCheckRef.current = now

    try {
      const resp = await fetch('/version.json?t=' + now, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      })
      if (!resp.ok) return
      const data = await resp.json() as { version?: string; builtAt?: string }
      if (!data.version) return

      if (data.version !== APP_VERSION) {
        console.log(
          `[VersionGuard] server=${data.version} vs locale=${APP_VERSION} → force refresh`
        )
        // Hard refresh: smonto SW + cache, poi navigate con cache-buster di versione
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map(r => r.unregister()))
          }
          if ('caches' in window) {
            const names = await caches.keys()
            await Promise.all(names.map(n => caches.delete(n)))
          }
        } catch (e) {
          console.warn('[VersionGuard] cleanup SW/caches failed, forcing reload anyway', e)
        }
        // Navigate con query distinta per versione: aggira cache HTTP di WKWebView
        // (iOS PWA standalone tiene HTTP cache separata dalle Cache API)
        const url = new URL(window.location.href)
        url.searchParams.set('_v', data.version)
        window.location.replace(url.toString())
      }
    } catch (e) {
      // Rete giù: silenzioso, riprovo al prossimo evento
    } finally {
      checkingRef.current = false
    }
  }

  useEffect(() => {
    // Check immediato all'avvio
    check()
    // Check al rientro in foreground (iOS PWA switch task → riapre)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    // Check periodico di sicurezza ogni 5 min (meno aggressivo del SilentAutoUpdater)
    const interval = setInterval(check, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
