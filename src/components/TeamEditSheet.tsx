import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { DURATION_PRESETS } from '../lib/matchDuration'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'

interface Profile { id: string; full_name: string | null; email: string }

interface ExistingTeam {
  id: string
  name: string
  category?: string | null
  age_range?: string | null
  color?: string | null
  head_coach_id?: string | null
  team_manager_id?: string | null
  assistant_coach_id?: string | null
  helper_coach_id?: string | null
  linesman_id?: string | null
  second_manager_id?: string | null
  third_manager_id?: string | null
  masseur_id?: string | null
  default_shirt_color?: string | null
  default_gk_shirt_color?: string | null
  home_shirt_color?: string | null
  home_gk_shirt_color?: string | null
  away_shirt_color?: string | null
  away_gk_shirt_color?: string | null
  public_presence_enabled?: boolean | null
  match_periods_count?: number | null
  match_period_duration_min?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  clubId: string
  existingTeam?: ExistingTeam | null
  canDelete?: boolean
  onSaved?: () => void
  onDeleted?: () => void
}

const PRESET_COLORS = ['#005f98', '#c1006c', '#00a86b', '#ff6b00', '#7a0071', '#8e6300', '#404751', '#e64a19']

export function TeamEditSheet({ open, onClose, clubId, existingTeam, canDelete = true, onSaved, onDeleted }: Props) {
  const { profile } = useAuth()
  const userIsAdmin = isAdmin(profile?.role)
  const currentUserId = profile?.id
  const isEdit = !!existingTeam
  const [name, setName] = useState('')
  const [category, setCategory] = useState('U-13')
  const [ageRange, setAgeRange] = useState('2014')
  const [color, setColor] = useState('#005f98')
  const [homeShirt, setHomeShirt] = useState('Rosso/Blu')
  const [homeGkShirt, setHomeGkShirt] = useState('Viola')
  const [awayShirt, setAwayShirt] = useState('Bianco/Blu')
  const [awayGkShirt, setAwayGkShirt] = useState('Giallo')
  const [headCoachId, setHeadCoachId] = useState<string>('')
  const [teamManagerId, setTeamManagerId] = useState<string>('')
  const [assistantCoachId, setAssistantCoachId] = useState<string>('')
  const [helperCoachId, setHelperCoachId] = useState<string>('')
  const [linesmanId, setLinesmanId] = useState<string>('')
  const [secondManagerId, setSecondManagerId] = useState<string>('')
  const [thirdManagerId, setThirdManagerId] = useState<string>('')
  const [masseurId, setMasseurId] = useState<string>('')
  const [publicPresence, setPublicPresence] = useState(false)
  // Durata partita: 2×45 default (retrocompatibile con vecchio hardcoded)
  const [periodsCount, setPeriodsCount] = useState<number>(2)
  const [periodDuration, setPeriodDuration] = useState<number>(45)
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carico tutti i profili che possono ricoprire ruoli staff (admin, coach, director)
  // Non solo coach: massaggiatore o secondo dirigente potrebbero avere role diversi
  useEffect(() => {
    if (!open) return
    supabase.from('profiles')
      .select('id, full_name, email')
      .or('role.eq.coach,role.eq.admin,is_director.eq.true')
      .order('full_name')
      .then(({ data }) => setCoaches(data ?? []))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (existingTeam) {
      setName(existingTeam.name || '')
      setCategory(existingTeam.category || 'U-13')
      setAgeRange(existingTeam.age_range || '')
      setColor(existingTeam.color || '#005f98')
      setHomeShirt(existingTeam.home_shirt_color || existingTeam.default_shirt_color || 'Rosso/Blu')
      setHomeGkShirt(existingTeam.home_gk_shirt_color || existingTeam.default_gk_shirt_color || 'Viola')
      setAwayShirt(existingTeam.away_shirt_color || 'Bianco/Blu')
      setAwayGkShirt(existingTeam.away_gk_shirt_color || 'Giallo')
      setHeadCoachId(existingTeam.head_coach_id || '')
      setTeamManagerId(existingTeam.team_manager_id || '')
      setAssistantCoachId(existingTeam.assistant_coach_id || '')
      setHelperCoachId(existingTeam.helper_coach_id || '')
      setLinesmanId(existingTeam.linesman_id || '')
      setSecondManagerId(existingTeam.second_manager_id || '')
      setThirdManagerId(existingTeam.third_manager_id || '')
      setMasseurId(existingTeam.masseur_id || '')
      setPublicPresence(!!existingTeam.public_presence_enabled)
      setPeriodsCount(existingTeam.match_periods_count ?? 2)
      setPeriodDuration(existingTeam.match_period_duration_min ?? 45)
    } else {
      setName('')
      setCategory('U-13')
      setAgeRange(String(new Date().getFullYear() - 12))
      setColor('#005f98')
      setHomeShirt('Rosso/Blu')
      setHomeGkShirt('Viola')
      setAwayShirt('Bianco/Blu')
      setAwayGkShirt('Giallo')
      setHeadCoachId('')
      setTeamManagerId('')
      setAssistantCoachId('')
      setHelperCoachId('')
      setLinesmanId('')
      setSecondManagerId('')
      setThirdManagerId('')
      setMasseurId('')
      setPublicPresence(false)
      setPeriodsCount(2)
      setPeriodDuration(45)
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingTeam?.id])

  // Se in edit mode e i campi divise/publicPresence/staff mancano dall'oggetto passato
  // in prop (perché venuti da hook che non li selezionano), li carico dal DB per completezza
  useEffect(() => {
    if (!open || !existingTeam?.id) return
    if (existingTeam.home_shirt_color != null && existingTeam.assistant_coach_id !== undefined) return
    supabase.from('teams')
      .select('home_shirt_color, home_gk_shirt_color, away_shirt_color, away_gk_shirt_color, default_shirt_color, default_gk_shirt_color, public_presence_enabled, match_periods_count, match_period_duration_min, head_coach_id, team_manager_id, assistant_coach_id, helper_coach_id, linesman_id, second_manager_id, third_manager_id, masseur_id')
      .eq('id', existingTeam.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setHomeShirt(data.home_shirt_color || data.default_shirt_color || 'Rosso/Blu')
        setHomeGkShirt(data.home_gk_shirt_color || data.default_gk_shirt_color || 'Viola')
        setAwayShirt(data.away_shirt_color || 'Bianco/Blu')
        setAwayGkShirt(data.away_gk_shirt_color || 'Giallo')
        setPublicPresence(!!data.public_presence_enabled)
        if ((data as any).match_periods_count != null) setPeriodsCount((data as any).match_periods_count)
        if ((data as any).match_period_duration_min != null) setPeriodDuration((data as any).match_period_duration_min)
        if (data.head_coach_id) setHeadCoachId(data.head_coach_id)
        if (data.team_manager_id) setTeamManagerId(data.team_manager_id)
        if (data.assistant_coach_id) setAssistantCoachId(data.assistant_coach_id)
        if (data.helper_coach_id) setHelperCoachId(data.helper_coach_id)
        if (data.linesman_id) setLinesmanId(data.linesman_id)
        if (data.second_manager_id) setSecondManagerId(data.second_manager_id)
        if (data.third_manager_id) setThirdManagerId(data.third_manager_id)
        if (data.masseur_id) setMasseurId(data.masseur_id)
      })
  }, [open, existingTeam?.id])

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome della squadra è obbligatorio'); return }
    // BUG 1 FIX: guard frontend contro l'autoesclusione dai propri ruoli.
    // Se un non-admin era assegnato a uno dei 6 ruoli sulla squadra e la modifica
    // lo rimuoverebbe da TUTTI, blocco il save senza fare la round-trip al backend
    // (dove comunque c'è il trigger prevent_self_removal_from_team come rete di sicurezza).
    if (!userIsAdmin && currentUserId && isEdit && existingTeam) {
      const wasAssigned = (
        existingTeam.head_coach_id === currentUserId
        || existingTeam.assistant_coach_id === currentUserId
        || existingTeam.helper_coach_id === currentUserId
        || existingTeam.team_manager_id === currentUserId
        || existingTeam.second_manager_id === currentUserId
        || existingTeam.third_manager_id === currentUserId
      )
      const willStayAssigned = (
        headCoachId === currentUserId
        || assistantCoachId === currentUserId
        || helperCoachId === currentUserId
        || teamManagerId === currentUserId
        || secondManagerId === currentUserId
        || thirdManagerId === currentUserId
      )
      if (wasAssigned && !willStayAssigned) {
        setError('Non puoi rimuovere la tua assegnazione alla squadra. Contatta un amministratore.')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        club_id: clubId,
        name: name.trim(),
        category: category || null,
        age_range: ageRange || null,
        color: color || null,
        // Divise casa/trasferta (nuove colonne v1.9.2+)
        home_shirt_color: homeShirt || null,
        home_gk_shirt_color: homeGkShirt || null,
        away_shirt_color: awayShirt || null,
        away_gk_shirt_color: awayGkShirt || null,
        // Retro-compat: mantengo default_* allineati alla divisa casa
        default_shirt_color: homeShirt || null,
        default_gk_shirt_color: homeGkShirt || null,
        head_coach_id: headCoachId || null,
        team_manager_id: teamManagerId || null,
        assistant_coach_id: assistantCoachId || null,
        helper_coach_id: helperCoachId || null,
        linesman_id: linesmanId || null,
        second_manager_id: secondManagerId || null,
        third_manager_id: thirdManagerId || null,
        masseur_id: masseurId || null,
        public_presence_enabled: publicPresence,
        match_periods_count: periodsCount,
        match_period_duration_min: periodDuration,
      }
      if (isEdit) {
        const { data, error: err } = await supabase.from('teams').update(payload).eq('id', existingTeam!.id).select('id')
        if (err) throw err
        // Silent-fail RLS: se non ho i permessi, l'UPDATE ritorna 0 righe senza errore
        if (!data || data.length === 0) {
          throw new Error('Non hai i permessi per modificare questa squadra. Se sei un mister assegnato a un\'altra categoria, non puoi editare questa. Contatta un amministratore.')
        }
      } else {
        const { error: err } = await supabase.from('teams').insert(payload)
        if (err) throw err
      }
      onSaved?.()
      onClose()
    } catch (e: any) {
      // La RLS "dirigente/staff aggiorna propria squadra" blocca con codice 42501
      // se un non-admin cerca di rimuoversi da tutti i 6 ruoli della squadra.
      // Trasformo il messaggio tecnico in un testo comprensibile.
      const msg = String(e?.message || e?.error_description || '')
      const code = String(e?.code || '')
      if (code === '42501' || /row-level security/i.test(msg)) {
        setError('Non puoi rimuovere la tua assegnazione alla squadra. La modifica deve essere effettuata da un amministratore o da un altro utente autorizzato.')
      } else {
        setError('Errore salvataggio: ' + (e.message || 'sconosciuto'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingTeam) return
    if (!confirm(`Vuoi eliminare la squadra "${existingTeam.name}"?\n\nATTENZIONE: verranno rimossi anche giocatori, allenamenti, partite e tutto ciò che è collegato. Irreversibile.`)) return
    setDeleting(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('teams').delete().eq('id', existingTeam.id)
      if (err) throw err
      onDeleted?.()
      onClose()
    } catch (e: any) {
      setError('Errore eliminazione: ' + (e.message || 'sconosciuto'))
    } finally {
      setDeleting(false)
    }
  }

  const coachName = (p: Profile) => p.full_name || p.email

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Modifica squadra' : 'Nuova squadra'}>
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

        <Field label="Nome squadra *">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Under 13" style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Categoria">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {['Piccoli Amici', 'Primi Calci', 'Pulcini', 'Esordienti', 'U-13', 'U-14', 'U-15', 'U-16', 'U-17', 'U-18', 'U-19', 'Juniores', 'Prima Squadra'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Annata">
            <input value={ageRange} onChange={e => setAgeRange(e.target.value)}
              placeholder="2014" style={inputStyle} />
          </Field>
        </div>

        <Field label="Colore identificativo squadra">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{
                  width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                  background: c, border: color === c ? '3px solid #181c20' : '1px solid #d5dae2',
                }} />
            ))}
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
          </div>
        </Field>

        {/* Divise gioco */}
        <div style={{
          background: '#f7f9ff', borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 6,
          border: '1px solid #d5e5ff',
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#004a78',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="checkroom" size={13} color="#004a78" />
            Divise di gioco
          </div>

          {/* Casa */}
          <div style={{
            background: '#fff', border: '1px solid #d5e5ff', borderRadius: 10,
            padding: 10, marginBottom: 8,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              fontSize: 11, fontWeight: 800, color: '#005f98',
            }}>
              <Icon name="home" size={13} color="#005f98" />
              CASA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Maglia giocatori">
                <input value={homeShirt} onChange={e => setHomeShirt(e.target.value)}
                  placeholder="Rosso/Blu" style={inputStyle} />
              </Field>
              <Field label="Maglia portiere">
                <input value={homeGkShirt} onChange={e => setHomeGkShirt(e.target.value)}
                  placeholder="Viola" style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Trasferta */}
          <div style={{
            background: '#fff', border: '1px solid #ffdae7', borderRadius: 10,
            padding: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              fontSize: 11, fontWeight: 800, color: '#c1006c',
            }}>
              <Icon name="flight_takeoff" size={13} color="#c1006c" />
              TRASFERTA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Maglia giocatori">
                <input value={awayShirt} onChange={e => setAwayShirt(e.target.value)}
                  placeholder="Bianco/Blu" style={inputStyle} />
              </Field>
              <Field label="Maglia portiere">
                <input value={awayGkShirt} onChange={e => setAwayGkShirt(e.target.value)}
                  placeholder="Giallo" style={inputStyle} />
              </Field>
            </div>
          </div>

          <div style={{
            fontSize: 10.5, color: '#707882', marginTop: 8, fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            Le divise vengono precompilate automaticamente nel form convocazione in base al fatto che la partita sia in casa o in trasferta.
          </div>
        </div>

        {/* ==== STAFF TECNICO ==== */}
        <div style={{
          background: '#eef7ff', border: '1px solid #a0c4e6',
          borderRadius: 12, padding: 14, marginTop: 8,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#004a78',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="sports" size={13} color="#004a78" />
            Staff tecnico
          </div>

          <Field label="Allenatore">
            <select value={headCoachId} onChange={e => setHeadCoachId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Allenatore in seconda">
            <select value={assistantCoachId} onChange={e => setAssistantCoachId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Aiuto allenatore">
            <select value={helperCoachId} onChange={e => setHelperCoachId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>
        </div>

        {/* ==== STAFF DIRIGENZIALE ==== */}
        <div style={{
          background: '#faedf7', border: '1px solid #e6a3dd',
          borderRadius: 12, padding: 14, marginTop: 4,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#5c0057',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="group" size={13} color="#5c0057" />
            Staff dirigenziale e sanitario
          </div>

          <Field label="Dirigente accompagnatore">
            <select value={teamManagerId} onChange={e => setTeamManagerId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Secondo dirigente accompagnatore">
            <select value={secondManagerId} onChange={e => setSecondManagerId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Terzo dirigente accompagnatore">
            <select value={thirdManagerId} onChange={e => setThirdManagerId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Guardalinee di casa">
            <select value={linesmanId} onChange={e => setLinesmanId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <Field label="Massaggiatore / sanitario">
            <select value={masseurId} onChange={e => setMasseurId(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{coachName(c)}</option>)}
            </select>
          </Field>

          <div style={{
            fontSize: 10.5, color: '#5c0057', marginTop: 6, fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            Tutti i ruoli compilati compariranno automaticamente nella sezione staff della distinta FIGC generata prima della partita.
          </div>
        </div>

        {/* Durata partita — configura tempi e minuti per l'annata */}
        <div style={{
          padding: '12px 14px', background: '#f8fbff', borderRadius: 10,
          border: '1px solid #cfe3f5', marginTop: 6,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005f98' }}>timer</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                Durata partita
              </div>
              <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>
                Scegli un preset in base alla categoria FIGC, o imposta valori personalizzati. Usato dalla timeline eventi per calcolare i tempi.
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#404751', display: 'block', marginBottom: 4 }}>
              Preset FIGC
            </label>
            <select
              value={(() => {
                const match = DURATION_PRESETS.find(p => p.periodsCount === periodsCount && p.periodDurationMin === periodDuration)
                return match ? `${match.periodsCount}x${match.periodDurationMin}` : 'custom'
              })()}
              onChange={(e) => {
                if (e.target.value === 'custom') return
                const [p, d] = e.target.value.split('x').map(Number)
                setPeriodsCount(p); setPeriodDuration(d)
              }}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #cfd4de', borderRadius: 8,
                background: '#fff', fontSize: 12.5, fontFamily: 'inherit',
              }}
            >
              {DURATION_PRESETS.map(p => (
                <option key={`${p.periodsCount}x${p.periodDurationMin}`} value={`${p.periodsCount}x${p.periodDurationMin}`}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Personalizzato…</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#404751', display: 'block', marginBottom: 4 }}>
                Numero tempi
              </label>
              <input type="number" min={1} max={4} value={periodsCount}
                onChange={e => setPeriodsCount(Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 2)))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cfd4de', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#404751', display: 'block', marginBottom: 4 }}>
                Minuti per tempo
              </label>
              <input type="number" min={5} max={60} value={periodDuration}
                onChange={e => setPeriodDuration(Math.max(5, Math.min(60, parseInt(e.target.value, 10) || 45)))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cfd4de', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{
            padding: '8px 10px', background: '#e6f3ff', borderRadius: 6,
            fontSize: 11.5, fontWeight: 700, color: '#005f98', textAlign: 'center',
          }}>
            Totale partita: <strong>{periodsCount} × {periodDuration}′ = {periodsCount * periodDuration} minuti</strong>
          </div>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: '#f1f3fa', borderRadius: 10,
          marginTop: 6, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={publicPresence}
            onChange={e => setPublicPresence(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
              Landing pubblica presenze
            </div>
            <div style={{ fontSize: 11, color: '#707882', marginTop: 2 }}>
              I ragazzi possono rispondere alle presenze dal telefono senza login
            </div>
          </div>
        </label>

        {/* Se abilitata: mostro il link della landing pubblica e i pulsanti per condividerlo */}
        {publicPresence && (
          <PublicPresenceShare teamName={existingTeam?.name || 'la squadra'} />
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving || deleting}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 12,
              border: '1px solid #c0c7d2', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#404751', cursor: 'pointer',
            }}>
            Annulla
          </button>
          <button onClick={handleSave} disabled={saving || deleting}
            style={{
              flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: '#005f98', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting) ? 0.6 : 1,
            }}>
            <Icon name={isEdit ? 'save' : 'add_circle'} size={16} color="#fff" />
            {saving ? 'Salvo…' : (isEdit ? 'Salva modifiche' : 'Crea squadra')}
          </button>
        </div>

        {isEdit && canDelete && (
          <button onClick={handleDelete} disabled={saving || deleting}
            style={{
              marginTop: 12, width: '100%', padding: '12px 18px', borderRadius: 12,
              border: '1.5px solid #ba1a1a', background: '#fff', color: '#ba1a1a',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting) ? 0.6 : 1,
            }}>
            <Icon name="delete" size={15} color="#ba1a1a" />
            {deleting ? 'Elimino…' : 'Elimina squadra'}
          </button>
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

/**
 * Pannello che appare sotto il flag "Landing pubblica presenze" quando è ON.
 * Mostra l'URL della landing pubblica e 3 pulsanti per condividerlo:
 *  - Apri (verifica visiva)
 *  - Copia negli appunti
 *  - Condividi su WhatsApp con messaggio pre-compilato per il gruppo squadra
 * Sotto: promemoria su come funziona per genitori/ragazzi.
 */
function PublicPresenceShare({ teamName }: { teamName: string }) {
  const url = 'https://lenci-poirino-presenze.netlify.app/'
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback (browser vecchi / permessi negati)
      window.prompt('Copia il link:', url)
    }
  }

  const whatsappText = encodeURIComponent(
    `🟢 Presenze ${teamName} — segna qui partite e allenamenti:\n\n${url}\n\n` +
    `Aprite il link, premete "CAMBIA" in alto e selezionate il nome di vostro figlio, ` +
    `poi rispondete Vengo / Non vengo / Forse per ogni impegno.`
  )

  return (
    <div style={{
      marginTop: 8,
      padding: '12px 14px',
      background: '#eaf3fb',
      border: '1px solid #b8d5ec',
      borderRadius: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#005f98', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Link della landing pubblica
      </div>

      {/* URL leggibile */}
      <div style={{
        padding: '10px 12px', background: '#fff', borderRadius: 8,
        border: '1px solid #b8d5ec', fontSize: 12.5, fontFamily: 'monospace',
        color: '#181c20', wordBreak: 'break-all', userSelect: 'all',
      }}>
        {url}
      </div>

      {/* 3 pulsanti azione */}
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          style={{
            flex: 1, padding: '9px 8px', borderRadius: 8, border: '1px solid #005f98',
            background: '#fff', color: '#005f98', fontSize: 11.5, fontWeight: 700,
            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Icon name="open_in_new" size={14} color="#005f98" />
          Apri
        </a>
        <button
          type="button" onClick={copyLink}
          style={{
            flex: 1, padding: '9px 8px', borderRadius: 8, border: '1px solid #005f98',
            background: copied ? '#dcf1e2' : '#fff',
            color: copied ? '#006e25' : '#005f98',
            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={14} color={copied ? '#006e25' : '#005f98'} />
          {copied ? 'Copiato' : 'Copia'}
        </button>
        <a
          href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer"
          style={{
            flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none',
            background: '#25d366', color: '#fff', fontSize: 11.5, fontWeight: 700,
            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Icon name="share" size={14} color="#fff" />
          WhatsApp
        </a>
      </div>

      {/* Promemoria uso */}
      <div style={{
        fontSize: 10.5, color: '#404751', lineHeight: 1.5,
        padding: '6px 2px 0', borderTop: '1px dashed #b8d5ec',
      }}>
        Condividi il link sul gruppo WhatsApp della squadra: chi lo apre sceglie il proprio nome con
        il tasto "Cambia" e risponde Vengo / Non vengo / Forse per ogni impegno, senza dover creare un account.
      </div>
    </div>
  )
}
