import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PitchView, type PitchPlayer } from '../components/PitchView'
import { MatchTimeline } from '../components/MatchTimeline'
import { buildTimelineEvents } from '../lib/timelineBuilder'
import { BottomSheet } from '../components/BottomSheet'
import { Icon } from '../components/Icon'

/**
 * Vista dedicata ai giornalisti locali che chiedono distinte e risultati partite.
 * Accessibile SOLO a utenti con profiles.is_journalist=true (le RLS "journalist legge…"
 * filtrano gli accessi lato DB).
 * Layout:
 *  - Selettore squadra (dropdown)
 *  - Lista partite giocate della squadra (dalla più recente, con risultato)
 *  - Tap su una partita → sheet con distinta convocati + tabellino marcatori/cartellini
 * Non ha pulsanti di modifica: read-only.
 */

interface TeamSummary {
  id: string
  name: string
  category: string | null
  color: string | null
  n_published: number
  last_match_date: string | null
  last_result: string | null   // es. "3-1", "0-2"
  last_result_class: 'win' | 'draw' | 'loss' | null
  last_opponent: string | null
  last_scorers: Scorer[]       // marcatori dell'ultima partita pubblicata
}
interface Scorer { name: string; goals: number; minutes: number[] }

interface MatchRow {
  id: string
  match_date: string
  opponent: string
  venue: 'home' | 'away'
  competition: string | null
  home_score: number | null
  away_score: number | null
  location: string | null
  formation?: string | null
  scorers?: Scorer[]
  opponent_own_goals?: number | null
  opponent_own_goal_minutes?: number[] | null
  opponent_goal_minutes?: number[] | null
  captain_change_minute?: number | null
  effective_formation?: string | null
  formation_change_minute?: number | null
}
interface PlayerLite {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  position: string | null
}

