import { useState, useEffect, useMemo } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { avatarBg } from '../lib/utils'
import { StaffAttendanceSection } from './StaffAttendanceSection'

export interface PostMatchData {
  id: string
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  competition: string | null
  team_id: string
  team_name: string
  team_category: string | null
  team_color: string | null
  home_score: number | null
  away_score: number | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  position: string | null
}

interface Stats {
  player_id: string
  was_starter: boolean
  minute_in: number | null
  minute_out: number | null
  position_played: string | null
  goals: number
  goal_minutes: number[]
  assists: number
  own_goals: number
  own_goal_minutes: number[]
  penalties_scored: number
  penalty_minutes: number[]
  penalties_missed: number
  yellow_cards: number
  red_card: boolean
  red_card_minute: number | null
  rating: number | null
  is_mvp: boolean
  notes: string | null
}

interface PostMatchSheetProps {
  open: boolean
  onClose: () => void
  match: PostMatchData | null
  onSaved?: () => void
}

// Moduli tattici standard usati nei referti FIGC/LND (dilettanti e giovanili)
const MODULES = [
  '4-4-2', '4-3-3', '4-2-3-1', '4-3-1-2', '4-1-4-1', '4-5-1',
  '3-5-2', '3-4-3', '3-4-1-2', '3-4-2-1',
  '5-3-2', '5-4-1',
  // Formati ridotti (Esordienti/Pulcini a 7 e 9)
  '2-3-1 (a 7)', '3-3 (a 7)',
  '3-3-2 (a 9)', '3-2-3 (a 9)', '2-4-2 (a 9)',
]
const POSITIONS = [
  'Portiere',
  'Difensore centrale', 'Terzino destro', 'Terzino sinistro',
  'Mediano', 'Centrocampista centrale',
  'Interno destro', 'Interno sinistro',
  'Trequartista',
  'Esterno destro', 'Esterno sinistro',
  'Ala destra', 'Ala sinistra',
  'Punta centrale', 'Seconda punta',
]

function emptyStats(player_id: string): Stats {
  return {
    player_id,
    was_starter: false,
    minute_in: null,
    minute_out: null,
    position_played: null,
    goals: 0,
    goal_minutes: [],
    assists: 0,
    own_goals: 0,
    own_goal_minutes: [],
    penalties_scored: 0,
    penalty_minutes: [],
    penalties_missed: 0,
    yellow_cards: 0,
    red_card: false,
    red_card_minute: null,
    rating: null,
    is_mvp: false,
    notes: null,
  }
}

