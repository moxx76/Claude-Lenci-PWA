/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// Precache generato da Workbox
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// IMPORTANTE: NON chiamare self.skipWaiting() al top-level.
// Se lo si fa, il nuovo SW passa da `installed` direttamente ad `active`
// bypassando lo stato `waiting`. Workbox-window chiama onNeedRefresh SOLO
// quando il nuovo SW è in waiting, quindi il top-level skipWaiting è esattamente
// ciò che rompe l'auto-update: SilentAutoUpdater del bundle vecchio non viene mai
// notificato e il reload automatico non parte mai.
//
// Soluzione corretta: aspettare il messaggio SKIP_WAITING che workbox-window
// invia dentro updateServiceWorker(true) chiamato da onNeedRefresh.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (evt) => evt.waitUntil(self.clients.claim()))

// IMPORTANTE: /version.json SEMPRE dalla rete, mai cache.
// Serve al VersionGuard client per rilevare un deploy nuovo e forzare il reload
// anche quando il resto del SW ha bundle vecchi precached. Deve stare PRIMA degli
// altri registerRoute per avere priorità sul precache.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname === '/version.json',
  new NetworkOnly()
)

// Navigation requests (richieste a /, /qualsiasi-path senza estensione) → NetworkFirst
// con timeout breve. Risolve il bug per cui index.html precached serviva per sempre
// l'HTML del vecchio deploy, impedendo ai client installati di scoprire deploy nuovi.
// Offline: fallback automatico al precache (PWA continua a funzionare senza rete).
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigations',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  )
)

// Supabase REST /rest/v1/ → NetworkOnly (A01).
// Prima era NetworkFirst con cache 'supabase-api-v2' condivisa fra sessioni:
// vulnerabilità cross-user quando dopo un logout un altro utente faceva la stessa
// request sulla stessa origine. Cache rimossa; se serve offline-read in futuro,
// progettare cache per-identity scoped al JWT con pulizia al logout.
registerRoute(
  ({ url }) => url.origin === 'https://nlgknkopottaxewpdofl.supabase.co'
    && url.pathname.startsWith('/rest/v1/'),
  new NetworkOnly()
)

// Al logout il client chiama caches.delete per supabase-api-v2 (legacy): se è
// ancora presente da deploy precedenti la svuotiamo in activate del nuovo SW.
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    try {
      const names = await caches.keys()
      await Promise.all(
        names.filter(n => n === 'supabase-api-v2' || n.startsWith('supabase-api-'))
          .map(n => caches.delete(n))
      )
    } catch { /* ignore */ }
  })())
})

// ============ PUSH NOTIFICATIONS ============
interface PushPayload {
  title: string
  body?: string
  link?: string
  icon?: string
  badge?: string
  kind?: string
  timestamp?: number
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: event.data.text() }
  }

  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    data: { link: payload.link || '/', kind: payload.kind },
    tag: payload.kind || 'general',
    requireInteraction: false,
    silent: false,
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'ASD Lenci Poirino', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      // Se una finestra è già aperta, focus + naviga
      for (const client of clientsList) {
        if ('focus' in client) {
          (client as WindowClient).focus()
          if ('navigate' in client) (client as WindowClient).navigate(link)
          return
        }
      }
      // Altrimenti apri nuova finestra
      if (self.clients.openWindow) return self.clients.openWindow(link)
    })
  )
})

// ============= AUTO UPDATE =============
// Permette all'app di attivare il nuovo SW su richiesta (bypass del "waiting")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
