import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { PlayerDetailSheet, type PlayerDetailData } from './PlayerDetailSheet'

/**
 * Dashboard mister: tabella riassuntiva di TUTTI i giocatori della squadra con
 * statistiche stagionali aggregate (presenze, %, minuti, gol, assist, cartellini).
 *
 * DATA FLOW:
 *   1) Roster giocatori (players WHERE team_id=X AND NOT is_lead)
 *   2) match_player_stats join matches del team + team.match_periods_count/duration
 *      per calcolare minuti giocati corretti anche per titolari fino alla fine
 *   3) Numero totale partite disputate dal team (per calcolare % presenza)
 *
 * Aggregazione client-side (JS) invece che con SQL: il calcolo minuti è
 * condizionale (was_starter/minute_in/minute_out) e diventerebbe verboso in SQL,
 * mentre in TS resta compatto. I dataset restano piccoli (poche decine di
 * giocatori × poche decine di partite = qualche centinaio di righe).
 *
 * UI: tabella ordinabile per colonna (click sul header). Font compatti + overflow-x
 * per adattarsi a schermi stretti. Tap sul nome giocatore apre PlayerDetailSheet.
 */

interface PlayerAggregate {
  playerId: string
  lastName: string
  firstName: string
  jerseyNumber: number | null
  position: string | null
  // Aggregati
  presenzeTitolare: number
  presenzeSubentro: number
  presenzeTot: number
  percentPresenza: number   // 0..100
  minutiGiocati: number
  goals: number
  penalties: number
  assists: number
  yellows: number
  reds: number
}

type SortKey =
  | 'name' | 'presenze' | 'percent' | 'minuti'
  | 'goals' | 'assists' | 'yellows' | 'reds'

interface Props {
  teamId: string
  teamColor?: string        // colore accento per la card (fallback blu Lenci)
  categoryName?: string     // opzionale: mostrato in header (es. "Under 14")
}

