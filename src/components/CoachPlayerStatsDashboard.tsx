import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { PlayerDetailSheet, type PlayerDetailData } from './PlayerDetailSheet'
import { BottomSheet } from './BottomSheet'

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
  // Partite disputate ma escluse dalle statistiche (referto non compilato).
  // Usato solo per informare il mister ("14 disputate, 2 escluse dal calcolo")
  // così sa perché le presenze non tornano con il calendario.
  const [totalMatchesExcluded, setTotalMatchesExcluded] = useState<number>(0)
  const [sortKey, setSortKey] = useState<SortKey>('minuti')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetailData | null>(null)
  const [expanded, setExpanded] = useState(true)  // sezione collassabile per non ingombrare

  // Filtri: testo (nome/cognome), ruolo (Portiere/Difensore/…), stato (attivi/fantasmi)
  // 'all' = nessun filtro. La ricerca è case-insensitive e trim-safe.
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'Portiere' | 'Difensore' | 'Centrocampista' | 'Attaccante'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ghost'>('all')

  // Confronto: fino a 2 player_id selezionati. Aggiungere il 3° espelle il 1° (FIFO).
  // Quando ne selezioni 1 non si apre nulla; con 2 appare la floating bar in basso.
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

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
      //    IMPORTANTE: escludo le partite con exclude_from_stats=true (referto non
      //    compilato o dati troppo parziali) sia dal count "partite disputate"
      //    (denominatore % presenza) sia dal join stats (che gonfierebbe minuti/gol
      //    con dati inaffidabili).
      const [matchesRes, teamRes, statsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id')
          .eq('team_id', teamId)
          .eq('exclude_from_stats', false)
          .not('home_score', 'is', null)
          .not('away_score', 'is', null),
        supabase
          .from('teams')
          .select('match_periods_count, match_period_duration_min')
          .eq('id', teamId)
          .maybeSingle(),
        supabase
          .from('match_player_stats')
          .select('player_id, was_starter, minute_in, minute_out, goals, penalties_scored, assists, yellow_cards, red_card, match:matches!inner(id, team_id, home_score, away_score, exclude_from_stats)')
          .eq('match.team_id', teamId)
          .eq('match.exclude_from_stats', false),
      ])

      const totalMatches = (matchesRes.data ?? []).length
      setTotalMatchesPlayed(totalMatches)

      // Conteggio separato delle partite escluse (per l'header informativo).
      // Query leggera, solo il count non i dati.
      const excludedRes = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('exclude_from_stats', true)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
      setTotalMatchesExcluded(excludedRes.count ?? 0)

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

  // Applica prima i filtri (search + ruolo + stato), poi l'ordinamento.
  // Ordine: filter → sort → render. `filtered` è utile anche per il contatore "N su M".
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return aggregates.filter(r => {
      if (s) {
        const hay = `${r.firstName} ${r.lastName}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (roleFilter !== 'all' && r.position !== roleFilter) return false
      if (statusFilter === 'active' && r.presenzeTot === 0) return false
      if (statusFilter === 'ghost' && r.presenzeTot > 0) return false
      return true
    })
  }, [aggregates, search, roleFilter, statusFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
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
  }, [filtered, sortKey, sortDir])

  /**
   * Toggle di selezione per il confronto. Max 2 giocatori.
   * - Se il playerId è già selezionato → rimuove
   * - Se ci sono già 2 selezionati e ne aggiungi uno nuovo → espelle il più vecchio (FIFO)
   *   così l'utente non deve mai "svuotare" prima di cambiare confronto
   */
  function toggleCompare(playerId: string) {
    setCompareIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId)
      if (prev.length >= 2) return [prev[1], playerId]  // scarta il primo, aggiungi il nuovo
      return [...prev, playerId]
    })
  }

  // Reset filtri: comodo per il pulsante "Azzera filtri" quando la lista risulta vuota
  function resetFilters() {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  // Trovo gli aggregate dei giocatori selezionati per il confronto
  const compareA = compareIds[0] ? aggregates.find(a => a.playerId === compareIds[0]) : null
  const compareB = compareIds[1] ? aggregates.find(a => a.playerId === compareIds[1]) : null
  const canCompare = !!compareA && !!compareB

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
              {totalMatchesExcluded > 0 && (
                <span style={{ color: '#8e6300', fontWeight: 700 }}>
                  {' '}· {totalMatchesExcluded} escluse
                </span>
              )}
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
              <>
                {/* BARRA FILTRI — cerca + chip ruolo + chip stato. Compatta, wrappa su mobile.
                    Ogni filtro è indipendente e si combina in AND con gli altri. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {/* Ricerca testuale */}
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      display: 'flex', alignItems: 'center', pointerEvents: 'none',
                    }}>
                      <Icon name="search" size={15} color="#8993a3" />
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca giocatore per nome o cognome…"
                      style={{
                        width: '100%', padding: '7px 32px 7px 32px', fontSize: 12.5,
                        border: '1px solid #dfe6ef', borderRadius: 8,
                        background: '#fff', color: '#181c20', fontFamily: 'inherit',
                        boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        aria-label="Cancella ricerca"
                        style={{
                          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', borderRadius: 4,
                        }}
                      >
                        <Icon name="close" size={14} color="#8993a3" />
                      </button>
                    )}
                  </div>

                  {/* Chip filtro ruolo */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <FilterChip label="Tutti" active={roleFilter==='all'} onClick={() => setRoleFilter('all')} />
                    <FilterChip label="🧤 Portieri" active={roleFilter==='Portiere'} onClick={() => setRoleFilter('Portiere')} />
                    <FilterChip label="🛡️ Difensori" active={roleFilter==='Difensore'} onClick={() => setRoleFilter('Difensore')} />
                    <FilterChip label="⚙️ Centrocamp." active={roleFilter==='Centrocampista'} onClick={() => setRoleFilter('Centrocampista')} />
                    <FilterChip label="⚔️ Attaccanti" active={roleFilter==='Attaccante'} onClick={() => setRoleFilter('Attaccante')} />
                  </div>

                  {/* Chip filtro stato + contatore risultati */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FilterChip label="Tutti" active={statusFilter==='all'} onClick={() => setStatusFilter('all')} small />
                    <FilterChip label="✅ Attivi" active={statusFilter==='active'} onClick={() => setStatusFilter('active')} small />
                    <FilterChip label="👻 Mai giocato" active={statusFilter==='ghost'} onClick={() => setStatusFilter('ghost')} small />
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#8993a3', fontWeight: 700 }}>
                      {filtered.length} su {aggregates.length}
                    </span>
                  </div>
                </div>

                {/* Se i filtri hanno svuotato la lista, mostro empty state con reset */}
                {filtered.length === 0 ? (
                  <div style={{
                    padding: 16, textAlign: 'center', color: '#7a8290', fontSize: 12,
                    background: '#f7f9ff', borderRadius: 10,
                  }}>
                    Nessun giocatore corrisponde ai filtri selezionati.
                    <button
                      onClick={resetFilters}
                      style={{
                        display: 'block', margin: '8px auto 0',
                        background: '#005f98', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 12px', fontSize: 11.5, fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Azzera filtri
                    </button>
                  </div>
                ) : (
                <div style={{
                overflowX: 'auto', overflowY: 'visible',
                margin: '0 -6px',  // permette alla tabella di respirare sui bordi mobile
                paddingBottom: 4,
              }}>
                <table style={{
                  width: '100%', minWidth: 620, borderCollapse: 'separate', borderSpacing: 0,
                  fontSize: 12, tableLayout: 'auto',
                }}>
                  <thead>
                    <tr style={{ background: '#f7f9ff' }}>
                      <th style={{ padding: '8px 4px', width: 30, borderBottom: '2px solid #e6e8ee', borderTopLeftRadius: 8 }}>
                        <span title="Confronto" style={{ display: 'inline-flex' }}>
                          <Icon name="compare_arrows" size={13} color="#8993a3" />
                        </span>
                      </th>
                      <ThCell onClick={() => toggleSort('name')} active={sortKey==='name'} dir={sortDir} align="left">Giocatore</ThCell>
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
                      const isSelected = compareIds.includes(r.playerId)
                      // Se selezionato per il confronto, riga con sfondo azzurro tenue
                      const rowBg = isSelected ? '#e6f2fb' : (idx % 2 === 0 ? '#fff' : '#fafbfd')
                      // Il giocatore ha giocato 0 partite → grigio
                      const isFantasma = r.presenzeTot === 0
                      return (
                        <tr key={r.playerId} style={{
                          background: rowBg,
                          opacity: isFantasma ? 0.55 : 1,
                        }}>
                          {/* Checkbox compare (prima colonna) */}
                          <td style={{
                            padding: '7px 4px', textAlign: 'center',
                            borderBottom: '1px solid #eef1f5',
                          }}>
                            <button
                              onClick={() => toggleCompare(r.playerId)}
                              title={isSelected ? 'Rimuovi dal confronto' : 'Aggiungi al confronto'}
                              style={{
                                width: 20, height: 20, borderRadius: 4,
                                border: `1.5px solid ${isSelected ? '#005f98' : '#c8ccd4'}`,
                                background: isSelected ? '#005f98' : '#fff',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', padding: 0,
                              }}
                            >
                              {isSelected && <Icon name="check" size={13} color="#fff" />}
                            </button>
                          </td>
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
                  tap sul nome per il dettaglio · spunta la casella a sinistra per confrontare 2 giocatori
                </div>
              </div>
              )}

              {/* BARRA CONFRONTO — appare quando ci sono giocatori selezionati.
                  Con 1 selezionato mostra il badge e chiede di sceglierne un altro.
                  Con 2 selezionati mostra il pulsante "Confronta" attivo. */}
              {compareIds.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: '#005f98', color: '#fff', borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  boxShadow: '0 4px 12px rgba(0,95,152,0.25)',
                }}>
                  <Icon name="compare_arrows" size={18} color="#fff" />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700 }}>
                    {canCompare ? (
                      <>
                        <span style={{ opacity: 0.95 }}>Confronto:</span>{' '}
                        {compareA!.lastName} <span style={{ opacity: 0.7, margin: '0 4px' }}>vs</span> {compareB!.lastName}
                      </>
                    ) : (
                      <>Seleziona un altro giocatore per confrontarli</>
                    )}
                  </div>
                  <button
                    onClick={() => setCompareIds([])}
                    style={{
                      background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => setCompareOpen(true)}
                    disabled={!canCompare}
                    style={{
                      background: canCompare ? '#fff' : 'rgba(255,255,255,0.35)',
                      color: canCompare ? '#005f98' : '#fff',
                      border: 'none', borderRadius: 6, padding: '6px 12px',
                      fontSize: 11.5, fontWeight: 800, cursor: canCompare ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Confronta →
                  </button>
                </div>
              )}
              </>
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

      {/* BOTTOM SHEET CONFRONTO — vista side-by-side con evidenza chi vince ogni KPI */}
      <BottomSheet open={compareOpen && canCompare} onClose={() => setCompareOpen(false)} title="Confronto giocatori">
        {canCompare && <CompareView a={compareA!} b={compareB!} accent={accent} totalMatches={totalMatchesPlayed} />}
      </BottomSheet>
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

/**
 * Chip filtro compatto. Se `small` è true, padding e font ridotti (per la seconda
 * riga di filtri stato che sta sotto quelli ruolo).
 */
function FilterChip({ label, active, onClick, small }: {
  label: string; active: boolean; onClick: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '3px 8px' : '5px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? '#005f98' : '#dfe6ef'}`,
        background: active ? '#005f98' : '#fff',
        color: active ? '#fff' : '#404751',
        fontSize: small ? 10.5 : 11.5, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Vista di confronto tra 2 giocatori. Riga per riga, ogni KPI mostra:
 *  - Label centrale
 *  - Valore A a sinistra, valore B a destra
 *  - Sfondo verde tenue sul lato che "vince" quel KPI
 *  - Per cartellini (gialli, rossi) vince chi ne ha MENO (invertito)
 *
 * Include anche metriche derivate utili per confronti fair anche se A e B hanno
 * numero di partite diverso: minuti/presenza e gol/partita.
 */
function CompareView({ a, b, accent, totalMatches }: {
  a: PlayerAggregate; b: PlayerAggregate; accent: string; totalMatches: number;
}) {
  // Helper: chi vince (higher-is-better = true di default; per gialli/rossi passa false)
  type Winner = 'a' | 'b' | 'tie'
  function winner(va: number, vb: number, higherBetter = true): Winner {
    if (va === vb) return 'tie'
    if (higherBetter) return va > vb ? 'a' : 'b'
    return va < vb ? 'a' : 'b'
  }

  // Metriche derivate: media minuti per presenza, media gol/partita
  const aMinPerPres = a.presenzeTot > 0 ? Math.round(a.minutiGiocati / a.presenzeTot) : 0
  const bMinPerPres = b.presenzeTot > 0 ? Math.round(b.minutiGiocati / b.presenzeTot) : 0
  const aTotGoals = a.goals + a.penalties
  const bTotGoals = b.goals + b.penalties
  const aGolPerPres = a.presenzeTot > 0 ? (aTotGoals / a.presenzeTot).toFixed(2) : '0'
  const bGolPerPres = b.presenzeTot > 0 ? (bTotGoals / b.presenzeTot).toFixed(2) : '0'

  const rows: Array<{ label: string; valA: string | number; valB: string | number; wins: Winner; suffix?: string }> = [
    { label: 'Presenze totali', valA: a.presenzeTot, valB: b.presenzeTot, wins: winner(a.presenzeTot, b.presenzeTot) },
    { label: 'Titolarità', valA: a.presenzeTitolare, valB: b.presenzeTitolare, wins: winner(a.presenzeTitolare, b.presenzeTitolare) },
    { label: 'Subentri', valA: a.presenzeSubentro, valB: b.presenzeSubentro, wins: winner(a.presenzeSubentro, b.presenzeSubentro) },
    { label: '% presenza', valA: `${a.percentPresenza}%`, valB: `${b.percentPresenza}%`, wins: winner(a.percentPresenza, b.percentPresenza) },
    { label: 'Minuti totali', valA: a.minutiGiocati, valB: b.minutiGiocati, wins: winner(a.minutiGiocati, b.minutiGiocati), suffix: '′' },
    { label: 'Media min/presenza', valA: aMinPerPres, valB: bMinPerPres, wins: winner(aMinPerPres, bMinPerPres), suffix: '′' },
    { label: 'Gol', valA: aTotGoals, valB: bTotGoals, wins: winner(aTotGoals, bTotGoals) },
    { label: 'Media gol/presenza', valA: aGolPerPres, valB: bGolPerPres, wins: winner(parseFloat(aGolPerPres), parseFloat(bGolPerPres)) },
    { label: 'Assist', valA: a.assists, valB: b.assists, wins: winner(a.assists, b.assists) },
    { label: '🟨 Ammonizioni', valA: a.yellows, valB: b.yellows, wins: winner(a.yellows, b.yellows, false) },
    { label: '🟥 Espulsioni', valA: a.reds, valB: b.reds, wins: winner(a.reds, b.reds, false) },
  ]

  // Conteggio vittorie complessive (esclusi pareggi) per un "riepilogo" in header
  const winsA = rows.filter(r => r.wins === 'a').length
  const winsB = rows.filter(r => r.wins === 'b').length

  return (
    <div style={{ padding: '4px 4px 24px' }}>
      {/* HEADER — 2 card affiancate coi nomi e ruoli */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 32px 1fr', gap: 8,
        alignItems: 'stretch', marginBottom: 14,
      }}>
        <PlayerCompareHeader agg={a} accent={accent} wins={winsA} side="left" />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8993a3', fontFamily: 'Anybody', fontWeight: 800, fontSize: 14,
        }}>
          VS
        </div>
        <PlayerCompareHeader agg={b} accent={accent} wins={winsB} side="right" />
      </div>

      {/* SPIEGAZIONE COMPATTA */}
      <div style={{
        fontSize: 10.5, color: '#7a8290', textAlign: 'center', lineHeight: 1.4,
        margin: '0 4px 12px', padding: '6px 8px',
        background: '#f7f9ff', borderRadius: 6,
      }}>
        Sfondo verde = migliore in quella statistica.
        Per cartellini vince chi ne ha meno.
        Base comune: {totalMatches} partite disputate dal team.
      </div>

      {/* GRIGLIA CONFRONTI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, idx) => {
          const aBg = r.wins === 'a' ? '#e8f5e9' : 'transparent'
          const bBg = r.wins === 'b' ? '#e8f5e9' : 'transparent'
          const aColor = r.wins === 'a' ? '#006e25' : '#181c20'
          const bColor = r.wins === 'b' ? '#006e25' : '#181c20'
          const aWeight = r.wins === 'a' ? 900 : 700
          const bWeight = r.wins === 'b' ? 900 : 700
          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0,
              alignItems: 'stretch',
              border: '1px solid #eef1f5', borderRadius: 8, overflow: 'hidden',
            }}>
              {/* Valore A */}
              <div style={{
                background: aBg, padding: '8px 10px', textAlign: 'right',
                fontFamily: 'Anybody', fontSize: 15, fontWeight: aWeight, color: aColor,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
              }}>
                <span>{r.valA}</span>
                {r.suffix && <span style={{ fontSize: 10, opacity: 0.75 }}>{r.suffix}</span>}
              </div>
              {/* Label centro */}
              <div style={{
                padding: '8px 12px', minWidth: 120, textAlign: 'center',
                fontSize: 10.5, fontWeight: 700, color: '#5c6773',
                textTransform: 'uppercase', letterSpacing: 0.3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fafbfd', borderLeft: '1px solid #eef1f5', borderRight: '1px solid #eef1f5',
              }}>
                {r.label}
              </div>
              {/* Valore B */}
              <div style={{
                background: bBg, padding: '8px 10px', textAlign: 'left',
                fontFamily: 'Anybody', fontSize: 15, fontWeight: bWeight, color: bColor,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2,
              }}>
                <span>{r.valB}</span>
                {r.suffix && <span style={{ fontSize: 10, opacity: 0.75 }}>{r.suffix}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Header di un giocatore nel confronto — numero maglia + cognome + ruolo + "wins counter".
 * `side` decide su quale bordo si aggancia il ribbon vittorie (left/right).
 */
function PlayerCompareHeader({ agg, accent, wins, side }: {
  agg: PlayerAggregate; accent: string; wins: number; side: 'left' | 'right';
}) {
  return (
    <div style={{
      background: '#fff', border: `2px solid ${accent}`, borderRadius: 10,
      padding: '10px 12px', display: 'flex', flexDirection: 'column',
      alignItems: side === 'left' ? 'flex-start' : 'flex-end',
      textAlign: side === 'left' ? 'left' : 'right',
      position: 'relative', minWidth: 0,
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexDirection: side === 'left' ? 'row' : 'row-reverse' }}>
        {agg.jerseyNumber != null && (
          <span style={{
            minWidth: 26, height: 24, padding: '0 6px', borderRadius: 5,
            background: accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Anybody', fontWeight: 900, fontSize: 13,
          }}>
            {agg.jerseyNumber}
          </span>
        )}
        <div style={{
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 14, color: '#181c20',
          lineHeight: 1.15, wordBreak: 'break-word',
        }}>
          {agg.lastName}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#5c6773', fontWeight: 600 }}>
        {agg.firstName}
      </div>
      {agg.position && (
        <div style={{
          fontSize: 9.5, color: accent, fontWeight: 800, marginTop: 3,
          textTransform: 'uppercase', letterSpacing: 0.3,
        }}>
          {agg.position}
        </div>
      )}
      {/* Ribbon vittorie in alto opposto */}
      <div style={{
        position: 'absolute', top: -8, [side === 'left' ? 'right' : 'left']: 8,
        background: wins > 0 ? '#006e25' : '#8993a3', color: '#fff',
        padding: '2px 7px', borderRadius: 999,
        fontSize: 10, fontWeight: 800,
      } as React.CSSProperties}>
        {wins} vinte
      </div>
    </div>
  )
}
