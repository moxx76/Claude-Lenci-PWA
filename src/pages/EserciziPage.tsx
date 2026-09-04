import { useMemo, useState } from 'react'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach } from '../lib/types'
import { Icon } from '../components/Icon'
import {
  useExerciseCatalog,
  SESSION_PART_META,
  type TrainingExercise,
  type SessionPart,
} from '../hooks/useExerciseCatalog'
import { TrainingExerciseDetailSheet } from '../components/TrainingExerciseDetailSheet'
import { TrainingExerciseFormSheet } from '../components/TrainingExerciseFormSheet'

const PARTS_ORDER: (SessionPart | 'all')[] = ['all', 'attivazione', 'tecnica', 'situazionale', 'gioco']
const AGE_OPTIONS = ['Piccoli Amici', 'Primi Calci', 'Pulcini', 'Esordienti', 'U-14', 'U-16', 'Juniores']

export function EserciziPage() {
  const { profile } = useAuth()
  const isStaff = isAdmin(profile?.role) || isCoach(profile?.role)

  const [selectedPart, setSelectedPart] = useState<SessionPart | 'all'>('all')
  const [ageFilter, setAgeFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [detailEx, setDetailEx] = useState<TrainingExercise | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create')
  const [formExercise, setFormExercise] = useState<TrainingExercise | null>(null)

  const { exercises, allExercises, loading, error } = useExerciseCatalog({
    session_part: selectedPart,
    age_range: ageFilter || undefined,
    search: search || undefined,
    refreshKey,
  })

  // Conteggi per parte (sull'intero catalogo, dopo aver applicato età/ricerca ma non parte)
  const preFilteredForCounts = useMemo(() => {
    let arr = allExercises
    if (ageFilter) arr = arr.filter(e => e.age_ranges.includes(ageFilter))
    if (search) {
      const q = search.toLowerCase().trim()
      if (q) arr = arr.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return arr
  }, [allExercises, ageFilter, search])

  const partCounts = useMemo(() => {
    const c: Record<string, number> = { all: preFilteredForCounts.length }
    for (const p of ['attivazione', 'tecnica', 'situazionale', 'gioco'] as SessionPart[]) {
      c[p] = preFilteredForCounts.filter(e => e.session_part === p).length
    }
    return c
  }, [preFilteredForCounts])

  if (!isStaff) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#707882' }}>
        Area riservata allo staff societario.
      </div>
    )
  }

  const openCreate = () => {
    setFormExercise(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (ex: TrainingExercise) => {
    setFormExercise(ex)
    setFormMode('edit')
    setFormOpen(true)
    setDetailEx(null)
  }
  const openDuplicate = (ex: TrainingExercise) => {
    setFormExercise(ex)
    setFormMode('duplicate')
    setFormOpen(true)
    setDetailEx(null)
  }
  const onSaved = () => {
    setFormOpen(false)
    setRefreshKey(k => k + 1)
  }
  const onDeleted = () => {
    setDetailEx(null)
    setRefreshKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px 30px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
        color: '#fff', padding: '14px 16px', borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="fitness_center" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.4, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase' }}>
            Metodologia
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Anybody, Arial Black, sans-serif', marginTop: 2 }}>
            CATALOGO ESERCIZI
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            {allExercises.length} esercizi totali · {exercises.length} filtrati
          </div>
        </div>
      </div>

      {/* Bottone crea nuovo */}
      <button
        onClick={openCreate}
        style={{
          width: '100%', padding: '12px', borderRadius: 12,
          background: '#c73434', color: '#fff', border: 'none',
          fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 3px 12px rgba(199,52,52,0.25)',
        }}
      >
        <Icon name="add_circle" size={18} color="#fff" />
        Nuovo esercizio
      </button>

      {/* Ricerca */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nome, descrizione o tag…"
          style={{
            width: '100%', padding: '11px 14px 11px 40px',
            borderRadius: 12, border: '1px solid #c0c7d2',
            fontSize: 13, background: '#fff', fontFamily: 'inherit',
          }}
        />
        <div style={{ position: 'absolute', left: 12, top: 11 }}>
          <Icon name="search" size={18} color="#707882" />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 6, top: 6,
              padding: 6, borderRadius: 8, border: 'none', background: '#f1f3fa',
              cursor: 'pointer',
            }}
          >
            <Icon name="close" size={14} color="#707882" />
          </button>
        )}
      </div>

      {/* Filtro età */}
      <div>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: '#404751',
          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6,
        }}>
          Fascia età
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterPill
            active={!ageFilter}
            onClick={() => setAgeFilter('')}
            label="Tutte"
            color="#404751"
          />
          {AGE_OPTIONS.map(a => (
            <FilterPill
              key={a}
              active={ageFilter === a}
              onClick={() => setAgeFilter(a)}
              label={a}
              color="#005f98"
            />
          ))}
        </div>
      </div>

      {/* Filtro parte seduta */}
      <div>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: '#404751',
          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6,
        }}>
          Parte della seduta
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PARTS_ORDER.map(p => {
            const meta = p === 'all' ? null : SESSION_PART_META[p]
            const label = p === 'all' ? `Tutte (${partCounts.all})` : `${meta!.short} (${partCounts[p] ?? 0})`
            const color = p === 'all' ? '#404751' : meta!.fg
            return (
              <FilterPill
                key={p}
                active={selectedPart === p}
                onClick={() => setSelectedPart(p)}
                label={label}
                color={color}
              />
            )
          })}
        </div>
      </div>

      {/* Loading / errore */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Carico il catalogo…
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {/* Lista esercizi */}
      {!loading && !error && exercises.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: '#707882', fontSize: 13,
          background: '#f7f9ff', borderRadius: 12,
        }}>
          Nessun esercizio corrisponde ai filtri. Prova a rimuoverne qualcuno o crea un nuovo esercizio col bottone rosso in alto.
        </div>
      )}

      {!loading && !error && exercises.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {exercises.map(ex => {
            const meta = SESSION_PART_META[ex.session_part]
            return (
              <button
                key={ex.id}
                onClick={() => setDetailEx(ex)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: '#fff', border: '1px solid #e6e8ee', borderRadius: 14,
                  padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  borderLeft: `4px solid ${meta.fg}`,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999,
                    background: meta.bg, color: meta.fg,
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
                  }}>
                    <Icon name={meta.icon} size={12} color={meta.fg} />
                    {meta.short}
                  </span>
                  <span style={{ fontSize: 11, color: '#707882', fontWeight: 700 }}>
                    ⏱ {ex.duration_min} min
                  </span>
                  {ex.is_official && (
                    <span style={{
                      padding: '2px 7px', borderRadius: 999,
                      background: '#eef7ff', color: '#004a78',
                      fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
                    }}>
                      ★ Ufficiale
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', lineHeight: 1.3 }}>
                  {ex.name}
                </div>
                {ex.description && (
                  <div style={{
                    fontSize: 12, color: '#404751', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {ex.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {ex.age_ranges.slice(0, 4).map(a => (
                    <span key={a} style={{
                      fontSize: 10, color: '#005f98', background: '#e7f2ff',
                      padding: '2px 7px', borderRadius: 999, fontWeight: 700,
                    }}>{a}</span>
                  ))}
                  {ex.players_min > 0 && (
                    <span style={{ fontSize: 10, color: '#707882', fontWeight: 600 }}>
                      👥 {ex.players_min}–{ex.players_max}
                    </span>
                  )}
                  {ex.materials && (
                    <span style={{ fontSize: 10, color: '#707882', fontWeight: 600 }}>
                      🎽 {ex.materials.length > 25 ? ex.materials.slice(0, 25) + '…' : ex.materials}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sheet dettaglio esercizio */}
      {detailEx && (
        <TrainingExerciseDetailSheet
          exercise={detailEx}
          onClose={() => setDetailEx(null)}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
          onDeleted={onDeleted}
        />
      )}

      {/* Sheet crea / modifica / duplica esercizio */}
      <TrainingExerciseFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        existingExercise={formExercise}
        onSaved={onSaved}
      />
    </div>
  )
}

function FilterPill({ active, onClick, label, color }: {
  active: boolean; onClick: () => void; label: string; color: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999,
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `1px solid ${color}`,
        fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
