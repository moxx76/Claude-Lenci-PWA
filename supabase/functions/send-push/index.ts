// deno-lint-ignore-file no-explicit-any
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

// VAPID setup dai secrets Supabase
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@lencipoirino.it'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

interface Payload {
  user_id: string
  title: string
  body?: string
  link?: string
  icon?: string
  kind?: string
}

Deno.serve(async (req) => {
  try {
    const p: Payload = await req.json()
    if (!p.user_id || !p.title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), { status: 400 })
    }

    // Recupera tutte le subscription dell'utente
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', p.user_id)

    if (error) {
      console.error('DB error', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { status: 200 })
    }

    const payload = JSON.stringify({
      title: p.title,
      body: p.body || '',
      link: p.link || '/',
      icon: p.icon || '/icon-192.png',
      badge: '/icon-192.png',
      kind: p.kind || 'info',
      timestamp: Date.now(),
    })

    const results = await Promise.allSettled(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth_key },
          },
          payload
        )
        // Aggiorna last_used_at
        await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
        return { id: s.id, status: 'sent' }
      } catch (err: any) {
        // 410 Gone o 404 → endpoint invalido, rimuovi la subscription
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
          return { id: s.id, status: 'pruned' }
        }
        console.error('Push send error', err?.statusCode, err?.body)
        return { id: s.id, status: 'error', error: err?.message }
      }
    }))

    const summary = {
      total: subs.length,
      sent: results.filter(r => r.status === 'fulfilled' && (r as any).value.status === 'sent').length,
      pruned: results.filter(r => r.status === 'fulfilled' && (r as any).value.status === 'pruned').length,
      failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r as any).value.status === 'error')).length,
    }
    return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('Handler error', err)
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 })
  }
})