export function JournalistPage() {
  const [summaries, setSummaries] = useState<TeamSummary[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(true)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [openMatchId, setOpenMatchId] = useState<string | null>(null)

  // Homepage: carico tutte le squadre + calcolo n. partite pubblicate + ultima
  useEffect(() => {
    (async () => {
      setLoadingSummaries(true)
      const [teamsRes, matchesRes] = await Promise.all([
        supabase.from('teams').select('id, name, category, color').order('name'),
        supabase.from('matches')
          .select('id, team_id, match_date, opponent, venue, home_score, away_score, match_player_stats(goals, goal_minutes, penalties_scored, penalty_minutes, player:players_public(first_name, last_name))')
          .eq('published_for_journalists', true)
          .not('home_score', 'is', null)
          .not('away_score', 'is', null)
          .order('match_date', { ascending: false }),
      ])
      const teams = (teamsRes.data ?? []) as TeamRow[]
      const allMatches = (matchesRes.data ?? []) as Array<{
        id: string; team_id: string; match_date: string; opponent: string;
        venue: 'home'|'away'; home_score: number; away_score: number;
        opponent_own_goals?: number | null; opponent_own_goal_minutes?: number[] | null;
        match_player_stats?: Array<{
          goals: number | null; penalties_scored: number | null;
          goal_minutes?: number[] | null; penalty_minutes?: number[] | null;
          player?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
        }>;
      }>

      // Query separata resiliente per autogol avversari (migration v1.9.55 opzionale)
      try {
        const matchIds = allMatches.map(m => m.id)
        if (matchIds.length > 0) {
          const { data: oogData } = await supabase.from('matches')
            .select('id, opponent_own_goals, opponent_own_goal_minutes')
            .in('id', matchIds)
          const oogMap: Record<string, { g: number | null; m: number[] | null }> = {}
          for (const r of (oogData ?? []) as any[]) {
            oogMap[r.id] = { g: r.opponent_own_goals, m: r.opponent_own_goal_minutes }
          }
          for (const m of allMatches) {
            const rec = oogMap[m.id]
            if (rec) {
              m.opponent_own_goals = rec.g
              m.opponent_own_goal_minutes = rec.m
            }
          }
        }
      } catch (err) {
        // Silenzioso: se la migration non c'è, procediamo senza autogol avversari
        console.warn('[Journalist] opponent_own_goals non caricato', err)
      }

      // Aggrego marcatori per ogni partita (usando solo il cognome + tutti i minuti).
      // Aggiungo anche gli autogol avversari a favore Lenci come voce speciale.
      const scorersOf = (mps: any[], oogMinutes: number[] | null | undefined, oogCount: number | null | undefined): Scorer[] => {
        const map: Record<string, Scorer> = {}
        for (const s of (mps || [])) {
          const tot = (s.goals ?? 0) + (s.penalties_scored ?? 0)
          if (tot === 0) continue
          const pl = Array.isArray(s.player) ? s.player[0] : s.player
          if (!pl) continue
          const name = pl.last_name
          if (!map[name]) map[name] = { name, goals: 0, minutes: [] }
          map[name].goals += tot
          if (Array.isArray(s.goal_minutes)) map[name].minutes.push(...s.goal_minutes)
          if (Array.isArray(s.penalty_minutes)) map[name].minutes.push(...s.penalty_minutes)
        }
        // Autogol avversario: unico entry "aut. avv."
        const oog = oogCount ?? 0
        if (oog > 0) {
          map['__aut_avv__'] = {
            name: 'aut. avversario',
            goals: oog,
            minutes: Array.isArray(oogMinutes) ? [...oogMinutes] : [],
          }
        }
        // Ordino i minuti crescenti per rendering pulito
        for (const k of Object.keys(map)) map[k].minutes.sort((a, b) => a - b)
        // Ordine cronologico: chi ha segnato prima appare prima; senza minuti in fondo per gol desc
        return Object.values(map).sort((a, b) => {
          const fa = a.minutes[0] ?? Infinity
          const fb = b.minutes[0] ?? Infinity
          if (fa !== fb) return fa - fb
          return b.goals - a.goals
        })
      }

      const rows: TeamSummary[] = teams.map(t => {
        const teamMatches = allMatches.filter(m => m.team_id === t.id)
        const last = teamMatches[0] || null
        let lastResult: string | null = null
        let lastClass: TeamSummary['last_result_class'] = null
        let lastScorers: Scorer[] = []
        if (last) {
          const our = last.venue === 'home' ? last.home_score : last.away_score
          const their = last.venue === 'home' ? last.away_score : last.home_score
          lastResult = last.venue === 'home' ? `${last.home_score}-${last.away_score}` : `${last.away_score}-${last.home_score}`
          lastClass = our > their ? 'win' : our < their ? 'loss' : 'draw'
          lastScorers = scorersOf(last.match_player_stats || [], last.opponent_own_goal_minutes, last.opponent_own_goals)
        }
        return {
          id: t.id, name: t.name, category: t.category, color: t.color,
          n_published: teamMatches.length,
          last_match_date: last?.match_date ?? null,
          last_result: lastResult,
          last_result_class: lastClass,
          last_opponent: last?.opponent ?? null,
          last_scorers: lastScorers,
        }
      })
      // Ordino: prima quelle con dati pubblicati, poi le altre
      rows.sort((a, b) => {
        if (a.n_published > 0 && b.n_published === 0) return -1
        if (a.n_published === 0 && b.n_published > 0) return 1
        return a.name.localeCompare(b.name)
      })
      setSummaries(rows)
      setLoadingSummaries(false)
    })()
  }, [])

  // Detail squadra: carico partite pubblicate della squadra scelta CON marcatori
  useEffect(() => {
    if (!selectedTeamId) { setMatches([]); return }
    setLoading(true)
    ;(async () => {
      const { data } = await supabase.from('matches')
        .select('id, match_date, opponent, venue, competition, home_score, away_score, location, formation, match_player_stats(goals, goal_minutes, penalties_scored, penalty_minutes, player:players_public(first_name, last_name))')
        .eq('team_id', selectedTeamId)
        .eq('published_for_journalists', true)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('match_date', { ascending: false })
        .limit(80)
      const raw = (data ?? []) as any[]

      // Query separata resiliente per autogol avversari
      try {
        const matchIds = raw.map(m => m.id)
        if (matchIds.length > 0) {
          const { data: oogData } = await supabase.from('matches')
            .select('id, opponent_own_goals, opponent_own_goal_minutes')
            .in('id', matchIds)
          const oogMap: Record<string, { g: number | null; m: number[] | null }> = {}
          for (const r of (oogData ?? []) as any[]) {
            oogMap[r.id] = { g: r.opponent_own_goals, m: r.opponent_own_goal_minutes }
          }
          for (const m of raw) {
            const rec = oogMap[m.id]
            if (rec) {
              m.opponent_own_goals = rec.g
              m.opponent_own_goal_minutes = rec.m
            }
          }
        }
      } catch (err) {
        console.warn('[Journalist] opponent_own_goals non caricato (detail)', err)
      }
      // Aggrego marcatori per ciascuna partita (con autogol avversari come voce speciale)
      const rows: MatchRow[] = raw.map(m => {
        const scorersMap: Record<string, Scorer> = {}
        for (const s of (m.match_player_stats || [])) {
          const tot = (s.goals ?? 0) + (s.penalties_scored ?? 0)
          if (tot === 0) continue
          const pl = Array.isArray(s.player) ? s.player[0] : s.player
          if (!pl) continue
          const name = pl.last_name
          if (!scorersMap[name]) scorersMap[name] = { name, goals: 0, minutes: [] }
          scorersMap[name].goals += tot
          if (Array.isArray(s.goal_minutes)) scorersMap[name].minutes.push(...s.goal_minutes)
          if (Array.isArray(s.penalty_minutes)) scorersMap[name].minutes.push(...s.penalty_minutes)
        }
        const oog = m.opponent_own_goals ?? 0
        if (oog > 0) {
          scorersMap['__aut_avv__'] = {
            name: 'aut. avversario',
            goals: oog,
            minutes: Array.isArray(m.opponent_own_goal_minutes) ? [...m.opponent_own_goal_minutes] : [],
          }
        }
        for (const k of Object.keys(scorersMap)) scorersMap[k].minutes.sort((a, b) => a - b)
        return {
          id: m.id, match_date: m.match_date, opponent: m.opponent, venue: m.venue,
          competition: m.competition, home_score: m.home_score, away_score: m.away_score,
          location: m.location, formation: m.formation,
          opponent_own_goals: m.opponent_own_goals, opponent_own_goal_minutes: m.opponent_own_goal_minutes,
          scorers: Object.values(scorersMap).sort((a, b) => {
            const fa = a.minutes[0] ?? Infinity
            const fb = b.minutes[0] ?? Infinity
            if (fa !== fb) return fa - fb
            return b.goals - a.goals
          }),
        }
      })
      setMatches(rows)
      setLoading(false)
    })()
  }, [selectedTeamId])

  const selectedTeam = summaries.find(t => t.id === selectedTeamId) || null

  // === HOMEPAGE: dashboard a card per annata ===
  if (!selectedTeamId) {
    return (
      <div style={{ padding: '16px 14px 80px', maxWidth: 780, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: '#005f98', letterSpacing: 0.6,
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            Vista giornalisti
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#181c20' }}>
            ASD Lenci Poirino — Risultati e distinte
          </div>
          <div style={{ fontSize: 12, color: '#707882', marginTop: 4 }}>
            Panoramica di tutte le squadre. Tocca una card per vedere le partite pubblicate,
            distinta e marcatori.
          </div>
        </div>

        {loadingSummaries ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Caricamento squadre…
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {summaries.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                style={{
                  background: '#fff', border: '1px solid #e0e2e9', borderRadius: 12,
                  padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  borderLeft: `4px solid ${t.color || '#005f98'}`,
                }}
              >
                {/* Riga 1: nome squadra + badge count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#181c20' }}>{t.name}</div>
                    {t.category && (
                      <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>{t.category}</div>
                    )}
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 999,
                    background: t.n_published > 0 ? '#e8f0f9' : '#f1f3fa',
                    color: t.n_published > 0 ? '#005f98' : '#707882',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {t.n_published} partit{t.n_published === 1 ? 'a' : 'e'}
                  </div>
                </div>

                {/* Riga 2: ultima partita disponibile o placeholder */}
                {t.n_published === 0 ? (
                  <div style={{
                    padding: '8px 10px', background: '#f8f9fc', borderRadius: 8,
                    fontSize: 11.5, color: '#707882', fontStyle: 'italic',
                  }}>
                    Nessuna partita pubblicata al momento
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 10px', background: '#f8f9fc', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, color: '#707882', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                          Ultima partita ·{' '}
                          {t.last_match_date && new Date(t.last_match_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', marginTop: 2 }}>
                          vs {t.last_opponent}
                        </div>
                      </div>
                      <div style={{
                        minWidth: 54, textAlign: 'center', padding: '4px 8px', borderRadius: 8,
                        background: t.last_result_class === 'win' ? '#d4f2dd'
                          : t.last_result_class === 'loss' ? '#ffdad6' : '#fff3d1',
                        color: t.last_result_class === 'win' ? '#006e25'
                          : t.last_result_class === 'loss' ? '#93000a' : '#8e6300',
                        fontSize: 13, fontWeight: 900,
                      }}>
                        {t.last_result}
                      </div>
                    </div>
                    {/* Marcatori Lenci dell'ultima partita */}
                    {t.last_scorers.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#c73434' }}>sports_soccer</span>
                        <span style={{ fontSize: 11, color: '#404751', fontWeight: 600 }}>
                          {t.last_scorers.map(s => {
                            const min = s.minutes.length > 0 ? ` ${s.minutes.map(m => `${m}'`).join(', ')}` : (s.goals > 1 ? ` (${s.goals})` : '')
                            return `${s.name}${min}`
                          }).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // === DETTAGLIO SQUADRA: lista partite ===
  return (
    <div style={{ padding: '16px 14px 80px', maxWidth: 780, margin: '0 auto' }}>
      {/* Torna alla dashboard */}
      <button
        onClick={() => setSelectedTeamId(null)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, color: '#005f98', fontWeight: 700, padding: '4px 0 10px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <Icon name="arrow_back" size={16} color="#005f98" /> Tutte le squadre
      </button>

      {/* Header squadra selezionata */}
      {selectedTeam && (
        <div style={{
          padding: '12px 14px', background: '#f6f8fc',
          border: '1px solid #e0e2e9', borderRadius: 10,
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
          borderLeft: `4px solid ${selectedTeam.color || '#005f98'}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#181c20' }}>{selectedTeam.name}</div>
            {selectedTeam.category && (
              <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>{selectedTeam.category}</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#707882', fontWeight: 600 }}>
            {matches.length} partit{matches.length === 1 ? 'a' : 'e'} pubblicat{matches.length === 1 ? 'a' : 'e'}
          </div>
        </div>
      )}

      {/* Lista partite */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Caricamento partite…
        </div>
      ) : matches.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Nessuna partita pubblicata per questa squadra.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(m => {
            const our = m.venue === 'home' ? m.home_score! : m.away_score!
            const their = m.venue === 'home' ? m.away_score! : m.home_score!
            const res = our > their ? 'win' : our < their ? 'loss' : 'draw'
            const resColor = res === 'win' ? '#006e25' : res === 'loss' ? '#93000a' : '#8e6300'
            const resBg = res === 'win' ? '#d4f2dd' : res === 'loss' ? '#ffdad6' : '#fff3d1'
            const dateFmt = new Date(m.match_date).toLocaleDateString('it-IT', {
              weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
            })
            return (
              <button
                key={m.id}
                onClick={() => setOpenMatchId(m.id)}
                style={{
                  background: '#fff', border: '1px solid #e0e2e9', borderRadius: 12,
                  padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#707882', fontWeight: 600 }}>
                    {dateFmt} · {m.venue === 'home' ? 'CASA' : 'TRASFERTA'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#181c20', marginTop: 2 }}>
                    {m.venue === 'home' ? 'Lenci' : m.opponent} — {m.venue === 'home' ? m.opponent : 'Lenci'}
                  </div>
                  {m.competition && (
                    <div style={{ fontSize: 11, color: '#707882', marginTop: 2, fontStyle: 'italic' }}>
                      {m.competition}
                    </div>
                  )}
                  {/* Marcatori Lenci per questa partita */}
                  {m.scorers && m.scorers.length > 0 && (
                    <div style={{
                      marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#c73434' }}>sports_soccer</span>
                      <span style={{ fontSize: 11, color: '#404751', fontWeight: 600 }}>
                        {m.scorers.map(s => {
                          const min = s.minutes.length > 0 ? ` ${s.minutes.map(x => `${x}'`).join(', ')}` : (s.goals > 1 ? ` (${s.goals})` : '')
                          return `${s.name}${min}`
                        }).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{
                  minWidth: 62, textAlign: 'center', padding: '8px 10px', borderRadius: 10,
                  background: resBg, color: resColor, fontSize: 16, fontWeight: 900,
                }}>
                  {m.venue === 'home' ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`}
                </div>
                <Icon name="chevron_right" size={16} color="#c0c7d2" />
              </button>
            )
          })}
        </div>
      )}

      {/* Sheet dettaglio partita */}
      {openMatchId && (
        <MatchJournalistSheet
          matchId={openMatchId}
          open={!!openMatchId}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </div>
  )
}

interface TeamRow {
  id: string
  name: string
  category: string | null
  color: string | null
}

/* ---------------- Dettaglio partita: distinta + tabellino ---------------- */

interface Convoc {
  player_id: string
  is_captain: boolean | null
  is_vice_captain: boolean | null
  shirt_number_override: number | null
}
interface Stats {
  player_id: string
  goals: number | null
  goal_minutes: number[] | null
  penalties_scored: number | null
  penalty_minutes: number[] | null
  own_goals: number | null
  own_goal_minutes: number[] | null
  yellow_cards: number | null
  red_card: boolean | null
  red_card_minute: number | null
  minute_in: number | null
  minute_out: number | null
  was_starter: boolean | null
  position_played: string | null
  role_slot: string | null
  slot_index: number | null
  role_slot_label: string | null
}

function MatchJournalistSheet({ matchId, open, onClose }: { matchId: string; open: boolean; onClose: () => void }) {
  const [match, setMatch] = useState<MatchRow | null>(null)
  const [convocs, setConvocs] = useState<Convoc[]>([])
  const [stats, setStats] = useState<Stats[]>([])
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return
    setLoading(true)
    ;(async () => {
      const [mRes, cRes, sRes] = await Promise.all([
        supabase.from('matches')
          .select('id, match_date, opponent, venue, competition, home_score, away_score, location, formation')
          .eq('id', matchId).maybeSingle(),
        supabase.from('convocations')
          .select('player_id, is_captain, is_vice_captain, shirt_number_override')
          .eq('match_id', matchId).eq('status', 'accepted'),
        supabase.from('match_player_stats')
          .select('player_id, goals, goal_minutes, penalties_scored, penalty_minutes, own_goals, own_goal_minutes, yellow_cards, red_card, red_card_minute, minute_in, minute_out, was_starter, position_played, role_slot, slot_index, role_slot_label')
          .eq('match_id', matchId),
      ])
      // Query separata resiliente per autogol avversari + gol subiti + captain_change_minute + effective_formation
      let matchRow = (mRes.data as MatchRow) || null
      try {
        const { data: oogData } = await supabase.from('matches')
          .select('opponent_own_goals, opponent_own_goal_minutes, opponent_goal_minutes, captain_change_minute, effective_formation, formation_change_minute')
          .eq('id', matchId)
          .maybeSingle()
        if (matchRow && oogData) {
          matchRow = {
            ...matchRow,
            opponent_own_goals: (oogData as any).opponent_own_goals,
            opponent_own_goal_minutes: (oogData as any).opponent_own_goal_minutes,
            opponent_goal_minutes: (oogData as any).opponent_goal_minutes,
            captain_change_minute: (oogData as any).captain_change_minute,
            effective_formation: (oogData as any).effective_formation,
            formation_change_minute: (oogData as any).formation_change_minute,
          }
        }
      } catch (err) {
        console.warn('[Journalist] opponent_own_goals/opponent_goal_minutes/captain_change_minute/effective_formation non caricato (match sheet)', err)
      }
      setMatch(matchRow)
      setConvocs((cRes.data ?? []) as Convoc[])
      setStats((sRes.data ?? []) as Stats[])

      // Carico i dati anagrafici NON sensibili dei giocatori coinvolti (vista limitata)
      const pIds = Array.from(new Set([
        ...(cRes.data ?? []).map(c => c.player_id),
        ...(sRes.data ?? []).map(s => s.player_id),
      ]))
      if (pIds.length > 0) {
        const { data: pData } = await supabase.from('players_public')
          .select('id, team_id, first_name, last_name, jersey_number, position')
          .in('id', pIds)
        const map: Record<string, PlayerLite> = {}
        for (const p of (pData ?? []) as PlayerLite[]) map[p.id] = p
        setPlayers(map)
      }
      setLoading(false)
    })()
  }, [matchId])

  const scorers = stats
    .filter(s => (s.goals ?? 0) + (s.penalties_scored ?? 0) > 0)
    .map(s => {
      const allMin = [...(s.goal_minutes ?? []), ...(s.penalty_minutes ?? [])].sort((a, b) => a - b)
      return {
        kind: 'player' as const,
        player_id: s.player_id,
        tot: (s.goals ?? 0) + (s.penalties_scored ?? 0),
        penalties_scored: s.penalties_scored ?? 0,
        goal_minutes: s.goal_minutes,
        penalty_minutes: s.penalty_minutes,
        firstMin: allMin[0] ?? Infinity,
      }
    })
  // Aggiungo eventuale autogol avversario come voce speciale
  const oogCount = match?.opponent_own_goals ?? 0
  const oogMinutes = (match?.opponent_own_goal_minutes ?? []).slice().sort((a, b) => a - b)
  const scorersAll: Array<
    | { kind: 'player'; player_id: string; tot: number; penalties_scored: number; goal_minutes?: number[] | null; penalty_minutes?: number[] | null; firstMin: number }
    | { kind: 'oog'; tot: number; minutes: number[]; firstMin: number }
  > = [...scorers]
  if (oogCount > 0) {
    scorersAll.push({ kind: 'oog', tot: oogCount, minutes: oogMinutes, firstMin: oogMinutes[0] ?? Infinity })
  }
  // Ordine cronologico: chi ha segnato prima appare prima; senza minuti in fondo per gol totali desc
  scorersAll.sort((a, b) => {
    if (a.firstMin !== b.firstMin) return a.firstMin - b.firstMin
    return b.tot - a.tot
  })

  const yellowCards = stats.filter(s => (s.yellow_cards ?? 0) > 0)
  const redCards = stats.filter(s => s.red_card)
  const ownGoals = stats
    .filter(s => (s.own_goals ?? 0) > 0)
    .map(s => ({ ...s, firstMin: (s.own_goal_minutes ?? []).slice().sort((a, b) => a - b)[0] ?? Infinity }))
    .sort((a, b) => a.firstMin - b.firstMin)

  // Ordine posizionale dal portiere in avanti (segue la logica del modulo tattico)
  const POSITION_ORDER: Record<string, number> = {
    'Portiere': 1,
    'Difensore centrale': 10,
    'Terzino destro': 11,
    'Terzino sinistro': 12,
    'Mediano': 20,
    'Centrocampista centrale': 21,
    'Interno destro': 22,
    'Interno sinistro': 23,
    'Esterno destro': 24,
    'Esterno sinistro': 25,
    'Trequartista': 30,
    'Ala destra': 40,
    'Ala sinistra': 41,
    'Punta centrale': 50,
    'Seconda punta': 51,
  }
  const positionRank = (posName: string | null | undefined): number => {
    if (!posName) return 999
    return POSITION_ORDER[posName] ?? 999
  }
  const sortByRole = (a: Convoc, b: Convoc) => {
    const sa = stats.find(x => x.player_id === a.player_id)
    const sb = stats.find(x => x.player_id === b.player_id)
    const ra = positionRank(sa?.position_played)
    const rb = positionRank(sb?.position_played)
    if (ra !== rb) return ra - rb
    // Fallback su numero maglia
    const na = a.shirt_number_override ?? players[a.player_id]?.jersey_number ?? 999
    const nb = b.shirt_number_override ?? players[b.player_id]?.jersey_number ?? 999
    if (na !== nb) return na - nb
    // Ultimo fallback: cognome
    return (players[a.player_id]?.last_name ?? '').localeCompare(players[b.player_id]?.last_name ?? '')
  }

  const starters = convocs.filter(c => stats.find(s => s.player_id === c.player_id)?.was_starter).sort(sortByRole)
  const bench = convocs.filter(c => !stats.find(s => s.player_id === c.player_id)?.was_starter).sort(sortByRole)
  const nome = (pid: string) => {
    const p = players[pid]
    return p ? `${p.last_name} ${p.first_name}` : '?'
  }
  const numero = (pid: string, override: number | null) => {
    const n = override ?? players[pid]?.jersey_number
    return n ? `#${n}` : ''
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Dettaglio partita">
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#707882' }}>Caricamento…</div>
      ) : !match ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#707882' }}>Partita non trovata.</div>
      ) : (
        <div style={{ padding: '12px 14px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Riepilogo */}
          <div style={{
            padding: 14, background: '#005f98', color: '#fff', borderRadius: 12,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85 }}>
              {new Date(match.match_date).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}
              {match.venue === 'home' ? 'IN CASA' : 'IN TRASFERTA'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {match.venue === 'home' ? 'Lenci Poirino' : match.opponent}
              {' '}
              <span style={{ fontSize: 26 }}>{match.venue === 'home' ? `${match.home_score}-${match.away_score}` : `${match.away_score}-${match.home_score}`}</span>
              {' '}
              {match.venue === 'home' ? match.opponent : 'Lenci Poirino'}
            </div>
            {match.competition && (
              <div style={{ fontSize: 12, opacity: 0.9, fontStyle: 'italic' }}>{match.competition}</div>
            )}
            {match.location && (
              <div style={{ fontSize: 12, opacity: 0.85 }}>📍 {match.location}</div>
            )}
            {match.formation && (
              <div style={{
                marginTop: 4, display: 'inline-flex', alignSelf: 'flex-start',
                padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.2)',
                fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
              }}>
                MODULO {match.formation}
              </div>
            )}
          </div>

          {/* Marcatori */}
          <Section title="Marcatori Lenci" icon="sports_soccer" empty="Nessun marcatore registrato">
            {scorersAll.length === 0 ? null : scorersAll.map((s, idx) => {
              if (s.kind === 'oog') {
                return (
                  <ScorerRow key={'oog-' + idx}
                    name="aut. avversario"
                    total={s.tot}
                    penalties={0}
                    minutes={s.minutes}
                    italic
                  />
                )
              }
              return (
                <ScorerRow key={s.player_id}
                  name={nome(s.player_id)}
                  total={s.tot}
                  penalties={s.penalties_scored ?? 0}
                  minutes={[...(s.goal_minutes ?? []), ...(s.penalty_minutes ?? [])].sort((a, b) => a - b)}
                />
              )
            })}
          </Section>

          {/* Autoreti */}
          {ownGoals.length > 0 && (
            <Section title="Autoreti Lenci" icon="warning" empty="">
              {ownGoals.map(s => (
                <ScorerRow key={s.player_id} name={nome(s.player_id)} total={s.own_goals ?? 0} penalties={0}
                  minutes={[...(s.own_goal_minutes ?? [])].sort((a, b) => a - b)}
                  suffix=" (aut.)" />
              ))}
            </Section>
          )}

          {/* Cartellini */}
          {(yellowCards.length > 0 || redCards.length > 0) && (
            <Section title="Cartellini" icon="rectangle" empty="">
              {yellowCards.map(s => (
                <div key={'y-' + s.player_id} style={rowStyle}>
                  <span style={{ ...badge, background: '#f5b800', color: '#181c20' }}>
                    {(s.yellow_cards ?? 0) > 1 ? `${s.yellow_cards} 🟨` : '🟨'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{nome(s.player_id)}</span>
                </div>
              ))}
              {redCards.map(s => (
                <div key={'r-' + s.player_id} style={rowStyle}>
                  <span style={{ ...badge, background: '#93000a', color: '#fff' }}>🟥</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{nome(s.player_id)}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Distinta - Campo grafico */}
          {starters.length > 0 && match?.formation && (() => {
            // Costruisco i player per il PitchView usando role_slot da stats + capitani da convocs
            // Includo le sostituzioni: per ogni titolare uscito, trovo chi è entrato al suo minute_out
            const subsByMin: Record<number, { last_name: string; jersey_number: number | null }> = {}
            for (const c of convocs) {
              const s = stats.find(x => x.player_id === c.player_id)
              if (s && !s.was_starter && s.minute_in != null && s.minute_in > 0) {
                const p = players[c.player_id]
                if (p) {
                  subsByMin[s.minute_in] = {
                    last_name: p.last_name,
                    jersey_number: c.shirt_number_override ?? p.jersey_number,
                  }
                }
              }
            }
            const pitchPlayers: PitchPlayer[] = starters
              .map(c => {
                const s = stats.find(x => x.player_id === c.player_id)
                const player = players[c.player_id]
                if (!s?.role_slot || !player) return null
                const substituted = s.minute_out != null && s.minute_out > 0 ? subsByMin[s.minute_out] : null
                return {
                  slot_key: s.role_slot,
                  slot_label: s.role_slot_label || '',
                  jersey_number: c.shirt_number_override ?? player.jersey_number,
                  last_name: player.last_name,
                  first_name: player.first_name,
                  is_captain: !!c.is_captain,
                  is_vice_captain: !!c.is_vice_captain,
                  minute_out: s.minute_out,
                  substituted_by: substituted?.last_name ?? null,
                  substituted_by_number: substituted?.jersey_number ?? null,
                } as PitchPlayer
              })
              .filter((p): p is PitchPlayer => p !== null)
            if (pitchPlayers.length === 0) return null
            return (
              <div style={{
                margin: '10px 0', borderRadius: 12, overflow: 'hidden',
                border: '1px solid #e6e8ee',
              }}>
                <div style={{
                  padding: '8px 12px', background: '#f8f9fc', borderBottom: '1px solid #e6e8ee',
                  fontSize: 11, fontWeight: 700, color: '#404751',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>📋 Modulo: <strong>{match.formation}</strong></span>
                  {match.effective_formation && match.effective_formation !== match.formation && (
                    <span style={{ color: '#8e6300', fontSize: 10.5 }}>
                      → {match.effective_formation}
                      {match.formation_change_minute && ` (dal ${match.formation_change_minute}\u2032)`}
                    </span>
                  )}
                </div>
                <PitchView
                  formation={match.formation}
                  players={pitchPlayers}
                  height={340}
                />
              </div>
            )
          })()}

          {/* Timeline eventi grafica: gol Lenci/subiti + rossi + sostituzioni sull'asse 0'-90' */}
          {match && (() => {
            const { events, yellowCardsCount } = buildTimelineEvents({
              stats: stats.map(s => ({
                player_id: s.player_id,
                was_starter: s.was_starter,
                minute_in: s.minute_in,
                minute_out: s.minute_out,
                goals: s.goals ?? 0,
                goal_minutes: s.goal_minutes,
                penalties_scored: s.penalties_scored ?? 0,
                penalty_minutes: s.penalty_minutes,
                own_goals: s.own_goals ?? 0,
                own_goal_minutes: s.own_goal_minutes,
                yellow_cards: s.yellow_cards ?? 0,
                red_card: s.red_card ?? false,
                red_card_minute: s.red_card_minute,
              })),
              players,
              opponentGoalMinutes: match.opponent_goal_minutes ?? [],
              opponentOwnGoalMinutes: match.opponent_own_goal_minutes ?? [],
            })
            if (events.length === 0 && yellowCardsCount === 0) return null
            return (
              <div style={{ margin: '10px 0' }}>
                <MatchTimeline events={events} yellowCardsCount={yellowCardsCount} />
              </div>
            )
          })()}

          {/* Distinta - Titolari */}
          <Section title={`Titolari (${starters.length})`} icon="group" empty="Nessuna distinta registrata">
            {starters.map(c => {
              const s = stats.find(x => x.player_id === c.player_id)
              // Notazione fascia: se capitano_change_minute è valorizzato il capitano
              // ha ceduto la fascia al vice al minuto X
              const capChangeAt = match?.captain_change_minute ?? null
              let captainBadge: React.ReactNode = null
              if (c.is_captain) {
                captainBadge = capChangeAt
                  ? <span title={`Capitano fino al ${capChangeAt}'`} style={{ color: '#8e6300' }}>(C fino al {capChangeAt}')</span>
                  : <span title="Capitano" style={{ color: '#8e6300' }}>(C)</span>
              } else if (c.is_vice_captain) {
                captainBadge = capChangeAt
                  ? <span title={`Fascia dal ${capChangeAt}'`} style={{ color: '#005f98' }}>(C dal {capChangeAt}')</span>
                  : <span title="Vice capitano" style={{ color: '#005f98' }}>(VC)</span>
              }
              return (
                <div key={c.player_id} style={rowStyle}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#005f98', minWidth: 30 }}>
                    {numero(c.player_id, c.shirt_number_override)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {nome(c.player_id)} {captainBadge}
                    </div>
                    {s?.position_played && (
                      <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
                        {s.position_played}
                      </div>
                    )}
                  </div>
                  {s?.minute_out != null && (
                    <span style={{ fontSize: 11, color: '#707882' }}>→ uscito {s.minute_out}'</span>
                  )}
                </div>
              )
            })}
          </Section>

          {/* Panchina */}
          {bench.length > 0 && (
            <Section title={`Panchina / subentrati (${bench.length})`} icon="event_seat" empty="">
              {bench.map(c => {
                const s = stats.find(x => x.player_id === c.player_id)
                const capChangeAt = match?.captain_change_minute ?? null
                let viceBadge: React.ReactNode = null
                if (c.is_vice_captain) {
                  viceBadge = capChangeAt
                    ? <span title={`Fascia dal ${capChangeAt}'`} style={{ color: '#005f98', marginLeft: 4 }}>(C dal {capChangeAt}')</span>
                    : <span title="Vice capitano" style={{ color: '#005f98', marginLeft: 4 }}>(VC)</span>
                }
                return (
                  <div key={c.player_id} style={rowStyle}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#404751', minWidth: 30 }}>
                      {numero(c.player_id, c.shirt_number_override)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                      {nome(c.player_id)}{viceBadge}
                    </span>
                    {s?.minute_in != null && (
                      <span style={{ fontSize: 11, color: '#707882' }}>entrato {s.minute_in}'</span>
                    )}
                  </div>
                )
              })}
            </Section>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/* ---------------- Piccoli helper UI ---------------- */

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 10px', background: '#f8f9fc', borderRadius: 8,
}
const badge: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
  minWidth: 28, textAlign: 'center',
}

function Section({
  title, icon, empty, children,
}: {
  title: string; icon: string; empty: string; children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children
  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e2e9', borderRadius: 12, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005f98' }}>{icon}</span>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{title}</div>
      </div>
      {!hasChildren && empty ? (
        <div style={{ fontSize: 11.5, color: '#707882', fontStyle: 'italic', padding: '4px 2px' }}>
          {empty}
        </div>
      ) : children}
    </div>
  )
}

function ScorerRow({ name, total, penalties, minutes, suffix, italic }: {
  name: string; total: number; penalties?: number; minutes?: number[]; suffix?: string; italic?: boolean
}) {
  const mins = minutes && minutes.length > 0 ? minutes.map(m => `${m}'`).join(', ') : ''
  return (
    <div style={rowStyle}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c73434' }}>sports_soccer</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontStyle: italic ? 'italic' : 'normal' }}>
          {name}{suffix || ''}
        </div>
        {mins && (
          <div style={{ fontSize: 11, color: '#707882', marginTop: 1, fontWeight: 600 }}>
            {mins}
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#181c20' }}>
        {total > 1 ? `×${total}` : ''}
        {penalties ? ` (${penalties} rig.)` : ''}
      </span>
    </div>
  )
}
