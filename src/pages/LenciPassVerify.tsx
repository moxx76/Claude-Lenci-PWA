/**
 * Pagina pubblica di verifica Lenci Pass tramite tag NFC.
 *
 * URL atteso dentro il tag NFC: https://lenci-poirino-app.netlify.app/pass/v/{nfc_token}
 *
 * Quando il cassiere avvicina lo smartphone al tag:
 *   1. Il browser si apre su questa pagina con il token in path
 *   2. Fetch sulla tabella lenci_pass_holders WHERE nfc_token = :token
 *   3. Schermata a semaforo (verde = valido, rosso = non valido/sospeso)
 *
 * Design: fullscreen, un solo rettangolo colorato grande leggibile da lontano,
 * zero scroll. Pensato per essere mostrato per 2-3 secondi al cassiere.
 * Dopo 10 secondi torna alla lista pubblica /pass.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface PassHolder {
  first_name: string
  last_name: string
  note: string | null
  enabled: boolean
}

type Status = 'loading' | 'valid' | 'suspended' | 'not_found' | 'error'

export function LenciPassVerify() {
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [holder, setHolder] = useState<PassHolder | null>(null)
  const [errMsg, setErrMsg] = useState<string>('')
  const [countdown, setCountdown] = useState(10)

  // Fetch del titolare dal token NFC
  useEffect(() => {
    if (!token) { setStatus('not_found'); return }
    // Vibrazione tattile sul telefono della cassa come conferma della scansione
    try { navigator.vibrate?.(80) } catch { /* non supportato */ }
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('lenci_pass_holders')
          .select('first_name, last_name, note, enabled')
          .eq('nfc_token', token)
          .maybeSingle()
        if (error) { setErrMsg(error.message); setStatus('error'); return }
        if (!data) { setStatus('not_found'); return }
        setHolder(data as PassHolder)
        setStatus(data.enabled ? 'valid' : 'suspended')
        // Doppia vibrazione se valido (feedback positivo), lunga se non valido
        try {
          if (data.enabled) navigator.vibrate?.([60, 50, 60])
          else navigator.vibrate?.(400)
        } catch { /* ignore */ }
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()
  }, [token])

  // Countdown + autoreturn alla lista pubblica dopo 10s
  useEffect(() => {
    if (status === 'loading') return
    const int = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(int)
  }, [status])

  useEffect(() => {
    if (countdown <= 0) nav('/pass', { replace: true })
  }, [countdown, nav])

  // Design "a semaforo": colore grande + un solo testo centrale leggibile da lontano
  const palette = {
    loading:   { bg: '#404751', title: 'VERIFICA…', icon: '…' },
    valid:     { bg: '#007a2a', title: 'VALIDO',       icon: '✓' },
    suspended: { bg: '#8e6300', title: 'SOSPESO',      icon: '⚠' },
    not_found: { bg: '#8e0000', title: 'NON VALIDO',   icon: '✗' },
    error:     { bg: '#8e0000', title: 'ERRORE',       icon: '!' },
  }[status]

  return (
    <div style={{
      minHeight: '100vh',
      background: palette.bg,
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', textAlign: 'center',
      position: 'relative',
    }}>
      {/* Icona enorme */}
      <div style={{
        fontSize: 160, lineHeight: 1, fontWeight: 900,
        marginBottom: 16, textShadow: '0 4px 12px rgba(0,0,0,0.25)',
        fontFamily: 'Anybody, system-ui, sans-serif',
      }}>
        {palette.icon}
      </div>

      {/* Verdetto */}
      <div style={{
        fontSize: 54, fontWeight: 900, letterSpacing: 2,
        marginBottom: 24, fontFamily: 'Anybody, system-ui, sans-serif',
      }}>
        {palette.title}
      </div>

      {/* Nome + ruolo (solo se trovato) */}
      {holder && (
        <div style={{
          padding: '16px 24px', borderRadius: 14,
          background: 'rgba(0,0,0,0.25)',
          maxWidth: 420, width: '100%',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
            {holder.last_name} {holder.first_name}
          </div>
          {holder.note && (
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6, letterSpacing: 0.5 }}>
              {holder.note}
            </div>
          )}
        </div>
      )}

      {/* Dettaglio quando non trovato / errore */}
      {status === 'not_found' && (
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 12, maxWidth: 360 }}>
          Il pass scansionato non risulta registrato.<br/>
          Chiedere al titolare un documento o rifiutare l'ingresso gratuito.
        </div>
      )}
      {status === 'suspended' && (
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 12, maxWidth: 360 }}>
          Pass temporaneamente sospeso.<br/>
          Chiedere conferma alla segreteria.
        </div>
      )}
      {status === 'error' && errMsg && (
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 12, maxWidth: 360 }}>
          {errMsg}
        </div>
      )}

      {/* Footer con countdown + bottone torna alla lista */}
      {status !== 'loading' && (
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 12, opacity: 0.75,
        }}>
          <span>Torno all'elenco in {Math.max(0, countdown)}s</span>
          <Link to="/pass" style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            textDecoration: 'none', fontWeight: 700,
          }}>Vai subito</Link>
        </div>
      )}
    </div>
  )
}
