import type React from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin, isCoach, isParent, isAthlete, avatarBg } from '../lib/types'
import { Icon } from '../components/Icon'
import { PlayerDetailSheet, type PlayerDetailData } from '../components/PlayerDetailSheet'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { EventEditSheet } from '../components/EventEditSheet'
import { DatabaseBackupSheet } from '../components/DatabaseBackupSheet'
import { TrainingExerciseCatalogSheet } from '../components/TrainingExerciseCatalogSheet'
import { BottomSheet } from '../components/BottomSheet'
import { MedicalComplianceSheet } from '../components/MedicalComplianceSheet'
import { PresenceLogSheet } from '../components/PresenceLogSheet'
import { ParentAttendanceSheet } from '../components/ParentAttendanceSheet'
import { CalendarSubscribeSheet } from '../components/CalendarSubscribeSheet'
import { DirectorDashboard } from '../components/DirectorDashboard'
import { ManagerDashboard } from '../components/ManagerDashboard'
import { CoachPlayerStatsDashboard } from '../components/CoachPlayerStatsDashboard'
import { ShuttleServiceCard } from '../components/ShuttleServiceCard'
import { AdminStaffOverviewCard } from '../components/AdminStaffOverviewCard'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useMyTeam } from '../hooks/useMyTeam'
import { useViewMode } from '../store/viewMode'
import { useImpersonation } from '../store/impersonation'

