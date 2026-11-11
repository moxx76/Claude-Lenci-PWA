// v1.9.172: pagina admin per impostazioni società.
// Singleton (una sola riga, id=1 in club_settings). Serve per
// l'intestazione dei PDF ricevuta pagamento quote.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'
import { useAuth } from '../store/auth'
import { isAdmin } from '../lib/types'

interface Settings {
  denominazione: string
  codice_fiscale: string
  partita_iva: string
  sede_via: string
  sede_cap: string
  sede_citta: string
  sede_provincia: string
  iban: string
  firmatario_nome: string
  firmatario_ruolo: string
  logo_data_uri: string
}

const EMPTY: Settings = {
  denominazione: '', codice_fiscale: '', partita_iva: '',
  sede_via: '', sede_cap: '', sede_citta: '', sede_provincia: '',
  iban: '', firmatario_nome: '', firmatario_ruolo: '', logo_data_uri: '',
}

export default function AdminClubSettings() {
  const { profile } = useAuth()
  const [s, setS] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('club_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const merged: Settings = { ...EMPTY }
          Object.keys(EMPTY).forEach(k => {
            const v = (data as any)[k]
            if (v != null) (merged as any)[k] = String(v)
          })
          setS(merged)
        }
        setLoading(false)
      })
  }, [])

  if (!isAdmin(profile?.role)) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Accesso riservato agli admin.</div>
  }
  if (loading) return <div style={{ padding: 20 }}>Caricamento…</div>

  const upd = <K extends keyof Settings>(k: K, v: string) => setS(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null)
    try {
      const payload: any = { id: 1 }
      Object.keys(EMPTY).forEach(k => {
        const v = (s as any)[k].trim()
        payload[k] = v || null
      })
      payload.updated_at = new Date().toISOString()
      const { error } = await supabase.from('club_settings').upsert(payload).eq('id', 1)
      if (error) throw error
      setMsg('Impostazioni salvate ✓')
    } catch (e: any) {
      setErr('Errore: ' + (e?.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  const onLogoUpload = async (file: File) => {
    // Dimensione max consigliata: ~50KB base64 per non appesantire le ricevute
    if (file.size > 300_000) {
      setErr('Logo troppo grande (max 300KB). Riduci le dimensioni.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => upd('logo_data_uri', String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const input = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #c0c7d2', fontSize: 13,
  } as const

  const label = (t: string) => (
    <div style={{ fontSize: 10, fontWeight: 800, color: '#707882', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>{t}</div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>Impostazioni società</h1>
      <p style={{ color: '#707882', fontSize: 13, margin: '0 0 20px' }}>
        Dati usati per l'intestazione dei PDF ricevuta pagamento quote.
      </p>

      {err && <div style={{ padding: 10, background: '#fee', color: '#c62828', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ padding: 10, background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Denominazione</div>
        {label('Denominazione completa')}
        <input value={s.denominazione} onChange={e => upd('denominazione', e.target.value)} placeholder="ASD Lenci O.N.L.U.S. Poirino" style={input} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Dati fiscali</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>{label('Codice fiscale')}<input value={s.codice_fiscale} onChange={e => upd('codice_fiscale', e.target.value.toUpperCase())} style={input} /></div>
          <div>{label('Partita IVA')}<input value={s.partita_iva} onChange={e => upd('partita_iva', e.target.value)} style={input} /></div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Sede legale</div>
        <div>{label('Via / numero civico')}<input value={s.sede_via} onChange={e => upd('sede_via', e.target.value)} placeholder="Via Roma 123" style={input} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 10, marginTop: 10 }}>
          <div>{label('CAP')}<input value={s.sede_cap} onChange={e => upd('sede_cap', e.target.value)} style={input} /></div>
          <div>{label('Città')}<input value={s.sede_citta} onChange={e => upd('sede_citta', e.target.value)} placeholder="Poirino" style={input} /></div>
          <div>{label('Prov.')}<input value={s.sede_provincia} onChange={e => upd('sede_provincia', e.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="TO" style={input} /></div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Coordinate bancarie</div>
        {label('IBAN (per le ricevute da bonifico)')}
        <input value={s.iban} onChange={e => upd('iban', e.target.value.toUpperCase().replace(/\s+/g, ''))} placeholder="IT00X00000000000000000000000" style={input} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Firmatario ricevute</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>{label('Nome e cognome')}<input value={s.firmatario_nome} onChange={e => upd('firmatario_nome', e.target.value)} style={input} /></div>
          <div>{label('Ruolo (es. Il Presidente)')}<input value={s.firmatario_ruolo} onChange={e => upd('firmatario_ruolo', e.target.value)} placeholder="Il Presidente" style={input} /></div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginBottom: 10 }}>Logo (opzionale)</div>
        {s.logo_data_uri ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={s.logo_data_uri} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #e6e8ee', borderRadius: 8, background: '#fafbfd' }} />
            <button onClick={() => upd('logo_data_uri', '')} style={{ padding: '8px 14px', border: '1px solid #c62828', background: '#fff', color: '#c62828', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Rimuovi</button>
          </div>
        ) : (
          <div>
            <input type="file" accept="image/png,image/jpeg" onChange={e => e.target.files?.[0] && onLogoUpload(e.target.files[0])} />
            <div style={{ fontSize: 11, color: '#707882', marginTop: 4 }}>PNG o JPG · max 300KB · consigliato 200×200px</div>
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '14px 20px', background: '#005f98', color: '#fff', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="save" size={18} color="#fff" />
        {saving ? 'Salvataggio…' : 'Salva impostazioni'}
      </button>
    </div>
  )
}
