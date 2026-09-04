import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { useToast } from './Toast'

type Status = 'present' | 'absent' | 'late' | 'excused'

interface EventRow {
  event_id: string
  event_date: string     // yyyy-mm-dd (per training) o timestamp iso (per match)
  event_time: string | null
  team_id: string
  team_name: string
  focus: string | null       // training
  opponent: string | null    // match
  venue: string | null       // match
  status: Status | null      // null = non tracciato
}

interface Props {
  open: boolean
  onClose: () => void
  profileId: string
  fullName: string
  kind: 'training' | 'match'
  onChanged?: () => void  // callback per refresh card parent
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  present:  { label: 'Presente',   color: '#2e7d32', bg: '#e8f5e9' },
  absent:   { label: 'Assente',    color: '#c62828', bg: '#ffe4e4' },
  late:     { label: 'In ritardo', color: '#8e6300', bg: '#fff4e6' },
  excused:  { label: 'Giustif.',   color: '#004a78', bg: '#eef7ff' },
}

const NOT_TRACKED = { label: 'Non firmata', color: '#707882', bg: '#f1f3fa' }

// Ciclo: null (non firmata) → present → absent → late → excused → null (di nuovo non firmata = elimina row)
const STATUS_CYCLE: (Status | null)[] = [null, 'present', 'absent', 'late', 'excused']

/**
 * Sheet che mostra tutti gli eventi (allenamenti o partite) passati delle squadre
 * dove il profilo è staff, con lo status di presenza corrente e possibilità di
 * modificarlo con un tap. Aperto dalla card AdminStaffOverviewCard.
 */
