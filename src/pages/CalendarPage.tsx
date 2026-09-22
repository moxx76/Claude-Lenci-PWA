import type React from 'react'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach, isParent, isAthlete } from '../lib/types'
import { useCalendarEvents, eventBadgeStyle, type CalendarEvent } from '../hooks/useCalendarEvents'
import { useMyTeam } from '../hooks/useMyTeam'
import { Icon } from '../components/Icon'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { CalendarSubscribeSheet } from '../components/CalendarSubscribeSheet'
import { EventEditSheet } from '../components/EventEditSheet'
import { PostMatchSheet, type PostMatchData } from '../components/PostMatchSheet'
import { TeamPickerSheet } from '../components/TeamPickerSheet'
import { TeamTrainingHistorySheet } from '../components/TeamTrainingHistorySheet'
import { TeamMatchHistorySheet } from '../components/TeamMatchHistorySheet'
import { TrainingDetailSheet } from '../components/TrainingDetailSheet'
import { WeeklyPlannerSheet } from '../components/WeeklyPlannerSheet'
import { AttendanceStatsSheet } from '../components/AttendanceStatsSheet'
import { useToast } from '../components/Toast'
import { TrainingProgramSheet } from '../components/TrainingProgramSheet'
import { ParentAttendanceSheet } from '../components/ParentAttendanceSheet'
import { ConvocationSheet } from '../components/ConvocationSheet'
import { DistintaTatticaSheet, type DistintaTatticaData } from '../components/DistintaTatticaSheet'
import { supabase } from '../lib/supabase'

function formatDate(iso: string): { day: string; date: string; month: string } {
  const d = new Date(iso + 'T00:00:00')
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  return {
    day: dayNames[d.getDay()],
    date: String(d.getDate()).padStart(2, '0'),
    month: monthNames[d.getMonth()],
  }
}

function groupByDate(events: CalendarEvent[]): Array<{ date: string; events: CalendarEvent[] }> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  return Array.from(map.entries()).map(([date, events]) => ({ date, events }))
}

type FilterKey = 'all' | 'training' | 'match'

const FILTERS: Array<{ key: FilterKey; label: string; icon: string }> = [
  { key: 'all', label: 'Tutti', icon: 'apps' },
  { key: 'training', label: 'Allenamenti', icon: 'fitness_center' },
  { key: 'match', label: 'Partite', icon: 'sports_soccer' },
]

interface AttBreakdown { present: number; absent: number; late: number; excused: number; total: number }
interface MatchBreakdown { yes: number; no: number; maybe: number; played: number; benched: number; convocated: number; reportCompleted?: boolean }

