/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// Precache generato da Workbox
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
self.addEventListener('activate', (evt) => evt.waitUntil(self.clients.claim()))

// Cache API Supabase Network-First
registerRoute(
  ({ url }) => url.origin === 'https://nlgknkopottaxewpdofl.supabase.co'
    && url.pathname.startsWith('/rest/v1/'),
  new NetworkFirst({
    cacheName: 'supabase-api-v2',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 5 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

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
