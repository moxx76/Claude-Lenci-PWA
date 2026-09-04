import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  event: {
    kind: 'training' | 'match'
    id: string
    date: string
    time: string | null
    location: string | null
    opponent?: string | null
    home_or_away?: string | null
    team?: { id: string; name: string; color: string | null } | null
  } | null
  child: { id: string; first_name: string; last_name: string } | null
  onSaved?: () => void
}

type Status = 'yes' | 'no' | 'maybe' | null

const STATUS_LABELS: Record<Exclude<Status, null>, string> = {
  yes: 'Ci sarò',
  no: 'Non ci sarò',
  maybe: 'Ancora non lo so',
}

const STATUS_COLORS: Record<Exclude<Status, null>, { bg: string; text: string; border: string }> = {
  yes: { bg: '#006e25', text: '#fff', border: '#006e25' },
  no: { bg: '#ba1a1a', text: '#fff', border: '#ba1a1a' },
  maybe: { bg: '#8e6300', text: '#fff', border: '#8e6300' },
}

export function ParentAttendanceSheet({ open, onClose, event, child, onSaved }: Props) {
  const [currentStatus, setCurrentStatus] = useState<Status>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !event || !child) return
    loadCurrent()
  }, [open, event?.id, child?.id])

  const loadCurrent = async () => {
    if (!event || !child) return
    setLoading(true)
    const { data } = await supabase.from('event_responses')
      .select('status, updated_at')
      .eq('event_kind', event.kind)
      .eq('event_id', event.id)
      .eq('player_id', child.id)
      .maybeSingle()
    setCurrentStatus((data?.status as Status) || null)
    setUpdatedAt(data?.updated_at || null)
    setLoading(false)
  }

  const saveResponse = async (status: Exclude<Status, null>) => {
    if (!event || !child) return
    setSaving(true)
    const { error } = await supabase.from('event_responses').upsert({
      event_kind: event.kind,
      event_id: event.id,
      event_date: event.date,
      player_id: child.id,
      status,
    }, { onConflict: 'event_kind,event_id,player_id' })
    setSaving(false)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setCurrentStatus(status)
    setUpdatedAt(new Date().toISOString())
    onSaved?.()
  }

  const clearResponse = async () => {
    if (!event || !child) return
    if (!confirm('Vuoi rimuovere la risposta?')) return
    setSaving(true)
    const { error } = await supabase.from('event_responses').delete()
      .eq('event_kind', event.kind)
      .eq('event_id', event.id)
      .eq('player_id', child.id)
    setSaving(false)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setCurrentStatus(null)
    setUpdatedAt(null)
    onSaved?.()
  }

  if (!event || !child) return null

  const dt = new Date(event.date + 'T' + (event.time || '00:00'))
  const dayLabel = dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = event.time ? event.time.slice(0, 5) : null
  const isMatch = event.kind === 'match'
  const title = isMatch
    ? (event.team?.name ? `${event.team.name} vs ${event.opponent || '?'}` : `Partita vs ${event.opponent || '?'}`)
    : `Allenamento ${event.team?.name || ''}`
  const opponentDetail = isMatch && event.opponent
    ? (event.home_or_away === 'home' || event.home_or_away === 'H' ? 'In casa' : 'Trasferta')
    : null

  return (
    <BottomSheet open={open} onClose={onClose} title="Presenza" maxHeight="80vh">
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Blocco evento */}
        <div style={{
          background: isMatch ? '#ffdad6' : '#cfe5ff',
          borderRadius: 14, padding: 14, marginBottom: 14,
          borderLeft: `4px solid ${isMatch ? '#ba1a1a' : '#005f98'}`,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: isMatch ? '#93000a' : '#003c5e', marginBottom: 4,
          }}>
            {isMatch ? '⚽ Partita' : '🏃 Allenamento'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#181c20', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#404751', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span>📅 {dayLabel}</span>
            {timeLabel && <span>🕐 {timeLabel}</span>}
            {event.location && <span>📍 {event.location}</span>}
            {opponentDetail && <span style={{ fontWeight: 700 }}>{opponentDetail}</span>}
          </div>
        </div>

        {/* Nome figlio */}
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f7f9ff', borderRadius: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5a6270', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Presenza di
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#181c20', marginTop: 2 }}>
            {child.first_name} {child.last_name}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Caricamento…
          </div>
        ) : (
          <>
            {/* Bottoni risposta */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#5a6270', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Cosa rispondi?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['yes', 'no', 'maybe'] as const).map(s => {
                const active = currentStatus === s
                const colors = STATUS_COLORS[s]
                return (
                  <button
                    key={s}
                    onClick={() => saveResponse(s)}
                    disabled={saving}
                    style={{
                      padding: '14px 16px', borderRadius: 12,
                      border: `2px solid ${active ? colors.border : '#e6e8ee'}`,
                      background: active ? colors.bg : '#fff',
                      color: active ? colors.text : '#181c20',
                      fontSize: 15, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.15s',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>
                      {s === 'yes' ? '✅' : s === 'no' ? '❌' : '❓'}
                    </span>
                    <span style={{ flex: 1 }}>{STATUS_LABELS[s]}</span>
                    {active && <Icon name="check_circle" size={20} color={colors.text} />}
                  </button>
                )
              })}
            </div>

            {/* Stato attuale + rimozione */}
            {currentStatus && updatedAt && (
              <div style={{
                marginTop: 14, padding: '10px 12px', background: '#f7f9ff', borderRadius: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 11, color: '#5a6270' }}>
                  Ultima modifica: {new Date(updatedAt).toLocaleString('it-IT', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <button
                  onClick={clearResponse}
                  disabled={saving}
                  style={{
                    background: 'transparent', border: 'none', color: '#ba1a1a',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <Icon name="delete" size={13} color="#ba1a1a" />
                  Rimuovi
                </button>
              </div>
            )}

            <p style={{
              fontSize: 10.5, color: '#a0a7b0', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5,
            }}>
              Puoi cambiare la risposta in qualsiasi momento fino all'evento.<br />
              Il mister vedrà queste indicazioni per organizzare l'allenamento.
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
