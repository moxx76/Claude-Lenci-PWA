import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { todayIT, dateIT } from '../../lib/dateIT'
import { avatarBg } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { ShuttleServiceCard } from '../../components/ShuttleServiceCard'

// M13 — Sheet lazy on-demand
const ParentAttendanceSheet = lazy(() => import('../../components/ParentAttendanceSheet').then(m => ({ default: m.ParentAttendanceSheet })))
const CalendarSubscribeSheet = lazy(() => import('../../components/CalendarSubscribeSheet').then(m => ({ default: m.CalendarSubscribeSheet })))


function ParentDashboard({ firstName }: { firstName: string }) {
  const { profile } = useAuth()
  const [children, setChildren] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nextEvents, setNextEvents] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState(0)
  const [responses, setResponses] = useState<Record<string, { status: string; updated_at: string }>>({})
  const [attSheetOpen, setAttSheetOpen] = useState(false)
  const [attEvent, setAttEvent] = useState<any>(null)
  const [attChild, setAttChild] = useState<any>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    load()
  }, [profile])

  const load = async () => {
    setLoading(true)
    const { data: kids } = await supabase.from('players')
      .select('id, first_name, last_name, birth_date, position, jersey_number, card_number, medical_expiry, avatar_url, team_id, team:teams(id, name, color, category)')
      .eq('parent_profile_id', profile!.id)
      .order('birth_date')
    const kidsClean = (kids ?? []).map((k: any) => ({
      ...k, team: Array.isArray(k.team) ? k.team[0] : k.team,
    }))
    setChildren(kidsClean)

    // Prossimi 5 eventi (allenamenti + partite) per le squadre dei figli
    if (kidsClean.length > 0) {
      const teamIds = kidsClean.map(k => k.team_id).filter(Boolean)
      const today = todayIT()
      const [trRes, mtRes] = await Promise.all([
        supabase.from('trainings').select('id, training_date, start_time, location, team_id, team:teams(id, name, color)')
          .in('team_id', teamIds).gte('training_date', today).order('training_date').limit(4),
        supabase.from('matches').select('id, match_date, venue, location, opponent, team_id, team:teams(id, name, color)')
          .in('team_id', teamIds).gte('match_date', today).order('match_date').limit(4),
      ])
      const all = [
        ...((trRes.data ?? []).map((t: any) => ({ ...t, kind: 'training', date: t.training_date, time: t.start_time, team: Array.isArray(t.team) ? t.team[0] : t.team }))),
        ...((mtRes.data ?? []).map((m: any) => {
          const d = m.match_date ? new Date(m.match_date) : null
          return {
            ...m, kind: 'match',
            date: d ? d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) : '',
            time: d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '',
            home_or_away: m.venue,
            team: Array.isArray(m.team) ? m.team[0] : m.team,
          }
        })),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
      setNextEvents(all)

      // Carico risposte già date dai/per i figli per questi eventi
      if (all.length > 0) {
        const kidIds = kidsClean.map(k => k.id)
        const evIds = all.map(e => e.id)
        const { data: resps } = await supabase.from('event_responses')
          .select('event_kind, event_id, player_id, status, updated_at')
          .in('player_id', kidIds)
          .in('event_id', evIds)
        const rmap: Record<string, { status: string; updated_at: string }> = {}
        for (const r of (resps ?? [])) {
          rmap[`${r.event_kind}:${r.event_id}:${r.player_id}`] = { status: r.status, updated_at: r.updated_at }
        }
        setResponses(rmap)
      }
    }
    setLoading(false)
  }

  const reloadResponses = async () => {
    if (children.length === 0 || nextEvents.length === 0) return
    const kidIds = children.map(k => k.id)
    const evIds = nextEvents.map(e => e.id)
    const { data: resps } = await supabase.from('event_responses')
      .select('event_kind, event_id, player_id, status, updated_at')
      .in('player_id', kidIds)
      .in('event_id', evIds)
    const rmap: Record<string, { status: string; updated_at: string }> = {}
    for (const r of (resps ?? [])) {
      rmap[`${r.event_kind}:${r.event_id}:${r.player_id}`] = { status: r.status, updated_at: r.updated_at }
    }
    setResponses(rmap)
  }

  const getInitials = (fn: string, ln: string) => (fn?.[0] || '') + (ln?.[0] || '')

  return (
    <>
      {/* Header parent */}
      <div style={{
        background: 'linear-gradient(135deg, #c1006c 0%, #7a0071 100%)',
        borderRadius: 18, padding: '16px 18px', color: '#fff',
        boxShadow: '0 12px 28px rgba(122,0,113,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="family_restroom" size={16} color="#ffd100" />
          <span style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
            Area genitore
          </span>
        </div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, margin: '4px 0 2px' }}>
          Ciao {firstName}!
        </h2>
        <p style={{ fontSize: 12.5, opacity: 0.9, margin: 0 }}>
          {loading ? 'Carico i dati dei ragazzi…'
            : children.length === 0 ? 'Nessun figlio associato — contatta la segreteria.'
            : `Segui ${children.length} ${children.length === 1 ? 'ragazzo' : 'ragazzi'} in tempo reale.`}
        </p>
      </div>

      {/* Card figli */}
      {children.map(child => {
        const initials = getInitials(child.first_name, child.last_name).toUpperCase()
        const medExpiry = child.medical_expiry
        const today = todayIT()
        const in30d = dateIT(new Date(Date.now() + 30 * 86400000))
        const medStatus = !medExpiry ? 'missing'
          : medExpiry < today ? 'expired'
          : medExpiry <= in30d ? 'expiring' : 'ok'
        return (
          <div key={child.id} style={{
            background: '#fff', borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
            borderTop: `4px solid ${child.team?.color || '#005f98'}`,
          }}>
            {/* Header figlio */}
            <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              {child.avatar_url ? (
                <img
                  src={child.avatar_url}
                  alt={`${child.first_name} ${child.last_name}`}
                  loading="lazy"
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                    background: avatarBg(initials),
                  }}
                  onError={(e) => {
                    // Fallback alle iniziali se l'immagine non carica
                    const img = e.currentTarget
                    img.style.display = 'none'
                    const fallback = img.nextElementSibling as HTMLElement | null
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: avatarBg(initials), color: '#fff',
                display: child.avatar_url ? 'none' : 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Anybody', fontWeight: 800, fontSize: 17, flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 17, color: '#181c20', margin: 0 }}>
                  {child.first_name} {child.last_name}
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {child.team && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 800,
                      background: (child.team.color || '#005f98') + '22',
                      color: child.team.color || '#005f98',
                      padding: '2px 8px', borderRadius: 999,
                    }}>{child.team.name}</span>
                  )}
                  {child.jersey_number && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#707882' }}>#{child.jersey_number}</span>
                  )}
                  {child.position && (
                    <span style={{ fontSize: 10.5, color: '#707882' }}>{child.position}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Info operative */}
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Certificato medico */}
              <div style={{
                padding: '9px 11px', borderRadius: 10,
                background: medStatus === 'missing' ? '#f4d0f2'
                  : medStatus === 'expired' ? '#ffdad6'
                  : medStatus === 'expiring' ? 'rgba(255,209,0,0.20)'
                  : 'rgba(128,249,139,0.15)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name={medStatus === 'ok' ? 'verified' : 'medical_services'} size={16}
                  color={medStatus === 'missing' ? '#7a0071'
                    : medStatus === 'expired' ? '#ba1a1a'
                    : medStatus === 'expiring' ? '#8e6300' : '#006e25'} />
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#181c20' }}>Certificato medico</div>
                  <div style={{ fontSize: 10.5, color: '#404751', marginTop: 1 }}>
                    {medStatus === 'missing' && 'Non registrato — contatta la segreteria'}
                    {medStatus === 'expired' && `Scaduto il ${new Date(medExpiry).toLocaleDateString('it-IT')}`}
                    {medStatus === 'expiring' && `Scade il ${new Date(medExpiry).toLocaleDateString('it-IT')} — rinnovalo`}
                    {medStatus === 'ok' && `Valido fino al ${new Date(medExpiry).toLocaleDateString('it-IT')}`}
                  </div>
                </div>
              </div>

              {/* Numero tessera FIGC (se presente) */}
              {child.card_number && (
                <div style={{
                  padding: '7px 11px', borderRadius: 8,
                  background: '#f7f9ff',
                  fontSize: 11, color: '#404751',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 700 }}>Matricola FIGC</span>
                  <span style={{ fontFamily: 'monospace' }}>{child.card_number}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Prossimi eventi delle squadre dei figli */}
      {nextEvents.length > 0 && (
        <div>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20', margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="event" size={16} color="#005f98" /> Prossimi impegni
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nextEvents.map(ev => {
              const dt = new Date(ev.date + 'T' + (ev.time || '00:00'))
              // Trovo il figlio a cui appartiene l'evento (per team_id)
              const childForEvent = children.find(k => k.team_id === ev.team_id)
              const respKey = childForEvent
                ? `${ev.kind}:${ev.id}:${childForEvent.id}`
                : null
              const resp = respKey ? responses[respKey] : null
              const status = resp?.status
              return (
                <button key={`${ev.kind}-${ev.id}`}
                  onClick={() => {
                    if (!childForEvent) return
                    setAttEvent(ev)
                    setAttChild(childForEvent)
                    setAttSheetOpen(true)
                  }}
                  disabled={!childForEvent}
                  style={{
                    background: '#fff', borderRadius: 10, padding: '10px 12px',
                    boxShadow: '0 4px 12px rgba(0,120,191,0.05)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <div style={{
                    width: 36, height: 40, borderRadius: 8,
                    background: ev.kind === 'match' ? '#ffdad6' : '#cfe5ff',
                    color: ev.kind === 'match' ? '#93000a' : '#005f98',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>
                      {dt.toLocaleDateString('it-IT', { month: 'short' })}
                    </span>
                    <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
                      {dt.getDate()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
                      {ev.kind === 'match' ? `${ev.team?.name} vs ${ev.opponent}` : `Allenamento ${ev.team?.name}`}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#707882', marginTop: 1, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{ev.time?.slice(0, 5)}{ev.location && ' · ' + ev.location}</span>
                      {childForEvent && children.length > 1 && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#7a0071', background: 'rgba(122,0,113,0.10)', padding: '1px 6px', borderRadius: 999 }}>
                          → {childForEvent.first_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {status ? (
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                      background: status === 'yes' ? 'rgba(0,110,37,0.15)' : status === 'no' ? 'rgba(186,26,26,0.15)' : 'rgba(142,99,0,0.15)',
                      color: status === 'yes' ? '#006e25' : status === 'no' ? '#93000a' : '#8e6300',
                      whiteSpace: 'nowrap',
                    }}>
                      {status === 'yes' ? '✅ CI SARÀ' : status === 'no' ? '❌ NO' : '❓ FORSE'}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                      background: '#f7f9ff', color: '#5a6270', whiteSpace: 'nowrap',
                    }}>
                      Rispondi
                    </span>
                  )}
                  <Icon name="chevron_right" size={16} color="#c0c7d2" />
                </button>
              )
            })}
          </div>

          {/* Bottone sottoscrivi calendario dinamico */}
          <button
            onClick={() => setSubscribeOpen(true)}
            style={{
              marginTop: 10, width: '100%', padding: '12px 14px', borderRadius: 12,
              background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)', color: '#fff',
              border: 'none',
              fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(0,95,152,0.20)',
            }}
          >
            <Icon name="event_repeat" size={16} color="#ffd100" />
            Sottoscrivi al calendario del telefono
          </button>
        </div>
      )}

      {/* Sheet lazy on-demand (M13) */}
      {attSheetOpen && (
        <Suspense fallback={null}>
          <ParentAttendanceSheet
            open={attSheetOpen}
            onClose={() => setAttSheetOpen(false)}
            event={attEvent}
            child={attChild}
            onSaved={reloadResponses}
          />
        </Suspense>
      )}

      {profile && subscribeOpen && (
        <Suspense fallback={null}>
          <CalendarSubscribeSheet
            open={subscribeOpen}
            onClose={() => setSubscribeOpen(false)}
            scope="children"
            scopeId={profile.id}
            label={children.length > 0
              ? `Lenci Poirino · ${children.map(k => k.first_name).join(' + ')}`
              : 'Lenci Poirino'}
          />
        </Suspense>
      )}

      {!loading && children.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 30, textAlign: 'center',
          color: '#707882', boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        }}>
          <Icon name="person_off" size={32} color="#c0c7d2" />
          <p style={{ margin: '10px 0 0', fontSize: 13 }}>
            Nessun ragazzo associato al tuo profilo. Scrivi alla segreteria per collegarli.
          </p>
        </div>
      )}
    </>
  )
}

export default ParentDashboard
