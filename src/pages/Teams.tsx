import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { RecruitmentLead, LeadStatus } from '../lib/types'
import { STATUS_LABEL, STATUS_STYLE, categoryStyle, avatarBg, isAdmin, isCoach } from '../lib/types'
import { calculateAge } from '../lib/utils'
import { Icon } from '../components/Icon'
import { PlayerDetailSheet, type PlayerDetailData } from '../components/PlayerDetailSheet'
import { PlayerEditSheet } from '../components/PlayerEditSheet'
import { TeamEditSheet } from '../components/TeamEditSheet'
import { StaffManagementSheet } from '../components/StaffManagementSheet'
import { TeamPickerSheet } from '../components/TeamPickerSheet'
import { AttendanceStatsSheet } from '../components/AttendanceStatsSheet'
import { TeamTrainingHistorySheet } from '../components/TeamTrainingHistorySheet'
import { TrainingDetailSheet } from '../components/TrainingDetailSheet'
import { EventEditSheet } from '../components/EventEditSheet'
import { TopScorersCard } from '../components/TopScorersCard'
import { AttendanceSheet } from '../components/AttendanceSheet'
import { useAuth } from '../store/auth'
import { useMyTeam } from '../hooks/useMyTeam'

const FILTERS: Array<{ key: 'all' | LeadStatus; label: string }> = [
  { key: 'enrolled', label: 'Tesserati' },
  { key: 'tryout', label: 'Provini' },
  { key: 'contacted', label: 'Contattati' },
  { key: 'new', label: 'Nuovi' },
  { key: 'all', label: 'Tutti' },
]

import { useTeamPicker } from '../hooks/useTeamPicker'

