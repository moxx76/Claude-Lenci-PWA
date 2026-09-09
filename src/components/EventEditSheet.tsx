import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { TrainingSessionComposerSheet } from './TrainingSessionComposerSheet'
import { TrainingAttachmentsSection } from './TrainingAttachmentsSection'
import { useToast } from './Toast'

interface Team {
  id: string
  name: string
  color: string | null
  age_range?: string | null
}

interface ExistingEvent {
  kind: EventKind
  id: string
  team_id?: string | null
  training_date?: string
  match_date?: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  location_address?: string | null
  focus?: string | null
  notes?: string | null
  program?: string | null
  opponent?: string | null
  venue?: 'home' | 'away' | null
  competition?: string | null
}

interface EventEditSheetProps {
  open: boolean
  onClose: () => void
  teams: Team[]
  defaultTeamId?: string | null
  existingEvent?: ExistingEvent | null
  onSaved?: () => void
  onDeleted?: () => void
}

type EventKind = 'training' | 'match'

export function EventEditSheet({ open, onClose, teams, defaultTeamId, existingEvent, onSaved, onDeleted }: EventEditSheetProps) {
  const { showToast } = useToast()
  const isEditMode = !!existingEvent
  const [kind, setKind] = useState<EventKind>('training')
  const [teamId, setTeamId] = useState<string>('')
  const [eventDate, setEventDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('19:00')
  const [endTime, setEndTime] = useState<string>('20:30')
  const [location, setLocation] = useState<string>('Campo Sportivo Poirino')
  const [locationAddress, setLocationAddress] = useState<string>('')
  const [focus, setFocus] = useState<string>('')
  const [program, setProgram] = useState<string>('')
  // Match-specific
  const [opponent, setOpponent] = useState<string>('')
  const [venue, setVenue] = useState<'home' | 'away'>('home')
  const [competition, setCompetition] = useState<string>('Amichevole')
  // Common
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  // Ripetizione settimanale (solo in creazione)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (existingEvent) {
      // Modalità modifica: precompila
      setKind(existingEvent.kind)
      setTeamId(existingEvent.team_id || defaultTeamId || teams[0]?.id || '')
      if (existingEvent.kind === 'training') {
        setEventDate(existingEvent.training_date || '')
        setStartTime((existingEvent.start_time || '19:00').slice(0, 5))
        setEndTime((existingEvent.end_time || '20:30').slice(0, 5))
        setFocus(existingEvent.focus || '')
        setProgram(existingEvent.program || '')
      } else {
        // match_date è timestamptz ISO
        const mdate = existingEvent.match_date ? new Date(existingEvent.match_date) : new Date()
        const y = mdate.getFullYear()
        const m = String(mdate.getMonth() + 1).padStart(2, '0')
        const d = String(mdate.getDate()).padStart(2, '0')
        const hh = String(mdate.getHours()).padStart(2, '0')
        const mm = String(mdate.getMinutes()).padStart(2, '0')
        setEventDate(`${y}-${m}-${d}`)
        setStartTime(`${hh}:${mm}`)
        setEndTime('20:30')
        setOpponent(existingEvent.opponent || '')
        setVenue(existingEvent.venue || 'home')
        setCompetition(existingEvent.competition || 'Amichevole')
      }
      setLocation(existingEvent.location || 'Campo Sportivo Poirino')
      setLocationAddress(existingEvent.location_address || '')
      setNotes(existingEvent.notes || '')
    } else {
      // Modalità creazione
      setKind('training')
      setTeamId(defaultTeamId || teams[0]?.id || '')
      const today = new Date()
      today.setDate(today.getDate() + 1)
      setEventDate(today.toISOString().slice(0, 10))
      setStartTime('19:00')
      setEndTime('20:30')
      setLocation('Campo Sportivo Poirino')
      setLocationAddress('')
      setFocus('')
      setProgram('')
      setOpponent('')
      setVenue('home')
      setCompetition('Amichevole')
      setNotes('')
      setRepeatWeekly(false)
      setRepeatUntil('')
    }
    // In modifica la ripetizione non ha senso (modifichi il singolo evento)
    if (existingEvent) {
      setRepeatWeekly(false)
      setRepeatUntil('')
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingEvent?.id])

  const handleSave = async () => {
    if (!teamId) { setError('Seleziona la squadra'); return }
    if (!eventDate) { setError('La data è obbligatoria'); return }
    if (kind === 'match' && !opponent.trim()) { setError('L\'avversario è obbligatorio'); return }
    if (!isEditMode && repeatWeekly) {
      if (!repeatUntil) { setError('Indica fino a quale data ripetere'); return }
      if (repeatUntil < eventDate) { setError('La data di fine ripetizione deve essere successiva a quella dell\'evento'); return }
    }
    setSaving(true)
    setError(null)
    try {
      // Genera l'elenco di date su cui creare l'evento
      // - In edit: solo eventDate
      // - In create senza ripetizione: solo eventDate
      // - In create con ripetizione: eventDate + eventDate+7 + ... fino a <= repeatUntil
      const dates: string[] = [eventDate]
      let recurrenceGroupId: string | null = null
      if (!isEditMode && repeatWeekly && repeatUntil) {
        const start = new Date(eventDate + 'T00:00:00')
        const end = new Date(repeatUntil + 'T00:00:00')
        const cursor = new Date(start.getTime())
        cursor.setDate(cursor.getDate() + 7)
        while (cursor <= end) {
          const y = cursor.getFullYear()
          const m = String(cursor.getMonth() + 1).padStart(2, '0')
          const d = String(cursor.getDate()).padStart(2, '0')
          dates.push(`${y}-${m}-${d}`)
          cursor.setDate(cursor.getDate() + 7)
        }
        if (dates.length > 1) {
          recurrenceGroupId = (crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now())
        }
      }

      if (kind === 'training') {
        const basePayload = {
          team_id: teamId,
          start_time: startTime,
          end_time: endTime,
          location: location || null,
          focus: focus || null,
          program: program || null,
          notes: notes || null,
        }
        if (isEditMode && existingEvent!.kind === 'training') {
          const { error: err } = await supabase.from('trainings').update({ ...basePayload, training_date: eventDate }).eq('id', existingEvent!.id)
          if (err) throw err
        } else {
          const rows = dates.map(d => ({
            ...basePayload,
            training_date: d,
            recurrence_group_id: recurrenceGroupId,
          }))
          const { error: err } = await supabase.from('trainings').insert(rows)
          if (err) throw err
        }
      } else {
        // Match: costruisco data locale → ISO
        const buildIso = (dateStr: string): string => {
          const [y, mo, d] = dateStr.split('-').map(Number)
          const [hh, mm] = startTime.split(':').map(Number)
          return new Date(y, mo - 1, d, hh, mm, 0).toISOString()
        }
        const basePayload = {
          team_id: teamId,
          opponent: opponent.trim(),
          venue,
          competition: competition || 'Amichevole',
          location: location || null,
          location_address: locationAddress.trim() || null,
          notes: notes || null,
        }
        if (isEditMode && existingEvent!.kind === 'match') {
          const { error: err } = await supabase.from('matches')
            .update({ ...basePayload, match_date: buildIso(eventDate) })
            .eq('id', existingEvent!.id)
          if (err) throw err
        } else {
          const rows = dates.map(d => ({
            ...basePayload,
            match_date: buildIso(d),
            status: 'scheduled',
            recurrence_group_id: recurrenceGroupId,
          }))
          const { error: err } = await supabase.from('matches').insert(rows)
          if (err) throw err
        }
      }
      onSaved?.()
      const count = dates.length
      const kindLabel = kind === 'training' ? 'Allenament' : 'Partit'
      const suffixSingle = kind === 'training' ? 'o' : 'a'
      const suffixMulti = kind === 'training' ? 'i' : 'e'
      showToast(
        isEditMode
          ? `${kindLabel}${suffixSingle} aggiornat${suffixSingle}`
          : count === 1
            ? `${kindLabel}${suffixSingle} creat${suffixSingle}`
            : `${count} ${kindLabel}${suffixMulti} creat${suffixMulti} (ripetuti settimanalmente)`,
        'success'
      )
      onClose()
    } catch (e: any) {
      const msg = 'Errore salvataggio: ' + (e.message || 'sconosciuto')
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingEvent) return
    const label = existingEvent.kind === 'training' ? 'allenamento' : 'partita'
    if (!confirm(`Vuoi eliminare questo ${label}?\n\nATTENZIONE: verranno rimosse anche eventuali presenze e convocazioni collegate. L'azione è irreversibile.`)) return
    setDeleting(true)
    setError(null)
    try {
      const table = existingEvent.kind === 'training' ? 'trainings' : 'matches'
      const { error: err } = await supabase.from(table).delete().eq('id', existingEvent.id)
      if (err) throw err
      onDeleted?.()
      showToast(existingEvent.kind === 'training' ? 'Allenamento eliminato' : 'Partita eliminata', 'success')
      onClose()
    } catch (e: any) {
      const msg = 'Errore eliminazione: ' + (e.message || 'sconosciuto')
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isEditMode ? (existingEvent!.kind === 'training' ? 'Modifica allenamento' : 'Modifica partita') : 'Nuovo evento'}>
      <div style={{ padding: '4px 20px 24px' }}>
        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a',
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Icon name="error" size={16} color="#93000a" />
            {error}
          </div>
        )}

        {/* Kind toggle solo in creazione */}
        {!isEditMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {(['training', 'match'] as EventKind[]).map(k => {
            const active = kind === k
            const label = k === 'training' ? 'Allenamento' : 'Partita'
            const icon = k === 'training' ? 'fitness_center' : 'sports_soccer'
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  padding: '12px', borderRadius: 12,
                  border: active ? '2px solid #005f98' : '1px solid #c0c7d2',
                  background: active ? '#cfe5ff' : '#fff',
                  color: active ? '#004a78' : '#404751',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon name={icon} size={16} color={active ? '#004a78' : '#707882'} />
                {label}
              </button>
            )
          })}
          </div>
        )}

        {/* Team select */}
        <Field label="Squadra *">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {teams.map(t => {
              const active = teamId === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTeamId(t.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 999,
                    border: active ? `2px solid ${t.color || '#005f98'}` : '1px solid #c0c7d2',
                    background: active ? (t.color || '#005f98') : '#fff',
                    color: active ? '#fff' : '#404751',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Date + times */}
        <Field label="Data *">
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
        </Field>

        {/* Banner retroattivo: data nel passato */}
        {eventDate && eventDate < new Date().toISOString().slice(0, 10) && (
          <div
            style={{
              padding: '8px 10px',
              background: '#fff4e6',
              border: '1px solid #ffc98a',
              borderRadius: 8,
              fontSize: 11.5,
              color: '#7c4700',
              lineHeight: 1.45,
            }}
          >
            📅 <strong>{kind === 'match' ? 'Partita' : 'Allenamento'} già svolto</strong>: stai registrando un evento nel passato. Dopo il salvataggio potrai aggiungere subito le presenze{kind === 'match' ? ' e compilare il report' : ''}.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={kind === 'match' ? 'Fischio d\'inizio *' : 'Inizio *'}>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
          </Field>
          {kind === 'training' && (
            <Field label="Fine">
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
            </Field>
          )}
        </div>

        {/* Match-specific fields */}
        {kind === 'match' && (
          <>
            <Field label="Avversario *">
              <input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="es. Airaschese" style={inputStyle} />
            </Field>
            <Field label="Dove si gioca">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  onClick={() => setVenue('home')}
                  style={{
                    padding: '10px', borderRadius: 10,
                    border: venue === 'home' ? '2px solid #005f98' : '1px solid #c0c7d2',
                    background: venue === 'home' ? '#cfe5ff' : '#fff',
                    color: venue === 'home' ? '#004a78' : '#404751',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <Icon name="home" size={15} color={venue === 'home' ? '#004a78' : '#707882'} />
                  In casa
                </button>
                <button
                  onClick={() => setVenue('away')}
                  style={{
                    padding: '10px', borderRadius: 10,
                    border: venue === 'away' ? '2px solid #005f98' : '1px solid #c0c7d2',
                    background: venue === 'away' ? '#cfe5ff' : '#fff',
                    color: venue === 'away' ? '#004a78' : '#404751',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <Icon name="flight_takeoff" size={15} color={venue === 'away' ? '#004a78' : '#707882'} />
                  Trasferta
                </button>
              </div>
            </Field>
            <Field label="Competizione">
              <input value={competition} onChange={e => setCompetition(e.target.value)} placeholder="es. Amichevole, Campionato, Torneo" style={inputStyle} />
            </Field>
          </>
        )}

        {kind === 'training' && (
          <>
            <Field label="Focus / tema seduta">
              <input value={focus} onChange={e => setFocus(e.target.value)} placeholder="es. Possesso palla, Situazioni di gioco" style={inputStyle} />
            </Field>

            {/* Bottone composer seduta strutturata (solo in edit mode) */}
            {isEditMode && existingEvent && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f2fd 100%)',
                  border: '1px solid #cfe5ff',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#005f98',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="assignment" size={18} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#004a78', lineHeight: 1.2 }}>
                      Componi seduta strutturata
                    </div>
                    <div style={{ fontSize: 11, color: '#005f98', marginTop: 2 }}>
                      Con esercizi dal catalogo, obiettivi e schema Federazione
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComposer(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#005f98',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name="edit_note" size={16} color="#fff" />
                  Apri compositore seduta
                </button>
              </div>
            )}

            {/* Allegati (foto + PDF) — visibili solo per allenamenti già salvati */}
            {kind === 'training' && isEditMode && existingEvent?.id && (
              <TrainingAttachmentsSection
                trainingId={existingEvent.id}
                canEdit={true}
              />
            )}

            {kind === 'training' && !isEditMode && (
              <div style={{
                background: '#fff8e6', border: '1px solid #ffe0a3',
                borderRadius: 10, padding: '10px 12px',
                fontSize: 11.5, color: '#7c4700', lineHeight: 1.4,
              }}>
                💡 Potrai allegare foto e PDF alla seduta dopo aver salvato l'allenamento (riaprendolo dal calendario).
              </div>
            )}

            <Field label="📋 Programma dettagliato dell'allenamento">
              <textarea
                value={program}
                onChange={e => setProgram(e.target.value)}
                placeholder={"Es.\n• Riscaldamento 15' — giro campo + stretching dinamico\n• Esercizio 1 (20') — passaggi corti in triangolo\n• Esercizio 2 (25') — 1v1 con transizione\n• Partitella 20' — 6v6 con jolly\n• Defaticamento 5'"}
                rows={7}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: '#707882', marginTop: 4 }}>
                Visibile a tutti gli utenti della squadra (staff, giocatori, genitori).
              </div>
            </Field>
          </>
        )}

        <Field label="Luogo">
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Campo Sportivo Poirino" style={inputStyle} />
        </Field>

        {kind === 'match' && (
          <Field label="Indirizzo campo (per locandine)">
            <input
              value={locationAddress}
              onChange={e => setLocationAddress(e.target.value)}
              placeholder="Es. Via Roma 15, 10046 Poirino (TO)"
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="Note">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Eventuali note (ritrovo, materiale, ecc.)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        {/* Ripetizione settimanale (solo in creazione) */}
        {!isEditMode && (
          <div style={{
            marginTop: 4, padding: '12px 14px', borderRadius: 12,
            background: repeatWeekly ? '#e7f2ff' : '#f7f9ff',
            border: '1px solid ' + (repeatWeekly ? '#005f98' : '#e6e8ee'),
            transition: 'background 120ms, border-color 120ms',
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={e => {
                  setRepeatWeekly(e.target.checked)
                  if (e.target.checked && !repeatUntil && eventDate) {
                    // Suggerisco 3 mesi come default
                    const d = new Date(eventDate + 'T00:00:00')
                    d.setMonth(d.getMonth() + 3)
                    const y = d.getFullYear()
                    const m = String(d.getMonth() + 1).padStart(2, '0')
                    const dy = String(d.getDate()).padStart(2, '0')
                    setRepeatUntil(`${y}-${m}-${dy}`)
                  }
                }}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#005f98' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20' }}>
                  🔁 Ripeti settimanalmente
                </div>
                <div style={{ fontSize: 10.5, color: '#707882', marginTop: 2 }}>
                  Crea un evento identico ogni 7 giorni fino alla data indicata
                </div>
              </div>
            </label>

            {repeatWeekly && (
              <div style={{ marginTop: 12 }}>
                <label style={{
                  display: 'block', fontSize: 10.5, fontWeight: 700, color: '#404751',
                  textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5,
                }}>
                  Ripeti fino al (incluso)
                </label>
                <input
                  type="date"
                  value={repeatUntil}
                  min={eventDate}
                  onChange={e => setRepeatUntil(e.target.value)}
                  style={inputStyle}
                />
                {repeatUntil && repeatUntil >= eventDate && (() => {
                  // Contatore preview eventi che verranno creati
                  const start = new Date(eventDate + 'T00:00:00')
                  const end = new Date(repeatUntil + 'T00:00:00')
                  const weeks = Math.floor((end.getTime() - start.getTime()) / (7 * 86400000)) + 1
                  return (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', background: '#fff',
                      border: '1px solid #c0dbf0', borderRadius: 8,
                      fontSize: 11.5, color: '#004a78', fontWeight: 600,
                    }}>
                      💡 Verranno creati <b>{weeks}</b> event{weeks === 1 ? 'o' : 'i'} in totale
                      {weeks > 1 && ` (ogni ${new Date(eventDate + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long' })})`}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={saving || deleting}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 12,
              border: '1px solid #c0c7d2', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#404751',
              cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            style={{
              flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: '#005f98', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting) ? 0.6 : 1,
            }}
          >
            <Icon name={isEditMode ? 'save' : 'add_circle'} size={16} color="#fff" />
            {saving ? 'Salvo…' : (isEditMode ? 'Salva modifiche' : 'Crea evento')}
          </button>
        </div>

        {/* Bottone Elimina solo in modalità modifica */}
        {isEditMode && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            style={{
              marginTop: 12, width: '100%', padding: '12px 18px', borderRadius: 12,
              border: '1.5px solid #ba1a1a', background: '#fff', color: '#ba1a1a',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting) ? 0.6 : 1,
            }}
          >
            <Icon name="delete" size={15} color="#ba1a1a" />
            {deleting ? 'Elimino…' : `Elimina ${existingEvent!.kind === 'training' ? 'allenamento' : 'partita'}`}
          </button>
        )}
      </div>

      {/* Composer seduta strutturata */}
      {isEditMode && existingEvent && kind === 'training' && (
        <TrainingSessionComposerSheet
          open={showComposer}
          onClose={() => setShowComposer(false)}
          trainingId={existingEvent.id}
          trainingDate={existingEvent.training_date}
          teamName={teams.find(t => t.id === teamId)?.name}
          teamAgeRange={teams.find(t => t.id === teamId)?.age_range || undefined}
          onSaved={() => {
            setShowComposer(false)
            onSaved?.()
          }}
        />
      )}
    </BottomSheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{
        fontSize: 10.5, fontWeight: 700, color: '#404751',
        textTransform: 'uppercase', letterSpacing: '0.03em',
        display: 'block', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #c0c7d2', fontSize: 13.5,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#fff',
}
