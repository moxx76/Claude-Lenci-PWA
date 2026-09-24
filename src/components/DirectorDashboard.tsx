import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { EventEditSheet } from './EventEditSheet'
import { AnnouncementEditSheet } from './AnnouncementEditSheet'
import { DatabaseBackupSheet } from './DatabaseBackupSheet'
import { TrainingExerciseCatalogSheet } from './TrainingExerciseCatalogSheet'
import { MedicalComplianceSheet } from './MedicalComplianceSheet'
import { PresenceLogSheet } from './PresenceLogSheet'
import { AdminStaffOverviewCard } from './AdminStaffOverviewCard'
import { CoachPlayerStatsDashboard } from './CoachPlayerStatsDashboard'
import { sortTeamsByAge } from '../lib/teamOrder'

interface Team {
  id: string
  name: string
  category: string | null
  color: string | null
  coach_name: string | null
  coach_email: string | null
  players_count: number
  avg_age: number | null
  medical_expiring: number
  medical_expired: number
}

interface Stats {
  players: number
  teams: number
  coaches: number
  adminsTotal: number
  trainingsUpcoming: number
  matchesUpcoming: number
  matchesWeek: number
  trainingsWeek: number
  certExpiring: number
  certExpired: number
  certMissing: number
  leadsNew: number
  leadsContacted: number
  leadsTryout: number
  leadsEnrolled: number
  announcementsTotal: number
}

interface UpcomingEvent {
  id: string
  kind: 'training' | 'match'
  date: string
  time: string
  title: string
  location: string | null
  team_name: string | null
  team_color: string | null
}

interface ExpiringPlayer {
  id: string
  first_name: string
  last_name: string
  medical_expiry: string | null
  team_name: string | null
}