export function Teams() {
  const { profile } = useAuth()
  const { myTeam, myTeams } = useMyTeam()
  const { teams: allTeams, refresh: refreshTeams } = useTeamPicker()
  const [selected, setSelected] = useState<PlayerDetailData | null>(null)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [adminTeamId, setAdminTeamId] = useState<string | null>(null)
  const [teamSheetOpen, setTeamSheetOpen] = useState(false)
  const [teamSheetEditing, setTeamSheetEditing] = useState<any>(null)
  const [staffOpen, setStaffOpen] = useState(false)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [detailTrainingId, setDetailTrainingId] = useState<string | null>(null)
  const [editTrainingEvent, setEditTrainingEvent] = useState<{ kind: 'training'; id: string; team_id: string; training_date?: string; start_time?: string | null; end_time?: string | null; location?: string | null; focus?: string | null; program?: string | null; notes?: string | null } | null>(null)
  const [attendanceState, setAttendanceState] = useState<{ trainingId: string; date: string; startTime: string; players: Array<{ id: string; firstName: string; lastName: string; position?: string | null }>; title: string } | null>(null)
  const [rosterReloadTick, setRosterReloadTick] = useState(0)

  const isCoachView = isCoach(profile?.role) && !!myTeam
  const isAdminView = isAdmin(profile?.role)
  const isManagerView = isCoach(profile?.role) && profile?.is_manager === true && !!myTeam
  const canWrite = !profile?.is_readonly

  const currentTeam = myTeams.find(t => t.id === activeTeamId) || myTeams[0] || myTeam
  useEffect(() => {
    if (myTeams.length > 0 && !activeTeamId) setActiveTeamId(myTeams[0].id)
  }, [myTeams, activeTeamId])

  // Admin: prima squadra come default appena arrivano le teams
  useEffect(() => {
    if (isAdminView && allTeams.length > 0 && !adminTeamId) setAdminTeamId(allTeams[0].id)
  }, [isAdminView, allTeams, adminTeamId])

  const adminCurrentTeam = isAdminView ? (allTeams.find(t => t.id === adminTeamId) || null) : null

  return (
    <div
      className="max-w-md md:max-w-2xl mx-auto flex flex-col"
      style={{ padding: '20px 18px', gap: 18 }}
    >
      {/* SELETTORE SQUADRA con dropdown → bottom sheet */}
      {(isAdminView || isCoachView) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(() => {
            const teamsForPicker = isAdminView ? allTeams : myTeams
            const selectedTeam = isAdminView ? adminCurrentTeam : currentTeam
            if (teamsForPicker.length === 0) return null
            const color = selectedTeam?.color || '#005f98'
            return (
              <>
                <button
                  onClick={() => setTeamPickerOpen(true)}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12,
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
                    <Icon name="shield" size={18} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedTeam?.name || 'Seleziona squadra'}
                    </div>
                    {selectedTeam && (
                      <div style={{ fontSize: 10.5, opacity: 0.9, marginTop: 2 }}>
                        {selectedTeam.category || selectedTeam.age_range}
                        {teamsForPicker.length > 1 && ` · Cambia squadra`}
                      </div>
                    )}
                  </div>
                  <Icon name="expand_more" size={18} color="#fff" />
                </button>
                {canWrite && isAdminView && (
                  <button
                    onClick={() => setStaffOpen(true)}
                    title="Gestione staff"
                    style={{
                      flexShrink: 0, background: '#fff',
                      color: '#7a0071', border: '1.5px solid #7a0071', borderRadius: 12,
                      padding: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Icon name="groups" size={16} color="#7a0071" />
                  </button>
                )}
              </>
            )
          })()}
          {isAdminView && canWrite && allTeams.length === 0 && (
            <button
              onClick={() => { setTeamSheetEditing(null); setTeamSheetOpen(true) }}
              style={{
                background: 'linear-gradient(135deg, #005f98, #0078bf)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 14px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
              }}
            >
              <Icon name="add" size={16} color="#fff" /> Nuova squadra
            </button>
          )}
        </div>
      )}

      {isCoachView && currentTeam ? (
        <CoachRoster
          team={currentTeam}
          onSelect={setSelected}
          canManage={isManagerView && canWrite}
          reloadTick={rosterReloadTick}
          onEditTeam={isManagerView && canWrite ? () => { setTeamSheetEditing(currentTeam); setTeamSheetOpen(true) } : undefined}
          onOpenStats={() => setStatsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          canSeePayments={false}
        />
      ) : isAdminView && adminCurrentTeam ? (
        <CoachRoster
          team={adminCurrentTeam as any}
          onSelect={setSelected}
          canManage={canWrite}
          reloadTick={rosterReloadTick}
          onEditTeam={canWrite ? () => { setTeamSheetEditing(adminCurrentTeam); setTeamSheetOpen(true) } : undefined}
          onOpenStats={() => setStatsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          canSeePayments={true}
        />
      ) : isAdminView ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#707882', fontSize: 13 }}>
          Nessuna squadra disponibile{canWrite ? '. Crea la prima usando il bottone in alto.' : '.'}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#707882', fontSize: 13 }}>
          Accesso riservato a coach e amministratori.
        </div>
      )}

      <PlayerDetailSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        player={selected}
        canEdit={(isAdminView || isCoachView) && canWrite}
      />

      {/* Sheet crea/modifica squadra (admin crea/modifica; dirigente solo modifica sua squadra) */}
      {profile?.club_id && canWrite && (isAdminView || isManagerView) && (
        <TeamEditSheet
          open={teamSheetOpen}
          onClose={() => setTeamSheetOpen(false)}
          clubId={profile.club_id}
          existingTeam={teamSheetEditing}
          canDelete={isAdminView}
          onSaved={() => { refreshTeams?.() }}
          onDeleted={() => { refreshTeams?.(); setAdminTeamId(null) }}
        />
      )}

      {/* Gestione staff (admin) */}
      {canWrite && isAdminView && (
        <StaffManagementSheet open={staffOpen} onClose={() => setStaffOpen(false)} />
      )}

      <TeamPickerSheet
        open={teamPickerOpen}
        onClose={() => setTeamPickerOpen(false)}
        teams={(isAdminView ? allTeams : myTeams).map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          category: t.category,
          age_range: t.age_range,
          n_players: (t as any).players?.[0]?.count ?? null,
        }))}
        selectedId={isAdminView ? adminTeamId : (currentTeam?.id ?? null)}
        onSelect={(id) => {
          if (isAdminView) setAdminTeamId(id)
          else setActiveTeamId(id)
        }}
        onCreateNew={isAdminView && canWrite ? () => { setTeamSheetEditing(null); setTeamSheetOpen(true) } : undefined}
      />

      {/* Statistiche presenze */}
      {(isCoachView || isAdminView) && (currentTeam || adminCurrentTeam) && (
        <AttendanceStatsSheet
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          teamId={(isCoachView ? currentTeam!.id : adminCurrentTeam!.id)}
          teamName={(isCoachView ? currentTeam!.name : adminCurrentTeam!.name)}
          teamColor={(isCoachView ? currentTeam!.color : adminCurrentTeam!.color)}
        />
      )}

      {/* Storico allenamenti */}
      {(isCoachView || isAdminView) && (currentTeam || adminCurrentTeam) && (
        <TeamTrainingHistorySheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          teamId={(isCoachView ? currentTeam!.id : adminCurrentTeam!.id)}
          teamName={(isCoachView ? currentTeam!.name : adminCurrentTeam!.name)}
          reloadKey={rosterReloadTick}
          onOpenTraining={(trainingId) => setDetailTrainingId(trainingId)}
        />
      )}

      {/* Dettaglio singolo allenamento (dallo storico) */}
      {detailTrainingId && (currentTeam || adminCurrentTeam) && (
        <TrainingDetailSheet
          open={!!detailTrainingId}
          onClose={() => setDetailTrainingId(null)}
          trainingId={detailTrainingId}
          teamName={(isCoachView ? currentTeam!.name : adminCurrentTeam!.name)}
          teamColor={(isCoachView ? currentTeam!.color : adminCurrentTeam!.color)}
          canEdit={canWrite}
          onEdit={async (tid) => {
            // Carica evento e apri EventEditSheet
            const { data } = await supabase.from('trainings')
              .select('id, team_id, training_date, start_time, end_time, location, focus, program, notes')
              .eq('id', tid).maybeSingle()
            if (data) {
              setDetailTrainingId(null)
              setEditTrainingEvent({ kind: 'training', ...data })
            }
          }}
          onManageAttendance={async (tid) => {
            // Carica training + rosa e apri AttendanceSheet
            const [tRes, pRes] = await Promise.all([
              supabase.from('trainings')
                .select('team_id, training_date, start_time')
                .eq('id', tid).maybeSingle(),
              supabase.from('players')
                .select('id, first_name, last_name, position')
                .eq('team_id', (isCoachView ? currentTeam!.id : adminCurrentTeam!.id))
                .order('last_name'),
            ])
            if (tRes.data) {
              setDetailTrainingId(null)
              setAttendanceState({
                trainingId: tid,
                date: tRes.data.training_date,
                startTime: tRes.data.start_time?.slice(0, 5) || '',
                title: `Allenamento ${(isCoachView ? currentTeam!.name : adminCurrentTeam!.name)}`,
                players: (pRes.data ?? []).map((p: { id: string; first_name: string; last_name: string; position: string | null }) => ({
                  id: p.id, firstName: p.first_name, lastName: p.last_name, position: p.position,
                })),
              })
            }
          }}
        />
      )}

      {/* Modifica evento allenamento */}
      {editTrainingEvent && (
        <EventEditSheet
          open={!!editTrainingEvent}
          onClose={() => setEditTrainingEvent(null)}
          teams={(currentTeam || adminCurrentTeam) ? [{ id: (isCoachView ? currentTeam!.id : adminCurrentTeam!.id), name: (isCoachView ? currentTeam!.name : adminCurrentTeam!.name), color: (isCoachView ? currentTeam!.color : adminCurrentTeam!.color) }] : []}
          existingEvent={editTrainingEvent}
          onSaved={() => { setRosterReloadTick(t => t + 1) }}
          onDeleted={() => { setRosterReloadTick(t => t + 1) }}
        />
      )}

      {/* Gestione presenze */}
      {attendanceState && (
        <AttendanceSheet
          open={!!attendanceState}
          onClose={() => setAttendanceState(null)}
          eventTitle={attendanceState.title}
          eventDate={attendanceState.date}
          eventTime={attendanceState.startTime}
          players={attendanceState.players}
          trainingId={attendanceState.trainingId}
        />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, label, icon, color }: {
  active: boolean; onClick: () => void; label: string; icon: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '9px 12px', borderRadius: 8,
        border: 'none', cursor: 'pointer',
        background: active ? color : 'transparent',
        color: active ? '#fff' : '#404751',
        fontSize: 12.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <Icon name={icon} size={13} color={active ? '#fff' : color} />
      {label}
    </button>
  )
}

