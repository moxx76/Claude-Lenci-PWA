import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { type TrainingExercise, SESSION_PART_META } from '../hooks/useExerciseCatalog'
import { useAuth } from '../store/auth'
import { supabase } from '../lib/supabase'

interface Props {
  exercise: TrainingExercise
  onClose: () => void
  /** Se fornito, mostra bottone "Aggiungi alla seduta" */
  onPick?: () => void
  /** Callback per modificare (apre form) */
  onEdit?: (ex: TrainingExercise) => void
  /** Callback per duplicare (apre form pre-compilato) */
  onDuplicate?: (ex: TrainingExercise) => void
  /** Callback dopo eliminazione riuscita */
  onDeleted?: () => void
}

export function TrainingExerciseDetailSheet({ exercise: ex, onClose, onPick, onEdit, onDuplicate, onDeleted }: Props) {
  const meta = SESSION_PART_META[ex.session_part]
  const { profile } = useAuth()
  const [deleting, setDeleting] = useState(false)

  // Chi può modificare/eliminare questo esercizio (specchia la policy RLS)
  const isAdmin = profile?.role === 'admin' && !profile?.is_readonly
  const isOwnerCoach = profile?.role === 'coach' && !profile?.is_manager && !profile?.is_readonly && ex.created_by === profile.id && !ex.is_official
  const canEditThis = isAdmin || isOwnerCoach
  // Chiunque possa CREARE (admin o coach non-manager, non readonly) può duplicare
  const canDuplicate = !profile?.is_readonly && (profile?.role === 'admin' || (profile?.role === 'coach' && !profile?.is_manager))

  const handleDelete = async () => {
    if (!confirm(`Eliminare l'esercizio "${ex.name}"? L'operazione non può essere annullata.`)) return
    setDeleting(true)
    const { error } = await supabase.from('training_exercises').delete().eq('id', ex.id)
    setDeleting(false)
    if (error) {
      alert(`Errore: ${error.message}`)
      return
    }
    onDeleted?.()
  }

  return (
    <BottomSheet open={true} onClose={onClose} title={ex.name} maxHeight="94vh">
      <div style={{ padding: '8px 16px 24px' }}>
        {/* Pill categoria + meta rapide */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              background: meta.bg,
              color: meta.fg,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: 0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name={meta.icon} size={13} color={meta.fg} />
            {meta.short}
          </span>
          <span style={pillGray}>⏱ {ex.duration_min} min</span>
          <span style={pillGray}>👥 {ex.players_min}-{ex.players_max}</span>
          {ex.area_size && <span style={pillGray}>📐 {ex.area_size}</span>}
          {ex.is_official ? (
            <span style={{ ...pillGray, background: '#e8f4fd', color: '#005f98' }}>✓ Ufficiale</span>
          ) : (
            <span style={{ ...pillGray, background: '#fff4e6', color: '#a15c00' }}>✎ Custom</span>
          )}
        </div>

        {/* SVG grande dello schema tattico */}
        <div
          style={{
            width: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #d0d5db',
            background: '#3d9b47',
            marginBottom: 16,
          }}
          dangerouslySetInnerHTML={{ __html: ex.diagram_svg || '' }}
        />

        {/* Descrizione */}
        {ex.description && (
          <Section label="Descrizione">
            <div style={{ fontSize: 13.5, color: '#404751', lineHeight: 1.55 }}>{ex.description}</div>
          </Section>
        )}

        {/* Obiettivi */}
        {(ex.objective_possesso || ex.objective_non_possesso || ex.objective_tecnico || ex.objective_motorio || ex.objective_emotivo) && (
          <Section label="Obiettivi">
            <div style={{ display: 'grid', gap: 6 }}>
              {ex.objective_possesso && <ObjRow icon="sports_soccer" color="#1e5fb6" label="Possesso" text={ex.objective_possesso} />}
              {ex.objective_non_possesso && <ObjRow icon="shield" color="#c73434" label="Non possesso" text={ex.objective_non_possesso} />}
              {ex.objective_tecnico && <ObjRow icon="build" color="#0c5460" label="Tecnico" text={ex.objective_tecnico} />}
              {ex.objective_motorio && <ObjRow icon="directions_run" color="#856404" label="Motorio" text={ex.objective_motorio} />}
              {ex.objective_emotivo && <ObjRow icon="favorite" color="#7b1fa2" label="Emotivo" text={ex.objective_emotivo} />}
            </div>
          </Section>
        )}

        {/* Principi di gioco */}
        {ex.principles.length > 0 && (
          <Section label="Principi di gioco">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ex.principles.map(p => (
                <span
                  key={p}
                  style={{
                    background: '#eef2ff',
                    color: '#005f98',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Età consigliate */}
        {ex.age_ranges.length > 0 && (
          <Section label="Categorie consigliate">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ex.age_ranges.map(a => (
                <span
                  key={a}
                  style={{
                    background: '#f0f0f2',
                    color: '#404751',
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Materiali */}
        {ex.materials && (
          <Section label="Materiali">
            <div style={{ fontSize: 12.5, color: '#404751', lineHeight: 1.5 }}>{ex.materials}</div>
          </Section>
        )}

        {/* Tags */}
        {ex.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
            {ex.tags.map(t => (
              <span key={t} style={{ fontSize: 10.5, color: '#707882' }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        {/* Azioni: se in modalità picker mostro solo Chiudi+Aggiungi; altrimenti Chiudi+Modifica/Duplica/Elimina */}
        {onPick ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={btnSecondary}>Chiudi</button>
            <button
              onClick={onPick}
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
                fontFamily: 'inherit',
              }}
            >
              <Icon name="add_circle" size={16} color="#fff" />
              Aggiungi alla seduta
            </button>
          </div>
        ) : (
          <>
            {/* Bottoni azione contestuali */}
            {(canEditThis || canDuplicate) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {canEditThis && onEdit && (
                  <button onClick={() => onEdit(ex)} style={btnAction('#005f98')}>
                    <Icon name="edit" size={14} color="#fff" /> Modifica
                  </button>
                )}
                {canDuplicate && onDuplicate && (
                  <button onClick={() => onDuplicate(ex)} style={btnAction('#0c5460')}>
                    <Icon name="content_copy" size={14} color="#fff" /> Duplica
                  </button>
                )}
                {canEditThis && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={btnAction('#c73434', deleting)}
                  >
                    <Icon name="delete" size={14} color="#fff" /> {deleting ? 'Elimino…' : 'Elimina'}
                  </button>
                )}
              </div>
            )}
            {/* Nota su esercizi ufficiali per chi non è admin */}
            {ex.is_official && !isAdmin && canDuplicate && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  background: '#f0f7ff',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#004a78',
                  lineHeight: 1.4,
                }}
              >
                💡 Questo è un esercizio ufficiale della società. Non è modificabile direttamente, ma puoi <strong>duplicarlo</strong> per adattarlo a un tuo bisogno specifico.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Chiudi</button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: '#005f98',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function ObjRow({ icon, color, label, text }: { icon: string; color: string; label: string; text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        background: '#f9fafb',
        padding: '8px 10px',
        borderRadius: 8,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Icon name={icon} size={16} color={color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: color, letterSpacing: 0.3, marginBottom: 2 }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 12.5, color: '#404751', lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  )
}

const pillGray: React.CSSProperties = {
  background: '#f0f0f2',
  color: '#404751',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700,
}

const btnSecondary: React.CSSProperties = {
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
}

const btnAction = (bg: string, disabled = false): React.CSSProperties => ({
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  background: bg,
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  cursor: disabled ? 'wait' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontFamily: 'inherit',
  opacity: disabled ? 0.6 : 1,
  minWidth: 90,
})
