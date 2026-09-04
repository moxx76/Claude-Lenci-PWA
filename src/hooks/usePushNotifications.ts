import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

// VAPID public key — sicuro esporla nel frontend
const VAPID_PUBLIC_KEY = 'BPC0U9g6CuAKWeyzsSC5Rb0woGoz1oGln19er4kX7_AvVOuJRP4jzbSPz71LWck6GE59-7GJk6VdVyACkWSTo24'

export type PushStatus =
  | 'unsupported'      // browser non supporta
  | 'ios_needs_pwa'    // iOS che richiede PWA installata
  | 'blocked'          // permesso negato
  | 'granted'          // ok
  | 'default'          // non ancora chiesto
  | 'subscribing'      // in corso
  | 'subscribed'       // attivo e registrato

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Rileva iOS Safari senza PWA installata (push richiedono PWA in home screen)
function isIosNeedsPwa(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  if (!isIos) return false
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
  return !isStandalone
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('default')
  const [error, setError] = useState<string | null>(null)

  const compute = useCallback(async (): Promise<PushStatus> => {
    // IMPORTANTE: iOS Safari senza PWA installata è il caso più comune di "non funziona"
    // e va rilevato PRIMA del check generico "unsupported", perché su iOS il PushManager
    // non è esposto in modalità browser normale ma lo è in modalità standalone.
    if (isIosNeedsPwa()) return 'ios_needs_pwa'
    if (!isSupported()) return 'unsupported'
    if (Notification.permission === 'denied') return 'blocked'
    if (Notification.permission === 'default') return 'default'
    // Granted → controlla se effettivamente c'è una subscription attiva su questo device+user
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return 'granted' // Permesso dato ma non sottoscritti
      if (!user) return 'granted'
      // Verifica che la subscription sia registrata in DB per l'utente corrente
      const { data } = await supabase.from('push_subscriptions')
        .select('id').eq('endpoint', sub.endpoint).eq('user_id', user.id).maybeSingle()
      return data ? 'subscribed' : 'granted'
    } catch { return 'granted' }
  }, [user])

  useEffect(() => {
    compute().then(setStatus)
  }, [compute])

  const subscribe = useCallback(async () => {
    if (!user) { setError('Utente non autenticato'); return false }
    setError(null)
    setStatus('subscribing')
    try {
      // Richiedi permesso
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'blocked' : 'default')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const json = sub.toJSON() as any
      // Upsert su DB
      const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 500),
      }, { onConflict: 'endpoint' })

      if (dbErr) {
        setError('Errore salvataggio: ' + dbErr.message)
        setStatus('granted')
        return false
      }
      setStatus('subscribed')
      return true
    } catch (e: any) {
      setError(e?.message || 'Errore sconosciuto')
      const s = await compute()
      setStatus(s)
      return false
    }
  }, [user, compute])

  const unsubscribe = useCallback(async () => {
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus('granted')
      return true
    } catch (e: any) {
      setError(e?.message || 'Errore')
      return false
    }
  }, [])

  return { status, error, subscribe, unsubscribe, refresh: () => compute().then(setStatus) }
}
