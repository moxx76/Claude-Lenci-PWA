import { useEffect, useRef } from 'react'
import { APP_VERSION } from '../lib/version'

/**
 * A11 — Rileva bozze non salvate per rimandare un reload automatico.
 * Convenzione: ogni form/sheet con modifiche pendenti può aggiungere
 * data-dirty="true" sul proprio root; in alternativa controlliamo:
 * - localStorage con chiavi che cominciano con "draft:" (es. PostMatchSheet)
 * - input testuali/textarea/select con value diverso da defaultValue
 *   e almeno un carattere digitato (euristica: value non vuoto per campi
 *   di tipo text/number/password/email/tel/search e textarea)
 */
export function hasUnsavedWork(): boolean {
  try {
    // 1. Marker esplicito via data-dirty
    if (document.querySelector('[data-dirty="true"]')) return true
    // 2. Draft keys in localStorage (PostMatchSheet usa questa convenzione)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('draft:') || k.startsWith('postmatch_draft_'))) {
        return true
      }
    }
    // 3. Un BottomSheet aperto con un form attivo è segnale di editing
    //    (il sheet appare con role="dialog" o aria-modal; se c'è un sheet
    //    aperto con dentro input/textarea con value, consideriamo dirty)
    const sheets = document.querySelectorAll('[data-bottom-sheet="open"]')
    if (sheets.length > 0) {
      for (const sheet of Array.from(sheets)) {
        const inputs = sheet.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        for (const el of Array.from(inputs)) {
          if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit') continue
          if ('value' in el && el.value && el.value.trim().length > 0 && el.value !== el.defaultValue) {
            return true
          }
        }
      }
    }
    return false
  } catch {
    return false
  }
}

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
        // A11: non ricaricare mentre l'utente ha una modifica in corso.
        // beforeunload torna truthy sse c'è almeno un form "dirty" registrato
        // tramite marker DOM data-dirty="true" o input modificati. Riprovo
        // automaticamente al prossimo check (3 min default): meglio ritardare
        // l'update di qualche minuto che far perdere la bozza al coach.
        if (hasUnsavedWork()) {
          console.log('[VersionGuard] bozze in corso rilevate, update rimandato al prossimo check')
          return
        }
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
