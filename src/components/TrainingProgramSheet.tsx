import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { SESSION_PART_META, type TrainingExercise } from '../hooks/useExerciseCatalog'
import { TrainingAttachmentsSection } from './TrainingAttachmentsSection'

interface Props {
  open: boolean
  onClose: () => void
  trainingId: string | null
  title: string
  dateLabel: string
  location: string | null
  focus: string | null
  program: string | null
  notes: string | null
}

interface SessionExerciseRow {
  id: string
  order_num: number
  custom_notes: string | null
  duration_override: number | null
  exercise: TrainingExercise | null
}

export function TrainingProgramSheet({ open, onClose, trainingId, title, dateLabel, location, focus, program, notes }: Props) {
  const [exercises, setExercises] = useState<SessionExerciseRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !trainingId) {
      setExercises([])
      return
    }
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.from('training_session_exercises')
          .select('id, order_num, custom_notes, duration_override, exercise:training_exercises(*)')
          .eq('training_id', trainingId)
          .order('order_num')
        if (error) throw error
        if (!alive) return
        const rows = (data ?? []) as any[]
        setExercises(rows.map(r => ({
          ...r,
          exercise: Array.isArray(r.exercise) ? r.exercise[0] : r.exercise,
        })) as SessionExerciseRow[])
      } catch {
        if (alive) setExercises([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open, trainingId])

  const totalMin = exercises.reduce((s, r) => s + (r.duration_override ?? r.exercise?.duration_min ?? 0), 0)
  const hasComposedProgram = exercises.length > 0
  const hasFreeProgram = !!program

  return (
    <BottomSheet open={open} onClose={onClose} title="Programma allenamento">
      <div style={{ padding: '4px 20px 24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #005f98, #003c5e)',
          color: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="fitness_center" size={16} color="#fff" />
            <div style={{ fontSize: 10.5, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Allenamento
            </div>
          </div>
          <div style={{ fontFamily: 'Anybody', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>{dateLabel}</div>
          {location && (
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="location_on" size={12} color="#fff" />
              {location}
            </div>
          )}
        </div>

        {focus && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: '#c1006c',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
            }}>
              Focus della seduta
            </div>
            <div style={{
              background: '#fff', border: '1px solid #ffdae7',
              padding: '10px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 700, color: '#181c20',
            }}>
              {focus}
            </div>
          </div>
        )}

        {hasComposedProgram && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: '#005f98',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="playlist_add_check" size={12} color="#005f98" />
              Programma della seduta · {exercises.length} esercizi · {totalMin} min
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {exercises.map((row, i) => {
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
                        ⏱ {durataMin} min
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
          </div>
        )}

        {hasFreeProgram && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: '#005f98',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="format_list_bulleted" size={12} color="#005f98" />
              {hasComposedProgram ? 'Note aggiuntive al programma' : 'Programma dettagliato'}
            </div>
            <div style={{
              background: '#fff', border: '1px solid #d5e5ff',
              padding: 14, borderRadius: 12,
              fontSize: 13, color: '#181c20', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', fontFamily: 'inherit',
            }}>
              {program}
            </div>
          </div>
        )}

        {!hasComposedProgram && !hasFreeProgram && !focus && !loading && (
          <div style={{
            background: '#f1f3fa', padding: 20, borderRadius: 12,
            textAlign: 'center', color: '#707882', fontSize: 12.5, lineHeight: 1.5,
          }}>
            <Icon name="info" size={16} color="#707882" />
            <div style={{ marginTop: 4 }}>
              L'allenatore non ha ancora pubblicato il programma per questa seduta.
            </div>
          </div>
        )}

        {loading && !hasComposedProgram && (
          <div style={{ padding: 16, textAlign: 'center', color: '#707882', fontSize: 12 }}>
            Carico il programma…
          </div>
        )}

        {notes && (
          <div style={{ marginBottom: 4, marginTop: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: '#707882',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
            }}>
              Note
            </div>
            <div style={{
              background: '#fff', border: '1px solid #d5dae2',
              padding: '10px 12px', borderRadius: 10,
              fontSize: 12, color: '#404751', lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {notes}
            </div>
          </div>
        )}

        {/* Allegati (readonly per chi apre da qui — genitori/atleti) */}
        <div style={{ marginTop: 14 }}>
          <TrainingAttachmentsSection trainingId={trainingId} canEdit={false} />
        </div>
      </div>
    </BottomSheet>
  )
}
