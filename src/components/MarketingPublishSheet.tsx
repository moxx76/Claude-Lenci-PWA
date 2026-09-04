import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { CATEGORY_META, type MarketingEvent } from '../lib/marketing'

interface Props {
  open: boolean
  onClose: () => void
  event: MarketingEvent | null
  onPublished: () => void
}

const AUDIENCE_OPTS: Array<{ key: string; label: string; icon: string; desc: string }> = [
  { key: 'all',      label: 'Tutti',       icon: 'public',     desc: 'Tutti gli utenti del club' },
  { key: 'parents',  label: 'Genitori',    icon: 'family_restroom', desc: 'Solo i genitori tesserati' },
  { key: 'athletes', label: 'Atleti',      icon: 'sports_soccer', desc: 'Solo gli atleti tesserati' },
  { key: 'coaches',  label: 'Coach',       icon: 'sports',     desc: 'Solo gli allenatori' },
  { key: 'staff',    label: 'Staff',       icon: 'admin_panel_settings', desc: 'Solo direzione e amministratori' },
  { key: 'team',     label: 'Per squadra', icon: 'shield',     desc: 'Solo utenti collegati a squadre specifiche' },
]

export function MarketingPublishSheet({ open, onClose, event, onPublished }: Props) {
  const { profile } = useAuth()
  const [audience, setAudience] = useState<string[]>(['all'])
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [publishCalendar, setPublishCalendar] = useState(true)
  const [sendAnnouncement, setSendAnnouncement] = useState(true)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string; color: string | null }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && event) {
      // Precarica valori se già pubblicato o valori di default
      setAudience(event.calendar_audience ?? ['all'])
      setTeamIds(event.calendar_team_ids ?? [])
      setPublishCalendar(event.is_published_calendar || true)
      setSendAnnouncement(!event.published_announcement_id)
      const cat = CATEGORY_META[event.category]
      setAnnouncementTitle(`${cat.emoji} ${event.title}`)
      const dateStr = new Date(event.event_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const timeStr = event.start_time ? ` alle ${event.start_time.slice(0, 5)}` : ''
      setAnnouncementBody(
        (event.description ? event.description + '\n\n' : '') +
        `📅 ${dateStr}${timeStr}` +
        (event.location ? `\n📍 ${event.location}` : '') +
        (event.address ? ` — ${event.address}` : '') +
        (event.ticket_price != null ? `\n🎫 Biglietto: € ${event.ticket_price.toFixed(2)}` : '') +
        (event.ticket_url ? `\n🔗 ${event.ticket_url}` : '')
      )
      loadTeams()
    }
  }, [open, event])

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name, color').order('name')
    setAvailableTeams((data ?? []) as any)
  }

  const toggleAudience = (key: string) => {
    // 'all' esclusivo — se cliccato, disabilita gli altri; se cliccato altro, disabilita 'all'
    if (key === 'all') { setAudience(['all']); setTeamIds([]); return }
    setAudience(prev => {
      const withoutAll = prev.filter(x => x !== 'all')
      return withoutAll.includes(key) ? withoutAll.filter(x => x !== key) : [...withoutAll, key]
    })
  }

  const toggleTeam = (id: string) => {
    setTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const canSubmit = event
    && audience.length > 0
    && (publishCalendar || sendAnnouncement)
    && (!audience.includes('team') || teamIds.length > 0)

  const handlePublish = async () => {
    if (!event || !canSubmit) return
    setSaving(true)

    let announcementId: string | null = event.published_announcement_id

    // 1. Se richiesto: crea un annuncio (o aggiornalo se già esistente)
    if (sendAnnouncement) {
      const audKeys = audience.filter(a => a !== 'team')
      // Per gli annunci, mappo la prima audience non-team; se solo 'team', usa 'team'
      const annAudience = audKeys[0] || 'team'
      const payload: any = {
        title: announcementTitle.trim() || event.title,
        body: announcementBody.trim(),
        audience: annAudience,
        status: 'published',
        target_team_id: annAudience === 'team' ? (teamIds[0] || null) : null,
      }
      if (announcementId) {
        await supabase.from('announcements').update(payload).eq('id', announcementId)
      } else {
        const { data, error } = await supabase.from('announcements').insert({
          ...payload, author_id: profile?.id,
        }).select('id').single()
        if (!error && data) announcementId = data.id
      }
    }

    // 2. Aggiorna evento marketing con stato pubblicazione
    const { error } = await supabase.from('marketing_events').update({
      is_published_calendar: publishCalendar,
      calendar_audience: audience,
      calendar_team_ids: audience.includes('team') ? teamIds : null,
      published_at: new Date().toISOString(),
      published_by: profile?.id,
      published_announcement_id: announcementId,
    }).eq('id', event.id)

    setSaving(false)
    if (error) { alert('Errore pubblicazione: ' + error.message); return }
    onPublished()
    onClose()
  }

  const handleUnpublish = async () => {
    if (!event || !confirm('Rimuovere la pubblicazione dell\'evento dal calendario condiviso?')) return
    setSaving(true)
    // Rimuovi annuncio collegato se presente
    if (event.published_announcement_id) {
      await supabase.from('announcements').delete().eq('id', event.published_announcement_id)
    }
    const { error } = await supabase.from('marketing_events').update({
      is_published_calendar: false,
      calendar_audience: null,
      calendar_team_ids: null,
      published_announcement_id: null,
    }).eq('id', event.id)
    setSaving(false)
    if (error) { alert('Errore: ' + error.message); return }
    onPublished()
    onClose()
  }

  if (!event) return null
  const isAlreadyPublished = event.is_published_calendar

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAlreadyPublished ? 'Modifica pubblicazione' : 'Pubblica evento'}
      maxHeight="95vh"
    >
      <div style={{ padding: '4px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Riepilogo evento */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: CATEGORY_META[event.category].bg,
          borderLeft: `4px solid ${CATEGORY_META[event.category].color}`,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: CATEGORY_META[event.category].color, textTransform: 'uppercase' }}>
            {CATEGORY_META[event.category].emoji} {CATEGORY_META[event.category].label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', marginTop: 2 }}>
            {event.title}
          </div>
          <div style={{ fontSize: 11.5, color: '#404751', marginTop: 3 }}>
            {new Date(event.event_date).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {event.start_time && ` · ${event.start_time.slice(0, 5)}`}
            {event.location && ` · ${event.location}`}
          </div>
        </div>

        {/* Stato attuale se già pubblicato */}
        {isAlreadyPublished && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, background: 'rgba(128,249,139,0.20)',
            fontSize: 12, color: '#006e25', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="check_circle" size={14} color="#006e25" />
            Evento già pubblicato — puoi aggiornare audience o canali
          </div>
        )}

        {/* Canali di pubblicazione */}
        <SectionLabel icon="output" text="Canali di pubblicazione" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ChannelToggle
            active={publishCalendar}
            onToggle={() => setPublishCalendar(!publishCalendar)}
            icon="calendar_month" title="Aggiungi al calendario condiviso"
            desc="Comparirà nel Calendario del club per gli utenti target"
          />
          <ChannelToggle
            active={sendAnnouncement}
            onToggle={() => setSendAnnouncement(!sendAnnouncement)}
            icon="campaign" title="Invia comunicazione in Bacheca"
            desc="Crea un annuncio pubblicato visibile agli utenti target"
          />
        </div>

        {/* Editor testo annuncio se attivato */}
        {sendAnnouncement && (
          <>
            <SectionLabel icon="edit_note" text="Testo comunicazione" />
            <input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)}
              style={inputStyle} placeholder="Titolo annuncio" />
            <textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)}
              style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
              placeholder="Testo dell'annuncio" />
          </>
        )}

        {/* Audience */}
        <SectionLabel icon="groups" text="Destinatari" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {AUDIENCE_OPTS.map(a => {
            const active = audience.includes(a.key)
            return (
              <button key={a.key} onClick={() => toggleAudience(a.key)}
                style={{
                  padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: active ? '#7a0071' : '#f7f9ff',
                  color: active ? '#fff' : '#181c20',
                  display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name={a.icon} size={14} color={active ? '#fff' : '#7a0071'} />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{a.label}</span>
                  {active && <Icon name="check_circle" size={12} color="#ffd100" />}
                </div>
                <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.85)' : '#707882', lineHeight: 1.3 }}>
                  {a.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selezione squadre se audience include team */}
        {audience.includes('team') && availableTeams.length > 0 && (
          <>
            <SectionLabel icon="shield" text="Squadre destinatarie" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {availableTeams.map(t => {
                const active = teamIds.includes(t.id)
                return (
                  <button key={t.id} onClick={() => toggleTeam(t.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: active ? (t.color || '#005f98') : '#e6e8ee',
                      color: active ? '#fff' : '#404751',
                      fontSize: 11.5, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                    {active && <Icon name="check" size={10} color="#fff" />}
                    {t.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {isAlreadyPublished && (
            <button onClick={handleUnpublish} disabled={saving}
              style={{
                padding: '10px 14px', borderRadius: 10, border: 'none',
                background: '#ffdad6', color: '#93000a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5,
              }}>
              <Icon name="unpublished" size={14} color="#93000a" />
              Rimuovi pubblicazione
            </button>
          )}
          <button onClick={handlePublish} disabled={!canSubmit || saving}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
              background: canSubmit ? '#7a0071' : '#c0c7d2',
              color: '#fff', fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: 14, opacity: saving ? 0.6 : 1,
              boxShadow: canSubmit ? '0 6px 16px rgba(122,0,113,0.30)' : 'none',
            }}>
            {saving
              ? 'Pubblicazione…'
              : isAlreadyPublished
                ? 'Aggiorna pubblicazione'
                : 'Approva e pubblica'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, color: '#5a6270', textTransform: 'uppercase',
      letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <Icon name={icon} size={12} color="#5a6270" /> {text}
    </div>
  )
}

function ChannelToggle({ active, onToggle, icon, title, desc }: {
  active: boolean; onToggle: () => void; icon: string; title: string; desc: string;
}) {
  return (
    <button onClick={onToggle}
      style={{
        padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? 'rgba(122,0,113,0.10)' : '#f7f9ff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: active ? '#7a0071' : '#c0c7d2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={16} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>{desc}</div>
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 999,
        background: active ? '#7a0071' : '#c0c7d2',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: active ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
        }} />
      </div>
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '1px solid #c0c7d2', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff',
}