export function CalendarPage() {
  const { profile } = useAuth()
  const { myTeam } = useMyTeam()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const initialFilter: FilterKey = (() => {
    const q = searchParams.get('filter')
    return q === 'training' || q === 'match' ? q : 'all'
  })()
  const [filter, setFilter] = useState<FilterKey>(initialFilter)
  const [teamFilter, setTeamFilter] = useState<string | null>(null)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const [trainingHistoryOpen, setTrainingHistoryOpen] = useState(false)
  const [matchHistoryOpen, setMatchHistoryOpen] = useState(false)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [attendanceStatsOpen, setAttendanceStatsOpen] = useState(false)
  const [historyReloadTick, setHistoryReloadTick] = useState(0)
  const [detailTrainingId, setDetailTrainingId] = useState<string | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceEvent, setAttendanceEvent] = useState<{ id: string; title: string; date: string; time: string; teamId: string } | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editExistingEvent, setEditExistingEvent] = useState<any>(null)
  const [programOpen, setProgramOpen] = useState(false)
  const [programEvent, setProgramEvent] = useState<CalendarEvent | null>(null)
  const [parentRespOpen, setParentRespOpen] = useState(false)
  const [parentRespEvent, setParentRespEvent] = useState<any>(null)
  const [parentRespChild, setParentRespChild] = useState<any>(null)
  const [convocationOpen, setConvocationOpen] = useState(false)
  const [convocationMatch, setConvocationMatch] = useState<any>(null)
  const [myChildren, setMyChildren] = useState<Array<{ id: string; first_name: string; last_name: string; team_id: string }>>([])

  // Carico i figli del parent loggato
  useEffect(() => {
    if (!profile?.id || !isParent(profile.role)) return
    supabase.from('players').select('id, first_name, last_name, team_id')
      .eq('parent_profile_id', profile.id)
      .then(({ data }) => setMyChildren(data ?? []))
  }, [profile?.id, profile?.role])
  const [rosterMap, setRosterMap] = useState<Record<string, Array<{ id: string; first_name: string; last_name: string; position: string | null }>>>({})
  const [attCounts, setAttCounts] = useState<Record<string, AttBreakdown>>({})
  const [matchCounts, setMatchCounts] = useState<Record<string, MatchBreakdown>>({})
  const [postMatchOpen, setPostMatchOpen] = useState(false)
  const [postMatchData, setPostMatchData] = useState<PostMatchData | null>(null)
  const [distintaMatch, setDistintaMatch] = useState<DistintaTatticaData | null>(null)

  // Se coach con squadra assegnata → filtro automatico e nascondi chips
  // È un membro staff (coach o dirigente) associato a una singola squadra?
  // I dirigenti hanno is_manager=true ma role diverso da 'coach': vanno inclusi qui
  // altrimenti il planner e altri strumenti team-scoped non filtrano la loro squadra.
  const isCoachWithTeam = (isCoach(profile?.role) || !!profile?.is_manager) && !!myTeam
  const effectiveTeamId = isCoachWithTeam ? myTeam!.id : teamFilter

  const isStaff = isAdmin(profile?.role) || isCoach(profile?.role)
  const canWrite = isStaff && !profile?.is_readonly
  const { events, teams, loading, error, refresh } = useCalendarEvents({
    teamId: effectiveTeamId,
    limit: 200,
  })

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'match') return events.filter(e => e.kind === 'match' || e.kind === 'tournament')
    return events.filter(e => e.kind === filter)
  }, [events, filter])

  // Carica breakdown presenze per tutti gli allenamenti visualizzati (solo staff)
  useEffect(() => {
    if (!isStaff) return
    const trainingIds = filtered.filter(e => e.kind === 'training').map(e => e.raw?.id).filter(Boolean)
    if (trainingIds.length === 0) { setAttCounts({}); return }
    supabase.from('attendances').select('training_id, status')
      .in('training_id', trainingIds)
      .then(({ data }) => {
        const m: Record<string, AttBreakdown> = {}
        for (const a of (data ?? []) as any[]) {
          const key = a.training_id
          if (!m[key]) m[key] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
          m[key].total++
          if (a.status === 'present') m[key].present++
          else if (a.status === 'absent') m[key].absent++
          else if (a.status === 'late') m[key].late++
          else if (a.status === 'excused') m[key].excused++
        }
        setAttCounts(m)
      })
  }, [filtered, isStaff])

  // Carica breakdown risposte/giocato per tutte le partite visualizzate (solo staff)
  useEffect(() => {
    if (!isStaff) return
    const matchIds = filtered.filter(e => e.kind === 'match' || e.kind === 'tournament').map(e => e.raw?.id).filter(Boolean)
    if (matchIds.length === 0) { setMatchCounts({}); return }
    Promise.all([
      supabase.from('event_responses').select('event_id, status')
        .eq('event_kind', 'match').in('event_id', matchIds),
      supabase.from('convocations').select('match_id, status')
        .in('match_id', matchIds),
      supabase.from('match_player_stats').select('match_id, was_starter, minute_in')
        .in('match_id', matchIds),
      supabase.from('matches').select('id, report_completed_at')
        .in('id', matchIds),
    ]).then(([respRes, convRes, statsRes, reportRes]) => {
      const m: Record<string, MatchBreakdown> = {}
      const ensure = (k: string) => {
        if (!m[k]) m[k] = { yes: 0, no: 0, maybe: 0, played: 0, benched: 0, convocated: 0, reportCompleted: false }
        return m[k]
      }
      for (const r of (respRes.data ?? []) as any[]) {
        const b = ensure(r.event_id)
        if (r.status === 'yes') b.yes++
        else if (r.status === 'no') b.no++
        else if (r.status === 'maybe') b.maybe++
      }
      for (const c of (convRes.data ?? []) as any[]) {
        const b = ensure(c.match_id)
        if (c.status === 'accepted' || c.status === 'pending') b.convocated++
      }
      for (const s of (statsRes.data ?? []) as any[]) {
        const b = ensure(s.match_id)
        if (s.was_starter || s.minute_in != null) b.played++
        else b.benched++
      }
      for (const r of (reportRes.data ?? []) as any[]) {
        const b = ensure(r.id)
        b.reportCompleted = !!r.report_completed_at
      }
      setMatchCounts(m)
    })
  }, [filtered, isStaff])

  // Al tap su un allenamento, carico rosa (una volta per squadra) e apro sheet
  const openAttendance = async (event: CalendarEvent) => {
    if (!isStaff || event.kind !== 'training' || !event.teamId) return
    const trainingId = event.raw?.id
    if (!trainingId) return
    if (!rosterMap[event.teamId]) {
      const { data } = await supabase.from('players')
        .select('id, first_name, last_name, position')
        .eq('team_id', event.teamId).order('last_name')
      setRosterMap(m => ({ ...m, [event.teamId!]: (data ?? []) as any }))
    }
    setAttendanceEvent({
      id: trainingId,
      title: event.title || event.focus || 'Allenamento',
      date: event.date,
      time: event.startTime,
      teamId: event.teamId,
    })
    setAttendanceOpen(true)
  }

  // Handler apertura azione per una partita (parent → risposta, staff → convocazioni)
  const openMatchAction = (event: CalendarEvent) => {
    const isMatchLike = event.kind === 'match' || event.kind === 'tournament'
    if (!isMatchLike) return

    if (isStaff && event.raw?.id) {
      setConvocationMatch({
        id: event.raw.id,
        team_id: event.teamId,
        team_name: event.teamName,
        team_category: event.teamCategory,
        team_color: event.teamColor,
        opponent: event.opponent,
        venue: event.venue,
        match_date: event.raw.match_date,
        location: event.location,
        location_address: event.raw.location_address ?? null,
        kickoff_field: event.raw.kickoff_field ?? null,
        meeting_time: event.raw.meeting_time ?? null,
        competition: event.competition,
      })
      setConvocationOpen(true)
      return
    }

    if (isParent(profile?.role)) {
      const child = myChildren.find(c => c.team_id === event.teamId) || myChildren[0]
      if (!child) return
      setParentRespEvent({
        kind: 'match', id: event.raw?.id, date: event.date,
        time: event.startTime, location: event.location,
        opponent: event.opponent, home_or_away: event.venue,
        team: event.teamId ? { id: event.teamId, name: event.teamName || '', color: event.teamColor || null } : null,
      })
      setParentRespChild(child)
      setParentRespOpen(true)
      return
    }
  }

  // Utility resiliente: recupera la durata partita configurata sulla squadra e la aggiunge al payload
  // PostMatchData, così la Timeline live nel recap si scala correttamente (U14 = 70', U16 = 80', ecc.).
  // Se la query fallisce, ritorna i due campi null → PostMatchSheet cadrà sul default 2×45=90'.
  // Serve perché PostMatchData.team_match_periods_count/team_match_period_duration_min sono opzionali
  // ma senza di essi la Timeline mostra sempre 90' anche per categorie con tempi diversi.
  const fetchTeamDuration = async (teamId: string): Promise<{ periods: number | null; dur: number | null }> => {
    try {
      const { data } = await supabase.from('teams')
        .select('match_periods_count, match_period_duration_min')
        .eq('id', teamId)
        .maybeSingle()
      return {
        periods: (data as any)?.match_periods_count ?? null,
        dur: (data as any)?.match_period_duration_min ?? null,
      }
    } catch {
      return { periods: null, dur: null }
    }
  }

  const openMatchReport = async (event: CalendarEvent) => {
    const isMatchLike = event.kind === 'match' || event.kind === 'tournament'
    if (!isMatchLike || !event.raw?.id || !event.teamId) return
    const teamDur = await fetchTeamDuration(event.teamId)
    setPostMatchData({
      id: event.raw.id,
      opponent: event.opponent || '',
      match_date: event.raw.match_date,
      venue: (event.venue as 'home' | 'away') || 'home',
      competition: event.competition || null,
      team_id: event.teamId,
      team_name: event.teamName || '',
      team_category: event.teamCategory || null,
      team_color: event.teamColor || null,
      home_score: event.raw.home_score ?? null,
      away_score: event.raw.away_score ?? null,
      team_match_periods_count: teamDur.periods,
      team_match_period_duration_min: teamDur.dur,
    })
    setPostMatchOpen(true)
  }

  const openEdit = async (event: CalendarEvent) => {
    // Tournament è comunque un record 'matches' con competition=Torneo → tratto come match
    const isMatchLike = event.kind === 'match' || event.kind === 'tournament'
    if (event.kind !== 'training' && !isMatchLike) return
    const raw = event.raw || {}
    if (!raw.id) { console.error('Missing raw.id for event', event); return }
    // Fetch fresco della row completa dal DB — così abbiamo TUTTI i campi
    // (location_address, kickoff_field, shirt colors, etc.) anche quando la
    // struttura in memoria è parziale
    const table = isMatchLike ? 'matches' : 'trainings'
    const { data, error } = await supabase.from(table).select('*').eq('id', raw.id).maybeSingle()
    if (error || !data) {
      console.error('Errore fetch evento per edit:', error)
      return
    }
    setEditExistingEvent({
      kind: isMatchLike ? 'match' : 'training',
      ...(data as any),
    })
    setEditOpen(true)
  }

  const grouped = groupByDate(filtered)

  // Determina scope + id per sottoscrizione calendario
  const subscribeScope: 'team' | 'all' = isCoachWithTeam || teamFilter ? 'team' : 'all'
  const subscribeScopeId: string | null = isCoachWithTeam
    ? myTeam.id
    : teamFilter || null
  const subscribeLabel = isCoachWithTeam
    ? `Lenci Poirino · ${myTeam.name}`
    : teamFilter && teams.length > 0
      ? `Lenci Poirino · ${teams.find(t => t.id === teamFilter)?.name || ''}`
      : 'ASD Lenci Poirino · Tutti gli impegni'

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
            Calendario
          </h2>
          <p style={{ fontSize: 12.5, color: '#707882', margin: '4px 0 0' }}>
            {isCoachWithTeam && (
              <span style={{ color: myTeam.color || '#005f98', fontWeight: 700 }}>
                {myTeam.name} · 
              </span>
            )}{' '}
            {filtered.length} {filtered.length === 1 ? 'evento' : 'eventi'} in programma
          </p>
          <button
            onClick={() => setSubscribeOpen(true)}
            style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 999,
              background: '#fff', color: '#005f98', border: '1.5px solid #005f98',
              fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="event_repeat" size={13} color="#005f98" />
            Sottoscrivi al calendario del telefono
          </button>
        </div>
        {canWrite && (
          <button
            onClick={() => { setEditExistingEvent(null); setEditOpen(true) }}
            title="Crea nuovo allenamento o partita"
            style={{
              flexShrink: 0,
              background: 'linear-gradient(135deg, #005f98, #0078bf)',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,95,152,0.2)',
            }}
          >
            <Icon name="add" size={16} color="#fff" />
            Evento
          </button>
        )}
      </div>

      {/* Selettore squadra: dropdown → bottom sheet (solo admin con più squadre) */}
      {isAdmin(profile?.role) && teams.length > 1 && (() => {
        const selectedTeam = teamFilter ? teams.find(t => t.id === teamFilter) : null
        const color = selectedTeam?.color || '#005f98'
        const label = selectedTeam?.name || 'Tutte le squadre'
        const sublabel = selectedTeam
          ? (selectedTeam.category || '')
          : `${teams.length} squadre visualizzate`
        return (
          <button
            onClick={() => setTeamPickerOpen(true)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              background: color, color: '#fff', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,60,94,0.12)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name={selectedTeam ? 'shield' : 'groups'} size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.9, marginTop: 2 }}>
                {sublabel && `${sublabel} · `}Cambia filtro
              </div>
            </div>
            <Icon name="expand_more" size={18} color="#fff" />
          </button>
        )
      })()}

      {/* Type filter chips */}
      <div className="flex overflow-x-auto hide-scrollbar" style={{ gap: 8, margin: '0 -2px', padding: '0 2px' }}>
        {FILTERS.map(f => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
            label={f.label}
            icon={f.icon}
          />
        ))}
      </div>

      {/* Bottone Planner settimanale (sempre visibile per staff) */}
      {isStaff && (
        <button
          onClick={() => setPlannerOpen(true)}
          style={historyBtnStyle('#2fa14e')}
        >
          <Icon name="calendar_view_week" size={16} color="#fff" />
          Planner settimanale{teamFilter && teams.find(t => t.id === teamFilter) ? ` — ${teams.find(t => t.id === teamFilter)!.name}` : ''}
          <span style={{ marginLeft: 'auto' }}>›</span>
        </button>
      )}

      {/* Bottone Report presenze (staff) */}
      {isStaff && (
        <button
          onClick={() => {
            if (!teamFilter) {
              showToast('Seleziona prima una squadra dal menu in alto', 'info')
              return
            }
            setAttendanceStatsOpen(true)
          }}
          style={historyBtnStyle('#c47f00')}
        >
          <Icon name="leaderboard" size={16} color="#fff" />
          Report presenze{teamFilter && teams.find(t => t.id === teamFilter) ? ` — ${teams.find(t => t.id === teamFilter)!.name}` : ' (scegli una squadra)'}
          <span style={{ marginLeft: 'auto' }}>›</span>
        </button>
      )}

      {/* Bottone "Vedi storico" contestuale al filtro attivo */}
      {isStaff && filter === 'training' && (
        <button
          onClick={() => setTrainingHistoryOpen(true)}
          style={historyBtnStyle('#005f98')}
        >
          <Icon name="history" size={16} color="#fff" />
          Storico allenamenti{teamFilter && teams.find(t => t.id === teamFilter) ? ` — ${teams.find(t => t.id === teamFilter)!.name}` : ''}
          <span style={{ marginLeft: 'auto' }}>›</span>
        </button>
      )}
      {isStaff && filter === 'match' && (
        <button
          onClick={() => setMatchHistoryOpen(true)}
          style={historyBtnStyle('#7a0071')}
        >
          <Icon name="scoreboard" size={16} color="#fff" />
          Partite passate & report{teamFilter && teams.find(t => t.id === teamFilter) ? ` — ${teams.find(t => t.id === teamFilter)!.name}` : ''}
          <span style={{ marginLeft: 'auto' }}>›</span>
        </button>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 6px 16px rgba(0,120,191,0.05)', textAlign: 'center', color: '#707882', fontSize: 13 }}>
          Caricamento…
        </div>
      ) : error ? (
        <div style={{ background: '#ffdad6', borderRadius: 14, padding: 16, color: '#93000a', fontSize: 12.5 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>⚠️ Errore caricamento eventi</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>{error}</p>
          <p style={{ margin: '8px 0 0', fontSize: 11, opacity: 0.8 }}>
            Prova a fare logout e login. Se persiste, dillo a Davide.
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 18, padding: 40, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', textAlign: 'center' }}>
          <Icon name="event_busy" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>Nessun evento in programma</p>
          <p style={{ fontSize: 11, color: '#707882', marginTop: 4 }}>
            (caricati {events.length} eventi totali, {teams.length} squadre)
          </p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 18 }}>
          {grouped.map(g => <DateGroup
            key={g.date} date={g.date} events={g.events}
            showTeamTag={isStaff && !effectiveTeamId}
            isStaff={isStaff}
            attCounts={attCounts}
            matchCounts={matchCounts}
            onOpenAttendance={openAttendance}
            onEdit={canWrite ? openEdit : undefined}
            onOpenProgram={(e) => { setProgramEvent(e); setProgramOpen(true) }}
            onOpenMatchAction={openMatchAction}
            onOpenReport={isStaff && canWrite ? openMatchReport : undefined}
            isParent={isParent(profile?.role)}
            hasChildren={myChildren.length > 0}
          />)}
        </div>
      )}

      {isParent(profile?.role) && (
        <p style={{ fontSize: 11, color: '#707882', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
          * Nel prossimo sprint filtreremo automaticamente sugli eventi delle squadre dei tuoi figli
        </p>
      )}
      {isAthlete(profile?.role) && (
        <p style={{ fontSize: 11, color: '#707882', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
          * Nel prossimo sprint vedrai solo gli eventi della tua squadra
        </p>
      )}

      {/* Attendance sheet */}
      <AttendanceSheet
        open={attendanceOpen}
        onClose={() => {
          setAttendanceOpen(false)
          // refresh counts + eventi
          refresh?.()
          // riforza conteggi con breakdown per status
          const trainingIds = filtered.filter(e => e.kind === 'training').map(e => e.raw?.id).filter(Boolean)
          if (trainingIds.length > 0) {
            supabase.from('attendances').select('training_id, status')
              .in('training_id', trainingIds)
              .then(({ data }) => {
                const m: Record<string, AttBreakdown> = {}
                for (const a of (data ?? []) as any[]) {
                  const key = a.training_id
                  if (!m[key]) m[key] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
                  m[key].total++
                  if (a.status === 'present') m[key].present++
                  else if (a.status === 'absent') m[key].absent++
                  else if (a.status === 'late') m[key].late++
                  else if (a.status === 'excused') m[key].excused++
                }
                setAttCounts(m)
              })
          }
        }}
        eventTitle={attendanceEvent?.title || ''}
        eventDate={attendanceEvent?.date || ''}
        eventTime={attendanceEvent?.time || ''}
        trainingId={attendanceEvent?.id ?? null}
        players={(attendanceEvent && rosterMap[attendanceEvent.teamId]
          ? rosterMap[attendanceEvent.teamId].map(p => ({
              id: p.id,
              firstName: p.first_name || '',
              lastName: p.last_name || '',
              position: p.position,
            }))
          : [])}
      />

      {/* Sottoscrizione calendario dinamico */}
      <CalendarSubscribeSheet
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        scope={subscribeScope}
        scopeId={subscribeScopeId}
        label={subscribeLabel}
      />

      {/* Modifica evento (staff) */}
      <EventEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        teams={teams}
        existingEvent={editExistingEvent}
        onSaved={() => { refresh?.(); setHistoryReloadTick(t => t + 1) }}
        onDeleted={() => { refresh?.(); setHistoryReloadTick(t => t + 1) }}
      />

      {/* Report post-partita (staff, dal calendario) */}
      <PostMatchSheet
        open={postMatchOpen}
        onClose={() => setPostMatchOpen(false)}
        match={postMatchData}
        onSaved={() => { refresh?.(); setHistoryReloadTick(t => t + 1) }}
      />

      {/* Team picker per admin: prima riga è l'opzione "Tutte le squadre" */}
      <TeamPickerSheet        open={teamPickerOpen}
        onClose={() => setTeamPickerOpen(false)}
        teams={[
          { id: '__all__', name: 'Tutte le squadre', color: '#005f98', category: `${teams.length} squadre visualizzate`, age_range: null, n_players: null },
          ...teams.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
            category: t.category,
            age_range: null,
            n_players: null,
          })),
        ]}
        selectedId={teamFilter || '__all__'}
        onSelect={(id) => setTeamFilter(id === '__all__' ? null : id)}
      />

      {/* Storico allenamenti dal calendario */}
      <TeamTrainingHistorySheet
        open={trainingHistoryOpen}
        onClose={() => setTrainingHistoryOpen(false)}
        teamId={teamFilter}
        teamName={teamFilter ? teams.find(t => t.id === teamFilter)?.name || null : null}
        reloadKey={historyReloadTick}
        onOpenTraining={(tid) => {
          setTrainingHistoryOpen(false)
          setDetailTrainingId(tid)
        }}
      />

      {/* Dettaglio singolo allenamento (aperto dallo storico) */}
      {detailTrainingId && (
        <TrainingDetailSheet
          open={!!detailTrainingId}
          onClose={() => setDetailTrainingId(null)}
          trainingId={detailTrainingId}
          teamName={teamFilter ? (teams.find(t => t.id === teamFilter)?.name || 'Allenamento') : 'Allenamento'}
          teamColor={teamFilter ? (teams.find(t => t.id === teamFilter)?.color || null) : null}
          canEdit={canWrite}
          onEdit={async (tid) => {
            // Carica evento e apri EventEditSheet
            const { data } = await supabase.from('trainings')
              .select('id, team_id, training_date, start_time, end_time, location, focus, program, notes')
              .eq('id', tid).maybeSingle()
            if (data) {
              setDetailTrainingId(null)
              setEditExistingEvent({ kind: 'training', ...data })
              setEditOpen(true)
            }
          }}
          onManageAttendance={async (tid) => {
            // Carica training + rosa e apri AttendanceSheet
            const { data: t } = await supabase.from('trainings')
              .select('id, team_id, training_date, start_time, focus')
              .eq('id', tid).maybeSingle()
            if (!t || !t.team_id) return
            if (!rosterMap[t.team_id]) {
              const { data: pdata } = await supabase.from('players')
                .select('id, first_name, last_name, position')
                .eq('team_id', t.team_id).order('last_name')
              setRosterMap(m => ({ ...m, [t.team_id!]: (pdata ?? []) as any }))
            }
            setDetailTrainingId(null)
            setAttendanceEvent({
              id: t.id,
              title: t.focus || 'Allenamento',
              date: t.training_date,
              time: t.start_time || '',
              teamId: t.team_id,
            })
            setAttendanceOpen(true)
          }}
        />
      )}

      {/* Storico partite passate + report tattico */}
      <TeamMatchHistorySheet
        open={matchHistoryOpen}
        onClose={() => setMatchHistoryOpen(false)}
        teamId={teamFilter}
        teamName={teamFilter ? teams.find(t => t.id === teamFilter)?.name || null : null}
        reloadKey={historyReloadTick}
        onOpenReport={async (matchId) => {
          // Fetch match e apri PostMatchSheet
          const { data } = await supabase.from('matches')
            .select('id, opponent, match_date, venue, competition, team_id, home_score, away_score, team:teams(name, category, color, match_periods_count, match_period_duration_min)')
            .eq('id', matchId).maybeSingle()
          if (data) {
            const teamObj = Array.isArray((data as any).team) ? (data as any).team[0] : (data as any).team
            setMatchHistoryOpen(false)
            setPostMatchData({
              id: data.id,
              opponent: data.opponent,
              match_date: data.match_date,
              venue: data.venue as 'home' | 'away',
              competition: data.competition,
              team_id: data.team_id,
              team_name: teamObj?.name || '',
              team_category: teamObj?.category || null,
              team_color: teamObj?.color || null,
              home_score: data.home_score,
              away_score: data.away_score,
              // Durata partita: la Timeline live nel recap la usa per scalare la barra 0'-N'
              team_match_periods_count: teamObj?.match_periods_count ?? null,
              team_match_period_duration_min: teamObj?.match_period_duration_min ?? null,
            })
            setPostMatchOpen(true)
          }
        }}
      />

      {/* Planner settimanale — usa effectiveTeamId così coach/dirigenti
          con una sola squadra vedono SOLO la loro (evita mix tra annate). */}
      <WeeklyPlannerSheet
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        teamFilter={effectiveTeamId}
        teams={teams.map(t => ({ id: t.id, name: t.name, color: t.color, category: t.category }))}
      />

      {/* Report presenze / classifica giocatori più presenti */}
      {teamFilter && (() => {
        const t = teams.find(t => t.id === teamFilter)
        if (!t) return null
        return (
          <AttendanceStatsSheet
            open={attendanceStatsOpen}
            onClose={() => setAttendanceStatsOpen(false)}
            teamId={t.id}
            teamName={t.name}
            teamColor={t.color}
          />
        )
      })()}

      {/* Programma allenamento visibile a tutti */}
      {programEvent && (
        <TrainingProgramSheet
          open={programOpen}
          onClose={() => setProgramOpen(false)}
          trainingId={programEvent.raw?.id || null}
          title={`${programEvent.title}${programEvent.teamName ? ' · ' + programEvent.teamName : ''}`}
          dateLabel={`${formatDateFull(programEvent.date)}${programEvent.startTime ? ' · ' + programEvent.startTime : ''}${programEvent.endTime ? '–' + programEvent.endTime : ''}`}
          location={programEvent.location}
          focus={programEvent.raw?.focus || null}
          program={programEvent.raw?.program || null}
          notes={programEvent.raw?.notes || null}
        />
      )}

      {/* Risposta genitore alla partita */}
      <ParentAttendanceSheet
        open={parentRespOpen}
        onClose={() => { setParentRespOpen(false); refresh?.() }}
        event={parentRespEvent}
        child={parentRespChild}
        onSaved={() => refresh?.()}
      />

      {/* Convocazioni + risposte per staff */}
      <ConvocationSheet
        open={convocationOpen}
        onClose={() => { setConvocationOpen(false); refresh?.() }}
        match={convocationMatch}
        onSaved={() => refresh?.()}
        onOpenDistintaTattica={convocationMatch ? () => {
          setDistintaMatch({
            id: convocationMatch.id,
            opponent: convocationMatch.opponent,
            match_date: convocationMatch.match_date,
            venue: convocationMatch.venue,
            team_id: convocationMatch.team_id,
            team_name: convocationMatch.team_name,
            team_category: convocationMatch.team_category,
          })
        } : undefined}
      />
      {/* Distinta tattica */}
      <DistintaTatticaSheet
        open={distintaMatch !== null}
        onClose={() => setDistintaMatch(null)}
        match={distintaMatch}
        onSaved={() => refresh?.()}
      />
    </div>
  )
}