export function PostMatchSheet({ open, onClose, match, onSaved }: PostMatchSheetProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [ourScore, setOurScore] = useState<string>('0')
  const [theirScore, setTheirScore] = useState<string>('0')
  // Auto-sincronizzazione punteggio "nostro" dalla somma dei marcatori.
  // Si disattiva quando l'utente modifica manualmente ourScore; si riattiva col bottone "usa somma".
  const [autoScore, setAutoScore] = useState(true)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  // Report tattico
  const [formation, setFormation] = useState('')
  const [reportPositive, setReportPositive] = useState('')
  const [reportNegative, setReportNegative] = useState('')
  const [reportGeneral, setReportGeneral] = useState('')
  const [weather, setWeather] = useState('')
  const [refereeNotes, setRefereeNotes] = useState('')
  // Flag "pubblica per giornalisti": se true, la partita compare nella vista giornalisti
  const [publishedForJournalists, setPublishedForJournalists] = useState(false)
  // Autogol degli avversari a favore di Lenci (contano nel nostro punteggio, no giocatore associato)
  const [opponentOwnGoals, setOpponentOwnGoals] = useState<number>(0)
  const [opponentOwnGoalMinutes, setOpponentOwnGoalMinutes] = useState<number[]>([])

  useEffect(() => {
    if (!open || !match) return
    load()
  }, [open, match?.id])

  const load = async () => {
    if (!match) return
    setLoading(true)

    // Convocati (via convocations) + tutte stats esistenti + campi report tattico
    const [convRes, statsRes, matchRes] = await Promise.all([
      supabase.from('convocations')
        .select('player_id, is_captain, shirt_number_override, player:players(id, first_name, last_name, jersey_number, position)')
        .eq('match_id', match.id)
        .eq('status', 'accepted'),
      supabase.from('match_player_stats')
        .select('*')
        .eq('match_id', match.id),
      supabase.from('matches')
        .select('formation, report_positive, report_negative, report_general, weather, referee_notes, published_for_journalists')
        .eq('id', match.id)
        .maybeSingle(),
    ])

    // Pre-compila report tattico
    const mRow = matchRes.data as { formation?: string | null; report_positive?: string | null; report_negative?: string | null; report_general?: string | null; weather?: string | null; referee_notes?: string | null; published_for_journalists?: boolean | null } | null
    setFormation(mRow?.formation ?? '')
    setReportPositive(mRow?.report_positive ?? '')
    setReportNegative(mRow?.report_negative ?? '')
    setReportGeneral(mRow?.report_general ?? '')
    setWeather(mRow?.weather ?? '')
    setRefereeNotes(mRow?.referee_notes ?? '')
    setPublishedForJournalists(mRow?.published_for_journalists === true)

    // Carico autogol avversari in query separata resiliente (le colonne potrebbero non esistere
    // se la migration v1.9.55 non è ancora stata applicata al DB).
    try {
      const { data: oogData } = await supabase.from('matches')
        .select('opponent_own_goals, opponent_own_goal_minutes')
        .eq('id', match.id)
        .maybeSingle()
      const oogRow = oogData as { opponent_own_goals?: number | null; opponent_own_goal_minutes?: number[] | null } | null
      setOpponentOwnGoals(oogRow?.opponent_own_goals ?? 0)
      setOpponentOwnGoalMinutes(oogRow?.opponent_own_goal_minutes ?? [])
    } catch {
      setOpponentOwnGoals(0)
      setOpponentOwnGoalMinutes([])
    }

    const convPlayers: Player[] = ((convRes.data ?? []) as any[])
      .filter(c => c.player)
      .map(c => ({
        id: c.player.id,
        first_name: c.player.first_name,
        last_name: c.player.last_name,
        jersey_number: c.shirt_number_override ?? c.player.jersey_number,
        position: c.player.position,
      }))
      .sort((a, b) => {
        const na = a.jersey_number ?? 999
        const nb = b.jersey_number ?? 999
        return na - nb
      })
    setPlayers(convPlayers)

    // Se non ci sono convocati, carico tutta la rosa (fallback)
    if (convPlayers.length === 0) {
      const { data: rosterData } = await supabase.from('players')
        .select('id, first_name, last_name, jersey_number, position')
        .eq('team_id', match.team_id)
        .order('jersey_number', { nullsFirst: false })
        .order('last_name')
      setPlayers((rosterData ?? []) as Player[])
    }

    // Mappa stats esistenti
    const map: Record<string, Stats> = {}
    for (const s of statsRes.data ?? []) {
      map[s.player_id] = { ...s } as Stats
    }
    setStats(map)

    // Score
    // Il nostro score è home_score se giochiamo in casa, altrimenti away_score
    const isHome = match.venue === 'home'
    setOurScore(String(isHome ? (match.home_score ?? 0) : (match.away_score ?? 0)))
    setTheirScore(String(isHome ? (match.away_score ?? 0) : (match.home_score ?? 0)))
    // Auto-sync attivo di default all'apertura (verrà disattivato al primo edit manuale)
    setAutoScore(true)

    setLoading(false)
  }

  const updateStat = (pid: string, patch: Partial<Stats>) => {
    setStats(s => {
      const cur = s[pid] || emptyStats(pid)
      return { ...s, [pid]: { ...cur, ...patch } }
    })
  }

  const toggleMvp = (pid: string) => {
    setStats(s => {
      const cleared: Record<string, Stats> = {}
      for (const [k, v] of Object.entries(s)) {
        cleared[k] = { ...v, is_mvp: k === pid && !v.is_mvp }
      }
      if (!cleared[pid]) {
        cleared[pid] = { ...emptyStats(pid), is_mvp: true }
      }
      return cleared
    })
  }

  // Ruolo giocatore nella gara: 3 stati mutuamente esclusivi
  //   'starter' = titolare (was_starter=true, minute_in=0 implicito)
  //   'sub'     = subentrato dalla panchina (was_starter=false, minute_in>0)
  //   'out'     = non entrato / non convocato (was_starter=false, minute_in=null)
  const setPlayerRole = (pid: string, role: 'starter' | 'sub' | 'out') => {
    if (role === 'starter') {
      updateStat(pid, { was_starter: true,  minute_in: 0,    minute_out: null })
    } else if (role === 'sub') {
      // Serve un minute_in > 0 perché roleOf riconosca il ruolo 'sub': se il giocatore
      // non ha ancora un ingresso valorizzato, uso 46 come default ragionevole
      // (inizio secondo tempo per una partita da 90'); l'utente poi lo modifica.
      const current = stats[pid]
      const keepIn = (current?.minute_in && current.minute_in > 0) ? current.minute_in : 46
      updateStat(pid, { was_starter: false, minute_in: keepIn, minute_out: current?.minute_out ?? null })
    } else {
      updateStat(pid, { was_starter: false, minute_in: null,  minute_out: null })
    }
  }

  // Etichetta del ruolo corrente (per rendering condizionale)
  const roleOf = (s: Stats): 'starter' | 'sub' | 'out' => {
    if (s.was_starter) return 'starter'
    if (s.minute_in != null) return 'sub'
    return 'out'
  }

  const played = useMemo(() =>
    Object.values(stats).filter(s => s.was_starter || (s.minute_in != null)).length,
    [stats])
  const totalGoals = useMemo(() =>
    Object.values(stats).reduce((sum, s) => sum + (s.goals || 0) + (s.penalties_scored || 0), 0)
    + opponentOwnGoals,
    [stats, opponentOwnGoals])

  // Auto-sync: se autoScore attivo, ourScore segue sempre la somma marcatori
  useEffect(() => {
    if (autoScore) setOurScore(String(totalGoals))
  }, [totalGoals, autoScore])

  const handleSave = async () => {
    if (!match) return
    setSaving(true)
    try {
      // 1. Aggiorna score partita + campi report tattico
      const isHome = match.venue === 'home'
      const oScore = parseInt(ourScore, 10) || 0
      const tScore = parseInt(theirScore, 10) || 0
      const hasReport = [formation, reportPositive, reportNegative, reportGeneral, weather, refereeNotes].some(s => s && s.trim())
      const { data: authRes } = await supabase.auth.getUser()
      const uid = authRes?.user?.id ?? null
      await supabase.from('matches').update({
        home_score: isHome ? oScore : tScore,
        away_score: isHome ? tScore : oScore,
        status: 'completed',
        formation: formation.trim() || null,
        report_positive: reportPositive.trim() || null,
        report_negative: reportNegative.trim() || null,
        report_general: reportGeneral.trim() || null,
        weather: weather.trim() || null,
        referee_notes: refereeNotes.trim() || null,
        published_for_journalists: publishedForJournalists,
        report_completed_at: hasReport ? new Date().toISOString() : null,
        report_completed_by: hasReport ? uid : null,
      }).eq('id', match.id)

      // 1b. Autogol avversari a favore Lenci: UPDATE separato in try/catch
      // (colonne aggiunte con la migration v1.9.55: se il DB non le ha ancora
      // il campo non viene salvato ma il resto del referto sì).
      try {
        await supabase.from('matches').update({
          opponent_own_goals: opponentOwnGoals,
          opponent_own_goal_minutes: opponentOwnGoalMinutes,
        }).eq('id', match.id)
      } catch (err) {
        console.warn('[PostMatchSheet] opponent_own_goals non salvato (migration mancante?)', err)
      }

      // 2. Sostituisce match_player_stats: delete + insert
      await supabase.from('match_player_stats').delete().eq('match_id', match.id)

      const rows = Object.values(stats)
        .filter(s =>
          s.was_starter || s.minute_in != null || s.goals > 0 || s.assists > 0 ||
          s.yellow_cards > 0 || s.red_card || s.rating != null || s.is_mvp || (s.notes && s.notes.trim()) ||
          s.own_goals > 0 || s.penalties_scored > 0 || s.penalties_missed > 0
        )
        .map(s => {
          // Se lo stato contiene campi provenienti dal SELECT precedente (id vuoto/valorizzato,
          // created_at, updated_at) li scarto: dopo il DELETE la INSERT deve lasciare che il DB
          // generi id via gen_random_uuid() e i timestamp via default now().
          const { id: _drop_id, created_at: _drop_ca, updated_at: _drop_ua, ...clean } = s as any
          return {
            ...clean,
            match_id: match.id,
            rating: s.rating != null ? Number(s.rating) : null,
            notes: s.notes ? s.notes.trim() : null,
          }
        })
      if (rows.length > 0) {
        const { error } = await supabase.from('match_player_stats').insert(rows)
        if (error) throw error
      }
      setSavedOk(true)
      onSaved?.()
      setTimeout(() => { setSavedOk(false); onClose() }, 1200)
    } catch (e: any) {
      alert('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  if (!match) return null

  const dateStr = new Date(match.match_date).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <BottomSheet open={open} onClose={onClose} title="Referto post-gara" maxHeight="95vh">
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Header con risultato */}
        <div style={{
          background: 'linear-gradient(135deg, #006e25 0%, #003c14 100%)',
          borderRadius: 14, padding: 14, color: '#fff',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.9, marginBottom: 6 }}>
            {match.venue === 'home' ? '🏠 IN CASA' : '✈️ IN TRASFERTA'}
            {match.competition && ` · ${match.competition}`}
          </div>

          {/* Risultato editable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Noi</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{match.team_category}</div>
            </div>
            <input
              type="number" min={0} max={99} value={ourScore}
              onChange={e => { setOurScore(e.target.value); setAutoScore(false) }}
              style={scoreInputStyle}
              title={autoScore ? 'Sincronizzato automaticamente dalla somma marcatori' : 'Modificato manualmente'}
            />
            <span style={{ fontFamily: 'Anybody', fontSize: 22, fontWeight: 800, opacity: 0.6 }}>–</span>
            <input
              type="number" min={0} max={99} value={theirScore}
              onChange={e => setTheirScore(e.target.value)}
              style={scoreInputStyle}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Loro</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{match.opponent}</div>
            </div>
          </div>

          {/* Badge auto-sync marcatori */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 8, fontSize: 11, opacity: 0.92,
          }}>
            {autoScore ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700,
              }}>
                <Icon name="autorenew" size={13} color="#fff" />
                Punteggio auto dai marcatori
              </span>
            ) : (
              <>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(255,209,0,0.22)', color: '#fff8dc', fontWeight: 700,
                }}>
                  <Icon name="edit" size={12} color="#fff8dc" />
                  Modificato manualmente
                </span>
                {totalGoals !== parseInt(ourScore, 10) && (
                  <button
                    onClick={() => { setAutoScore(true); setOurScore(String(totalGoals)) }}
                    style={{
                      padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.4)',
                      background: 'transparent', color: '#fff',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Usa somma ({totalGoals})
                  </button>
                )}
              </>
            )}
          </div>

          <p style={{ fontSize: 11.5, margin: '8px 0 0', opacity: 0.85, textAlign: 'center', textTransform: 'capitalize' }}>
            {dateStr}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Caricamento…
          </div>
        ) : players.length === 0 ? (
          <div style={{
            background: 'rgba(255,209,0,0.15)', color: '#8e6300',
            padding: 16, borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: 'center',
          }}>
            <Icon name="warning" size={20} color="#8e6300" />
            <p style={{ margin: '6px 0 0' }}>
              Nessun convocato per questa partita.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.85 }}>
              Torna indietro e prepara prima la convocazione.
            </p>
          </div>
        ) : (
          <>
            {/* SEZIONE REPORT TATTICO — collassabile */}
            <details style={{
              border: '1px solid #dfe3ea', borderRadius: 12, padding: 0, marginBottom: 12,
              background: '#fafbfc', overflow: 'hidden',
            }}>
              <summary style={{
                padding: '12px 14px', cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: '#181c20',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                listStyle: 'none',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  📋 Report tattico
                </span>
                {(formation || reportPositive || reportNegative || reportGeneral || weather || refereeNotes) ? (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 10,
                    background: '#dcf1e2', color: '#006e25', letterSpacing: 0.3,
                  }}>
                    ✓ COMPILATO
                  </span>
                ) : (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 10,
                    background: '#fff4e6', color: '#a15c00', letterSpacing: 0.3,
                  }}>
                    VUOTO
                  </span>
                )}
              </summary>

              <div style={{ padding: '4px 14px 14px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <SmallLabel>Modulo / formazione</SmallLabel>
                    <input
                      list="lenci-modules"
                      value={formation}
                      onChange={e => setFormation(e.target.value)}
                      placeholder="es. 4-3-3 (scegli o scrivi)"
                      style={compactInput}
                    />
                    <datalist id="lenci-modules">
                      {MODULES.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <SmallLabel>Meteo</SmallLabel>
                    <input
                      value={weather}
                      onChange={e => setWeather(e.target.value)}
                      placeholder="es. soleggiato, campo bagnato"
                      style={compactInput}
                    />
                  </div>
                </div>

                <div>
                  <SmallLabel>✅ Cosa è andato bene</SmallLabel>
                  <textarea
                    value={reportPositive}
                    onChange={e => setReportPositive(e.target.value)}
                    placeholder="Aspetti positivi da valorizzare: gioco costruito dal basso, aggressività alta, ecc."
                    rows={2}
                    style={{ ...compactInput, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <SmallLabel>⚠ Cosa migliorare</SmallLabel>
                  <textarea
                    value={reportNegative}
                    onChange={e => setReportNegative(e.target.value)}
                    placeholder="Aspetti su cui lavorare nella prossima settimana"
                    rows={2}
                    style={{ ...compactInput, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <SmallLabel>📝 Commento generale</SmallLabel>
                  <textarea
                    value={reportGeneral}
                    onChange={e => setReportGeneral(e.target.value)}
                    placeholder="Racconto sintetico della partita, momenti chiave, comportamento della squadra"
                    rows={3}
                    style={{ ...compactInput, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <SmallLabel>Note sull'arbitraggio (opzionale)</SmallLabel>
                  <textarea
                    value={refereeNotes}
                    onChange={e => setRefereeNotes(e.target.value)}
                    placeholder="Eventuali osservazioni sull'arbitro / conduzione della gara"
                    rows={2}
                    style={{ ...compactInput, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </details>

            {/* Riepilogo mini */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 12, fontSize: 11, flexWrap: 'wrap',
            }}>
              <MiniStat label="in campo" value={played} color="#006e25" />
              <MiniStat label="gol segnati" value={totalGoals} color="#005f98" />
              <span style={{
                marginLeft: 'auto', color: '#707882', fontSize: 10.5, fontStyle: 'italic',
              }}>
                Tocca un giocatore per aprire il form
              </span>
            </div>

            {/* Autogol degli avversari a favore Lenci: contano nel nostro risultato ma non hanno
                un giocatore Lenci a cui essere attribuiti. */}
            <div style={{
              marginBottom: 12, padding: 12,
              background: opponentOwnGoals > 0 ? '#f0f9ff' : '#f8f9fc',
              border: `1px solid ${opponentOwnGoals > 0 ? '#005f98' : '#e0e2e9'}`,
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005f98' }}>swap_horiz</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
                    Autogol avversari a favore Lenci
                  </div>
                  <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
                    Ogni autogol dell'avversario che vale come nostro gol. Entra nel punteggio Lenci.
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <Counter
                  label="Numero"
                  value={opponentOwnGoals}
                  onChange={n => {
                    setOpponentOwnGoals(n)
                    // Se riduco il count sotto la lunghezza dei minuti, taglio i minuti in eccesso
                    if (n < opponentOwnGoalMinutes.length) {
                      setOpponentOwnGoalMinutes(opponentOwnGoalMinutes.slice(0, n))
                    }
                  }}
                  icon="sports_soccer"
                  color="#005f98"
                />
                {opponentOwnGoals > 0 && (
                  <MinutesInput
                    label="Minuti (facoltativi)"
                    value={opponentOwnGoalMinutes}
                    onChange={setOpponentOwnGoalMinutes}
                  />
                )}
              </div>
            </div>

            {/* Lista giocatori */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {players.map(p => {
                const s = stats[p.id] || emptyStats(p.id)
                const isExpanded = expandedPlayer === p.id
                const initials = ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase()
                const played = s.was_starter || s.minute_in != null

                return (
                  <div key={p.id} style={{
                    background: '#fff', borderRadius: 12,
                    border: `1px solid ${isExpanded ? '#005f98' : (played ? '#80f98b' : '#e6e8ee')}`,
                    overflow: 'hidden',
                  }}>
                    {/* Header compatto */}
                    <div
                      onClick={() => setExpandedPlayer(isExpanded ? null : p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', cursor: 'pointer',
                        background: isExpanded ? '#f7f9ff' : (played ? 'rgba(128,249,139,0.08)' : '#fff'),
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: avatarBg(initials), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 11, flexShrink: 0,
                      }}>{initials}</div>
                      {p.jersey_number != null && (
                        <span style={{
                          minWidth: 26, textAlign: 'center',
                          background: '#e6e8ee', padding: '2px 6px', borderRadius: 6,
                          fontSize: 11, fontWeight: 800, color: '#404751',
                        }}>#{p.jersey_number}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                          {p.last_name} {p.first_name}
                        </div>
                        {/* Riepilogo inline */}
                        <div style={{ fontSize: 10.5, color: '#707882', display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                          {roleOf(s) === 'starter' && (
                            <span style={pill('#006e25', 'rgba(128,249,139,0.35)')}>Titolare</span>
                          )}
                          {roleOf(s) === 'sub' && (
                            <span style={pill('#005f98', 'rgba(160,196,230,0.5)')}>
                              Subentrato{s.minute_in != null ? ` al ${s.minute_in}'` : ''}
                            </span>
                          )}
                          {roleOf(s) === 'out' && <span style={{ opacity: 0.6 }}>Non entrato</span>}
                          {s.minute_out != null && <span>fino {s.minute_out}'</span>}
                          {s.goals > 0 && <span>⚽ {s.goals}</span>}
                          {s.penalties_scored > 0 && <span>🎯 {s.penalties_scored}rig</span>}
                          {s.assists > 0 && <span>🅰️ {s.assists}</span>}
                          {s.yellow_cards > 0 && <span>🟨{s.yellow_cards > 1 ? s.yellow_cards : ''}</span>}
                          {s.red_card && <span>🟥</span>}
                          {s.rating != null && <span style={{ fontWeight: 800, color: '#005f98' }}>voto {s.rating}</span>}
                          {s.is_mvp && <span style={{ color: '#8e6300', fontWeight: 800 }}>⭐ MVP</span>}
                        </div>
                      </div>
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={20} color="#707882" />
                    </div>

                    {/* Form espanso */}
                    {isExpanded && (
                      <div style={{ padding: '12px 14px', borderTop: '1px solid #e6e8ee', background: '#fafbfd' }}>
                        {/* Titolare / Subentrato / Non giocato */}
                        <div style={{ marginBottom: 12 }}>
                          <SmallLabel>Impiego in gara</SmallLabel>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                            <ToggleBtn active={roleOf(s) === 'starter'} onClick={() => setPlayerRole(p.id, 'starter')} label="Titolare" color="#006e25" />
                            <ToggleBtn active={roleOf(s) === 'sub'} onClick={() => setPlayerRole(p.id, 'sub')} label="Subentrato" color="#005f98" />
                            <ToggleBtn active={roleOf(s) === 'out'} onClick={() => setPlayerRole(p.id, 'out')} label="Non entrato" color="#707882" />
                          </div>
                        </div>

                        {/* Minutaggio — visibile per titolari e subentrati */}
                        {roleOf(s) !== 'out' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                            <NumField
                              label={roleOf(s) === 'sub' ? "Min ingresso*" : "Min ingresso"}
                              value={s.minute_in ?? ''}
                              onChange={v => updateStat(p.id, { minute_in: v })}
                              min={0} max={120}
                              placeholder={roleOf(s) === 'sub' ? 'es. 60' : '0'}
                            />
                            <NumField label="Min uscita" value={s.minute_out ?? ''} onChange={v => updateStat(p.id, { minute_out: v })} min={0} max={120} placeholder="finale" />
                            <div>
                              <SmallLabel>Ruolo giocato</SmallLabel>
                              <select
                                value={s.position_played || ''}
                                onChange={e => updateStat(p.id, { position_played: e.target.value || null })}
                                style={{ ...compactInput, padding: '6px 8px' }}
                              >
                                <option value="">— stesso —</option>
                                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Gol / Assist / Autogol */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <Counter label="Gol" value={s.goals} onChange={v => updateStat(p.id, { goals: v })} icon="sports_soccer" color="#005f98" />
                          <Counter label="Assist" value={s.assists} onChange={v => updateStat(p.id, { assists: v })} icon="volunteer_activism" color="#006e25" />
                          <Counter label="Autogol" value={s.own_goals} onChange={v => updateStat(p.id, { own_goals: v })} icon="dangerous" color="#93000a" />
                        </div>
                        {/* Minuti gol / autogol (facoltativi, per la vista giornalisti) */}
                        {(s.goals > 0 || s.own_goals > 0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
                            {s.goals > 0 && (
                              <MinutesInput
                                label="Minuti gol (es. 12, 45+2, 78)"
                                value={s.goal_minutes}
                                onChange={arr => updateStat(p.id, { goal_minutes: arr })}
                              />
                            )}
                            {s.own_goals > 0 && (
                              <MinutesInput
                                label="Minuti autogol"
                                value={s.own_goal_minutes}
                                onChange={arr => updateStat(p.id, { own_goal_minutes: arr })}
                              />
                            )}
                          </div>
                        )}

                        {/* Rigori */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <Counter label="Rigori segnati" value={s.penalties_scored} onChange={v => updateStat(p.id, { penalties_scored: v })} icon="gps_fixed" color="#006e25" />
                          <Counter label="Rigori sbagliati" value={s.penalties_missed} onChange={v => updateStat(p.id, { penalties_missed: v })} icon="gps_off" color="#8e6300" />
                        </div>
                        {/* Minuti rigori segnati */}
                        {s.penalties_scored > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <MinutesInput
                              label="Minuti rigori segnati"
                              value={s.penalty_minutes}
                              onChange={arr => updateStat(p.id, { penalty_minutes: arr })}
                            />
                          </div>
                        )}

                        {/* Cartellini */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div>
                            <SmallLabel>Ammonizioni</SmallLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[0, 1, 2].map(n => (
                                <button key={n} type="button" onClick={() => updateStat(p.id, { yellow_cards: n })}
                                  style={{
                                    flex: 1, padding: '6px', borderRadius: 6,
                                    border: 'none', cursor: 'pointer',
                                    background: s.yellow_cards === n ? '#ffd100' : '#f1f3fa',
                                    color: s.yellow_cards === n ? '#8e6300' : '#707882',
                                    fontWeight: 700, fontSize: 12,
                                  }}
                                >{n === 0 ? '—' : `🟨${n > 1 ? n : ''}`}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <SmallLabel>Espulsione</SmallLabel>
                            <button type="button" onClick={() => updateStat(p.id, { red_card: !s.red_card, red_card_minute: !s.red_card ? 45 : null })}
                              style={{
                                width: '100%', padding: '6px', borderRadius: 6,
                                border: 'none', cursor: 'pointer',
                                background: s.red_card ? '#93000a' : '#f1f3fa',
                                color: s.red_card ? '#fff' : '#707882',
                                fontWeight: 700, fontSize: 12,
                              }}
                            >{s.red_card ? '🟥 SÌ' : '—'}</button>
                          </div>
                          {s.red_card && (
                            <NumField label="Min esp." value={s.red_card_minute ?? ''} onChange={v => updateStat(p.id, { red_card_minute: v })} min={0} max={120} />
                          )}
                        </div>

                        {/* Voto + MVP */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div>
                            <SmallLabel>Voto (0-10)</SmallLabel>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <input
                                type="number" min={0} max={10} step={0.5}
                                value={s.rating ?? ''}
                                onChange={e => updateStat(p.id, { rating: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="—"
                                style={{ ...compactInput, textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#005f98' }}
                              />
                              {s.rating != null && (
                                <button onClick={() => updateStat(p.id, { rating: null })}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <Icon name="close" size={14} color="#707882" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <SmallLabel>MVP</SmallLabel>
                            <button type="button" onClick={() => toggleMvp(p.id)}
                              style={{
                                width: '100%', padding: '6px', borderRadius: 6,
                                border: 'none', cursor: 'pointer',
                                background: s.is_mvp ? 'rgba(255,209,0,0.35)' : '#f1f3fa',
                                color: s.is_mvp ? '#8e6300' : '#707882',
                                fontWeight: 700, fontSize: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              }}
                            >
                              <Icon name="star" size={12} color={s.is_mvp ? '#8e6300' : '#c0c7d2'} />
                              {s.is_mvp ? 'Sì' : '—'}
                            </button>
                          </div>
                        </div>

                        {/* Note */}
                        <div>
                          <SmallLabel>Note</SmallLabel>
                          <textarea
                            value={s.notes || ''}
                            onChange={e => updateStat(p.id, { notes: e.target.value })}
                            placeholder="Osservazioni tecniche, prestazioni, infortuni…"
                            rows={2}
                            style={{ ...compactInput, resize: 'vertical', fontFamily: 'inherit' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Presenze staff (mister + dirigenti che erano in panchina) */}
            <StaffAttendanceSection eventKind="match" eventId={match.id} />

            {/* Flag pubblicazione per la vista giornalisti */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              background: publishedForJournalists ? '#e8f0f9' : '#f8f9fc',
              border: `1px solid ${publishedForJournalists ? '#005f98' : '#e0e2e9'}`,
              borderRadius: 10, cursor: 'pointer',
            }}>
              <input type="checkbox" checked={publishedForJournalists}
                onChange={e => setPublishedForJournalists(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                  Pubblica su vista giornalisti
                </div>
                <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>
                  Quando attivo, questa partita compare nell'elenco letto dai giornalisti locali
                  con formazione, marcatori, ammonizioni ed espulsioni. Disattiva se il referto
                  non è ancora pronto per la comunicazione esterna.
                </div>
              </div>
            </label>

            {/* Salva */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none',
                background: savedOk ? '#006e25' : 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
                color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,95,152,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: saving ? 0.6 : 1,
                transition: 'background 0.2s',
              }}
            >
              <Icon name={savedOk ? 'check_circle' : 'save'} size={17} color="#fff" />
              {savedOk ? 'Referto salvato!' : (saving ? 'Salvo…' : 'Salva referto post-gara')}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// =========== helpers UI ===========

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 9.5, fontWeight: 800, color: '#404751',
      textTransform: 'uppercase', letterSpacing: '0.04em',
      display: 'block', marginBottom: 4,
    }}>{children}</label>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color, fontWeight: 700,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        background: color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800,
      }}>{value}</span>
      {label}
    </span>
  )
}

function ToggleBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '8px', borderRadius: 8,
        border: 'none', cursor: 'pointer',
        background: active ? color : '#f1f3fa',
        color: active ? '#fff' : '#404751',
        fontSize: 11, fontWeight: 700,
      }}
    >{label}</button>
  )
}

function NumField({ label, value, onChange, min, max, placeholder }: {
  label: string; value: number | string; onChange: (n: number | null) => void;
  min?: number; max?: number; placeholder?: string;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
        placeholder={placeholder}
        style={{ ...compactInput, textAlign: 'center', fontWeight: 700 }}
      />
    </div>
  )
}

function Counter({ label, value, onChange, icon, color }: {
  label: string; value: number; onChange: (n: number) => void; icon: string; color: string;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          style={counterBtn}>−</button>
        <div style={{
          flex: 1, textAlign: 'center', padding: '6px',
          background: value > 0 ? `${color}15` : '#f1f3fa',
          color: value > 0 ? color : '#707882',
          borderRadius: 6, fontWeight: 800, fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <Icon name={icon} size={13} color={value > 0 ? color : '#c0c7d2'} />
          {value}
        </div>
        <button type="button" onClick={() => onChange(value + 1)}
          style={counterBtn}>+</button>
      </div>
    </div>
  )
}

function pill(color: string, bg: string): React.CSSProperties {
  return {
    background: bg, color, padding: '1px 6px', borderRadius: 4,
    fontSize: 9.5, fontWeight: 700,
  }
}

const scoreInputStyle: React.CSSProperties = {
  width: 46, padding: '8px', borderRadius: 8, border: 'none',
  background: 'rgba(255,255,255,0.15)', color: '#fff',
  fontFamily: 'Anybody', fontSize: 26, fontWeight: 800,
  textAlign: 'center', outline: 'none',
}

const compactInput: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6,
  border: '1px solid #c0c7d2', fontSize: 12.5,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#fff',
}

const counterBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid #c0c7d2',
  background: '#fff', color: '#404751', fontSize: 15, fontWeight: 800,
  cursor: 'pointer', flexShrink: 0,
}

/**
 * Input per una lista di minuti (es. "12, 45+2, 78"). Salva un int[] normalizzato
 * (i tempi di recupero "45+2" diventano 47). L'utente vede sempre la stringa che
 * ha digitato finché è in focus, così può correggere liberamente.
 */
function MinutesInput({
  label, value, onChange,
}: { label: string; value: number[]; onChange: (arr: number[]) => void }) {
  const [text, setText] = useState<string>(value.join(', '))
  // Se il parent aggiorna value da fuori (es. dopo load), risincronizzo il testo
  useEffect(() => {
    setText(value.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.length])

  const parse = (raw: string): number[] => raw
    .split(/[,;\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      // Supporta forme "45+2" → 47, "12" → 12
      const m = s.match(/^(\d+)(?:\+(\d+))?$/)
      if (!m) return NaN
      return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0)
    })
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 130)

  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <input
        value={text}
        onChange={e => {
          setText(e.target.value)
          onChange(parse(e.target.value))
        }}
        placeholder="es. 12, 45+2, 78"
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8,
          border: '1px solid #c0c7d2', background: '#fff',
          fontFamily: 'inherit', fontSize: 13, color: '#181c20',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
