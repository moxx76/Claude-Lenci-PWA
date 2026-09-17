import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
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

interface TeamRow {
  id: string
  name: string
  category: string | null
  color: string | null
}
interface MatchRow {
  id: string
  match_date: string
  opponent: string
  venue: 'home' | 'away'
  competition: string | null
  home_score: number | null
  away_score: number | null
  location: string | null
}
interface PlayerLite {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  position: string | null
}

export function JournalistPage() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [openMatchId, setOpenMatchId] = useState<string | null>(null)

  // Carico squadre disponibili al giornalista
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('teams')
        .select('id, name, category, color')
        .order('name')
      setTeams((data ?? []) as TeamRow[])
      if (data && data.length > 0 && !selectedTeamId) setSelectedTeamId(data[0].id)
    })()
  }, [])

  // Carico partite giocate della squadra selezionata
  useEffect(() => {
    if (!selectedTeamId) return
    setLoading(true)
    ;(async () => {
      const { data } = await supabase.from('matches')
        .select('id, match_date, opponent, venue, competition, home_score, away_score, location')
        .eq('team_id', selectedTeamId)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('match_date', { ascending: false })
        .limit(80)
      setMatches((data ?? []) as MatchRow[])
      setLoading(false)
    })()
  }, [selectedTeamId])

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || null

  return (
    <div style={{ padding: '16px 14px 80px', maxWidth: 780, margin: '0 auto' }}>
      {/* Header */}
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
          Seleziona una squadra per vedere l'elenco delle partite giocate con distinta e marcatori.
        </div>
      </div>

      {/* Selettore squadra */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#404751', letterSpacing: 0.3 }}>
          SQUADRA
        </label>
        <select
          value={selectedTeamId}
          onChange={e => setSelectedTeamId(e.target.value)}
          style={{
            width: '100%', marginTop: 6,
            padding: '11px 12px', borderRadius: 10, border: '1px solid #c0c7d2',
            fontSize: 14, fontWeight: 600, color: '#181c20', background: '#fff',
            fontFamily: 'inherit',
          }}
        >
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.category ? ` · ${t.category}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Header squadra selezionata */}
      {selectedTeam && (
        <div style={{
          padding: '10px 14px', background: '#f6f8fc',
          border: '1px solid #e0e2e9', borderRadius: 10,
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: 999,
            background: selectedTeam.color || '#005f98',
          }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20' }}>
            {selectedTeam.name}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#707882', fontWeight: 600 }}>
            {matches.length} partit{matches.length === 1 ? 'a' : 'e'} giocat{matches.length === 1 ? 'a' : 'e'}
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
          Nessuna partita giocata con risultato registrato per questa squadra.
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

/* ---------------- Dettaglio partita: distinta + tabellino ---------------- */

interface Convoc {
  player_id: string
  is_captain: boolean | null
  shirt_number_override: number | null
}
interface Stats {
  player_id: string
  goals: number | null
  penalties_scored: number | null
  own_goals: number | null
  yellow_cards: number | null
  red_card: boolean | null
  minute_in: number | null
  minute_out: number | null
  was_starter: boolean | null
  position_played: string | null
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
          .select('id, match_date, opponent, venue, competition, home_score, away_score, location')
          .eq('id', matchId).maybeSingle(),
        supabase.from('convocations')
          .select('player_id, is_captain, shirt_number_override')
          .eq('match_id', matchId).eq('status', 'accepted'),
        supabase.from('match_player_stats')
          .select('player_id, goals, penalties_scored, own_goals, yellow_cards, red_card, minute_in, minute_out, was_starter, position_played')
          .eq('match_id', matchId),
      ])
      setMatch((mRes.data as MatchRow) || null)
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
    .map(s => ({ ...s, tot: (s.goals ?? 0) + (s.penalties_scored ?? 0) }))
    .sort((a, b) => b.tot - a.tot)

  const yellowCards = stats.filter(s => (s.yellow_cards ?? 0) > 0)
  const redCards = stats.filter(s => s.red_card)
  const ownGoals = stats.filter(s => (s.own_goals ?? 0) > 0)

  const starters = convocs.filter(c => stats.find(s => s.player_id === c.player_id)?.was_starter)
  const bench = convocs.filter(c => !stats.find(s => s.player_id === c.player_id)?.was_starter)
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
          </div>

          {/* Marcatori */}
          <Section title="Marcatori Lenci" icon="sports_soccer" empty="Nessun marcatore registrato">
            {scorers.length === 0 ? null : scorers.map(s => (
              <ScorerRow key={s.player_id}
                name={nome(s.player_id)}
                total={s.tot}
                penalties={s.penalties_scored ?? 0} />
            ))}
          </Section>

          {/* Autoreti */}
          {ownGoals.length > 0 && (
            <Section title="Autoreti Lenci" icon="warning" empty="">
              {ownGoals.map(s => (
                <ScorerRow key={s.player_id} name={nome(s.player_id)} total={s.own_goals ?? 0} penalties={0} suffix=" (aut.)" />
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

          {/* Distinta - Titolari */}
          <Section title={`Titolari (${starters.length})`} icon="group" empty="Nessuna distinta registrata">
            {starters.map(c => {
              const s = stats.find(x => x.player_id === c.player_id)
              return (
                <div key={c.player_id} style={rowStyle}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#005f98', minWidth: 30 }}>
                    {numero(c.player_id, c.shirt_number_override)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {nome(c.player_id)} {c.is_captain && <span title="Capitano" style={{ color: '#8e6300' }}>(C)</span>}
                  </span>
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
                return (
                  <div key={c.player_id} style={rowStyle}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#404751', minWidth: 30 }}>
                      {numero(c.player_id, c.shirt_number_override)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                      {nome(c.player_id)}
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

function ScorerRow({ name, total, penalties, suffix }: { name: string; total: number; penalties?: number; suffix?: string }) {
  return (
    <div style={rowStyle}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c73434' }}>sports_soccer</span>
      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
        {name}{suffix || ''}
      </span>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#181c20' }}>
        {total > 1 ? `×${total}` : ''}
        {penalties ? ` (${penalties} rig.)` : ''}
      </span>
    </div>
  )
}
