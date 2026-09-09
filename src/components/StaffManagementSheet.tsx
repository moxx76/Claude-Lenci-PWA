import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { sortTeamsByAge } from '../lib/teamOrder'

interface StaffMember {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: string
  is_manager: boolean | null
  is_marketing: boolean | null
  is_director: boolean | null
  is_supervisor: boolean | null
  is_readonly: boolean | null
  teams_coached: string[]
  teams_managed: string[]
  // Ogni squadra dove ha un ruolo, con ruolo esatto (solo ruoli assegnati)
  teams_with_role: Array<{ teamName: string; role: Exclude<TeamRoleAssignment, ''> }>
}

interface Team { id: string; name: string; color: string | null }

interface Props {
  open: boolean
  onClose: () => void
}

type NewRoleType = 'coach' | 'manager' | 'admin_marketing' | 'admin_secretary' | 'admin'

// Ruolo dell'utente su una singola squadra (dropdown a 7 opzioni)
type TeamRoleAssignment = '' | 'head' | 'assistant' | 'helper' | 'team_manager' | 'second_manager' | 'third_manager'

// Etichette IT per il dropdown
const TEAM_ROLE_LABELS: Record<TeamRoleAssignment, string> = {
  '': '— Non assegnato —',
  'head': 'Allenatore',
  'assistant': 'Vice allenatore',
  'helper': 'Aiuto allenatore',
  'team_manager': 'Dirigente accompagnatore',
  'second_manager': '2° Dirigente',
  'third_manager': '3° Dirigente',
}

// Etichette compatte per la lista (accanto al nome squadra)
const TEAM_ROLE_LABELS_SHORT: Record<Exclude<TeamRoleAssignment, ''>, string> = {
  'head': 'All.',
  'assistant': 'Vice',
  'helper': 'Aiuto',
  'team_manager': 'Dirig.',
  'second_manager': '2° Dirig.',
  'third_manager': '3° Dirig.',
}

// Mapping ruolo → colonna DB in teams
const TEAM_ROLE_COLUMN: Record<Exclude<TeamRoleAssignment, ''>, string> = {
  'head': 'head_coach_id',
  'assistant': 'assistant_coach_id',
  'helper': 'helper_coach_id',
  'team_manager': 'team_manager_id',
  'second_manager': 'second_manager_id',
  'third_manager': 'third_manager_id',
}

const TEAM_ROLE_COLUMNS_ALL = Object.values(TEAM_ROLE_COLUMN)

// Calcola il ruolo di un utente su una squadra (priorità: head > assistant > helper > team_manager > 2nd > 3rd)
function detectRoleOnTeam(userId: string, team: any): TeamRoleAssignment {
  if (team?.head_coach_id === userId) return 'head'
  if (team?.assistant_coach_id === userId) return 'assistant'
  if (team?.helper_coach_id === userId) return 'helper'
  if (team?.team_manager_id === userId) return 'team_manager'
  if (team?.second_manager_id === userId) return 'second_manager'
  if (team?.third_manager_id === userId) return 'third_manager'
  return ''
}

const ROLE_OPTIONS: Array<{ key: NewRoleType; label: string; desc: string; icon: string; color: string }> = [
  { key: 'coach', label: 'Allenatore (Mister)', desc: 'Guida una squadra in campo', icon: 'sports', color: '#005f98' },
  { key: 'manager', label: 'Dirigente accompagnatore', desc: 'Gestisce logistica e presenze di una squadra', icon: 'assignment_ind', color: '#7a0071' },
  { key: 'admin_marketing', label: 'Staff Marketing / Comunicazione', desc: 'Gestisce annunci, comunicazioni social', icon: 'campaign', color: '#c1006c' },
  { key: 'admin_secretary', label: 'Staff Segreteria', desc: 'Gestione amministrativa, quote, iscrizioni', icon: 'business_center', color: '#00838f' },
  { key: 'admin', label: 'Amministratore', desc: 'Accesso completo al club', icon: 'admin_panel_settings', color: '#8e6300' },
]

