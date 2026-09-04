import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sortTeamsByAge } from '../lib/teamOrder'

export type EventKind = 'training' | 'match' | 'tournament' | 'marketing'

export interface CalendarEvent {
  id: string
  kind: EventKind
  date: string          // YYYY-MM-DD
  startTime: string     // HH:MM
  endTime: string | null
  title: string
  location: string | null
  address: string | null
  teamId: string | null
  teamName: string | null
  teamCategory: string | null
  teamColor: string | null
  opponent: string | null
  venue: 'home' | 'away' | null
  competition: string | null
  focus: string | null
  notes: string | null
  marketingCategory: string | null
  raw: any
}

interface Team {
  id: string
  name: string
  category: string | null
  color: string | null
}

interface UseCalendarEventsOptions {
  teamId?: string | null
  from?: string
  to?: string
  limit?: number
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const {
    teamId,
    from = new Date().toISOString().slice(0, 10),
    to,
    limit = 100,
  } = options

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, from, to, limit])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Teams (per enrichment)
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('id, name, category, age_range, color')
      if (teamsErr) console.warn('teams load err:', teamsErr)
      const teamsMap = new Map<string, Team>((teamsData ?? []).map(t => [t.id, t as Team]))
      setTeams(sortTeamsByAge((teamsData ?? []) as Team[]))

      // 2. Trainings (+ conteggio esercizi composti per capire se c'è un programma composto)
      let trainingsQuery = supabase
        .from('trainings')
        .select('*, training_session_exercises(count)')
        .gte('training_date', from)
      if (to) trainingsQuery = trainingsQuery.lte('training_date', to)
      if (teamId) trainingsQuery = trainingsQuery.eq('team_id', teamId)
      trainingsQuery = trainingsQuery.order('training_date').order('start_time').limit(limit)

      // 3. Matches
      let matchesQuery = supabase
        .from('matches')
        .select('*')
        .gte('match_date', `${from}T00:00:00`)
      if (to) matchesQuery = matchesQuery.lte('match_date', `${to}T23:59:59`)
      if (teamId) matchesQuery = matchesQuery.eq('team_id', teamId)
      matchesQuery = matchesQuery.order('match_date').limit(limit)

      // 4. Marketing pubblicati (RLS filtra già per audience)
      let marketingQuery = supabase
        .from('marketing_events')
        .select('*')
        .eq('is_published_calendar', true)
        .gte('event_date', from)
      if (to) marketingQuery = marketingQuery.lte('event_date', to)
      marketingQuery = marketingQuery.order('event_date').limit(limit)

      const [trainingsSettled, matchesSettled, marketingSettled] = await Promise.allSettled([
        trainingsQuery,
        matchesQuery,
        marketingQuery,
      ])
      const trainingsRes = trainingsSettled.status === 'fulfilled' ? trainingsSettled.value : { data: [], error: trainingsSettled.reason }
      const matchesRes   = matchesSettled.status   === 'fulfilled' ? matchesSettled.value   : { data: [], error: matchesSettled.reason }
      const marketingRes = marketingSettled.status === 'fulfilled' ? marketingSettled.value : { data: [], error: marketingSettled.reason }

      const errs: string[] = []
      if ((trainingsRes as any).error) errs.push('trainings: ' + ((trainingsRes as any).error.message ?? 'errore'))
      if ((matchesRes as any).error)   errs.push('matches: '   + ((matchesRes as any).error.message   ?? 'errore'))
      if (errs.length > 0) {
        console.warn('useCalendarEvents partial errors:', errs)
        // se ENTRAMBE fallite → esponi errore
        if ((trainingsRes as any).error && (matchesRes as any).error) {
          setError(errs.join(' | '))
        }
      }

      const norm: CalendarEvent[] = []

      for (const t of (trainingsRes.data ?? []) as any[]) {
        const team = t.team_id ? teamsMap.get(t.team_id) : null
        norm.push({
          id: `training-${t.id}`,
          kind: 'training',
          date: t.training_date,
          startTime: (t.start_time as string)?.slice(0, 5) || '',
          endTime: (t.end_time as string)?.slice(0, 5) || null,
          title: t.focus || 'Allenamento',
          location: t.location,
          address: null,
          teamId: t.team_id,
          teamName: team?.name || null,
          teamCategory: team?.category || null,
          teamColor: team?.color || null,
          opponent: null,
          venue: null,
          competition: null,
          focus: t.focus,
          notes: t.notes,
          marketingCategory: null,
          raw: t,
        })
      }

      for (const m of (matchesRes.data ?? []) as any[]) {
        const team = m.team_id ? teamsMap.get(m.team_id) : null
        const matchDate = new Date(m.match_date)
        // Uso getters LOCALI (non toISOString che ritorna UTC)
        const dateStr = `${matchDate.getFullYear()}-${String(matchDate.getMonth()+1).padStart(2,'0')}-${String(matchDate.getDate()).padStart(2,'0')}`
        const timeStr = `${String(matchDate.getHours()).padStart(2,'0')}:${String(matchDate.getMinutes()).padStart(2,'0')}`
        const isTournament = (m.competition || '').toLowerCase().includes('torneo')
        norm.push({
          id: `match-${m.id}`,
          kind: isTournament ? 'tournament' : 'match',
          date: dateStr,
          startTime: timeStr,
          endTime: null,
          title: isTournament
            ? `Torneo — ${m.opponent}`
            : `${m.venue === 'home' ? 'vs' : '@'} ${m.opponent}`,
          location: m.location,
          address: null,
          teamId: m.team_id,
          teamName: team?.name || null,
          teamCategory: team?.category || null,
          teamColor: team?.color || null,
          opponent: m.opponent,
          venue: m.venue,
          competition: m.competition,
          focus: null,
          notes: m.notes,
          marketingCategory: null,
          raw: m,
        })
      }

      // Marketing events pubblicati
      for (const me of (marketingRes.data ?? []) as any[]) {
        norm.push({
          id: `marketing-${me.id}`,
          kind: 'marketing',
          date: me.event_date,
          startTime: (me.start_time as string)?.slice(0, 5) || '',
          endTime: (me.end_time as string)?.slice(0, 5) || null,
          title: me.title,
          location: me.location,
          address: me.address,
          teamId: null,
          teamName: null,
          teamCategory: null,
          teamColor: me.color || '#7a0071',
          opponent: null,
          venue: null,
          competition: null,
          focus: null,
          notes: me.notes,
          marketingCategory: me.category,
          raw: me,
        })
      }

      // Ordina
      norm.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.startTime || '').localeCompare(b.startTime || '')
      })

      // eslint-disable-next-line no-console
      console.log(`[useCalendarEvents] Loaded: trainings=${(trainingsRes.data ?? []).length} matches=${(matchesRes.data ?? []).length} total=${norm.length} teamFilter=${teamId ?? 'none'}`)

      setEvents(norm)
    } catch (e: any) {
      console.error('useCalendarEvents error:', e)
      setError(e.message || 'Errore caricamento eventi')
    } finally {
      setLoading(false)
    }
  }

  const nextEvent = events.find(e => {
    const eventDT = new Date(`${e.date}T${e.startTime || '00:00'}:00`)
    return eventDT.getTime() >= Date.now()
  })

  return { events, teams, loading, error, refresh: load, nextEvent }
}

export function eventBadgeStyle(kind: EventKind): { bg: string; color: string; label: string; icon: string } {
  switch (kind) {
    case 'training':
      return { bg: '#cfe5ff', color: '#004a78', label: 'Allenamento', icon: 'fitness_center' }
    case 'match':
      return { bg: '#ffdad6', color: '#93000a', label: 'Partita', icon: 'sports_soccer' }
    case 'tournament':
      return { bg: 'rgba(255,209,0,0.25)', color: '#8e6300', label: 'Torneo', icon: 'emoji_events' }
    case 'marketing':
      return { bg: '#f4d0f2', color: '#7a0071', label: 'Evento club', icon: 'campaign' }
  }
}
