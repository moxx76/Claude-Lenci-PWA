/**
 * Pagina admin per la gestione del Lenci Pass.
 *
 * - Elenco titolari (anche sospesi), con URL del tag NFC + QR code pronto per
 *   la programmazione del tag con l'app "NFC Tools" (Android/iOS).
 * - Pulsanti: copia URL, sospendi/riattiva, elimina.
 * - Form rapido per aggiungere un nuovo titolare (first_name, last_name, note).
 *
 * Accesso: solo admin loggati (controllo da profile.role).
 * Writes governati da RLS M31 (admin_write).
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'
import { Icon } from '../components/Icon'

interface Holder {
  id: string
  first_name: string
  last_name: string
  note: string | null
  enabled: boolean
  nfc_token: string
  nfc_tag_uid: string | null
  issued_at: string
}

export function AdminPass() {
  const { profile } = useAuth()
  const canManage = isAdmin(profile?.role)

  const [rows, setRows] = useState<Holder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Form nuovo titolare
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newNote, setNewNote] = useState('')

  // URL pubblico di verifica (match con la route /pass/v/:token)
  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://lenci-poirino-app.netlify.app'
    return `${window.location.protocol}//${window.location.host}`
  }, [])
  const urlFor = (token: string) => `${baseUrl}/pass/v/${token}`

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('lenci_pass_holders')
        .select('id, first_name, last_name, note, enabled, nfc_token, nfc_tag_uid, issued_at')
        .order('enabled', { ascending: false })
        .order('last_name', { ascending: true })
      if (err) throw err
      setRows((data ?? []) as Holder[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!canManage) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#707882' }}>
        <h2>Area riservata</h2>
        <p>Accesso consentito solo agli amministratori.</p>
      </div>
    )
  }

  const toggleEnabled = async (h: Holder) => {
    setBusyId(h.id)
    try {
      await supabase.from('lenci_pass_holders')
        .update({ enabled: !h.enabled, updated_at: new Date().toISOString() })
        .eq('id', h.id)
      await load()
    } finally { setBusyId(null) }
  }

  const removeHolder = async (h: Holder) => {
    if (!confirm(`Rimuovere definitivamente ${h.last_name} ${h.first_name} dal Lenci Pass?\n\nIl tag NFC esistente diventerà "NON VALIDO".`)) return
    setBusyId(h.id)
    try {
      await supabase.from('lenci_pass_holders').delete().eq('id', h.id)
      await load()
    } finally { setBusyId(null) }
  }

  const addHolder = async () => {
    if (!newFirst.trim() || !newLast.trim()) {
      alert('Nome e cognome sono obbligatori.')
      return
    }
    try {
      const { error: err } = await supabase.from('lenci_pass_holders').insert({
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        note: newNote.trim() || null,
      })
      if (err) throw err
      setNewFirst(''); setNewLast(''); setNewNote('')
      await load()
    } catch (e) {
      alert('Errore: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const copyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); alert('URL copiato negli appunti') }
    catch { prompt('Copia manualmente l\'URL:', url) }
  }

  return (
    <div style={{ padding: '16px 14px 24px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: 'Anybody, sans-serif', color: '#b3005c' }}>
          🎟️ Lenci Pass — gestione
        </h1>
        <Link to="/pass" style={{
          marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
          background: '#f1f3fa', color: '#404751', textDecoration: 'none',
          fontSize: 12, fontWeight: 700,
        }}>Vista pubblica</Link>
      </div>

      {/* Form nuovo titolare */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: '#fff', border: '1px solid #e6e8ee', marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#181c20', marginBottom: 8 }}>
          Aggiungi titolare
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 8 }}>
          <input placeholder="Nome" value={newFirst} onChange={e => setNewFirst(e.target.value)} style={inputStyle} />
          <input placeholder="Cognome" value={newLast} onChange={e => setNewLast(e.target.value)} style={inputStyle} />
          <input placeholder="Nota (es. Direttore Commerciale, Sponsor…)" value={newNote} onChange={e => setNewNote(e.target.value)} style={inputStyle} />
          <button onClick={addHolder} style={primaryBtn}>+ Aggiungi</button>
        </div>
      </div>

      {loading && <div style={{ padding: 20, color: '#707882' }}>Caricamento…</div>}
      {error && <div style={{ padding: 12, background: '#ffe4e4', color: '#7a0000', borderRadius: 8, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Lista titolari con QR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(h => {
          const url = urlFor(h.nfc_token)
          return (
            <div key={h.id} style={{
              padding: 14, borderRadius: 12,
              background: '#fff', border: `1px solid ${h.enabled ? '#e6e8ee' : '#f0c040'}`,
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'start',
            }}>
              {/* QR */}
              <div style={{
                padding: 8, background: '#fff', borderRadius: 8,
                border: '1px solid #e6e8ee',
              }}>
                <QRCodeSVG value={url} size={120} level="M" />
              </div>

              {/* Dati + azioni */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#181c20' }}>
                    {h.last_name} {h.first_name}
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999,
                    background: h.enabled ? 'rgba(0,110,37,0.1)' : 'rgba(142,99,0,0.15)',
                    color: h.enabled ? '#006e25' : '#8e6300',
                    fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
                  }}>
                    {h.enabled ? '✓ Attivo' : '⏸ Sospeso'}
                  </span>
                </div>
                {h.note && (
                  <div style={{ fontSize: 12, color: '#707882', marginBottom: 8 }}>
                    {h.note}
                  </div>
                )}
                <div style={{
                  padding: '6px 10px', borderRadius: 6,
                  background: '#f8f9fc', border: '1px solid #e6e8ee',
                  fontSize: 10.5, color: '#404751', fontFamily: 'monospace',
                  wordBreak: 'break-all', marginBottom: 8,
                }}>
                  {url}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => copyUrl(url)} style={smallBtn('#005f98')} disabled={busyId === h.id}>
                    <Icon name="content_copy" size={14} color="#fff" /> Copia URL
                  </button>
                  <button onClick={() => toggleEnabled(h)} style={smallBtn(h.enabled ? '#8e6300' : '#006e25')} disabled={busyId === h.id}>
                    {h.enabled ? '⏸ Sospendi' : '▶ Riattiva'}
                  </button>
                  <button onClick={() => removeHolder(h)} style={smallBtn('#8e0000')} disabled={busyId === h.id}>
                    🗑 Rimuovi
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Istruzioni rapide */}
      <div style={{
        marginTop: 20, padding: 14, borderRadius: 10,
        background: '#f8f9fc', border: '1px solid #e6e8ee',
        fontSize: 12.5, lineHeight: 1.55, color: '#404751',
      }}>
        <strong>Come programmare un tag NFC:</strong>
        <ol style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>Installa <strong>NFC Tools</strong> (gratis, Android o iOS).</li>
          <li>Apri l'app → <em>Scrivi</em> → <em>Aggiungi un record</em> → <em>URL/URI</em>.</li>
          <li>Scansiona il QR qui sopra con il telefono per copiare l'URL, oppure usa "Copia URL" e incollalo.</li>
          <li>Torna in NFC Tools → <em>Scrivi</em> → avvicina il tag al telefono.</li>
          <li>(Opzionale) <em>Altre operazioni → Blocca tag</em> per rendere il tag di sola lettura.</li>
        </ol>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cfd4de',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: '#b3005c', color: '#fff', fontWeight: 800, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

const smallBtn = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', borderRadius: 6, border: 'none',
  background: color, color: '#fff', fontWeight: 700, fontSize: 11,
  cursor: 'pointer', fontFamily: 'inherit',
})
