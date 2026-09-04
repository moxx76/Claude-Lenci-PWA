import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { PlayerAttendanceTimelineSheet } from './PlayerAttendanceTimelineSheet'

interface Row {
  player_id: string
  first_name: string
  last_name: string
  presenti: number
  ritardi: number
  giustificati: number
  assenti: number
  non_firmati: number
  allenamenti_totali: number
  pct_presenza: number
}

interface MatchRow {
  player_id: string
  first_name: string
  last_name: string
  convocati: number
  accettate: number
  rifiutate: number
  non_risposto: number
  giocate: number
  titolare: number
  partite_totali: number
  pct_convocazione: number
  risposto_vengo: number
  risposto_non_vengo: number
  risposto_forse: number
  non_risposto_disponibilita: number
}

interface MatchMatrixRow {
  player_id: string
  player_last_name: string
  player_first_name: string
  match_id: string
  match_date: string
  opponent: string | null
  competition: string | null
  venue: string | null
  convocation_status: string | null
  response_status: string | null
  was_starter: boolean | null
  played: boolean
}

interface MonthlyPoint {
  month_start: string
  n_trainings: number
  pct_presenza_media: number | null
}

interface MatrixRow {
  player_id: string
  player_last_name: string
  player_first_name: string
  training_id: string
  training_date: string
  training_start_time: string | null
  status: string | null
}

type Period = 'season' | 'month' | 'quarter' | 'year' | 'custom'
type Tab = 'trainings' | 'matches' | 'register'
type SortBy = 'presenza' | 'nome' | 'assenze' | 'convocazione'

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Ultimo mese',
  quarter: 'Ultimi 3 mesi',
  season: 'Stagione in corso',
  year: 'Ultimi 12 mesi',
  custom: 'Personalizzato',
}

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
  teamName: string
  teamColor: string | null
}