// ============================================================
// COACH VIEW: solo rosa della sua squadra dalla tabella players
// ============================================================
function CoachRoster({ team, onSelect, canManage, reloadTick, onEditTeam, onOpenStats, onOpenHistory, canSeePayments }: {
  team: { id: string; name: string; color: string | null; category: string | null };
  onSelect: (p: PlayerDetailData) => void;
  canManage: boolean;
  reloadTick: number;
  onEditTeam?: () => void;
  onOpenStats?: () => void;
  onOpenHistory?: () => void;
  canSeePayments?: boolean;
}) {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<string>('all')
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false)
  const [playerSheetEditing, setPlayerSheetEditing] = useState<PlayerDetailData | null>(null)

  useEffect(() => { load() }, [team.id, reloadTick])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('players')
      .select('id,first_name,last_name,position,birth_date,notes,fiscal_code,jersey_number,medical_expiry,card_number,parent_profile_id,parent_name,parent_phone,parent_email,dominant_foot,secondary_positions,height_cm,weight_kg,shoe_size,sex,avatar_url,registration_paid,balance_paid,parent:profiles!players_parent_profile_id_fkey(full_name,phone,email)')
      .eq('team_id', team.id)
      .order('last_name')
    setPlayers(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return players
      .filter(p => posFilter === 'all' || p.position === posFilter)
      .filter(p => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          p.first_name?.toLowerCase().includes(s) ||
          p.last_name?.toLowerCase().includes(s)
        )
      })
  }, [players, search, posFilter])

  const byRole = useMemo(() => {
    const map: Record<string, number> = { Portiere: 0, Difensore: 0, Centrocampista: 0, Attaccante: 0 }
    for (const p of players) {
      if (p.position && map[p.position] !== undefined) map[p.position]++
    }
    return map
  }, [players])

  return (
    <>
      {/* Barra azioni contestuali sulla squadra selezionata */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        {onOpenStats && (
          <button
            onClick={onOpenStats}
            style={{
              flex: 1, background: '#fff', border: '1px solid #005f98',
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 12, fontWeight: 800, color: '#005f98', fontFamily: 'inherit',
            }}
          >
            <Icon name="bar_chart" size={15} color="#005f98" />
            Presenze
          </button>
        )}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            style={{
              flex: 1, background: '#fff', border: '1px solid #005f98',
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 12, fontWeight: 800, color: '#005f98', fontFamily: 'inherit',
            }}
          >
            <Icon name="history" size={15} color="#005f98" />
            Storico
          </button>
        )}
        {canManage && onEditTeam && (
          <button
            onClick={onEditTeam}
            title="Modifica squadra"
            style={{
              flexShrink: 0, background: '#fff', border: '1px solid #c0c7d2',
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 12, fontWeight: 700, color: '#404751', fontFamily: 'inherit',
            }}
          >
            <Icon name="settings" size={15} color="#404751" />
          </button>
        )}
        {canManage && (
          <button
            onClick={() => { setPlayerSheetEditing(null); setPlayerSheetOpen(true) }}
            style={{
              flex: 1.4, background: 'linear-gradient(135deg, #005f98, #0078bf)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '10px 12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,95,152,0.2)',
            }}
          >
            <Icon name="person_add" size={15} color="#fff" />
            Giocatore
          </button>
        )}
      </div>

      {/* Riepilogo compatto squadra (senza titolo duplicato) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 2px', fontSize: 12,
      }}>
        <span style={{ color: team.color || '#005f98', fontWeight: 800 }}>{team.category}</span>
        <span style={{ color: '#c0c7d2' }}>·</span>
        <span style={{ color: '#404751', fontWeight: 700 }}>{players.length} tesserati</span>
      </div>

      {/* Top 3 marcatori della squadra (aggregato da referti partita) */}
      <TopScorersCard teamId={team.id} />

      {/* Search */}
      <div className="relative">
        <span
          className="msi absolute pointer-events-none"
          style={{
            left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 18, color: '#707882',
          }}
        >
          search
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca nome o cognome…"
          style={{
            width: '100%', border: '1px solid #c0c7d2', borderRadius: 10,
            padding: '10px 14px 10px 40px', fontSize: 13.5,
            fontFamily: 'Lexend', outline: 'none', background: '#fff',
          }}
        />
      </div>

      {/* Position filter */}
      <div className="flex overflow-x-auto hide-scrollbar" style={{ gap: 8, margin: '0 -2px', padding: '0 2px' }}>
        {[
          { key: 'all', label: 'Tutti', count: players.length },
          { key: 'Portiere', label: 'Portieri', count: byRole.Portiere },
          { key: 'Difensore', label: 'Difensori', count: byRole.Difensore },
          { key: 'Centrocampista', label: 'Centrocampisti', count: byRole.Centrocampista },
          { key: 'Attaccante', label: 'Attaccanti', count: byRole.Attaccante },
        ].map(f => {
          const active = posFilter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setPosFilter(f.key)}
              className="flex-shrink-0"
              style={{
                padding: '8px 14px', borderRadius: 999, border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: active ? (team.color || '#005f98') : '#e6e8ee',
                color: active ? '#fff' : '#404751',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#707882' }}>
          Caricamento…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="group_off" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>Nessun giocatore trovato.</p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {filtered.map(p => (
            <PlayerRow
              key={p.id}
              player={p}
              teamCategory={team.category}
              canSeePayments={canSeePayments}
              onClick={() => onSelect({
                id: p.id,
                firstName: p.first_name || '',
                lastName: p.last_name || '',
                birthDate: p.birth_date,
                position: p.position,
                category: team.category,
                previousClub: null,
                parentName: (p.parent as any)?.full_name || p.parent_name || null,
                parentPhone: (p.parent as any)?.phone || p.parent_phone || null,
                parentEmail: (p.parent as any)?.email || p.parent_email || null,
                fiscalCode: p.fiscal_code,
                jerseyNumber: p.jersey_number,
                cardNumber: p.card_number,
                medicalExpiry: p.medical_expiry,
                teamId: team.id,
                avatarUrl: p.avatar_url,
                dominantFoot: p.dominant_foot,
                secondaryPositions: p.secondary_positions,
                heightCm: p.height_cm,
                weightKg: p.weight_kg,
                shoeSize: p.shoe_size,
                sex: p.sex,
                source: 'player',
              })}
            />
          ))}
        </div>
      )}

      {/* Sheet crea/modifica giocatore (admin) */}
      <PlayerEditSheet
        open={playerSheetOpen}
        onClose={() => setPlayerSheetOpen(false)}
        player={playerSheetEditing}
        createInTeamId={playerSheetEditing ? undefined : team.id}
        onSaved={() => load()}
        onDeleted={() => load()}
      />
    </>
  )
}