function formatDateFull(d: string): string {
  const dt = new Date(d)
  const days = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

function historyBtnStyle(color: string): React.CSSProperties {
  return {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    background: color,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    fontWeight: 800,
    boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
    textAlign: 'left',
  }
}

function FilterChip({
  active, onClick, label, icon, accent,
}: {
  active: boolean; onClick: () => void; label: string; icon?: string; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center flex-shrink-0"
      style={{
        gap: 6,
        padding: '8px 14px',
        borderRadius: 999,
        border: 'none',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        background: active ? (accent || '#005f98') : '#e6e8ee',
        color: active ? '#fff' : '#404751',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <Icon name={icon} size={14} color={active ? '#fff' : '#707882'} />}
      {label}
    </button>
  )
}

function DateGroup({ date, events, showTeamTag, isStaff, attCounts, matchCounts, onOpenAttendance, onEdit, onOpenProgram, onOpenMatchAction, onOpenReport, isParent, hasChildren }: {
  date: string; events: CalendarEvent[]; showTeamTag: boolean;
  isStaff: boolean; attCounts: Record<string, AttBreakdown>;
  matchCounts: Record<string, MatchBreakdown>;
  onOpenAttendance: (e: CalendarEvent) => void;
  onEdit?: (e: CalendarEvent) => void;
  onOpenProgram?: (e: CalendarEvent) => void;
  onOpenMatchAction?: (e: CalendarEvent) => void;
  onOpenReport?: (e: CalendarEvent) => void;
  isParent?: boolean;
  hasChildren?: boolean;
}) {
  const { day, date: d, month } = formatDate(date)
  const today = new Date().toISOString().slice(0, 10)
  const isToday = date === today
  const isPast = date < today

  return (
    <div className="flex" style={{ gap: 12 }}>
      {/* Date column */}
      <div
        className="flex flex-col items-center justify-center flex-shrink-0"
        style={{
          width: 56,
          padding: '10px 6px',
          borderRadius: 12,
          background: isToday ? '#005f98' : (isPast ? '#e6e8ee' : '#f1f3fa'),
          color: isToday ? '#fff' : (isPast ? '#707882' : '#181c20'),
          height: 'fit-content',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
          {day}
        </span>
        <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
          {d}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
          {month}
        </span>
      </div>

      {/* Events column */}
      <div className="flex-1 flex flex-col min-w-0" style={{ gap: 8 }}>
        {events.map(e => <EventCard
          key={e.id} event={e} showTeamTag={showTeamTag} isPast={isPast}
          isStaff={isStaff}
          attBreakdown={e.kind === 'training' ? attCounts[e.raw?.id] : undefined}
          matchBreakdown={(e.kind === 'match' || e.kind === 'tournament') ? matchCounts[e.raw?.id] : undefined}
          onOpenAttendance={onOpenAttendance}
          onEdit={onEdit}
          onOpenProgram={onOpenProgram}
          onOpenMatchAction={onOpenMatchAction}
          onOpenReport={onOpenReport}
          isParent={isParent}
          hasChildren={hasChildren}
        />)}
      </div>
    </div>
  )
}

function EventCard({ event, showTeamTag, isPast, isStaff, attBreakdown, matchBreakdown, onOpenAttendance, onEdit, onOpenProgram, onOpenMatchAction, onOpenReport, isParent, hasChildren }: {
  event: CalendarEvent; showTeamTag: boolean; isPast: boolean;
  isStaff: boolean; attBreakdown?: AttBreakdown;
  matchBreakdown?: MatchBreakdown;
  onOpenAttendance: (e: CalendarEvent) => void;
  onEdit?: (e: CalendarEvent) => void;
  onOpenProgram?: (e: CalendarEvent) => void;
  onOpenMatchAction?: (e: CalendarEvent) => void;
  onOpenReport?: (e: CalendarEvent) => void;
  isParent?: boolean;
  hasChildren?: boolean;
}) {
  const badge = eventBadgeStyle(event.kind)
  const isTraining = event.kind === 'training'
  const isMatch = event.kind === 'match' || event.kind === 'tournament'
  const canMatchTap = isMatch && (isStaff || (isParent && hasChildren))
  const clickable = (isStaff && isTraining) || canMatchTap
  const editable = isStaff && (isTraining || isMatch) && !!onEdit
  const hasAttendance = attBreakdown && attBreakdown.total > 0
  const hasProgram = isTraining && (
    event.raw?.program ||
    event.raw?.focus ||
    // count esercizi composti da training_session_exercises(count) → [{ count: N }]
    (Array.isArray(event.raw?.training_session_exercises) && event.raw.training_session_exercises[0]?.count > 0)
  )

  // Indicatore visivo casa/trasferta per le partite — colpo d'occhio nel calendario
  const isHomeMatch = isMatch && event.venue === 'home'
  const isAwayMatch = isMatch && event.venue === 'away'
  const venueBorderColor = isHomeMatch ? '#2e7d32' : isAwayMatch ? '#c47f00' : null

  return (
    <div
      onClick={clickable ? () => {
        if (isTraining) onOpenAttendance(event)
        else if (canMatchTap) onOpenMatchAction?.(event)
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        opacity: isPast && !clickable ? 0.6 : 1,
        cursor: clickable ? 'pointer' : undefined,
        border: clickable && hasAttendance ? '1px solid rgba(128,249,139,0.6)' : '1px solid transparent',
        // Bordo left 5px colorato solo per partite: verde=casa, arancione=trasferta
        borderLeft: venueBorderColor ? `5px solid ${venueBorderColor}` : undefined,
        paddingLeft: venueBorderColor ? 14 : 14,
        transition: 'transform 0.1s',
      }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 6 }}>
        <span
          className="flex items-center"
          style={{
            gap: 4,
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            padding: '3px 9px',
            borderRadius: 999,
            background: badge.bg,
            color: badge.color,
          }}
        >
          <Icon name={badge.icon} size={12} color={badge.color} />
          {badge.label}
        </span>
        {event.startTime && (
          <span style={{ fontSize: 11.5, color: '#707882', fontWeight: 600 }}>
            {event.startTime}
            {event.endTime ? `–${event.endTime}` : ''}
          </span>
        )}
        {/* Pill CASA / TRASFERTA — indicatore prominente per colpo d'occhio nel calendario */}
        {isHomeMatch && (
          <span style={{
            padding: '3px 9px', borderRadius: 999,
            background: '#e8f5e9', color: '#1b5e20',
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid #a5d6a7',
          }} title="Partita giocata in casa">
            <Icon name="home" size={12} color="#1b5e20" />
            Casa
          </span>
        )}
        {isAwayMatch && (
          <span style={{
            padding: '3px 9px', borderRadius: 999,
            background: '#fff4e6', color: '#7c4700',
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid #ffcc80',
          }} title="Partita giocata in trasferta">
            <Icon name="directions_car" size={12} color="#7c4700" />
            Trasferta
          </span>
        )}
        {event.raw?.lnd_gara_id && (
          <span style={{
            padding: '2px 7px', borderRadius: 999,
            background: '#eef7ff', color: '#004a78',
            fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }} title="Gara importata dal Comunicato Ufficiale LND">
            📄 Ufficiale
          </span>
        )}
        {/* Pill status presenze per allenamenti (solo staff) */}
        {clickable && (
          hasAttendance ? null : isPast ? (
            <span style={{
              marginLeft: 'auto',
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(255,209,0,0.25)', color: '#8e6300',
              fontSize: 10, fontWeight: 800,
            }}>Da compilare</span>
          ) : (
            <span style={{
              marginLeft: 'auto',
              padding: '3px 8px', borderRadius: 999,
              background: '#f1f3fa', color: '#707882',
              fontSize: 10, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="checklist" size={10} color="#707882" />
              Presenze
            </span>
          )
        )}
        {showTeamTag && event.teamName && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              background: event.teamColor || '#005f98',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {event.teamName}
          </span>
        )}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#181c20', margin: '0 0 4px', paddingRight: editable ? 28 : 0, position: 'relative' }}>
        {event.title}
        {editable && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit!(event) }}
            title="Modifica evento"
            style={{
              position: 'absolute', top: -2, right: -4,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 6, color: '#005f98',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="edit" size={16} color="#005f98" />
          </button>
        )}
      </h3>

      {/* Pill Programma allenamento (visibile a TUTTI se allenamento) */}
      {isTraining && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenProgram?.(event) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 999,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: hasProgram ? 'rgba(0,95,152,0.12)' : '#f1f3fa',
            color: hasProgram ? '#005f98' : '#707882',
            fontSize: 10.5, fontWeight: 700, marginBottom: 8,
          }}
        >
          <Icon name={hasProgram ? 'format_list_bulleted' : 'schedule'} size={11} color={hasProgram ? '#005f98' : '#707882'} />
          {hasProgram ? 'Vedi programma seduta' : 'Programma non pubblicato'}
        </button>
      )}

      {/* Pill azione partita: staff → convocazioni, parent → rispondi */}
      {isMatch && canMatchTap && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMatchAction?.(event) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 999,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: isStaff ? 'rgba(122,0,113,0.12)' : 'rgba(0,110,37,0.12)',
            color: isStaff ? '#7a0071' : '#006e25',
            fontSize: 10.5, fontWeight: 800, marginBottom: 8,
          }}
        >
          <Icon name={isStaff ? 'group' : 'how_to_reg'} size={11} color={isStaff ? '#7a0071' : '#006e25'} />
          {isStaff ? 'Convocazioni & risposte' : 'Rispondi disponibilità'}
        </button>
      )}

      {/* Pill Report post-partita: staff, solo partite passate */}
      {isMatch && isStaff && isPast && onOpenReport && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenReport(event) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 999,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: matchBreakdown?.reportCompleted ? 'rgba(0,110,37,0.12)' : 'rgba(255,193,7,0.20)',
            color: matchBreakdown?.reportCompleted ? '#006e25' : '#7c4700',
            fontSize: 10.5, fontWeight: 800, marginBottom: 8, marginLeft: 6,
          }}
        >
          <Icon name={matchBreakdown?.reportCompleted ? 'check_circle' : 'edit_note'} size={11} color={matchBreakdown?.reportCompleted ? '#006e25' : '#7c4700'} />
          {matchBreakdown?.reportCompleted ? 'Report OK · modifica' : 'Compila report'}
        </button>
      )}

      {/* KPI partita (staff): breakdown compatto */}
      {isMatch && isStaff && matchBreakdown && (matchBreakdown.yes + matchBreakdown.no + matchBreakdown.maybe + matchBreakdown.played + matchBreakdown.benched + matchBreakdown.convocated > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {/* Partita passata → priorità: giocato/panchina */}
          {isPast && matchBreakdown.played > 0 && (
            <span title="Giocati" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(0,95,152,0.12)', color: '#005f98', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="sports_soccer" size={10} color="#005f98" />
              {matchBreakdown.played} giocati
            </span>
          )}
          {isPast && matchBreakdown.benched > 0 && (
            <span title="Panchina" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(249,168,37,0.15)', color: '#8e6300', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="event_seat" size={10} color="#8e6300" />
              {matchBreakdown.benched} panchina
            </span>
          )}

          {/* Partita futura → risposte disponibilità */}
          {!isPast && matchBreakdown.yes > 0 && (
            <span title="Hanno confermato: Vengo" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(67,160,71,0.15)', color: '#2e7d32', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="check_circle" size={10} color="#2e7d32" />
              {matchBreakdown.yes} vengo
            </span>
          )}
          {!isPast && matchBreakdown.no > 0 && (
            <span title="Hanno risposto: Non vengo" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(198,40,40,0.12)', color: '#c62828', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="cancel" size={10} color="#c62828" />
              {matchBreakdown.no} no
            </span>
          )}
          {!isPast && matchBreakdown.maybe > 0 && (
            <span title="Hanno risposto: Forse" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(249,168,37,0.15)', color: '#8e6300', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="help" size={10} color="#8e6300" />
              {matchBreakdown.maybe} forse
            </span>
          )}

          {/* Convocazioni ufficiali (sempre se ci sono) */}
          {matchBreakdown.convocated > 0 && (
            <span title="Convocati ufficialmente" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(122,0,113,0.12)', color: '#7a0071', fontSize: 10, fontWeight: 800,
            }}>
              <Icon name="group" size={10} color="#7a0071" />
              {matchBreakdown.convocated} conv.
            </span>
          )}
        </div>
      )}

      {/* Breakdown presenze dettagliato (staff, allenamento firmato) */}
      {clickable && hasAttendance && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8,
        }}>
          {attBreakdown!.present > 0 && (
            <span title="Presenti" style={{
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: 'rgba(0,110,37,0.15)', color: '#006e25',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="check_circle" size={10} color="#006e25" />
              {attBreakdown!.present} presenti
            </span>
          )}
          {attBreakdown!.late > 0 && (
            <span title="In ritardo" style={{
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: 'rgba(142,99,0,0.15)', color: '#8e6300',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="schedule" size={10} color="#8e6300" />
              {attBreakdown!.late} in ritardo
            </span>
          )}
          {attBreakdown!.excused > 0 && (
            <span title="Giustificati" style={{
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: 'rgba(0,95,152,0.15)', color: '#005f98',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="event_available" size={10} color="#005f98" />
              {attBreakdown!.excused} giustificati
            </span>
          )}
          {attBreakdown!.absent > 0 && (
            <span title="Assenti" style={{
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: 'rgba(186,26,26,0.12)', color: '#93000a',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="cancel" size={10} color="#93000a" />
              {attBreakdown!.absent} assenti
            </span>
          )}
        </div>
      )}

      {event.location && (
        <p
          style={{
            fontSize: 11.5, color: '#707882', margin: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Icon name="location_on" size={13} />
          {event.location}
        </p>
      )}

      {event.notes && (
        <p style={{ fontSize: 11.5, color: '#404751', margin: '6px 0 0', fontStyle: 'italic' }}>
          {event.notes}
        </p>
      )}
    </div>
  )
}
