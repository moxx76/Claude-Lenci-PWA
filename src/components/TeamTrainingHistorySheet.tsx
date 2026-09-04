import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  /** Se null, mostra allenamenti di tutte le squadre */
  teamId: string | null
  /** Nome squadra per il titolo; se null, mostra "tutte le squadre" */
  teamName: string | null
  /** Callback chiamato quando l'utente vuole aprire il dettaglio di un allenamento */
  onOpenTraining?: (trainingId: string, trainingDate: string) => void
  /** Chiave che se cambia riscatena il fetch (utile dopo modifiche/salvataggi) */
  reloadKey?: number
}

interface TrainingRow {
  id: string
  training_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  focus: string | null
  zona_sviluppo: string | null
  obiettivo_tecnico: string | null
  team_id: string
  team_name?: string | null
  team_color?: string | null
  presenze: number
  totale_convocati: number
}

export function TeamTrainingHistorySheet({ open, onClose, teamId, teamName, onOpenTraining, reloadKey }: Props) {
  const [rows, setRows] = useState<TrainingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'past' | 'all'>('past')

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        // 1. Trainings (di una squadra o di tutte)
        let q = supabase
          .from('trainings')
          .select('id, training_date, start_time, end_time, location, focus, zona_sviluppo, obiettivo_tecnico, team_id, team:teams(name, color)')
          .order('training_date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(150)
        if (teamId) q = q.eq('team_id', teamId)
        if (scope === 'past') q = q.lte('training_date', today)
        const { data: tData, error: tErr } = await q
        if (tErr) throw tErr
        const list = (tData || []) as unknown as Array<{
          id: string; training_date: string; start_time: string | null; end_time: string | null;
          location: string | null; focus: string | null; zona_sviluppo: string | null; obiettivo_tecnico: string | null;
          team_id: string; team?: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
        }>

        // 2. Conteggio presenze per ogni training
        const ids = list.map(t => t.id)
        const attMap: Record<string, { presenze: number; totale: number }> = {}
        if (ids.length > 0) {
          const { data: attData } = await supabase
            .from('attendances')
            .select('training_id, status')
            .in('training_id', ids)
          if (attData) {
            for (const a of attData as { training_id: string; status: string }[]) {
              if (!attMap[a.training_id]) attMap[a.training_id] = { presenze: 0, totale: 0 }
              attMap[a.training_id].totale += 1
              if (a.status === 'present') attMap[a.training_id].presenze += 1
            }
          }
        }

        if (!alive) return
        setRows(
          list.map(t => {
            const team = Array.isArray(t.team) ? t.team[0] : t.team
            return {
              id: t.id,
              training_date: t.training_date,
              start_time: t.start_time,
              end_time: t.end_time,
              location: t.location,
              focus: t.focus,
              zona_sviluppo: t.zona_sviluppo,
              obiettivo_tecnico: t.obiettivo_tecnico,
              team_id: t.team_id,
              team_name: team?.name ?? null,
              team_color: team?.color ?? null,
              presenze: attMap[t.id]?.presenze ?? 0,
              totale_convocati: attMap[t.id]?.totale ?? 0,
            }
          })
        )
      } catch (e: unknown) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, teamId, scope, reloadKey])

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(day))
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const isPast = (d: string) => d < new Date().toISOString().slice(0, 10)

  return (
    <BottomSheet open={open} onClose={onClose} title={`Storico allenamenti${teamName ? ' — ' + teamName : ''}`}>
      <div style={{ padding: '10px 14px 24px' }}>
        {/* Filtro scope */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            onClick={() => setScope('past')}
            style={scopeBtn(scope === 'past')}
          >
            Solo svolti
          </button>
          <button
            onClick={() => setScope('all')}
            style={scopeBtn(scope === 'all')}
          >
            Tutti (anche futuri)
          </button>
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#707882', fontSize: 13 }}>Carico…</div>}

        {error && (
          <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Nessun allenamento {scope === 'past' ? 'svolto' : ''} in archivio{teamId ? ' per questa squadra' : ''}.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#707882', marginBottom: 8, fontWeight: 600 }}>
              {rows.length} allenament{rows.length === 1 ? 'o' : 'i'} — dal più recente
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {rows.map(t => {
                const past = isPast(t.training_date)
                const pctPresenti = t.totale_convocati > 0 ? Math.round((t.presenze / t.totale_convocati) * 100) : null
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTraining?.(t.id, t.training_date)}
                    style={{
                      textAlign: 'left',
                      background: past ? '#fff' : '#f0f7ff',
                      border: '1px solid ' + (past ? '#dfe3ea' : '#c0dbf0'),
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: onOpenTraining ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#181c20', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {formatDate(t.training_date)}
                        {!past && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: '#005f98',
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: 10,
                            }}
                          >
                            FUTURO
                          </span>
                        )}
                        {!teamId && t.team_name && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: t.team_color || '#404751',
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: 10,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                            }}
                          >
                            {t.team_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>
                        {t.start_time && t.start_time.slice(0, 5)}
                        {t.end_time && `–${t.end_time.slice(0, 5)}`}
                        {t.location && ` · ${t.location}`}
                      </div>
                      {(t.focus || t.zona_sviluppo || t.obiettivo_tecnico) && (
                        <div style={{ fontSize: 11, color: '#404751', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.zona_sviluppo || t.focus || t.obiettivo_tecnico}
                        </div>
                      )}
                    </div>
                    {past && t.totale_convocati > 0 && (
                      <div style={{ textAlign: 'right', minWidth: 60 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: pctPresenti !== null && pctPresenti >= 70 ? '#2d7a3f' : pctPresenti !== null && pctPresenti >= 50 ? '#a15c00' : '#c73434' }}>
                          {t.presenze}/{t.totale_convocati}
                        </div>
                        <div style={{ fontSize: 9, color: '#707882', fontWeight: 700 }}>
                          {pctPresenti !== null ? `${pctPresenti}%` : '—'}
                        </div>
                      </div>
                    )}
                    {past && t.totale_convocati === 0 && (
                      <div style={{ fontSize: 10, color: '#a15c00', fontWeight: 700 }}>
                        ⚠ senza presenze
                      </div>
                    )}
                    <Icon name="chevron_right" size={16} color="#c0c7d2" />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

const scopeBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 10px',
  borderRadius: 8,
  border: active ? '2px solid #005f98' : '1px solid #c0c7d2',
  background: active ? '#e0f0ff' : '#fff',
  color: active ? '#004a78' : '#404751',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
})