function PlayerRow({ player, teamCategory, onClick, canSeePayments }: { player: any; teamCategory: string | null; onClick: () => void; canSeePayments?: boolean }) {
  const age = calculateAge(player.birth_date)
  const initials = ((player.first_name?.[0] ?? '') + (player.last_name?.[0] ?? '')).toUpperCase()

  return (
    <div
      onClick={onClick}
      className="flex items-center cursor-pointer"
      style={{
        gap: 12, background: '#fff', border: '1px solid #e0e2e9',
        borderRadius: 12, padding: '10px 12px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078bf'; e.currentTarget.style.background = '#f7f9ff' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e2e9'; e.currentTarget.style.background = '#fff' }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: player.avatar_url ? '#fff' : avatarBg(player.id),
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0, overflow: 'hidden',
        }}
      >
        {player.avatar_url
          ? <img src={player.avatar_url} alt={initials}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#181c20', margin: 0 }}>
            {player.first_name} {player.last_name}
          </h4>
          {player.position && (
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: '#cfe5ff', color: '#004a78',
              }}
            >
              {player.position}
            </span>
          )}
          {(() => {
            const m = medicalStatus(player.medical_expiry)
            return (
              <span
                title={m.tooltip}
                style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                  background: m.bg, color: m.color,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}
              >
                <Icon name={m.icon} size={10} color={m.color} />
                {m.label}
              </span>
            )
          })()}
          {canSeePayments && (() => {
            const p = paymentStatus(player.registration_paid, player.balance_paid)
            return (
              <span
                title={p.tooltip}
                style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                  background: p.bg, color: p.color,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}
              >
                <Icon name={p.icon} size={10} color={p.color} />
                {p.label}
              </span>
            )
          })()}
        </div>
        <p style={{ fontSize: 11.5, color: '#707882', margin: '2px 0 0' }}>
          {age !== null && `${age} anni`}
          {teamCategory && ` • ${teamCategory}`}
        </p>
      </div>
      <Icon name="chevron_right" size={18} color="#c0c7d2" />
    </div>
  )
}

