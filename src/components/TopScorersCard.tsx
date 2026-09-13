import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Mostra la classifica dei primi 3 marcatori di una squadra (stagione corrente
 * di fatto: tutte le partite associate al team_id). Aggregata sui referti
 * partita compilati (match_player_stats): gol su azione + gol su rigore.
 * Non mostra autogol nei totali dei singoli marcatori (né considera partite
 * senza referto compilato).
 * Se nessun giocatore ha ancora segnato, il componente non renderizza nulla.
 */

interface TopScorer {
  playerId: string
  fullName: string
  goalsRegular: number
  goalsPenalty: number
  total: number
}

interface Props {
  teamId: string
}

export function TopScorersCard({ teamId }: Props) {
  const [scorers, setScorers] = useState<TopScorer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    const load = async () => {
      // Aggregazione lato client: prendo tutte le stat con match_id di quel team
      // (Supabase permette filtro su relazione con !inner)
      const { data, error } = await supabase
        .from('match_player_stats')
        .select('player_id, goals, penalties_scored, match:matches!inner(team_id), player:players(first_name, last_name)')
        .eq('match.team_id', teamId)
      if (error || !data) { setScorers([]); setLoading(false); return }

      // Aggrego per player_id
      const agg: Record<string, TopScorer> = {}
      for (const row of data as any[]) {
        const pid = row.player_id
        const g = row.goals ?? 0
        const p = row.penalties_scored ?? 0
        if (g === 0 && p === 0) continue  // salto righe di sole presenze
        if (!agg[pid]) {
          const pl = Array.isArray(row.player) ? row.player[0] : row.player
          const fullName = pl ? `${pl.last_name} ${pl.first_name}` : '?'
          agg[pid] = { playerId: pid, fullName, goalsRegular: 0, goalsPenalty: 0, total: 0 }
        }
        agg[pid].goalsRegular += g
        agg[pid].goalsPenalty += p
        agg[pid].total += g + p
      }

      const sorted = Object.values(agg).sort((a, b) => b.total - a.total).slice(0, 3)
      setScorers(sorted)
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) return null
  if (scorers.length === 0) return null

  const podiumColor = ['#f5b800', '#a6a9ad', '#c98a5c']  // oro / argento / bronzo
  const podiumBg    = ['#fff8e0', '#f0f1f3', '#f9ede2']

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#c73434' }}>sports_soccer</span>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20' }}>
          Top marcatori squadra
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scorers.map((s, i) => (
          <div key={s.playerId} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: podiumBg[i],
            borderRadius: 10,
            borderLeft: `4px solid ${podiumColor[i]}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: podiumColor[i], color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900,
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                {s.fullName}
              </div>
              <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
                {s.goalsRegular} su azione{s.goalsPenalty > 0 ? ` · ${s.goalsPenalty} su rigore` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#181c20' }}>{s.total}</span>
              <span style={{ fontSize: 10, color: '#707882', fontWeight: 700 }}>GOL</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
