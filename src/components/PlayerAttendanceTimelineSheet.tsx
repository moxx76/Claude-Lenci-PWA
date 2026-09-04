import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

interface TimelineRow {
  training_id: string
  training_date: string
  start_time: string | null
  location: string | null
  focus: string | null
  status: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  playerId: string | null
  playerName: string
  from: string
  to: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  present:  { label: 'Presente',    color: '#2e7d32', bg: 'rgba(67,160,71,0.15)',  icon: 'check_circle' },
  late:     { label: 'In ritardo',  color: '#8e6300', bg: 'rgba(249,168,37,0.15)', icon: 'schedule' },
  excused:  { label: 'Giustificato', color: '#005f98', bg: 'rgba(0,95,152,0.12)',  icon: 'event_available' },
  absent:   { label: 'Assente',     color: '#c62828', bg: 'rgba(198,40,40,0.15)',  icon: 'cancel' },
}

export function PlayerAttendanceTimelineSheet({ open, onClose, playerId, playerName, from, to }: Props) {
  const [rows, setRows] = useState<TimelineRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !playerId) return
    setLoading(true)
    supabase.rpc('player_attendance_timeline', {
      p_player_id: playerId, p_from: from, p_to: to,
    }).then(({ data, error }) => {
      if (error) console.error('timeline err:', error)
      setRows((data as TimelineRow[]) ?? [])
      setLoading(false)
    })
  }, [open, playerId, from, to])

  return (
    <BottomSheet open={open} onClose={onClose} title={`Dettaglio presenze · ${playerName}`}>
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 11, color: '#707882', margin: '0 0 12px' }}>
          Timeline degli allenamenti dal {fmtDate(from)} al {fmtDate(to)}
        </p>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13 }}>Carico…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
            Nessun allenamento in questo periodo.
          </div>
        )}

        {!loading && rows.map(r => {
          const meta = r.status ? STATUS_META[r.status] : null
          return (
            <div key={r.training_id} style={{
              display: 'flex', gap: 10, alignItems: 'center',
              background: '#fff', border: '1px solid #d5dae2',
              borderRadius: 10, padding: '10px 12px', marginBottom: 6,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: '#f1f3fa', color: '#181c20',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
                  {new Date(r.training_date).getDate()}
                </div>
                <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', color: '#707882' }}>
                  {MONTHS[new Date(r.training_date).getMonth()]}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#181c20' }}>
                  {DAYS[new Date(r.training_date).getDay()]} {r.start_time?.slice(0, 5) || ''}
                </div>
                {r.focus && (
                  <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.focus}
                  </div>
                )}
              </div>
              {meta ? (
                <span style={{
                  padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                  background: meta.bg, color: meta.color,
                  display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                }}>
                  <Icon name={meta.icon} size={11} color={meta.color} />
                  {meta.label}
                </span>
              ) : (
                <span style={{
                  padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                  background: '#f1f3fa', color: '#707882', flexShrink: 0,
                }}>Non firmato</span>
              )}
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}

const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
const DAYS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
