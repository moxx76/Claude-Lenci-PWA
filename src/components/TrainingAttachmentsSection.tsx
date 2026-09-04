import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { PRINCIPI_GIOCO, SOTTO_PRINCIPI_GIOCO, TAG_CONDIZIONALI, TAG_TECNICI } from './PrincipioSelect'

export interface TrainingAttachment {
  id: string
  training_id: string
  kind: 'image' | 'pdf' | 'other'
  filename: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  caption: string | null
  tags: string[]
  uploaded_by: string | null
  created_at: string
  signed_url?: string  // caricato on-demand
}

interface Props {
  trainingId: string | null    // se null → readonly + nulla da mostrare
  canEdit: boolean             // solo staff può caricare/eliminare
  reloadKey?: number           // per forzare refetch dall'esterno
}

const MAX_FILE_MB = 15  // limite ragionevole per foto+PDF
const ACCEPT_MIME = 'image/*,application/pdf'

// Suggerimenti tag: usa le stesse categorie della metodologia
// (principi e sotto principi di gioco già usati nelle sedute)
// così i tag sono semanticamente allineati e permettono di ritrovare
// facilmente i materiali di riferimento per ciascun principio.

export function TrainingAttachmentsSection({ trainingId, canEdit, reloadKey }: Props) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [attachments, setAttachments] = useState<TrainingAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)  // per lightbox immagini
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null)  // id allegato in editing tag
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!trainingId) { setAttachments([]); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId, reloadKey])

  const load = async () => {
    if (!trainingId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('training_attachments')
        .select('*')
        .eq('training_id', trainingId)
        .order('created_at', { ascending: false })
      if (err) throw err
      const rows = (data ?? []) as TrainingAttachment[]
      // Genero signed URL per ognuno (valido 1h) + default tags=[] se null
      const withUrls = await Promise.all(rows.map(async r => {
        const { data: signed } = await supabase.storage
          .from('training-attachments')
          .createSignedUrl(r.storage_path, 3600)
        return { ...r, tags: r.tags || [], signed_url: signed?.signedUrl }
      }))
      setAttachments(withUrls)
    } catch (e: any) {
      setError(e.message || 'Errore nel caricare gli allegati')
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !trainingId) return
    setError(null)

    // Validazione dimensione
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File troppo grande (max ${MAX_FILE_MB} MB)`)
      showToast(`File troppo grande (max ${MAX_FILE_MB} MB)`, 'error')
      resetInputs()
      return
    }

    // Determino kind
    const kind: TrainingAttachment['kind'] =
      file.type.startsWith('image/') ? 'image' :
      file.type === 'application/pdf' ? 'pdf' : 'other'

    setUploading(true)
    try {
      // Path unico dentro cartella training_id
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const uniq = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const path = `${trainingId}/${uniq}.${ext}`

      // Upload al bucket
      const { error: upErr } = await supabase.storage
        .from('training-attachments')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr

      // INSERT metadati
      const { error: insErr } = await supabase.from('training_attachments').insert({
        training_id: trainingId,
        kind,
        filename: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: profile?.id ?? null,
      })
      if (insErr) {
        // Se INSERT fallisce, cancello il file appena caricato per evitare orfani
        await supabase.storage.from('training-attachments').remove([path])
        throw insErr
      }

      showToast('Allegato caricato', 'success')
      await load()
    } catch (e: any) {
      const msg = e.message || 'Errore durante il caricamento'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setUploading(false)
      resetInputs()
    }
  }

  const resetInputs = () => {
    if (galleryRef.current) galleryRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    if (pdfRef.current) pdfRef.current.value = ''
  }

  const handleDelete = async (att: TrainingAttachment) => {
    if (!confirm(`Rimuovere "${att.filename}"?`)) return
    try {
      // Elimino prima la row (RLS-checked), poi il file storage
      const { error: delErr } = await supabase.from('training_attachments').delete().eq('id', att.id)
      if (delErr) throw delErr
      await supabase.storage.from('training-attachments').remove([att.storage_path])
      showToast('Allegato rimosso', 'success')
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch (e: any) {
      showToast(e.message || 'Errore rimozione allegato', 'error')
    }
  }

  const handleSaveTags = async (attId: string, newTags: string[]) => {
    // Normalizzo: trim + lowercase per confronto, ma preservo scritta originale, dedup case-insensitive
    const seen = new Set<string>()
    const cleaned: string[] = []
    for (const t of newTags) {
      const trimmed = t.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      cleaned.push(trimmed)
    }
    try {
      const { error: err } = await supabase
        .from('training_attachments')
        .update({ tags: cleaned })
        .eq('id', attId)
      if (err) throw err
      setAttachments(prev => prev.map(a => a.id === attId ? { ...a, tags: cleaned } : a))
      setEditingTagsId(null)
      showToast('Tag salvati', 'success')
    } catch (e: any) {
      showToast(e.message || 'Errore salvataggio tag', 'error')
    }
  }

  if (!trainingId) return null
  if (!canEdit && attachments.length === 0 && !loading) return null

  return (
    <div style={{
      background: '#f7f9ff', borderRadius: 12, padding: 12,
      border: '1px solid #d5e5ff',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: '#004a78',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="attachment" size={13} color="#004a78" />
        Allegati {attachments.length > 0 && `(${attachments.length})`}
      </div>

      {/* Bottoni upload */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: attachments.length > 0 ? 12 : 0 }}>
          <button onClick={() => galleryRef.current?.click()} disabled={uploading}
            style={uploadBtnStyle('#005f98', '#fff')}>
            <Icon name="photo_library" size={13} color="#fff" />
            Foto da galleria
          </button>
          <button onClick={() => cameraRef.current?.click()} disabled={uploading}
            style={uploadBtnStyle('#fff', '#005f98', '1px solid #005f98')}>
            <Icon name="photo_camera" size={13} color="#005f98" />
            Scatta foto
          </button>
          <button onClick={() => pdfRef.current?.click()} disabled={uploading}
            style={uploadBtnStyle('#7a0071', '#fff')}>
            <Icon name="picture_as_pdf" size={13} color="#fff" />
            PDF
          </button>
          {uploading && (
            <span style={{ fontSize: 11, color: '#404751', alignSelf: 'center' }}>
              Carico…
            </span>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={galleryRef} type="file" accept="image/*"
        onChange={handleFile} style={{ display: 'none' }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        onChange={handleFile} style={{ display: 'none' }} />
      <input ref={pdfRef} type="file" accept="application/pdf"
        onChange={handleFile} style={{ display: 'none' }} />

      {error && (
        <div style={{
          background: '#ffe4e4', color: '#93000a', padding: '6px 10px',
          borderRadius: 6, fontSize: 11.5, marginBottom: 8,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Empty state (solo per staff, se readonly non mostro nulla) */}
      {!loading && attachments.length === 0 && canEdit && (
        <div style={{
          fontSize: 11.5, color: '#707882', fontStyle: 'italic',
          textAlign: 'center', padding: '10px 4px',
        }}>
          Nessun allegato. Aggiungi schemi, foto lavagna, o PDF di riferimento (max {MAX_FILE_MB} MB).
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 11.5, color: '#707882', textAlign: 'center', padding: 10 }}>
          Carico allegati…
        </div>
      )}

      {/* Griglia allegati */}
      {attachments.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8,
        }}>
          {attachments.map(att => (
            <AttachmentCard key={att.id}
              attachment={att}
              canDelete={canEdit}
              canEditTags={canEdit}
              isEditingTags={editingTagsId === att.id}
              onStartEditTags={() => setEditingTagsId(att.id)}
              onCancelEditTags={() => setEditingTagsId(null)}
              onSaveTags={(tags) => handleSaveTags(att.id, tags)}
              onPreview={() => att.kind === 'image' && att.signed_url && setPreviewUrl(att.signed_url)}
              onDelete={() => handleDelete(att)}
            />
          ))}
        </div>
      )}

      {/* Lightbox immagini */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 16,
          }}
        >
          <img src={previewUrl} alt="Anteprima"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}

function AttachmentCard({
  attachment: att, canDelete, canEditTags,
  isEditingTags, onStartEditTags, onCancelEditTags, onSaveTags,
  onPreview, onDelete,
}: {
  attachment: TrainingAttachment
  canDelete: boolean
  canEditTags: boolean
  isEditingTags: boolean
  onStartEditTags: () => void
  onCancelEditTags: () => void
  onSaveTags: (tags: string[]) => void
  onPreview: () => void
  onDelete: () => void
}) {
  const isImage = att.kind === 'image'
  const isPdf = att.kind === 'pdf'
  const hasTags = att.tags && att.tags.length > 0

  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #e6e8ee',
      overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Thumb / icona */}
      {isImage && att.signed_url ? (
        <button onClick={onPreview}
          style={{
            display: 'block', width: '100%', aspectRatio: '1', border: 'none',
            padding: 0, cursor: 'zoom-in', background: '#f1f3fa', overflow: 'hidden',
          }}>
          <img src={att.signed_url} alt={att.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </button>
      ) : (
        <a href={att.signed_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', aspectRatio: '1',
            background: isPdf ? '#f5e6f0' : '#f1f3fa',
            color: isPdf ? '#7a0071' : '#404751', textDecoration: 'none',
            gap: 4,
          }}>
          <Icon name={isPdf ? 'picture_as_pdf' : 'insert_drive_file'} size={40}
            color={isPdf ? '#7a0071' : '#404751'} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4 }}>
            {isPdf ? 'APRI PDF' : 'APRI FILE'}
          </span>
        </a>
      )}

      {/* Nome file + delete */}
      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#181c20',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }} title={att.filename}>
            {att.filename}
          </div>
          {att.size_bytes && (
            <div style={{ fontSize: 9.5, color: '#707882' }}>
              {formatSize(att.size_bytes)}
            </div>
          )}
        </div>
        {canDelete && (
          <button onClick={onDelete} title="Rimuovi allegato"
            style={{
              padding: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#c62828',
            }}>
            <Icon name="delete" size={14} color="#c62828" />
          </button>
        )}
      </div>

      {/* Tag: mostra pill se ne ha, altrimenti mostra "aggiungi tag" (solo staff) */}
      <div style={{
        padding: '0 8px 8px', borderTop: hasTags || isEditingTags ? '1px solid #f1f3fa' : 'none',
        paddingTop: hasTags || isEditingTags ? 8 : 0,
      }}>
        {isEditingTags ? (
          <TagsEditor initial={att.tags} onSave={onSaveTags} onCancel={onCancelEditTags} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {att.tags?.map(t => {
              const lower = t.toLowerCase()
              const isPrincipio = PRINCIPI_GIOCO.some(x => x.toLowerCase() === lower)
              const isSotto = SOTTO_PRINCIPI_GIOCO.some(x => x.toLowerCase() === lower)
              const isCondizionale = TAG_CONDIZIONALI.some(x => x.toLowerCase() === lower)
              const isTecnico = TAG_TECNICI.some(x => x.toLowerCase() === lower)
              let bg = '#f1f3fa'; let color = '#404751'
              if (isPrincipio)         { bg = '#eef7ff'; color = '#004a78' }
              else if (isSotto)        { bg = '#faedf7'; color = '#5c0057' }
              else if (isCondizionale) { bg = '#fff4e6'; color = '#7c4700' }
              else if (isTecnico)      { bg = '#e8f5e9'; color = '#1b5e20' }
              return (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: bg, color,
                }}>{t}</span>
              )
            })}
            {canEditTags && (
              <button type="button" onClick={onStartEditTags}
                title={hasTags ? 'Modifica tag' : 'Aggiungi tag'}
                style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: 'transparent',
                  color: '#005f98', border: '1px dashed #a0c4e6',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                <Icon name={hasTags ? 'edit' : 'add'} size={10} color="#005f98" />
                {hasTags ? 'Modifica tag' : 'Aggiungi tag'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TagsEditor({ initial, onSave, onCancel }: {
  initial: string[]
  onSave: (tags: string[]) => void
  onCancel: () => void
}) {
  const [tags, setTags] = useState<string[]>(initial || [])
  const [input, setInput] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    principi: true, sotto: false, condizionali: true, tecnici: true,
  })

  // AUTOSALVATAGGIO: ogni volta che cambia l'array tags, persiste subito.
  // Elimina l'ambiguità del vecchio flusso in cui l'utente dimenticava di cliccare "Salva".
  // Skip il salvataggio al primo render (quando tags = initial).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    onSave(tags)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags])

  const addTag = (t: string) => {
    const trimmed = t.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (tags.some(x => x.toLowerCase() === lower)) return
    setTags([...tags, trimmed])
    setInput('')
  }

  const removeTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  // Se l'utente chiude senza aver aggiunto il testo digitato, lo aggiungo automaticamente
  // così non si perde una modifica in corso di digitazione
  const handleClose = () => {
    if (input.trim()) addTag(input)
    onCancel()
  }

  // Filtro suggerimenti: escludo già selezionati (case-insensitive) e opzionalmente filtro per input
  const q = input.trim().toLowerCase()
  const filterAvailable = (list: string[]) => list.filter(s => {
    if (tags.some(t => t.toLowerCase() === s.toLowerCase())) return false
    if (q && !s.toLowerCase().includes(q)) return false
    return true
  })
  const availPrincipi = filterAvailable(PRINCIPI_GIOCO)
  const availSottoPrincipi = filterAvailable(SOTTO_PRINCIPI_GIOCO)
  const availCondizionali = filterAvailable(TAG_CONDIZIONALI)
  const availTecnici = filterAvailable(TAG_TECNICI)

  // Con ricerca attiva apro tutte le sezioni
  const searchActive = q.length > 0

  // Categorizzo tag selezionato per colore chip
  type TagKind = 'principio' | 'sotto' | 'condizionale' | 'tecnico' | 'custom'
  const tagKind = (t: string): TagKind => {
    const lower = t.toLowerCase()
    if (PRINCIPI_GIOCO.some(x => x.toLowerCase() === lower)) return 'principio'
    if (SOTTO_PRINCIPI_GIOCO.some(x => x.toLowerCase() === lower)) return 'sotto'
    if (TAG_CONDIZIONALI.some(x => x.toLowerCase() === lower)) return 'condizionale'
    if (TAG_TECNICI.some(x => x.toLowerCase() === lower)) return 'tecnico'
    return 'custom'
  }
  const tagChipStyle = (kind: TagKind): React.CSSProperties => {
    switch (kind) {
      case 'principio':    return { background: '#005f98', color: '#fff' }
      case 'sotto':        return { background: '#7a0071', color: '#fff' }
      case 'condizionale': return { background: '#c47f00', color: '#fff' }
      case 'tecnico':      return { background: '#2e7d32', color: '#fff' }
      case 'custom':       return { background: '#404751', color: '#fff' }
    }
  }

  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Helper per render sezione suggerimenti
  const SuggestSection = ({
    id, label, count, headerBg, chipColor, chipBorder, items,
  }: {
    id: string; label: string; count: number
    headerBg: string; chipColor: string; chipBorder: string
    items: string[]
  }) => {
    if (count === 0) return null
    const expanded = openSections[id] || searchActive
    return (
      <div>
        <button type="button" onClick={() => toggle(id)}
          style={{
            width: '100%', padding: '4px 6px', borderRadius: 6,
            background: headerBg, color: '#fff', border: 'none',
            fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4,
            textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
          <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={12} color="#fff" />
          {label} ({count})
        </button>
        {expanded && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {items.map(s => (
              <button key={s} type="button" onClick={() => addTag(s)}
                style={{
                  fontSize: 9.5, fontWeight: 700,
                  padding: '3px 7px', borderRadius: 999,
                  background: '#fff', color: chipColor,
                  border: `1px solid ${chipBorder}`, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: '#f7f9ff', border: '1px solid #d5e5ff',
      borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Tag selezionati (con colori distintivi in base al tipo) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 20 }}>
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} style={{
            fontSize: 10, fontWeight: 700,
            padding: '3px 4px 3px 8px', borderRadius: 999,
            ...tagChipStyle(tagKind(t)),
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {t}
            <button type="button" onClick={() => removeTag(i)}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)', color: '#fff',
                border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900,
              }}>×</button>
          </span>
        ))}
        {tags.length === 0 && (
          <span style={{ fontSize: 10, color: '#707882', fontStyle: 'italic' }}>
            Tocca un suggerimento sotto per aggiungere un tag (salvato subito)
          </span>
        )}
      </div>

      {/* Input per tag personalizzati / ricerca nei suggerimenti */}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Cerca o scrivi un tag personalizzato…"
        style={{
          width: '100%', padding: '5px 8px', borderRadius: 6,
          border: '1px solid #c0c7d2', fontSize: 11,
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
        autoFocus
      />

      <SuggestSection id="principi" label="Principi di gioco"
        count={availPrincipi.length} items={availPrincipi}
        headerBg="#005f98" chipColor="#005f98" chipBorder="#a0c4e6" />
      <SuggestSection id="sotto" label="Sotto principi"
        count={availSottoPrincipi.length} items={availSottoPrincipi}
        headerBg="#7a0071" chipColor="#7a0071" chipBorder="#e6a3dd" />
      <SuggestSection id="condizionali" label="Condizionali"
        count={availCondizionali.length} items={availCondizionali}
        headerBg="#c47f00" chipColor="#7c4700" chipBorder="#ffe0a3" />
      <SuggestSection id="tecnici" label="Tecnici"
        count={availTecnici.length} items={availTecnici}
        headerBg="#2e7d32" chipColor="#1b5e20" chipBorder="#a5d6a7" />

      {/* Info autosave + chiudi */}
      <div style={{
        display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center',
        marginTop: 2, paddingTop: 4, borderTop: '1px dashed #d5e5ff',
      }}>
        <span style={{ fontSize: 9.5, color: '#2e7d32', fontStyle: 'italic', fontWeight: 700 }}>
          ✓ Salvataggio automatico
        </span>
        <button type="button" onClick={handleClose}
          style={{
            padding: '4px 14px', borderRadius: 6, border: 'none',
            background: '#005f98', color: '#fff',
            fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}>Chiudi</button>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const uploadBtnStyle = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 999,
  background: bg, color: fg, border: border || 'none',
  fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: 4,
})