// Calcola stato visita medica per badge visivo
function medicalStatus(expiryDate: string | null | undefined): {
  label: string; color: string; bg: string; icon: string; tooltip: string
} {
  if (!expiryDate) {
    return {
      label: 'No visita', color: '#93000a', bg: '#ffdad6', icon: 'medical_information',
      tooltip: 'Nessuna data di visita medica registrata',
    }
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate); exp.setHours(0, 0, 0, 0)
  const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const dateFmt = `${String(exp.getDate()).padStart(2, '0')}/${String(exp.getMonth() + 1).padStart(2, '0')}/${exp.getFullYear()}`

  if (diffDays < 0) {
    return {
      label: `Scaduta ${dateFmt}`, color: '#93000a', bg: '#ffdad6', icon: 'error',
      tooltip: `Visita medica scaduta da ${Math.abs(diffDays)} giorni`,
    }
  }
  if (diffDays <= 30) {
    return {
      label: `Scade ${dateFmt}`, color: '#8e6300', bg: '#fff2b8', icon: 'warning',
      tooltip: `Visita medica in scadenza tra ${diffDays} giorni`,
    }
  }
  return {
    label: `OK ${dateFmt}`, color: '#2e7d32', bg: 'rgba(67,160,71,0.15)', icon: 'check_circle',
    tooltip: `Visita medica valida fino al ${dateFmt}`,
  }
}

