/**
 * Pagina Referti partite — vista centralizzata di tutti i post-match report.
 *
 * Perché esiste: prima gli allenatori / analyst arrivavano al PostMatchSheet solo
 * dalla dashboard (una squadra alla volta) o dal calendario (partita per partita).
 * Con più squadre a carico serviva un unico posto per vedere a colpo d'occhio
 * quali partite hanno ancora il referto da compilare.
 *
 * Cosa mostra: elenco di tutte le partite passate delle squadre a cui l'utente ha
 * accesso, ordinate per data (più recente in alto), con badge dello stato del referto
 * (compilato / mancante). Click su una card apre il PostMatchSheet già esistente,
 * popolando tutti i campi necessari inclusa la durata partita per la Timeline.
 *
 * Chi vede questa pagina: solo staff (admin + coach). I parents non hanno accesso.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useMyTeam } from '../hooks/useMyTeam'
import { PostMatchSheet, type PostMatchData } from '../components/PostMatchSheet'
import { Icon } from '../components/Icon'

/**
 * Riga elenco: ogni match arricchito col nome/categoria/colore del team
 * e col conteggio delle stats già compilate (per capire se il referto è pronto).
 */
interface RefertoRow {
  id: string
  match_date: string
  opponent: string
  venue: 'home' | 'away'
  competition: string | null
  team_id: string
  team_name: string
  team_category: string | null
  team_color: string | null
  team_match_periods_count: number | null
  team_match_period_duration_min: number | null
  home_score: number | null
  away_score: number | null
  stats_count: number    // count(match_player_stats) per la partita
  conv_count: number     // count(convocations accepted) per la partita
}

type FiltroStato = 'tutti' | 'da_compilare' | 'compilati'