export function AttendanceStatsSheet({ open, onClose, teamId, teamName, teamColor }: Props) {
  const [tab, setTab] = useState<Tab>('trainings')
  const [period, setPeriod] = useState<Period>('season')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [matchRows, setMatchRows] = useState<MatchRow[]>([])
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([])
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [matchMatrix, setMatchMatrix] = useState<MatchMatrixRow[]>([])
  const [registerType, setRegisterType] = useState<'trainings' | 'matches'>('trainings')
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('presenza')
  const [timelinePlayer, setTimelinePlayer] = useState<{ id: string; name: string } | null>(null)

  const { from, to } = useMemo(() => computePeriod(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (!open || !teamId) return
    setLoading(true)
    Promise.all([
      supabase.rpc('team_attendance_stats', { p_team_id: teamId, p_from: from, p_to: to }),
      supabase.rpc('team_match_stats', { p_team_id: teamId, p_from: from, p_to: to }),
      supabase.rpc('team_attendance_monthly_trend', { p_team_id: teamId, p_from: from, p_to: to }),
      supabase.rpc('team_attendance_matrix', { p_team_id: teamId, p_from: from, p_to: to }),
      supabase.rpc('team_matches_matrix', { p_team_id: teamId, p_from: from, p_to: to }),
    ]).then(([r1, r2, r3, r4, r5]) => {
      if (r1.error) console.error('attendance_stats err:', r1.error)
      if (r2.error) console.error('match_stats err:', r2.error)
      if (r3.error) console.error('monthly err:', r3.error)
      if (r4.error) console.error('matrix err:', r4.error)
      if (r5.error) console.error('match_matrix err:', r5.error)
      setRows((r1.data as Row[]) ?? [])
      setMatchRows((r2.data as MatchRow[]) ?? [])
      setMonthly((r3.data as MonthlyPoint[]) ?? [])
      setMatrix((r4.data as MatrixRow[]) ?? [])
      setMatchMatrix((r5.data as MatchMatrixRow[]) ?? [])
      setLoading(false)
    })
  }, [open, teamId, from, to])

  const sorted = useMemo(() => {
    const arr = [...rows]
    if (sortBy === 'presenza') arr.sort((a, b) => b.pct_presenza - a.pct_presenza)
    else if (sortBy === 'assenze') arr.sort((a, b) => b.assenti - a.assenti)
    else arr.sort((a, b) => a.last_name.localeCompare(b.last_name))
    return arr
  }, [rows, sortBy])

  const sortedMatches = useMemo(() => {
    const arr = [...matchRows]
    if (sortBy === 'convocazione' || sortBy === 'presenza')
      arr.sort((a, b) => b.pct_convocazione - a.pct_convocazione)
    else if (sortBy === 'assenze') arr.sort((a, b) => b.rifiutate - a.rifiutate)
    else arr.sort((a, b) => a.last_name.localeCompare(b.last_name))
    return arr
  }, [matchRows, sortBy])

  const criticalCount = useMemo(() => rows.filter(r => r.allenamenti_totali > 0 && r.pct_presenza < 60).length, [rows])

  const totals = useMemo(() => {
    const totAllen = rows[0]?.allenamenti_totali ?? 0
    const avgPct = rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.pct_presenza, 0) / rows.length) * 10) / 10
      : 0
    return { totAllen, avgPct }
  }, [rows])

  const exportCsv = () => {
    let headers: string[] = []
    let lines: string[] = []
    if (tab === 'trainings') {
      headers = ['Cognome', 'Nome', 'Presenti', 'Ritardi', 'Giustificati', 'Assenti', 'Non firmati', 'Tot allenamenti', '% presenza']
      lines = [headers.join(';')]
      for (const r of sorted) {
        lines.push([r.last_name, r.first_name, r.presenti, r.ritardi, r.giustificati, r.assenti, r.non_firmati, r.allenamenti_totali, r.pct_presenza].join(';'))
      }
    } else {
      headers = ['Cognome', 'Nome', 'Convocati', 'Accettate', 'Rifiutate', 'Non risposto', 'Giocate', 'Da titolare', 'Tot partite', '% convocazione']
      lines = [headers.join(';')]
      for (const r of sortedMatches) {
        lines.push([r.last_name, r.first_name, r.convocati, r.accettate, r.rifiutate, r.non_risposto, r.giocate, r.titolare, r.partite_totali, r.pct_convocazione].join(';'))
      }
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab === 'trainings' ? 'presenze' : 'partite'}_${teamName.replace(/\s+/g, '_')}_${from}_${to}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Statistiche · ${teamName}`}>
      <div style={{ padding: '4px 20px 24px' }}>
        {/* Tab switcher Allenamenti / Partite / Registro */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f3fa', padding: 3, borderRadius: 10, marginBottom: 12 }}>
          {(['trainings', 'matches', 'register'] as Tab[]).map(t => {
            const active = tab === t
            const label = t === 'trainings' ? 'Statistiche' : t === 'matches' ? 'Partite' : 'Registro'
            const icon = t === 'trainings' ? 'bar_chart' : t === 'matches' ? 'sports_soccer' : 'grid_on'
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 8,
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#005f98' : '#707882',
                  border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                }}>
                <Icon name={icon} size={12} color={active ? '#005f98' : '#707882'} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Filtro periodo */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Periodo
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#f1f3fa', padding: 3, borderRadius: 10, overflowX: 'auto' }}>
            {(['month', 'quarter', 'season', 'year', 'custom'] as Period[]).map(p => {
              const active = period === p
              return (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{
                    flex: '0 0 auto', padding: '7px 10px', borderRadius: 8,
                    background: active ? '#fff' : 'transparent',
                    color: active ? '#005f98' : '#707882',
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
                    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  }}>{PERIOD_LABELS[p]}</button>
              )
            })}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
            </div>
          )}
          <div style={{ fontSize: 10, color: '#707882', marginTop: 5 }}>
            Dal {formatDate(from)} al {formatDate(to)}
          </div>
        </div>

        {/* Riassunto squadra (solo per training tab, per match ha altra card) */}
        {tab === 'trainings' && (
          <>
            <div style={{
              background: 'linear-gradient(135deg, ' + (teamColor || '#005f98') + ', #003c5e)',
              color: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Media squadra
                </div>
                <div style={{ fontFamily: 'Anybody', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
                  {totals.avgPct.toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11 }}>
                <div><b>{totals.totAllen}</b> allenamenti</div>
                <div><b>{rows.length}</b> giocatori</div>
              </div>
            </div>

            {/* Alert giocatori sotto soglia */}
            {criticalCount > 0 && (
              <div style={{
                background: '#fff8e1', border: '1px solid #ffd54f',
                padding: '10px 12px', borderRadius: 10, marginBottom: 12,
                fontSize: 12, color: '#8e6300',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="warning" size={16} color="#8e6300" />
                <div>
                  <b>{criticalCount} {criticalCount === 1 ? 'giocatore ha' : 'giocatori hanno'}</b> una percentuale di presenza sotto il 60%.
                  Ordina per "% presenza" per vederli in fondo.
                </div>
              </div>
            )}

            {/* Trend mensile squadra */}
            {monthly.filter(m => m.pct_presenza_media != null).length >= 2 && (
              <MonthlyTrendChart data={monthly} color={teamColor || '#005f98'} />
            )}
          </>
        )}

        {tab === 'matches' && (
          <div style={{
            background: 'linear-gradient(135deg, ' + (teamColor || '#005f98') + ', #003c5e)',
            color: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Partite periodo
              </div>
              <div style={{ fontFamily: 'Anybody', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
                {matchRows[0]?.partite_totali ?? 0}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11 }}>
              <div><b>{matchRows.length}</b> giocatori</div>
            </div>
          </div>
        )}

        {/* Sort + Export (non in register) */}
        {tab !== 'register' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 10.5, color: '#707882', fontWeight: 700, marginRight: 4 }}>Ordina:</div>
          {(tab === 'trainings' ? [
            { key: 'presenza', label: '% presenza' },
            { key: 'assenze', label: 'Più assenze' },
            { key: 'nome', label: 'Cognome' },
          ] : [
            { key: 'convocazione', label: '% convocazione' },
            { key: 'assenze', label: 'Rifiuti' },
            { key: 'nome', label: 'Cognome' },
          ]).map(o => (
            <button key={o.key} onClick={() => setSortBy(o.key as SortBy)}
              style={{
                padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                border: sortBy === o.key ? '1px solid #005f98' : '1px solid #d5dae2',
                background: sortBy === o.key ? '#cfe5ff' : '#fff',
                color: sortBy === o.key ? '#004a78' : '#404751',
                fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
              }}>{o.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={exportCsv} disabled={(tab === 'trainings' ? rows : matchRows).length === 0}
            title="Esporta CSV (apribile con Excel)"
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid #005f98',
              background: '#fff', color: '#005f98', cursor: 'pointer',
              fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
              opacity: (tab === 'trainings' ? rows : matchRows).length === 0 ? 0.4 : 1,
            }}>
            <Icon name="download" size={12} color="#005f98" />
            CSV
          </button>
        </div>
        )}

        {/* ============= TAB REGISTRO ============= */}
        {tab === 'register' && !loading && (
          <>
            <div style={{ display: 'flex', gap: 4, background: '#f1f3fa', padding: 3, borderRadius: 10, marginBottom: 10 }}>
              {(['trainings', 'matches'] as const).map(t => {
                const active = registerType === t
                return (
                  <button key={t} onClick={() => setRegisterType(t)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8,
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#005f98' : '#707882',
                      border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    }}>
                    <Icon name={t === 'trainings' ? 'fitness_center' : 'sports_soccer'} size={11} color={active ? '#005f98' : '#707882'} />
                    {t === 'trainings' ? 'Allenamenti' : 'Partite'}
                  </button>
                )
              })}
            </div>
            {registerType === 'trainings'
              ? <AttendanceMatrix data={matrix} onCellClick={(pid, pname) => setTimelinePlayer({ id: pid, name: pname })} />
              : <MatchesMatrix data={matchMatrix} />
            }
          </>
        )}

        {/* Lista giocatori */}
        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13 }}>Calcolo…</div>}

        {!loading && tab === 'trainings' && rows.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
            Nessun giocatore nella squadra.
          </div>
        )}

        {!loading && tab === 'trainings' && totals.totAllen === 0 && rows.length > 0 && (
          <div style={{
            background: '#fff8e1', border: '1px solid #ffd54f',
            padding: '10px 12px', borderRadius: 10, marginBottom: 10,
            fontSize: 11.5, color: '#8e6300',
          }}>
            Nessun allenamento pianificato nel periodo selezionato.
          </div>
        )}

        {!loading && tab === 'trainings' && sorted.map(r => (
          <PlayerStatCard key={r.player_id} row={r}
            onClick={() => setTimelinePlayer({ id: r.player_id, name: `${r.first_name} ${r.last_name}` })}
          />
        ))}

        {!loading && tab === 'matches' && matchRows.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
            Nessun giocatore.
          </div>
        )}

        {!loading && tab === 'matches' && (matchRows[0]?.partite_totali ?? 0) === 0 && matchRows.length > 0 && (
          <div style={{
            background: '#fff8e1', border: '1px solid #ffd54f',
            padding: '10px 12px', borderRadius: 10, marginBottom: 10,
            fontSize: 11.5, color: '#8e6300',
          }}>
            Nessuna partita nel periodo selezionato.
          </div>
        )}

        {!loading && tab === 'matches' && sortedMatches.map(r => (
          <PlayerMatchCard key={r.player_id} row={r} />
        ))}
      </div>

      {/* Timeline dettagliata singolo giocatore */}
      <PlayerAttendanceTimelineSheet
        open={!!timelinePlayer}
        onClose={() => setTimelinePlayer(null)}
        playerId={timelinePlayer?.id ?? null}
        playerName={timelinePlayer?.name ?? ''}
        from={from} to={to}
      />
    </BottomSheet>
  )
}

function PlayerStatCard({ row, onClick }: { row: Row; onClick?: () => void }) {
  const pct = row.pct_presenza
  const color = pct >= 80 ? '#43a047' : pct >= 60 ? '#f9a825' : '#c62828'
  const critical = row.allenamenti_totali > 0 && pct < 60
  return (
    <button onClick={onClick} disabled={!onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        background: '#fff', border: critical ? '1.5px solid #ffab00' : '1px solid #d5dae2',
        borderRadius: 12, padding: 12, marginBottom: 8,
        fontFamily: 'inherit',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 12, flexShrink: 0,
          position: 'relative',
        }}>
          {pct.toFixed(0)}%
          {critical && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ffab00', borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>
              <Icon name="warning" size={9} color="#fff" />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#181c20' }}>
            {row.last_name} {row.first_name}
          </div>
          <div style={{ fontSize: 10.5, color: '#707882' }}>
            Presente in {row.presenti + row.ritardi}/{row.allenamenti_totali} allenamenti
          </div>
        </div>
        {onClick && <Icon name="chevron_right" size={16} color="#707882" />}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {row.presenti > 0 && <Pill label="Presenze" val={row.presenti} bg="rgba(67,160,71,0.15)" color="#2e7d32" />}
        {row.ritardi > 0 && <Pill label="Ritardi" val={row.ritardi} bg="rgba(249,168,37,0.15)" color="#8e6300" />}
        {row.giustificati > 0 && <Pill label="Giustificate" val={row.giustificati} bg="rgba(0,95,152,0.12)" color="#005f98" />}
        {row.assenti > 0 && <Pill label="Assenze" val={row.assenti} bg="rgba(198,40,40,0.15)" color="#c62828" />}
        {row.non_firmati > 0 && <Pill label="Non firmate" val={row.non_firmati} bg="#f1f3fa" color="#707882" />}
      </div>
    </button>
  )
}

function PlayerMatchCard({ row }: { row: MatchRow }) {
  const pct = row.pct_convocazione
  const color = pct >= 70 ? '#005f98' : pct >= 40 ? '#8e6300' : '#707882'
  return (
    <div style={{
      background: '#fff', border: '1px solid #d5dae2',
      borderRadius: 12, padding: 12, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 12, flexShrink: 0,
        }}>
          {pct.toFixed(0)}%
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#181c20' }}>
            {row.last_name} {row.first_name}
          </div>
          <div style={{ fontSize: 10.5, color: '#707882' }}>
            Convocato in {row.convocati}/{row.partite_totali} partite · Giocate {row.giocate}
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 9.5, fontWeight: 800, color: '#707882',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginTop: 6, marginBottom: 4,
      }}>Convocazioni ufficiali</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {row.accettate > 0 && <Pill label="Accettate" val={row.accettate} bg="rgba(67,160,71,0.15)" color="#2e7d32" />}
        {row.rifiutate > 0 && <Pill label="Rifiutate" val={row.rifiutate} bg="rgba(198,40,40,0.15)" color="#c62828" />}
        {row.non_risposto > 0 && <Pill label="Non risposto" val={row.non_risposto} bg="#f1f3fa" color="#707882" />}
        {row.accettate === 0 && row.rifiutate === 0 && row.non_risposto === 0 && (
          <span style={{ fontSize: 10.5, color: '#c0c7d2', fontStyle: 'italic' }}>Nessuna convocazione</span>
        )}
      </div>

      <div style={{
        fontSize: 9.5, fontWeight: 800, color: '#707882',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginTop: 8, marginBottom: 4,
      }}>Disponibilità dichiarata dal giocatore</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {row.risposto_vengo > 0 && <Pill label="Vengo" val={row.risposto_vengo} bg="rgba(67,160,71,0.15)" color="#2e7d32" />}
        {row.risposto_non_vengo > 0 && <Pill label="Non vengo" val={row.risposto_non_vengo} bg="rgba(198,40,40,0.15)" color="#c62828" />}
        {row.risposto_forse > 0 && <Pill label="Forse" val={row.risposto_forse} bg="rgba(249,168,37,0.15)" color="#8e6300" />}
        {row.non_risposto_disponibilita > 0 && <Pill label="Non ha risposto" val={row.non_risposto_disponibilita} bg="#f1f3fa" color="#707882" />}
      </div>
    </div>
  )
}

function MonthlyTrendChart({ data, color }: { data: MonthlyPoint[]; color: string }) {
  // Filtro solo mesi con valore
  const points = data
    .filter(d => d.pct_presenza_media != null)
    .map(d => ({ x: d.month_start, y: d.pct_presenza_media as number }))

  if (points.length < 2) return null

  const width = 320, height = 110, padL = 24, padR = 12, padT = 12, padB = 22
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const yMin = 0, yMax = 100

  const coords = points.map((p, i) => ({
    ...p,
    cx: padL + (i / (points.length - 1)) * plotW,
    cy: padT + plotH - ((p.y - yMin) / (yMax - yMin)) * plotH,
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ')

  const monthLabel = (iso: string) => {
    const d = new Date(iso)
    return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #d5dae2', borderRadius: 12,
      padding: 12, marginBottom: 12,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Trend mensile presenze
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padT + plotH * frac
          const v = yMax - frac * (yMax - yMin)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y}
                stroke="#e6e8ee" strokeWidth={1} strokeDasharray={i === 0 || i === 4 ? '' : '2,3'} />
              <text x={padL - 4} y={y + 3} fontSize={8} fill="#707882" textAnchor="end" fontFamily="inherit">{v}</text>
            </g>
          )
        })}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${pathD} L ${coords[coords.length - 1].cx} ${padT + plotH} L ${coords[0].cx} ${padT + plotH} Z`}
          fill={color} opacity={0.1} />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
            <text x={c.cx} y={height - 4} fontSize={8} fill="#707882" textAnchor="middle" fontFamily="inherit">
              {monthLabel(c.x)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function Pill({ label, val, bg, color }: { label: string; val: number; bg: string; color: string }) {
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
      background: bg, color,
    }}>{val} {label.toLowerCase()}</span>
  )
}

