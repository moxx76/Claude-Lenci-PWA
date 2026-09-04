import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

interface AnnouncementInput {
  id?: string
  title: string
  body: string
  audience: string
  pinned: boolean | null
}

interface AnnouncementEditSheetProps {
  open: boolean
  onClose: () => void
  existing: AnnouncementInput | null
  onSaved?: () => void
}

const AUDIENCES = [
  { key: 'all',      label: 'Tutti',    icon: 'group' },
  { key: 'parents',  label: 'Genitori', icon: 'family_restroom' },
  { key: 'athletes', label: 'Atleti',   icon: 'sports_soccer' },
  { key: 'coaches',  label: 'Coach',    icon: 'psychology' },
  { key: 'staff',    label: 'Staff',    icon: 'admin_panel_settings' },
]

export function AnnouncementEditSheet({ open, onClose, existing, onSaved }: AnnouncementEditSheetProps) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(existing?.title || '')
    setBody(existing?.body || '')
    setAudience(existing?.audience || 'all')
    setPinned(!!existing?.pinned)
    setError(null)
  }, [open, existing])

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Titolo e testo sono obbligatori')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (existing?.id) {
        const { error: err } = await supabase
          .from('announcements')
          .update({
            title: title.trim(),
            body: body.trim(),
            audience,
            pinned,
          })
          .eq('id', existing.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('announcements')
          .insert({
            club_id: '9cb45011-8014-45f1-a045-f2253d422926',
            author_id: profile?.id ?? null,
            title: title.trim(),
            body: body.trim(),
            audience,
            pinned,
            status: 'published',
            published_at: new Date().toISOString(),
          })
        if (err) throw err
      }
      onSaved?.()
    } catch (e: any) {
      setError('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={existing?.id ? 'Modifica comunicazione' : 'Nuova comunicazione'}>
      <div style={{ padding: '4px 20px 24px' }}>
        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a',
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Icon name="error" size={16} color="#93000a" />
            {error}
          </div>
        )}

        <Field label="Titolo *">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="es. Riunione genitori 5 settembre"
            style={inputStyle}
          />
        </Field>

        <Field label="Testo *">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Descrivi la comunicazione..."
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 120 }}
          />
        </Field>

        <Field label="Destinatari">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {AUDIENCES.map(a => {
              const active = audience === a.key
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAudience(a.key)}
                  style={{
                    padding: '10px', borderRadius: 10,
                    border: active ? '2px solid #005f98' : '1px solid #c0c7d2',
                    background: active ? '#cfe5ff' : '#fff',
                    color: active ? '#004a78' : '#404751',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <Icon name={a.icon} size={14} color={active ? '#004a78' : '#707882'} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </Field>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 12, borderRadius: 10, background: '#f7f9ff',
          cursor: 'pointer', marginTop: 8,
        }}>
          <input
            type="checkbox"
            checked={pinned}
            onChange={e => setPinned(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#181c20' }}>
              Fissa in cima
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#707882' }}>
              L'annuncio resterà sempre in cima alla bacheca
            </p>
          </div>
          <Icon name="push_pin" size={16} color={pinned ? '#b3005c' : '#c0c7d2'} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={saving}
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
            disabled={saving}
            style={{
              flex: 2, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: '#005f98', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(0,95,152,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Icon name={existing?.id ? 'save' : 'campaign'} size={16} color="#fff" />
            {saving ? 'Salvo…' : (existing?.id ? 'Salva modifiche' : 'Pubblica')}
          </button>
        </div>
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
