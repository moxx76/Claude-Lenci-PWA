import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import type { PlayerDetailData } from './PlayerDetailSheet'
import { AvatarUploader } from './AvatarUploader'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'
import { todayIT, dateIT } from '../lib/dateIT'
// v1.9.172: generatore PDF ricevute quote
import { downloadReceipt, type ClubSettings } from '../lib/receiptPdf'

// v1.9.173: 'Voucher Sportivo' aggiunto come metodo saldo (Comune di Poirino)
const PAYMENT_METHODS = ['Contanti', 'Bonifico', 'POS', 'Assegno', 'Carta', 'Voucher Sportivo', 'Altro'] as const

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
  // v1.9.172: metodo pagamento + numero ricevuta per acconto
  const [registrationMethod, setRegistrationMethod] = useState<string>('')
  const [registrationReceiptNo, setRegistrationReceiptNo] = useState<string>('')
  const [balancePaid, setBalancePaid] = useState(false)
  const [balancePaidAt, setBalancePaidAt] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  // v1.9.172: metodo pagamento + numero ricevuta per saldo
  const [balanceMethod, setBalanceMethod] = useState<string>('')
  const [balanceReceiptNo, setBalanceReceiptNo] = useState<string>('')
  const [paymentNotes, setPaymentNotes] = useState('')
  // v1.9.172: cache impostazioni società (per il PDF)
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null)
  const [generatingReceipt, setGeneratingReceipt] = useState<'acconto' | 'saldo' | null>(null)
  // v1.9.173: quota annuale, sconti e voucher sportivo del Comune
  const [annualFee, setAnnualFee] = useState<string>('')          // quota annua giocatore (es. 310)
  const [feeDiscount, setFeeDiscount] = useState<string>('')      // sconto (es. 50 per 2° figlio)
  const [feeDiscountReason, setFeeDiscountReason] = useState<string>('')
  const [hasVoucher, setHasVoucher] = useState<boolean>(false)    // voucher sportivo assegnato?
  const [voucherAmount, setVoucherAmount] = useState<string>('')  // importo voucher (default 220)
  const [voucherCode, setVoucherCode] = useState<string>('')      // codice/protocollo voucher
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parents, setParents] = useState<ParentOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fix 2026-10-14: finché il fetch dei campi non passati dal prop (notes,
  // parent_profile_id, pagamenti) non è completo, bloccare il Salva per
  // evitare che un click immediato ("Modifica → Salva" al volo) sovrascriva
  // le note esistenti a vuoto. In creazione (!isEdit) non serve, è già vuoto.
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('profiles').select('id, full_name, email').eq('role', 'parent').order('full_name')
      .then(({ data }) => setParents(data ?? []))
    // v1.9.172: carico impostazioni società per il PDF ricevuta
    if (canSeePayments) {
      supabase.from('club_settings').select('*').eq('id', 1).maybeSingle()
        .then(({ data }) => setClubSettings(data as any))
    }
  }, [open, canSeePayments])

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
      setAvatarUrl((player as any).avatarUrl || null)
      // notes e parent_profile_id NON SONO nel tipo PlayerDetailData e NON
      // sono passati nel prop dalla rosa — bug fix 2026-10-14: in passato
      // li leggevamo da `(player as any).*` che era SEMPRE undefined →
      // setNotes('') → payload.notes = null → UPDATE CANCELLAVA le note
      // esistenti. Idem per parent_profile_id. Ora li leggiamo direttamente
      // dal DB in questo stesso fetch, come già facciamo per i pagamenti.
      // Finché il fetch non completa, teniamo stringhe vuote: il bottone
      // Salva è attivo subito e un save prematuro resterebbe non peggiore
      // del comportamento precedente — ma di fatto il fetch si risolve
      // ampiamente prima che l'utente arrivi a cliccare.
      setNotes('')
      setParentProfileId('')
      setLoadingData(true)

      // Carico stato pagamenti, note, parent_profile_id e dati genitore
      // direttamente dal DB.
      // Review (assessment): richiedere le colonne payment_* solo se canSeePayments.
      // Prima venivano sempre selezionate anche quando canSeePayments era false;
      // rendering omesso in UI non equivale a non trasmettere il dato lato wire.
      // Ora chi non è admin NON riceve le colonne pagamento dal server.
      const paymentCols = canSeePayments
        ? 'registration_paid, registration_paid_at, registration_amount, registration_receipt_no, registration_payment_method, '
          + 'balance_paid, balance_paid_at, balance_amount, balance_receipt_no, balance_payment_method, '
          + 'payment_notes, '
          // v1.9.173: quota annuale + sconto + voucher
          + 'annual_fee, fee_discount, fee_discount_reason, has_voucher, voucher_amount, voucher_code, '
        : ''
      supabase.from('players')
        .select(paymentCols + 'notes, parent_profile_id, parent_name, parent_phone, parent_email')
        .eq('id', player.id).single()
        .then(({ data }) => {
          if (data) {
            if (canSeePayments) {
              setRegistrationPaid(!!(data as any).registration_paid)
              setRegistrationPaidAt((data as any).registration_paid_at || '')
              setRegistrationAmount((data as any).registration_amount != null ? String((data as any).registration_amount) : '')
              setRegistrationMethod((data as any).registration_payment_method || '')
              setRegistrationReceiptNo((data as any).registration_receipt_no || '')
              setBalancePaid(!!(data as any).balance_paid)
              setBalancePaidAt((data as any).balance_paid_at || '')
              setBalanceAmount((data as any).balance_amount != null ? String((data as any).balance_amount) : '')
              setBalanceMethod((data as any).balance_payment_method || '')
              setBalanceReceiptNo((data as any).balance_receipt_no || '')
              setPaymentNotes((data as any).payment_notes || '')
              // v1.9.173: quota annuale, sconto, voucher
              setAnnualFee((data as any).annual_fee != null ? String((data as any).annual_fee) : '')
              setFeeDiscount((data as any).fee_discount != null ? String((data as any).fee_discount) : '')
              setFeeDiscountReason((data as any).fee_discount_reason || '')
              setHasVoucher(!!(data as any).has_voucher)
              setVoucherAmount((data as any).voucher_amount != null ? String((data as any).voucher_amount) : '')
              setVoucherCode((data as any).voucher_code || '')
            }
            setNotes((data as any).notes || '')
            setParentProfileId((data as any).parent_profile_id || '')
            setParentName((data as any).parent_name || '')
            setParentPhone((data as any).parent_phone || '')
            setParentEmail((data as any).parent_email || '')
          }
          setLoadingData(false)
        })
    } else {
      // Modalità creazione
      setFirstName(''); setLastName(''); setBirthDate('')
      setPosition(''); setJerseyNumber(''); setCardNumber('')
      setMedicalExpiry(''); setFiscalCode(''); setNotes('')
      setParentProfileId('')
      setAvatarUrl(null)
      setRegistrationPaid(false); setRegistrationPaidAt(''); setRegistrationAmount('')
      setRegistrationMethod(''); setRegistrationReceiptNo('')
      setBalancePaid(false); setBalancePaidAt(''); setBalanceAmount('')
      setBalanceMethod(''); setBalanceReceiptNo('')
      setPaymentNotes('')
      // v1.9.173: quota annuale, sconto, voucher
      setAnnualFee(''); setFeeDiscount(''); setFeeDiscountReason('')
      setHasVoucher(false); setVoucherAmount(''); setVoucherCode('')
      setParentName(''); setParentPhone(''); setParentEmail('')
    }
    setError(null)
  }, [player, open])

  if (!open || (!player && !createInTeamId)) return null

  // v1.9.172: chiede al server il prossimo numero ricevuta progressivo dell'anno.
  // Progressivo globale su tutta la società (acconti + saldi), formato NNNN/YYYY.
  // Se l'anno di riferimento è quello della data del pagamento (altrimenti oggi).
  const requestAutoReceiptNo = async (tipo: 'acconto' | 'saldo'): Promise<string | null> => {
    const refDate = tipo === 'acconto' ? registrationPaidAt : balancePaidAt
    const year = (refDate && /^\d{4}-/.test(refDate)) ? parseInt(refDate.slice(0, 4), 10) : new Date().getFullYear()
    const { data, error } = await supabase.rpc('next_receipt_number', { p_year: year })
    if (error) { console.error(error); return null }
    return typeof data === 'string' ? data : null
  }

  // v1.9.172: scarica la ricevuta PDF di acconto o saldo
  const handleDownloadReceipt = async (tipo: 'acconto' | 'saldo') => {
    if (!clubSettings) {
      setError('Impostazioni società non caricate — apri /admin/impostazioni-societa per configurarle')
      return
    }
    const isAcconto = tipo === 'acconto'
    const receiptNo = isAcconto ? registrationReceiptNo : balanceReceiptNo
    const paidAt = isAcconto ? registrationPaidAt : balancePaidAt
    const amount = isAcconto ? registrationAmount : balanceAmount
    const method = isAcconto ? registrationMethod : balanceMethod
    if (!receiptNo.trim()) { setError('Manca il numero ricevuta'); return }
    if (!paidAt) { setError('Manca la data di pagamento'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Importo non valido'); return }
    if (!method) { setError('Specifica il metodo di pagamento'); return }
    setGeneratingReceipt(tipo)
    try {
      // Stagione sportiva: se mese >= 7 → anno/anno+1, altrimenti anno-1/anno
      const d = new Date(paidAt)
      const y = d.getFullYear()
      const stagione = d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
      // Nome squadra: dall'oggetto player se disponibile (in creazione non esiste)
      const squadra = (player as any)?.teamName || (player as any)?.team?.name || 'Settore giovanile'
      downloadReceipt({
        tipo,
        numero: receiptNo.trim(),
        data: paidAt,
        importo: parseFloat(amount),
        metodo: method,
        giocatoreNome: firstName.trim(),
        giocatoreCognome: lastName.trim(),
        giocatoreCF: fiscalCode.trim() || null,
        squadra,
        stagione,
        settings: clubSettings,
      })
    } catch (e: any) {
      setError('Errore generazione PDF: ' + (e?.message || String(e)))
    } finally {
      setGeneratingReceipt(null)
    }
  }

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
          registration_payment_method: registrationPaid ? (registrationMethod || null) : null,
          registration_receipt_no: registrationPaid ? (registrationReceiptNo.trim() || null) : null,
          balance_paid: balancePaid,
          balance_paid_at: balancePaid && balancePaidAt ? balancePaidAt : null,
          balance_amount: balanceAmount ? parseFloat(balanceAmount) : null,
          balance_payment_method: balancePaid ? (balanceMethod || null) : null,
          balance_receipt_no: balancePaid ? (balanceReceiptNo.trim() || null) : null,
          payment_notes: paymentNotes.trim() || null,
          // v1.9.173: quota annuale + sconto + voucher
          annual_fee: annualFee ? parseFloat(annualFee) : null,
          fee_discount: feeDiscount ? parseFloat(feeDiscount) : 0,
          fee_discount_reason: feeDiscountReason.trim() || null,
          has_voucher: hasVoucher,
          voucher_amount: hasVoucher && voucherAmount ? parseFloat(voucherAmount) : null,
          voucher_code: hasVoucher ? (voucherCode.trim() || null) : null,
        } : {}),
      }
      if (isEdit) {
        // Silent-fail RLS pattern: senza .select('id') un UPDATE bloccato
        // dalle policy torna {error:null, data:null} e il flusso dice
        // "salvato" senza che il DB cambi (sintomo riportato 2026-10-07
        // sulla scadenza visita medica che "non si salvava"). Il .select
        // forza RETURNING: 0 righe => errore esplicito.
        const { data, error: err } = await supabase
          .from('players')
          .update(payload)
          .eq('id', player!.id)
          .select('id')
        if (err) throw err
        if (!data || data.length === 0) {
          throw new Error('Modifica non salvata: nessuna riga aggiornata (permessi insufficienti sul giocatore o giocatore eliminato)')
        }
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
              : medicalExpiry < todayIT() ? 'rgba(255,218,214,0.6)'
              : 'rgba(128,249,139,0.15)',
            border: `1px solid ${!medicalExpiry ? '#f4b0f0'
              : medicalExpiry < todayIT() ? '#ffbdb6'
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
                  setMedicalExpiry(dateIT(d))
                }}
                style={quickBtn}
              >+1 anno da oggi</button>
              <button type="button"
                onClick={() => {
                  const d = new Date()
                  d.setMonth(d.getMonth() + 6)
                  setMedicalExpiry(dateIT(d))
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
                : medicalExpiry < todayIT()
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

          {/* v1.9.173: QUOTA ANNUALE + SCONTI + VOUCHER + RIEPILOGO
              Default quota viene da club_settings.default_annual_fee (310€).
              Sconto p.es. per iscrizione del secondo figlio.
              Voucher sportivo del Comune di Poirino (default 220€), editabile. */}
          {(() => {
            const defaultFee = Number(clubSettings?.default_annual_fee ?? 310)
            const defaultVoucher = Number(clubSettings?.default_voucher_amount ?? 220)
            const fee = annualFee ? parseFloat(annualFee) : defaultFee
            const disc = feeDiscount ? parseFloat(feeDiscount) : 0
            const vA = hasVoucher ? (voucherAmount ? parseFloat(voucherAmount) : defaultVoucher) : 0
            const paidReg = registrationPaid && registrationAmount ? parseFloat(registrationAmount) : 0
            const paidBal = balancePaid && balanceAmount ? parseFloat(balanceAmount) : 0
            const netQuota = Math.max(0, fee - disc)
            const totPaid = paidReg + paidBal
            const residuo = netQuota - totPaid
            return (
              <div style={{
                background: '#fffaf0', border: '1px dashed #e8b96b',
                borderRadius: 10, padding: 10, marginBottom: 12,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8a5a10', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  📊 Quota annuale
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Quota €</div>
                    <input type="number" step="0.01" min="0" value={annualFee}
                      onChange={e => setAnnualFee(e.target.value)}
                      placeholder={String(defaultFee)}
                      style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Sconto €</div>
                    <input type="number" step="0.01" min="0" value={feeDiscount}
                      onChange={e => setFeeDiscount(e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                  </div>
                  {disc > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Motivo sconto</div>
                      <input type="text" value={feeDiscountReason}
                        onChange={e => setFeeDiscountReason(e.target.value)}
                        placeholder="es. 2° figlio, convenzione, ecc."
                        style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                    </div>
                  )}
                </div>

                {/* Voucher Sportivo Comune */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e8b96b' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={hasVoucher}
                      onChange={e => {
                        const v = e.target.checked
                        setHasVoucher(v)
                        // auto-popola importo con default quando si spunta per la prima volta
                        if (v && !voucherAmount) setVoucherAmount(String(defaultVoucher))
                      }}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8b96b' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#181c20' }}>
                      🎟 {clubSettings?.voucher_label || 'Voucher Sportivo Comune di Poirino'}
                    </span>
                  </label>
                  {hasVoucher && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, paddingLeft: 26, marginTop: 6 }}>
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Importo €</div>
                        <input type="number" step="0.01" min="0" value={voucherAmount}
                          onChange={e => setVoucherAmount(e.target.value)}
                          placeholder={String(defaultVoucher)}
                          style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Codice / protocollo (opz.)</div>
                        <input type="text" value={voucherCode}
                          onChange={e => setVoucherCode(e.target.value)}
                          placeholder="es. VS-2026-00123"
                          style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Riepilogo */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e8b96b', fontSize: 11.5, color: '#404751', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3 }}>
                  <div>Quota piena</div><div style={{ textAlign: 'right' }}>€ {fee.toFixed(2)}</div>
                  {disc > 0 && (<><div style={{ color: '#2e7d32' }}>− Sconto{feeDiscountReason ? ` (${feeDiscountReason})` : ''}</div><div style={{ textAlign: 'right', color: '#2e7d32' }}>− € {disc.toFixed(2)}</div></>)}
                  <div style={{ fontWeight: 800 }}>Quota da saldare</div><div style={{ textAlign: 'right', fontWeight: 800 }}>€ {netQuota.toFixed(2)}</div>
                  {paidReg > 0 && (<><div style={{ color: '#707882' }}>· Acconto versato</div><div style={{ textAlign: 'right', color: '#707882' }}>€ {paidReg.toFixed(2)}</div></>)}
                  {paidBal > 0 && (<><div style={{ color: '#707882' }}>· Saldo versato{hasVoucher && (balanceMethod || '').toLowerCase().includes('voucher') ? ' (voucher)' : ''}</div><div style={{ textAlign: 'right', color: '#707882' }}>€ {paidBal.toFixed(2)}</div></>)}
                  <div style={{ fontWeight: 800, color: residuo <= 0 ? '#2e7d32' : '#c62828', borderTop: '1px solid #e8b96b', paddingTop: 4, marginTop: 2 }}>
                    {residuo <= 0 ? '✓ Saldato' : 'Residuo'}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: residuo <= 0 ? '#2e7d32' : '#c62828', borderTop: '1px solid #e8b96b', paddingTop: 4, marginTop: 2 }}>
                    € {Math.max(0, residuo).toFixed(2)}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ACCONTO / ISCRIZIONE */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
              <input type="checkbox" checked={registrationPaid}
                onChange={e => {
                  setRegistrationPaid(e.target.checked)
                  if (e.target.checked && !registrationPaidAt) {
                    setRegistrationPaidAt(todayIT())
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
                {/* v1.9.172: metodo pagamento */}
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Metodo</div>
                  <select value={registrationMethod} onChange={e => setRegistrationMethod(e.target.value)}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }}>
                    <option value="">— seleziona —</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {/* v1.9.172: numero ricevuta + bottone auto */}
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>N° Ricevuta</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="text" value={registrationReceiptNo}
                      onChange={e => setRegistrationReceiptNo(e.target.value)}
                      placeholder="0001/2026"
                      style={{ ...inputStyle, padding: '8px 10px', fontSize: 12, flex: 1 }} />
                    <button type="button" onClick={async () => {
                      const n = await requestAutoReceiptNo('acconto')
                      if (n) setRegistrationReceiptNo(n)
                    }}
                      style={{
                        padding: '8px 10px', fontSize: 11, fontWeight: 700,
                        background: '#005f98', color: '#fff', border: 0, borderRadius: 8,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                      title="Genera il prossimo numero progressivo dell'anno">
                      Auto
                    </button>
                  </div>
                </div>
                {/* v1.9.172: pulsante download PDF ricevuta */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="button"
                    onClick={() => handleDownloadReceipt('acconto')}
                    disabled={generatingReceipt === 'acconto' || !registrationReceiptNo || !registrationPaidAt || !registrationAmount || !registrationMethod}
                    style={{
                      width: '100%', padding: '9px 10px', fontSize: 12, fontWeight: 700,
                      background: '#00838f', color: '#fff', border: 0, borderRadius: 8,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: (!registrationReceiptNo || !registrationPaidAt || !registrationAmount || !registrationMethod) ? 0.5 : 1,
                    }}>
                    <Icon name="picture_as_pdf" size={14} color="#fff" />
                    {generatingReceipt === 'acconto' ? 'Generazione…' : 'Scarica ricevuta PDF (acconto)'}
                  </button>
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
                    setBalancePaidAt(todayIT())
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
                {/* v1.9.172/173: metodo pagamento — selezionando 'Voucher Sportivo'
                    auto-popola importo con il voucher del giocatore (o il default club_settings),
                    e marca has_voucher a true se non lo era già. */}
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>Metodo</div>
                  <select value={balanceMethod} onChange={e => {
                    const m = e.target.value
                    setBalanceMethod(m)
                    if (m === 'Voucher Sportivo') {
                      if (!hasVoucher) setHasVoucher(true)
                      const defV = Number(clubSettings?.default_voucher_amount ?? 220)
                      const v = voucherAmount ? parseFloat(voucherAmount) : defV
                      // Se l'importo saldo è vuoto o zero, metti il voucher; altrimenti rispetta
                      if (!balanceAmount || parseFloat(balanceAmount) === 0) setBalanceAmount(String(v))
                      if (!voucherAmount) setVoucherAmount(String(defV))
                    }
                  }}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }}>
                    <option value="">— seleziona —</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {/* v1.9.172: numero ricevuta + bottone auto */}
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#707882', textTransform: 'uppercase', marginBottom: 3 }}>N° Ricevuta</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="text" value={balanceReceiptNo}
                      onChange={e => setBalanceReceiptNo(e.target.value)}
                      placeholder="0002/2026"
                      style={{ ...inputStyle, padding: '8px 10px', fontSize: 12, flex: 1 }} />
                    <button type="button" onClick={async () => {
                      const n = await requestAutoReceiptNo('saldo')
                      if (n) setBalanceReceiptNo(n)
                    }}
                      style={{
                        padding: '8px 10px', fontSize: 11, fontWeight: 700,
                        background: '#005f98', color: '#fff', border: 0, borderRadius: 8,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                      title="Genera il prossimo numero progressivo dell'anno">
                      Auto
                    </button>
                  </div>
                </div>
                {/* v1.9.172: pulsante download PDF ricevuta */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="button"
                    onClick={() => handleDownloadReceipt('saldo')}
                    disabled={generatingReceipt === 'saldo' || !balanceReceiptNo || !balancePaidAt || !balanceAmount || !balanceMethod}
                    style={{
                      width: '100%', padding: '9px 10px', fontSize: 12, fontWeight: 700,
                      background: '#00838f', color: '#fff', border: 0, borderRadius: 8,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: (!balanceReceiptNo || !balancePaidAt || !balanceAmount || !balanceMethod) ? 0.5 : 1,
                    }}>
                    <Icon name="picture_as_pdf" size={14} color="#fff" />
                    {generatingReceipt === 'saldo' ? 'Generazione…' : 'Scarica ricevuta PDF (saldo)'}
                  </button>
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
            disabled={saving || deleting || loadingData}
            title={loadingData ? 'Caricamento dati in corso...' : undefined}
            style={{
              flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: '#005f98', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || deleting || loadingData) ? 0.6 : 1,
            }}
          >
            <Icon name={isEdit ? 'save' : 'person_add'} size={16} color="#fff" />
            {saving ? 'Salvo…' : loadingData ? 'Caricamento…' : (isEdit ? 'Salva modifiche' : 'Aggiungi giocatore')}
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