// Calcola stato pagamenti quote per badge visivo
function paymentStatus(regPaid: boolean | null | undefined, balPaid: boolean | null | undefined): {
  label: string; color: string; bg: string; icon: string; tooltip: string
} {
  if (regPaid && balPaid) {
    return {
      label: '€ Saldato',
      color: '#2e7d32', bg: 'rgba(67,160,71,0.15)', icon: 'check_circle',
      tooltip: 'Acconto e saldo entrambi versati',
    }
  }
  if (regPaid && !balPaid) {
    return {
      label: '€ Acconto',
      color: '#8e6300', bg: '#fff2b8', icon: 'schedule',
      tooltip: 'Acconto versato, saldo ancora da versare',
    }
  }
  if (!regPaid && balPaid) {
    return {
      label: '€ Saldo',
      color: '#8e6300', bg: '#fff2b8', icon: 'schedule',
      tooltip: 'Saldo versato ma manca l\'acconto (anomalia)',
    }
  }
  return {
    label: '€ Non versato',
    color: '#93000a', bg: '#ffdad6', icon: 'error',
    tooltip: 'Nessun pagamento registrato',
  }
}

// ============================================================
// ADMIN VIEW: tutti i recruitment_leads (com'era prima)
// ============================================================
function AdminLeadsList({ onSelect }: { onSelect: (p: PlayerDetailData) => void }) {
  const [leads, setLeads] = useState<RecruitmentLead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | LeadStatus>('enrolled')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recruitment_leads')
      .select('*')
      .order('last_name')
      .limit(500)
    setLeads((data ?? []) as RecruitmentLead[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return leads
      .filter(l => filter === 'all' || l.status === filter)
      .filter(l => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          l.first_name?.toLowerCase().includes(s) ||
          l.last_name?.toLowerCase().includes(s) ||
          l.parent_name?.toLowerCase().includes(s) ||
          l.category?.toLowerCase().includes(s)
        )
      })
  }, [leads, filter, search])

  return (
    <>
      <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20', margin: 0 }}>
        Squadre
      </h2>

      {/* Search */}
      <div className="relative">
        <span
          className="msi absolute pointer-events-none"
          style={{
            left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 18, color: '#707882',
          }}
        >
          search
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca nome, cognome, categoria…"
          style={{
            width: '100%', border: '1px solid #c0c7d2', borderRadius: 10,
            padding: '10px 14px 10px 40px', fontSize: 13.5,
            fontFamily: 'Lexend', outline: 'none', background: '#fff',
          }}
        />
      </div>

      {/* Filter chips */}
      <div className="flex overflow-x-auto hide-scrollbar" style={{ gap: 8, margin: '0 -2px', padding: '0 2px' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0"
              style={{
                padding: '8px 14px', borderRadius: 999, border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: active ? '#005f98' : '#e6e8ee',
                color: active ? '#fff' : '#404751',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              {active && filtered.length > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.8 }}>({filtered.length})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#707882' }}>
          Caricamento…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="group_off" size={40} color="#c0c7d2" />
          <p style={{ fontSize: 13, color: '#707882', marginTop: 8 }}>Nessun atleta trovato.</p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {filtered.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              onClick={() => onSelect({
                id: lead.id,
                firstName: lead.first_name || '',
                lastName: lead.last_name || '',
                birthDate: lead.birth_date,
                position: lead.position,
                category: lead.category,
                previousClub: lead.previous_club,
                parentName: lead.parent_name,
                parentPhone: lead.parent_phone,
                parentEmail: lead.parent_email,
                source: 'lead',
              })}
            />
          ))}
        </div>
      )}
    </>
  )
}

