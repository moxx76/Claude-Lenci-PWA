import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/**
 * Card admin-only per gestire i dati "amministrativi" del club:
 * al momento solo la MATRICOLA FIGC della società (numero univoco assegnato dalla
 * FIGC all'ASD), che viene stampata nell'header della distinta ufficiale di gara.
 *
 * Sta in Profilo → sezione "Impostazioni club" (solo per role='admin').
 * Rende in sola lettura la matricola per gli altri utenti (informativo).
 */
interface Props {
  clubId: string
  isAdmin: boolean
}

export function ClubSettingsCard({ clubId, isAdmin }: Props) {
  const [current, setCurrent] = useState<string>('')
  const [draft, setDraft] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubId) return
    let cancelled = false
    setLoading(true)
    supabase.from('clubs').select('federation_code').eq('id', clubId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError('Errore lettura: ' + error.message)
        } else {
          const val = (data?.federation_code as string) || ''
          setCurrent(val)
          setDraft(val)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [clubId])

  const dirty = draft.trim() !== current.trim()

  const handleSave = async () => {
    if (!isAdmin || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const cleaned = draft.trim() || null
      const { error } = await supabase.from('clubs')
        .update({ federation_code: cleaned })
        .eq('id', clubId)
      if (error) throw error
      setCurrent(cleaned || '')
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 1800)
    } catch (e: any) {
      setError('Errore salvataggio: ' + (e?.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 4px 12px rgba(0,60,95,0.05)', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon name="verified" size={18} color="#005f98" />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#003c5f' }}>
          Impostazioni club
        </div>
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#404751', letterSpacing: 0.4, marginBottom: 4 }}>
        MATRICOLA FIGC DELLA SOCIETÀ
      </div>
      <div style={{ fontSize: 11, color: '#707882', marginBottom: 6, lineHeight: 1.35 }}>
        Numero univoco assegnato dalla FIGC alla società. Compare nell'header della distinta ufficiale di gara accanto al nome dell'ASD.
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#707882' }}>Caricamento…</div>
      ) : isAdmin ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Es. 947654"
            maxLength={20}
            disabled={saving}
            style={{
              width: '100%', padding: '9px 10px', fontSize: 14,
              border: '1px solid #dfe6ef', borderRadius: 8,
              background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          {error && (
            <div style={{
              marginTop: 8, padding: '6px 8px', background: '#ffdad6', color: '#93000a',
              borderRadius: 6, fontSize: 11.5, fontWeight: 600,
            }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: dirty ? '#005f98' : '#c0c7d2',
                color: '#fff', fontSize: 12, fontWeight: 800,
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
            {savedOk && (
              <span style={{ fontSize: 11.5, color: '#0a7d3a', fontWeight: 700 }}>✓ Salvato</span>
            )}
          </div>
        </>
      ) : (
        <div style={{
          padding: '9px 10px', background: '#f5f7fb', border: '1px solid #e6ebf2',
          borderRadius: 8, fontSize: 13, color: current ? '#181c20' : '#707882',
          fontFamily: current ? 'monospace, monospace' : 'inherit',
        }}>
          {current || 'Non impostata (chiedi all\'amministratore)'}
        </div>
      )}
    </div>
  )
}