export function StaffManagementSheet({ open, onClose }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form create/edit
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [newRoleType, setNewRoleType] = useState<NewRoleType>('coach')
  const [teamHeadCoachOf, setTeamHeadCoachOf] = useState<string>('')
  const [teamManagerOf, setTeamManagerOf] = useState<string>('')
  // Edit mode: mappa team_id -> TeamRoleAssignment (7 opzioni)
  const [teamAssignments, setTeamAssignments] = useState<Record<string, TeamRoleAssignment>>({})
  // Se il salvataggio comporta sovrascritture di altri utenti, le raccolgo qui
  // per mostrare un banner di conferma prima di procedere
  const [pendingOverwrites, setPendingOverwrites] = useState<Array<{
    teamName: string; roleLabel: string; currentUserName: string
  }> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    load()
    setMode('list')
    setEditingId(null)
    setEmail(''); setFullName(''); setPhone('')
    setNewRoleType('coach'); setTeamHeadCoachOf(''); setTeamManagerOf('')
    setTeamAssignments({})
    setError(null); setSuccess(null)
  }, [open])

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id)
    setEmail(m.email)
    setFullName(m.full_name || '')
    setPhone(m.phone || '')
    // Determino il "tipo" attuale
    if (m.role === 'admin' && (m as any).is_secretary) setNewRoleType('admin_secretary')
    else if (m.role === 'admin' && m.is_marketing) setNewRoleType('admin_marketing')
    else if (m.role === 'admin') setNewRoleType('admin')
    else if (m.role === 'coach' && m.is_manager) setNewRoleType('manager')
    else setNewRoleType('coach')
    // Costruisco mappa assegnazioni squadre — auto-detect ruolo attuale
    // per ognuno dei 6 slot (head/assistant/helper/team_mgr/2nd/3rd)
    const assignments: Record<string, TeamRoleAssignment> = {}
    teams.forEach(t => {
      assignments[t.id] = detectRoleOnTeam(m.id, t)
    })
    setTeamAssignments(assignments)
    setMode('edit')
    setError(null)
    setSuccess(null)
    setPendingOverwrites(null)
  }

  const handleUpdate = async (overwriteConfirmed: boolean = false) => {
    if (!editingId) return
    if (!fullName.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    setError(null)
    if (!overwriteConfirmed) setPendingOverwrites(null)
    try {
      // 1) Update profile
      const profilePayload: any = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }
      switch (newRoleType) {
        case 'coach':
          profilePayload.role = 'coach'
          profilePayload.is_manager = false
          profilePayload.is_marketing = false
          profilePayload.is_secretary = false
          break
        case 'manager':
          profilePayload.role = 'coach'
          profilePayload.is_manager = true
          profilePayload.is_marketing = false
          profilePayload.is_secretary = false
          break
        case 'admin_marketing':
          profilePayload.role = 'admin'
          profilePayload.is_marketing = true
          profilePayload.is_manager = false
          profilePayload.is_secretary = false
          break
        case 'admin_secretary':
          profilePayload.role = 'admin'
          profilePayload.is_secretary = true
          profilePayload.is_marketing = false
          profilePayload.is_manager = false
          break
        case 'admin':
          profilePayload.role = 'admin'
          profilePayload.is_marketing = false
          profilePayload.is_manager = false
          profilePayload.is_secretary = false
          break
      }
      const { error: pErr } = await supabase.from('profiles').update(profilePayload).eq('id', editingId)
      if (pErr) throw pErr

      // 2) Update team assignments: per ogni team, se il ruolo dell'utente su
      //    quel team è cambiato, azzeriamo il vecchio slot e settiamo il nuovo.
      //    Se il nuovo slot è occupato da un ALTRO utente, lo mostriamo in un
      //    banner di conferma per evitare sovrascritture silenziose.

      // Passo A: costruisci il piano di modifiche (per team → diff)
      type PlannedChange = {
        teamId: string
        teamName: string
        oldRole: TeamRoleAssignment
        newRole: TeamRoleAssignment
        newSlotCurrentOccupantId: string | null  // chi è già nel nuovo slot (se diverso da editingId)
        newSlotCurrentOccupantName: string | null
      }
      const plan: PlannedChange[] = []
      for (const teamId of Object.keys(teamAssignments)) {
        const currentTeam = teams.find(t => t.id === teamId) as any
        if (!currentTeam) continue
        const oldRole = detectRoleOnTeam(editingId, currentTeam)
        const newRole = teamAssignments[teamId]
        if (oldRole === newRole) continue  // nulla da fare

        let occupantId: string | null = null
        let occupantName: string | null = null
        if (newRole !== '') {
          const col = TEAM_ROLE_COLUMN[newRole]
          const currentOccupantId = currentTeam[col] as string | null
          if (currentOccupantId && currentOccupantId !== editingId) {
            occupantId = currentOccupantId
            const occupant = staff.find(s => s.id === currentOccupantId)
            occupantName = occupant?.full_name || occupant?.email || 'un altro utente'
          }
        }

        plan.push({
          teamId,
          teamName: currentTeam.name,
          oldRole,
          newRole,
          newSlotCurrentOccupantId: occupantId,
          newSlotCurrentOccupantName: occupantName,
        })
      }

      // Passo B: se ci sono sovrascritture non ancora confermate, chiedi conferma
      const overwrites = plan.filter(p => p.newSlotCurrentOccupantId !== null)
      if (overwrites.length > 0 && !overwriteConfirmed) {
        setPendingOverwrites(overwrites.map(o => ({
          teamName: o.teamName,
          roleLabel: TEAM_ROLE_LABELS[o.newRole],
          currentUserName: o.newSlotCurrentOccupantName!,
        })))
        setSaving(false)
        return  // aspetta conferma dell'utente
      }

      // Passo C: applica gli update — un UPDATE per team, con azzeramento
      // dello slot vecchio e assegnazione del nuovo slot in un colpo
      for (const change of plan) {
        const updates: any = {}
        if (change.oldRole !== '') {
          updates[TEAM_ROLE_COLUMN[change.oldRole]] = null
        }
        if (change.newRole !== '') {
          updates[TEAM_ROLE_COLUMN[change.newRole]] = editingId
        }
        const { data: udata, error: uerr } = await supabase.from('teams').update(updates).eq('id', change.teamId).select('id')
        if (uerr) throw uerr
        if (!udata || udata.length === 0) {
          throw new Error(`Non hai i permessi per modificare le assegnazioni della squadra "${change.teamName}". Solo un amministratore o il tuo mister di squadra può farlo.`)
        }
      }

      setSuccess(`✅ ${fullName} aggiornato`)
      await load()
      setTimeout(() => setMode('list'), 1200)
    } catch (e: any) {
      setError('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    const target = staff.find(s => s.id === editingId)
    if (!target) return
    if (!confirm(`Vuoi eliminare "${target.full_name || target.email}"?\n\nATTENZIONE: rimuoverà anche l'account di accesso e tutte le squadre a lui assegnate perderanno il collegamento. Azione irreversibile.`)) return
    setDeleting(true)
    setError(null)
    try {
      // Rimuovo eventuali assegnamenti team
      await supabase.from('teams').update({ head_coach_id: null }).eq('head_coach_id', editingId)
      await supabase.from('teams').update({ team_manager_id: null }).eq('team_manager_id', editingId)
      // Elimino profile (cascade eliminerà anche auth.user tramite trigger? in genere no)
      const { error: pErr } = await supabase.from('profiles').delete().eq('id', editingId)
      if (pErr) throw pErr
      // Nota: l'utente auth resta orfano — accettabile per un club (non pochi utenti). L'admin può cancellarlo manualmente via dashboard Supabase se serve
      setSuccess('✅ Membro rimosso')
      await load()
      setTimeout(() => setMode('list'), 1200)
    } catch (e: any) {
      setError('Errore eliminazione: ' + (e.message || 'sconosciuto'))
    } finally {
      setDeleting(false)
    }
  }

  const load = async () => {
    setLoading(true)
    const [{ data: profs }, { data: tms }] = await Promise.all([
      supabase.from('profiles')
        .select('id, full_name, email, phone, role, is_manager, is_marketing, is_director, is_supervisor, is_readonly, is_secretary')
        .in('role', ['coach', 'admin'])
        .order('full_name'),
      supabase.from('teams').select('id, name, category, age_range, color, head_coach_id, assistant_coach_id, helper_coach_id, team_manager_id, second_manager_id, third_manager_id'),
    ])
    const teamsList = sortTeamsByAge((tms ?? []) as any[])
    const enriched: StaffMember[] = (profs ?? []).map((p: any) => {
      const teams_with_role: Array<{ teamName: string; role: Exclude<TeamRoleAssignment, ''> }> = []
      for (const t of teamsList) {
        const role = detectRoleOnTeam(p.id, t)
        if (role !== '') teams_with_role.push({ teamName: t.name, role })
      }
      // teams_coached = squadre dove è coach (head/vice/aiuto)
      // teams_managed = squadre dove è dirigente (mgr/2°/3°)
      const coachRoles: Array<Exclude<TeamRoleAssignment, ''>> = ['head', 'assistant', 'helper']
      const managerRoles: Array<Exclude<TeamRoleAssignment, ''>> = ['team_manager', 'second_manager', 'third_manager']
      return {
        ...p,
        teams_coached: teams_with_role.filter(x => coachRoles.includes(x.role)).map(x => x.teamName),
        teams_managed: teams_with_role.filter(x => managerRoles.includes(x.role)).map(x => x.teamName),
        teams_with_role,
      }
    })
    setStaff(enriched)
    // Salvo l'intero teamsList con head_coach_id/team_manager_id per l'edit
    setTeams(teamsList as any)
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!email.trim() || !fullName.trim()) {
      setError('Email e nome completo sono obbligatori'); return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email non valida'); return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: any = {
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }
      switch (newRoleType) {
        case 'coach':
          payload.role = 'coach'
          if (teamHeadCoachOf) payload.team_head_coach_of = teamHeadCoachOf
          break
        case 'manager':
          payload.role = 'coach'
          payload.is_manager = true
          if (teamManagerOf) payload.team_manager_of = teamManagerOf
          break
        case 'admin_marketing':
          payload.role = 'admin'
          payload.is_marketing = true
          break
        case 'admin_secretary':
          payload.role = 'admin'
          payload.is_secretary = true
          break
        case 'admin':
          payload.role = 'admin'
          break
      }
      // Uso fetch diretto per avere accesso al body-errore vero
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessione scaduta, effettua di nuovo il login')

      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
        || 'https://nlgknkopottaxewpdofl.supabase.co'
      const anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${supabaseUrl}/functions/v1/create-staff-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey ? { 'apikey': anonKey } : {}),
        },
        body: JSON.stringify(payload),
      })
      const raw = await res.text()
      let body: any = null
      try { body = raw ? JSON.parse(raw) : {} } catch {
        throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300) || '(body vuoto)'}`)
      }
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
      if (body?.error) throw new Error(body.error)

      setSuccess(`✅ ${fullName} creato. Password iniziale: Lenci2026!`)
      setEmail(''); setFullName(''); setPhone('')
      setTeamHeadCoachOf(''); setTeamManagerOf('')
      await load()
      setTimeout(() => setMode('list'), 1500)
    } catch (e: any) {
      setError(e.message || 'Errore nella creazione')
    } finally {
      setSaving(false)
    }
  }

  const roleLabel = (m: StaffMember): string => {
    if (m.is_supervisor) return 'Supervisor'
    if (m.is_readonly) return 'Direttore Tecnico (sola lettura)'
    if (m.is_director) return 'Direttivo'
    if ((m as any).is_secretary && m.role === 'admin') return 'Staff Segreteria'
    if (m.is_marketing && m.role === 'admin') return 'Staff Marketing'
    if (m.role === 'admin') return 'Amministratore'
    if (m.role === 'coach' && m.is_manager) return 'Dirigente'
    if (m.role === 'coach') return 'Allenatore'
    return m.role
  }

  const roleColor = (m: StaffMember): string => {
    if (m.is_supervisor) return '#7a0071'
    if (m.is_readonly) return '#404751'
    if (m.is_director) return '#8e6300'
    if ((m as any).is_secretary) return '#00838f'
    if (m.is_marketing) return '#c1006c'
    if (m.role === 'admin') return '#8e6300'
    if (m.is_manager) return '#7a0071'
    return '#005f98'
  }

  return (
    <BottomSheet open={open} onClose={onClose}
      title={mode === 'create' ? 'Nuovo membro staff' : mode === 'edit' ? 'Modifica membro staff' : 'Gestione staff'}>
      <div style={{ padding: '4px 20px 24px' }}>
        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a', borderRadius: 10,
            padding: '10px 12px', marginBottom: 14, fontSize: 12.5,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Icon name="error" size={16} color="#93000a" />{error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#d4edda', color: '#155724', borderRadius: 10,
            padding: '10px 12px', marginBottom: 14, fontSize: 12.5,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Icon name="check_circle" size={16} color="#155724" />{success}
          </div>
        )}

        {mode === 'list' && (
          <>
            <button
              onClick={() => setMode('create')}
              style={{
                width: '100%', marginBottom: 16,
                background: 'linear-gradient(135deg, #005f98, #0078bf)', color: '#fff',
                border: 'none', borderRadius: 12, padding: '12px 16px',
                fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              }}
            >
              <Icon name="person_add" size={16} color="#fff" />
              Aggiungi nuovo membro staff
            </button>

            <p style={{ fontSize: 11, color: '#707882', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '0.05em' }}>
              Staff attuale ({staff.length})
            </p>

            {loading && <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 13 }}>Carico…</div>}

            {!loading && staff.map(m => (
              <button key={m.id}
                onClick={() => openEdit(m)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: '#fff', border: '1px solid #d5dae2',
                  borderRadius: 12, padding: 12, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontFamily: 'inherit',
                }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: roleColor(m), color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>
                  {(m.full_name || m.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#181c20' }}>
                    {m.full_name || m.email}
                  </div>
                  <div style={{ fontSize: 10.5, color: roleColor(m), fontWeight: 700, marginTop: 2 }}>
                    {roleLabel(m)}
                  </div>
                  {m.teams_with_role.length > 0 && (
                    <div style={{ fontSize: 10, color: '#707882', marginTop: 3 }}>
                      {m.teams_with_role.map(x =>
                        x.role === 'head' || x.role === 'team_manager'
                          ? x.teamName
                          : `${x.teamName} (${TEAM_ROLE_LABELS_SHORT[x.role]})`
                      ).join(' · ')}
                    </div>
                  )}
                </div>
                <Icon name="chevron_right" size={16} color="#707882" />
              </button>
            ))}
          </>
        )}

        {mode === 'create' && (
          <>
            <button onClick={() => { setMode('list'); setError(null); setSuccess(null) }}
              style={{
                background: 'transparent', border: 'none', color: '#005f98',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12,
              }}>
              <Icon name="arrow_back" size={14} color="#005f98" />
              Torna all'elenco
            </button>

            <Field label="Tipo di ruolo *">
              <div style={{ display: 'grid', gap: 6 }}>
                {ROLE_OPTIONS.map(opt => {
                  const active = newRoleType === opt.key
                  return (
                    <button key={opt.key} onClick={() => setNewRoleType(opt.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 11, borderRadius: 10, cursor: 'pointer',
                        border: active ? `2px solid ${opt.color}` : '1px solid #d5dae2',
                        background: active ? opt.color + '15' : '#fff',
                        fontFamily: 'inherit', textAlign: 'left',
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: opt.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon name={opt.icon} size={16} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? opt.color : '#181c20' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#707882' }}>{opt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Nome e cognome *">
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Mario Rossi" style={inputStyle} />
            </Field>

            <Field label="Email *">
              <input type="email" value={email} onChange={e => setEmail(e.target.value.toLowerCase())}
                placeholder="mario.rossi@example.com" style={inputStyle} />
            </Field>

            <Field label="Telefono">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+39 333 1234567" style={inputStyle} />
            </Field>

            {newRoleType === 'coach' && (
              <Field label="Assegna come allenatore di (opzionale)">
                <select value={teamHeadCoachOf} onChange={e => setTeamHeadCoachOf(e.target.value)} style={inputStyle}>
                  <option value="">— Nessuna squadra —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            )}

            {newRoleType === 'manager' && (
              <Field label="Assegna come dirigente di (opzionale)">
                <select value={teamManagerOf} onChange={e => setTeamManagerOf(e.target.value)} style={inputStyle}>
                  <option value="">— Nessuna squadra —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            )}

            <div style={{
              background: '#eef4fb', padding: '10px 12px', borderRadius: 10, marginTop: 12,
              fontSize: 11, color: '#404751', lineHeight: 1.4,
            }}>
              💡 <strong>Password iniziale</strong>: <code>Lenci2026!</code>. Comunicagliela al primo accesso; potrà cambiarla in seguito.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setMode('list')} disabled={saving}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 12,
                  border: '1px solid #c0c7d2', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
                }}>Annulla</button>
              <button onClick={handleCreate} disabled={saving}
                style={{
                  flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
                  background: '#005f98', color: '#fff',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: saving ? 0.6 : 1,
                }}>
                <Icon name="person_add" size={15} color="#fff" />
                {saving ? 'Creo…' : 'Crea utente'}
              </button>
            </div>
          </>
        )}

        {mode === 'edit' && editingId && (
          <>
            <button onClick={() => { setMode('list'); setError(null); setSuccess(null) }} disabled={saving || deleting}
              style={{
                background: 'transparent', border: 'none', color: '#005f98',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12,
              }}>
              <Icon name="arrow_back" size={14} color="#005f98" />
              Torna all'elenco
            </button>

            <Field label="Tipo di ruolo *">
              <div style={{ display: 'grid', gap: 6 }}>
                {ROLE_OPTIONS.map(opt => {
                  const active = newRoleType === opt.key
                  return (
                    <button key={opt.key} onClick={() => setNewRoleType(opt.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 11, borderRadius: 10, cursor: 'pointer',
                        border: active ? `2px solid ${opt.color}` : '1px solid #d5dae2',
                        background: active ? opt.color + '15' : '#fff',
                        fontFamily: 'inherit', textAlign: 'left',
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: opt.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon name={opt.icon} size={16} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? opt.color : '#181c20' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#707882' }}>{opt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Nome e cognome *">
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Email">
              <input value={email} disabled style={{ ...inputStyle, background: '#f1f3fa', color: '#707882' }} />
              <div style={{ fontSize: 10, color: '#707882', marginTop: 4 }}>
                L'email non è modificabile. Se serve cambiarla, elimina l'utente e ricrealo.
              </div>
            </Field>

            <Field label="Telefono">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+39 333 1234567" style={inputStyle} />
            </Field>

            {/* Assegnazione squadre (per ogni team un radio) */}
            {teams.length > 0 && (
              <Field label="Assegnazioni squadre">
                <div style={{ display: 'grid', gap: 6 }}>
                  {teams.map(t => {
                    const val = teamAssignments[t.id] || ''
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: '#f7f9ff', padding: '8px 10px', borderRadius: 10,
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: (t as any).color || '#005f98', flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#181c20' }}>
                          {t.name}
                        </div>
                        <select value={val}
                          onChange={e => setTeamAssignments(prev => ({ ...prev, [t.id]: e.target.value as TeamRoleAssignment }))}
                          style={{
                            fontSize: 11, padding: '4px 8px', borderRadius: 6,
                            border: '1px solid #c0c7d2', background: '#fff',
                            fontFamily: 'inherit',
                          }}>
                          {(Object.keys(TEAM_ROLE_LABELS) as TeamRoleAssignment[]).map(r => (
                            <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </Field>
            )}

            {pendingOverwrites && pendingOverwrites.length > 0 && (
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 10,
                background: '#fff8e1', border: '1px solid #ffd54f',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#b26a00', marginTop: 1 }}>warning</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#7a4c00', marginBottom: 4 }}>
                      Attenzione: sostituirai altri utenti
                    </div>
                    <div style={{ fontSize: 12.5, color: '#7a4c00', lineHeight: 1.5 }}>
                      Confermando, <strong>{fullName || 'questa persona'}</strong> prenderà il posto di:
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                        {pendingOverwrites.map((o, i) => (
                          <li key={i}>
                            <strong>{o.currentUserName}</strong> come <em>{o.roleLabel}</em> di <strong>{o.teamName}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setPendingOverwrites(null)} type="button"
                    style={{
                      padding: '8px 14px', borderRadius: 8,
                      border: '1px solid #c0c7d2', background: '#fff',
                      fontSize: 12, fontWeight: 700, color: '#404751', cursor: 'pointer',
                    }}>Annulla</button>
                  <button onClick={() => handleUpdate(true)} type="button" disabled={saving}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: 'none',
                      background: '#b26a00', color: '#fff',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}>Sì, sostituisci</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setMode('list')} disabled={saving || deleting}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 12,
                  border: '1px solid #c0c7d2', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
                }}>Annulla</button>
              <button onClick={() => handleUpdate(false)} disabled={saving || deleting}
                style={{
                  flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
                  background: '#005f98', color: '#fff',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: (saving || deleting) ? 0.6 : 1,
                }}>
                <Icon name="save" size={15} color="#fff" />
                {saving ? 'Salvo…' : 'Salva modifiche'}
              </button>
            </div>

            <button onClick={handleDelete} disabled={saving || deleting}
              style={{
                marginTop: 12, width: '100%', padding: '12px 18px', borderRadius: 12,
                border: '1.5px solid #ba1a1a', background: '#fff', color: '#ba1a1a',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: (saving || deleting) ? 0.6 : 1,
              }}>
              <Icon name="delete" size={15} color="#ba1a1a" />
              {deleting ? 'Elimino…' : 'Elimina membro staff'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10,
  border: '1px solid #c0c7d2', fontSize: 13.5, color: '#181c20',
  fontFamily: 'inherit', background: '#fff', outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: '#707882',
        textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
