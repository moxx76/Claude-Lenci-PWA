import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'

/**
 * Sheet per creare/modificare una riunione (interna staff o esterna genitori).
 * Accessibile solo ad admin, director e is_manager. La RLS backend rafforza
 * la stessa regola.
 *
 * FLOW:
 *  1. Tipo riunione: Interna (staff) o Esterna (genitori)
 *  2. Se INTERNA: sub-scelta audience (Allenatori / Dirigenti / Tutto lo staff)
 *  3. Squadre target (opzionale): se vuoto = tutto il club, altrimenti filtra
 *  4. Titolo + data + orario + luogo/link + note
 *  5. Salva → trigger DB fanoutta le notifiche in-app + push automaticamente
 */

interface MeetingDraft {
  id?: string
  title: string
  description: string
  meeting_date: string    // YYYY-MM-DD
  start_time: string      // HH:MM
  end_time: string
  location: string
  meeting_url: string
  kind: 'internal' | 'external'
  audience: string[]      // per internal: subset di ['coaches','managers','all_staff']; per external: ['parents']
  team_ids: string[]      // opzionale
  notes: string
  color: string
}

interface TeamOption {
  id: string
  name: string
  color: string | null
  category: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  clubId: string
  currentUserId: string | null
  existing?: any    // per modifica: passa il raw della riunione
  onSaved?: () => void
}

const EMPTY_DRAFT: MeetingDraft = {
  title: '',
  description: '',
  meeting_date: '',
  start_time: '20:30',
  end_time: '',
  location: '',
  meeting_url: '',
  kind: 'internal',
  audience: ['all_staff'],
  team_ids: [],
  notes: '',
  color: '',
}

