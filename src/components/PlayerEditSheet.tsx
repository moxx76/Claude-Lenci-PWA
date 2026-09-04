import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import type { PlayerDetailData } from './PlayerDetailSheet'
import { AvatarUploader } from './AvatarUploader'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'

interface PlayerEditSheetProps {
  open: boolean
  onClose: () => void
  player: PlayerDetailData | null
  createInTeamId?: string // Se presente e player=null, apre in modalità creazione
  onSaved?: () => void
  onDeleted?: () => void
}

interface ParentOption { id: string; full_name: string | null; email: string }

const POSITIONS = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante']

export function PlayerEditSheet({ open, onClose, player, createInTeamId, onSaved, onDeleted }: PlayerEditSheetProps) {
  const { profile } = useAuth()
  const canSeePayments = isAdmin(profile?.role)
  const isEdit = !!player
  const isCreate = !player && !!createInTeamId
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [position, setPosition] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState<string>('')
  const [cardNumber, setCardNumber] = useState<string>('')
  const [medicalExpiry, setMedicalExpiry] = useState('')
  const [fiscalCode, setFiscalCode] = useState('')
  const [notes, setNotes] = useState('')
  const [parentProfileId, setParentProfileId] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [registrationPaid, setRegistrationPaid] = useState(false)
  const [registrationPaidAt, setRegistrationPaidAt] = useState('')
  const [registrationAmount, setRegistrationAmount] = useState('')
  const [balancePaid, setBalancePaid] = useState(false)
  const [balancePaidAt, setBalancePaidAt] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parents, setParents] = useState<ParentOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    supabase.from('profiles').select('id, full_name, email').eq('role', 'parent').order('full_name')
      .then(({ data }) => setParents(data ?? []))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (player) {
      setFirstName(player.firstName || '')
      setLastName(player.lastName || '')
      setBirthDate(player.birthDate || '')
      setPosition(player.position || '')
      setJerseyNumber(player.jerseyNumber != null ? String(player.jerseyNumber) : '')
      setCardNumber(player.cardNumber || '')
      setMedicalExpiry(player.medicalExpiry || '')
      setFiscalCode(player.fiscalCode || '')
      setNotes((player as any).notes || '')
      setParentProfileId((player as any).parentProfileId || '')
      setAvatarUrl((player as any).avatarUrl || null)

      // Carico stato pagamenti e dati genitore diretti dal DB
      supabase.from('players')
        .select('registration_paid, registration_paid_at, registration_amount, balance_paid, balance_paid_at, balance_amount, payment_notes, parent_name, parent_phone, parent_email')
        .eq('id', player.id).single()
        .then(({ data }) => {
          if (data) {
            setRegistrationPaid(!!data.registration_paid)
            setRegistrationPaidAt(data.registration_paid_at || '')
            setRegistrationAmount(data.registration_amount != null ? String(data.registration_amount) : '')
            setBalancePaid(!!data.balance_paid)
            setBalancePaidAt(data.balance_paid_at || '')
            setBalanceAmount(data.balance_amount != null ? String(data.balance_amount) : '')
            setPaymentNotes(data.payment_notes || '')
            setParentName(data.parent_name || '')
            setParentPhone(data.parent_phone || '')
            setParentEmail(data.parent_email || '')
          }
        })
    } else {
      // Modalità creazione
      setFirstName(''); setLastName(''); setBirthDate('')
      setPosition(''); setJerseyNumber(''); setCardNumber('')
      setMedicalExpiry(''); setFiscalCode(''); setNotes('')
      setParentProfileId('')
      setAvatarUrl(null)
      setRegistrationPaid(false); setRegistrationPaidAt(''); setRegistrationAmount('')
      setBalancePaid(false); setBalancePaidAt(''); setBalanceAmount('')
      setPaymentNotes('')
      setParentName(''); setParentPhone(''); setParentEmail('')
    }
    setError(null)
  }, [player, open])

  if (!open || (!player && !createInTeamId)) return null

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !birthDate) {
      setError('Nome, cognome e data di nascita sono obbligatori')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        position: position || null,
        jersey_number: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
        card_number: cardNumber.trim() || null,
        medical_expiry: medicalExpiry || null,
        fiscal_code: fiscalCode.trim().toUpperCase() || null,
        notes: notes.trim() || null,
        parent_profile_id: parentProfileId || null,
        parent_name: parentName.trim() || null,
        parent_phone: parentPhone.trim() || null,
        parent_email: parentEmail.trim() || null,
        avatar_url: avatarUrl,
        ...(canSeePayments ? {
          registration_paid: registrationPaid,
          registration_paid_at: registrationPaid && registrationPaidAt ? registrationPaidAt : null,
          registration_amount: registrationAmount ? parseFloat(registrationAmount) : null,
          balance_paid: balancePaid,
          balance_paid_at: balancePaid && balancePaidAt ? balancePaidAt : null,
          balance_amount: balanceAmount ? parseFloat(balanceAmount) : null,
          payment_notes: paymentNotes.trim() || null,
        } : {}),
      }
      if (isEdit) {
        const { error: err } = await supabase.from('players').update(payload).eq('id', player!.id)
        if (err) throw err
      } else {
        payload.team_id = createInTeamId
        const { error: err } = await supabase.from('players').insert(payload)
        if (err) throw err
      }
      onSaved?.()
      onClose()
    } catch (e: any) {
      setError('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!player) return
    if (!confirm(`Vuoi eliminare "${player.firstName} ${player.lastName}"?\n\nATTENZIONE: verranno rimossi anche presenze, convocazioni, valutazioni collegate. Irreversibile.`)) return
    setDeleting(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('players').delete().eq('id', player.id)
      if (err) throw err
      onDeleted?.()
      onClose()
    } catch (e: any) {
      setError('Errore eliminazione: ' + (e.message || 'sconosciuto'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Modifica giocatore' : 'Nuovo giocatore'}>
      <div style={{ padding: '4px 20px 24px' }}>
        {isEdit && (
          <p style={{ fontSize: 12, color: '#707882', margin: '0 0 16px' }}>
            Aggiorna i dati anagrafici e di tesseramento di <strong>{player!.firstName} {player!.lastName}</strong>.
          </p>
        )}
        {isCreate && (
          <p style={{ fontSize: 12, color: '#707882', margin: '0 0 16px' }}>
            Compila i dati del nuovo giocatore. Verrà aggiunto direttamente alla rosa.
          </p>
        )}

        <div style={{
          background: 'rgba(0,120,191,0.06)', border: '1px solid #cfe5ff',
          borderRadius: 10, padding: '9px 12px', marginBottom: 14,
          fontSize: 11.5, color: '#004a78', lineHeight: 1.4,
        }}>
          <Icon name="info" size={13} color="#005f98" style={{ verticalAlign: -2, marginRight: 4 }} />
          <strong>N° Maglia</strong> e <strong>Matricola FIGC</strong> compaiono automaticamente nella distinta arbitro.
        </div>

        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a',
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          }}>
            <Icon name="error" size={16} color="#93000a" />
            {error}
          </div>
        )}

        {/* Foto giocatore (solo in modifica: serve id per storage path) */}
        {isEdit && player && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AvatarUploader
              currentUrl={avatarUrl}
              displayName={`${firstName} ${lastName}`}
              entityKind="player"
              entityId={player.id}
              size={90}
              onUploaded={(url) => {
                setAvatarUrl(url)
                // Salvo subito su DB per persistere immediatamente
                supabase.from('players').update({ avatar_url: url }).eq('id', player.id)
              }}
              onRemoved={() => {
                setAvatarUrl(null)
                supabase.from('players').update({ avatar_url: null }).eq('id', player.id)
              }}
            />
          </div>
        )}

        {/* Nome + Cognome */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Nome *">
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Cognome *">
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Data di nascita */}
        <Field label="Data di nascita *">
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        {/* Ruolo */}
        <Field label="Ruolo">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            {POSITIONS.map(pos => {
              const active = position === pos
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPosition(active ? '' : pos)}
                  style={{
                    padding: '10px', borderRadius: 10,
                    border: active ? '2px solid #005f98' : '1px solid #c0c7d2',
                    background: active ? '#cfe5ff' : '#fff',
                    color: active ? '#004a78' : '#404751',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {pos}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Numero maglia + Matricola FIGC */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <Field label="N° Maglia">
            <input
              type="number"
              min={1}
              max={99}
              value={jerseyNumber}
              onChange={e => setJerseyNumber(e.target.value)}
              placeholder="10"
              style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
            />
          </Field>
          <Field label="Matricola FIGC">
            <input
              value={cardNumber}
              onChange={e => setCardNumber(e.target.value.replace(/\s+/g, ''))}
              placeholder="es. 1234567"
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
          </Field>
        </div>

        {/* Codice fiscale */}
        <Field label="Codice fiscale (documento identità)">
          <input
            value={fiscalCode}
            onChange={e => setFiscalCode(e.target.value.toUpperCase())}
            placeholder="es. RSSMRA13H15L219X"
            maxLength={16}
            style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
        </Field>

        {/* Scadenza certificato medico */}
        <Field label="Scadenza certificato medico">
          <div style={{
            padding: 10, borderRadius: 10,
            background: !medicalExpiry ? 'rgba(244,208,242,0.35)'
              : medicalExpiry < new Date().toISOString().slice(0, 10) ? 'rgba(255,218,214,0.6)'
              : 'rgba(128,249,139,0.15)',
            border: `1px solid ${!medicalExpiry ? '#f4b0f0'
              : medicalExpiry < new Date().toISOString().slice(0, 10) ? '#ffbdb6'
              : '#80f98b'}`,
            marginBottom: 4,
          }}>
            <input
              type="date"
              value={medicalExpiry}
              onChange={e => setMedicalExpiry(e.target.value)}
              style={{ ...inputStyle, marginBottom: 6 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button"
                onClick={() => {
                  const d = new Date()
                  d.setFullYear(d.getFullYear() + 1)
                  setMedicalExpiry(d.toISOString().slice(0, 10))
                }}
                style={quickBtn}
              >+1 anno da oggi</button>
              <button type="button"
                onClick={() => {
                  const d = new Date()
                  d.setMonth(d.getMonth() + 6)
                  setMedicalExpiry(d.toISOString().slice(0, 10))
                }}
                style={quickBtn}
              >+6 mesi</button>
              {medicalExpiry && (
                <button type="button" onClick={() => setMedicalExpiry('')}
                  style={{ ...quickBtn, color: '#93000a' }}
                >Svuota</button>
              )}
            </div>
            <p style={{ fontSize: 10.5, color: '#404751', margin: '6px 0 0', lineHeight: 1.35 }}>
              {!medicalExpiry
                ? '⚠️ Nessuna visita medica registrata. Inserisci la data di scadenza per mettere in bonis il giocatore.'
                : medicalExpiry < new Date().toISOString().slice(0, 10)
                  ? '⚠️ Certificato scaduto — aggiorna la data della nuova visita.'
                  : '✅ Giocatore in regola per la stagione.'}
            </p>
          </div>
        </Field>

        {/* Contatti genitore/referente (sempre visibili) */}
        <div style={{
          marginTop: 4, marginBottom: 12,
          background: '#f7fdf9', border: '1.5px solid #d5eddb',
          borderRadius: 12, padding: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            paddingBottom: 6, borderBottom: '1px solid #d5eddb',
          }}>
            <Icon name="contacts" size={14} color="#2e7d32" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Contatti Genitore/Referente
            </span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Nome e cognome</div>
            <input type="text" value={parentName}
              onChange={e => setParentName(e.target.value)}
              placeholder="Es. Mario Rossi"
              style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Telefono</div>
              <input type="tel" value={parentPhone}
                onChange={e => setParentPhone(e.target.value)}
                placeholder="Es. +39 333 1234567"
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
            </div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Email</div>
              <input type="email" value={parentEmail}
                onChange={e => setParentEmail(e.target.value)}
                placeholder="mario.rossi@esempio.it"
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
            </div>
          </div>

          <div style={{
            fontSize: 10, color: '#707882', fontStyle: 'italic', lineHeight: 1.4, marginTop: 4,
          }}>
            💡 Se il genitore ha un account nell'app, associalo qui sotto per abilitare notifiche e risposte automatiche
          </div>
        </div>

        {/* Genitore associato (con account) */}
        <Field label="Genitore associato con account (opzionale)">
          <select value={parentProfileId}
            onChange={e => setParentProfileId(e.target.value)}
            style={inputStyle}>
            <option value="">— Nessun account collegato —</option>
            {parents.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </Field>

        {/* ============= PAGAMENTI (solo admin/segreteria) ============= */}
        {canSeePayments && (
        <div style={{
          marginTop: 4, marginBottom: 12,
          background: '#f7f9ff', border: '1.5px solid #d5e5ff',
          borderRadius: 12, padding: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            paddingBottom: 6, borderBottom: '1px solid #d5e5ff',
          }}>
            <Icon name="euro" size={14} color="#00838f" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pagamenti quote
            </span>
          </div>

          {/* ACCONTO / ISCRIZIONE */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
              <input type="checkbox" checked={registrationPaid}
                onChange={e => {
                  setRegistrationPaid(e.target.checked)
                  if (e.target.checked && !registrationPaidAt) {
                    setRegistrationPaidAt(new Date().toISOString().slice(0, 10))
                  }
                }}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#00838f' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                💰 Acconto / Iscrizione versata
              </span>
            </label>
            {registrationPaid && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 26 }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Data</div>
                  <input type="date" value={registrationPaidAt}
                    onChange={e => setRegistrationPaidAt(e.target.value)}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Importo €</div>
                  <input type="number" step="0.01" min="0" value={registrationAmount}
                    onChange={e => setRegistrationAmount(e.target.value)}
                    placeholder="150.00"
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                </div>
              </div>
            )}
          </div>

          {/* SALDO */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
              <input type="checkbox" checked={balancePaid}
                onChange={e => {
                  setBalancePaid(e.target.checked)
                  if (e.target.checked && !balancePaidAt) {
                    setBalancePaidAt(new Date().toISOString().slice(0, 10))
                  }
                }}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#00838f' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                💰 Saldo versato
              </span>
            </label>
            {balancePaid && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 26 }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Data</div>
                  <input type="date" value={balancePaidAt}
                    onChange={e => setBalancePaidAt(e.target.value)}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Importo €</div>
                  <input type="number" step="0.01" min="0" value={balanceAmount}
                    onChange={e => setBalanceAmount(e.target.value)}
                    placeholder="300.00"
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                </div>
              </div>
            )}
          </div>

          {/* NOTE PAGAMENTO */}
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>
              Note (metodo pagamento, rate, ecc.)
            </div>
            <textarea value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              rows={2}
              placeholder="Es. Bonifico 15/09, ricevuta n. 42, rateizzato in 3 mesi..."
              style={{ ...inputStyle, padding: '8px 10px', fontSize: 12, resize: 'vertical' }} />
          </div>
        </div>
        )}

        {/* Note (giocatore, non pagamento) */}
        <Field label="Note">
          <textarea value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Note su infortuni, particolarità, ecc."
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
        </Field>

        {/* Buttons */}
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
            <Icon name={isEdit ? 'save' : 'person_add'} size={16} color="#fff" />
            {saving ? 'Salvo…' : (isEdit ? 'Salva modifiche' : 'Aggiungi giocatore')}
          </button>
        </div>

        {isEdit && (
          <button onClick={handleDelete} disabled={saving || deleting}
            style={{
              marginTop: 12, width: '100%', padding: '12px 18px', borderRadius: 12,
              border: '1.5px solid #ba1a1a', background: '#fff', color: '#ba1a1a',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting) ? 0.6 : 1,
            }}>
            <Icon name="delete" size={15} color="#ba1a1a" />
            {deleting ? 'Elimino…' : 'Elimina giocatore'}
          </button>
        )}
      </div>
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

const quickBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 7,
  background: '#fff', border: '1px solid #c0c7d2',
  color: '#005f98', fontSize: 11, fontWeight: 700,
  cursor: 'pointer',
}
