import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'

/**
 * Pagina di reimpostazione password dopo click sul link email.
 * Il link di Supabase arriva come /reset-password#access_token=...&type=recovery
 * (hash fragment, non query). supabase-js intercetta l'hash all'init via
 * onAuthStateChange con evento 'PASSWORD_RECOVERY' e stabilisce una sessione
 * di recovery che permette update password senza fornire quella vecchia.
 *
 * Flow:
 * 1. Utente clicca link email → arriva qui con hash
 * 2. supabase-js emette PASSWORD_RECOVERY → noi lo rileviamo
 * 3. Mostriamo form "nuova password"
 * 4. supabase.auth.updateUser({password: nuova}) salva
 * 5. Redirect al login (o alla dashboard se la sessione resta valida)
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'waiting' | 'ready' | 'invalid' | 'done'>('waiting')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Il recovery link è un hash; supabase-js lo processa automaticamente
    // all'init del client. Al mount di questa pagina, ascoltiamo l'evento
    // PASSWORD_RECOVERY, o verifichiamo se c'è già una sessione di recovery.
    const sub = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
      else if (event === 'SIGNED_IN' && status === 'waiting') setStatus('ready')
    })

    // Timeout: se dopo 3 secondi non è arrivato PASSWORD_RECOVERY e non c'è
    // una sessione utile, consideriamo il link scaduto/invalido.
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setStatus(prev => prev === 'waiting' ? 'ready' : prev)
      else setStatus(prev => prev === 'waiting' ? 'invalid' : prev)
    }, 3000)

    return () => {
      sub.data.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [status])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri.')
      return
    }
    if (password !== password2) {
      setError('Le due password non coincidono.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) {
      setError(err.message || 'Errore durante il salvataggio')
      return
    }
    setStatus('done')
    setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Icon name="lock_reset" style={{ fontSize: 26, color: '#005f98' }} />
          <h1 style={{ margin: 0, fontFamily: 'Anybody', fontWeight: 800, fontSize: 22, color: '#181c20' }}>
            Reimposta password
          </h1>
        </div>

        {status === 'waiting' && (
          <p style={{ color: '#59616c', fontSize: 14, margin: '8px 0' }}>Validazione del link in corso…</p>
        )}

        {status === 'invalid' && (
          <>
            <p style={{ color: '#93000a', fontSize: 14, margin: '8px 0' }}>
              Il link non è valido o è scaduto. Richiedi un nuovo link dalla pagina di accesso.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{ marginTop: 10, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#005f98', color: '#fff', fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              Vai al login
            </button>
          </>
        )}

        {status === 'done' && (
          <p style={{ color: '#006e25', fontSize: 14, margin: '8px 0' }}>
            Password aggiornata. Reindirizzamento in corso…
          </p>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
            <p style={{ color: '#59616c', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
              Scegli una nuova password per il tuo account. Minimo 8 caratteri.
            </p>
            <div>
              <label htmlFor="rp-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#404751', marginBottom: 4 }}>
                Nuova password
              </label>
              <input
                id="rp-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #c0c5cf', borderRadius: 10, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="rp-password2" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#404751', marginBottom: 4 }}>
                Conferma password
              </label>
              <input
                id="rp-password2"
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #c0c5cf', borderRadius: 10, boxSizing: 'border-box' }}
              />
            </div>
            {error && (
              <div style={{ padding: 10, background: '#ffdad6', color: '#93000a', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#005f98', color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvataggio…' : 'Salva nuova password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
