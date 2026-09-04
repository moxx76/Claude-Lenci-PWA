import { useState, useMemo, useEffect } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { avatarBg } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { StaffAttendanceSection } from './StaffAttendanceSection'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null

export interface AttendancePlayer {
  id: string
  firstName: string
  lastName: string
  position?: string | null
}

interface AttendanceSheetProps {
  open: boolean
  onClose: () => void
  eventTitle: string
  eventDate: string
  eventTime: string
  players: AttendancePlayer[]
  trainingId?: string | null  // id del training reale su cui salvare
  onSaved?: () => void
}

const STATUS_STYLE = {
  present: { bg: 'rgba(128,249,139,0.35)', color: '#006e25', icon: 'check_circle', label: 'Presente' },
  absent:  { bg: '#ffdad6', color: '#93000a', icon: 'cancel', label: 'Assente' },
  late:    { bg: 'rgba(255,209,0,0.30)', color: '#8e6300', icon: 'schedule', label: 'Ritardo' },
  excused: { bg: '#cfe5ff', color: '#004a78', icon: 'medical_services', label: 'Giustificato' },
} as const

export function AttendanceSheet({
  open, onClose, eventTitle, eventDate, eventTime, players, trainingId, onSaved,
}: AttendanceSheetProps) {
  const { profile } = useAuth()
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Carica presenze esistenti quando si apre
  useEffect(() => {
    if (!open || !trainingId) {
      setAttendance({})
      setSavedOk(false)
      return
    }
    loadAttendance()
  }, [open, trainingId])

  const loadAttendance = async () => {
    if (!trainingId) return
    setLoading(true)
    const { data } = await supabase
      .from('attendances')
      .select('player_id, status')
      .eq('training_id', trainingId)
    const map: Record<string, AttendanceStatus> = {}
    for (const a of data ?? []) {
      map[a.player_id] = a.status as AttendanceStatus
    }
    setAttendance(map)
    setLoading(false)
  }

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, missing: 0 }
    for (const p of players) {
      const s = attendance[p.id]
      if (s) c[s]++
      else c.missing++
    }
    return c
  }, [attendance, players])

  const setStatus = (playerId: string, status: AttendanceStatus) => {
    setAttendance(a => ({ ...a, [playerId]: a[playerId] === status ? null : status }))
    setSavedOk(false)
  }

  const markAllPresent = () => {
    const all: Record<string, AttendanceStatus> = {}
    for (const p of players) all[p.id] = 'present'
    setAttendance(all)
    setSavedOk(false)
  }

  const handleSave = async () => {
    if (!trainingId) {
      alert('Impossibile salvare: nessun allenamento associato a questo evento (le partite usano le convocazioni).')
      return
    }
    setSaving(true)
    try {
      // 1. Cancello tutte le presenze pregresse per questo training
      await supabase.from('attendances').delete().eq('training_id', trainingId)
      // 2. Inserisco quelle nuove (solo per giocatori con status non-null)
      const rows = Object.entries(attendance)
        .filter(([, status]) => status !== null)
        .map(([playerId, status]) => ({
          training_id: trainingId,
          player_id: playerId,
          status,
        }))
      if (rows.length > 0) {
        const { error } = await supabase.from('attendances').insert(rows)
        if (error) throw error
      }
      setSavedOk(true)
      onSaved?.()
      // Chiudi dopo un breve delay per mostrare feedback
      setTimeout(() => { setSavedOk(false); onClose() }, 900)
    } catch (e: any) {
      alert('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  const canSave = !!trainingId

  return (
    <BottomSheet open={open} onClose={onClose} title="Segna presenze">
      <div style={{ padding: '4px 20px 24px' }}>
        {/* Event header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #005f98 0%, #0078bf 100%)',
            color: '#fff',
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, margin: 0 }}>
            {eventTitle}
          </h3>
          <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.9 }}>
            {eventDate} • {eventTime}
          </p>
          {!canSave && (
            <p style={{ fontSize: 11, margin: '8px 0 0', opacity: 0.85, background: 'rgba(255,255,255,0.15)', padding: '6px 10px', borderRadius: 6 }}>
              ⚠️ Per le partite usa la sezione "Convocazioni" (in arrivo).
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#707882', fontSize: 13 }}>
            Caricamento presenze...
          </div>
        ) : (
          <>
            {/* Riepilogo + azione veloce */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
                <StatusCount label="Presenti" count={counts.present} color="#006e25" />
                <StatusCount label="Assenti" count={counts.absent} color="#93000a" />
                {counts.late > 0 && <StatusCount label="Ritardi" count={counts.late} color="#8e6300" />}
                {counts.excused > 0 && <StatusCount label="Giust." count={counts.excused} color="#004a78" />}
                {counts.missing > 0 && <StatusCount label="Da segnare" count={counts.missing} color="#707882" />}
              </div>
              <button
                onClick={markAllPresent}
                style={{
                  padding: '6px 12px', borderRadius: 999, border: '1px solid #006e25',
                  background: 'rgba(128,249,139,0.15)', color: '#006e25',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}
              >
                <Icon name="done_all" size={13} color="#006e25" />
                Tutti presenti
              </button>
            </div>

            {/* Lista giocatori */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {players.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
                  Nessun giocatore in rosa. Aggiungi giocatori alla squadra prima di segnare le presenze.
                </div>
              ) : (
                players.map(p => {
                  const initials = `${p.firstName[0] || ''}${p.lastName[0] || ''}`.toUpperCase()
                  const current = attendance[p.id]
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        background: '#fff',
                        borderRadius: 12,
                        border: '1px solid #e6e8ee',
                      }}
                    >
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: avatarBg(initials),
                          color: '#fff', fontWeight: 800, fontSize: 12,
                          fontFamily: 'Anybody',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20', lineHeight: 1.2 }}>
                          {p.firstName} {p.lastName}
                        </p>
                        {p.position && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>{p.position}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['present', 'absent', 'late', 'excused'] as const).map(s => {
                          const st = STATUS_STYLE[s]
                          const isActive = current === s
                          return (
                            <button
                              key={s}
                              onClick={() => setStatus(p.id, s)}
                              title={st.label}
                              aria-label={st.label}
                              style={{
                                width: 32, height: 32, borderRadius: 8,
                                border: 'none',
                                background: isActive ? st.color : st.bg,
                                color: isActive ? '#fff' : st.color,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: isActive || !current ? 1 : 0.4,
                                transition: 'all 0.15s',
                              }}
                            >
                              <Icon name={st.icon} size={16} color={isActive ? '#fff' : st.color} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Presenze staff (mister + dirigenti della squadra) */}
            {trainingId && (
              <StaffAttendanceSection eventKind="training" eventId={trainingId} />
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || players.length === 0 || !canSave}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none',
                background: savedOk ? '#006e25' : '#005f98', color: '#fff',
                fontSize: 14, fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed',
                boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: (saving || players.length === 0 || !canSave) ? 0.6 : 1,
                transition: 'background 0.2s',
              }}
            >
              <Icon name={savedOk ? 'check_circle' : 'save'} size={17} color="#fff" />
              {savedOk ? 'Salvato!' : (saving ? 'Salvataggio…' : 'Salva presenze')}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function StatusCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color, fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 18, height: 18, borderRadius: '50%',
          background: color, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
        }}
      >
        {count}
      </span>
      {label}
    </span>
  )
}
