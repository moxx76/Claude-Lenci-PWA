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
}

interface Team { id: string; name: string; color: string | null }

interface Props {
  open: boolean
  onClose: () => void
}

type NewRoleType = 'coach' | 'manager' | 'admin_marketing' | 'admin_secretary' | 'admin'

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
  // Edit mode: mappa team_id -> 'coach' | 'manager' | ''
  const [teamAssignments, setTeamAssignments] = useState<Record<string, '' | 'coach' | 'manager'>>({})
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
    // Costruisco mappa assegnazioni squadre
    const assignments: Record<string, '' | 'coach' | 'manager'> = {}
    teams.forEach(t => {
      if (m.teams_coached.includes(t.name)) assignments[t.id] = 'coach'
      else if (m.teams_managed.includes(t.name)) assignments[t.id] = 'manager'
      else assignments[t.id] = ''
    })
    setTeamAssignments(assignments)
    setMode('edit')
    setError(null)
    setSuccess(null)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    if (!fullName.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    setError(null)
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

      // 2) Update team assignments (per ogni team, applica quello che serve)
      for (const teamId of Object.keys(teamAssignments)) {
        const assignment = teamAssignments[teamId]
        // Prendo la squadra corrente per capire cosa cambiare
        const currentTeam = teams.find(t => t.id === teamId) as any
        const isAlreadyHeadCoach = currentTeam?.head_coach_id === editingId
        const isAlreadyManager = currentTeam?.team_manager_id === editingId

        const updates: any = {}
        // Se ora è coach e non lo era → assegna
        if (assignment === 'coach' && !isAlreadyHeadCoach) updates.head_coach_id = editingId
        // Se ora è manager e non lo era → assegna
        if (assignment === 'manager' && !isAlreadyManager) updates.team_manager_id = editingId
        // Se ora è vuoto/altro ma era head_coach → rimuovi
        if (assignment !== 'coach' && isAlreadyHeadCoach) updates.head_coach_id = null
        // Se ora è vuoto/altro ma era manager → rimuovi
        if (assignment !== 'manager' && isAlreadyManager) updates.team_manager_id = null

        if (Object.keys(updates).length > 0) {
          const { data: udata, error: uerr } = await supabase.from('teams').update(updates).eq('id', teamId).select('id')
          if (uerr) throw uerr
          if (!udata || udata.length === 0) {
            throw new Error('Non hai i permessi per modificare l\'assegnazione della squadra. Solo un amministratore o il tuo mister di squadra può farlo.')
          }
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
      supabase.from('teams').select('id, name, category, age_range, color, head_coach_id, team_manager_id'),
    ])
    const teamsList = sortTeamsByAge((tms ?? []) as any[])
    const enriched: StaffMember[] = (profs ?? []).map((p: any) => ({
      ...p,
      teams_coached: teamsList.filter(t => t.head_coach_id === p.id).map(t => t.name),
      teams_managed: teamsList.filter(t => t.team_manager_id === p.id).map(t => t.name),
    }))
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
                  {(m.teams_coached.length > 0 || m.teams_managed.length > 0) && (
                    <div style={{ fontSize: 10, color: '#707882', marginTop: 3 }}>
                      {[...m.teams_coached, ...m.teams_managed].join(' · ')}
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
                          onChange={e => setTeamAssignments(prev => ({ ...prev, [t.id]: e.target.value as any }))}
                          style={{
                            fontSize: 11, padding: '4px 8px', borderRadius: 6,
                            border: '1px solid #c0c7d2', background: '#fff',
                            fontFamily: 'inherit',
                          }}>
                          <option value="">— Non assegnato —</option>
                          <option value="coach">Allenatore</option>
                          <option value="manager">Dirigente</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              </Field>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setMode('list')} disabled={saving || deleting}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: 12,
                  border: '1px solid #c0c7d2', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
                }}>Annulla</button>
              <button onClick={handleUpdate} disabled={saving || deleting}
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
