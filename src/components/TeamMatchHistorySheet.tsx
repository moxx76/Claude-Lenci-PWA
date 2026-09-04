import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  /** Se null, mostra partite di tutte le squadre */
  teamId: string | null
  /** Nome squadra per il titolo; se null, mostra "tutte le squadre" */
  teamName: string | null
  /** Callback per aprire il post-match / report tattico */
  onOpenReport?: (matchId: string) => void
  /** Chiave che se cambia riscatena il fetch (utile dopo modifiche/salvataggi) */
  reloadKey?: number
}

interface MatchRow {
  id: string
  match_date: string
  opponent: string
  venue: 'home' | 'away'
  competition: string | null
  home_score: number | null
  away_score: number | null
  status: string
  report_completed_at: string | null
  team_id: string
  team_name?: string | null
  team_color?: string | null
  goals_from_stats?: number  // somma marcatori registrati (anche se report non ancora salvato)
}

export function TeamMatchHistorySheet({ open, onClose, teamId, teamName, onOpenReport, reloadKey }: Props) {
  const [rows, setRows] = useState<MatchRow[]>([])
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
        const nowIso = new Date().toISOString()
        let q = supabase
          .from('matches')
          .select('id, match_date, opponent, venue, competition, home_score, away_score, status, report_completed_at, team_id, team:teams(name, color), match_player_stats(goals, penalties_scored)')
          .order('match_date', { ascending: false })
          .limit(200)
        if (teamId) q = q.eq('team_id', teamId)
        if (scope === 'past') q = q.lte('match_date', nowIso)
        const { data, error: err } = await q
        if (err) throw err

        const list = (data || []) as unknown as Array<{
          id: string; match_date: string; opponent: string; venue: 'home' | 'away';
          competition: string | null; home_score: number | null; away_score: number | null;
          status: string; report_completed_at: string | null; team_id: string;
          team?: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
          match_player_stats?: Array<{ goals: number | null; penalties_scored: number | null }>;
        }>

        if (!alive) return
        setRows(
          list.map(m => {
            const team = Array.isArray(m.team) ? m.team[0] : m.team
            // Somma dei marcatori registrati nel report (utile come anticipazione se il report non è stato ancora salvato)
            const goalsFromStats = (m.match_player_stats || [])
              .reduce((s, r) => s + (r.goals || 0) + (r.penalties_scored || 0), 0)
            return {
              id: m.id,
              match_date: m.match_date,
              opponent: m.opponent,
              venue: m.venue,
              competition: m.competition,
              home_score: m.home_score,
              away_score: m.away_score,
              status: m.status,
              report_completed_at: m.report_completed_at,
              team_id: m.team_id,
              team_name: team?.name ?? null,
              team_color: team?.color ?? null,
              goals_from_stats: goalsFromStats,
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
    return () => { alive = false }
  }, [open, teamId, scope, reloadKey])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }
  const isPast = (iso: string) => new Date(iso) < new Date()

  // Etichetta risultato + colore (dal punto di vista della NOSTRA squadra)
  const resultLabel = (m: MatchRow): { text: string; bg: string; color: string; isPreview?: boolean } | null => {
    // Se abbiamo marcatori registrati ma il report non è stato salvato ancora → mostro anticipazione
    const hasSavedScore = m.home_score != null && m.away_score != null
                          && !(m.home_score === 0 && m.away_score === 0 && !m.report_completed_at)
    const goalsInStats = m.goals_from_stats || 0

    if (!hasSavedScore) {
      if (goalsInStats > 0) {
        // Marcatori inseriti ma report non salvato: mostro il totale come "anteprima"
        return { text: `${goalsInStats}–?`, bg: '#fff4e6', color: '#7c4700', isPreview: true }
      }
      return null
    }

    const ourScore = m.venue === 'home' ? m.home_score! : m.away_score!
    const theirScore = m.venue === 'home' ? m.away_score! : m.home_score!
    const label = `${ourScore}–${theirScore}`
    if (ourScore > theirScore) return { text: label, bg: '#dcf1e2', color: '#006e25' }
    if (ourScore < theirScore) return { text: label, bg: '#ffe4e4', color: '#93000a' }
    return { text: label, bg: '#f0e6ff', color: '#5c2ba8' }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Partite passate${teamName ? ' — ' + teamName : ''}`}>
      <div style={{ padding: '10px 14px 24px' }}>
        {/* Filtro scope */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            onClick={() => setScope('past')}
            style={scopeBtn(scope === 'past')}
          >
            Solo passate
          </button>
          <button
            onClick={() => setScope('all')}
            style={scopeBtn(scope === 'all')}
          >
            Tutte (anche future)
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
            Nessuna partita {scope === 'past' ? 'giocata' : ''} in archivio{teamId ? ' per questa squadra' : ''}.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#707882', marginBottom: 8, fontWeight: 600 }}>
              {rows.length} partit{rows.length === 1 ? 'a' : 'e'} — dalla più recente
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {rows.map(m => {
                const past = isPast(m.match_date)
                const res = resultLabel(m)
                const reportOk = !!m.report_completed_at
                return (
                  <button
                    key={m.id}
                    onClick={() => onOpenReport?.(m.id)}
                    style={{
                      textAlign: 'left',
                      background: past ? '#fff' : '#f0f7ff',
                      border: '1px solid ' + (past ? '#dfe3ea' : '#c0dbf0'),
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: onOpenReport ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#181c20', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {formatDate(m.match_date)}
                        {!past && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: '#005f98', color: '#fff', padding: '2px 6px', borderRadius: 10 }}>
                            FUTURO
                          </span>
                        )}
                        {!teamId && m.team_name && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: m.team_color || '#404751', color: '#fff', padding: '2px 6px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            {m.team_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#404751', marginTop: 3, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.venue === 'home' ? '🏠 vs ' : '✈ @ '}{m.opponent}
                      </div>
                      {m.competition && (
                        <div style={{ fontSize: 10.5, color: '#707882', marginTop: 2, fontStyle: 'italic' }}>
                          {m.competition}
                        </div>
                      )}
                      {past && (
                        <div style={{ marginTop: 5 }}>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                            background: reportOk ? '#dcf1e2' : '#fff4e6',
                            color: reportOk ? '#006e25' : '#7c4700',
                            textTransform: 'uppercase', letterSpacing: 0.3,
                          }}>
                            {reportOk ? '✓ Report compilato' : '⚠ Report da compilare'}
                          </span>
                        </div>
                      )}
                    </div>

                    {res && (
                      <div style={{
                        minWidth: 62, textAlign: 'center',
                        padding: '6px 10px', borderRadius: 10,
                        background: res.bg, color: res.color,
                        fontSize: 15, fontWeight: 900,
                      }}>
                        {res.text}
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
