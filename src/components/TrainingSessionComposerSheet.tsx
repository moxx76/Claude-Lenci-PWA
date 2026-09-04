import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { TrainingExerciseCatalogSheet } from './TrainingExerciseCatalogSheet'
import { type TrainingExercise, SESSION_PART_META } from '../hooks/useExerciseCatalog'
import { PrincipioSelect, PRINCIPI_GIOCO, SOTTO_PRINCIPI_GIOCO } from './PrincipioSelect'

interface Props {
  open: boolean
  onClose: () => void
  trainingId: string
  trainingDate?: string
  teamName?: string
  teamAgeRange?: string
  onSaved?: () => void
}

interface SessionExerciseRow {
  /** id row in DB (null se nuovo) */
  id: string | null
  exercise_id: string
  exercise: TrainingExercise
  order_num: number
  custom_notes: string
  duration_override: number | null
}

interface TrainingMetadata {
  staff_allenatore: string
  staff_collaboratore: string
  staff_prep_portieri: string
  staff_prep_coordinativo: string
  staff_medico: string
  session_number: number | null
  zona_sviluppo: string
  obiettivo_tecnico: string
  obiettivo_situazionale: string
  principi_gioco: string
  sotto_principi_gioco: string
  annotazioni: string
}

const EMPTY_META: TrainingMetadata = {
  staff_allenatore: '',
  staff_collaboratore: '',
  staff_prep_portieri: '',
  staff_prep_coordinativo: '',
  staff_medico: '',
  session_number: null,
  zona_sviluppo: '',
  obiettivo_tecnico: '',
  obiettivo_situazionale: '',
  principi_gioco: '',
  sotto_principi_gioco: '',
  annotazioni: '',
}