function computePeriod(period: Period, cFrom: string, cTo: string): { from: string; to: string } {
  const today = new Date()
  const to = toIso(today)
  let fromDate: Date
  switch (period) {
    case 'month':
      fromDate = new Date(today); fromDate.setMonth(fromDate.getMonth() - 1); break
    case 'quarter':
      fromDate = new Date(today); fromDate.setMonth(fromDate.getMonth() - 3); break
    case 'year':
      fromDate = new Date(today); fromDate.setFullYear(fromDate.getFullYear() - 1); break
    case 'season':
      // Stagione sportiva: da luglio anno corrente/precedente
      fromDate = today.getMonth() >= 6
        ? new Date(today.getFullYear(), 6, 1)
        : new Date(today.getFullYear() - 1, 6, 1)
      break
    case 'custom':
      return { from: cFrom || toIso(new Date(today.getFullYear(), 0, 1)), to: cTo || to }
  }
  return { from: toIso(fromDate), to }
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: 8,
  border: '1px solid #c0c7d2', fontSize: 12, color: '#181c20',
  fontFamily: 'inherit', background: '#fff', outline: 'none',
}

const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']

// ============= REGISTRO PRESENZE (Matrix) =============
const STATUS_CELL: Record<string, { letter: string; bg: string; color: string; label: string }> = {
  present:  { letter: 'P', bg: '#43a047', color: '#fff', label: 'Presente' },
  late:     { letter: 'R', bg: '#f9a825', color: '#fff', label: 'Ritardo' },
  excused:  { letter: 'G', bg: '#005f98', color: '#fff', label: 'Giustificato' },
  absent:   { letter: 'A', bg: '#c62828', color: '#fff', label: 'Assente' },
}

