import { useState, useEffect } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'

interface Team {
  id: string
  name: string
  color: string | null
}

interface ProposeAnnouncementSheetProps {
  open: boolean
  onClose: () => void
  team: Team | null
  editing?: { id: string; title: string; body: string; audience?: string } | null
  onSubmitted?: () => void
}

export function ProposeAnnouncementSheet({ open, onClose, team, editing, onSubmitted }: ProposeAnnouncementSheetProps) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'team' | 'parents'>('team')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title || '')
      setBody(editing.body || '')
      setAudience((editing.audience as any) === 'parents' ? 'parents' : 'team')
    } else {
      setTitle(''); setBody(''); setAudience('team')
    }
    setError(null); setSavedOk(false)
  }, [open, editing?.id])

  const submit = async () => {
    if (!team || !profile) return
    if (!title.trim() || !body.trim()) {
      setError('Titolo e testo sono obbligatori.')
      return
    }
    setSaving(true); setError(null)
    try {
      if (editing) {
        // UPDATE (solo pending, garantito da RLS)
        const { error: upErr } = await supabase.from('announcements').update({
          title: title.trim(),
          body: body.trim(),
          audience,
        }).eq('id', editing.id)
        if (upErr) throw upErr
      } else {
        // INSERT nuovo annuncio in pending
        const { data: teamRow } = await supabase.from('teams').select('club_id').eq('id', team.id).maybeSingle()
        if (!teamRow) throw new Error('Squadra non trovata')

        const { error: insErr } = await supabase.from('announcements').insert({
          club_id: teamRow.club_id,
          author_id: profile.id,
          target_team_id: team.id,
          title: title.trim(),
          body: body.trim(),
          audience,
          status: 'pending',
        })
        if (insErr) throw insErr
      }

      setSavedOk(true)
      onSubmitted?.()
      setTimeout(() => { setSavedOk(false); onClose() }, 1500)
    } catch (e: any) {
      setError(e.message || 'Errore invio proposta')
    } finally {
      setSaving(false)
    }
  }

  if (!team) return null

  const isEdit = !!editing

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Modifica annuncio' : 'Nuovo annuncio squadra'}>
      <div style={{ padding: '4px 18px 24px' }}>
        {/* Info box */}
        <div style={{
          background: 'rgba(255,209,0,0.14)', color: '#8e6300',
          padding: 12, borderRadius: 12, marginBottom: 16,
          fontSize: 12, lineHeight: 1.45,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="info" size={16} color="#8e6300" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              {isEdit ? (
                <>
                  <strong>Annuncio in attesa di approvazione.</strong> Puoi modificarne titolo e testo
                  finché non viene approvato. Le modifiche restano in attesa.
                </>
              ) : (
                <>
                  <strong>Annuncio per {team.name}.</strong> Sarà sottoposto ad
                  approvazione degli amministratori prima della pubblicazione in bacheca.
                  Riceverai una notifica quando verrà approvato o rifiutato.
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a',
            padding: 10, borderRadius: 8, marginBottom: 12,
            fontSize: 12, fontWeight: 700,
          }}>{error}</div>
        )}

        <Field label="Titolo">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Es. Ritrovo domenica ore 8:30"
            maxLength={120}
            style={inputStyle}
          />
        </Field>

        <Field label="Messaggio">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Scrivi qui il testo dell'avviso per genitori/atleti…"
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 100 }}
          />
        </Field>

        <Field label="Destinatari">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AudienceBtn active={audience === 'team'} onClick={() => setAudience('team')}
              icon="groups" label="Squadra intera" hint="atleti + genitori" />
            <AudienceBtn active={audience === 'parents'} onClick={() => setAudience('parents')}
              icon="family_restroom" label="Solo genitori" hint="no atleti" />
          </div>
        </Field>

        <button
          onClick={submit}
          disabled={saving || !title.trim() || !body.trim()}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 12,
            border: 'none',
            background: savedOk ? '#006e25' : 'linear-gradient(135deg, #005f98 0%, #003c5e 100%)',
            color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,95,152,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (saving || !title.trim() || !body.trim()) ? 0.55 : 1,
            transition: 'background 0.2s',
            marginTop: 6,
          }}
        >
          <Icon name={savedOk ? 'check_circle' : (isEdit ? 'save' : 'send')} size={16} color="#fff" />
          {savedOk
            ? (isEdit ? 'Modifiche salvate' : 'Inviato per approvazione')
            : (saving ? 'Salvo…' : (isEdit ? 'Salva modifiche' : 'Invia agli amministratori'))}
        </button>
      </div>
    </BottomSheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 11, fontWeight: 800, color: '#404751',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        display: 'block', marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  )
}

function AudienceBtn({ active, onClick, icon, label, hint }: {
  active: boolean; onClick: () => void; icon: string; label: string; hint: string;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 10,
        border: `2px solid ${active ? '#005f98' : '#e6e8ee'}`,
        background: active ? 'rgba(0,95,152,0.06)' : '#fff',
        cursor: 'pointer', textAlign: 'left',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <Icon name={icon} size={16} color={active ? '#005f98' : '#707882'} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: active ? '#005f98' : '#181c20' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: '#707882' }}>{hint}</div>
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #c0c7d2', fontSize: 13.5,
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
