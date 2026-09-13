import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Vista statistiche completa di una squadra.
 * Renderizza:
 *  - KPI riepilogativi: partite giocate, vinte, pareggiate, perse
 *  - Classifica top 3 marcatori (goals + penalties_scored)
 *  - Classifica top 3 espulsi (red_card = true)
 *  - Classifica top 3 ammoniti (SUM yellow_cards)
 * Le partite "giocate" sono quelle con both home_score e away_score valorizzati
 * (referto o solo risultato inserito). Le classifiche sono aggregate dai
 * match_player_stats dei match della squadra.
 */

interface Ranking {
  playerId: string
  fullName: string
  count: number
  breakdown?: string   // testo dettaglio opzionale
}

interface Kpi {
  played: number
  won: number
  drawn: number
  lost: number
}

interface Props {
  teamId: string
  /** Se impostato, viene invocato quando l'utente clicca su un KPI risultato */
  onKpiClick?: (filter: 'won' | 'drawn' | 'lost') => void
}

export function TeamStatsCard({ teamId, onKpiClick }: Props) {
  const [kpi, setKpi] = useState<Kpi>({ played: 0, won: 0, drawn: 0, lost: 0 })
  const [scorers, setScorers] = useState<Ranking[]>([])
  const [sentOff, setSentOff] = useState<Ranking[]>([])
  const [booked, setBooked] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    const load = async () => {
      // 1) KPI partite: prendo tutte le partite giocate della squadra
      //    (venue home/away + home_score + away_score valorizzati)
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, venue, home_score, away_score')
        .eq('team_id', teamId)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)

      const nextKpi: Kpi = { played: 0, won: 0, drawn: 0, lost: 0 }
      for (const m of (matchesData ?? []) as any[]) {
        const hs = m.home_score
        const as = m.away_score
        if (hs == null || as == null) continue
        nextKpi.played++
        // Se venue = 'home' Lenci ha giocato in casa (home_score è nostro)
        // altrimenti Lenci ha giocato in trasferta (away_score è nostro)
        const our = m.venue === 'home' ? hs : as
        const their = m.venue === 'home' ? as : hs
        if (our > their) nextKpi.won++
        else if (our === their) nextKpi.drawn++
        else nextKpi.lost++
      }
      setKpi(nextKpi)

      // 2) Classifiche dai match_player_stats — filtro sulle partite della squadra
      const { data: statsData } = await supabase
        .from('match_player_stats')
        .select('player_id, goals, penalties_scored, yellow_cards, red_card, match:matches!inner(team_id), player:players(first_name, last_name)')
        .eq('match.team_id', teamId)

      // Aggregatori per player_id
      const scorersMap: Record<string, { fullName: string; g: number; p: number }> = {}
      const sentOffMap: Record<string, { fullName: string; c: number }> = {}
      const bookedMap: Record<string, { fullName: string; c: number }> = {}

      for (const row of (statsData ?? []) as any[]) {
        const pid = row.player_id
        const pl = Array.isArray(row.player) ? row.player[0] : row.player
        const fullName = pl ? `${pl.last_name} ${pl.first_name}` : '?'
        const g = row.goals ?? 0
        const p = row.penalties_scored ?? 0
        const yc = row.yellow_cards ?? 0
        const rc = !!row.red_card

        if (g > 0 || p > 0) {
          if (!scorersMap[pid]) scorersMap[pid] = { fullName, g: 0, p: 0 }
          scorersMap[pid].g += g
          scorersMap[pid].p += p
        }
        if (rc) {
          if (!sentOffMap[pid]) sentOffMap[pid] = { fullName, c: 0 }
          sentOffMap[pid].c += 1
        }
        if (yc > 0) {
          if (!bookedMap[pid]) bookedMap[pid] = { fullName, c: 0 }
          bookedMap[pid].c += yc
        }
      }

      setScorers(
        Object.entries(scorersMap)
          .map(([pid, v]) => ({
            playerId: pid, fullName: v.fullName,
            count: v.g + v.p,
            breakdown: `${v.g} su azione${v.p > 0 ? ` · ${v.p} su rigore` : ''}`,
          }))
          .sort((a, b) => b.count - a.count).slice(0, 3)
      )
      setSentOff(
        Object.entries(sentOffMap)
          .map(([pid, v]) => ({ playerId: pid, fullName: v.fullName, count: v.c }))
          .sort((a, b) => b.count - a.count).slice(0, 3)
      )
      setBooked(
        Object.entries(bookedMap)
          .map(([pid, v]) => ({ playerId: pid, fullName: v.fullName, count: v.c }))
          .sort((a, b) => b.count - a.count).slice(0, 3)
      )
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
        Caricamento statistiche…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* KPI PARTITE */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
      }}>
        <KpiTile label="Giocate" value={kpi.played} color="#005f98" bg="#e8f0f9" />
        <KpiTile label="Vinte"   value={kpi.won}    color="#006e25" bg="#d4f2dd" onClick={onKpiClick ? () => onKpiClick('won') : undefined} />
        <KpiTile label="Pareggi" value={kpi.drawn}  color="#8e6300" bg="#fff3d1" onClick={onKpiClick ? () => onKpiClick('drawn') : undefined} />
        <KpiTile label="Perse"   value={kpi.lost}   color="#93000a" bg="#ffdad6" onClick={onKpiClick ? () => onKpiClick('lost') : undefined} />
      </div>

      {/* RANKING marcatori */}
      <RankingCard
        title="Top marcatori"
        icon="sports_soccer"
        iconColor="#c73434"
        rows={scorers}
        emptyLabel="Nessun gol registrato"
        unitLabel="GOL"
      />

      {/* RANKING ammoniti */}
      <RankingCard
        title="Top ammoniti"
        icon="rectangle"
        iconColor="#f5b800"
        rows={booked}
        emptyLabel="Nessuna ammonizione"
        unitLabel="AMM"
      />

      {/* RANKING espulsi */}
      <RankingCard
        title="Top espulsi"
        icon="dangerous"
        iconColor="#93000a"
        rows={sentOff}
        emptyLabel="Nessuna espulsione"
        unitLabel="ESP"
      />
    </div>
  )
}

function KpiTile({ label, value, color, bg, onClick }: { label: string; value: number; color: string; bg: string; onClick?: () => void }) {
  const Comp: any = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${color}22`,
        borderRadius: 12,
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#404751', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </Comp>
  )
}

function RankingCard({
  title, icon, iconColor, rows, emptyLabel, unitLabel,
}: {
  title: string
  icon: string
  iconColor: string
  rows: Ranking[]
  emptyLabel: string
  unitLabel: string
}) {
  const podiumColor = ['#f5b800', '#a6a9ad', '#c98a5c']
  const podiumBg    = ['#fff8e0', '#f0f1f3', '#f9ede2']

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: iconColor }}>{icon}</span>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{title}</div>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '4px 2px 2px', fontSize: 11.5, color: '#707882', fontStyle: 'italic' }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rows.map((r, i) => (
            <div key={r.playerId} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 9px',
              background: podiumBg[i],
              borderRadius: 8,
              borderLeft: `4px solid ${podiumColor[i]}`,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: podiumColor[i], color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, flexShrink: 0,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>{r.fullName}</div>
                {r.breakdown && (
                  <div style={{ fontSize: 10, color: '#707882', marginTop: 1 }}>{r.breakdown}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#181c20' }}>{r.count}</span>
                <span style={{ fontSize: 9, color: '#707882', fontWeight: 700 }}>{unitLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