export function TrainingSessionComposerSheet({
  open,
  onClose,
  trainingId,
  trainingDate,
  teamName,
  teamAgeRange,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<TrainingMetadata>(EMPTY_META)
  const [rows, setRows] = useState<SessionExerciseRow[]>([])
  const [showCatalog, setShowCatalog] = useState(false)

  // Carica dati esistenti
  useEffect(() => {
    if (!open || !trainingId) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        // Metadati seduta
        const { data: t, error: e1 } = await supabase
          .from('trainings')
          .select(
            'staff_allenatore, staff_collaboratore, staff_prep_portieri, staff_prep_coordinativo, staff_medico, session_number, zona_sviluppo, obiettivo_tecnico, obiettivo_situazionale, principi_gioco, sotto_principi_gioco, annotazioni'
          )
          .eq('id', trainingId)
          .single()
        if (e1) throw e1

        // Esercizi collegati
        const { data: sessionEx, error: e2 } = await supabase
          .from('training_session_exercises')
          .select('id, exercise_id, order_num, custom_notes, duration_override, exercise:training_exercises(*)')
          .eq('training_id', trainingId)
          .order('order_num', { ascending: true })
        if (e2) throw e2

        if (!alive) return

        setMeta({
          staff_allenatore: t?.staff_allenatore || '',
          staff_collaboratore: t?.staff_collaboratore || '',
          staff_prep_portieri: t?.staff_prep_portieri || '',
          staff_prep_coordinativo: t?.staff_prep_coordinativo || '',
          staff_medico: t?.staff_medico || '',
          session_number: t?.session_number || null,
          zona_sviluppo: t?.zona_sviluppo || '',
          obiettivo_tecnico: t?.obiettivo_tecnico || '',
          obiettivo_situazionale: t?.obiettivo_situazionale || '',
          principi_gioco: t?.principi_gioco || '',
          sotto_principi_gioco: t?.sotto_principi_gioco || '',
          annotazioni: t?.annotazioni || '',
        })
        setRows(
          (sessionEx || []).map((r: any) => ({
            id: r.id,
            exercise_id: r.exercise_id,
            exercise: r.exercise,
            order_num: r.order_num,
            custom_notes: r.custom_notes || '',
            duration_override: r.duration_override,
          }))
        )
        setError(null)
      } catch (e: any) {
        if (alive) setError(e.message || 'Errore caricamento')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, trainingId])

  const totalDuration = rows.reduce((sum, r) => sum + (r.duration_override || r.exercise.duration_min), 0)
  const durationTargetOk = totalDuration >= 80 && totalDuration <= 100
  const durationTargetWarn = totalDuration < 80 || totalDuration > 100

  const handleAddExercise = (ex: TrainingExercise) => {
    setRows(prev => [
      ...prev,
      {
        id: null,
        exercise_id: ex.id,
        exercise: ex,
        order_num: prev.length + 1,
        custom_notes: '',
        duration_override: null,
      },
    ])
    setShowCatalog(false)
  }

  const handleMove = (index: number, dir: 'up' | 'down') => {
    const newRows = [...rows]
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newRows.length) return
    ;[newRows[index], newRows[target]] = [newRows[target], newRows[index]]
    setRows(newRows.map((r, i) => ({ ...r, order_num: i + 1 })))
  }

  const handleRemove = (index: number) => {
    if (!confirm('Rimuovere questo esercizio dalla seduta?')) return
    setRows(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, order_num: i + 1 })))
  }

  const handleUpdateRow = (index: number, patch: Partial<SessionExerciseRow>) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // 1. Aggiorna metadati training
      const { error: eUpd } = await supabase
        .from('trainings')
        .update({
          staff_allenatore: meta.staff_allenatore || null,
          staff_collaboratore: meta.staff_collaboratore || null,
          staff_prep_portieri: meta.staff_prep_portieri || null,
          staff_prep_coordinativo: meta.staff_prep_coordinativo || null,
          staff_medico: meta.staff_medico || null,
          session_number: meta.session_number,
          zona_sviluppo: meta.zona_sviluppo || null,
          obiettivo_tecnico: meta.obiettivo_tecnico || null,
          obiettivo_situazionale: meta.obiettivo_situazionale || null,
          principi_gioco: meta.principi_gioco || null,
          sotto_principi_gioco: meta.sotto_principi_gioco || null,
          annotazioni: meta.annotazioni || null,
        })
        .eq('id', trainingId)
      if (eUpd) throw eUpd

      // 2. Cancella tutti gli esercizi esistenti e reinserisci (approccio semplice, atomico)
      const { error: eDel } = await supabase.from('training_session_exercises').delete().eq('training_id', trainingId)
      if (eDel) throw eDel

      if (rows.length > 0) {
        const { error: eIns } = await supabase.from('training_session_exercises').insert(
          rows.map((r, i) => ({
            training_id: trainingId,
            exercise_id: r.exercise_id,
            order_num: i + 1,
            custom_notes: r.custom_notes || null,
            duration_override: r.duration_override,
          }))
        )
        if (eIns) throw eIns
      }

      onSaved?.()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const dateFormatted = trainingDate
    ? new Date(trainingDate).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  return (
    <>
      <BottomSheet
        open={open && !showCatalog}
        onClose={onClose}
        title="Componi seduta strutturata"
        maxHeight="94vh"
      >
        <div style={{ padding: '8px 16px 24px' }}>
          {/* Info seduta */}
          {(teamName || dateFormatted) && (
            <div
              style={{
                background: '#f0f7ff',
                border: '1px solid #cfe5ff',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 14,
                fontSize: 12.5,
                color: '#004a78',
              }}
            >
              {teamName && (
                <div style={{ fontWeight: 700 }}>
                  <Icon name="shield" size={13} color="#005f98" /> {teamName}
                </div>
              )}
              {dateFormatted && <div style={{ marginTop: 2 }}>📅 {dateFormatted}</div>}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#707882' }}>Caricamento…</div>
          ) : (
            <>
              {error && (
                <div style={{ padding: 10, background: '#ffe5e5', color: '#ba1a1a', borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
                  ⚠ {error}
                </div>
              )}

              {/* SEZIONE 1: STAFF */}
              <SectionTitle>👥 Staff</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldMini label="Allenatore">
                  <input
                    value={meta.staff_allenatore}
                    onChange={e => setMeta({ ...meta, staff_allenatore: e.target.value })}
                    placeholder="Nome"
                    style={inputStyle}
                  />
                </FieldMini>
                <FieldMini label="Collaboratore">
                  <input
                    value={meta.staff_collaboratore}
                    onChange={e => setMeta({ ...meta, staff_collaboratore: e.target.value })}
                    placeholder="Nome"
                    style={inputStyle}
                  />
                </FieldMini>
                <FieldMini label="Prep. Portieri">
                  <input
                    value={meta.staff_prep_portieri}
                    onChange={e => setMeta({ ...meta, staff_prep_portieri: e.target.value })}
                    placeholder="Nome"
                    style={inputStyle}
                  />
                </FieldMini>
                <FieldMini label="Prep. Coordinativo">
                  <input
                    value={meta.staff_prep_coordinativo}
                    onChange={e => setMeta({ ...meta, staff_prep_coordinativo: e.target.value })}
                    placeholder="Nome"
                    style={inputStyle}
                  />
                </FieldMini>
                <FieldMini label="Medico / Fisio">
                  <input
                    value={meta.staff_medico}
                    onChange={e => setMeta({ ...meta, staff_medico: e.target.value })}
                    placeholder="Nome"
                    style={inputStyle}
                  />
                </FieldMini>
                <FieldMini label="Seduta N.">
                  <input
                    type="number"
                    value={meta.session_number ?? ''}
                    onChange={e => setMeta({ ...meta, session_number: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="1, 2, 3..."
                    style={inputStyle}
                  />
                </FieldMini>
              </div>

              {/* SEZIONE 2: OBIETTIVI GENERALI */}
              <SectionTitle>🎯 Obiettivi seduta</SectionTitle>
              <FieldMini label="Zona/e di sviluppo degli obiettivi">
                <input
                  value={meta.zona_sviluppo}
                  onChange={e => setMeta({ ...meta, zona_sviluppo: e.target.value })}
                  placeholder="es. Costruzione + Finalizzazione"
                  style={inputStyle}
                />
              </FieldMini>
              <FieldMini label="Tecnico">
                <input
                  value={meta.obiettivo_tecnico}
                  onChange={e => setMeta({ ...meta, obiettivo_tecnico: e.target.value })}
                  placeholder="es. Tiro in porta"
                  style={inputStyle}
                />
              </FieldMini>
              <FieldMini label="Situazionale">
                <input
                  value={meta.obiettivo_situazionale}
                  onChange={e => setMeta({ ...meta, obiettivo_situazionale: e.target.value })}
                  placeholder="es. 3 vs 2+Portiere"
                  style={inputStyle}
                />
              </FieldMini>
              <FieldMini label="Principi di gioco">
                <PrincipioSelect
                  value={meta.principi_gioco}
                  onChange={v => setMeta({ ...meta, principi_gioco: v })}
                  options={PRINCIPI_GIOCO}
                  placeholder="— Seleziona un principio —"
                  otherPlaceholder="Scrivi il principio personalizzato"
                />
              </FieldMini>

              <FieldMini label="Sotto principi di gioco">
                <PrincipioSelect
                  value={meta.sotto_principi_gioco}
                  onChange={v => setMeta({ ...meta, sotto_principi_gioco: v })}
                  options={SOTTO_PRINCIPI_GIOCO}
                  placeholder="— Seleziona un sotto principio —"
                  otherPlaceholder="Scrivi il sotto principio personalizzato"
                />
              </FieldMini>

              {/* SEZIONE 3: ESERCIZI */}
              <SectionTitle>
                📋 Esercizi ({rows.length})
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: durationTargetOk ? '#d4edda' : durationTargetWarn && rows.length > 0 ? '#ffe5b4' : '#f0f0f2',
                    color: durationTargetOk ? '#155724' : durationTargetWarn && rows.length > 0 ? '#8b5000' : '#707882',
                  }}
                >
                  {totalDuration} min / 90 target
                </span>
              </SectionTitle>

              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {rows.map((row, i) => {
                  const partMeta = SESSION_PART_META[row.exercise.session_part]
                  return (
                    <div
                      key={`${row.exercise_id}-${i}`}
                      style={{
                        background: '#fff',
                        border: '1px solid #e6e8ee',
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {/* Numero d'ordine */}
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: '#005f98',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </div>
                        {/* Info esercizio */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: partMeta.bg,
                                color: partMeta.fg,
                                padding: '1px 7px',
                                borderRadius: 999,
                                fontSize: 9.5,
                                fontWeight: 800,
                              }}
                            >
                              {partMeta.short.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#181c20', lineHeight: 1.25, marginBottom: 4 }}>
                            {row.exercise.name}
                          </div>
                        </div>
                        {/* Bottoni controllo */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => handleMove(i, 'up')} disabled={i === 0} style={ctrlBtn(i === 0)}>
                            <Icon name="keyboard_arrow_up" size={16} color={i === 0 ? '#c0c7d2' : '#404751'} />
                          </button>
                          <button onClick={() => handleMove(i, 'down')} disabled={i === rows.length - 1} style={ctrlBtn(i === rows.length - 1)}>
                            <Icon name="keyboard_arrow_down" size={16} color={i === rows.length - 1 ? '#c0c7d2' : '#404751'} />
                          </button>
                        </div>
                      </div>

                      {/* Durata + note custom */}
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={row.duration_override ?? row.exercise.duration_min}
                            onChange={e =>
                              handleUpdateRow(i, {
                                duration_override: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
                          />
                          <span style={{ fontSize: 11, color: '#707882', fontWeight: 600 }}>min</span>
                        </div>
                        <input
                          value={row.custom_notes}
                          onChange={e => handleUpdateRow(i, { custom_notes: e.target.value })}
                          placeholder="Note aggiuntive per questa seduta…"
                          style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
                        />
                        <button
                          onClick={() => handleRemove(i)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: '#fff',
                            border: '1px solid #ffb4b4',
                            cursor: 'pointer',
                          }}
                          aria-label="Rimuovi"
                        >
                          <Icon name="delete" size={14} color="#ba1a1a" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottone aggiungi esercizio */}
              <button
                onClick={() => setShowCatalog(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  border: '2px dashed #005f98',
                  background: '#f0f7ff',
                  color: '#005f98',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                  marginBottom: 16,
                }}
              >
                <Icon name="add_circle" size={18} color="#005f98" />
                Aggiungi esercizio dal catalogo
              </button>

              {/* Annotazioni */}
              <SectionTitle>📝 Annotazioni</SectionTitle>
              <textarea
                value={meta.annotazioni}
                onChange={e => setMeta({ ...meta, annotazioni: e.target.value })}
                placeholder="Note staff, osservazioni, cose da ricordare per la prossima seduta…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />

              {/* Azioni finali */}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: '1px solid #c0c7d2',
                    background: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#404751',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#005f98',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: saving ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name="save" size={16} color="#fff" />
                  {saving ? 'Salvo…' : 'Salva seduta'}
                </button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Catalogo esercizi in modalità picker */}
      <TrainingExerciseCatalogSheet
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onPickExercise={handleAddExercise}
        defaultAgeFilter={teamAgeRange}
        alreadyPickedIds={rows.map(r => r.exercise_id)}
      />
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        color: '#005f98',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: 18,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  )
}

function FieldMini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#404751',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          display: 'block',
          marginBottom: 3,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #c0c7d2',
  fontSize: 12.5,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
}

const ctrlBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '2px',
  borderRadius: 6,
  background: disabled ? '#f5f5f7' : '#fff',
  border: '1px solid #e6e8ee',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})