export function CoachPlayerStatsDashboard({ teamId, teamColor, categoryName }: Props) {
  const accent = teamColor || '#005f98'
  const [loading, setLoading] = useState(true)
  const [aggregates, setAggregates] = useState<PlayerAggregate[]>([])
  const [totalMatchesPlayed, setTotalMatchesPlayed] = useState<number>(0)
  const [sortKey, setSortKey] = useState<SortKey>('minuti')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetailData | null>(null)
  const [expanded, setExpanded] = useState(true)  // sezione collassabile per non ingombrare

  useEffect(() => {
    if (!teamId) return
    load()
  }, [teamId])

  async function load() {
    setLoading(true)
    try {
      // 1) Roster della squadra (solo giocatori tesserati, non lead)
      //    Uso una query semplice: prendo tutti i player del team; se in futuro
      //    si vogliono escludere gli "usciti dalla rosa" servirà un flag active.
      const rosterRes = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, position')
        .eq('team_id', teamId)
        .order('last_name')

      // 2) Partite del team con risultato: quelle "disputate" contano per % presenza.
      //    Anche partite senza referto pieno ma con score valorizzato sono presenze potenziali.
      //    Prendo anche la durata dal team per il calcolo minuti.
      const [matchesRes, teamRes, statsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id')
          .eq('team_id', teamId)
          .not('home_score', 'is', null)
          .not('away_score', 'is', null),
        supabase
          .from('teams')
          .select('match_periods_count, match_period_duration_min')
          .eq('id', teamId)
          .maybeSingle(),
        supabase
          .from('match_player_stats')
          .select('player_id, was_starter, minute_in, minute_out, goals, penalties_scored, assists, yellow_cards, red_card, match:matches!inner(id, team_id, home_score, away_score)')
          .eq('match.team_id', teamId),
      ])

      const totalMatches = (matchesRes.data ?? []).length
      setTotalMatchesPlayed(totalMatches)

      // Durata partita del team per il calcolo minuti (fallback 90')
      const teamRow = teamRes.data as { match_periods_count?: number | null; match_period_duration_min?: number | null } | null
      const teamTotalMinutes = teamRow
        ? (teamRow.match_periods_count ?? 2) * (teamRow.match_period_duration_min ?? 45)
        : 90

      // 3) Aggregazione: raggruppo le stats per player_id.
      //    Escludo le righe delle partite non ancora disputate (score null): il join
      //    !inner + i filtri sopra dovrebbero già tenerle fuori, ma metto un secondo
      //    filtro difensivo per sicurezza.
      const byPlayer = new Map<string, {
        titolare: number, subentro: number,
        minuti: number, goals: number, penalties: number, assists: number,
        yellows: number, reds: number,
      }>()
      for (const raw of (statsRes.data ?? [])) {
        const r = raw as any
        const m = Array.isArray(r.match) ? r.match[0] : r.match
        if (!m || m.home_score == null || m.away_score == null) continue

        const wasStarter = !!r.was_starter
        const mIn = r.minute_in
        const mOut = r.minute_out

        // Presenza (contribuisce a "presenze") se titolare OR subentrato
        const isSubentro = !wasStarter && mIn != null
        const played = wasStarter || isSubentro

        // Minuti giocati (stessa formula di PlayerDetailSheet)
        let minutes = 0
        if (played) {
          const start = wasStarter ? 0 : (mIn ?? 0)
          const end = mOut ?? teamTotalMinutes
          minutes = Math.max(0, end - start)
        }

        const key = r.player_id
        const cur = byPlayer.get(key) ?? {
          titolare: 0, subentro: 0, minuti: 0, goals: 0, penalties: 0,
          assists: 0, yellows: 0, reds: 0,
        }
        cur.titolare += wasStarter ? 1 : 0
        cur.subentro += isSubentro ? 1 : 0
        cur.minuti += minutes
        cur.goals += Number(r.goals || 0)
        cur.penalties += Number(r.penalties_scored || 0)
        cur.assists += Number(r.assists || 0)
        cur.yellows += Number(r.yellow_cards || 0)
        cur.reds += r.red_card ? 1 : 0
        byPlayer.set(key, cur)
      }

      // 4) Costruisco la lista finale: TUTTI i giocatori del roster (anche chi non
      //    è mai stato convocato → 0 su tutto, così il mister vede subito i "fantasmi")
      const rows: PlayerAggregate[] = (rosterRes.data ?? []).map((p: any) => {
        const agg = byPlayer.get(p.id) ?? {
          titolare: 0, subentro: 0, minuti: 0, goals: 0, penalties: 0,
          assists: 0, yellows: 0, reds: 0,
        }
        const presenzeTot = agg.titolare + agg.subentro
        const percent = totalMatches > 0 ? Math.round((presenzeTot / totalMatches) * 100) : 0
        return {
          playerId: p.id,
          lastName: p.last_name,
          firstName: p.first_name,
          jerseyNumber: p.jersey_number,
          position: p.position,
          presenzeTitolare: agg.titolare,
          presenzeSubentro: agg.subentro,
          presenzeTot,
          percentPresenza: percent,
          minutiGiocati: agg.minuti,
          goals: agg.goals,
          penalties: agg.penalties,
          assists: agg.assists,
          yellows: agg.yellows,
          reds: agg.reds,
        }
      })
      setAggregates(rows)
    } finally {
      setLoading(false)
    }
  }

  const sorted = useMemo(() => {
    const arr = [...aggregates]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.lastName.localeCompare(b.lastName)
        case 'presenze': return dir * (a.presenzeTot - b.presenzeTot)
        case 'percent': return dir * (a.percentPresenza - b.percentPresenza)
        case 'minuti': return dir * (a.minutiGiocati - b.minutiGiocati)
        case 'goals': return dir * ((a.goals + a.penalties) - (b.goals + b.penalties))
        case 'assists': return dir * (a.assists - b.assists)
        case 'yellows': return dir * (a.yellows - b.yellows)
        case 'reds': return dir * (a.reds - b.reds)
      }
    })
    return arr
  }, [aggregates, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc') }
  }

  async function openPlayer(playerId: string) {
    // Fetcho i dati completi del giocatore per aprire PlayerDetailSheet.
    // Prendo solo i campi che ESISTONO nel DB E che l'interfaccia PlayerDetailData
    // accetta. Campi non presenti nello schema players (previous_club, source,
    // category) vengono passati come null: la sheet li gestisce con optional chaining.
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, birth_date, position, parent_name, parent_phone, parent_email, fiscal_code, jersey_number, card_number, medical_expiry, team_id, avatar_url, dominant_foot, secondary_positions, height_cm, weight_kg, shoe_size, sex')
      .eq('id', playerId)
      .single()
    if (!data) return
    setSelectedPlayer({
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      birthDate: data.birth_date,
      position: data.position,
      category: null,          // colonna non presente nello schema players
      previousClub: null,      // idem
      parentName: data.parent_name,
      parentPhone: data.parent_phone,
      parentEmail: data.parent_email,
      fiscalCode: data.fiscal_code,
      jerseyNumber: data.jersey_number,
      cardNumber: data.card_number,
      medicalExpiry: data.medical_expiry,
      teamId: data.team_id,
      avatarUrl: data.avatar_url,
      dominantFoot: data.dominant_foot,
      secondaryPositions: data.secondary_positions,
      heightCm: data.height_cm,
      weightKg: data.weight_kg,
      shoeSize: data.shoe_size,
      sex: data.sex,
      source: 'player',        // hardcoded: se giocatore è in roster, è tesserato
    })
  }

  // Guard: nessuna partita ancora giocata → sezione minimale
  const noMatchesYet = totalMatchesPlayed === 0

  return (
    <>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 14,
        boxShadow: '0 6px 16px rgba(0,120,191,0.06)',
      }}>
        {/* Header collassabile */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            textAlign: 'left', color: '#181c20',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="leaderboard" size={18} color={accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>
              Statistiche giocatori
            </div>
            <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>
              {categoryName ? `${categoryName} · ` : ''}
              {aggregates.length} giocatori · {totalMatchesPlayed} partite disputate
            </div>
          </div>
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} color="#707882" />
        </button>

        {expanded && (
          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12.5 }}>
                Caricamento…
              </div>
            ) : noMatchesYet ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#7a8290', fontSize: 12, background: '#f7f9ff', borderRadius: 10 }}>
                Nessuna partita ancora disputata. Le statistiche appariranno qui appena
                verrà salvato un referto con risultato.
              </div>
            ) : aggregates.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#7a8290', fontSize: 12, background: '#f7f9ff', borderRadius: 10 }}>
                Nessun giocatore nel roster di questa squadra.
              </div>
            ) : (
              <div style={{
                overflowX: 'auto', overflowY: 'visible',
                margin: '0 -6px',  // permette alla tabella di respirare sui bordi mobile
                paddingBottom: 4,
              }}>
                <table style={{
                  width: '100%', minWidth: 560, borderCollapse: 'separate', borderSpacing: 0,
                  fontSize: 12, tableLayout: 'auto',
                }}>
                  <thead>
                    <tr style={{ background: '#f7f9ff' }}>
                      <ThCell first onClick={() => toggleSort('name')} active={sortKey==='name'} dir={sortDir} align="left">Giocatore</ThCell>
                      <ThCell onClick={() => toggleSort('presenze')} active={sortKey==='presenze'} dir={sortDir}>Pres.</ThCell>
                      <ThCell onClick={() => toggleSort('percent')} active={sortKey==='percent'} dir={sortDir}>%</ThCell>
                      <ThCell onClick={() => toggleSort('minuti')} active={sortKey==='minuti'} dir={sortDir}>Min</ThCell>
                      <ThCell onClick={() => toggleSort('goals')} active={sortKey==='goals'} dir={sortDir}>Gol</ThCell>
                      <ThCell onClick={() => toggleSort('assists')} active={sortKey==='assists'} dir={sortDir}>Ast</ThCell>
                      <ThCell onClick={() => toggleSort('yellows')} active={sortKey==='yellows'} dir={sortDir}>🟨</ThCell>
                      <ThCell last onClick={() => toggleSort('reds')} active={sortKey==='reds'} dir={sortDir}>🟥</ThCell>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, idx) => {
                      // Colore % presenza: >=70 verde, >=40 giallo, <40 rosso
                      const pctColor = r.percentPresenza >= 70 ? '#006e25'
                        : r.percentPresenza >= 40 ? '#8e6300' : '#93000a'
                      const pctBg = r.percentPresenza >= 70 ? '#e8f5e9'
                        : r.percentPresenza >= 40 ? '#fff8e0' : '#ffdad6'
                      const rowBg = idx % 2 === 0 ? '#fff' : '#fafbfd'
                      // Il giocatore ha giocato 0 partite → grigio
                      const isFantasma = r.presenzeTot === 0
                      return (
                        <tr key={r.playerId} style={{
                          background: rowBg,
                          opacity: isFantasma ? 0.55 : 1,
                        }}>
                          <TdCell first align="left">
                            <button
                              onClick={() => openPlayer(r.playerId)}
                              style={{
                                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
                                fontFamily: 'inherit', color: '#181c20',
                              }}
                            >
                              {r.jerseyNumber != null && (
                                <span style={{
                                  minWidth: 22, height: 20, padding: '0 4px', borderRadius: 4,
                                  background: `${accent}18`, color: accent,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontFamily: 'Anybody', fontWeight: 900, fontSize: 11,
                                }}>
                                  {r.jerseyNumber}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, fontSize: 12 }}>
                                {r.lastName.toUpperCase()} {r.firstName[0]}.
                              </span>
                            </button>
                          </TdCell>
                          <TdCell>
                            <span style={{ fontWeight: 800 }}>{r.presenzeTot}</span>
                            {r.presenzeTot > 0 && (
                              <span style={{ fontSize: 9.5, color: '#8993a3', marginLeft: 3 }}>
                                ({r.presenzeTitolare}T)
                              </span>
                            )}
                          </TdCell>
                          <TdCell>
                            <span style={{
                              display: 'inline-block', padding: '1px 5px', borderRadius: 4,
                              background: pctBg, color: pctColor, fontWeight: 800, fontSize: 11,
                            }}>
                              {r.percentPresenza}%
                            </span>
                          </TdCell>
                          <TdCell><span style={{ fontWeight: 700 }}>{r.minutiGiocati}</span><span style={{ fontSize: 9.5, color: '#8993a3' }}>′</span></TdCell>
                          <TdCell>
                            <span style={{ fontWeight: 800, color: (r.goals + r.penalties) > 0 ? '#b3005c' : '#c8ccd4' }}>
                              {r.goals + r.penalties}
                            </span>
                            {r.penalties > 0 && (
                              <span style={{ fontSize: 9, color: '#8e6300', marginLeft: 2 }}>*</span>
                            )}
                          </TdCell>
                          <TdCell>
                            <span style={{ fontWeight: 800, color: r.assists > 0 ? '#7a0071' : '#c8ccd4' }}>
                              {r.assists}
                            </span>
                          </TdCell>
                          <TdCell>
                            <span style={{ fontWeight: 700, color: r.yellows > 0 ? '#8e6300' : '#c8ccd4' }}>
                              {r.yellows}
                            </span>
                          </TdCell>
                          <TdCell last>
                            <span style={{ fontWeight: 700, color: r.reds > 0 ? '#93000a' : '#c8ccd4' }}>
                              {r.reds}
                            </span>
                          </TdCell>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Legenda compatta */}
                <div style={{
                  marginTop: 10, padding: '8px 10px', background: '#f7f9ff',
                  borderRadius: 8, fontSize: 10.5, color: '#5c6773', lineHeight: 1.5,
                }}>
                  <strong>Pres.</strong> = titolare + subentri (T = titolare) &nbsp;·&nbsp;
                  <strong>%</strong> = presenze / partite disputate ({totalMatchesPlayed}) &nbsp;·&nbsp;
                  <strong>Gol</strong> include rigori (* se ce ne sono) &nbsp;·&nbsp;
                  tap sul nome per il dettaglio partita per partita
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PlayerDetailSheet — reuse esistente */}
      <PlayerDetailSheet
        open={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        player={selectedPlayer}
        canEdit={false}
      />
    </>
  )
}

// ---- Helper cells ---------------------------------------------------------

function ThCell({ children, onClick, active, dir, align = 'center', first, last }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean;
  dir?: 'asc' | 'desc'; align?: 'left' | 'center'; first?: boolean; last?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '8px 6px', textAlign: align,
        borderTopLeftRadius: first ? 8 : 0,
        borderTopRightRadius: last ? 8 : 0,
        borderBottom: '2px solid #e6e8ee',
        fontSize: 10, fontWeight: 800, color: active ? '#005f98' : '#404751',
        letterSpacing: 0.3, textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {active && (
        <span style={{ marginLeft: 3, fontSize: 8 }}>
          {dir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  )
}

function TdCell({ children, align = 'center', first, last }: {
  children: React.ReactNode; align?: 'left' | 'center'; first?: boolean; last?: boolean;
}) {
  return (
    <td style={{
      padding: '7px 6px', textAlign: align,
      borderBottom: '1px solid #eef1f5',
      paddingLeft: first ? 8 : 6, paddingRight: last ? 8 : 6,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </td>
  )
}
