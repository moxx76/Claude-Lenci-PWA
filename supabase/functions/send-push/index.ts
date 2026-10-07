// deno-lint-ignore-file no-explicit-any
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

// VAPID setup dai secrets Supabase
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@lencipoirino.it'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Admin client (service role) per leggere subscription e scrivere push_log
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

// Rate limit: max N push per minuto per caller
const PUSH_PER_MIN_PER_CALLER = 20
// Max link length per prevenire payload abusivi
const MAX_LINK_LENGTH = 2048
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 1000

interface Payload {
  user_id: string
  title: string
  body?: string
  link?: string
  icon?: string
  kind?: string
}

function sanitizeLink(link: string | undefined): string {
  if (!link) return '/'
  if (link.length > MAX_LINK_LENGTH) return '/'
  // Permetti solo path relativi o URL app
  if (link.startsWith('/')) return link
  try {
    const url = new URL(link)
    const allowedHosts = ['asd-lenci-poirino.netlify.app', 'lencipoirino.it']
    if (allowedHosts.some(h => url.hostname === h)) return url.pathname + url.search
  } catch { /* ignore */ }
  return '/'
}

Deno.serve(async (req) => {
  try {
    // 1. Estrai JWT dall'header Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'missing authorization' }), { status: 401 })
    }

    // 2. Verifica il JWT contro Supabase Auth (client anon con token utente)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 })
    }

    // 3. Parse e validazione payload
    let p: Payload
    try {
      p = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
    }
    if (!p.user_id || !p.title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), { status: 400 })
    }
    if (typeof p.user_id !== 'string' || typeof p.title !== 'string') {
      return new Response(JSON.stringify({ error: 'invalid payload types' }), { status: 400 })
    }
    const title = p.title.slice(0, MAX_TITLE_LENGTH)
    const body = (p.body || '').slice(0, MAX_BODY_LENGTH)
    const link = sanitizeLink(p.link)

    // 4. Autorizzazione: can_notify_user(target_id) con il JWT del caller
    //    Chiamiamo l'RPC con userClient per rispettare auth.uid() = caller
    const { data: canNotify, error: notifyErr } = await userClient.rpc('can_notify_user', { target_id: p.user_id })
    if (notifyErr) {
      console.error('can_notify_user error', notifyErr)
      return new Response(JSON.stringify({ error: 'authorization check failed' }), { status: 500 })
    }
    if (!canNotify) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    }

    // 5. Rate limit: conta push_log del caller nell'ultimo minuto
    const since = new Date(Date.now() - 60_000).toISOString()
    const { count, error: countErr } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('caller_id', caller.id)
      .gte('sent_at', since)
    if (countErr) {
      console.error('rate limit check error', countErr)
    } else if ((count ?? 0) >= PUSH_PER_MIN_PER_CALLER) {
      return new Response(JSON.stringify({ error: 'rate limit exceeded', retry_after_seconds: 60 }), { status: 429 })
    }

    // 6. Log della chiamata (fire-and-forget, non blocca)
    admin.from('push_log').insert({ caller_id: caller.id, target_id: p.user_id }).then(() => {})

    // 7. Recupera subscription del destinatario (service role, bypassa RLS)
    const { data: subs, error: subsErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', p.user_id)
    if (subsErr) {
      console.error('DB error', subsErr)
      return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 })
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { status: 200 })
    }

    const payload = JSON.stringify({
      title,
      body,
      link,
      icon: p.icon && p.icon.startsWith('/') ? p.icon : '/icon-192.png',
      badge: '/icon-192.png',
      kind: typeof p.kind === 'string' ? p.kind.slice(0, 64) : 'info',
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
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
        return { id: s.id, status: 'sent' }
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
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
    return new Response(JSON.stringify({ error: err?.message || 'internal error' }), { status: 500 })
  }
})