export function DirectorDashboard({ firstName }: { firstName: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [statsTeamId, setStatsTeamId] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([])
  const [expiring, setExpiring] = useState<ExpiringPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [eventEditOpen, setEventEditOpen] = useState(false)
  const [annEditOpen, setAnnEditOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [pendingAnnouncements, setPendingAnnouncements] = useState<Array<{
    id: string; title: string; body: string;
    author: { full_name: string | null } | null;
    target_team: { name: string | null; color: string | null } | null;
  }>>([])
  const [rejectReasonFor, setRejectReasonFor] = useState<string | null>(null)
  const [rejectReasonText, setRejectReasonText] = useState('')
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [presenceLogOpen, setPresenceLogOpen] = useState(false)

  useEffect(() => { load() }, [])

  const approvePending = async (id: string) => {
    const { error } = await supabase.from('announcements').update({
      status: 'published',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      published_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('Errore approvazione: ' + error.message); return }
    load()
  }
  const rejectPending = async (id: string, reason: string) => {
    const { error } = await supabase.from('announcements').update({
      status: 'rejected',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      rejection_reason: reason.trim() || null,
    }).eq('id', id)
    if (error) { alert('Errore rifiuto: ' + error.message); return }
    setRejectReasonFor(null); setRejectReasonText('')
    load()
  }

  const load = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const in7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    // Fetch parallelo di tutte le metriche
    const [
      players, teamsData, coaches, admins,
      trUpc, mtUpc, trWeek, mtWeek,
      certExp, certExd, certMiss,
      lNew, lContact, lTryout, lEnroll,
      annCount,
      upcomingEvents,
      expiringList,
      pendAnn,
    ] = await Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id, name, category, age_range, color, head_coach_id'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('trainings').select('id', { count: 'exact', head: true }).gte('training_date', today),
      supabase.from('matches').select('id', { count: 'exact', head: true }).gte('match_date', today),
      supabase.from('trainings').select('id', { count: 'exact', head: true }).gte('training_date', today).lte('training_date', in7d),
      supabase.from('matches').select('id', { count: 'exact', head: true }).gte('match_date', today).lte('match_date', in7d + 'T23:59:59'),
      supabase.from('players').select('id', { count: 'exact', head: true }).not('medical_expiry', 'is', null).gte('medical_expiry', today).lte('medical_expiry', in30d),
      supabase.from('players').select('id', { count: 'exact', head: true }).not('medical_expiry', 'is', null).lt('medical_expiry', today),
      supabase.from('players').select('id', { count: 'exact', head: true }).is('medical_expiry', null),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'tryout'),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).eq('status', 'enrolled'),
      supabase.from('announcements').select('id', { count: 'exact', head: true }),
      Promise.all([
        supabase.from('trainings')
          .select('id, training_date, start_time, focus, location, team:teams(name, color)')
          .gte('training_date', today).lte('training_date', in7d)
          .order('training_date').order('start_time').limit(15),
        supabase.from('matches')
          .select('id, match_date, opponent, venue, competition, location, team:teams(name, color)')
          .gte('match_date', today).lte('match_date', in7d + 'T23:59:59')
          .order('match_date').limit(15),
      ]),
      supabase.from('players')
        .select('id, first_name, last_name, medical_expiry, team:teams(name)')
        .or(`medical_expiry.is.null,medical_expiry.lte.${in30d}`)
        .order('medical_expiry', { ascending: true, nullsFirst: true })
        .limit(15),
      supabase.from('announcements')
        .select('id, title, body, author:profiles!announcements_author_id_fkey(full_name), target_team:teams(name, color)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false }).limit(10),
    ])
    setPendingAnnouncements((pendAnn.data ?? []) as any)

    // Merge trainings + matches upcoming
    const evTr: UpcomingEvent[] = (upcomingEvents[0].data ?? []).map((t: any) => ({
      id: 't-' + t.id,
      kind: 'training' as const,
      date: t.training_date,
      time: (t.start_time || '00:00').slice(0, 5),
      title: t.focus || 'Allenamento',
      location: t.location,
      team_name: t.team?.name || null,
      team_color: t.team?.color || null,
    }))
    const evMt: UpcomingEvent[] = (upcomingEvents[1].data ?? []).map((m: any) => {
      const d = m.match_date ? new Date(m.match_date) : null
      return {
        id: 'm-' + m.id,
        kind: 'match' as const,
        date: d ? d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) : '',
        time: d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '',
        title: `vs ${m.opponent}${m.competition ? ` · ${m.competition}` : ''}`,
        location: m.location,
        team_name: m.team?.name || null,
        team_color: m.team?.color || null,
      }
    })
    const merged = [...evTr, ...evMt]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 10)
    setUpcoming(merged)

    setExpiring((expiringList.data ?? []).map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      medical_expiry: p.medical_expiry,
      team_name: p.team?.name || null,
    })))

    // Costruisco vista team con dettagli
    const teamsRaw = teamsData.data ?? []
    const teamsFull: Team[] = []
    for (const t of teamsRaw) {
      const [pl, coachRes, ageData, medExpRes, medExdRes] = await Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', t.id),
        t.head_coach_id
          ? supabase.from('profiles').select('full_name, email').eq('id', t.head_coach_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('players').select('birth_date').eq('team_id', t.id).not('birth_date', 'is', null),
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', t.id).not('medical_expiry', 'is', null).gte('medical_expiry', today).lte('medical_expiry', in30d),
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', t.id).not('medical_expiry', 'is', null).lt('medical_expiry', today),
      ])
      const ages = (ageData.data ?? [])
        .map((r: any) => {
          const d = new Date(r.birth_date)
          const now = new Date()
          return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0)
        })
      const avgAge = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null
      teamsFull.push({
        id: t.id,
        name: t.name,
        category: t.category,
        color: t.color,
        coach_name: coachRes.data?.full_name || null,
        coach_email: coachRes.data?.email || null,
        players_count: pl.count ?? 0,
        avg_age: avgAge,
        medical_expiring: medExpRes.count ?? 0,
        medical_expired: medExdRes.count ?? 0,
      })
    }

    setStats({
      players: players.count ?? 0,
      teams: teamsRaw.length,
      coaches: coaches.count ?? 0,
      adminsTotal: admins.count ?? 0,
      trainingsUpcoming: trUpc.count ?? 0,
      matchesUpcoming: mtUpc.count ?? 0,
      trainingsWeek: trWeek.count ?? 0,
      matchesWeek: mtWeek.count ?? 0,
      certExpiring: certExp.count ?? 0,
      certExpired: certExd.count ?? 0,
      certMissing: certMiss.count ?? 0,
      leadsNew: lNew.count ?? 0,
      leadsContacted: lContact.count ?? 0,
      leadsTryout: lTryout.count ?? 0,
      leadsEnrolled: lEnroll.count ?? 0,
      announcementsTotal: annCount.count ?? 0,
    })
    setTeams(sortTeamsByAge(teamsFull))
    // Default della squadra da mostrare nel pannello stats giocatori (una volta sola)
    if (teamsFull.length > 0) {
      setStatsTeamId(prev => prev ?? sortTeamsByAge(teamsFull)[0].id)
    }
    setLoading(false)
  }

  const totalLeads = (stats?.leadsNew ?? 0) + (stats?.leadsContacted ?? 0) + (stats?.leadsTryout ?? 0) + (stats?.leadsEnrolled ?? 0)
  const conversionRate = totalLeads > 0 ? Math.round(((stats?.leadsEnrolled ?? 0) / totalLeads) * 100) : 0
  const complianceRate = stats && stats.players > 0
    ? Math.round(((stats.players - stats.certExpired - stats.certExpiring - stats.certMissing) / stats.players) * 100)
    : 100

  const critical = (stats?.certExpired ?? 0) > 0 || (stats?.certMissing ?? 0) > 0

  return (
    <>
      {/* Header executive */}
      <div style={{
        background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
        borderRadius: 18, padding: '18px 20px', color: '#fff',
        boxShadow: '0 12px 28px rgba(0,60,94,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="workspace_premium" size={16} color="#ffd100" />
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#ffd100',
          }}>
            Direzione Generale
          </span>
        </div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 24, margin: 0, lineHeight: 1.15 }}>
          Buongiorno, {firstName || 'Direttore'}
        </h2>
        <p style={{ fontSize: 12.5, margin: '5px 0 0', opacity: 0.85 }}>
          ASD Lenci Poirino · Stagione 2026/2027
        </p>
      </div>

      {/* Panoramica staff (presenze allenamenti/partite + servizi navetta) */}
      <AdminStaffOverviewCard />

      {/* Statistiche giocatori per squadra — vista mister disponibile al direttore
          (che, come admin, non ha una propria squadra). Card leggera per il selettore,
          poi renderizza il componente CoachPlayerStatsDashboard (già una card con la
          sua intestazione) per non annidare card. */}
      {teams.length > 0 && (
        <>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '12px 14px',
            boxShadow: '0 6px 16px rgba(0,120,191,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="groups" size={16} color="#005f98" />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#005f98', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Statistiche giocatori — squadra
              </div>
            </div>
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
              margin: '0 -4px', padding: '0 4px 4px',
            }}>
              {teams.map(t => {
                const active = t.id === statsTeamId
                const color = t.color || '#005f98'
                return (
                  <button
                    key={t.id}
                    onClick={() => setStatsTeamId(t.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 999,
                      border: `1.5px solid ${active ? color : '#dfe6ef'}`,
                      background: active ? color : '#fff',
                      color: active ? '#fff' : '#404751',
                      fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.name}
                    <span style={{ marginLeft: 6, opacity: 0.75, fontSize: 10 }}>
                      · {t.players_count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {statsTeamId && (
            <CoachPlayerStatsDashboard
              teamId={statsTeamId}
              teamColor={teams.find(t => t.id === statsTeamId)?.color || undefined}
              categoryName={teams.find(t => t.id === statsTeamId)?.name}
            />
          )}
        </>
      )}

      {/* Snapshot societario */}
      <div>
        <SectionTitle icon="analytics" text="Snapshot societario" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <BigStat
            label="Tesserati"
            value={stats?.players ?? '—'}
            delta={`in ${stats?.teams ?? 0} squadre`}
            icon="groups"
            color="#005f98"
            bg="#cfe5ff"
          />
          <BigStat
            label="Staff tecnico"
            value={stats?.coaches ?? '—'}
            delta={`+ ${stats?.adminsTotal ?? 0} amministratori`}
            icon="psychology"
            color="#006e25"
            bg="rgba(128,249,139,0.35)"
          />
          <BigStat
            label="Impegni 7gg"
            value={(stats?.trainingsWeek ?? 0) + (stats?.matchesWeek ?? 0)}
            delta={`${stats?.trainingsWeek ?? 0} allen · ${stats?.matchesWeek ?? 0} part`}
            icon="calendar_month"
            color="#8e6300"
            bg="rgba(255,209,0,0.30)"
          />
          <BigStat
            label="Annunci pubblicati"
            value={stats?.announcementsTotal ?? '—'}
            delta="bacheca sempre attiva"
            icon="campaign"
            color="#b3005c"
            bg="rgba(179,0,92,0.15)"
          />
        </div>
      </div>

      {/* ANNUNCI DA APPROVARE */}
      {pendingAnnouncements.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff5cc 0%, #fff9e5 100%)',
          borderRadius: 16, padding: 14,
          border: '1px solid rgba(142,99,0,0.2)',
          boxShadow: '0 6px 16px rgba(255,209,0,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="fact_check" size={18} color="#8e6300" />
            <h3 style={{
              fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
              color: '#8e6300', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Annunci da approvare</h3>
            <span style={{
              marginLeft: 'auto', background: '#8e6300', color: '#fff',
              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
            }}>{pendingAnnouncements.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAnnouncements.map(a => (
              <div key={a.id} style={{
                background: '#fff', borderRadius: 11, padding: 12, border: '1px solid #f0e0a0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {a.target_team && (
                    <span style={{
                      background: (a.target_team.color || '#005f98') + '22',
                      color: a.target_team.color || '#005f98',
                      padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                    }}>{a.target_team.name}</span>
                  )}
                  <span style={{ fontSize: 10.5, color: '#707882' }}>
                    proposto da <strong>{a.author?.full_name || '—'}</strong>
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#181c20', marginBottom: 4 }}>
                  {a.title}
                </div>
                <p style={{
                  margin: '0 0 10px', fontSize: 12, color: '#404751',
                  lineHeight: 1.4, whiteSpace: 'pre-wrap',
                }}>{a.body}</p>

                {rejectReasonFor === a.id ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      value={rejectReasonText}
                      onChange={e => setRejectReasonText(e.target.value)}
                      placeholder="Motivo (facoltativo)"
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 7,
                        border: '1px solid #c0c7d2', fontSize: 12, outline: 'none',
                      }}
                    />
                    <button onClick={() => rejectPending(a.id, rejectReasonText)}
                      style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#93000a', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      Conferma
                    </button>
                    <button onClick={() => { setRejectReasonFor(null); setRejectReasonText('') }}
                      style={{ padding: '7px 12px', borderRadius: 7, background: '#fff', color: '#404751', border: '1px solid #c0c7d2', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Annulla
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approvePending(a.id)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', background: '#006e25', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Icon name="check" size={13} color="#fff" /> Approva
                    </button>
                    <button onClick={() => { setRejectReasonFor(a.id); setRejectReasonText('') }}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#fff', color: '#93000a', border: '1px solid #ffbdb6', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Icon name="close" size={13} color="#93000a" /> Rifiuta
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPLIANCE SANITARIA - priorità DG */}
      <div>
        <SectionTitle
          icon="verified_user"
          text="Compliance sanitaria"
          accent={critical ? '#ba1a1a' : (stats?.certExpiring ? '#8e6300' : '#006e25')}
        />
        <button
          onClick={() => {
            if (expiring.length > 0) setComplianceOpen(true)
          }}
          disabled={expiring.length === 0}
          style={{
            width: '100%', textAlign: 'left',
            background: '#fff', borderRadius: 18, padding: 16,
            borderLeft: `4px solid ${critical ? '#ba1a1a' : (stats?.certExpiring ? '#8e6300' : '#006e25')}`,
            border: 'none',
            boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
            cursor: expiring.length > 0 ? 'pointer' : 'default',
          }}
        >
          {/* Progress ring style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 82, height: 82, borderRadius: '50%',
              background: `conic-gradient(${critical ? '#ba1a1a' : '#006e25'} ${complianceRate}%, #e6e8ee 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 62, height: 62, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
              }}>
                <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 18, color: critical ? '#ba1a1a' : '#006e25', lineHeight: 1 }}>
                  {complianceRate}%
                </span>
                <span style={{ fontSize: 8.5, color: '#707882', fontWeight: 700, textTransform: 'uppercase' }}>
                  In regola
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                {stats && (stats.players - stats.certExpired - stats.certExpiring - stats.certMissing)} di {stats?.players ?? 0} tesserati
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#707882' }}>
                Certificato medico valido oltre 30 giorni
              </p>
              {stats && (stats.certExpired > 0 || stats.certExpiring > 0 || stats.certMissing > 0) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {stats.certMissing > 0 && (
                    <span style={{
                      background: '#f4d0f2', color: '#7a0071',
                      fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                    }}>
                      {stats.certMissing} MANCANTI
                    </span>
                  )}
                  {stats.certExpired > 0 && (
                    <span style={{
                      background: '#ffdad6', color: '#93000a',
                      fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                    }}>
                      {stats.certExpired} SCADUTI
                    </span>
                  )}
                  {stats.certExpiring > 0 && (
                    <span style={{
                      background: 'rgba(255,209,0,0.25)', color: '#8e6300',
                      fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                    }}>
                      {stats.certExpiring} IN SCADENZA
                    </span>
                  )}
                </div>
              )}
            </div>
            {expiring.length > 0 && (
              <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                <Icon name="chevron_right" size={22} color="#707882" />
              </div>
            )}
          </div>

          {expiring.length > 0 ? (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: '#f7f9ff',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: '#005f98', fontWeight: 700,
            }}>
              <Icon name="fact_check" size={15} color="#005f98" />
              Tocca per aprire l'elenco raggruppato per squadra →
            </div>
          ) : (
            <div style={{
              marginTop: 12, padding: 12, background: 'rgba(128,249,139,0.15)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: '#006e25', fontWeight: 700,
            }}>
              <Icon name="verified" size={16} color="#006e25" />
              Tutti i certificati sono in regola oltre i 30 giorni
            </div>
          )}
        </button>
      </div>

      {/* Squadre & Staff — vista completa */}
      <div>
        <SectionTitle icon="groups" text="Squadre & staff tecnico" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teams.map(t => (
            <div key={t.id} style={{
              background: '#fff', borderRadius: 16,
              padding: 14, boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
              borderLeft: `5px solid ${t.color || '#005f98'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div>
                  <h4 style={{
                    fontFamily: 'Anybody', fontWeight: 800, fontSize: 15,
                    color: '#181c20', margin: 0,
                  }}>
                    {t.name}
                  </h4>
                  {t.coach_name ? (
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#404751' }}>
                      Mister <strong>{t.coach_name}</strong>
                    </p>
                  ) : (
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#ba1a1a', fontWeight: 700 }}>
                      ⚠️ Nessun mister assegnato
                    </p>
                  )}
                </div>
                <span style={{
                  fontFamily: 'Anybody', fontWeight: 800, fontSize: 22,
                  color: t.color || '#005f98',
                }}>
                  {t.players_count}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <MiniTag label="tesserati" value={t.players_count} icon="badge" />
                {t.avg_age !== null && <MiniTag label="età media" value={t.avg_age} icon="cake" />}
                {t.medical_expired > 0 && (
                  <MiniTag label="scaduti" value={t.medical_expired} icon="error" color="#93000a" bg="#ffdad6" />
                )}
                {t.medical_expiring > 0 && (
                  <MiniTag label="in scad" value={t.medical_expiring} icon="warning" color="#8e6300" bg="rgba(255,209,0,0.25)" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Impegni prossimi 7 giorni */}
      <div>
        <SectionTitle icon="event_upcoming" text="Impegni prossimi 7 giorni" />
        {upcoming.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <Icon name="event_available" size={32} color="#c0c7d2" />
            <p style={{ fontSize: 12.5, color: '#707882', margin: '6px 0 0' }}>
              Nessun impegno nei prossimi 7 giorni
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcoming.map(e => {
              const d = new Date(e.date + 'T00:00:00')
              const dLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
              const isMatch = e.kind === 'match'
              return (
                <div key={e.id} style={{
                  background: '#fff', borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex', gap: 10, alignItems: 'center',
                  boxShadow: '0 3px 10px rgba(0,120,191,0.04)',
                  borderLeft: `4px solid ${isMatch ? '#b3005c' : (e.team_color || '#005f98')}`,
                }}>
                  <div style={{
                    width: 42, minWidth: 42, textAlign: 'center',
                    padding: '4px 0', borderRadius: 8,
                    background: isMatch ? 'rgba(179,0,92,0.1)' : '#f7f9ff',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#707882', textTransform: 'uppercase' }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)}
                    </div>
                    <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 16, color: isMatch ? '#b3005c' : '#005f98', lineHeight: 1 }}>
                      {d.getDate()}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
                      {isMatch && (
                        <span style={{
                          background: '#ffdad6', color: '#93000a',
                          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          Partita
                        </span>
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20', lineHeight: 1.2 }}>
                        {e.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#707882' }}>
                      {e.time && `${e.time} · `}
                      {e.team_name && (
                        <span style={{ color: e.team_color || '#005f98', fontWeight: 700 }}>
                          {e.team_name}
                        </span>
                      )}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions Direzione */}
      <div>
        <SectionTitle icon="bolt" text="Azioni rapide" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction
            icon="add_circle"
            label="Nuovo evento"
            hint="Allenamento o partita"
            color="#005f98"
            onClick={() => setEventEditOpen(true)}
          />
          <QuickAction
            icon="campaign"
            label="Nuovo annuncio"
            hint="Comunicazione al club"
            color="#b3005c"
            onClick={() => setAnnEditOpen(true)}
          />
          <QuickActionLink
            icon="groups"
            label="Vedi tesserati"
            hint="Anagrafica completa"
            color="#006e25"
            to="/teams"
          />
          <QuickActionLink
            icon="calendar_month"
            label="Calendario completo"
            hint="Tutti gli impegni"
            color="#8e6300"
            to="/calendario"
          />
          <QuickAction
            icon="fact_check"
            label="Log presenze pubbliche"
            hint="Chi ha risposto dal sito"
            color="#7a0071"
            onClick={() => setPresenceLogOpen(true)}
          />
        </div>

        {/* Catalogo esercizi + Backup dati */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => setCatalogOpen(true)}
            style={{
              padding: '10px 14px', borderRadius: 10,
              background: '#fff', border: '1px solid #d5dae2', color: '#404751',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icon name="library_books" size={14} color="#404751" />
            Catalogo esercizi
          </button>
          <button
            onClick={() => setBackupOpen(true)}
            style={{
              padding: '10px 14px', borderRadius: 10,
              background: '#fff', border: '1px solid #d5dae2', color: '#404751',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icon name="cloud_download" size={14} color="#404751" />
            Backup dati
          </button>
        </div>
      </div>

      {/* Modals */}
      <EventEditSheet
        open={eventEditOpen}
        onClose={() => setEventEditOpen(false)}
        teams={teams.map(t => ({ id: t.id, name: t.name, color: t.color, age_range: (t as any).age_range || null }))}
        onSaved={() => { setEventEditOpen(false); load() }}
      />
      <AnnouncementEditSheet
        open={annEditOpen}
        onClose={() => setAnnEditOpen(false)}
        existing={null}
        onSaved={() => { setAnnEditOpen(false); load() }}
      />
      <DatabaseBackupSheet
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
      />
      <TrainingExerciseCatalogSheet
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
      />
      <MedicalComplianceSheet
        open={complianceOpen}
        onClose={() => setComplianceOpen(false)}
        onUpdated={() => load()}
      />
      <PresenceLogSheet
        open={presenceLogOpen}
        onClose={() => setPresenceLogOpen(false)}
      />
    </>
  )
}

// ============================================================
// SUB-COMPONENTI
// ============================================================

function SectionTitle({ icon, text, accent }: { icon: string; text: string; accent?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: 8, marginTop: 4,
    }}>
      <Icon name={icon} size={16} color={accent || '#004a78'} />
      <h3 style={{
        fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
        color: accent || '#004a78', margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {text}
      </h3>
    </div>
  )
}

function BigStat({ label, value, delta, icon, color, bg }: {
  label: string; value: number | string; delta: string; icon: string; color: string; bg: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 14,
      boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#707882', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
        <Icon name={icon} size={14} color={color} style={{ background: bg, padding: 4, borderRadius: 6 }} />
      </div>
      <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: '#707882', marginTop: 3 }}>
        {delta}
      </div>
    </div>
  )
}

function MiniTag({ label, value, icon, color = '#404751', bg = '#f1f3fa' }: {
  label: string; value: number | string; icon: string; color?: string; bg?: string
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, padding: '4px 8px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 700,
    }}>
      <Icon name={icon} size={11} color={color} />
      <strong>{value}</strong> {label}
    </span>
  )
}

function FunnelBar({ label, value, total, color, bg }: {
  label: string; value: number; total: number; color: string; bg: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11.5, color: '#181c20', fontWeight: 600, minWidth: 78 }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 22, background: '#f1f3fa', borderRadius: 6,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
          background: bg,
          borderRadius: 6,
          transition: 'width 0.4s ease',
        }} />
        <span style={{
          position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)',
          fontSize: 11, fontWeight: 800, color,
        }}>
          {value}
        </span>
      </div>
      <span style={{ fontSize: 10.5, color: '#707882', fontWeight: 700, minWidth: 34, textAlign: 'right' }}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

function QuickAction({ icon, label, hint, color, onClick }: {
  icon: string; label: string; hint: string; color: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', border: '1px solid #e6e8ee', borderRadius: 14,
      padding: 12, textAlign: 'left', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 4,
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e6e8ee'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <Icon name={icon} size={20} color={color} />
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: '#707882' }}>{hint}</span>
    </button>
  )
}

function QuickActionLink({ icon, label, hint, color, to }: {
  icon: string; label: string; hint: string; color: string; to: string
}) {
  return (
    <Link to={to} style={{
      background: '#fff', border: '1px solid #e6e8ee', borderRadius: 14,
      padding: 12, textAlign: 'left', textDecoration: 'none',
      display: 'flex', flexDirection: 'column', gap: 4,
      transition: 'all 0.15s',
    }}>
      <Icon name={icon} size={20} color={color} />
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: '#707882' }}>{hint}</span>
    </Link>
  )
}
