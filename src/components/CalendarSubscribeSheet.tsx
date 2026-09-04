import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { downloadIcs, type IcsEvent } from '../lib/ical'

interface Props {
  open: boolean
  onClose: () => void
  /** Scope della sottoscrizione */
  scope: 'player' | 'children' | 'team' | 'all'
  /** ID dello scope: player_id / profile_id / team_id, o null per 'all' */
  scopeId: string | null
  /** Nome leggibile mostrato in UI (es. "Under 16") */
  label: string
  /** Optional: se fornito, permette anche download statico immediato */
  staticEvents?: IcsEvent[]
  staticFilename?: string
}

const CAL_ENDPOINT = 'https://nlgknkopottaxewpdofl.supabase.co/functions/v1/calendar-ics'

export function CalendarSubscribeSheet({ open, onClose, scope, scopeId, label, staticEvents, staticFilename }: Props) {
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'https' | 'webcal' | null>(null)

  useEffect(() => {
    if (!open) return
    loadOrCreateToken()
  }, [open, scope, scopeId])

  const loadOrCreateToken = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_or_create_calendar_subscription', {
      p_scope: scope,
      p_scope_id: scopeId,
    })
    setLoading(false)
    if (err || !data?.ok) {
      setError((data?.error as string) || err?.message || 'Errore creazione sottoscrizione')
      return
    }
    setToken(data.token as string)
  }

  const httpsUrl = token ? `${CAL_ENDPOINT}?t=${token}` : ''
  const webcalUrl = token ? httpsUrl.replace(/^https:\/\//, 'webcal://') : ''

  const copyToClipboard = async (text: string, type: 'https' | 'webcal') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback: create temporary textarea
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); setCopied(type); setTimeout(() => setCopied(null), 2000) }
      catch { alert('Copia manuale: ' + text) }
      document.body.removeChild(ta)
    }
  }

  const openWebcal = () => {
    if (!webcalUrl) return
    window.location.href = webcalUrl
  }

  const doStaticDownload = () => {
    if (staticEvents && staticFilename) {
      downloadIcs(staticEvents, label, staticFilename)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Aggiungi al calendario" maxHeight="85vh">
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Intestazione */}
        <div style={{
          background: 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
          color: '#fff', borderRadius: 14, padding: 14, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800, color: '#ffd100' }}>
            <Icon name="event_repeat" size={14} color="#ffd100" />
            Aggiornamento automatico
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{label}</div>
          <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 4, lineHeight: 1.4 }}>
            Il telefono si aggiorna da solo ogni ora circa. Se il club aggiunge un allenamento o sposta una partita, lo trovi nel calendario senza dover fare niente.
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#707882', fontSize: 13 }}>
            Preparo la sottoscrizione…
          </div>
        ) : error ? (
          <div style={{ padding: 16, background: '#ffdad6', color: '#93000a', borderRadius: 10, fontSize: 12.5 }}>
            {error === 'not_authorized' ? 'Non hai i permessi per sottoscrivere questo calendario.' : `Errore: ${error}`}
          </div>
        ) : token ? (
          <>
            {/* Opzione 1: iPhone / Apple */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#5a6270', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                📱 iPhone / iPad / Mac
              </div>
              <button
                onClick={openWebcal}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: '#005f98', color: '#fff', border: 'none',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 16px rgba(0,95,152,0.25)',
                }}
              >
                <Icon name="calendar_add_on" size={17} color="#fff" />
                Sottoscrivi ora
              </button>
              <div style={{ fontSize: 10.5, color: '#707882', marginTop: 5, textAlign: 'center' }}>
                Apre il Calendario del telefono per confermare
              </div>
            </div>

            {/* Opzione 2: Google Calendar (Android + web) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#5a6270', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                🤖 Google Calendar / Android
              </div>
              <div style={{ fontSize: 11.5, color: '#404751', marginBottom: 8, lineHeight: 1.5 }}>
                Su Google Calendar apri <strong>Impostazioni → Aggiungi calendario → Da URL</strong> e incolla questo indirizzo:
              </div>
              <button
                onClick={() => copyToClipboard(httpsUrl, 'https')}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: '#f7f9ff', color: '#005f98', border: '1.5px solid #cfe5ff',
                  fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                  textAlign: 'left', wordBreak: 'break-all', lineHeight: 1.4,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{httpsUrl}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6,
                  background: copied === 'https' ? '#006e25' : '#005f98',
                  color: '#fff', whiteSpace: 'nowrap',
                }}>
                  {copied === 'https' ? '✓ COPIATO' : 'COPIA'}
                </span>
              </button>
            </div>

            {/* Info promemoria */}
            <div style={{
              padding: 12, background: 'rgba(255,209,0,0.15)', borderRadius: 10,
              fontSize: 11, color: '#404751', lineHeight: 1.5, display: 'flex', gap: 8,
            }}>
              <Icon name="info" size={14} color="#8e6300" />
              <div>
                Il link è personale e non richiede login. Non condividerlo, chi ce l'ha può vedere il calendario.
              </div>
            </div>

            {/* Fallback: download statico */}
            {staticEvents && staticFilename && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e6e8ee', textAlign: 'center' }}>
                <button
                  onClick={doStaticDownload}
                  style={{
                    background: 'transparent', color: '#707882', border: 'none',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="download" size={12} color="#707882" />
                  Preferisci uno snapshot statico? Scarica il file .ics
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </BottomSheet>
  )
}
