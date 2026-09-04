import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { SESSION_PART_META, type TrainingExercise } from '../hooks/useExerciseCatalog'
import { TrainingAttachmentsSection } from './TrainingAttachmentsSection'

interface SessionExerciseRow {
  id: string
  order_num: number
  custom_notes: string | null
  duration_override: number | null
  exercise: TrainingExercise | null
}

interface Props {
  open: boolean
  onClose: () => void
  trainingId: string | null
  teamName: string
  teamColor: string | null
  /** Callback per aprire la modifica evento */
  onEdit?: (trainingId: string) => void
  /** Callback per aprire la gestione presenze */
  onManageAttendance?: (trainingId: string) => void
  /** True se l'utente ha i permessi per modificare */
  canEdit?: boolean
}

interface TrainingRow {
  id: string
  team_id: string
  training_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  focus: string | null
  notes: string | null
  program: string | null
  session_number: number | null
  zona_sviluppo: string | null
  obiettivo_tecnico: string | null
  obiettivo_situazionale: string | null
  principi_gioco: string | null
  sotto_principi_gioco: string | null
  annotazioni: string | null
  staff_allenatore: string | null
  staff_collaboratore: string | null
  staff_prep_portieri: string | null
  staff_prep_coordinativo: string | null
  staff_medico: string | null
}

interface AttendanceRow {
  status: 'present' | 'absent' | 'late' | 'excused'
  player: { id: string; first_name: string; last_name: string; jersey_number: number | null } | null
}

const STATUS_META: Record<AttendanceRow['status'], { label: string; color: string; bg: string; icon: string }> = {
  present:  { label: 'Presenti',      color: '#006e25', bg: '#dcf1e2', icon: '✓' },
  late:     { label: 'In ritardo',    color: '#7c4700', bg: '#fff4e6', icon: '⏱' },
  excused:  { label: 'Giustificati',  color: '#005f98', bg: '#e0f0ff', icon: '≈' },
  absent:   { label: 'Assenti',       color: '#93000a', bg: '#ffe4e4', icon: '✕' },
}