function AttendanceMatrix({ data, onCellClick }: {
  data: MatrixRow[];
  onCellClick: (playerId: string, playerName: string) => void;
}) {
  // Pivot: estraggo lista unica di trainings ordinati per data + lista unica di players
  const { trainings, players, matrix } = useMemo(() => {
    const trainingMap = new Map<string, { id: string; date: string; time: string | null }>()
    const playerMap = new Map<string, { id: string; last_name: string; first_name: string }>()
    const cellMap: Record<string, string | null> = {}

    for (const r of data) {
      if (!trainingMap.has(r.training_id)) {
        trainingMap.set(r.training_id, { id: r.training_id, date: r.training_date, time: r.training_start_time })
      }
      if (!playerMap.has(r.player_id)) {
        playerMap.set(r.player_id, { id: r.player_id, last_name: r.player_last_name, first_name: r.player_first_name })
      }
      cellMap[`${r.player_id}|${r.training_id}`] = r.status
    }

    const trainings = Array.from(trainingMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
    )
    const players = Array.from(playerMap.values()).sort((a, b) =>
      a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
    )
    return { trainings, players, matrix: cellMap }
  }, [data])

  if (players.length === 0) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
      Nessun giocatore nella squadra.
    </div>
  }

  if (trainings.length === 0) {
    return <div style={{
      background: '#fff8e1', border: '1px solid #ffd54f',
      padding: '10px 12px', borderRadius: 10,
      fontSize: 11.5, color: '#8e6300',
    }}>
      Nessun allenamento nel periodo selezionato.
    </div>
  }

  const NAME_COL_W = 100
  const CELL_W = 30
  const CELL_H = 30

  return (
    <>
      {/* Legenda */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10,
        padding: '8px 10px', background: '#f7f9ff', borderRadius: 8,
      }}>
        {Object.entries(STATUS_CELL).map(([k, m]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 18, height: 18, borderRadius: 4, background: m.bg, color: m.color,
              fontSize: 10, fontWeight: 800, fontFamily: 'Anybody',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.letter}</span>
            <span style={{ fontSize: 10.5, color: '#404751', fontWeight: 700 }}>{m.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4, background: '#f1f3fa', color: '#c0c7d2',
            fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>–</span>
          <span style={{ fontSize: 10.5, color: '#404751', fontWeight: 700 }}>Non firmato</span>
        </div>
      </div>

      {/* Scroll orizzontale registro */}
      <div style={{
        border: '1px solid #d5dae2', borderRadius: 10, overflow: 'hidden',
        background: '#fff',
      }}>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            {/* Header: date */}
            <div style={{ display: 'flex', background: '#f1f3fa', borderBottom: '2px solid #d5dae2', position: 'sticky', top: 0, zIndex: 2 }}>
              <div style={{
                width: NAME_COL_W, minWidth: NAME_COL_W, padding: '6px 8px',
                borderRight: '2px solid #d5dae2', background: '#f1f3fa',
                fontSize: 9.5, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.04em',
                position: 'sticky', left: 0, zIndex: 3,
              }}>Giocatore</div>
              {trainings.map(t => {
                const d = new Date(t.date)
                return (
                  <div key={t.id} style={{
                    width: CELL_W, minWidth: CELL_W, padding: '4px 2px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid #e6e8ee', textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 11, lineHeight: 1, color: '#181c20' }}>
                      {d.getDate()}
                    </div>
                    <div style={{ fontSize: 7.5, color: '#707882', fontWeight: 700, textTransform: 'uppercase' }}>
                      {MONTHS[d.getMonth()]}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rows: giocatori */}
            {players.map((p, rowIdx) => (
              <div key={p.id} style={{
                display: 'flex',
                background: rowIdx % 2 === 0 ? '#fff' : '#fafbff',
                borderBottom: '1px solid #e6e8ee',
              }}>
                <button
                  onClick={() => onCellClick(p.id, `${p.first_name} ${p.last_name}`)}
                  style={{
                    width: NAME_COL_W, minWidth: NAME_COL_W, padding: '6px 8px',
                    background: 'inherit', border: 'none', borderRight: '2px solid #d5dae2',
                    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                    position: 'sticky', left: 0, zIndex: 1,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#181c20', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.last_name}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#707882', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.first_name}
                  </div>
                </button>
                {trainings.map(t => {
                  const status = matrix[`${p.id}|${t.id}`]
                  const meta = status ? STATUS_CELL[status] : null
                  return (
                    <div key={t.id} style={{
                      width: CELL_W, minWidth: CELL_W, height: CELL_H,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid #e6e8ee',
                    }}>
                      {meta ? (
                        <span
                          title={`${meta.label} — ${new Date(t.date).toLocaleDateString('it-IT')}`}
                          style={{
                            width: 22, height: 22, borderRadius: 5,
                            background: meta.bg, color: meta.color,
                            fontSize: 10.5, fontWeight: 800, fontFamily: 'Anybody',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{meta.letter}</span>
                      ) : (
                        <span style={{ color: '#c0c7d2', fontSize: 14, fontWeight: 800 }}>·</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#707882', marginTop: 8, textAlign: 'center' }}>
        Tocca il nome di un giocatore per vedere la sua timeline dettagliata · scorri lateralmente per le date
      </div>
    </>
  )
}

/**
 * MatchesMatrix: registro giocatori × partite.
 * Cella mostra icona/lettera basata su stato:
 *  - Partita passata: 'T' titolare / 'G' giocato / 'P' panchina / '·' non convocato
 *  - Partita futura: 'V' vengo / 'N' non vengo / 'F' forse / '?' non risposto
 * Colonna partita = header con data + avversario.
 */
function MatchesMatrix({ data }: { data: MatchMatrixRow[] }) {
  if (data.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
      Nessuna partita nel periodo selezionato.
    </div>
  )

  // Raggruppo per player + estraggo partite uniche
  const playersMap = new Map<string, { id: string; name: string; cells: Map<string, MatchMatrixRow> }>()
  const matchesMap = new Map<string, { id: string; date: string; opponent: string | null; venue: string | null }>()

  for (const r of data) {
    if (!playersMap.has(r.player_id)) {
      playersMap.set(r.player_id, {
        id: r.player_id,
        name: `${r.player_last_name} ${r.player_first_name}`,
        cells: new Map(),
      })
    }
    playersMap.get(r.player_id)!.cells.set(r.match_id, r)
    if (!matchesMap.has(r.match_id)) {
      matchesMap.set(r.match_id, { id: r.match_id, date: r.match_date, opponent: r.opponent, venue: r.venue })
    }
  }

  const matches = Array.from(matchesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const players = Array.from(playersMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div style={{
        overflowX: 'auto', border: '1px solid #d5dae2', borderRadius: 10, background: '#fff',
      }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, top: 0, zIndex: 3,
                background: '#f7f9ff', padding: '8px 10px', textAlign: 'left',
                fontSize: 10, fontWeight: 800, color: '#404751', textTransform: 'uppercase',
                letterSpacing: '0.05em', minWidth: 130, borderRight: '1px solid #d5dae2',
              }}>Giocatore</th>
              {matches.map(m => {
                const d = new Date(m.date + 'T12:00:00')
                const dd = String(d.getDate()).padStart(2, '0')
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                return (
                  <th key={m.id} style={{
                    background: '#f7f9ff', padding: '6px 4px',
                    fontSize: 10, fontWeight: 700, color: '#404751',
                    borderRight: '1px solid #eef1f5', minWidth: 44,
                  }} title={`${m.opponent || '?'} · ${m.date} · ${m.venue === 'home' ? 'Casa' : 'Trasferta'}`}>
                    <div>{dd}/{mm}</div>
                    <div style={{ fontSize: 8.5, color: '#707882', marginTop: 1, fontWeight: 600 }}>
                      {(m.opponent || '').slice(0, 5)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fbfcfe' }}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: i % 2 === 0 ? '#fff' : '#fbfcfe', padding: '6px 10px',
                  fontSize: 11, fontWeight: 700, color: '#181c20',
                  minWidth: 130, borderRight: '1px solid #d5dae2',
                }}>{p.name}</td>
                {matches.map(m => {
                  const cell = p.cells.get(m.id)
                  const isFuture = m.date >= todayIso
                  const symbol = matchCellSymbol(cell, isFuture)
                  return (
                    <td key={m.id} style={{
                      textAlign: 'center', padding: '2px 4px',
                      borderRight: '1px solid #eef1f5',
                    }}>
                      <div title={symbol.tooltip} style={{
                        width: 26, height: 26, borderRadius: 6,
                        margin: '0 auto',
                        background: symbol.bg, color: symbol.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, fontFamily: 'Anybody',
                      }}>{symbol.letter}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Partite passate
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <MatrixLegend letter="G" bg="rgba(0,95,152,0.2)" color="#005f98" label="Ha giocato" />
          <MatrixLegend letter="P" bg="rgba(249,168,37,0.2)" color="#8e6300" label="Panchina (convocato non giocato)" />
          <MatrixLegend letter="·" bg="#f1f3fa" color="#c0c7d2" label="Non convocato" />
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
          Partite future — risposta giocatore
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <MatrixLegend letter="V" bg="rgba(67,160,71,0.2)" color="#2e7d32" label="Vengo" />
          <MatrixLegend letter="N" bg="rgba(198,40,40,0.2)" color="#c62828" label="Non vengo" />
          <MatrixLegend letter="F" bg="rgba(249,168,37,0.2)" color="#8e6300" label="Forse" />
          <MatrixLegend letter="?" bg="#f1f3fa" color="#707882" label="Non ha risposto" />
        </div>
      </div>
    </>
  )
}

function matchCellSymbol(cell: MatchMatrixRow | undefined, isFuture: boolean): { letter: string; bg: string; color: string; tooltip: string } {
  if (!cell) {
    return { letter: '·', bg: '#f1f3fa', color: '#c0c7d2', tooltip: 'Nessun dato' }
  }
  if (!isFuture) {
    // Passato: mostro cosa è successo effettivamente
    if (cell.played) return { letter: 'G', bg: 'rgba(0,95,152,0.2)', color: '#005f98', tooltip: 'Ha giocato' }
    if (cell.convocation_status === 'accepted' || cell.convocation_status === 'pending')
      return { letter: 'P', bg: 'rgba(249,168,37,0.2)', color: '#8e6300', tooltip: 'Convocato ma non giocato (panchina)' }
    if (cell.convocation_status === 'declined')
      return { letter: 'R', bg: 'rgba(198,40,40,0.15)', color: '#c62828', tooltip: 'Convocato ma rifiutato' }
    return { letter: '·', bg: '#f1f3fa', color: '#c0c7d2', tooltip: 'Non convocato' }
  } else {
    if (cell.response_status === 'yes') return { letter: 'V', bg: 'rgba(67,160,71,0.2)', color: '#2e7d32', tooltip: 'Ha risposto: Vengo' }
    if (cell.response_status === 'no') return { letter: 'N', bg: 'rgba(198,40,40,0.2)', color: '#c62828', tooltip: 'Ha risposto: Non vengo' }
    if (cell.response_status === 'maybe') return { letter: 'F', bg: 'rgba(249,168,37,0.2)', color: '#8e6300', tooltip: 'Ha risposto: Forse' }
    return { letter: '?', bg: '#f1f3fa', color: '#707882', tooltip: 'Non ha ancora risposto' }
  }
}

function MatrixLegend({ letter, bg, color, label }: { letter: string; bg: string; color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, color: '#404751',
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 4, background: bg, color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, fontFamily: 'Anybody',
      }}>{letter}</span>
      {label}
    </span>
  )
}

