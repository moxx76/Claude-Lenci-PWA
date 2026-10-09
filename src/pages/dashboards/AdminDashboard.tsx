import type React from 'react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { todayIT, dateIT } from '../../lib/dateIT'
import { avatarBg } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { TeamPickerSheet } from '../../components/TeamPickerSheet'
import { AdminStaffOverviewCard } from '../../components/AdminStaffOverviewCard'
import { WeekendPlannerCard } from '../../components/WeekendPlannerCard'
import { CoachPlayerStatsDashboard } from '../../components/CoachPlayerStatsDashboard'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { extractCity, isTournamentCompetition, HOME_CITY } from '../../lib/eventLocation'
import { ScadenziarioWidget } from '../../components/ScadenziarioWidget'

// M13 — Sheet pesanti aperti raramente dall'admin: lazy-loaded così il
// loro codice (e il transitivo pdf-lib/html2canvas per il backup) non
// entra nel chunk AdminDashboard. Il fallback è null: il tempo di
// caricamento è <1 frame tipico, l'overlay dello Sheet maschera già.
const EventEditSheet = lazy(() => import('../../components/EventEditSheet').then(m => ({ default: m.EventEditSheet })))
const DatabaseBackupSheet = lazy(() => import('../../components/DatabaseBackupSheet').then(m => ({ default: m.DatabaseBackupSheet })))
const TrainingExerciseCatalogSheet = lazy(() => import('../../components/TrainingExerciseCatalogSheet').then(m => ({ default: m.TrainingExerciseCatalogSheet })))
const MedicalComplianceSheet = lazy(() => import('../../components/MedicalComplianceSheet').then(m => ({ default: m.MedicalComplianceSheet })))
const PresenceLogSheet = lazy(() => import('../../components/PresenceLogSheet').then(m => ({ default: m.PresenceLogSheet })))


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
  const [statsPickerOpen, setStatsPickerOpen] = useState(false)

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
    // A10: usa todayIT/dateIT per "oggi civile Italia", non UTC
    const today = todayIT()
    const in30d = dateIT(new Date(Date.now() + 30 * 86400000))
    const in14d = dateIT(new Date(Date.now() + 14 * 86400000))
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

      {/* M22+ — Scadenziario in testa alla dashboard (richiesta Davide
          2026-10-09): deve essere la prima cosa che un admin vede. */}
      <ScadenziarioWidget />

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

      {/* Weekend del club raggruppato per settore (Prima Squadra / Settore Giovanile / Scuola Calcio).
          Richiesto da Luca Palermo per avere a colpo d'occhio i tre settori. Visibile per
          tutti gli admin (sia director sia non-director), montato anche in DirectorDashboard. */}
      <WeekendPlannerCard />

      {/* Panoramica staff (presenze allenamenti/partite + servizi navetta) */}
      <AdminStaffOverviewCard />

      {/* Selettore squadra per il pannello statistiche giocatori sotto.
          Stesso pattern usato in Calendario e Squadre: pulsante colorato col
          nome squadra che apre TeamPickerSheet (bottom sheet). Coerenza UI
          con il resto dell'app invece di chip scorrevoli custom. */}
      {teams.length > 0 && (() => {
        const selectedTeam = teams.find(t => t.id === statsTeamId) || teams[0]
        const color = selectedTeam?.color || '#005f98'
        return (
          <>
            <button
              onClick={() => setStatsPickerOpen(true)}
              style={{
                padding: '12px 14px', borderRadius: 12,
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
                <Icon name="leaderboard" size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                  Statistiche giocatori
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedTeam?.name || 'Seleziona squadra'}
                </div>
                {selectedTeam && teams.length > 1 && (
                  <div style={{ fontSize: 10.5, opacity: 0.9, marginTop: 2 }}>
                    {selectedTeam.count} tesserati · Cambia squadra
                  </div>
                )}
              </div>
              <Icon name="expand_more" size={20} color="#fff" />
            </button>

            {statsTeamId && (
              <CoachPlayerStatsDashboard
                teamId={statsTeamId}
                teamColor={selectedTeam?.color || undefined}
                categoryName={selectedTeam?.name}
              />
            )}

            <TeamPickerSheet
              open={statsPickerOpen}
              onClose={() => setStatsPickerOpen(false)}
              teams={teams.map(t => ({
                id: t.id, name: t.name, color: t.color,
                n_players: t.count,
              }))}
              selectedId={statsTeamId}
              onSelect={(id) => setStatsTeamId(id)}
            />
          </>
        )
      })()}

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

      {/* M13 — Editor evento e sheet admin pesanti caricati on-demand solo
          quando aperti (il chunk arriva al primo click, poi è in cache per
          la sessione). Fallback null: lo scrim dello Sheet copre il frame. */}
      {eventEditOpen && (
        <Suspense fallback={null}>
          <EventEditSheet
            open={eventEditOpen}
            onClose={() => setEventEditOpen(false)}
            teams={teams}
            onSaved={() => { setEventEditOpen(false); load() }}
          />
        </Suspense>
      )}
      {complianceOpen && (
        <Suspense fallback={null}>
          <MedicalComplianceSheet
            open={complianceOpen}
            onClose={() => setComplianceOpen(false)}
            onUpdated={() => load()}
          />
        </Suspense>
      )}
      {presenceLogOpen && (
        <Suspense fallback={null}>
          <PresenceLogSheet
            open={presenceLogOpen}
            onClose={() => setPresenceLogOpen(false)}
          />
        </Suspense>
      )}
      {backupOpen && (
        <Suspense fallback={null}>
          <DatabaseBackupSheet
            open={backupOpen}
            onClose={() => setBackupOpen(false)}
          />
        </Suspense>
      )}
      {catalogOpen && (
        <Suspense fallback={null}>
          <TrainingExerciseCatalogSheet
            open={catalogOpen}
            onClose={() => setCatalogOpen(false)}
          />
        </Suspense>
      )}
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

export default AdminDashboard
