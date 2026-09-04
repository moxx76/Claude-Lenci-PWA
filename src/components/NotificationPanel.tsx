import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

interface Notification {
  id: string
  kind: string
  title: string
  body: string | null
  icon: string
  icon_color: string
  icon_bg: string
  link: string | null
  read_at: string | null
  created_at: string
}

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ora'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} g`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { profile } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    load()
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const load = async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems((data ?? []) as Notification[])
    setLoading(false)
  }

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setItems(items.map(i => i.id === id ? { ...i, read_at: new Date().toISOString() } : i))
    }
  }

  const markAllRead = async () => {
    if (!profile?.id) return
    const ids = items.filter(i => !i.read_at).map(i => i.id)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
    if (!error) {
      const now = new Date().toISOString()
      setItems(items.map(i => i.read_at ? i : { ...i, read_at: now }))
    }
  }

  if (!open) return null
  const unreadCount = items.filter(i => !i.read_at).length

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(24,28,32,0.35)',
          zIndex: 40, animation: 'lenciFadeIn 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 72, right: 14, left: 14,
          maxWidth: 380, marginLeft: 'auto',
          background: '#fff', borderRadius: 18,
          boxShadow: '0 20px 40px rgba(0,95,152,0.25), 0 4px 12px rgba(0,0,0,0.08)',
          zIndex: 50, overflow: 'hidden',
          animation: 'lenciSlideUp 0.25s ease',
          maxHeight: 'calc(100vh - 96px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px', borderBottom: '1px solid #e6e8ee',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0, fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20', flex: 1 }}>
            Notifiche
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: '#ba1a1a', color: '#fff',
                padding: '2px 7px', borderRadius: 999,
              }}>
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: 'transparent', border: 'none',
                color: '#005f98', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', padding: 4,
              }}
            >
              Segna tutte lette
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 4, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Chiudi"
          >
            <Icon name="close" size={20} color="#707882" />
          </button>
        </div>

        <div className="lenci-scroll" style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
              Caricamento…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="notifications_off" size={40} color="#c0c7d2" />
              <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>
                Nessuna notifica
              </p>
            </div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read_at && markRead(n.id)}
                style={{
                  padding: '12px 18px', borderBottom: '1px solid #f1f3fa',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: 'pointer',
                  opacity: n.read_at ? 0.65 : 1,
                  transition: 'background 0.15s',
                  background: n.read_at ? 'transparent' : 'rgba(0,120,191,0.03)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f7f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read_at ? 'transparent' : 'rgba(0,120,191,0.03)')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: n.icon_bg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={n.icon} size={18} color={n.icon_color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20', lineHeight: 1.35 }}>
                      {n.title}
                    </h4>
                    <span style={{ fontSize: 10.5, color: '#707882', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#404751', lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                  )}
                </div>
                {!n.read_at && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#005f98', flexShrink: 0, marginTop: 14,
                  }} />
                )}
              </div>
            ))
          )}
        </div>

        <Link
          to="/annunci"
          onClick={onClose}
          style={{
            padding: '13px 18px', background: '#f1f3fa', color: '#005f98',
            border: 'none', borderTop: '1px solid #e6e8ee',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            textDecoration: 'none',
          }}
        >
          <Icon name="inbox" size={15} color="#005f98" />
          Apri bacheca comunicazioni
        </Link>
      </div>
    </>
  )
}
