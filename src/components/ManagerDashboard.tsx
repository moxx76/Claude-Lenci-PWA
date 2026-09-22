import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { useMyTeam } from '../hooks/useMyTeam'
import { ConvocationSheet, type ConvocationMatch } from './ConvocationSheet'
import { PostMatchSheet, type PostMatchData } from './PostMatchSheet'
import { DistintaTatticaSheet, type DistintaTatticaData } from './DistintaTatticaSheet'
import { PitchView, type PitchPlayer } from './PitchView'
import { MatchTimeline, type TimelineEvent } from './MatchTimeline'
import { buildTimelineEvents } from '../lib/timelineBuilder'
import { ProposeAnnouncementSheet } from './ProposeAnnouncementSheet'
import { AttendanceSheet } from './AttendanceSheet'

interface MatchWithConv {
  id: string
  opponent: string
  match_date: string
  venue: 'home' | 'away'
  competition: string | null
  location: string | null
  location_address: string | null
  kickoff_field: string | null
  shirt_color_home: string | null
  shirt_color_gk: string | null
  meeting_time: string | null
  status: string
  home_score: number | null
  away_score: number | null
  convocated_count: number
  stats_count: number
  formation: string | null
  lineup_completed_at: string | null
  lineup_starters: Array<{
    slot_index: number
    role_slot: string | null
    role_slot_label: string | null
    player_name: string
    last_name: string
    first_name: string
    jersey_number: number | null
    is_captain: boolean
    is_vice_captain: boolean
    minute_out: number | null
    substituted_by: string | null
    substituted_by_number: number | null
  }>
  lineup_captain_name: string | null
  lineup_vice_name: string | null
  lineup_bench_count: number
  /** Eventi timeline (gol/rossi/sostituzioni) pre-calcolati per la preview past match */
  timeline_events: TimelineEvent[]
  /** Conteggio cartellini gialli (non hanno minuti nel DB, mostrati come badge legenda) */
  timeline_yellow_count: number
}

