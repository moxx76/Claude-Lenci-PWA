import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { useExerciseCatalog, type TrainingExercise, type SessionPart, SESSION_PART_META } from '../hooks/useExerciseCatalog'
import { TrainingExerciseDetailSheet } from './TrainingExerciseDetailSheet'
import { TrainingExerciseFormSheet } from './TrainingExerciseFormSheet'
import { useAuth } from '../store/auth'

interface Props {
  open: boolean
  onClose: () => void
  /** Se fornito, mostra un bottone "Aggiungi" su ogni esercizio */
  onPickExercise?: (exercise: TrainingExercise) => void
  /** Filtra i risultati per età (es. "U-14") — utile in modalità picker per una squadra specifica */
  defaultAgeFilter?: string
  /** Nascondi tutti gli esercizi già presenti nella seduta corrente (mostra pill "già in seduta") */
  alreadyPickedIds?: string[]
}

const PARTS_ORDER: (SessionPart | 'all')[] = ['all', 'attivazione', 'tecnica', 'situazionale', 'gioco']

export function TrainingExerciseCatalogSheet({
  open,
  onClose,
  onPickExercise,
  defaultAgeFilter,
  alreadyPickedIds = [],
}: Props) {
  const { profile } = useAuth()
  const [selectedPart, setSelectedPart] = useState<SessionPart | 'all'>('all')
  const [search, setSearch] = useState('')
  const [ageFilter, setAgeFilter] = useState<string>(defaultAgeFilter || '')
  const [openDetail, setOpenDetail] = useState<TrainingExercise | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate' | null>(null)
  const [formTarget, setFormTarget] = useState<TrainingExercise | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const { exercises, loading, error } = useExerciseCatalog({
    session_part: selectedPart,
    age_range: ageFilter || undefined,
    search: search || undefined,
    refreshKey,
  })

  const pickerMode = !!onPickExercise
  // Può creare esercizi custom: admin (non readonly), o coach non-manager
  const canCreate = !profile?.is_readonly && (
    profile?.role === 'admin' || (profile?.role === 'coach' && !profile?.is_manager)
  )

  const handleSaved = () => {
    setRefreshKey(k => k + 1)
    setFormMode(null)
    setFormTarget(null)
  }

  const handleEditFromDetail = (ex: TrainingExercise) => {
    setOpenDetail(null)
    setFormTarget(ex)
    setFormMode('edit')
  }
  const handleDuplicateFromDetail = (ex: TrainingExercise) => {
    setOpenDetail(null)
    setFormTarget(ex)
    setFormMode('duplicate')
  }
  const handleDeletedFromDetail = () => {
    setOpenDetail(null)
    setRefreshKey(k => k + 1)
  }

  return (
    <>
      <BottomSheet
        open={open && !openDetail}
        onClose={onClose}
        title={pickerMode ? 'Scegli esercizio' : 'Catalogo esercizi'}
        maxHeight="92vh"
      >
        <div style={{ padding: '12px 16px 24px' }}>
          {/* Bottone nuovo esercizio - solo per admin/coach non-manager */}
          {canCreate && !pickerMode && (
            <button
              onClick={() => {
                setFormTarget(null)
                setFormMode('create')
              }}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 12,
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
              }}
            >
              <Icon name="add" size={16} color="#005f98" />
              Crea nuovo esercizio custom
            </button>
          )}

          {/* Filtri chip session_part */}
          <div
            className="lenci-scroll-x"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              marginBottom: 12,
              paddingBottom: 4,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {PARTS_ORDER.map(part => {
              const isActive = selectedPart === part
              const meta = part === 'all' ? null : SESSION_PART_META[part]
              return (
                <button
                  key={part}
                  onClick={() => setSelectedPart(part)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: isActive ? 'none' : '1px solid #c0c7d2',
                    background: isActive ? (meta?.fg || '#005f98') : '#fff',
                    color: isActive ? '#fff' : '#404751',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  {meta && <Icon name={meta.icon} size={14} color={isActive ? '#fff' : meta.fg} />}
                  {part === 'all' ? 'Tutti' : meta!.short}
                </button>
              )
            })}
          </div>

          {/* Search + age filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <Icon name="search" size={16} color="#707882" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca…"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  borderRadius: 10,
                  border: '1px solid #c0c7d2',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#fff',
                }}
              />
              <div style={{ position: 'absolute', left: 10, top: 10, pointerEvents: 'none' }}>
                <Icon name="search" size={14} color="#707882" />
              </div>
            </div>
            <select
              value={ageFilter}
              onChange={e => setAgeFilter(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #c0c7d2',
                fontSize: 12,
                fontFamily: 'inherit',
                background: '#fff',
                color: '#404751',
              }}
            >
              <option value="">Tutte età</option>
              <option value="Piccoli Amici">Piccoli Amici</option>
              <option value="Primi Calci">Primi Calci</option>
              <option value="Pulcini">Pulcini</option>
              <option value="Esordienti">Esordienti</option>
              <option value="U-14">Under 14</option>
              <option value="U-16">Under 16</option>
              <option value="Juniores">Juniores</option>
            </select>
          </div>

          {/* Risultati */}
          <div style={{ fontSize: 11.5, color: '#707882', marginBottom: 10, fontWeight: 600 }}>
            {loading ? 'Caricamento…' : `${exercises.length} eserciz${exercises.length === 1 ? 'io' : 'i'} trovat${exercises.length === 1 ? 'o' : 'i'}`}
          </div>

          {error && (
            <div style={{ padding: 12, background: '#ffe5e5', color: '#ba1a1a', borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
              Errore: {error}
            </div>
          )}

          {!loading && exercises.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
              Nessun esercizio corrisponde ai filtri.
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {exercises.map(ex => {
              const meta = SESSION_PART_META[ex.session_part]
              const isPicked = alreadyPickedIds.includes(ex.id)
              return (
                <div
                  key={ex.id}
                  onClick={() => setOpenDetail(ex)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e6e8ee',
                    borderRadius: 14,
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    opacity: isPicked ? 0.55 : 1,
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* SVG preview miniatura */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: 88,
                      height: 62,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#3d9b47',
                      border: '1px solid #d0d5db',
                    }}
                    dangerouslySetInnerHTML={{ __html: ex.diagram_svg || '' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: meta.bg,
                          color: meta.fg,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: 0.3,
                        }}
                      >
                        {meta.short.toUpperCase()}
                      </span>
                      {isPicked && (
                        <span style={{ background: '#e6f4ea', color: '#1e7a3d', padding: '2px 6px', borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>
                          ✓ in seduta
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#181c20', marginBottom: 4, lineHeight: 1.25 }}>
                      {ex.name}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#707882', flexWrap: 'wrap' }}>
                      <span>⏱ {ex.duration_min}′</span>
                      <span>👥 {ex.players_min}-{ex.players_max}</span>
                      {ex.area_size && <span>📐 {ex.area_size}</span>}
                    </div>
                  </div>
                  {pickerMode && !isPicked && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onPickExercise!(ex)
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '8px 12px',
                        borderRadius: 999,
                        background: '#005f98',
                        color: '#fff',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Icon name="add" size={14} color="#fff" />
                      Aggiungi
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </BottomSheet>

      {/* Dettaglio esercizio */}
      {openDetail && (
        <TrainingExerciseDetailSheet
          exercise={openDetail}
          onClose={() => setOpenDetail(null)}
          onPick={
            pickerMode && !alreadyPickedIds.includes(openDetail.id)
              ? () => {
                  onPickExercise!(openDetail)
                  setOpenDetail(null)
                }
              : undefined
          }
          onEdit={handleEditFromDetail}
          onDuplicate={handleDuplicateFromDetail}
          onDeleted={handleDeletedFromDetail}
        />
      )}

      {/* Form create/edit/duplicate */}
      {formMode && (
        <TrainingExerciseFormSheet
          open={!!formMode}
          onClose={() => {
            setFormMode(null)
            setFormTarget(null)
          }}
          mode={formMode}
          existingExercise={formTarget}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
