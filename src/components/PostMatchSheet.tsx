import { useState, useEffect, useMemo, useRef } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { avatarBg } from '../lib/utils'
import { StaffAttendanceSection } from './StaffAttendanceSection'
import { PitchView, pitchToPngDataUrl, dataUrlToBlob, type PitchPlayer } from './PitchView'
import { MatchTimeline } from './MatchTimeline'
import { buildTimelineEvents } from '../lib/timelineBuilder'
import { buildLocandinaPngDataUrl, type LocandinaData } from '../lib/locandinaBuilder'

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
  team_match_periods_count?: number | null
  team_match_period_duration_min?: number | null
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
  role_slot?: string | null
  slot_index?: number | null
  role_slot_label?: string | null
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
  // Modulo effettivamente giocato (se cambiato in corsa) + minuto del cambio
  const [effectiveFormation, setEffectiveFormation] = useState('')
  const [formationChangeMinute, setFormationChangeMinute] = useState('')
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
  const [opponentGoalMinutes, setOpponentGoalMinutes] = useState<number[]>([])
  // Id del capitano dei convocati (dalla convocazione): serve per calcolare captain_change_minute
  const [captainPlayerId, setCaptainPlayerId] = useState<string | null>(null)
  // Id del vice capitano dei convocati (per notazione recap "Capitano dal X'")
  const [viceCaptainPlayerId, setViceCaptainPlayerId] = useState<string | null>(null)
  // Timestamp di quando la distinta tattica è stata compilata (banner + prompt "sei allineato?")
  const [lineupCompletedAt, setLineupCompletedAt] = useState<string | null>(null)
  // Bozza persistente in localStorage: metadati per il banner "recupera bozza"
  const [draftMeta, setDraftMeta] = useState<{ savedAt: string; playersCount: number } | null>(null)
  // Flag interno: true quando load() ha finito, così il useEffect di salvataggio bozza non parte al primo render
  const [isLoaded, setIsLoaded] = useState(false)

  // Chiave localStorage per la bozza di questa partita
  const draftKey = match?.id ? `lenci-postmatch-draft-${match.id}` : null

  useEffect(() => {
    if (!open || !match) {
      setIsLoaded(false)
      return
    }
    load()
  }, [open, match?.id])

  const load = async () => {
    if (!match) return
    setLoading(true)

    // Convocati (via convocations) + tutte stats esistenti + campi report tattico
    const [convRes, statsRes, matchRes] = await Promise.all([
      supabase.from('convocations')
        .select('player_id, is_captain, is_vice_captain, shirt_number_override, player:players(id, first_name, last_name, jersey_number, position)')
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

    // Carico autogol avversari + gol subiti + modulo effettivo + lineup_completed_at in query separata resiliente
    // (le colonne potrebbero non esistere se le migration v1.9.55/v1.9.59/v1.9.61/v1.9.64 non sono state applicate).
    try {
      const { data: oogData } = await supabase.from('matches')
        .select('opponent_own_goals, opponent_own_goal_minutes, opponent_goal_minutes, effective_formation, formation_change_minute, lineup_completed_at')
        .eq('id', match.id)
        .maybeSingle()
      const oogRow = oogData as { opponent_own_goals?: number | null; opponent_own_goal_minutes?: number[] | null; opponent_goal_minutes?: number[] | null; effective_formation?: string | null; formation_change_minute?: number | null; lineup_completed_at?: string | null } | null
      setOpponentOwnGoals(oogRow?.opponent_own_goals ?? 0)
      setOpponentOwnGoalMinutes(oogRow?.opponent_own_goal_minutes ?? [])
      setOpponentGoalMinutes(oogRow?.opponent_goal_minutes ?? [])
      setEffectiveFormation(oogRow?.effective_formation ?? '')
      setFormationChangeMinute(oogRow?.formation_change_minute != null ? String(oogRow.formation_change_minute) : '')
      setLineupCompletedAt(oogRow?.lineup_completed_at ?? null)
    } catch {
      setOpponentOwnGoals(0)
      setOpponentOwnGoalMinutes([])
      setOpponentGoalMinutes([])
      setEffectiveFormation('')
      setFormationChangeMinute('')
      setLineupCompletedAt(null)
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
    // Identifico il capitano dalla convocazione: serve per calcolare captain_change_minute al save
    const capRow = ((convRes.data ?? []) as any[]).find(c => c.is_captain)
    setCaptainPlayerId(capRow?.player_id ?? null)
    const viceRow = ((convRes.data ?? []) as any[]).find(c => (c as any).is_vice_captain)
    setViceCaptainPlayerId(viceRow?.player_id ?? null)

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

    // Check bozza in localStorage per questo match
    if (draftKey) {
      try {
        const rawDraft = localStorage.getItem(draftKey)
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft) as { savedAt: string; stats?: Record<string, any> }
          if (parsed?.savedAt) {
            setDraftMeta({
              savedAt: parsed.savedAt,
              playersCount: parsed.stats ? Object.keys(parsed.stats).length : 0,
            })
          }
        }
      } catch (err) {
        console.warn('[PostMatchSheet] Errore lettura bozza', err)
      }
    }

    setLoading(false)
    // Piccolo delay: monto isLoaded al prossimo tick per evitare che il useEffect di salvataggio
    // bozza scriva subito dopo il load (che ha appena settato gli state a valore DB)
    setTimeout(() => setIsLoaded(true), 100)
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

  // Bozza persistente: salva lo state completo del referto in localStorage con debounce 500ms.
  // Serve a proteggere il coach da chiusure accidentali (tap fuori sheet, chiude browser, ecc.).
  // Non sostituisce il salvataggio esplicito su DB — è solo un cuscinetto di sicurezza.
  useEffect(() => {
    if (!isLoaded || !draftKey) return
    const timer = setTimeout(() => {
      try {
        const payload = {
          savedAt: new Date().toISOString(),
          formation,
          effectiveFormation,
          formationChangeMinute,
          reportPositive,
          reportNegative,
          reportGeneral,
          weather,
          refereeNotes,
          publishedForJournalists,
          ourScore,
          theirScore,
          autoScore,
          opponentOwnGoals,
          opponentOwnGoalMinutes,
          opponentGoalMinutes,
          stats,
        }
        localStorage.setItem(draftKey, JSON.stringify(payload))
      } catch (err) {
        console.warn('[PostMatchSheet] Errore salvataggio bozza', err)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [isLoaded, draftKey, formation, effectiveFormation, formationChangeMinute, reportPositive, reportNegative, reportGeneral, weather, refereeNotes, publishedForJournalists, ourScore, theirScore, autoScore, opponentOwnGoals, opponentOwnGoalMinutes, opponentGoalMinutes, stats])

  // Recupera bozza da localStorage e applica tutto lo state
  const recoverDraft = () => {
    if (!draftKey) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) { setDraftMeta(null); return }
      const p = JSON.parse(raw)
      if (p.formation != null) setFormation(p.formation)
      if (p.effectiveFormation != null) setEffectiveFormation(p.effectiveFormation)
      if (p.formationChangeMinute != null) setFormationChangeMinute(p.formationChangeMinute)
      if (p.reportPositive != null) setReportPositive(p.reportPositive)
      if (p.reportNegative != null) setReportNegative(p.reportNegative)
      if (p.reportGeneral != null) setReportGeneral(p.reportGeneral)
      if (p.weather != null) setWeather(p.weather)
      if (p.refereeNotes != null) setRefereeNotes(p.refereeNotes)
      if (p.publishedForJournalists != null) setPublishedForJournalists(p.publishedForJournalists)
      if (p.ourScore != null) setOurScore(p.ourScore)
      if (p.theirScore != null) setTheirScore(p.theirScore)
      if (p.autoScore != null) setAutoScore(p.autoScore)
      if (p.opponentOwnGoals != null) setOpponentOwnGoals(p.opponentOwnGoals)
      if (p.opponentOwnGoalMinutes != null) setOpponentOwnGoalMinutes(p.opponentOwnGoalMinutes)
      if (p.opponentGoalMinutes != null) setOpponentGoalMinutes(p.opponentGoalMinutes)
      if (p.stats) setStats(p.stats)
      setDraftMeta(null)
    } catch (err) {
      alert('Errore nel recupero della bozza: ' + (err as any)?.message)
    }
  }

  // Scarta la bozza salvata (l'utente vuole partire dai dati del DB)
  const discardDraft = () => {
    if (!draftKey) return
    try { localStorage.removeItem(draftKey) } catch {}
    setDraftMeta(null)
  }

  // Ruolo giocatore nella gara: 3 stati mutuamente esclusivi
  //   'starter' = titolare (was_starter=true, minute_in=0 implicito)
  //   'sub'     = subentrato dalla panchina (was_starter=false, minute_in>0)
  //   'out'     = non entrato / non convocato (was_starter=false, minute_in=null)
  // NB: quando un giocatore lascia lo stato 'starter' i campi legati alla distinta
  // tattica (role_slot, slot_index, role_slot_label) vengono azzerati per coerenza.
  const setPlayerRole = (pid: string, role: 'starter' | 'sub' | 'out') => {
    if (role === 'starter') {
      updateStat(pid, { was_starter: true,  minute_in: 0,    minute_out: null })
    } else if (role === 'sub') {
      // Serve un minute_in > 0 perché roleOf riconosca il ruolo 'sub': se il giocatore
      // non ha ancora un ingresso valorizzato, uso 46 come default ragionevole
      // (inizio secondo tempo per una partita da 90'); l'utente poi lo modifica.
      const current = stats[pid]
      const keepIn = (current?.minute_in && current.minute_in > 0) ? current.minute_in : 46
      updateStat(pid, {
        was_starter: false, minute_in: keepIn, minute_out: current?.minute_out ?? null,
        role_slot: null, slot_index: null, role_slot_label: null,
      } as any)
    } else {
      updateStat(pid, {
        was_starter: false, minute_in: null,  minute_out: null,
        role_slot: null, slot_index: null, role_slot_label: null,
      } as any)
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

  // Ordinamento smart: se c'è una distinta compilata, titolari prima (ordinati per slot_index),
  // poi panchinari (ordinati per jersey_number). Se non c'è distinta, ordinamento classico per jersey.
  const hasLineup = useMemo(() =>
    Object.values(stats).some(s => s.was_starter && (s as any).slot_index != null),
    [stats])
  const sortedPlayers = useMemo(() => {
    if (!hasLineup) return players
    return [...players].sort((a, b) => {
      const sa = stats[a.id]
      const sb = stats[b.id]
      const saIdx = (sa as any)?.slot_index
      const sbIdx = (sb as any)?.slot_index
      const aIsStarter = sa?.was_starter && saIdx != null
      const bIsStarter = sb?.was_starter && sbIdx != null
      if (aIsStarter && bIsStarter) return saIdx - sbIdx
      if (aIsStarter) return -1
      if (bIsStarter) return 1
      // Entrambi panchinari: chi ha giocato (minute_in != null) prima di chi non è entrato
      const aPlayed = sa?.minute_in != null
      const bPlayed = sb?.minute_in != null
      if (aPlayed && !bPlayed) return -1
      if (!aPlayed && bPlayed) return 1
      // Poi per numero maglia
      return (a.jersey_number ?? 999) - (b.jersey_number ?? 999)
    })
  }, [players, stats, hasLineup])

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

      // 1b. Autogol avversari a favore Lenci + captain_change_minute: UPDATE separato in try/catch
      // (colonne aggiunte con le migration v1.9.55 / v1.9.58: se il DB non le ha ancora
      // il campo non viene salvato ma il resto del referto sì).
      try {
        // captain_change_minute: se il capitano titolare esce durante la partita
        // (minute_out valorizzato) segno il minuto della sostituzione. Il vice
        // prenderà la fascia da quel momento nella vista giornalisti.
        let captainChangeMinute: number | null = null
        if (captainPlayerId) {
          const capStats = stats[captainPlayerId]
          if (capStats?.was_starter && capStats.minute_out != null && capStats.minute_out > 0) {
            captainChangeMinute = capStats.minute_out
          }
        }
        await supabase.from('matches').update({
          opponent_own_goals: opponentOwnGoals,
          opponent_own_goal_minutes: opponentOwnGoalMinutes,
          opponent_goal_minutes: opponentGoalMinutes,
          captain_change_minute: captainChangeMinute,
          effective_formation: effectiveFormation.trim() || null,
          formation_change_minute: formationChangeMinute.trim() ? (parseInt(formationChangeMinute, 10) || null) : null,
        }).eq('id', match.id)
      } catch (err) {
        console.warn('[PostMatchSheet] opponent_own_goals/opponent_goal_minutes/captain_change_minute/effective_formation non salvati (migration mancante?)', err)
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
      // Bozza persistente non serve più: il DB ora ha i dati definitivi
      if (draftKey) {
        try { localStorage.removeItem(draftKey) } catch {}
        setDraftMeta(null)
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

                {/* Modulo cambiato in corsa: toggle compatto */}
                {formation && (
                  <div style={{
                    marginTop: 8, padding: 10, borderRadius: 8,
                    background: effectiveFormation ? 'rgba(224,168,0,0.08)' : '#f8f9fc',
                    border: `1px solid ${effectiveFormation ? '#e0a800' : '#e6e8ee'}`,
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11.5, fontWeight: 700, color: '#404751', cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={!!effectiveFormation}
                        onChange={e => {
                          if (e.target.checked) {
                            setEffectiveFormation(formation)  // parte da modulo iniziale
                          } else {
                            setEffectiveFormation('')
                            setFormationChangeMinute('')
                          }
                        }}
                      />
                      Modulo cambiato in corsa (es. dopo un\u2019espulsione)
                    </label>
                    {effectiveFormation && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <SmallLabel>Nuovo modulo</SmallLabel>
                          <input
                            list="lenci-modules"
                            value={effectiveFormation}
                            onChange={e => setEffectiveFormation(e.target.value)}
                            placeholder="es. 4-4-1"
                            style={compactInput}
                          />
                        </div>
                        <div>
                          <SmallLabel>Al minuto</SmallLabel>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={formationChangeMinute}
                            onChange={e => setFormationChangeMinute(e.target.value)}
                            placeholder="es. 65"
                            style={compactInput}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

            {/* Banner: bozza recuperabile da localStorage — chiusura accidentale, refresh, ecc. */}
            {draftMeta && (
              <div style={{
                marginBottom: 12, padding: 10, borderRadius: 10,
                background: '#fff4e5', border: '1px solid #e0a800',
                display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8e6300', flexShrink: 0 }}>
                  restore
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#8e6300' }}>
                    Hai una bozza non salvata
                  </div>
                  <div style={{ fontSize: 10.5, color: '#404751', marginTop: 2, lineHeight: 1.4 }}>
                    Modifiche del {new Date(draftMeta.savedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle {new Date(draftMeta.savedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {draftMeta.playersCount > 0 && ` \u00b7 ${draftMeta.playersCount} giocator${draftMeta.playersCount === 1 ? 'e' : 'i'} interessat${draftMeta.playersCount === 1 ? 'o' : 'i'}`}.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={recoverDraft}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid #8e6300',
                      background: '#8e6300', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Recupera
                  </button>
                  <button
                    onClick={discardDraft}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid #c0c7d2',
                      background: 'transparent', color: '#707882', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Scarta
                  </button>
                </div>
              </div>
            )}

            {/* Banner: distinta tattica compilata → i titolari sono già impostati */}
            {lineupCompletedAt && hasLineup && (
              <div style={{
                marginBottom: 12, padding: 10, borderRadius: 10,
                background: '#e8f5e9', border: '1px solid #006e25',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#006e25', flexShrink: 0 }}>
                  check_circle
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#005520' }}>
                    Distinta tattica gi\u00e0 compilata
                  </div>
                  <div style={{ fontSize: 10.5, color: '#404751', marginTop: 2, lineHeight: 1.4 }}>
                    I titolari sono impostati con i ruoli dalla distinta ({new Date(lineupCompletedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle {new Date(lineupCompletedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}).
                    Aggiungi solo gol, sostituzioni e cartellini.
                  </div>
                </div>
              </div>
            )}

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

            {/* Gol avversari (subiti): serve per la timeline eventi (puntini rossi al minuto).
                Il conteggio totale è già in matches.away_score/home_score, ma qui tracciamo i minuti. */}
            <div style={{
              marginBottom: 12, padding: 12,
              background: opponentGoalMinutes.length > 0 ? '#fff5f5' : '#f8f9fc',
              border: `1px solid ${opponentGoalMinutes.length > 0 ? '#93000a' : '#e0e2e9'}`,
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#93000a' }}>sports_soccer</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
                    Gol avversari (minuti)
                  </div>
                  <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
                    Minuti dei gol segnati dagli avversari. Facoltativi, ma se compilati compaiono nella timeline eventi come puntini rossi.
                  </div>
                </div>
              </div>
              <MinutesInput
                label={`Minuti gol subiti (facoltativi) — segnati ${theirScore}`}
                value={opponentGoalMinutes}
                onChange={setOpponentGoalMinutes}
              />
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

            {/* Lista giocatori — ordinata per slot se distinta compilata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {sortedPlayers.map(p => {
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

                        {/* Sostituisce: solo per subentrati con minute_in valorizzato.
                            Selezionando un titolare, imposta automaticamente il suo minute_out
                            uguale al minute_in del subentrato (una singola sostituzione = due state update coordinati). */}
                        {roleOf(s) === 'sub' && s.minute_in != null && s.minute_in > 0 && (
                          <div style={{
                            marginBottom: 12, padding: 8, borderRadius: 8,
                            background: 'rgba(0,95,152,0.06)', border: '1px solid rgba(0,95,152,0.25)',
                          }}>
                            <SmallLabel>Sostituisce (titolare che esce al {s.minute_in}\u2032)</SmallLabel>
                            <select
                              value={(() => {
                                // Chi ha minute_out = questo minute_in E era titolare
                                const replaced = Object.values(stats).find(x =>
                                  x.was_starter && x.minute_out === s.minute_in && x.player_id !== p.id
                                )
                                return replaced?.player_id || ''
                              })()}
                              onChange={e => {
                                const outId = e.target.value
                                // Reset: chi era stato marcato come sostituito da questo sub torna senza minute_out
                                setStats(prev => {
                                  const next = { ...prev }
                                  for (const [pid, st] of Object.entries(next)) {
                                    if (st.was_starter && st.minute_out === s.minute_in && pid !== outId) {
                                      // Solo se non c'è un altro sub che gli è associato
                                      const otherSub = Object.values(next).find(x =>
                                        x.player_id !== p.id && !x.was_starter && x.minute_in === s.minute_in
                                      )
                                      if (!otherSub) next[pid] = { ...st, minute_out: null }
                                    }
                                  }
                                  if (outId) {
                                    const cur = next[outId] || emptyStats(outId)
                                    next[outId] = { ...cur, minute_out: s.minute_in }
                                  }
                                  return next
                                })
                              }}
                              style={{ ...compactInput, padding: '6px 8px' }}
                            >
                              <option value="">— Nessuno / imposta manualmente —</option>
                              {/* Titolari ancora "in campo" al minute_in del sub: was_starter=true
                                  E (minute_out == null OR minute_out >= s.minute_in) */}
                              {players.filter(other => {
                                if (other.id === p.id) return false
                                const os = stats[other.id]
                                if (!os?.was_starter) return false
                                if (os.minute_out != null && os.minute_out < (s.minute_in ?? 0)) return false
                                return true
                              }).map(other => (
                                <option key={other.id} value={other.id}>
                                  {other.jersey_number != null ? `#${other.jersey_number} ` : ''}
                                  {other.last_name} {other.first_name[0]}.
                                </option>
                              ))}
                            </select>
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

            {/* Recap condivisibile — sempre disponibile, comodo dopo il salvataggio */}
            <RecapExport
              match={match}
              formation={formation}
              players={players}
              stats={stats}
              opponentOwnGoals={opponentOwnGoals}
              opponentOwnGoalMinutes={opponentOwnGoalMinutes}
              opponentGoalMinutes={opponentGoalMinutes}
              ourScore={parseInt(ourScore, 10) || 0}
              theirScore={parseInt(theirScore, 10) || 0}
              captainPlayerId={captainPlayerId}
              viceCaptainPlayerId={viceCaptainPlayerId}
            />
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

/* ---------------- Recap post-gara: copia/condividi messaggio ---------------- */

// Ordine ruoli standard per la formazione (dal portiere in poi)
const RECAP_POSITION_ORDER: Record<string, number> = {
  'Portiere': 1,
  'Difensore centrale': 10, 'Terzino destro': 11, 'Terzino sinistro': 12,
  'Mediano': 20, 'Centrocampista centrale': 21, 'Interno destro': 22, 'Interno sinistro': 23,
  'Esterno destro': 24, 'Esterno sinistro': 25,
  'Trequartista': 30,
  'Ala destra': 40, 'Ala sinistra': 41,
  'Punta centrale': 50, 'Seconda punta': 51,
}
const recapPositionRank = (pos: string | null | undefined): number =>
  !pos ? 999 : (RECAP_POSITION_ORDER[pos] ?? 999)

function buildRecapMessage(args: {
  match: PostMatchData
  formation: string
  players: Player[]
  stats: Record<string, Stats>
  opponentOwnGoals: number
  opponentOwnGoalMinutes: number[]
  ourScore: number
  theirScore: number
  captainPlayerId: string | null
  viceCaptainPlayerId: string | null
  captainChangeMinute: number | null
}): string {
  const { match, formation, players, stats, opponentOwnGoals, opponentOwnGoalMinutes, ourScore, theirScore,
    captainPlayerId, viceCaptainPlayerId, captainChangeMinute } = args
  const isHome = match.venue === 'home'
  const lenci = 'Lenci Poirino'
  const line1 = isHome
    ? `🏆 ${lenci} ${ourScore}-${theirScore} ${match.opponent}`
    : `🏆 ${match.opponent} ${theirScore}-${ourScore} ${lenci}`
  const dateFmt = new Date(match.match_date).toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const teamLine = `🏅 ${match.team_name}${match.team_category ? ` · ${match.team_category}` : ''}`
  const meta: string[] = [line1, `📅 ${dateFmt} · ${isHome ? 'in casa' : 'in trasferta'}`]
  meta.push(teamLine)
  if (match.competition) meta.push(`🏆 ${match.competition}`)

  // Marcatori Lenci — un evento per riga, cronologici
  type Event = { min: number; text: string; hasMin: boolean }
  const events: Event[] = []
  const nameOf = (pid: string): string => {
    const p = players.find(x => x.id === pid)
    return p ? `${p.last_name} ${p.first_name[0]}.` : '?'
  }
  for (const s of Object.values(stats)) {
    const goalMin = s.goal_minutes ?? []
    const penMin = s.penalty_minutes ?? []
    const oogMin = s.own_goal_minutes ?? []
    const nGoals = s.goals || 0
    const nPen = s.penalties_scored || 0
    const nOog = s.own_goals || 0

    // Gol normali con minuti
    goalMin.forEach(m => events.push({ min: m, text: `${m}' ⚽ ${nameOf(s.player_id)}`, hasMin: true }))
    // Gol senza minuto (nGoals > goalMin.length)
    const goalNoMin = Math.max(0, nGoals - goalMin.length)
    for (let i = 0; i < goalNoMin; i++) {
      events.push({ min: Infinity, text: `⚽ ${nameOf(s.player_id)}`, hasMin: false })
    }
    // Rigori con minuti
    penMin.forEach(m => events.push({ min: m, text: `${m}' ⚽ ${nameOf(s.player_id)} (rig.)`, hasMin: true }))
    const penNoMin = Math.max(0, nPen - penMin.length)
    for (let i = 0; i < penNoMin; i++) {
      events.push({ min: Infinity, text: `⚽ ${nameOf(s.player_id)} (rig.)`, hasMin: false })
    }
    // Autoreti nostro giocatore (a favore avversario)
    oogMin.forEach(m => events.push({ min: m, text: `${m}' ⚠️ ${nameOf(s.player_id)} (aut. Lenci → ${match.opponent})`, hasMin: true }))
    const oogNoMin = Math.max(0, nOog - oogMin.length)
    for (let i = 0; i < oogNoMin; i++) {
      events.push({ min: Infinity, text: `⚠️ ${nameOf(s.player_id)} (aut. Lenci → ${match.opponent})`, hasMin: false })
    }
  }
  // Autogol avversari a favore Lenci
  const oogAvvCount = opponentOwnGoals || 0
  const oogAvvMin = opponentOwnGoalMinutes || []
  oogAvvMin.forEach(m => events.push({ min: m, text: `${m}' ⚽ aut. avversario`, hasMin: true }))
  const oogAvvNoMin = Math.max(0, oogAvvCount - oogAvvMin.length)
  for (let i = 0; i < oogAvvNoMin; i++) {
    events.push({ min: Infinity, text: `⚽ aut. avversario`, hasMin: false })
  }
  events.sort((a, b) => a.min - b.min)

  const recapLines: string[] = [meta.join('\n')]
  if (events.length > 0) {
    recapLines.push('') // riga vuota separatore
    recapLines.push(events.map(e => e.text).join('\n'))
  }

  // Formazione titolare (ordinata per ruolo tattico dal portiere in poi)
  const sortByRole = (a: Player, b: Player) => {
    const sa = stats[a.id]
    const sb = stats[b.id]
    const ra = recapPositionRank(sa?.position_played)
    const rb = recapPositionRank(sb?.position_played)
    if (ra !== rb) return ra - rb
    const na = a.jersey_number ?? 999
    const nb = b.jersey_number ?? 999
    if (na !== nb) return na - nb
    return a.last_name.localeCompare(b.last_name)
  }
  const starters = players.filter(p => stats[p.id]?.was_starter).sort(sortByRole)
  const subs = players.filter(p => !stats[p.id]?.was_starter && stats[p.id]?.minute_in != null && stats[p.id]!.minute_in! > 0)
    .sort((a, b) => (stats[a.id]!.minute_in! - stats[b.id]!.minute_in!))

  if (starters.length > 0) {
    recapLines.push('')
    recapLines.push(`📋 Formazione titolare${formation ? ` (${formation})` : ''}:`)
    for (const p of starters) {
      const n = p.jersey_number != null ? `${p.jersey_number}. ` : '• '
      const pos = stats[p.id]?.position_played ? ` – ${stats[p.id]!.position_played}` : ''
      // Fascia: capitano titolare + eventuale passaggio al vice
      let capTag = ''
      if (p.id === captainPlayerId) {
        capTag = captainChangeMinute ? ` (C fino al ${captainChangeMinute}')` : ' (C)'
      } else if (p.id === viceCaptainPlayerId) {
        // Vice che gioca dal 1': se il capitano è uscito, prende la fascia dal min di uscita
        capTag = captainChangeMinute ? ` (C dal ${captainChangeMinute}')` : ' (VC)'
      }
      recapLines.push(`${n}${p.last_name} ${p.first_name[0]}.${pos}${capTag}`)
    }
  }
  if (subs.length > 0) {
    recapLines.push('')
    recapLines.push('🔄 Subentrati:')
    for (const p of subs) {
      const min = stats[p.id]!.minute_in
      const pos = stats[p.id]?.position_played ? ` – ${stats[p.id]!.position_played}` : ''
      // Vice capitano subentrato: se il capitano titolare era già uscito, prende la fascia
      let capTag = ''
      if (p.id === viceCaptainPlayerId) {
        capTag = captainChangeMinute ? ` (C dal ${captainChangeMinute}')` : ' (VC)'
      }
      recapLines.push(`${p.last_name} ${p.first_name[0]}. (${min}')${pos}${capTag}`)
    }
  }

  // Cartellini
  const yellows = Object.values(stats).filter(s => (s.yellow_cards ?? 0) > 0)
  const reds = Object.values(stats).filter(s => s.red_card)
  if (yellows.length > 0) {
    recapLines.push('')
    recapLines.push(`🟨 Ammoniti: ${yellows.map(s => nameOf(s.player_id) + ((s.yellow_cards ?? 0) > 1 ? ` (${s.yellow_cards})` : '')).join(', ')}`)
  }
  if (reds.length > 0) {
    recapLines.push(`🟥 Espulsi: ${reds.map(s => nameOf(s.player_id) + (s.red_card_minute ? ` (${s.red_card_minute}')` : '')).join(', ')}`)
  }

  return recapLines.join('\n')
}

function RecapExport({
  match, formation, players, stats, opponentOwnGoals, opponentOwnGoalMinutes, opponentGoalMinutes,
  ourScore, theirScore, captainPlayerId, viceCaptainPlayerId,
}: {
  match: PostMatchData | null
  formation: string
  players: Player[]
  stats: Record<string, Stats>
  opponentOwnGoals: number
  opponentOwnGoalMinutes: number[]
  opponentGoalMinutes: number[]
  ourScore: number
  theirScore: number
  captainPlayerId: string | null
  viceCaptainPlayerId: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [pngBusy, setPngBusy] = useState(false)
  const [pngError, setPngError] = useState<string | null>(null)
  const pitchWrapRef = useRef<HTMLDivElement>(null)
  if (!match) return null
  // Calcolo live del cambio fascia: se il capitano titolare è uscito, il vice
  // prende la fascia dal minuto di uscita
  let captainChangeMinute: number | null = null
  if (captainPlayerId) {
    const capStats = stats[captainPlayerId]
    if (capStats?.was_starter && capStats.minute_out != null && capStats.minute_out > 0) {
      captainChangeMinute = capStats.minute_out
    }
  }
  const message = buildRecapMessage({
    match, formation, players, stats, opponentOwnGoals, opponentOwnGoalMinutes,
    ourScore, theirScore, captainPlayerId, viceCaptainPlayerId, captainChangeMinute,
  })

  // Costruisco i PitchPlayer per il campo grafico dell'export PNG (solo se distinta valida)
  const pitchPlayers: PitchPlayer[] = useMemo(() => {
    const starters = players
      .map(p => {
        const s = stats[p.id]
        if (!s?.was_starter || (s as any).slot_index == null || !s.role_slot) return null
        // Cerca subentrato
        let substituted_by: string | null = null
        let substituted_by_number: number | null = null
        if (s.minute_out != null && s.minute_out > 0) {
          const subP = players.find(x => {
            const xs = stats[x.id]
            return xs && !xs.was_starter && xs.minute_in === s.minute_out
          })
          if (subP) {
            substituted_by = subP.last_name
            substituted_by_number = subP.jersey_number
          }
        }
        return {
          slot_key: s.role_slot,
          slot_label: (s as any).role_slot_label || '',
          jersey_number: p.jersey_number,
          last_name: p.last_name,
          first_name: p.first_name,
          is_captain: p.id === captainPlayerId,
          is_vice_captain: p.id === viceCaptainPlayerId,
          minute_out: s.minute_out,
          substituted_by,
          substituted_by_number,
        } as PitchPlayer
      })
      .filter((x): x is PitchPlayer => x !== null)
    return starters
  }, [players, stats, captainPlayerId, viceCaptainPlayerId])

  const hasPitch = pitchPlayers.length > 0 && !!formation

  // Timeline eventi: gol/rossi/sostituzioni con minuti — mostrata come preview live nel recap
  const { events: timelineEvents, yellowCardsCount } = useMemo(() => buildTimelineEvents({
    stats: players.map(p => {
      const s = stats[p.id]
      return {
        player_id: p.id,
        was_starter: s?.was_starter ?? false,
        minute_in: s?.minute_in ?? null,
        minute_out: s?.minute_out ?? null,
        goals: s?.goals ?? 0,
        goal_minutes: s?.goal_minutes ?? [],
        penalties_scored: s?.penalties_scored ?? 0,
        penalty_minutes: s?.penalty_minutes ?? [],
        own_goals: s?.own_goals ?? 0,
        own_goal_minutes: s?.own_goal_minutes ?? [],
        yellow_cards: s?.yellow_cards ?? 0,
        red_card: s?.red_card ?? false,
        red_card_minute: s?.red_card_minute ?? null,
      }
    }),
    players: Object.fromEntries(players.map(p => [p.id, {
      first_name: p.first_name, last_name: p.last_name, jersey_number: p.jersey_number,
    }])),
    opponentGoalMinutes,
    opponentOwnGoalMinutes,
  }), [players, stats, opponentGoalMinutes, opponentOwnGoalMinutes])
  const hasTimeline = timelineEvents.length > 0 || yellowCardsCount > 0

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: alcune webview mobile bloccano clipboard senza permessi
      window.prompt('Copia manualmente il messaggio:', message)
    }
  }
  const doWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Scarica il campo grafico come PNG (locandina condivisibile)
  // Costruisce il payload LocandinaData dai dati partita.
  // Include marcatori (con distinzione rigori), sostituzioni, gol subiti/autogol avversari.
  const buildLocandinaPayload = (): LocandinaData => {
    const nameOf = (pid: string) => {
      const p = players.find(x => x.id === pid)
      return p ? `${p.last_name} ${p.first_name[0]}.` : '?'
    }
    // Aggrega marcatori per giocatore: per ogni giocatore un array minutes[] + isPenalty[]
    const marcatoriMap = new Map<string, { name: string; minutes: number[]; isPenalty: boolean[] }>()
    for (const s of Object.values(stats)) {
      const goalMin = s.goal_minutes ?? []
      const penMin = s.penalty_minutes ?? []
      if (goalMin.length === 0 && penMin.length === 0) continue
      const key = s.player_id
      if (!marcatoriMap.has(key)) marcatoriMap.set(key, { name: nameOf(key), minutes: [], isPenalty: [] })
      const entry = marcatoriMap.get(key)!
      for (const m of goalMin) { entry.minutes.push(m); entry.isPenalty.push(false) }
      for (const m of penMin) { entry.minutes.push(m); entry.isPenalty.push(true) }
    }
    // Ordina i minuti dentro ciascun marcatore mantenendo l'allineamento isPenalty
    const marcatori = Array.from(marcatoriMap.values()).map(m => {
      const idx = m.minutes.map((min, i) => ({ min, pen: m.isPenalty[i] }))
      idx.sort((a, b) => a.min - b.min)
      return { name: m.name, minutes: idx.map(x => x.min), isPenalty: idx.map(x => x.pen) }
    }).sort((a, b) => a.minutes[0] - b.minutes[0])

    // Sostituzioni: per ogni subentrato con minute_in > 0, trovo il titolare uscito allo stesso minuto
    const sostituzioni: LocandinaData['sostituzioni'] = []
    for (const s of Object.values(stats)) {
      if (!s.was_starter && s.minute_in != null && s.minute_in > 0) {
        const outStat = Object.values(stats).find(x => x.was_starter && x.minute_out === s.minute_in)
        sostituzioni.push({
          minute: s.minute_in,
          in: nameOf(s.player_id),
          out: outStat ? nameOf(outStat.player_id) : '—',
        })
      }
    }
    sostituzioni.sort((a, b) => a.minute - b.minute)

    return {
      teamName: match!.team_name,
      teamCategory: match!.team_category,
      opponentName: match!.opponent,
      ourScore, theirScore,
      matchDate: match!.match_date,
      venue: match!.venue,
      competition: match!.competition,
      formation,
      teamColor: match!.team_color || '#b3005c',
      marcatori,
      opponentOwnGoalMinutes,
      opponentGoalMinutes,
      sostituzioni,
    }
  }

  const buildFileName = () => {
    const isHome = match!.venue === 'home'
    const dateStr = new Date(match!.match_date).toISOString().slice(0, 10)
    const oppSlug = match!.opponent.replace(/[^a-zA-Z0-9]/g, '_')
    return `locandina-${dateStr}-${isHome ? 'vs' : 'a'}-${oppSlug}.png`
  }

  const doDownloadPitchPng = async () => {
    setPngError(null)
    setPngBusy(true)
    try {
      const svg = pitchWrapRef.current?.querySelector('svg') as SVGSVGElement | null
      if (!svg) throw new Error('Campo non trovato')
      const dataUrl = await buildLocandinaPngDataUrl(svg, buildLocandinaPayload())
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = buildFileName()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e: any) {
      setPngError(e?.message || 'Errore generazione locandina')
    } finally {
      setPngBusy(false)
    }
  }

  // Condividi via Web Share API (native share sheet mobile) — se non supportato, fallback download
  const doSharePitchPng = async () => {
    setPngError(null)
    setPngBusy(true)
    try {
      const svg = pitchWrapRef.current?.querySelector('svg') as SVGSVGElement | null
      if (!svg) throw new Error('Campo non trovato')
      const dataUrl = await buildLocandinaPngDataUrl(svg, buildLocandinaPayload())
      const blob = dataUrlToBlob(dataUrl)
      const fileName = buildFileName()
      const file = new File([blob], fileName, { type: 'image/png' })
      const nav = navigator as any
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${match!.team_name} vs ${match!.opponent} ${ourScore}-${theirScore}`,
          text: message,
        })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        try { await navigator.clipboard.writeText(message) } catch {}
        alert('Locandina scaricata e testo copiato negli appunti. Ora aprila in WhatsApp e allega l\u2019immagine.')
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setPngError(e?.message || 'Errore condivisione locandina')
      }
    } finally {
      setPngBusy(false)
    }
  }

  return (
    <div style={{
      marginTop: 12, padding: 12,
      background: '#f0f9ff', border: '1px solid #005f98', borderRadius: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005f98' }}>share</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
            Recap partita
          </div>
          <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1 }}>
            Risultato, marcatori coi minuti, formazione titolare e subentrati.
            Copia il messaggio o condividilo su WhatsApp{hasPitch ? ', oppure scarica la locandina PNG post-partita (header col risultato + campo + marcatori)' : ''}.
          </div>
        </div>
      </div>
      <details style={{ background: '#fff', border: '1px solid #e0e2e9', borderRadius: 8, padding: '6px 10px' }}>
        <summary style={{ fontSize: 11, color: '#005f98', fontWeight: 700, cursor: 'pointer' }}>
          Anteprima messaggio
        </summary>
        <pre style={{
          margin: '6px 0 0', padding: 8, background: '#f8f9fc', borderRadius: 6,
          fontSize: 11, color: '#181c20', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.45,
          maxHeight: 240, overflowY: 'auto',
        }}>{message}</pre>
      </details>
      {hasPitch && (
        <details style={{ background: '#fff', border: '1px solid #e0e2e9', borderRadius: 8, padding: '6px 10px' }}>
          <summary style={{ fontSize: 11, color: '#005f98', fontWeight: 700, cursor: 'pointer' }}>
            Anteprima campo (usato dentro la locandina)
          </summary>
          <div ref={pitchWrapRef} style={{ marginTop: 6 }}>
            <PitchView
              formation={formation}
              players={pitchPlayers}
              height={340}
              shirtColor={match.team_color || '#b3005c'}
            />
          </div>
        </details>
      )}
      {hasTimeline && (
        <details open style={{ background: '#fff', border: '1px solid #e0e2e9', borderRadius: 8, padding: '6px 10px' }}>
          <summary style={{ fontSize: 11, color: '#005f98', fontWeight: 700, cursor: 'pointer' }}>
            Timeline eventi ({timelineEvents.length} {timelineEvents.length === 1 ? 'evento' : 'eventi'}{yellowCardsCount > 0 ? ` + ${yellowCardsCount} 🟨` : ''})
          </summary>
          <div style={{ marginTop: 6 }}>
            <MatchTimeline events={timelineEvents} yellowCardsCount={yellowCardsCount} />
          </div>
        </details>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={doCopy} style={{
          padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: copied ? '#006e25' : '#404751', color: '#fff',
          fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'background 0.2s',
        }}>
          <Icon name={copied ? 'check' : 'content_copy'} size={14} color="#fff" />
          {copied ? 'Copiato!' : 'Copia messaggio'}
        </button>
        <button onClick={doWhatsApp} style={{
          padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#25d366', color: '#fff',
          fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="chat" size={14} color="#fff" />
          Condividi WhatsApp
        </button>
      </div>
      {hasPitch && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={doDownloadPitchPng} disabled={pngBusy} style={{
            padding: '10px 12px', borderRadius: 8, border: '1px solid #005f98', cursor: pngBusy ? 'wait' : 'pointer',
            background: '#fff', color: '#005f98',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: pngBusy ? 0.6 : 1,
          }}>
            <Icon name="download" size={14} color="#005f98" />
            {pngBusy ? 'Genero…' : 'Scarica locandina (PNG)'}
          </button>
          <button onClick={doSharePitchPng} disabled={pngBusy} style={{
            padding: '10px 12px', borderRadius: 8, border: 'none', cursor: pngBusy ? 'wait' : 'pointer',
            background: '#25d366', color: '#fff',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: pngBusy ? 0.6 : 1,
          }}>
            <Icon name="ios_share" size={14} color="#fff" />
            {pngBusy ? 'Genero…' : 'Condividi locandina'}
          </button>
        </div>
      )}
      {pngError && (
        <div style={{
          padding: 8, borderRadius: 6, background: '#ffdad6', color: '#93000a',
          fontSize: 11, fontWeight: 600,
        }}>
          ⚠️ {pngError}
        </div>
      )}
    </div>
  )
}