export function TrainingDetailSheet({ open, onClose, trainingId, teamName, teamColor, onEdit, onManageAttendance, canEdit }: Props) {
  const [training, setTraining] = useState<TrainingRow | null>(null)
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !trainingId) return
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [tRes, aRes, sRes] = await Promise.all([
          supabase.from('trainings').select('*').eq('id', trainingId).maybeSingle(),
          supabase.from('attendances')
            .select('status, player:players(id, first_name, last_name, jersey_number)')
            .eq('training_id', trainingId),
          supabase.from('training_session_exercises')
            .select('id, order_num, custom_notes, duration_override, exercise:training_exercises(*)')
            .eq('training_id', trainingId)
            .order('order_num'),
        ])
        if (tRes.error) throw tRes.error
        if (!alive) return
        setTraining(tRes.data as TrainingRow | null)
        setAttendances((aRes.data ?? []) as unknown as AttendanceRow[])
        const rows = (sRes.data ?? []) as any[]
        setSessionExercises(rows.map(r => ({
          ...r,
          exercise: Array.isArray(r.exercise) ? r.exercise[0] : r.exercise,
        })) as SessionExerciseRow[])
      } catch (e: unknown) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open, trainingId])

  const formatDate = (d: string): string => {
    const [y, m, day] = d.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(day))
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  // Raggruppa presenze per status
  const grouped: Record<AttendanceRow['status'], AttendanceRow[]> = {
    present: [], late: [], excused: [], absent: [],
  }
  for (const a of attendances) {
    if (grouped[a.status]) grouped[a.status].push(a)
  }
  const totale = attendances.length
  const presenti = grouped.present.length + grouped.late.length
  const pctPresenti = totale > 0 ? Math.round((presenti / totale) * 100) : null

  // Ha almeno un obiettivo o programma?
  const hasContent = training && (
    training.focus || training.program || training.notes || training.zona_sviluppo ||
    training.obiettivo_tecnico || training.obiettivo_situazionale || training.principi_gioco ||
    training.sotto_principi_gioco || training.annotazioni
  )
  // Ha staff diverso da default?
  const hasStaff = training && (
    training.staff_allenatore || training.staff_collaboratore ||
    training.staff_prep_portieri || training.staff_prep_coordinativo || training.staff_medico
  )

  return (
    <BottomSheet open={open} onClose={onClose} title="Dettaglio allenamento" maxHeight="94vh">
      <div style={{ padding: '4px 14px 30px' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Carico i dettagli…
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, fontSize: 12 }}>
            ⚠ Errore: {error}
          </div>
        )}

        {!loading && !error && training && (
          <>
            {/* Header data + squadra */}
            <div style={{
              background: `linear-gradient(135deg, ${teamColor || '#005f98'} 0%, #003c5e 100%)`,
              borderRadius: 14, padding: '12px 14px', color: '#fff', marginBottom: 14,
            }}>
              <div style={{ fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginBottom: 4 }}>
                🏋️ Allenamento · {teamName}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, textTransform: 'capitalize' }}>
                {cap(formatDate(training.training_date))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12.5, opacity: 0.95, flexWrap: 'wrap' }}>
                {training.start_time && (
                  <span>⏰ {training.start_time.slice(0, 5)}{training.end_time ? `–${training.end_time.slice(0, 5)}` : ''}</span>
                )}
                {training.location && <span>📍 {training.location}</span>}
                {training.session_number != null && <span>N° seduta: {training.session_number}</span>}
              </div>
            </div>

            {/* Presenze - riepilogo con conteggi */}
            {totale > 0 ? (
              <>
                <SectionTitle icon="how_to_reg" text="Presenze registrate" />

                <div style={{
                  padding: '12px 14px', background: '#f9fafb', borderRadius: 12,
                  marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#181c20', lineHeight: 1 }}>
                      {presenti}<span style={{ fontSize: 15, color: '#707882', fontWeight: 700 }}>/{totale}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>partecipanti effettivi</div>
                  </div>
                  {pctPresenti !== null && (
                    <div style={{
                      fontSize: 22, fontWeight: 900,
                      color: pctPresenti >= 70 ? '#006e25' : pctPresenti >= 50 ? '#a15c00' : '#c73434',
                    }}>
                      {pctPresenti}%
                    </div>
                  )}
                </div>

                {/* Sezioni per status */}
                {(['present', 'late', 'excused', 'absent'] as const).map(status => {
                  const list = grouped[status]
                  if (list.length === 0) return null
                  const meta = STATUS_META[status]
                  return (
                    <div key={status} style={{ marginBottom: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                        fontSize: 11.5, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.3,
                      }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: '50%', background: meta.bg, color: meta.color, fontWeight: 900,
                        }}>{meta.icon}</span>
                        {meta.label} ({list.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {list.map((a, i) => a.player && (
                          <span key={a.player.id || i} style={{
                            fontSize: 11.5, padding: '4px 9px', borderRadius: 999,
                            background: meta.bg, color: meta.color, fontWeight: 600,
                          }}>
                            {a.player.jersey_number != null && (
                              <b style={{ marginRight: 4 }}>#{a.player.jersey_number}</b>
                            )}
                            {a.player.last_name.toUpperCase()} {a.player.first_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div style={{
                padding: 14, background: '#fff4e6', color: '#7c4700', borderRadius: 10,
                fontSize: 12, fontWeight: 600, marginBottom: 12, textAlign: 'center',
              }}>
                ⚠ Nessuna presenza registrata per questo allenamento
              </div>
            )}

            {/* Contenuto seduta (focus, obiettivi, programma) */}
            {hasContent && (
              <>
                <SectionTitle icon="assignment" text="Contenuto della seduta" />
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {training.focus && <InfoRow label="Focus" value={training.focus} />}
                  {training.zona_sviluppo && <InfoRow label="Zona di sviluppo" value={training.zona_sviluppo} />}
                  {training.obiettivo_tecnico && <InfoRow label="Obiettivo tecnico" value={training.obiettivo_tecnico} />}
                  {training.obiettivo_situazionale && <InfoRow label="Obiettivo situazionale" value={training.obiettivo_situazionale} />}
                  {training.principi_gioco && <InfoRow label="Principi di gioco" value={training.principi_gioco} />}
                  {training.sotto_principi_gioco && <InfoRow label="Sotto principi di gioco" value={training.sotto_principi_gioco} />}
                  {training.program && <InfoRow label="Programma" value={training.program} />}
                  {training.annotazioni && <InfoRow label="Annotazioni" value={training.annotazioni} />}
                  {training.notes && <InfoRow label="Note" value={training.notes} />}
                </div>
              </>
            )}

            {/* Staff */}
            {hasStaff && (
              <>
                <SectionTitle icon="group" text="Staff seduta" />
                <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                  {training.staff_allenatore && <StaffRow role="Allenatore" name={training.staff_allenatore} />}
                  {training.staff_collaboratore && <StaffRow role="Collaboratore" name={training.staff_collaboratore} />}
                  {training.staff_prep_portieri && <StaffRow role="Prep. portieri" name={training.staff_prep_portieri} />}
                  {training.staff_prep_coordinativo && <StaffRow role="Prep. coordinativo" name={training.staff_prep_coordinativo} />}
                  {training.staff_medico && <StaffRow role="Medico" name={training.staff_medico} />}
                </div>
              </>
            )}

            {/* Programma della seduta (esercizi dal composer) */}
            {sessionExercises.length > 0 && (
              <>
                <SectionTitle
                  icon="playlist_add_check"
                  text={`Programma della seduta (${sessionExercises.length} esercizi · ${
                    sessionExercises.reduce((sum, r) => sum + (r.duration_override ?? r.exercise?.duration_min ?? 0), 0)
                  } min)`}
                />
                <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                  {sessionExercises.map((row, i) => {
                    const ex = row.exercise
                    const partMeta = ex ? SESSION_PART_META[ex.session_part] : null
                    const durataMin = row.duration_override ?? ex?.duration_min ?? 0
                    return (
                      <div key={row.id} style={{
                        background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12,
                        padding: '11px 13px',
                        borderLeft: `4px solid ${partMeta?.fg || '#c0c7d2'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: 999,
                            background: '#404751', color: '#fff',
                            fontSize: 11, fontWeight: 900,
                          }}>{i + 1}</span>
                          {partMeta && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 8px', borderRadius: 999,
                              background: partMeta.bg, color: partMeta.fg,
                              fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
                            }}>
                              <Icon name={partMeta.icon} size={11} color={partMeta.fg} />
                              {partMeta.short}
                            </span>
                          )}
                          <span style={{ fontSize: 10.5, color: '#707882', fontWeight: 700 }}>
                            ⏱ {durataMin}'
                          </span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#181c20', lineHeight: 1.35 }}>
                          {ex?.name || '(esercizio non disponibile)'}
                        </div>
                        {ex?.description && (
                          <div style={{ fontSize: 12, color: '#404751', lineHeight: 1.45, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                            {ex.description}
                          </div>
                        )}
                        {(ex?.area_size || ex?.materials) && (
                          <div style={{ fontSize: 11, color: '#707882', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {ex.area_size && <span>📐 {ex.area_size}</span>}
                            {ex.materials && <span>🎽 {ex.materials}</span>}
                          </div>
                        )}
                        {row.custom_notes && (
                          <div style={{
                            marginTop: 6, padding: '6px 9px', background: '#fff8e6',
                            borderRadius: 6, fontSize: 11, color: '#7c4700', fontStyle: 'italic',
                          }}>
                            📝 {row.custom_notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Allegati (foto + PDF) — canEdit determina se si può caricare/eliminare */}
            <div style={{ marginTop: 14 }}>
              <TrainingAttachmentsSection trainingId={training.id} canEdit={!!canEdit} />
            </div>

            {/* Bottoni azione */}
            <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
              {canEdit && onManageAttendance && (
                <button
                  onClick={() => onManageAttendance(training.id)}
                  style={{
                    padding: '12px', borderRadius: 12, border: 'none',
                    background: '#005f98', color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,95,152,0.25)',
                  }}
                >
                  <Icon name="how_to_reg" size={16} color="#fff" />
                  {totale > 0 ? 'Modifica presenze' : 'Registra presenze'}
                </button>
              )}
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(training.id)}
                  style={{
                    padding: '11px', borderRadius: 12, border: '1px solid #005f98',
                    background: '#fff', color: '#005f98',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name="edit" size={15} color="#005f98" />
                  Modifica dettagli evento
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  padding: '11px', borderRadius: 12,
                  background: '#fff', border: '1px solid #c0c7d2', color: '#404751',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Chiudi
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function SectionTitle({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4,
      fontSize: 11, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      <Icon name={icon} size={14} color="#707882" />
      {text}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '10px 12px', background: '#f9fafb', borderRadius: 10,
      border: '1px solid #eef1f5',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#005f98', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: '#181c20', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
        {value}
      </div>
    </div>
  )
}

function StaffRow({ role, name }: { role: string; name: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', background: '#f9fafb', borderRadius: 8,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', background: '#005f98', color: '#fff',
        fontSize: 12, fontWeight: 900,
      }}>
        {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{role}</div>
        <div style={{ fontSize: 12.5, color: '#181c20', fontWeight: 600 }}>{name}</div>
      </div>
    </div>
  )
}
