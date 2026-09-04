import { useState, useEffect } from 'react'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { avatarBg, calculateAge, formatDate } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { PlayerEditSheet } from './PlayerEditSheet'
import { PlayerAssessmentSheet } from './PlayerAssessmentSheet'

export interface PlayerDetailData {
  id: string
  firstName: string
  lastName: string
  birthDate: string | null
  position: string | null
  category: string | null
  previousClub: string | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
  fiscalCode?: string | null
  jerseyNumber?: number | null
  cardNumber?: string | null
  medicalExpiry?: string | null
  teamId?: string | null
  avatarUrl?: string | null
  dominantFoot?: string | null
  secondaryPositions?: string[] | null
  heightCm?: number | null
  weightKg?: number | null
  shoeSize?: number | null
  sex?: 'M' | 'F' | null
  source?: 'player' | 'lead'
}

interface PlayerDetailSheetProps {
  open: boolean
  onClose: () => void
  player: PlayerDetailData | null
  canEdit?: boolean
  onUpdated?: () => void
}

type NoteType = 'note' | 'yellow' | 'red' | 'achievement'

interface DisciplinaryEntry {
  id: string
  kind: NoteType
  content: string
  occurred_on: string
  author_name?: string
  created_at: string
}

const NOTE_TYPE_STYLE: Record<NoteType, { bg: string; color: string; label: string; icon: string }> = {
  note:        { bg: '#cfe5ff', color: '#004a78', label: 'Nota',        icon: 'edit_note' },
  yellow:      { bg: 'rgba(255,209,0,0.30)', color: '#8e6300', label: 'Ammonizione', icon: 'square' },
  red:         { bg: '#ffdad6', color: '#93000a', label: 'Espulsione', icon: 'square' },
  achievement: { bg: 'rgba(128,249,139,0.35)', color: '#006e25', label: 'Merito',    icon: 'emoji_events' },
}