export function ManagerDashboard({ firstName }: { firstName: string }) {
  const { myTeam, myTeams } = useMyTeam()
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<MatchWithConv[]>([])
  const [past, setPast] = useState<MatchWithConv[]>([])
  const [loading, setLoading] = useState(true)
  const [rosterCount, setRosterCount] = useState(0)
  const [rosterWithoutCard, setRosterWithoutCard] = useState(0)
  const [rosterWithoutJersey, setRosterWithoutJersey] = useState(0)
  const [openMatch, setOpenMatch] = useState<ConvocationMatch | null>(null)
  const [openPostMatch, setOpenPostMatch] = useState<PostMatchData | null>(null)
  const [openDistinta, setOpenDistinta] = useState<DistintaTatticaData | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [editingAnn, setEditingAnn] = useState<{ id: string; title: string; body: string; audience?: string } | null>(null)
  const [myAnnouncements, setMyAnnouncements] = useState<Array<{ id: string; title: string; body: string; audience: string; status: string; rejection_reason: string | null; submitted_at: string }>>([])
  const [trainings, setTrainings] = useState<Array<{
    id: string; training_date: string; start_time: string | null; end_time: string | null;
    focus: string | null; location: string | null; attendance_count: number;
  }>>([])
  const [rosterFull, setRosterFull] = useState<Array<{ id: string; first_name: string; last_name: string; position: string | null }>>([])
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceEvent, setAttendanceEvent] = useState<{ id: string; title: string; date: string; time: string } | null>(null)
  const [nextImpegno, setNextImpegno] = useState<{
    kind: 'training' | 'match'
    id: string
    title: string
    date: string
    time: string
    location: string | null
    presenti: number
    assenti: number
    ritardo: number
    giustificati: number
    inAttesa: number
    total: number
    hasData: boolean
    isPast: boolean
  } | null>(null)

  // Squadra attualmente visualizzata: quella selezionata dal chip o la prima disponibile
  const currentTeam = myTeams.find(t => t.id === activeTeamId) || myTeams[0] || myTeam

  useEffect(() => {
    if (myTeams.length > 0 && !activeTeamId) setActiveTeamId(myTeams[0].id)
  }, [myTeams, activeTeamId])

  useEffect(() => { if (currentTeam?.id) load(currentTeam.id) }, [currentTeam?.id])

  const load = async (teamId: string) => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    // Fetch parallelo
    const in14d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    const from14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)

    const [upcomingRes, pastRes, rosterRes, annRes, trainRes, rosterFullRes] = await Promise.all([
      supabase.from('matches')
        .select('id, opponent, match_date, venue, competition, location, location_address, kickoff_field, shirt_color_home, shirt_color_gk, meeting_time, status, home_score, away_score, formation, lineup_completed_at')
        .eq('team_id', teamId)
        .gte('match_date', today)
        .order('match_date').limit(20),
      supabase.from('matches')
        .select('id, opponent, match_date, venue, competition, location, location_address, kickoff_field, shirt_color_home, shirt_color_gk, meeting_time, status, home_score, away_score, formation, lineup_completed_at')
        .eq('team_id', teamId)
        .lt('match_date', today)
        .order('match_date', { ascending: false }).limit(10),
      supabase.from('players')
        .select('id, jersey_number, card_number')
        .eq('team_id', teamId),
      supabase.from('announcements')
        .select('id, title, body, audience, status, rejection_reason, submitted_at')
        .eq('target_team_id', teamId)
        .order('submitted_at', { ascending: false }).limit(6),
      supabase.from('trainings')
        .select('id, training_date, start_time, end_time, focus, location')
        .eq('team_id', teamId)
        .gte('training_date', from14).lte('training_date', in14d)
        .order('training_date', { ascending: false }),
      supabase.from('players')
        .select('id, first_name, last_name, position')
        .eq('team_id', teamId)
        .order('last_name'),
    ])

    // Conteggi convocazioni + stats per ogni partita
    const allMatchIds = [...(upcomingRes.data ?? []), ...(pastRes.data ?? [])].map(m => m.id)
    const convCounts: Record<string, number> = {}
    const statsCounts: Record<string, number> = {}
    if (allMatchIds.length > 0) {
      const [convData, statsData] = await Promise.all([
        supabase.from('convocations')
          .select('match_id, player_id')
          .in('match_id', allMatchIds)
          .eq('status', 'accepted'),
        supabase.from('match_player_stats')
          .select('match_id, player_id')
          .in('match_id', allMatchIds),
      ])
      for (const c of convData.data ?? []) {
        convCounts[c.match_id] = (convCounts[c.match_id] ?? 0) + 1
      }
      for (const s of statsData.data ?? []) {
        statsCounts[s.match_id] = (statsCounts[s.match_id] ?? 0) + 1
      }
    }

    // Preload distinta per prossimi e ultime 5 partite passate (per la preview compatta)
    const upcomingWithLineup = (upcomingRes.data ?? []).filter((m: any) => m.lineup_completed_at)
    const pastWithLineup = (pastRes.data ?? []).slice(0, 5).filter((m: any) => m.lineup_completed_at)
    const allWithLineup = [...upcomingWithLineup, ...pastWithLineup]
    const lineupStartersByMatch: Record<string, Array<{ slot_index: number; role_slot: string | null; role_slot_label: string | null; player_name: string; last_name: string; first_name: string; jersey_number: number | null; is_captain: boolean; is_vice_captain: boolean; minute_out: number | null; substituted_by: string | null; substituted_by_number: number | null }>> = {}
    const lineupCapByMatch: Record<string, { cap: string | null; vice: string | null; bench: number; capId: string | null; viceId: string | null }> = {}
    const timelineByMatch: Record<string, { events: TimelineEvent[]; yellowCardsCount: number }> = {}
    if (allWithLineup.length > 0) {
      const lineupIds = allWithLineup.map((m: any) => m.id)
      // Prima raccolgo capitano/vice per match_id (mi serve prima di costruire lineup_starters)
      const { data: convDetail } = await supabase.from('convocations')
        .select('match_id, player_id, is_captain, is_vice_captain, player:players(first_name, last_name, jersey_number)')
        .in('match_id', lineupIds)
        .eq('status', 'accepted')
      const capViceIds: Record<string, { capId: string | null; viceId: string | null }> = {}
      for (const c of (convDetail ?? []) as any[]) {
        if (!capViceIds[c.match_id]) capViceIds[c.match_id] = { capId: null, viceId: null }
        if (c.is_captain) capViceIds[c.match_id].capId = c.player_id
        if (c.is_vice_captain) capViceIds[c.match_id].viceId = c.player_id
      }
      // Titolari con dati giocatore + minute_in/out per calcolo sostituzioni
      // + eventi timeline (gol/rigori/autogol/rossi/gialli)
      const { data: lineupStatsRes } = await supabase.from('match_player_stats')
        .select('match_id, player_id, slot_index, role_slot, role_slot_label, was_starter, minute_in, minute_out, goals, goal_minutes, penalties_scored, penalty_minutes, own_goals, own_goal_minutes, yellow_cards, red_card, red_card_minute, player:players(first_name, last_name, jersey_number)')
        .in('match_id', lineupIds)
      // Prima costruisco una mappa dei subentrati per match: chi ha minute_in = X = titolare uscito al minuto X
      const subsByMatch: Record<string, Array<{ player_id: string; minute_in: number; last_name: string; jersey_number: number | null }>> = {}
      for (const s of (lineupStatsRes ?? []) as any[]) {
        if (!s.was_starter && s.minute_in != null && s.minute_in > 0 && s.player) {
          if (!subsByMatch[s.match_id]) subsByMatch[s.match_id] = []
          subsByMatch[s.match_id].push({
            player_id: s.player_id,
            minute_in: s.minute_in,
            last_name: s.player.last_name,
            jersey_number: s.player.jersey_number,
          })
        }
      }
      for (const s of (lineupStatsRes ?? []) as any[]) {
        if (s.was_starter && s.slot_index != null && s.player) {
          if (!lineupStartersByMatch[s.match_id]) lineupStartersByMatch[s.match_id] = []
          const cv = capViceIds[s.match_id]
          // Cerco chi è entrato al minuto in cui questo titolare è uscito
          let substituted_by: string | null = null
          let substituted_by_number: number | null = null
          if (s.minute_out != null && s.minute_out > 0) {
            const matchSubs = subsByMatch[s.match_id] || []
            const sub = matchSubs.find(x => x.minute_in === s.minute_out)
            if (sub) {
              substituted_by = sub.last_name
              substituted_by_number = sub.jersey_number
            }
          }
          lineupStartersByMatch[s.match_id].push({
            slot_index: s.slot_index,
            role_slot: s.role_slot,
            role_slot_label: s.role_slot_label,
            player_name: `${s.player.last_name} ${s.player.first_name[0]}.`,
            last_name: s.player.last_name,
            first_name: s.player.first_name,
            jersey_number: s.player.jersey_number,
            is_captain: cv?.capId === s.player_id,
            is_vice_captain: cv?.viceId === s.player_id,
            minute_out: s.minute_out ?? null,
            substituted_by,
            substituted_by_number,
          })
        }
      }
      // Ordino per slot_index
      for (const mid of Object.keys(lineupStartersByMatch)) {
        lineupStartersByMatch[mid].sort((a, b) => a.slot_index - b.slot_index)
      }
      // Bench count + nomi cap/vice per rendering testuale
      const startersIdSet: Record<string, Set<string>> = {}
      for (const s of (lineupStatsRes ?? []) as any[]) {
        if (s.was_starter) {
          if (!startersIdSet[s.match_id]) startersIdSet[s.match_id] = new Set()
          startersIdSet[s.match_id].add(s.player_id ?? '')
        }
      }
      for (const c of (convDetail ?? []) as any[]) {
        if (!lineupCapByMatch[c.match_id]) lineupCapByMatch[c.match_id] = { cap: null, vice: null, bench: 0, capId: null, viceId: null }
        const name = c.player ? `${c.player.last_name} ${c.player.first_name[0]}.` : null
        if (c.is_captain) { lineupCapByMatch[c.match_id].cap = name; lineupCapByMatch[c.match_id].capId = c.player_id }
        if (c.is_vice_captain) { lineupCapByMatch[c.match_id].vice = name; lineupCapByMatch[c.match_id].viceId = c.player_id }
        if (!startersIdSet[c.match_id]?.has(c.player_id)) {
          lineupCapByMatch[c.match_id].bench += 1
        }
      }

      // Query resiliente per opponent_goal_minutes + opponent_own_goal_minutes (v1.9.64+)
      // Se la colonna opponent_goal_minutes non esiste, il catch la ignora e la timeline mostrerà solo i gol Lenci
      const oppGoalsByMatch: Record<string, { subiti: number[]; autogol_fav: number[] }> = {}
      try {
        const { data: oogRes } = await supabase.from('matches')
          .select('id, opponent_goal_minutes, opponent_own_goal_minutes')
          .in('id', lineupIds)
        for (const r of (oogRes ?? []) as any[]) {
          oppGoalsByMatch[r.id] = {
            subiti: Array.isArray(r.opponent_goal_minutes) ? r.opponent_goal_minutes : [],
            autogol_fav: Array.isArray(r.opponent_own_goal_minutes) ? r.opponent_own_goal_minutes : [],
          }
        }
      } catch (err) {
        console.warn('[ManagerDashboard] opponent_goal_minutes non caricato (migration v1.9.64 mancante?)', err)
      }

      // Costruisco la timeline per ogni match che ha lineup
      // Raggruppo prima le stats per match_id, e mi serve la mappa players (per nome nel timeline)
      const statsByMatch: Record<string, any[]> = {}
      const playersInMatch: Record<string, Record<string, { first_name: string; last_name: string; jersey_number: number | null }>> = {}
      for (const s of (lineupStatsRes ?? []) as any[]) {
        if (!statsByMatch[s.match_id]) statsByMatch[s.match_id] = []
        statsByMatch[s.match_id].push(s)
        if (!playersInMatch[s.match_id]) playersInMatch[s.match_id] = {}
        if (s.player) {
          playersInMatch[s.match_id][s.player_id] = {
            first_name: s.player.first_name,
            last_name: s.player.last_name,
            jersey_number: s.player.jersey_number,
          }
        }
      }
      for (const mid of lineupIds) {
        const opp = oppGoalsByMatch[mid] ?? { subiti: [], autogol_fav: [] }
        const built = buildTimelineEvents({
          stats: (statsByMatch[mid] ?? []).map(s => ({
            player_id: s.player_id,
            was_starter: s.was_starter,
            minute_in: s.minute_in,
            minute_out: s.minute_out,
            goals: s.goals ?? 0,
            goal_minutes: s.goal_minutes ?? [],
            penalties_scored: s.penalties_scored ?? 0,
            penalty_minutes: s.penalty_minutes ?? [],
            own_goals: s.own_goals ?? 0,
            own_goal_minutes: s.own_goal_minutes ?? [],
            yellow_cards: s.yellow_cards ?? 0,
            red_card: s.red_card ?? false,
            red_card_minute: s.red_card_minute ?? null,
          })),
          players: playersInMatch[mid] ?? {},
          opponentGoalMinutes: opp.subiti,
          opponentOwnGoalMinutes: opp.autogol_fav,
        })
        timelineByMatch[mid] = built
      }
    }

    const enrich = (m: any): MatchWithConv => ({
      ...m,
      convocated_count: convCounts[m.id] ?? 0,
      stats_count: statsCounts[m.id] ?? 0,
      formation: m.formation ?? null,
      lineup_completed_at: m.lineup_completed_at ?? null,
      lineup_starters: lineupStartersByMatch[m.id] ?? [],
      lineup_captain_name: lineupCapByMatch[m.id]?.cap ?? null,
      lineup_vice_name: lineupCapByMatch[m.id]?.vice ?? null,
      lineup_bench_count: lineupCapByMatch[m.id]?.bench ?? 0,
      timeline_events: timelineByMatch[m.id]?.events ?? [],
      timeline_yellow_count: timelineByMatch[m.id]?.yellowCardsCount ?? 0,
    })
    setUpcoming((upcomingRes.data ?? []).map(enrich))
    setPast((pastRes.data ?? []).map(enrich))

    const roster = rosterRes.data ?? []
    setRosterCount(roster.length)
    setRosterWithoutCard(roster.filter(p => !p.card_number).length)
    setRosterWithoutJersey(roster.filter(p => p.jersey_number == null).length)
    setMyAnnouncements((annRes.data ?? []) as any)
    setRosterFull((rosterFullRes.data ?? []) as any)

    // Conta presenze per allenamento (per pill compilate/da compilare)
    const trainingList = (trainRes.data ?? []) as any[]
    const trainingIds = trainingList.map(t => t.id)
    const attCounts: Record<string, number> = {}
    if (trainingIds.length > 0) {
      const { data: attData } = await supabase.from('attendances')
        .select('training_id')
        .in('training_id', trainingIds)
      for (const a of attData ?? []) {
        attCounts[a.training_id] = (attCounts[a.training_id] ?? 0) + 1
      }
    }
    setTrainings(trainingList.map(t => ({ ...t, attendance_count: attCounts[t.id] ?? 0 })))

    // === PROSSIMO IMPEGNO: primo evento in ordine cronologico (allenamento o partita)
    // Considera solo eventi da oggi in poi
    const nowISO = new Date().toISOString()
    const nextTraining = trainingList
      .filter(t => `${t.training_date}T${(t.start_time || '00:00')}` >= nowISO.slice(0, 16))
      .sort((a, b) => `${a.training_date}T${a.start_time || '00:00'}`.localeCompare(`${b.training_date}T${b.start_time || '00:00'}`))[0]
    const nextMatch = (upcomingRes.data ?? []).sort((a: any, b: any) => a.match_date.localeCompare(b.match_date))[0] as any
    // Fallback: se non c'è nessun evento futuro, prendi l'ultimo passato per mostrare comunque i dati
    let picked: { kind: 'training' | 'match'; obj: any } | null = null
    if (nextTraining && nextMatch) {
      const t1 = `${nextTraining.training_date}T${nextTraining.start_time || '00:00'}`
      const t2 = String(nextMatch.match_date)
      picked = t1 <= t2 ? { kind: 'training', obj: nextTraining } : { kind: 'match', obj: nextMatch }
    } else if (nextTraining) picked = { kind: 'training', obj: nextTraining }
    else if (nextMatch) picked = { kind: 'match', obj: nextMatch }
    else if (trainingList[0]) picked = { kind: 'training', obj: trainingList[0] } // fallback: ultimo passato

    if (!picked) {
      setNextImpegno(null)
    } else {
      const rosterTotal = roster.length
      if (picked.kind === 'training') {
        const t = picked.obj
        const { data: att } = await supabase.from('attendances')
          .select('status').eq('training_id', t.id)
        const counts = { present: 0, absent: 0, late: 0, excused: 0 }
        for (const a of att ?? []) counts[a.status as keyof typeof counts]++
        const total = (att ?? []).length
        const dateStr = t.training_date
        const isPast = new Date(`${dateStr}T${t.start_time || '23:59'}`) < new Date()
        setNextImpegno({
          kind: 'training', id: t.id,
          title: t.focus || 'Allenamento',
          date: dateStr, time: (t.start_time || '').slice(0, 5),
          location: t.location,
          presenti: counts.present, assenti: counts.absent,
          ritardo: counts.late, giustificati: counts.excused,
          inAttesa: Math.max(0, rosterTotal - total),
          total: rosterTotal, hasData: total > 0, isPast,
        })
      } else {
        // Partita: conta convocazioni
        const m = picked.obj
        const { data: convs } = await supabase.from('convocations')
          .select('status').eq('match_id', m.id)
        let accepted = 0, declined = 0, pending = 0
        for (const c of convs ?? []) {
          if (c.status === 'accepted') accepted++
          else if (c.status === 'declined') declined++
          else pending++
        }
        // "In attesa" include chi non ha ancora risposta + chi non è stato ancora invitato
        const invited = (convs ?? []).length
        const stillToInvite = Math.max(0, rosterTotal - invited)
        const isPast = new Date(m.match_date) < new Date()
        const d = m.match_date ? new Date(m.match_date) : null
        setNextImpegno({
          kind: 'match', id: m.id,
          title: `${m.venue === 'home' ? 'vs' : '@'} ${m.opponent}`,
          date: d ? d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) : '',
          time: d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '',
          location: m.location,
          presenti: accepted, assenti: declined,
          ritardo: 0, giustificati: 0,
          inAttesa: pending + stillToInvite,
          total: rosterTotal, hasData: invited > 0, isPast,
        })
      }
    }

    setLoading(false)
  }

  const openConvocation = (m: MatchWithConv) => {
    if (!currentTeam) return
    setOpenMatch({
      id: m.id,
      opponent: m.opponent,
      match_date: m.match_date,
      venue: m.venue,
      competition: m.competition,
      location: m.location,
      location_address: m.location_address,
      kickoff_field: m.kickoff_field,
      shirt_color_home: m.shirt_color_home,
      shirt_color_gk: m.shirt_color_gk,
      meeting_time: m.meeting_time ?? null,
      team_id: currentTeam?.id,
      team_name: currentTeam.name,
      team_category: currentTeam.category,
      team_color: currentTeam?.color,
    })
  }

  const openReport = (m: MatchWithConv) => {
    if (!currentTeam) return
    setOpenPostMatch({
      id: m.id,
      opponent: m.opponent,
      match_date: m.match_date,
      venue: m.venue,
      competition: m.competition,
      team_id: currentTeam?.id,
      team_name: currentTeam.name,
      team_category: currentTeam.category,
      team_color: currentTeam?.color,
      home_score: m.home_score,
      away_score: m.away_score,
    })
  }

  const openDistintaTattica = (m: MatchWithConv) => {
    if (!currentTeam) return
    setOpenDistinta({
      id: m.id,
      opponent: m.opponent,
      match_date: m.match_date,
      venue: m.venue,
      team_id: currentTeam.id,
      team_name: currentTeam.name,
      team_category: currentTeam.category,
    })
  }

  const teamColor = currentTeam?.color || '#005f98'
  const nextMatch = upcoming[0] ?? null

  // Manager senza squadra
  if (!currentTeam) {
    return (
      <>
        <div>
          <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#181c20', margin: 0 }}>
            Ciao {firstName}
          </h2>
          <p style={{ fontSize: 13, color: '#404751', margin: '6px 0 0' }}>
            Non hai ancora una squadra assegnata come dirigente accompagnatore.
          </p>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', textAlign: 'center' }}>
          <Icon name="assignment_ind" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>
            Contatta un amministratore per farti assegnare la squadra.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Team switcher - solo se gestisce più di una squadra */}
      {myTeams.length > 1 && (
        <div style={{
          display: 'flex', gap: 6, background: '#fff',
          padding: 4, borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,60,94,0.08)',
        }}>
          {myTeams.map(t => {
            const isActive = t.id === currentTeam.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeamId(t.id)}
                style={{
                  flex: 1, padding: '9px 10px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  background: isActive ? (t.color || '#005f98') : 'transparent',
                  color: isActive ? '#fff' : '#404751',
                  fontSize: 12.5, fontWeight: 700,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon name="shield" size={13} color={isActive ? '#fff' : t.color || '#707882'} />
                {t.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Header brandizzato dirigente */}
      <div style={{
        background: `linear-gradient(135deg, ${teamColor} 0%, ${darken(teamColor)} 100%)`,
        borderRadius: 18, padding: '18px 20px', color: '#fff',
        boxShadow: `0 12px 28px ${teamColor}40`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="assignment_ind" size={16} color="#ffd100" />
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#ffd100',
          }}>
            Dirigente Accompagnatore
          </span>
        </div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 24, margin: 0, lineHeight: 1.15 }}>
          {currentTeam.name}
        </h2>
        <p style={{ fontSize: 12.5, margin: '5px 0 0', opacity: 0.9 }}>
          {rosterCount} tesserati · Stagione 2026/2027
        </p>
      </div>

      {/* Alert dati mancanti per la distinta */}
      {(rosterWithoutCard > 0 || rosterWithoutJersey > 0) && (
        <Link to="/teams" style={{
          background: '#fff', borderRadius: 14, padding: 12,
          borderLeft: '4px solid #8e6300',
          boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
          textDecoration: 'none', display: 'block',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="warning" size={18} color="#8e6300" style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                Attenzione: dati distinta incompleti
              </p>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11.5, color: '#404751', lineHeight: 1.5 }}>
                {rosterWithoutCard > 0 && <li>{rosterWithoutCard} giocatori senza matricola FIGC</li>}
                {rosterWithoutJersey > 0 && <li>{rosterWithoutJersey} giocatori senza numero maglia</li>}
              </ul>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#005f98', fontWeight: 700 }}>
                Tocca per completare l'anagrafica →
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* PROSSIMA PARTITA - hero card */}
      {nextMatch ? (
        <div style={{
          background: '#fff', borderRadius: 18,
          boxShadow: '0 10px 24px rgba(0,120,191,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #b3005c 0%, #6a0036 100%)',
            color: '#fff',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
              Prossima partita
            </div>
            <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, margin: '4px 0 0', lineHeight: 1.15 }}>
              {nextMatch.venue === 'home' ? '🏠' : '✈️'} vs {nextMatch.opponent}
            </h3>
            <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.9, textTransform: 'capitalize' }}>
              {formatMatchDate(nextMatch.match_date)}
              {nextMatch.competition && ` · ${nextMatch.competition}`}
            </p>
          </div>
          <div style={{ padding: 16 }}>
            {nextMatch.location && (
              <p style={{ fontSize: 12, color: '#404751', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="location_on" size={13} />
                {nextMatch.location}
              </p>
            )}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 12,
              padding: '10px 12px', background: '#f7f9ff', borderRadius: 10,
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontFamily: 'Anybody', fontWeight: 800, color: '#005f98' }}>
                  {nextMatch.convocated_count}
                </div>
                <div style={{ fontSize: 10, color: '#707882', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                  Convocati
                </div>
              </div>
              <div style={{ width: 1, background: '#e6e8ee' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontFamily: 'Anybody', fontWeight: 800, color: '#404751' }}>
                  {rosterCount - nextMatch.convocated_count}
                </div>
                <div style={{ fontSize: 10, color: '#707882', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
                  Non convocati
                </div>
              </div>
            </div>
            <button
              onClick={() => openConvocation(nextMatch)}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #b3005c 0%, #6a0036 100%)',
                color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(179,0,92,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Icon name="how_to_reg" size={17} color="#fff" />
              {nextMatch.convocated_count > 0 ? 'Modifica convocazione' : 'Prepara convocazione'}
            </button>
            {/* Distinta tattica: disponibile solo se ci sono già convocati */}
            {nextMatch.convocated_count > 0 && (
              <button
                onClick={() => openDistintaTattica(nextMatch)}
                style={{
                  width: '100%', marginTop: 8, padding: '11px 18px', borderRadius: 10, border: '1.5px solid #005f98',
                  background: '#fff', color: '#005f98', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icon name="dashboard" size={15} color="#005f98" />
                {nextMatch.lineup_completed_at ? 'Modifica distinta tattica' : 'Distinta tattica (modulo & titolari)'}
              </button>
            )}
            {/* Preview distinta compilata: campo grafico + riepilogo */}
            {nextMatch.lineup_completed_at && nextMatch.lineup_starters.length > 0 && (
              <div
                onClick={() => openDistintaTattica(nextMatch)}
                style={{
                  marginTop: 10, padding: 10, borderRadius: 10,
                  background: '#f0f9ff', border: '1px solid #005f98', cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8, gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="dashboard" size={14} color="#005f98" />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#005f98' }}>
                      Distinta {nextMatch.formation || ''}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#707882' }}>
                    {nextMatch.lineup_starters.length} tit · {nextMatch.lineup_bench_count} panc
                  </span>
                </div>
                {/* Campo grafico */}
                <PitchView
                  formation={nextMatch.formation || '4-4-2'}
                  players={nextMatch.lineup_starters.map<PitchPlayer>(s => ({
                    slot_key: s.role_slot || '',
                    slot_label: s.role_slot_label || '',
                    jersey_number: s.jersey_number,
                    last_name: s.last_name,
                    first_name: s.first_name,
                    is_captain: s.is_captain,
                    is_vice_captain: s.is_vice_captain,
                    minute_out: s.minute_out,
                    substituted_by: s.substituted_by,
                    substituted_by_number: s.substituted_by_number,
                  }))}
                  height={340}
                  shirtColor={teamColor}
                />
                {(nextMatch.lineup_captain_name || nextMatch.lineup_vice_name) && (
                  <div style={{ fontSize: 10.5, color: '#404751', marginTop: 8, textAlign: 'center' }}>
                    {nextMatch.lineup_captain_name && (
                      <span style={{ color: '#8e6300', fontWeight: 700 }}>
                        (C) {nextMatch.lineup_captain_name}
                      </span>
                    )}
                    {nextMatch.lineup_captain_name && nextMatch.lineup_vice_name && ' · '}
                    {nextMatch.lineup_vice_name && (
                      <span style={{ color: '#005f98', fontWeight: 700 }}>
                        (VC) {nextMatch.lineup_vice_name}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#005f98', marginTop: 6, fontStyle: 'italic', textAlign: 'center' }}>
                  Tocca per modificare →
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, padding: 24, textAlign: 'center', boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
          <Icon name="sports_soccer" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8, margin: '8px 0 0' }}>
            Nessuna partita in programma
          </p>
          <p style={{ fontSize: 11.5, color: '#707882', margin: '4px 0 0' }}>
            Il mister o l'admin possono aggiungere partite dal calendario
          </p>
        </div>
      )}

      {/* PROSSIME PARTITE (altre) */}
      {upcoming.length > 1 && (
        <div>
          <SectionTitle icon="event_upcoming" text="Altre partite in programma" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.slice(1).map(m => (
              <MatchRow key={m.id} match={m} onClick={() => openConvocation(m)} />
            ))}
          </div>
        </div>
      )}

      {/* PARTITE PASSATE - storico distinte + referto */}
      {past.length > 0 && (
        <div>
          <SectionTitle icon="history" text="Partite passate" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.slice(0, 5).map(m => (
              <PastMatchRow
                key={m.id}
                match={m}
                onOpenDistinta={() => openConvocation(m)}
                onOpenReport={() => openReport(m)}
                teamColor={teamColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* ANNUNCI SQUADRA */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 14,
        boxShadow: '0 6px 16px rgba(0,120,191,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="campaign" size={18} color={teamColor} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#181c20' }}>
              Annunci squadra
            </h3>
          </div>
          <button
            onClick={() => { setEditingAnn(null); setProposeOpen(true) }}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none',
              background: teamColor, color: '#fff', fontSize: 11.5,
              fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Icon name="add" size={13} color="#fff" />
            Nuovo
          </button>
        </div>

        {myAnnouncements.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#707882', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
            Nessun annuncio ancora. Tocca "Nuovo" per proporne uno.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myAnnouncements.map(a => {
              const badge =
                a.status === 'published' ? { bg: 'rgba(128,249,139,0.35)', color: '#006e25', label: 'Pubblicato', icon: 'check_circle' } :
                a.status === 'rejected'  ? { bg: '#ffdad6', color: '#93000a', label: 'Rifiutato', icon: 'cancel' } :
                                           { bg: 'rgba(255,209,0,0.25)', color: '#8e6300', label: 'In attesa', icon: 'schedule' }
              const canEdit = a.status === 'pending'
              return (
                <div key={a.id} style={{
                  padding: '9px 10px', borderRadius: 9,
                  background: '#fafbfd', border: '1px solid #e6e8ee',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.title}
                    </div>
                    {a.status === 'rejected' && a.rejection_reason && (
                      <div style={{ fontSize: 10.5, color: '#93000a', marginTop: 2, fontStyle: 'italic' }}>
                        Motivo: {a.rejection_reason}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: badge.bg, color: badge.color,
                    padding: '3px 8px', borderRadius: 999,
                    fontSize: 10, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                  }}>
                    <Icon name={badge.icon} size={10} color={badge.color} />
                    {badge.label}
                  </span>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          setEditingAnn({ id: a.id, title: a.title, body: a.body, audience: a.audience })
                          setProposeOpen(true)
                        }}
                        title="Modifica"
                        style={iconBtn}
                      >
                        <Icon name="edit" size={14} color="#005f98" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Eliminare l'annuncio "${a.title}"?`)) return
                          const { error } = await supabase.from('announcements').delete().eq('id', a.id)
                          if (error) { alert('Errore eliminazione: ' + error.message); return }
                          if (currentTeam?.id) load(currentTeam.id)
                        }}
                        title="Elimina"
                        style={iconBtn}
                      >
                        <Icon name="delete_outline" size={14} color="#93000a" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KPI PROSSIMO IMPEGNO — presenti / assenti / in attesa */}
      {nextImpegno && (
        <button
          onClick={() => {
            if (nextImpegno.kind === 'training') {
              setAttendanceEvent({
                id: nextImpegno.id, title: nextImpegno.title,
                date: nextImpegno.date, time: nextImpegno.time,
              })
              setAttendanceOpen(true)
            } else {
              // Match → apre lo sheet convocazione (già gestito)
              const m = upcoming.find(x => x.id === nextImpegno.id) || past.find(x => x.id === nextImpegno.id)
              if (m) openConvocation(m)
            }
          }}
          style={{
            background: '#fff', borderRadius: 14, padding: 14,
            boxShadow: '0 6px 16px rgba(0,120,191,0.06)',
            border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon
              name={nextImpegno.kind === 'match' ? 'sports_soccer' : 'fitness_center'}
              size={16}
              color={nextImpegno.kind === 'match' ? '#93000a' : '#005f98'}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#707882',
              }}>
                {nextImpegno.isPast ? 'Ultimo impegno' : 'Prossimo impegno'} · {nextImpegno.kind === 'match' ? 'Partita' : 'Allenamento'}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextImpegno.title}
              </div>
              <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>
                {formatDate(nextImpegno.date)}{nextImpegno.time && ` · ${nextImpegno.time}`}
                {nextImpegno.location && ` · ${nextImpegno.location}`}
              </div>
            </div>
            <Icon name="chevron_right" size={16} color="#707882" />
          </div>

          {nextImpegno.hasData ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Kpi
                icon="check_circle" color="#006e25" bg="rgba(128,249,139,0.30)"
                value={nextImpegno.presenti}
                label={nextImpegno.kind === 'match' ? 'convocati' : 'presenti'}
              />
              {nextImpegno.kind === 'training' && nextImpegno.ritardo > 0 && (
                <Kpi icon="schedule" color="#8e6300" bg="rgba(255,209,0,0.25)"
                  value={nextImpegno.ritardo} label="ritardo" />
              )}
              {nextImpegno.kind === 'training' && nextImpegno.giustificati > 0 && (
                <Kpi icon="medical_services" color="#005f98" bg="#cfe5ff"
                  value={nextImpegno.giustificati} label="giustif." />
              )}
              <Kpi icon="cancel" color="#93000a" bg="#ffdad6"
                value={nextImpegno.assenti}
                label={nextImpegno.kind === 'match' ? 'esclusi' : 'assenti'} />
              {nextImpegno.inAttesa > 0 && (
                <Kpi icon="hourglass_empty" color="#404751" bg="#e6e8ee"
                  value={nextImpegno.inAttesa}
                  label={nextImpegno.kind === 'match' ? 'no risposta' : 'da segnare'} />
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,209,0,0.15)', color: '#8e6300',
              fontSize: 11.5, fontWeight: 700,
            }}>
              <Icon name={nextImpegno.kind === 'match' ? 'group_add' : 'checklist'} size={14} color="#8e6300" />
              {nextImpegno.kind === 'match' ? 'Convocazione da preparare' : 'Presenze da compilare'}
              <span style={{ marginLeft: 'auto', color: '#005f98' }}>Tocca per aprire →</span>
            </div>
          )}
        </button>
      )}

      {/* AZIONI RAPIDE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <QuickLink icon="badge" label="Anagrafica rosa" hint="Numeri maglia & matricole" color="#006e25" to="/teams" />
        <QuickLink icon="calendar_month" label="Calendario" hint="Tutti gli impegni" color="#8e6300" to="/calendario" />
      </div>

      {/* Convocation sheet */}
      <ConvocationSheet
        open={openMatch !== null}
        onClose={() => setOpenMatch(null)}
        match={openMatch}
        onSaved={() => { if (currentTeam?.id) load(currentTeam.id) }}
        onOpenDistintaTattica={openMatch ? () => openDistintaTattica({
          id: openMatch.id,
          opponent: openMatch.opponent,
          match_date: openMatch.match_date,
          venue: openMatch.venue,
          competition: (openMatch as any).competition ?? null,
          home_score: null,
          away_score: null,
          convocated_count: 0,
          formation: null,
          lineup_completed_at: null,
          lineup_starters: [],
          lineup_captain_name: null,
          lineup_vice_name: null,
          lineup_bench_count: 0,
        } as unknown as MatchWithConv) : undefined}
      />
      {/* Post-match sheet */}
      <PostMatchSheet
        open={openPostMatch !== null}
        onClose={() => setOpenPostMatch(null)}
        match={openPostMatch}
        onSaved={() => { if (currentTeam?.id) load(currentTeam.id) }}
      />
      {/* Distinta tattica sheet */}
      <DistintaTatticaSheet
        open={openDistinta !== null}
        onClose={() => setOpenDistinta(null)}
        match={openDistinta}
        onSaved={() => { if (currentTeam?.id) load(currentTeam.id) }}
      />
      {/* Propose announcement sheet */}
      <ProposeAnnouncementSheet
        open={proposeOpen}
        onClose={() => { setProposeOpen(false); setEditingAnn(null) }}
        team={currentTeam ? { id: currentTeam.id, name: currentTeam.name, color: currentTeam.color } : null}
        editing={editingAnn}
        onSubmitted={() => { if (currentTeam?.id) load(currentTeam.id) }}
      />
      {/* Attendance sheet */}
      <AttendanceSheet
        open={attendanceOpen}
        onClose={() => { setAttendanceOpen(false); if (currentTeam?.id) load(currentTeam.id) }}
        eventTitle={attendanceEvent?.title || ''}
        eventDate={attendanceEvent?.date || ''}
        eventTime={attendanceEvent?.time || ''}
        trainingId={attendanceEvent?.id ?? null}
        players={rosterFull.map(p => ({
          id: p.id,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          position: p.position,
        }))}
      />
    </>
  )
}

function PastMatchRow({ match, onOpenDistinta, onOpenReport, teamColor }: {
  match: MatchWithConv;
  onOpenDistinta: () => void;
  onOpenReport: () => void;
  teamColor: string;
}) {
  const d = new Date(match.match_date)
  const isHome = match.venue === 'home'
  const hasReport = match.stats_count > 0
  const hasScore = match.home_score != null && match.away_score != null
  const hasLineup = match.lineup_completed_at && match.lineup_starters.length > 0
  const hasTimeline = match.timeline_events.length > 0 || match.timeline_yellow_count > 0
  const ourScore = isHome ? match.home_score : match.away_score
  const theirScore = isHome ? match.away_score : match.home_score
  const resultColor = hasScore && ourScore! > theirScore! ? '#006e25'
                    : hasScore && ourScore! < theirScore! ? '#93000a'
                    : hasScore ? '#8e6300' : '#707882'

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${hasReport ? '#80f98b' : '#e6e8ee'}`,
      overflow: 'hidden',
    }}>
      {/* Riga info */}
      <div style={{
        padding: '10px 12px',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{
          width: 44, minWidth: 44, textAlign: 'center',
          padding: '4px 0', borderRadius: 8,
          background: 'rgba(179,0,92,0.1)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#707882', textTransform: 'uppercase' }}>
            {d.toLocaleDateString('it-IT', { month: 'short' }).slice(0, 3)}
          </div>
          <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, color: '#b3005c', lineHeight: 1 }}>
            {d.getDate()}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20', marginBottom: 2 }}>
            {isHome ? '🏠' : '✈️'} {match.opponent}
          </div>
          <div style={{ fontSize: 11, color: '#707882' }}>
            {match.competition || 'Amichevole'}
            {match.convocated_count > 0 && ` · ${match.convocated_count} conv.`}
          </div>
        </div>
        {hasScore ? (
          <div style={{
            fontFamily: 'Anybody', fontWeight: 800, fontSize: 16,
            color: resultColor, minWidth: 44, textAlign: 'right',
          }}>
            {ourScore}-{theirScore}
          </div>
        ) : (
          <span style={{
            background: '#e6e8ee', color: '#707882',
            padding: '3px 8px', borderRadius: 999,
            fontSize: 9.5, fontWeight: 700,
          }}>senza risultato</span>
        )}
      </div>
      {/* Riga azioni */}
      <div style={{
        borderTop: '1px solid #f1f3fa',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
      }}>
        <button onClick={onOpenDistinta} style={pastActionBtn}>
          <Icon name="description" size={14} color="#005f98" />
          <span>Distinta</span>
        </button>
        <button onClick={onOpenReport} style={{
          ...pastActionBtn,
          borderLeft: '1px solid #f1f3fa',
          background: hasReport ? 'rgba(128,249,139,0.08)' : '#fff',
          color: hasReport ? '#006e25' : '#404751',
        }}>
          <Icon name={hasReport ? 'fact_check' : 'edit_note'} size={14} color={hasReport ? '#006e25' : '#8e6300'} />
          <span>{hasReport ? `Referto ✓ (${match.stats_count})` : 'Compila referto'}</span>
        </button>
      </div>
      {/* Distinta espandibile con campo grafico e sostituzioni */}
      {hasLineup && (
        <details style={{ borderTop: '1px solid #f1f3fa' }}>
          <summary style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#005f98',
            cursor: 'pointer', background: '#f8fbff', listStyle: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="dashboard" size={13} color="#005f98" />
            Vedi distinta ({match.formation || '—'}) · {match.lineup_starters.length} tit
            {match.lineup_starters.filter(s => s.substituted_by).length > 0 &&
              ` · ${match.lineup_starters.filter(s => s.substituted_by).length} sub`}
          </summary>
          <div style={{ padding: 8 }}>
            <PitchView
              formation={match.formation || '4-4-2'}
              players={match.lineup_starters.map<PitchPlayer>(s => ({
                slot_key: s.role_slot || '',
                slot_label: s.role_slot_label || '',
                jersey_number: s.jersey_number,
                last_name: s.last_name,
                first_name: s.first_name,
                is_captain: s.is_captain,
                is_vice_captain: s.is_vice_captain,
                minute_out: s.minute_out,
                substituted_by: s.substituted_by,
                substituted_by_number: s.substituted_by_number,
              }))}
              height={320}
              shirtColor={teamColor}
            />
          </div>
        </details>
      )}
      {/* Timeline eventi espandibile (gol, rossi, sostituzioni con minuti) */}
      {hasTimeline && (
        <details style={{ borderTop: '1px solid #f1f3fa' }}>
          <summary style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#93000a',
            cursor: 'pointer', background: '#fff8f8', listStyle: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="timeline" size={13} color="#93000a" />
            Timeline eventi · {match.timeline_events.length} {match.timeline_events.length === 1 ? 'evento' : 'eventi'}
            {match.timeline_yellow_count > 0 && ` + ${match.timeline_yellow_count} 🟨`}
          </summary>
          <div style={{ padding: 8 }}>
            <MatchTimeline events={match.timeline_events} yellowCardsCount={match.timeline_yellow_count} />
          </div>
        </details>
      )}
    </div>
  )
}

const pastActionBtn: React.CSSProperties = {
  padding: '9px 8px', background: '#fff', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, fontSize: 11.5, fontWeight: 700, color: '#404751',
}

function MatchRow({ match, onClick, isPast }: { match: MatchWithConv; onClick: () => void; isPast?: boolean }) {
  const d = new Date(match.match_date)
  const isHome = match.venue === 'home'
  return (
    <button onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '10px 12px',
      border: '1px solid #e6e8ee', cursor: 'pointer', textAlign: 'left',
      display: 'flex', gap: 10, alignItems: 'center',
      opacity: isPast ? 0.75 : 1,
    }}>
      <div style={{
        width: 44, minWidth: 44, textAlign: 'center',
        padding: '4px 0', borderRadius: 8,
        background: 'rgba(179,0,92,0.1)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#707882', textTransform: 'uppercase' }}>
          {d.toLocaleDateString('it-IT', { month: 'short' }).slice(0, 3)}
        </div>
        <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, color: '#b3005c', lineHeight: 1 }}>
          {d.getDate()}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#181c20' }}>
            {isHome ? '🏠' : '✈️'} {match.opponent}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#707882' }}>
          {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          {match.competition && ` · ${match.competition}`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {match.convocated_count > 0 ? (
          <span style={{
            background: '#cfe5ff', color: '#004a78',
            padding: '3px 8px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 800,
          }}>
            {match.convocated_count} conv.
          </span>
        ) : (
          <span style={{
            background: '#e6e8ee', color: '#707882',
            padding: '3px 8px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
          }}>
            da convocare
          </span>
        )}
      </div>
      <Icon name="chevron_right" size={16} color="#c0c7d2" />
    </button>
  )
}

function SectionTitle({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Icon name={icon} size={16} color="#004a78" />
      <h3 style={{
        fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
        color: '#004a78', margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {text}
      </h3>
    </div>
  )
}

function QuickLink({ icon, label, hint, color, to }: { icon: string; label: string; hint: string; color: string; to: string }) {
  return (
    <Link to={to} style={{
      background: '#fff', border: '1px solid #e6e8ee', borderRadius: 14,
      padding: 12, textDecoration: 'none',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <Icon name={icon} size={20} color={color} />
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: '#707882' }}>{hint}</span>
    </Link>
  )
}

function formatMatchDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}

function darken(hex: string): string {
  // Semplice darkening: rimuove 30% luminosità
  try {
    const c = hex.startsWith('#') ? hex.slice(1) : hex
    const r = Math.max(0, parseInt(c.slice(0, 2), 16) * 0.6) | 0
    const g = Math.max(0, parseInt(c.slice(2, 4), 16) * 0.6) | 0
    const b = Math.max(0, parseInt(c.slice(4, 6), 16) * 0.6) | 0
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch { return hex }
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: 'none',
  background: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function Kpi({ icon, color, bg, value, label }: {
  icon: string; color: string; bg: string; value: number; label: string;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 9px', borderRadius: 9,
      background: bg, color, fontSize: 11, fontWeight: 700,
    }}>
      <Icon name={icon} size={12} color={color} />
      <strong style={{ fontSize: 12.5, fontWeight: 800 }}>{value}</strong>
      {label}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
}