export function StaffAttendanceDetailSheet({ open, onClose, profileId, fullName, kind, onChanged }: Props) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)  // event_id in salvataggio

  useEffect(() => {
    if (!open || !profileId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId, kind])

  const load = async () => {
    setLoading(true)
    try {
      // 1) Squadre dove il profilo è staff
      const { data: teamsData } = await supabase.from('teams')
        .select('id, name')
        .or([
          `head_coach_id.eq.${profileId}`,
          `assistant_coach_id.eq.${profileId}`,
          `helper_coach_id.eq.${profileId}`,
          `team_manager_id.eq.${profileId}`,
          `second_manager_id.eq.${profileId}`,
          `linesman_id.eq.${profileId}`,
          `masseur_id.eq.${profileId}`,
        ].join(','))
      const teamIds = (teamsData ?? []).map(t => t.id)
      const teamMap = new Map((teamsData ?? []).map(t => [t.id, t.name]))
      if (teamIds.length === 0) { setEvents([]); setLoading(false); return }

      // 2) Eventi passati per quelle squadre
      let evs: any[] = []
      if (kind === 'training') {
        const { data } = await supabase.from('trainings')
          .select('id, team_id, training_date, start_time, focus')
          .in('team_id', teamIds)
          .lte('training_date', new Date().toISOString().slice(0, 10))
          .order('training_date', { ascending: false })
        evs = (data ?? []).map(t => ({
          event_id: t.id, event_date: t.training_date, event_time: t.start_time?.slice(0, 5) ?? null,
          team_id: t.team_id, team_name: teamMap.get(t.team_id) ?? '', focus: t.focus, opponent: null, venue: null,
        }))
      } else {
        const { data } = await supabase.from('matches')
          .select('id, team_id, match_date, opponent, venue')
          .in('team_id', teamIds)
          .lte('match_date', new Date().toISOString())
          .order('match_date', { ascending: false })
        evs = (data ?? []).map(m => {
          const d = new Date(m.match_date)
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
          return {
            event_id: m.id, event_date: dateStr, event_time: timeStr,
            team_id: m.team_id, team_name: teamMap.get(m.team_id) ?? '',
            focus: null, opponent: m.opponent, venue: m.venue,
          }
        })
      }

      // 3) Presenze staff registrate per questo profilo su questi eventi
      const eventIds = evs.map(e => e.event_id)
      const attMap = new Map<string, Status>()
      if (eventIds.length > 0) {
        const { data } = await supabase.from('staff_attendances')
          .select('event_id, status')
          .eq('event_kind', kind)
          .eq('profile_id', profileId)
          .in('event_id', eventIds)
        for (const a of (data ?? [])) attMap.set(a.event_id, a.status as Status)
      }

      setEvents(evs.map(e => ({ ...e, status: attMap.get(e.event_id) ?? null })))
    } finally {
      setLoading(false)
    }
  }

  const cycleStatus = async (evt: EventRow) => {
    const idx = STATUS_CYCLE.indexOf(evt.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setSaving(evt.event_id)

    // Optimistic
    setEvents(prev => prev.map(e => e.event_id === evt.event_id ? { ...e, status: next } : e))

    try {
      if (next === null) {
        // Elimino la riga (torna a "non firmata")
        const { error } = await supabase.from('staff_attendances').delete()
          .eq('event_kind', kind).eq('event_id', evt.event_id).eq('profile_id', profileId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('staff_attendances').upsert({
          event_kind: kind, event_id: evt.event_id, profile_id: profileId,
          status: next, recorded_by: profile?.id ?? null, recorded_at: new Date().toISOString(),
        }, { onConflict: 'event_kind,event_id,profile_id' })
        if (error) throw error
      }
      onChanged?.()  // refresh contatori nella card parent
    } catch (e: any) {
      // Rollback
      setEvents(prev => prev.map(x => x.event_id === evt.event_id ? { ...x, status: evt.status } : x))
      showToast(e.message || 'Errore salvataggio', 'error')
    } finally {
      setSaving(null)
    }
  }

  const dayLabel = (iso: string, time: string | null) => {
    const d = new Date(iso + 'T12:00:00')
    const day = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
    return time ? `${day} · ${time}` : day
  }

  // Aggregati per header
  const total = events.length
  const tracked = events.filter(e => e.status !== null).length
  const presentEq = events.filter(e => e.status === 'present' || e.status === 'late').length
  const pct = total > 0 ? Math.round(1000 * presentEq / total) / 10 : 0
  const pctColor = pct >= 80 ? '#2e7d32' : pct >= 60 ? '#8e6300' : '#c62828'

  return (
    <BottomSheet open={open} onClose={onClose}
      title={`${kind === 'training' ? 'Allenamenti' : 'Partite'} · ${fullName}`}>
      <div style={{ padding: '4px 4px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header con contatori */}
        <div style={{
          background: '#f7f9ff', border: '1px solid #d5e5ff', borderRadius: 12, padding: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ textAlign: 'center', minWidth: 60 }}>
            <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: pctColor, lineHeight: 1 }}>
              {pct}%
            </div>
            <div style={{ fontSize: 9, color: '#707882', fontWeight: 700, marginTop: 2 }}>
              presenza
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 11.5, color: '#404751', lineHeight: 1.4 }}>
            <div><b>{presentEq}/{total}</b> eventi con presenza (present + ritardo)</div>
            <div><b>{tracked}/{total}</b> firmati · {total - tracked} non firmati</div>
          </div>
        </div>

        {/* Legenda breve */}
        <div style={{ fontSize: 10.5, color: '#707882', fontStyle: 'italic', lineHeight: 1.4 }}>
          Tocca lo stato di ciascun evento per ciclare: <b>Non firmata → Presente → Assente → In ritardo → Giustif.</b> Il ciclo torna a "non firmata" per rimuovere la registrazione.
        </div>

        {loading && <div style={{ fontSize: 12, color: '#707882', textAlign: 'center', padding: 20 }}>Carico eventi…</div>}

        {!loading && events.length === 0 && (
          <div style={{ fontSize: 12, color: '#707882', textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
            Nessun {kind === 'training' ? 'allenamento' : 'partita'} passato per le sue squadre.
          </div>
        )}

        {/* Lista eventi */}
        {!loading && events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {events.map(evt => {
              const meta = evt.status ? STATUS_META[evt.status] : NOT_TRACKED
              const isSaving = saving === evt.event_id
              const title = kind === 'training'
                ? (evt.focus || 'Allenamento')
                : `${evt.venue === 'home' ? 'vs' : '@'} ${evt.opponent || 'Avversario'}`

              return (
                <button
                  key={evt.event_id}
                  onClick={() => cycleStatus(evt)}
                  disabled={isSaving}
                  style={{
                    background: '#fff', border: '1px solid #e6e8ee', borderRadius: 10,
                    padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    opacity: isSaving ? 0.5 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#181c20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dayLabel(evt.event_date, evt.event_time)}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#404751', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#005f98', fontWeight: 700 }}>{evt.team_name}</span>
                      <span style={{ color: '#707882' }}> · {title}</span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: '4px 9px', borderRadius: 999,
                    background: meta.bg, color: meta.color, whiteSpace: 'nowrap',
                  }}>
                    {meta.label}
                  </span>
                  <Icon name="sync" size={12} color="#c0c7d2" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