export function PlayerDetailSheet({ open, onClose, player, canEdit = false, onUpdated }: PlayerDetailSheetProps) {
  const { profile } = useAuth()
  const [addingNote, setAddingNote] = useState(false)
  const [noteType, setNoteType] = useState<NoteType>('note')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<DisciplinaryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [assessOpen, setAssessOpen] = useState(false)

  useEffect(() => {
    if (!open || !player || player.source === 'lead') {
      setHistory([])
      return
    }
    loadHistory()
  }, [open, player?.id])

  const loadHistory = async () => {
    if (!player) return
    setLoadingHistory(true)
    const { data } = await supabase
      .from('disciplinary_records')
      .select('id, kind, content, occurred_on, created_at, author:profiles!disciplinary_records_author_id_fkey(full_name)')
      .eq('player_id', player.id)
      .order('occurred_on', { ascending: false })
      .limit(30)
    setHistory((data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind,
      content: r.content,
      occurred_on: r.occurred_on,
      created_at: r.created_at,
      author_name: r.author?.full_name || 'Staff',
    })))
    setLoadingHistory(false)
  }

  if (!player) return null

  const initials = `${player.firstName[0] || ''}${player.lastName[0] || ''}`.toUpperCase() || '??'
  const age = calculateAge(player.birthDate)
  const isLead = player.source === 'lead'

  const medicalDaysLeft = player.medicalExpiry
    ? Math.floor((new Date(player.medicalExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const handleAddNote = async () => {
    if (!noteText.trim() || !player || isLead) return
    setSaving(true)
    try {
      const { error } = await supabase.from('disciplinary_records').insert({
        player_id: player.id,
        kind: noteType,
        content: noteText.trim(),
        occurred_on: new Date().toISOString().slice(0, 10),
        author_id: profile?.id ?? null,
      })
      if (error) throw error
      setAddingNote(false)
      setNoteText('')
      setNoteType('note')
      await loadHistory()
    } catch (e: any) {
      alert('Errore salvataggio: ' + (e.message || 'sconosciuto'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 20px 24px' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'center' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: player.avatarUrl ? '#fff' : avatarBg(initials),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: 'Anybody', fontWeight: 800, fontSize: 22,
              flexShrink: 0, boxShadow: '0 6px 14px rgba(0,120,191,0.15)', overflow: 'hidden',
            }}
          >
            {player.avatarUrl
              ? <img src={player.avatarUrl} alt={initials}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 20, color: '#181c20', margin: 0, lineHeight: 1.2 }}>
              {player.firstName} {player.lastName}
            </h2>
            <p style={{ fontSize: 12.5, color: '#404751', margin: '4px 0 0' }}>
              {player.position || 'Ruolo non specificato'}
              {age !== null && ` • ${age} anni`}
            </p>
            {player.category && (
              <p style={{ fontSize: 11.5, color: '#707882', margin: '2px 0 0' }}>
                {player.category}
              </p>
            )}
          </div>
          {!isLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    background: '#f1f3fa', color: '#005f98', border: 'none',
                    borderRadius: 999, padding: '8px 12px',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="edit" size={14} color="#005f98" />
                  Modifica
                </button>
              )}
              <button
                onClick={() => setAssessOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #005f98, #003c5e)',
                  color: '#fff', border: 'none',
                  borderRadius: 999, padding: '8px 12px',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Icon name="analytics" size={14} color="#fff" />
                Scheda tecnica
              </button>
            </div>
          )}
        </div>

        {/* Alert certificato medico */}
        {medicalDaysLeft !== null && medicalDaysLeft < 30 && (
          <div
            style={{
              background: medicalDaysLeft < 0 ? '#ffdad6' : 'rgba(255,209,0,0.25)',
              color: medicalDaysLeft < 0 ? '#93000a' : '#8e6300',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 700,
            }}
          >
            <Icon name={medicalDaysLeft < 0 ? 'error' : 'warning'} size={16} color={medicalDaysLeft < 0 ? '#93000a' : '#8e6300'} />
            {medicalDaysLeft < 0
              ? `Certificato medico SCADUTO il ${formatDate(player.medicalExpiry)}`
              : `Certificato medico scade tra ${medicalDaysLeft} giorni (${formatDate(player.medicalExpiry)})`}
          </div>
        )}

        {/* Info tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          <InfoTile label="Data di nascita" value={player.birthDate ? formatDate(player.birthDate) : '—'} />
          <InfoTile label="Maglia" value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : '—'} />
          <InfoTile label="Matricola FIGC" value={player.cardNumber || '—'} />
          <InfoTile label="Cert. medico" value={player.medicalExpiry ? formatDate(player.medicalExpiry) : '—'} />
          <InfoTile label="Codice fiscale" value={player.fiscalCode || '—'} />
          {player.previousClub && (
            <InfoTile label="Squadra precedente" value={player.previousClub} />
          )}
          {player.parentName && (
            <InfoTile label="Genitore" value={player.parentName} />
          )}
          {player.parentPhone && (
            <InfoTile label="Telefono" value={player.parentPhone} action={`tel:${player.parentPhone}`} icon="phone" />
          )}
          {player.parentEmail && (
            <InfoTile label="Email" value={player.parentEmail} action={`mailto:${player.parentEmail}`} icon="mail" />
          )}
        </div>

        {/* Storico disciplinare - solo per giocatori (non lead) */}
        {!isLead ? (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Anybody', fontWeight: 800, fontSize: 14, color: '#181c20', margin: 0 }}>
                Storico disciplinare & note
              </h3>
              {canEdit && !addingNote && (
                <button
                  onClick={() => setAddingNote(true)}
                  style={{
                    background: '#005f98', color: '#fff', border: 'none',
                    borderRadius: 999, padding: '6px 12px',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="add" size={14} color="#fff" />
                  Aggiungi
                </button>
              )}
            </div>

            {addingNote && (
              <div style={{
                background: '#f7f9ff', borderRadius: 14, padding: 14,
                marginBottom: 12, border: '1px solid #cfe5ff',
              }}>
                <p style={{ fontSize: 11.5, color: '#404751', fontWeight: 700, margin: '0 0 8px' }}>
                  Tipo
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {(['note', 'achievement', 'yellow', 'red'] as NoteType[]).map(t => {
                    const s = NOTE_TYPE_STYLE[t]
                    const active = noteType === t
                    return (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        style={{
                          padding: '8px', borderRadius: 10,
                          border: active ? `2px solid ${s.color}` : '2px solid transparent',
                          background: s.bg, color: s.color,
                          fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        <Icon name={s.icon} size={13} color={s.color} />
                        {s.label}
                      </button>
                    )
                  })}
                </div>

                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Descrivi l'annotazione..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid #c0c7d2', fontSize: 13,
                    fontFamily: 'inherit', resize: 'vertical', marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setAddingNote(false); setNoteText('') }}
                    disabled={saving}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: '1px solid #c0c7d2',
                      background: '#fff', fontSize: 12, fontWeight: 700, color: '#404751',
                      cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || saving}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: 'none',
                      background: '#005f98', fontSize: 12, fontWeight: 700, color: '#fff',
                      cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                      opacity: (noteText.trim() && !saving) ? 1 : 0.5,
                    }}
                  >
                    {saving ? 'Salvo…' : 'Salva'}
                  </button>
                </div>
              </div>
            )}

            {loadingHistory ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
                Caricamento…
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#707882', fontSize: 12 }}>
                Nessuna annotazione presente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => {
                  const s = NOTE_TYPE_STYLE[h.kind]
                  return (
                    <div key={h.id} style={{
                      padding: 12, borderRadius: 12, background: '#fff',
                      border: '1px solid #e6e8ee', display: 'flex', gap: 10,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: s.bg, color: s.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon name={s.icon} size={16} color={s.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color }}>{s.label}</span>
                          <span style={{ fontSize: 10.5, color: '#707882' }}>{formatDate(h.occurred_on)}</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: '#181c20', margin: '2px 0', lineHeight: 1.4 }}>
                          {h.content}
                        </p>
                        <p style={{ fontSize: 10.5, color: '#707882', margin: '2px 0 0', fontStyle: 'italic' }}>
                          — {h.author_name}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: 14, background: '#f7f9ff', borderRadius: 12,
            color: '#404751', fontSize: 12, textAlign: 'center',
          }}>
            ℹ️ Storico disciplinare disponibile solo per tesserati (categoria: {player.category || 'lead'})
          </div>
        )}
      </div>
    </BottomSheet>

    {/* Editor giocatore, si apre sopra */}
    <PlayerEditSheet
      open={editOpen}
      onClose={() => setEditOpen(false)}
      player={player}
      onSaved={() => {
        setEditOpen(false)
        onUpdated?.()
      }}
    />

    {/* Scheda tecnica giocatore */}
    <PlayerAssessmentSheet
      open={assessOpen}
      onClose={() => setAssessOpen(false)}
      player={player ? {
        id: player.id,
        first_name: player.firstName,
        last_name: player.lastName,
        birth_date: player.birthDate || '',
        position: player.position,
        dominant_foot: player.dominantFoot,
        secondary_positions: player.secondaryPositions,
        height_cm: player.heightCm,
        weight_kg: player.weightKg,
        shoe_size: player.shoeSize,
        sex: player.sex,
        team_id: player.teamId || '',
        team: player.category ? { name: player.category, age_range: null, category: player.category } : null,
      } : null}
      canEdit={canEdit}
      onSaved={() => onUpdated?.()}
    />
    </>
  )
}

function InfoTile({ label, value, action, icon }: { label: string; value: string; action?: string; icon?: string }) {
  const content = (
    <>
      <p style={{ fontSize: 10, color: '#707882', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0, fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ fontSize: 12.5, color: '#181c20', margin: '3px 0 0', fontWeight: 600, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && action && <Icon name={icon} size={12} color="#005f98" />}
        {value}
      </p>
    </>
  )
  const style: React.CSSProperties = {
    padding: 10, borderRadius: 10, background: '#f7f9ff',
    minWidth: 0, textDecoration: 'none', color: 'inherit', display: 'block',
  }
  if (action) {
    return <a href={action} style={style}>{content}</a>
  }
  return <div style={style}>{content}</div>
}
