import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import {
  CATEGORY_META, STATUS_META,
  type MarketingCategory, type MarketingStatus, type MarketingEvent,
} from '../lib/marketing'

interface Props {
  open: boolean
  onClose: () => void
  event: MarketingEvent | null   // null = nuovo evento
  clubId: string | null
  onSaved: () => void
  onDeleted?: () => void
  onOpenPublish?: (event: MarketingEvent) => void
}

export function MarketingEventEditSheet({ open, onClose, event, clubId, onSaved, onDeleted, onOpenPublish }: Props) {
  const { profile } = useAuth()
  const isEdit = !!event

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<MarketingCategory>('other')
  const [status, setStatus] = useState<MarketingStatus>('planning')
  const [eventDate, setEventDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [address, setAddress] = useState('')
  const [estAttendance, setEstAttendance] = useState('')
  const [actualAttendance, setActualAttendance] = useState('')
  const [budgetEst, setBudgetEst] = useState('')
  const [budgetAct, setBudgetAct] = useState('')
  const [revenueEst, setRevenueEst] = useState('')
  const [revenueAct, setRevenueAct] = useState('')
  const [sponsors, setSponsors] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [ticketUrl, setTicketUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<Array<{ text: string; done: boolean }>>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title)
        setDescription(event.description || '')
        setCategory(event.category)
        setStatus(event.status)
        setEventDate(event.event_date)
        setStartTime(event.start_time || '')
        setEndTime(event.end_time || '')
        setLocation(event.location || '')
        setAddress(event.address || '')
        setEstAttendance(event.estimated_attendance?.toString() || '')
        setActualAttendance(event.actual_attendance?.toString() || '')
        setBudgetEst(event.budget_estimated?.toString() || '')
        setBudgetAct(event.budget_actual?.toString() || '')
        setRevenueEst(event.revenue_estimated?.toString() || '')
        setRevenueAct(event.revenue_actual?.toString() || '')
        setSponsors(event.sponsors || '')
        setContactName(event.contact_name || '')
        setContactPhone(event.contact_phone || '')
        setContactEmail(event.contact_email || '')
        setTicketPrice(event.ticket_price?.toString() || '')
        setTicketUrl(event.ticket_url || '')
        setNotes(event.notes || '')
        setChecklist(event.checklist ?? [])
      } else {
        setTitle(''); setDescription(''); setCategory('other'); setStatus('planning')
        setEventDate(new Date().toISOString().slice(0, 10))
        setStartTime(''); setEndTime(''); setLocation(''); setAddress('')
        setEstAttendance(''); setActualAttendance('')
        setBudgetEst(''); setBudgetAct(''); setRevenueEst(''); setRevenueAct('')
        setSponsors(''); setContactName(''); setContactPhone(''); setContactEmail('')
        setTicketPrice(''); setTicketUrl(''); setNotes(''); setChecklist([])
      }
      setConfirmDelete(false)
      setNewChecklistItem('')
    }
  }, [open, event])

  const handleSave = async () => {
    if (!title.trim() || !eventDate) {
      alert('Titolo e data sono obbligatori')
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category, status,
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location.trim() || null,
      address: address.trim() || null,
      estimated_attendance: estAttendance ? parseInt(estAttendance) : null,
      actual_attendance: actualAttendance ? parseInt(actualAttendance) : null,
      budget_estimated: budgetEst ? parseFloat(budgetEst) : null,
      budget_actual: budgetAct ? parseFloat(budgetAct) : null,
      revenue_estimated: revenueEst ? parseFloat(revenueEst) : null,
      revenue_actual: revenueAct ? parseFloat(revenueAct) : null,
      sponsors: sponsors.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      ticket_price: ticketPrice ? parseFloat(ticketPrice) : null,
      ticket_url: ticketUrl.trim() || null,
      notes: notes.trim() || null,
      checklist,
      color: CATEGORY_META[category].color,
    }
    let error: any
    if (isEdit && event) {
      const res = await supabase.from('marketing_events').update(payload).eq('id', event.id)
      error = res.error
    } else {
      const res = await supabase.from('marketing_events').insert({
        ...payload, club_id: clubId, created_by: profile?.id,
      })
      error = res.error
    }
    setSaving(false)
    if (error) {
      alert('Errore salvataggio: ' + error.message)
      return
    }
    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    const { error } = await supabase.from('marketing_events').delete().eq('id', event.id)
    setDeleting(false)
    if (error) { alert('Errore eliminazione: ' + error.message); return }
    onDeleted?.()
    onClose()
  }

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    setChecklist([...checklist, { text: newChecklistItem.trim(), done: false }])
    setNewChecklistItem('')
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifica evento' : 'Nuovo evento marketing'}
      maxHeight="95vh"
    >
      <div style={{ padding: '4px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* BANNER PUBBLICAZIONE (solo su evento esistente) */}
        {isEdit && event && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: event.is_published_calendar ? 'rgba(128,249,139,0.20)' : '#f7f9ff',
            border: `1px solid ${event.is_published_calendar ? 'rgba(0,110,37,0.30)' : '#c0c7d2'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Icon
              name={event.is_published_calendar ? 'public' : 'lock'}
              size={20}
              color={event.is_published_calendar ? '#006e25' : '#707882'}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>
                {event.is_published_calendar ? 'Evento pubblicato' : 'Evento privato'}
              </div>
              <div style={{ fontSize: 11, color: '#707882', marginTop: 1 }}>
                {event.is_published_calendar
                  ? `Visibile nel calendario condiviso · Audience: ${(event.calendar_audience ?? []).join(', ')}`
                  : 'Solo il team Marketing può vederlo'}
              </div>
            </div>
            {onOpenPublish && (
              <button
                onClick={() => onOpenPublish(event)}
                style={{
                  padding: '7px 12px', borderRadius: 8, border: 'none',
                  background: event.is_published_calendar ? '#005f98' : '#7a0071',
                  color: '#fff', fontWeight: 800, fontSize: 11.5, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.10)',
                }}>
                <Icon name={event.is_published_calendar ? 'edit' : 'campaign'} size={12} color="#fff" />
                {event.is_published_calendar ? 'Gestisci' : 'Pubblica'}
              </button>
            )}
          </div>
        )}

        {/* CATEGORIA */}
        <Section title="Categoria evento">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6,
          }}>
            {(Object.keys(CATEGORY_META) as MarketingCategory[]).map(c => {
              const m = CATEGORY_META[c]
              const active = category === c
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '10px 6px', borderRadius: 10,
                    background: active ? m.color : m.bg,
                    color: active ? '#fff' : m.color,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    fontSize: 10.5, fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{m.emoji}</span>
                  {m.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* STATUS pills */}
        <Section title="Stato">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(STATUS_META) as MarketingStatus[]).map(s => {
              const m = STATUS_META[s]
              const active = status === s
              return (
                <button key={s} onClick={() => setStatus(s)}
                  style={{
                    padding: '6px 10px', borderRadius: 999,
                    background: active ? m.color : m.bg,
                    color: active ? '#fff' : m.color,
                    border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <Icon name={m.icon} size={12} color={active ? '#fff' : m.color} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* TITOLO e descrizione */}
        <Field label="Titolo *">
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle}
            placeholder="Es. Cena sociale di Natale" />
        </Field>
        <Field label="Descrizione">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            placeholder="Cosa prevede l'evento?" />
        </Field>

        {/* DATA/ORA */}
        <Section title="Data e orario">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Field label="Data *">
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ora inizio">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ora fine">
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </Section>

        {/* LOCATION */}
        <Section title="Location">
          <Field label="Nome location">
            <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle}
              placeholder="Es. Circolo del Tennis Poirino" />
          </Field>
          <Field label="Indirizzo">
            <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle}
              placeholder="Via / n° / città" />
          </Field>
        </Section>

        {/* PUBBLICO */}
        <Section title="Pubblico">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Partecipanti stimati">
              <input type="number" min={0} value={estAttendance} onChange={e => setEstAttendance(e.target.value)} style={inputStyle} placeholder="0" />
            </Field>
            <Field label="Partecipanti effettivi">
              <input type="number" min={0} value={actualAttendance} onChange={e => setActualAttendance(e.target.value)} style={inputStyle} placeholder="0" />
            </Field>
          </div>
        </Section>

        {/* ECONOMICS */}
        <Section title="Economics" icon="euro">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Budget preventivato €">
              <input type="number" step="0.01" min={0} value={budgetEst} onChange={e => setBudgetEst(e.target.value)} style={inputStyle} placeholder="0.00" />
            </Field>
            <Field label="Budget consuntivo €">
              <input type="number" step="0.01" min={0} value={budgetAct} onChange={e => setBudgetAct(e.target.value)} style={inputStyle} placeholder="0.00" />
            </Field>
            <Field label="Ricavi previsti €">
              <input type="number" step="0.01" min={0} value={revenueEst} onChange={e => setRevenueEst(e.target.value)} style={inputStyle} placeholder="0.00" />
            </Field>
            <Field label="Ricavi effettivi €">
              <input type="number" step="0.01" min={0} value={revenueAct} onChange={e => setRevenueAct(e.target.value)} style={inputStyle} placeholder="0.00" />
            </Field>
          </div>
          {(budgetAct && revenueAct) && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: parseFloat(revenueAct) - parseFloat(budgetAct) >= 0 ? 'rgba(128,249,139,0.20)' : '#ffdad6',
              color: parseFloat(revenueAct) - parseFloat(budgetAct) >= 0 ? '#006e25' : '#93000a',
              fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Margine effettivo</span>
              <span>€ {(parseFloat(revenueAct) - parseFloat(budgetAct)).toFixed(2)}</span>
            </div>
          )}
        </Section>

        {/* TICKETING */}
        <Section title="Ticketing" icon="confirmation_number">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <Field label="Prezzo biglietto €">
              <input type="number" step="0.01" min={0} value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} style={inputStyle} placeholder="0.00" />
            </Field>
            <Field label="Link vendita biglietti">
              <input type="url" value={ticketUrl} onChange={e => setTicketUrl(e.target.value)} style={inputStyle} placeholder="https://…" />
            </Field>
          </div>
        </Section>

        {/* SPONSOR e contatti */}
        <Section title="Sponsor e contatti" icon="handshake">
          <Field label="Sponsor">
            <input value={sponsors} onChange={e => setSponsors(e.target.value)} style={inputStyle}
              placeholder="Es. Torino Vending, DM SRLs, …" />
          </Field>
          <Field label="Contatto referente esterno">
            <input value={contactName} onChange={e => setContactName(e.target.value)} style={inputStyle}
              placeholder="Nome referente" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Telefono">
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={inputStyle}
                placeholder="+39 …" />
            </Field>
            <Field label="Email">
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={inputStyle}
                placeholder="referente@…" />
            </Field>
          </div>
        </Section>

        {/* CHECKLIST */}
        <Section title="Checklist operativa" icon="checklist">
          {checklist.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {checklist.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  background: item.done ? 'rgba(128,249,139,0.15)' : '#f7f9ff', borderRadius: 6,
                }}>
                  <input type="checkbox" checked={item.done} onChange={() => {
                    const c = [...checklist]; c[i] = { ...c[i], done: !c[i].done }; setChecklist(c)
                  }} style={{ cursor: 'pointer' }} />
                  <span style={{ flex: 1, fontSize: 12.5, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#707882' : '#181c20' }}>{item.text}</span>
                  <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <Icon name="close" size={14} color="#ba1a1a" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
              style={{ ...inputStyle, flex: 1 }} placeholder="Nuova voce checklist…" />
            <button onClick={addChecklistItem}
              style={{
                padding: '0 14px', borderRadius: 10, border: 'none',
                background: '#005f98', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>+</button>
          </div>
        </Section>

        {/* NOTE */}
        <Field label="Note interne">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            placeholder="Note libere per te ed Enzo…" />
        </Field>

        {/* AZIONI */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {isEdit && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              style={{
                padding: '10px 14px', borderRadius: 10, border: 'none',
                background: '#ffdad6', color: '#93000a', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
              }}>
              <Icon name="delete" size={14} color="#93000a" />
              Elimina
            </button>
          )}
          {isEdit && confirmDelete && (
            <>
              <button onClick={handleDelete} disabled={deleting}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: 'none',
                  background: '#ba1a1a', color: '#fff', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
                }}>
                <Icon name="delete_forever" size={14} color="#fff" />
                Conferma
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid #c0c7d2',
                  background: '#fff', color: '#404751', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                }}>Annulla</button>
            </>
          )}
          <button onClick={handleSave} disabled={saving || confirmDelete}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
              background: '#005f98', color: '#fff', fontWeight: 800,
              cursor: 'pointer', fontSize: 14, opacity: saving ? 0.6 : 1,
            }}>
            {saving ? 'Salvataggio…' : (isEdit ? 'Salva modifiche' : 'Crea evento')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#5a6270', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {icon && <Icon name={icon} size={12} color="#5a6270" />}
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#404751', display: 'block', marginBottom: 3 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '1px solid #c0c7d2', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff',
}