function LeadRow({ lead, onClick }: { lead: RecruitmentLead; onClick: () => void }) {
  const age = calculateAge(lead.birth_date)
  const stat = STATUS_STYLE[lead.status]
  const catStat = categoryStyle(lead.category)

  return (
    <div
      onClick={onClick}
      className="flex items-center cursor-pointer"
      style={{
        gap: 12, background: '#fff', border: '1px solid #e0e2e9',
        borderRadius: 12, padding: '10px 12px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078bf'; e.currentTarget.style.background = '#f7f9ff' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e2e9'; e.currentTarget.style.background = '#fff' }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: avatarBg(lead.id),
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}
      >
        {(lead.first_name?.[0] ?? '') + (lead.last_name?.[0] ?? '')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#181c20', margin: 0 }}>
            {lead.first_name} {lead.last_name}
          </h4>
          <span
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: stat.bg, color: stat.color,
            }}
          >
            {STATUS_LABEL[lead.status]}
          </span>
          {lead.category && (
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: catStat.bg, color: catStat.color,
              }}
            >
              {lead.category}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: '#707882', margin: '2px 0 0' }}>
          {age !== null && `${age} anni`}
          {lead.position && ` • ${lead.position}`}
          {lead.parent_phone && ` • ${lead.parent_phone}`}
        </p>
      </div>
      <Icon name="chevron_right" size={18} color="#c0c7d2" />
    </div>
  )
}