export function Dashboard() {
  const { profile } = useAuth()
  const { mode } = useViewMode()
  const { managerId } = useImpersonation()
  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || ''

  // Se l'utente è admin ma ha scelto la vista parent, mostra ParentDashboard con i propri figli
  const forcedParent = profile?.can_switch_to_parent === true && mode === 'parent'

  // Se supervisor sta impersonando, carico il profile target per il routing dashboard
  const [targetProfile, setTargetProfile] = useState<{ role: string; is_manager: boolean | null; full_name: string | null } | null>(null)
  useEffect(() => {
    if (!(profile?.is_supervisor && managerId)) { setTargetProfile(null); return }
    supabase.from('profiles').select('role, is_manager, full_name').eq('id', managerId).single()
      .then(({ data }) => setTargetProfile(data as any))
  }, [profile?.is_supervisor, managerId])

  const impersonatingTarget = !!(profile?.is_supervisor && managerId && targetProfile)
  const effectiveFirstName = impersonatingTarget
    ? (targetProfile?.full_name?.split(' ')[0] || firstName)
    : firstName

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      {forcedParent ? (
        <ParentDashboard firstName={firstName} />
      ) : impersonatingTarget ? (
        <>
          {targetProfile!.role === 'coach' && targetProfile!.is_manager && <ManagerDashboard firstName={effectiveFirstName} />}
          {targetProfile!.role === 'coach' && !targetProfile!.is_manager && <CoachDashboard firstName={effectiveFirstName} />}
          {targetProfile!.role === 'admin' && <AdminDashboard firstName={effectiveFirstName} />}
        </>
      ) : (
        <>
          {isAdmin(profile?.role) && profile?.is_director && <DirectorDashboard firstName={firstName} />}
          {isAdmin(profile?.role) && !profile?.is_director && <AdminDashboard firstName={firstName} />}
          {isCoach(profile?.role) && profile?.is_manager && <ManagerDashboard firstName={firstName} />}
          {isCoach(profile?.role) && !profile?.is_manager && <CoachDashboard firstName={firstName} />}
          {isAthlete(profile?.role) && <AthleteDashboard firstName={firstName} />}
          {isParent(profile?.role) && <ParentDashboard firstName={firstName} />}
          {!['admin', 'coach', 'athlete', 'parent'].includes(profile?.role ?? '') && (
            <PublicDashboard firstName={firstName} />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================

function AdminDashboard({ firstName }: { firstName: string }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canWrite = !profile?.is_readonly
  const [stats, setStats] = useState<{
    players: number
    teams: number
    trainings: number
    matches: number
    certExpiring: number
    certExpired: number
    certMissing: number
    leadsPending: number
  } | null>(null)
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color: string | null; count: number }>>([])
  const [expiringPlayers, setExpiringPlayers] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{
    id: string; kind: 'training' | 'match'; date: string; time: string;
    title: string; location: string | null;
    team_name: string | null; team_color: string | null;
  }>>([])
  const [pendingAnnouncements, setPendingAnnouncements] = useState<Array<{
    id: string; title: string; body: string; submitted_at: string;
    author: { full_name: string | null } | null;
    target_team: { name: string | null; color: string | null } | null;
  }>>([])
  const [rejectReasonFor, setRejectReasonFor] = useState<string | null>(null)
  const [rejectReasonText, setRejectReasonText] = useState('')
  const [eventEditOpen, setEventEditOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [presenceLogOpen, setPresenceLogOpen] = useState(false)
  // Squadra selezionata nel pannello "Statistiche giocatori per squadra":
  // l'admin non ha una propria squadra, quindi deve poter scegliere quale vedere.
  // Default = prima squadra caricata (impostato via useEffect dopo load).
  const [statsTeamId, setStatsTeamId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    const { error } = await supabase.from('announcements').update({
      status: 'published',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      published_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('Errore approvazione: ' + error.message); return }
    load()
  }

  const reject = async (id: string, reason: string) => {
    const { error } = await supabase.from('announcements').update({
      status: 'rejected',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      rejection_reason: reason.trim() || null,
    }).eq('id', id)
    if (error) { alert('Errore rifiuto: ' + error.message); return }
    setRejectReasonFor(null)
    setRejectReasonText('')
    load()
  }

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const in14d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    const [pl, tm, tr, mt, certExpiring, certExpired, certMissing, leadsPending, expiringList, upTr, upMt, pendAnn] = await Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id, name, color'),
      supabase.from('trainings').select('id', { count: 'exact', head: true }).gte('training_date', today),
      supabase.from('matches').select('id', { count: 'exact', head: true }).gte('match_date', today),
      supabase.from('players').select('id', { count: 'exact', head: true }).not('medical_expiry', 'is', null).gte('medical_expiry', today).lte('medical_expiry', in30d),
      supabase.from('players').select('id', { count: 'exact', head: true }).not('medical_expiry', 'is', null).lt('medical_expiry', today),
      supabase.from('players').select('id', { count: 'exact', head: true }).is('medical_expiry', null),
      supabase.from('recruitment_leads').select('id', { count: 'exact', head: true }).in('status', ['new', 'contacted', 'tryout']),
      supabase.from('players')
        .select('id, first_name, last_name, medical_expiry, team:teams(name, color)')
        .or(`medical_expiry.is.null,medical_expiry.lte.${in30d}`)
        .order('medical_expiry', { ascending: true, nullsFirst: true })
        .limit(10),
      supabase.from('trainings')
        .select('id, training_date, start_time, focus, location, team:teams(name, color)')
        .gte('training_date', today).lte('training_date', in14d)
        .order('training_date').order('start_time').limit(20),
      supabase.from('matches')
        .select('id, match_date, opponent, venue, competition, location, team:teams(name, color)')
        .gte('match_date', today).lte('match_date', in14d + 'T23:59:59')
        .order('match_date').limit(20),
      supabase.from('announcements')
        .select('id, title, body, submitted_at, author:profiles!announcements_author_id_fkey(full_name), target_team:teams(name, color)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false }).limit(10),
    ])
    setPendingAnnouncements((pendAnn.data ?? []) as any)

    // Merge trainings + matches
    const evTr = ((upTr.data ?? []) as any[]).map(t => ({
      id: 't-' + t.id, kind: 'training' as const,
      date: t.training_date, time: (t.start_time || '00:00').slice(0, 5),
      title: t.focus || 'Allenamento', location: t.location,
      team_name: t.team?.name || null, team_color: t.team?.color || null,
    }))
    const evMt = ((upMt.data ?? []) as any[]).map(m => {
      const d = m.match_date ? new Date(m.match_date) : null
      return {
        id: 'm-' + m.id, kind: 'match' as const,
        date: d ? d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) : '',
        time: d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '',
        title: `vs ${m.opponent}${m.competition ? ' · ' + m.competition : ''}`,
        location: m.location,
        team_name: m.team?.name || null, team_color: m.team?.color || null,
      }
    })
    setUpcomingEvents(
      [...evTr, ...evMt]
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 12)
    )

    // per-team player count
    const teamsData = tm.data ?? []
    const teamsWithCount: typeof teams = []
    for (const t of teamsData) {
      const { count } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', t.id)
      teamsWithCount.push({ ...t, count: count ?? 0 })
    }

    setStats({
      players: pl.count ?? 0,
      teams: teamsData.length,
      trainings: tr.count ?? 0,
      matches: mt.count ?? 0,
      certExpiring: certExpiring.count ?? 0,
      certExpired: certExpired.count ?? 0,
      certMissing: certMissing.count ?? 0,
      leadsPending: leadsPending.count ?? 0,
    })
    setTeams(teamsWithCount)
    // Se non è stata già scelta una squadra per il pannello stats, seleziono la prima
    // (di solito Prima Squadra o l'unica). Se cambia poi, resta la scelta dell'utente.
    if (teamsWithCount.length > 0) {
      setStatsTeamId(prev => prev ?? teamsWithCount[0].id)
    }
    setExpiringPlayers(expiringList.data ?? [])
  }

  return (
    <>
      <div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#005f98', margin: 0, lineHeight: 1.15 }}>
          Benvenuto, {firstName || 'Admin'}
        </h2>
        <p style={{ fontSize: 13, color: '#404751', margin: '6px 0 0' }}>
          Panoramica globale delle attività del club.
        </p>
      </div>

      {/* CTA Nuovo Evento */}
      {canWrite && (
        <button
          onClick={() => setEventEditOpen(true)}
          style={{
            background: '#005f98', color: '#fff', border: 'none', borderRadius: 999,
            padding: '13px 20px', fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.03em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,95,152,0.25)',
          }}
        >
          <Icon name="add_circle" size={18} />
          Nuovo evento
        </button>
      )}

      {/* Quick stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard
          label="Tesserati"
          value={stats?.players ?? '—'}
          icon="groups"
          color="#005f98"
          bg="#cfe5ff"
          onClick={() => navigate('/teams')}
        />
        <StatCard
          label="Squadre"
          value={stats?.teams ?? '—'}
          icon="sports"
          color="#006e25"
          bg="rgba(128,249,139,0.35)"
          onClick={() => navigate('/teams')}
        />
        <StatCard
          label="Allenamenti in programma"
          value={stats?.trainings ?? '—'}
          icon="fitness_center"
          color="#8e6300"
          bg="rgba(255,209,0,0.30)"
          onClick={() => navigate('/calendario?filter=training')}
        />
        <StatCard
          label="Partite in programma"
          value={stats?.matches ?? '—'}
          icon="sports_soccer"
          color="#b3005c"
          bg="rgba(179,0,92,0.15)"
          onClick={() => navigate('/calendario?filter=match')}
        />
      </div>

      {/* Scorciatoia Comunicati LND (staff) */}
      <button
        onClick={() => navigate('/comunicati')}
        style={{
          width: '100%', textAlign: 'left',
          background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
          borderRadius: 14, padding: '13px 16px', border: 'none', cursor: 'pointer',
          color: '#fff', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 14px rgba(0,60,94,0.15)',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="article" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Comunicati LND</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            Rilievi, scadenze e calendario 1ª squadra
          </div>
        </div>
        <Icon name="chevron_right" size={18} color="#fff" />
      </button>

      {/* Scorciatoia Catalogo Esercizi (staff) */}
      <button
        onClick={() => navigate('/esercizi')}
        style={{
          width: '100%', textAlign: 'left',
          background: 'linear-gradient(135deg, #c73434 0%, #7a0f0f 100%)',
          borderRadius: 14, padding: '13px 16px', border: 'none', cursor: 'pointer',
          color: '#fff', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 14px rgba(122,15,15,0.18)',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="fitness_center" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Catalogo esercizi</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            Sfoglia, crea e organizza tutti gli esercizi della metodologia
          </div>
        </div>
        <Icon name="chevron_right" size={18} color="#fff" />
      </button>
      {(stats?.certExpired ?? 0) + (stats?.certExpiring ?? 0) + (stats?.certMissing ?? 0) > 0 ? (
        <button
          onClick={() => setComplianceOpen(true)}
          style={{
            width: '100%', textAlign: 'left',
            background: '#fff', borderRadius: 18, padding: 16,
            borderLeft: `4px solid ${(stats?.certExpired ?? 0) > 0 || (stats?.certMissing ?? 0) > 0 ? '#ba1a1a' : '#8e6300'}`,
            border: 'none',
            boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20', margin: 0 }}>
                Certificati medici
              </h3>
              <p style={{ fontSize: 11.5, color: '#707882', margin: '2px 0 0' }}>
                {(stats?.certMissing ?? 0) > 0 && <>{stats?.certMissing} mancanti • </>}
                {stats?.certExpired ?? 0} scaduti • {stats?.certExpiring ?? 0} in scadenza (30gg)
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(stats?.certMissing ?? 0) > 0 && (
                  <span style={{ background: '#f4d0f2', color: '#7a0071', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
                    {stats?.certMissing} MANCANTI
                  </span>
                )}
                {(stats?.certExpired ?? 0) > 0 && (
                  <span style={{ background: '#ffdad6', color: '#93000a', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
                    {stats?.certExpired} SCADUTI
                  </span>
                )}
                {(stats?.certExpiring ?? 0) > 0 && (
                  <span style={{ background: 'rgba(255,209,0,0.25)', color: '#8e6300', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
                    {stats?.certExpiring} IN SCADENZA
                  </span>
                )}
              </div>
              <div style={{
                marginTop: 10, padding: '7px 10px', borderRadius: 8,
                background: '#f7f9ff',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, color: '#005f98', fontWeight: 700,
              }}>
                <Icon name="fact_check" size={13} color="#005f98" />
                Tocca per aprire l'elenco raggruppato per squadra →
              </div>
            </div>
            <Icon
              name="medical_services"
              size={22}
              color={(stats?.certExpired ?? 0) > 0 || (stats?.certMissing ?? 0) > 0 ? '#ba1a1a' : '#8e6300'}
            />
          </div>
        </button>
      ) : (
        <div style={{
          background: 'rgba(128,249,139,0.15)', borderRadius: 18, padding: 14,
          borderLeft: '4px solid #006e25',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="verified" size={22} color="#006e25" />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#006e25' }}>
              Tutti i certificati sono validi
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#404751' }}>
              Nessun certificato medico in scadenza nei prossimi 30 giorni
            </p>
          </div>
        </div>
      )}

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
            }}>
              Annunci da approvare
            </h3>
            <span style={{
              marginLeft: 'auto',
              background: '#8e6300', color: '#fff',
              padding: '2px 8px', borderRadius: 999,
              fontSize: 11, fontWeight: 800,
            }}>
              {pendingAnnouncements.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAnnouncements.map(a => (
              <div key={a.id} style={{
                background: '#fff', borderRadius: 11, padding: 12,
                border: '1px solid #f0e0a0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {a.target_team && (
                    <span style={{
                      background: (a.target_team.color || '#005f98') + '22',
                      color: a.target_team.color || '#005f98',
                      padding: '2px 7px', borderRadius: 6,
                      fontSize: 10, fontWeight: 800,
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
                      placeholder="Motivo del rifiuto (facoltativo)"
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 7,
                        border: '1px solid #c0c7d2', fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <button onClick={() => reject(a.id, rejectReasonText)}
                      style={btnRed}>Conferma</button>
                    <button onClick={() => { setRejectReasonFor(null); setRejectReasonText('') }}
                      style={btnGhost}>Annulla</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approve(a.id)} style={btnGreen}>
                      <Icon name="check" size={13} color="#fff" />
                      Approva
                    </button>
                    <button onClick={() => { setRejectReasonFor(a.id); setRejectReasonText('') }}
                      style={btnRedGhost}>
                      <Icon name="close" size={13} color="#93000a" />
                      Rifiuta
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panoramica staff (presenze allenamenti/partite + servizi navetta) */}
      <AdminStaffOverviewCard />

      {/* Selettore squadra per il pannello statistiche giocatori sotto.
          L'admin non ha una propria squadra: sceglie quale vedere. La card sotto
          (CoachPlayerStatsDashboard) è già una card bianca con la propria intestazione,
          quindi qui uso una card compatta solo per il selettore, per non annidare card. */}
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
                      · {t.count}
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

      {/* Prossimi impegni (14 giorni) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="event_upcoming" size={16} color="#004a78" />
            <h3 style={{
              fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
              color: '#004a78', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Prossimi impegni
            </h3>
          </div>
          <Link to="/calendario" style={{ fontSize: 11.5, fontWeight: 700, color: '#005f98', textDecoration: 'none' }}>
            Calendario →
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <Icon name="event_available" size={32} color="#c0c7d2" />
            <p style={{ fontSize: 12.5, color: '#707882', margin: '6px 0 0' }}>
              Nessun impegno nei prossimi 14 giorni
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingEvents.map(e => {
              const d = new Date(e.date + 'T00:00:00')
              const isMatch = e.kind === 'match'
              return (
                <button key={e.id} onClick={() => navigate(`/calendario?filter=${isMatch ? 'match' : 'training'}`)} style={{
                  background: '#fff', borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex', gap: 10, alignItems: 'center',
                  boxShadow: '0 3px 10px rgba(0,120,191,0.04)',
                  borderLeft: `4px solid ${isMatch ? '#b3005c' : (e.team_color || '#005f98')}`,
                  border: 'none', borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  width: '100%',
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
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Log presenze pubbliche */}
      <button
        onClick={() => setPresenceLogOpen(true)}
        style={{
          width: '100%', textAlign: 'left',
          background: 'linear-gradient(135deg, #7a0071 0%, #a04697 100%)',
          borderRadius: 18, padding: 14, border: 'none', cursor: 'pointer',
          color: '#fff',
          boxShadow: '0 10px 24px rgba(122,0,113,0.15)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="fact_check" size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800 }}>Log presenze pubbliche</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.9 }}>Anomalie e storico risposte dal sito</p>
        </div>
        <Icon name="chevron_right" size={18} color="rgba(255,255,255,0.8)" />
      </button>

      {/* Squadre overview */}
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
        <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 15, color: '#181c20', margin: '0 0 12px' }}>
          Squadre
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => navigate('/teams')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                background: '#f7f9ff', border: '1px solid #e6e8ee',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                width: '100%',
              }}
            >
              <div style={{
                width: 8, height: 40, borderRadius: 4,
                background: t.color || '#005f98',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                  {t.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
                  {t.count} tesserati
                </p>
              </div>
              <span style={{
                fontFamily: 'Anybody', fontWeight: 800, fontSize: 22,
                color: t.color || '#005f98',
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Catalogo esercizi (tutti) + Backup DB (solo admin non readonly) */}
      <div style={{ display: 'grid', gridTemplateColumns: canWrite ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
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
        {canWrite && (
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
        )}
      </div>

      {/* Editor evento */}
      <EventEditSheet
        open={eventEditOpen}
        onClose={() => setEventEditOpen(false)}
        teams={teams}
        onSaved={() => { setEventEditOpen(false); load() }}
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
      <DatabaseBackupSheet
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
      />
      <TrainingExerciseCatalogSheet
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
      />
    </>
  )
}

function StatCard({ label, value, icon, color, bg, onClick }: { label: string; value: number | string; icon: string; color: string; bg: string; onClick?: () => void }) {
  const content = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, color: '#707882', fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
        <Icon name={icon} size={16} color={color} style={{ background: bg, padding: 5, borderRadius: 8 }} />
      </div>
      <div style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color, lineHeight: 1 }}>
        {value}
      </div>
    </>
  )

  const commonStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14, padding: 14,
    boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        style={{
          ...commonStyle,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit', width: '100%',
          transition: 'transform 120ms ease-out, box-shadow 120ms',
        }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        {content}
      </button>
    )
  }
  return <div style={commonStyle}>{content}</div>
}

// ============================================================
// COACH DASHBOARD
// ============================================================

function CoachDashboard({ firstName }: { firstName: string }) {
  const { myTeam } = useMyTeam()
  const [rosterCount, setRosterCount] = useState<number>(0)
  const [rosterSample, setRosterSample] = useState<any[]>([])
  const [rosterFull, setRosterFull] = useState<any[]>([])
  const [certExpiring, setCertExpiring] = useState<any[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetailData | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceEvent, setAttendanceEvent] = useState<{ id: string; title: string; date: string; time: string } | null>(null)
  const [eventEditOpen, setEventEditOpen] = useState(false)
  const [pickEventOpen, setPickEventOpen] = useState(false)

  // Prossimo evento della SUA squadra
  const { nextEvent, events, refresh: refreshEvents } = useCalendarEvents({
    teamId: myTeam?.id ?? null,
    limit: 30,
  })

  useEffect(() => { if (myTeam?.id) load(myTeam.id) }, [myTeam?.id])
  const load = async (teamId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const [rosterRes, certRes] = await Promise.all([
      supabase
        .from('players')
        .select('id,first_name,last_name,position,birth_date,notes,fiscal_code,jersey_number,card_number,medical_expiry', { count: 'exact' })
        .eq('team_id', teamId)
        .order('last_name'),
      supabase
        .from('players')
        .select('id,first_name,last_name,medical_expiry')
        .eq('team_id', teamId)
        .not('medical_expiry', 'is', null)
        .lte('medical_expiry', in30d)
        .order('medical_expiry'),
    ])
    setRosterCount(rosterRes.count ?? 0)
    setRosterFull(rosterRes.data ?? [])
    setRosterSample((rosterRes.data ?? []).slice(0, 3))
    setCertExpiring(certRes.data ?? [])
  }

  const isToday = nextEvent && nextEvent.date === new Date().toISOString().slice(0, 10)
  const eventDateLabel = nextEvent
    ? (isToday ? `Oggi, ${nextEvent.startTime}` : `${new Date(nextEvent.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}, ${nextEvent.startTime}`)
    : ''

  // Attendance session
  const openAttendanceForNext = () => {
    if (!nextEvent) { setPickEventOpen(true); return }
    if (nextEvent.kind !== 'training') {
      setPickEventOpen(true)
      return
    }
    // training id = event.id minus prefix
    const trainingId = nextEvent.raw?.id
    setAttendanceEvent({
      id: trainingId,
      title: nextEvent.title,
      date: nextEvent.date,
      time: nextEvent.startTime,
    })
    setAttendanceOpen(true)
  }

  const trainingEvents = events.filter(e => e.kind === 'training')

  // Coach senza squadra assegnata
  if (!myTeam) {
    return (
      <>
        <div>
          <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#181c20', margin: 0 }}>
            Ciao Mister {firstName}
          </h2>
        </div>

        {/* Card evidenza attesa */}
        <div style={{
          background: 'linear-gradient(135deg, #fff4e6, #ffe4c0)',
          border: '1px solid #ffcda3',
          borderRadius: 18,
          padding: 22,
          boxShadow: '0 6px 20px rgba(180,90,10,0.08)',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: '#c47f00', color: '#fff',
            fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <Icon name="hourglass_top" size={13} color="#fff" />
            In attesa di assegnazione
          </div>
          <h3 style={{
            fontSize: 18, fontWeight: 800, color: '#5c3800',
            margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Il tuo profilo è attivo ma non hai ancora una squadra
          </h3>
          <p style={{ fontSize: 13, color: '#7c4700', margin: 0, lineHeight: 1.5 }}>
            Un amministratore della società deve assegnarti la squadra che allenerai in questa stagione. Solo dopo l'assegnazione potrai accedere a calendario, roster, convocazioni e report presenze.
          </p>
        </div>

        {/* Cosa fare */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: 16,
          boxShadow: '0 6px 20px rgba(0,120,191,0.05)',
          border: '1px solid #e6e8ee',
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#005f98',
            textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="info" size={13} color="#005f98" />
            Cosa fare adesso
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#404751', lineHeight: 1.7 }}>
            <li>Contatta un amministratore della società (Luca Palermo o Andrea Caratto) e chiedi l'assegnazione della tua squadra</li>
            <li>Nel frattempo puoi completare il tuo profilo dalla sezione <b>Profilo</b> in alto a destra</li>
            <li>Al prossimo accesso, quando la squadra sarà assegnata, vedrai qui tutte le informazioni della tua rosa</li>
          </ul>
        </div>

        {/* Servizio navetta — appare solo per autisti designati */}
        <ShuttleServiceCard />
      </>
    )
  }

  return (
    <>
      <div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 26, color: '#181c20', margin: 0 }}>
          {myTeam.name}
        </h2>
        <p style={{ fontSize: 13, color: '#404751', margin: '6px 0 0' }}>
          Bentornato, Mister {firstName || 'Rossi'}.
        </p>
      </div>

      {/* Servizio navetta — appare solo per autisti designati */}
      <ShuttleServiceCard />

      {/* CTA Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <button
          onClick={openAttendanceForNext}
          style={{
            background: myTeam.color || '#005f98', color: '#fff', border: 'none', borderRadius: 999,
            padding: '13px 16px', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.03em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,95,152,0.25)',
          }}
        >
          <Icon name="fact_check" size={17} />
          Segna Presenze
        </button>
        <button
          onClick={() => setEventEditOpen(true)}
          style={{
            background: '#fff', color: '#005f98', border: '2px solid #005f98', borderRadius: 999,
            padding: '11px 12px', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer',
          }}
        >
          <Icon name="add" size={16} color="#005f98" />
          Evento
        </button>
      </div>

      {/* Alert certificati */}
      {certExpiring.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 14,
          borderLeft: `4px solid ${certExpiring.some(c => new Date(c.medical_expiry) < new Date()) ? '#ba1a1a' : '#8e6300'}`,
          boxShadow: '0 6px 16px rgba(0,120,191,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name="medical_services" size={20} color="#8e6300" />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
                {certExpiring.length} certificat{certExpiring.length === 1 ? 'o' : 'i'} in scadenza
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
                Ricorda ai genitori di rinnovarli
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {certExpiring.slice(0, 3).map(c => {
              const days = Math.floor((new Date(c.medical_expiry).getTime() - Date.now()) / 86400000)
              return (
                <div key={c.id} style={{
                  fontSize: 11.5, display: 'flex', justifyContent: 'space-between',
                  padding: '4px 8px', background: '#f7f9ff', borderRadius: 6,
                }}>
                  <span style={{ color: '#181c20', fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                  <span style={{ color: days < 0 ? '#93000a' : '#8e6300', fontWeight: 700 }}>
                    {days < 0 ? `SCADUTO` : `${days}gg`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prossimo evento */}
      {nextEvent ? (
        <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', overflow: 'hidden' }}>
          <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
            <span
              style={{
                background: nextEvent.kind === 'training' ? '#80f98b' : '#ffdad6',
                color: nextEvent.kind === 'training' ? '#007327' : '#93000a',
                fontSize: 10, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                padding: '4px 10px', borderRadius: 999,
              }}
            >
              Prossimo {nextEvent.kind === 'training' ? 'Allenamento' : (nextEvent.kind === 'tournament' ? 'Torneo' : 'Impegno')}
            </span>
            <span style={{ fontSize: 12, color: '#404751' }}>{eventDateLabel}</span>
          </div>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: 18, color: '#181c20', margin: '0 0 8px' }}>
            {nextEvent.title}
          </h3>
          {nextEvent.location && (
            <p style={{ fontSize: 12.5, color: '#404751', margin: '0 0 14px', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="location_on" size={14} />
              {nextEvent.location}
            </p>
          )}
          <div
            style={{
              width: '100%', height: 110, borderRadius: 12,
              background: nextEvent.kind === 'training'
                ? `linear-gradient(135deg,#28A745,${myTeam.color || '#005f98'})`
                : `linear-gradient(135deg,#b3005c,${myTeam.color || '#005f98'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Icon
              name={nextEvent.kind === 'training' ? 'fitness_center' : 'sports_soccer'}
              size={40}
              color="rgba(255,255,255,0.85)"
            />
          </div>
          <Link
            to="/calendario"
            style={{
              border: '1px solid #005f98', color: '#005f98', background: 'transparent',
              borderRadius: 999, padding: '9px 16px', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Icon name="calendar_month" size={15} />
            Vedi tutto il calendario
          </Link>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 10px 24px rgba(0,120,191,0.06)', textAlign: 'center' }}>
          <Icon name="event_available" size={36} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>
            Nessun evento in programma
          </p>
          <button
            onClick={() => setEventEditOpen(true)}
            style={{
              marginTop: 8, background: '#005f98', color: '#fff', border: 'none',
              borderRadius: 999, padding: '8px 16px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Crea il primo evento
          </button>
        </div>
      )}

      {/* Statistiche giocatori — vista mister aggregata (presenze, minuti, gol, assist, cartellini) */}
      <CoachPlayerStatsDashboard teamId={myTeam.id} categoryName={myTeam.name} />

      {/* Rosa Attuale */}
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
        <div className="flex justify-between items-center flex-wrap" style={{ marginBottom: 12, gap: 8 }}>
          <h3 style={{ fontFamily: 'Anybody', fontWeight: 700, fontSize: 16, color: '#181c20', margin: 0 }}>
            Rosa {myTeam.name}
          </h3>
          <div className="flex" style={{ gap: 6 }}>
            <span style={{ fontSize: 10.5, background: '#e6e8ee', padding: '4px 8px', borderRadius: 999, color: '#181c20' }}>
              ● {rosterCount} Tesserati
            </span>
          </div>
        </div>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {rosterSample.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedPlayer({
                id: p.id,
                firstName: p.first_name || '',
                lastName: p.last_name || '',
                birthDate: p.birth_date,
                position: p.position,
                category: myTeam.category,
                previousClub: null,
                parentName: null,
                parentPhone: null,
                parentEmail: null,
                fiscalCode: p.fiscal_code,
                jerseyNumber: p.jersey_number,
                cardNumber: p.card_number,
                medicalExpiry: p.medical_expiry,
                source: 'player',
              })}
              className="flex items-center"
              style={{
                gap: 12, border: '1px solid #e0e2e9', borderRadius: 12,
                padding: '10px 12px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078bf'; e.currentTarget.style.background = '#f7f9ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e2e9'; e.currentTarget.style.background = 'transparent' }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: avatarBg(p.id),
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}
              >
                {(p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')}
              </div>
              <div className="flex-1 min-w-0">
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#181c20', margin: 0 }}>
                  {p.first_name} {p.last_name}
                </h4>
                <p style={{ fontSize: 11.5, color: '#006e25', margin: '1px 0 0' }}>
                  Disponibile{p.position ? ` • ${p.position}` : ''}
                </p>
              </div>
              <Icon name="chevron_right" size={18} color="#c0c7d2" />
            </div>
          ))}
          {rosterSample.length > 0 && (
            <Link to="/teams" style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#005f98', paddingTop: 6 }}>
              Vedi tutti →
            </Link>
          )}
        </div>
      </div>

      {/* Modals */}
      <PlayerDetailSheet
        open={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        player={selectedPlayer}
        canEdit={true}
        onUpdated={() => { if (myTeam?.id) load(myTeam.id); setSelectedPlayer(null) }}
      />
      <AttendanceSheet
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
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
      <EventEditSheet
        open={eventEditOpen}
        onClose={() => setEventEditOpen(false)}
        teams={[{ id: myTeam.id, name: myTeam.name, color: myTeam.color }]}
        defaultTeamId={myTeam.id}
        onSaved={() => { setEventEditOpen(false); refreshEvents() }}
      />
      {/* Selezione evento per presenze */}
      {pickEventOpen && (
        <EventPickerSheet
          open={pickEventOpen}
          onClose={() => setPickEventOpen(false)}
          events={trainingEvents}
          onPick={(e) => {
            setAttendanceEvent({
              id: e.raw?.id,
              title: e.title,
              date: e.date,
              time: e.startTime,
            })
            setPickEventOpen(false)
            setAttendanceOpen(true)
          }}
        />
      )}
    </>
  )
}

// Picker per scegliere su quale allenamento segnare le presenze
function EventPickerSheet({ open, onClose, events, onPick }: {
  open: boolean
  onClose: () => void
  events: any[]
  onPick: (e: any) => void
}) {
  // Divide passati vs futuri
  const today = new Date().toISOString().slice(0, 10)
  const past = events.filter(e => e.date < today).slice(-5).reverse()
  const upcoming = events.filter(e => e.date >= today).slice(0, 10)

  return (
    <BottomSheet open={open} onClose={onClose} title="Su quale allenamento?">
      <div style={{ padding: '4px 20px 24px' }}>
        <p style={{ fontSize: 12, color: '#707882', margin: '0 0 14px' }}>
          Scegli l'allenamento su cui vuoi registrare le presenze.
        </p>

        {upcoming.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#404751', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
              In programma
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map(e => (
                <EventPickerRow key={e.id} event={e} onClick={() => onPick(e)} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#404751', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
              Passati recenti
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {past.map(e => (
                <EventPickerRow key={e.id} event={e} onClick={() => onPick(e)} isPast />
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Nessun allenamento disponibile.
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

function EventPickerRow({ event, onClick, isPast }: { event: any; onClick: () => void; isPast?: boolean }) {
  const d = new Date(event.date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        border: '1px solid #e6e8ee', background: '#fff',
        cursor: 'pointer', textAlign: 'left',
        opacity: isPast ? 0.75 : 1,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: '#cfe5ff', color: '#004a78',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="fitness_center" size={16} color="#004a78" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20', textTransform: 'capitalize' }}>
          {dateLabel} · {event.startTime}
        </p>
        {event.location && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
            {event.location}
          </p>
        )}
      </div>
      <Icon name="chevron_right" size={18} color="#c0c7d2" />
    </button>
  )
}

// ============================================================
// ATHLETE DASHBOARD - gamification!
// ============================================================

function AthleteDashboard({ firstName }: { firstName: string }) {
  const { profile } = useAuth()
  const [presenceConfirmed, setPresenceConfirmed] = useState(false)
  const displayName = profile?.full_name || firstName || 'Atleta'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || 'AT'

  const badges = [
    { icon: 'bolt', color: '#00b4d8', name: 'Scheggia', desc: 'Velocità max in partita', opacity: 1 },
    { icon: 'sports_martial_arts', color: '#e21b79', name: 'Insuperabile', desc: '10 contrasti vinti', opacity: 1 },
    { icon: 'military_tech', color: '#707882', name: 'Cecchino', desc: '5 gol da fuori area', opacity: 0.4 },
    { icon: 'handshake', color: '#707882', name: 'Assist Man', desc: '10 assist stagionali', opacity: 0.4 },
  ]

  return (
    <>
      {/* Athlete hero card */}
      <div
        style={{
          background: '#fff', borderRadius: 18, padding: 22,
          boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg,#005f98,#0078bf)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: 'Anybody', fontWeight: 800, fontSize: 26,
            marginBottom: 10, position: 'relative',
          }}
        >
          {initials}
          <span
            style={{
              position: 'absolute', bottom: -2, right: -2,
              background: '#005f98', color: '#fff',
              border: '2px solid #fff',
              width: 26, height: 26, borderRadius: '50%',
              fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            L12
          </span>
        </div>
        <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 19, color: '#181c20', margin: '2px 0 0' }}>
          {displayName}
        </h2>
        <p style={{ fontSize: 12.5, color: '#404751', margin: '4px 0 10px' }}>
          Attaccante • Under 13
        </p>
        <span
          style={{
            background: '#e6e8ee', border: '1px solid #c0c7d2',
            borderRadius: 999, padding: '5px 14px',
            fontSize: 11.5, fontWeight: 700, color: '#181c20',
          }}
        >
          XP: 2450 / 3000
        </span>
      </div>

      {/* Grid 2x2 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatBox icon="sports_soccer" color="#00b4d8" value="14" label="Gol Stagionali" />
        <StatBox icon="speed" color="#e91e63" value="850'" label="Minuti Giocati" />
        <StatBox icon="verified" color="#4caf50" value="98%" label="Presenze All." />
        <StatBox icon="emoji_events" color="#FFD100" value="3" label="MVP Partita" />
      </div>

      {/* Card blu - Prossimo Allenamento con CONFERMA PRESENZA */}
      <div
        style={{
          background: '#005f98', borderRadius: 18, padding: 18, color: '#fff',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 12px 26px rgba(0,95,152,0.28)',
        }}
      >
        <span
          style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 999,
            padding: '4px 12px', fontSize: 10.5, fontWeight: 700,
          }}
        >
          Prossimo Allenamento
        </span>
        <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, margin: '10px 0 4px' }}>
          Oggi, 17:30
        </h3>
        <p style={{ fontSize: 12, opacity: 0.9, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="location_on" size={14} />
          Campo Sportivo Poirino (Sintetico)
        </p>
        {presenceConfirmed ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.18)', borderRadius: 12,
              padding: 13, textAlign: 'center',
              fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icon name="check_circle" size={18} />
            PRESENZA CONFERMATA
          </div>
        ) : (
          <button
            onClick={() => setPresenceConfirmed(true)}
            style={{
              width: '100%', background: '#83fc8e', color: '#002106',
              border: 'none', borderRadius: 12, padding: 13,
              fontFamily: 'Anybody', fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer',
            }}
          >
            <Icon name="check_circle" size={18} />
            CONFERMA PRESENZA
          </button>
        )}
      </div>

      {/* Obiettivi Sbloccati */}
      <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 10px 24px rgba(0,120,191,0.06)' }}>
        <h3
          style={{
            fontFamily: 'Anybody', fontWeight: 700, fontSize: 16,
            color: '#181c20', margin: '0 0 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Icon name="local_fire_department" size={20} color="#005f98" />
          Obiettivi Sbloccati
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {badges.map(b => (
            <div
              key={b.name}
              style={{
                border: '1px solid #e0e2e9', borderRadius: 14, padding: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', opacity: b.opacity,
              }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#ebeef4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Icon name={b.icon} size={22} color={b.color} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#181c20' }}>{b.name}</span>
              <span style={{ fontSize: 10, color: '#707882' }}>{b.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function StatBox({ icon, color, value, label, onClick }: { icon: string; color: string; value: string; label: string; onClick?: () => void }) {
  const content = (
    <>
      <Icon name={icon} size={26} color={color} />
      <span style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#707882' }}>{label}</span>
    </>
  )
  const commonStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #e0e2e9', borderRadius: 14,
    padding: 14, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 4,
  }
  if (onClick) {
    return (
      <button
        onClick={onClick}
        style={{ ...commonStyle, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {content}
      </button>
    )
  }
  return <div style={commonStyle}>{content}</div>
}

// ============================================================
// PARENT DASHBOARD
// ============================================================


// ============================================================
// ============================================================
// PARENT DASHBOARD (dati reali via parent_profile_id)
// ============================================================

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
      .select('id, first_name, last_name, birth_date, position, jersey_number, card_number, medical_expiry, team_id, team:teams(id, name, color, category)')
      .eq('parent_profile_id', profile!.id)
      .order('birth_date')
    const kidsClean = (kids ?? []).map((k: any) => ({
      ...k, team: Array.isArray(k.team) ? k.team[0] : k.team,
    }))
    setChildren(kidsClean)

    // Prossimi 5 eventi (allenamenti + partite) per le squadre dei figli
    if (kidsClean.length > 0) {
      const teamIds = kidsClean.map(k => k.team_id).filter(Boolean)
      const today = new Date().toISOString().slice(0, 10)
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
        const today = new Date().toISOString().slice(0, 10)
        const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
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
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: avatarBg(initials), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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

      {/* Sheet gestione presenza */}
      <ParentAttendanceSheet
        open={attSheetOpen}
        onClose={() => setAttSheetOpen(false)}
        event={attEvent}
        child={attChild}
        onSaved={reloadResponses}
      />

      {/* Sheet sottoscrizione calendario */}
      {profile && (
        <CalendarSubscribeSheet
          open={subscribeOpen}
          onClose={() => setSubscribeOpen(false)}
          scope="children"
          scopeId={profile.id}
          label={children.length > 0
            ? `Lenci Poirino · ${children.map(k => k.first_name).join(' + ')}`
            : 'Lenci Poirino'}
        />
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

// PUBLIC (fallback ruoli non definiti)
// ============================================================

function PublicDashboard({ firstName }: { firstName: string }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 18, padding: 22, textAlign: 'center',
        boxShadow: '0 10px 24px rgba(0,120,191,0.06)',
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg,#005f98,#0078bf)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, margin: '0 auto 12px',
        }}
      >
        LP
      </div>
      <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20', margin: 0 }}>
        Ciao {firstName || 'ospite'}!
      </h2>
      <p style={{ fontSize: 13, color: '#404751', margin: '8px 0 0' }}>
        Il tuo account è attivo. Contatta la segreteria per assegnare il tuo ruolo.
      </p>
    </div>
  )
}

// helpers
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ora'
  if (min < 60) return `${min} min fa`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ${d === 1 ? 'giorno' : 'giorni'} fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

// Stili condivisi per bottoni approva/rifiuta annunci
const btnGreen: React.CSSProperties = {
  flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none',
  background: '#006e25', color: '#fff', fontSize: 12, fontWeight: 800,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
}
const btnRed: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 7, border: 'none',
  background: '#93000a', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
}
const btnRedGhost: React.CSSProperties = {
  flex: 1, padding: '8px 10px', borderRadius: 8,
  background: '#fff', color: '#93000a', border: '1px solid #ffbdb6',
  fontSize: 12, fontWeight: 800, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
}
const btnGhost: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 7,
  background: '#fff', color: '#404751', border: '1px solid #c0c7d2',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}
