import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Logo } from '../components/Logo'
import { supabase } from '../lib/supabase'

export function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#e4e9f2' }}
    >
      {/* Phone frame - solo su desktop */}
      <div className="w-full max-w-sm md:max-w-none md:w-auto">
        <div
          className="md:mx-auto flex flex-col"
          style={{
            width: '100%',
            minHeight: '100vh',
            maxWidth: 402,
            background: 'linear-gradient(180deg,#f7f9ff 0%,#e8f2fb 100%)',
          }}
        >
          <div
            className="flex-1 flex flex-col items-center justify-center overflow-y-auto"
            style={{ gap: 26, padding: '36px 30px' }}
          >
            {/* Logo */}
            <div className="flex flex-col items-center" style={{ gap: 14 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 10px 24px rgba(0,95,152,0.15)',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Logo size={84} variant="plain" />
              </div>
              <h1
                className="text-center m-0"
                style={{
                  fontFamily: 'Anybody', fontWeight: 800, fontSize: 22,
                  color: '#005f98', letterSpacing: '-0.01em',
                }}
              >
                ASD LENCI POIRINO
              </h1>
              <p
                className="text-center m-0"
                style={{
                  fontSize: 13, color: '#404751',
                  lineHeight: 1.5, maxWidth: 260,
                }}
              >
                Gestione sportiva, tecnica, disciplinare e comunicazione del club
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col w-full"
              style={{ gap: 12, maxWidth: 300 }}
            >
              <div className="flex flex-col" style={{ gap: 6 }}>
                <label
                  style={{
                    fontSize: 11, fontWeight: 700, color: '#404751',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@lenci-poirino.it"
                  style={{
                    border: '1px solid #c0c7d2', borderRadius: 10,
                    padding: '12px 14px', fontSize: 13.5,
                    fontFamily: 'Lexend', outline: 'none', background: '#fff',
                  }}
                />
              </div>
              <div className="flex flex-col" style={{ gap: 6 }}>
                <label
                  style={{
                    fontSize: 11, fontWeight: 700, color: '#404751',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    border: '1px solid #c0c7d2', borderRadius: 10,
                    padding: '12px 14px', fontSize: 13.5,
                    fontFamily: 'Lexend', outline: 'none', background: '#fff',
                  }}
                />
              </div>
              {error && (
                <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email || !password}
                style={{
                  background: '#005f98', color: '#fff', border: 'none',
                  borderRadius: 12, padding: 14, fontSize: 13.5, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 8px 20px rgba(0,95,152,0.25)',
                  marginTop: 4, opacity: loading || !email || !password ? 0.6 : 1,
                }}
              >
                {loading ? 'Accesso in corso…' : 'Accedi'}
              </button>

              {/* Password dimenticata */}
              <button
                type="button"
                onClick={async () => {
                  if (!email) { alert('Inserisci prima l\'email nel campo sopra'); return }
                  const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password',
                  })
                  if (err) alert('Errore: ' + err.message)
                  else alert(`Email di recupero inviata a ${email}.\n\nControlla la posta (anche spam) e segui il link per impostare una nuova password.\n\nSe non arriva entro 5 minuti, contatta l'amministratore.`)
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#005f98',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  padding: '6px', marginTop: 4,
                }}
              >
                Password dimenticata?
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