export function MeetingEditSheet({ open, onClose, clubId, currentUserId, existing, onSaved }: Props) {
  const [draft, setDraft] = useState<MeetingDraft>(EMPTY_DRAFT)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!existing?.id

  // Carico squadre del club per il selettore
  useEffect(() => {
    if (!open) return
    supabase.from('teams')
      .select('id, name, color, category')
      .eq('club_id', clubId)
      .order('name')
      .then(({ data }) => setTeams((data as TeamOption[]) ?? []))
  }, [open, clubId])

  // Init draft (nuova o edit)
  useEffect(() => {
    if (!open) return
    if (existing) {
      setDraft({
        id: existing.id,
        title: existing.title ?? '',
        description: existing.description ?? '',
        meeting_date: existing.meeting_date ?? '',
        start_time: (existing.start_time ?? '').slice(0, 5),
        end_time: (existing.end_time ?? '').slice(0, 5),
        location: existing.location ?? '',
        meeting_url: existing.meeting_url ?? '',
        kind: existing.kind ?? 'internal',
        audience: existing.audience ?? ['all_staff'],
        team_ids: existing.team_ids ?? [],
        notes: existing.notes ?? '',
        color: existing.color ?? '',
      })
    } else {
      // Default nuova: oggi + 3 giorni alle 20:30 (comodo per riunioni serali)
      const d = new Date()
      d.setDate(d.getDate() + 3)
      setDraft({ ...EMPTY_DRAFT, meeting_date: d.toISOString().slice(0, 10) })
    }
    setError(null)
    setConfirmDelete(false)
  }, [open, existing])

  // Al cambio kind, resetto audience al default sensato
  function setKind(kind: 'internal' | 'external') {
    setDraft(d => ({
      ...d, kind,
      audience: kind === 'external' ? ['parents'] : ['all_staff'],
    }))
  }

  function toggleAudience(value: string) {
    setDraft(d => {
      const has = d.audience.includes(value)
      // Per interne: se aggiungi 'all_staff' rimuove gli altri (è il superset)
      // Se aggiungi coaches/managers rimuove all_staff
      if (d.kind === 'internal') {
        if (value === 'all_staff') return { ...d, audience: has ? [] : ['all_staff'] }
        const cleaned = d.audience.filter(a => a !== 'all_staff' && a !== value)
        return { ...d, audience: has ? cleaned : [...cleaned, value] }
      }
      return { ...d, audience: has ? d.audience.filter(a => a !== value) : [...d.audience, value] }
    })
  }

  function toggleTeam(teamId: string) {
    setDraft(d => ({
      ...d,
      team_ids: d.team_ids.includes(teamId)
        ? d.team_ids.filter(t => t !== teamId)
        : [...d.team_ids, teamId],
    }))
  }

  async function handleSave() {
    // Validazione minima
    if (!draft.title.trim()) { setError('Il titolo è obbligatorio'); return }
    if (!draft.meeting_date) { setError('La data è obbligatoria'); return }
    if (!draft.start_time) { setError('L\'orario di inizio è obbligatorio'); return }
    if (draft.audience.length === 0) { setError('Seleziona almeno un destinatario'); return }

    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        club_id: clubId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        meeting_date: draft.meeting_date,
        start_time: draft.start_time,
        end_time: draft.end_time || null,
        location: draft.location.trim() || null,
        meeting_url: draft.meeting_url.trim() || null,
        kind: draft.kind,
        audience: draft.audience,
        // NB: array vuoto o null = "tutto il club, nessun filtro squadra"
        team_ids: draft.team_ids.length > 0 ? draft.team_ids : null,
        notes: draft.notes.trim() || null,
        color: draft.color || null,
      }
      if (isEdit) {
        const { error: err } = await supabase.from('meetings').update(payload).eq('id', draft.id!)
        if (err) throw err
      } else {
        payload.created_by = currentUserId
        const { error: err } = await supabase.from('meetings').insert(payload)
        if (err) throw err
      }
      onSaved?.()
      onClose()
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (String(e?.code) === '42501' || /row-level security/i.test(msg)) {
        setError('Non hai i permessi per creare/modificare riunioni. Serve essere admin, direttore o dirigente.')
      } else {
        setError('Errore salvataggio: ' + (msg || 'sconosciuto'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    setSaving(true)
    try {
      const { error: err } = await supabase.from('meetings').delete().eq('id', draft.id)
      if (err) throw err
      onSaved?.()
      onClose()
    } catch (e: any) {
      setError('Errore eliminazione: ' + (e?.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Modifica riunione' : 'Nuova riunione'}>
      <div style={{ padding: '4px 4px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* TIPO RIUNIONE — segmented */}
        <div>
          <Label>Tipo</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KindTile
              active={draft.kind === 'internal'}
              onClick={() => setKind('internal')}
              icon="groups"
              label="Interna"
              subtitle="Staff (allenatori/dirigenti)"
              color="#7a0071"
            />
            <KindTile
              active={draft.kind === 'external'}
              onClick={() => setKind('external')}
              icon="family_restroom"
              label="Esterna"
              subtitle="Genitori"
              color="#005f98"
            />
          </div>
        </div>

        {/* AUDIENCE (solo se INTERNA — per esterna è sempre 'parents' implicito) */}
        {draft.kind === 'internal' && (
          <div>
            <Label>Destinatari staff</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Checkbox
                label="Tutto lo staff"
                sub="Allenatori + Dirigenti (raccomandato)"
                checked={draft.audience.includes('all_staff')}
                onChange={() => toggleAudience('all_staff')}
              />
              <Checkbox
                label="Solo allenatori"
                sub="Chi ha ruolo Allenatore"
                checked={draft.audience.includes('coaches')}
                onChange={() => toggleAudience('coaches')}
                disabled={draft.audience.includes('all_staff')}
              />
              <Checkbox
                label="Solo dirigenti"
                sub="Chi è flag Dirigente"
                checked={draft.audience.includes('managers')}
                onChange={() => toggleAudience('managers')}
                disabled={draft.audience.includes('all_staff')}
              />
            </div>
          </div>
        )}

        {/* SQUADRE TARGET (opzionale) */}
        <div>
          <Label>
            {draft.kind === 'external' ? 'Genitori di quali squadre?' : 'Staff di quali squadre?'}
          </Label>
          <div style={{ fontSize: 11, color: '#707882', marginTop: -4, marginBottom: 8 }}>
            {draft.team_ids.length === 0
              ? '→ Nessun filtro: tutte le squadre del club'
              : `→ ${draft.team_ids.length} squadr${draft.team_ids.length === 1 ? 'a' : 'e'} selezionat${draft.team_ids.length === 1 ? 'a' : 'e'}`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {teams.map(t => {
              const active = draft.team_ids.includes(t.id)
              const color = t.color || '#005f98'
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeam(t.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 999,
                    border: `1.5px solid ${active ? color : '#dfe6ef'}`,
                    background: active ? color : '#fff',
                    color: active ? '#fff' : '#404751',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* TITOLO */}
        <div>
          <Label>Titolo *</Label>
          <input
            type="text"
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Es. Riunione staff pre-stagione"
            style={inputStyle}
            maxLength={200}
          />
        </div>

        {/* DATA + ORA IN GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8 }}>
          <div>
            <Label>Data *</Label>
            <input type="date" value={draft.meeting_date}
              onChange={e => setDraft(d => ({ ...d, meeting_date: e.target.value }))}
              style={inputStyle} />
          </div>
          <div>
            <Label>Ora inizio *</Label>
            <input type="time" value={draft.start_time}
              onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))}
              style={inputStyle} />
          </div>
          <div>
            <Label>Ora fine</Label>
            <input type="time" value={draft.end_time}
              onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))}
              style={inputStyle} />
          </div>
        </div>

        {/* LUOGO / LINK */}
        <div>
          <Label>Luogo (facoltativo)</Label>
          <input type="text" value={draft.location}
            onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
            placeholder="Es. Sede Lenci, Poirino"
            style={inputStyle} maxLength={300} />
        </div>

        <div>
          <Label>Link online (facoltativo)</Label>
          <input type="url" value={draft.meeting_url}
            onChange={e => setDraft(d => ({ ...d, meeting_url: e.target.value }))}
            placeholder="https://meet.google.com/… o Zoom/Teams"
            style={inputStyle} maxLength={500} />
        </div>

        {/* DESCRIZIONE / ORDINE DEL GIORNO */}
        <div>
          <Label>Descrizione / Ordine del giorno</Label>
          <textarea value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Argomenti in agenda, materiali da preparare, ecc."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
        </div>

        {error && (
          <div style={{
            padding: '8px 10px', background: '#ffdad6', color: '#93000a',
            borderRadius: 8, fontSize: 12.5, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* AZIONI */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {isEdit && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              style={{ ...buttonStyle, background: '#fff', color: '#93000a', border: '1px solid #ffb3ac', flex: '0 0 auto' }}>
              <Icon name="delete" size={14} color="#93000a" />
            </button>
          )}
          {isEdit && confirmDelete && (
            <button onClick={handleDelete} disabled={saving}
              style={{ ...buttonStyle, background: '#93000a', color: '#fff', flex: 1 }}>
              Conferma elimina
            </button>
          )}
          {!confirmDelete && (
            <>
              <button onClick={onClose} disabled={saving}
                style={{ ...buttonStyle, background: '#fff', color: '#404751', border: '1px solid #dfe6ef', flex: 1 }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ ...buttonStyle, background: '#005f98', color: '#fff', flex: 2 }}>
                {saving ? 'Salvataggio…' : (isEdit ? 'Salva modifiche' : 'Crea riunione')}
              </button>
            </>
          )}
        </div>

        {!isEdit && (
          <div style={{
            fontSize: 10.5, color: '#5c6773', textAlign: 'center', lineHeight: 1.4,
            padding: '8px 10px', background: '#f7f9ff', borderRadius: 6,
          }}>
            📢 Alla creazione, i destinatari selezionati ricevono automaticamente
            notifica in-app + push (se hanno le notifiche abilitate)
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

// ---- Helper UI --------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 10px', fontSize: 13,
  border: '1px solid #dfe6ef', borderRadius: 8,
  background: '#fff', fontFamily: 'inherit',
  boxSizing: 'border-box', outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none',
  fontSize: 13, fontWeight: 800, cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, color: '#404751',
      textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

function KindTile({ active, onClick, icon, label, subtitle, color }: {
  active: boolean; onClick: () => void; icon: string; label: string; subtitle: string; color: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 8px', borderRadius: 10,
      border: `2px solid ${active ? color : '#dfe6ef'}`,
      background: active ? `${color}12` : '#fff',
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <Icon name={icon} size={22} color={active ? color : '#8993a3'} />
      <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? color : '#404751' }}>{label}</div>
      <div style={{ fontSize: 10, color: '#707882', textAlign: 'center' }}>{subtitle}</div>
    </button>
  )
}

function Checkbox({ label, sub, checked, onChange, disabled }: {
  label: string; sub?: string; checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onChange} disabled={disabled}
      style={{
        padding: '8px 10px', borderRadius: 8,
        border: `1px solid ${checked ? '#005f98' : '#dfe6ef'}`,
        background: checked ? '#e6f2fb' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left', width: '100%',
      }}>
      <span style={{
        width: 18, height: 18, borderRadius: 4,
        border: `1.5px solid ${checked ? '#005f98' : '#c8ccd4'}`,
        background: checked ? '#005f98' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && <Icon name="check" size={13} color="#fff" />}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#181c20' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  )
}
