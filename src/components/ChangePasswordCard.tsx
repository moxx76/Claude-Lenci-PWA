import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

export function ChangePasswordCard() {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const handleChange = async () => {
    setMessage(null)
    if (newPassword.length < 8) {
      setMessage({ type: 'err', text: 'La password deve essere almeno 8 caratteri' }); return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'err', text: 'Le due password non coincidono' }); return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage({ type: 'ok', text: '✅ Password aggiornata correttamente' })
      setNewPassword(''); setConfirmPassword('')
      setTimeout(() => { setOpen(false); setMessage(null) }, 1800)
    } catch (e: any) {
      setMessage({ type: 'err', text: 'Errore: ' + (e.message || 'sconosciuto') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #d5dae2',
      borderRadius: 12, padding: 12, marginTop: 10,
    }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: 'transparent', border: 'none',
            color: '#005f98', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock_reset" size={16} color="#005f98" />
            Cambia password
          </span>
          <Icon name="chevron_right" size={16} color="#005f98" />
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Icon name="lock_reset" size={16} color="#005f98" />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#181c20' }}>Cambia password</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => { setOpen(false); setMessage(null); setNewPassword(''); setConfirmPassword('') }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#707882' }}>
              <Icon name="close" size={16} color="#707882" />
            </button>
          </div>

          {message && (
            <div style={{
              padding: '8px 10px', borderRadius: 8, marginBottom: 10, fontSize: 11.5,
              background: message.type === 'ok' ? '#d4edda' : '#ffdad6',
              color: message.type === 'ok' ? '#155724' : '#93000a',
            }}>{message.text}</div>
          )}

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nuova password (min 8 caratteri)
            </label>
            <input type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8,
                border: '1px solid #c0c7d2', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Conferma nuova password
            </label>
            <input type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8,
                border: '1px solid #c0c7d2', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }} />
          </div>

          <button onClick={handleChange} disabled={saving || !newPassword || !confirmPassword}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: 10,
              background: '#005f98', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: (saving || !newPassword || !confirmPassword) ? 0.5 : 1,
            }}>
            <Icon name="check" size={15} color="#fff" />
            {saving ? 'Aggiorno…' : 'Aggiorna password'}
          </button>
        </>
      )}
    </div>
  )
}