export function Referti() {
  const { profile } = useAuth()
  const { myTeams, loading: teamsLoading } = useMyTeam()
  const [rows, setRows] = useState<RefertoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openReport, setOpenReport] = useState<PostMatchData | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')  // 'all' = tutte le squadre
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutti')

  // Carica tutte le partite passate delle squadre dell'utente.
  // NB: non uso il join `team:teams(...)` in un unico select perché con l'ordine
  // "SELECT ... FROM matches m JOIN teams t ..." su Supabase la sintassi è
  // via .select con relazione — funziona ma richiede che la FK sia esposta.
  // Preferisco 2 query in parallelo (matches + teams) e merge lato client, più predicibile.
  useEffect(() => {
    if (!profile || teamsLoading) return
    const teamIds = myTeams.map(t => t.id)
    if (teamIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        // Solo partite passate (< now) + solo dei miei team
        // Fetch match + join teams (per nome, categoria, colore, durata partita)
        const { data: matchData, error: matchErr } = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, competition, team_id, home_score, away_score, team:teams(name, category, color, match_periods_count, match_period_duration_min)')
          .in('team_id', teamIds)
          .lt('match_date', new Date().toISOString())
          .order('match_date', { ascending: false })
          .limit(200)  // ultimi 200 referti — più che sufficiente per la stagione
        if (matchErr) throw matchErr
        const matchIds = (matchData ?? []).map(m => m.id)
        if (matchIds.length === 0) {
          setRows([])
          setLoading(false)
          return
        }
        // Fetch conteggi in parallelo (query resilienti — se una fallisce uso {})
        const [statsRes, convRes] = await Promise.all([
          supabase.from('match_player_stats').select('match_id').in('match_id', matchIds),
          supabase.from('convocations').select('match_id').in('match_id', matchIds).eq('status', 'accepted'),
        ])
        const statsCounts: Record<string, number> = {}
        for (const s of statsRes.data ?? []) statsCounts[s.match_id] = (statsCounts[s.match_id] ?? 0) + 1
        const convCounts: Record<string, number> = {}
        for (const c of convRes.data ?? []) convCounts[c.match_id] = (convCounts[c.match_id] ?? 0) + 1

        const enriched: RefertoRow[] = (matchData ?? []).map((m: any) => {
          const t = Array.isArray(m.team) ? m.team[0] : m.team
          return {
            id: m.id,
            match_date: m.match_date,
            opponent: m.opponent,
            venue: m.venue,
            competition: m.competition,
            team_id: m.team_id,
            team_name: t?.name || 'Squadra',
            team_category: t?.category || null,
            team_color: t?.color || null,
            team_match_periods_count: t?.match_periods_count ?? null,
            team_match_period_duration_min: t?.match_period_duration_min ?? null,
            home_score: m.home_score,
            away_score: m.away_score,
            stats_count: statsCounts[m.id] ?? 0,
            conv_count: convCounts[m.id] ?? 0,
          }
        })
        setRows(enriched)
      } catch (err) {
        console.error('[Referti] Errore caricamento', err)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile, myTeams, teamsLoading])

  // Filtri applicati alla lista
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (selectedTeamId !== 'all' && r.team_id !== selectedTeamId) return false
      if (filtroStato === 'da_compilare' && r.stats_count > 0) return false
      if (filtroStato === 'compilati' && r.stats_count === 0) return false
      return true
    })
  }, [rows, selectedTeamId, filtroStato])

  // Conteggi per i badge dei filtri (calcolati sulla lista già filtrata per squadra)
  const conteggi = useMemo(() => {
    const perTeam = rows.filter(r => selectedTeamId === 'all' || r.team_id === selectedTeamId)
    return {
      tutti: perTeam.length,
      da_compilare: perTeam.filter(r => r.stats_count === 0).length,
      compilati: perTeam.filter(r => r.stats_count > 0).length,
    }
  }, [rows, selectedTeamId])

  const handleOpenReport = (r: RefertoRow) => {
    setOpenReport({
      id: r.id,
      opponent: r.opponent,
      match_date: r.match_date,
      venue: r.venue,
      competition: r.competition,
      team_id: r.team_id,
      team_name: r.team_name,
      team_category: r.team_category,
      team_color: r.team_color,
      home_score: r.home_score,
      away_score: r.away_score,
      // Passo i campi durata così la Timeline nel recap si scala correttamente per la categoria
      team_match_periods_count: r.team_match_periods_count,
      team_match_period_duration_min: r.team_match_period_duration_min,
    })
  }

  if (teamsLoading || loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#8993a3' }}>
        Caricamento referti…
      </div>
    )
  }

  if (myTeams.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#8993a3' }}>
        Non hai squadre assegnate: nessun referto da mostrare.
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 12px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Icon name="edit_note" size={26} color="#b3005c" />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1a1a1a' }}>Referti partite</h1>
      </div>
      <p style={{ fontSize: 13, color: '#707882', marginTop: 0, marginBottom: 16 }}>
        Tutte le partite passate delle tue squadre. Le partite senza referto sono evidenziate in giallo —
        tap sulla card per aprire il report e compilare gol, cartellini, sostituzioni e pagelle.
      </p>

      {/* Filtro squadra (solo se >1 team, altrimenti implicito) */}
      {myTeams.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Squadra
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            style={{
              width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10,
              border: '1px solid #c0c7d2', fontSize: 14, fontFamily: 'inherit', background: '#fff',
            }}
          >
            <option value="all">Tutte le squadre ({rows.length})</option>
            {myTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.category ? ` — ${t.category}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filtro stato: segmented control con badge conteggi */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: '#f0f2f5', padding: 4, borderRadius: 10 }}>
        {([
          { key: 'tutti' as const, label: 'Tutti', count: conteggi.tutti },
          { key: 'da_compilare' as const, label: '⚠️ Da compilare', count: conteggi.da_compilare },
          { key: 'compilati' as const, label: '✅ Compilati', count: conteggi.compilati },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFiltroStato(f.key)}
            style={{
              flex: 1, padding: '8px 6px', borderRadius: 7, border: 'none',
              background: filtroStato === f.key ? '#fff' : 'transparent',
              boxShadow: filtroStato === f.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              color: filtroStato === f.key ? '#005f98' : '#404751',
              whiteSpace: 'nowrap',
            }}
          >
            {f.label} <span style={{ fontWeight: 500, color: '#8993a3' }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* Lista referti */}
      {filtered.length === 0 ? (
        <div style={{
          padding: 30, textAlign: 'center', color: '#8993a3', fontSize: 13,
          background: '#f9fafc', borderRadius: 12,
        }}>
          {filtroStato === 'da_compilare'
            ? '🎉 Tutti i referti sono compilati! Bel lavoro.'
            : filtroStato === 'compilati'
            ? 'Nessun referto compilato per questa squadra.'
            : 'Nessuna partita passata da mostrare.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <RefertoCard key={r.id} row={r} onOpen={() => handleOpenReport(r)} />
          ))}
        </div>
      )}

      {/* Sheet Post-Match: apre lo stesso componente usato da dashboard/calendario */}
      <PostMatchSheet
        open={openReport !== null}
        onClose={() => setOpenReport(null)}
        match={openReport}
        onSaved={() => {
          // Al save, ricarico i conteggi per aggiornare i badge da 'mancante' → 'compilato'
          // Piccolo trick: rifaccio il fetch cambiando una dep dell'useEffect... in realtà
          // il modo più semplice è ricaricare tutto tramite window reload leggero, ma qui
          // aggiorno solo lo stats_count in-memory (assumendo che l'utente abbia salvato almeno 1 stat)
          if (openReport) {
            setRows(prev => prev.map(x =>
              x.id === openReport.id && x.stats_count === 0
                ? { ...x, stats_count: 1 }  // marchio come compilato (basta >0)
                : x
            ))
          }
        }}
      />
    </div>
  )
}

/** Card singola del referto: colore del team a sinistra, dati partita al centro, risultato a destra */
function RefertoCard({ row, onOpen }: { row: RefertoRow; onOpen: () => void }) {
  const d = new Date(row.match_date)
  const dataStr = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })
  const oraStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const hasScore = row.home_score != null && row.away_score != null
  const isCompilato = row.stats_count > 0
  const teamColor = row.team_color || '#b3005c'
  const bgBadge = isCompilato ? '#e6f7ea' : '#fff8e0'
  const colorBadge = isCompilato ? '#005520' : '#8e6300'
  const labelBadge = isCompilato ? '✅ Compilato' : '⚠️ Da compilare'

  // Risultato per Lenci: se casa, home_score è nostro; se trasferta, away_score è nostro
  const ourScore = hasScore ? (row.venue === 'home' ? row.home_score : row.away_score) : null
  const theirScore = hasScore ? (row.venue === 'home' ? row.away_score : row.home_score) : null
  const esito = hasScore && ourScore != null && theirScore != null
    ? (ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D')
    : null

  return (
    <button
      onClick={onOpen}
      style={{
        display: 'grid', gridTemplateColumns: '4px 1fr auto',
        gap: 10, alignItems: 'stretch',
        background: '#fff', border: `1px solid ${isCompilato ? '#e0e2e9' : '#f0c040'}`,
        borderRadius: 12, padding: 0, cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', width: '100%',
        boxShadow: isCompilato ? 'none' : '0 1px 3px rgba(240,192,64,0.15)',
      }}
    >
      {/* Barra colorata a sinistra col colore del team */}
      <div style={{ background: teamColor, borderRadius: '12px 0 0 12px' }} />

      {/* Corpo centrale */}
      <div style={{ padding: '10px 4px 10px 10px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: '#fff', background: teamColor,
            padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3,
          }}>
            {row.team_name.toUpperCase()}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: colorBadge, background: bgBadge,
            padding: '2px 6px', borderRadius: 4,
          }}>
            {labelBadge}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.venue === 'home' ? '🏠' : '✈️'} {row.opponent}
        </div>
        <div style={{ fontSize: 11.5, color: '#707882' }}>
          {dataStr} · {oraStr}
          {row.competition && (
            <span style={{ marginLeft: 6, opacity: 0.8 }}>· {row.competition}</span>
          )}
        </div>
      </div>

      {/* Risultato a destra */}
      <div style={{
        padding: '10px 14px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minWidth: 60,
        borderLeft: '1px solid #f0f2f5',
      }}>
        {hasScore ? (
          <>
            <div style={{
              fontSize: 22, fontWeight: 900, color: '#1a1a1a',
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {ourScore}-{theirScore}
            </div>
            {esito && (
              <div style={{
                fontSize: 9, fontWeight: 800, marginTop: 3,
                color: esito === 'W' ? '#005520' : esito === 'L' ? '#8e0000' : '#404751',
              }}>
                {esito === 'W' ? 'VITTORIA' : esito === 'L' ? 'SCONFITTA' : 'PAREGGIO'}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#8993a3', fontStyle: 'italic' }}>
            no risultato
          </div>
        )}
      </div>
    </button>
  )
}
