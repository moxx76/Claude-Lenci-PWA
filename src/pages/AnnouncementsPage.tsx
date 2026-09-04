import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'
import { Icon } from '../components/Icon'
import { AnnouncementEditSheet } from '../components/AnnouncementEditSheet'

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  pinned: boolean | null
  published_at: string | null
  author: { full_name: string | null } | null
}

const AUDIENCE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  all:       { bg: '#cfe5ff', color: '#004a78', label: 'Tutti' },
  parents:   { bg: 'rgba(255,209,0,0.30)', color: '#8e6300', label: 'Genitori' },
  athletes:  { bg: 'rgba(128,249,139,0.35)', color: '#006e25', label: 'Atleti' },
  coaches:   { bg: '#ffdad6', color: '#93000a', label: 'Coach' },
  staff:     { bg: '#e6e8ee', color: '#404751', label: 'Staff' },
}

function formatDateLong(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function AnnouncementsPage() {
  const { profile } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const canEdit = isAdmin(profile?.role)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('id, title, body, audience, pinned, published_at, author:profiles!announcements_author_id_fkey(full_name)')
      .not('published_at', 'is', null)
      .order('pinned', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(50)
    setAnnouncements((data ?? []) as any)
    setLoading(false)
  }

  const sorted = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return (b.published_at || '').localeCompare(a.published_at || '')
    })
  }, [announcements])

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Eliminare la comunicazione "${title}"?\n\nL'azione è irreversibile.`)) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { alert('Errore eliminazione: ' + error.message); return }
    load()
  }

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
            Comunicazioni
          </h2>
          <p style={{ fontSize: 12.5, color: '#707882', margin: '4px 0 0' }}>
            {announcements.length} {announcements.length === 1 ? 'annuncio' : 'annunci'} pubblicati
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setEditOpen(true) }}
            style={{
              background: '#005f98', color: '#fff', border: 'none',
              borderRadius: 999, padding: '9px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 6px 16px rgba(0,95,152,0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="add" size={14} color="#fff" />
            Nuovo
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#707882', fontSize: 13 }}>
          Caricamento…
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 18, padding: 40, textAlign: 'center' }}>
          <Icon name="campaign" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>
            Nessuna comunicazione pubblicata.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map(a => {
            const aStyle = AUDIENCE_STYLE[a.audience] || AUDIENCE_STYLE.all
            const isExpanded = expanded.has(a.id)
            const preview = a.body.slice(0, 180)
            const hasMore = a.body.length > 180
            return (
              <div
                key={a.id}
                style={{
                  background: '#fff', borderRadius: 14,
                  padding: 16, boxShadow: '0 6px 16px rgba(0,120,191,0.06)',
                  borderLeft: a.pinned ? '4px solid #b3005c' : '4px solid transparent',
                }}
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {a.pinned && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: '#b3005c',
                      background: 'rgba(179,0,92,0.1)', padding: '3px 8px', borderRadius: 999,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Icon name="push_pin" size={12} color="#b3005c" />
                      IN EVIDENZA
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: aStyle.bg, color: aStyle.color,
                  }}>
                    {aStyle.label}
                  </span>
                  {canEdit && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => { setEditing(a); setEditOpen(true) }}
                        style={{
                          background: 'rgba(0,95,152,0.10)', border: 'none', cursor: 'pointer',
                          padding: '5px 10px', borderRadius: 8,
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, color: '#005f98',
                        }}
                        title="Modifica"
                      >
                        <Icon name="edit" size={13} color="#005f98" />
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDelete(a.id, a.title)}
                        style={{
                          background: 'rgba(147,0,10,0.08)', border: 'none', cursor: 'pointer',
                          padding: '5px 10px', borderRadius: 8,
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, color: '#93000a',
                        }}
                        title="Elimina"
                      >
                        <Icon name="delete_outline" size={13} color="#93000a" />
                        Elimina
                      </button>
                    </div>
                  )}
                </div>

                <h3 style={{
                  fontFamily: 'Anybody', fontWeight: 700, fontSize: 16,
                  color: '#181c20', margin: '0 0 6px',
                }}>
                  {a.title}
                </h3>

                <p style={{
                  fontSize: 13, color: '#404751', lineHeight: 1.5,
                  margin: 0, whiteSpace: 'pre-line',
                }}>
                  {isExpanded ? a.body : preview}
                  {hasMore && !isExpanded && '…'}
                </p>

                {hasMore && (
                  <button
                    onClick={() => toggleExpanded(a.id)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#005f98', fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer', padding: '6px 0 0',
                    }}
                  >
                    {isExpanded ? 'Mostra meno' : 'Leggi tutto'}
                  </button>
                )}

                <p style={{
                  fontSize: 10.5, color: '#707882', margin: '10px 0 0',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Icon name="schedule" size={12} color="#707882" />
                  {formatDateLong(a.published_at)}
                  {a.author?.full_name && ` • ${a.author.full_name}`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <AnnouncementEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={editing}
        onSaved={() => { setEditOpen(false); load() }}
      />
    </div>
  )
}
